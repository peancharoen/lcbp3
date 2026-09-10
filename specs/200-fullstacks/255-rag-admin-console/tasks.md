// File: specs/200-fullstacks/255-rag-admin-console/tasks.md
// Change Log:
// - 2026-09-10: Initial tasks for Feature 255 RAG Admin Console
// - 2026-09-10: Updated with interview decisions Q1-Q45 (route prefix, 8 endpoints, 4 permissions, status enum, orphan scan, retryIngestion, ADR-053)

# Tasks: RAG Admin Console

**Input**: Design documents from `/specs/200-fullstacks/255-rag-admin-console/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: TDD approach — tests written FIRST, fail before implementation.

**Organization**: Tasks grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Web app**: `backend/src/`, `frontend/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Permission seeds, i18n namespace, shared service + types, ADR-053

- [ ] T001 Add `rag.admin.write` permission to `specs/03-Data-and-Storage/lcbp3-v1.9.0-seed-permissions.sql` (Superadmin only grant) — force re-ingest + metrics reset (Q3, Q39)
- [ ] T002 [P] Add `rag.retry` permission to `specs/03-Data-and-Storage/lcbp3-v1.9.0-seed-permissions.sql` (Superadmin + Org Admin grants) — batch retry (Q3, Q39)
- [ ] T003 [P] Create production delta SQL `specs/03-Data-and-Storage/deltas/2026-09-10-rag-admin-permissions.sql` — INSERT rag.admin.write + rag.retry permissions + role grants (Q38)
- [ ] T004 [P] Create rollback delta SQL `specs/03-Data-and-Storage/deltas/2026-09-10-rag-admin-permissions-rollback.sql` — DELETE for rollback (Q38)
- [ ] T005 [P] Add `rag.admin.*` i18n namespace to `frontend/public/locales/en/ai.json` (sub-namespaces: dashboard, classification, lifecycle, metrics, retry, status, errors, empty_states — Q22)
- [ ] T006 [P] Add `rag.admin.*` i18n namespace to `frontend/public/locales/th/ai.json` (Thai translations matching en keys — Q22)
- [ ] T007 [P] Create `backend/src/modules/ai/dto/rag-admin.dto.ts` — all admin DTOs (RagAdminListAttachmentsDto with enum pageSize [10,20,50], RagAdminClassificationListDto, RagAdminBatchRetryDto with @ArrayMaxSize(50), response DTOs — NO RagAdminResetMetricsDto since global-only with no body Q15)
- [ ] T008 [P] Create `frontend/lib/services/admin-rag.service.ts` — API client for all 8 admin endpoints (single file, Q44)
- [ ] T009 Review `specs/06-Decision-Records/ADR-053-rag-admin-console-architecture.md` (already created and committed — review during implementation if new architectural details emerge, update if needed)

**Checkpoint**: Shared infrastructure ready — permissions seeded, DTOs + frontend service + i18n + ADR-053

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Backend admin controller + service + frontend hooks + shared components

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T010 Create `backend/src/modules/ai/rag-admin.controller.ts` — base controller with `@UseGuards(JwtAuthGuard, RbacGuard)`, `@Controller('ai/admin/rag')` (route prefix Q1), empty endpoint stubs for 8 endpoints
- [ ] T011 Create `backend/src/modules/ai/services/rag-admin.service.ts` — admin service for list/aggregate/metrics/retry operations (separate from RagAttachmentController, Q2)
- [ ] T012 Wire `RagAdminController` + `RagAdminService` into `backend/src/modules/ai/ai.module.ts` (controllers + providers arrays)
- [ ] T013 [P] Create `frontend/hooks/ai/use-rag-admin.ts` — TanStack Query hooks (useRagAttachments, useRagClassificationList, useRagGenerations, useRagMetrics, useRagFailedIngestions, mutations for reingest/retry/reset/classification)
- [ ] T014 [P] Create `frontend/components/admin/ai/rag-console/RagStatusBadge.tsx` — reusable status badge (NOT_STARTED/BUILDING/ACTIVE/RETIRED/FAILED with colors — actual enum, Q5)
- [ ] T015 [P] Create `frontend/components/admin/ai/rag-console/ClassificationBadge.tsx` — reusable classification badge (PUBLIC/INTERNAL/CONFIDENTIAL)
- [ ] T016 [P] Create `frontend/components/admin/ai/rag-console/ServiceUnavailableBanner.tsx` — banner triggered by `GET /ai/admin/health` polling (Q40 — show when Ollama/Qdrant/OCR status = DOWN)
- [ ] T017 [P] Create `frontend/components/admin/ai/rag-console/EmptyState.tsx` — per-tab empty state with context + suggested action (Q41)
- [ ] T018 Add nav link to RAG Admin in `frontend/app/(admin)/admin/ai/layout.tsx` or header component — route `/admin/ai/rag-console/` (Q23)

