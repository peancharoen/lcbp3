-- Rollback: 2026-09-09-maintenance-console-permissions.sql
-- Date: 2026-09-09

DELETE FROM role_permissions WHERE role_id = 1 AND permission_id IN (234, 235, 236, 237);
DELETE FROM permissions WHERE permission_id IN (234, 235, 236, 237);
