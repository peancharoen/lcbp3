# Testing Strategy

---

title: 'Testing Strategy'
version: 1.8.0
status: first-draft
owner: Nattanin Peancharoen
last_updated: 2025-11-30
related:

- specs/03-implementation/backend-guidelines.md
- specs/03-implementation/frontend-guidelines.md
- specs/02-architecture/system-architecture.md

---

## 📋 Overview

เอกสารนี้กำหนดกลยุทธ์การทดสอบสำหรับโปรเจกต์ LCBP3-DMS เพื่อให้มั่นใจในคุณภาพ ความถูกต้อง และความปลอดภัยของระบบ

### Testing Philosophy

> **"Quality First, Test Everything That Matters"**

เราเน้นการทดสอบที่มีความหมาย ไม่ใช่แค่เพิ่มตัวเลข Coverage แต่เป็นการทดสอบที่ช่วยป้องกันบั๊กจริง และให้ความมั่นใจว่าระบบทำงานถูกต้อง

### Key Principles

1. **Test Early, Test Often** - เขียน Test ควบคู่กับ Code
2. **Critical Path First** - ทดสอบ Business Logic สำคัญก่อน
3. **Automated Testing** - Automate ทุกอย่างที่ทำซ้ำได้
4. **Fast Feedback** - Unit Tests ต้องรวดเร็ว (< 5 วินาที)
5. **Real-World Scenarios** - E2E Tests ต้องใกล้เคียงกับการใช้งานจริง

---

## 🎯 Testing Pyramid

```
                    /\
                   /  \
                  / E2E \            ~10%
                 /--------\
                /          \
               / Integration \       ~30%
              /--------------\
             /                \
            /   Unit Tests     \    ~60%
           /--------------------\
```

### Test Distribution

| Level       | Coverage | Speed      | Purpose                      |
| ----------- | -------- | ---------- | ---------------------------- |
| Unit        | 60%      | Fast (ms)  | ทดสอบตรรกะแต่ละ Function      |
| Integration | 30%      | Medium (s) | ทดสอบการทำงานร่วมกันของ Modules |
| E2E         | 10%      | Slow (m)   | ทดสอบ User Journey ทั้งหมด     |

---

## 🧪 Backend Testing (NestJS)

### 1. Unit Testing

**Tools:** Jest, @nestjs/testing

**Target Coverage:** 80% สำหรับ Services, Utilities, Guards

#### 1.1 Service Unit Tests

```typescript
// File: src/modules/correspondence/services/correspondence.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CorrespondenceService } from './correspondence.service';
import { Correspondence } from '../entities/correspondence.entity';
import { Repository } from 'typeorm';

describe('CorrespondenceService', () => {
  let service: CorrespondenceService;
  let repository: Repository<Correspondence>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CorrespondenceService,
        {
          provide: getRepositoryToken(Correspondence),
          useClass: Repository,
        },
      ],
    }).compile();

    service = module.get<CorrespondenceService>(CorrespondenceService);
    repository = module.get<Repository<Correspondence>>(
      getRepositoryToken(Correspondence)
    );
  });

  describe('findAll', () => {
    it('should return an array of correspondences', async () => {
      const mockCorrespondences = [
        { id: '1', title: 'Test 1' },
        { id: '2', title: 'Test 2' },
      ];

      jest
        .spyOn(repository, 'find')
        .mockResolvedValue(mockCorrespondences as any);

      const result = await service.findAll();
      expect(result).toEqual(mockCorrespondences);
      expect(repository.find).toHaveBeenCalled();
    });

    it('should throw error when repository fails', async () => {
      jest.spyOn(repository, 'find').mockRejectedValue(new Error('DB Error'));

      await expect(service.findAll()).rejects.toThrow('DB Error');
    });
  });
});
```

#### 1.2 Guard/Interceptor Unit Tests

```typescript
// File: src/common/guards/rbac.guard.spec.ts
describe('RBACGuard', () => {
  let guard: RBACGuard;
  let abilityFactory: AbilityFactory;

  beforeEach(() => {
    abilityFactory = new AbilityFactory();
    guard = new RBACGuard(abilityFactory);
  });

  it('should allow access when user has permission', () => {
    const context = createMockExecutionContext({
      user: { role: 'admin', permissions: ['correspondence.create'] },
      handler: createMockHandler({ permission: 'correspondence.create' }),
    });

    expect(guard.canActivate(context)).toBe(true);
  });

  it('should deny access when user lacks permission', () => {
    const context = createMockExecutionContext({
      user: { role: 'viewer', permissions: ['correspondence.view'] },
      handler: createMockHandler({ permission: 'correspondence.create' }),
    });

    expect(guard.canActivate(context)).toBe(false);
  });
});
```

