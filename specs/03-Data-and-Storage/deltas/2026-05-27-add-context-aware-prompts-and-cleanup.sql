-- Delta: Add context_config & publicId to ai_prompts & Clean up CC whitespace typo
-- Date: 2026-05-27
-- Related ADR: ADR-030, ADR-019
-- Applied in: v1.9.7 -> main
-- ------------------------------------------------------------
-- 1. ล้าง whitespace typo 'CC ' ในตารางผู้รับเอกสาร
-- อัปเดตข้อมูลเก่าให้เรียบร้อยก่อนเพื่อไม่ให้เกิดข้อผิดพลาดในการเปลี่ยน Schema
UPDATE correspondence_recipients
SET recipient_type = 'CC'
WHERE recipient_type = 'CC ';

-- แก้ไขประเภทคอลัมน์ของ correspondence_recipients ตัดช่องว่างออก
ALTER TABLE correspondence_recipients
MODIFY COLUMN recipient_type ENUM('TO', 'CC') NOT NULL COMMENT 'ประเภทผู้รับ (TO หรือ CC)';

-- 2. เพิ่มคอลัมน์ publicId (UUID) ใน ai_prompts ตาม ADR-019
ALTER TABLE ai_prompts
ADD COLUMN public_id UUID NULL UNIQUE COMMENT 'Public UUID สำหรับ API exposure (ADR-019)';

-- สร้าง UUID สำหรับ records ที่มีอยู่เดิม
UPDATE ai_prompts
SET public_id = UUID()
WHERE public_id IS NULL;

-- ตั้งค่า publicId เป็น NOT NULL หลังจาก populate ข้อมูลเดิม
ALTER TABLE ai_prompts
MODIFY COLUMN public_id UUID NOT NULL UNIQUE COMMENT 'Public UUID สำหรับ API exposure (ADR-019)';

-- 3. เพิ่มคอลัมน์ context_config JSON ใน ai_prompts
ALTER TABLE ai_prompts
ADD COLUMN context_config JSON NULL COMMENT 'Configuration สำหรับ context ที่ backend ต้องส่งให้ AI (filter, pageSize, language, etc.)';

-- 4. อัปเดต Seed Prompt Version 2 (ภาษาไทย พร้อม Context-Aware layout)
-- ปิดใช้งานเวอร์ชัน 1
UPDATE ai_prompts
SET is_active = 0
WHERE prompt_type = 'ocr_extraction'
  AND version_number = 1;

-- แทรก Prompt Version 2 (ภาษาไทย) เข้าสู่ตาราง ai_prompts
INSERT INTO ai_prompts (
    prompt_type,
    version_number,
    template,
    field_schema,
    is_active,
    context_config,
    manual_note,
    activated_at,
    created_by
  )
VALUES (
    'ocr_extraction',
    2,
    'คุณคือเอนจิ้นสกัดข้อมูลอัจฉริยะ (Document Intelligence Engine)
วิเคราะห์ข้อความ OCR ที่ได้รับจากเอกสารของโครงการ Laem Chabang Port Phase 3 และสกัดข้อมูลเมตาดาต้าให้ออกมาเป็น JSON object ที่ถูกต้องตามโครงสร้างที่กำหนด

ข้อความ OCR ที่สกัดได้:
{{ocr_text}}

ข้อมูลอ้างอิงของระบบ (Master Data Context):
{{master_data_context}}

กฎการสกัดข้อมูล:
1. วิเคราะห์และจับคู่ข้อมูลจากข้อความ OCR กับข้อมูลอ้างอิงที่ระบุใน Master Data Context เสมอ
2. สำหรับโครงการ (project) ให้ค้นหาและสกัดส่งกลับเป็น UUID ของโครงการ (projectPublicId)
3. สำหรับประเภทเอกสารโต้ตอบ (correspondence type) ให้สกัดรหัสส่งกลับมา (correspondenceTypeCode) เช่น RFA, Transmittal
4. สำหรับสาขางาน (discipline) ให้ส่งคืนรหัสส่งกลับมา (disciplineCode) เช่น GEN, STR
5. สำหรับหน่วยงานผู้ส่ง (originator) ค้นหาจาก availableOrganizations และส่งกลับมาเป็น UUID (originatorOrganizationPublicId)
6. สำหรับหน่วยงานผู้รับ (recipients) ให้ส่งกลับมาเป็นรายการ Array ของออบเจกต์ ซึ่งมี UUID ขององค์กร (organizationPublicId) และประเภทผู้รับ (recipientType: "TO" หรือ "CC") เสมอ
7. สำหรับหัวข้อเอกสาร (subject) ให้สกัดหัวข้อหรือชื่อเรื่องของเอกสารภาษาไทยหรือภาษาอังกฤษ
8. วันที่ของเอกสาร (documentDate) ให้ส่งคืนในรูปแบบ YYYY-MM-DD
9. รายการแท็ก (tags) สกัดคำสำคัญหรือคำแนะนำ Tags (สอดคล้องกับ availableTags หากมี)
10. สรุปความเนื้อหา (summary) เขียนสรุปรายละเอียดเอกสารสั้นกระชับ 4-5 ประโยคเป็นภาษาไทยอย่างสละสลวย
11. confidence: ค่าความมั่นใจในการสกัดข้อมูลนี้ (ทศนิยมระหว่าง 0.0 ถึง 1.0)

ส่งคืนคำตอบเฉพาะ JSON Object ที่ถูกต้องเท่านั้น ห้ามใส่บล็อกโค้ด markdown หรือคำอธิบายเพิ่มเติมใดๆ
โครงสร้าง JSON ผลลัพธ์:
{
  "projectPublicId": "string หรือ null",
  "correspondenceTypeCode": "string หรือ null",
  "disciplineCode": "string หรือ null",
  "originatorOrganizationPublicId": "string หรือ null",
  "recipients": [
    {
      "organizationPublicId": "string",
      "recipientType": "TO หรือ CC"
    }
  ],
  "subject": "string หรือ null",
  "documentDate": "string:YYYY-MM-DD หรือ null",
  "tags": ["string"],
  "summary": "string หรือ null",
  "confidence": 0.95
}',
    '{"projectPublicId":"string|null","correspondenceTypeCode":"string|null","disciplineCode":"string|null","originatorOrganizationPublicId":"string|null","recipients":"array:object(organizationPublicId:string|null,recipientType:string|null)","subject":"string|null","documentDate":"date:YYYY-MM-DD|null","tags":"string[]","summary":"string|null","confidence":"float:0-1"}',
    1,
    '{"filter":null,"pageSize":3,"language":"th","outputLanguage":"th"}',
    'Seed Prompt ภาษาไทย เวอร์ชัน 2 รองรับ Context-Aware และการล้าง Typo CC (ADR-030)',
    CURRENT_TIMESTAMP,
    (
      SELECT user_id
      FROM users
      WHERE username = 'superadmin'
      LIMIT 1
    )
  ) ON DUPLICATE KEY
UPDATE prompt_type = prompt_type;
