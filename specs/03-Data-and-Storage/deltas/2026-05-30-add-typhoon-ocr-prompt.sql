-- File: specs/03-Data-and-Storage/deltas/2026-05-30-add-typhoon-ocr-prompt.sql
-- เพิ่ม Typhoon OCR System Prompt ลงใน ai_prompts table
-- ตาม ADR-029: Dynamic Prompt Management, ADR-032: Typhoon OCR Integration
-- Change Log:
-- - 2026-05-30: Initial seed สำหรับ typhoon_ocr_system prompt (T005)
-- - 2026-05-30: Fix: เพิ่ม public_id (UUID) และ context_config (NULL)
--              ai_prompts entity มี publicId NOT NULL column ตาม ADR-019 (เพิ่มเมื่อ 2026-05-27)
--              ใช้ UUID() ของ MariaDB เพื่อสร้าง UUIDv4 ที่ valid

INSERT INTO ai_prompts (
    public_id,
    prompt_type,
    version_number,
    template,
    field_schema,
    context_config,
    is_active,
    manual_note,
    activated_at,
    created_by
)
SELECT
    UUID(),
    'typhoon_ocr_system',
    1,
    'สกัดข้อความภาษาไทยและอังกฤษทั้งหมดจากภาพนี้อย่างถูกต้อง รักษาโครงสร้างบรรทัดและการเว้นวรรคให้ใกล้เคียงต้นฉบับมากที่สุด ห้ามเพิ่มคำอธิบายใดๆ',
    JSON_OBJECT(
        'type', 'system_prompt',
        'model', 'scb10x/typhoon-ocr-3b',
        'temperature', 0.0,
        'top_p', 0.9,
        'repeat_penalty', 1.0,
        'keep_alive', 0
    ),
    NULL,
    1,
    'System prompt สำหรับ Typhoon OCR-3B เพื่อสกัดข้อความภาษาไทย/อังกฤษจากภาพเอกสาร (ADR-032)',
    CURRENT_TIMESTAMP,
    (
        SELECT user_id
        FROM users
        WHERE username = 'superadmin'
        LIMIT 1
    )
WHERE NOT EXISTS (
    SELECT 1 FROM ai_prompts
    WHERE prompt_type = 'typhoon_ocr_system'
      AND version_number = 1
)
ON DUPLICATE KEY UPDATE prompt_type = prompt_type;
