# Tasks: RAG Attachment Chunks

**Input**: Design documents from `/specs/200-fullstacks/254-rag-attachment-chunks/`
**Prerequisites**: `spec.md`, `plan.md`, `research.md`, `data-model.md`, `contracts/`, `quickstart.md`

**Tests**: Required. Behavior-changing tasks require RED/GREEN/REFACTOR evidence in `ledger.md`.

**Organization**: Tasks are grouped by user story with setup/foundation gates.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel when files and dependencies are independent.
- **[Story]**: User story mapping for story-phase tasks.
- Every task includes an exact repository path.

## Path Conventions

- Backend: `backend/src/`, `backend/test/`
- Frontend: `frontend/`
- Schema/docs: `specs/03-Data-and-Storage/`, `specs/200-fullstacks/254-rag-attachment-chunks/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish contracts, schema delta boundaries, permissions, and queue names.

- [x] T001 Create the ADR-044 forward and rollback SQL deltas for `rag_attachment_generations`, `rag_attachment_pages`, and `rag_attachment_chunks` in `specs/03-Data-and-Storage/deltas/2026-09-09-rag-attachment-chunks.sql` and its rollback companion.
- [x] T002 [P] Update canonical schema definitions in `specs/03-Data-and-Storage/lcbp3-v1.9.0-schema-02-tables.sql` to replace the empty `document_chunks` model with the approved RAG Attachment model.
- [x] T003 [P] Update the RAG and Attachment entries in `specs/03-Data-and-Storage/03-01-data-dictionary.md`.
- [x] T004 [P] Add `document.classification_override` permission and Security/System Admin mapping in `specs/03-Data-and-Storage/lcbp3-v1.9.0-seed-permissions.sql`.
- [x] T005 [P] Add RAG queue/job constants in `backend/src/modules/common/constants/queue.constants.ts` for ingestion, metadata sync, and generation cleanup.
- [x] T006 [P] Add RAG ingestion and retrieval contract tests skeletons in `backend/src/modules/ai/contracts/rag-attachment.contract.spec.ts`.
- [x] T007 Update `specs/200-fullstacks/254-rag-attachment-chunks/ledger.md` with the setup checkpoint and TDD evidence references.

**Checkpoint**: Schema/contract design is reviewable; no SQL is applied to a live database yet.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Build data entities, security boundaries, queue plumbing, and shared value objects before story work.

**CRITICAL**: No user story work begins until this phase passes typecheck and focused tests.

- [x] T008 Create `RagAttachmentGeneration` entity in `backend/src/modules/ai/entities/rag-attachment-generation.entity.ts` with status transitions and checksum fields.
- [x] T009 [P] Create `RagAttachmentPage` entity in `backend/src/modules/ai/entities/rag-attachment-page.entity.ts` with generic TextSegment fields and generation FK.
- [x] T010 [P] Create `RagAttachmentChunk` entity in `backend/src/modules/ai/entities/rag-attachment-chunk.entity.ts` with UUIDv7 chunk identity, offsets, owner metadata, and Attachment FK.
- [x] T011 [P] Add entity registration and repository exports in `backend/src/modules/ai/ai.module.ts`.
- [x] T012 Create strict TextSegment and citation types in `backend/src/modules/ai/interfaces/rag-text-segment.interface.ts` and `backend/src/modules/ai/interfaces/rag-citation.interface.ts`.
- [x] T013 [P] Create DTO validation for ingestion/status/query in `backend/src/modules/ai/dto/rag-attachment.dto.ts` with UUIDv7, checksum, and Project scope; enforce Idempotency-Key in `backend/src/modules/ai/controllers/rag-attachment.controller.ts`.
- [x] T014 [P] Add `document.classification_override` CASL ability and guard tests in `backend/src/common/guards/rbac.guard.spec.ts` or the existing permission test location.
- [x] T015 Implement Redlock key policy and generation transition helper in `backend/src/modules/ai/services/rag-generation-lock.service.ts`.
- [x] T016 Implement BullMQ payload types and producer methods in `backend/src/modules/ai/ai-queue.service.ts`.
- [x] T017 Implement shared layered exceptions for checksum, generation state, stale result, and Project-scope failures in `backend/src/modules/ai/services/rag-error.service.ts`.
- [x] T018 Add focused unit tests for entity validation, status transitions, checksum mismatch, and one-ACTIVE invariant in `backend/src/modules/ai/services/rag-generation.service.spec.ts`.
- [x] T019 Run backend typecheck and focused tests; record RED/GREEN/REFACTOR evidence and update `specs/200-fullstacks/254-rag-attachment-chunks/ledger.md`.

**Checkpoint**: Foundational model, security, queue, and error boundaries are ready.

---

## Phase 3: User Story 1 — Build searchable chunks from a committed Attachment (Priority: P1) 🎯 MVP

**Goal**: Produce one checksum-bound ACTIVE generation with normalized segments, pages, chunks, and BGE-M3 vectors.

**Independent Test**: Ingest a committed Attachment with a checksum and verify generation, page, chunk, and vector creation.

### Tests for User Story 1

- [x] T020 [P] [US1] Add failing unit tests for checksum readiness and mismatch handling in `backend/src/modules/ai/services/rag-attachment-ingestion.service.spec.ts`.
- [x] T021 [P] [US1] Add failing unit tests for TextSegment normalization and 512/64 chunking in `backend/src/modules/ai/services/rag-text-segment.service.spec.ts`.
- [x] T022 [P] [US1] Add failing integration tests for page/chunk persistence and FK behavior in `backend/test/rag-attachment-schema.e2e-spec.ts`.
- [x] T023 [P] [US1] Add failing integration tests for ingestion job enqueue and retry behavior in `backend/src/modules/ai/services/ai-queue.service.spec.ts`.

### Implementation for User Story 1

- [x] T024 [US1] Implement committed Attachment/checksum/owner resolver in `backend/src/modules/ai/services/rag-attachment-source.service.ts`.
- [x] T025 [US1] Implement generic TextSegment normalization and segment persistence in `backend/src/modules/ai/services/rag-text-segment.service.ts`.
- [x] T026 [US1] Implement chunking with 512-token size, 64-token overlap, normalized offsets, and source locator in `backend/src/modules/ai/services/rag-chunking.service.ts`.
- [x] T027 [US1] Implement generation creation, checksum verification, and BUILDING/FAILED transitions in `backend/src/modules/ai/services/rag-attachment-ingestion.service.ts`.
- [x] T028 [US1] Implement BGE-M3 dense+sparse embedding and Qdrant payload construction in `backend/src/modules/ai/services/rag-embedding.service.ts`.
- [x] T029 [US1] Implement ingestion worker in `backend/src/modules/ai/processors/rag-attachment-ingestion.processor.ts`.
- [x] T030 [US1] Add ingestion/status endpoints in `backend/src/modules/ai/controllers/rag-attachment.controller.ts` with JWT/CASL/Idempotency-Key enforcement.
- [x] T031 [US1] Wire post-commit Attachment ingestion trigger in `backend/src/modules/ai/ai-queue.service.ts`, `backend/src/common/file-storage/file-storage.service.ts`, and the owning document commit services.
- [x] T032 [US1] Add E2E coverage for committed Attachment → ACTIVE generation in `backend/test/rag-attachment-ingestion.e2e-spec.ts`.
- [x] T033 [US1] Update `specs/200-fullstacks/254-rag-attachment-chunks/quickstart.md` with executed ingestion verification and update the ledger checkpoint.

**Checkpoint**: MVP produces one secure, searchable ACTIVE generation from a committed Attachment.

---

## Phase 4: User Story 2 — Retrieve secure, citable RAG context (Priority: P1)

**Goal**: Retrieve only owning-Project ACTIVE chunks and return user-safe citations.

**Independent Test**: Query two Projects, retire one generation, and verify tenant and ACTIVE-generation guards.

### Tests for User Story 2

- [x] T034 [P] [US2] Add failing Qdrant filter tests for owning `project_public_id` in `backend/src/modules/ai/ai-qdrant.service.spec.ts`.
- [x] T035 [P] [US2] Add failing retrieval guard tests for ACTIVE-only batch validation in `backend/src/modules/ai/services/rag-retrieval-guard.service.spec.ts`.
- [x] T036 [P] [US2] Add failing citation contract tests in `backend/src/modules/ai/contracts/rag-retrieval.contract.spec.ts`.
- [x] T037 [P] [US2] Add failing cross-Project Distribution denial tests in `backend/test/rag-cross-project.e2e-spec.ts`.

### Implementation for User Story 2

- [x] T038 [US2] Extend `backend/src/modules/ai/qdrant.service.ts` with generation-aware payload and mandatory owning-Project filter behavior.
- [x] T039 [US2] Implement batched ACTIVE-generation validation in `backend/src/modules/ai/services/rag-retrieval-guard.service.ts`.
- [x] T040 [US2] Implement stale-result skip and full-text fallback in `backend/src/modules/ai/ai-rag.service.ts`.
- [x] T041 [US2] Implement user-safe citation mapping in `backend/src/modules/ai/services/rag-citation.service.ts`.
- [x] T042 [US2] Update RAG query response DTO and API contract in `backend/src/modules/ai/dto/rag-query-response.dto.ts` and `specs/200-fullstacks/254-rag-attachment-chunks/contracts/rag-retrieval.md`.
- [x] T043 [US2] Add frontend citation rendering in `frontend/components/ai/rag-citation-list.tsx` and API hook in `frontend/hooks/use-rag-query.ts` if the existing Document Chat UI consumes this contract.
- [x] T044 [US2] Add backend and frontend tests for citation display, omitted generation UUID, and fallback mode.
- [x] T045 [US2] Update ledger with retrieval isolation checkpoint and evidence.

**Checkpoint**: RAG retrieval is tenant-safe, ACTIVE-generation-safe, and citable.

---

## Phase 5: User Story 3 — Maintain generation integrity during replacement and cleanup (Priority: P1)

**Goal**: Replace generations without race conditions or stale retrieval and recover from Qdrant cleanup failures.

**Independent Test**: Run concurrent re-ingestion and force vector cleanup failure; verify one ACTIVE generation and retryable RETIRED cleanup.

### Tests for User Story 3

- [x] T046 [P] [US3] Add failing race tests for Redlock and one-ACTIVE transaction swap in `backend/src/modules/ai/services/rag-generation-swap.service.spec.ts`.
- [x] T047 [P] [US3] Add failing tests for RETIRED cleanup retry and pending vector deletion in `backend/src/modules/ai/processors/rag-generation-cleanup.processor.spec.ts`.
- [x] T048 [P] [US3] Add E2E replacement tests in `backend/test/rag-generation-replacement.e2e-spec.ts`.

### Implementation for User Story 3

- [x] T049 [US3] Implement build-then-swap transaction in `backend/src/modules/ai/services/rag-generation-swap.service.ts`.
- [x] T050 [US3] Implement RETIRED vector/chunk cleanup worker in `backend/src/modules/ai/processors/rag-generation-cleanup.processor.ts`.
- [x] T051 [US3] Extend `backend/src/modules/ai/services/vector-cleanup.service.ts` with generation-scoped cleanup and retry records.
- [x] T052 [US3] Add FAILED-generation 30-day retention job in `backend/src/modules/ai/processors/rag-generation-retention.processor.ts`.
- [x] T053 [US3] Add concurrency, rollback, and partial Qdrant failure metrics in `backend/src/modules/ai/services/rag-observability.service.ts`.
- [x] T054 [US3] Update quickstart recovery scenarios and ledger checkpoint.

**Checkpoint**: Generation replacement and cleanup are race-safe and recoverable.

---

## Phase 6: User Story 4 — Ingest page-aware and archive-based Attachments (Priority: P2)

**Goal**: Preserve source segments and securely ingest ZIP inner files.

**Independent Test**: Ingest page-based and ZIP fixtures, verify source locators, and reject unsafe archives.

### Tests for User Story 4

- [x] T055 [P] [US4] Add failing TextSegment contract tests for PAGE/SECTION/SHEET/WHOLE_DOCUMENT in `backend/src/modules/ai/services/rag-text-segment.service.spec.ts`.
- [x] T056 [P] [US4] Add failing ZIP security tests for traversal, encryption, malware, nested depth, file count, and expanded size in `backend/src/common/file-storage/secure-archive.service.spec.ts`.
- [x] T057 [P] [US4] Add E2E fixture tests for ZIP sourceLocator citations in `backend/test/rag-zip-ingestion.e2e-spec.ts`.

### Implementation for User Story 4

- [x] T058 [US4] Extend OCR/text extraction contract to return `TextSegment[]` in `backend/src/modules/ai/interfaces/text-segment.interface.ts` and the existing OCR adapter boundary.
- [x] T059 [US4] Add `rag_attachment_pages` persistence with generation-scoped normalized offsets in `backend/src/modules/ai/services/rag-page.service.ts`.
- [x] T060 [US4] Implement secure ZIP extraction and inner-file source locator in `backend/src/common/file-storage/secure-archive.service.ts`.
- [x] T061 [US4] Integrate ClamAV scanning and two-phase temporary extraction into `backend/src/modules/ai/services/rag-attachment-ingestion.service.ts`.
- [x] T062 [US4] Add segment/citation UI support for sourceLocator and non-page source types in `frontend/components/ai/rag-citation-list.tsx`.
- [x] T063 [US4] Update ledger with segment/ZIP security checkpoint.

**Checkpoint**: Page-aware and ZIP source citations are secure and testable.

---

## Phase 7: User Story 5 — Apply document security classification to RAG content (Priority: P1)

**Goal**: Enforce classification policy and audited Security/System Admin overrides.

**Independent Test**: Attempt unauthorized/authorized classification changes and verify retrieval metadata synchronization.

### Tests for User Story 5

- [x] T064 [P] [US5] Add failing CASL tests for `document.classification_override` in `backend/src/modules/ai/services/rag-classification.service.spec.ts`.
- [x] T065 [P] [US5] Add failing audit tests for before/after/reason/actor in `backend/src/modules/ai/services/rag-classification.service.spec.ts`.
- [x] T066 [P] [US5] Add E2E classification retrieval tests in `backend/test/rag-classification.e2e-spec.ts`.

### Implementation for User Story 5

- [x] T067 [US5] Add canonical Attachment effective classification fields and SQL delta in `specs/03-Data-and-Storage/deltas/2026-09-09-rag-attachment-classification.sql`.
- [x] T068 [US5] Implement classification inheritance/override service in `backend/src/modules/ai/services/rag-classification.service.ts`.
- [x] T069 [US5] Add Security/System Admin guarded classification endpoint in `backend/src/modules/ai/controllers/rag-attachment.controller.ts`.
- [x] T070 [US5] Add audit event and asynchronous Qdrant metadata sync in `backend/src/modules/ai/services/rag-classification.service.ts` and `backend/src/modules/ai/processors/rag-metadata-sync.processor.ts`.
- [x] T071 [US5] Add classification-aware retrieval checks in `backend/src/modules/ai/services/rag-retrieval-guard.service.ts`.
- [x] T072 [US5] Update ledger with classification checkpoint.

**Checkpoint**: Classification policy and override controls are audited and enforced.

---

## Phase 8: Polish & Cross-Cutting Concerns

- [x] T073 [P] Run ADR-019/016/007/008/023A/044 compliance scans and fix violations.
- [x] T074 [P] Add performance metrics for ingestion duration, chunk count, vector latency, stale-result rate, fallback rate, and cleanup retry rate.
- [x] T075 [P] Add i18n user/recovery messages for ingestion status, checksum failure, stale fallback, and classification denial.
- [x] T076 Run backend build, lint:ci, typecheck, focused tests, full tests, and coverage checks.
- [x] T077 Run frontend typecheck, lint, tests, and citation component coverage checks.
- [x] T078 Run integration/E2E tests with MariaDB, Redis/BullMQ, and Qdrant available.
- [x] T079 Review SQL delta and obtain explicit authorization before applying database changes.
- [x] T080 Update `specs/200-fullstacks/254-rag-attachment-chunks/ledger.md` with final verification evidence.
- [x] T081 Finalize validation report and terminal ledger status before handoff.

---

## Dependencies & Execution Order

### Phase Dependencies

- Setup (Phase 1) precedes Foundational (Phase 2).
- Foundational blocks all user stories.
- US1 is the MVP and precedes US2/US3 because retrieval and replacement require active generation data.
- US4 depends on the segment/chunk foundation from US1 but can proceed in parallel with US2 after the foundation checkpoint.
- US5 depends on the generation/chunk metadata model from US1 and retrieval guard from US2.
- Polish begins after all required user stories are complete.

### Parallel Opportunities

- T002–T006 can run in parallel after the spec/plan review.
- T008–T014 can run in parallel where files do not overlap.
- T020–T023 can run in parallel before US1 implementation.
- T034–T037 can run in parallel before US2 implementation.
- T046–T048 can run in parallel before US3 implementation.
- T055–T057 can run in parallel before US4 implementation.
- T064–T066 can run in parallel before US5 implementation.

### MVP Scope

MVP is US1 only:

1. Schema/entities and checksum readiness
2. TextSegment normalization and chunking
3. BGE-M3 ingestion
4. One ACTIVE generation
5. Basic ingestion status and focused tests

## Implementation Strategy

1. Complete Setup and Foundational phases.
2. Implement US1 and stop for an independent ingestion gate.
3. Implement US2 retrieval guard/citations.
4. Implement US3 replacement/cleanup.
5. Implement US4 segment/ZIP support.
6. Implement US5 classification authority.
7. Run final compliance, integration, E2E, and ledger gates.

## Notes

- Do not execute SQL deltas against production or shared databases without explicit authorization.
- Do not create a TypeORM migration.
- All behavior-changing tasks require permanent tests and ledger TDD evidence.
- All public identifiers use UUIDv7/publicId; internal INT IDs remain internal.
