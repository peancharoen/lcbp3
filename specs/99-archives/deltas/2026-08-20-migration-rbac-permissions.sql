-- File: specs/03-Data-and-Storage/deltas/2026-08-20-migration-rbac-permissions.sql
-- Change Log:
-- - 2026-08-20: Initial delta — เพิ่ม 5 migration RBAC permissions ที่ commit 56284be6 (Issue #3)
--   อ้างอิงใน @RequirePermission ของ migration.controller.ts แต่ไม่เคย seed ลง DB
--   ทำให้ Org Admin / Document Control และ role อื่นๆ (ที่ไม่ใช่ Superadmin) ถูก 403
--   เมื่อเข้าหน้า admin/migration → Legacy Review Queue ("Failed to load queue")
--
-- Description:
--   1. INSERT 5 permissions: migration.view, migration.commit, migration.enqueue,
--      migration.import, migration.error_log (ID 216-220)
--   2. GRANT ให้ Org Admin (role 2) และ Document Control (role 3) ตามหลักการเดียวกับ
--      ai.migration_manage (permission_id 183) ที่ grant อยู่แล้ว
--   3. Superadmin (role 1) ได้ทุก permission อัตโนมัติผ่าน SELECT-all pattern ใน
--      lcbp3-v1.9.0-seed-permissions.sql (บรรทัด 825-829) เพราะ is_active = 1
--
-- อ้างอิง: ADR-009 (schema delta ไม่ใช้ TypeORM migration), ADR-016 (RBAC matrix),
--          ADR-019 (UUID — ไม่เกี่ยวข้องโดยตรงแต่อยู่ใน migration module),
--          Issue #3 commit 56284be6 (เพิ่ม @RequirePermission แต่ไม่ seed)
--
-- Idempotent: ใช้ INSERT IGNORE และ SELECT-then-INSERT pattern เพื่อรันซ้ำได้
--
-- Rollback: DELETE FROM role_permissions WHERE permission_id IN (216,217,218,219,220);
--           DELETE FROM permissions WHERE permission_id IN (216,217,218,219,220);
-- ------------------------------------------------------------

-- ==========================================================
-- 1. INSERT 5 migration permissions (ID 216-220)
-- ==========================================================
-- ตรวจสอบก่อนว่า ID 216-220 ว่าง (ป้องกัน collision กับ delta อื่น)
-- ใช้ INSERT ... ON DUPLICATE KEY UPDATE เพื่อ idempotency บน permission_id และ permission_name (unique)

INSERT INTO permissions (
    permission_id,
    permission_name,
    description,
    module,
    is_active
  )
VALUES (
    216,
    'migration.view',
    'ดู Migration Review Queue และรายการ errors',
    'migration',
    1
  ),
  (
    217,
    'migration.commit',
    'อนุมัติ/Commit/Reject รายการใน Migration Review Queue',
    'migration',
    1
  ),
  (
    218,
    'migration.enqueue',
    'Enqueue รายการเข้า Migration Review Queue (n8n integration)',
    'migration',
    1
  ),
  (
    219,
    'migration.import',
    'Import legacy correspondence record ผ่าน n8n integration',
    'migration',
    1
  ),
  (
    220,
    'migration.error_log',
    'Log migration errors จาก n8n workflow',
    'migration',
    1
  )
ON DUPLICATE KEY UPDATE
  description = VALUES(description),
  module = VALUES(module),
  is_active = VALUES(is_active);

-- ==========================================================
-- 2. GRANT ให้ Org Admin (role 2) และ Document Control (role 3)
-- ==========================================================
-- หลักการ: เดียวกับ ai.migration_manage (permission_id 183) ที่ grant ให้ role 2 และ 3
-- ใน lcbp3-v1.9.0-seed-permissions.sql บรรทัด 1176-1198
--
-- migration.view (216) — ทั้งสอง role (ดู queue และ errors)
-- migration.commit (217) — ทั้งสอง role (อนุมัติ/commit/reject)
-- migration.enqueue (218) — ทั้งสอง role (enqueue ผ่าน n8n)
-- migration.import (219) — ทั้งสอง role (import legacy record)
-- migration.error_log (220) — ทั้งสอง role (log errors จาก n8n)

INSERT IGNORE INTO role_permissions (role_id, permission_id)
VALUES
  -- Org Admin (role 2)
  (2, 216), (2, 217), (2, 218), (2, 219), (2, 220),
  -- Document Control (role 3)
  (3, 216), (3, 217), (3, 218), (3, 219), (3, 220);

-- ==========================================================
-- 3. GRANT ให้ Superadmin (role 1) — ป้องกัน edge case
-- ==========================================================
-- Superadmin ปกติได้ทุก permission ผ่าน SELECT-all pattern ใน seed-permissions.sql
-- แต่เพื่อ idempotency บน environment ที่รัน delta นี้อย่างเดียว (ไม่ re-run seed)
-- จึง grant ให้ role 1 ด้วย
INSERT IGNORE INTO role_permissions (role_id, permission_id)
VALUES
  (1, 216), (1, 217), (1, 218), (1, 219), (1, 220);

-- ==========================================================
-- Verification query
-- ==========================================================
-- SELECT p.permission_id, p.permission_name, p.module, p.is_active,
--        GROUP_CONCAT(r.role_name ORDER BY r.role_id) AS granted_roles
-- FROM permissions p
-- LEFT JOIN role_permissions rp ON rp.permission_id = p.permission_id
-- LEFT JOIN roles r ON r.role_id = rp.role_id
-- WHERE p.permission_name LIKE 'migration.%'
-- GROUP BY p.permission_id
-- ORDER BY p.permission_id;
-- Expected:
--   216 | migration.view       | migration | 1 | Superadmin,Org Admin,Document Control
--   217 | migration.commit     | migration | 1 | Superadmin,Org Admin,Document Control
--   218 | migration.enqueue    | migration | 1 | Superadmin,Org Admin,Document Control
--   219 | migration.import     | migration | 1 | Superadmin,Org Admin,Document Control
--   220 | migration.error_log  | migration | 1 | Superadmin,Org Admin,Document Control
