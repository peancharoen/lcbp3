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

---

## Extension — Production File Replace (D17–D22, 2026-09-19)

**Schema changes: still none.** Reuses `correspondence_revision_attachments` (junction), `attachments.isTemporary`/`temp_id`/`expires_at` (candidate lifecycle), and `migration_review_queue.review_state_json.fileReplacements` (audit annotation).

### Junction — `correspondence_revision_attachments` (existing)

| Column | Use in replace flow |
|--------|---------------------|
| `correspondence_revision_id` | link identity — only rows on the target correspondence's `is_current` revision are eligible |
| `attachment_id` | **the swapped field** — re-pointed from old attachment id to candidate id at confirm |
| `is_main_document` | preserved automatically (same row, FK change only) |

Unit of change is the junction row, never the attachment row: `UPDATE ... SET attachment_id=:new WHERE correspondence_revision_id=:rev AND attachment_id=:old` (affected=0 → 404).

### Candidate — `attachments` temp row (existing columns)

| Phase | State |
|-------|-------|
| trigger | `isTemporary=1`, `expires_at` set, `file_path` = tempDir copy (staging source is **copied**, never referenced on NAS) |
| confirm (tx) | `ocr_text=newText`, `ai_processing_status='DONE'`, `rag_status='PENDING'`, `expires_at=NULL` (reap-protected) |
| confirm (post-tx) | `commit()` moves file → permanentDir, `isTemporary=0`; auto ingest trigger indexes it |
| reject/expire | existing temp-cleanup worker removes row + temp copy; NAS source untouched |

Checksum dedup at confirm: if a non-temp attachment already has the same SHA-256, the link re-points to that row instead of creating a duplicate.

### Pointer — replace-mode fields (D4 extension)

| Field | Type | Notes |
|-------|------|-------|
| mode | `'replace'` | absent ⇒ plain re-OCR (behavior unchanged) |
| targetCorrespondencePublicId | string | which link to re-point |
| candidateAttachmentPublicId | string | temp attachment (candidate preview + confirm source) |
| candidateFilename | string | shown in dialog + mismatch warning |
| candidateSource | `'STAGING'`\|`'UPLOAD'` | audit |

### Confirm (replace) ordering — commit-before-side-effects

```text
tx: UPDATE candidate row (ocrText/DONE/PENDING/expiresAt=NULL)
    UPDATE junction SET attachment_id=candidateId WHERE rev=:rev AND attachment=:old   (0 → 404)
post-tx: commit([tempId])        → move file + isTemporary=0 + auto ingest trigger
         orphan check old        → junction count=0 ? enqueue vector deletion + ragStatus : skip
         audit + queue annotate  → ai_audit_logs + review_state_json.fileReplacements (best-effort)
         cleanupKeys             → DEL pointer + payload
```
