# Tasks: Unified Workflow Engine — Production Hardening & Integrated Context

**Input**: Design documents from `specs/003-unified-workflow-engine/`  
**Prerequisites**: plan.md ✅ | spec.md ✅ | data-model.md ✅ | research.md ✅ | contracts/ ✅ | quickstart.md ✅  
**Tests**: Included for business-critical paths (per plan.md Test Plan)

**Organization**: Tasks grouped by user story (US1–US5) enabling independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no shared dependencies)
- **[Story]**: Which user story this task belongs to
- **Exact file paths** included in all descriptions

---

## Phase 1: Setup (Schema Deltas — DB Prerequisites)

**Purpose**: Create and apply schema changes that ALL subsequent code depends on. No code changes until Phase 1 is complete.

**⚠️ MUST apply to DB before writing any entity code**

- [ ] T001 Create `specs/03-Data-and-Storage/deltas/09-add-version-no-to-workflow-instances.sql` — `ALTER TABLE workflow_instances ADD COLUMN version_no INT NOT NULL DEFAULT 1` with `idx_wf_inst_version` index (per data-model.md §1 Delta 09)
- [ ] T002 Create `specs/03-Data-and-Storage/deltas/10-add-action-by-user-uuid-to-workflow-histories.sql` — `ALTER TABLE workflow_histories ADD COLUMN action_by_user_uuid VARCHAR(36) NULL` (per data-model.md §1 Delta 10)
- [ ] T003 Apply Delta 09 to MariaDB: `source specs/03-Data-and-Storage/deltas/09-add-version-no-to-workflow-instances.sql` — verify with `DESCRIBE workflow_instances`
- [ ] T004 Apply Delta 10 to MariaDB: `source specs/03-Data-and-Storage/deltas/10-add-action-by-user-uuid-to-workflow-histories.sql` — verify with `DESCRIBE workflow_histories`

**Checkpoint**: Run `DESCRIBE workflow_instances` and `DESCRIBE workflow_histories` — both new columns must be present before Phase 2 begins.

---

## Phase 2: Foundational (Entity & Module Setup — Blocking Prerequisites)

**Purpose**: Entity/DTO/module changes that ALL user story implementations depend on. No user story work until Phase 2 is complete.

**⚠️ CRITICAL — blocks all phases 3+**

- [ ] T005 [P] Add `versionNo: number` column to `backend/src/modules/workflow-engine/entities/workflow-instance.entity.ts` — `@Column({ name: 'version_no', type: 'int', default: 1 })` (per data-model.md §2.1)
- [ ] T006 [P] Add `actionByUserUuid?: string` column to `backend/src/modules/workflow-engine/entities/workflow-history.entity.ts` — `@Column({ name: 'action_by_user_uuid', length: 36, nullable: true })` (per data-model.md §2.2)
- [ ] T007 [P] Add `actorUuid?: string` field to `backend/src/modules/workflow-engine/dto/workflow-history-item.dto.ts` with `@ApiPropertyOptional` decorator (per data-model.md §2.3)
- [ ] T008 Register `workflow_transitions_total` Counter and `workflow_transition_duration_ms` Histogram in `backend/src/modules/workflow-engine/workflow-engine.module.ts` via `makeCounterProvider` / `makeHistogramProvider` from `@willsoto/nestjs-prometheus` (per data-model.md §4, plan.md Phase B5)
- [ ] T009 [P] Verify backend TypeScript compiles with no errors after T005–T008: `pnpm tsc --noEmit` in `backend/`

**Checkpoint**: `pnpm tsc --noEmit` passes in backend. Existing workflow-engine tests still pass: `pnpm test --testPathPattern=workflow-engine`.

---

## Phase 3: User Story 1 — Workflow Transition with State Integrity (P1) 🎯 MVP

**Goal**: Guarantee race-condition-free state transitions with optimistic lock, CASL-mapped DSL role checks, structured observability, BullMQ dead-letter queue, and file rollback on DB failure.

