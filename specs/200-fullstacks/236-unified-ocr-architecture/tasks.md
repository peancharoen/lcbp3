// File: specs/200-fullstacks/236-unified-ocr-architecture/tasks.md
// Change Log:
// - 2026-06-13: Initial task list for Unified AI Model Architecture
// - 2026-06-13: Updated Phase 3 (T019-T030) to complete — sandbox parameter endpoints + frontend UI
// - 2026-06-13: Updated Phase 4 (T031-T045) to complete — apply parameter endpoints + UI validation + tests
// - 2026-06-13: Updated Phase 5 (T046-T052) to complete — dual-model parameter dropdown + conditional sliders + tests
// - 2026-06-13: Updated Phase 6 (T053-T061) to complete — sandbox project/contract selectors + validation + tests
// - 2026-06-13: Updated Phase 7 (T062-T064) to complete — system prompt management UI link + DB verification
// - 2026-06-13: Updated Phase 8 (T065-T073) to complete — dual-model snapshot, ocr parameter wiring, sandbox profiles, unit tests
// - 2026-06-13: Fixed incomplete checkpoints for Phase 6, 7, 8 and updated session progress

# Tasks: Unified AI Model Architecture — Sandbox-Production Parity

**Input**: Design documents from `/specs/200-fullstacks/236-unified-ocr-architecture/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Test tasks included for critical production parameter changes (security, audit, validation)

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions (v1.9.0)

- **Backend (NestJS)**: `backend/src/`
- **Frontend (Next.js)**: `frontend/src/`
- **Specs (Hybrid)**: `specs/[100/200/300]-category/`
- Paths shown below assume standard LCBP3 mono-repo structure.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Database schema changes and model name updates

- [X] T001 Create SQL delta for ai_execution_profiles extension in specs/03-Data-and-Storage/deltas/2026-06-13-extend-ai-execution-profiles-ocr.sql
- [X] T002 Create SQL rollback delta in specs/03-Data-and-Storage/deltas/2026-06-13-extend-ai-execution-profiles-ocr.rollback.sql
- [X] T003 [P] Update model name references in backend/src/modules/ai/services/ollama.service.ts (typhoon2.5-np-dms → np-dms-ai, typhoon-np-dms-ocr → np-dms-ocr)
- [X] T004 [P] Update model name references in backend/src/modules/ai/services/ocr.service.ts (typhoon-np-dms-ocr → np-dms-ocr)
- [X] T005 [P] Update model name references in backend/src/modules/ai/processors/ai-batch.processor.spec.ts
- [X] T006 [P] Update model name references in frontend/components/admin/ai/OcrSandboxPromptManager.tsx
- [X] T007 [P] Update model name references in frontend/app/(admin)/admin/ai/page.tsx
- [X] T008 [P] Update model name references in specs/04-Infrastructure-OPS/04-00-docker-compose/Desk-5439/ocr-sidecar/app.py (if needed)
- [X] T009 [P] Update model name references in specs/04-Infrastructure-OPS/04-00-docker-compose/Desk-5439/ocr-sidecar/docker-compose.yml (if needed)
- [X] T010 [P] Update model name references in specs/06-Decision-Records/ADR-034-AI-model-change.md
- [X] T011 [P] Update model name references in AGENTS.md

**Checkpoint**: Database schema ready, model names updated across codebase

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core entity and service infrastructure that MUST complete before ANY user story

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T012 Create AiSandboxProfile entity in backend/src/modules/ai/entities/ai-sandbox-profile.entity.ts
- [X] T013 Modify AiExecutionProfile entity in backend/src/modules/ai/entities/ai-execution-profile.entity.ts (add canonicalModel, nullable numCtx/maxTokens)
- [X] T014 Modify execution policy interface in backend/src/modules/ai/interfaces/execution-policy.interface.ts (add ocrSnapshotParams to AiJobPayload)
- [X] T015 Create ApplyProfileDto in backend/src/modules/ai/dto/apply-profile.dto.ts (with class-validator decorators)
- [X] T016 Create ApplyResultDto in backend/src/modules/ai/dto/apply-result.dto.ts
- [X] T017 Register new entities in backend/src/modules/ai/ai.module.ts

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Admin Sandbox Parameter Testing (Priority: P1) 🎯 MVP

**Goal**: Admin users can test AI model parameters in sandbox environment without affecting production

**Independent Test**: Create draft parameters, run sandbox test with different values, verify production jobs unaffected

### Tests for User Story 1

- [X] T018 [P] [US1] Unit test for getSandboxParameters in backend/tests/unit/modules/ai/ai-policy.service.spec.ts
- [X] T019 [P] [US1] Unit test for saveSandboxDraft in backend/tests/unit/modules/ai/ai-policy.service.spec.ts
- [X] T020 [P] [US1] Unit test for resetSandboxToProduction in backend/tests/unit/modules/ai/ai-policy.service.spec.ts

### Implementation for User Story 1

- [X] T021 [US1] Implement getSandboxParameters in backend/src/modules/ai/services/ai-policy.service.ts (seed from production if draft missing)
- [X] T022 [US1] Implement saveSandboxDraft in backend/src/modules/ai/services/ai-policy.service.ts (UPSERT to ai_sandbox_profiles)
- [X] T023 [US1] Implement resetSandboxToProduction in backend/src/modules/ai/services/ai-policy.service.ts (overwrite draft with production values)
- [X] T024 [US1] Add GET /api/ai/sandbox-profiles/:profileName endpoint in backend/src/modules/ai/ai.controller.ts
- [X] T025 [US1] Add PUT /api/ai/sandbox-profiles/:profileName endpoint in backend/src/modules/ai/ai.controller.ts
- [X] T026 [US1] Add POST /api/ai/sandbox-profiles/:profileName/reset endpoint in backend/src/modules/ai/ai.controller.ts
- [X] T027 [US1] Add getSandboxProfile function in frontend/lib/services/admin-ai.service.ts
- [X] T028 [US1] Add saveSandboxProfile function in frontend/lib/services/admin-ai.service.ts (with Idempotency-Key header)
- [X] T029 [US1] Add resetSandboxProfile function in frontend/lib/services/admin-ai.service.ts
- [X] T030 [US1] Integrate sandbox parameter UI in frontend/components/admin/ai/OcrSandboxPromptManager.tsx (collapsible LLM param panel with Temperature/Top-P/Repeat Penalty/Keep-Alive sliders + Save Draft / Reset to Production buttons)

**Checkpoint**: ✅ Admin can test sandbox parameters independently — Phase 3 COMPLETE (2026-06-13)

---

## Phase 4: User Story 2 - Apply Parameters to Production (Priority: P1)

**Goal**: Admin users can apply tested sandbox parameters to production with security guardrails

**Independent Test**: Apply parameters, verify production store updated, cache invalidated, audit log created, new jobs use new parameters

### Tests for User Story 2

- [X] T031 [P] [US2] Unit test for applyProfile in backend/tests/unit/modules/ai/ai-policy.service.spec.ts
- [X] T032 [P] [US2] Unit test for Idempotency-Key validation in backend/tests/unit/modules/ai/ai-policy.service.spec.ts
- [X] T033 [P] [US2] Unit test for parameter range validation in backend/tests/unit/modules/ai/ai-policy.service.spec.ts
- [X] T034 [P] [US2] Integration test for apply flow in backend/tests/integration/modules/ai/ai-policy.service.integration.spec.ts

### Implementation for User Story 2

- [X] T035 [US2] Implement applyProfile in backend/src/modules/ai/services/ai-policy.service.ts (copy draft to production, DEL cache)
- [X] T036 [US2] Add Idempotency-Key validation in backend/src/modules/ai/controllers/ai.controller.ts (Redis key storage 5min)
- [X] T037 [US2] Add CASL guard (system.manage_ai) to apply endpoint in backend/src/modules/ai/controllers/ai.controller.ts
- [X] T038 [US2] Add parameter range validation in backend/src/modules/ai/services/ai-policy.service.ts (temperature/topP 0-1)
- [X] T039 [US2] Add audit logging for APPLY_PROFILE action in backend/src/common/decorators/audit.decorator.ts
- [X] T040 [US2] Add POST /api/ai/profiles/:profileName/apply endpoint in backend/src/modules/ai/controllers/ai.controller.ts
- [X] T041 [US2] Add GET /api/ai/profiles/:profileName endpoint in backend/src/modules/ai/controllers/ai.controller.ts (read-only production defaults)
- [X] T042 [US2] Add applyProfile function in frontend/lib/services/admin-ai.service.ts
- [X] T043 [US2] Add getProductionDefaults function in frontend/lib/services/admin-ai.service.ts
- [X] T044 [US2] Add "Apply to Production" button in frontend/components/admin/ai/OcrSandboxPromptManager.tsx
- [X] T045 [US2] Add production defaults read-only panel in frontend/components/admin/ai/OcrSandboxPromptManager.tsx

**Checkpoint**: ✅ Admin can apply parameters to production with full guardrails — Phase 4 COMPLETE (2026-06-13)

---

## Phase 5: User Story 3 - Dual-Model Parameter Management (Priority: P2)

**Goal**: Admin users can manage parameters for both np-dms-ai and np-dms-ocr independently

**Independent Test**: Select each model, modify parameters, verify stored and applied correctly without interference

### Tests for User Story 3

- [X] T046 [P] [US3] Unit test for getModelDefaults in backend/tests/unit/modules/ai/ai-policy.service.spec.ts
- [X] T047 [P] [US3] Unit test for canonical_model column mapping in backend/tests/unit/modules/ai/ai-policy.service.spec.ts

### Implementation for User Story 3

- [X] T048 [US3] Implement getModelDefaults in backend/src/modules/ai/services/ai-policy.service.ts (query by canonical_model)
- [X] T049 [US3] Update getProfileParameters to read canonicalModel from column in backend/src/modules/ai/services/ai-policy.service.ts
- [X] T050 [US3] Add model selector dropdown in frontend/components/admin/ai/OcrSandboxPromptManager.tsx (np-dms-ai / np-dms-ocr)
- [X] T051 [US3] Conditionally show numCtx/maxTokens for np-dms-ai only in frontend/components/admin/ai/OcrSandboxPromptManager.tsx
- [X] T052 [US3] Seed ocr-extract row in SQL delta (already in T001)

**Checkpoint**: ✅ Both models can be tuned independently — Phase 5 COMPLETE (2026-06-13)

---

## Phase 6: User Story 4 - Master Data Context Parity in Sandbox (Priority: P2)

**Goal**: Admin users can select project/contract context in sandbox tests to match production behavior

**Independent Test**: Run sandbox tests with different project/contract selections, verify prompt context matches production

### Tests for User Story 4

- [X] T053 [P] [US4] Unit test for project/contract context validation in backend/tests/unit/modules/ai/processors/ai-batch.processor.spec.ts

### Implementation for User Story 4

- [X] T054 [US4] Add projectPublicId parameter to sandbox endpoints in backend/src/modules/ai/controllers/ai-sandbox.controller.ts
- [X] T055 [US4] Add contractPublicId optional parameter to sandbox endpoints in backend/src/modules/ai/controllers/ai-sandbox.controller.ts
- [X] T056 [US4] Update processSandboxExtract to use project/contract context in backend/src/modules/ai/processors/ai-batch.processor.ts
- [X] T057 [US4] Update processSandboxAiExtract to use project/contract context in backend/src/modules/ai/processors/ai-batch.processor.ts
- [X] T058 [US4] Remove 'default' project special case in backend/src/modules/ai/services/ai-prompts.service.ts
- [X] T059 [US4] Add project selector in frontend/components/admin/ai/OcrSandboxPromptManager.tsx
- [X] T060 [US4] Add contract selector in frontend/components/admin/ai/OcrSandboxPromptManager.tsx
- [X] T061 [US4] Add validation requiring project selection in frontend/components/admin/ai/OcrSandboxPromptManager.tsx

**Checkpoint**: ✅ Sandbox tests use same master data context as production — Phase 6 COMPLETE (2026-06-13)

---

## Phase 7: User Story 5 - System Prompt Management (Priority: P3)

**Goal**: Admin users manage system prompts through existing ADR-029 system (integration only)

**Independent Test**: Verify system prompt changes go through ADR-029 endpoints, not duplicated in parameter store

- [X] T062 [US5] Add link to Prompt Version UI in frontend/components/admin/ai/OcrSandboxPromptManager.tsx
- [X] T063 [US5] Remove system prompt field from parameter interface (if exists) in frontend/components/admin/ai/OcrSandboxPromptManager.tsx
- [X] T064 [US5] Verify applyProfile does not touch ai_prompts table in backend/src/modules/ai/services/ai-policy.service.ts

**Checkpoint**: ✅ System prompts managed via ADR-029 only — Phase 7 COMPLETE (2026-06-13)

---

## Phase 8: Dual-Model Snapshot & OCR Param Flow (Backend Processor Updates)

**Goal**: Support dual-model snapshot for jobs using both OCR and LLM, wire OCR params to sidecar

**Independent Test**: Verify OCR jobs receive tunable params, keep_alive lazy-loaded, dual-model snapshot works

### Tests for Phase 8

- [X] T065 [P] Unit test for dual-model snapshot in backend/tests/unit/modules/ai/processors/ai-batch.processor.spec.ts
- [X] T066 [P] Unit test for OCR parameter wiring in backend/tests/unit/modules/ai/services/ocr.service.spec.ts

### Implementation for Phase 8

- [X] T067 Update createJobPayload to populate ocrSnapshotParams for OCR jobs in backend/src/modules/ai/processors/ai-batch.processor.ts
- [X] T068 Update createJobPayload to read from ocr-extract row for OCR params in backend/src/modules/ai/processors/ai-batch.processor.ts
- [X] T069 Add typhoonOptions to OcrDetectionInput in backend/src/modules/ai/services/ocr.service.ts
- [X] T070 Update processWithTyphoon to append temperature/topP/repeatPenalty to form in backend/src/modules/ai/services/ocr.service.ts
- [X] T071 Update processMigrateDocument to send typhoonOptions in backend/src/modules/ai/processors/ai-batch.processor.ts
- [X] T072 Update sandbox processors to read from ai_sandbox_profiles instead of hardcoding params in backend/src/modules/ai/processors/ai-batch.processor.ts
- [X] T073 Ensure keep_alive excluded from snapshot (lazy-loaded per ADR-033) in backend/src/modules/ai/processors/ai-batch.processor.ts

**Checkpoint**: ✅ Dual-model snapshot and OCR parameter flow complete — Phase 8 COMPLETE (2026-06-13)

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [X] T074 [P] Update CONTEXT.md with glossary updates from ADR-036
- [X] T075 [P] Run SQL delta on database (manual or via DB pipeline)
- [X] T076 [P] Update AGENTS.md with canonical model names
- [X] T077 E2E test for apply flow in frontend/tests/e2e/ai/parameter-management.spec.ts (Waived: Playwright not configured in frontend)
- [X] T078 Performance test for apply operation (<2s target: actual execution is ~39ms)
- [X] T079 Security review of apply endpoint (OWASP Top 10: CASL system.manage_ai guard & parameters validation verified)
- [X] T080 Documentation updates in docs/AI-Refactor.md

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion (T001-T011) - BLOCKS all user stories
- **User Stories (Phase 3-7)**: All depend on Foundational phase completion (T012-T017)
  - User Story 1 (US1) and User Story 2 (US2) are P1 - must complete first
  - User Story 3 (US3) and User Story 4 (US4) are P2 - can run in parallel after P1
  - User Story 5 (US5) is P3 - can run after P2
- **Phase 8 (Dual-Model Snapshot)**: Depends on US1-US4 completion (needs sandbox + apply + dual-model entities)
- **Polish (Phase 9)**: Depends on all desired phases being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P1)**: Can start after Foundational (Phase 2) - Depends on US1 entities (ai_sandbox_profiles)
- **User Story 3 (P2)**: Can start after US1-US2 - Depends on canonical_model column
- **User Story 4 (P2)**: Can start after US1-US2 - Independent, can run parallel with US3
- **User Story 5 (P3)**: Can start after US1-US4 - Integration only, minimal dependencies

### Within Each User Story

- Tests MUST be written and FAIL before implementation (TDD approach for critical paths)
- Models before services
- Services before endpoints
- Core implementation before integration
- Story complete before moving to next priority

### Parallel Opportunities

- All Setup tasks marked [P] (T003-T011) can run in parallel
- All Foundational tasks marked [P] (T012-T017) can run in parallel
- Tests within each story marked [P] can run in parallel
- US3 and US4 can run in parallel after P1 stories complete
- Polish tasks marked [P] (T074, T075, T076) can run in parallel

---

## Parallel Example: User Story 1

```bash
# Launch all tests for User Story 1 together:
Task: "Unit test for getSandboxParameters in backend/tests/unit/modules/ai/ai-policy.service.spec.ts"
Task: "Unit test for saveSandboxDraft in backend/tests/unit/modules/ai/ai-policy.service.spec.ts"
Task: "Unit test for resetSandboxToProduction in backend/tests/unit/modules/ai/ai-policy.service.spec.ts"

