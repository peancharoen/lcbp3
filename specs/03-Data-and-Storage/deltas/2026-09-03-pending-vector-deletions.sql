-- File: specs/03-Data-and-Storage/deltas/2026-09-03-pending-vector-deletions.sql
-- Change Log:
-- - 2026-09-03: Create pending_vector_deletions table for reliable Qdrant vector cleanup
--   when hardDelete() cannot synchronously delete vectors (Qdrant down, network error).
--   Periodic cleanup job retries until success or max retries exceeded.

CREATE TABLE IF NOT EXISTS pending_vector_deletions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  public_id UUID NOT NULL UNIQUE,
  document_public_id VARCHAR(64) NOT NULL,
  project_public_id VARCHAR(64) NOT NULL,
  status ENUM('PENDING', 'COMPLETED', 'FAILED') NOT NULL DEFAULT 'PENDING',
  retry_count INT NOT NULL DEFAULT 0,
  max_retries INT NOT NULL DEFAULT 10,
  last_error TEXT NULL,
  requested_by_user_id INT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  completed_at TIMESTAMP NULL,
  INDEX idx_pvd_status (status),
  INDEX idx_pvd_doc (document_public_id),
  INDEX idx_pvd_project (project_public_id),
  INDEX idx_pvd_created (created_at)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci
  COMMENT = 'ตารางเก็บคำสั่งลบ Qdrant vectors ที่ยังไม่สำเร็จ (compensation pattern สำหรับ hardDelete)';
