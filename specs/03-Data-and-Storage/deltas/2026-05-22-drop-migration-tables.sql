-- File: specs/03-Data-and-Storage/deltas/2026-05-22-drop-migration-tables.sql
-- Change Log:
-- - 2026-05-22: ดรอปตาราง staging ทั้งหมดหลังย้ายข้อมูลเสร็จสิ้น (Phase 6) โดยยังคงรักษาตาราง import_transactions ไว้ป้องกันการย้ายข้อมูลซ้ำ

-- Delta: ดรอปตาราง Staging ชั่วคราว (Post-Migration Cleanup)
-- Date: 2026-05-22
-- Related ADR: ADR-028

-- ------------------------------------------------------------
-- การล้างตาราง Staging เพื่อประหยัดพื้นที่ระบบจัดเก็บข้อมูล (Cleanups)
-- ------------------------------------------------------------

-- ลบตารางแสดงข้อมูลสรุปรายวันของ Migration
DROP TABLE IF EXISTS migration_daily_summary;

-- ลบตารางสถานะสำหรับ AI Model Fallback State
DROP TABLE IF EXISTS migration_fallback_state;

-- ลบตารางแสดงประวัติข้อผิดพลาดการย้ายข้อมูล
DROP TABLE IF EXISTS migration_errors;

-- ลบตารางคิวตรวจสอบสำหรับเอกสาร
DROP TABLE IF EXISTS migration_review_queue;

-- ลบตารางความคืบหน้าของ Migration Progress
DROP TABLE IF EXISTS migration_progress;
