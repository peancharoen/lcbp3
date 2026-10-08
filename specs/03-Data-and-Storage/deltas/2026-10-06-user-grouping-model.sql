-- File: specs/03-Data-and-Storage/deltas/2026-10-06-user-grouping-model.sql
-- Change Log:
-- - 2026-10-06: User Grouping Model — departments + user_organizations (multi-org membership,
--   position ต่อ org), user_groups + user_group_members, circulation_routings.assigned_group_id
--   (claim-based), reminder_rule_recipients (structured แทน notify_roles CSV),
--   distribution_recipients enum + GROUP/DEPARTMENT
-- - 2026-10-07: เพิ่ม §5.1 reconcile reminder_rules — production DB เป็นโครง schema เก่า
--   (document_type_id/trigger_days_before_due/escalation_days_after_due/recipients/message_template_th|en)
--   rename recipients→notify_roles ก่อน backfill, drop โครงเก่า, add spec columns (idempotent)
-- - 2026-10-07: เพิ่ม primary_org_guard generated column + UNIQUE — บังคับ is_primary=1
--   แถวเดียวต่อ user ที่ระดับ DB (MariaDB ไม่มี partial unique index)
-- - 2026-10-07: chk_channel_single_scope เปลี่ยน ≤1 → =1 (exactly-one-scope)
--   — ไม่มี delivery path สำหรับ global channel (dead binding); ตรง API + precedent chk_scope
--
-- NOTE: users.primary_organization_id คงไว้เป็น denormalized pointer → sync ที่ app layer
-- (UserService.syncPrimaryMembership) ไม่ drop column นี้

