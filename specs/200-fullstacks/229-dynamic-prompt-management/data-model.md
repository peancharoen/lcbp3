# Data Model: Dynamic Prompt Management for OCR Extraction

**Feature**: `229-dynamic-prompt-management`
**Date**: 2026-05-25

---

## Entity: AiPrompt (`ai_prompts`)

### SQL Schema (delta file)

```sql
-- File: specs/03-Data-and-Storage/deltas/2026-05-25-create-ai-prompts.sql
-- ADR-029: Dynamic Prompt Management for OCR Extraction

CREATE TABLE ai_prompts (
  id               INT PRIMARY KEY AUTO_INCREMENT
                     COMMENT 'Internal INT PK — never exposed in API (ADR-019)',
  prompt_type      VARCHAR(50) NOT NULL
                     COMMENT 'ประเภท prompt เช่น ocr_extraction — ใช้เป็น public identifier',
  version_number   INT NOT NULL
                     COMMENT 'เลข version ต่อเนื่องต่อ prompt_type (1, 2, 3...) — monotonically increasing, ไม่ fill gaps',
  template         TEXT NOT NULL
                     COMMENT 'prompt template ที่มี {{ocr_text}} placeholder บังคับ — validated ก่อน save',
  field_schema     JSON NULL
                     COMMENT 'definition ของ fields ที่คาดหวังในผลลัพธ์ JSON (system-managed, ไม่ user-editable ใน v1)',
  is_active        TINYINT(1) DEFAULT 0
                     COMMENT '1 = version นี้ใช้งานจริงทั้ง sandbox และ migrate-document; exactly 1 active ต่อ prompt_type',
  test_result_json JSON NULL
                     COMMENT 'ผลลัพธ์ JSON จาก OCR sandbox run ล่าสุด (auto-save โดย processSandboxExtract)',
  manual_note      TEXT NULL
                     COMMENT 'หมายเหตุ/annotation จาก admin (PATCH endpoint)',
  last_tested_at   TIMESTAMP NULL
                     COMMENT 'เวลาที่ sandbox รันสำเร็จครั้งล่าสุดสำหรับ version นี้',
  activated_at     TIMESTAMP NULL
                     COMMENT 'เวลาที่ version นี้ถูก activate เป็น active — NULL ถ้ายังไม่เคย activate',
  created_by       INT NOT NULL
                     COMMENT 'FK → users.user_id — ผู้สร้าง version นี้',
  created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_type_version (prompt_type, version_number)
             COMMENT 'ป้องกัน race condition — version_number ต้อง unique ต่อ prompt_type',
  INDEX idx_prompt_type_active (prompt_type, is_active)
        COMMENT 'ใช้สำหรับ query active prompt (Redis cache miss path)',
  CONSTRAINT fk_ai_prompts_created_by FOREIGN KEY (created_by) REFERENCES users(user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='ADR-029: Versioned prompt templates สำหรับ OCR extraction — ใช้ร่วมกันโดย sandbox และ migrate-document';

-- Seed data: default active version จาก hardcoded prompt ปัจจุบัน
-- NOTE: template text ต้องแทนที่ด้วย exact hardcoded prompt จาก ai-batch.processor.ts ก่อน deploy
INSERT INTO ai_prompts (prompt_type, version_number, template, field_schema, is_active, created_by)
VALUES (
  'ocr_extraction',
  1,
  'You are a document metadata extraction assistant. Extract the following fields from the OCR text below and return a valid JSON object.\n\nFields to extract:\n- documentNumber: document number or reference code\n- subject: document title or subject\n- discipline: engineering discipline (e.g., Civil, Mechanical, Electrical)\n- date: document date (ISO 8601 format if possible)\n- confidence: your confidence score 0.0-1.0\n- category: document category\n- tags: array of relevant tags\n- summary: brief document summary (max 200 chars)\n\nReturn ONLY valid JSON. No explanation text.\n\nOCR Text:\n{{ocr_text}}',
  JSON_OBJECT(
    -- key = ชื่อ field ใน JSON output ที่ LLM ควร return (ไม่ใช่ column name ของ ai_prompts table)
    -- value = type constraint ที่ processor ใช้ validate/document
    'documentNumber', 'string|null',
    'subject',        'string|null',
    'discipline',     'enum:Civil,Mechanical,Electrical,Architectural|null',
    'category',       'enum:Correspondence,Transmittal,Circulation,RFA,Shop Drawing,Contract Drawing|null',
    'date',           'date:YYYY-MM-DD|null',
    'confidence',     'float:0-1',
    'tags',           'string[]',
    'summary',        'string|null'
  ),
  1,
  1
);
```