#### 1.3 Critical Business Logic Tests

**Document Numbering Concurrency Test:**

```typescript
// File: src/modules/document-numbering/services/numbering.service.spec.ts
describe('DocumentNumberingService - Concurrency', () => {
  it('should generate unique numbers for concurrent requests', async () => {
    const context = {
      projectId: '1',
      organizationId: '1',
      typeId: '1',
      year: 2025,
    };

    // จำลอง 100 requests พร้อมกัน
    const promises = Array(100)
      .fill(null)
      .map(() => service.generateNextNumber(context));

    const results = await Promise.all(promises);

    // ตรวจสอบว่าไม่มีเลขซ้ำ
    const uniqueNumbers = new Set(results);
    expect(uniqueNumbers.size).toBe(100);

    // ตรวจสอบว่าเรียงลำดับถูกต้อง
    const sorted = [...results].sort();
    expect(results).toEqual(sorted);
  });
});
```

**Idempotency Test:**

```typescript
describe('IdempotencyInterceptor', () => {
  it('should return cached result for duplicate request', async () => {
    const idempotencyKey = 'test-key-123';
    const mockResponse = { id: '1', title: 'Test' };

    // Request 1
    const result1 = await invokeInterceptor(idempotencyKey, mockResponse);
    expect(result1).toEqual(mockResponse);

    // Request 2 (same key)
    const result2 = await invokeInterceptor(idempotencyKey, mockResponse);
    expect(result2).toEqual(mockResponse);

    // Verify business logic only executed once
    expect(mockBusinessLogic).toHaveBeenCalledTimes(1);
  });
});
```

---

### 2. Integration Testing

**Tools:** Jest, Supertest, In-Memory Database

**Target:** ทดสอบ API Endpoints พร้อม Database interactions

#### 2.1 API Integration Test

```typescript
// File: test/correspondence.e2e-spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';
import { v4 as uuidv4 } from 'uuid';

describe('Correspondence API (e2e)', () => {
  let app: INestApplication;
  let authToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    // Login to get token
    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: 'testuser', password: 'password123' });

    authToken = loginResponse.body.access_token;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /correspondences', () => {
    it('should create correspondence with valid data', async () => {
      const createDto = {
        title: 'E2E Test Correspondence',
        project_id: '1',
        correspondence_type_id: '1',
      };

      const response = await request(app.getHttpServer())
        .post('/correspondences')
        .set('Authorization', `Bearer ${authToken}`)
        .send(createDto)
        .expect(201);

      expect(response.body).toMatchObject({
        id: expect.any(String),
        title: createDto.title,
        correspondence_number: expect.stringMatching(/^TEAM-RFA-\d{4}-\d{4}$/),
      });
    });

    it('should enforce idempotency', async () => {
      const idempotencyKey = uuidv4();
      const createDto = {
        title: 'Idempotency Test',
        project_id: '1',
        correspondence_type_id: '1',
      };

      // Request 1
      const response1 = await request(app.getHttpServer())
        .post('/correspondences')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Idempotency-Key', idempotencyKey)
        .send(createDto)
        .expect(201);

      // Request 2 (same key)
      const response2 = await request(app.getHttpServer())
        .post('/correspondences')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Idempotency-Key', idempotencyKey)
        .send(createDto)
        .expect(201);

      // Should return same entity
      expect(response1.body.id).toBe(response2.body.id);
    });

    it('should validate input data', async () => {
      const invalidDto = {
        title: '', // Empty title
      };

      await request(app.getHttpServer())
        .post('/correspondences')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidDto)
        .expect(400);
    });

    it('should enforce RBAC permissions', async () => {
      // Login as viewer (no create permission)
      const viewerResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ username: 'viewer', password: 'password123' });

      const createDto = {
        title: 'Test',
        project_id: '1',
        correspondence_type_id: '1',
      };

      await request(app.getHttpServer())
        .post('/correspondences')
        .set('Authorization', `Bearer ${viewerResponse.body.access_token}`)
        .send(createDto)
        .expect(403);
    });
  });

  describe('File Upload Flow', () => {
    it('should complete two-phase file upload', async () => {
      // Phase 1: Upload to temp
      const uploadResponse = await request(app.getHttpServer())
        .post('/attachments/upload')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('file', Buffer.from('test file content'), 'test.pdf')
        .expect(201);

      const tempId = uploadResponse.body.temp_id;
      expect(tempId).toBeDefined();

      // Phase 2: Commit with correspondence
      const createResponse = await request(app.getHttpServer())
        .post('/correspondences')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Test with Attachment',
          project_id: '1',
          correspondence_type_id: '1',
          temp_file_ids: [tempId],
        })
        .expect(201);

      // Verify attachment is committed
      const attachments = await request(app.getHttpServer())
        .get(`/correspondences/${createResponse.body.id}/attachments`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(attachments.body).toHaveLength(1);
      expect(attachments.body[0].is_temporary).toBe(false);
    });
  });
});
```

