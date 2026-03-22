# ADR-019: Hybrid Identifier Strategy (INT + UUIDv7)

**Status:** Accepted
**Date:** 2026-03-12
**Version:** 1.8.1
**Decision Makers:** Development Team, Database Architect
**Related Documents:**

- [Data Dictionary](../03-Data-and-Storage/03-01-data-dictionary.md)
- [Database Schema](../03-Data-and-Storage/lcbp3-v1.8.0-schema-02-tables.sql)
- [ADR-005: Technology Stack](ADR-005-technology-stack.md)
- [ADR-009: Database Migration Strategy](ADR-009-database-migration-strategy.md)
- [ADR-016: Security & Authentication](ADR-016-security-authentication.md)

---

## Context and Problem Statement

ระบบ LCBP3-DMS ใช้ `INT AUTO_INCREMENT` เป็น Primary Key ทุกตาราง ซึ่งทำงานได้ดีสำหรับ Internal JOIN/FK แต่มีปัญหาด้านความปลอดภัยและ Scalability:

1. **ID Enumeration Attack:** Sequential INT IDs ถูกเดาได้ง่าย (เช่น `/api/correspondences/1`, `/api/correspondences/2`) ทำให้ผู้ไม่ประสงค์ดีสามารถ Enumerate ข้อมูลได้
2. **Information Leakage:** INT IDs เปิดเผยจำนวนข้อมูลในระบบ (เช่น `user_id=5` แปลว่ามีผู้ใช้ 5 คน)
3. **Cross-System Integration:** หากในอนาคตต้องการ Sync ข้อมูลข้ามระบบ INT ID จะชนกัน
4. **API Security:** OWASP BOLA (Broken Object Level Authorization) แนะนำให้ใช้ Opaque Identifier แทน Sequential ID

ทั้งนี้ ระบบมีข้อจำกัดด้าน Hardware (QNAP NAS) ที่ต้องพิจารณาเรื่อง Performance

---

## Decision Drivers

- **Security:** ป้องกัน ID Enumeration และลดความเสี่ยง OWASP BOLA
- **Performance:** INT PK ยังคงเป็น Primary Key เพื่อ JOIN/FK Performance บน InnoDB
- **Backward Compatibility:** ไม่ต้อง Migrate ข้อมูลหรือเปลี่ยน FK Relationships ที่มีอยู่
- **Simplicity:** เปลี่ยนเฉพาะ Public-Facing Tables (ไม่ใช่ทุกตาราง)
- **Standards:** UUIDv7 (RFC 9562) เป็น Time-ordered UUID ที่ B-tree friendly

---

## Considered Options

### Option 1: Replace INT with UUID as Primary Key

**Pros:**

- ✅ Opaque identifier ทุกที่

**Cons:**

- ❌ FK ทั้งหมดต้องเปลี่ยนเป็น BINARY(16) — Migration ซับซ้อนมาก
- ❌ JOIN Performance แย่ลง (16 bytes vs 4 bytes)
- ❌ InnoDB Clustered Index ไม่เรียงลำดับตาม INSERT Time (UUIDv4)
- ❌ ต้อง Rewrite Backend ทั้งหมด (Entity, DTO, Controller, Service)
- ❌ Breaking Change กับ Frontend ที่ใช้ INT ID อยู่

### Option 2: UUID as String Column (CHAR(36))

**Pros:**

- ✅ Human-readable

**Cons:**

- ❌ ใช้พื้นที่ 36 bytes ต่อ row (vs 16 bytes สำหรับ BINARY)
- ❌ Index ใหญ่ ช้ากว่า BINARY(16) อย่างมีนัยสำคัญ
- ❌ Collation issues กับ case-sensitivity

### Option 3: Hybrid INT + UUID (MariaDB Native) ⭐ (Selected)

**Pros:**

