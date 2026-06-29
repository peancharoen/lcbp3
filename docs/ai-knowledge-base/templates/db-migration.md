// File: docs/ai-knowledge-base/templates/db-migration.md
# Database Change Script (SQL Delta)

## 📋 Metadata
- **Feature**: [Feature Name]
- **Requested By**: [Name]
- **Date**: [YYYY-MM-DD]
- **Risk Level**: Low / Medium / High

## 🏗️ SQL Script (ADR-009 Standard)
```sql
-- Purpose: [Add new column/table for feature X]
-- Target Table: [table_name]

-- 1. Create Table (if new)
CREATE TABLE IF NOT EXISTS `table_name` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `publicId` BINARY(16) NOT NULL UNIQUE,
    -- Custom fields...
    `version` INT DEFAULT 1,
    `createdAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updatedAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `createdBy` INT,
    `updatedBy` INT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Alter Table (if existing)
-- ALTER TABLE `table_name` ADD COLUMN `new_field` VARCHAR(255);

-- 3. Add Indexes
-- CREATE INDEX `idx_table_field` ON `table_name` (`field`);
```

## 🆘 Rollback Script
```sql
-- DROP TABLE IF EXISTS `table_name`;
-- ALTER TABLE `table_name` DROP COLUMN `new_field`;
```

---
// Change Log:
// - 2026-05-14: Initial SQL delta template based on ADR-009