---

### 3. Database Testing

#### 3.1 Migration Tests

```typescript
// File: test/migrations/migration.spec.ts
describe('Database Migrations', () => {
  it('should run all migrations without error', async () => {
    const dataSource = await createTestDataSource();
    await expect(dataSource.runMigrations()).resolves.not.toThrow();
    await dataSource.destroy();
  });

  it('should rollback migrations successfully', async () => {
    const dataSource = await createTestDataSource();
    await dataSource.runMigrations();
    await expect(dataSource.undoLastMigration()).resolves.not.toThrow();
    await dataSource.destroy();
  });
});
```

#### 3.2 Transaction Tests

```typescript
describe('Transaction Handling', () => {
  it('should rollback on error', async () => {
    const initialCount = await correspondenceRepo.count();

    await expect(
      service.createWithError({
        /* invalid data */
      })
    ).rejects.toThrow();

    const finalCount = await correspondenceRepo.count();
    expect(finalCount).toBe(initialCount); // No change
  });
});
```

---

### 4. Performance Testing

**Tools:** Artillery, k6, Jest with timing

#### 4.1 Load Testing Configuration

```yaml
# File: test/load/correspondence-load.yml
config:
  target: 'http://localhost:3000'
  phases:
    - duration: 60
      arrivalRate: 10 # 10 requests/second
    - duration: 120
      arrivalRate: 50 # Ramp up to 50 requests/second
  processor: './load-test-processor.js'

scenarios:
  - name: 'Create Correspondence'
    weight: 40
    flow:
      - post:
          url: '/correspondences'
          headers:
            Authorization: 'Bearer {{ authToken }}'
            Idempotency-Key: '{{ $uuid }}'
          json:
            title: 'Load Test {{ $randomString() }}'
            project_id: '{{ projectId }}'
            correspondence_type_id: '{{ typeId }}'

  - name: 'Search Correspondences'
    weight: 60
    flow:
      - get:
          url: '/correspondences?project_id={{ projectId }}'
          headers:
            Authorization: 'Bearer {{ authToken }}'
```

#### 4.2 Query Performance Tests

```typescript
describe('Performance - Database Queries', () => {
  it('should fetch 1000 correspondences in < 100ms', async () => {
    const startTime = Date.now();
    await service.findAll({ limit: 1000 });
    const duration = Date.now() - startTime;

    expect(duration).toBeLessThan(100);
  });

  it('should use proper indexes for search', async () => {
    const queryPlan = await repository.query(
      `EXPLAIN SELECT * FROM correspondences
       WHERE project_id = ? AND deleted_at IS NULL`,
      ['1']
    );

    expect(queryPlan[0].key).toBe('idx_project_deleted');
  });
});
```

---

## 🎨 Frontend Testing (Next.js)

### 1. Component Testing

**Tools:** Vitest, React Testing Library

**Target Coverage:** 70% สำหรับ Shared Components

#### 1.1 UI Component Tests