**Independent Test**: POST 50 concurrent APPROVE requests on one instance → exactly 1 success (200) + 49 conflicts (409). Transition log entry appears for each outcome. Redlock metric increments.

### Implementation — US1 Core: Optimistic Lock

- [ ] T010 [US1] Update `processTransition()` signature in `backend/src/modules/workflow-engine/workflow-engine.service.ts` — add `userUuid: string` and `clientVersionNo?: number` parameters (per data-model.md §3, quickstart.md)
- [ ] T011 [US1] Add fast-fail optimistic lock check in `processTransition()` BEFORE Redlock acquisition: read `instance.versionNo`, compare with `clientVersionNo`, throw `ConflictException('WORKFLOW_VERSION_CONFLICT')` HTTP 409 on mismatch (per data-model.md §3 "Fast-fail check")
- [ ] T012 [US1] Add CAS version increment inside DB transaction in `processTransition()`: `UPDATE workflow_instances SET version_no = version_no + 1 WHERE id = :id AND version_no = :expected` — throw `ConflictException` if `affected === 0` (per data-model.md §3 "Version increment")
- [ ] T013 [US1] Populate `actionByUserUuid: userUuid` when creating `WorkflowHistory` record inside `processTransition()` (per data-model.md §3 "History creation")
- [ ] T014 [US1] Return `versionNo` (post-increment value) in the transition response DTO so clients can update their local version

### Implementation — US1: CASL DSL Role Mapping (FR-002a)

- [ ] T015 [US1] Add `DSL_ROLE_TO_CASL` config map constant in `backend/src/modules/workflow-engine/guards/workflow-transition.guard.ts`: map `Superadmin → system.manage_all`, `OrgAdmin → organization.manage_users`, `ContractMember → contract.view`, `AssignedHandler → __assigned__` (per research.md Decision 2, quickstart.md)
- [ ] T016 [US1] Add DSL role resolution step in `WorkflowTransitionGuard.canActivate()`: load compiled definition from instance, extract `require.role[]` for `currentState`, map each via `DSL_ROLE_TO_CASL`, check `userPermissions.includes(mapped)` — pass if any match; fall through to existing Level 3 check for `__assigned__` (per plan.md Phase B4, quickstart.md "DSL Role Mapping" pattern)

### Implementation — US1: Structured Observability (FR-022, FR-023)

- [ ] T017 [US1] Inject `workflow_transitions_total` Counter and `workflow_transition_duration_ms` Histogram via `@InjectMetric()` in `WorkflowEngineService` constructor (per data-model.md §4)
- [ ] T018 [US1] Wrap `processTransition()` body in `startMs = Date.now()` timer; add `try/catch/finally` block that: labels `outcome` from exception type, calls `transitionDuration.labels({workflow_code}).observe(durationMs)`, calls `transitionsTotal.labels({workflow_code, action, outcome}).inc()`, emits structured `this.logger.log(JSON.stringify({instanceId, action, fromState, toState, userUuid, durationMs, outcome, workflowCode}))` (per data-model.md §4, FR-022/023)

### Implementation — US1: BullMQ Dead-Letter Queue (FR-005, FR-006)

- [ ] T019 [US1] Register `workflow-events-failed` queue in `backend/src/modules/workflow-engine/workflow-engine.module.ts` — inject via `BullModule.registerQueue({ name: 'workflow-events-failed' })` (per plan.md Phase B7)
- [ ] T020 [US1] Add `@OnWorkerEvent('failed')` handler `onJobFailed(job, error)` in `backend/src/modules/workflow-engine/workflow-event.service.ts`: if `job.attemptsMade >= job.opts.attempts`, add job to `workflow-events-failed` queue; if `N8N_WEBHOOK_URL` env var set, POST JSON payload via `fetch`; else `logger.warn('N8N_WEBHOOK_URL not configured')` (per data-model.md §6, research.md Decision 5)
- [ ] T021 [US1] Verify worker default options in `workflow-engine.module.ts` have `concurrency: 5`, `attempts: 3`, `backoff: { type: 'exponential', delay: 500 }`, `removeOnFail: false` (per FR-005, plan.md Phase B7)

