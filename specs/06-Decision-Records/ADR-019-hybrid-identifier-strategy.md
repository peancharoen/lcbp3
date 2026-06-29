# ADR-019: Hybrid Identifier Strategy (INT + UUIDv7)

**Status:** Accepted
**Date:** 2026-03-12
**Version:** 1.8.2
**Review Cycle:** Core ADR (Review every 6 months or Major Version upgrade)
**Decision Makers:** Development Team, Database Architect
**Gap Resolution:** Addresses security vulnerability from sequential INT IDs (OWASP BOLA) and scalability requirements for cross-system integration (Product Vision v1.8.5, Section 2.4) and API security requirements (Security Requirements, Section 3.1)
**Version Dependency:**
- **Effective From:** v1.8.2
- **Applies To:** v1.8.2+ (Progressive implementation)
- **Backward Compatible:** v1.8.0+ (Dual-mode transition)
- **Required For:** v1.9.0+ (All public APIs must use UUID)

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

## Impact Analysis

### Affected Components

| Component | Impact Level | Description |
|-----------|--------------|-------------|
| **Database Schema** | **High** | Add UUID columns to 14 core tables with UNIQUE indexes |
| **Backend Entities** | **High** | Add BaseUuidEntity, update all public-facing entities |
| **API Layer** | **High** | Update controllers, services, DTOs to use UUID parameters |
| **Frontend Types** | **Medium** | Update TypeScript interfaces to use publicId consistently |
| **URL Routing** | **Medium** | Change route patterns from INT to UUID parameters |
| **Security Model** | **Medium** | Enhanced OWASP BOLA protection, API authentication |
| **Caching Strategy** | **Medium** | Redis cache keys transition from INT to UUID |
| **API Documentation** | **Low** | Update endpoint documentation and examples |
| **Testing Framework** | **Low** | Update test fixtures and mock data |

### Required Changes

| Change Category | Specific Changes | Priority |
|----------------|------------------|----------|
| **Database** | <ul><li>ADD UUID column to 14 core tables (SQL First)</li><li>CREATE UNIQUE INDEX on each UUID column</li><li>Update data dictionary with new fields</li></ul> | **Critical** |
| **Backend** | <ul><li>Create BaseUuidEntity with publicId property</li><li>Update 14+ entities to extend BaseUuidEntity</li><li>Modify controllers to accept UUID parameters</li><li>Update services to resolve UUID → INT for queries</li><li>Modify DTOs to expose publicId, exclude INT id</li></ul> | **Critical** |
| **API Layer** | <ul><li>Update route patterns to use :uuid parameters</li><li>Add ParseUUIDPipe for validation</li><li>Implement FindByIdOrUuid methods during transition</li><li>Update API responses to return publicId</li></ul> | **Critical** |
| **Frontend** | <ul><li>Update all TypeScript interfaces to use publicId</li><li>Remove fallback uuid/id fields from types</li><li>Update URL construction to use publicId</li><li>Modify API calls to pass UUID strings</li></ul> | **High** |
| **Security** | <ul><li>Update CASL policies to work with UUID identifiers</li><li>Enhance API authentication for UUID-based routes</li><li>Update audit logging to use UUID references</li></ul> | **High** |
| **Caching** | <ul><li>Update Redis cache key strategy to use UUID</li><li>Implement cache invalidation for UUID-based keys</li><li>Migrate existing cache entries during transition</li></ul> | **Medium** |
| **Testing** | <ul><li>Update unit tests with UUID fixtures</li><li>Modify integration tests for UUID routes</li><li>Add performance tests for UUID vs INT lookups</li></ul> | **Medium** |
| **Documentation** | <ul><li>Update API documentation with UUID examples</li><li>Create migration guide for developers</li><li>Update frontend development guidelines</li></ul> | **Medium** |

### Cross-Component Dependencies

| Dependency | Source | Target | Impact |
|------------|--------|--------|--------|
| **Entity → Database** | BaseUuidEntity publicId property | Database uuid column | Data persistence |
| **Controller → Service** | UUID route parameters | Service UUID resolution | Request handling |
| **Frontend → API** | publicId in TypeScript | UUID API endpoints | Data binding |
| **Cache → Database** | Redis UUID keys | Database UUID lookups | Performance |
| **Security → API** | CASL UUID policies | UUID-based route protection | Authorization |
| **Documentation → Code** | UUID examples | Implementation patterns | Developer guidance |

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

