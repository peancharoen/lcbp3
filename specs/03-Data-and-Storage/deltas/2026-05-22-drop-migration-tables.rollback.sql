-- File: specs/03-Data-and-Storage/deltas/2026-05-22-drop-migration-tables.rollback.sql
-- Change Log:
-- - 2026-05-22: กู้คืนโครงสร้างตาราง staging ทั้งหมด 5 ตารางสำหรับระบบย้ายข้อมูลกรณีเกิดเหตุฉุกเฉิน (Phase 6)

-- Delta Rollback: กู้คืนตาราง Staging ชั่วคราว (Recreate Staging Tables)
-- Date: 2026-05-22
-- Related ADR: ADR-028

-- ------------------------------------------------------------
-- การกู้คืนตาราง Staging ทั้งหมด 5 ตาราง
-- ------------------------------------------------------------

-- 1. กู้คืนตารางความคืบหน้าของ Migration Progress
CREATE TABLE IF NOT EXISTS migration_progress (
  batch_id VARCHAR(50) PRIMARY KEY,
  last_processed_index INT DEFAULT 0,
  STATUS ENUM('RUNNING', 'COMPLETED', 'FAILED') DEFAULT 'RUNNING',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci COMMENT = 'Migration: Batch Progress';

-- 2. กู้คืนตารางคิวตรวจสอบสำหรับเอกสาร (Review Queue)
CREATE TABLE IF NOT EXISTS migration_review_queue (
  id INT NOT NULL AUTO_INCREMENT,
  uuid CHAR(36) NOT NULL DEFAULT (uuid()) COMMENT 'UUID Public Identifier (ADR-019)',
  document_number VARCHAR(100) NOT NULL,
  subject TEXT COMMENT 'หัวข้อเรื่องภาษาไทยหรืออังกฤษ',
  original_subject TEXT COMMENT 'หัวข้อเรื่องเดิมจากระบบจัดเก็บเดิม',
  body TEXT NULL COMMENT 'เนื้อความย่อจาก AI',
  ai_suggested_category VARCHAR(50),
  ai_confidence DECIMAL(4, 3),
  ai_issues JSON,
  review_reason VARCHAR(255),
  status ENUM('PENDING', 'APPROVED', 'IMPORTED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
  reviewed_by VARCHAR(100),
  reviewed_at TIMESTAMP NULL,
  project_id INT NULL COMMENT 'Project ID ของโครงการ',
  sender_organization_id INT NULL COMMENT 'Sender ID ของผู้ส่ง',
  receiver_organization_id INT NULL COMMENT 'Receiver ID ของผู้รับ',
  received_date DATE NULL,
  issued_date DATE NULL,
  remarks TEXT,
  ai_summary TEXT,
  extracted_tags JSON,
  temp_attachment_id INT NULL,
  ai_job_id VARCHAR(36) NULL COMMENT 'BullMQ Job ID สำหรับงานประมวลผล AI',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_doc_number (document_number),
  UNIQUE KEY uq_migration_review_uuid (uuid)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci COMMENT = 'Migration: Review Queue';

-- 3. กู้คืนตารางแสดงประวัติข้อผิดพลาดการย้ายข้อมูล (Error Log)
CREATE TABLE IF NOT EXISTS migration_errors (
  id INT AUTO_INCREMENT PRIMARY KEY,
  batch_id VARCHAR(50),
  document_number VARCHAR(100),
  error_type ENUM(
    'FILE_NOT_FOUND',
    'MISSING_FILENAME',
    'FILE_ERROR',
    'AI_PARSE_ERROR',
    'API_ERROR',
    'DB_ERROR',
    'SECURITY',
    'UNKNOWN'
  ),
  error_message TEXT,
  raw_ai_response TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_batch_id (batch_id),
  INDEX idx_error_type (error_type)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci COMMENT = 'Migration: Error Log';

-- 4. กู้คืนตารางสถานะสำหรับ AI Model Fallback State
CREATE TABLE IF NOT EXISTS migration_fallback_state (
  id INT AUTO_INCREMENT PRIMARY KEY,
  batch_id VARCHAR(50) UNIQUE,
  recent_error_count INT DEFAULT 0,
  is_fallback_active BOOLEAN DEFAULT FALSE,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci COMMENT = 'Migration: Fallback Model State';

-- 5. กู้คืนตารางแสดงข้อมูลสรุปรายวันของ Migration (Daily Summary)
CREATE TABLE IF NOT EXISTS migration_daily_summary (
  id INT AUTO_INCREMENT PRIMARY KEY,
  batch_id VARCHAR(50),
  summary_date DATE,
  total_processed INT DEFAULT 0,
  auto_ingested INT DEFAULT 0,
  sent_to_review INT DEFAULT 0,
  rejected INT DEFAULT 0,
  errors INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_batch_date (batch_id, summary_date)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci COMMENT = 'Migration: Daily Summary';