**Checkpoint**: Foundation ready — controller + service wired, hooks ready, shared components available

---

## Phase 3: User Story 1 - Ingestion Status Dashboard (Priority: P1) 🎯 MVP

**Goal**: Admin sees all attachments with RAG ingestion status (NOT_STARTED/BUILDING/ACTIVE/RETIRED/FAILED), chunk count, aiProcessingStatus, auto-polling 10s

**Independent Test**: Open `/admin/ai/rag-console/`, verify attachments listed with status, chunk count, last-updated; filter by project/status; paginate; auto-polling refreshes every 10s; polling stops when tab backgrounded

### Tests for User Story 1

- [ ] T019 [P] [US1] Write backend test for `GET /ai/admin/rag/attachments` list+paginate+filter in `backend/src/modules/ai/rag-admin.controller.spec.ts` — verify left join includes NOT_STARTED attachments, ROW_NUMBER() window function, enum pageSize validation [10,20,50], aiProcessingStatus column (Q5, Q7, Q9, Q20)
- [ ] T020 [P] [US1] Write backend test for `RagAdminService.listAttachments()` in `backend/src/modules/ai/services/rag-admin.service.spec.ts` — verify single SQL query with left join + ROW_NUMBER() OVER (PARTITION BY attachmentUuid ORDER BY createdAt DESC), grouped chunk count, classificationOverride from audit log (Q9, Q10, Q11)
- [ ] T021 [P] [US1] Write frontend test for status dashboard tab in `frontend/app/(admin)/admin/ai/rag-console/__tests__/page.test.tsx` — verify polling 10s + refetchIntervalInBackground: false (Q21)

### Implementation for User Story 1

- [ ] T022 [US1] Implement `listAttachments()` method in `backend/src/modules/ai/services/rag-admin.service.ts` (left join attachments + rag_attachment_generations, ROW_NUMBER() window function for latest generation, grouped COUNT(*) for chunkCount, join audit log for classificationOverride, filter by project/status, paginate with enum pageSize [10,20,50], return RagAdminAttachmentsResponseDto; compute ragStatus on-the-fly — NO stored field Q9)
- [ ] T023 [US1] Implement `GET /ai/admin/rag/attachments` endpoint in `backend/src/modules/ai/rag-admin.controller.ts` (uses RagAdminListAttachmentsDto, @RequirePermission('rag.manage'), no AiEnabledGuard — read-only Q4)
- [ ] T024 [US1] Create `frontend/app/(admin)/admin/ai/rag-console/page.tsx` — single page with 5 tabs (Dashboard | Classification | Lifecycle | Metrics | Retry — Q23, Q24). Dashboard tab: table with attachmentPublicId, originalFilename, ragStatus badge, aiProcessingStatus, chunkCount, effectiveClassification, classificationOverride, lastUpdated; project filter, status filter, pagination (default 20, enum [10,20,50]); auto-polling via TanStack Query refetchInterval: 10000 + refetchIntervalInBackground: false (Q21); manual refresh button; empty state with context (Q41); ServiceUnavailableBanner (Q40). Validates SC-001 (status within 3s) and SC-007 (500+ attachments <3s load)
- [ ] T025 [US1] Add error handling with i18n messages (ADR-007) — user-friendly errors for service unavailable, permission denied, invalid pageSize

