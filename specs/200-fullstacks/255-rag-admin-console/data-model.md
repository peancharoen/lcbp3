// File: specs/200-fullstacks/255-rag-admin-console/data-model.md
// Change Log:
// - 2026-09-10: Initial data model for Feature 255 RAG Admin Console
// - 2026-09-10: Updated with interview decisions Q1-Q45 (status enum, aiProcessingStatus, classificationOverride object, 2-section failed list, state transitions)

# Data Model: RAG Admin Console

## Overview

Feature 255 ไม่มี entity ใหม่ — ใช้ entities ที่มีอยู่ของ Feature 254 ทั้งหมด การเปลี่ยนแปลงคือเพิ่ม DTOs สำหรับ admin-facing API contracts

## Existing Entities (no changes)

### RagAttachmentGeneration

| Field | Type | Notes |
|-------|------|-------|
| generationUuid | UUID (PK) | Internal — ไม่ expose ใน admin UI (FR-014) |
| attachmentUuid | UUID (FK) | Exposed as `attachmentPublicId` |
| attachmentChecksumSnapshot | CHAR(64) | SHA-256 snapshot |
| status | ENUM('BUILDING','ACTIVE','RETIRED','FAILED') | Lifecycle status |
| embeddingModel | VARCHAR(100) | Default: bge-m3 |
| errorCode | VARCHAR(100) NULL | Error code ถ้า FAILED |
| errorMessage | TEXT NULL | Error message ถ้า FAILED |
| createdAt | DATETIME(3) | Generation created |
| activatedAt | DATETIME(3) NULL | When generation became ACTIVE |
| retiredAt | DATETIME(3) NULL | When generation was RETIRED |
| failedAt | DATETIME(3) NULL | When generation FAILED |

### Attachment (existing — no schema change)

| Field | Type | Notes |
|-------|------|-------|
| publicId | UUIDv7 | Exposed as `attachmentPublicId` |
| originalFilename | VARCHAR(255) | Original filename |
| mimeType | VARCHAR(100) | MIME type |
| checksum | CHAR(64) NULL | SHA-256 checksum |
| classification | ENUM('PUBLIC','INTERNAL','CONFIDENTIAL') | Security classification (default: INTERNAL) |
| aiProcessingStatus | ENUM('PENDING','PROCESSING','DONE','FAILED') | AI pipeline status (shown as supplementary column) |

### RagAttachmentChunk

| Field | Type | Notes |
|-------|------|-------|
| chunkPublicId | UUID (PK) | Exposed in citations |
| generationUuid | UUID (FK) | Internal — ไม่ expose ใน admin UI |
| attachmentUuid | UUID (FK) | Exposed as `attachmentPublicId` |
| chunkIndex | INT | Order within generation |
| content | TEXT | Chunk text content |
| segmentType | ENUM('PAGE','SECTION','SHEET','WHOLE_DOCUMENT') | Segment type |
| classification | ENUM('PUBLIC','INTERNAL','CONFIDENTIAL') | Security classification |
| projectPublicId | UUID | Multi-tenant isolation key |

### RagAttachmentPage

| Field | Type | Notes |
|-------|------|-------|
| pageUuid | UUID (PK) | Internal |
| generationUuid | UUID (FK) | Internal |
| attachmentUuid | UUID (FK) | Exposed |
| segmentType | ENUM | Same as chunk |
| normalizedText | LONGTEXT | Canonical text |
| sourceLocator | VARCHAR(1000) | ZIP path or locator |

## New DTOs

### RagAdminListAttachmentsDto (Query)

```typescript
class RagAdminListAttachmentsDto {
  projectPublicId?: string;      // Filter by project (UUIDv7)
  status?: 'NOT_STARTED' | 'BUILDING' | 'ACTIVE' | 'RETIRED' | 'FAILED';  // Filter by RAG status (NOT_STARTED = no generation exists — filter via LEFT JOIN WHERE generationUuid IS NULL)
  page?: number;                 // Default: 1
  pageSize?: number;             // Default: 20, enum: [10, 20, 50] — other values rejected
}
```

### RagAdminAttachmentsResponseDto

```typescript
class RagAdminAttachmentsResponseDto {
  items: Array<{
    attachmentPublicId: string;
    originalFilename: string;
    mimeType: string;
    ragStatus: 'NOT_STARTED' | 'BUILDING' | 'ACTIVE' | 'RETIRED' | 'FAILED';
    aiProcessingStatus: 'PENDING' | 'PROCESSING' | 'DONE' | 'FAILED';  // Supplementary column (Q7)
    chunkCount: number;
    effectiveClassification: 'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL';
    classificationOverride: {
      reason: string;
      overriddenBy: string;   // user publicId
      overriddenAt: Date;
    } | null;                  // From latest audit log entry (Q11)
    lastUpdated: Date;
    errorMessage?: string;
  }>;
  total: number;
  page: number;
  pageSize: number;
}
```

