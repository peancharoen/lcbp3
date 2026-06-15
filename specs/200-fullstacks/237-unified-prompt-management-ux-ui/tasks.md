# Tasks: Unified Prompt Management UX/UI

**Input**: Design documents from `/specs/200-fullstacks/237-unified-prompt-management-ux-ui/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Tests are included for backend services to ensure quality and coverage targets (Backend 70%+, Business Logic 80%+).

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Backend**: `backend/src/`, `backend/test/`
- **Frontend**: `frontend/src/`, `frontend/__tests__/`

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Database schema and seed data setup

- [x] T001 Create SQL delta for ai_execution_profiles table in specs/03-Data-and-Storage/deltas/2026-06-14-create-ai-execution-profiles.sql
- [x] T002 Create SQL delta for execution profiles seed data in specs/03-Data-and-Storage/deltas/2026-06-14-seed-execution-profiles.sql
- [x] T003 Create SQL delta for additional prompt types seed data in specs/03-Data-and-Storage/deltas/2026-06-14-seed-additional-prompt-types.sql
- [x] T004 [P] Run SQL deltas to create ai_execution_profiles table and seed data

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core backend entities and DTOs that all user stories depend on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T005 Create AiExecutionProfile entity in backend/src/modules/ai/entities/ai-execution-profile.entity.ts
- [x] T006 [P] Create ContextConfigDto in backend/src/modules/ai/dto/context-config.dto.ts
- [x] T007 [P] Create SandboxRagPrepDto in backend/src/modules/ai/dto/sandbox-rag-prep.dto.ts
- [x] T008 [P] Create CreateExecutionProfileDto in backend/src/modules/ai/dto/create-execution-profile.dto.ts
- [x] T009 [P] Create UpdateExecutionProfileDto in backend/src/modules/ai/dto/update-execution-profile.dto.ts
- [x] T010 [P] Create frontend types in frontend/lib/types/ai-prompts.ts (extend with ContextConfig, ExecutionProfile, SandboxJob types)
- [x] T011 Register AiExecutionProfile entity in AiModule in backend/src/modules/ai/ai.module.ts

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Multi-Type Prompt Management (Priority: P1) 🎯 MVP

**Goal**: Admin users can manage prompt templates for multiple AI workflow types through a single unified interface with separated version history.

**Independent Test**: Create and activate versions for different prompt types, verify version history is correctly separated by type, and confirm active version badge displays correctly.

### Tests for User Story 1

- [x] T012 [P] [US1] Unit test for placeholder validation in AiPromptsService in backend/test/unit/ai/ai-prompts.service.spec.ts
- [x] T013 [P] [US1] Integration test for version number increment per prompt type in backend/test/integration/ai/ai-prompts.service.spec.ts

### Implementation for User Story 1

- [x] T014 [US1] Extend AiPromptsService with placeholder validation logic in backend/src/modules/ai/services/ai-prompts.service.ts
- [x] T015 [US1] Extend AiPromptsService with version number increment per prompt_type in backend/src/modules/ai/services/ai-prompts.service.ts
- [x] T016 [US1] Create PromptTypeDropdown component in frontend/components/admin/ai/PromptTypeDropdown.tsx
- [x] T017 [US1] Extend VersionHistory component with prompt_type filtering in frontend/components/admin/ai/VersionHistory.tsx
- [x] T018 [US1] Create PromptEditor component with placeholder validation in frontend/components/admin/ai/PromptEditor.tsx
- [x] T019 [US1] Create unified prompt management page with 2-column layout in frontend/app/(admin)/admin/ai/prompt-management/page.tsx
  - Left Panel: VersionHistory component
  - Right Panel: PromptEditor + ContextConfigEditor (stacked vertically)
- [x] T020 [US1] Extend admin-ai.service.ts with prompt type filtering methods in frontend/lib/services/admin-ai.service.ts
- [x] T021 [US1] Add i18n keys for prompt management UI in frontend/public/locales/th/common.json and en/common.json

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently

---

## Phase 4: User Story 2 - Context Configuration Management (Priority: P1)

**Goal**: Admin users can view, edit, save, and apply context configuration for each prompt version to control what data context the AI sees.

**Independent Test**: Edit context config fields, save a new version, and verify that the context config is correctly persisted and applied when the version is activated.

### Tests for User Story 2

- [x] T022 [P] [US2] Unit test for context config CRUD in AiPromptsService in backend/test/unit/ai/ai-prompts.service.spec.ts
- [x] T023 [P] [US2] Integration test for context config validation against database in backend/test/integration/ai/ai-prompts.service.spec.ts

### Implementation for User Story 2

- [x] T024 [US2] Add GET /api/ai/prompts/:type/:version/context-config endpoint in backend/src/modules/ai/controllers/ai-prompts.controller.ts
- [x] T025 [US2] Add PUT /api/ai/prompts/:type/:version/context-config endpoint in backend/src/modules/ai/controllers/ai-prompts.controller.ts
- [x] T026 [US2] Extend AiPromptsService with context config CRUD methods in backend/src/modules/ai/services/ai-prompts.service.ts
- [x] T027 [US2] Add context config validation (project/contract ID validation) in backend/src/modules/ai/services/ai-prompts.service.ts
- [x] T028 [US2] Create ContextConfigEditor component in frontend/components/admin/ai/ContextConfigEditor.tsx
- [x] T029 [US2] Integrate ContextConfigEditor into prompt management page in frontend/app/(admin)/admin/ai/prompt-management/page.tsx
- [x] T030 [US2] Extend admin-ai.service.ts with context config API methods in frontend/lib/services/admin-ai.service.ts

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently

---

## Phase 5: User Story 3 - Three-Step Sandbox Testing (Priority: P1)

**Goal**: Admin users can test the full AI pipeline (OCR → AI Extract → RAG Prep) in sandbox to validate prompt versions before activation. RAG Prep is required to ensure production parity.

**Independent Test**: Upload a PDF, run all three sandbox steps sequentially (OCR → Extract → RAG Prep), and verify that each step produces expected outputs (OCR text, extracted metadata, RAG chunks).

### Tests for User Story 3

- [x] T031 [P] [US3] Unit test for sandbox RAG Prep job processing in ai-batch.processor in backend/test/unit/ai/ai-batch.processor.spec.ts
- [x] T032 [P] [US3] Integration test for 3-step sandbox workflow in backend/test/integration/ai/sandbox-workflow.spec.ts

### Implementation for User Story 3

- [x] T033 [US3] Add POST /api/ai/admin/sandbox/rag-prep endpoint in backend/src/modules/ai/controllers/ai.controller.ts
- [x] T034 [US3] Add GET /api/ai/admin/sandbox/job/:jobId endpoint in backend/src/modules/ai/controllers/ai.controller.ts
- [x] T035 [US3] Extend ai-batch.processor with sandbox-rag-prep job handler in backend/src/modules/ai/processors/ai-batch.processor.ts
- [x] T036 [US3] Extend OcrService with RAG Prep integration (semantic chunking + embedding) in backend/src/modules/ai/services/ocr.service.ts
- [x] T037 [US3] Create SandboxTabs component with 3-step workflow in frontend/components/admin/ai/SandboxTabs.tsx
- [x] T038 [US3] Create SandboxTestArea component with UI elements in frontend/components/admin/ai/SandboxTestArea.tsx
  - Upload PDF file input
  - Select Project/Contract dropdowns
  - Run Test button
  - View Results display area (OCR text, extracted metadata, RAG chunks)
- [x] T039 [US3] Integrate SandboxTabs into prompt management page in frontend/app/(admin)/admin/ai/prompt-management/page.tsx
- [x] T040 [US3] Extend admin-ai.service.ts with sandbox RAG Prep API methods in frontend/lib/services/admin-ai.service.ts
- [x] T041 [US3] Add "Activate This Version" button in sandbox results in frontend/components/admin/ai/SandboxTabs.tsx

**Checkpoint**: All user stories should now be independently functional

---

## Phase 6: User Story 4 - Runtime Parameters vs Context Config Separation (Priority: P2)

**Goal**: Admin users have clear separation between Runtime Parameters (AI model behavior) and Context Config (data context) to avoid confusion.

**Independent Test**: Verify that Runtime Parameters are in the Sandbox tab and apply globally to AI execution profiles, while Context Config is in the Prompt Editor panel and applies per prompt version.

### Tests for User Story 4

- [x] T042 [P] [US4] Unit test for execution profile CRUD in AiExecutionProfilesService in backend/test/unit/ai/ai-execution-profiles.service.spec.ts
- [x] T043 [P] [US4] Integration test for runtime parameters application to sandbox in backend/test/integration/ai/execution-profiles.spec.ts

### Implementation for User Story 4

- [x] T044 [US4] Create AiExecutionProfilesService in backend/src/modules/ai/services/ai-execution-profiles.service.ts
- [x] T045 [US4] Add GET /api/ai/execution-profiles endpoint in backend/src/modules/ai/controllers/ai.controller.ts
- [x] T046 [US4] Add POST /api/ai/execution-profiles endpoint in backend/src/modules/ai/controllers/ai.controller.ts
- [x] T047 [US4] Add PUT /api/ai/execution-profiles/:id endpoint in backend/src/modules/ai/controllers/ai.controller.ts
- [x] T048 [US4] Add DELETE /api/ai/execution-profiles/:id endpoint in backend/src/modules/ai/controllers/ai.controller.ts
- [x] T049 [US4] Create RuntimeParametersPanel component in frontend/components/admin/ai/RuntimeParametersPanel.tsx
- [x] T050 [US4] Integrate RuntimeParametersPanel into SandboxTabs in frontend/components/admin/ai/SandboxTabs.tsx
- [x] T051 [US4] Extend admin-ai.service.ts with execution profile API methods in frontend/lib/services/admin-ai.service.ts
- [x] T052 [US4] Add "Apply to Production" button in RuntimeParametersPanel in frontend/components/admin/ai/RuntimeParametersPanel.tsx

**Checkpoint**: All user stories including US4 should now be independently functional

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [x] T053 [P] Add error handling following ADR-007 (BusinessException hierarchy) in backend/src/modules/ai/services/ai-prompts.service.ts
- [x] T054 [P] Add error handling following ADR-007 in backend/src/modules/ai/services/ai-execution-profiles.service.ts
- [x] T055 [P] Add CASL guards to all new mutation endpoints in backend/src/modules/ai/controllers/ai-prompts.controller.ts
- [x] T056 [P] Add CASL guards to all new mutation endpoints in backend/src/modules/ai/controllers/ai.controller.ts
- [x] T057 [P] Add ThrottlerGuard to sandbox endpoints in backend/src/modules/ai/controllers/ai.controller.ts
- [x] T058 [P] Add Redis cache invalidation on version activation in backend/src/modules/ai/services/ai-prompts.service.ts
- [x] T059 [P] Add i18n keys for all new UI components in frontend/public/locales/th/common.json and en/common.json
- [x] T060 [P] Add TypeScript strict mode compliance checks (no any, no console.log) in backend/src/modules/ai/ and frontend/components/admin/ai/
- [x] T061 [P] Add E2E test for full prompt management workflow in backend/tests/e2e/prompt-management.e2e-spec.ts
- [x] T062 Run quickstart.md validation checklist
- [x] T063 Update ADR-037 with implementation status

---

## Phase 8: Grilling Session Resolutions (ADR-037 Clarifications)

**Purpose**: Implement decisions from grilling session 2026-06-15

- [x] T064 [P] Add "All Types" option to PromptTypeDropdown in frontend/components/admin/ai/PromptTypeDropdown.tsx
- [x] T065 [P] Add "All Types" view to VersionHistory (grouped by type with labels) in frontend/components/admin/ai/VersionHistory.tsx
- [x] T066 [P] Add @VersionColumn to AiPrompt entity for optimistic locking in backend/src/modules/ai/entities/ai-prompt.entity.ts
- [x] T067 [P] Add optimistic locking error handling in AiPromptsService (detect version mismatch) in backend/src/modules/ai/services/ai-prompts.service.ts
- [x] T068 [P] Add context config field validation (Project/Contract UUID existence, Page Size int range, Language enum) in backend/src/modules/ai/services/ai-prompts.service.ts
- [x] T069 [P] Add context config field validation UI (dropdown valid options, inline errors) in frontend/components/admin/ai/ContextConfigEditor.tsx
- [x] T070 [P] Add responsive design breakpoints (Desktop/Tablet/Mobile) to prompt management page in frontend/app/(admin)/admin/ai/prompt-management/page.tsx
- [x] T071 [P] Add collapsible Left Panel accordion for mobile in frontend/components/admin/ai/VersionHistory.tsx
- [x] T072 [P] Add "Runtime Parameters (Global - Applies to All AI Jobs)" label to RuntimeParametersPanel in frontend/components/admin/ai/RuntimeParametersPanel.tsx
- [x] T073 [P] Add layered error handling (Toast/Inline/Modal) to prompt management UI in frontend/app/(admin)/admin/ai/prompt-management/page.tsx
- [x] T074 [P] Add Redis cache (60s TTL) for version history in backend/src/modules/ai/services/ai-prompts.service.ts
- [x] T075 [P] Add pagination (20 versions/page) to version history in frontend/components/admin/ai/VersionHistory.tsx
- [x] T076 [P] Add database locking (SELECT FOR UPDATE) for concurrent activation in backend/src/modules/ai/services/ai-prompts.service.ts
- [x] T077 [P] Add block deletion of active version in backend/src/modules/ai/services/ai-prompts.service.ts
- [x] T078 [P] Add Redis TTL (60m) for sandbox job results in backend/src/modules/ai/processors/ai-batch.processor.ts

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-6)**: All depend on Foundational phase completion
  - User stories can then proceed in parallel (if staffed)
  - Or sequentially in priority order (US1 → US2 → US3 → US4)
- **Polish (Phase 7)**: Depends on all desired user stories being complete
- **Grilling Resolutions (Phase 8)**: Depends on all user stories being complete (cross-cutting improvements)

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P1)**: Can start after Foundational (Phase 2) - Integrates with US1 (uses same page) but independently testable
- **User Story 3 (P1)**: Can start after Foundational (Phase 2) - Integrates with US1 (uses same page) but independently testable
- **User Story 4 (P2)**: Can start after Foundational (Phase 2) - Integrates with US3 (SandboxTabs) but independently testable

### Within Each User Story

- Tests MUST be written and FAIL before implementation
- DTOs before services
- Services before controllers
- Backend before frontend (for API-dependent features)
- Core implementation before integration
- Story complete before moving to next priority

### Parallel Opportunities

- All Setup tasks marked [P] can run in parallel
- All Foundational tasks marked [P] can run in parallel (within Phase 2)
- Once Foundational phase completes, all user stories can start in parallel (if team capacity allows)
- All tests for a user story marked [P] can run in parallel
- DTOs within a story marked [P] can run in parallel
- Different user stories can be worked on in parallel by different team members

---

## Parallel Example: User Story 1

```bash
# Launch all tests for User Story 1 together:
Task: "Unit test for placeholder validation in AiPromptsService in backend/test/unit/ai/ai-prompts.service.spec.ts"
Task: "Integration test for version number increment per prompt type in backend/test/integration/ai/ai-prompts.service.spec.ts"

