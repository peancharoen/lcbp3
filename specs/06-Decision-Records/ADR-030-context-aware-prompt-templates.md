# ADR-030: Context-Aware Prompt Templates for OCR Metadata Extraction

**Status:** Accepted
**Date:** 2026-05-27
**Decision Makers:** Development Team, System Architect
**Related Documents:**
- [ADR-029: Dynamic Prompt Management](./ADR-029-dynamic-prompt-management.md)
- [ADR-023A: Unified AI Architecture — Model Revision](./ADR-023A-unified-ai-architecture.md)
- [ADR-019: Hybrid Identifier Strategy](./ADR-019-hybrid-identifier-strategy.md)
- [ADR-007: Error Handling Strategy](./ADR-007-error-handling-strategy.md)

---

## บริบทและปัญหา (Context and Problem Statement)

ADR-029 แก้ปัญหา hardcoded prompt โดยเก็บ prompt template ในตาราง `ai_prompts` แต่ยังมีข้อจำกัด:

1. **ไม่มี Context Awareness:** Prompt template ไม่สามารถระบุ master data context (projects, organizations, disciplines, etc.) ที่ AI ต้องใช้ในการ match ข้อมูล
2. **Context Size ไม่ถูกควบคุม:** ไม่มีกลไก filter master data ตาม project/contract scope ทำให้ context ใหญ่เกินไป
3. **Language Hardcoded:** Prompt template เดิมใช้ภาษาอังกฤษ แต่ LCBP3-DMS เป็นระบบภาษาไทย
4. **Output Schema ไม่ครบ:** สกัดเฉพาะ 8 fields แต่ยังขาด fields สำคัญสำหรับ correspondence creation (เช่น recipient organizations, UUID matching)

---

## ปัจัยขับเคลื่อนการตัดสินใจ (Decision Drivers)

- **Context Filtering:** ต้อง filter master data ตาม project/contract scope เพื่อลด context size และป้องกัน cross-project data leak (ADR-023A)
- **UUID Matching:** AI ต้องส่งคืน UUID (ไม่ใช่ INT ID) ตาม ADR-019
- **Thai Language Support:** Prompt และ output ต้องเป็นภาษาไทย
- **Flexible Configuration:** Admin ต้องกำหนด filter criteria และ context config ได้ผ่าน AI Admin Console
- **Backward Compatibility:** ต้องรองรับ prompt template เดิมที่ไม่มี context_config

---

## ทางเลือกที่ถูกพิจารณา (Considered Options)

### Option 1: เพิ่มคอลัมน์แยกต่างหาก (project_id, contract_id)
- **ข้อดี:** Query ง่าย, type-safe
- **ข้อเสีย:** ไม่ flexible, ถ้าอนาคตต้องการ filter criteria อื่นต้อง alter table อีก

### Option 2: เก็บ filter criteria ใน field_schema (JSON)
- **ข้อดี:** ไม่ต้อง alter table
- **ข้อเสีย:** ผสม output schema กับ filter config, สับสน, query ซับซ้อน

### Option 3: เพิ่ม context_config JSON column (ตัวเลือกที่ได้รับเลือก)
- **ข้อดี:** Flexible, แยก concern ชัด (field_schema vs context_config), รองรับ config อนาคต
- **ข้อเสีย:** ต้อง alter table ครั้งเดียว

---

## ผลการตัดสินใจ (Decision Outcome)

**ทางเลือกที่ได้รับเลือก:** Option 3 — เพิ่ม `context_config` JSON column

---

## ข้อตกลงหลัก (Core Decisions — Grilling Session 2026-05-27)

