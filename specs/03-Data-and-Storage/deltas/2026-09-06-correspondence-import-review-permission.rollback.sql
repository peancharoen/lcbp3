-- Rollback: Remove correspondence.import_review permission (ADR-052)
-- Date: 2026-09-06
-- Related ADR: ADR-052 (Excel Data Review Pipeline)
-- Reverses: 2026-09-06-correspondence-import-review-permission.sql

-- ------------------------------------------------------------
-- Remove role_permissions grants for permission 221
-- ------------------------------------------------------------

DELETE FROM role_permissions
WHERE permission_id = 221;

-- ------------------------------------------------------------
-- Remove permission 221
-- ------------------------------------------------------------

DELETE FROM permissions
WHERE permission_id = 221
  AND permission_name = 'correspondence.import_review';