/**
 * Abstract base entity providing a UUID public identifier.
 *
 * Naming Convention:
 * - TypeScript Property: `publicId` — semantic name indicating this is the public-facing identifier
 * - Database Column: `uuid` — MariaDB native UUID type (stored as BINARY(16))
 *
 * This avoids confusion between the property name and the DB data type,
 * while clearly indicating this is the ID exposed via API (not internal INT PK).
 */
export abstract class UuidBaseEntity {
  @Column({
    type: 'uuid',
    name: 'uuid',           // DB column name (MariaDB native UUID type)
    unique: true,
    nullable: false,
    comment: 'UUID Public Identifier (ADR-019)',
  })
  publicId!: string;        // TypeScript property name — semantic, avoids type confusion

  @BeforeInsert()
  generateUuid(): void {
    if (!this.publicId) {
      this.publicId = uuidv7();
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
  id!: number;              // Internal INT PK — never exposed via API

  // publicId (from BaseUuidEntity) is the UUID exposed via API
  // DB Column: uuid (MariaDB native UUID type)

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
async findByUuid(publicId: string): Promise<CorrespondenceDto> {
  const entity = await this.repository.findOne({
    where: { publicId },   // Use publicId property (DB column is 'uuid')
  });
  if (!entity) throw new NotFoundException();
  return this.toDto(entity);
}
```

### DTO Pattern — Expose publicId Directly

```typescript
export class CorrespondenceResponseDto {
  // ✅ Expose publicId directly in API response
  publicId!: string;

  // ❌ Never expose internal INT id
  // id: number; — REMOVED from response

  // ... other fields
  // For FK references, also use publicId
  projectPublicId!: string;
}
```

> **Note:** We use `publicId` directly in API responses (not transformed to `id`) to maintain naming consistency between Backend Entity property and Frontend Type property. This prevents confusion when mapping data.

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

- เพิ่ม `publicId` field ใน TypeORM Entities (DB column ยังชื่อ `uuid`)
- สร้าง `BaseUuidEntity` class ด้วย `publicId` property
- API รับได้ทั้ง INT และ UUID ผ่าน `FindByIdOrUuid` pattern
- API Response รวม UUID เป็น `id` field (via @Expose)

### Phase 3: Frontend (Consistent publicId Usage)

- Frontend ใช้ `publicId` เป็น Standard ทุก Type (ไม่ใช้ `uuid` หรือ `id` ที่เป็น number)
- URL parameters ใช้ `publicId` (UUID string)
- ทุก Type Definition ใช้ `publicId?: string` อย่างเดียว — ไม่มี fallback เป็น `uuid` หรือ `id`

**Example:**
```typescript
// ✅ Correct — Consistent publicId usage
type ProjectOption = {
  publicId?: string;
  projectName?: string;
  projectCode?: string;
};

// ❌ Wrong — Multiple identifier fields cause confusion
type ProjectOption = {
  publicId?: string;
  uuid?: string;  // Don't do this
  id?: number;    // Don't do this
  projectName?: string;
};
```

### Phase 4: Cleanup

- ลบ INT ID จาก API Response (DTO)
- ลบ INT-based route handlers
- Update API Documentation

---

## Final Assessment

| Area                   | Status                               |
| ---------------------- | ------------------------------------ |
| Security               | ✅ Eliminates ID enumeration         |
| Performance            | ✅ No impact on internal JOINs         |
| Migration Risk         | ✅ Low — ADD COLUMN only             |
| Storage Impact         | ✅ Negligible (~3.8 MB)              |
| Backward Compatibility | ✅ Dual-mode transition              |
| ADR Compliance         | ✅ Compatible with all existing ADRs |

---

## Naming Convention Summary

| Context | Backend (TypeORM) | Frontend (TypeScript) | API Response |
|---------|-------------------|----------------------|--------------|
| **Entity Property** | `publicId: string` | `publicId?: string` | `publicId: string` |
| **DB Column** | `uuid UUID` | — | — |
| **Internal PK** | `id: number` (excluded) | — | — |

**Rule:** ใช้ `publicId` เป็น Identifier เดียวใน API — ไม่มีการ Transform เป็น `id` เพื่อป้องกัน confusion ระหว่าง Backend ↔ Frontend

---

## ADR Review Cycle

### Review Classification

**Core ADR Status:** This ADR is classified as a **Core Architecture Decision** due to its fundamental impact on system security, data architecture, and API design patterns.

### Review Schedule

| Review Type | Frequency | Trigger | Scope |
|-------------|-----------|---------|-------|
| **Regular Review** | Every 6 months | Calendar-based | Security effectiveness, performance impact |
| **Major Version Review** | Every major version (v2.0.0, v3.0.0) | Version planning | Architecture relevance, new requirements |
| **Security Review** | Annually or after security incident | Security audit | OWASP compliance, threat model updates |
| **Performance Review** | Quarterly | Performance monitoring | Database performance, query optimization |

### Review Process

#### Phase 1: Preparation (1 week before review)
1. **Metrics Collection**
   - UUID vs INT query performance benchmarks
   - Security incident reports related to ID enumeration
   - Storage usage and growth patterns
   - Developer adoption and compliance rates
   - Cross-system integration success metrics

2. **Stakeholder Notification**
   - Development Team
   - Database Architect
   - Security Team
   - API Team
   - Frontend Team

#### Phase 2: Review Meeting (2-hour session)
1. **Security Assessment**
   - Review any ID enumeration attempts
   - Assess OWASP BOLA protection effectiveness
   - Evaluate UUID randomness and collision resistance

2. **Performance Evaluation**
   - Analyze UUID lookup performance vs INT
   - Review index fragmentation and maintenance
   - Assess storage impact and growth projections

3. **Implementation Compliance**
   - Check frontend publicId usage consistency
   - Verify API endpoint UUID adoption
   - Review cache key migration progress

#### Phase 3: Decision & Documentation (1 week after review)
1. **Review Outcomes**
   - **No Change:** ADR remains valid and effective
   - **Update Required:** Adjust naming conventions or patterns
   - **Supersede:** New ADR created for different identifier strategy
   - **Retire:** ADR no longer relevant (unlikely given core nature)

2. **Documentation Updates**
   - Update review date and findings
   - Add new version notes
   - Update implementation guidelines
   - Modify transition timeline if needed

### Review Criteria

| Criterion | Question | Pass/Fail Threshold |
|-----------|----------|---------------------|
| **Security Effectiveness** | Are ID enumeration attacks prevented? | Pass: 0 incidents, Fail: Any successful enumeration |
| **Performance Impact** | Are UUID lookups within acceptable limits? | Pass: <50ms avg, Fail: >50ms avg |
| **Developer Compliance** | Is publicId used consistently across codebase? | Pass: >95% compliance, Fail: <95% |
| **Storage Efficiency** | Is storage impact within projections? | Pass: <5% deviation, Fail: >5% |
| **API Coverage** | Are all public APIs using UUID? | Pass: 100% coverage, Fail: Any INT-based endpoints |
| **Frontend Consistency** | Are all TypeScript types using publicId? | Pass: 100% compliance, Fail: Any fallback fields |

### Review History Template

```
## Review Cycle [YYYY-MM-DD]

**Review Type:** [Regular/Major Version/Security/Performance]
**Reviewers:** [Names and roles]
**Duration:** [Meeting date]

### Findings
- [Key findings from security and performance assessment]

### Issues Identified
- [Problems or concerns discovered]

### Recommendations
- [Action items and decisions]

### Outcome
- [No Change/Update Required/Supersede/Retire]

### Next Review Date
- [YYYY-MM-DD]
```

---

## 🔄 Change Log

| Version | Date       | Changes                                                             | Updated By  |
| ------- | ---------- | ------------------------------------------------------------------- | ----------- |
| 1.8.3   | 2026-04-04 | Enhanced — Added Impact Analysis template, ADR Review Cycle process, Gap Linking to requirements, and Version Dependency tracking | System Architect |
| 1.8.2   | 2026-04-01 | Removed Waiver: Session Identity to enforce strict `publicId` usage | Antigravity |
| 1.8.1   | 2026-03-21 | Added Naming Convention Summary & Transition Strategy               | Claude      |
| 1.8.0   | 2026-03-12 | Initial Decision Outcome & Technical Spec                           | Human Dev   |

---

**Last Updated:** 2026-04-04
**Status:** Accepted
**Implementation Target:** v1.9.0+ (Progressive)
**Next Review Date:** 2026-10-04 (6-month regular review)

_สำหรับรายละเอียดการ Implement ดูที่ Implementation Plan ใน `05-07-hybrid-uuid-implementation-plan.md`_
