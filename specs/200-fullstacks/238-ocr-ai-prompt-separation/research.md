# Research Findings: OCR & AI Extraction Prompt Management

**Date**: 2026-06-17
**Feature**: 238-ocr-ai-prompt-separation

## Research Areas

### 1. Concurrent Edit Handling Strategy

**Decision**: ใช้ optimistic locking ด้วย version/timestamp field ใน ai_prompts table

**Rationale**:
- ลด lock contention ใน database - ไม่ block admin คนอื่น
- User experience ดีกว่า - แจ้งเตือนแทนการ block
- ง่ายต่อการ implement กับ TypeORM @VersionColumn
- สอดคล้องกับ pattern ที่ใช้ใน LCBP3-DMS อยู่แล้ว (ADR-002 document numbering)

**Alternatives considered**:
- **Pessimistic locking (SELECT FOR UPDATE)**: ไม่เลือกเพราะอาจ block admin คนอื่นนาน, ไม่เหมาะกับ admin UI
- **Last-write-wins**: ไม่เลือกเพราะเสี่ยงสูญเสียการแก้ไขของ admin คนแรกโดยไม่รู้ตัว
- **Operational Transform (like Google Docs)**: ไม่เลือกเพราะ complex เกินความจำเป็น, prompt editing ไม่ต้องการ real-time collaboration

**⚠️ สถานะของจริง (codebase ปัจจุบัน)**:
- `@VersionColumn({ name: 'version' })` ถูกเพิ่มใน entity **แล้ว** (delta 2026-06-15) — คอลัมน์ DB มีแล้ว
- แต่ `activate()` ของจริง **ใช้ pessimistic_write lock** ใน transaction และ **ไม่รับ `expectedVersion`** จึงยังไม่มี HTTP 409 flow
- `@VersionColumn` ปัจจุบันทำงานตอน `save()` เท่านั้น (ดัก lost update ระหว่าง read→write)

**ถ้าจะทำ flow optimistic 409 ตาม spec ต้องแก้เพิ่ม**:
- แก้ signature `activate(promptType, versionNumber, userId, expectedVersion)` ให้รับ `expectedVersion`
- เทียบ `version` ก่อน save → ถ้าไม่ตรงโยน BusinessException/409 พร้อม current data
- หมายเหตุ: อ้าง ADR-002 จริงๆใช้ Redlock/pessimistic — คำว่า "สอดคล้อง pattern ADR-002" ใน rationale จึงคลาดเคลื่อน

### 2. Sidecar System Prompt Parameter Format

**Decision**: Sidecar รับ systemPrompt ผ่าน multipart/form-data field 'systemPrompt'

**Rationale**:
- สอดคล้องกับรูปแบบที่ sidecar รับ file upload อยู่แล้ว
- ไม่ต้องเปลี่ยน content-type หรือ endpoint structure
- ง่ายต่อการ integrate กับ existing form data

**Alternatives considered**:
- **JSON payload with base64 PDF**: ไม่เลือกเพราะต้องเปลี่ยน endpoint structure มาก, file size limit ของ JSON
- **Separate endpoint**: ไม่เลือกเพราะซับซ้อนเกินไป, ควรรวมอยู่ใน /ocr-upload

**✅ ยืนยันแล้ว (จาก app.py จริง)**: OCR engine ใช้ `prepare_ocr_messages(pdf_path, task_type="structure", page_num=N)` จาก typhoon_ocr ซึ่งคืน messages array ที่มี **user message เดียว** โดย `messages[0]["content"]` เป็น list (image + prompt). โค้ดปัจจุบันที่ `process_ocr()` (app.py:194-203) **inject ข้อความเพิ่มได้สำเร็จอยู่แล้ว** ด้วยการ `messages[0]["content"].append({"type": "text", "text": ...})` (DMS tags) → ใช้ pattern เดียวกันนี้กับ systemPrompt ได้ทันที

**Decision (ปรับให้ตรงของจริง)**: inject systemPrompt ด้วยการ **append text item เข้า `messages[0]["content"]`** — **ไม่** insert `{"role":"system"}` แยก (typhoon OCR เป็น single-message format; system role แยกยังไม่พิสูจน์ และเสี่ยงกระทบ structured extraction)

