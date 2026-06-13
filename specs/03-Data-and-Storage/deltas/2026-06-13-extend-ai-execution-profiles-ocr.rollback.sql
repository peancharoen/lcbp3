-- File: specs/03-Data-and-Storage/deltas/2026-06-13-extend-ai-execution-profiles-ocr.rollback.sql
-- Change Log:
-- - 2026-06-13: Rollback for ADR-036 OCR execution profile extension.

DROP TABLE IF EXISTS ai_sandbox_profiles;

DELETE FROM ai_execution_profiles
WHERE profile_name = 'ocr-extract'
  AND canonical_model = 'np-dms-ocr';

ALTER TABLE ai_execution_profiles
  MODIFY COLUMN max_tokens INT NOT NULL COMMENT 'Maximum tokens to generate',
  MODIFY COLUMN num_ctx INT NOT NULL COMMENT 'Context window size (tokens)';

ALTER TABLE ai_execution_profiles
  DROP COLUMN IF EXISTS canonical_model;