| # | ประเด็น | การตัดสินใจ |
|---|---------|-------------|
| 1 | Page Limit | **3 หน้า** (ตาม ADR-023A — classification/tagging rule) |
| 2 | Database Query Strategy | **Option A** — Backend ดึง master data แล้วส่งเป็น context ใน prompt (AI ไม่ query DB โดยตรงตาม ADR-023) |
| 3 | JSON Output Schema | **11 fields**: projectPublicId, correspondenceTypeCode, disciplineCode, originatorOrganizationPublicId, recipientOrganizationPublicIds, recipientTypes, subject, documentDate, tags, summary, confidence |
| 4 | Context Format | **Option A** — List format (array of objects) สำหรับ AI scan ง่าย |
| 5 | Filter Strategy | กำหนดใน prompt template โดย filter ด้วย projects และ contracts |
| 6 | Filter Storage | **Option C** — เพิ่ม `context_config` JSON column |
| 7 | Language | **ภาษาไทย** — Prompt instruction และ summary output |
| 8 | UUID Handling | **ADR-019** — AI ส่งคืน UUID string (ไม่ใช่ INT ID) |
| 9 | Fallback Strategy | ถ้า AI ไม่พบ match → ส่ง `null` และต้องการ human validation |

---

## รายละเอียดเชิงสถาปัตยกรรม (Implementation Details)

### 1. Schema Changes (ADR-009)

```sql
-- Delta: เพิ่ม context_config สำหรับ filter criteria
ALTER TABLE ai_prompts 
ADD COLUMN context_config JSON NULL 
COMMENT 'Configuration สำหรับ context ที่ backend ต้องส่งให้ AI (filter, pageSize, language, etc.)';
```

### 2. context_config Structure

```json
{
  "filter": {
    "projectId": 123,
    "contractId": 456
  },
  "pageSize": 3,
  "language": "th",
  "outputLanguage": "th"
}
```

**Field Descriptions:**
- `filter.projectId`: INT หรือ null — Filter master data ตาม project scope
- `filter.contractId`: INT หรือ null — Filter master data ตาม contract scope
- `pageSize`: INT (default: 3) — จำนวนหน้า PDF ที่ OCR สกัด (ตาม ADR-023A)
- `language`: string (default: "th") — ภาษา prompt instruction
- `outputLanguage`: string (default: "th") — ภาษา output (summary)

### 3. JSON Output Schema (field_schema)

```json
{
  "projectPublicId": "string|null",
  "correspondenceTypeCode": "string|null",
  "disciplineCode": "string|null",
  "originatorOrganizationPublicId": "string|null",
  "recipientOrganizationPublicIds": "string[]|null",
  "recipientTypes": "string[]|null",
  "subject": "string|null",
  "documentDate": "string:YYYY-MM-DD|null",
  "tags": "string[]|null",
  "summary": "string|null",
  "confidence": "float:0-1"
}
```

**Mapping to Database:**
- `projectPublicId` → `projects.uuid` (ADR-019)
- `correspondenceTypeCode` → `correspondence_types.type_code`
- `disciplineCode` → `disciplines.discipline_code`
- `originatorOrganizationPublicId` → `organizations.uuid` (originator_id)
- `recipientOrganizationPublicIds` → `organizations.uuid[]` (correspondence_recipients)
- `recipientTypes` → `correspondence_recipients.recipient_type` ("TO", "CC ")
- `subject` → `correspondence_revisions.title`
- `documentDate` → `correspondence_revisions.document_date`
- `tags` → `tags.tag_name[]`
- `summary` — AI-generated summary (4-5 ประโยคภาษาไทย)
- `confidence` — AI confidence score (0.0-1.0)

### 4. Context Format (List Format)

Backend ส่ง master data context ในรูปแบบ:

```json
{
  "availableProjects": [
    {"code": "LCBP3", "uuid": "0195...", "name": "โครงการ LCBP3"}
  ],
  "availableOrganizations": [
    {"code": "กทท.", "uuid": "0195...", "name": "การทางพิเศษแห่งประเทศไทย"},
    {"code": "TEAM", "uuid": "0195...", "name": "TEAM Consulting"}
  ],
  "availableDisciplines": [
    {"code": "GEN", "name": "General"},
    {"code": "STR", "name": "Structural"}
  ],
  "availableCorrespondenceTypes": [
    {"code": "RFA", "name": "Request for Approval"},
    {"code": "RFI", "name": "Request for Information"}
  ],
  "availableTags": [
    {"name": "Urgent", "color": "red"},
    {"name": "Review", "color": "blue"}
  ]
}
```

