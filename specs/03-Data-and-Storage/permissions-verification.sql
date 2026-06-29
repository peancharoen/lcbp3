-- ==========================================================
-- Permission System Verification Queries (v1.8.0)
-- File: specs/03-Data-and-Storage/permissions-verification.sql
-- Purpose: Verify permissions setup after seed data deployment
-- ==========================================================
-- ==========================================================
-- 1. COUNT PERMISSIONS PER CATEGORY
-- ==========================================================
SELECT CASE
    WHEN permission_id BETWEEN 1 AND 10 THEN '001-010: System & Global'
    WHEN permission_id BETWEEN 11 AND 20 THEN '011-020: Organization Management'
    WHEN permission_id BETWEEN 21 AND 40 THEN '021-040: User & Role Management'
    WHEN permission_id BETWEEN 41 AND 50 THEN '041-050: Master Data Management'
    WHEN permission_id BETWEEN 51 AND 70 THEN '051-070: Document Management (Generic)'
    WHEN permission_id BETWEEN 71 AND 80 THEN '071-080: Correspondence Module'
    WHEN permission_id BETWEEN 81 AND 90 THEN '081-090: RFA Module'
    WHEN permission_id BETWEEN 91 AND 100 THEN '091-100: Drawing Module'
    WHEN permission_id BETWEEN 101 AND 110 THEN '101-110: Circulation Module'
    WHEN permission_id BETWEEN 111 AND 120 THEN '111-120: Transmittal Module'
    WHEN permission_id BETWEEN 121 AND 130 THEN '121-130: Workflow Engine'
    WHEN permission_id BETWEEN 131 AND 140 THEN '131-140: Document Numbering'
    WHEN permission_id BETWEEN 141 AND 150 THEN '141-150: Search & Reporting'
    WHEN permission_id BETWEEN 151 AND 160 THEN '151-160: Notification & Dashboard'
    WHEN permission_id BETWEEN 161 AND 170 THEN '161-170: JSON Schema Management'
    WHEN permission_id BETWEEN 171 AND 180 THEN '171-180: Monitoring & Admin Tools'
    WHEN permission_id BETWEEN 201 AND 220 THEN '201-220: Project & Contract Management'
    ELSE 'Unknown Range'
  END AS category_range,
  COUNT(*) AS permission_count
FROM permissions
GROUP BY CASE
    WHEN permission_id BETWEEN 1 AND 10 THEN '001-010: System & Global'
    WHEN permission_id BETWEEN 11 AND 20 THEN '011-020: Organization Management'
    WHEN permission_id BETWEEN 21 AND 40 THEN '021-040: User & Role Management'
    WHEN permission_id BETWEEN 41 AND 50 THEN '041-050: Master Data Management'
    WHEN permission_id BETWEEN 51 AND 70 THEN '051-070: Document Management (Generic)'
    WHEN permission_id BETWEEN 71 AND 80 THEN '071-080: Correspondence Module'
    WHEN permission_id BETWEEN 81 AND 90 THEN '081-090: RFA Module'
    WHEN permission_id BETWEEN 91 AND 100 THEN '091-100: Drawing Module'
    WHEN permission_id BETWEEN 101 AND 110 THEN '101-110: Circulation Module'
    WHEN permission_id BETWEEN 111 AND 120 THEN '111-120: Transmittal Module'
    WHEN permission_id BETWEEN 121 AND 130 THEN '121-130: Workflow Engine'
    WHEN permission_id BETWEEN 131 AND 140 THEN '131-140: Document Numbering'
    WHEN permission_id BETWEEN 141 AND 150 THEN '141-150: Search & Reporting'
    WHEN permission_id BETWEEN 151 AND 160 THEN '151-160: Notification & Dashboard'
    WHEN permission_id BETWEEN 161 AND 170 THEN '161-170: JSON Schema Management'
    WHEN permission_id BETWEEN 171 AND 180 THEN '171-180: Monitoring & Admin Tools'
    WHEN permission_id BETWEEN 201 AND 220 THEN '201-220: Project & Contract Management'
    ELSE 'Unknown Range'
  END
ORDER BY MIN(permission_id);

-- ==========================================================
-- 2. COUNT PERMISSIONS PER ROLE
-- ==========================================================
SELECT r.role_id,
  r.role_name,
  r.scope,
  COUNT(rp.permission_id) AS permission_count
FROM roles r
  LEFT JOIN role_permissions rp ON r.role_id = rp.role_id
GROUP BY r.role_id,
  r.role_name,
  r.scope
ORDER BY r.role_id;

-- ==========================================================
-- 3. CHECK TOTAL PERMISSION COUNT
-- ==========================================================
SELECT 'Total Permissions' AS metric,
  COUNT(*) AS COUNT
FROM permissions
UNION ALL
SELECT 'Active Permissions',
  COUNT(*)
FROM permissions
WHERE is_active = 1;

