# Tasks: Attachment Manual Re-OCR

**Input**: [spec.md](./spec.md), [plan.md](./plan.md), [data-model.md](./data-model.md), [contracts/re-ocr-api.md](./contracts/re-ocr-api.md), [research.md](./research.md), ADR-055
**Tests**: INCLUDED — ADR-055 defines a mandatory test list; TDD (RED before GREEN) per `_LCBP3-CONTRACTS.md` for every behavior task.
**Format**: `- [ ] TID [P?] [Story] Description with file path` — `[P]` = parallelizable (different files, no incomplete dependency)
**Paths**: `B=backend/src`, `F=frontend`

## Phase 1: Setup

- [x] T001 Read ADR-055, `B/modules/ai/processors/np-dms-ocr-processor.ts`, `B/modules/ai/ai-queue.service.ts`, `B/modules/ai/controllers/rag-admin.controller.ts` (`reingest` precedent: guards, `@Audit`, Idempotency-Key, `@Throttle`) and record the exact decorators/interceptor names to reuse in `specs/200-fullstacks/257-attachment-manual-re-ocr/research.md` (closes the "open items" list). **Route prefix decided (F1): keep existing `@Controller('files')` → `/files/:publicId/re-ocr[/status|/confirm]`; no new `attachments` controller.**
- [x] T002 [P] Add shared types `ReOcrStatus`, `ReOcrPointer`, `ReOcrPayload`, `ReOcrWarning`, Redis key builders (`attachment:re-ocr:{id}`, `…:{token}`), and `RE_OCR_TTL_SECONDS = 72*3600` in `B/common/file-storage/re-ocr.constants.ts` (new)

## Phase 2: Foundational (blocks all user stories)

- [x] T003 [P] RED: extend `B/modules/ai/processors/ai-batch.processor.spec.ts` — job on attachment with `ai_processing_status='DONE'` skips (no `ocr_text` write, warn logged); `PENDING`/`FAILED` proceed unchanged; PENDING→PROCESSING→DONE normal flow intact
- [x] T004 [P] RED: create `B/modules/ai/processors/np-dms-ocr-processor.spec.ts` — failure paths write `ai:np-dms-ocr:{key}` `{status:'failed',errorMessage,failedAt}` on final attempt for BOTH VRAM-gate throw and catch throw; attempts 1–2 do not write `failed`
- [x] T005 Extend `NpDmsOcrJobData` (`attachmentPublicId?`, `reOcrToken?`, `forceRefresh?`) in `B/modules/ai/processors/np-dms-ocr-processor.ts` (ADR-055 D15); legacy jobs without `reOcrToken` behave exactly as before
- [x] T006 Implement D9.3 DONE terminal-state guard in `B/modules/ai/processors/ai-batch.processor.ts` (conditional `UPDATE … WHERE ai_processing_status <> 'DONE'`; affected rows 0 → skip job + `Logger.warn`); T003 GREEN. Separate commit.
- [x] T007 Implement D10 in `B/modules/ai/processors/np-dms-ocr-processor.ts`: write failed status on final attempt in both throw paths (`job.attemptsMade + 1 >= job.opts.attempts`); T004 GREEN
- [x] T008 (merged into T017 — attempts/backoff are set where `enqueueAttachmentReOcr()` is created; kept as placeholder to preserve task numbering)
- [x] T009 Update assurance ledger checkpoint after Phase 2 in `specs/200-fullstacks/257-attachment-manual-re-ocr/ledger.md`

**Checkpoint**: US4 acceptance scenarios 1–3 satisfied (T003/T004 green).

## Phase 3: User Story 4 — Pipeline fixes verified (P2, but delivered first as prerequisite)

**Goal**: No silent failures; DONE is terminal. **Independent Test**: T003/T004 suites + quickstart failure drills.

- [x] T010 [US4] Run `pnpm --filter backend test -- ai-batch.processor np-dms-ocr` and `pnpm --filter backend lint:ci`; record RED/GREEN evidence in `ledger.md`

## Phase 4: User Story 1 — Re-OCR, review, confirm (P1) 🎯 MVP

**Goal**: End-to-end trigger → wait → compare → confirm → re-index. **Independent Test**: quickstart manual flow steps 1–4; `ocr_text` unchanged until confirm.

### Tests (RED first)

