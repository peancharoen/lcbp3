# Backend Development Guidelines

**สำหรับ:** NAP-DMS LCBP3 Backend (NestJS + TypeScript)
**เวอร์ชัน:** 1.8.1
**อัปเดต:** 2026-03-19

---

## 🎯 หลักการพื้นฐาน

ระบบ Backend ของเรามุ่งเน้น **"Data Integrity First"** - ความถูกต้องของข้อมูลต้องมาก่อน ตามด้วย Security และ UX

### หลักการหลัก

1. **Strict Typing:** ใช้ TypeScript เต็มรูปแบบ ห้ามใช้ `any`
2. **Data Integrity:** ป้องกัน Race Condition ด้วย Optimistic Locking + Redis Lock
3. **Security First:** ทุก Endpoint ต้องผ่าน Authentication, Authorization, และ Input Validation
4. **Idempotency:** Request สำคัญต้องทำซ้ำได้โดยไม่เกิดผลกระทบซ้ำซ้อน
5. **Resilience:** รองรับ Network Failure และ External Service Downtime
6. **Zero Vulnerabilities:** รักษาความปลอดภัยของ dependencies เป็นประจำ (0 vulnerabilities ณ 2026-03-19)

---

## 📁 โครงสร้างโปรเจกต์

```
backend/
├── src/
│   ├── common/              # Shared utilities
│   │   ├── decorators/      # Custom decorators
│   │   ├── dtos/            # Common DTOs
│   │   ├── entities/        # Base entities
│   │   ├── filters/         # Exception filters
│   │   ├── guards/          # Auth guards, RBAC
│   │   ├── interceptors/    # Logging, transform, idempotency
│   │   ├── interfaces/      # Common interfaces
│   │   └── utils/           # Helper functions
│   ├── config/              # Configuration management
│   ├── database/
│   │   ├── migrations/
│   │   └── seeds/
│   ├── modules/             # Business modules (domain-driven)
│   │   ├── auth/
│   │   ├── circulation/
│   │   ├── correspondence/
│   │   ├── dashboard/
│   │   ├── document-numbering/
│   │   ├── drawing/
│   │   ├── json-schema/
│   │   ├── master/
│   │   ├── monitoring/
│   │   ├── notification/
│   │   ├── project/
│   │   ├── organization/
│   │   ├── contract/
│   │   ├── rfa/
│   │   ├── search/
│   │   ├── transmittal/
│   │   ├── user/
│   │   └── workflow-engine/
│   ├── app.module.ts
│   └── main.ts
├── test/                    # E2E tests
└── scripts/                 # Utility scripts
```

---

## 🔐 Security Guidelines

### 1. Authentication & Authorization

**JWT Authentication:**

```typescript
// ใช้ @UseGuards(JwtAuthGuard) สำหรับ Protected Routes
@Controller('projects')
@UseGuards(JwtAuthGuard)
export class ProjectController {
  // ...
}
```

**RBAC (4 ระดับ):**

```typescript
// ใช้ @RequirePermission() Decorator
@Post(':id/contracts')
@RequirePermission('contract.create', { scope: 'project' })
async createContract() {
  // Level 1: Global Permission
  // Level 2: Organization Permission
  // Level 3: Project Permission
  // Level 4: Contract Permission
}
```

### 2. Input Validation

**ใช้ DTOs พร้อม class-validator:**

```typescript
import { IsNotEmpty, IsUUID, MaxLength } from 'class-validator';

export class CreateCorrespondenceDto {
  @IsNotEmpty({ message: 'ต้องระบุโปรเจกต์' })
  @IsUUID('4', { message: 'รูปแบบ Project ID ไม่ถูกต้อง' })
  project_id: string;

  @IsNotEmpty()
  @MaxLength(500)
  title: string;
}
```

### 3. Rate Limiting

```typescript
// กำหนด Rate Limit ตาม User Type
@UseGuards(RateLimitGuard)
@RateLimit({ points: 100, duration: 3600 }) // 100 requests/hour
@Post('upload')
async uploadFile() { }
```

### 4. Secrets Management

- **Production:** ใช้ Docker Environment Variables (ไม่ใส่ใน docker-compose.yml)
- **Development:** ใช้ `docker-compose.override.yml` (gitignored)
- **Validation:** Validate Environment Variables ตอน Start App

```typescript
// src/common/config/env.validation.ts
import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  DATABASE_URL: Joi.string().required(),
  JWT_SECRET: Joi.string().min(32).required(),
  REDIS_URL: Joi.string().required(),
});
```

---

## 🗄️ Database Best Practices

### 1. Optimistic Locking

**ใช้ @VersionColumn() ป้องกัน Race Condition:**

