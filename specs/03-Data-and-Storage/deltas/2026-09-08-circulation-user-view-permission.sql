-- Delta: Grant user.view to Document Control + Editor roles (circulation Assignees picker)
-- Date: 2026-09-08
-- Related Spec: Bug report — /circulation/new "Assignees" combobox renders empty
-- Applied in: v1.9.18 → v1.9.19

-- ------------------------------------------------------------
-- Root cause
-- ------------------------------------------------------------
-- circulation.create (permission 101) is granted to Role 3 (Document Control) and
-- Role 4 (Editor), but user.view (permission 22) — required by GET /users, which the
-- circulation "Assignees" picker calls — is only granted to Role 2 (Org Admin). No
-- non-superadmin role that can create a circulation can list users to assign it to,
-- so GET /users returns 403 and the frontend combobox silently renders empty (no
-- onError handler on the query).

-- ------------------------------------------------------------
-- Schema changes
-- ------------------------------------------------------------

-- Role 3: Document Control — user.view
INSERT IGNORE INTO role_permissions (role_id, permission_id)
VALUES (3, 22);

-- Role 4: Editor — user.view
INSERT IGNORE INTO role_permissions (role_id, permission_id)
VALUES (4, 22);

-- ------------------------------------------------------------
-- Verification query (optional)
-- ------------------------------------------------------------

-- SELECT p.permission_id, p.permission_name,
--   GROUP_CONCAT(r.role_name ORDER BY r.role_id) AS granted_roles
-- FROM permissions p
-- LEFT JOIN role_permissions rp ON rp.permission_id = p.permission_id
-- LEFT JOIN roles r ON r.role_id = rp.role_id
-- WHERE p.permission_id = 22
-- GROUP BY p.permission_id;