- ✅ INT PK ยังเป็น Internal ID → Performance ไม่เปลี่ยน
- ✅ UUID เป็น External ID → ปลอดภัย + Space-efficient (BINARY(16) ภายใน)
- ✅ ไม่ต้อง Migrate FK Relationships
- ✅ UUIDv7 Time-ordered → B-tree friendly, Index Performance ดี
- ✅ Backward Compatible — Frontend ค่อยๆ Migrate ได้
- ✅ ไม่กระทบ Migration Tables (Temporary)

**Cons:**

- ❌ ต้องเพิ่ม Column ใหม่ + UNIQUE INDEX ทุก Public-Facing Table
- ❌ Application Layer ต้อง Generate UUIDv7 ตอน INSERT
- ❌ API Layer ต้อง Resolve UUID → INT สำหรับ Internal Queries

---

## Decision Outcome

**Chosen Option:** Option 3 — Hybrid INT + UUID (MariaDB Native Type)

**Rationale:** เป็นแนวทางที่ Balance ระหว่าง Security, Performance และ Migration Effort ดีที่สุด ไม่ต้อง Rewrite FK ทั้งหมด ไม่ต้อง Migrate ข้อมูล และเพิ่มความปลอดภัยของ API

---

## Technical Specification

### 1. UUID Format

| Property           | Value                                                                       |
| ------------------ | --------------------------------------------------------------------------- |
| **Type**           | MariaDB Native `UUID` (available since 10.7)                                |
| **Storage**        | `BINARY(16)` internally (automatic)                                         |
| **DB Default**     | `UUID()` — generates UUID v1 (time-based, fallback for seed data)           |
| **App Generation** | NestJS `@BeforeInsert()` generates UUIDv7 (RFC 9562) for time-ordering      |
| **Display**        | Auto-converts to string format (8-4-4-4-12) — no conversion function needed |
| **Index**          | `UNIQUE INDEX` on `uuid` column                                             |

### 2. Column Specification

```sql
-- Column definition for all public-facing tables (MariaDB 10.7+)
uuid UUID NOT NULL DEFAULT UUID() COMMENT 'UUID Public Identifier (ADR-019)',
UNIQUE INDEX idx_{table}_uuid (uuid)
```

> **Note:** MariaDB native `UUID` type เก็บเป็น `BINARY(16)` ภายใน แต่แสดงผลเป็น String format อัตโนมัติ ไม่ต้องใช้ `BIN_TO_UUID()` / `UUID_TO_BIN()`
>
> **DB Default:** `UUID()` สร้าง UUID v1 (สำหรับ Seed Data และ Fallback)
>
> **Application Override:** NestJS Entity จะ Generate UUIDv7 เองก่อน INSERT เพื่อให้ได้ True UUIDv7 (Time-ordered, B-tree friendly)

### 3. Tables Requiring UUID Column

#### Tier 1 — Core Entity Tables (Own UUID Column)

| #   | Table Name                  | Current PK                | UUID Column | Notes                     |
| --- | --------------------------- | ------------------------- | ----------- | ------------------------- |
| 1   | `users`                     | `user_id INT AI`          | `uuid UUID` | User profiles             |
| 2   | `organizations`             | `id INT AI`               | `uuid UUID` | Organization data         |
| 3   | `projects`                  | `id INT AI`               | `uuid UUID` | Project data              |
| 4   | `contracts`                 | `id INT AI`               | `uuid UUID` | Contract data             |
| 5   | `correspondences`           | `id INT AI`               | `uuid UUID` | Main document entity      |
| 6   | `correspondence_revisions`  | `id INT AI`               | `uuid UUID` | Document versions         |
| 7   | `circulations`              | `id INT AI`               | `uuid UUID` | Internal circulations     |
| 8   | `shop_drawings`             | `id INT AI`               | `uuid UUID` | Shop drawing master       |
| 9   | `shop_drawing_revisions`    | `id INT AI`               | `uuid UUID` | Shop drawing versions     |
| 10  | `contract_drawings`         | `id INT AI`               | `uuid UUID` | Contract drawing master   |
| 11  | `asbuilt_drawings`          | `id INT AI`               | `uuid UUID` | As-built drawing master   |
| 12  | `asbuilt_drawing_revisions` | `id INT AI`               | `uuid UUID` | As-built drawing versions |
| 13  | `attachments`               | `id INT AI`               | `uuid UUID` | File attachments          |
| 14  | `notifications`             | `id INT AI` (partitioned) | `uuid UUID` | User notifications        |

