# Quickstart: RAG Attachment Chunks

## Scope

This feature replaces the ambiguous RAG `document_chunks` concept with Attachment-scoped generations, page/segment persistence, chunks, Qdrant points, active-generation guards, and citations.

## Prerequisites

- Attachment is committed to permanent storage.
- ClamAV scan has passed.
- Attachment has a SHA-256 checksum.
- Owning document and owning Project are resolvable.
- BGE-M3 embedding configuration is available.
- MariaDB, Redis/BullMQ, and Qdrant are healthy.

## Ingestion Flow

1. Resolve Attachment by `attachmentPublicId`.
2. Acquire `rag:attachment:{attachmentPublicId}` Redlock.
3. Read current Attachment checksum and verify the file.
4. Create a `BUILDING` generation with a new `generation_uuid`.
5. Produce normalized `TextSegment[]` values.
6. Persist canonical rows in `rag_attachment_pages`.
7. Split segments into 512-token chunks with 64-token overlap.
8. Persist `rag_attachment_chunks` with page/segment offsets and metadata snapshots.
9. Create BGE-M3 dense+sparse embeddings.
10. Upsert Qdrant points with owning `project_public_id`.
11. In a database transaction, activate the new generation and retire the previous one.
12. Enqueue cleanup for the retired generation.
13. Release the Redlock.

## Failure Handling

- Checksum mismatch → mark generation `FAILED`; do not activate.
- OCR/segment failure → mark generation `FAILED`; retry with a new generation UUID.
- Qdrant upsert failure → keep the generation `BUILDING` or mark `FAILED` according to the worker retry policy; do not activate incomplete vectors.
- Retired vector cleanup failure → retain RETIRED rows and retry through BullMQ.
- Retrieval stale result → skip it; use full-text fallback if no ACTIVE result remains.

## Verification Scenarios

1. One PDF Attachment creates ordered chunks with PAGE citations.
2. One non-page file creates SECTION/SHEET/WHOLE_DOCUMENT citations without fabricated page numbers.
3. A checksum change creates a new generation and leaves one ACTIVE generation.
4. Two concurrent ingestion jobs produce one ACTIVE generation.
5. A receiving Project cannot retrieve a distributed-only Attachment through RAG.
6. ZIP traversal/encrypted/malware/oversized fixtures are rejected.
7. Metadata-only update changes Qdrant payload without re-embedding.
8. Classification downgrade requires Security/System Admin permission and an audit record.

## Verification: Ingestion

> Ledger checkpoint: implementation covered by `CP-017` in [`ledger.md`](./ledger.md) (Wave 3 refactor — ingestion service, processor, controller). Run the commands below against a running backend with MariaDB, Redis/BullMQ, and Qdrant healthy.

### 1. Trigger ingestion manually

`POST /ai/rag/attachments/:attachmentPublicId/ingest` starts an asynchronous generation. The `Idempotency-Key` header is **required** (ADR-016). The response is `202 Accepted` and never exposes the internal `generationUuid`.

```bash
curl -X POST "http://localhost:3000/ai/rag/attachments/019505a1-7c3e-7000-8000-abc123def456/ingest" \
  -H "Authorization: Bearer <JWT>" \
  -H "Idempotency-Key: $(uuidgen)" \
  -H "Content-Type: application/json" \
  -d '{}'
```

Expected response (`202`):

```json
{
  "attachmentPublicId": "019505a1-7c3e-7000-8000-abc123def456",
  "status": "BUILDING",
  "jobId": "<bullmq-job-id>"
}
```

When an `ACTIVE` generation already exists for the same checksum and `force` is not set, the endpoint is idempotent: it returns the existing generation with `status: "ACTIVE"` and enqueues no new build.

### 2. Force a re-ingest

Pass `"force": true` to build a new generation even when the checksum is unchanged (e.g. after a metadata-only change that requires fresh Qdrant payload). The previous `ACTIVE` generation is retired and cleaned up.

