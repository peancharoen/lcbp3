-- Delta: เพิ่ม fields สำหรับ AI Runtime Policy Refactor ใน ai_audit_logs
-- Date: 2026-06-11
-- Related ADR: ADR-023, ADR-029, Feature-235
-- Applied in: AI Runtime Policy Refactor cutover (big bang)
-- ------------------------------------------------------------
-- เพิ่ม 3 columns:
--   effective_profile    — profile name ที่ backend กำหนด (interactive/standard/quality/deep-analysis)
--   canonical_model      — canonical model identity (np-dms-ai / np-dms-ocr)
--   snapshot_params_json — parameters snapshot ณ เวลา dispatch (FR-A09)
-- ------------------------------------------------------------

-- effective_profile: ชื่อ ExecutionProfile ที่ backend กำหนดจาก job.type
ALTER TABLE ai_audit_logs
  ADD COLUMN IF NOT EXISTS effective_profile VARCHAR(50) NULL
  COMMENT 'ExecutionProfile ที่ backend กำหนด: interactive|standard|quality|deep-analysis (Feature-235)'
  AFTER model_name;

-- canonical_model: ชื่อ canonical identity — ไม่ใช่ runtime tag
ALTER TABLE ai_audit_logs
  ADD COLUMN IF NOT EXISTS canonical_model VARCHAR(50) NULL
  COMMENT 'Canonical model identity: np-dms-ai หรือ np-dms-ocr (Feature-235, ADR-023)'
  AFTER effective_profile;

-- snapshot_params_json: parameters ที่ถูก snapshot ตอน dispatch โดย AiPolicyService (FR-A09)
-- { temperature, topP, maxTokens, numCtx, repeatPenalty, keepAliveSeconds }
ALTER TABLE ai_audit_logs
  ADD COLUMN IF NOT EXISTS snapshot_params_json JSON NULL
  COMMENT 'Runtime parameters snapshot ณ เวลา dispatch — ใช้จริงใน Ollama call (FR-A09, Feature-235)'
  AFTER canonical_model;

-- index สำหรับ analytics queries ตาม profile
ALTER TABLE ai_audit_logs
  ADD INDEX IF NOT EXISTS idx_ai_audit_effective_profile (effective_profile);

-- index สำหรับ canonical_model
ALTER TABLE ai_audit_logs
  ADD INDEX IF NOT EXISTS idx_ai_audit_canonical_model (canonical_model);
