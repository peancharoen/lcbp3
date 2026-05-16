-- File: specs/03-Data-and-Storage/deltas/15-add-ai-processing-status.sql
-- Change Log
-- - 2026-05-15: เพิ่มสถานะประมวลผล AI สำหรับเอกสารตาม ADR-023A FR-018.
-- ADR-009: ใช้ SQL delta โดยตรง ห้ามใช้ TypeORM migration

SET NAMES utf8mb4;

-- หมายเหตุ: schema v1.9.0 ยังไม่มีตาราง documents กลาง จึงเพิ่มให้ตาราง attachments
-- ซึ่งเป็นตารางไฟล์เอกสารรวมที่มีอยู่จริงใน canonical schema ปัจจุบัน
ALTER TABLE attachments
  ADD COLUMN IF NOT EXISTS ai_processing_status ENUM('PENDING', 'PROCESSING', 'DONE', 'FAILED')
    NOT NULL DEFAULT 'PENDING' COMMENT 'สถานะ AI job ของไฟล์เอกสารตาม ADR-023A';

CREATE INDEX IF NOT EXISTS idx_attachments_ai_status ON attachments (ai_processing_status);
