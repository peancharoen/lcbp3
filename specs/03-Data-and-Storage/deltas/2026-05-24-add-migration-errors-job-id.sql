-- File: specs/03-Data-and-Storage/deltas/2026-05-24-add-migration-errors-job-id.sql
-- Change Log:
-- - 2026-05-24: เพิ่ม job_id ใน migration_errors เพื่อผูก error log กับ BullMQ AI job

-- Delta: เพิ่มคอลัมน์ job_id สำหรับ Migration Error Log
-- Related ADR: ADR-009, ADR-023A, ADR-028

ALTER TABLE migration_errors
ADD COLUMN job_id VARCHAR(100) NULL COMMENT 'BullMQ Job ID สำหรับ trace error ของ AI migration'
AFTER error_message,
ADD INDEX idx_migration_errors_job_id (job_id);
