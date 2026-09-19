# Research: Attachment Manual Re-OCR

All unknowns were resolved during ADR-055 grill sessions (2026-09-14, 2026-09-19) against actual code. This file records the decisions relevant to planning; the ADR holds full rationale.

| # | Topic | Decision | Alternatives rejected |
|---|-------|----------|-----------------------|
| 1 | Queue | Revive `QUEUE_NP_DMS_OCR` (registered in `ai.module.ts:210`, processor concurrency 1/lock 180s, currently no producer). No `priority`. | `ai-batch` (mixes GPU work); `priority:1` (BullMQ lower = higher priority, and queue has no other jobs) |
| 2 | State store | Redis two-key: pointer `attachment:re-ocr:{publicId}` + payload `…:{token}`, TTL 72h, both DEL on confirm | Single key (heavy polls, race); new DB column (ADR-044 footprint) |
| 3 | Cache | `forceRefresh` in job data skips `OcrCacheService.get()`; still `set()` | Invalidate on trigger (less explicit) |
| 4 | Re-embed | Commit DB tx → `RagAdminService.reingest()` → `ingest(force=true)`; generation lifecycle retires old vectors | Manual `QUEUE_AI_VECTOR_DELETION` (races upsert); no force (silently reuses ACTIVE generation) |
| 5 | Module wiring | `ModuleRef` lazy lookup in FileStorage module (AiModule already imports FileStorageModule) | `forwardRef`; moving service to AiModule |
| 6 | In-flight guard | Pointer status queued/processing AND BullMQ job still waiting/active → 409; stale pointer allowed | Writing `PROCESSING` to `ai_processing_status` |
| 7 | DONE guard | Conditional `UPDATE … WHERE ai_processing_status <> 'DONE'`; 0 rows → skip + warn | Allowing collision with queued PENDING jobs |
| 8 | Failure semantics | attempts 3, backoff 5s; write `failed` only on last attempt; both throw paths | attempts 1 |
| 9 | Contract | `rag.admin.write` trigger/confirm, `rag.manage` status; `AiEnabledGuard`, `@Audit`, `Idempotency-Key`, `@Throttle`, `checkAiUnavailableLocks` per `reingest` precedent | `system.manage_all`; role-name guards |
| 10 | UI | Row action in RAG console → full-screen dialog; resume via `GET status` first; side-by-side `<pre>` with scroll sync, PDF reference pane (reuse `file-preview-modal`), per-pane search, AlertDialog | Dedicated route; word-level diff |

**Decided**: route prefix = existing `files` controller (`/files/:publicId/re-ocr*`), success status 202.

**Still to confirm in code during T001** (non-blocking): exact `@Throttle` numbers (~10/min), the idempotency interceptor reused from `reingest` (`rag-admin.controller.ts:101`), and where `file-preview-modal` exposes a reusable inner viewer.
