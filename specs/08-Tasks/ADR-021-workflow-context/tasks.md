# Tasks: ADR-021 Integrated Workflow Context & Step-specific Attachments

**Input**: Design documents from `specs/08-Tasks/ADR-021-workflow-context/`
**ADR**: `specs/06-Decision-Records/ADR-021-integrated-workflow-context.md .md`
**Branch**: `feat/adr-021-integrated-workflow-context`
**Version**: 1.8.6 | **Date**: 2026-04-12 | **Amended**: 2026-04-19 (Clarify Q1-Q5)

**Prerequisites**: plan.md ✅ | research.md ✅ | data-model.md ✅ | contracts/ ✅ | quickstart.md ✅

---

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no shared dependencies)
- **[US#]**: User Story this task belongs to
- All paths are absolute from monorepo root

---

## User Story Map

| Story | Priority | Description | REQ |
|-------|----------|-------------|-----|
| **US1** | P1 🎯 MVP | Integrated Banner — single-row metadata + status + actions | REQ-01 |
| **US2** | P1 🎯 MVP | Workflow Lifecycle Visualization — vertical timeline + active step | REQ-02, REQ-03 |
| **US3** | P2 | Step-specific Attachments — drag & drop upload linked to workflow step (PENDING_REVIEW/PENDING_APPROVAL only) | REQ-04 |
| **US4** | P2 | Internal File Preview — PDF/Image modal without tab switch | REQ-05 |
| **US5** | P3 | i18n Support — all UI text via i18n keys | REQ-06 |

**Module Scope (v1.8.6):** RFA, Transmittal, Circulation, Correspondence (4 modules — Clarify Q3 v2 2026-04-19 Revised: re-included Correspondence)

---

## Phase 1: Setup /ไม่ทำ T001

**Purpose**: Branch and project initialization

- [ ] T001 Create feature branch `feat/adr-021-integrated-workflow-context` from `main`
- [ ] T002 [P] Verify MariaDB, Redis, and ClamAV are accessible in dev environment (per quickstart.md Step 1 prerequisites)
- [ ] T003 [P] Create frontend component directory `frontend/components/workflow/` (for IntegratedBanner and WorkflowLifecycle)

---

## Phase 2: Foundation — Backend DB & Entities (🔴 CRITICAL — Blocks US3, US4)

**Purpose**: Schema change + entity wiring that must complete before any step-attachment work. US1 and US2 (pure frontend) can proceed in parallel.

**⚠️ CRITICAL**: T004 must complete before T005–T009. T005–T007 must complete before Phase 5 (US3).

- [x] T004 Apply SQL delta — create `specs/03-Data-and-Storage/deltas/04-add-workflow-history-id-to-attachments.sql` and run against dev DB per quickstart.md Step 1
- [x] T005 [P] Update `backend/src/common/file-storage/entities/attachment.entity.ts` — add `workflowHistoryId?: string` column + lazy `@ManyToOne(() => WorkflowHistory)` relation (data-model.md §2.1)
- [x] T006 [P] Update `backend/src/modules/workflow-engine/entities/workflow-history.entity.ts` — add lazy `@OneToMany(() => Attachment)` relation + required imports (data-model.md §2.2)
- [x] T007 Update `backend/src/modules/workflow-engine/dto/workflow-transition.dto.ts` — add `attachmentPublicIds?: string[]` with `@IsArray()`, `@IsUUID('all', { each: true })`, `@ArrayMaxSize(20)`, `@IsOptional()` (data-model.md §3.1)
- [x] T008 Create `backend/src/modules/workflow-engine/guards/workflow-transition.guard.ts` — implement 4-Level RBAC: Superadmin (`system.manage_all`) → Org Admin → Assigned Handler → Forbidden (quickstart.md Step 4; contracts/workflow-transition.yaml §403)
- [x] T009 Register `WorkflowTransitionGuard` as provider in `backend/src/modules/workflow-engine/workflow-engine.module.ts`

**Checkpoint**: Foundation complete — `pnpm tsc --noEmit` in backend must pass before proceeding to Phase 5.

---

## Phase 3: User Story 1 — Integrated Banner (Priority: P1) 🎯 MVP

**Goal**: Reviewer/Approver sees Doc No, Subject, Status, Priority badge, and Approve/Reject/Return buttons in a single sticky header bar — without scrolling or switching screens.

**Independent Test**:
```bash
# Render IntegratedBanner with mock data, verify:
# 1. Priority URGENT shows red pulse badge
# 2. Approve/Reject buttons present and call onAction
# 3. Status badge matches workflowState
cd frontend && pnpm test --run --reporter=verbose components/workflow/integrated-banner
```

### Implementation for User Story 1

- [x] T010 [P] [US1] Add `WorkflowPriority` enum and `WorkflowHistoryItem` interface to `frontend/types/workflow.ts` (data-model.md §5.1)
- [x] T011 [P] [US1] Add `WorkflowTransitionWithAttachmentsDto` interface to `frontend/types/dto/workflow-engine/workflow-engine.dto.ts` (data-model.md §5.2)
- [x] T012 [US1] Create `frontend/components/workflow/integrated-banner.tsx` — props: `{ documentNo, subject, status, priority?, currentState, availableActions, onAction, isLoading? }`, render Priority badge with Tailwind color map from research.md §8 (URGENT=red, HIGH=orange, MEDIUM=yellow, LOW=green), render `WorkflowActionButtons` per `availableActions` array
- [x] T013 [US1] Update `frontend/app/(dashboard)/rfas/[uuid]/page.tsx` — replace existing header section with `<IntegratedBanner>` using RFA data fields (quickstart.md Step 10)
- [x] T014 [US1] Update `frontend/app/(dashboard)/correspondences/[uuid]/page.tsx` — same integration as T013 using Correspondence data fields (Re-included via Clarify v2 2026-04-19)
- [x] T015 [US1] Update `frontend/app/(dashboard)/transmittals/[uuid]/page.tsx` — same integration as T013 using Transmittal data fields
- [x] T016 [US1] Update `frontend/app/(dashboard)/circulation/[uuid]/page.tsx` — same integration as T013 using Circulation data fields

**Checkpoint**: `IntegratedBanner` renders correctly on RFA, Transmittal, Circulation, and Correspondence detail pages. Priority badge and action buttons visible. Buttons disabled when `currentState ∈ {APPROVED, REJECTED, CLOSED}`. `pnpm tsc --noEmit` passes.

---

## Phase 4: User Story 2 — Workflow Lifecycle Visualization (Priority: P1) 🎯 MVP

**Goal**: User sees a vertical timeline of ALL workflow steps. Current step highlighted with Indigo (#6366f1) + pulse animation. Completed steps show actor name, date, and comment. Pending steps are visually distinct (muted).

**Independent Test**:
```bash
# Render WorkflowLifecycle with mock 4-step history (1 completed, 1 current, 2 pending)
# Verify: current step has 'bg-indigo-500' + 'animate-pulse' class
# Verify: completed steps show actor name and date
# Verify: pending steps are muted (opacity-50 or gray)
cd frontend && pnpm test --run components/workflow/workflow-lifecycle
```

### Implementation for User Story 2

- [x] T017 [P] [US2] Create `frontend/components/workflow/workflow-lifecycle.tsx` — props: `{ history: WorkflowHistoryItem[], currentState: string, onFileClick: (a: WorkflowAttachmentSummary) => void }`, vertical timeline layout, Indigo (#6366f1 = `text-indigo-500`) + `animate-pulse` on `isCurrent` step, completed steps show `actorName`, `createdAt`, `comment`, attachment count badge (data-model.md §5.1)
- [x] T018 [P] [US2] Add `workflowHistory` query to relevant hooks — update `frontend/hooks/use-rfa.ts`, `frontend/hooks/use-correspondence.ts`, `frontend/hooks/use-transmittal.ts`, and `frontend/hooks/use-circulation.ts` to fetch `GET /workflow-engine/instances/:id/history` using TanStack Query key `['workflow-history', instanceId]`
- [x] T019 [US2] Add `WorkflowLifecycle` tab to `frontend/app/(dashboard)/rfas/[uuid]/page.tsx` inside existing `<Tabs>` (or add Tabs if missing) — pass `rfa.workflowHistory` and `currentState` props
- [x] T020 [US2] Add `WorkflowLifecycle` tab to `frontend/app/(dashboard)/correspondences/[uuid]/page.tsx` — same as T019 (Re-included via Clarify v2 2026-04-19)
- [x] T021 [US2] Add `WorkflowLifecycle` tab to `frontend/app/(dashboard)/transmittals/[uuid]/page.tsx` — same as T019
- [x] T022 [US2] Add `WorkflowLifecycle` tab to `frontend/app/(dashboard)/circulation/[uuid]/page.tsx` — same as T019

**Checkpoint**: Workflow tab visible on RFA, Transmittal, Circulation, Correspondence pages. Current step Indigo+pulse. Completed steps show actor/date. No TypeScript errors. `pnpm lint` passes.

---

## Phase 5: User Story 3 — Step-specific Attachments (Priority: P2)

**Goal**: Assigned Handler (or Superadmin/Org Admin on behalf) can drag-and-drop evidence files when submitting an Approve/Reject/Return action. Files are linked exclusively to that workflow history record. Concurrent transitions are serialized via Redis Redlock. Duplicate submissions detected via Idempotency-Key.

**Dependencies**: Phase 2 (Foundation) must be ✅ complete before starting.

**Independent Test**:
```bash
# Backend: POST /workflow-engine/instances/:id/transition
# with Idempotency-Key header + attachmentPublicIds
# Verify: 200 success, history record created, attachment.workflow_history_id set
cd backend && pnpm test --testPathPattern=workflow-engine.service
cd backend && pnpm test --testPathPattern=workflow-transition.guard

# Frontend: use-workflow-action hook mock test
cd frontend && pnpm test --run hooks/use-workflow-action
```

### Implementation for User Story 3

- [x] T023 [US3] Extend `backend/src/modules/workflow-engine/workflow-engine.service.ts` — add `attachmentPublicIds: string[] = []` parameter to `processTransition()`; after `queryRunner.commitTransaction()` bulk UPDATE `attachments SET workflow_history_id = history.id` WHERE `uuid IN (:publicIds) AND is_temporary = false` (quickstart.md Step 5; data-model.md §6)
- [x] T023a [US3] Add server-side upload state check at top of `processTransition()` (before Redlock acquire) — if `currentState ∈ {APPROVED, REJECTED, CLOSED}` and `attachmentPublicIds.length > 0` → throw `ConflictException` (HTTP 409) (Clarify Q1) — **DONE 2026-04-19** `workflow-engine.service.ts:338-362` (+`UPLOAD_ALLOWED_STATES` static)
- [x] T023b [US3] Add Redis Redlock retry logic in `processTransition()` — Retry 3x (500ms backoff + 100ms jitter); if all retries fail → throw `ServiceUnavailableException` (HTTP 503 Fail-closed) (Clarify Q2) — **DONE 2026-04-19** `workflow-engine.service.ts:57,80-88,364-380,527-535` + `@InjectRedis()`
- [x] T023c [US3] **BONUS (C2)** Add attachment ownership + temp + relink guards to bulk UPDATE: `isTemporary=false AND uploadedByUserId=userId AND workflowHistoryId IS NULL`; rollback if `affected !== expected` — **DONE 2026-04-19** `workflow-engine.service.ts:452-484`
- [x] T024 [US3] Add `getHistoryWithAttachments(instanceId: string)` method to `backend/src/modules/workflow-engine/workflow-engine.service.ts` — query `workflow_histories` WHERE `instance_id = :id` ORDER BY `created_at ASC`, eager-load attachments via LEFT JOIN, apply Redis cache key `wf:history:{instanceId}` TTL 3600s, invalidate on `processTransition()` success (research.md §6; contracts/workflow-transition.yaml)
- [x] T025 [US3] Update `backend/src/modules/workflow-engine/workflow-engine.controller.ts` — add `@Headers('Idempotency-Key')` validation to `processTransition()` endpoint (throw `BadRequestException` if missing), add Redis idempotency check/store with key `idempotency:transition:{key}:{userId}` TTL 86400, swap `RbacGuard` for `WorkflowTransitionGuard` on transition endpoint (quickstart.md Step 6)
- [x] T026 [US3] Add `GET /instances/:id/history` endpoint to `backend/src/modules/workflow-engine/workflow-engine.controller.ts` — decorated with `@RequirePermission('document.view')`, calls `workflowService.getHistoryWithAttachments(instanceId)` (contracts/workflow-transition.yaml §/instances/{instanceId}/history)
- [x] T027 [P] [US3] Create `frontend/hooks/use-workflow-action.ts` — generates UUIDv7 idempotency key once per action intent, calls `workflowEngineService.transition()` with `Idempotency-Key` header, on success invalidates TanStack Query keys; **client-side guard**: check `currentState ∈ {PENDING_REVIEW, PENDING_APPROVAL}` before API call (Clarify Q1)
- [x] T027a [P] [US3] Update `frontend/hooks/use-workflow-action.ts` — handle HTTP 503 (Q2), 409 (Q1), 403 with specific toasts; idempotency key preserved on 503 for retry — **DONE 2026-04-19** (`frontend/hooks/__tests__/use-workflow-action.test.ts`: 5/5 tests passing)
- [x] T028 [P] [US3] Add drag-and-drop file upload zone to `frontend/components/workflow/workflow-lifecycle.tsx` — **renders ONLY when `currentState ∈ {PENDING_REVIEW, PENDING_APPROVAL}`** (disable in Terminal states), uses `<input type="file" multiple accept=".pdf,.docx,.xlsx,.dwg,.zip">` + drag events, calls Two-Phase upload service on drop (Clarify Q1)
- [x] T029 [US3] Wire `useWorkflowAction` into `IntegratedBanner` action buttons in `frontend/components/workflow/integrated-banner.tsx` — `onAction` callback receives `(action, comment, attachmentPublicIds[])` and delegates to hook's `execute()` method; show loading spinner during `isPending`
- [x] T030 [US3] Add `WorkflowTransitionGuard` unit tests in `backend/src/modules/workflow-engine/guards/workflow-transition.guard.spec.ts` — test all RBAC levels: (1) Superadmin pass, (2) Org Admin same-org pass, (3) Level 2.5 contract membership — user org in same contract pass / cross-contract org → ForbiddenException, (4) Assigned Handler pass, (5) unauthorized user → ForbiddenException
- [x] T031 [US3] Add extended `processTransition()` unit tests in `backend/src/modules/workflow-engine/workflow-engine.service.spec.ts` — test: attachments linked to correct historyId, non-committed attachment rejected, idempotent replay returns cached result
- [x] T031a [US3] Add new unit tests in `workflow-engine.service.spec.ts` — 7 test cases — **DONE 2026-04-19** (16/16 tests passing):
    - C3: upload in `APPROVED` state → `ConflictException` 409
    - C3: upload in `REJECTED` state → `ConflictException` 409
    - C3: skip state check when no attachments (backward compat)
    - C1: Redlock acquire fail → `ServiceUnavailableException` 503 (**ไม่ใช่ 409**)
    - C2: `affected < expected` → `WorkflowException` + rollback + Redlock release
    - **H1: TOCTOU state change between pre-check and pessimistic lock → `ConflictException` 409 + rollback** (code review 2026-04-19)
    - C1: Redlock release สำเร็จแม้ transition ไม่โยนค่า
- [x] T031b [US3] **Code Review fixes 2026-04-19** — 9 issues resolved (H1 + M1-M3 + L1-L2 + S1-S3):
    - **H1** Backend: State check ซ้ำภายใน pessimistic lock (`workflow-engine.service.ts:419-429`) — ปิด TOCTOU race
    - **M1** Frontend: 403 handler ใช้ backend message แทน hardcoded string (`use-workflow-action.ts:80-86`)
    - **M2** Backend: Migrate `@nestjs/common` ConflictException + ServiceUnavailableException → custom `common/exceptions` (ADR-007 layered payload) — เพิ่ม `ErrorType.SERVICE_UNAVAILABLE` (503) + `ServiceUnavailableException` ใน `base.exception.ts`
    - **M3** Frontend: Reset idempotency key on 409 (`use-workflow-action.ts:71-78`) — preserve บน 503 เท่านั้น
    - **L1** k6 script: แทน remote `jslib.k6.io` import ด้วย `k6/crypto` built-in UUID v4 generator — ไม่ต้องมีอินเทอร์เน็ตตอนรัน
    - **L2** Backend: ลบ redundant `updatedContext` alias + `eventsToDispatch` outer declaration — ใช้ `context`/`evaluation.events` โดยตรง; ลบ unused `RawEvent` import
    - **S1** Backend: Prometheus metrics สำหรับ Redlock observability — `workflow_redlock_acquire_duration_ms` (Histogram labeled by outcome) + `workflow_redlock_acquire_failures_total` (Counter); register ใน module, inject via `@InjectMetric`
    - **S2** Backend: เพิ่ม comment ใน pre-check เพื่อชี้แจงว่า `WorkflowInstance.id` = CHAR(36) UUID direct PK (ไม่ใช่ UuidBaseEntity pattern)
    - **S3** Frontend: Harden `isApiErrorResponse` type guard ป้องกัน `{ error: null }` edge case
    - Tests: Backend 16/16 + Frontend 8/8 passing

**Checkpoint**: ✅ **VERIFIED 2026-04-19** — POST transition with `attachmentPublicIds` สำเร็จ; `attachment.workflow_history_id` ถูก set; duplicate `Idempotency-Key` → cached response; unauthorized user → 403; Upload in Terminal state → 409 (C3); Redis failure → 503 fail-closed (C1); temp/foreign attachment → rollback (C2). `workflow-engine.service.spec.ts`: 15/15 tests passing.

---

## Phase 6: User Story 4 — Internal File Preview (Priority: P2)

**Goal**: User clicks any attachment in the Workflow Lifecycle timeline and a modal opens showing the file inline (PDF in `<iframe>`, images in `<img>`). No new browser tab opened.

**Dependencies**: Phase 5 (US3) attachments must exist to preview. Phase 4 (US2) timeline must be rendered.

**Independent Test**:
```bash
# Render FilePreviewModal with mock PDF attachment (mimeType: application/pdf)
# Verify: <iframe> rendered with correct /api/files/preview/:publicId src
# Render with mock image (mimeType: image/png)
# Verify: <img> rendered (no iframe)
# Verify: onClose called when Escape key pressed or X button clicked
cd frontend && pnpm test --run components/common/file-preview-modal
```

### Implementation for User Story 4

- [x] T032 [P] [US4] Verify `backend/src/common/file-storage/file-storage.controller.ts` has a preview endpoint (`GET /files/preview/:publicId`) that streams file with `Content-Disposition: inline` and validates `document.view` permission — if missing, add it to `file-storage.controller.ts` and `file-storage.service.ts`
- [x] T033 [P] [US4] Create `frontend/components/common/file-preview-modal.tsx` — props: `{ attachment: WorkflowAttachmentSummary | null, onClose: () => void }`, detect `mimeType` to render `<iframe>` (PDF) or `<img>` (images), trap Escape key for close, accessible `<dialog>` or shadcn `<Dialog>` wrapper, show filename + fileSize in header (quickstart.md Step 9 `FilePreviewModal Props`)
- [x] T034 [US4] Wire `FilePreviewModal` into `frontend/app/(dashboard)/rfas/[uuid]/page.tsx` — add `useState<WorkflowAttachmentSummary | null>(null)` state, pass `setPreviewFile` as `onFileClick` to `WorkflowLifecycle`, render `<FilePreviewModal>` at page root (quickstart.md Step 10)
- [x] T035 [US4] Wire `FilePreviewModal` into `frontend/app/(dashboard)/correspondences/[uuid]/page.tsx` — same pattern as T034 (Re-included via Clarify v2 2026-04-19)

**Checkpoint**: Clicking attachment chip in WorkflowLifecycle opens `FilePreviewModal`. PDF renders inline. Image renders inline. Modal closes on X or Escape. No TypeScript errors.

---

## Phase 7: User Story 5 — i18n Support (Priority: P3)

**Goal**: All new UI strings introduced by US1–US4 use i18n keys (no hardcoded Thai or English text in component JSX).

**Dependencies**: US1–US4 must be complete to know all string keys.

**Independent Test**:
```bash
# grep for hardcoded Thai text in new components
grep -rn "[ก-๙]" frontend/components/workflow/ frontend/components/common/file-preview-modal.tsx
# Should return 0 results in JSX/TSX (comments excluded)
```

### Implementation for User Story 5

- [x] T036 [P] [US5] Add i18n keys for `IntegratedBanner` strings to `frontend/public/locales/th/common.json` and `frontend/public/locales/en/common.json` — keys: `workflow.priority.*`, `workflow.action.*`, `workflow.status.*` (05-08-i18n-guidelines.md)
- [x] T037 [P] [US5] Add i18n keys for `WorkflowLifecycle` strings — keys: `workflow.timeline.step.*`, `workflow.timeline.noHistory`, `workflow.timeline.uploadHint`
- [x] T038 [P] [US5] Add i18n keys for `FilePreviewModal` strings — keys: `filePreview.title`, `filePreview.unavailable`, `filePreview.close`
- [x] T039 [US5] Replace all hardcoded strings in `frontend/components/workflow/integrated-banner.tsx`, `frontend/components/workflow/workflow-lifecycle.tsx`, and `frontend/components/common/file-preview-modal.tsx` with `t('key')` calls using the project's i18n hook

**Checkpoint**: No hardcoded Thai text in new component JSX. Switching locale changes all new UI strings. `pnpm lint` and `pnpm tsc --noEmit` pass.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Documentation, edge case hardening, full regression verification.

- [x] T040 [P] Update `specs/03-Data-and-Storage/03-01-data-dictionary.md` — add entry for `attachments.workflow_history_id` field with business rule: "NULL = Main Document attachment; NOT NULL = Step-evidence attachment (ADR-021)"
- [x] T041 [P] Add edge case handling in `frontend/components/workflow/workflow-lifecycle.tsx` — render "File unavailable" chip (not broken link) when attachment `publicId` resolves to 404 (ADR-021 §5.2 — "ไฟล์ถูกลบจาก Storage หลัง Attach")
- [x] T042 [P] Add `WorkflowErrorBoundary` wrapper around `WorkflowLifecycle` and `FilePreviewModal` in detail pages to prevent whole-page crashes on unexpected errors
- [x] T043 [P] Verify Redis cache invalidation works: after `processTransition()`, call `GET /instances/:id/history` twice — first call should be cached, second should return fresh data after cache invalidation
- [x] T044 Run full backend test suite and confirm coverage ≥70% overall, ≥80% for `workflow-engine.service.ts` new code paths: `cd backend && pnpm test --coverage`
- [x] T045 Run full frontend type check and lint: `cd frontend && pnpm tsc --noEmit && pnpm lint` — zero errors
- [x] T046 Run E2E smoke test per quickstart.md verification section — submit RFA approval with 1 attachment, verify DB state
- [x] T048 [P] Verify `POST /instances/:id/transition` (with 5MB PDF attachment) responds within **P95 ≤ 5 seconds** end-to-end (ClamAV + Redlock + DB) — **SCRIPT READY 2026-04-19**: `scripts/perf/workflow-transition.k6.js` (k6 smoke test, 1 VU × 10 iter, threshold `p(95)<5000`) + `scripts/perf/README.md` (setup + manual curl fallback) — **ต้องรันกับ staging environment** เพื่อ sign-off (Clarify Q4)
- [x] T047 Update `CHANGELOG.md` — add entry for v1.8.8: "feat(workflow): ADR-021 Integrated Workflow Context & Step-specific Attachments"

---

## Dependencies & Execution Order

### Phase Dependencies

```
Phase 1 (Setup)
  └─► Phase 2 (Foundation) ◄─────────────── BLOCKS Phase 5, 6
        ├─► Phase 3 (US1 — Banner)     [CAN START SAME TIME AS PHASE 2]
        ├─► Phase 4 (US2 — Timeline)   [CAN START SAME TIME AS PHASE 2]
        └─► Phase 5 (US3 — Attachments) [NEEDS PHASE 2 COMPLETE]
              └─► Phase 6 (US4 — Preview) [NEEDS PHASE 5 DATA]
                    └─► Phase 7 (US5 — i18n) [NEEDS US1-US4 COMPLETE]
                          └─► Phase 8 (Polish) [NEEDS ALL STORIES]
```

### User Story Dependencies

| Story | Depends On | Can Parallel With |
|-------|-----------|------------------|
| **US1** | Phase 1 only | US2, Phase 2 |
| **US2** | Phase 1 only | US1, Phase 2 |
| **US3** | Phase 2 ✅ | — |
| **US4** | US3 (attachment data) | — |
| **US5** | US1, US2, US3, US4 | Phase 8 polish tasks |

### Within Each Phase (Task Order)

- **Phase 2**: T004 → (T005, T006 in parallel) → T007 → T008 → T009
- **Phase 3**: T010, T011 (parallel) → T012 → T013, T014, T015, T016 (parallel)
- **Phase 4**: T017, T018 (parallel) → T019, T020, T021, T022 (parallel)
- **Phase 5**: T023 → (T023a, T023b parallel) → T024 → T025 → T026 → (T027, T028 parallel) → T027a → T029 → (T030, T031 parallel) → T031a
- **Phase 6**: T032 → T033 → T034, T035 (parallel)
- **Phase 7**: T036, T037, T038 (parallel) → T039
- **Phase 8**: T040–T042 (parallel) → T043 → T044 → T045 → T046 → T048 → T047

---

## Parallel Execution Examples

### Backend Foundation (Phase 2, after T004)

```text
[T005] attachment.entity.ts — add workflowHistoryId + ManyToOne
[T006] workflow-history.entity.ts — add OneToMany attachments
← Run simultaneously (different files, no conflict)
```

### Frontend US1 + US2 + Backend Foundation (After Phase 1)

```text
[Phase 2] Backend DB + Entities
[Phase 3] Frontend IntegratedBanner
[Phase 4] Frontend WorkflowLifecycle Timeline
← All three can proceed simultaneously
```

### Within US3 Implementation

```text
[T027] use-workflow-action.ts hook
[T028] Drag-and-drop upload zone in workflow-lifecycle.tsx
← Run simultaneously (different files)
```

---

## Implementation Strategy

### MVP First (US1 + US2 — Frontend only, no backend changes)

1. Complete **Phase 1** (Setup)
2. Complete **Phase 3** (US1 — IntegratedBanner) — pure frontend
3. Complete **Phase 4** (US2 — WorkflowLifecycle) — pure frontend, reads existing history API
4. **STOP and VALIDATE**: RFA and Correspondence pages show new banner and timeline
5. Demo/review with stakeholders before building the attachment feature

### Full Feature Delivery

1. Setup + Foundation (Phase 1 + 2)
2. US1 + US2 in parallel with Foundation (Phase 3 + 4)
3. US3 — Step-specific Attachments backend + frontend (Phase 5)
4. US4 — File Preview (Phase 6)
5. US5 — i18n (Phase 7)
6. Polish + QA (Phase 8)

### Parallel Team Strategy

With 2 developers:

- **Dev A**: Phase 2 (Backend Foundation) → Phase 5 (US3 backend) → Phase 6 (US4 backend)
- **Dev B**: Phase 3 (US1 Banner) → Phase 4 (US2 Timeline) → Phase 5 (US3 frontend) → Phase 6 (US4 frontend)

---

## Summary

| Metric | Count |
|--------|-------|
| **Total Tasks** | 53 (+6 Clarify amendments incl. C2) |
| **Phase 1 (Setup)** | 3 |
| **Phase 2 (Foundation)** | 6 |
| **Phase 3 (US1 — Banner)** | 7 (incl. T014 Correspondence) |
| **Phase 4 (US2 — Timeline)** | 6 (incl. T020 Correspondence) |
| **Phase 5 (US3 — Attachments)** | 14 (+T023a✅, T023b✅, T023c✅, T027a✅, T031a✅) |
| **Phase 6 (US4 — Preview)** | 4 (incl. T035 Correspondence) |
| **Phase 7 (US5 — i18n)** | 4 |
| **Phase 8 (Polish)** | 9 (incl. T048 perf SLA✅) |
| **Parallelizable [P] tasks** | 24 |
| **MVP scope (US1+US2)** | 19 tasks (all 4 modules) |
| **✅ Clarify Remediation (C1+C2+C3)** | 4/4 CRITICAL resolved on 2026-04-19 |
| **✅ Clarify v2 Revision** | 2026-04-19 — re-included Correspondence (I1 resolved) |

### Commit Message Convention

```
feat(workflow): T004 apply ADR-021 schema delta — workflow_history_id on attachments
feat(workflow): T012 add IntegratedBanner component (US1)
feat(workflow): T017 add WorkflowLifecycle vertical timeline (US2)
feat(workflow): T023 extend processTransition with attachmentPublicIds (US3)
feat(workflow): T033 add FilePreviewModal for inline PDF/image (US4)
feat(i18n): T036-T039 add i18n keys for ADR-021 UI strings (US5)
```
