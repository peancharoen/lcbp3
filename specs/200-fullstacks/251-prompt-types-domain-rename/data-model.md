// File: specs/200-fullstacks/251-prompt-types-domain-rename/data-model.md
// Change Log:
// - 2026-09-01: Initial data model for Feature 251

# Data Model: Prompt Types Master Table + Domain Term Rename

**Feature**: 251-prompt-types-domain-rename
**Date**: 2026-09-01

---

## New Entity: `ai_prompt_types`

### Table: `ai_prompt_types`

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `INT AUTO_INCREMENT` | PK | Internal ID (ไม่ expose ใน API, ADR-019) |
| `public_id` | `UUID` | NOT NULL UNIQUE | UUIDv7 (NestJS @BeforeInsert) |
| `prompt_type` | `VARCHAR(50)` | NOT NULL UNIQUE | ชื่อ type เช่น `ocr_extraction` — FK target จาก `ai_prompts.prompt_type` |
| `display_name` | `VARCHAR(255)` | NOT NULL | ชื่อแสดงผลใน dropdown (ภาษาไทย/อังกฤษ) |
| `description` | `TEXT` | NULL | คำอธิบาย type |
| `expected_placeholders` | `JSON` | NULL | Array ของ placeholder names เช่น `["ocr_text","allowed_correspondence_types"]` |
| `is_system_managed` | `TINYINT(1)` | NOT NULL DEFAULT 1 | 1 = seed โดยระบบ (ห้ามลบ), 0 = admin สร้างเพิ่ม |
| `is_active` | `TINYINT(1)` | NOT NULL DEFAULT 1 | 1 = ใช้งาน, 0 = deactivated |
| `created_at` | `TIMESTAMP` | NOT NULL DEFAULT CURRENT_TIMESTAMP | |
| `updated_at` | `TIMESTAMP` | NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP | |

### Relationships

- `ai_prompts.prompt_type` → `ai_prompt_types.prompt_type` (FK, `ON DELETE RESTRICT`)
- One `ai_prompt_type` has many `ai_prompts` versions

### Seed Data

7 system-managed types:

| prompt_type | display_name | expected_placeholders | is_system_managed |
|---|---|---|---|
| `ocr_system` | คำสั่งระบบ OCR | `[]` | 1 |
| `ocr_extraction` | สกัด Metadata จาก OCR | `["ocr_text","allowed_correspondence_types","existing_tags","master_data_context"]` | 1 |
| `migration_compare` | เปรียบเทียบทะเบียนเอกสาร | `["ocr_text","excel_metadata","ocr_truncated"]` | 1 |
| `rag_prep_prompt` | เตรียมข้อมูล RAG | `["text"]` | 1 |
| `rag_query_prompt` | ค้นหาข้อมูล RAG | `["query","context"]` | 1 |
| `rag_chunking` | แบ่งข้อความ RAG | `["text"]` | 1 |
| `classification_prompt` | จำแนกประเภทเอกสาร | `["document_text"]` | 1 |

---

## Modified Entity: `ai_prompts`

### Changes

| Change | Before | After |
|---|---|---|
| `prompt_type` column | `VARCHAR(50)` no FK | `VARCHAR(50)` with FK to `ai_prompt_types.prompt_type` (`ON DELETE RESTRICT`) |

No other changes to `ai_prompts` — version/activation/template mechanism คงเดิมตาม ADR-029.

---

## Modified Entity: `migration_review_queue`

### Column Rename

| Before | After | Type | Notes |
|---|---|---|---|
| `ai_suggested_category` | `ai_suggested_correspondence_type` | `VARCHAR(50) NULL` | Physical rename via `ALTER TABLE ... CHANGE COLUMN` — ไม่สูญเสียข้อมูล |

### JSON Field Renames (in `details` column)

| Before | After | Path |
|---|---|---|
| `metadata.category` | `metadata.correspondenceType` | `details.metadata.category` |
| `metadata.confidence.category` | `metadata.confidence.correspondenceType` | `details.metadata.confidence.category` |
| `fieldResolutions.category` | `fieldResolutions.correspondenceType` | `details.fieldResolutions.category` |

**Note**: JSON field renames ไม่ใช่ DB schema change — เป็น application contract change ที่ backend/frontend ต้องเปลี่ยนพร้อมกัน (atomic deploy, FR-015)

---

## TypeScript Type Changes

### Backend

| File | Before | After |
|---|---|---|
| `migration-review-queue.entity.ts` | `aiSuggestedCategory?: string \| null` (`@Column name: 'ai_suggested_category'`) | `aiSuggestedCorrespondenceType?: string \| null` (`@Column name: 'ai_suggested_correspondence_type'`) |
| `ai-extraction-details.type.ts` | `category: string` (Metadata) | `correspondenceType: string` |
| `ai-extraction-details.type.ts` | `category: number` (MetadataConfidence) | `correspondenceType: number` |
| `ai-extraction-details.type.ts` | `category?: 'edited' \| 'acknowledged'` (FieldResolutionState) | `correspondenceType?: 'edited' \| 'acknowledged'` |
| `commit-migration-review.dto.ts` | `category?: string` | `correspondenceType?: string` |
| `commit-migration-review.dto.ts` | `ACKNOWLEDGEABLE_FIELDS` includes `'category'` | includes `'correspondenceType'` |

### Frontend

| File | Before | After |
|---|---|---|
| `types/migration.ts` | `category?: 'edited' \| 'acknowledged'` | `correspondenceType?: 'edited' \| 'acknowledged'` |
| `types/migration.ts` | `category: number` (MetadataConfidence) | `correspondenceType: number` |
| `types/migration.ts` | `category: string` (Metadata) | `correspondenceType: string` |
| `types/dto/migration/migration-review.dto.ts` | `AcknowledgeableMigrationField` includes `'category'` | includes `'correspondenceType'` |
| `types/dto/migration/migration-review.dto.ts` | `category?: string` | `correspondenceType?: string` |
| `lib/types/ai-prompts.ts` | `PromptType` = hardcoded union | `PromptType` = `string` (dynamic from API) |

---

## State Transitions

### `ai_prompt_types` lifecycle

```text
[created] → is_active=1 → (deactivate) → is_active=0 → (reactivate) → is_active=1
                ↓
          (delete attempt)
                ↓
      FK RESTRICT check
         /        \
    has refs    no refs
        ↓          ↓
   BLOCKED     DELETE
```

- `is_system_managed = 1` types ไม่ควรลบ (application-level guard นอกเหนือจาก FK)
- `is_active = 0` types ยังปรากฏใน dropdown แต่ marker "inactive" — runtime เรียกใช้ไม่ได้ (FR-014)

---

## Validation Rules

### `ai_prompt_types`

- `prompt_type`: required, unique, max 50 chars, snake_case pattern
- `display_name`: required, max 255 chars
- `expected_placeholders`: optional, JSON array of strings
- Delete: blocked if `ai_prompts` references exist (FK RESTRICT + application check)

### `ai_prompts` (updated validation)

- `prompt_type`: must exist in `ai_prompt_types` (FK + application check)
- `template`: must contain all `expected_placeholders` from `ai_prompt_types` (dynamic validation, replaces hardcoded switch)
- Template max 4000 chars (existing rule, unchanged)

### Migration review commit

- `correspondenceType`: must exist in `correspondence_types.typeCode` (replaces `category` validation)
- `fieldAcknowledgments`: accepts `'correspondenceType'` (replaces `'category'`)