- [x] T011 [US1] RED `B/common/file-storage/attachment-re-ocr.service.spec.ts` — trigger: pointer `queued` (TTL 72h asserted on pointer; payload key TTL 72h asserted in T014) with `triggeredByDisplayName`/`triggeredAt`, returns token/jobId/queuePosition/estimatedWaitSeconds, `ocr_text` untouched; guards: non-PDF→422, missing file→410, `PROCESSING`→409, `PENDING/DONE/FAILED` allowed
- [x] T012 [US1] RED same spec — status: 404 when no pointer; `queued/processing`; `failed`+errorMessage; `completed` returns `newText`, `charCount`, `identical`, and `warning:'RESULT_MUCH_SHORTER'` when <50%; `newText` absent for non-completed
- [x] T013 [US1] RED same spec — confirm: valid token → tx UPDATE (`ocr_text`, `rag_status='PENDING'`, `rag_last_error=NULL`, `ai_processing_status='DONE'`) → `reingest` called with force path AFTER commit → both keys DEL; repeat confirm → 404/410; wrong/expired token rejected; 0 affected rows → 404; `QUEUE_AI_VECTOR_DELETION` never called; **enqueue failure inside `reingest` → generation marked FAILED, no dangling BUILDING (FR-023)**
- [x] T014 [P] [US1] RED `B/modules/ai/processors/np-dms-ocr-processor.spec.ts` — re-OCR job: skips `ocrCacheService.get()` but calls `set()`; writes pointer `processing`→`completed` + payload key; VRAM gate only for `engineType='np-dms-ocr'`; empty text → pointer `failed`; shrink<50% → warning; attempts 1–2 pointer stays `processing` with `attempt`; payload + pointer keys set with TTL 72h (FR-015); a failed `np-dms-ocr` job is never re-run with `auto` (FR-008)
- [x] T015 [P] [US1] RED `B/common/file-storage/file-storage.controller.spec.ts` — 3 routes: RBAC (`rag.admin.write` / `rag.manage`), missing `Idempotency-Key`→400, invalid `engineType`→400 (DTO validation); `@Audit` (trigger+confirm), `@Throttle`, `AiEnabledGuard` metadata present (FR-002)
- [x] T016 [P] [US1] RED `B/modules/ai/ai-queue.service.spec.ts` — `enqueueAttachmentReOcr` calls `checkAiUnavailableLocks` (503 under `ai:ocr-batch:active` / `ai:model:transitioning`), jobId `re-ocr:{id}:{token}`, no `priority`

### Implementation

- [x] T017 [US1] Add `enqueueAttachmentReOcr()` to `B/modules/ai/ai-queue.service.ts` (uses `npDmsOcrQueue`, lock check, `attempts: 3` + exponential backoff 5000ms, no priority); T016 GREEN
- [x] T018 [US1] Implement re-OCR branch in `B/modules/ai/processors/np-dms-ocr-processor.ts`: pointer transitions, payload write, forceRefresh cache bypass + cache `set`, conditional VRAM gate, empty→failed, shrink warning, final-attempt-only failed; T014 GREEN
- [x] T019 [P] [US1] Create DTOs `B/common/file-storage/dto/re-ocr.dto.ts` (`TriggerReOcrDto{engineType}` via `SandboxOcrEngineType` enum validation, `ConfirmReOcrDto{reOcrToken}`) — publicId strings only (ADR-019)
- [x] T020 [US1] Create `B/common/file-storage/attachment-re-ocr.service.ts` (trigger/status/confirm per D3, D4, D6, D9 in-flight guard using `@InjectQueue(QUEUE_NP_DMS_OCR)` `getJob`, D12, D14; `AiQueueService`/`RagAdminService` via `ModuleRef.get(..., {strict:false})` per D13; BusinessException with Thai `userMessage`/`recoveryAction`, `Logger` only); T011–T013 GREEN
- [x] T021 [US1] Register `AttachmentReOcrService` + `AttachmentReOcrController` in `B/modules/ai/ai.module.ts` (deviation: not FileStorageModule — `AiEnabledGuard` needs `AiSettingsService`; `QUEUE_NP_DMS_OCR` already registered there)
- [x] T022 [US1] Add `POST :publicId/re-ocr`, `GET :publicId/re-ocr/status`, `POST :publicId/re-ocr/confirm` in new `B/common/file-storage/attachment-re-ocr.controller.ts` (`@Controller('files')`) with guards/decorators from T001 (thin controller); T015 GREEN
- [x] T023 [P] [US1] Frontend API client + types `F/lib/services/re-ocr.service.ts` and hooks `F/hooks/use-re-ocr.ts` (TanStack Query; status poll 3s, stop on terminal; `Idempotency-Key` per mutation; publicId only, no `parseInt`/`id ?? ''`)
- [x] T024 [P] [US1] i18n keys for all Re-OCR strings in `F/components/admin/ai/rag-console/rag-admin-i18n.ts` (Thai + English)
- [x] T025 [US1] Create `F/components/admin/ai/rag-console/ReOcrDiffView.tsx`: side-by-side monospace `<pre>` with scroll sync, char counts, per-pane search box, PDF reference pane reusing `file-preview-modal`, empty-old placeholder, shrink warning badge, `identical` notice
- [x] T026 [US1] Create `F/components/admin/ai/rag-console/ReOcrDialog.tsx`: full-screen dialog, resume-by-click (`GET status` first → phase), engine select (default `np-dms-ocr` + explanation), wait phase with queue position/estimate + "started by {name} at {time}", confirm via AlertDialog (permanent, old→new counts), post-confirm toast + list query invalidate
- [x] T027 [US1] Create `F/components/admin/ai/rag-console/ReOcrButton.tsx` (visible only with `rag.admin.write`) and mount next to `RetryButton` in the attachments list in `F/app/(admin)/admin/ai/rag-console/page.tsx`
- [x] T028 [P] [US1] Frontend tests (Vitest `run`): resume-by-click phases (404/queued/completed/failed), confirm disabled when `identical`, AlertDialog gate, button hidden without permission in `F/components/admin/ai/__tests__/`
- [x] T029 [US1] Update assurance ledger checkpoint after US1 in `ledger.md`