**Checkpoint**: US1 fully functional — dashboard shows RAG ingestion status with auto-polling 10s

---

## Phase 4: User Story 2 - Classification Override UI (Priority: P1)

**Goal**: Security Admin can view all attachments with classification + override info, and override classification with reason + audit trail

**Independent Test**: Open Classification tab, verify all attachments listed with effectiveClassification + classificationOverride object; select attachment, override classification with reason; verify audit log shows before/after/reason/actor; verify permission denied for unauthorized users

### Tests for User Story 2

- [ ] T026 [P] [US2] Write backend test for `GET /ai/admin/rag/attachments/classification` in `backend/src/modules/ai/rag-admin.controller.spec.ts` — verify separate query joins audit log for override info, pagination (Q43)
- [ ] T027 [P] [US2] Write frontend test for classification tab in `frontend/app/(admin)/admin/ai/rag-console/__tests__/classification.test.tsx`

### Implementation for User Story 2

- [ ] T028 [US2] Implement `listAttachmentsForClassification()` method in `backend/src/modules/ai/services/rag-admin.service.ts` (separate query from dashboard — joins audit log for latest classificationOverride object {reason, overriddenBy, overriddenAt}, paginate, Q43)
- [ ] T029 [US2] Implement `GET /ai/admin/rag/attachments/classification` endpoint in `backend/src/modules/ai/rag-admin.controller.ts` (uses RagAdminClassificationListDto, @RequirePermission('rag.manage'), no AiEnabledGuard — read-only Q4)
- [ ] T030 [US2] Implement Classification tab in `frontend/app/(admin)/admin/ai/rag-console/page.tsx` — table with attachmentPublicId, originalFilename, effectiveClassification badge, classificationOverride object (null if never overridden); attachment selector, classification dropdown (PUBLIC/INTERNAL/CONFIDENTIAL), reason input (RHF + Zod), submit button; CASL permission check (hide override form if no `document.classification_override` — Q42 shows all, override form permission-gated). Validates SC-002 (override <30s) and SC-008 (zero unauthorized access)
- [ ] T031 [US2] Wire classification override to existing `PATCH /ai/rag/attachments/:id/classification` endpoint via `admin-rag.service.ts` (existing endpoint, no backend change — Q30)
- [ ] T032 [US2] Display effective classification badge using ClassificationBadge component + classificationOverride info (reason, overriddenBy, overriddenAt — Q11)
- [ ] T033 [US2] Add audit trail display — show recent classification changes with before/after/reason/actor from audit log. Validates SC-006 (100% overrides visible in audit log within 5s)

**Checkpoint**: US2 fully functional — classification override UI with audit trail

---

## Phase 5: User Story 3 - Generation Lifecycle Viewer (Priority: P2)

**Goal**: Admin views generation lifecycle history (BUILDING → ACTIVE → RETIRED → FAILED) and can trigger force re-ingest (409 Conflict if BUILDING exists)

**Independent Test**: Open Lifecycle tab, select attachment, verify all generations listed with status/timestamps/chunk counts (newest first, no generationUuid exposed); click force re-ingest; verify 409 Conflict if BUILDING already exists

### Tests for User Story 3

- [ ] T034 [P] [US3] Write backend test for `GET /ai/admin/rag/attachments/:id/generations` in `backend/src/modules/ai/rag-admin.controller.spec.ts` — verify generations ordered by createdAt DESC, chunkCount via grouped COUNT(*), generationUuid NOT exposed (Q25, Q26)
- [ ] T035 [P] [US3] Write backend test for `POST /ai/admin/rag/attachments/:id/reingest` in `backend/src/modules/ai/rag-admin.controller.spec.ts` — verify 409 Conflict when BUILDING exists, AiEnabledGuard method-level, Idempotency-Key required, @RequirePermission('rag.admin.write'), @Audit('rag.admin.reingest') (Q12, Q13, Q14, Q4, Q19)
- [ ] T036 [P] [US3] Write frontend test for lifecycle tab in `frontend/app/(admin)/admin/ai/rag-console/__tests__/lifecycle.test.tsx`

