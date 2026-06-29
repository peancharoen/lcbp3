# Data Model: OCR & AI Extraction Prompt Management

**Feature**: 238-ocr-ai-prompt-separation
**Date**: 2026-06-17

## Entity: AiPrompt (Extended from ADR-029)

### Database Schema

> **สถานะ**: ตาราง `ai_prompts` มีอยู่แล้วจริง (ADR-029, deltas 2026-05-25 / 2026-06-06 / 2026-06-15) — ข้างล่างคือ schema **จริง** ไม่ใช่ข้อเสนอ งานนี้ไม่ได้สร้างตารางใหม่ — มีเพียง seed `ocr_system` เท่านั้น

```sql
-- File (ของจริง): specs/03-Data-and-Storage/deltas/2026-05-25-create-ai-prompts.sql
--                + 2026-06-06-add-ai-prompts-public-id.sql
--                + 2026-06-15-fix-ai-prompts-columns.sql

CREATE TABLE ai_prompts (
    id INT AUTO_INCREMENT PRIMARY KEY,             -- internal PK (ไม่ expose, ADR-019)
    public_id UUID NOT NULL UNIQUE,                -- MariaDB native UUID for API (ADR-019)
    prompt_type VARCHAR(50) NOT NULL,              -- 'ocr_system', 'ocr_extraction', etc.
    version_number INT NOT NULL,                   -- User-visible version number (1, 2, 3...)
    template TEXT NOT NULL,                        -- Prompt content
    field_schema JSON NULL,                        -- definition ของ fields ที่คาดหวังใน JSON result
    context_config JSON NULL,                      -- Master Data context filtering (project/contract scope)
    is_active TINYINT(1) NOT NULL DEFAULT 0,       -- Only one active per prompt_type
    test_result_json JSON NULL,                    -- ผล sandbox run ล่าสุด
    manual_note TEXT NULL,                         -- annotation จาก admin
    last_tested_at TIMESTAMP NULL,
    activated_at TIMESTAMP NULL,
    created_by INT NOT NULL,                       -- FK users(user_id) — INT ไม่ใช่ created_by_public_id
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    version INT NOT NULL DEFAULT 1,                -- @VersionColumn optimistic locking (delta 2026-06-15)

    UNIQUE KEY uk_type_version (prompt_type, version_number),
    INDEX idx_prompt_type_active (prompt_type, is_active),
    FOREIGN KEY (created_by) REFERENCES users(user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### TypeScript Entity (Backend)

> **สถานะ**: entity มีอยู่แล้วที่ `backend/src/modules/ai/prompts/ai-prompts.entity.ts` (ไม่ใช่ `entities/ai-prompt.entity.ts`). ข้างล่างคือโครงสร้าง**จริง** — งาน 238 ไม่ต้องสร้าง entity ใหม่

```typescript
// File: backend/src/modules/ai/prompts/ai-prompts.entity.ts (มีอยู่แล้ว)

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  VersionColumn,
} from 'typeorm';
import { Exclude } from 'class-transformer';

@Entity('ai_prompts')
export class AiPrompt {
  @PrimaryGeneratedColumn()
  @Exclude() // ADR-019: INT PK ไม่ expose ใน API
  id!: number;

  @Column({ name: 'public_id', type: 'uuid', unique: true })
  publicId!: string;

  @Column({ name: 'prompt_type', length: 50 })
  promptType!: string; // 'ocr_system' | 'ocr_extraction' | 'rag_query_prompt' | 'rag_prep_prompt' | 'classification_prompt'

  @Column({ name: 'version_number' })
  versionNumber!: number;

  @Column({ type: 'text' })
  template!: string;

  @Column({ name: 'field_schema', type: 'json', nullable: true })
  fieldSchema!: Record<string, unknown> | null;

  @Column({ name: 'context_config', type: 'json', nullable: true })
  contextConfig!: Record<string, unknown> | null;

  @Column({ name: 'is_active', type: 'tinyint', width: 1, default: 0 })
  isActive!: boolean;

  @Column({ name: 'test_result_json', type: 'json', nullable: true })
  testResultJson!: Record<string, unknown> | null;

  @Column({ name: 'manual_note', type: 'text', nullable: true })
  manualNote!: string | null;

