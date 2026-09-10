// File: specs/200-fullstacks/255-rag-admin-console/contracts/rag-admin-api.md
// Change Log:
// - 2026-09-10: Initial API contracts for Feature 255 RAG Admin Console
// - 2026-09-10: Updated with interview decisions Q1-Q45 (route prefix, 8 endpoints, 4 permissions, status enum, response formats)

# API Contracts: RAG Admin Console

Base path: `/ai/admin/rag`
Auth: JWT (JwtAuthGuard) + CASL (RbacGuard)
All read-only endpoints require `rag.manage` permission unless noted otherwise.
Mutation endpoints have additional permissions as noted.
Operations that enqueue BullMQ jobs have method-level `AiEnabledGuard`.

## US1: Ingestion Status Dashboard

### GET /ai/admin/rag/attachments

List all attachments with RAG ingestion status (left join — includes attachments without generations).

**Permission**: `rag.manage`

**Query Parameters**:
| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| projectPublicId | UUIDv7 | No | — | Filter by project |
| status | ENUM | No | — | NOT_STARTED, BUILDING, ACTIVE, RETIRED, FAILED |
| page | number | No | 1 | Page number |
| pageSize | number | No | 20 | Items per page (enum: 10, 20, 50 — other values rejected) |

**Response 200**:
```json
{
  "items": [
    {
      "attachmentPublicId": "0195...",
      "originalFilename": "drawing-001.pdf",
      "mimeType": "application/pdf",
      "ragStatus": "ACTIVE",
      "aiProcessingStatus": "DONE",
      "chunkCount": 42,
      "effectiveClassification": "INTERNAL",
      "classificationOverride": null,
      "lastUpdated": "2026-09-10T10:30:00.000Z",
      "errorMessage": null
    }
  ],
  "total": 150,
  "page": 1,
  "pageSize": 20
}
```

**Notes**:
- `ragStatus`: computed on-the-fly via left join + `ROW_NUMBER() OVER (PARTITION BY attachmentUuid ORDER BY createdAt DESC)` — no stored field
- `aiProcessingStatus`: from `Attachment.aiProcessingStatus` (PENDING/PROCESSING/DONE/FAILED) — shown as supplementary column
- `classificationOverride`: object from latest audit log entry or `null` if never overridden
- `NOT_STARTED`: attachment exists but has no generation record

## US2: Classification Override UI

### GET /ai/admin/rag/attachments/classification

List all attachments with classification + override info (separate query from dashboard — joins audit log).

**Permission**: `rag.manage`

**Query Parameters**:
| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| projectPublicId | UUIDv7 | No | — | Filter by project |
| page | number | No | 1 | Page number |
| pageSize | number | No | 20 | Items per page (enum: 10, 20, 50) |

**Response 200**:
```json
{
  "items": [
    {
      "attachmentPublicId": "0195...",
      "originalFilename": "drawing-001.pdf",
      "effectiveClassification": "CONFIDENTIAL",
      "classificationOverride": {
        "reason": "Document contains sensitive project financials",
        "overriddenBy": "0195...",
        "overriddenAt": "2026-09-10T09:00:00.000Z"
      }
    }
  ],
  "total": 150,
  "page": 1,
  "pageSize": 20
}
```

### PATCH /ai/rag/attachments/:attachmentPublicId/classification

_Existing endpoint (Feature 254) — no changes needed. Frontend calls this directly from Classification tab._

**Permission**: `document.classification_override`

**Request Body**:
```json
{
  "classification": "CONFIDENTIAL",
  "reason": "Document contains sensitive project financials"
}
```

**Response 200**:
```json
{
  "attachmentPublicId": "0195...",
  "classification": "CONFIDENTIAL"
}
```

## US3: Generation Lifecycle Viewer

### GET /ai/admin/rag/attachments/:attachmentPublicId/generations

List all generations for an attachment (timeline, ordered by `createdAt DESC`).

**Permission**: `rag.manage`

**Path Parameters**:
| Param | Type | Description |
|-------|------|-------------|
| attachmentPublicId | UUIDv7 | Attachment public ID |

