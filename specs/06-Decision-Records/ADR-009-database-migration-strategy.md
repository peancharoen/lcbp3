# ADR-009: Database Migration & Deployment Strategy

**Status:** ✅ Accepted (Penging)
**Date:** 2026-02-24
**Decision Makers:** Backend Team, DevOps Team, System Architect
**Related Documents:** [TASK-BE-001](../06-tasks/TASK-BE-015-schema-v160-migration.md), [ADR-005: Technology Stack](./ADR-005-technology-stack.md)
**Version Applicability:** v1.8.0+
**Next Review:** 2026-08-01 (6-month cycle)

---

## Gap Analysis & Requirement Linking

### ปิด Gap จาก Requirements:

| Gap/Requirement | แหล่งที่มา | วิธีการแก้ไขใน ADR นี้ |
|----------------|-------------|-------------------|
| **Schema Evolution** | [Product Vision](../00-overview/00-03-product-vision.md) - Data Integrity | TypeORM migrations with version control |
| **Zero-Downtime Deployment** | [Acceptance Criteria](../01-Requirements/01-05-acceptance-criteria.md) - AC-DEPLOY-001 | Blue-Green deployment strategy |
| **Data Safety** | [Business Rules](../01-Requirements/01-02-business-rules/01-02-02-doc-numbering-rules.md) - Document numbering | Rollback mechanism with backups |
| **Team Collaboration** | [Engineering Guidelines](../05-Engineering-Guidelines/05-02-backend-guidelines.md) - Team workflows | Git-based migration collaboration |
| **Auditability** | [Infrastructure OPS](../04-Infrastructure-OPS/04-04-deployment-guide.md) - Deployment tracking | Migration tracking table and CI/CD integration |

### แก้ไขความขัดแย้ง:

- **Conflict:** Simplicity vs. Safety (Synchronize vs. TypeORM Migrations)
- **Resolution:** Chose TypeORM Migrations for production safety
- **Trade-off:** Additional discipline required vs. Data protection

---

## Impact Analysis

### Affected Components (ส่วนประกอบที่ได้รับผลกระทบ):

| Component | ผลกระทบ | ความสำคัญ |
|-----------|----------|-----------|
| **Database Config** | TypeORM configuration with migrations | 🔴 Critical |
| **Migration Files** | Version-controlled schema changes | 🔴 Critical |
| **CI/CD Pipeline** | Automated migration execution | 🔴 Critical |
| **Deployment Scripts** | Blue-Green deployment logic | 🔴 Critical |
| **Database Backup** | Pre-migration backup strategy | 🔴 Critical |
| **Migration Testing** | Test suite for migrations | 🟡 Important |
| **Documentation** | Migration best practices guide | 🟢 Guidelines |
| **Monitoring** | Migration execution monitoring | 🟢 Guidelines |

### Required Changes (การเปลี่ยนแปลงที่ต้องดำเนินการ):

#### Backend (NestJS)
- [x] Configure TypeORM with migrations disabled
- [x] Create migration workflow scripts
- [x] Setup migration testing framework
- [x] Implement migration rollback procedures
- [x] Add migration health checks

#### DevOps/Infrastructure
- [x] Create database backup automation
- [x] Setup Blue-Green deployment pipeline
- [x] Configure migration execution in CI/CD
- [x] Add migration monitoring and alerts

#### Team Processes
- [x] Define migration review checklist
- [x] Document migration conflict resolution
- [x] Create migration approval workflow

---

## Context and Problem Statement

ระบบ LCBP3-DMS ต้องการกลยุทธ์การจัดการ Database Schema และ Data migrations ที่ปลอดภัยและเชื่อถือได้ เพื่อให้ Deploy ใหม่ได้โดยไม่ทำให้ Production data เสียหาย

### ปัญหาที่ต้องแก้:

