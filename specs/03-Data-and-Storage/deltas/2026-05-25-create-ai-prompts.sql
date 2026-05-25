-- Delta: สร้างตาราง ai_prompts สำหรับ Dynamic Prompt Management
-- Date: 2026-05-25
-- Related ADR: ADR-029
-- Applied in: v1.9.0 -> v1.9.6
-- ------------------------------------------------------------
-- การเปลี่ยนแปลงโครงสร้างฐานข้อมูล (Schema changes)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ai_prompts (
  id INT PRIMARY KEY AUTO_INCREMENT COMMENT 'ID ภายใน (ไม่ expose ใน API)',
  prompt_type VARCHAR(50) NOT NULL COMMENT 'ประเภท prompt เช่น ocr_extraction',
  version_number INT NOT NULL COMMENT 'เลข version ต่อเนื่องต่อ prompt_type (1, 2, 3...)',
  template TEXT NOT NULL COMMENT 'prompt template ที่มี {{ocr_text}} placeholder บังคับ',
  field_schema JSON NULL COMMENT 'definition ของ fields ที่คาดหวังในผลลัพธ์ JSON',
  is_active TINYINT(1) NOT NULL DEFAULT 0 COMMENT '1 = version นี้ใช้งานจริงทั้ง sandbox และ migrate-document (1 per prompt_type)',
  test_result_json JSON NULL COMMENT 'ผลลัพธ์ JSON จาก sandbox run ล่าสุด (auto-save โดย processor)',
  manual_note TEXT NULL COMMENT 'หมายเหตุ/annotation จาก admin (manual input)',
  last_tested_at TIMESTAMP NULL COMMENT 'เวลาที่ sandbox รันครั้งล่าสุดสำหรับ version นี้',
  activated_at TIMESTAMP NULL COMMENT 'เวลาที่ version นี้ถูก activate เป็น active',
  created_by INT NOT NULL COMMENT 'user_id ของผู้สร้าง version นี้',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_type_version (prompt_type, version_number),
  INDEX idx_prompt_type_active (prompt_type, is_active),
  FOREIGN KEY (created_by) REFERENCES users(user_id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = 'ตาราง versioned prompt templates สำหรับ OCR extraction (ADR-029)';

-- ------------------------------------------------------------
-- Seed: migrate hardcoded prompt เป็น active version 1
-- (8 fields รวม category, tags, summary — ใช้ร่วมกันทั้ง sandbox และ migrate-document)
-- ------------------------------------------------------------
INSERT INTO ai_prompts (
    prompt_type,
    version_number,
    template,
    field_schema,
    is_active,
    manual_note,
    activated_at,
    created_by
  )
VALUES (
    'ocr_extraction',
    1,
    'You are a professional document intelligence engine.\nAnalyze the following OCR text extracted from a project document and extract the metadata fields.\n\nOCR TEXT:\n{{ocr_text}}\n\nExtract these fields:\n1. documentNumber: The official document number or code. If not found, return null.\n2. subject: The main subject, title, or topic of the document. If not found, return null.\n3. discipline: Must be exactly one of: "Civil", "Mechanical", "Electrical", "Architectural", or null if not specified.\n4. category: Must be exactly one of: "Correspondence", "Transmittal", "Circulation", "RFA", "Shop Drawing", "Contract Drawing", or null if not specified.\n5. date: The issue/document date in YYYY-MM-DD format. If not found, return null.\n6. confidence: A float between 0.0 and 1.0 indicating your confidence in this extraction.\n7. tags: An array of tags/keywords (strings) that describe the document.\n8. summary: A short 1-2 sentence summary of the document contents.\nReturn ONLY a valid JSON object matching this schema. Do NOT include markdown code blocks, HTML, or any conversational text. Example:\n{\n  "documentNumber": "LCBP3-CIV-001",\n  "subject": "Foundation Inspection Report",\n  "discipline": "Civil",\n  "category": "Correspondence",\n  "date": "2026-05-20",\n  "confidence": 0.95,\n  "tags": ["foundation", "inspection", "concrete"],\n  "summary": "This document is a foundation inspection report for the LCBP3 project, confirming concrete strength."\n}',
    JSON_OBJECT(
      'documentNumber',
      'string|null',
      'subject',
      'string|null',
      'discipline',
      'enum:Civil,Mechanical,Electrical,Architectural|null',
      'category',
      'enum:Correspondence,Transmittal,Circulation,RFA,Shop Drawing,Contract Drawing|null',
      'date',
      'date:YYYY-MM-DD|null',
      'confidence',
      'float:0-1',
      'tags',
      'string[]',
      'summary',
      'string|null'
    ),
    1,
    'Migrated from hardcoded prompt in processSandboxExtract / processMigrateDocument (ADR-029)',
    CURRENT_TIMESTAMP,
    (
      SELECT user_id
      FROM users
      WHERE username = 'superadmin'
      LIMIT 1
    ) -- PREREQUISITE: user seed (user.seed.ts) MUST run before this delta;
    -- 'superadmin' is always the first user inserted per standard deployment order
  ) ON DUPLICATE KEY
UPDATE prompt_type = prompt_type;