**Implementation approach (ยืนยันตาม app.py)**:
```python
# process_ocr() — เพิ่มพารามิเตอร์ system_prompt และ append ก่อน DMS tags
def process_ocr(pdf_path, page_num=1, options_override={}, system_prompt: Optional[str] = None) -> str:
    messages = prepare_ocr_messages(pdf_path, task_type="structure", page_num=page_num)
    if system_prompt:
        messages[0]["content"].append({"type": "text", "text": system_prompt})
    # DMS tags injection เดิม (ยังคงไว้)
    messages[0]["content"].append({"type": "text", "text": "Additionally: ..."})
    # ...payload เดิม → /v1/chat/completions

# /ocr-upload — รับ systemPrompt แล้วส่งต่อ (ต้อง X-API-Key)
@app.post("/ocr-upload", dependencies=[Depends(get_api_key)])
def ocr_upload(file=File(...), engine=Form("auto"), systemPrompt: Optional[str] = Form(None), ...):
    # ต้อง thread systemPrompt → _process_pdf_doc(...) → process_ocr(..., system_prompt=systemPrompt)
    ...
```

> หมายเหตุ: ต้อง thread `systemPrompt` ผ่าน `_process_pdf_doc()` (เพิ่มพารามิเตอร์) ไปยัง `process_ocr()` ด้วย เพราะปัจจุบัน `_process_pdf_doc` ไม่รับ systemPrompt

### 3. Default OCR System Prompt Content

**Decision**: ใช้ hardcoded default minimal system prompt

**Content**: "Extract all text from this PDF page accurately."

**Rationale**:
- Simple and language-agnostic
- ทำงานได้กับทุกประเภทเอกสาร (Thai/English/mixed)
- ไม่มี bias ต่อ specific document type
- Vision model (np-dms-ocr) ถูกฝึกมาให้เข้าใจ instruction แบบนี้อยู่แล้ว

**Alternatives considered**:
- **No default (fail fast)**: ไม่เลือกเพราะจะทำให้ OCR ใช้ไม่ได้ถ้าลืมสร้าง prompt หรือ database error
- **Complex multi-language prompt**: ไม่เลือกเพราะอาจทำให้ model confused, minimal prompt มีประสิทธิภาพดีกว่า
- **Template with placeholders**: ไม่เลือกเพราะ OCR system prompt ไม่มี context อื่นให้ inject

### 4. Placeholder Validation for AI Extraction Prompt

**Decision**: ตรวจสอบ required placeholders ตอน save (backend validation)

**Required placeholders**:
- `{{ocr_text}}` - mandatory (OCR text to extract from)
- `{{master_data_context}}` - optional (project/contract context)

**Rationale**:
- ป้องกัน runtime error เมื่อ prompt ถูกใช้
- ให้ admin รู้ทันทีว่า template ไม่ถูกต้อง
- สอดคล้องกับ ADR-007 error handling strategy

**Validation approach**:
```typescript
validateTemplate(template: string, promptType: string): ValidationResult {
  if (promptType === 'ocr_extraction') {
    if (!template.includes('{{ocr_text}}')) {
      return { valid: false, error: 'Template must include {{ocr_text}} placeholder' };
    }
  }
  // ocr_system has no required placeholders
  return { valid: true };
}
```

### 5. AI Prompts Table Schema Compatibility

**Decision**: ใช้ schema ที่มีอยู่แล้วจาก ADR-029, เพิ่มแค่ @VersionColumn

**Existing fields (sufficient)**:
- `prompt_type` (string): รองรับ 'ocr_system', 'ocr_extraction'
- `version_number` (int): Version tracking
- `template` (text): Prompt content
- `context_config` (json): Metadata
- `is_active` (tinyint(1)): Active flag (MariaDB ส่งกลับเป็น 0/1)
- `created_at` (datetime): Timestamp
- `created_by` (int FK → users.user_id): Creator — ไม่ใช่ created_by_public_id

**คอลัมน์จริงที่ต้องระวัง**:
- `version` (int, @VersionColumn): **มีอยู่แล้ว** (delta `2026-06-15-fix-ai-prompts-columns.sql`)
- `created_by` เป็น **INT FK → users(user_id)** — ไม่ใช่ `created_by_public_id`; seed ต้องใช้ `(SELECT user_id FROM users WHERE username='superadmin')`

**SQL delta (idempotent — version มีแล้ว)**:
```sql
ALTER TABLE ai_prompts ADD COLUMN IF NOT EXISTS `version` INT NOT NULL DEFAULT 1;
```

## Summary

ทุก research area มีทางเลือกที่ชัดเจนและสอดคล้องกับ:
1. LCBP3-DMS patterns (optimistic locking, backend validation)
2. ADR-007 error handling strategy
3. ADR-029 dynamic prompt management
4. ADR-037 unified prompt management UX

ไม่มี technical blockers พร้อม proceed ไป Phase 1 design
