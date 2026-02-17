-- Fix Project Permissions
-- File: specs/07-database/fix-project-permissions.sql
-- 1. Ensure project.view permission exists
INSERT IGNORE INTO permissions (
    permission_id,
    permission_name,
    description,
    module,
    is_active
  )
VALUES (
    202,
    'project.view',
    'ดูรายการโครงการ',
    'project',
    1
  );
-- 2. Grant project.view to Superadmin (Role 1)
INSERT IGNORE INTO role_permissions (role_id, permission_id)
VALUES (1, 202);
-- 3. Grant project.view to Organization Admin (Role 2)
INSERT IGNORE INTO role_permissions (role_id, permission_id)
VALUES (2, 202);
-- 4. Grant project.view to Project Manager (Role 6)
INSERT IGNORE INTO role_permissions (role_id, permission_id)
VALUES (6, 202);
-- 5. Grant project.view to Viewer (Role 5)
INSERT IGNORE INTO role_permissions (role_id, permission_id)
VALUES (5, 202);