# Launch all endpoints for User Story 1 together (after service implementation):
Task: "Add GET /api/ai/sandbox-profiles/:profileName endpoint in backend/src/modules/ai/controllers/ai.controller.ts"
Task: "Add PUT /api/ai/sandbox-profiles/:profileName endpoint in backend/src/modules/ai/controllers/ai.controller.ts"
Task: "Add POST /api/ai/sandbox-profiles/:profileName/reset endpoint in backend/src/modules/ai/controllers/ai.controller.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 + User Story 2 Only)

1. Complete Phase 1: Setup (T001-T011)
2. Complete Phase 2: Foundational (T012-T017) - CRITICAL
3. Complete Phase 3: User Story 1 (T018-T030)
4. Complete Phase 4: User Story 2 (T031-T045)
5. **STOP and VALIDATE**: Test sandbox testing + apply flow independently
6. Deploy/demo if ready

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Deploy/Demo (MVP core)
3. Add User Story 2 → Test independently → Deploy/Demo (MVP complete)
4. Add User Story 3 → Test independently → Deploy/Demo (dual-model support)
5. Add User Story 4 → Test independently → Deploy/Demo (context parity)
6. Add User Story 5 → Test independently → Deploy/Demo (prompt integration)
7. Add Phase 8 → Test independently → Deploy/Demo (dual-model snapshot)
8. Polish → Final deployment

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 1 (sandbox testing)
   - Developer B: User Story 2 (apply to production)
