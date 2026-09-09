-- Rollback: 2026-09-09-unified-document-crud-permissions.sql
-- Date: 2026-09-09

DELETE FROM role_permissions WHERE role_id IN (2, 3) AND permission_id BETWEEN 222 AND 233;
DELETE FROM permissions WHERE permission_id BETWEEN 222 AND 233;