-- =============================================================================
-- 1. departments — แผนกภายในองค์กร (org-scoped, flat)
-- =============================================================================
CREATE TABLE IF NOT EXISTS departments (
  id INT PRIMARY KEY AUTO_INCREMENT COMMENT 'ID ของตาราง',
  uuid UUID NOT NULL DEFAULT UUID() COMMENT 'UUIDv7 (NestJS @BeforeInsert) สำหรับ runtime; UUIDv1 (DEFAULT UUID() fallback) สำหรับ seed/migration (ADR-019)',
  organization_id INT NOT NULL COMMENT 'องค์กรเจ้าของแผนก',
  department_code VARCHAR(20) NOT NULL COMMENT 'รหัสแผนก (unique ภายใน org)',
  department_name VARCHAR(255) NOT NULL COMMENT 'ชื่อแผนก',
  is_active TINYINT(1) DEFAULT 1 COMMENT 'สถานะการใช้งาน',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'วันที่สร้าง',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'วันที่แก้ไขล่าสุด',
  deleted_at DATETIME NULL COMMENT 'วันที่ลบ (Soft Delete)',
  FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE,
  UNIQUE KEY uk_department_code (organization_id, department_code),
  UNIQUE INDEX idx_departments_uuid (uuid)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci COMMENT = 'ตาราง Master เก็บแผนกภายในองค์กร';

-- =============================================================================
-- 2. user_organizations — user ↔ org membership (multi-org + department + position)
-- =============================================================================
CREATE TABLE IF NOT EXISTS user_organizations (
  id INT PRIMARY KEY AUTO_INCREMENT COMMENT 'ID ของตาราง',
  uuid UUID NOT NULL DEFAULT UUID() COMMENT 'UUIDv7 (NestJS @BeforeInsert) สำหรับ runtime; UUIDv1 (DEFAULT UUID() fallback) สำหรับ seed/migration (ADR-019)',
  user_id INT NOT NULL,
  organization_id INT NOT NULL,
  department_id INT NULL COMMENT 'แผนกใน org นี้ (FK → departments)',
  position VARCHAR(100) NULL COMMENT 'ตำแหน่งใน org นี้ (free-text — แต่ละบริษัทต่างกัน ไม่ทำ master)',
  is_primary TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'สังกัดหลัก — มีได้ 1 แถวต่อ user (sync กับ users.primary_organization_id)',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'วันที่สร้าง',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'วันที่แก้ไขล่าสุด',
  UNIQUE KEY uk_user_org (user_id, organization_id),
  FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE,
  FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE,
  FOREIGN KEY (department_id) REFERENCES departments (id) ON DELETE SET NULL,
  UNIQUE INDEX idx_user_organizations_uuid (uuid)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci COMMENT = 'ตารางเชื่อม user กับ org ทุกแห่งที่สังกัด (พร้อมแผนก+ตำแหน่งต่อ org)';

-- Backfill: users.primary_organization_id → user_organizations (is_primary=1)
INSERT INTO user_organizations (user_id, organization_id, is_primary)
SELECT u.user_id, u.primary_organization_id, 1
FROM users u
WHERE u.primary_organization_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM user_organizations uo
    WHERE uo.user_id = u.user_id AND uo.organization_id = u.primary_organization_id
  );

-- DB-level guard: is_primary=1 ได้แค่ 1 แถวต่อ user
-- MariaDB ไม่มี partial unique index → generated column คืน user_id เมื่อ is_primary=1
-- (NULL ใน unique key ชนกันไม่ได้ → is_primary=0 กี่แถวก็ได้)
-- ⚠️ ถ้ามีข้อมูล duplicate primary อยู่ก่อนแล้ว ALTER นี้จะ fail — ตรวจก่อน:
--   SELECT user_id, COUNT(*) FROM user_organizations WHERE is_primary=1 GROUP BY user_id HAVING COUNT(*)>1;
ALTER TABLE user_organizations
  ADD COLUMN IF NOT EXISTS primary_org_guard INT GENERATED ALWAYS AS (IF(is_primary = 1, user_id, NULL)) PERSISTENT
    COMMENT 'guard บังคับ is_primary=1 แถวเดียวต่อ user (ห้าม map ใน entity)',
  ADD UNIQUE KEY IF NOT EXISTS uk_user_primary_org (primary_org_guard);

-- =============================================================================
-- 3. user_groups + user_group_members — functional group ภายใน org
--    ใช้เป็น pool สำหรับ claim-based assignment (circulation), distribution, reminder
-- =============================================================================
CREATE TABLE IF NOT EXISTS user_groups (
  id INT PRIMARY KEY AUTO_INCREMENT COMMENT 'ID ของตาราง',
  uuid UUID NOT NULL DEFAULT UUID() COMMENT 'UUIDv7 (NestJS @BeforeInsert) สำหรับ runtime; UUIDv1 (DEFAULT UUID() fallback) สำหรับ seed/migration (ADR-019)',
  organization_id INT NOT NULL COMMENT 'องค์กรเจ้าของกลุ่ม',
  name VARCHAR(100) NOT NULL COMMENT 'ชื่อกลุ่ม (unique ภายใน org)',
  description VARCHAR(255) NULL COMMENT 'คำอธิบาย',
  is_active TINYINT(1) DEFAULT 1 COMMENT 'สถานะการใช้งาน',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'วันที่สร้าง',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'วันที่แก้ไขล่าสุด',
  deleted_at DATETIME NULL COMMENT 'วันที่ลบ (Soft Delete)',
  FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE,
  UNIQUE KEY uk_user_group_name (organization_id, name),
  UNIQUE INDEX idx_user_groups_uuid (uuid)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci COMMENT = 'ตาราง functional group ของ user ภายใน org';

CREATE TABLE IF NOT EXISTS user_group_members (
  group_id INT NOT NULL,
  user_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'วันที่เพิ่มสมาชิก',
  PRIMARY KEY (group_id, user_id),
  FOREIGN KEY (group_id) REFERENCES user_groups (id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci COMMENT = 'ตารางเชื่อมสมาชิกของ user_groups';

-- =============================================================================
-- 4. circulation_routings.assigned_group_id — claim-based assignment
--    routing ที่มอบให้ group: member คนแรกที่รับงานจะ set assigned_to ของจริง
-- =============================================================================
ALTER TABLE circulation_routings
  ADD COLUMN IF NOT EXISTS assigned_group_id INT NULL
    COMMENT 'กลุ่มที่ได้รับมอบหมาย (FK → user_groups) — claim-based: member คนแรกที่รับงานจะ set assigned_to'
    AFTER assigned_to;

-- เพิ่ม FK เฉพาะเมื่อยังไม่มี (MariaDB ไม่รองรับ ADD CONSTRAINT IF NOT EXISTS)
SET @fk_exists := (
  SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE()
    AND TABLE_NAME = 'circulation_routings'
    AND CONSTRAINT_NAME = 'circulation_routings_ibfk_group'
);
SET @sql := IF(@fk_exists = 0,
  'ALTER TABLE circulation_routings ADD CONSTRAINT circulation_routings_ibfk_group FOREIGN KEY (assigned_group_id) REFERENCES user_groups (id) ON DELETE SET NULL',
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- =============================================================================
-- 5. reminder_rule_recipients — structured recipients แทน notify_roles CSV
--    symbolic (ref=NULL): TASK_ASSIGNEE/TEAM_LEAD/PROJECT_MANAGER
--    concrete (ref=publicId): USER/ROLE/TEAM/GROUP/DEPARTMENT
-- =============================================================================

-- 5.1 Reconcile reminder_rules ให้ตรง spec (schema-02-tables.sql §20.7)
--     production DB สร้างจาก schema เก่า: document_type_id / trigger_days_before_due /
--     escalation_days_after_due / recipients(CSV) / message_template_th|en
--     แทน spec columns — fresh install จะ no-op ทั้งหมดเพราะ IF [NOT] EXISTS
--     ⚠️ ตารางนี้ 0 rows ใน production ณ วันที่ delta นี้เขียน (feature ยังไม่ถูกใช้จริง)

-- legacy `recipients` CSV → rename เป็น notify_roles เพื่อให้ backfill ด้านล่างใช้ source เดียว
-- (vocabulary เดียวกัน: ASSIGNEE→TASK_ASSIGNEE, MANAGER→TEAM_LEAD, PROJECT_MANAGER)
SET @rcpt_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'reminder_rules'
    AND COLUMN_NAME = 'recipients'
);
SET @nr_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'reminder_rules'
    AND COLUMN_NAME = 'notify_roles'
);
SET @sql := IF(@rcpt_exists > 0 AND @nr_exists = 0,
  'ALTER TABLE reminder_rules CHANGE COLUMN recipients notify_roles TEXT NULL COMMENT ''CSV legacy — superseded by reminder_rule_recipients''',
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- edge case: มีทั้ง recipients และ notify_roles → ทิ้ง recipients (notify_roles คือ source ของ backfill)
SET @sql := IF(@rcpt_exists > 0 AND @nr_exists > 0,
  'ALTER TABLE reminder_rules DROP COLUMN recipients',
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- drop columns โครงเก่า + add spec columns ที่ขาด (idempotent)
ALTER TABLE reminder_rules
  DROP COLUMN IF EXISTS document_type_id,
  DROP COLUMN IF EXISTS trigger_days_before_due,
  DROP COLUMN IF EXISTS escalation_days_after_due,
  DROP COLUMN IF EXISTS message_template_th,
  DROP COLUMN IF EXISTS message_template_en,
  ADD COLUMN IF NOT EXISTS document_type_code VARCHAR(20) NULL COMMENT 'รหัสประเภทเอกสาร เช่น SDW, DDW — NULL = all types' AFTER project_id,
  ADD COLUMN IF NOT EXISTS days_before_due INT NOT NULL COMMENT 'บวก = ก่อน due, ลบ = หลัง due (overdue)',
  ADD COLUMN IF NOT EXISTS escalation_level TINYINT NOT NULL DEFAULT 0 COMMENT '0 = reminder, 1 = escalation L1, 2 = escalation L2',
  ADD COLUMN IF NOT EXISTS message_template TEXT NULL;

CREATE TABLE IF NOT EXISTS `reminder_rule_recipients` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `uuid` UUID NOT NULL DEFAULT (UUID()) COMMENT 'UUIDv7 (NestJS @BeforeInsert) สำหรับ runtime; UUIDv1 (DEFAULT (UUID()) fallback) สำหรับ seed/migration (ADR-019)',
  `rule_id` INT NOT NULL,
  `recipient_type` ENUM(
    'TASK_ASSIGNEE',
    'TEAM_LEAD',
    'PROJECT_MANAGER',
    'USER',
    'ROLE',
    'TEAM',
    'GROUP',
    'DEPARTMENT'
  ) NOT NULL,
  `recipient_ref` UUID NULL COMMENT 'publicId ของ target — NULL สำหรับ symbolic types',
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_reminder_rule_recipients_uuid` (`uuid`),
  KEY `idx_rrr_rule` (`rule_id`),
  CONSTRAINT `fk_rrr_rule` FOREIGN KEY (`rule_id`) REFERENCES `reminder_rules` (`id`) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = 'Structured recipients — polymorphic ref, no FK on recipient_ref (by design, ADR-019)';

-- Backfill notify_roles CSV → symbolic recipient rows
-- map: ASSIGNEE/TASK_ASSIGNEE → TASK_ASSIGNEE | MANAGER/TEAM_LEAD → TEAM_LEAD | PROJECT_MANAGER → PROJECT_MANAGER
-- (FIND_IN_SET match เฉพาะ element เต็มใน CSV — 'MANAGER' ไม่ชน 'PROJECT_MANAGER')
INSERT INTO reminder_rule_recipients (rule_id, recipient_type)
SELECT r.id, 'TASK_ASSIGNEE'
FROM reminder_rules r
WHERE r.notify_roles IS NOT NULL
  AND (FIND_IN_SET('TASK_ASSIGNEE', r.notify_roles) OR FIND_IN_SET('ASSIGNEE', r.notify_roles))
  AND NOT EXISTS (
    SELECT 1 FROM reminder_rule_recipients x
    WHERE x.rule_id = r.id AND x.recipient_type = 'TASK_ASSIGNEE'
  );

INSERT INTO reminder_rule_recipients (rule_id, recipient_type)
SELECT r.id, 'TEAM_LEAD'
FROM reminder_rules r
WHERE r.notify_roles IS NOT NULL
  AND (FIND_IN_SET('TEAM_LEAD', r.notify_roles) OR FIND_IN_SET('MANAGER', r.notify_roles))
  AND NOT EXISTS (
    SELECT 1 FROM reminder_rule_recipients x
    WHERE x.rule_id = r.id AND x.recipient_type = 'TEAM_LEAD'
  );

INSERT INTO reminder_rule_recipients (rule_id, recipient_type)
SELECT r.id, 'PROJECT_MANAGER'
FROM reminder_rules r
WHERE r.notify_roles IS NOT NULL
  AND FIND_IN_SET('PROJECT_MANAGER', r.notify_roles)
  AND NOT EXISTS (
    SELECT 1 FROM reminder_rule_recipients x
    WHERE x.rule_id = r.id AND x.recipient_type = 'PROJECT_MANAGER'
  );

-- ⚠️ ตรวจ orphan ก่อน drop: values ใน notify_roles ที่ไม่ map ได้จะหาย
--   SELECT id, name, notify_roles FROM reminder_rules
--   WHERE notify_roles IS NOT NULL AND notify_roles != ''
--     AND NOT EXISTS (SELECT 1 FROM reminder_rule_recipients x WHERE x.rule_id = reminder_rules.id);
ALTER TABLE reminder_rules DROP COLUMN IF EXISTS notify_roles;

-- =============================================================================
-- 6. notification_channels — scope user_group/department (Telegram group ผูกกับกลุ่ม/แผนก)
--    ต้องผูกกับ 1 scope เสมอ: project_id / user_group_id / department_id (เดียวพอดี)
--    — ไม่อนุญาต global: ไม่มี delivery path ที่อ่าน channel ไม่มี scope (dead binding)
--    — ตาม precedent chk_scope ของ user_assignments (exactly-one-scope)
-- =============================================================================
ALTER TABLE notification_channels
  ADD COLUMN IF NOT EXISTS user_group_id INT NULL
    COMMENT 'user group เจ้าของ (User Grouping Model) — ตั้งได้ 1 ใน project/user_group/department'
    AFTER project_id,
  ADD COLUMN IF NOT EXISTS department_id INT NULL
    COMMENT 'department เจ้าของ (User Grouping Model)'
    AFTER user_group_id;

-- FK + index + CHECK เพิ่มเฉพาะเมื่อยังไม่มี (MariaDB ไม่รองรับ ADD CONSTRAINT IF NOT EXISTS)
SET @fk_exists := (
  SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE()
    AND TABLE_NAME = 'notification_channels'
    AND CONSTRAINT_NAME = 'fk_channels_user_group'
);
SET @sql := IF(@fk_exists = 0,
  'ALTER TABLE notification_channels ADD CONSTRAINT fk_channels_user_group FOREIGN KEY (user_group_id) REFERENCES user_groups (id) ON DELETE CASCADE',
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
SET @sql := IF(@fk_exists = 0,
  'ALTER TABLE notification_channels ADD CONSTRAINT fk_channels_department FOREIGN KEY (department_id) REFERENCES departments (id) ON DELETE CASCADE',
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

ALTER TABLE notification_channels
  ADD INDEX IF NOT EXISTS idx_channels_user_group_active (user_group_id, is_active),
  ADD INDEX IF NOT EXISTS idx_channels_department_active (department_id, is_active);

SET @chk_exists := (
  SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE()
    AND TABLE_NAME = 'notification_channels'
    AND CONSTRAINT_NAME = 'chk_channel_single_scope'
);
SET @sql := IF(@chk_exists = 0,
  'ALTER TABLE notification_channels ADD CONSTRAINT chk_channel_single_scope CHECK ((project_id IS NOT NULL) + (user_group_id IS NOT NULL) + (department_id IS NOT NULL) = 1)',
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- =============================================================================
-- 7. distribution_recipients — เพิ่ม GROUP/DEPARTMENT ใน enum (consume user_groups/departments)
-- =============================================================================
ALTER TABLE `distribution_recipients`
  MODIFY COLUMN `recipient_type` ENUM('USER', 'ORGANIZATION', 'TEAM', 'ROLE', 'GROUP', 'DEPARTMENT') NOT NULL,
  MODIFY COLUMN `recipient_public_id` UUID NOT NULL COMMENT 'publicId ของ target entity (UUIDv7 หรือ UUIDv1 ตามที่มาของ record): USER=users.uuid | ORGANIZATION=organizations.uuid | TEAM=review_teams.uuid | ROLE=roles.uuid | GROUP=user_groups.uuid | DEPARTMENT=departments.uuid';
