-- Delta: Add correspondence.import_review permission (ADR-052)
-- Date: 2026-09-06
-- Related ADR: ADR-052 (Excel Data Review Pipeline)
-- Related Spec: specs/200-fullstacks/252-excel-data-review-pipeline/spec.md (FR-018)
-- Applied in: v1.9.0 → v1.9.1

-- ------------------------------------------------------------
-- Permission: correspondence.import_review (ID 221)
-- สิทธิ์สำหรับการอัปโหลด Excel/ZIP เข้า 4-Layer Review Pipeline
-- (POST /api/v1/correspondence/import-review/check)
-- - Superadmin (role 1): ได้ทุก permission อัตโนมัติผ่าน SELECT-all pattern
-- - Org Admin (role 2): ใช้ได้ทั้ง MIGRATION_STAGING และ DIRECT_IMPORT
-- - Document Control (role 3): ใช้ DIRECT_IMPORT + LOCAL_OLLAMA เท่านั้น
--   (MIGRATION_STAGING และ External AI ถูกจำกัดเพิ่มเติมใน controller — FR-018, D7, D2)
-- ------------------------------------------------------------

INSERT INTO permissions (
    permission_id,
    permission_name,
    description,
    module,
    is_active
  )
VALUES (
    221,
    'correspondence.import_review',
    'อัปโหลด Excel/ZIP เข้า 4-Layer Review Pipeline (ADR-052)',
    'correspondence',
    1
  ) ON DUPLICATE KEY
UPDATE description =
VALUES(description),
  module =
VALUES(module),
  is_active =
VALUES(is_active);

-- Role 2: Org Admin — correspondence.import_review
INSERT IGNORE INTO role_permissions (role_id, permission_id)
VALUES (2, 221);

-- Role 3: Document Control — correspondence.import_review
INSERT IGNORE INTO role_permissions (role_id, permission_id)
VALUES (3, 221);

-- ------------------------------------------------------------
-- Verification query
-- ------------------------------------------------------------

-- SELECT p.permission_id, p.permission_name, p.module,
--   GROUP_CONCAT(r.role_name ORDER BY r.role_id) AS granted_roles
-- FROM permissions p
-- LEFT JOIN role_permissions rp ON rp.permission_id = p.permission_id
-- LEFT JOIN roles r ON r.role_id = rp.role_id
-- WHERE p.permission_name = 'correspondence.import_review'
-- GROUP BY p.permission_id;
