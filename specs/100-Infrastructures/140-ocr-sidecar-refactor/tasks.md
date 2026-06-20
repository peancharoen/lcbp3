# Tasks: OCR Sidecar Refactor

**Input**: Design documents from `/specs/100-Infrastructures/140-ocr-sidecar-refactor/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/sidecar-api.md, quickstart.md

**Tests**: Tests are included for path-traversal protection and residency wiring (per spec acceptance criteria)

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Sidecar**: `specs/04-Infrastructure-OPS/04-00-docker-compose/Desk-5439/ocr-sidecar/`
- **Backend**: `backend/src/modules/ai/`
- **Tests**: `tests/unit/ocr-sidecar/`, `tests/integration/ocr-sidecar/`

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [x] T001 Create test directory structure in specs/04-Infrastructure-OPS/04-00-docker-compose/Desk-5439/ocr-sidecar/tests/
- [x] T002 Create test directory structure in tests/unit/ocr-sidecar/
- [x] T003 Create test directory structure in tests/integration/ocr-sidecar/

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T004 Update requirements.txt in specs/04-Infrastructure-OPS/04-00-docker-compose/Desk-5439/ocr-sidecar/requirements.txt (add httpx 0.27.0, remove numpy if present)
- [x] T005 Update .env template in specs/04-Infrastructure-OPS/04-00-docker-compose/Desk-5439/ocr-sidecar/.env (add OCR_SIDECAR_API_KEY placeholder)
- [x] T006 Update backend .env.example in backend/.env.example (add OCR_API_URL, OCR_API_KEY placeholders)

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Sidecar Security Hardening (Priority: P1) 🎯 MVP

**Goal**: Ensure the OCR sidecar is secure from path traversal attacks and does not contain hardcoded secrets that cannot be rotated without rebuilding containers.

**Independent Test**: Attempt path traversal requests and verify they return 403 Forbidden; verify sidecar fails fast when OCR_SIDECAR_API_KEY env is missing.

### Tests for User Story 1

- [x] T007 [P] [US1] Create path traversal test in tests/unit/ocr-sidecar/test_path_traversal.py (test various path patterns: ../../etc/passwd, symlinks outside base path, etc.)
- [x] T008 [P] [US1] Create API key validation test in tests/unit/ocr-sidecar/test_api_key_validation.py (test missing key, invalid key scenarios)

### Implementation for User Story 1

- [x] T009 [US1] Remove hardcoded default API key in specs/04-Infrastructure-OPS/04-00-docker-compose/Desk-5439/ocr-sidecar/app.py
- [x] T010 [US1] Add fail-fast check for OCR_SIDECAR_API_KEY environment variable in specs/04-Infrastructure-OPS/04-00-docker-compose/Desk-5439/ocr-sidecar/app.py (raise error on startup if missing)
- [x] T011 [US1] Implement path canonicalization function in specs/04-Infrastructure-OPS/04-00-docker-compose/Desk-5439/ocr-sidecar/app.py (using os.path.abspath + os.path.realpath)
- [x] T012 [US1] Implement base-path whitelist check in specs/04-Infrastructure-OPS/04-00-docker-compose/Desk-5439/ocr-sidecar/app.py (check against OCR_SIDECAR_UPLOAD_BASE)
- [x] T013 [US1] Add path validation to POST /ocr endpoint in specs/04-Infrastructure-OPS/04-00-docker-compose/Desk-5439/ocr-sidecar/app.py (return 403 for invalid paths)
- [x] T014 [US1] Fix mutable default argument options_override={} in specs/04-Infrastructure-OPS/04-00-docker-compose/Desk-5439/ocr-sidecar/app.py (change to None and initialize in function body)
- [x] T015 [US1] Remove duplicate import tempfile in specs/04-Infrastructure-OPS/04-00-docker-compose/Desk-5439/ocr-sidecar/app.py

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently

---

## Phase 4: User Story 2 - GPU Resource Management (Priority: P1)

**Goal**: Prevent VRAM exhaustion on Desk-5439 by implementing adaptive OCR residency policy and CPU fallback for retrieval models, ensuring LLM has priority GPU access.

**Independent Test**: Monitor VRAM usage during concurrent OCR and embedding operations; verify BGE-M3 and FlagReranker fall back to CPU when GPU is under pressure.

### Tests for User Story 2

- [x] T016 [P] [US2] Create residency wiring unit test in tests/unit/ocr-sidecar/test_residency_wiring.py (verify calculate_ocr_residency is called in process_ocr)
- [x] T017 [P] [US2] Create CPU fallback integration test in tests/integration/ocr-sidecar/test_cpu_fallback.py (verify BGE-M3 and FlagReranker use CPU when GPU under pressure)

### Implementation for User Story 2

- [x] T018 [US2] Import calculate_ocr_residency from residency_policy.py in specs/04-Infrastructure-OPS/04-00-docker-compose/Desk-5439/ocr-sidecar/app.py
- [x] T019 [US2] Wire calculate_ocr_residency(active_profile) into process_ocr function in specs/04-Infrastructure-OPS/04-00-docker-compose/Desk-5439/ocr-sidecar/app.py
- [x] T020 [US2] Remove hardcoded keep_alive=0 in process_ocr in specs/04-Infrastructure-OPS/04-00-docker-compose/Desk-5439/ocr-sidecar/app.py
- [x] T021 [US2] Reject explicit options_override["keep_alive"] from backend in specs/04-Infrastructure-OPS/04-00-docker-compose/Desk-5439/ocr-sidecar/app.py (keep_alive must be calculated lazily per ADR-036 Gap-2)
- [x] T022 [US2] Retain vram_monitor.py in specs/04-Infrastructure-OPS/04-00-docker-compose/Desk-5439/ocr-sidecar/ (ensure not deleted)
- [x] T023 [US2] Retain residency_policy.py in specs/04-Infrastructure-OPS/04-00-docker-compose/Desk-5439/ocr-sidecar/ (ensure not deleted)
- [x] T024 [US2] Verify dynamic CPU/GPU selection exists for /embed endpoint in specs/04-Infrastructure-OPS/04-00-docker-compose/Desk-5439/ocr-sidecar/app.py (check .to(device) logic)
- [x] T025 [US2] Verify dynamic CPU/GPU selection exists for /rerank endpoint in specs/04-Infrastructure-OPS/04-00-docker-compose/Desk-5439/ocr-sidecar/app.py (check .to(device) logic)

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently

---

## Phase 5: User Story 3 - Parameter Governance via Active Prompt (Priority: P2)

**Goal**: Enable backend services to control AI model parameters from the database via ai_execution_profiles and ai_prompts tables, ensuring no hardcoded values in the sidecar.

**Independent Test**: Modify ai_execution_profiles row ocr-extract and verify that the sidecar uses the new parameters on the next request.

### Tests for User Story 3

- [x] T026 [P] [US3] Create parameter resolution integration test in tests/integration/ocr-sidecar/test_parameter_governance.py (verify parameters from ai_execution_profiles are used)
- [x] T027 [P] [US3] Create Active Prompt integration test in tests/integration/ocr-sidecar/test_active_prompt.py (verify systemPrompt and DMS tags from ai_prompts are used)

### Implementation for User Story 3

- [x] T028 [US3] Remove hardcoded runtime parameters (temperature, top_p, repeat_penalty, max_tokens) in specs/04-Infrastructure-OPS/04-00-docker-compose/Desk-5439/ocr-sidecar/app.py
- [x] T029 [US3] Add runtime_params field to OcrRequest pydantic model in specs/04-Infrastructure-OPS/04-00-docker-compose/Desk-5439/ocr-sidecar/app.py
- [x] T030 [US3] Add system_prompt field to OcrRequest pydantic model in specs/04-Infrastructure-OPS/04-00-docker-compose/Desk-5439/ocr-sidecar/app.py
- [x] T031 [US3] Add dms_tags field to OcrRequest pydantic model in specs/04-Infrastructure-OPS/04-00-docker-compose/Desk-5439/ocr-sidecar/app.py
- [x] T032 [US3] Pass runtime_params to Ollama in process_ocr in specs/04-Infrastructure-OPS/04-00-docker-compose/Desk-5439/ocr-sidecar/app.py
- [x] T033 [US3] Pass system_prompt to Ollama in process_ocr in specs/04-Infrastructure-OPS/04-00-docker-compose/Desk-5439/ocr-sidecar/app.py (inject into every load/generate call)
- [x] T034 [US3] Pass dms_tags to Ollama in process_ocr in specs/04-Infrastructure-OPS/04-00-docker-compose/Desk-5439/ocr-sidecar/app.py (inject into every load/generate call)
- [x] T035 [US3] Implement parameter resolution in backend/src/modules/ai/services/ocr.service.ts (resolve from ai_execution_profiles row ocr-extract)
- [x] T036 [US3] Implement Active Prompt resolution in backend/src/modules/ai/services/ocr.service.ts (resolve from ai_prompts type ocr_extraction)
- [x] T037 [US3] Extract systemPrompt and DMS tags in backend/src/modules/ai/services/ocr.service.ts
- [x] T038 [US3] Send resolved parameters to sidecar in backend/src/modules/ai/services/ocr.service.ts
- [x] T039 [US3] Implement parameter resolution in backend/src/modules/ai/services/sandbox-ocr-engine.service.ts (same pattern as ocr.service.ts)
- [x] T040 [US3] Implement Active Prompt resolution in backend/src/modules/ai/services/sandbox-ocr-engine.service.ts (same pattern as ocr.service.ts)

**Checkpoint**: All user stories should now be independently functional

---

## Phase 6: User Story 4 - Async I/O Performance (Priority: P2)

**Goal**: Use asynchronous I/O patterns to prevent blocking the FastAPI event loop, improving throughput and reducing latency for OCR operations.

**Independent Test**: Run concurrent OCR requests and measure response times; verify async implementation handles load without blocking.

### Tests for User Story 4

- [x] T041 [P] [US4] Create async I/O performance test in tests/integration/ocr-sidecar/test_async_performance.py (benchmark concurrent requests)

### Implementation for User Story 4

- [x] T042 [US4] Refactor process_ocr to async def in specs/04-Infrastructure-OPS/04-00-docker-compose/Desk-5439/ocr-sidecar/app.py
- [x] T043 [US4] Create AsyncClient via lifespan context manager in specs/04-Infrastructure-OPS/04-00-docker-compose/Desk-5439/ocr-sidecar/app.py
- [x] T044 [US4] Replace httpx.Client with httpx.AsyncClient in specs/04-Infrastructure-OPS/04-00-docker-compose/Desk-5439/ocr-sidecar/app.py
- [x] T045 [US4] Replace @app.on_event("startup") with @asynccontextmanager lifespan in specs/04-Infrastructure-OPS/04-00-docker-compose/Desk-5439/ocr-sidecar/app.py
- [x] T046 [US4] Load models via asyncio.to_thread during lifespan in specs/04-Infrastructure-OPS/04-00-docker-compose/Desk-5439/ocr-sidecar/app.py (avoid blocking startup)

---

## Phase 7: User Story 5 - Network Isolation Auth Phase 2 (Priority: P3)

**Goal**: After ADR-041 server consolidation completes, remove X-API-Key validation and rely solely on Docker-internal network isolation for authentication.

**Independent Test**: After consolidation, remove X-API-Key headers and verify that requests from within Docker network succeed while external requests fail.

### Tests for User Story 5

- [ ] T047 [P] [US5] Create network isolation test in tests/integration/ocr-sidecar/test_network_isolation.py (verify Docker-internal requests work, external requests fail)

### Implementation for User Story 5 (BLOCKED until ADR-041 consolidation complete)

- [ ] T048 [US5] Remove X-API-Key validation from all endpoints in specs/04-Infrastructure-OPS/04-00-docker-compose/Desk-5439/ocr-sidecar/app.py
- [ ] T049 [US5] Remove OCR_SIDECAR_API_KEY from .env in specs/04-Infrastructure-OPS/04-00-docker-compose/Desk-5439/ocr-sidecar/.env
- [ ] T050 [US5] Remove X-API-Key send-side in backend/src/modules/ai/services/ocr.service.ts
- [ ] T051 [US5] Remove X-API-Key send-side in backend/src/modules/ai/services/sandbox-ocr-engine.service.ts
- [ ] T052 [US5] Remove OCR_API_KEY from backend .env in backend/.env
- [ ] T053 [US5] Update OCR_API_URL to Docker-internal URL in backend/.env (e.g., http://sidecar:8765)

**Note**: Phase 7 tasks are BLOCKED until ADR-041 server consolidation completes. Do not implement until ADR-041 cutover is successful.

---

## Phase 8: Remove /normalize Endpoint (Cross-Cutting)

**Purpose**: Remove unused /normalize endpoint per ADR-040 D2

- [x] T054 Remove /normalize endpoint from specs/04-Infrastructure-OPS/04-00-docker-compose/Desk-5439/ocr-sidecar/app.py
- [x] T055 Verify no consumers exist via grep search in backend codebase

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [x] T056 [P] Update Dockerfile in specs/04-Infrastructure-OPS/04-00-docker-compose/Desk-5439/ocr-sidecar/Dockerfile (if any changes needed)
- [x] T057 [P] Update docker-compose.yml in specs/04-Infrastructure-OPS/04-00-docker-compose/Desk-5439/ocr-sidecar/docker-compose.yml (if any changes needed)
- [x] T058 Run path traversal test suite and verify all tests pass
- [x] T059 Run residency wiring test suite and verify all tests pass
- [x] T060 Run parameter governance test suite and verify all tests pass
- [x] T061 Run async performance test and verify 20%+ throughput improvement
- [x] T062 Update documentation in specs/04-Infrastructure-OPS/04-00-docker-compose/Desk-5439/ocr-sidecar/README.md
- [x] T063 Validate quickstart.md deployment steps on Desk-5439

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-6)**: All depend on Foundational phase completion
  - User Stories 1-4 (P1, P1, P2, P2) can proceed in parallel after Phase 2
  - User Story 5 (P3) is BLOCKED until ADR-041 consolidation completes
- **Remove /normalize (Phase 8)**: Can run in parallel with user stories (no dependencies)
- **Polish (Phase 9)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 3 (P2)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 4 (P2)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 5 (P3)**: BLOCKED until ADR-041 consolidation completes

### Within Each User Story

- Tests MUST be written and FAIL before implementation (TDD approach)
- Sidecar implementation before backend implementation (for parameter governance story)
- Core implementation before integration
- Story complete before moving to next priority

### Parallel Opportunities

- All Setup tasks (T001-T003) can run in parallel
- All Foundational tasks (T004-T006) can run in parallel
- Once Foundational phase completes, User Stories 1-4 can start in parallel (if team capacity allows)
- All tests for a user story marked [P] can run in parallel
- User Story 5 tasks can run in parallel once ADR-041 consolidation completes
- Remove /normalize task (T054-T055) can run in parallel with user stories
- Polish tasks (T056-T057) can run in parallel

---

## Parallel Example: User Story 1

```bash
# Launch all tests for User Story 1 together:
Task: "Create path traversal test in tests/unit/ocr-sidecar/test_path_traversal.py"
Task: "Create API key validation test in tests/unit/ocr-sidecar/test_api_key_validation.py"