```tsx
// File: components/forms/correspondence-form.spec.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CorrespondenceForm } from './correspondence-form';

describe('CorrespondenceForm', () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  it('should render all required fields', () => {
    render(<CorrespondenceForm />, { wrapper });

    expect(screen.getByLabelText('หัวเรื่อง')).toBeInTheDocument();
    expect(screen.getByLabelText('โปรเจกต์')).toBeInTheDocument();
    expect(screen.getByLabelText('ประเภทเอกสาร')).toBeInTheDocument();
  });

  it('should show validation errors on submit without data', async () => {
    const onSubmit = vi.fn();
    render(<CorrespondenceForm onSubmit={onSubmit} />, { wrapper });

    const submitButton = screen.getByRole('button', { name: /บันทึก/i });
    fireEvent.click(submitButton);

    expect(await screen.findByText('กรุณาระบุหัวเรื่อง')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('should submit form with valid data', async () => {
    const onSubmit = vi.fn();
    render(<CorrespondenceForm onSubmit={onSubmit} />, { wrapper });

    // Fill form
    const titleInput = screen.getByLabelText('หัวเรื่อง');
    fireEvent.change(titleInput, { target: { value: 'Test Title' } });

    const projectSelect = screen.getByLabelText('โปรเจกต์');
    fireEvent.change(projectSelect, { target: { value: 'project-1' } });

    const typeSelect = screen.getByLabelText('ประเภทเอกสาร');
    fireEvent.change(typeSelect, { target: { value: 'type-1' } });

    // Submit
    const submitButton = screen.getByRole('button', { name: /บันทึก/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Test Title',
          project_id: 'project-1',
          correspondence_type_id: 'type-1',
        })
      );
    });
  });

  it('should auto-save draft every 30 seconds', async () => {
    vi.useFakeTimers();
    const saveDraft = vi.fn();

    render(<CorrespondenceForm onSaveDraft={saveDraft} />, { wrapper });

    const titleInput = screen.getByLabelText('หัวเรื่อง');
    fireEvent.change(titleInput, { target: { value: 'Draft Test' } });

    // Fast-forward 30 seconds
    vi.advanceTimersByTime(30000);

    await waitFor(() => {
      expect(saveDraft).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Draft Test' })
      );
    });

    vi.useRealTimers();
  });
});
```

#### 1.2 Custom Hook Tests

```tsx
// File: lib/hooks/use-correspondence.spec.ts
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useCorrespondences } from './use-correspondence';
import { correspondenceService } from '@/lib/services/correspondence.service';

vi.mock('@/lib/services/correspondence.service');

describe('useCorrespondences', () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  it('should fetch correspondences successfully', async () => {
    const mockData = [
      { id: '1', title: 'Test 1' },
      { id: '2', title: 'Test 2' },
    ];

    vi.mocked(correspondenceService.getAll).mockResolvedValue(mockData);

    const { result } = renderHook(() => useCorrespondences('project-1'), {
      wrapper,
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(mockData);
  });

  it('should handle error state', async () => {
    vi.mocked(correspondenceService.getAll).mockRejectedValue(
      new Error('API Error')
    );

    const { result } = renderHook(() => useCorrespondences('project-1'), {
      wrapper,
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBeDefined();
  });
});
```

---

### 2. E2E Testing

**Tools:** Playwright

**Target:** ทดสอบ Critical User Journeys

#### 2.1 E2E Test Configuration

```typescript
// File: frontend/playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
});
```

#### 2.2 Critical User Journey Tests