```bash
curl -X POST "http://localhost:3000/ai/rag/attachments/019505a1-7c3e-7000-8000-abc123def456/ingest" \
  -H "Authorization: Bearer <JWT>" \
  -H "Idempotency-Key: $(uuidgen)" \
  -H "Content-Type: application/json" \
  -d '{"force": true}'
```

### 3. Check ingestion status

`GET /ai/rag/attachments/:attachmentPublicId/status` returns the latest generation state and chunk count without exposing the generation UUID.

```bash
curl -X GET "http://localhost:3000/ai/rag/attachments/019505a1-7c3e-7000-8000-abc123def456/status" \
  -H "Authorization: Bearer <JWT>"
```

Expected response while building:

```json
{
  "attachmentPublicId": "019505a1-7c3e-7000-8000-abc123def456",
  "status": "BUILDING",
  "chunkCount": 0
}
```

Expected response once active:

```json
{
  "attachmentPublicId": "019505a1-7c3e-7000-8000-abc123def456",
  "status": "ACTIVE",
  "chunkCount": 12,
  "indexedAt": "2026-09-10T08:30:00.000Z"
}
```

When no generation exists yet:

```json
{
  "attachmentPublicId": "019505a1-7c3e-7000-8000-abc123def456",
  "status": "NOT_STARTED",
  "chunkCount": 0
}
```

On failure, `status` is `FAILED` and `lastError` carries the stored error message (technical detail is logged server-side per ADR-007; the user-facing message is layered).

### 4. Automatic post-commit trigger (T031)

When an Attachment is committed to permanent storage via `FileStorageService.commit()`, the backend automatically enqueues a RAG Attachment Ingestion job into the `ai-batch` BullMQ queue (`AiQueueService.enqueueRagAttachmentIngestion`) — no manual call is required for the normal upload flow.

Behavior:

- **Fire-and-forget:** the trigger runs after the commit succeeds. If enqueue fails, the commit **still succeeds**; the operator can re-trigger ingestion manually via `POST /ingest` (ADR-007 error swallowing).
- **Checksum guard:** the trigger only fires for Attachments that have a verified SHA-256 checksum (committed Attachments always do).
- **Idempotent:** `force: false` is sent, so a duplicate trigger for an unchanged checksum reuses the existing `ACTIVE` generation instead of rebuilding.
- **Lazy lookup:** `AiQueueService` is resolved via NestJS `ModuleRef` (non-strict) to avoid a circular module dependency between `FileStorageModule` and `AiModule`.

You can observe the trigger in the backend logs:

```
Enqueued RAG attachment ingestion for publicId=019505a1-... checksum=abc123...
```

### 5. Error cases

| Case | HTTP | Cause | Recovery |
| --- | --- | --- | --- |
| Missing `Idempotency-Key` header | `400` | `POST /ingest` without the header | Re-send with a unique `Idempotency-Key` |
| No checksum on Attachment | `400` | Attachment has no verified SHA-256 checksum | Wait for/complete the upload+scan flow so a checksum is recorded |
| Checksum mismatch with `BUILDING` generation | `400` | File changed while a build is in progress | Start a fresh ingestion (new `Idempotency-Key`) |
| Attachment not found | `404` | `attachmentPublicId` does not exist | Verify the UUID and that the Attachment is committed |

Example missing-key response (`400`):

```json
{
  "message": "Idempotency-Key header is required",
  "errors": [
    { "field": "Idempotency-Key", "message": "ต้องระบุ Idempotency-Key header" }
  ]
}
```

Example no-checksum response (`400`):

```json
{
  "message": "ไฟล์ยังไม่พร้อมสำหรับการประมวลผล RAG",
  "errors": [
    { "field": "checksum", "message": "ไฟล์ยังไม่มี checksum ที่ตรวจสอบแล้ว" }
  ]
}
```

> None of the ingestion or status responses expose the internal `generationUuid`; callers reference Attachments by `attachmentPublicId` only (ADR-019).
