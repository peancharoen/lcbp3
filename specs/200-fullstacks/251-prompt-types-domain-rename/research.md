// File: specs/200-fullstacks/251-prompt-types-domain-rename/research.md
// Change Log:
// - 2026-09-01: Initial research for Feature 251

# Research: Prompt Types Master Table + Domain Term Rename

**Feature**: 251-prompt-types-domain-rename
**Date**: 2026-09-01

---

## R1: `ai_prompt_types` table schema design

### Decision

สร้างตาราง `ai_prompt_types` ใหม่ใน schema canonical (`lcbp3-v1.9.0-schema-02-tables.sql`) และ SQL delta file โดยมีโครงสร้าง:

```sql
CREATE TABLE ai_prompt_types (
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
);
```

### Rationale

- `prompt_type` เป็น PK ทางธุรกิจ (unique) — เป็น FK target จาก `ai_prompts.prompt_type`
- `display_name` สำหรับ dropdown label ในภาษาไทย/อังกฤษ
- `expected_placeholders` เก็บ JSON array ของ placeholder names (เช่น `["ocr_text", "allowed_correspondence_types", "existing_tags"]`) — ใช้แทน hardcoded switch statement ใน `ai-prompts.service.ts:402-430`
- `is_system_managed` = 1 สำหรับ 7 types ที่ seed ตอนติดตั้ง (admin ไม่ลบได้) = 0 สำหรับ type ที่ admin สร้างเพิ่ม
- `is_active` สำหรับ deactivate ชั่วคราวโดยไม่ลบ (soft delete pattern เหมือน `correspondence_types`)

### Alternatives considered

1. **Enum column ใน `ai_prompts`** — ปฏิเสธเพราะ MariaDB ENUM ไม่ dynamic ต้อง ALTER TABLE ทุกครั้งที่เพิ่ม type
2. **Soft reference (no FK)** — ปฏิเสธตาม clarification Q1 (ผู้ใช้เลือก real FK)
3. **ใช้ `system_settings` table** — ปฏิเสธเพราะ `system_settings` เป็น key-value ไม่เหมาะกับ structured metadata

---

## R2: FK constraint strategy — seed before FK

### Decision

ใน SQL delta file เดียว ทำตามลำดับ:
1. `CREATE TABLE ai_prompt_types`
2. `INSERT` seed data 7 types
3. `ALTER TABLE ai_prompts ADD CONSTRAINT fk_prompt_type FOREIGN KEY (prompt_type) REFERENCES ai_prompt_types(prompt_type) ON DELETE RESTRICT`

### Rationale

- ต้อง seed ก่อนเพิ่ม FK เพราะถ้ามี `ai_prompts` rows ที่ `prompt_type` ไม่มีใน master table แล้ว FK จะ fail
- ใช้ `ON DELETE RESTRICT` ตาม FR-012 — ไม่ให้ลบ type ที่มี prompt อ้างอิงอยู่
- ใช้ delta file เดียวเพื่อให้ deploy atomic (FR-015)

### Alternatives considered

1. **แยก 2 delta files** — ปฏิเสธเพราะต้อง deploy atomic
2. **`ON DELETE CASCADE`** — ปฏิเสธเพราะอันตราย (ลบ type แล้ว prompt หายหมด)
3. **`ON DELETE SET NULL`** — ปฏิเสธเพราะทำให้ prompt กลายเป็น orphan

---

## R3: Seed data — 7 known prompt types

### Decision

Seed 7 prompt types พร้อม metadata:

| prompt_type | display_name | expected_placeholders | is_system_managed |
|---|---|---|---|
| `ocr_system` | คำสั่งระบบ OCR | `[]` (free-form) | 1 |
| `ocr_extraction` | สกัด Metadata จาก OCR | `["ocr_text","allowed_correspondence_types","existing_tags","master_data_context"]` | 1 |
| `migration_compare` | เปรียบเทียบทะเบียนเอกสาร | `["ocr_text","excel_metadata","ocr_truncated"]` | 1 |
| `rag_prep_prompt` | เตรียมข้อมูล RAG | `["text"]` | 1 |
| `rag_query_prompt` | ค้นหาข้อมูล RAG | `["query","context"]` | 1 |
| `rag_chunking` | แบ่งข้อความ RAG | `["text"]` | 1 |
| `classification_prompt` | จำแนกประเภทเอกสาร | `["document_text"]` | 1 |