```typescript
// File: e2e/correspondence-workflow.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Correspondence Complete Workflow', () => {
  test.beforeEach(async ({ page }) => {
    // Login
    await page.goto('/login');
    await page.fill('input[name="username"]', 'testuser');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');
  });

  test('should create, edit, and submit correspondence', async ({ page }) => {
    // 1. Navigate to create page
    await page.click('text=สร้างเอกสาร');
    await page.waitForURL('/correspondences/new');

    // 2. Fill form
    await page.fill('input[name="title"]', 'E2E Test Correspondence');
    await page.selectOption('select[name="project_id"]', { index: 1 });
    await page.selectOption('select[name="type_id"]', { index: 1 });
    await page.fill('textarea[name="description"]', 'E2E Test Description');

    // 3. Upload attachment
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles('test-fixtures/sample.pdf');
    await expect(page.locator('text=sample.pdf')).toBeVisible();

    // 4. Save as draft
    await page.click('button:has-text("บันทึกแบบร่าง")');
    await expect(page.locator('text=บันทึกแบบร่างสำเร็จ')).toBeVisible();

    // 5. Edit draft
    const docId = page.url().match(/correspondences\/([^/]+)/)?.[1];
    await page.goto(`/correspondences/${docId}/edit`);
    await page.fill('input[name="title"]', 'E2E Test Correspondence (Edited)');

    // 6. Submit for approval
    await page.click('button:has-text("ส่งอนุมัติ")');
    await page.waitForSelector('text=ยืนยันการส่งเอกสาร');
    await page.click('button:has-text("ยืนยัน")');

    // 7. Verify status changed
    await expect(page.locator('text=รอการอนุมัติ')).toBeVisible();
  });

  test('should support offline draft save', async ({ page, context }) => {
    await page.goto('/correspondences/new');

    // Fill form
    await page.fill('input[name="title"]', 'Offline Test');

    // Go offline
    await context.setOffline(true);

    // Trigger auto-save
    await page.waitForTimeout(31000); // Wait for auto-save (30s)

    // Verify draft saved to localStorage
    const localStorage = await page.evaluate(() => window.localStorage);
    expect(localStorage).toHaveProperty('correspondence-drafts');

    // Go back online
    await context.setOffline(false);

    // Reload page
    await page.reload();

    // Verify draft restored
    const titleValue = await page.inputValue('input[name="title"]');
    expect(titleValue).toBe('Offline Test');
  });

  test('should handle responsive design', async ({ page }) => {
    await page.goto('/correspondences');

    // Desktop view - should show table
    await page.setViewportSize({ width: 1280, height: 720 });
    await expect(page.locator('table')).toBeVisible();

    // Mobile view - should show card layout
    await page.setViewportSize({ width: 375, height: 667 });
    await expect(page.locator('table')).not.toBeVisible();
    await expect(page.locator('[data-testid="card-view"]')).toBeVisible();
  });
});
```

---

## 🔒 Security Testing

### 1. OWASP Top 10 Testing

#### 1.1 SQL Injection Protection

```typescript
describe('Security - SQL Injection', () => {
  it('should prevent SQL injection in search', async () => {
    const maliciousInput = "'; DROP TABLE correspondences; --";

    const response = await request(app.getHttpServer())
      .get(`/correspondences/search?title=${maliciousInput}`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    // Should not execute malicious SQL
    const tableExists = await repository.query(
      `SHOW TABLES LIKE 'correspondences'`
    );
    expect(tableExists).toHaveLength(1);
  });
});
```

#### 1.2 XSS Protection

```typescript
test('should sanitize user input to prevent XSS', async ({ page }) => {
  await page.goto('/correspondences/new');

  const xssPayload = '<script>alert("XSS")</script>';
  await page.fill('input[name="title"]', xssPayload);
  await page.click('button[type="submit"]');

  // Verify script not executed
  const alerts = [];
  page.on('dialog', (dialog) => {
    alerts.push(dialog.message());
    dialog.dismiss();
  });

  await page.waitForTimeout(1000);
  expect(alerts).toHaveLength(0);

  // Verify content escaped
  const displayedTitle = await page.textContent('h1');
  expect(displayedTitle).not.toContain('<script>');
});
```

#### 1.3 CSRF Protection

```typescript
describe('Security - CSRF', () => {
  it('should reject requests without CSRF token', async () => {
    await request(app.getHttpServer())
      .post('/correspondences')
      .set('Authorization', `Bearer ${authToken}`)
      // No CSRF token
      .send({ title: 'Test' })
      .expect(403);
  });

  it('should accept requests with valid CSRF token', async () => {
    const csrfToken = await getCSRFToken(app);

    await request(app.getHttpServer())
      .post('/correspondences')
      .set('Authorization', `Bearer ${authToken}`)
      .set('X-CSRF-Token', csrfToken)
      .send({ title: 'Test' })
      .expect(201);
  });
});
```

---

### 2. Authentication & Authorization Testing

```typescript
describe('Security - Authentication', () => {
  it('should reject requests without token', async () => {
    await request(app.getHttpServer()).get('/correspondences').expect(401);
  });

  it('should reject expired tokens', async () => {
    const expiredToken = generateExpiredToken();

    await request(app.getHttpServer())
      .get('/correspondences')
      .set('Authorization', `Bearer ${expiredToken}`)
      .expect(401);
  });

  it('should enforce role-based access control', async () => {
    const viewerToken = await getTokenForRole('viewer');

    // Viewer can read
    await request(app.getHttpServer())
      .get('/correspondences')
      .set('Authorization', `Bearer ${viewerToken}`)
      .expect(200);

    // Viewer cannot create
    await request(app.getHttpServer())
      .post('/correspondences')
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({ title: 'Test' })
      .expect(403);
  });
});
```

