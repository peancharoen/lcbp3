-- Delta: เพิ่ม public_id และ context_config columns ใน ai_prompts
-- Date: 2026-06-06
-- Related ADR: ADR-019 (UUID strategy), ADR-029 (Dynamic Prompts)
-- ------------------------------------------------------------
-- การเปลี่ยนแปลงโครงสร้างฐานข้อมูล (Schema changes)
-- ------------------------------------------------------------

-- เพิ่ม public_id column (UUIDv7) สำหรับ ADR-019 compliance
ALTER TABLE ai_prompts
ADD COLUMN public_id UUID UNIQUE COMMENT 'Public UUID สำหรับ API (ADR-019)';

-- เพิ่ม context_config column สำหรับ ADR-029 context filtering
ALTER TABLE ai_prompts
ADD COLUMN context_config JSON NULL COMMENT 'Configuration สำหรับ Master Data context filtering (project/contract scope)';

-- สร้าง UUID สำหรับ records ที่มีอยู่แล้ว
UPDATE ai_prompts
SET public_id = UUID()
WHERE public_id IS NULL;

-- ตั้ง public_id เป็น NOT NULL หลังจาก populate ครบแล้ว
ALTER TABLE ai_prompts
MODIFY COLUMN public_id UUID NOT NULL;
