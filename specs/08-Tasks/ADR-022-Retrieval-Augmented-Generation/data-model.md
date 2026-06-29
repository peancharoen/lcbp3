# Data Model: ADR-022 RAG

**Date**: 2026-04-19 | **Phase**: 1 — Design

---

## 1. MariaDB Schema

### 1.1 Schema Delta — `attachments` table (ADR-009: แก้ SQL โดยตรง)

```sql
-- specs/03-Data-and-Storage/deltas/06-add-rag-status-to-attachments.sql
ALTER TABLE attachments
  ADD COLUMN rag_status ENUM('PENDING', 'PROCESSING', 'INDEXED', 'FAILED')
    NOT NULL DEFAULT 'PENDING'
    COMMENT 'สถานะ RAG ingestion ระดับ file',
  ADD COLUMN rag_last_error TEXT NULL
    COMMENT 'Error message ล่าสุดเมื่อ rag_status = FAILED',
  ADD INDEX idx_attachments_rag_status (rag_status);
```

**Lifecycle transitions**:
```
PENDING → PROCESSING → INDEXED
                     ↘ FAILED (retry → PROCESSING → ... max 3 times)
```

### 1.2 New Table — `document_chunks`

```sql
-- specs/03-Data-and-Storage/deltas/06b-create-document-chunks.sql
CREATE TABLE document_chunks (
  id              CHAR(36)      NOT NULL PRIMARY KEY COMMENT 'UUID = Qdrant point ID',
  document_id     CHAR(36)      NOT NULL COMMENT 'FK → attachments.public_id (UUIDv7)',
  chunk_index     INT           NOT NULL COMMENT 'ลำดับ chunk ภายใน document',
  content         TEXT          NOT NULL COMMENT 'เนื้อหา chunk หลัง PyThaiNLP normalize',
  doc_type        VARCHAR(20)   NOT NULL COMMENT 'CORR, RFA, DRAWING, CONTRACT, RPT, TRANS',
  doc_number      VARCHAR(100)  NULL     COMMENT 'หมายเลขเอกสาร เช่น REF-2026-001',
  revision        VARCHAR(20)   NULL     COMMENT 'Revision เช่น Rev.A',
  project_code    VARCHAR(50)   NOT NULL COMMENT 'รหัสโครงการ (ใช้ filter)',
  project_public_id CHAR(36)   NOT NULL COMMENT 'UUIDv7 ของโครงการ (Qdrant tenant key)',
  version         VARCHAR(20)   NULL     COMMENT 'เวอร์ชันเอกสาร เช่น 1.0, 2.1 (ถ้ามี)',
  classification  ENUM('PUBLIC', 'INTERNAL', 'CONFIDENTIAL')
                               NOT NULL DEFAULT 'INTERNAL',
  embedding_model VARCHAR(100)  NOT NULL DEFAULT 'nomic-embed-text',
  created_at      DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  INDEX idx_chunks_document_id     (document_id),
  INDEX idx_chunks_doc_number_rev  (doc_number, revision),
  INDEX idx_chunks_project         (project_public_id),
  FULLTEXT INDEX ft_chunks_content (content)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

> ⚠️ `document_chunks` เก็บ chunks ที่ indexed แล้วเท่านั้น — **ห้าม** เพิ่ม `rag_status` ในนี้

---

## 2. Qdrant Vector Store

### 2.1 Collection: `lcbp3_vectors`

```typescript
// VectorMetadata payload interface (TypeScript)
interface VectorMetadata {
  chunk_id: string;          // UUID = document_chunks.id
  public_id: string;         // UUIDv7 ของ attachment (document)
  project_public_id: string; // UUIDv7 ของโครงการ (tenant key — mandatory filter)
  doc_type: string;          // CORR, RFA, DRAWING, etc.
  doc_number: string | null;
  revision: string | null;
  project_code: string;
  classification: 'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL';
  content_preview: string;   // ตัดสั้นๆ สำหรับ UI (max 200 chars)
  embedding_model: string;   // nomic-embed-text
}
```

### 2.2 Collection Setup

```typescript
// qdrant.service.ts — createCollectionIfNotExists()
{
  vectors: { size: 768, distance: 'Cosine' },
  hnsw_config: {
    payload_m: 16,  // tenant-aware HNSW index
    m: 0,           // ปิด global HNSW index
  },
  optimizers_config: { indexing_threshold: 10000 },
}

