# Task: Database Setup & Migrations

**Status:** Not Started
**Priority:** P0 (Critical - Foundation)
**Estimated Effort:** 2-3 days
**Dependencies:** None
**Owner:** Backend Team

---

## 📋 Overview

ตั้งค่า Database schema สำหรับ LCBP3-DMS โดยใช้ TypeORM Migrations และ Seeding data

---

## 🎯 Objectives

- ✅ สร้าง Initial Database Schema
- ✅ Setup TypeORM Configuration
- ✅ Create Migration System
- ✅ Setup Seed Data
- ✅ Verify Database Structure

---

## 📝 Acceptance Criteria

1. **Database Schema:**
   - ✅ ทุกตารางถูกสร้างตาม Data Dictionary v1.5.1
   - ✅ Foreign Keys ถูกต้องครบถ้วน
   - ✅ Indexes ครบตาม Specification
   - ✅ Virtual Columns สำหรับ JSON fields

2. **Migrations:**
   - ✅ Migration files เรียงลำดับถูกต้อง
   - ✅ สามารถ `migrate:up` และ `migrate:down` ได้
   - ✅ ไม่มี Data loss เมื่อ rollback

3. **Seed Data:**
   - ✅ Master data (Organizations, Project, Roles, Permissions)
   - ✅ Test users สำหรับแต่ละ Role
   - ✅ Sample data สำหรับ Development

---

## 🛠️ Implementation Steps

### 1. TypeORM Configuration

```typescript
// File: backend/src/config/database.config.ts
import { TypeOrmModuleOptions } from '@nestjs/typeorm';

export const databaseConfig: TypeOrmModuleOptions = {
  type: 'mysql',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 3306,
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  entities: [__dirname + '/../**/*.entity{.ts,.js}'],
  migrations: [__dirname + '/../database/migrations/*{.ts,.js}'],
  migrationsRun: false, // Manual migration
  synchronize: false, // ห้ามใช้ใน Production
  logging: process.env.NODE_ENV === 'development',
};
```

### 2. Create Entity Classes

**Core Entities:**

- `Organization` (organizations)
- `Project` (projects)
- `Contract` (contracts)
- `User` (users)
- `Role` (roles)
- `Permission` (permissions)
- `UserAssignment` (user_assignments)

**Document Entities:**

- `Correspondence` (correspondences)
- `CorrespondenceRevision` (correspondence_revisions)
- `Rfa` (rfas)
- `RfaRevision` (rfa_revisions)
- `ShopDrawing` (shop_drawings)
- `ShopDrawingRevision` (shop_drawing_revisions)

**Supporting Entities:**

- `WorkflowDefinition` (workflow_definitions)
- `WorkflowInstance` (workflow_instances)
- `WorkflowHistory` (workflow_history)
- `DocumentNumberFormat` (document_number_formats)
- `DocumentNumberCounter` (document_number_counters)
- `Attachment` (attachments)
- `AuditLog` (audit_logs)

### 3. Create Initial Migration

```bash
npm run migration:generate -- -n InitialSchema
```

**Migration File Structure:**

```typescript
// File: backend/src/database/migrations/1701234567890-InitialSchema.ts
import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1701234567890 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create organizations table
    await queryRunner.query(`
      CREATE TABLE organizations (
        id INT PRIMARY KEY AUTO_INCREMENT,
        organization_code VARCHAR(20) NOT NULL UNIQUE,
        organization_name VARCHAR(200) NOT NULL,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        deleted_at TIMESTAMP NULL,
        INDEX idx_org_code (organization_code),
        INDEX idx_org_active (is_active, deleted_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // Continue with other tables...
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS organizations;`);
    // Rollback other tables...
  }
}
```

### 4. Create Seed Script

```typescript
// File: backend/src/database/seeds/run-seed.ts
import { DataSource } from 'typeorm';
import { seedOrganizations } from './organization.seed';
import { seedRoles } from './role.seed';
import { seedUsers } from './user.seed';

async function runSeeds() {
  const dataSource = new DataSource(databaseConfig);
  await dataSource.initialize();

  try {
    console.log('🌱 Seeding database...');

    await seedOrganizations(dataSource);
    await seedRoles(dataSource);
    await seedUsers(dataSource);

    console.log('✅ Seeding completed!');
  } catch (error) {
    console.error('❌ Seeding failed:', error);
  } finally {
    await dataSource.destroy();
  }
}

runSeeds();
```

---

## ✅ Testing & Verification

### 1. Migration Testing

```bash
# Run migrations
npm run migration:run

# Verify tables created
mysql -u root -p lcbp3_dev -e "SHOW TABLES;"

# Rollback one migration
npm run migration:revert

# Re-run migrations
npm run migration:run
```

### 2. Seed Data Verification

```bash
# Run seed
npm run seed

# Verify data
mysql -u root -p lcbp3_dev -e "SELECT * FROM organizations;"
mysql -u root -p lcbp3_dev -e "SELECT * FROM roles;"
mysql -u root -p lcbp3_dev -e "SELECT * FROM users;"
```

### 3. Schema Validation

```sql
-- Check Foreign Keys
SELECT
  TABLE_NAME, CONSTRAINT_NAME, REFERENCED_TABLE_NAME
FROM
  INFORMATION_SCHEMA.KEY_COLUMN_USAGE
WHERE
  TABLE_SCHEMA = 'lcbp3_dev'
  AND REFERENCED_TABLE_NAME IS NOT NULL;

-- Check Indexes
SELECT
  TABLE_NAME, INDEX_NAME, COLUMN_NAME
FROM
  INFORMATION_SCHEMA.STATISTICS
WHERE
  TABLE_SCHEMA = 'lcbp3_dev'
ORDER BY
  TABLE_NAME, INDEX_NAME;
```

---

## 📚 Related Documents

- [Data Dictionary v1.4.5](../../docs/4_Data_Dictionary_V1_4_5.md)
- [SQL Schema](../../docs/8_lcbp3_v1_4_5.sql)
- [Data Model](../02-architecture/data-model.md)

---

## 📦 Deliverables

- [ ] TypeORM configuration file
- [ ] Entity classes (50+ entities)
- [ ] Initial migration file
- [ ] Seed scripts (organizations, roles, users)
- [ ] Migration test script
- [ ] Documentation: How to run migrations

---

## 🚨 Risks & Mitigation

| Risk                | Impact | Mitigation                                  |
| ------------------- | ------ | ------------------------------------------- |
| Migration errors    | High   | Test on dev DB first, backup before migrate |
| Missing indexes     | Medium | Review Data Dictionary carefully            |
| Seed data conflicts | Low    | Use `INSERT IGNORE` or check existing       |

---

## 📌 Notes

- ใช้ `utf8mb4_unicode_ci` สำหรับ Thai language support
- ตรวจสอบ Virtual Columns สำหรับ JSON indexing
- ใช้ `@VersionColumn()` สำหรับ Optimistic Locking tables
