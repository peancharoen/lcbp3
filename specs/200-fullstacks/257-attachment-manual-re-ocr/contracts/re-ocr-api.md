# Contract: Attachment Re-OCR API

Base: existing `@Controller('files')` in `backend/src/common/file-storage/file-storage.controller.ts` → routes are `/files/:publicId/re-ocr`, `/files/:publicId/re-ocr/status`, `/files/:publicId/re-ocr/confirm` (decision F1; ADR-055's `/attachments/...` is shorthand). All `:publicId` are UUIDv7 strings (ADR-019).

## POST `:publicId/re-ocr`

- Auth: `JwtAuthGuard, RbacGuard, AiEnabledGuard`; permission `rag.admin.write`
- Headers: `Idempotency-Key` **required** (400 if missing); `@Throttle` ≈10/min; `@Audit('attachment.re_ocr.trigger','attachment')`
- Body: `{ "engineType": "np-dms-ocr" | "auto" }` (default `np-dms-ocr`; other → 400 validation)
- 202: `{ reOcrToken, jobId, status:"queued", queuePosition:number, estimatedWaitSeconds:number }`
- Errors: 404 attachment; 422 non-PDF; 410 file missing on disk; 409 `ai_processing_status='PROCESSING'` or live in-flight job; 503 `AI_FEATURES_UNAVAILABLE` (batch OCR/model transition, with `userMessage`/`recoveryAction`); 403 RBAC
- Effects: writes pointer `queued` (+ starter name/time); never touches `ocr_text`

## GET `:publicId/re-ocr/status`

- Auth: `JwtAuthGuard, RbacGuard`; permission `rag.manage`
- 404: no pointer/expired
- `{ status:"queued"|"processing", reOcrToken, jobId, engineType, attempt?, triggeredByDisplayName, triggeredAt }`
- `{ status:"failed", reOcrToken, errorMessage, triggeredByDisplayName, triggeredAt }`
- `{ status:"completed", reOcrToken, newText, engineUsed, charCount, processingTimeMs, identical:boolean, currentText:string (current ocr_text, '' if none — left diff pane), warning?:"RESULT_MUCH_SHORTER", triggeredByDisplayName, triggeredAt }` — `newText` only here

## POST `:publicId/re-ocr/confirm`

- Auth: same as trigger; `@Audit('attachment.re_ocr.confirm','attachment')`; `Idempotency-Key` required; `@Throttle`
- Body: `{ "reOcrToken": string }`
- 200: `{ status:"confirmed", ragStatus:"PENDING", reindexQueued:boolean }` (`false` = text replaced but re-index enqueue failed; ADR-056 health check repairs)
- Errors: 404/410 token expired, mismatched, or already confirmed (keys deleted); 404 attachment deleted (0 rows); 409 BUILDING generation conflict (from `reingest`); 400 missing key
- Effects: tx UPDATE → commit → `reingest()` (force=true) → DEL pointer + payload. Never calls `QUEUE_AI_VECTOR_DELETION`.

## POST `:publicId/re-ocr/replace` (extension — ADR-055 D17–D22)

- Auth: `JwtAuthGuard, RbacGuard, AiEnabledGuard`; permission **`rag.admin.write` AND `correspondence.edit`** (RequirePermission AND semantics)
- Headers: `Idempotency-Key` **required**; `@Throttle`; `@Audit('attachment.re_ocr.replace','attachment')`
- Body:
  ```json
  {
    "engineType": "np-dms-ocr" | "auto",          // optional, default np-dms-ocr
    "targetCorrespondencePublicId": "<uuid>",      // required — correspondence whose current-revision link is re-pointed
    "storageTempPath": "/staging/.../file.pdf",    // XOR ↓
    "tempAttachmentPublicId": "<uuid>"             // XOR ↑ (from POST /files/upload)
  }
  ```
- 202: same shape as trigger (`reOcrToken, jobId, status:"queued", queuePosition, estimatedWaitSeconds`)
- Errors: 400 missing key / XOR violation / path outside staging roots; 404 attachment or target link not found (attachment not linked to target's *current* revision); 409 `RE_OCR_IDENTICAL_FILE` (checksum match), `PROCESSING`, live in-flight job; 410 source file missing; 503 AI unavailable; 403 RBAC
- Effects: candidate materialized as **temporary attachment** (staging source is *copied* into tempDir — NAS never referenced/moved); pointer written with `mode:'replace'` + link/candidate fields; OCR job runs on the *candidate* file; original attachment untouched

## GET `:publicId/re-ocr/links`

- Auth: `JwtAuthGuard, RbacGuard`; permission `rag.manage`
- 200: `{ links: [{ correspondencePublicId, correspondenceNumber, revisionPublicId, revisionLabel, isCurrent, isMainDocument }] }` — for the link picker; only `isCurrent` links are eligible targets

## Status — replace-mode fields (extension)

When pointer has `mode:'replace'`, status responses additionally carry:

```json
{
  "mode": "replace",
  "targetCorrespondencePublicId": "<uuid>",
  "candidateAttachmentPublicId": "<uuid>",   // temp attachment — preview source for "new file" pane
  "candidateFilename": "O672-...-0004-2567.pdf",
  "candidateSource": "STAGING" | "UPLOAD"
}
```

## POST `:publicId/re-ocr/confirm` — replace-mode semantics

When the token belongs to a replace job, confirm additionally:

- In one transaction: re-points the selected junction row (`correspondence_revision_attachments.attachment_id` → candidate attachment id), sets candidate `ocr_text`/`ai_processing_status='DONE'`/`rag_status='PENDING'`/`expires_at=NULL`
- Then commits the candidate file temp→permanent (`commit()` — move + `isTemporary=false` + auto ingest trigger)
- Then de-indexes the *old* attachment **only if no junction link remains** (row + file always retained)
- Then writes audit + appends `review_state_json.fileReplacements` on the traceable migration queue item (best-effort)
- Errors: 404/410 link vanished or candidate expired; 409 superseded/identical guards unchanged

## Error format

ADR-007: `BusinessException`/`ValidationException` with Thai `userMessage` + `recoveryAction`; technical details only in logs.
