-- Delta: เพิ่ม publicId column ให้ ai_prompts table เพื่อ ADR-019 compliance
-- Date: 2026-05-30
-- Related ADR: ADR-019 (Hybrid UUID Strategy)
-- Applied in: v1.9.6 -> v1.9.7
-- ------------------------------------------------------------
-- การเปลี่ยนแปลงโครงสร้างฐานข้อมูล (Schema changes)
-- ------------------------------------------------------------
-- เพิ่ม publicId column (MariaDB native UUID type ตาม ADR-019)
ALTER TABLE ai_prompts
ADD COLUMN publicId CHAR(36) UNIQUE COMMENT 'UUIDv7 public identifier (ADR-019)';

-- Generate UUIDv7 for existing records
-- ใช้ MariaDB UUID() function สำหรับสร้าง UUID v4 (fallback)
-- หมายเหตุ: UUIDv7 จริงๆ ต้องใช้ timestamp แต่ MariaDB ยังไม่รองรับ UUIDv7 native
-- ใช้ UUID() เป็น workaround และจะถูก replace ด้วย UUIDv7 จริงเมื่อ migrate document
UPDATE ai_prompts
SET publicId = UUID()
WHERE publicId IS NULL;

-- Add index for publicId (optional but recommended for performance)
CREATE INDEX idx_ai_prompts_publicId ON ai_prompts(publicId);