  @Column({ name: 'last_tested_at', type: 'timestamp', nullable: true })
  lastTestedAt!: Date | null;

  @Column({ name: 'activated_at', type: 'timestamp', nullable: true })
  activatedAt!: Date | null;

  @Column({ name: 'created_by' })
  @Exclude() // FK ไม่ expose โดยตรง
  createdBy!: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @VersionColumn({ name: 'version' })
  version!: number; // optimistic locking
}
```

### Validation Rules

| Prompt Type | Required Placeholders | Validation |
|-------------|----------------------|------------|
| `ocr_system` | None | Free-form system prompt |
| `ocr_extraction` | `{{ocr_text}}` | Must contain at least this placeholder |
| `ocr_extraction` | `{{master_data_context}}` | Optional - does NOT block save if absent |
| `rag_prep_prompt` | `{{text}}` | Must contain `{{text}}` placeholder for chunking input |

### State Transitions

```
[DRAFT] → [ACTIVE] → [INACTIVE]
   ↓         ↓
[DELETED]  [NEW_VERSION]
```

- **DRAFT**: สร้างใหม่, ยังไม่ active
- **ACTIVE**: กำลังใช้งาน (is_active = true)
- **INACTIVE**: เคย active แต่ถูกแทนที่ด้วย version ใหม่
- **NEW_VERSION**: สร้าง version ใหม่จาก existing prompt

### Relationships

```mermaid
ai_prompts ||--o{ ai_jobs : "used_by"
ai_prompts ||--|| users : "created_by"
```

- **ai_jobs**: Reference prompt ที่ใช้ในการทำ OCR/Extraction
- **users**: Admin ที่สร้าง prompt version

### Query Patterns

```typescript
// 1. Get active prompt for a type
const activePrompt = await repo.findOne({
  where: { promptType: 'ocr_system', isActive: true }
});

// 2. Get version history for a prompt type
const versions = await repo.find({
  where: { promptType: 'ocr_extraction' },
  order: { versionNumber: 'DESC' }
});

// 3. การ activate ปัจจุบัน (ของจริง) ใช้ PESSIMISTIC lock ใน transaction
//    @VersionColumn มีไว้ดักการแก้ไขซ้อนตอน save แต่ activate() ไม่รับ expectedVersion
const promptToActivate = await queryRunner.manager.findOne(AiPrompt, {
  where: { promptType, versionNumber },
  lock: { mode: 'pessimistic_write' },
});
```

> **หมายเหตุ optimistic vs pessimistic**: research.md เสนอ optimistic locking (`expectedVersion` + HTTP 409) แต่ `activate()` ของจริงใช้ `pessimistic_write`. ถ้าจะทำ flow 409 ตาม spec ต้องแก้ signature ของ `activate()` ให้รับ `expectedVersion` และเทียบกับ `version` ก่อน save

### SQL Delta Script (ADR-009)

```sql
-- Delta for this feature
-- File: specs/03-Data-and-Storage/deltas/2026-06-17-seed-ocr-system-prompt.sql

-- version column มีอยู่แล้วจาก 2026-06-15-fix-ai-prompts-columns.sql — บรรทัดนี้ idempotent เผื่อ env เก่า
ALTER TABLE ai_prompts ADD COLUMN IF NOT EXISTS `version` INT NOT NULL DEFAULT 1;

-- Seed default OCR system prompt (ถ้ายังไม่มี active ของ type นี้)
-- ใช้ created_by INT FK → users(user_id) และ username='superadmin' ตาม pattern ของ delta เดิม
INSERT INTO ai_prompts (
    public_id, prompt_type, version_number, template,
    context_config, is_active, activated_at, created_by
)
SELECT
    UUID(),
    'ocr_system',
    1,
    'Extract all text from this PDF page accurately.',
    '{"temperature": 0.1, "topP": 0.6}',
    1,
    CURRENT_TIMESTAMP,
    (SELECT user_id FROM users WHERE username = 'superadmin' LIMIT 1)
WHERE NOT EXISTS (
    SELECT 1 FROM ai_prompts WHERE prompt_type = 'ocr_system' AND is_active = 1
);
```
