-- Delta: Drop migration_logs table (D161 — ADR-020 era dead code)
-- Date: 2026-08-25
-- Related ADR: ADR-044 (schema-change policy), ADR-023/023A (BullMQ replaces n8n orchestrator)
-- Related Spec: D161 cleanup of dead AI Migration Logs endpoints
--
-- migration_logs เป็นตารางจาก ADR-020 era ที่ออกแบบให้ n8n เป็น orchestrator
-- หลัง ADR-023/023A เปลี่ยนไปใช้ BullMQ + migration_review_queue แล้ว
-- ไม่มี code path ใดเขียนลง migration_logs อีก (verified: 0 rows in production)
-- จึงถึงเวลา drop table ตาม ADR-044 schema-change policy
-- ------------------------------------------------------------
-- Schema changes
-- ------------------------------------------------------------

-- 1. Drop foreign key constraint ก่อน (reviewed_by → users)
ALTER TABLE `migration_logs`
  DROP FOREIGN KEY IF EXISTS `migration_logs_ibfk_1`;

-- 2. Drop indexes
ALTER TABLE `migration_logs`
  DROP INDEX IF EXISTS `idx_migration_logs_uuid`,
  DROP INDEX IF EXISTS `idx_migration_logs_status`,
  DROP INDEX IF EXISTS `idx_migration_logs_confidence`;

-- 3. Drop table
DROP TABLE IF EXISTS `migration_logs`;

-- ------------------------------------------------------------
-- Verification query
-- ------------------------------------------------------------
-- SELECT TABLE_NAME FROM information_schema.TABLES
-- WHERE TABLE_SCHEMA = 'lcbp3' AND TABLE_NAME = 'migration_logs';
-- ควรคืนค่า 0 rows