1. **Schema Evolution:** จัดการการเปลี่ยนแปลง Schema ใน Production อย่างไร
2. **Zero-Downtime:** Deploy โดยไม่ต้อง Downtime ระบบได้หรือไม่
3. **Rollback:** หาก Migration ล้มเหลว จะ Rollback อย่างไร
4. **Data Safety:** ป้องกัน Data loss จาก Migration errors อย่างไร
5. **Team Collaboration:** หลายคน Develop พร้อมกัน จัดการ Migration conflicts อย่างไร

---

## Decision Drivers

- 🔒 **Data Safety:** ป้องกัน Data loss เป็นอันดับแรก
- ⚡ **Zero Downtime:** Deploy ได้โดยไม่ต้อง Stop service
- 🔄 **Reversibility:** สามารถ Rollback ได้ถ้า Migration ล้ม
- 👥 **Team Collaboration:** หลายคน Work พร้อมกัน ไม่ Conflict
- 📊 **Auditability:** ต้องรู้ว่า Schema เป็น Version ไหน

---

## Considered Options

### Option 1: Synchronize Schema (TypeORM synchronize: true)

**Implementation:**

```typescript
TypeOrmModule.forRoot({
  synchronize: true, // Auto-generate schema from entities
});
```

**Pros:**

- ✅ ง่ายที่สุด ไม่ต้องเขียน Migration
- ✅ เหมาะสำหรับ Development

**Cons:**

- ❌ **อันตราย** ใน Production (อาจ Drop columns/tables)
- ❌ ไม่มี Version control
- ❌ ไม่มี Rollback
- ❌ ไม่เหมาะสำหรับ Production

### Option 2: Manual SQL Scripts

**Implementation:**

- เขียน SQL scripts ด้วยมือ
- Execute โดย DBA

**Pros:**

- ✅ Full control
- ✅ Review ได้ละเอียด

**Cons:**

- ❌ Manual process (Error-prone)
- ❌ ไม่มี Automation
- ❌ ลืม Run migration ได้
- ❌ Tracking ยาก

### Option 3: TypeORM Migrations (Automated + Version Controlled)

**Implementation:**

```bash
npm run migration:generate -- MigrationName
npm run migration:run
npm run migration:revert
```

**Pros:**

- ✅ Version controlled (Git)
- ✅ Automatic tracking (`migrations` table)
- ✅ Rollback support
- ✅ Generated from Entity changes
- ✅ CI/CD integration

**Cons:**

- ❌ ต้องเขียน Migration files
- ❌ Requires discipline

---

## Decision Outcome

**Chosen Option:** **Option 3 - TypeORM Migrations + Blue-Green Deployment Strategy**

### Rationale

1. **Safety:** Migrations มี Version control และ Rollback mechanism
2. **Automation:** Run migrations auto ใน CI/CD pipeline
3. **Tracking:** ดู Migration history ได้จาก `migrations` table
4. **Team Collaboration:** Merge migrations ใน Git เหมือน Code
5. **Zero Downtime:** ใช้ Blue-Green deployment สำหรับ Breaking changes

---

## Implementation Details

### 1. TypeORM Configuration

```typescript
// File: backend/src/config/database.config.ts
export default {
  type: 'mariadb',
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT),
  username: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  entities: ['dist/**/*.entity.js'],
  migrations: ['dist/migrations/*.js'],
  migrationsTableName: 'migrations',
  synchronize: false, // NEVER true in production
  logging: process.env.NODE_ENV === 'development',
};
```

### 2. Migration Workflow

```bash
# 1. Create new entity or modify existing
# 2. Generate migration
npm run migration:generate -- -n AddDisciplineIdToCorrespondences

# Output: src/migrations/1234567890-AddDisciplineIdToCorrespondences.ts

# 3. Review generated migration
# 4. Test migration locally
npm run migration:run

# 5. Test rollback
npm run migration:revert

# 6. Commit to Git
git add src/migrations/
git commit -m "feat: add discipline_id to correspondences"
```