#### Tier 2 — Shared-PK Tables (Inherit UUID from Parent)

| #   | Table Name      | Shared PK Source              | UUID Resolution                     |
| --- | --------------- | ----------------------------- | ----------------------------------- |
| 1   | `rfas`          | `correspondences.id`          | Use `correspondences.uuid`          |
| 2   | `rfa_revisions` | `correspondence_revisions.id` | Use `correspondence_revisions.uuid` |
| 3   | `transmittals`  | `correspondences.id`          | Use `correspondences.uuid`          |

#### Already Using UUID — No Changes Needed

| Table Name             | Current PK      |
| ---------------------- | --------------- |
| `workflow_definitions` | `CHAR(36) UUID` |
| `workflow_instances`   | `CHAR(36) UUID` |
| `workflow_histories`   | `CHAR(36) UUID` |

#### Excluded Tables (Internal/Master/Junction)

ตารางต่อไปนี้ **ไม่ต้อง** เพิ่ม UUID Column เพราะเป็น Internal-use only:

- **Master/Lookup:** `organization_roles`, `disciplines`, `correspondence_types`, `correspondence_sub_types`, `correspondence_status`, `rfa_types`, `rfa_status_codes`, `rfa_approve_codes`, `circulation_status_codes`, `tags`
- **RBAC:** `roles`, `permissions`, `user_assignments`
- **Junction/Mapping:** `project_organizations`, `contract_organizations`, `correspondence_recipients`, `correspondence_tags`, `correspondence_references`, `contract_drawing_subcat_cat_maps`, `shop_drawing_revision_contract_refs`, `asbuilt_revision_shop_revisions_refs`, all `*_attachments` junction tables
- **Drawing Categories:** `contract_drawing_volumes`, `contract_drawing_cats`, `contract_drawing_sub_cats`, `shop_drawing_main_categories`, `shop_drawing_sub_categories`
- **Document Numbering:** `document_number_formats`, `document_number_counters`, `document_number_audit`, `document_number_errors`, `document_number_reservations`
- **System/Logs:** `json_schemas`, `user_preferences`, `audit_logs`, `search_indices`, `backup_logs`, `refresh_tokens`
- **Migration (Temporary):** `migration_progress`, `migration_review_queue`, `migration_errors`, `migration_fallback_state`, `import_transactions`, `migration_daily_summary`

---

## TypeORM Entity Pattern

### Base Entity with UUID

```typescript
// src/common/entities/base-uuid.entity.ts
import { Column, BeforeInsert } from 'typeorm';
import { v7 as uuidv7 } from 'uuid';

export abstract class BaseUuidEntity {
  @Column({
    type: 'uuid',
    unique: true,
    nullable: false,
    comment: 'UUID Public Identifier (ADR-019)',
  })
  uuid!: string;

  @BeforeInsert()
  generateUuid(): void {
    if (!this.uuid) {
      this.uuid = uuidv7();
    }
  }
}
```

> **Note:** MariaDB native `UUID` type ทำให้ TypeORM ไม่ต้องใช้ transformer อีกต่อไป — ค่าเข้า/ออกเป็น string format เสมอ

### Entity Usage Example

```typescript
// Example: correspondence.entity.ts
import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';
import { BaseUuidEntity } from '../../common/entities/base-uuid.entity';

@Entity('correspondences')
export class Correspondence extends BaseUuidEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  // ... existing columns
}
```

---

## API Layer Changes

### URL Pattern

