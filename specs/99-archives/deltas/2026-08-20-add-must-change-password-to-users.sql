-- File: specs/03-Data-and-Storage/deltas/2026-08-20-add-must-change-password-to-users.sql
-- Change Log:
-- - 2026-08-20: Initial delta — เพิ่ม column `must_change_password` ใน table `users`
--   เพื่อบังคับให้ seed users เปลี่ยนรหัสผ่านหลัง login ครั้งแรก (SEV-014, ADR-016)
--
-- Description:
--   1. ALTER TABLE users ADD COLUMN must_change_password TINYINT(1) NOT NULL DEFAULT 0
--   2. UPDATE users ที่ถูกสร้างโดย seed script ให้ must_change_password = 1
--      (ใช้ heuristic: username ในรายการ seed users)
--
-- อ้างอิง: ADR-044 (schema delta ไม่ใช้ TypeORM migration), ADR-016 (password security)
--
-- Idempotent: ใช้ INFORMATION_SCHEMA check ก่อน ALTER TABLE
-- Rollback: ALTER TABLE users DROP COLUMN must_change_password;
-- ------------------------------------------------------------

-- 1. เพิ่ม column ถ้ายังไม่มี
SET @col_exists = (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'users'
    AND COLUMN_NAME = 'must_change_password'
);

SET @sql = IF(
  @col_exists = 0,
  'ALTER TABLE users ADD COLUMN must_change_password TINYINT(1) NOT NULL DEFAULT 0 AFTER is_active',
  'SELECT "Column must_change_password already exists" AS info'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 2. Flag seed users ให้ต้องเปลี่ยนรหัสผ่าน (heuristic: username ในรายการ seed)
--    รายชื่อ seed users ดูจาก backend/src/database/seeds/user.seed.ts
UPDATE users
SET must_change_password = 1
WHERE username IN (
  'admin', 'org_admin', 'doc_control', 'editor', 'viewer'
)
  AND must_change_password = 0;

-- Verification query:
-- SELECT user_id, username, email, must_change_password FROM users WHERE must_change_password = 1;