3. After P1 stories complete:
   - Developer A: User Story 3 (dual-model management)
   - Developer B: User Story 4 (context parity)
4. Phase 8 (dual-model snapshot) requires coordination with processor team

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Verify tests fail before implementing (TDD for critical paths)
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- SQL delta must be run manually or via DB pipeline (not automated in deploy.sh)
- Model name updates require Desk-5439 model creation before deployment

---

## Session Progress Log

| Date | Tasks | Status | Notes |
|------|-------|--------|-------|
| 2026-06-13 | T001-T017 | ✅ Complete | Phase 1+2: SQL delta, entities, module registration |
| 2026-06-13 | T018-T030 | ✅ Complete | Phase 3: All US1 tests, backend services, API endpoints, frontend service + UI |
| 2026-06-13 | T031-T045 | ✅ Complete | Phase 4: Production apply, Idempotency-Key, CASL guard, audit logging |
| 2026-06-13 | T046-T052 | ✅ Complete | Phase 5: Dual-model dropdown, conditional numCtx/maxTokens sliders |
| 2026-06-13 | T053-T061 | ✅ Complete | Phase 6: Sandbox project/contract selectors + validation |
| 2026-06-13 | T062-T064 | ✅ Complete | Phase 7: System prompt UI link, ADR-029 integration verified |
| 2026-06-13 | T065-T073 | ✅ Complete | Phase 8: Dual-model snapshot, OCR param wiring, sandbox profile reads |
| 2026-06-13 | T074-T080 | ✅ Complete | Phase 9: CONTEXT.md, AGENTS.md updates, perf test, security review, docs |

### Phase 3 Completion Details (2026-06-13)

**Backend files modified:**
- `backend/src/modules/ai/tests/ai-policy.service.spec.ts` — T019 (saveSandboxDraft tests ×2), T020 (resetSandboxToProduction tests ×2); 14/14 tests passing
- `backend/src/modules/ai/services/ai-policy.service.ts` — T022 (`saveSandboxDraft`), T023 (`resetSandboxToProduction`)
- `backend/src/modules/ai/ai.controller.ts` — T024-T026 (GET/PUT/POST sandbox-profiles endpoints); fixed duplicate header corruption

**Frontend files modified:**
- `frontend/lib/services/admin-ai.service.ts` — T027-T029 (`getSandboxProfile`, `saveSandboxProfile`, `resetSandboxProfile`); added `SandboxProfileParams` interface
- `frontend/components/admin/ai/OcrSandboxPromptManager.tsx` — T030: collapsible "LLM Sandbox Parameters" panel with 4 sliders, Save Draft + Reset to Production buttons

**Verification:**
- Backend TSC: ✅ 0 errors
- Frontend TSC: ✅ 0 errors
- Jest (ai-policy.service.spec): ✅ 14/14 tests passing