### Implementation — US1: File Rollback on DB Failure (FR-019)

- [ ] T022 [US1] In `processTransition()` `catch` block, after `queryRunner.rollbackTransaction()`, call `storageService.moveToTemp(attachmentPublicIds)` when `attachmentPublicIds` is non-empty — log rollback with attachment IDs for audit (per plan.md Phase B8, FR-019)
- [ ] T023 [US1] Inject `StorageService` (or `FileStorageService`) into `WorkflowEngineService` constructor for rollback call — add to `workflow-engine.module.ts` imports if not already present

### Tests — US1

- [ ] T024 [P] [US1] Write unit test in `backend/src/modules/workflow-engine/workflow-engine.service.spec.ts` — concurrent optimistic lock: mock two simultaneous calls with same `clientVersionNo`, assert first resolves success and second throws `ConflictException` with code `WORKFLOW_VERSION_CONFLICT`
- [ ] T025 [P] [US1] Write unit test in `backend/src/modules/workflow-engine/guards/workflow-transition.guard.spec.ts` — DSL role CASL mapping: assert `Superadmin` maps to `system.manage_all` pass, `OrgAdmin` with matching org passes, unknown role falls through to assignedUserId check
- [ ] T026 [P] [US1] Write unit test for `onJobFailed` in `workflow-event.service.ts` — assert `workflow-events-failed` queue receives dead-letter job and `fetch` is called with correct payload when `N8N_WEBHOOK_URL` is set; assert `logger.warn` when unset

**Checkpoint**: `pnpm test --testPathPattern=workflow-engine --coverage` — T024/T025/T026 green. Concurrent lock test passes.

---

## Phase 4: User Story 2 — Integrated Banner & Workflow Lifecycle View (P1)

**Goal**: All four document detail pages (RFA, Transmittal, Circulation, Correspondence) display live `workflowState`, `availableActions`, and priority badge with no navigation required for approval.

**Independent Test**: Open each detail page while a workflow instance is in `PENDING_REVIEW` — banner shows correct state + action buttons; Workflow Engine tab shows step timeline with active step highlighted in indigo + pulse animation.

### Implementation — US2: Correspondence Backend Gap-Fill

- [ ] T027 [US2] Update `backend/src/modules/correspondence/correspondence.service.ts` `findOneByUuid()` — call `workflowEngineService.getInstanceByEntity('correspondence', correspondence.uuid)` and expose `workflowInstanceId`, `workflowState`, `availableActions` in the response (same pattern as Transmittal/Circulation per v1.8.7 memory)
- [ ] T028 [US2] Update `backend/src/modules/correspondence/correspondence.module.ts` — import `WorkflowEngineModule` if not already imported

### Implementation — US2: Frontend Module Gap-Fill (all 4 modules)

- [ ] T029 [P] [US2] Gap-fill `frontend/app/(admin)/admin/doc-control/correspondence/[uuid]/page.tsx` — wire live `workflowInstanceId`, `workflowState`, `availableActions`, `workflowPriority` into `<IntegratedBanner>` and `<WorkflowLifecycle>` components; update Correspondence type in `frontend/types/` to include workflow fields
- [ ] T030 [P] [US2] Gap-fill `frontend/app/(admin)/admin/doc-control/rfa/[uuid]/page.tsx` — connect missing `availableActions` and `workflowPriority` props to `<IntegratedBanner>`; ensure `<WorkflowLifecycle>` receives live `instanceId`
- [ ] T031 [P] [US2] Gap-fill `frontend/app/(admin)/admin/doc-control/transmittals/[uuid]/page.tsx` — add step-attachment upload zone props (`canUpload` flag computed from `currentState ∈ {PENDING_REVIEW, PENDING_APPROVAL}` AND user is assigned/org-admin/superadmin)
- [ ] T032 [P] [US2] Gap-fill `frontend/app/(admin)/admin/doc-control/circulation/[uuid]/page.tsx` — same step-attachment upload zone props as T031
- [ ] T033 [US2] Update `frontend/types/correspondence.ts` (or equivalent) — add `workflowInstanceId?: string`, `workflowState?: string`, `availableActions?: string[]`, `workflowPriority?: 'URGENT' | 'HIGH' | 'MEDIUM' | 'LOW'` (ADR-019: string UUIDs only, no parseInt)

