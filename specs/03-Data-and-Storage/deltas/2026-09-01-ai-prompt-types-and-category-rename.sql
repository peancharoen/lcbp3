-- File: specs/03-Data-and-Storage/deltas/2026-09-01-ai-prompt-types-and-category-rename.sql
-- Change Log:
-- - 2026-09-01: Create ai_prompt_types master table, seed 7 prompt types, add FK to ai_prompts,
--   and rename ai_suggested_category → ai_suggested_correspondence_type (Feature 251)

-- 1. สร้างตาราง ai_prompt_types (FR-001)
CREATE TABLE IF NOT EXISTS ai_prompt_types (
  id INT AUTO_INCREMENT PRIMARY KEY,
  public_id UUID NOT NULL UNIQUE,
  prompt_type VARCHAR(50) NOT NULL UNIQUE,
  display_name VARCHAR(255) NOT NULL,
  description TEXT NULL,
  expected_placeholders JSON NULL,
  is_system_managed TINYINT(1) NOT NULL DEFAULT 1,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_prompt_type (prompt_type)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = 'ตาราง master สำหรับประเภท AI prompt (ADR-029 + Feature 251)';

-- 2. Seed 7 known prompt types (FR-002)
INSERT INTO ai_prompt_types (public_id, prompt_type, display_name, description, expected_placeholders, is_system_managed, is_active)
SELECT UUID(),
       'ocr_system',
       'คำสั่งระบบ OCR',
       'System prompt สำหรับ np-dms-ocr (step 1) — ผลิต OCR text เท่านั้น',
       CAST('[]' AS JSON),
       1,
       1
WHERE NOT EXISTS (SELECT 1 FROM ai_prompt_types WHERE prompt_type = 'ocr_system');

INSERT INTO ai_prompt_types (public_id, prompt_type, display_name, description, expected_placeholders, is_system_managed, is_active)
SELECT UUID(),
       'ocr_extraction',
       'สกัด Metadata จาก OCR',
       'LLM metadata extraction prompt (step 2) — ใช้ ocr_text, allowed_correspondence_types, existing_tags, master_data_context',
       CAST('["ocr_text","allowed_correspondence_types","existing_tags","master_data_context"]' AS JSON),
       1,
       1
WHERE NOT EXISTS (SELECT 1 FROM ai_prompt_types WHERE prompt_type = 'ocr_extraction');

INSERT INTO ai_prompt_types (public_id, prompt_type, display_name, description, expected_placeholders, is_system_managed, is_active)
SELECT UUID(),
       'migration_compare',
       'เปรียบเทียบทะเบียนเอกสาร',
       'เปรียบเทียบข้อมูลทะเบียนเอกสารกับ OCR text',
       CAST('["ocr_text","excel_metadata","ocr_truncated"]' AS JSON),
       1,
       1
WHERE NOT EXISTS (SELECT 1 FROM ai_prompt_types WHERE prompt_type = 'migration_compare');

INSERT INTO ai_prompt_types (public_id, prompt_type, display_name, description, expected_placeholders, is_system_managed, is_active)
SELECT UUID(),
       'rag_prep_prompt',
       'เตรียมข้อมูล RAG',
       'RAG prep prompt — ประมวลผล text',
       CAST('["text"]' AS JSON),
       1,
       1
WHERE NOT EXISTS (SELECT 1 FROM ai_prompt_types WHERE prompt_type = 'rag_prep_prompt');

INSERT INTO ai_prompt_types (public_id, prompt_type, display_name, description, expected_placeholders, is_system_managed, is_active)
SELECT UUID(),
       'rag_query_prompt',
       'ค้นหาข้อมูล RAG',
       'RAG query prompt — ใช้ query และ context',
       CAST('["query","context"]' AS JSON),
       1,
       1
WHERE NOT EXISTS (SELECT 1 FROM ai_prompt_types WHERE prompt_type = 'rag_query_prompt');

INSERT INTO ai_prompt_types (public_id, prompt_type, display_name, description, expected_placeholders, is_system_managed, is_active)
SELECT UUID(),
       'rag_chunking',
       'แบ่งข้อความ RAG',
       'Semantic chunking prompt — แบ่ง text โดยใช้ np-dms-ai',
       CAST('["text"]' AS JSON),
       1,
       1
WHERE NOT EXISTS (SELECT 1 FROM ai_prompt_types WHERE prompt_type = 'rag_chunking');

INSERT INTO ai_prompt_types (public_id, prompt_type, display_name, description, expected_placeholders, is_system_managed, is_active)
SELECT UUID(),
       'classification_prompt',
       'จำแนกประเภทเอกสาร',
       'Document classification prompt — ใช้ document_text',
       CAST('["document_text"]' AS JSON),
       1,
       1
WHERE NOT EXISTS (SELECT 1 FROM ai_prompt_types WHERE prompt_type = 'classification_prompt');

-- 3. เพิ่ม FK จาก ai_prompts.prompt_type ไป ai_prompt_types.prompt_type (FR-001, FR-012)
ALTER TABLE ai_prompts
  ADD CONSTRAINT ai_prompts_fk_type
  FOREIGN KEY (prompt_type) REFERENCES ai_prompt_types(prompt_type)
  ON DELETE RESTRICT;

-- 4. เปลี่ยนชื่อคอลัมน์ ai_suggested_category → ai_suggested_correspondence_type (FR-007)
ALTER TABLE migration_review_queue
  CHANGE COLUMN ai_suggested_category ai_suggested_correspondence_type VARCHAR(50) NULL
  COMMENT 'Correspondence Type ที่ AI แนะนำ (correspondence_types.typeCode)';
