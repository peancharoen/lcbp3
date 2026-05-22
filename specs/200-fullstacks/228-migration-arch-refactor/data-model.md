// File: specs/200-fullstacks/228-migration-arch-refactor/data-model.md
// Change Log:
// - 2026-05-22: Phase 1 data model for migration architecture refactor

# Data Model: ADR-028 Migration Architecture Refactor

## New Tables (SQL Delta Required — ADR-009)

### tags

```sql
CREATE TABLE tags (
  id          INT PRIMARY KEY AUTO_INCREMENT,
  public_id   CHAR(36) NOT NULL UNIQUE,       -- UUIDv7 (ADR-019)
  project_id  INT NULL REFERENCES projects(id) ON DELETE CASCADE,
  tag_name    VARCHAR(100) NOT NULL,
  color_code  VARCHAR(30) DEFAULT 'default',
  description TEXT,
  created_by  INT REFERENCES users(id),
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at  TIMESTAMP NULL,
  UNIQUE KEY uq_tag_project (project_id, tag_name)
);
```

### correspondence_tags

```sql
CREATE TABLE correspondence_tags (
  correspondence_id INT NOT NULL REFERENCES correspondences(id) ON DELETE CASCADE,
  tag_id            INT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  is_ai_suggested   BOOLEAN DEFAULT FALSE,
  confidence        DECIMAL(4,3) NULL,           -- AI confidence score (0.000–1.000)
  created_by        INT REFERENCES users(id),
  created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (correspondence_id, tag_id)
);
```

## Existing Tables (Updated by this Feature)

### import_transactions (เก็บถาวร — Audit Trail)

```sql
-- ตารางนี้มีอยู่แล้วใน migration SQL
-- เพิ่ม index สำหรับ audit queries:
CREATE INDEX idx_import_transactions_batch ON import_transactions(batch_id);
CREATE INDEX idx_import_transactions_doc   ON import_transactions(document_number);
```

### migration_review_queue (Drop หลัง Gate #3)

| Column | Type | Notes |
|--------|------|-------|
| `id` | INT AUTO_INCREMENT PK | — |
| `batch_id` | VARCHAR(50) | FK migration_progress |
| `document_number` | VARCHAR(100) | จาก Excel |
| `temp_attachment_id` | VARCHAR(36) | UUID — cleaned up หลัง commit หรือ 24h |
| `ai_job_id` | VARCHAR(36) NULL | BullMQ job ID — **เพิ่มโดย SQL delta** `2026-05-22-alter-migration-review-queue.sql` (ไม่มีใน 03-04 migration SQL เดิม) |
| `ai_confidence` | DECIMAL(4,3) | 0.000–1.000 |
| `ai_summary` | TEXT | — |
| `suggested_tags` | JSON | `[{name, is_new, confidence}]` |
| `status` | ENUM('PENDING','APPROVED','REJECTED','ERROR') | — |
| `reviewed_by` | INT NULL | FK users(id) |
| `reviewed_at` | TIMESTAMP NULL | — |

## BullMQ Job Types (New)

### `migrate-document` (ai-batch queue)

**Input payload:**
```typescript
interface MigrateDocumentJobPayload {
  tempAttachmentId: string;      // UUID ของ temp file
  documentNumber: string;
  title: string;
  existingTags: TagOption[];     // project tags สำหรับ AI ใช้ประกอบ
  systemCategories: string[];    // categories จาก /api/meta/categories
  batchId: string;
}
```

**Output (stored in job result):**
```typescript
interface MigrateDocumentJobResult {
  isValid: boolean;
  confidence: number;            // 0.0–1.0
  category: string;
  summary: string;
  suggestedTags: {
    name: string;
    description: string;
    isNew: boolean;
    confidence: number;
  }[];
  detectedIssues: string[];
  ocrMethod: 'fast-path' | 'slow-path';
  processingTimeMs: number;
}
```

### `cleanup-temp-files` (ai-batch queue — Scheduled)

รัน Scheduled ทุก 1 ชั่วโมง — ลบ temp attachments ที่:
- `is_temporary = TRUE`
- `created_at < NOW() - INTERVAL 24 HOUR`
- ไม่มี `committed_at` (ยังไม่ถูก commit)

## Entity Relationships

```
projects (1) ──── (N) tags
tags (N) ──── (N) correspondences  [through correspondence_tags]
migration_review_queue (1) ──── (1) import_transactions
migration_review_queue.temp_attachment_id → attachments.public_id
```

## State Transitions: Migration Review Record

```
[Queued by n8n]
      ↓
  PENDING
  ├── (confidence ≥ 0.85 + is_valid) → PENDING (ready for batch import)
  ├── (0.60 ≤ confidence < 0.85)     → PENDING (flagged for careful review)
  └── (confidence < 0.60 OR !is_valid) → REJECTED (auto)
      ↓
  [Human Review by DC/Admin/Superadmin]
      ├── Execute Import → APPROVED → Correspondence created
      └── Reject → REJECTED
```