### Tests — US2

- [ ] T034 [P] [US2] Verify `pnpm tsc --noEmit` in `frontend/` passes after T029–T033 — all four detail pages type-check correctly

**Checkpoint**: All four detail pages render `<IntegratedBanner>` with live data. Switch a document to `PENDING_REVIEW` — banner shows correct action buttons without page navigation.

---

## Phase 5: User Story 3 — Step-specific Attachments with Preview (P1)

**Goal**: Users in `PENDING_REVIEW` / `PENDING_APPROVAL` states can upload files via drag-and-drop, attached atomically to the workflow step. All users can preview PDFs/images inline without navigation.

**Independent Test**: Upload a PDF during `PENDING_REVIEW` → click Approve → history timeline shows the file chip → click chip → preview modal opens inline. Force-fail DB transaction → file appears back in temp, permanent storage unchanged.

### Implementation — US3: File Preview Modal (FR-020)

- [ ] T035 [P] [US3] Create `frontend/components/workflow/file-preview-modal.tsx` — shadcn/ui `Dialog` component; accepts `attachment: WorkflowAttachmentSummary | null` and `onClose: () => void` props; renders `<iframe src="/api/files/{publicId}/preview" />` for PDFs; `<img>` for image MIME types; download link fallback for other types (per plan.md Phase F1, quickstart.md "File Preview Modal")
- [ ] T036 [P] [US3] Add `WorkflowAttachmentSummary` interface to `frontend/types/workflow.ts` if not present: `{ publicId: string; originalFilename: string; mimeType: string; fileSize: number; createdAt: string }` (ADR-019: `publicId` only, no `id` or `uuid` alias)

### Implementation — US3: Step-Attachment Upload Zone (FR-014–FR-019)

- [ ] T037 [US3] Update `frontend/components/workflow/integrated-banner.tsx` — add conditional upload zone rendered only when `props.currentState ∈ {PENDING_REVIEW, PENDING_APPROVAL}` AND `props.canUpload === true`; upload calls existing Two-Phase upload endpoint; appends returned `publicId` to `pendingAttachmentIds` state; passes `pendingAttachmentIds` to action button handler (per plan.md Phase F2)
- [ ] T038 [US3] Update `frontend/components/workflow/workflow-lifecycle.tsx` — for each history item render `attachments[]` as clickable file chips; on chip click open `<FilePreviewModal>`; import and use `FilePreviewModal` from T035 (per plan.md Phase F2)
- [ ] T039 [US3] Update `frontend/hooks/use-workflow-action.ts` — accept `attachmentPublicIds: string[]` parameter; include in POST body to `/workflow-engine/instances/:id/transition`; include `versionNo` from current instance state; on HTTP 409 show toast "เอกสารถูกอนุมัติโดยผู้อื่นแล้ว กรุณารีเฟรช"; on 503 show toast "ระบบยุ่งชั่วคราว กรุณาลองใหม่" (per quickstart.md "Optimistic Lock — Client Side")
- [ ] T040 [US3] Update `backend/src/modules/workflow-engine/workflow-engine.controller.ts` — ensure `POST /instances/:id/transition` accepts `Idempotency-Key` header and passes `userUuid` (from JWT) and `clientVersionNo` to `processTransition()` (per contracts/workflow-transition.yaml)
- [ ] T041 [US3] Verify `WorkflowHistoryItemDto` exposes `attachments: AttachmentSummaryDto[]` in the history list endpoint response — update `getHistory()` method in `workflow-engine.service.ts` to eagerly load `attachments` relation per `workflow_history_id` (per data-model.md §3, FR-014)

### Tests — US3

