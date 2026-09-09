-- Delta: Apply missing Maintenance Console permissions (Feature 253)
-- Date: 2026-09-09
-- Related Spec: lcbp3-v1.9.0-seed-permissions.sql lines 1422-1505 (already designed,
--   never applied to the live DB) — discovered while fixing MaintenanceController
--   having no @UseGuards at all (security fix, 2026-09-09). Adding the guard without
--   this delta would lock EVERYONE (including Superadmin) out of the Maintenance
--   Console, since these 4 permission rows never existed to be granted to anyone.

-- ------------------------------------------------------------
-- Permissions (verbatim from canonical seed-permissions.sql)
-- ------------------------------------------------------------

INSERT INTO permissions (permission_id, permission_name, description, module, is_active)
VALUES
  (234, 'system.numbering_override', 'แก้ไขเลขที่เอกสาร (Maintenance Console)', 'system', 1),
  (235, 'system.orphan_cleanup', 'ล้างไฟล์ขยะใน Storage (Maintenance Console)', 'system', 1),
  (236, 'system.vector_sync', 'ซิงค์เวกเตอร์ค้นหา Qdrant (Maintenance Console)', 'system', 1),
  (237, 'system.emergency_unlock', 'ปลดล็อกเอกสารฉุกเฉิน (Maintenance Console)', 'system', 1)
ON DUPLICATE KEY UPDATE
  description = VALUES(description),
  module = VALUES(module),
  is_active = VALUES(is_active);

-- Superadmin (role 1) — system.manage_all already covers it, listed explicitly
-- per the canonical seed file's own comment
INSERT IGNORE INTO role_permissions (role_id, permission_id)
VALUES (1, 234), (1, 235), (1, 236), (1, 237);

-- ------------------------------------------------------------
-- Verification query (optional)
-- ------------------------------------------------------------

-- SELECT p.permission_id, p.permission_name,
--   GROUP_CONCAT(r.role_name ORDER BY r.role_id) AS granted_roles
-- FROM permissions p
-- LEFT JOIN role_permissions rp ON rp.permission_id = p.permission_id
-- LEFT JOIN roles r ON r.role_id = rp.role_id
-- WHERE p.permission_id IN (234, 235, 236, 237)
-- GROUP BY p.permission_id;
