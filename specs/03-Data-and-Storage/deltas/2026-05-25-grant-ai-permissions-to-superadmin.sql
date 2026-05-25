-- File: specs/03-Data-and-Storage/deltas/2026-05-25-grant-ai-permissions-to-superadmin.sql
-- Change Log:
-- - 2026-05-25: Grant ai.* permissions ให้ Superadmin (role_id=1) ที่ขาดหายไปจาก seed
-- ==========================================================
-- Root Cause:
--   Seed script (lcbp3-v1.9.0-seed-permissions.sql) รัน:
--     INSERT INTO role_permissions SELECT 1, permission_id FROM permissions WHERE is_active = 1
--   ก่อนที่ ai.* permissions (permission_id 181-186) จะถูก INSERT เข้า permissions table
--   ทำให้ role_id=1 (Superadmin) ไม่มี ai.* ใน role_permissions
--   ผลกระทบ: migration_bot (user_id=5, role_id=1) ถูก RbacGuard block ที่ POST /api/ai/jobs
-- ==========================================================
INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT 1, permission_id
FROM permissions
WHERE permission_name IN (
  'ai.suggest',
  'ai.rag_query',
  'ai.migration_manage',
  'ai.audit_log_delete',
  'ai.read_analytics',
  'ai.delete_audit'
)
AND is_active = 1;
