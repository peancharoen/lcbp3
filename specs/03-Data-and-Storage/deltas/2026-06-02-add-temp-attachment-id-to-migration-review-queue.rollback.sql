-- File: specs/03-Data-and-Storage/deltas/2026-06-02-add-temp-attachment-id-to-migration-review-queue.rollback.sql
-- Change Log:
-- - 2026-06-02: ลบคอลัมน์ temp_attachment_id ออกจากตาราง migration_review_queue

-- Rollback Delta: ลบคอลัมน์ temp_attachment_id ออกจากตาราง migration_review_queue
-- Date: 2026-06-02
-- Related ADR: ADR-028, ADR-023A
-- Applied in: v1.9.8

ALTER TABLE migration_review_queue
DROP COLUMN temp_attachment_id;
