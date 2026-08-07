-- File: specs/03-Data-and-Storage/deltas/2026-08-06-migration-multi-attachment-and-compare.sql
-- Change Log:
-- - 2026-08-06: Initial delta for Migration AI Pipeline Refactor (Feature 242)
-- Description:
--   1. ALTER TABLE migration_review_queue ADD COLUMN temp_attachment_ids JSON NULL
--   2. ALTER TABLE migration_review_queue ADD COLUMN compare_status ENUM('COMPARED','UNAVAILABLE') NOT NULL DEFAULT 'COMPARED'
--   3. ALTER TABLE migration_review_queue ADD COLUMN compare_unavailable_reason VARCHAR(500) NULL
--   4. CREATE INDEX idx_migration_review_compare_status ON migration_review_queue (compare_status, status, created_at)
--   5. INSERT ai_prompts row for migration_compare prompt type (ADR-029)
--   6. INSERT system_settings rows for MIGRATION_MAX_MISMATCH_FIELDS and MIGRATION_MIN_CONFIDENCE
-- อ้างอิง: ADR-009 (schema delta ไม่ใช้ TypeORM migration), ADR-028 (migration architecture),
--          ADR-029 (prompt templates ใน ai_prompts), FR-001/FR-002 (multi-attachment), FR-010 (thresholds)
-- 1. เพิ่มคอลัมน์ temp_attachment_ids เก็บรายการ attachment id หลายไฟล์ (FR-001, FR-002)
--    element [0] คือเอกสารหลัก (is_main_document=1); temp_attachment_id เดิมยังคงไว้เพื่อ backward compatibility (R4)
ALTER TABLE migration_review_queue
ADD COLUMN temp_attachment_ids JSON NULL COMMENT 'รายการ internal attachment IDs หลายไฟล์; element [0] คือเอกสารหลัก (FR-001, FR-002)';

-- 1a. เพิ่มคอลัมน์ ai_metadata_json เก็บ compareResult, capturedThresholds, attachments[] (FR-005, FR-007, FR-010c)
ALTER TABLE migration_review_queue
ADD COLUMN ai_metadata_json JSON NULL COMMENT 'JSON metadata: compareResult, capturedThresholds, attachments[] (FR-005, FR-007, FR-010c)';

-- 2. เพิ่มคอลัมน์ compare_status ระบุสถานะการเปรียบเทียบทะเบียนกับเอกสารจริง (FR-012a)
ALTER TABLE migration_review_queue
ADD COLUMN compare_status ENUM('COMPARED', 'UNAVAILABLE') NOT NULL DEFAULT 'COMPARED' COMMENT 'สถานะการเปรียบเทียบทะเบียนกับเอกสารจริง (FR-012a)';

-- 3. เพิ่มคอลัมน์ compare_unavailable_reason เก็บเหตุผลภาษาไทยเมื่อเปรียบเทียบไม่ได้ (FR-012b)
ALTER TABLE migration_review_queue
ADD COLUMN compare_unavailable_reason VARCHAR(500) NULL COMMENT 'เหตุผลภาษาไทยเมื่อ compare_status = UNAVAILABLE (FR-012b)';

-- 4. สร้าง composite index สำหรับ filter ตาม compare_status + status + created_at (FR-012d, R3)
CREATE INDEX idx_migration_review_compare_status ON migration_review_queue (compare_status, STATUS, created_at);

-- 5. Seed migration_compare prompt ใน ai_prompts (ADR-029, FR-006, FR-007, FR-008)
--    template มี placeholders: {{ocr_text}}, {{excel_metadata}}, {{ocr_truncated}}
--    context_config = NULL เพราะไม่ต้องการ master_data_context (R1)
INSERT INTO ai_prompts (
    public_id,
    prompt_type,
    version_number,
    template,
    field_schema,
    context_config,
    is_active,
    created_by,
    created_at,
    activated_at
  )