**Response 200**:
```json
{
  "attachmentPublicId": "0195...",
  "generations": [
    {
      "status": "ACTIVE",
      "chunkCount": 42,
      "createdAt": "2026-09-10T10:00:00.000Z",
      "activatedAt": "2026-09-10T10:02:30.000Z",
      "retiredAt": null,
      "failedAt": null,
      "errorCode": null,
      "errorMessage": null
    },
    {
      "status": "RETIRED",
      "chunkCount": 38,
      "createdAt": "2026-09-09T14:00:00.000Z",
      "activatedAt": "2026-09-09T14:03:00.000Z",
      "retiredAt": "2026-09-10T10:02:30.000Z",
      "failedAt": null,
      "errorCode": null,
      "errorMessage": null
    }
  ]
}
```

**Notes**:
- `generationUuid` is NOT exposed (FR-014)
- `chunkCount` computed via `COUNT(*) GROUP BY generationUuid` in single SQL query

### POST /ai/admin/rag/attachments/:attachmentPublicId/reingest

Force re-ingest an attachment. Delegates to `RagAttachmentIngestionService.ingest()`.

**Permission**: `rag.admin.write`
**Guards**: `JwtAuthGuard` + `RbacGuard` + `AiEnabledGuard` (method-level)
**Headers**: `Idempotency-Key` (required)
**Audit**: `rag.admin.reingest` / `rag_attachment`

**Request Body**: none (empty)

**Response 202**:
```json
{
  "attachmentPublicId": "0195...",
  "status": "BUILDING",
  "jobId": "job-uuid"
}
```

**Error 409** (if BUILDING generation already exists):
```json
{
  "errorCode": "RAG_BUILDING_IN_PROGRESS",
  "userMessage": "กำลัง ingest อยู่ กรุณารอให้เสร็จก่อน",
  "recoveryAction": "Please wait for the current ingestion to complete before retrying"
}
```

## US4: Observability Metrics Dashboard

### GET /ai/admin/rag/metrics

Get observability metrics snapshot (global, in-memory).

**Permission**: `rag.manage`

**Response 200**:
```json
{
  "swap": { "started": 10, "completed": 9, "rolledBack": 1, "activeConcurrent": 0, "maxConcurrent": 2 },
  "qdrantDeletion": { "attempted": 50, "succeeded": 48, "partialFailures": 2, "totalPendingRetries": 0 },
  "cleanup": { "processed": 30, "succeeded": 28, "failed": 2 },
  "ingestionDuration": { "count": 100, "sumMs": 25000, "buckets": { "100": 30, "500": 50, "2000": 20 } },
  "chunkCount": { "totalChunks": 4200, "ingestions": 100 },
  "vectorLatency": { "count": 200, "sumMs": 5000, "buckets": { "50": 100, "100": 60, "500": 30, "2000": 10 } },
  "staleResultRate": { "filtered": 15, "total": 200 },
  "fallbackRate": { "fullTextFallbacks": 5, "totalQueries": 200 },
  "cleanupRetryRate": { "retries": 3 },
  "uptimeMs": 3600000
}
```

### POST /ai/admin/rag/metrics/reset

Reset all observability metrics globally.

**Permission**: `rag.admin.write`
**Guards**: `JwtAuthGuard` + `RbacGuard` (no AiEnabledGuard — pure in-memory operation)
**Audit**: `rag.admin.metrics_reset` / `rag_observability`
**Idempotency-Key**: Not required (operation is inherently idempotent)

**Request Body**: none (empty)

**Response 200**:
```json
{
  "reset": true,
  "scope": "global"
}
```

**Note**: Per-project reset is NOT supported — metrics are in-memory system-level aggregates without per-project partitioning.

## US5: Failed Ingestion Retry Management

### GET /ai/admin/rag/failed-ingestions

List failed ingestions in 2 sections: RAG failures (retryable) + AI pipeline failures (read-only).

**Permission**: `rag.manage`

