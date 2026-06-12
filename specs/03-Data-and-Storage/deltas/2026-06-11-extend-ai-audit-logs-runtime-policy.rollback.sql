-- Rollback: ลบ fields ที่เพิ่มสำหรับ AI Runtime Policy Refactor
-- Date: 2026-06-11
-- Related Delta: 2026-06-11-extend-ai-audit-logs-runtime-policy.sql
-- ------------------------------------------------------------

ALTER TABLE ai_audit_logs
  DROP INDEX IF EXISTS idx_ai_audit_canonical_model;

ALTER TABLE ai_audit_logs
  DROP INDEX IF EXISTS idx_ai_audit_effective_profile;

ALTER TABLE ai_audit_logs
  DROP COLUMN IF EXISTS snapshot_params_json;

ALTER TABLE ai_audit_logs
  DROP COLUMN IF EXISTS canonical_model;

ALTER TABLE ai_audit_logs
  DROP COLUMN IF EXISTS effective_profile;
