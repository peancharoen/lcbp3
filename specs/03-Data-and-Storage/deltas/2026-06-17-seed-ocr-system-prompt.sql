-- Delta: 2026-06-17-seed-ocr-system-prompt.sql
-- Purpose: Seed default OCR system prompt for np-dms-ocr model (Feature 238)
-- ADR-009: Edit schema directly, no TypeORM migrations

-- version column มีอยู่แล้วจาก 2026-06-15-fix-ai-prompts-columns.sql — บรรทัดนี้ idempotent เผื่อ env เก่า
ALTER TABLE ai_prompts ADD COLUMN IF NOT EXISTS `version` INT NOT NULL DEFAULT 1;

-- Seed default OCR system prompt (ถ้ายังไม่มี active ของ type นี้)
-- ใช้ created_by INT FK → users(user_id) และ username='superadmin' ตาม pattern ของ delta เดิม
INSERT INTO ai_prompts (
    public_id, prompt_type, version_number, template,
    context_config, is_active, activated_at, created_by
)
SELECT
    UUID(),
    'ocr_system',
    1,
    'Extract all text from this PDF page accurately.',
    '{"temperature": 0.1, "topP": 0.6}',
    1,
    CURRENT_TIMESTAMP,
    (SELECT user_id FROM users WHERE username = 'superadmin' LIMIT 1)
WHERE NOT EXISTS (
    SELECT 1 FROM ai_prompts WHERE prompt_type = 'ocr_system' AND is_active = 1
);
