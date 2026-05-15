-- File: specs/03-Data-and-Storage/deltas/12-unified-ai-architecture.sql
-- Change Log
-- - 2026-05-14: เพิ่ม schema delta สำหรับ ADR-023 Unified AI Architecture.
-- ADR-009: ใช้ SQL delta โดยตรง ห้ามใช้ TypeORM migration

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS migration_review_queue (
  id INT AUTO_INCREMENT PRIMARY KEY COMMENT 'Internal PK (ห้าม expose ใน API)',
  uuid UUID NOT NULL DEFAULT UUID() COMMENT 'UUID Public Identifier (ADR-019)',
  batch_id VARCHAR(100) NOT NULL COMMENT 'Batch ingestion identifier',
  original_file_name VARCHAR(255) NOT NULL COMMENT 'Original uploaded legacy filename',
  source_attachment_public_id UUID NULL COMMENT 'Temp attachment publicId from two-phase upload',
  temp_attachment_id INT NULL COMMENT 'Internal temp attachment id used during commit only',
  extracted_metadata JSON NULL COMMENT 'AI extracted metadata before human validation',
  confidence_score DECIMAL(4, 3) NULL COMMENT 'Overall AI confidence score 0.000-1.000',
  status ENUM('PENDING', 'IMPORTED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
  error_reason TEXT NULL COMMENT 'Reason when AI processing rejected the record',
  version INT NOT NULL DEFAULT 1 COMMENT 'Optimistic locking version',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY idx_migration_review_uuid (uuid),
  KEY idx_migration_review_batch (batch_id),
  KEY idx_migration_review_status (status)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = 'ADR-023 AI migration review staging queue';

ALTER TABLE migration_review_queue
  ADD COLUMN IF NOT EXISTS uuid UUID NOT NULL DEFAULT UUID() COMMENT 'UUID Public Identifier (ADR-019)',
  ADD COLUMN IF NOT EXISTS batch_id VARCHAR(100) NULL COMMENT 'Batch ingestion identifier',
  ADD COLUMN IF NOT EXISTS original_file_name VARCHAR(255) NULL COMMENT 'Original uploaded legacy filename',
  ADD COLUMN IF NOT EXISTS source_attachment_public_id UUID NULL COMMENT 'Temp attachment publicId from two-phase upload',
  ADD COLUMN IF NOT EXISTS temp_attachment_id INT NULL COMMENT 'Internal temp attachment id used during commit only',
  ADD COLUMN IF NOT EXISTS extracted_metadata JSON NULL COMMENT 'AI extracted metadata before human validation',
  ADD COLUMN IF NOT EXISTS confidence_score DECIMAL(4, 3) NULL COMMENT 'Overall AI confidence score 0.000-1.000',
  ADD COLUMN IF NOT EXISTS error_reason TEXT NULL COMMENT 'Reason when AI processing rejected the record',
  ADD COLUMN IF NOT EXISTS version INT NOT NULL DEFAULT 1 COMMENT 'Optimistic locking version',
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;

ALTER TABLE migration_review_queue
  MODIFY COLUMN status ENUM('PENDING', 'APPROVED', 'IMPORTED', 'REJECTED') NOT NULL DEFAULT 'PENDING';

CREATE UNIQUE INDEX IF NOT EXISTS idx_migration_review_uuid ON migration_review_queue (uuid);
CREATE INDEX IF NOT EXISTS idx_migration_review_batch ON migration_review_queue (batch_id);
CREATE INDEX IF NOT EXISTS idx_migration_review_status ON migration_review_queue (status);

CREATE TABLE IF NOT EXISTS ai_audit_logs (
  id INT AUTO_INCREMENT PRIMARY KEY COMMENT 'Internal PK (ห้าม expose ใน API)',
  uuid UUID NOT NULL DEFAULT UUID() COMMENT 'UUID Public Identifier (ADR-019)',
  document_public_id UUID NULL COMMENT 'Imported document publicId when available',
  ai_model VARCHAR(50) NOT NULL DEFAULT 'gemma4' COMMENT 'Legacy AI model column used by current gateway service',
  model_name VARCHAR(100) NOT NULL COMMENT 'Local model name used by ADR-023 AI pipeline',
  ai_suggestion_json JSON NULL COMMENT 'AI suggested metadata',
  human_override_json JSON NULL COMMENT 'Human approved or overridden metadata',
  processing_time_ms INT NULL COMMENT 'Legacy processing duration field',
  confidence_score DECIMAL(4, 3) NULL COMMENT 'AI confidence score 0.000-1.000',
  input_hash VARCHAR(64) NULL COMMENT 'Legacy SHA-256 input hash',
  output_hash VARCHAR(64) NULL COMMENT 'Legacy SHA-256 output hash',
  status ENUM('SUCCESS', 'FAILED', 'TIMEOUT') NOT NULL DEFAULT 'SUCCESS' COMMENT 'Legacy processing status field',
  error_message TEXT NULL COMMENT 'Legacy processing error field',
  confirmed_by_user_id INT NULL COMMENT 'Internal users.user_id that confirmed the record',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY idx_ai_audit_logs_uuid (uuid),
  KEY idx_ai_audit_document (document_public_id),
  KEY idx_ai_audit_model (ai_model),
  KEY idx_ai_audit_model_name (model_name),
  KEY idx_ai_audit_status (status),
  KEY idx_ai_audit_confirmed_by (confirmed_by_user_id),
  CONSTRAINT fk_ai_audit_confirmed_by_user FOREIGN KEY (confirmed_by_user_id) REFERENCES users (user_id) ON DELETE SET NULL
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = 'ADR-023 AI development feedback log';

ALTER TABLE ai_audit_logs
  ADD COLUMN IF NOT EXISTS ai_model VARCHAR(50) NOT NULL DEFAULT 'gemma4' COMMENT 'Legacy AI model column used by current gateway service',
  ADD COLUMN IF NOT EXISTS model_name VARCHAR(100) NULL COMMENT 'Local model name used by ADR-023 AI pipeline',
  ADD COLUMN IF NOT EXISTS ai_suggestion_json JSON NULL COMMENT 'AI suggested metadata',
  ADD COLUMN IF NOT EXISTS human_override_json JSON NULL COMMENT 'Human approved or overridden metadata',
  ADD COLUMN IF NOT EXISTS processing_time_ms INT NULL COMMENT 'Legacy processing duration field',
  ADD COLUMN IF NOT EXISTS input_hash VARCHAR(64) NULL COMMENT 'Legacy SHA-256 input hash',
  ADD COLUMN IF NOT EXISTS output_hash VARCHAR(64) NULL COMMENT 'Legacy SHA-256 output hash',
  ADD COLUMN IF NOT EXISTS status ENUM('SUCCESS', 'FAILED', 'TIMEOUT') NOT NULL DEFAULT 'SUCCESS' COMMENT 'Legacy processing status field',
  ADD COLUMN IF NOT EXISTS error_message TEXT NULL COMMENT 'Legacy processing error field',
  ADD COLUMN IF NOT EXISTS confirmed_by_user_id INT NULL COMMENT 'Internal users.user_id that confirmed the record';

UPDATE ai_audit_logs
SET model_name = ai_model
WHERE model_name IS NULL AND ai_model IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ai_audit_model_name ON ai_audit_logs (model_name);
CREATE INDEX IF NOT EXISTS idx_ai_audit_confirmed_by ON ai_audit_logs (confirmed_by_user_id);