**Query Parameters**:
| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| projectPublicId | UUIDv7 | No | — | Filter by project (applies to section 1 only) |
| page | number | No | 1 | Page number (applies to section 1 only) |
| pageSize | number | No | 20 | Items per page (enum: 10, 20, 50 — section 1 only) |

**Response 200**:
```json
{
  "ragFailures": {
    "items": [
      {
        "attachmentPublicId": "0195...",
        "originalFilename": "corrupted.pdf",
        "ragStatus": "FAILED",
        "errorCode": "OCR_TIMEOUT",
        "errorMessage": "OCR processing timed out after 60s",
        "failedAt": "2026-09-10T08:00:00.000Z"
      }
    ],
    "total": 5,
    "page": 1,
    "pageSize": 20
  },
  "aiPipelineFailures": {
    "items": [
      {
        "attachmentPublicId": "0195...",
        "originalFilename": "broken.pdf",
        "aiProcessingStatus": "FAILED",
        "errorMessage": "OCR extraction failed: corrupted PDF structure"
      }
    ],
    "total": 3
  }
}
```

**Notes**:
- Section 1 (`ragFailures`): `RagAttachmentGeneration.status = 'FAILED'` — paginated, retryable
- Section 2 (`aiPipelineFailures`): `Attachment.aiProcessingStatus = 'FAILED'` — not paginated (all items), read-only (no retry button)

### POST /ai/admin/rag/failed-ingestions/retry

Batch retry failed RAG ingestions. Partial-success — each item processed independently.

**Permission**: `rag.retry`
**Guards**: `JwtAuthGuard` + `RbacGuard` + `AiEnabledGuard` (method-level)
**Headers**: `Idempotency-Key` (required — for audit trail; BullMQ jobId handles dedup)
**Audit**: `rag.admin.batch_retry` / `rag_attachment`

**Request Body**:
```json
{
  "attachmentPublicIds": ["0195...", "0195..."]
}
```

**Validation**: `@IsArray()` + `@IsUuid('7', { each: true })` + `@ArrayMaxSize(50)`

**Response 202**:
```json
{
  "succeeded": [
    { "attachmentPublicId": "0195...", "jobId": "job-123" }
  ],
  "failed": [
    { "attachmentPublicId": "0195...", "reason": "Attachment not in FAILED state (current: BUILDING)" }
  ],
  "totalRequested": 2,
  "totalSucceeded": 1,
  "totalFailed": 1
}
```

**Notes**:
- Only `FAILED` generations are retried — other statuses go to `failed[]` with reason
- Each retry: mark FAILED→RETIRED, then `ingest(attachmentPublicId, true)` + enqueue BullMQ job
- BullMQ `jobId` dedup prevents duplicate jobs for same attachment
- 1 BullMQ job per attachment (not batch job)

## Permission Requirements Summary

| Endpoint | Permission | AiEnabledGuard | Audit |
|----------|-----------|----------------|-------|
| GET /ai/admin/rag/attachments | `rag.manage` | No | No |
| GET /ai/admin/rag/attachments/classification | `rag.manage` | No | No |
| GET /ai/admin/rag/attachments/:id/generations | `rag.manage` | No | No |
| POST /ai/admin/rag/attachments/:id/reingest | `rag.admin.write` | Yes (method) | Yes |
| PATCH /ai/rag/attachments/:id/classification | `document.classification_override` | No | Yes (service) |
| GET /ai/admin/rag/metrics | `rag.manage` | No | No |
| POST /ai/admin/rag/metrics/reset | `rag.admin.write` | No | Yes |
| GET /ai/admin/rag/failed-ingestions | `rag.manage` | No | No |
| POST /ai/admin/rag/failed-ingestions/retry | `rag.retry` | Yes (method) | Yes |

## Permission Grants

| Permission | Superadmin | Org Admin | Document Control |
|-----------|-----------|-----------|------------------|
| `rag.manage` | Yes | No | No |
| `rag.admin.write` | Yes | No | No |
| `document.classification_override` | Yes | No | No |
| `rag.retry` | Yes | Yes | No |
