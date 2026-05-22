-- File: specs/03-Data-and-Storage/deltas/2026-05-22-alter-migration-review-queue.sql
-- Change Log:
-- - 2026-05-22: เพิ่มคอลัมน์ ai_job_id ในตาราง migration_review_queue ตาม ADR-028

-- Delta: เพิ่มคอลัมน์ ai_job_id ในตาราง migration_review_queue
-- Date: 2026-05-22
-- Related ADR: ADR-028, ADR-023A
-- Applied in: v1.9.0 -> v1.9.5

-- ------------------------------------------------------------
-- การปรับปรุงตาราง migration_review_queue (Schema changes)
-- ------------------------------------------------------------

ALTER TABLE migration_review_queue 
ADD COLUMN ai_job_id VARCHAR(36) NULL COMMENT 'BullMQ Job ID สำหรับงานประมวลผล AI'
AFTER storage_temp_path;
