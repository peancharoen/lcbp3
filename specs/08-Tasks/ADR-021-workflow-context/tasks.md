# Tasks: ADR-021 Integrated Workflow Context & Step-specific Attachments

**Input**: Design documents from `specs/08-Tasks/ADR-021-workflow-context/`
**ADR**: `specs/06-Decision-Records/ADR-021-integrated-workflow-context.md .md`
**Branch**: `feat/adr-021-integrated-workflow-context`
**Version**: 1.8.6 | **Date**: 2026-04-12

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
| **US3** | P2 | Step-specific Attachments — drag & drop upload linked to workflow step | REQ-04 |
| **US4** | P2 | Internal File Preview — PDF/Image modal without tab switch | REQ-05 |
| **US5** | P3 | i18n Support — all UI text via i18n keys | REQ-06 |

---

## Phase 1: Setup

**Purpose**: Branch and project initialization

- [ ] T001 Create feature branch `feat/adr-021-integrated-workflow-context` from `main`
- [ ] T002 [P] Verify MariaDB, Redis, and ClamAV are accessible in dev environment (per quickstart.md Step 1 prerequisites)
- [ ] T003 [P] Create frontend component directory `frontend/components/workflow/` (for IntegratedBanner and WorkflowLifecycle)

---

## Phase 2: Foundation — Backend DB & Entities (🔴 CRITICAL — Blocks US3, US4)

**Purpose**: Schema change + entity wiring that must complete before any step-attachment work. US1 and US2 (pure frontend) can proceed in parallel.

**⚠️ CRITICAL**: T004 must complete before T005–T009. T005–T007 must complete before Phase 5 (US3).

- [ ] T004 Apply SQL delta — create `specs/03-Data-and-Storage/deltas/04-add-workflow-history-id-to-attachments.sql` and run against dev DB per quickstart.md Step 1
- [ ] T005 [P] Update `backend/src/common/file-storage/entities/attachment.entity.ts` — add `workflowHistoryId?: string` column + lazy `@ManyToOne(() => WorkflowHistory)` relation (data-model.md §2.1)
- [ ] T006 [P] Update `backend/src/modules/workflow-engine/entities/workflow-history.entity.ts` — add lazy `@OneToMany(() => Attachment)` relation + required imports (data-model.md §2.2)
- [ ] T007 Update `backend/src/modules/workflow-engine/dto/workflow-transition.dto.ts` — add `attachmentPublicIds?: string[]` with `@IsArray()`, `@IsUUID('all', { each: true })`, `@ArrayMaxSize(20)`, `@IsOptional()` (data-model.md §3.1)
- [ ] T008 Create `backend/src/modules/workflow-engine/guards/workflow-transition.guard.ts` — implement 4-Level RBAC: Superadmin (`system.manage_all`) → Org Admin → Assigned Handler → Forbidden (quickstart.md Step 4; contracts/workflow-transition.yaml §403)
- [ ] T009 Register `WorkflowTransitionGuard` as provider in `backend/src/modules/workflow-engine/workflow-engine.module.ts`

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

- [ ] T010 [P] [US1] Add `WorkflowPriority` enum and `WorkflowHistoryItem` interface to `frontend/types/workflow.ts` (data-model.md §5.1)
- [ ] T011 [P] [US1] Add `WorkflowTransitionWithAttachmentsDto` interface to `frontend/types/dto/workflow-engine/workflow-engine.dto.ts` (data-model.md §5.2)
- [ ] T012 [US1] Create `frontend/components/workflow/integrated-banner.tsx` — props: `{ documentNo, subject, status, priority?, currentState, availableActions, onAction, isLoading? }`, render Priority badge with Tailwind color map from research.md §8 (URGENT=red, HIGH=orange, MEDIUM=yellow, LOW=green), render `WorkflowActionButtons` per `availableActions` array
- [ ] T013 [US1] Update `frontend/app/(dashboard)/rfas/[uuid]/page.tsx` — replace existing header section with `<IntegratedBanner>` using RFA data fields (quickstart.md Step 10)
- [ ] T014 [US1] Update `frontend/app/(dashboard)/correspondences/[uuid]/page.tsx` — same integration as T013 using Correspondence data fields
- [ ] T015 [US1] Update `frontend/app/(dashboard)/transmittals/[uuid]/page.tsx` — same integration as T013 using Transmittal data fields (if detail page has a header section)
- [ ] T016 [US1] Update `frontend/app/(dashboard)/circulation/[uuid]/page.tsx` — same integration as T013 using Circulation data fields (if detail page has a header section)

