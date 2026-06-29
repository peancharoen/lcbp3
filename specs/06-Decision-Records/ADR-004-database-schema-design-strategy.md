# ADR-004: Database Schema Design Strategy

**Status:** ✅ Accepted (Implementation Ready)
**Date:** 2026-04-04
**Decision Makers:** Development Team, System Architect, Database Administrator
**Related Documents:**

- [Database Schema Tables](../03-Data-and-Storage/lcbp3-v1.8.0-schema-02-tables.sql)
- [Data Dictionary](../03-Data-and-Storage/03-01-data-dictionary.md)
- [ADR-009: Database Migration Strategy](./ADR-009-database-migration-strategy.md)
- [ADR-019: Hybrid Identifier Strategy](./ADR-019-hybrid-identifier-strategy.md)

---

## 🎯 Gap Analysis & Purpose

### ปิด Gap จากเอกสาร:
- **Database Schema Tables** - Section 1: "ตารางต้องมีโครงสร้างที่สอดคล้องกันและรองรับ Business Logic"
  - เหตุผล: ต้องการบันทึกการตัดสินใจเกี่ยวกับ Schema Patterns ที่ใช้จริง
- **Data Dictionary** - Section 2: "การตั้งชื่อคอลัมน์และความสัมพันธ์ต้องสอดคล้องกัน"
  - เหตุผล: ต้องการทำให้ naming conventions เป็นมาตรฐานเดียวกัน

### แก้ไขความขัดแย้ง:
- **Normalization** vs **Performance**: ต้องการ Database Normalization แต่ต้องรักษา Performance สำหรับ DMS
  - การตัดสินใจนี้ช่วยแก้ไขโดย: ใช้ selective denormalization และ strategic indexing

---

## Context and Problem Statement

LCBP3-DMS ต้องการ Database Schema Design ที่:

1. **Consistent:** ทุกตารางใช้ Patterns เดียวกัน
2. **Scalable:** รองรับข้อมูลจำนวนมากและ Complex Queries
3. **Maintainable:** ง่ายต่อการ Modify และ Debug
4. **Performance:** รองรับ High-volume Operations พร้อม Concurrent Access
5. **Audit-Ready:** รองรับ Audit Trail และ Compliance

### Key Challenges

1. **Identifier Strategy:** การใช้ทั้ง INT PK และ UUID (ADR-019)
2. **Soft Delete:** การจัดการการลบข้อมูลแบบ Soft Delete
3. **Audit Trail:** การติดตามการเปลี่ยนแปลงข้อมูล
4. **Workflow State:** การจัดการ State Machines ใน Database
5. **Document Relationships:** การจัดการ Complex Many-to-Many Relationships

---

## Decision Drivers

- **Data Integrity:** ป้องกัน Data Corruption และ Inconsistencies
- **Performance:** Query Response Times < 200ms (p90)
- **Scalability:** รองรับ 100+ concurrent users
- **Maintainability:** ง่ายต่อการ Add/Modify Columns
- **Auditability:** Complete audit trail สำหรับ Compliance
- **Migration Safety:** ง่ายต่อการ Schema Evolution

---

## Considered Options

### Option 1: Highly Normalized (3NF+)

**แนวทาง:** Strict normalization ทุกตาราง

**Pros:**

- ✅ Data integrity สูงสุด
- ✅ Minimal data duplication
- ✅ Theoretical correctness

**Cons:**

- ❌ Complex queries มากขึ้น
- ❌ Performance impact จาก JOINs
- ❌ ยากต่อการ maintain ในระยะยาว

### Option 2: Denormalized for Performance

**แนวทาง:** Duplicate data สำหรับ performance

**Pros:**

- ✅ Fast queries (fewer JOINs)
- ✅ Simple read operations
- ✅ Good for reporting

**Cons:**

- ❌ Data synchronization complexity
- ❌ Higher storage requirements
- ❌ Risk of inconsistencies

### Option 3: **Selective Normalization with Strategic Patterns** ⭐ (Selected)

**แนวทาง:** Normalize ที่สำคัญ แต่ denormalize ที่จำเป็น พร้อม Standard Patterns

**Pros:**

- ✅ **Balance Performance & Integrity:** Optimize สำหรับ use case จริง
- ✅ **Consistent Patterns:** Standard conventions ทั่วทั้ง schema
- ✅ **Audit Trail Built-in:** Soft delete + tracking tables
- ✅ **Migration Ready:** ง่ายต่อการ evolve schema
- ✅ **Workflow Support:** Native state management