-- ==========================================================
-- 4. CHECK FOR MISSING PERMISSIONS (Used in Code but Not in DB)
-- ==========================================================
-- List of permissions actually used in controllers
WITH code_permissions AS (
  SELECT 'system.manage_all' AS permission_name
  UNION
  SELECT 'system.impersonate'
  UNION
  SELECT 'organization.view'
  UNION
  SELECT 'organization.create'
  UNION
  SELECT 'user.create'
  UNION
  SELECT 'user.view'
  UNION
  SELECT 'user.edit'
  UNION
  SELECT 'user.delete'
  UNION
  SELECT 'user.manage_assignments'
  UNION
  SELECT 'role.assign_permissions'
  UNION
  SELECT 'project.create'
  UNION
  SELECT 'project.view'
  UNION
  SELECT 'project.edit'
  UNION
  SELECT 'project.delete'
  UNION
  SELECT 'contract.create'
  UNION
  SELECT 'contract.view'
  UNION
  SELECT 'contract.edit'
  UNION
  SELECT 'contract.delete'
  UNION
  SELECT 'master_data.view'
  UNION
  SELECT 'master_data.manage'
  UNION
  SELECT 'master_data.drawing_category.manage'
  UNION
  SELECT 'master_data.tag.manage'
  UNION
  SELECT 'document.view'
  UNION
  SELECT 'document.create'
  UNION
  SELECT 'document.edit'
  UNION
  SELECT 'document.delete'
  UNION
  SELECT 'correspondence.create'
  UNION
  SELECT 'rfa.create'
  UNION
  SELECT 'drawing.create'
  UNION
  SELECT 'drawing.view'
  UNION
  SELECT 'circulation.create'
  UNION
  SELECT 'circulation.respond'
  UNION
  SELECT 'workflow.action_review'
  UNION
  SELECT 'workflow.manage_definitions'
  UNION
  SELECT 'search.advanced'
  UNION
  SELECT 'json_schema.view'
  UNION
  SELECT 'json_schema.manage'
  UNION
  SELECT 'monitoring.manage_maintenance'
)
SELECT cp.permission_name,
  CASE
    WHEN p.permission_id IS NULL THEN '❌ MISSING'
    ELSE '✅ EXISTS'
  END AS STATUS,
  p.permission_id
FROM code_permissions cp
  LEFT JOIN permissions p ON cp.permission_name = p.permission_name
ORDER BY STATUS DESC,
  cp.permission_name;

-- ==========================================================
-- 5. LIST PERMISSIONS FOR EACH ROLE
-- ==========================================================
SELECT r.role_name,
  r.scope,
  GROUP_CONCAT(
    p.permission_name
    ORDER BY p.permission_id SEPARATOR ', '
  ) AS permissions
FROM roles r
  LEFT JOIN role_permissions rp ON r.role_id = rp.role_id
  LEFT JOIN permissions p ON rp.permission_id = p.permission_id
GROUP BY r.role_id,
  r.role_name,
  r.scope
ORDER BY r.role_id;

-- ==========================================================
-- 6. CHECK SUPERADMIN HAS ALL PERMISSIONS
-- ==========================================================
SELECT 'Superadmin Permission Coverage' AS metric,
  CONCAT(
    COUNT(DISTINCT rp.permission_id),
    ' / ',
    (
      SELECT COUNT(*)
      FROM permissions
      WHERE is_active = 1
    ),
    ' (',
    ROUND(
      COUNT(DISTINCT rp.permission_id) * 100.0 / (
        SELECT COUNT(*)
        FROM permissions
        WHERE is_active = 1
      ),
      1
    ),
    '%)'
  ) AS coverage
FROM role_permissions rp
WHERE rp.role_id = 1;

-- Superadmin
-- ==========================================================
-- 7. CHECK FOR DUPLICATE PERMISSIONS
-- ==========================================================
SELECT permission_name,
  COUNT(*) AS duplicate_count
FROM permissions
GROUP BY permission_name
HAVING COUNT(*) > 1;

-- ==========================================================
-- 8. CHECK PERMISSIONS WITHOUT ROLE ASSIGNMENTS
-- ==========================================================
SELECT p.permission_id,
  p.permission_name,
  p.description
FROM permissions p
  LEFT JOIN role_permissions rp ON p.permission_id = rp.permission_id
WHERE rp.permission_id IS NULL
  AND p.is_active = 1
ORDER BY p.permission_id;

-- ==========================================================
-- 9. CHECK USER PERMISSION VIEW (v_user_all_permissions)
-- ==========================================================
-- Test with user_id = 1 (Superadmin)
SELECT 'User 1 (Superadmin) Permissions' AS metric,
  COUNT(*) AS permission_count
FROM v_user_all_permissions
WHERE user_id = 1;

-- List first 10 permissions for user 1
SELECT user_id,
  permission_name
FROM v_user_all_permissions
WHERE user_id = 1
ORDER BY permission_name
LIMIT 10;

-- ==========================================================
-- 10. CHECK SPECIFIC CRITICAL PERMISSIONS
-- ==========================================================
SELECT permission_name,
  permission_id,
  CASE
    WHEN permission_id IS NOT NULL THEN '✅ Exists'
    ELSE '❌ Missing'
  END AS STATUS
FROM (
    SELECT 'system.manage_all' AS permission_name
    UNION
    SELECT 'document.view'
    UNION
    SELECT 'user.create'
    UNION
    SELECT 'master_data.manage'
    UNION
    SELECT 'drawing.view'
    UNION
    SELECT 'workflow.action_review'
    UNION
    SELECT 'project.view'
  ) required_perms
  LEFT JOIN permissions p USING (permission_name)
ORDER BY permission_name;