```typescript
@Entity()
export class DocumentNumberCounter {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  last_number: number;

  @VersionColumn() // Auto-increment on update
  version: number;
}
```

### 2. Virtual Columns สำหรับ JSON

**สร้าง Index สำหรับ JSON field ที่ใช้ Search บ่อย:**

```sql
-- Migration Script
ALTER TABLE correspondence_revisions
ADD COLUMN ref_project_id INT GENERATED ALWAYS AS
  (JSON_UNQUOTE(JSON_EXTRACT(details, '$.projectId'))) VIRTUAL;

CREATE INDEX idx_ref_project_id ON correspondence_revisions(ref_project_id);
```

### 3. Soft Delete

```typescript
// Base Entity
@Entity()
export abstract class BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt?: Date; // NULL = Active, NOT NULL = Soft Deleted
}
```

> [!NOTE]
> **Property Naming Convention:** TypeScript properties use **camelCase** (`createdAt`, `updatedAt`, `deletedAt`) while database columns use **snake_case** (`created_at`, `updated_at`, `deleted_at`). The `{ name: 'column_name' }` decorator maps between them.

---

## 📦 Core Modules

### 1. DocumentNumberingModule

**Double-Lock Mechanism:**

```typescript
@Injectable()
export class DocumentNumberingService {
  async generateNextNumber(context: NumberingContext): Promise<string> {
    const lockKey = `doc_num:${context.projectId}:${context.typeId}`;

    // Layer 1: Redis Lock (2-5 seconds TTL)
    const lock = await this.redisLock.acquire(lockKey, 3000);

    try {
      // Layer 2: Optimistic DB Lock
      const counter = await this.counterRepo.findOne({
        where: context,
        lock: { mode: 'optimistic' },
      });

      counter.last_number++;
      await this.counterRepo.save(counter); // Throws if version changed

      return this.formatNumber(counter);
    } finally {
      await lock.release();
    }
  }
}
```

### 2. FileStorageService (Two-Phase)

**Phase 1: Upload to Temp**

```typescript
@Post('upload')
async uploadFile(@UploadedFile() file: Express.Multer.File) {
  // 1. Virus Scan
  await this.virusScan(file);

  // 2. Save to temp/
  const tempId = await this.fileStorage.saveToTemp(file);

  // 3. Return temp_id
  return { temp_id: tempId, expires_at: addHours(new Date(), 24) };
}
```

**Phase 2: Commit to Permanent**

```typescript
async createCorrespondence(dto: CreateDto, tempFileIds: string[]) {
  return this.dataSource.transaction(async (manager) => {
    // 1. Create Correspondence
    const correspondence = await manager.save(Correspondence, dto);

    // 2. Commit Files (ภายใน Transaction)
    await this.fileStorage.commitFiles(tempFileIds, correspondence.id, manager);

    return correspondence;
  });
}
```

**Cleanup Job:**

```typescript
@Cron('0 */6 * * *') // ทุก 6 ชั่วโมง
async cleanupOrphanFiles() {
  const expiredFiles = await this.attachmentRepo.find({
    where: {
      is_temporary: true,
      expires_at: LessThan(new Date()),
    },
  });

  for (const file of expiredFiles) {
    await this.deleteFile(file.file_path);
    await this.attachmentRepo.remove(file);
  }
}
```

### 3. Idempotency Interceptor

```typescript
@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  async intercept(context: ExecutionContext, next: CallHandler) {
    const request = context.switchToHttp().getRequest();
    const idempotencyKey = request.headers['idempotency-key'];

    if (!idempotencyKey) {
      throw new BadRequestException('Idempotency-Key required');
    }

    // ตรวจสอบ Cache
    const cached = await this.redis.get(`idempotency:${idempotencyKey}`);
    if (cached) {
      return of(JSON.parse(cached)); // Return ผลลัพธ์เดิม
    }

    // Execute & Cache Result
    return next.handle().pipe(
      tap(async (response) => {
        await this.redis.set(
          `idempotency:${idempotencyKey}`,
          JSON.stringify(response),
          'EX',
          86400 // 24 hours
        );
      })
    );
  }
}
```

---

## 🔄 Workflow Engine Integration

**ห้ามสร้างตาราง Routing แยก** - ใช้ Unified Workflow Engine

```typescript
@Injectable()
export class CorrespondenceWorkflowService {
  constructor(private workflowEngine: WorkflowEngineService) {}

  async submitCorrespondence(corrId: string, templateId: string) {
    // สร้าง Workflow Instance
    const instance = await this.workflowEngine.createInstance({
      definition_name: 'CORRESPONDENCE_ROUTING',
      entity_type: 'correspondence',
      entity_id: corrId,
      template_id: templateId,
    });

    // Execute Initial Transition
    await this.workflowEngine.executeTransition(instance.id, 'SUBMIT');

    return instance;
  }
}
```

