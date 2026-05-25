-- File: specs/03-Data-and-Storage/deltas/2026-05-25-grant-ai-permissions-to-superadmin.rollback.sql
-- Change Log:
-- - 2026-05-25: Rollback — ลบ ai.* permissions ออกจาก role_id=1 (Superadmin)
-- ==========================================================
DELETE rp FROM role_permissions rp
JOIN permissions p ON rp.permission_id = p.permission_id
WHERE rp.role_id = 1
AND p.permission_name IN (
  'ai.suggest',
  'ai.rag_query',
  'ai.migration_manage',
  'ai.audit_log_delete',
  'ai.read_analytics',
  'ai.delete_audit'
);