### 5. Prompt Template Example (ภาษาไทย)

```
คุณเป็นเอนจิ้นสกัดข้อมูลเอกสารมืออาชีพ
วิเคราะห์ข้อความ OCR จากเอกสารโครงการ (3 หน้าแรกเท่านั้น) และสกัดข้อมูลเมตาดาต้า

ข้อความ OCR:
{{ocr_text}}

ข้อมูลอ้างอิงที่ใช้ได้:
{{master_data_context}}

สกัด fields ต่อไปนี้:
1. projectPublicId: UUID ของโครงการ (จาก availableProjects)
2. correspondenceTypeCode: รหัสประเภทเอกสาร (เช่น RFA, RFI)
3. disciplineCode: รหัสสาขางาน (เช่น GEN, STR)
4. originatorOrganizationPublicId: UUID ขององค์กรผู้ส่ง
5. recipientOrganizationPublicIds: UUID[] ขององค์กรผู้รับ (หลายองค์กรได้)
6. recipientTypes: string[] ("TO", "CC")
7. subject: หัวข้อเอกสาร
8. documentDate: วันที่เอกสาร (YYYY-MM-DD)
9. tags: string[] รายชื่อ tags
10. summary: สรุปเอกสาร 4-5 ประโยคภาษาไทย
11. confidence: ความมั่นใจ (0.0-1.0)

ส่งคืนเฉพาะ JSON object ที่ถูกต้อง ไม่รวม markdown code blocks
```

### 6. Backend Implementation

**AiPromptsService.resolveContext()**
```typescript
async resolveContext(activePrompt: AiPrompt): Promise<Record<string, unknown>> {
  const config = activePrompt.contextConfig || {};
  const filter = config.filter || {};
  
  const projectId = filter.projectId;
  const contractId = filter.contractId;
  
  // Query master data with filter
  const projects = await this.projectService.findAll({ projectId });
  const organizations = await this.organizationService.findAll({ projectId, contractId });
  const disciplines = await this.disciplineService.findAll({ contractId });
  const correspondenceTypes = await this.correspondenceTypeService.findAll();
  const tags = await this.tagsService.findAll({ projectId });
  
  return {
    availableProjects: projects.map(p => ({ code: p.projectCode, uuid: p.uuid, name: p.projectName })),
    availableOrganizations: organizations.map(o => ({ code: o.organizationCode, uuid: o.uuid, name: o.organizationName })),
    availableDisciplines: disciplines.map(d => ({ code: d.disciplineCode, name: d.codeNameTh })),
    availableCorrespondenceTypes: correspondenceTypes.map(t => ({ code: t.typeCode, name: t.typeName })),
    availableTags: tags.map(t => ({ name: t.tagName, color: t.colorCode })),
  };
}
```

**AiBatchProcessor.processSandboxExtract()**
```typescript
const activePrompt = await this.aiPromptsService.getActive('ocr_extraction');
const context = await this.aiPromptsService.resolveContext(activePrompt);

const prompt = activePrompt.template
  .replace('{{ocr_text}}', ocrText)
  .replace('{{master_data_context}}', JSON.stringify(context, null, 2));
```

### 7. Frontend Changes (AI Admin Console)

**Prompt Editor UI:**
- เพิ่ม section "Context Configuration"
- Dropdown เลือก Project (optional)
- Dropdown เลือก Contract (optional)
- Input field: Page Size (default: 3)
- Select: Language (th/en)

**n8n Workflow:**
- เพิ่ม node "Select Project/Contract" ก่อน "OCR Extraction"
- ส่ง `projectId` และ `contractId` ไปยัง DMS API `/ai/ocr-extract`
- Backend resolve context จาก context_config หรือ override ด้วย input parameters

