-- File: specs/03-Data-and-Storage/deltas/2026-05-24-add-migration-errors-job-id.rollback.sql
-- Change Log:
-- - 2026-05-24: Rollback สำหรับลบ job_id ออกจาก migration_errors

-- Delta Rollback: ลบคอลัมน์ job_id สำหรับ Migration Error Log
-- Related ADR: ADR-009, ADR-023A, ADR-028

ALTER TABLE migration_errors
DROP INDEX idx_migration_errors_job_id,
DROP COLUMN job_id;