---

## 📊 Test Coverage Requirements

### Minimum Coverage Targets

| Component         | Unit | Integration | E2E  | Total |
| ----------------- | ---- | ----------- | ---- | ----- |
| Services          | 85%  | 70%         | -    | 80%   |
| Controllers       | -    | 80%         | -    | 80%   |
| Guards/Middleware | 90%  | -           | -    | 90%   |
| Utilities         | 95%  | -           | -    | 95%   |
| UI Components     | 75%  | -           | -    | 75%   |
| Critical Flows    | -    | -           | 100% | 100%  |

### Critical Paths (Must have 100% coverage)

1. **Authentication & Authorization**

   - Login/Logout flow
   - Token refresh
   - RBAC permission checks

2. **Document Numbering**

   - Concurrent number generation
   - Format validation
   - Counter increment logic

3. **File Upload**

   - Two-phase upload
   - Virus scanning
   - File type validation
   - Orphan cleanup

4. **Workflow Engine**

   - State transitions
   - Permission checks at each step
   - Notification triggers

5. **Data Integrity**
   - Transaction rollback
   - Optimistic locking
   - Idempotency

---

## 🔄 CI/CD Integration

### GitHub Actions Workflow

```yaml
# File: .github/workflows/test.yml
name: Test Suite

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  backend-tests:
    runs-on: ubuntu-latest
    services:
      mariadb:
        image: mariadb:11.8
        env:
          MYSQL_ROOT_PASSWORD: test
          MYSQL_DATABASE: lcbp3_test
      redis:
        image: redis:7-alpine

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'

      - name: Install dependencies
        working-directory: ./backend
        run: npm ci

      - name: Run unit tests
        working-directory: ./backend
        run: npm run test:cov

      - name: Run integration tests
        working-directory: ./backend
        run: npm run test:e2e
        env:
          DATABASE_URL: mysql://root:test@localhost:3306/lcbp3_test
          REDIS_URL: redis://localhost:6379

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./backend/coverage/lcov.info

  frontend-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'

      - name: Install dependencies
        working-directory: ./frontend
        run: npm ci

      - name: Run unit tests
        working-directory: ./frontend
        run: npm run test:coverage

      - name: Run E2E tests
        working-directory: ./frontend
        run: npx playwright test
        env:
          CI: true

      - name: Upload Playwright report
        uses: actions/upload-artifact@v3
        if: always()
        with:
          name: playwright-report
          path: frontend/playwright-report/

  security-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Run Trivy vulnerability scanner
        uses: aquasecurity/trivy-action@master
        with:
          scan-type: 'fs'
          scan-ref: '.'
          format: 'sarif'
          output: 'trivy-results.sarif'

      - name: Upload Trivy results to GitHub Security
        uses: github/codeql-action/upload-sarif@v2
        with:
          sarif_file: 'trivy-results.sarif'
```

---

## 🛠️ Test Utilities & Helpers

### Database Test Helpers

```typescript
// File: test/helpers/database.helper.ts
import { DataSource } from 'typeorm';

export class DatabaseTestHelper {
  static async createTestDataSource(): Promise<DataSource> {
    const dataSource = new DataSource({
      type: 'mysql',
      host: 'localhost',
      port: 3306,
      username: 'root',
      password: 'test',
      database: 'lcbp3_test',
      entities: ['src/**/*.entity.ts'],
      synchronize: true,
      dropSchema: true,
    });

    await dataSource.initialize();
    return dataSource;
  }

  static async seedDatabase(dataSource: DataSource): Promise<void> {
    // Seed organizations
    await dataSource.query(`
      INSERT INTO organizations (organization_code, organization_name)
      VALUES ('TEAM', 'TEAM Consulting'), ('กทท.', 'Port Authority');
    `);

    // Seed projects
    await dataSource.query(`
      INSERT INTO projects (project_code, project_name)
      VALUES ('LCBP3', 'Laem Chabang Phase 3');
    `);
  }

  static async clearDatabase(dataSource: DataSource): Promise<void> {
    const entities = dataSource.entityMetadatas;
    for (const entity of entities) {
      const repository = dataSource.getRepository(entity.name);
      await repository.clear();
    }
  }
}
```

