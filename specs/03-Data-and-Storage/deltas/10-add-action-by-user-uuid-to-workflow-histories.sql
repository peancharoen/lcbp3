-- ============================================================
-- Delta 10: ADR-001 v1.1 / ADR-019 UUID Compliance
-- เพิ่ม action_by_user_uuid ใน workflow_histories
-- เพื่อ expose User identity ผ่าน API โดยไม่ต้องเปิดเผย INT PK (ADR-019)
-- ============================================================
-- Feature: 003-unified-workflow-engine (FR-003)
-- Date: 2026-05-03
-- ข้อควรระวัง: NULL สำหรับ Historical records ที่สร้างก่อน delta นี้ — เป็น Acceptable
--              NULL ในบริบทนี้ = "System Action" หรือ "Pre-migration record"
-- Rollback: ALTER TABLE workflow_histories DROP COLUMN action_by_user_uuid;

ALTER TABLE workflow_histories
  ADD COLUMN action_by_user_uuid VARCHAR(36) NULL
    COMMENT 'UUID ของ User ผู้ดำเนินการ — ใช้ใน API Response แทน INT FK (ADR-019). NULL = System Action หรือ Pre-migration record';
