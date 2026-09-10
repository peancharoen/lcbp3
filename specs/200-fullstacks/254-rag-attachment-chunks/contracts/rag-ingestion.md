# Contract: RAG Attachment Ingestion

## Enqueue

```http
POST /api/ai/rag/attachments/{attachmentPublicId}/ingest
Idempotency-Key: <uuid>
Authorization: Bearer <jwt>
Content-Type: application/json
```

Request:

```json
{
  "force": false
}
```

Rules:

- Requires CASL permission for the owning Project and RAG ingestion.
- Attachment must be committed and have a SHA-256 checksum.
- A request for an Attachment with no checksum is deferred/rejected with a recovery message.
- The job is idempotent by Attachment checksum and active generation state.

Response `202`:

```json
{
  "attachmentPublicId": "019...",
  "status": "BUILDING",
  "jobId": "rag-prepare:019...:checksum"
}
```

Generation UUIDs are internal and are not exposed through this public API response or ordinary frontend citation responses.

## Generation Status

```http
GET /api/ai/rag/attachments/{attachmentPublicId}/status
Authorization: Bearer <jwt>
```

Response:

```json
{
  "attachmentPublicId": "019...",
  "status": "ACTIVE",
  "chunkCount": 42,
  "indexedAt": "2026-09-09T18:00:00.000Z",
  "lastError": null
}
```

Technical error details are logged; user responses contain recovery guidance only.
