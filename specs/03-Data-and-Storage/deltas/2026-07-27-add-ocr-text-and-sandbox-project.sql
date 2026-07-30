-- File: specs/03-Data-and-Storage/deltas/2026-07-27-add-ocr-text-and-sandbox-project.sql
-- Change Log:
-- - 2026-07-27: Initial delta for OCR Text Persistence & Sandbox Project (ADR-042)
-- Description:
--   1. ALTER TABLE attachments ADD COLUMN ocr_text LONGTEXT NULL
--   2. ALTER TABLE projects ADD COLUMN is_sandbox TINYINT(1) NOT NULL DEFAULT 0
--   3. INSERT sandbox project seed row
-- 1. เพิ่มคอลัมน์ ocr_text ใน attachments เก็บ OCR text ที่สกัดได้ก่อน embedding (ADR-042)
ALTER TABLE attachments
ADD COLUMN ocr_text LONGTEXT NULL COMMENT 'OCR text ที่สกัดได้ก่อน semantic chunking/embedding (ADR-042)';

-- 2. เพิ่มคอลัมน์ is_sandbox ใน projects ระบุว่าเป็นโครงการทดสอบ (ADR-042)
ALTER TABLE projects
ADD COLUMN is_sandbox TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'Flag ระบุว่าเป็นโครงการทดสอบ (ADR-042)';

-- 3. Seed sandbox project — 1 แถวคงที่สำหรับ Full Pipeline Testing
-- uuid column has DEFAULT UUID() so no need to specify it
INSERT INTO projects (
    project_code,
    project_name,
    is_active,
    is_sandbox,
    created_at,
    updated_at
  )
SELECT 'SANDBOX',
  'AI Sandbox Testing (Internal)',
  1,
  1,
  NOW(),
  NOW()
FROM DUAL
WHERE NOT EXISTS (
    SELECT 1
    FROM projects
    WHERE project_code = 'SANDBOX'
      AND is_sandbox = 1
  );
