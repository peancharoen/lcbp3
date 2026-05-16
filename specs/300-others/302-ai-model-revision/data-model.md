# Data Model: AI Model Revision (ADR-023A)

**Feature**: `302-ai-model-revision`
**Date**: 2026-05-15

---

## Entities & Schema Changes

### 1. `ai_audit_logs` (existing table — verify against schema)

ไม่มีการเพิ่ม column ใหม่ — ใช้ `model_name` column ที่มีอยู่แล้วบันทึก `gemma4:e4b` แทน `gemma4:9b`

**Key fields (existing)**:
```
id               INT AUTO_INCREMENT
public_id        BINARY(16) → UUIDv7
document_id      INT FK documents.id
project_id       INT FK projects.id
job_type         VARCHAR(50)     -- 'classification', 'tagging', 'rag', 'embed'
model_name       VARCHAR(100)    -- 'gemma4:e4b', 'nomic-embed-text'
confidence_score DECIMAL(5,4)    -- 0.0000 – 1.0000
ai_suggestion_json   JSON
human_override_json  JSON NULL
status           ENUM('PENDING','PROCESSING','DONE','REJECTED')
created_at       DATETIME
updated_at       DATETIME
```

**Index needed**: `(project_id, status, created_at)` สำหรับ Admin Dashboard query

---

### 2. `migration_review_queue` (new table — ADR-009: SQL delta)

staging table สำหรับ Legacy Migration — เก็บ AI output รอ Admin review

```sql
-- Delta file: specs/03-Data-and-Storage/deltas/14-add-migration-review-queue.sql

CREATE TABLE migration_review_queue (
  id             INT           NOT NULL AUTO_INCREMENT,
  public_id      BINARY(16)    NOT NULL DEFAULT (UUID_TO_BIN(UUID(), TRUE)),
  batch_id       VARCHAR(100)  NOT NULL,                    -- n8n batch identifier
  idempotency_key VARCHAR(200) NOT NULL UNIQUE,             -- '<doc_number>:<batch_id>'
  original_filename VARCHAR(500) NOT NULL,
  storage_temp_path VARCHAR(1000) NOT NULL,                 -- path ใน temp storage ก่อน import
  ai_metadata_json  JSON       NOT NULL,                    -- AI suggestion (full)
  confidence_score  DECIMAL(5,4) NOT NULL,
  ocr_used          TINYINT(1)  NOT NULL DEFAULT 0,
  status         ENUM('PENDING','IMPORTED','REJECTED') NOT NULL DEFAULT 'PENDING',
  reviewed_by    INT           NULL,                        -- FK users.id (Admin who reviewed)
  reviewed_at    DATETIME      NULL,
  rejection_reason VARCHAR(500) NULL,
  created_at     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_idempotency (idempotency_key),
  INDEX idx_status_created (status, created_at),
  INDEX idx_batch (batch_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

---

### 3. `documents` table changes (existing table — ADR-009: SQL delta)

เพิ่ม column `ai_processing_status` สำหรับ track AI job progress

```sql
-- Delta file: specs/03-Data-and-Storage/deltas/15-add-ai-processing-status.sql

ALTER TABLE documents
ADD COLUMN ai_processing_status ENUM('PENDING','PROCESSING','DONE','FAILED')
  NOT NULL DEFAULT 'PENDING';

ADD INDEX idx_ai_status (ai_processing_status);
```

**State transitions**:
- `PENDING` → เมื่อ document commit (ใหม่)
- `PROCESSING` → เมื่อ AI job ถูก dequeue
- `DONE` → เมื่อ ai-suggest + embed-document สำเร็จทั้งคู่
- `FAILED` → เมื่อ job เข้า dead-letter

---

### 4. Qdrant Vector Structure (no DB change — external store)

Collection name: `lcbp3_documents` (shared collection, separated by payload filter)

**Point structure**:
```json
{
  "id": "<uuid-v7>",
  "vector": [/* 768-dim from nomic-embed-text */],
  "payload": {
    "document_public_id": "019505a1-...",
    "project_public_id":  "019505a2-...",
    "chunk_index":        3,
    "page_number":        2,
    "chunk_text":         "...",
    "document_type":      "SHOP_DRAWING",
    "embedded_at":        "2026-05-15T10:00:00Z"
  }
}
```

**Multi-tenancy filter (REQUIRED)**:
```typescript
filter: {
  must: [
    { key: 'project_public_id', match: { value: projectPublicId } }
  ]
}
```

---

### 5. BullMQ Job Payload Interfaces

**ai-realtime queue** (RAG Q&A, AI Suggest):
```typescript
interface AiRealtimeJobData {
  jobType: 'rag-query' | 'ai-suggest';
  documentPublicId: string;   // UUIDv7
  projectPublicId: string;    // UUIDv7 — required
  userId: number;             // INT internal ID (for audit only)
  payload: {
    // ai-suggest: { pdfPath: string; pages: 1-3 }
    // rag-query:  { question: string; topK: number }
  };
  idempotencyKey: string;
}
```

**ai-batch queue** (OCR, Extract, Embed):
```typescript
interface AiBatchJobData {
  jobType: 'ocr' | 'extract-metadata' | 'embed-document';
  documentPublicId: string;   // UUIDv7
  projectPublicId: string;    // UUIDv7 — required
  payload: {
    // ocr:              { pdfPath: string }
    // extract-metadata: { textContent: string; maxPages: 3 }
    // embed-document:   { pdfPath: string; chunkSize: 512; overlap: 64 }
  };
  batchId?: string;           // สำหรับ Legacy Migration เท่านั้น
  idempotencyKey: string;
}
```

---

### 6. State Transitions

**Document Upload Flow** (new documents):
```
upload → temp → [ClamAV] → commit → [
  parallel:
    → ai-realtime: ai-suggest → (USER: confirm/edit) → ai_audit_logs
    → ai-batch: embed-document → Qdrant
]
```

**Legacy Migration Flow**:
```
n8n trigger → POST /api/ai/migration/queue → [
  ai-batch: ocr (if needed) + extract-metadata
] → migration_review_queue (PENDING)
                ↓
        Admin review (DMS UI)
                ↓
    IMPORTED → document insert → ai-batch: embed-document → Qdrant
    REJECTED → rejection_reason saved
```

**ai-realtime ↔ ai-batch Coordination**:
```
ai-realtime.active  → ai-batch.pause()
ai-realtime.completed/failed → ai-batch.resume()
ai-batch concurrency=1 (no parallel GPU jobs)
```

---

## Schema Delta File

จะสร้างใน `specs/03-Data-and-Storage/deltas/14-add-migration-review-queue.sql` ตาม ADR-009