### TypeORM Entity

```typescript
// File: backend/src/modules/ai/prompts/ai-prompts.entity.ts
// ADR-029: Entity สำหรับ ai_prompts table

@Entity('ai_prompts')
export class AiPrompt {
  @PrimaryGeneratedColumn()
  @Exclude() // ADR-019: INT PK ไม่ expose ใน API
  id: number;

  @Column({ name: 'prompt_type', length: 50 })
  promptType: string;

  @Column({ name: 'version_number' })
  versionNumber: number;

  @Column({ type: 'text' })
  template: string;

  @Column({ name: 'field_schema', type: 'json', nullable: true })
  fieldSchema: Record<string, unknown> | null;

  @Column({ name: 'is_active', type: 'tinyint', width: 1, default: 0 })
  isActive: boolean;

  @Column({ name: 'test_result_json', type: 'json', nullable: true })
  testResultJson: Record<string, unknown> | null;

  @Column({ name: 'manual_note', type: 'text', nullable: true })
  manualNote: string | null;

  @Column({ name: 'last_tested_at', type: 'timestamp', nullable: true })
  lastTestedAt: Date | null;

  @Column({ name: 'activated_at', type: 'timestamp', nullable: true })
  activatedAt: Date | null;

  @Column({ name: 'created_by' })
  @Exclude() // FK ไม่ expose โดยตรง
  createdBy: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
```

---

## State Transitions

```
[CREATE] → is_active = 0 (inactive)
                │
                ▼
[ACTIVATE] → is_active = 1 (active) ── replaces previous active version
                │
                ▼ (when another version is activated)
[DEACTIVATE] → is_active = 0 (inactive)
                │
                ▼ (only if not active)
[DELETE] → row removed from DB
```

**Invariant**: Exactly 1 row with `is_active = 1` per `prompt_type` at all times (enforced by transaction in `AiPromptsService.activate()`)

---

## Redis Cache

| Key | Value | TTL | Invalidated by |
|-----|-------|-----|---------------|
| `ai:prompt:active:ocr_extraction` | Serialized `AiPrompt` (JSON) | 60s | `AiPromptsService.activate()` — `DEL key` after transaction commit |

**Fallback**: If Redis unavailable (`ioredis` connection error), `AiPromptsService.getActive()` queries DB directly with `LOG.warn('Redis unavailable, falling back to DB query')` — no throw.

---

## API Response Shape

```typescript
// AiPromptResponseDto — สำหรับ expose ใน API response
interface AiPromptResponse {
  promptType: string;          // 'ocr_extraction'
  versionNumber: number;       // 1, 2, 3...
  template: string;            // full template text
  isActive: boolean;
  testResultJson: Record<string, unknown> | null;
  manualNote: string | null;
  lastTestedAt: string | null; // ISO 8601
  activatedAt: string | null;  // ISO 8601
  createdAt: string;           // ISO 8601
}
// NOTE: id (INT) ไม่ expose — @Exclude() per ADR-019
// NOTE: createdBy (INT) ไม่ expose
```

---

## Relationships

- `ai_prompts.created_by` → `users.user_id` (FK)
- No relationship to other AI tables (standalone)
- Consumed by: `AiBatchProcessor.processSandboxExtract()` and `AiBatchProcessor.processMigrateDocument()`

---

## Pre-existing Bug (must fix in T024)

`MigrateDocumentMetadata` interface (บรรทัด 29-37 ใน `ai-batch.processor.ts`) **ขาด `discipline?: string`** — แม้ `processMigrateDocument` prompt จะ extract `discipline` ออกมาได้ แต่ `parseMigrateDocumentMetadata()` ทิ้งค่านี้ทุกครั้งเพราะ interface ไม่รับ field นี้

```typescript
// ❌ ปัจจุบัน (ขาด discipline)
interface MigrateDocumentMetadata {
  documentNumber?: string;
  subject?: string;
  category?: string;          // มี category
  date?: string;
  confidence?: number;
  tags?: string[];
  summary?: string;
  // discipline หายไปเลย!
}

// ✅ ต้องแก้เป็น (เพิ่ม discipline)
interface MigrateDocumentMetadata {
  documentNumber?: string;
  subject?: string;
  discipline?: string;        // เพิ่ม
  category?: string;
  date?: string;
  confidence?: number;
  tags?: string[];
  summary?: string;
}
```

**Fix**: เพิ่มการแก้ bug นี้เข้าไปใน T026 หรือ T024 เมื่อ implement — ก่อน/หลัง replace hardcoded prompt