- [ ] T042 [P] [US3] Write unit test in `backend/src/modules/workflow-engine/workflow-engine.service.spec.ts` — file rollback: mock `queryRunner.commitTransaction()` to throw; assert `storageService.moveToTemp()` is called with the correct `attachmentPublicIds` (per plan.md Test Plan)
- [ ] T043 [P] [US3] Write Vitest component test in `frontend/components/workflow/__tests__/file-preview-modal.test.tsx` — assert PDF renders `<iframe>`, image MIME type renders `<img>`, unsupported type renders download link, `onClose` called on dialog dismiss

**Checkpoint**: Upload a PDF on a document in `PENDING_REVIEW` → approve → check `workflow_histories` record has matching `workflow_history_id` in `attachments` table. Click the file chip → modal opens inline.

---

## Phase 6: User Story 4 — DSL Versioning & Instance Binding (P2)

**Goal**: Super Admins can activate new DSL versions; in-progress workflow instances continue on their bound definition version; Redis cache invalidates within 1 second of activation (SC-005).

**Independent Test**: Activate DSL v2 while v1 has an in-progress instance → existing instance still uses v1 DSL transitions; new instance created after activation uses v2.

### Implementation — US4: DSL Redis Cache Invalidation (FR-007, SC-005)

- [ ] T044 [US4] In `workflow-engine.service.ts` `createDefinition()` — after `workflowDefRepo.save()`, call `cacheManager.set('wf:def:${code}:${version}', saved, 3600000)` (1h TTL in ms) (per data-model.md §5, research.md Decision 4)
- [ ] T045 [US4] In `workflow-engine.service.ts` `update()` — before save, call `cacheManager.del('wf:def:${code}:${oldVersion}')` when DSL changes; when `is_active` toggles to `true`, call `redis.del('wf:def:${code}:active')` then set updated pointer; when `is_active` toggles to `false`, call `redis.del('wf:def:${code}:active')` (per data-model.md §5 "Invalidation triggers")
- [ ] T046 [US4] Add read-through cache in `getDefinitionById()`: call `cacheManager.get('wf:def:${id}')` first; fall back to `workflowDefRepo.findOne()` on miss; store result in cache before returning (per research.md Decision 4)
- [ ] T047 [US4] Verify `createInstance()` always uses latest active definition from DB (not cache) to prevent stale binding — confirm `findOne({ where: { workflow_code, is_active: true }, order: { version: 'DESC' } })` pattern is authoritative (per FR-010)

### Tests — US4

- [ ] T048 [P] [US4] Write unit test in `workflow-engine.service.spec.ts` — DSL activate cache invalidation: mock `cacheManager.del`, call `update({ is_active: true })`, assert `cacheManager.del` called with correct key within the same tick (per plan.md Test Plan)

**Checkpoint**: Activate DSL v2 via `PATCH /workflow-engine/definitions/:id` → Redis key `wf:def:{code}:active` updated immediately. In-progress v1 instance transitions still resolve against v1 compiled DSL.

---

## Phase 7: User Story 5 — Workflow Definition Authoring (Super Admin) (P2)

**Goal**: Super Admins can list, create, edit (JSON editor with inline validation), activate, and deactivate DSL definitions from an Admin UI page without touching the API directly.

**Independent Test**: Log in as Super Admin → navigate to `/admin/workflows/definitions` → create a new definition with an invalid DSL → see inline validation error before saving → fix → save → new definition appears in list.

### Implementation — US5: Backend `/validate` Endpoint (FR-025)

- [ ] T049 [US5] Add `POST /workflow-engine/definitions/validate` endpoint to `backend/src/modules/workflow-engine/workflow-engine.controller.ts` — accepts `{ dsl: object }`, calls `dslService.compile(dto.dsl)` in try/catch, returns `{ valid: true }` or `{ valid: false, errors: [{ path, message }] }` (per contracts/workflow-definitions.yaml, FR-025)

### Implementation — US5: TanStack Query Hooks