### Rationale

- ครอบคลุมทุก prompt type ที่ใช้ใน codebase (จาก subagent investigation)
- `expected_placeholders` ตรงกับ validation logic ที่มีใน `ai-prompts.service.ts:402-430` — เปลี่ยนจาก switch statement เป็น query จาก master table
- `is_system_managed = 1` ทั้งหมดเพราะเป็น type ที่ code path อ้างอิงโดยตรง

### Alternatives considered

1. **Seed เฉพาะ 5 types ที่อยู่ใน frontend** — ปฏิเสธเพราะ `migration_compare` และ `rag_chunking` ใช้ใน backend แล้ว ถ้าไม่ seed จะเป็น orphan
2. **ให้ admin สร้าง type เองทั้งหมด** — ปฏิเสธเพราะ runtime code อ้างอิง type name โดยตรง ต้องมี seed เพื่อรับประกัน

---

## R4: Backend validation — replace hardcoded switch with master table query

### Decision

แก้ `ai-prompts.service.ts:create()` จาก hardcoded switch statement:

```typescript
// เดิม: switch on promptType (lines 402-430)
if (promptType === 'ocr_system') { ... }
else if (promptType === 'ocr_extraction') { ... }
```

เป็น dynamic validation จาก master table:

```typescript
// ใหม่: query expected_placeholders จาก ai_prompt_types
const promptTypeRecord = await this.aiPromptTypesService.findByType(promptType);
if (!promptTypeRecord) {
  throw new BusinessException(`prompt_type "${promptType}" ไม่มีในระบบ ติดต่อ super-admin`);
}
const expectedPlaceholders = promptTypeRecord.expectedPlaceholders ?? [];
for (const placeholder of expectedPlaceholders) {
  if (!dto.template.includes(`{{${placeholder}}}`)) {
    throw new ValidationException(`template ต้องมี {{${placeholder}}} placeholder`);
  }
}
```

### Rationale

- ลบ hardcoded switch statement ที่เป็น source ของ bug (ลืมเพิ่ม type ใหม่)
- Validation rules มาจาก DB แก้ไขได้โดยไม่ต้อง deploy code
- สอดคล้องกับ ADR-029 dynamic prompt management philosophy

### Alternatives considered

1. **เก็บ switch statement และเพิ่ม type ใหม่ใน code** — ปฏิเสธเพราะลืมได้ และขัด FR-006
2. **Hardcode validation rules ใน frontend** — ปฏิเสธเพราะ frontend ไม่ควรรู้ business rules

---

## R5: Frontend unification — merge 2 pages into 1

### Decision

- ลบ `frontend/app/(admin)/admin/ai/prompts/page.tsx` (thin wrapper รอบ `PromptManagementTabs`)
- แก้ `frontend/app/(admin)/admin/ai/prompt-management/page.tsx` ให้เป็น unified page ที่ใช้ `PromptTypeDropdown` แบบ dynamic (query จาก `/ai/prompt-types` API)
- เพิ่ม `next.config.ts` redirect 308: `/admin/ai/prompts` → `/admin/ai/prompt-management`
- ลบ `PromptManagementTabs.tsx` (2-tab layout ที่แยก OCR System กับ AI Extraction)
- แก้ `PromptTypeDropdown.tsx` ให้ query จาก API แทน hardcoded list

### Rationale

- ผู้ใช้ระบุชัดเจน: "หน้าเดียว ไม่ต้องมี 2 หน้า"
- Dynamic dropdown จาก `ai_prompt_types` ทำให้ type ใหม่ปรากฏอัตโนมัติ (FR-003, FR-005)
- Redirect 308 รักษา bookmark เดิม (FR-004)

