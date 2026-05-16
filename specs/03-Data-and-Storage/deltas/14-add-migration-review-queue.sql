-- File: specs/03-Data-and-Storage/deltas/14-add-migration-review-queue.sql
-- Change Log
-- - 2026-05-15: เพิ่ม delta สำหรับ migration_review_queue ตาม ADR-023A โดยไม่ลบ/rename column เดิม.
-- ADR-009: ใช้ SQL delta โดยตรง ห้ามใช้ TypeORM migration

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS migration_review_queue (
  id INT NOT NULL AUTO_INCREMENT COMMENT 'Internal PK (ห้าม expose ใน API)',
  uuid UUID NOT NULL DEFAULT UUID() COMMENT 'UUID Public Identifier (ADR-019)',
  batch_id VARCHAR(100) NOT NULL COMMENT 'n8n batch identifier',
  idempotency_key VARCHAR(200) NOT NULL COMMENT 'Idempotency-Key สำหรับป้องกัน queue ซ้ำ',
  original_filename VARCHAR(500) NOT NULL COMMENT 'ชื่อไฟล์ต้นฉบับจาก legacy source',
  storage_temp_path VARCHAR(1000) NOT NULL COMMENT 'temp storage path ก่อน import',
  ai_metadata_json JSON NOT NULL COMMENT 'AI suggestion payload เต็มสำหรับ human review',
  confidence_score DECIMAL(5, 4) NOT NULL COMMENT 'AI confidence score 0.0000-1.0000',
  ocr_used TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'ระบุว่าใช้ OCR path หรือไม่',
  status ENUM('PENDING', 'IMPORTED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
  reviewed_by INT NULL COMMENT 'Internal users.user_id ของผู้ review',
  reviewed_at DATETIME NULL COMMENT 'เวลาที่ review record',
  rejection_reason VARCHAR(500) NULL COMMENT 'เหตุผลเมื่อ reject',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_migration_review_uuid (uuid),
  UNIQUE KEY uq_migration_review_idempotency (idempotency_key),
  KEY idx_migration_review_status_created (status, created_at),
  KEY idx_migration_review_batch (batch_id),
  KEY idx_migration_review_reviewed_by (reviewed_by)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = 'ADR-023A AI migration review staging queue';

ALTER TABLE migration_review_queue
  ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(200) NULL COMMENT 'Idempotency-Key สำหรับป้องกัน queue ซ้ำ',
  ADD COLUMN IF NOT EXISTS original_filename VARCHAR(500) NULL COMMENT 'ชื่อไฟล์ต้นฉบับจาก legacy source',
  ADD COLUMN IF NOT EXISTS storage_temp_path VARCHAR(1000) NULL COMMENT 'temp storage path ก่อน import',
  ADD COLUMN IF NOT EXISTS ai_metadata_json JSON NULL COMMENT 'AI suggestion payload เต็มสำหรับ human review',
  ADD COLUMN IF NOT EXISTS ocr_used TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'ระบุว่าใช้ OCR path หรือไม่',
  ADD COLUMN IF NOT EXISTS reviewed_by INT NULL COMMENT 'Internal users.user_id ของผู้ review',
  ADD COLUMN IF NOT EXISTS reviewed_at DATETIME NULL COMMENT 'เวลาที่ review record',
  ADD COLUMN IF NOT EXISTS rejection_reason VARCHAR(500) NULL COMMENT 'เหตุผลเมื่อ reject';

UPDATE migration_review_queue
SET
  idempotency_key = COALESCE(idempotency_key, CONCAT(batch_id, ':', uuid)),
  original_filename = COALESCE(original_filename, original_file_name),
  ai_metadata_json = COALESCE(ai_metadata_json, extracted_metadata),
  rejection_reason = COALESCE(rejection_reason, error_reason)
WHERE idempotency_key IS NULL
   OR original_filename IS NULL
   OR ai_metadata_json IS NULL
   OR rejection_reason IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_migration_review_idempotency ON migration_review_queue (idempotency_key);
CREATE INDEX IF NOT EXISTS idx_migration_review_status_created ON migration_review_queue (status, created_at);
CREATE INDEX IF NOT EXISTS idx_migration_review_batch ON migration_review_queue (batch_id);
CREATE INDEX IF NOT EXISTS idx_migration_review_reviewed_by ON migration_review_queue (reviewed_by);