### Implementation for User Story 3

- [ ] T037 [US3] Implement `listGenerations(attachmentPublicId)` method in `backend/src/modules/ai/services/rag-admin.service.ts` (return generations ordered by createdAt DESC with status/timestamps/chunkCount only — MUST NOT expose internal `generationUuid` per FR-014; chunkCount via single grouped COUNT(*) GROUP BY generationUuid query Q26)
- [ ] T038 [US3] Implement `GET /ai/admin/rag/attachments/:attachmentPublicId/generations` endpoint in `backend/src/modules/ai/rag-admin.controller.ts` (@RequirePermission('rag.manage'), no AiEnabledGuard — read-only Q4)
- [ ] T039 [US3] Implement `POST /ai/admin/rag/attachments/:attachmentPublicId/reingest` endpoint in `backend/src/modules/ai/rag-admin.controller.ts` — (1) check attachment has checksum → if missing, throw 400 with user-friendly error "checksum required for re-ingest" (edge case spec.md:L108); (2) check BUILDING status BEFORE calling ingest() (Q13); if BUILDING → throw 409 Conflict with errorCode RAG_BUILDING_IN_PROGRESS + userMessage + recoveryAction (Q14); @RequirePermission('rag.admin.write'), method-level @UseGuards(AiEnabledGuard) (Q4), Idempotency-Key required, @Audit('rag.admin.reingest', 'rag_attachment') (Q19); delegate to existing RagAttachmentIngestionService.ingest(attachmentPublicId, true) (Q12)
- [ ] T040 [US3] Create `frontend/components/admin/ai/rag-console/GenerationTimeline.tsx` — timeline component showing generations with status badges, timestamps, chunk counts (newest first)
- [ ] T041 [US3] Implement Lifecycle tab in `frontend/app/(admin)/admin/ai/rag-console/page.tsx` — attachment selector, GenerationTimeline, force re-ingest button (calls POST /ai/admin/rag/attachments/:id/reingest), 409 Conflict error handling with user-friendly message. Validates SC-003 (complete lifecycle history in single page)
- [ ] T042 [US3] Add i18n error message for BUILDING guard ("กำลัง ingest อยู่ กรุณารอให้เสร็จก่อน" / "Ingestion already in progress") in `rag.admin.lifecycle.errors.building_in_progress`

**Checkpoint**: US3 fully functional — generation lifecycle viewer with force re-ingest (409 Conflict guard)

---

## Phase 6: User Story 4 - Observability Metrics Dashboard (Priority: P2)

**Goal**: Admin views RAG operational metrics (6 categories) and can reset globally (per-project NOT supported — documented limitation)

**Independent Test**: Open Metrics tab, verify 6 metric categories displayed with current values; click reset global; verify confirmation dialog; verify no per-project reset button (limitation documented)

### Tests for User Story 4

- [ ] T043 [P] [US4] Write backend test for `GET /ai/admin/rag/metrics` in `backend/src/modules/ai/rag-admin.controller.spec.ts` — verify delegates to existing RagObservabilityService.getSnapshot()
- [ ] T044 [P] [US4] Write backend test for `POST /ai/admin/rag/metrics/reset` in `backend/src/modules/ai/rag-admin.controller.spec.ts` — verify global-only reset (no projectPublicId in body), @RequirePermission('rag.admin.write'), @Audit('rag.admin.metrics_reset'), no AiEnabledGuard (pure in-memory Q4)
- [ ] T045 [P] [US4] Write frontend test for metrics tab in `frontend/app/(admin)/admin/ai/rag-console/__tests__/metrics.test.tsx`

### Implementation for User Story 4

