-- File: specs/03-Data-and-Storage/deltas/2026-05-22-alter-migration-review-queue.rollback.sql
-- Change Log:
-- - 2026-05-22: ลบคอลัมน์ ai_job_id ออกจากตาราง migration_review_queue ตาม ADR-028

-- Delta Rollback: ลบคอลัมน์ ai_job_id ในตาราง migration_review_queue
-- Date: 2026-05-22
-- Related ADR: ADR-028, ADR-023A

-- ------------------------------------------------------------
-- การลบคอลัมน์ (Rollback changes)
-- ------------------------------------------------------------

ALTER TABLE migration_review_queue 
DROP COLUMN ai_job_id;