**Cons:**

- ❌ Requires architectural discipline
- ❌ More complex initial design

---

## Decision Outcome

**Chosen Option:** Option 3 - Selective Normalization with Strategic Patterns

### Rationale

เลือก Selective Normalization เนื่องจาก:

1. **Business Reality:** DMS มี both transactional และ reporting needs
2. **Performance Requirements:** ต้องการ fast reads สำหรับ list views แต่ maintain integrity สำหรับ transactions
3. **Maintainability:** Standard patterns ลดความซับซ้อนในระยะยาว
4. **Audit Requirements:** Built-in audit trail จำเป็นสำหรับ document management

---

## 🔍 Impact Analysis

### Affected Components (ส่วนประกอบที่ได้รับผลกระทบ)

| Component | Level | Impact Description | Required Action |
|-----------|-------|-------------------|-----------------|
| **Database Schema** | 🔴 High | ทุกตารางต้องใช้ standard patterns | Refactor all tables |
| **TypeORM Entities** | 🔴 High | Entity classes ต้อง映射 schema patterns | Update entity definitions |
| **Migration Scripts** | 🔴 High | ต้องมี migration สำหรับ pattern changes | Create migration strategy |
| **Queries & Services** | 🟡 Medium | ต้อง optimize queries สำหรับ new patterns | Update service queries |
| **Performance Testing** | 🟡 Medium | ต้อง validate performance ของ patterns | Load testing |

### Required Changes (การเปลี่ยนแปลงที่ต้องดำเนินการ)

#### 🔴 Critical Changes (ต้องทำทันที)
- [ ] **Define Schema Standards** - สร้างมาตรฐานการออกแบบตาราง
- [ ] **Implement Base Entity Pattern** - สำหรับ common fields
- [ ] **Update Core Tables** - ใช้ standard patterns
- [ ] **Create Audit Trail Tables** - สำหรับ tracking

#### 🟡 Important Changes (ควรทำภายใน 1 สัปดาห์)
- [ ] **Optimize Indexes** - สำหรับ performance
- [ ] **Create Migration Scripts** - สำหรับ evolution
- [ ] **Update TypeORM Entities** - reflect new patterns
- [ ] **Performance Testing** - validate improvements

#### 🟢 Nice-to-Have (ทำถ้ามีเวลา)
- [ ] **Database Documentation** - auto-generate from schema
- [ ] **Performance Monitoring** - query analysis tools
- [ ] **Schema Validation** - automated checks

---

## Implementation Details

### Schema Design Patterns

#### 1. Base Table Pattern

ทุกตารางต้องมี base columns ต่อไปนี้:

```sql
CREATE TABLE example_table (
  -- Primary Keys (ADR-019)
  id INT PRIMARY KEY AUTO_INCREMENT COMMENT 'Internal PK - never exposed',
  uuid UUID NOT NULL DEFAULT UUID() COMMENT 'Public UUID (ADR-019)',

  -- Business Columns
  name VARCHAR(255) NOT NULL,
  -- ... other business columns

  -- Standard Metadata
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'Record creation time',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Last update time',
  created_by INT NULL COMMENT 'User who created record',
  updated_by INT NULL COMMENT 'User who last updated record',
  deleted_at DATETIME NULL COMMENT 'Soft delete timestamp',

  -- Indexes
  UNIQUE INDEX idx_example_uuid (uuid),
  INDEX idx_example_created_at (created_at),
  INDEX idx_example_deleted_at (deleted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
```

#### 2. Naming Conventions

**Table Names:**

- **Plural snake_case:** `organizations`, `correspondences`, `workflow_instances`
- **Join Tables:** `table1_table2` (e.g., `correspondence_recipients`)
- **Lookup Tables:** Prefix with type: `correspondence_types`, `organization_roles`

**Column Names:**

- **Primary Keys:** `id` (INT), `uuid` (UUID)
- **Foreign Keys:** `{table}_id` (e.g., `organization_id`, `project_id`)
- **Boolean Columns:** `is_` prefix: `is_active`, `is_deleted`
- **Timestamp Columns:** `_at` suffix: `created_at`, `updated_at`, `deleted_at`
- **User References:** `_by` suffix: `created_by`, `updated_by`

#### 3. Relationship Patterns

**One-to-Many:**