**Checkpoint**: MVP complete — manual quickstart steps 1–4 pass.

## Phase 5: User Story 2 — Failure handling & engine retry (P1)

**Goal**: Honest failure states, no silent fallback. **Independent Test**: stop sidecar → failed after 3 attempts + two retry buttons.

- [x] T030 [P] [US2] RED test in `attachment-re-ocr.service.spec.ts`/frontend: failed view shows errorMessage and two retry buttons that each issue a NEW trigger (new token, chosen engine)
- [x] T031 [US2] Add failed-phase UI (retry with `np-dms-ocr` / retry with `auto`) in `F/components/admin/ai/rag-console/ReOcrDialog.tsx`; ensure trigger allowed from `failed` pointer state
- [x] T032 [US2] Verify AI-unavailable (503 `AI_FEATURES_UNAVAILABLE`) surfaces existing frontend interceptor dialog in re-OCR start; add test in `F/components/admin/ai/__tests__/`

## Phase 6: User Story 3 — Resume & multi-admin coordination (P2)

**Goal**: One live job per attachment; any admin resumes. **Independent Test**: acceptance scenarios US3-1..4.

- [x] T033 [P] [US3] RED tests in `attachment-re-ocr.service.spec.ts`: live queued/processing job + second trigger → 409; stale pointer (job removed from queue) → allowed; new trigger overwrites pointer with new token; two tokens' payloads never mix
- [x] T034 [US3] Verify/fix in-flight guard (T020) satisfies T033; verify dialog "started by" and empty-old placeholder in `ReOcrDialog.tsx`/`ReOcrDiffView.tsx`

## Phase 7: Polish & Cross-Cutting

- [x] T034a Tier 2 conformance sweep on all new/edited files: `// File:` header + Change Log, JSDoc on public methods, explicit types, Thai comments, single export, zero `any`/`console.log`
- [x] T035 [P] Run `pnpm --filter backend lint:ci && pnpm --filter backend build && pnpm --filter backend test`
- [x] T036 [P] Run `pnpm --filter lcbp3-frontend lint && pnpm --filter lcbp3-frontend test run && pnpm --filter lcbp3-frontend build`
- [x] T037 Security review (done inline: grep gates clean — no any/console/parseInt/unary+, guards/idempotency verified in controller spec; independent `/112-speckit-security-audit` still recommended before merge): ADR-019, ADR-016 guards, idempotency, no `any`/`console.log`, no direct Qdrant deletion
- [ ] T038 Real-app verification per `specs/200-fullstacks/257-attachment-manual-re-ocr/quickstart.md` via `check-real-app` (after deploy authorization from user); also measure SC-002 (start→confirm active effort) and SC-003 (failed shown ≤1 min after final attempt) and record in ledger
- [x] T039 Sync spec docs: mark ADR-055 implementation status, update `specs/05-Engineering-Guidelines`/`memory` notes if needed; commit locally (no push without explicit user authorization)
- [ ] T040 Finalize ledger terminal status in `ledger.md` before handoff/PR

## Dependencies & Order

- Phase 1 → Phase 2 (blocks all) → Phase 3 (US4 verify) → Phase 4 (US1/MVP) → Phase 5 (US2, extends US1 dialog) → Phase 6 (US3, verifies US1 service) → Phase 7.
- Within US1: tests T011–T016 before T017–T022; backend T017–T022 before frontend T025–T027; T023/T024 parallel with backend.
- T003 ∥ T004; T011–T013 share one spec file (write sequentially); T014, T015, T016 are separate files and parallel to it; T023 ∥ T024; T035 ∥ T036.
- US4 (P2) intentionally precedes US1 (P1): it is a blocking prerequisite (DONE-guard + failure reporting).
- Commit discipline: T006 (DONE-guard) and T007 (D10) in separate commits from feature work (ADR-055 notes).

## Parallel Example (US1 tests)

```text
T011 → T012 → T013 (attachment-re-ocr.service.spec.ts, one file, sequential)
T014 (np-dms-ocr-processor.spec.ts)  ∥  T015 (file-storage.controller.spec.ts)  ∥  T016 (ai-queue.service.spec.ts)
```

## Implementation Strategy

1. MVP = Phase 1–4 (fixes + US1). Demo after T029.
2. Add US2 (retry UX) then US3 (coordination hardening), then polish.
3. Stop at each ledger checkpoint; never push/deploy without explicit user authorization.

## Summary

- Total tasks: 40 numbered (T008 merged into T017, T034a added → 40 active): Setup 2, Foundational 6, US4 1, US1 19, US2 3, US3 2, Polish 7