- [ ] T046 [US4] Implement `GET /ai/admin/rag/metrics` endpoint in `backend/src/modules/ai/rag-admin.controller.ts` (delegates to existing `RagObservabilityService.getSnapshot()`, @RequirePermission('rag.manage'), no AiEnabledGuard — read-only Q4)
- [ ] T047 [US4] Implement `POST /ai/admin/rag/metrics/reset` endpoint in `backend/src/modules/ai/rag-admin.controller.ts` — global-only reset via existing `RagObservabilityService.reset()` (NO resetForProject — Q15, Q16); no request body; @RequirePermission('rag.admin.write'), @Audit('rag.admin.metrics_reset', 'rag_observability') (Q19), no AiEnabledGuard (pure in-memory operation Q4), no Idempotency-Key required (inherently idempotent)
- [ ] T048 [US4] Create `frontend/components/admin/ai/rag-console/MetricsCard.tsx` — reusable metric card component (title, value, histogram bars)
- [ ] T049 [US4] Implement Metrics tab in `frontend/app/(admin)/admin/ai/rag-console/page.tsx` — 6 MetricsCards (ingestionDuration, chunkCount, vectorLatency, staleResultRate, fallbackRate, cleanupRetryRate), reset global button with confirmation dialog, NO per-project reset button (document limitation in UI tooltip), empty state (zeros). Validates SC-004 (identify bottlenecks without manual queries)

**Checkpoint**: US4 fully functional — metrics dashboard with global-only reset

---

## Phase 7: User Story 5 - Failed Ingestion Retry Management (Priority: P2)

**Goal**: Operator sees failed ingestions (2 sections: RAG failures + AI pipeline failures) and triggers batch retries (partial-success, max 50)

**Independent Test**: Open Retry tab, verify 2 sections displayed (RAG failures paginated + AI pipeline failures read-only); select multiple RAG failures; click retry all; verify partial-success results; verify retry button disabled while processing

### Tests for User Story 5

- [ ] T050 [P] [US5] Write backend test for `GET /ai/admin/rag/failed-ingestions` in `backend/src/modules/ai/rag-admin.controller.spec.ts` — verify 2 sections (ragFailures paginated + aiPipelineFailures read-only, Q31, Q32)
- [ ] T051 [P] [US5] Write backend test for `POST /ai/admin/rag/failed-ingestions/retry` in `backend/src/modules/ai/rag-admin.controller.spec.ts` — verify partial-success format, @ArrayMaxSize(50), only FAILED generations retried, BUILDING/ACTIVE/NOT_STARTED returned in failed[] with reason, AiEnabledGuard method-level, Idempotency-Key required, @RequirePermission('rag.retry'), @Audit('rag.admin.batch_retry') (Q17, Q18, Q34, Q4, Q19)
- [ ] T052 [P] [US5] Write backend test for `RagAttachmentIngestionService.retryIngestion()` in `backend/src/modules/ai/services/rag-attachment-ingestion.service.spec.ts` — verify mark FAILED→RETIRED before creating BUILDING (Q35, Q36)
- [ ] T053 [P] [US5] Write frontend test for retry tab in `frontend/app/(admin)/admin/ai/rag-console/__tests__/retry.test.tsx`

### Implementation for User Story 5