**Checkpoint**: `IntegratedBanner` renders correctly on RFA and Correspondence detail pages. Priority badge and action buttons visible. `pnpm tsc --noEmit` passes.

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

- [ ] T017 [P] [US2] Create `frontend/components/workflow/workflow-lifecycle.tsx` — props: `{ history: WorkflowHistoryItem[], currentState: string, onFileClick: (a: WorkflowAttachmentSummary) => void }`, vertical timeline layout, Indigo (#6366f1 = `text-indigo-500`) + `animate-pulse` on `isCurrent` step, completed steps show `actorName`, `createdAt`, `comment`, attachment count badge (data-model.md §5.1)
- [ ] T018 [P] [US2] Add `workflowHistory` query to relevant hooks — update `frontend/hooks/use-rfa.ts` (or equivalent) to fetch `GET /workflow-engine/instances/:id/history` using TanStack Query key `['workflow-history', instanceId]`; add same to `frontend/hooks/use-correspondence.ts`
- [ ] T019 [US2] Add `WorkflowLifecycle` tab to `frontend/app/(dashboard)/rfas/[uuid]/page.tsx` inside existing `<Tabs>` (or add Tabs if missing) — pass `rfa.workflowHistory` and `currentState` props
- [ ] T020 [US2] Add `WorkflowLifecycle` tab to `frontend/app/(dashboard)/correspondences/[uuid]/page.tsx` — same as T019
- [ ] T021 [US2] Add `WorkflowLifecycle` tab to `frontend/app/(dashboard)/transmittals/[uuid]/page.tsx` — same as T019 (if applicable)
- [ ] T022 [US2] Add `WorkflowLifecycle` tab to `frontend/app/(dashboard)/circulation/[uuid]/page.tsx` — same as T019 (if applicable)

**Checkpoint**: Workflow tab visible on RFA/Correspondence pages. Current step Indigo+pulse. Completed steps show actor/date. No TypeScript errors. `pnpm lint` passes.

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

- [ ] T023 [US3] Extend `backend/src/modules/workflow-engine/workflow-engine.service.ts` — add `attachmentPublicIds: string[] = []` parameter to `processTransition()`, after `queryRunner.commitTransaction()` run bulk UPDATE to set `workflow_history_id = history.id` WHERE `uuid IN (:publicIds) AND is_temporary = false` (quickstart.md Step 5; data-model.md §6)
- [ ] T024 [US3] Add `getHistoryWithAttachments(instanceId: string)` method to `backend/src/modules/workflow-engine/workflow-engine.service.ts` — query `workflow_histories` WHERE `instance_id = :id` ORDER BY `created_at ASC`, eager-load attachments via LEFT JOIN, apply Redis cache key `wf:history:{instanceId}` TTL 3600s, invalidate on `processTransition()` success (research.md §6; contracts/workflow-transition.yaml)
- [ ] T025 [US3] Update `backend/src/modules/workflow-engine/workflow-engine.controller.ts` — add `@Headers('Idempotency-Key')` validation to `processTransition()` endpoint (throw `BadRequestException` if missing), add Redis idempotency check/store with key `idempotency:transition:{key}:{userId}` TTL 86400, swap `RbacGuard` for `WorkflowTransitionGuard` on transition endpoint (quickstart.md Step 6)
- [ ] T026 [US3] Add `GET /instances/:id/history` endpoint to `backend/src/modules/workflow-engine/workflow-engine.controller.ts` — decorated with `@RequirePermission('document.view')`, calls `workflowService.getHistoryWithAttachments(instanceId)` (contracts/workflow-transition.yaml §/instances/{instanceId}/history)
- [ ] T027 [P] [US3] Create `frontend/hooks/use-workflow-action.ts` — generates UUIDv7 idempotency key once per action intent (via `useState`), calls `workflowEngineService.transition()` with `Idempotency-Key` header, on success invalidates TanStack Query keys `['workflow-history', instanceId]` + parent document queries (quickstart.md Step 8)
- [ ] T028 [P] [US3] Add drag-and-drop file upload zone to `frontend/components/workflow/workflow-lifecycle.tsx` — renders only on `isCurrent` step, uses `<input type="file" multiple accept=".pdf,.docx,.xlsx,.dwg,.zip">` + drag events, calls existing Two-Phase upload service on drop, accumulates `publicId`s in local state, passes to `useWorkflowAction` on submit
- [ ] T029 [US3] Wire `useWorkflowAction` into `IntegratedBanner` action buttons in `frontend/components/workflow/integrated-banner.tsx` — `onAction` callback receives `(action, comment, attachmentPublicIds[])` and delegates to hook's `execute()` method; show loading spinner during `isPending`
- [ ] T030 [US3] Add `WorkflowTransitionGuard` unit tests in `backend/src/modules/workflow-engine/guards/workflow-transition.guard.spec.ts` — test all 4 RBAC levels: Superadmin pass, Org Admin same-org pass, Assigned Handler pass, unauthorized user → ForbiddenException
- [ ] T031 [US3] Add extended `processTransition()` unit tests in `backend/src/modules/workflow-engine/workflow-engine.service.spec.ts` — test: attachments linked to correct historyId, non-committed attachment rejected, idempotent replay returns cached result, Redlock contention throws 409

**Checkpoint**: POST transition with `attachmentPublicIds` succeeds. `attachment.workflow_history_id` set in DB. Duplicate `Idempotency-Key` returns cached response. Unauthorized user gets 403. Backend unit tests pass ≥80% coverage on new logic.

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

- [ ] T032 [P] [US4] Verify `backend/src/common/file-storage/file-storage.controller.ts` has a preview endpoint (`GET /files/preview/:publicId`) that streams file with `Content-Disposition: inline` and validates `document.view` permission — if missing, add it to `file-storage.controller.ts` and `file-storage.service.ts`
- [ ] T033 [US4] Create `frontend/components/common/file-preview-modal.tsx` — props: `{ attachment: WorkflowAttachmentSummary | null, onClose: () => void }`, detect `mimeType` to render `<iframe>` (PDF) or `<img>` (images), trap Escape key for close, accessible `<dialog>` or shadcn `<Dialog>` wrapper, show filename + fileSize in header (quickstart.md Step 9 `FilePreviewModal Props`)
- [ ] T034 [US4] Wire `FilePreviewModal` into `frontend/app/(dashboard)/rfas/[uuid]/page.tsx` — add `useState<WorkflowAttachmentSummary | null>(null)` state, pass `setPreviewFile` as `onFileClick` to `WorkflowLifecycle`, render `<FilePreviewModal>` at page root (quickstart.md Step 10)
- [ ] T035 [US4] Wire `FilePreviewModal` into `frontend/app/(dashboard)/correspondences/[uuid]/page.tsx` — same pattern as T034

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

- [ ] T036 [P] [US5] Add i18n keys for `IntegratedBanner` strings to `frontend/public/locales/th/common.json` and `frontend/public/locales/en/common.json` — keys: `workflow.priority.*`, `workflow.action.*`, `workflow.status.*` (05-08-i18n-guidelines.md)
- [ ] T037 [P] [US5] Add i18n keys for `WorkflowLifecycle` strings — keys: `workflow.timeline.step.*`, `workflow.timeline.noHistory`, `workflow.timeline.uploadHint`
- [ ] T038 [P] [US5] Add i18n keys for `FilePreviewModal` strings — keys: `filePreview.title`, `filePreview.unavailable`, `filePreview.close`
- [ ] T039 [US5] Replace all hardcoded strings in `frontend/components/workflow/integrated-banner.tsx`, `frontend/components/workflow/workflow-lifecycle.tsx`, and `frontend/components/common/file-preview-modal.tsx` with `t('key')` calls using the project's i18n hook

**Checkpoint**: No hardcoded Thai text in new component JSX. Switching locale changes all new UI strings. `pnpm lint` and `pnpm tsc --noEmit` pass.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Documentation, edge case hardening, full regression verification.

- [ ] T040 [P] Update `specs/03-Data-and-Storage/03-01-data-dictionary.md` — add entry for `attachments.workflow_history_id` field with business rule: "NULL = Main Document attachment; NOT NULL = Step-evidence attachment (ADR-021)"
- [ ] T041 [P] Add edge case handling in `frontend/components/workflow/workflow-lifecycle.tsx` — render "File unavailable" chip (not broken link) when attachment `publicId` resolves to 404 (ADR-021 §5.2 — "ไฟล์ถูกลบจาก Storage หลัง Attach")
- [ ] T042 [P] Add error boundary for `WorkflowLifecycle` and `FilePreviewModal` in their parent pages — catches unexpected failures without crashing the full detail page
- [ ] T043 Verify Redis cache invalidation works end-to-end: after `processTransition()`, query `wf:history:{instanceId}` in Redis — must be empty; subsequent GET history refetches from DB
- [ ] T044 Run full backend test suite and confirm coverage ≥70% overall, ≥80% for `workflow-engine.service.ts` new code paths: `cd backend && pnpm test --coverage`
- [ ] T045 Run full frontend type check and lint: `cd frontend && pnpm tsc --noEmit && pnpm lint` — zero errors
- [ ] T046 Run E2E smoke test per quickstart.md verification section — submit RFA approval with 1 attachment, verify DB state
- [ ] T047 Update `CHANGELOG.md` — add entry for v1.8.6: "feat(workflow): ADR-021 Integrated Workflow Context & Step-specific Attachments"

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
- **Phase 5**: T023 → T024 → T025 → T026 → (T027, T028 parallel) → T029 → T030, T031 (parallel)
- **Phase 6**: T032 → T033 → T034, T035 (parallel)
- **Phase 7**: T036, T037, T038 (parallel) → T039
- **Phase 8**: T040–T042 (parallel) → T043 → T044 → T045 → T046 → T047

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
| **Total Tasks** | 47 |
| **Phase 1 (Setup)** | 3 |
| **Phase 2 (Foundation)** | 6 |
| **Phase 3 (US1 — Banner)** | 7 |
| **Phase 4 (US2 — Timeline)** | 6 |
| **Phase 5 (US3 — Attachments)** | 9 |
| **Phase 6 (US4 — Preview)** | 4 |
| **Phase 7 (US5 — i18n)** | 4 |
| **Phase 8 (Polish)** | 8 |
| **Parallelizable [P] tasks** | 22 |
| **MVP scope (US1+US2 only)** | 19 tasks |

### Commit Message Convention

```
feat(workflow): T004 apply ADR-021 schema delta — workflow_history_id on attachments
feat(workflow): T012 add IntegratedBanner component (US1)
feat(workflow): T017 add WorkflowLifecycle vertical timeline (US2)
feat(workflow): T023 extend processTransition with attachmentPublicIds (US3)
feat(workflow): T033 add FilePreviewModal for inline PDF/image (US4)
feat(i18n): T036-T039 add i18n keys for ADR-021 UI strings (US5)
```
