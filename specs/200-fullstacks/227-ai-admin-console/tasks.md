// File: specs/200-fullstacks/227-ai-admin-console/tasks.md
// Change Log:
// - 2026-05-20: Initial task list for AI Admin Console
// - 2026-05-21: Restructure following speckit tasks-template.md format

# Tasks: AI Admin Console

**Input**: Design documents from `/specs/200-fullstacks/227-ai-admin-console/`
**Prerequisites**: plan.md (required), spec.md (required for user stories)
**Tests**: Include unit tests for Guard, Service, and Controller layers

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure setup

- [X] T001 Create feature branch `227-ai-admin-console` from main
- [X] T002 [P] Setup AI Admin Console folder structure in `frontend/app/(admin)/admin/ai/`
- [X] T003 [P] Verify shared `QUEUE_AI_BATCH` usage for admin sandbox per ADR-027 (no `QUEUE_AI_ADMIN_SANDBOX`)

---

## Phase 2: Foundational (Blocking Prerequisites) ⚠️

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T004 Create `system_settings` table SQL in `specs/03-Data-and-Storage/lcbp3-v1.9.0-schema-02-tables.sql` (per ADR-009)
- [X] T005 [P] Create `SystemSetting` entity in `backend/src/modules/ai/entities/system-setting.entity.ts`
- [X] T006 [P] Register `SystemSetting` entity in `backend/src/modules/ai/ai.module.ts` TypeORM forFeature
- [X] T007 [P] Create `AiEnabledGuard` in `backend/src/modules/ai/guards/ai-enabled.guard.ts`
- [X] T008 Implement `getAiFeaturesEnabled()` and `setAiFeaturesEnabled()` methods in `backend/src/modules/ai/ai-settings.service.ts` with Redis caching
- [X] T009 Keep existing `ai-batch` BullMQ registration for admin sandbox per ADR-027
- [X] T010 Defer sandbox job handling to `AiBatchProcessor` per ADR-027 (no separate `AiSandboxProcessor`)

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Superadmin Toggles AI System On/Off (Priority: P1) 🎯 MVP

**Goal**: Enable Superadmin to dynamically control AI system availability with database persistence and Redis caching

**Independent Test**: Superadmin can toggle AI switch and verify state persists across page refreshes and API calls

### Tests for User Story 1

- [X] T011 [P] [US1] Unit test for `AiSettingsService.getAiFeaturesEnabled()` cache behavior in `backend/src/modules/ai/ai-settings.service.spec.ts`
- [X] T012 [P] [US1] Unit test for `AiEnabledGuard` blocking/allowing logic in `backend/src/modules/ai/guards/ai-enabled.guard.spec.ts`

### Implementation for User Story 1

- [X] T013 [US1] Implement `POST /ai/admin/toggle` endpoint in `backend/src/modules/ai/ai.controller.ts` with `@RequirePermission('system.manage_all')`
- [X] T014 [US1] Implement `GET /ai/admin/settings` endpoint to return current AI enabled state
- [X] T015 [US1] Add cache invalidation logic in `AiSettingsService.setAiFeaturesEnabled()` after DB update (TypeORM transaction)
- [X] T016 [US1] Apply `AiEnabledGuard` to existing AI endpoints in `AiController` (suggest, rag_query)
- [X] T017 [US1] Create `admin-ai.service.ts` in `frontend/lib/services/admin-ai.service.ts` with toggle API methods
- [X] T018 [US1] Build AI toggle switch component in `frontend/app/(admin)/admin/ai/page.tsx` (Header Switch section)
- [X] T019 [US1] Create `useAiStatus()` hook in `frontend/hooks/use-ai-status.ts` for polling AI state

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently

---

## Phase 4: User Story 2 - Normal Users Experience Soft Fallback (Priority: P1)

**Goal**: Implement soft fallback UX with disabled buttons, tooltips, and global banner when AI is turned off

**Independent Test**: Disable AI as admin, then verify regular user sees disabled buttons with tooltips and global banner

### Tests for User Story 2

- [x] T020 [P] [US2] Unit test for soft fallback component rendering in `frontend/components/ai/__tests__/ai-suggestion-button.test.tsx`

### Implementation for User Story 2

- [x] T021 [US2] Create `AiSuggestionButton` component in `frontend/components/ai/ai-suggestion-button.tsx` with disabled state and tooltip
- [x] T022 [US2] Create `AiStatusBanner` component in `frontend/components/ai/AiStatusBanner.tsx` for global banner display
- [x] T023 [US2] Integrate AI status polling (30s interval) in `frontend/providers/session-provider.tsx` or layout
- [x] T024 [US2] Update document forms (RFA/Correspondence) to use `AiSuggestionButton` with AI status check
- [x] T025 [US2] Implement HTTP 503 error handling in `frontend/lib/api/client.ts` for AI endpoint failures

**Checkpoint**: User Stories 1 AND 2 should both work independently (toggle affects user experience)

---

## Phase 5: User Story 3 - Superadmin Monitors AI Health Status (Priority: P2)

**Goal**: Provide real-time health monitoring dashboard for Ollama, Qdrant, and BullMQ

**Independent Test**: Access AI Admin Console and verify all health metrics display correctly

### Tests for User Story 3

- [X] T026 [P] [US3] Unit test for `AiService.getSystemHealth()` in `backend/src/modules/ai/ai.service.spec.ts`

### Implementation for User Story 3