```
// Before (INT — vulnerable to enumeration)
GET /api/correspondences/42
GET /api/users/5

// After (UUID — opaque identifier)
GET /api/correspondences/019505a1-7c3e-7000-8000-abc123def456
GET /api/users/019505a1-8b2f-7000-8000-abc123def456
```

### Controller Pattern

```typescript
@Get(':uuid')
async findOne(@Param('uuid', ParseUUIDPipe) uuid: string) {
  return this.service.findByUuid(uuid);
}
```

### Service Pattern

```typescript
async findByUuid(uuid: string): Promise<CorrespondenceDto> {
  const entity = await this.repository.findOne({
    where: { uuid },
  });
  if (!entity) throw new NotFoundException();
  return this.toDto(entity);
}
```

### DTO Pattern — Never Expose INT ID

```typescript
export class CorrespondenceResponseDto {
  // ✅ Expose UUID as 'id' in API response
  @Expose({ name: 'id' })
  uuid!: string;

  // ❌ Never expose internal INT id
  // id: number; — REMOVED from response

  // ... other fields
  // For FK references, also use UUID
  @Expose({ name: 'project_id' })
  projectUuid!: string;
}
```

---

## Migration SQL Script

```sql
-- =====================================================
-- ADR-019: Add UUIDv7 columns to public-facing tables
-- Strategy: Non-destructive — ADD COLUMN only
-- Rollback: DROP COLUMN uuid
-- =====================================================

-- Tier 1: Core Entity Tables
ALTER TABLE users
  ADD COLUMN uuid UUID NOT NULL DEFAULT UUID()
    COMMENT 'UUID Public Identifier (ADR-019)',
  ADD UNIQUE INDEX idx_users_uuid (uuid);

ALTER TABLE organizations
  ADD COLUMN uuid UUID NOT NULL DEFAULT UUID()
    COMMENT 'UUID Public Identifier (ADR-019)',
  ADD UNIQUE INDEX idx_organizations_uuid (uuid);

ALTER TABLE projects
  ADD COLUMN uuid UUID NOT NULL DEFAULT UUID()
    COMMENT 'UUID Public Identifier (ADR-019)',
  ADD UNIQUE INDEX idx_projects_uuid (uuid);

ALTER TABLE contracts
  ADD COLUMN uuid UUID NOT NULL DEFAULT UUID()
    COMMENT 'UUID Public Identifier (ADR-019)',
  ADD UNIQUE INDEX idx_contracts_uuid (uuid);

ALTER TABLE correspondences
  ADD COLUMN uuid UUID NOT NULL DEFAULT UUID()
    COMMENT 'UUID Public Identifier (ADR-019)',
  ADD UNIQUE INDEX idx_correspondences_uuid (uuid);

ALTER TABLE correspondence_revisions
  ADD COLUMN uuid UUID NOT NULL DEFAULT UUID()
    COMMENT 'UUID Public Identifier (ADR-019)',
  ADD UNIQUE INDEX idx_correspondence_revisions_uuid (uuid);

ALTER TABLE circulations
  ADD COLUMN uuid UUID NOT NULL DEFAULT UUID()
    COMMENT 'UUID Public Identifier (ADR-019)',
  ADD UNIQUE INDEX idx_circulations_uuid (uuid);

ALTER TABLE shop_drawings
  ADD COLUMN uuid UUID NOT NULL DEFAULT UUID()
    COMMENT 'UUID Public Identifier (ADR-019)',
  ADD UNIQUE INDEX idx_shop_drawings_uuid (uuid);

ALTER TABLE shop_drawing_revisions
  ADD COLUMN uuid UUID NOT NULL DEFAULT UUID()
    COMMENT 'UUID Public Identifier (ADR-019)',
  ADD UNIQUE INDEX idx_shop_drawing_revisions_uuid (uuid);

ALTER TABLE contract_drawings
  ADD COLUMN uuid UUID NOT NULL DEFAULT UUID()
    COMMENT 'UUID Public Identifier (ADR-019)',
  ADD UNIQUE INDEX idx_contract_drawings_uuid (uuid);

ALTER TABLE asbuilt_drawings
  ADD COLUMN uuid UUID NOT NULL DEFAULT UUID()
    COMMENT 'UUID Public Identifier (ADR-019)',
  ADD UNIQUE INDEX idx_asbuilt_drawings_uuid (uuid);

ALTER TABLE asbuilt_drawing_revisions
  ADD COLUMN uuid UUID NOT NULL DEFAULT UUID()
    COMMENT 'UUID Public Identifier (ADR-019)',
  ADD UNIQUE INDEX idx_asbuilt_drawing_revisions_uuid (uuid);

ALTER TABLE attachments
  ADD COLUMN uuid UUID NOT NULL DEFAULT UUID()
    COMMENT 'UUID Public Identifier (ADR-019)',
  ADD UNIQUE INDEX idx_attachments_uuid (uuid);

ALTER TABLE notifications
  ADD COLUMN uuid UUID NOT NULL DEFAULT UUID()
    COMMENT 'UUID Public Identifier (ADR-019)',
  ADD INDEX idx_notifications_uuid (uuid);
  -- Note: UNIQUE constraint on partitioned table requires uuid in partition key
  -- Using regular INDEX instead
```

