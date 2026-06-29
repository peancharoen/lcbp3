# Tasks: Unified AI Architecture

**Input**: Design documents from `/specs/300-others/301-unified-ai-arch/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/openapi.yaml
**Tests**: Tests are OPTIONAL for this implementation phase unless specifically requested during PR review.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [X] T001 Initialize `AiModule` inside `backend/src/ai/ai.module.ts`
- [X] T002 [P] Install `qdrant-js` client dependency in the backend workspace
- [X] T003 Add `AI_HOST_URL`, `AI_QDRANT_URL`, `AI_N8N_SERVICE_TOKEN` to backend `.env` configuration

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented
**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T004 Setup `QdrantService` in `backend/src/ai/qdrant.service.ts` to manage vector DB connections
- [X] T005 [P] Setup BullMQ infrastructure in `AiModule` (configure `AiQueueService`)
- [X] T006 [P] Implement `ServiceAccountGuard` to validate n8n service tokens for internal API routes
- [X] T007 Implement SQL Schema Deltas for `migration_review_queue` and `ai_audit_logs` in MariaDB
- [X] T008 Implement TypeORM base entities mapping to the created SQL tables

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - Legacy Document Migration and Review (Priority: P1) 🎯 MVP

**Goal**: Process legacy PDFs through an AI pipeline and review extracted metadata in a staging queue before DB commit.
**Independent Test**: Upload PDF batch via n8n/endpoint, verify they appear in the UI queue, and approve them successfully.

### Implementation for User Story 1

- [X] T009 [P] [US1] Create `MigrationReviewRecord` TypeORM Entity in `backend/src/ai/entities/migration-review.entity.ts`
- [X] T010 [US1] Implement `AiIngestService` to handle batch ingestion and queue creation
- [X] T011 [US1] Implement `POST /api/ai/legacy-migration/ingest` in `AiController` using `ServiceAccountGuard`
- [X] T011b [P] [US1] Export n8n workflow definition to `backend/src/ai/workflows/folder-watcher.json` to monitor the network directory and POST to the ingest API (FR-001b)
- [X] T012 [US1] Implement `GET /api/ai/legacy-migration/queue` in `AiController`
- [X] T013 [US1] Implement `POST /api/ai/legacy-migration/queue/{publicId}/approve` with Zod/class-validator payload checking (FR-007)
- [X] T014 [P] [US1] Create Frontend API hooks for staging queue in `frontend/src/lib/api/ai.ts`
- [X] T015 [US1] Build Frontend Staging Queue Table UI in `frontend/src/app/(dashboard)/ai-staging/page.tsx`
- [X] T016 [US1] Implement UI Form dropdown constraints for master data fields in the approval modal (FR-012)
- [X] T017 [US1] Build `AiStatusBanner.tsx` component in `frontend/src/components/ai/AiStatusBanner.tsx` to handle offline graceful degradation

**Checkpoint**: At this point, User Story 1 should be fully functional.

---

## Phase 4: User Story 2 - RAG Conversational Q&A (Priority: P2)

**Goal**: Ask natural language questions about project documents with context-aware RAG answers.
**Independent Test**: Submit a RAG query for a specific project; verify response < 10s and accurate isolation.

### Implementation for User Story 2

- [X] T018 [P] [US2] Create BullMQ Processor `rag.processor.ts` with strict concurrency limit = 1 (FR-009)
- [X] T019 [US2] Implement `AiRagService` containing Ollama LLM integration logic
- [X] T020 [US2] Enforce `projectPublicId` filtering natively in Qdrant search payload inside `AiRagService`
- [X] T021 [US2] Implement `POST /api/ai/rag/query` to push jobs to BullMQ and apply rate limiting (5 per min) (FR-010)
- [X] T022 [US2] Add AbortController logic to backend processor to cancel LLM generation on client disconnect (FR-011)
- [X] T023 [P] [US2] Build `RagChatWidget.tsx` component with streaming/polling UI for queue wait status

**Checkpoint**: RAG capability is fully implemented and throttled safely.

---

## Phase 5: User Story 3 - AI Audit Log Management (Priority: P3)

**Goal**: View and manage AI audit logs for model feedback, with safe deletion capabilities.
**Independent Test**: Generate AI suggestions, verify logs exist, and test hard delete as a System Admin.

### Implementation for User Story 3

- [X] T024 [P] [US3] Create `AiAuditLog` TypeORM Entity in `backend/src/ai/entities/ai-audit-log.entity.ts`
- [X] T025 [US3] Inject Audit Log creation logic into the `/approve` endpoint (capture Human vs AI differences)
- [X] T026 [US3] Implement `DELETE /api/ai/audit-logs` endpoint with `@UseGuards(CaslAbilityGuard)` checking for `SYSTEM_ADMIN`
- [X] T027 [US3] Create BullMQ Processor `vector-deletion.processor.ts` to handle asynchronous vector cleanup (FR-008)
- [X] T028 [US3] Integrate `vector-deletion-queue` dispatch into the main Document Deletion service

**Checkpoint**: AI Audit and safe vector cleanup are complete.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [X] T029 Code cleanup and CASL RBAC matrix review for all AI endpoints
- [X] T030 E2E Validation of the BullMQ concurrency limit (stress test 10 concurrent requests)
- [X] T031 Finalize `README.md` and `quickstart.md` documentation for Desk-5439 setup

---

## Dependencies & Execution Order

### Phase Dependencies
- **Setup (Phase 1)**: Start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 - BLOCKS US1, US2, US3
- **User Stories (Phases 3-5)**: Depend on Phase 2. Should be executed sequentially (US1 -> US2 -> US3) due to shared services, but frontend/backend tasks within each story can run in parallel.
- **Polish (Phase 6)**: Depends on all stories completing.

### Parallel Opportunities
- Database schema changes (T007) and Backend Auth Setup (T006)
- Frontend UI components (T015, T017, T023) can be stubbed concurrently with backend API creation.
- Entity creation (T009, T024) and BullMQ Processor setup (T018)