// Payload indexes
{ field_name: 'project_public_id', field_schema: { type: 'keyword', is_tenant: true } }
{ field_name: 'classification',    field_schema: 'keyword' }
{ field_name: 'doc_type',          field_schema: 'keyword' }
{ field_name: 'doc_number',        field_schema: 'keyword' }
```

---

## 3. TypeORM Entity

### 3.1 `DocumentChunk` Entity

```typescript
// backend/src/modules/rag/entities/document-chunk.entity.ts
@Entity('document_chunks')
export class DocumentChunk {
  @PrimaryColumn({ type: 'char', length: 36 })
  id: string; // UUID = Qdrant point ID

  @Column({ type: 'char', length: 36, name: 'document_id' })
  documentId: string; // FK → attachments.public_id

  @Column({ name: 'chunk_index' })
  chunkIndex: number;

  @Column({ type: 'text' })
  content: string;

  @Column({ length: 20, name: 'doc_type' })
  docType: string;

  @Column({ length: 100, name: 'doc_number', nullable: true })
  docNumber: string | null;

  @Column({ length: 20, nullable: true })
  revision: string | null;

  @Column({ length: 50, name: 'project_code' })
  projectCode: string;

  @Column({ length: 36, name: 'project_public_id' })
  projectPublicId: string;

  @Column({
    type: 'enum',
    enum: ['PUBLIC', 'INTERNAL', 'CONFIDENTIAL'],
    default: 'INTERNAL',
  })
  classification: 'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL';

  @Column({ length: 20, nullable: true })
  version: string | null;

  @Column({ length: 100, name: 'embedding_model', default: 'nomic-embed-text' })
  embeddingModel: string;

  @CreateDateColumn({ name: 'created_at', precision: 3 })
  createdAt: Date;
}
```

---

## 4. DTO Interfaces

### 4.1 RAG Query DTO

```typescript
// rag-query.dto.ts
export class RagQueryDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  question: string;

  @IsUUID()
  projectPublicId: string; // mandatory — enforces tenant isolation

  @IsOptional()
  @IsEnum(['PUBLIC', 'INTERNAL', 'CONFIDENTIAL'])
  maxClassification?: 'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL';
}
```

### 4.2 RAG Response DTO

```typescript
// rag-response.dto.ts
export class RagResponseDto {
  answer: string;
  citations: Array<{
    chunkId: string;
    docNumber: string | null;
    docType: string;
    revision: string | null;
    snippet: string;
    score: number;
  }>;
  confidence: number;       // 0.0 – 1.0
  fallbackUsed: boolean;    // true = Ollama fallback ถูกใช้แทน Typhoon
  latencyMs: number;
}
```

---

## 5. State Transitions

### `rag_status` in `attachments`

```
[file committed to permanent storage]
         ↓
    PENDING (default)
         ↓ (BullMQ: rag:ocr job created)
    PROCESSING
         ↓
    ┌────────────┐
    │  SUCCESS   │ → INDEXED
    └────────────┘
    ┌────────────┐
    │  FAILURE   │ → retry ≤ 3 → PROCESSING → ...
    └────────────┘
              ↓ (after 3 failures)
           FAILED (rag_last_error populated)
```

**Trigger**: hook ใน `StorageService.commitFile()` → enqueue `rag:ocr` job

---

## 6. Relationships

```
attachments (1) ──────────── (N) document_chunks
  .public_id  ←─── document_chunks.document_id

projects (1) ─────────────── (N) document_chunks
  .public_id  ←─── document_chunks.project_public_id

document_chunks (1) ──────── (1) Qdrant point
  .id         ←─── Qdrant payload.chunk_id
```