### Rollback SQL

```sql
-- Rollback: Remove UUID columns (Non-destructive reverse)
ALTER TABLE users DROP INDEX idx_users_uuid, DROP COLUMN uuid;
ALTER TABLE organizations DROP INDEX idx_organizations_uuid, DROP COLUMN uuid;
ALTER TABLE projects DROP INDEX idx_projects_uuid, DROP COLUMN uuid;
ALTER TABLE contracts DROP INDEX idx_contracts_uuid, DROP COLUMN uuid;
ALTER TABLE correspondences DROP INDEX idx_correspondences_uuid, DROP COLUMN uuid;
ALTER TABLE correspondence_revisions DROP INDEX idx_correspondence_revisions_uuid, DROP COLUMN uuid;
ALTER TABLE circulations DROP INDEX idx_circulations_uuid, DROP COLUMN uuid;
ALTER TABLE shop_drawings DROP INDEX idx_shop_drawings_uuid, DROP COLUMN uuid;
ALTER TABLE shop_drawing_revisions DROP INDEX idx_shop_drawing_revisions_uuid, DROP COLUMN uuid;
ALTER TABLE contract_drawings DROP INDEX idx_contract_drawings_uuid, DROP COLUMN uuid;
ALTER TABLE asbuilt_drawings DROP INDEX idx_asbuilt_drawings_uuid, DROP COLUMN uuid;
ALTER TABLE asbuilt_drawing_revisions DROP INDEX idx_asbuilt_drawing_revisions_uuid, DROP COLUMN uuid;
ALTER TABLE attachments DROP INDEX idx_attachments_uuid, DROP COLUMN uuid;
ALTER TABLE notifications DROP INDEX idx_notifications_uuid, DROP COLUMN uuid;
```

---

## Storage Impact Analysis

| Item                                    | Size                                            |
| --------------------------------------- | ----------------------------------------------- |
| UUID (BINARY(16) internal) per row      | 16 bytes                                        |
| UNIQUE INDEX per row                    | ~16 bytes (key) + ~6 bytes (pointer) ≈ 22 bytes |
| **Total per row**                       | **~38 bytes**                                   |
| Estimated rows (all 14 tables combined) | ~100,000 (Year 1)                               |
| **Total additional storage**            | **~3.8 MB**                                     |
| Impact on QNAP NAS                      | **Negligible**                                  |

---

## Performance Considerations

### UUIDv7 vs UUIDv4 for B-tree Index

| Property            | UUIDv4             | UUIDv7            |
| ------------------- | ------------------ | ----------------- |
| Ordering            | Random             | Time-ordered      |
| B-tree insert       | Random page splits | Sequential append |
| Index fragmentation | High               | Low               |
| Cache efficiency    | Poor               | Good              |