---

## ✅ Testing Standards

### 1. Unit Tests

```typescript
describe('DocumentNumberingService', () => {
  let service: DocumentNumberingService;
  let mockRedisLock: jest.Mocked<RedisLock>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        DocumentNumberingService,
        { provide: RedisLock, useValue: mockRedisLock },
      ],
    }).compile();

    service = module.get(DocumentNumberingService);
  });

  it('should generate unique numbers concurrently', async () => {
    // Test concurrent number generation
    const promises = Array(10)
      .fill(null)
      .map(() => service.generateNextNumber(context));

    const results = await Promise.all(promises);
    const unique = new Set(results);

    expect(unique.size).toBe(10); // ไม่มีเลขซ้ำ
  });
});
```

### 2. E2E Tests

```typescript
describe('Correspondence API (e2e)', () => {
  it('should create correspondence with idempotency', async () => {
    const idempotencyKey = uuidv4();

    // Request 1
    const response1 = await request(app.getHttpServer())
      .post('/correspondences')
      .set('Idempotency-Key', idempotencyKey)
      .send(createDto);

    expect(response1.status).toBe(201);

    // Request 2 (Same Key)
    const response2 = await request(app.getHttpServer())
      .post('/correspondences')
      .set('Idempotency-Key', idempotencyKey)
      .send(createDto);

    expect(response2.status).toBe(201);
    expect(response2.body.id).toBe(response1.body.id); // Same entity
  });
});
```

---

## 📊 Logging & Monitoring

### 1. Winston Logger

```typescript
// src/modules/monitoring/logger/winston.config.ts
export const winstonConfig = {
  level: process.env.NODE_ENV === 'production' ? 'warn' : 'debug',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
  ],
};
```

### 2. Audit Logging

```typescript
@Post(':id/approve')
@UseInterceptors(AuditLogInterceptor)
async approve(@Param('id') id: string, @CurrentUser() user: User) {
  // AuditLogInterceptor จะบันทึก:
  // - user_id
  // - action: 'correspondence.approve'
  // - entity_type: 'correspondence'
  // - entity_id: id
  // - ip_address
  // - timestamp
}
```

---

## 🚫 Anti-Patterns (สิ่งที่ห้ามทำ)

1. ❌ **ห้ามใช้ SQL Triggers** สำหรับ Business Logic
2. ❌ **ห้ามใช้ .env** ใน Production (ใช้ Docker ENV)
3. ❌ **ห้ามใช้ `any` Type** — Enforced ✅ (0 remaining as of v1.8.1, see techniques below)
4. ❌ **ห้าม Hardcode Secrets**
5. ❌ **ห้ามสร้างตาราง Routing แยก** (ใช้ Workflow Engine)
6. ❌ **ห้ามใช้ console.log** (ใช้ Logger)

### `any` Type Elimination Techniques (v1.8.1)

Backend codebase has **zero** `any` types remaining. Key techniques used:

| Pattern | Solution |
|---------|----------|
| JWT `expiresIn` branded type | `import type { StringValue } from 'ms'`; cast `as StringValue` |
| CASL `detectSubjectType` callback | Type param as `object`, internal cast via `Record<string, unknown>` |
| CASL `ability.can()` params | Export `Actions`/`Subjects` types from `ability.factory.ts`, cast explicitly |
| TypeORM nullable column clearing | Use `undefined` instead of `null as any` for optional (`?:`) properties |
| Test mock objects | Use `as unknown as InterfaceType` or `as Partial<Entity> as Entity` |
| TypeScript legacy decorators | `target: any` is unavoidable — whitelisted per TS spec limitation |

> **Exceptions:** Only `target: any` in legacy TS decorators (`circuit-breaker.decorator.ts`, `retry.decorator.ts`) remains — this is a TypeScript language constraint, not a code quality issue.

---

## 📚 เอกสารอ้างอิง

- [FullStack Guidelines](05-01-fullstack-js-guidelines.md)
- [Backend Plan v1.8.0](../02-Architecture/02-02-software-architecture.md)
- [Data Dictionary](../03-Data-and-Storage/03-01-data-dictionary.md)
- [Workflow Engine Plan](../01-Requirements/01-03-modules/README.md)

---

## 🔄 Update History

| Version | Date       | Changes                            |
| ------- | ---------- | ---------------------------------- |
| 1.5.0   | 2025-12-01 | Initial backend guidelines created |
| 1.8.1   | 2026-03-20 | Added `any` type elimination techniques, enforced 0 remaining `any` |