### RagAdminClassificationListResponseDto (Q43 — separate endpoint)

```typescript
class RagAdminClassificationListResponseDto {
  items: Array<{
    attachmentPublicId: string;
    originalFilename: string;
    effectiveClassification: 'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL';
    classificationOverride: {
      reason: string;
      overriddenBy: string;
      overriddenAt: Date;
    } | null;
  }>;
  total: number;
  page: number;
  pageSize: number;
}
```

### RagAdminGenerationsResponseDto

```typescript
class RagAdminGenerationsResponseDto {
  attachmentPublicId: string;
  generations: Array<{
    status: 'BUILDING' | 'ACTIVE' | 'RETIRED' | 'FAILED';
    chunkCount: number;          // Computed via COUNT(*) GROUP BY generationUuid (Q26)
    createdAt: Date;
    activatedAt?: Date;
    retiredAt?: Date;
    failedAt?: Date;
    errorCode?: string;
    errorMessage?: string;
    // generationUuid is NOT included (FR-014)
  }>;
}
```

### RagAdminMetricsSnapshotDto

```typescript
class RagAdminMetricsSnapshotDto {
  swap: { started: number; completed: number; rolledBack: number; activeConcurrent: number; maxConcurrent: number };
  qdrantDeletion: { attempted: number; succeeded: number; partialFailures: number; totalPendingRetries: number };
  cleanup: { processed: number; succeeded: number; failed: number };
  ingestionDuration: { count: number; sumMs: number; buckets: { '100': number; '500': number; '2000': number } };
  chunkCount: { totalChunks: number; ingestions: number };
  vectorLatency: { count: number; sumMs: number; buckets: { '50': number; '100': number; '500': number; '2000': number } };
  staleResultRate: { filtered: number; total: number };
  fallbackRate: { fullTextFallbacks: number; totalQueries: number };
  cleanupRetryRate: { retries: number };
  uptimeMs: number;
}
```

### RagAdminBatchRetryDto

```typescript
class RagAdminBatchRetryDto {
  attachmentPublicIds: string[];   // Array of UUIDv7 — max 50 (@ArrayMaxSize(50))
}
```

### RagAdminFailedIngestionsResponseDto (Q31 — 2 sections in 1 response)

```typescript
class RagAdminFailedIngestionsResponseDto {
  ragFailures: {
    items: Array<{
      attachmentPublicId: string;
      originalFilename: string;
      ragStatus: 'FAILED';
      errorCode?: string;
      errorMessage?: string;
      failedAt?: Date;
    }>;
    total: number;
    page: number;
    pageSize: number;
  };
  aiPipelineFailures: {
    items: Array<{
      attachmentPublicId: string;
      originalFilename: string;
      aiProcessingStatus: 'FAILED';
      errorMessage?: string;
    }>;
    total: number;
    // Not paginated — all items returned (Q32)
  };
}
```

## State Transitions (updated — Q35)

```
BUILDING → ACTIVE (ingestion success)
BUILDING → FAILED (ingestion failure)
ACTIVE → RETIRED (new generation activated)
FAILED → RETIRED (before retry — mark old FAILED as RETIRED, then create new BUILDING)
```

**Retry flow** (Q35-Q36):
1. Find latest FAILED generation for attachment
2. Mark FAILED → RETIRED (`retiredAt = now()`)
3. Call `ingest(attachmentPublicId, true)` → creates new BUILDING generation
4. Enqueue BullMQ job
5. `cleanupRetiredGenerations()` Cron will clean up RETIRED records after 24h

## Validation Rules

- `attachmentPublicId` ต้องเป็น UUIDv7 (ใช้ ParseUuidPipe)
- `pageSize` ต้องเป็น 10, 20, หรือ 50 (enum validation — ค่าอื่น rejected)
- `status` ต้องเป็นหนึ่งใน NOT_STARTED, BUILDING, ACTIVE, RETIRED, FAILED (หมายเหตุ: `NOT_STARTED` เป็น computed status — filter implementation ต้องใช้ `LEFT JOIN ... WHERE generationUuid IS NULL` เพื่อหา attachments ที่ไม่มี generation)
- `projectPublicId` ถ้าระบุ ต้องเป็น UUIDv7 ที่มีอยู่
- Batch retry ต้องมีอย่างน้อย 1 attachment และไม่เกิน 50 (`@ArrayMaxSize(50)`)
- `attachmentPublicIds` แต่ละตัวต้องเป็น UUIDv7 (`@IsUuid('7', { each: true })`)
- Force re-ingest ถ้ามี BUILDING อยู่แล้ว → 409 Conflict (ไม่ใช่ BusinessException 400)
- Metrics reset: ไม่มี request body (global-only, no projectPublicId)
