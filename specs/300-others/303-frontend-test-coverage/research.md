# Research: Frontend Test Coverage — Phased Improvement

**Branch**: `303-frontend-test-coverage` | **Date**: 2026-06-13
**Source**: Static analysis ของ codebase จริง

---

## Technical Findings

### Test Framework Stack

| Item | Value |
|------|-------|
| **Framework** | Vitest `^4.1.0` |
| **Coverage Provider** | `@vitest/coverage-v8` `^4.1.6` |
| **Environment** | `jsdom ^29.0.0` |
| **Setup File** | `frontend/vitest.setup.ts` |
| **Test Include Pattern** | `hooks/**/*.test.{ts,tsx}`, `lib/**/*.test.{ts,tsx}`, `components/**/*.test.{ts,tsx}` |
| **Coverage Include** | `hooks/**/*.ts`, `lib/**/*.ts`, `components/**/*.tsx` |
| **MSW** | ❌ ไม่ได้ติดตั้ง — ใช้ `vi.mock` แทน |

> **สำคัญ:** ชื่อ test files ต้องใช้ `*.test.ts` / `*.test.tsx` (ไม่ใช่ `*.spec.ts`) ตาม vitest config include pattern

### Test Script Commands

```powershell
# รัน test + generate coverage (ใช้ verify แต่ละ Phase)
npm run test:coverage

# รัน test แบบ watch (สำหรับพัฒนา)
npm run test

# debug mode
npm run test:debug
```

### Coverage Thresholds ที่ตั้งไว้ใน vitest.config.ts

```ts
thresholds: { global: { branches: 70, functions: 70, lines: 70, statements: 70 } }
```

> ⚠️ ตอนนี้ threshold ตั้งไว้ที่ 70% แต่ coverage จริงยังอยู่ที่ 13% ซึ่งหมายความว่า `npm run test:coverage` จะ **fail** เสมอจนกว่า Phase 3 เสร็จ — ไม่ต้องกังวล เพราะเราใช้ manual check ไม่ใช่ CI enforcement (ตาม Q1)

---

## Global Mocks (vitest.setup.ts) — ใช้ได้ทุก test โดยอัตโนมัติ

```ts
// 1. jest-dom matchers (toBeInTheDocument, toHaveValue, ฯลฯ)
import '@testing-library/jest-dom/vitest';

// 2. sonner toast — ใช้ใน assert ว่า toast แสดงหรือไม่
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), loading: vi.fn(), dismiss: vi.fn() } }));

// 3. next/navigation — useRouter, usePathname, useSearchParams, useParams
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }), ... }));

// 4. apiClient (axios wrapper) — mock ทั้งหมด: get, post, put, patch, delete
vi.mock('@/lib/api/client', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() } }));

// 5. Browser polyfills (ResizeObserver ฯลฯ)
```

---

## Test Helper — `frontend/lib/test-utils.tsx`

```ts
// ใช้ใน hook tests และ component tests
import { createTestQueryClient } from '@/lib/test-utils';

const { wrapper, queryClient } = createTestQueryClient();
// wrapper = QueryClientProvider ที่ตั้ง retry: false, gcTime: 0, staleTime: 0
```

---

## Existing Test Files (13 files)

```
hooks/__tests__/
  use-ai-chat.test.ts
  use-circulation.test.ts
  use-correspondence.test.ts
  use-drawing.test.ts
  use-projects.test.ts
  use-rfa.test.ts
  use-users.test.ts
  use-workflow-action.test.ts

hooks/ai/__tests__/
  use-intent-classification.test.ts

lib/services/__tests__/
  correspondence.service.test.ts
  master-data.service.test.ts
  project.service.test.ts

components/correspondences/
  form.test.tsx
```

---

## Coverage Gaps Analysis

### hooks/ (28 hooks, 9 tested, **19 ขาด**)

| Hook ที่ขาด | ขนาด | ความสำคัญ |
|-------------|-------|-----------|
| `use-ai-prompts.ts` | 7051 B | Medium |
| `use-ai-status.ts` | 3708 B | Medium |
| `use-audit-logs.ts` | 566 B | Low |
| `use-dashboard.ts` | 1214 B | Medium |
| `use-delegation.ts` | 2323 B | Medium |
| `use-distribution-matrices.ts` | 3455 B | Medium |
| `use-master-data.ts` | 4851 B | **High** (ใช้ใน form ทุกตัว) |
| `use-migration-review.ts` | 4453 B | Medium |
| `use-notification.ts` | 943 B | Low |
| `use-numbering.ts` | 2955 B | **High** (Document Numbering) |
| `use-reference-data.ts` | 4345 B | Medium |
| `use-reminder.ts` | 3810 B | Low |
| `use-response-codes.ts` | 1590 B | Low |
| `use-review-teams.ts` | 4605 B | Medium |
| `use-search.ts` | 962 B | Low |
| `use-translations.ts` | 554 B | Low |
| `use-transmittal.ts` | 1129 B | **High** |
| `use-workflow-history.ts` | 1206 B | Medium |
| `use-workflows.ts` | 3066 B | **High** |

### lib/services/ (28 services, 3 tested, **25 ขาด**)

High-priority services ที่ควรทำก่อน:
- `rfa.service.ts` (2598 B)
- `transmittal.service.ts` (2013 B)
- `circulation.service.ts` (2506 B)
- `workflow-engine.service.ts` (7658 B) ← ใหญ่ที่สุด
- `user.service.ts` (2289 B)
- `document-numbering.service.ts` (1866 B)
- `admin-ai.service.ts` (14833 B) ← ใหญ่มาก, Phase 3