# Launch all DTOs for User Story 1 together (in Foundational phase):
Task: "Create ContextConfigDto in backend/src/modules/ai/dto/context-config.dto.ts"
Task: "Create SandboxRagPrepDto in backend/src/modules/ai/dto/sandbox-rag-prep.dto.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Test User Story 1 independently
5. Deploy/demo if ready

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Deploy/Demo (MVP!)
3. Add User Story 2 → Test independently → Deploy/Demo
4. Add User Story 3 → Test independently → Deploy/Demo
5. Add User Story 4 → Test independently → Deploy/Demo
6. Each story adds value without breaking previous stories

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 1 (Multi-Type Prompt Management)
   - Developer B: User Story 2 (Context Configuration Management)
   - Developer C: User Story 3 (Three-Step Sandbox Testing)
3. After P1 stories complete:
   - Developer A: User Story 4 (Runtime Parameters Separation)
   - Developer B: Polish & Cross-Cutting Concerns
   - Developer C: E2E testing
4. Stories complete and integrate independently

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Verify tests fail before implementing
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Avoid: vague tasks, same file conflicts, cross-story dependencies that break independence
- Follow ADR-019 UUID handling (no parseInt, use publicId only)
- Follow ADR-009 schema changes (edit SQL directly, no migrations)
- Follow ADR-016 security (CASL guards on all mutations)
- Follow ADR-007 error handling (layered classification)
- Follow ADR-023/023A AI boundary (BullMQ queues, no direct AI access)