```sql
-- Projects have many Contracts
CREATE TABLE contracts (
  id INT PRIMARY KEY AUTO_INCREMENT,
  uuid UUID NOT NULL DEFAULT UUID(),
  project_id INT NOT NULL,
  -- ... other columns
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);
```

**Many-to-Many:**

```sql
-- Correspondences have many Recipients
CREATE TABLE correspondence_recipients (
  id INT PRIMARY KEY AUTO_INCREMENT,
  correspondence_id INT NOT NULL,
  user_id INT NOT NULL,
  recipient_type ENUM('TO', 'CC', 'BCC') NOT NULL,
  received_at TIMESTAMP NULL,
  -- Metadata
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (correspondence_id) REFERENCES correspondences(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY unique_correspondence_recipient (correspondence_id, user_id)
);
```

#### 4. Workflow State Pattern

```sql
-- Workflow States
CREATE TABLE workflow_states (
  id INT PRIMARY KEY AUTO_INCREMENT,
  workflow_code VARCHAR(50) NOT NULL,
  state_name VARCHAR(50) NOT NULL,
  is_initial BOOLEAN DEFAULT FALSE,
  is_terminal BOOLEAN DEFAULT FALSE,
  allowed_transitions JSON NULL, -- Array of next states
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_workflow_state (workflow_code, state_name)
);

-- Workflow Instances
CREATE TABLE workflow_instances (
  id INT PRIMARY KEY AUTO_INCREMENT,
  uuid UUID NOT NULL DEFAULT UUID(),
  workflow_code VARCHAR(50) NOT NULL,
  entity_type VARCHAR(50) NOT NULL, -- 'correspondence', 'rfa', etc.
  entity_id INT NOT NULL,
  current_state VARCHAR(50) NOT NULL,
  status ENUM('ACTIVE', 'COMPLETED', 'CANCELLED') DEFAULT 'ACTIVE',
  context JSON NULL,
  -- Metadata
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (workflow_code, current_state) REFERENCES workflow_states(workflow_code, state_name)
);
```

#### 5. Audit Trail Pattern

```sql
-- Generic Audit Trail
CREATE TABLE audit_logs (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  table_name VARCHAR(50) NOT NULL,
  record_id INT NOT NULL,
  record_uuid UUID NULL,
  action ENUM('CREATE', 'UPDATE', 'DELETE', 'SOFT_DELETE') NOT NULL,
  old_values JSON NULL,
  new_values JSON NULL,
  changed_fields JSON NULL, -- Array of changed field names
  user_id INT NULL,
  ip_address VARCHAR(45) NULL,
  user_agent TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  INDEX idx_audit_table_record (table_name, record_id),
  INDEX idx_audit_user (user_id, created_at),
  INDEX idx_audit_created (created_at)
);

-- Document-specific History (for critical tables)
CREATE TABLE correspondence_histories (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  correspondence_id INT NOT NULL,
  revision_number INT NOT NULL,
  changes JSON NOT NULL, -- Full snapshot or delta
  changed_by INT NULL,
  change_reason VARCHAR(255) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (correspondence_id) REFERENCES correspondences(id) ON DELETE CASCADE,
  UNIQUE KEY unique_correspondence_revision (correspondence_id, revision_number)
);
```

#### 6. Master Data Pattern

```sql
-- Reference Data Tables
CREATE TABLE correspondence_types (
  id INT PRIMARY KEY AUTO_INCREMENT,
  type_code VARCHAR(20) NOT NULL UNIQUE, -- LETTER, RFI, MEMO
  type_name VARCHAR(100) NOT NULL,
  description TEXT NULL,
  display_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  -- Metadata
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) COMMENT='Master data: Correspondence types';
```

### TypeORM Entity Patterns

#### Base Entity

```typescript
import { CreateDateColumn, UpdateDateColumn, DeleteDateColumn } from 'typeorm';
import { UuidBaseEntity } from './uuid-base.entity';

export abstract class BaseEntity extends UuidBaseEntity {
  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt: Date;

  @DeleteDateColumn({ type: 'datetime', nullable: true })
  deletedAt?: Date;

  @Column({ type: 'int', nullable: true })
  createdBy?: number;

  @Column({ type: 'int', nullable: true })
  updatedBy?: number;
}
```

#### Entity Example