### components/correspondences/ (9 files, 1 tested)

ไฟล์ที่ขาด: `list.tsx`, `detail.tsx`, `tag-manager.tsx`, `reference-selector.tsx`, `revision-history.tsx`, `circulation-status-card.tsx`, `correspondences-content.tsx`, `ux-flow-dialog.tsx`

### components/rfas/ (3 files, 0 tested)

- `form.tsx` (32061 B — ใหญ่ที่สุด, priority สูงสุด)
- `list.tsx` (4251 B)
- `detail.tsx` (11971 B)

---

## Proven Test Patterns (จาก existing files)

### Pattern A — Hook Test

```ts
// File: hooks/__tests__/use-[name].test.ts
// Change Log: 2026-06-XX - สร้างใหม่สำหรับ Phase X Coverage

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { createTestQueryClient } from '@/lib/test-utils';
import { useMyHook } from '../use-my-hook';

// mock service ที่ hook ใช้
vi.mock('@/lib/services/my.service', () => ({
  myService: { getAll: vi.fn(), create: vi.fn() }
}));

import { myService } from '@/lib/services/my.service';

describe('useMyHook', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('ควรดึงข้อมูลสำเร็จ', async () => {
    const mockData = [{ publicId: '019505a1-7c3e-7000-8000-abc123def456', name: 'Test' }];
    vi.mocked(myService.getAll).mockResolvedValue(mockData);
    const { wrapper } = createTestQueryClient();
    const { result } = renderHook(() => useMyHook(), { wrapper });
    await waitFor(() => { expect(result.current.isSuccess).toBe(true); });
    expect(result.current.data).toEqual(mockData);
  });

  it('ควร handle error state', async () => {
    vi.mocked(myService.getAll).mockRejectedValue(new Error('API Error'));
    const { wrapper } = createTestQueryClient();
    const { result } = renderHook(() => useMyHook(), { wrapper });
    await waitFor(() => { expect(result.current.isError).toBe(true); });
  });
});
```

### Pattern B — Service Test

```ts
// File: lib/services/__tests__/[name].service.test.ts
// Change Log: 2026-06-XX - สร้างใหม่สำหรับ Phase X Coverage

import { describe, it, expect, vi, beforeEach } from 'vitest';
// apiClient ถูก mock ไว้ใน vitest.setup.ts แล้ว — import มาใช้ได้เลย
import apiClient from '@/lib/api/client';
import { myService } from '../my.service';

describe('myService', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('ควรเรียก GET /my-endpoint', async () => {
    const mockData = { items: [{ publicId: '019505a1-7c3e-7000-8000-abc123def456' }] };
    vi.mocked(apiClient.get).mockResolvedValue({ data: mockData });
    const result = await myService.getAll({ projectId: 1 });
    expect(apiClient.get).toHaveBeenCalledWith('/my-endpoint', expect.any(Object));
    expect(result).toEqual(mockData);
  });
});
```

### Pattern C — Component Test

```ts
// File: components/[folder]/[Component].test.tsx
// Change Log: 2026-06-XX - สร้างใหม่สำหรับ Phase X Coverage

import { render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { createTestQueryClient } from '@/lib/test-utils';
import { MyComponent } from './MyComponent';

// mock hooks ที่ component ใช้
vi.mock('@/hooks/use-my-hook', () => ({
  useMyHook: vi.fn()
}));
import { useMyHook } from '@/hooks/use-my-hook';

const renderWithQueryClient = (ui: React.ReactElement) => {
  const { wrapper } = createTestQueryClient();
  return render(ui, { wrapper });
};

describe('MyComponent', () => {
  beforeEach(() => {
    vi.mocked(useMyHook).mockReturnValue({
      data: [{ publicId: '019505a1-7c3e-7000-8000-abc123def456', name: 'Test' }],
      isLoading: false,
      isError: false
    } as ReturnType<typeof useMyHook>);
  });

  it('ควร render รายการข้อมูล', () => {
    renderWithQueryClient(<MyComponent />);
    expect(screen.getByText('Test')).toBeInTheDocument();
  });

  it('ควร render loading state', () => {
    vi.mocked(useMyHook).mockReturnValue({ isLoading: true } as ReturnType<typeof useMyHook>);
    renderWithQueryClient(<MyComponent />);
    expect(screen.getByRole('status')).toBeInTheDocument(); // หรือ loading spinner
  });
});
```

---

## Decisions

| Decision | Rationale |
|----------|-----------|
| ใช้ `*.test.ts` ไม่ใช่ `*.spec.ts` | vitest.config.ts include pattern กำหนดไว้แล้ว |
| ใช้ `vi.mock` ไม่ใช่ MSW | MSW ไม่ได้ติดตั้ง, apiClient ถูก mock globally ใน setup.ts |
| ใช้ `createTestQueryClient` จาก `@/lib/test-utils` | helper มีอยู่แล้ว ไม่ต้องสร้างใหม่ |
| วาง test file ใน `__tests__/` subfolder | ตาม pattern ที่มีอยู่ใน codebase แล้ว |
| `publicId` เสมอใน mock data | ADR-019 Tier 1 — ห้ามใช้ `id` ตัวเลข |
| `vi.clearAllMocks()` ใน `beforeEach` | ป้องกัน test pollution ระหว่าง test cases |
