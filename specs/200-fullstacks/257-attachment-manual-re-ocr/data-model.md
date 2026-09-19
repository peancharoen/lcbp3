# Data Model: Attachment Manual Re-OCR

**Schema changes: none** (ADR-044 — no delta SQL). Existing `attachments` columns are read/updated; temporary state is in Redis.

## MariaDB — `attachments` (existing)

| Column | Use in this feature |
|--------|---------------------|
| `public_id` | identifier in all endpoints (ADR-019) |
| `mime_type`, `file_path` | D12 guards (PDF-only → 422; file exists → 410) |
| `ai_processing_status` | D9 guard (`PROCESSING`→409); set `DONE` at confirm; DONE is terminal for ingestion writes |
| `ocr_text` | replaced only at confirm; read for `identical`/shrink comparison |
| `rag_status`, `rag_last_error` | set `PENDING` / `NULL` at confirm; then existing pipeline drives `INDEXED`/`FAILED` |

Confirm transaction:

```sql
UPDATE attachments
SET ocr_text=:newText, rag_status='PENDING', rag_last_error=NULL, ai_processing_status='DONE'
WHERE public_id=:publicId;   -- affected rows = 0 → 404
```

## Redis (TTL 72h each)

**Status pointer** `attachment:re-ocr:{publicId}` (latest job)

| Field | Type | Notes |
|-------|------|-------|
| status | `queued`\|`processing`\|`completed`\|`failed` | |
| reOcrToken | string (UUID) | |
| jobId | string | `re-ocr:{publicId}:{token}` |
| engineType | `auto`\|`np-dms-ocr` | |
| triggeredByDisplayName, triggeredAt | string, ISO | shown as "started by" |
| attempt | number? | while retrying |
| errorMessage | string? | failed only |
| updatedAt | ISO | |

Note: the `warning:'RESULT_MUCH_SHORTER'` (new < 50% of current) and `identical` flag are computed by the service at status-read time (it has the attachment row); the processor has no DB access.

**Payload** `attachment:re-ocr:{publicId}:{reOcrToken}` (written on success only)

| Field | Type |
|-------|------|
| newText | string (non-empty) |
| engineUsed | string |
| charCount | number |
| processingTimeMs | number |
| completedAt | ISO |

Also written by processor for polling clients: `ai:np-dms-ocr:{idempotencyKey}` (`{status:'failed', errorMessage, failedAt}` — D10 bugfix).

## Job data — `NpDmsOcrJobData` (extended, D15)

Existing: `pdfPath`, `engineType`, `idempotencyKey` (= `reOcrToken` for re-OCR), `documentPublicId`, `ocrOptions?`.
New optional: `attachmentPublicId`, `reOcrToken`, `forceRefresh`. Presence of `reOcrToken` ⇒ re-OCR job; absent ⇒ legacy behavior unchanged.

## State transitions (pointer)

```text
(none/404) → queued → processing ⇄ (retry, attempt n) → completed → [confirm: keys DEL] 
                                                    ↘ failed (final attempt or empty result)
completed/failed/queued → TTL 72h → expired (=404)
new trigger (allowed when no live job) overwrites pointer with new token
```
