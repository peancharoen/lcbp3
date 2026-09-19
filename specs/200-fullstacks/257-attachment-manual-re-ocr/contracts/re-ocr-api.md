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

## Error format

ADR-007: `BusinessException`/`ValidationException` with Thai `userMessage` + `recoveryAction`; technical details only in logs.