### 3. Migration File Example

```typescript
// File: backend/src/migrations/1234567890-AddDisciplineIdToCorrespondences.ts
import { MigrationInterface, QueryRunner, TableColumn, TableForeignKey } from 'typeorm';

export class AddDisciplineIdToCorrespondences1234567890 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add column
    await queryRunner.addColumn(
      'correspondences',
      new TableColumn({
        name: 'discipline_id',
        type: 'int',
        isNullable: true,
      })
    );

    // Add foreign key
    await queryRunner.createForeignKey(
      'correspondences',
      new TableForeignKey({
        columnNames: ['discipline_id'],
        referencedTableName: 'disciplines',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      })
    );

    // Add index
    await queryRunner.query('CREATE INDEX idx_correspondences_discipline_id ON correspondences(discipline_id)');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Reverse order: index → FK → column
    await queryRunner.query('DROP INDEX idx_correspondences_discipline_id ON correspondences');

    const table = await queryRunner.getTable('correspondences');
    const foreignKey = table.foreignKeys.find((fk) => fk.columnNames.indexOf('discipline_id') !== -1);
    await queryRunner.dropForeignKey('correspondences', foreignKey);

    await queryRunner.dropColumn('correspondences', 'discipline_id');
  }
}
```

### 4. CI/CD Pipeline Integration

```yaml
# File: .github/workflows/deploy.yml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v2

      - name: Install dependencies
        run: npm install

      - name: Build
        run: npm run build

      - name: Run migrations
        run: npm run migration:run
        env:
          DB_HOST: ${{ secrets.DB_HOST }}
          DB_PORT: ${{ secrets.DB_PORT }}
          DB_USER: ${{ secrets.DB_USER }}
          DB_PASS: ${{ secrets.DB_PASS }}
          DB_NAME: ${{ secrets.DB_NAME }}

      - name: Deploy application
        run: |
          # Deploy to server
          pm2 restart app
```

### 5. Zero-Downtime Migration Strategy

**กรณี Non-Breaking Changes (เพิ่ม Column ใหม่):**

```bash
# Step 1: Add nullable column (Old code still works)
ALTER TABLE correspondences ADD COLUMN discipline_id INT NULL;

# Step 2: Deploy new code (Can use new column)
pm2 restart app

# Step 3: (Optional) Backfill data if needed
UPDATE correspondences SET discipline_id = X WHERE ...;
```

**กรณี Breaking Changes (ลบ Column, เปลี่ยนชนิด):**

**Blue-Green Deployment:**

```bash
# Step 1: Deploy "Green" (New version) พร้อม Migration
# - Database supports ทั้ง old + new schema
# - Run migration: Add new column, Keep old column

# Step 2: Route traffic to "Green"
# - Load balancer switches to new version

# Step 3: Verify "Green" works
# - Monitor errors, metrics

# Step 4: (After 24h) Cleanup old schema
# - Run migration: Drop old column
# - Shutdown "Blue" (Old version)
```

### 6. Migration Testing

```typescript
// File: backend/test/migrations/migration.spec.ts
describe('Migrations', () => {
  let dataSource: DataSource;

  beforeEach(async () => {
    dataSource = await createTestDataSource();
  });

  it('should run all migrations successfully', async () => {
    await dataSource.runMigrations();

    // Verify tables exist
    const tables = await dataSource.query('SHOW TABLES');
    expect(tables).toContainEqual(expect.objectContaining({ Tables_in_lcbp3: 'correspondences' }));
  });

  it('should rollback all migrations successfully', async () => {
    await dataSource.runMigrations();
    await dataSource.undoLastMigration();

    // Verify rollback worked
  });
});
```

---

## Consequences

### Positive Consequences