- [ ] T054 [US5] Implement `listFailedIngestions()` method in `backend/src/modules/ai/services/rag-admin.service.ts` — 2 sections: (1) ragFailures from RagAttachmentGeneration.status='FAILED' joined with attachments, paginated; (2) aiPipelineFailures from Attachment.aiProcessingStatus='FAILED', all items (not paginated Q32). Return RagAdminFailedIngestionsResponseDto (Q31)
- [ ] T055 [US5] Implement `GET /ai/admin/rag/failed-ingestions` endpoint in `backend/src/modules/ai/rag-admin.controller.ts` (@RequirePermission('rag.manage'), no AiEnabledGuard — read-only Q4)
- [ ] T056 [US5] Implement `retryIngestion(attachmentPublicId)` method in `backend/src/modules/ai/services/rag-attachment-ingestion.service.ts` — (1) find latest FAILED generation, (2) mark FAILED→RETIRED (retiredAt=now()), (3) call existing ingest(attachmentPublicId, true) → creates new BUILDING, (4) enqueue BullMQ job. Q35, Q36
- [ ] T057 [US5] Implement `batchRetry(attachmentPublicIds[])` method in `backend/src/modules/ai/services/rag-admin.service.ts` — for each: check latest generation status; if FAILED → call retryIngestion() + return in succeeded[]; if BUILDING/ACTIVE/NOT_STARTED → return in failed[] with reason. Max 50 (@ArrayMaxSize(50) Q34). 1 BullMQ job per attachment (not batch job Q37). BullMQ jobId dedup prevents duplicates (Q18)
- [ ] T058 [US5] Implement `POST /ai/admin/rag/failed-ingestions/retry` endpoint in `backend/src/modules/ai/rag-admin.controller.ts` (uses RagAdminBatchRetryDto with @ArrayMaxSize(50), @RequirePermission('rag.retry'), method-level @UseGuards(AiEnabledGuard) Q4, Idempotency-Key required Q18, @Audit('rag.admin.batch_retry', 'rag_attachment') Q19); return partial-success response {succeeded[], failed[], totalRequested, totalSucceeded, totalFailed}
- [ ] T059 [US5] Create `frontend/components/admin/ai/rag-console/RetryButton.tsx` — reusable retry button with disabled state while processing
- [ ] T060 [US5] Implement Retry tab in `frontend/app/(admin)/admin/ai/rag-console/page.tsx` — 2 sections: (1) RAG failures table with checkboxes, error messages, batch retry button, pagination; (2) AI pipeline failures table (read-only, no retry button); partial-success results display; per-item retry buttons; BUILDING status display; permanent error user-friendly messages. Validates SC-005 (retry in <10s)

**Checkpoint**: US5 fully functional — failed ingestion retry management with 2 sections + partial-success batch retry

---

## Phase 8: Orphan Cleanup (Q8)

**Purpose**: Add Cron job to clean up orphaned RAG records for deleted attachments

- [ ] T061 [P] Write backend test for `VectorCleanupService.orphanScanRagAttachments()` in `backend/src/modules/ai/services/vector-cleanup.service.spec.ts` — verify scan finds generations whose attachmentUuid no longer exists in attachments table, deletes chunks + pages + Qdrant vectors + generation records
- [ ] T062 Implement `orphanScanRagAttachments()` method in `backend/src/modules/ai/services/vector-cleanup.service.ts` — Cron job (e.g., @Cron('0 */6 * * *') every 6h matching existing cleanupRetiredGenerations); scan rag_attachment_generations LEFT JOIN attachments WHERE attachments.id IS NULL; for each orphan: delete Qdrant vectors by attachmentUuid, delete rag_attachment_chunks, delete rag_attachment_pages, delete rag_attachment_generations (Q8)

**Checkpoint**: Orphan cleanup Cron operational — prevents stale RAG records for deleted attachments

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Integration, E2E, ledger finalization

