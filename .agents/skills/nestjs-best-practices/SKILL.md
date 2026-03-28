---
name: nestjs-best-practices
description: NestJS best practices and architecture patterns for building production-ready applications. This skill should be used when writing, reviewing, or refactoring NestJS code to ensure proper patterns for modules, dependency injection, security, and performance.
license: MIT
metadata:
  author: Kadajett
  version: '1.1.0'
---

# NestJS Best Practices

Comprehensive best practices guide for NestJS applications. Contains 40 rules across 10 categories, prioritized by impact to guide automated refactoring and code generation.

## When to Apply

Reference these guidelines when:

- Writing new NestJS modules, controllers, or services
- Implementing authentication and authorization
- Reviewing code for architecture and security issues
- Refactoring existing NestJS codebases
- Optimizing performance or database queries
- Building microservices architectures

## Rule Categories by Priority

| Priority | Category             | Impact      | Prefix      |
| -------- | -------------------- | ----------- | ----------- |
| 1        | Architecture         | CRITICAL    | `arch-`     |
| 2        | Dependency Injection | CRITICAL    | `di-`       |
| 3        | Error Handling       | HIGH        | `error-`    |
| 4        | Security             | HIGH        | `security-` |
| 5        | Performance          | HIGH        | `perf-`     |
| 6        | Testing              | MEDIUM-HIGH | `test-`     |
| 7        | Database & ORM       | MEDIUM-HIGH | `db-`       |
| 8        | API Design           | MEDIUM      | `api-`      |
| 9        | Microservices        | MEDIUM      | `micro-`    |
| 10       | DevOps & Deployment  | LOW-MEDIUM  | `devops-`   |

## Quick Reference

### 1. Architecture (CRITICAL)

- `arch-avoid-circular-deps` - Avoid circular module dependencies
- `arch-feature-modules` - Organize by feature, not technical layer
- `arch-module-sharing` - Proper module exports/imports, avoid duplicate providers
- `arch-single-responsibility` - Focused services over "god services"
- `arch-use-repository-pattern` - Abstract database logic for testability
- `arch-use-events` - Event-driven architecture for decoupling

### 2. Dependency Injection (CRITICAL)

- `di-avoid-service-locator` - Avoid service locator anti-pattern
- `di-interface-segregation` - Interface Segregation Principle (ISP)
- `di-liskov-substitution` - Liskov Substitution Principle (LSP)
- `di-prefer-constructor-injection` - Constructor over property injection
- `di-scope-awareness` - Understand singleton/request/transient scopes
- `di-use-interfaces-tokens` - Use injection tokens for interfaces

### 3. Error Handling (HIGH)

- `error-use-exception-filters` - Centralized exception handling
- `error-throw-http-exceptions` - Use NestJS HTTP exceptions
- `error-handle-async-errors` - Handle async errors properly

### 4. Security (HIGH)

- `security-auth-jwt` - Secure JWT authentication
- `security-validate-all-input` - Validate with class-validator
- `security-use-guards` - Authentication and authorization guards
- `security-sanitize-output` - Prevent XSS attacks
- `security-rate-limiting` - Implement rate limiting

### 5. Performance (HIGH)

- `perf-async-hooks` - Proper async lifecycle hooks
- `perf-use-caching` - Implement caching strategies
- `perf-optimize-database` - Optimize database queries
- `perf-lazy-loading` - Lazy load modules for faster startup

### 6. Testing (MEDIUM-HIGH)

- `test-use-testing-module` - Use NestJS testing utilities
- `test-e2e-supertest` - E2E testing with Supertest
- `test-mock-external-services` - Mock external dependencies

### 7. Database & ORM (MEDIUM-HIGH)

- `db-hybrid-identifier` - **CRITICAL** ADR-019: INT PK + UUID public API
- `db-avoid-n-plus-one` - HIGH N+1 query prevention
- `db-use-transactions` - HIGH Transaction management
- `db-no-typeorm-migrations` - **CRITICAL** ADR-009: No TypeORM migrations - use SQL files