1. ✅ **Version Control:** Migrations อยู่ใน Git มี History
2. ✅ **Automation:** CI/CD run migrations automatically
3. ✅ **Rollback:** สามารถ Revert migration ได้
4. ✅ **Audit Trail:** ดู Migration history ใน `migrations` table
5. ✅ **Zero Downtime:** สามารถ Deploy โดยไม่ Downtime (Blue-Green)

### Negative Consequences

1. ❌ **Discipline Required:** ต้อง Review migrations ก่อน Merge
2. ❌ **Complex Rollbacks:** Breaking changes ยาก Rollback
3. ❌ **Migration Conflicts:** หลายคน Develop อาจ Conflict (แก้ด้วย Rebase)

### Mitigation Strategies

- **Code Review:** Review migrations เหมือน Code
- **Testing:** Test migrations ใน Staging ก่อน Production
- **Backup:** Backup database ก่อน Run migration ใน Production
- **Monitoring:** Monitor migration execution time และ Errors
- **Documentation:** Document Breaking changes ชัดเจน

---

## Migration Best Practices

### DO:

- ✅ Test migrations ใน Development และ Staging
- ✅ Backup database ก่อน Production migration
- ✅ ใช้ Transactions (TypeORM มีอัตโนมัติ)
- ✅ เขียน `down()` migration สำหรับ Rollback
- ✅ ใช้ Nullable columns สำหรับ Non-breaking changes

### DON'T:

- ❌ Run `synchronize: true` ใน Production
- ❌ ลบ Column/Table โดยไม่ Deploy code ก่อน
- ❌ เปลี่ยน Data type โดยตรง (ใช้ New column แทน)
- ❌ Hardcode Values ใน Migration (ใช้ Environment variables)

---

## ADR Review Cycle

### Core Principle Review Schedule
- **Review Frequency:** ทุก 6 เดือน (กุมภาพันธ์ และ สิงหาคม)
- **Trigger Events:**
  - Major version upgrade (v1.9.0, v2.0.0)
  - Complex schema changes requiring breaking migrations
  - Database performance issues
  - New TypeORM version compatibility

### Review Checklist
- [ ] Migration process still meeting safety requirements
- [ ] Zero-downtime strategy effective
- [ ] Rollback procedures tested and working
- [ ] Team collaboration workflow smooth
- [ ] Cross-document dependencies still valid
- [ ] New database technologies or patterns to consider
- [ ] Migration execution time within acceptable limits

### Version Dependency Matrix

| System Version | ADR Version | Required Changes | Status |
|----------------|-------------|------------------|---------|
| v1.8.0 - v1.8.5 | ADR-009 v1.0 | Base TypeORM migration setup | ✅ Complete |
| v1.9.0+ | ADR-009 v1.1 | Review migration performance and tools | 📋 Planned |
| v2.0.0+ | ADR-009 v2.0 | Consider new database patterns | 📋 Future |

---

## Related ADRs

- [ADR-005: Technology Stack](./ADR-005-technology-stack.md) - เลือกใช้ TypeORM
- [TASK-BE-001: Database Migrations](../06-tasks/TASK-BE-015-schema-v160-migration.md)

---

## References

- [TypeORM Migrations](https://typeorm.io/migrations)
- [Blue-Green Deployment](https://martinfowler.com/bliki/BlueGreenDeployment.html)
- [Zero-Downtime Migrations](https://www.braintreepayments.com/blog/safe-operations-for-high-volume-postgresql/)

---

**Document Version:** v1.0
**Last Updated:** 2026-02-24
**Next Review:** 2026-08-01 (6-month cycle)
**Version Applicability:** LCBP3 v1.8.0+

---

## Change History

| Version | Date | Changes | Author |
|---------|------|---------|---------|
| v1.0 | 2026-02-24 | Initial ADR creation with migration strategy | Backend Team |
| v1.1 | 2026-04-04 | Added structured templates: Impact Analysis, Gap Linking, Version Dependency, Review Cycle | System Architect |