### Alternatives considered

1. **คง 2 หน้าและเพิ่ม type ใหม่ใน dropdown** — ปฏิเสธตาม FR-004 และคำขอผู้ใช้
2. **รวมใน `prompts/page.tsx` และลบ `prompt-management/`** — ปฏิเสธเพราะ `prompt-management` มี logic ครบ สมควรเป็น canonical path

---

## R6: `category` → `correspondenceType` rename — physical DB column

### Decision

SQL delta:
```sql
ALTER TABLE migration_review_queue
  CHANGE COLUMN ai_suggested_category ai_suggested_correspondence_type VARCHAR(50) NULL
  COMMENT 'Correspondence Type ที่ AI แนะนำ (correspondence_types.typeCode)';
```

### Rationale

- `CHANGE COLUMN` เปลี่ยนชื่อโดยไม่สูญเสียข้อมูล (metadata-only operation ใน MariaDB)
- ผู้ใช้เลือก physical rename ใน clarification Q1
- ไม่ต้อง handle ทั้ง old และ new column name เพราะ atomic deploy (FR-015)

### Alternatives considered

1. **Application-only rename (คง DB column เดิม)** — ปฏิเสธตาม clarification Q1
2. **Add new + deprecate old** — ปฏิเสธเพราะซับซ้อนและไม่จำเป็นสำหรับ atomic deploy

---

## R7: ADR-050 §9 + prompt template update

### Decision

- แก้ ADR-050 §9: `{{allowed_categories}}` → `{{allowed_correspondence_types}}`, `metadata.category` → `metadata.correspondenceType`
- แก้ `specs/200-fullstacks/250-ai-metadata-extraction-contract/prompts/ocr_extraction.md` ให้ตรงกัน
- ไม่แก้ `ocr_system` prompt (FR-009)

### Rationale

- ADR-050 §9 เป็น source of truth ของ prompt template — ต้องแก้ก่อน แล้ว file reference ค่อยตาม
- หลัง deploy ต้อง activate prompt version ใหม่ผ่าน ADR-029 mechanism (เป็น follow-up task ไม่ใช่ schema change)

### Alternatives considered

1. **เก็บ `category` ใน prompt แล้ว map ใน backend** — ปฏิเสธเพราะ FR-010 ห้าม silent backward-compat mapping
2. **ไม่แก้ ADR-050** — ปฏิเสธเพราะ ADR เป็น source of truth ต้องตรงกับ implementation

---

## R8: RBAC — `system.manage_all` for prompt type CRUD

### Decision

- `GET /ai/prompt-types` — admin ทั่วไปที่มี `system.manage_all` ดูได้ (read)
- `POST /ai/prompt-types` — `system.manage_all` (super-admin only)
- `DELETE /ai/prompt-types/:promptType` — `system.manage_all` (super-admin only)
- `ai_prompts` CRUD — คงเดิม `system.manage_all`

### Rationale

- ผู้ใช้เลือก "แยกระดับ" ใน clarification Q3 แต่ `system.manage_all` ในระบบ LCBP3 คือ super-admin permission อยู่แล้ว
- ในทางปฏิบัติ: admin ที่มี `system.manage_all` จัดการ prompt ได้หมด (ทั้ง type และ version) — สอดคล้องกับ ADR-029 ที่ใช้ `system.manage_all` บน prompt mutations
- แยกในระดับ UI: หน้า type management เป็น section แยกที่ติดป้าย "Super Admin Only"

### Alternatives considered

1. **สร้าง permission ใหม่ `system.manage_prompt_types`** — ปฏิเสธเพราะเพิ่ม complexity ใน RBAC matrix โดยไม่จำเป็น และต้อง seed permission ใหม่
2. **ใช้ `system.maintenance_mode`** — ปฏิเสธเพราะไม่ใช่ purpose ของ permission นี้