### Mock Data Factories

```typescript
// File: test/factories/correspondence.factory.ts
import { faker } from '@faker-js/faker';
import { Correspondence } from '@/modules/correspondence/entities/correspondence.entity';

export class CorrespondenceFactory {
  static create(overrides?: Partial<Correspondence>): Correspondence {
    return {
      id: faker.string.uuid(),
      correspondence_number: `TEAM-RFA-${faker.number.int({
        min: 1000,
        max: 9999,
      })}`,
      title: faker.lorem.sentence(),
      project_id: '1',
      correspondence_type_id: '1',
      created_at: faker.date.past(),
      ...overrides,
    };
  }

  static createMany(
    count: number,
    overrides?: Partial<Correspondence>
  ): Correspondence[] {
    return Array(count)
      .fill(null)
      .map(() => this.create(overrides));
  }
}
```

---

## 📝 Test Documentation

### Writing Good Tests

#### ✅ Good Test Example

```typescript
describe('DocumentNumberingService', () => {
  describe('generateNextNumber', () => {
    it('should generate sequential numbers for same project', async () => {
      // Arrange - เตรียมข้อมูล
      const context = {
        projectId: '1',
        organizationId: '1',
        typeId: '1',
        year: 2025,
      };

      // Act - ทำการทดสอบ
      const number1 = await service.generateNextNumber(context);
      const number2 = await service.generateNextNumber(context);

      // Assert - ตรวจสอบผลลัพธ์
      expect(number1).toBe('TEAM-RFA-2025-0001');
      expect(number2).toBe('TEAM-RFA-2025-0002');
    });
  });
});
```

#### ❌ Bad Test Example

```typescript
// ❌ Test name ไม่ชัดเจน
it('should work', async () => {
  // ❌ ไม่แยก Arrange/Act/Assert
  expect(await service.doSomething()).toBeTruthy();
});

// ❌ ทดสอบหลายเรื่องในครั้งเดียว
it('should create and update and delete', async () => {
  await service.create();
  await service.update();
  await service.delete();
  expect(true).toBe(true);
});
```

### Test Naming Convention

```
describe('[ClassName/FeatureName]', () => {
  describe('[methodName/featureAspect]', () => {
    it('should [expected behavior] when [condition]', () => {
      // Test implementation
    });
  });
});
```

**Examples:**

- ✅ `should return 404 when correspondence not found`
- ✅ `should prevent concurrent number generation`
- ✅ `should rollback transaction on validation error`
- ❌ `test create correspondence`
- ❌ `it works`

---

## 📈 Monitoring Test Quality

### Key Metrics

1. **Coverage Percentage**

   - Track via CodeCov/Coveralls
   - Enforce minimum thresholds in CI

2. **Test Execution Time**

   - Unit tests: < 5 seconds
   - Integration tests: < 30 seconds
   - E2E tests: < 5 minutes

3. **Flaky Test Rate**

   - Target: < 1% flaky tests
   - Track and fix flaky tests immediately

4. **Test Maintenance Cost**
   - Time spent fixing broken tests after code changes
   - Target: < 10% of development time

---

## 🔗 Related Documentation

- [Backend Guidelines](05-02-backend-guidelines.md) - Backend development standards
- [Frontend Guidelines](05-03-frontend-guidelines.md) - Frontend development standards
- [System Architecture](../02-Architecture/02-01-system-context.md) - System overview
- [API Design](../02-Architecture/02-04-api-design.md) - API specifications

---

## 📚 External Resources

- [Jest Documentation](https://jestjs.io/)
- [Vitest Guide](https://vitest.dev/)
- [Playwright Docs](https://playwright.dev/)
- [Testing Library Best Practices](https://testing-library.com/docs/guiding-principles)
- [OWASP Testing Guide](https://owasp.org/www-project-web-security-testing-guide/)

---

## 🔄 Version History

| Version | Date       | Author               | Changes                          |
| ------- | ---------- | -------------------- | -------------------------------- |
| 1.5.0   | 2025-11-30 | Nattanin Peancharoen | Initial testing strategy created |
