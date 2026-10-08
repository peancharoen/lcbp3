-- File: specs/03-Data-and-Storage/deltas/2026-10-06-user-grouping-model.rollback.sql
-- Change Log:
-- - 2026-10-06: Rollback ของ 2026-10-06-user-grouping-model.sql
--
-- ⚠️ DATA LOSS NOTES:
-- - user_organizations/user_groups/departments/reminder_rule_recipients ถูก drop ทั้งตาราง
--   → membership, แผนก, กลุ่ม, recipients ที่สร้างหลัง apply delta จะหายทั้งหมด
-- - notify_roles ถูกสร้างคืนเป็น column ว่าง — backfill กลับจาก reminder_rule_recipients
--   เฉพาะ symbolic types เท่านั้น (concrete types หาย)
-- - users.primary_organization_id ไม่ได้แตะ (delta ไม่ drop column นี้อยู่แล้ว)

-- 0. notification_channels — drop CHECK + FK + columns ก่อน (ต้องทำก่อน drop user_groups/departments)
SET @chk_exists := (
  SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE()
    AND TABLE_NAME = 'notification_channels'
    AND CONSTRAINT_NAME = 'chk_channel_single_scope'
);
SET @sql := IF(@chk_exists > 0,
  'ALTER TABLE notification_channels DROP CONSTRAINT chk_channel_single_scope',
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @fk_exists := (
  SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE()
    AND TABLE_NAME = 'notification_channels'
    AND CONSTRAINT_NAME = 'fk_channels_user_group'
);
SET @sql := IF(@fk_exists > 0,
  'ALTER TABLE notification_channels DROP FOREIGN KEY fk_channels_user_group',
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @fk_exists := (
  SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE()
    AND TABLE_NAME = 'notification_channels'
    AND CONSTRAINT_NAME = 'fk_channels_department'
);
SET @sql := IF(@fk_exists > 0,
  'ALTER TABLE notification_channels DROP FOREIGN KEY fk_channels_department',
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

ALTER TABLE notification_channels
  DROP INDEX IF EXISTS idx_channels_user_group_active,
  DROP INDEX IF EXISTS idx_channels_department_active;

ALTER TABLE notification_channels
  DROP COLUMN IF EXISTS user_group_id,
  DROP COLUMN IF EXISTS department_id;

-- 1. distribution_recipients enum กลับเป็นชุดเดิม
--    ⚠️ ถ้ามี rows ที่ใช้ GROUP/DEPARTMENT อยู่ จะ fail — ตรวจก่อน:
--    SELECT * FROM distribution_recipients WHERE recipient_type IN ('GROUP','DEPARTMENT');
ALTER TABLE `distribution_recipients`
  MODIFY COLUMN `recipient_type` ENUM('USER', 'ORGANIZATION', 'TEAM', 'ROLE') NOT NULL,
  MODIFY COLUMN `recipient_public_id` UUID NOT NULL COMMENT 'publicId ของ target entity (UUIDv7 หรือ UUIDv1 ตามที่มาของ record): USER=users.uuid | ORGANIZATION=organizations.uuid | TEAM=review_teams.uuid | ROLE=roles.uuid';

-- 2. reminder_rules.notify_roles — สร้างคืน + backfill จาก symbolic recipients
--    ⚠️ สำหรับ DB ที่เป็นโครง legacy (เช่น production np-dms-lcbp3 ที่ delta §5.1 reconcile ไป):
--    rollback block ด้านล่างจะคืน legacy columns ด้วย — ถ้า DB ต้นทางเป็น spec shape อยู่แล้ว
--    (fresh install จาก schema-02-tables.sql) ให้ข้าม block นี้เพราะ spec columns เดิมถูกต้องอยู่แล้ว
ALTER TABLE reminder_rules
  ADD COLUMN IF NOT EXISTS notify_roles TEXT NULL COMMENT 'CSV ของ symbolic recipient types (legacy — superseded by reminder_rule_recipients)';

-- 2.1 คืน legacy shape (กลับด้าน delta §5.1) — เฉพาะ DB ที่เดิมเป็นโครง legacy
ALTER TABLE reminder_rules
  DROP COLUMN IF EXISTS document_type_code,
  DROP COLUMN IF EXISTS days_before_due,
  DROP COLUMN IF EXISTS escalation_level,
  DROP COLUMN IF EXISTS message_template,
  ADD COLUMN IF NOT EXISTS document_type_id INT NULL COMMENT 'NULL = all types' AFTER project_id,
  ADD COLUMN IF NOT EXISTS trigger_days_before_due INT NOT NULL DEFAULT 2 AFTER document_type_id,
  ADD COLUMN IF NOT EXISTS escalation_days_after_due INT NOT NULL DEFAULT 1 AFTER trigger_days_before_due,
  ADD COLUMN IF NOT EXISTS message_template_th TEXT NULL,
  ADD COLUMN IF NOT EXISTS message_template_en TEXT NULL;

UPDATE reminder_rules r
SET r.notify_roles = (
  SELECT GROUP_CONCAT(x.recipient_type ORDER BY x.recipient_type SEPARATOR ',')
  FROM reminder_rule_recipients x
  WHERE x.rule_id = r.id
    AND x.recipient_type IN ('TASK_ASSIGNEE', 'TEAM_LEAD', 'PROJECT_MANAGER')
)
WHERE EXISTS (
  SELECT 1 FROM reminder_rule_recipients x
  WHERE x.rule_id = r.id
    AND x.recipient_type IN ('TASK_ASSIGNEE', 'TEAM_LEAD', 'PROJECT_MANAGER')
);

-- 2.2 (legacy DBs เท่านั้น) rename กลับเป็น recipients ตามโครงเดิม
--     ถ้า DB ต้นทางเป็น spec shape อยู่แล้ว → ข้าม statement นี้ (คงชื่อ notify_roles ไว้)
ALTER TABLE reminder_rules
  CHANGE COLUMN notify_roles recipients TEXT NULL COMMENT 'Comma-separated: ASSIGNEE,MANAGER,PROJECT_MANAGER';

DROP TABLE IF EXISTS reminder_rule_recipients;

-- 3. circulation_routings.assigned_group_id — drop FK ก่อน column
--    ⚠️ routing ที่ assigned ผ่าน group จะสูญ context เดิม
SET @fk_exists := (
  SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE()
    AND TABLE_NAME = 'circulation_routings'
    AND CONSTRAINT_NAME = 'circulation_routings_ibfk_group'
);
SET @sql := IF(@fk_exists > 0,
  'ALTER TABLE circulation_routings DROP FOREIGN KEY circulation_routings_ibfk_group',
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

ALTER TABLE circulation_routings DROP COLUMN IF EXISTS assigned_group_id;

-- 4. user_groups + members (members ต้อง drop ก่อนเพราะ FK)
DROP TABLE IF EXISTS user_group_members;
DROP TABLE IF EXISTS user_groups;

-- 5. user_organizations — drop ทั้งตาราง (users.primary_organization_id ไม่ได้แตะ)
DROP TABLE IF EXISTS user_organizations;

-- 6. departments
DROP TABLE IF EXISTS departments;