- [ ] T050 [P] [US5] Create `frontend/hooks/use-workflow-definitions.ts` — `useWorkflowDefinitions()` (GET list), `useWorkflowDefinition(id)` (GET single), `useCreateDefinition()` (POST mutation), `useUpdateDefinition()` (PATCH mutation), `useValidateDsl()` (POST validate mutation) — all using TanStack Query v5 patterns (per quickstart.md)

### Implementation — US5: Admin DSL List Page

- [ ] T051 [US5] Create `frontend/app/(admin)/admin/workflows/definitions/page.tsx` — Server Component shell + Client Component table; columns: `workflow_code`, `version`, `is_active` badge, created date, Actions (Edit link, Activate/Deactivate toggle button); uses `useWorkflowDefinitions()` hook; Activate/Deactivate calls `useUpdateDefinition()` mutation with `{ is_active: true/false }`; requires `system.manage_all` permission (CASL guard on page) (per plan.md Phase F4, FR-024)

### Implementation — US5: Admin DSL Editor Page

- [ ] T052 [US5] Create `frontend/app/(admin)/admin/workflows/definitions/[id]/page.tsx` — loads definition via `useWorkflowDefinition(id)`; renders Monaco Editor via `dynamic(() => import('@monaco-editor/react'), { ssr: false })`; `onChange` handler debounced 800ms calls `useValidateDsl()` mutation; displays validation errors as inline error list below editor; Save button disabled when `validationErrors.length > 0` (FR-025); on Save calls `useUpdateDefinition()` and shows success toast; i18n keys for all UI text (per research.md Decision 6, quickstart.md "Admin DSL Editor")
- [ ] T053 [US5] Create `frontend/app/(admin)/admin/workflows/definitions/new/page.tsx` — same editor as T052 but calls `useCreateDefinition()` mutation; `workflow_code` input field with validation; redirect to list page on success

### Tests — US5

- [ ] T054 [P] [US5] Write Vitest test for `frontend/app/(admin)/admin/workflows/definitions/[id]/page.tsx` — assert Save button is disabled when validation errors present; assert Save button enabled when `validationErrors` is empty; assert `useValidateDsl` is called on editor change (per plan.md Test Plan)

**Checkpoint**: Navigate to `/admin/workflows/definitions` — list renders all definitions. Click Edit → Monaco editor loads definition DSL. Paste invalid DSL → Save button disables and errors display inline. Fix DSL → Save enabled → save succeeds.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: i18n coverage, SC-009 verification, and spec compliance checks across all user stories.

- [ ] T055 [P] Audit all new UI text in `frontend/components/workflow/` and `frontend/app/(admin)/admin/workflows/` — replace any hardcoded Thai/English strings with i18n keys; add missing keys to `frontend/public/locales/th/` and `frontend/public/locales/en/` translation files (FR-021)
- [ ] T056 [P] Run full backend test suite: `pnpm test --coverage` in `backend/` — confirm no regressions; coverage ≥ 70% overall, ≥ 80% on `workflow-engine.service.ts` business logic (per plan.md Test Plan)
- [ ] T057 [P] Run full frontend typecheck: `pnpm tsc --noEmit` in `frontend/` — zero errors across all modified files
- [ ] T058 Verify SC-009 observability coverage: trigger one transition of each outcome type (success, conflict, forbidden, validation_error) and confirm structured log entries appear in the NestJS log output with all required fields (`instanceId`, `action`, `fromState`, `toState`, `userUuid`, `durationMs`, `outcome`, `workflowCode`)
- [ ] T059 Update `specs/003-unified-workflow-engine/spec.md` Status field from `Draft` to `Implemented` after all phases complete

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 DB columns applied — **BLOCKS Phases 3–7**
- **Phase 3 (US1)**: Depends on Phase 2 — can start as soon as entities compile
- **Phase 4 (US2)**: Depends on Phase 2 — independent of Phase 3 (different files)
- **Phase 5 (US3)**: Depends on Phase 3 (uses updated `processTransition` + `use-workflow-action`) and Phase 4 (upload zone sits inside `IntegratedBanner`)
- **Phase 6 (US4)**: Depends on Phase 2 — independent of US1/US2/US3
- **Phase 7 (US5)**: Depends on Phase 6 (T049 validate endpoint, T044 cache) — `/validate` endpoint needed for editor inline feedback
- **Phase 8 (Polish)**: Depends on all phases complete