**UUIDv7 ถูกเลือกเพราะ Time-ordering** ทำให้ INSERT ไม่ทำให้เกิด Random Page Split บน InnoDB B-tree ซึ่งสำคัญมากสำหรับ QNAP NAS ที่มี I/O จำกัด

### Query Pattern

```sql
-- Internal query (JOINs still use INT — no performance change)
SELECT c.*, cr.*
FROM correspondences c
JOIN correspondence_revisions cr ON c.id = cr.correspondence_id
WHERE c.id = 42;

-- API query (UUID lookup via UNIQUE INDEX — O(log n))
SELECT c.*, cr.*
FROM correspondences c
JOIN correspondence_revisions cr ON c.id = cr.correspondence_id
WHERE c.uuid = '019505a1-7c3e-7000-8000-abc123def456';
```

---

## Security Benefits

| Threat                 | Before (INT)                          | After (Hybrid)           |
| ---------------------- | ------------------------------------- | ------------------------ |
| ID Enumeration         | ❌ Vulnerable (`/api/users/1,2,3...`) | ✅ Opaque UUID           |
| Record Count Leak      | ❌ `id=500` reveals ~500 records      | ✅ UUID reveals nothing  |
| BOLA Attack Surface    | ❌ Predictable IDs                    | ✅ 2^122 possible values |
| Cross-System Collision | ❌ Possible                           | ✅ Globally unique       |

---

## Compatibility with Existing ADRs

| ADR                        | Impact        | Notes                                                            |
| -------------------------- | ------------- | ---------------------------------------------------------------- |
| ADR-002 (Doc Numbering)    | ✅ None       | Document numbers (VARCHAR) are business identifiers, unaffected  |
| ADR-005 (Tech Stack)       | ✅ Compatible | uuid npm package + MariaDB native UUID type                      |
| ADR-006 (Redis Caching)    | ⚠️ Minor      | Cache keys should use UUID instead of INT for public-facing data |
| ADR-009 (DB Migration)     | ✅ Compatible | ADD COLUMN is a safe, non-destructive migration                  |
| ADR-016 (Security)         | ✅ Enhanced   | Strengthens OWASP BOLA defense                                   |
| ADR-017 (Ollama Migration) | ✅ None       | Migration tables are temporary, excluded from UUID scope         |

---

## Transition Strategy

### Phase 1: Database (Schema Change)

- เพิ่ม `uuid UUID` column (MariaDB native type) กับ UNIQUE INDEX ใน 14 ตาราง
- Existing rows ได้รับ UUID อัตโนมัติจาก DB DEFAULT

### Phase 2: Backend (Dual-Mode)

- เพิ่ม `uuid` field ใน TypeORM Entities
- สร้าง `BaseUuidEntity` class
- API รับได้ทั้ง INT และ UUID ผ่าน `FindByIdOrUuid` pattern
- API Response รวม UUID เป็น `id` field

### Phase 3: Frontend (Gradual Migration)

- Frontend เปลี่ยนจากใช้ `id` (INT) เป็น `id` (UUID) ใน API response
- URL parameters เปลี่ยนเป็น UUID
- ไม่ต้อง Big-Bang migration — ค่อยๆ เปลี่ยนทีละ Module

### Phase 4: Cleanup

- ลบ INT ID จาก API Response (DTO)
- ลบ INT-based route handlers
- Update API Documentation

---

## Final Assessment

| Area                   | Status                               |
| ---------------------- | ------------------------------------ |
| Security               | ✅ Eliminates ID enumeration         |
| Performance            | ✅ No impact on internal JOINs       |
| Migration Risk         | ✅ Low — ADD COLUMN only             |
| Storage Impact         | ✅ Negligible (~3.8 MB)              |
| Backward Compatibility | ✅ Dual-mode transition              |
| ADR Compliance         | ✅ Compatible with all existing ADRs |

---

_สำหรับรายละเอียดการ Implement ดูที่ Implementation Plan ใน ADR-019-implementation-plan.md_
