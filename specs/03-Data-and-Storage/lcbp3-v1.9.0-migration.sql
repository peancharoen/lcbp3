-- ==========================================================
-- DMS v1.9.0 Migration Support Tables
-- ไฟล์นี้แยกจาก schema หลัก (lcbp3-v1.9.0-schema-01/02/03)
-- ใช้สำหรับ n8n Migration Workflow เท่านั้น
-- ลบได้ทั้งหมดหลัง Migration เสร็จสิ้น
-- ==========================================================
-- รันบน MariaDB **ก่อน** เริ่ม n8n Workflow
SET NAMES utf8mb4;

-- =====================================================
-- 1. Checkpoint — ติดตามความคืบหน้าของ Batch
-- =====================================================
CREATE TABLE IF NOT EXISTS migration_progress (
  batch_id VARCHAR(50) PRIMARY KEY,
  last_processed_index INT DEFAULT 0,
  STATUS ENUM('RUNNING', 'COMPLETED', 'FAILED') DEFAULT 'RUNNING',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci COMMENT = 'Migration: ติดตามความคืบหน้า Batch (ลบได้หลัง Migration เสร็จ)';

-- =====================================================
-- 2. Review Queue — รายการที่ต้องตรวจสอบโดยคน
-- =====================================================
CREATE TABLE IF NOT EXISTS migration_review_queue (
  id INT AUTO_INCREMENT PRIMARY KEY,
  document_number VARCHAR(100) NOT NULL,
  subject TEXT COMMENT 'หัวข้อเรื่อง (ตรงกับ correspondence_revisions.subject)',
  original_subject TEXT COMMENT 'หัวข้อเดิมจาก Excel (ก่อน AI แก้ไข)',
  body TEXT NULL COMMENT 'เนื้อความสรุปจาก AI (เตรียมนำเข้า correspondence_revisions.body)',
  project_id INT NULL COMMENT 'Project ID จาก Lookups',
  sender_organization_id INT NULL COMMENT 'Sender ID จาก Lookups',
  receiver_organization_id INT NULL COMMENT 'Receiver ID จาก Lookups',
  received_date DATE NULL COMMENT 'วันที่รับเอกสาร',
  issued_date DATE NULL COMMENT 'วันที่ออกเอกสาร',
  remarks TEXT COMMENT 'หมายเหตุจากหน้างาน (response)',
  ai_suggested_category VARCHAR(50),
  ai_confidence DECIMAL(4, 3),
  ai_issues JSON,
  ai_summary TEXT COMMENT 'สรุปเนื้อหาจาก AI (4-5 บรรทัด)',
  extracted_tags JSON COMMENT 'Tag ที่ AI นำเสนอหรือจับคู่ได้',
  temp_attachment_id INT NULL COMMENT 'ID ของไฟล์ชั่วคราวจาก Two-Phase Storage',
  review_reason VARCHAR(255),
  STATUS ENUM('PENDING', 'APPROVED', 'REJECTED') DEFAULT 'PENDING',
  reviewed_by VARCHAR(100),
  reviewed_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_doc_number (document_number)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci COMMENT = 'Migration: Review Queue ชั่วคราว (ลบได้หลัง Migration เสร็จ)';

-- =====================================================
-- 3. Error Log — บันทึก Error ระหว่าง Migration
-- =====================================================
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
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci COMMENT = 'Migration: Error Log (ลบได้หลัง Migration เสร็จ)';

-- =====================================================
-- 4. Fallback State — สถานะ AI Model Fallback
-- =====================================================
CREATE TABLE IF NOT EXISTS migration_fallback_state (
  id INT AUTO_INCREMENT PRIMARY KEY,
  batch_id VARCHAR(50) UNIQUE,
  recent_error_count INT DEFAULT 0,
  is_fallback_active BOOLEAN DEFAULT FALSE,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci COMMENT = 'Migration: Fallback Model State (ลบได้หลัง Migration เสร็จ)';

-- =====================================================
-- 5. Idempotency — ป้องกัน Import ซ้ำ
-- =====================================================
CREATE TABLE IF NOT EXISTS import_transactions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  idempotency_key VARCHAR(255) UNIQUE NOT NULL,
  document_number VARCHAR(100),
  batch_id VARCHAR(100),
  status_code INT DEFAULT 201,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_idem_key (idempotency_key)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci COMMENT = 'Migration: Idempotency Tracking (ลบได้หลัง Migration เสร็จ)';

-- =====================================================
-- 6. Daily Summary — สรุปผลรายวัน
-- =====================================================
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
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci COMMENT = 'Migration: Daily Summary (ลบได้หลัง Migration เสร็จ)';

-- =====================================================
-- Cleanup Script (รันหลัง Migration เสร็จสิ้นทั้งหมด)
-- =====================================================
-- DROP TABLE IF EXISTS migration_daily_summary;
-- DROP TABLE IF EXISTS import_transactions;
-- DROP TABLE IF EXISTS migration_fallback_state;
-- DROP TABLE IF EXISTS migration_errors;
-- DROP TABLE IF EXISTS migration_review_queue;
-- DROP TABLE IF EXISTS migration_progress;