```typescript
@Entity('correspondences')
export class Correspondence extends BaseEntity {
  @Column({ type: 'varchar', length: 50 })
  documentNumber: string;

  @Column({ type: 'varchar', length: 255 })
  subject: string;

  @Column({ type: 'text', nullable: true })
  content?: string;

  @ManyToOne(() => CorrespondenceType)
  @JoinColumn({ name: 'correspondence_type_id' })
  type: CorrespondenceType;

  @ManyToOne(() => Organization)
  @JoinColumn({ name: 'originator_id' })
  originator: Organization;

  @OneToMany(() => CorrespondenceRecipient, recipient => recipient.correspondence)
  recipients: CorrespondenceRecipient[];
}
```

### Indexing Strategy

#### Primary Indexes

```sql
-- UUID for public access
CREATE UNIQUE INDEX idx_table_uuid ON table_name (uuid);

-- Performance indexes
CREATE INDEX idx_table_created_at ON table_name (created_at);
CREATE INDEX idx_table_updated_at ON table_name (updated_at);
CREATE INDEX idx_table_deleted_at ON table_name (deleted_at);
```

#### Foreign Key Indexes

```sql
-- All foreign keys should be indexed
CREATE INDEX idx_correspondence_project_id ON correspondences (project_id);
CREATE INDEX idx_correspondence_originator_id ON correspondences (originator_id);
CREATE INDEX idx_correspondence_type_id ON correspondences (correspondence_type_id);
```

#### Query-Specific Indexes

```sql
-- Composite indexes for common queries
CREATE INDEX idx_correspondences_project_status ON correspondences (project_id, status, deleted_at);
CREATE INDEX idx_correspondences_date_range ON correspondences (created_at, deleted_at) WHERE deleted_at IS NULL;
```

---

## Consequences

### Positive

1. ✅ **Consistency:** Standard patterns ทั่วทั้ง database
2. ✅ **Performance:** Strategic indexing และ selective denormalization
3. ✅ **Audit Trail:** Complete tracking สำหรับ compliance
4. ✅ **Maintainability:** Clear naming conventions และ patterns
5. ✅ **Migration Safety:** Evolution-friendly schema design
6. ✅ **Type Safety:** TypeORM entities ที่สอดคล้องกับ schema

### Negative

1. ❌ **Initial Complexity:** ต้องเรียนรู้ patterns และ conventions
2. ❌ **Storage Overhead:** Audit tables ใช้พื้นที่เพิ่ม
3. ❌ **Development Overhead:** ต้อง maintain patterns อย่างสม่ำเสมอ

### Mitigation Strategies

- **Complexity:** Comprehensive documentation และ examples
- **Storage:** Partition audit tables และ implement retention policies
- **Development:** Code generation สำหรับ boilerplate entities

---

## 🔄 Review Cycle & Maintenance

### Review Schedule
- **Next Review:** 2026-10-04 (6 months from creation)
- **Review Type:** Scheduled (Schema Strategy Review)
- **Reviewers:** System Architect, DBA, Backend Team Lead

### Review Checklist
- [ ] ยังคงตอบโจทย์ Performance Requirements หรือไม่?
- [ ] มี schema patterns ใหม่ที่ควรพิจารณาหรือไม่?
- [ ] มีปัญหา Storage หรือ Performance หรือไม่?
- [ ] ต้องการ Update หรือ Deprecate patterns ใดหรือไม่?

### Version History
| Version | Date | Changes | Status |
|---------|------|---------|--------|
| 1.0 | 2026-04-04 | Initial version - Selective Normalization Strategy | ✅ Accepted |

---

## Compliance

เป็นไปตาม:

- [Database Schema Tables](../03-Data-and-Storage/lcbp3-v1.8.0-schema-02-tables.sql)
- [Data Dictionary](../03-Data-and-Storage/03-01-data-dictionary.md)
- [ADR-009: Database Migration Strategy](./ADR-009-database-migration-strategy.md)
- [ADR-019: Hybrid Identifier Strategy](./ADR-019-hybrid-identifier-strategy.md)

---

## Related ADRs

- [ADR-009: Database Migration Strategy](./ADR-009-database-migration-strategy.md) - Schema evolution
- [ADR-019: Hybrid Identifier Strategy](./ADR-019-hybrid-identifier-strategy.md) - UUID usage
- [ADR-001: Unified Workflow Engine](./ADR-001-unified-workflow-engine.md) - Workflow state management

---

## References

- [MariaDB Documentation](https://mariadb.com/kb/en/)
- [TypeORM Documentation](https://typeorm.io/)
- [Database Design Best Practices](https://www.databasestar.com/)