### 8. API Design (MEDIUM)

- `api-use-dto-serialization` - DTO and response serialization
- `api-use-interceptors` - Cross-cutting concerns
- `api-versioning` - API versioning strategies
- `api-use-pipes` - Input transformation with pipes

### 9. Microservices (MEDIUM)

- `micro-use-patterns` - Message and event patterns
- `micro-use-health-checks` - Health checks for orchestration
- `micro-use-queues` - Background job processing

### 10. DevOps & Deployment (LOW-MEDIUM)

- `devops-use-config-module` - Environment configuration
- `devops-use-logging` - Structured logging
- `devops-graceful-shutdown` - Zero-downtime deployments

## NAP-DMS Project-Specific Rules (MUST FOLLOW)

These rules override general NestJS best practices for the NAP-DMS project:

### ADR-009: No TypeORM Migrations

- **ห้ามสร้างไฟล์ migration ของ TypeORM**
- แก้ไข schema โดยตรงที่: `specs/03-Data-and-Storage/lcbp3-v1.8.0-schema-02-tables.sql`
- ใช้ n8n workflow สำหรับ data migration ถ้าจำเป็น

### ADR-019: Hybrid Identifier Strategy (CRITICAL)

```typescript
@Entity()
export class Project {
  @PrimaryGeneratedColumn()
  @Exclude() // ห้ามส่งออกทาง API
  id: number; // INT AUTO_INCREMENT - internal only

  @Column({ type: 'uuid' })
  @Expose({ name: 'id' }) // ส่งออกเป็น 'id' ทาง API
  publicId: string; // UUIDv7 - public API identifier
}
```

### Two-Phase File Upload

```typescript
// Phase 1: Upload to temp
@Post('upload')
async uploadFile(@UploadedFile() file: Express.Multer.File) {
  await this.virusScan(file);
  const tempId = await this.fileStorage.saveToTemp(file);
  return { temp_id: tempId, expires_at: addHours(new Date(), 24) };
}

// Phase 2: Commit in transaction
async createEntity(dto: CreateDto, tempIds: string[]) {
  return this.dataSource.transaction(async (manager) => {
    const entity = await manager.save(Entity, dto);
    await this.fileStorage.commitFiles(tempIds, entity.id, manager);
    return entity;
  });
}
```

### Idempotency Requirement

- ทุก POST/PUT/PATCH ที่สำคัญต้องมี `Idempotency-Key` header
- ใช้ `IdempotencyInterceptor` ที่มีอยู่แล้ว

### Document Numbering (Double-Lock)

```typescript
async generateNextNumber(context: NumberingContext): Promise<string> {
  const lockKey = `doc_num:${context.projectId}:${context.typeId}`;
  const lock = await this.redisLock.acquire(lockKey, 3000);

  try {
    const counter = await this.counterRepo.findOne({
      where: context,
      lock: { mode: 'optimistic' },
    });
    counter.last_number++;
    return this.formatNumber(await this.counterRepo.save(counter));
  } finally {
    await lock.release();
  }
}
```

### Anti-Patterns (ห้ามทำ)

- ❌ ใช้ SQL Triggers สำหรับ business logic
- ❌ ใช้ `.env` ใน production (ใช้ Docker ENV)
- ❌ ใช้ `any` type (strict mode enforced)
- ❌ ใช้ `console.log` (ใช้ NestJS Logger)
- ❌ สร้างตาราง routing แยก (ใช้ Workflow Engine)

---

Read individual rule files for detailed explanations and code examples:

```
rules/arch-avoid-circular-deps.md
rules/security-validate-all-input.md
rules/_sections.md
```

Each rule file contains:

- Brief explanation of why it matters
- Incorrect code example with explanation
- Correct code example with explanation
- Additional context and references

## Full Compiled Document

For the complete guide with all rules expanded: `AGENTS.md`
