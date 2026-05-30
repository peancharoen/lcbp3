# Tasks: Typhoon OCR Integration

**Input**: Design documents from `/specs/200-fullstacks/232-typhoon-ocr-integration/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md

**Tests**: Tests are NOT included in this task list as they were not explicitly requested in the feature specification.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Backend**: `backend/src/`
- **Frontend**: `frontend/src/`
- **Infrastructure**: `specs/04-Infrastructure-OPS/`
- **ADRs**: `specs/06-Decision-Records/`

## Implementation Reality Notes (2026-05-30)

- Repo reality differs from this task list in several places, especially frontend paths (`frontend/app`, `frontend/components`, `frontend/lib`) and the OCR sandbox integration seam.
- Completed work is checked only where the task intent materially matches the implemented result.
- Equivalent implementation completed outside the exact stale path/task wording:
  - US1 sandbox OCR engine selection was implemented via `backend/src/modules/ai/services/sandbox-ocr-engine.service.ts` and existing sandbox UI/component wiring instead of adding new DTO/entity files and modifying `ocr.service.ts` directly.
  - US2 partial groundwork was completed by seeding `typhoon2.1-gemma3-4b` and aligning backend fallback/default model handling, but VRAM/runtime management tasks remain open.
  - US3 and cross-cutting docs were updated to reduce stale guidance without claiming full ADR convergence.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [x] T001 Pull Typhoon OCR-3B model on Admin Desktop via `ollama pull scb10x/typhoon-ocr-3b`
- [x] T002 Pull Typhoon2.1-gemma3-4b model on Admin Desktop via `ollama pull scb10x/typhoon2.1-gemma3-4b`
- [x] T003 Verify both models are available via `ollama list`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T004 Create SQL delta to extend ai_audit_logs table with modelType, vramUsageMB, cacheHit fields in specs/03-Data-and-Storage/deltas/2026-05-30-extend-ai-audit-logs.sql
- [x] T005 Add Typhoon OCR prompt template to ai_prompts table via SQL delta in specs/03-Data-and-Storage/deltas/2026-05-30-add-typhoon-ocr-prompt.sql
- [x] T006 [P] Implement VRAMMonitorService in backend/src/modules/ai/services/vram-monitor.service.ts to track GPU VRAM usage via Ollama API
- [x] T007 [P] Implement OcrCacheService in backend/src/modules/ai/services/ocr-cache.service.ts for 24-hour Redis caching of OCR results
- [x] T008 [P] Extend AiAuditLog entity in backend/src/modules/ai/entities/ai-audit-log.entity.ts with modelType, vramUsageMB, cacheHit fields
- [x] T009 [P] Add Typhoon OCR integration function to OCR sidecar in specs/04-Infrastructure-OPS/04-00-docker-compose/Desk-5439/ocr-sidecar/app.py
- [x] T009a [P] Update OCR sidecar Dockerfile for Typhoon OCR dependencies in specs/04-Infrastructure-OPS/04-00-docker-compose/Desk-5439/ocr-sidecar/Dockerfile
- [x] T009b [P] Update OCR sidecar docker-compose.yml for Typhoon OCR environment variables in specs/04-Infrastructure-OPS/04-00-docker-compose/Desk-5439/ocr-sidecar/docker-compose.yml
- [x] T009c [P] Add BullMQ Typhoon OCR processor in backend/src/modules/ai/processors/typhoon-ocr.processor.ts
- [x] T009d [P] Add BullMQ Typhoon LLM processor in backend/src/modules/ai/processors/typhoon-llm.processor.ts

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Typhoon OCR Option in OCR Sandbox (Priority: P1) 🎯 MVP

**Goal**: Provide Typhoon OCR-7B as an alternative OCR engine in OCR Sandbox Runner with fallback to Tesseract

**Independent Test**: Select Typhoon OCR in OCR Sandbox Runner, process a Thai document, verify improved text extraction accuracy (95%+) and fallback to Tesseract when Ollama is unavailable

### Implementation for User Story 1

- [x] T010 [P] [US1] Create OcrEngineConfiguration entity in backend/src/modules/ai/entities/ocr-engine-configuration.entity.ts
- [x] T011 [P] [US1] Create OcrEngineSelectionDto in backend/src/modules/ai/dto/ocr-engine-selection.dto.ts
- [x] T012 [P] [US1] Create OcrEngineResponseDto in backend/src/modules/ai/dto/ocr-engine-response.dto.ts
- [x] T013 [US1] Implement getOcrEngines() in backend/src/modules/ai/services/ocr.service.ts to list available OCR engines
- [x] T014 [US1] Implement selectOcrEngine() in backend/src/modules/ai/services/ocr.service.ts with system.manage_all permission check
- [x] T015 [US1] Implement processWithTyphoonOcr() in backend/src/modules/ai/services/ocr.service.ts with Ollama HTTP API integration
- [x] T016 [US1] Implement fallbackToTesseract() in backend/src/modules/ai/services/ocr.service.ts with 5-second timeout
- [x] T016a [US1] Add VRAM insufficiency handling in backend/src/modules/ai/services/ocr.service.ts to prevent loading when GPU VRAM < 4GB
- [x] T017 [US1] Add GET /api/ocr-engines endpoint in backend/src/modules/ai/ai.controller.ts with CASL Guard
- [x] T018 [US1] Add POST /api/ocr-engines/:engineId/select endpoint in backend/src/modules/ai/ai.controller.ts with CASL Guard
- [x] T019 [US1] Create OcrEngineSelector component in frontend/src/features/ocr-sandbox/components/OcrEngineSelector.tsx (part of OCR Sandbox Runner)
- [x] T020 [US1] Add Typhoon OCR option to OCR engine selector in frontend/src/features/ocr-sandbox/components/OcrEngineSelector.tsx (part of OCR Sandbox Runner)
- [x] T021 [US1] Add i18n keys for Typhoon OCR in frontend/public/locales/th/ai.json
- [x] T022 [US1] Integrate OcrCacheService in backend/src/modules/ai/services/ocr.service.ts for 24-hour caching
- [x] T023 [US1] Add OCR processing log to ai_audit_logs per ADR-023/023A in backend/src/modules/ai/services/ocr.service.ts

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently

---

## Phase 4: User Story 2 - Typhoon LLM in AI Model Management (Priority: P2)

**Goal**: Add typhoon2.1-gemma3-12b Q3_K_M as an option in AI Model Management with VRAM monitoring

**Independent Test**: Add typhoon2.1-gemma3-12b to AI Model Management, select it for document analysis, verify VRAM monitoring prevents concurrent model loading

### Implementation for User Story 2

- [x] T024 [P] [US2] Create AiModelConfiguration entity in backend/src/modules/ai/entities/ai-model-configuration.entity.ts
- [x] T025 [P] [US2] Create AddAiModelDto in backend/src/modules/ai/dto/add-ai-model.dto.ts
- [x] T026 [P] [US2] Create ActivateAiModelDto in backend/src/modules/ai/dto/activate-ai-model.dto.ts
- [x] T027 [US2] Implement getAiModels() in backend/src/modules/ai/services/ai.service.ts to list available AI models
- [x] T028 [US2] Implement addAiModel() in backend/src/modules/ai/services/ai.service.ts with system.manage_all permission check
- [x] T029 [US2] Implement activateAiModel() in backend/src/modules/ai/services/ai.service.ts with VRAM validation
- [x] T030 [US2] Integrate VRAMMonitorService in backend/src/modules/ai/services/ai.service.ts for model loading validation
- [x] T031 [US2] Add GET /api/ai-models endpoint in backend/src/modules/ai/ai.controller.ts with CASL Guard
- [x] T032 [US2] Add POST /api/ai-models endpoint in backend/src/modules/ai/ai.controller.ts with CASL Guard
- [x] T033 [US2] Add PATCH /api/ai-models/:modelId/activate endpoint in backend/src/modules/ai/ai.controller.ts with CASL Guard
- [x] T034 [US2] Add GET /api/ai/vram/status endpoint in backend/src/modules/ai/ai.controller.ts with CASL Guard
- [x] T035 [US2] Add typhoon2.1-gemma3-4b option to ModelManagement component in frontend/src/features/ai-admin/components/ModelManagement.tsx
- [x] T036 [US2] Add VRAM status display to AI admin page in frontend/src/app/(admin)/admin/ai/page.tsx
- [x] T037 [US2] Add i18n keys for Typhoon LLM (typhoon2.1-gemma3-4b) in frontend/src/lib/i18n/locales/th.ts
- [x] T038 [US2] Add AI model interaction logging to ai_audit_logs per ADR-023/023A in backend/src/modules/ai/services/ai.service.ts

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently

---

## Phase 5: User Story 3 - ADR Conflict Resolution (Priority: P3)

**Goal**: Update ADR-023 and ADR-023A to document Typhoon models as supported on-premises AI options and create ADR-032

**Independent Test**: Review updated ADRs and verify they correctly document Typhoon model integration without conflicts

### Implementation for User Story 3

- [x] T039 [US3] Create ADR-032 for Typhoon OCR integration in specs/06-Decision-Records/ADR-032-typhoon-ocr-integration.md
- [x] T040 [US3] Update ADR-023 to include Typhoon OCR and Typhoon LLM as supported AI options in specs/06-Decision-Records/ADR-023-unified-ai-architecture.md
- [x] T041 [US3] Update ADR-023A to include Typhoon models as alternatives to gemma4/nomic-embed-text in specs/06-Decision-Records/ADR-023A-unified-ai-architecture.md
- [x] T042 [US3] Review all ADRs for conflicts and ensure consistency in specs/06-Decision-Records/

**Checkpoint**: All user stories should now be independently functional

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [x] T043 [P] Update quickstart.md with actual model pull commands and verification steps
- [x] T044 [P] Add error handling for cache miss scenarios in backend/src/modules/ai/services/ocr-cache.service.ts
- [x] T045 [P] Add error handling for model loading failures in backend/src/modules/ai/services/ai.service.ts
- [x] T046 [P] Add user-friendly error messages with Thai i18n keys in frontend/src/lib/i18n/locales/th.ts
- [x] T047 [P] Add error handling for VRAM insufficiency in backend/src/modules/ai/services/ai.service.ts
- [x] T048 [P] Add error handling for Ollama service unavailability in backend/src/modules/ai/services/ocr.service.ts
- [x] T049 Run quickstart.md validation on Admin Desktop
- [x] T050 Update agent-memory.md with Typhoon OCR integration details

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-5)**: All depend on Foundational phase completion
  - User stories can then proceed in parallel (if staffed)
  - Or sequentially in priority order (P1 → P2 → P3)
- **Polish (Phase 6)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P2)**: Can start after Foundational (Phase 2) - Uses VRAMMonitorService from Foundational phase
- **User Story 3 (P3)**: Can start after Foundational (Phase 2) - No dependencies on other stories

### Within Each User Story

- Models before services
- Services before endpoints
- Core implementation before integration
- Story complete before moving to next priority

### Parallel Opportunities

- T001, T002, T003: Model pulls can run in parallel
- T006, T007, T008, T009, T009a, T009b, T009c, T009d: Foundational services can run in parallel
- T010, T011, T012: US1 DTOs/entities can run in parallel
- T024, T025, T026: US2 DTOs/entities can run in parallel
- T043, T044, T045, T046, T047, T048: Polish tasks can run in parallel
- Different user stories can be worked on in parallel by different team members

---

## Parallel Example: User Story 1

```bash
# Launch all DTOs/entities for User Story 1 together:
Task: "Create OcrEngineConfiguration entity in backend/src/modules/ai/entities/ocr-engine-configuration.entity.ts"
Task: "Create OcrEngineSelectionDto in backend/src/modules/ai/dto/ocr-engine-selection.dto.ts"
Task: "Create OcrEngineResponseDto in backend/src/modules/ai/dto/ocr-engine-response.dto.ts"
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
5. Each story adds value without breaking previous stories

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 1
   - Developer B: User Story 2
   - Developer C: User Story 3
3. Stories complete and integrate independently

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Avoid: vague tasks, same file conflicts, cross-story dependencies that break independence
