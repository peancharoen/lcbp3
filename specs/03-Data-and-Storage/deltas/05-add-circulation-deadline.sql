-- Delta 05: Add deadline_date to circulations (v1.8.7 — EC-CIRC-003)
-- Purpose: เพิ่มคอลัมน์ deadline_date ที่ตาราง circulations
--          เพื่อรองรับ EC-CIRC-003 (Overdue Badge) และการตั้งค่ากำหนดเวลา
-- Applied: เพิ่มทีหลัง Schema v1.8.0
-- Author:  NAP-DMS v1.8.7

ALTER TABLE circulations
  ADD COLUMN deadline_date DATE NULL
    COMMENT 'วันครบกำหนดส่งงาน (nullable — ถ้า NULL = ไม่มีกำหนด)'
    AFTER closed_at;

-- Index สำหรับ query Overdue Circulations ที่ Dashboard
CREATE INDEX idx_circulations_deadline ON circulations (deadline_date);