SELECT UUID(),
  'migration_compare',
  1,
  'คุณคือผู้ตรวจสอบความถูกต้องของทะเบียนเอกสาร หน้าที่ของคุณคือเปรียบเทียบข้อมูลในทะเบียนเอกสาร
กับข้อความที่อ่านได้จากไฟล์เอกสารจริง แล้วรายงานว่าแต่ละช่องตรงกันหรือไม่

ข้อกำหนดสำคัญ:
1. ทะเบียนเอกสารเป็นข้อมูลอ้างอิงหลัก — ห้ามเสนอค่าใหม่มาแทน
2. รายงานเฉพาะผลการเปรียบเทียบ ห้ามสกัดข้อมูลขึ้นมาใหม่จากเอกสาร
3. หากหาค่าของช่องใดในเอกสารไม่พบ ให้ตั้ง foundInDocument = false และ ocrValue = null
   โดยตั้ง match = false — ห้ามเดาค่า
4. ถ้า ocr_truncated = true หมายความว่าข้อความจากเอกสารไม่ครบทั้งฉบับ
   ช่องที่หาไม่พบอาจอยู่ในส่วนที่ถูกตัดออก ให้ตั้ง foundInDocument = false
   แทนการรายงานว่าไม่ตรงกัน
5. การเปรียบเทียบต้องยืดหยุ่นตามรูปแบบ:
   - วันที่: 14/03/2019, 14 มี.ค. 2562, และ 2019-03-14 ถือว่าตรงกัน (พ.ศ. = ค.ศ. + 543)
   - หน่วยงาน: ตัวย่อกับชื่อเต็มที่หมายถึงหน่วยงานเดียวกันถือว่าตรงกัน
   - เลขที่เอกสาร: ต่างกันแค่ตัวคั่นหรือช่องว่างถือว่าตรงกัน
   - หัวเรื่อง: ต่างกันแค่เครื่องหมายวรรคตอนหรือช่องว่างถือว่าตรงกัน
     แต่ถ้าเนื้อความต่างกันถือว่าไม่ตรงกัน
6. ตอบเป็น JSON เท่านั้น ห้ามมีข้อความอื่นนอก JSON

ข้อความที่ถูกตัดทอน: {{ocr_truncated}}

ข้อมูลจากทะเบียนเอกสาร:
{{excel_metadata}}

ข้อความที่อ่านได้จากไฟล์เอกสาร:
{{ocr_text}}

ตอบตามโครงสร้าง JSON นี้:
{
  "fieldResults": [
    {
      "field": "<ชื่อช่อง>",
      "excelValue": "<ค่าจากทะเบียน หรือ null>",
      "ocrValue": "<ค่าที่พบในเอกสาร หรือ null>",
      "match": <true|false>,
      "foundInDocument": <true|false>
    }
  ],
  "mismatches": ["<ชื่อช่องที่ไม่ตรงกัน>"],
  "confidence": <0.0-1.0>
}',
  JSON_OBJECT(
    'type',
    'object',
    'required',
    JSON_ARRAY('fieldResults', 'mismatches', 'confidence'),
    'properties',
    JSON_OBJECT(
      'fieldResults',
      JSON_OBJECT(
        'type',
        'array',
        'items',
        JSON_OBJECT(
          'type',
          'object',
          'required',
          JSON_ARRAY(
            'field',
            'excelValue',
            'ocrValue',
            'match',
            'foundInDocument'
          ),
          'properties',
          JSON_OBJECT(
            'field',
            JSON_OBJECT(
              'type',
              'string',
              'enum',
              JSON_ARRAY(
                'documentNumber',
                'subject',
                'documentDate',
                'fromOrganization',
                'toOrganization',
                'correspondenceType',
                'discipline',
                'project',
                'revision'
              )
            ),
            'excelValue',
            JSON_OBJECT('type', JSON_ARRAY('string', 'null')),
            'ocrValue',
            JSON_OBJECT('type', JSON_ARRAY('string', 'null')),
            'match',
            JSON_OBJECT('type', 'boolean'),
            'foundInDocument',
            JSON_OBJECT('type', 'boolean')
          )
        )
      ),
      'mismatches',
      JSON_OBJECT(
        'type',
        'array',
        'items',
        JSON_OBJECT('type', 'string')
      ),
      'confidence',
      JSON_OBJECT('type', 'number', 'minimum', 0, 'maximum', 1)
    )
  ),
  NULL,
  1,
  1,
  NOW(),
  NOW()