# Launch implementation tasks sequentially (each depends on previous):
Task: "Remove hardcoded default API key in specs/04-Infrastructure-OPS/04-00-docker-compose/Desk-5439/ocr-sidecar/app.py"
Task: "Add fail-fast check for OCR_SIDECAR_API_KEY environment variable in specs/04-Infrastructure-OPS/04-00-docker-compose/Desk-5439/ocr-sidecar/app.py"
Task: "Implement path canonicalization function in specs/04-Infrastructure-OPS/04-00-docker-compose/Desk-5439/ocr-sidecar/app.py"
```

---

## Implementation Strategy

### MVP First (User Stories 1-2 Only - Critical Security & GPU Management)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1 (Security Hardening)
4. Complete Phase 4: User Story 2 (GPU Resource Management)
5. **STOP and VALIDATE**: Test User Stories 1-2 independently
6. Deploy/demo if ready

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Deploy/Demo (Security MVP!)
3. Add User Story 2 → Test independently → Deploy/Demo (GPU Management MVP!)
4. Add User Story 3 → Test independently → Deploy/Demo (Parameter Governance)
5. Add User Story 4 → Test independently → Deploy/Demo (Async Performance)
6. Wait for ADR-041 consolidation → Add User Story 5 → Test independently → Deploy/Demo
7. Each story adds value without breaking previous stories

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 1 (Security)
   - Developer B: User Story 2 (GPU Management)
   - Developer C: User Story 3 (Parameter Governance)
   - Developer D: User Story 4 (Async I/O)
3. Stories complete and integrate independently
4. After ADR-041 consolidation: Developer A/E: User Story 5 (Network Isolation)

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Verify tests fail before implementing
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- User Story 5 is BLOCKED until ADR-041 consolidation completes
- Phase 7 tasks should NOT be started until ADR-041 cutover is successful
- Avoid: vague tasks, same file conflicts, cross-story dependencies that break independence

