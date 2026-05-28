-- Rollback Delta: Remove context_config & publicId from ai_prompts & Revert CC whitespace typo
-- Date: 2026-05-27
-- Related ADR: ADR-030, ADR-019
-- ------------------------------------------------------------
-- 1. ย้อนกลับตาราง correspondence_recipients ให้มี whitespace ENUM เหมือนเดิม
ALTER TABLE correspondence_recipients
MODIFY COLUMN recipient_type ENUM('TO', 'CC ') NOT NULL COMMENT 'ประเภทผู้รับ (TO หรือ CC)';

-- ย้อนคืนข้อมูลจาก CC เป็น CC
UPDATE correspondence_recipients
SET recipient_type = 'CC '
WHERE recipient_type = 'CC';

-- 2. ลบคอลัมน์ publicId จาก ai_prompts
ALTER TABLE ai_prompts DROP COLUMN public_id;

-- 3. ลบคอลัมน์ context_config จาก ai_prompts
ALTER TABLE ai_prompts DROP COLUMN context_config;

-- 4. ลบ Seed Prompt Version 2 และเปิดใช้งาน Version 1 แทน
DELETE FROM ai_prompts
WHERE prompt_type = 'ocr_extraction'
  AND version_number = 2;

UPDATE ai_prompts
SET is_active = 1
WHERE prompt_type = 'ocr_extraction'
  AND version_number = 1;