- [X] T027 [US3] Implement `getSystemHealth()` method in `backend/src/modules/ai/ai.service.ts` with 5s timeout per service
- [X] T028 [US3] Implement `GET /ai/admin/health` endpoint in `backend/src/modules/ai/ai.controller.ts`
- [X] T029 [US3] Add health check caching (30s) using Redis or in-memory cache with TTL
- [X] T030 [US3] Create Health Indicator cards component in `frontend/app/(admin)/admin/ai/page.tsx`
- [X] T031 [US3] Implement health status polling (30s) in admin console page

**Checkpoint**: All health monitoring features functional and independently testable

---

## Phase 6: User Story 4 - Superadmin Uses RAG Playground Sandbox (Priority: P2)

**Goal**: Enable isolated RAG testing environment with sandbox queue and job polling

**Independent Test**: Submit RAG query in sandbox and receive response with citations

### Tests for User Story 4

- [X] T032 [P] [US4] Unit test for RAG sandbox job processing in `backend/src/modules/ai/processors/ai-sandbox.processor.spec.ts` (Unified in ai-batch.processor.spec.ts)

### Implementation for User Story 4

- [X] T033 [US4] Implement `sandbox-rag` job handler in `backend/src/modules/ai/processors/ai-sandbox.processor.ts` (Unified in ai-batch.processor.ts)
- [X] T034 [US4] Add `enqueueSandboxJob()` method in `backend/src/modules/ai/ai-queue.service.ts` with SUPERADMIN priority
- [X] T035 [US4] Implement `POST /ai/admin/sandbox/rag` endpoint in `backend/src/modules/ai/ai.controller.ts`
- [X] T036 [US4] Implement `GET /ai/admin/sandbox/job/:id` endpoint for job status polling
- [X] T037 [US4] Create RAG Playground tab UI in `frontend/app/(admin)/admin/ai/page.tsx`
- [X] T038 [US4] Implement job status polling (5s) with progress display in RAG Playground

**Checkpoint**: RAG sandbox fully functional with isolated queue processing

---

## Phase 7: User Story 5 - Superadmin Uses OCR Sandbox (Priority: P2)

**Goal**: Provide isolated OCR sandbox for PDF metadata extraction with JSON output

**Independent Test**: Upload PDF to OCR sandbox and receive valid JSON extraction results

### Tests for User Story 5

- [X] T039 [P] [US5] Unit test for OCR sandbox job processing in `backend/src/modules/ai/processors/ai-sandbox.processor.spec.ts`

### Implementation for User Story 5

- [X] T040 [US5] Implement `sandbox-extract` job handler in `backend/src/modules/ai/processors/ai-sandbox.processor.ts`
- [X] T041 [US5] Implement `POST /ai/admin/sandbox/extract` endpoint in `backend/src/modules/ai/ai.controller.ts`
- [X] T042 [US5] Implement dynamic rate limiting logic (queue < 3: no limit, >= 3: 10 req/hr) in controller
- [X] T043 [US5] Create OCR Sandbox tab with drag-drop file upload in `frontend/app/(admin)/admin/ai/page.tsx`
- [X] T044 [US5] Implement JSON output display with syntax highlighting in OCR Sandbox tab
- [X] T045 [US5] Add inline error display (red box) for failed OCR extractions

**Checkpoint**: OCR sandbox fully functional with rate limiting and error handling

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [X] T046 [P] Add "AI Console" menu item in `frontend/components/admin/sidebar.tsx` (Superadmin only)
- [X] T047 [P] Update agent context via `update-agent-context.sh` with new AI Admin Console patterns
- [X] T048 Security hardening: Verify all admin endpoints require `system.manage_all` permission
- [X] T049 Run `quickstart.md` validation and walkthrough tests
- [X] T050 Create `walkthrough.md` documenting end-to-end testing procedures

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-7)**: All depend on Foundational phase completion
  - User stories can proceed in parallel (if staffed)
  - Or sequentially in priority order (P1 → P2)
- **Polish (Phase 8)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies
- **User Story 2 (P1)**: Can start after Foundational (Phase 2) - Integrates with US1 toggle state
- **User Story 3 (P2)**: Can start after Foundational (Phase 2) - Independent monitoring feature
- **User Story 4 (P2)**: Can start after Foundational (Phase 2) - Uses same sandbox queue infrastructure
- **User Story 5 (P2)**: Can start after Foundational (Phase 2) - Shares OCR extraction with US4 patterns

### Within Each User Story

- Tests (if included) MUST be written and FAIL before implementation
- Services before controllers
- Controllers before frontend integration
- Core implementation before polish

### Parallel Opportunities

- All Setup tasks marked [P] can run in parallel
- All Foundational tasks marked [P] can run in parallel (within Phase 2)
- Once Foundational is done, US3/4/5 can start in parallel (independent P2 stories)
- US1 and US2 should be developed sequentially (toggle affects fallback)
- Different story tests can run in parallel

---

## Implementation Strategy

### MVP First (User Stories 1 & 2)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1 (toggle mechanism)
4. Complete Phase 4: User Story 2 (soft fallback)
5. **STOP and VALIDATE**: Test toggle → fallback flow end-to-end
6. Deploy/demo MVP

### Incremental Delivery

1. MVP (US1 + US2) → Deploy
2. Add US3 (Health Monitoring) → Deploy
3. Add US4 (RAG Sandbox) → Deploy
4. Add US5 (OCR Sandbox) → Deploy

### Parallel Team Strategy

With multiple developers post-Foundational:

- Developer A: US1 + US2 (core control + fallback)
- Developer B: US3 (health monitoring)
- Developer C: US4 + US5 (sandbox features)
