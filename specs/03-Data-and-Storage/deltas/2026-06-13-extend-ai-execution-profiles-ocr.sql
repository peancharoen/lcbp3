-- File: specs/03-Data-and-Storage/deltas/2026-06-13-extend-ai-execution-profiles-ocr.sql
-- Change Log:
-- - 2026-06-13: ADR-036 — extend execution profiles for OCR defaults and sandbox drafts.

-- ADR-036: production parameter store remains ai_execution_profiles.
ALTER TABLE ai_execution_profiles
  ADD COLUMN IF NOT EXISTS canonical_model VARCHAR(20) NOT NULL DEFAULT 'np-dms-ai'
  COMMENT 'Canonical model identity: np-dms-ai หรือ np-dms-ocr'
  AFTER profile_name;

ALTER TABLE ai_execution_profiles
  MODIFY COLUMN max_tokens INT NULL COMMENT 'Maximum tokens to generate; NULL when model does not use token limit',
  MODIFY COLUMN num_ctx INT NULL COMMENT 'Context window size; NULL when model does not use context window';

INSERT INTO ai_execution_profiles (
  profile_name,
  canonical_model,
  temperature,
  top_p,
  max_tokens,
  num_ctx,
  repeat_penalty,
  keep_alive_seconds,
  is_active
) VALUES (
  'ocr-extract',
  'np-dms-ocr',
  0.100,
  0.100,
  NULL,
  NULL,
  1.100,
  0,
  1
) ON DUPLICATE KEY UPDATE
  canonical_model = VALUES(canonical_model),
  max_tokens = VALUES(max_tokens),
  num_ctx = VALUES(num_ctx);

CREATE TABLE IF NOT EXISTS ai_sandbox_profiles (
  id INT PRIMARY KEY AUTO_INCREMENT COMMENT 'ID ภายใน (ไม่ expose ใน API)',
  profile_name VARCHAR(50) NOT NULL COMMENT 'ชื่อ profile หรือ model-defaults row เช่น ocr-extract',
  canonical_model VARCHAR(20) NOT NULL DEFAULT 'np-dms-ai' COMMENT 'Canonical model identity: np-dms-ai หรือ np-dms-ocr',
  temperature DECIMAL(4,3) NOT NULL COMMENT 'Model temperature parameter',
  top_p DECIMAL(4,3) NOT NULL COMMENT 'Model top_p parameter',
  max_tokens INT NULL COMMENT 'Maximum tokens to generate; NULL for OCR',
  num_ctx INT NULL COMMENT 'Context window size; NULL for OCR',
  repeat_penalty DECIMAL(5,3) NOT NULL COMMENT 'Repeat penalty parameter',
  keep_alive_seconds INT NOT NULL COMMENT 'Model keep_alive in seconds; resource policy remains ADR-033',
  updated_by INT NULL COMMENT 'user_id ที่แก้ไขล่าสุด',
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_ai_sandbox_profile_name (profile_name),
  INDEX idx_ai_sandbox_profile_model (canonical_model),
  CONSTRAINT fk_ai_sandbox_profiles_updated_by
    FOREIGN KEY (updated_by) REFERENCES users(user_id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci
  COMMENT = 'Sandbox draft execution profile parameters สำหรับ ADR-036';