### User Story Dependencies

- **US1 (P1)**: Starts after Phase 2 — no US dependencies
- **US2 (P1)**: Starts after Phase 2 — no US dependencies (parallel with US1)
- **US3 (P1)**: Starts after US1 (T039 needs updated hook signature) and US2 (upload zone in banner)
- **US4 (P2)**: Starts after Phase 2 — independent (parallel with US1/US2)
- **US5 (P2)**: Starts after US4 (T049 validate endpoint depends on DSL cache from T044)

### Within Each Phase

- Schema before entities → entities before services → services before controllers → backend before frontend
- [P] tasks within a phase can run in parallel (different files)

---

## Parallel Execution Examples

### Phase 2 Parallel (T005–T007 run together)

```
T005: workflow-instance.entity.ts   ← add versionNo
T006: workflow-history.entity.ts    ← add actionByUserUuid
T007: workflow-history-item.dto.ts  ← add actorUuid
```

### Phase 3 Parallel Groups

```
Group A (processTransition core): T010 → T011 → T012 → T013 → T014 (sequential)
Group B (guard): T015 → T016 (sequential, different file from Group A — parallel with Group A)
Group C (observability): T017 → T018 (different file — parallel with Groups A+B)
Group D (BullMQ): T019 → T020 → T021 (different service file — parallel with Groups A+B+C)
Tests: T024, T025, T026 (parallel with each other after Groups A+B+D complete)
```

### Phase 4 + Phase 6 Parallel (different feature areas)

```
Phase 4 (US2): T027–T034 — Correspondence backend + frontend gap-fill
Phase 6 (US4): T044–T048 — DSL cache invalidation
(Run simultaneously — no shared files)
```

---

## Implementation Strategy

### MVP Scope (US1 + US2 + US3 — all P1)

```
Phase 1 → Phase 2 → Phase 3 (US1) → Phase 4 (US2) → Phase 5 (US3) → Phase 8 Polish
```

Delivers: Race-condition-free transitions, live banner on all 4 modules, step-specific attachments with preview.

### Full Delivery (adds P2 stories)

```
MVP + Phase 6 (US4) + Phase 7 (US5)
```

Adds: Redis cache invalidation, Admin DSL editor.

### Suggested First Commit

After T001–T009 (schema + entities compile) → commit:
```
chore(schema): delta-09 version_no, delta-10 action_by_user_uuid (ADR-009)
feat(workflow-engine): add versionNo + actionByUserUuid entities + metrics registration (FR-002/003)
```

---

## Summary

| Phase | User Story | Tasks | Parallel Opportunities |
|-------|-----------|-------|----------------------|
| 1 — Setup | Schema | T001–T004 | T001+T002 parallel |
| 2 — Foundational | — | T005–T009 | T005+T006+T007 parallel |
| 3 — P1 US1 | Transition Integrity | T010–T026 | Guard + observability + BullMQ parallel; tests parallel |
| 4 — P1 US2 | Banner Gap-Fill | T027–T034 | T029+T030+T031+T032+T033 parallel |
| 5 — P1 US3 | Step Attachments | T035–T043 | T035+T036 parallel; tests parallel |
| 6 — P2 US4 | DSL Versioning | T044–T048 | T044+T046+T047 parallel |
| 7 — P2 US5 | Admin DSL Editor | T049–T054 | T050+T054 parallel |
| 8 — Polish | Cross-cutting | T055–T059 | T055+T056+T057 parallel |
| **Total** | | **59 tasks** | **~22 parallel opportunities** |

**MVP**: T001–T043 (43 tasks, Phases 1–5, all P1 stories)  
**Full**: T001–T059 (59 tasks, all phases)