FROM DUAL
WHERE NOT EXISTS (
    SELECT 1
    FROM ai_prompts
    WHERE prompt_type = 'migration_compare'
      AND version_number = 1
  );

-- 6. Seed system_settings สำหรับ review thresholds (FR-010, R2)
--    MIGRATION_MAX_MISMATCH_FIELDS: ค่าเริ่มต้น 3 (รักษาพฤติกรรมการผลิตปัจจุบัน)
INSERT INTO system_settings (
    setting_key,
    setting_value,
    data_type,
    category,
    is_public,
    is_encrypted,
    validation_rules,
    description,
    updated_by,
    created_at,
    updated_at
  )
SELECT 'MIGRATION_MAX_MISMATCH_FIELDS',
  '3',
  'number',
  'migration',
  0,
  0,
  JSON_OBJECT('min', 0, 'max', 9),
  'จำนวนช่องที่ไม่ตรงกันสูงสุดที่ยอมให้ยืนยันได้โดยไม่ต้องตรวจสอบด้วยมือ (FR-010b)',
  1,
  NOW(),
  NOW()
FROM DUAL
WHERE NOT EXISTS (
    SELECT 1
    FROM system_settings
    WHERE setting_key = 'MIGRATION_MAX_MISMATCH_FIELDS'
  );

--    MIGRATION_MIN_CONFIDENCE: ค่าเริ่มต้น 0.6 (รักษาพฤติกรรมการผลิตปัจจุบัน — ai-batch.processor.ts line ~1343)
INSERT INTO system_settings (
    setting_key,
    setting_value,
    data_type,
    category,
    is_public,
    is_encrypted,
    validation_rules,
    description,
    updated_by,
    created_at,
    updated_at
  )
SELECT 'MIGRATION_MIN_CONFIDENCE',
  '0.6',
  'number',
  'migration',
  0,
  0,
  JSON_OBJECT('min', 0, 'max', 1),
  'ค่าความมั่นใจขั้นต่ำของการเปรียบเทียบ ถ้าต่ำกว่านี้ต้องตรวจสอบด้วยมือ (FR-010b)',
  1,
  NOW(),
  NOW()
FROM DUAL
WHERE NOT EXISTS (
    SELECT 1
    FROM system_settings
    WHERE setting_key = 'MIGRATION_MIN_CONFIDENCE'
  );

-- 7. Seed MIGRATION_RESOLVE_BATCH_TIMEOUT_MS สำหรับ runtime guard (Complexity Tracking deviation)
INSERT INTO system_settings (
    setting_key,
    setting_value,
    data_type,
    category,
    is_public,
    is_encrypted,
    validation_rules,
    description,
    updated_by,
    created_at,
    updated_at
  )
SELECT 'MIGRATION_RESOLVE_BATCH_TIMEOUT_MS',
  '30000',
  'number',
  'migration',
  0,
  0,
  JSON_OBJECT('min', 5000, 'max', 120000),
  'ระยะเวลาสูงสุด (ms) สำหรับ resolve-batch ก่อนแนะนำให้ย้ายไป ai-batch queue',
  1,
  NOW(),
  NOW()
FROM DUAL
WHERE NOT EXISTS (
    SELECT 1
    FROM system_settings
    WHERE setting_key = 'MIGRATION_RESOLVE_BATCH_TIMEOUT_MS'
  );