---

## ผลกระทบ (Consequences)

### ผลดี
- Admin กำหนด filter criteria ได้ runtime ผ่าน AI Admin Console
- Context size ถูกควบคุม ตาม project/contract scope
- AI ส่งคืน UUID ตาม ADR-019 พร้อมนำเข้า
- Prompt และ output เป็นภาษาไทย
- Flexible สำหรับ config อนาคต (language, temperature, etc.)

### ผลเสีย / ข้อระวัง
- ต้อง alter table `ai_prompts` เพิ่ม `context_config` column
- Backend query master data เพิ่มขึ้นต่อ job (mitigate ด้วย Redis cache)
- ต้อง migrate prompt template เดิม (seed data) ให้มี context_config
- n8n workflow ต้องอัปเดตให้รองรับ filter criteria

---

## Migration Plan

### Phase 1: Database Schema
1. Run delta SQL: `ALTER TABLE ai_prompts ADD COLUMN context_config JSON NULL`
2. Update `AiPrompt` entity เพิ่ม `contextConfig` property
3. Update DTOs (CreateAiPromptDto, UpdateAiPromptDto)

### Phase 2: Backend Logic
1. Implement `AiPromptsService.resolveContext()`
2. Update `AiBatchProcessor` สำหรับส่ง context ไปให้ AI
3. Add Redis cache สำหรับ master data context (TTL: 300s)

### Phase 3: Seed Data
1. Update seed data ใน `2026-05-25-create-ai-prompts.sql`
2. เพิ่ม context_config สำหรับ version 1 (null = no filter)
3. สร้าง version 2 ใหม่ด้วย prompt template ภาษาไทย + context_config example

### Phase 4: Frontend
1. Update AI Admin Console UI ให้มี Context Configuration section
2. Update n8n workflow ให้รองรับ filter criteria

### Phase 5: Testing
1. Unit tests สำหรับ context resolution logic
2. Integration tests สำหรับ sandbox และ migration pipeline
3. Manual testing ด้วย prompt template ใหม่

---

## Grilling Session Log

```
2026-05-27 — grilling session ผ่าน Antigravity AI
Q1: Page limit → 3 หน้า (ตาม ADR-023A)
Q2: Database query strategy → Option A (Backend ดึง master data ส่ง context)
Q3: JSON output schema → 11 fields (UUID-based ตาม ADR-019) พร้อมปรับปรุง recipients เป็น Object Array: Array<{ organizationPublicId: string, recipientType: "TO" | "CC" }>
Q4: Context format → Option A (List format)
Q5: Filter strategy → กำหนดใน prompt template โดย filter ด้วย projects/contracts
Q6: Filter storage → Option C (เพิ่ม context_config JSON column)
Q7: Tag Suggestion → Option A (ให้ Backend ทำการ Diff ระหว่าง tags ที่ได้มากับ availableTags เพื่อระบุสถานะ isNew: true เอง)
Q8: Project Scope Priority → Option C (หาก Template มีการผูกโครงการไว้ใน context_config แต่ request พยายาม override ไปโครงการอื่น ระบบจะทำการ Reject ด้วย ForbiddenException ทันที)
Q9: Database Typo Cleanup → Option C (อนุมัติล้าง whitespace typo ของตัวแปร 'CC ' ให้ถูกต้องเป็น 'CC' ทั้งระบบในระดับ Database Schema และอัปเดตไฟล์โครงสร้างหลัก)
```

---

## Related ADRs

- **ADR-029:** Dynamic Prompt Management (base architecture)
- **ADR-023A:** Unified AI Architecture — Model Revision (3-page rule, AI boundary)
- **ADR-019:** Hybrid Identifier Strategy (UUID handling)
- **ADR-007:** Error Handling Strategy (layered error classification)
- **ADR-009:** Database Migration Strategy (direct SQL edits)
