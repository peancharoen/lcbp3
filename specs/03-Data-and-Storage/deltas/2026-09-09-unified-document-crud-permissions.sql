-- Delta: Apply missing Unified Document CRUD permissions (Feature 253, ids 222-233)
-- Date: 2026-09-09
-- Related Spec: lcbp3-v1.9.0-seed-permissions.sql lines 1331-1498 (already designed,
--   never applied to the live DB) — discovered while auditing all controllers for
--   missing @UseGuards after finding MaintenanceController had none. document.
--   controller.ts's bulk-cancel/tag/export routes reference document.bulk_cancel/
--   document.bulk_tag/document.bulk_export, and the per-document-type cancel/
--   edit_metadata/circulation.edit_routing routes elsewhere in the app reference
--   correspondence.cancel/rfa.cancel/transmittal.cancel/drawing.cancel/*.edit_metadata
--   — NONE of these 12 permissions existed in the live `permissions` table.
--   Superadmin was unaffected (system.manage_all bypasses all RBAC checks — see
--   rbac.guard.ts:50), but every other role (Org Admin, Document Control) has been
--   unable to cancel/edit-metadata/bulk-operate on documents in production since
--   Feature 253 shipped, silently 403ing on a permission that was never seeded.

-- ------------------------------------------------------------
-- Permissions (verbatim from canonical seed-permissions.sql)
-- ------------------------------------------------------------

INSERT INTO permissions (permission_id, permission_name, description, module, is_active)
VALUES
  (222, 'correspondence.cancel', 'ยกเลิกเอกสาร Correspondence (soft-cancel)', 'correspondence', 1),
  (223, 'rfa.cancel', 'ยกเลิกเอกสาร RFA (soft-cancel)', 'rfa', 1),
  (224, 'transmittal.cancel', 'ยกเลิกเอกสาร Transmittal (soft-cancel)', 'transmittal', 1),
  (225, 'drawing.cancel', 'ยกเลิก/Soft-delete Drawing (deletedAt)', 'drawing', 1),
  (226, 'correspondence.edit_metadata', 'แก้ไขข้อมูลกำกับ Correspondence', 'correspondence', 1),
  (227, 'rfa.edit_metadata', 'แก้ไขข้อมูลกำกับ RFA', 'rfa', 1),
  (228, 'transmittal.edit_metadata', 'แก้ไขข้อมูลกำกับ Transmittal', 'transmittal', 1),
  (229, 'drawing.edit_metadata', 'แก้ไขข้อมูลกำกับ Drawing', 'drawing', 1),
  (230, 'circulation.edit_routing', 'แก้ไขเส้นทาง Circulation', 'circulation', 1),
  (231, 'document.bulk_cancel', 'ยกเลิกเอกสารเป็นชุด (max 100 รายการ)', 'document', 1),
  (232, 'document.bulk_tag', 'เพิ่ม/ลบแท็กเอกสารเป็นชุด', 'document', 1),
  (233, 'document.bulk_export', 'ส่งออก metadata เอกสารเป็นชุด (CSV/XLSX/JSON)', 'document', 1)
ON DUPLICATE KEY UPDATE
  description = VALUES(description),
  module = VALUES(module),
  is_active = VALUES(is_active);

-- ------------------------------------------------------------
-- Role grants (verbatim from canonical seed-permissions.sql — Feature 253
-- Unified Document CRUD role assignments)
-- ------------------------------------------------------------

-- Document Control (role 3): Cancel + Metadata Patch + Bulk Operations
INSERT IGNORE INTO role_permissions (role_id, permission_id)
VALUES
  (3, 222), (3, 223), (3, 224), (3, 225),
  (3, 226), (3, 227), (3, 228), (3, 229),
  (3, 230), (3, 231), (3, 232), (3, 233);

-- Org Admin (role 2): Cancel + Metadata Patch (no bulk ops — DC-only tooling)
INSERT IGNORE INTO role_permissions (role_id, permission_id)
VALUES
  (2, 222), (2, 223), (2, 224), (2, 225),
  (2, 226), (2, 227), (2, 228), (2, 229), (2, 230);

-- ------------------------------------------------------------
-- Verification query (optional)
-- ------------------------------------------------------------

-- SELECT p.permission_id, p.permission_name,
--   GROUP_CONCAT(r.role_name ORDER BY r.role_id) AS granted_roles
-- FROM permissions p
-- LEFT JOIN role_permissions rp ON rp.permission_id = p.permission_id
-- LEFT JOIN roles r ON r.role_id = rp.role_id
-- WHERE p.permission_id BETWEEN 222 AND 233
-- GROUP BY p.permission_id;
