-- Add permission for Bulk RBAC Update
-- Fix: Use existing 'user.manage_assignments' instead of creating new invalid permission
-- This permission (ID 25) is for assigning roles/projects
-- Grant to ADMIN (ID 2) and DC (ID 3) roles if not already present
-- Use INSERT IGNORE to avoid duplicates
INSERT IGNORE INTO `role_permissions` (`role_id`, `permission_id`)
SELECT r.role_id,
  p.permission_id
FROM `roles` r,
  `permissions` p
WHERE r.role_name IN ('ADMIN', 'Org Admin', 'DC', 'Document Control')
  AND p.permission_name = 'user.manage_assignments';