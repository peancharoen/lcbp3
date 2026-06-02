-- File: specs/03-Data-and-Storage/deltas/2026-06-02-add-temp-attachment-id-to-migration-review-queue.sql
-- Change Log:
-- - 2026-06-02: เพิ่มคอลัมน์ temp_attachment_id ในตาราง migration_review_queue เพื่อแก้บั๊ก CleanupTempFilesWorker

-- Delta: เพิ่มคอลัมน์ temp_attachment_id ในตาราง migration_review_queue
-- Date: 2026-06-02
-- Related ADR: ADR-028, ADR-023A
-- Applied in: v1.9.8

-- ------------------------------------------------------------
-- การปรับปรุงตาราง migration_review_queue (Schema changes)
-- ------------------------------------------------------------

ALTER TABLE migration_review_queue 
ADD COLUMN temp_attachment_id INT NULL COMMENT 'Temporary attachment ID referencing attachments.id (ADR-028)'
AFTER STATUS;
