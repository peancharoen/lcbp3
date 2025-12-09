-- Patch: Add workflow.action_review permission to Editor role
-- Required for E2E tests where editor01 needs to perform workflow actions
INSERT IGNORE INTO role_permissions (role_id, permission_id)
VALUES (4, 123);

-- permission_id 123 = workflow.action_review
-- role_id 4 = Editor
