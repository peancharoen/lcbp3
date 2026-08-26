-- Delta: Add WAITING to migration_review_queue.ai_status enum (ADR-047)
-- เพิ่มสถานะ WAITING สำหรับ BullMQ job ที่ enqueue แล้วแต่ยังไม่ถูก worker pick up
-- PENDING = ยังไม่ enqueue (aiJobId = null)
-- WAITING = enqueue แล้ว รอ worker (aiJobId != null)
-- RUNNING = worker กำลังประมวลผล
-- DONE = สำเร็จ
-- FAILED = ล้มเหลว
-- Date: 2026-08-26

ALTER TABLE `migration_review_queue`
  MODIFY COLUMN `ai_status` ENUM('PENDING', 'WAITING', 'RUNNING', 'DONE', 'FAILED') NULL DEFAULT 'PENDING'
  COMMENT 'สถานะ BullMQ AI job (ADR-047) — WAITING = enqueue แล้วรอ worker';

-- อัปเดตรายการที่ aiJobId != null และ aiStatus = 'PENDING' ให้เป็น 'WAITING'
-- (รายการเดิมที่ enqueue แล้วแต่ยังใช้ PENDING แทน WAITING)
UPDATE `migration_review_queue`
SET `ai_status` = 'WAITING'
WHERE `ai_job_id` IS NOT NULL
  AND `ai_status` = 'PENDING';