- [ ] T063 [P] Add E2E test for US1 status dashboard flow in `backend/test/rag-admin-dashboard.e2e-spec.ts` — NestJS TestingModule + Supertest + mocked services + guard overrides (Q27, Q28)
- [ ] T064 [P] Add E2E test for US2 classification override flow in `backend/test/rag-admin-classification.e2e-spec.ts`
- [ ] T065 [P] Add E2E test for US3 force re-ingest + 409 Conflict in `backend/test/rag-admin-reingest.e2e-spec.ts`
- [ ] T066 [P] Add E2E test for US4 metrics reset in `backend/test/rag-admin-metrics.e2e-spec.ts`
- [ ] T067 [P] Add E2E test for US5 batch retry + partial-success in `backend/test/rag-admin-retry.e2e-spec.ts`
- [ ] T068 Verify all i18n keys used in components exist in both en + th locale files (rag.admin.* namespace Q22)
- [ ] T069 Verify ADR-019 compliance — no parseInt/Number/+ on UUIDs, no internal id exposed, no generationUuid exposed, publicId only
- [ ] T070 Verify ADR-007 compliance — all error states have user-friendly i18n messages with recoveryAction (including 409 Conflict Q14)
- [ ] T071 Verify ADR-053 compliance — all 8 architectural decisions implemented as documented
- [ ] T072 Run quickstart.md validation — verify all 5 tabs accessible, 8 backend endpoints respond
- [ ] T073 Update assurance ledger checkpoint after all US complete in `specs/200-fullstacks/255-rag-admin-console/ledger.md`
- [ ] T074 Finalize ledger terminal status before handoff/PR in `specs/200-fullstacks/255-rag-admin-console/ledger.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user stories
- **User Stories (Phase 3-7)**: All depend on Foundational phase completion
  - US1 (P1) and US2 (P1) can proceed in parallel
  - US3 (P2), US4 (P2), US5 (P2) can proceed in parallel after P1 stories
- **Orphan Cleanup (Phase 8)**: Can run in parallel with user stories (separate service method)
- **Polish (Phase 9)**: Depends on all user stories being complete

### User Story Dependencies

- **US1 (P1)**: No dependencies on other stories — MVP candidate
- **US2 (P1)**: No dependencies on other stories — uses existing classification endpoint + new classification list endpoint
- **US3 (P2)**: No hard dependency, but benefits from US1 (attachment listing)
- **US4 (P2)**: No dependencies on other stories — uses existing metrics service
- **US5 (P2)**: Depends on US3's retryIngestion() method (T056) — batch retry calls retryIngestion()

### Within Each User Story

- Tests MUST be written and FAIL before implementation (TDD)
- Backend service methods before controller endpoints
- Controller endpoints before frontend pages
- Shared components before page integration

### Parallel Opportunities

- T005, T006, T007, T008 can run in parallel (different files)
- T013, T014, T015, T016, T017 can run in parallel (different files)
- All test tasks marked [P] can run in parallel within a story
- US1 + US2 can be worked on in parallel (both P1, minimal overlap)
- US3 + US4 can be worked on in parallel (all P2, different files)
- Phase 8 (orphan cleanup) can run in parallel with Phase 3-7

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (permission seeds, i18n, DTOs, API client, ADR-053)
2. Complete Phase 2: Foundational (controller, service, hooks, shared components)
3. Complete Phase 3: User Story 1 (status dashboard)
4. **STOP and VALIDATE**: Test US1 independently — dashboard shows RAG status
5. Deploy/demo if ready

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. Add US1 → Test independently → Deploy (MVP!)
3. Add US2 → Test independently → Deploy
4. Add US3 + US4 in parallel → Test each → Deploy
5. Add US5 (depends on US3 retryIngestion) → Test → Deploy
6. Add orphan cleanup (Phase 8) → Test → Deploy
7. Polish phase → E2E + compliance checks → Final deploy

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Verify tests fail before implementing (TDD)
- Commit after each task or logical group (D264 — commit local immediately)
- Stop at any checkpoint to validate story independently
- Backend APIs ส่วนใหญ่มีอยู่แล้ว (Feature 254) — งานหลักคือ frontend + 8 admin endpoints
- `rag.admin.write` + `rag.retry` permissions ต้อง seed ก่อนใช้งาน (T001-T004)
- retryIngestion() method (T056) ต้องเสร็จก่อน US5 batch retry (T057) ใช้งาน
- Route prefix: `ai/admin/rag/...` (NOT `ai/rag/admin/...` — Q1)
- Status enum: NOT_STARTED/BUILDING/ACTIVE/RETIRED/FAILED (actual generation statuses — Q5)
- Metrics reset: global-only, no per-project (Q15, Q16)
- 409 Conflict for BUILDING rejection (NOT 400 BusinessException — Q14)
- generationUuid NEVER exposed in API responses (FR-014)
- E2E tests use NestJS TestingModule + Supertest + mocked services (no real Qdrant/Redis/OCR — Q27)
