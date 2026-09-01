// File: specs/200-fullstacks/251-prompt-types-domain-rename/tasks.md
// Change Log:
// - 2026-09-01: Initial task breakdown for Feature 251
// - 2026-09-01: Added FR-010 test task (T033) + FR traceability references

# Tasks: Prompt Types Master Table + Domain Term Rename

**Input**: Design documents from `/specs/200-fullstacks/251-prompt-types-domain-rename/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: TDD_REQUIRED — `_LCBP3-CONTRACTS.md` requires TDD evidence for every feature/behavior change in this repo; not optional here. Write each test task FIRST and confirm it FAILS before its paired implementation task.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Web app**: `backend/src/`, `frontend/`
- Schema: `specs/03-Data-and-Storage/`
- Specs: `specs/200-fullstacks/251-prompt-types-domain-rename/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: SQL delta file + canonical schema update — foundation for all user stories

- [ ] T001 Create SQL delta file `specs/03-Data-and-Storage/deltas/2026-09-01-ai-prompt-types-and-category-rename.sql` with: (1) `CREATE TABLE ai_prompt_types` (FR-001), (2) `INSERT` seed 7 types (FR-002), (3) `ALTER TABLE ai_prompts ADD CONSTRAINT fk_prompt_type FOREIGN KEY (prompt_type) REFERENCES ai_prompt_types(prompt_type) ON DELETE RESTRICT` (FR-001), (4) `ALTER TABLE migration_review_queue CHANGE COLUMN ai_suggested_category ai_suggested_correspondence_type VARCHAR(50) NULL` (FR-007)
- [ ] T002 [P] Update canonical schema `specs/03-Data-and-Storage/lcbp3-v1.9.0-schema-02-tables.sql` — add `ai_prompt_types` table definition after `ai_prompts` (line ~1644), add FK constraint to `ai_prompts` (FR-001), rename `ai_suggested_category` → `ai_suggested_correspondence_type` (line 1534) (FR-007)

**Checkpoint**: Schema delta + canonical schema ready — backend entity tasks can begin

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Backend entity + service + controller for `ai_prompt_types` — MUST complete before US1 frontend and US2/US3 tasks

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

### Tests for Foundational (TDD — write FIRST, confirm FAIL)

- [ ] T003 [P] Write failing test for `AiPromptTypesService.findByType()` in `backend/src/modules/ai/prompts/ai-prompt-types.service.spec.ts` — test that it returns the type record and throws `BusinessException` when type not found (FR-014)
- [ ] T004 [P] Write failing test for `AiPromptTypesService.findAll()` in `backend/src/modules/ai/prompts/ai-prompt-types.service.spec.ts` — test that it returns all active types
- [ ] T005 [P] Write failing test for `AiPromptTypesService.create()` in `backend/src/modules/ai/prompts/ai-prompt-types.service.spec.ts` — test validation (unique prompt_type, required displayName) and RBAC (FR-013)
- [ ] T006 [P] Write failing test for `AiPromptTypesService.delete()` in `backend/src/modules/ai/prompts/ai-prompt-types.service.spec.ts` — test that delete is blocked when `ai_prompts` references exist (FR-012)

### Implementation for Foundational

- [ ] T007 [P] Create `AiPromptType` entity in `backend/src/modules/ai/prompts/ai-prompt-types.entity.ts` — `@Entity('ai_prompt_types')` with fields: `id` (INT PK, `@Exclude()`), `publicId` (UUID), `promptType` (VARCHAR 50, unique), `displayName` (VARCHAR 255), `description` (TEXT nullable), `expectedPlaceholders` (JSON nullable), `isSystemManaged` (TINYINT, default 1), `isActive` (TINYINT, default 1), `createdAt`, `updatedAt` (FR-001)
- [ ] T008 Create `CreateAiPromptTypeDto` in `backend/src/modules/ai/prompts/dto/create-ai-prompt-type.dto.ts` — fields: `promptType` (string, max 50, snake_case pattern), `displayName` (string, max 255), `description` (string, optional), `expectedPlaceholders` (string array, optional)
- [ ] T009 [P] Create `AiPromptTypeResponseDto` in `backend/src/modules/ai/prompts/dto/ai-prompt-type-response.dto.ts` — `@Exclude()` on `id`, expose `publicId`, `promptType`, `displayName`, `description`, `expectedPlaceholders`, `isSystemManaged`, `isActive`
- [ ] T010 Implement `AiPromptTypesService` in `backend/src/modules/ai/prompts/ai-prompt-types.service.ts` — `findByType(promptType)` (throws `BusinessException` if not found, FR-014), `findAll()` (returns active types), `create(dto, userId)` (validates unique, generates UUIDv7), `delete(promptType)` (checks `ai_prompts` references before delete, FR-012)
- [ ] T011 Implement `AiPromptTypesController` in `backend/src/modules/ai/prompts/ai-prompt-types.controller.ts` — `GET /ai/prompt-types` (list), `POST /ai/prompt-types` (create, `@RequirePermission('system.manage_all')`, `@Audit`) (FR-013), `DELETE /ai/prompt-types/:promptType` (delete, `@RequirePermission('system.manage_all')`, `@Audit`) (FR-013)
- [ ] T012 Register `AiPromptType` entity + `AiPromptTypesService` + `AiPromptTypesController` in `backend/src/modules/ai/ai.module.ts` (or appropriate module)
- [ ] T013 Update `AiPromptsService.create()` in `backend/src/modules/ai/prompts/ai-prompts.service.ts` — replace hardcoded switch statement (lines 402-430) with dynamic validation: query `aiPromptTypesService.findByType(promptType)` → validate `expectedPlaceholders` against template (FR-006)
- [ ] T014 Update `AiPromptsService.getActive()` / `resolveActive()` in `backend/src/modules/ai/prompts/ai-prompts.service.ts` — add `aiPromptTypesService.findByType()` check; throw `BusinessException` if type not in master table (FR-014)
- [ ] T015 Run focused tests: `pnpm --filter backend test -- --testPathPatterns=ai-prompt-types --coverage=false` — confirm T003-T006 now pass (GREEN)
- [ ] T016 Run `pnpm --filter backend build` — confirm TypeScript compilation passes

**Checkpoint**: Foundation ready — `ai_prompt_types` CRUD works, dynamic validation replaces hardcoded switch, runtime fallback throws `BusinessException`

---

## Phase 3: User Story 1 — Admin manages all AI prompt types from a single page (Priority: P1) 🎯 MVP

**Goal**: Unified prompt management page with dynamic dropdown from `ai_prompt_types` — replaces 2 pages + makes all 7 types manageable (FR-003, FR-004, FR-005)

**Independent Test**: Open `/admin/ai/prompt-management` → dropdown lists all 7 types (including `migration_compare`, `rag_chunking`) → create/activate prompt for any type → old `/admin/ai/prompts` URL redirects 308

### Tests for User Story 1 (TDD — write FIRST, confirm FAIL)

- [ ] T017 [P] [US1] Write failing test for `PromptTypeDropdown` dynamic rendering in `frontend/components/admin/ai/__tests__/PromptTypeDropdown.test.tsx` — test that dropdown options come from API query (not hardcoded), includes all 7 types (FR-005)
- [ ] T018 [P] [US1] Write failing test for unified prompt management page in `frontend/app/(admin)/admin/ai/prompt-management/__tests__/page.test.tsx` — test that single page renders dropdown + version list + editor (no 2-tab layout) (FR-003, FR-004)

### Implementation for User Story 1

- [ ] T019 [P] [US1] Update `frontend/lib/types/ai-prompts.ts` — change `PromptType` from hardcoded union to `string` (dynamic from API); add `AiPromptType` interface (`publicId`, `promptType`, `displayName`, `description`, `expectedPlaceholders`, `isSystemManaged`, `isActive`)
- [ ] T020 [P] [US1] Add `listPromptTypes()` method to `frontend/lib/services/admin-ai.service.ts` — `GET /ai/prompt-types` → returns `AiPromptType[]`
- [ ] T021 [US1] Rewrite `frontend/components/admin/ai/PromptTypeDropdown.tsx` — replace hardcoded `<SelectItem>` list with `useQuery(['ai-prompt-types'])` → render options from API response; use `displayName` for label (FR-005)
- [ ] T022 [US1] Rewrite `frontend/app/(admin)/admin/ai/prompt-management/page.tsx` — remove `promptSeparationTabValue` logic (line 25-26); use `PromptTypeDropdown` with dynamic types; ensure version list + editor + sandbox all work with any selected type (FR-003)
- [ ] T023 [US1] Delete `frontend/components/admin/ai/PromptManagementTabs.tsx` (2-tab OCR System vs AI Extraction layout — replaced by unified page) (FR-004)
- [ ] T024 [US1] Update `frontend/app/(admin)/admin/ai/prompts/page.tsx` — replace `PromptManagementTabs` render with `redirect('/admin/ai/prompt-management', 308)` (Next.js permanent redirect) (FR-004)
- [ ] T025 [P] [US1] Update `frontend/components/admin/ai/VersionHistory.tsx` — replace hardcoded Thai labels (lines 61-67) with dynamic `displayName` from `ai_prompt_types` data
- [ ] T026 [P] [US1] Add i18n keys for new prompt type display names in `frontend/public/locales/en/ai.json` and `frontend/public/locales/th/ai.json` — keys for `migration_compare`, `rag_chunking` display names
- [ ] T027 [US1] Run focused frontend tests: `npx vitest run --reporter=verbose` for PromptTypeDropdown + prompt-management page tests — confirm T017-T018 pass (GREEN)
- [ ] T028 [US1] Run `npx tsc --noEmit` in frontend — confirm TypeScript passes

**Checkpoint**: US1 complete — unified page works, all 7 types in dropdown, old URL redirects

---

## Phase 4: User Story 2 — Domain term "Correspondence Type" replaces "Category" (Priority: P2)

**Goal**: Rename `category` → `correspondenceType` across DB column, backend entity/DTO/types, frontend types/UI/i18n — atomic deploy with US1 (FR-007, FR-015)

**Independent Test**: Grep migration review files for `category` → 0 matches (excluding `system_settings.category`); migration review UI shows "Correspondence Type" label; commit DTO uses `correspondenceType` field

### Tests for User Story 2 (TDD — write FIRST, confirm FAIL)

- [ ] T029 [P] [US2] Update failing test in `backend/src/modules/migration/migration-review.service.spec.ts` — rename all `category` references to `correspondenceType` in test fixtures, assertions, and describe/it names (lines 492-1292 per investigation) (FR-007)
- [ ] T030 [P] [US2] Update failing test in `backend/src/modules/migration/migration.service.spec.ts` — rename all `category` / `confidence.category` references to `correspondenceType` / `confidence.correspondenceType` (lines 382-2374 per investigation) (FR-007)
- [ ] T031 [P] [US2] Update failing test in `frontend/components/migration/__tests__/review-queue-table.test.tsx` — rename `category` fixtures and `confidence.category` to `correspondenceType` (lines 77-330) (FR-007)
- [ ] T032 [P] [US2] Update failing test in `frontend/components/migration/__tests__/review-detail-page.test.tsx` — rename `category` fixtures, `data-testid`, `getByRole` to `correspondenceType` (lines 111-337) (FR-007)
- [ ] T033 [P] [US2] Write failing test for FR-010 in `backend/src/modules/ai/processors/ai-batch.processor.spec.ts` — test that when LLM output JSON contains old key `metadata.category` (instead of `metadata.correspondenceType`), the schema validator rejects it and sets `aiFailed=true` with `aiFailureReason='SCHEMA_VALIDATION_FAILED'` — no silent backward-compat mapping (FR-010)

### Implementation for User Story 2 — Backend

- [ ] T034 [US2] Update `backend/src/modules/migration/entities/migration-review-queue.entity.ts` — rename `@Column name: 'ai_suggested_category'` → `'ai_suggested_correspondence_type'` (line 67); rename property `aiSuggestedCategory` → `aiSuggestedCorrespondenceType` (line 72); rename `aiSuggestedCategoryName` → `aiSuggestedCorrespondenceTypeName` (line 222) (FR-007)
- [ ] T035 [US2] Update `backend/src/modules/migration/types/ai-extraction-details.type.ts` — rename `category: string` → `correspondenceType: string` in `Metadata` (line 52); rename `category: number` → `correspondenceType: number` in `MetadataConfidence` (line 45); rename `category?: 'edited' | 'acknowledged'` → `correspondenceType?: 'edited' | 'acknowledged'` in `FieldResolutionState` (line 70) (FR-007)
- [ ] T036 [US2] Update `backend/src/modules/migration/dto/commit-migration-review.dto.ts` — rename `category?: string` → `correspondenceType?: string` (line 97); update `ACKNOWLEDGEABLE_FIELDS` to include `'correspondenceType'` instead of `'category'` (line 26) (FR-007)
- [ ] T037 [US2] Update `backend/src/modules/migration/migration-review.service.ts` — rename all `category` references: `GATED_FIELDS` (line 88), `field === 'category'` → `field === 'correspondenceType'` (line 238), `dto.category` → `dto.correspondenceType` (lines 240-241, 604), `allowedCategoryCodes.includes(category)` → `allowedCategoryCodes.includes(correspondenceType)` (line 450), `where: { typeName: category }` → `where: { typeName: correspondenceType }` (line 470), `where: { typeCode: category }` → `where: { typeCode: correspondenceType }` (line 476), `CATEGORY_ALIAS[category]` → remove dead map (lines 479-482), `isRFA` checks (lines 529, 730) (FR-007)
- [ ] T038 [US2] Update `backend/src/modules/migration/migration.service.ts` — rename `dto.category` → `dto.correspondenceType` (lines 169, 177, 395, 423, 737); rename `metadataConfidence?.category` → `metadataConfidence?.correspondenceType` (lines 811, 827, 848, 917); rename `documentType: dto.category` → `documentType: dto.correspondenceType` (FR-007)
- [ ] T039 [P] [US2] Update `backend/src/modules/migration/migration-approve-status.spec.ts` — rename `category: 'Correspondence'` → `correspondenceType: 'Correspondence'` (line 38) (FR-007)
- [ ] T040 [P] [US2] Update `backend/src/modules/migration/migration.controller.spec.ts` — rename `category: 'Correspondence'` → `correspondenceType: 'Correspondence'` (line 110) (FR-007)
- [ ] T041 [US2] Implement FR-010 schema validation rejection in `backend/src/modules/ai/processors/ai-batch.processor.ts` — when parsing LLM output, reject JSON containing old key `metadata.category` and set `aiFailed=true` with `aiFailureReason='SCHEMA_VALIDATION_FAILED'` — no silent backward-compat mapping (FR-010)
- [ ] T042 [US2] Run focused backend tests: `pnpm --filter backend test -- --testPathPatterns=migration-review.service --coverage=false` — confirm T029-T030 pass (GREEN)
- [ ] T043 [US2] Run focused backend tests: `pnpm --filter backend test -- --testPathPatterns=ai-batch.processor --coverage=false` — confirm T033 passes (GREEN, FR-010)
- [ ] T044 [US2] Run `pnpm --filter backend build` — confirm TypeScript passes

### Implementation for User Story 2 — Frontend

- [ ] T045 [US2] Update `frontend/types/migration.ts` — rename `category?: 'edited' | 'acknowledged'` → `correspondenceType?: 'edited' | 'acknowledged'` (line 83); rename `category: number` → `correspondenceType: number` in `MetadataConfidence` (line 100); rename `category: string` → `correspondenceType: string` in `Metadata` (line 107) (FR-007)
- [ ] T046 [US2] Update `frontend/types/dto/migration/migration-review.dto.ts` — rename `'category'` → `'correspondenceType'` in `AcknowledgeableMigrationField` (line 17); rename `category?: string` → `correspondenceType?: string` (line 22) (FR-007)
- [ ] T047 [US2] Update `frontend/components/migration/review-queue-table.tsx` — rename `category: editCategory` → `correspondenceType: editCorrespondenceType` (line 175); rename `htmlFor="category"` → `htmlFor="correspondenceType"` (line 504); rename `id="category"` → `id="correspondenceType"` (line 506) (FR-007)
- [ ] T048 [US2] Update `frontend/app/(admin)/admin/migration/review/[id]/page.tsx` — rename Zod field `category` → `correspondenceType` (line 124); rename `categoryError` → `correspondenceTypeError` (lines 154, 329); rename default `category: ''` → `correspondenceType: ''` (line 168); rename `category: res.aiSuggestedCategory` → `correspondenceType: res.aiSuggestedCorrespondenceType` (line 213); rename `category: values.category` → `correspondenceType: values.correspondenceType` (line 301); rename FormField `name="category"` → `name="correspondenceType"` (line 505); rename acknowledge UI for `'category'` → `'correspondenceType'` (lines 745-751); rename label "Category:" → "Correspondence Type:" (line 721) (FR-007)
- [ ] T049 [P] [US2] Update `frontend/app/(admin)/admin/migration/page.tsx` — rename `category: item.aiSuggestedCategory` → `correspondenceType: item.aiSuggestedCorrespondenceType` (line 158) (FR-007)
- [ ] T050 [P] [US2] Update i18n keys in `frontend/public/locales/en/ai.json` — rename `"category"` → `"correspondence_type"`, `"category_read"` → `"correspondence_type_read"`, `"category_suggest"` → `"correspondence_type_suggest"`, `"category_utility"` → `"correspondence_type_utility"`, `"category_dropdown_label"` → `"correspondence_type_dropdown_label"`, `"ack_category"` → `"ack_correspondence_type"` (lines 15-18, 143, 149) (FR-007)
- [ ] T051 [P] [US2] Update i18n keys in `frontend/public/locales/th/ai.json` — same renames as T050 (lines 15-18, 175, 181) (FR-007)
- [ ] T052 [US2] Run focused frontend tests: `npx vitest run --reporter=verbose` for migration review tests — confirm T031-T032 pass (GREEN)
- [ ] T053 [US2] Run `npx tsc --noEmit` in frontend — confirm TypeScript passes

**Checkpoint**: US2 complete — `category` → `correspondenceType` across entire stack, FR-010 rejection test passes, tests pass, build passes

---

## Phase 5: User Story 3 — AI prompt templates use consistent domain terminology (Priority: P3)

**Goal**: Update `ocr_extraction` prompt template + ADR-050 §9 to use `{{allowed_correspondence_types}}` and `metadata.correspondenceType` — `ocr_system` unchanged (FR-008, FR-009, FR-011)

**Independent Test**: Open `ocr_extraction` template in unified prompt management → placeholder is `{{allowed_correspondence_types}}` → output schema shows `correspondenceType` → `ocr_system` template unchanged

### Implementation for User Story 3

- [ ] T054 [P] [US3] Update ADR-050 §9 in `specs/06-Decision-Records/ADR-050-ai-metadata-extraction-output-contract.md` — rename `{{allowed_categories}}` → `{{allowed_correspondence_types}}` (lines 89, 137); rename `metadata.category` → `metadata.correspondenceType` (lines 156, 160); rename `allowed_categories` references in decision items (lines 45, 85) (FR-008, FR-011)
- [ ] T055 [P] [US3] Update prompt reference file `specs/200-fullstacks/250-ai-metadata-extraction-contract/prompts/ocr_extraction.md` — rename `{{allowed_categories}}` → `{{allowed_correspondence_types}}` in template (lines 23, 41, 52); rename `metadata.category` → `metadata.correspondenceType` in output schema (lines 71, 75); update "New placeholders" section (lines 23-26) (FR-008, FR-011)
- [ ] T056 [US3] Update `ai_prompt_types` seed data in SQL delta `specs/03-Data-and-Storage/deltas/2026-09-01-ai-prompt-types-and-category-rename.sql` — change `ocr_extraction` `expected_placeholders` from `["ocr_text","allowed_categories","existing_tags","master_data_context"]` to `["ocr_text","allowed_correspondence_types","existing_tags","master_data_context"]` (FR-008)
- [ ] T057 [US3] Update canonical schema seed in `specs/03-Data-and-Storage/lcbp3-v1.9.0-schema-02-tables.sql` — same placeholder rename as T056 in the `ai_prompt_types` seed section (FR-008)
- [ ] T058 [P] [US3] Verify `ocr_system` prompt template is NOT modified — grep `ocr_system` references in `backend/src/modules/ai/services/ocr.service.ts` and confirm no `category` or `correspondenceType` references exist (FR-009)
- [ ] T059 [P] [US3] Update Feature 250 spec documents to reflect renamed field: `specs/200-fullstacks/250-ai-metadata-extraction-contract/spec.md` (lines 11-110), `specs/200-fullstacks/250-ai-metadata-extraction-contract/data-model.md` (lines 22-130), `specs/200-fullstacks/250-ai-metadata-extraction-contract/contracts/migration-review-queue.openapi.yaml` (FR-011)

**Checkpoint**: US3 complete — prompt template + ADR-050 + Feature 250 docs all use `correspondenceType` / `{{allowed_correspondence_types}}`

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Verification, documentation, ledger finalization

- [ ] T060 Run full backend test suite: `pnpm --filter backend test -- --testPathIgnorePatterns=tests/performance` — confirm 0 failures
- [ ] T061 Run full frontend test suite: `npx vitest run` — confirm 0 failures
- [ ] T062 [P] Run `npx tsc --noEmit` in frontend — confirm 0 errors
- [ ] T063 [P] Run `pnpm --filter backend build` — confirm 0 errors
- [ ] T064 Grep verification: `grep -rn "category" backend/src/modules/migration/ --include="*.ts" | grep -v "system_settings" | grep -v "node_modules"` — confirm 0 matches (SC-003)
- [ ] T065 Grep verification: `grep -rn "category" frontend/types/migration.ts frontend/components/migration/ frontend/app/\(admin\)/admin/migration/` — confirm 0 matches (SC-003)
- [ ] T066 [P] Update Feature 251 spec documents to reflect any changes discovered during implementation: `specs/200-fullstacks/251-prompt-types-domain-rename/spec.md`, `plan.md`, `data-model.md`
- [ ] T067 Run quickstart.md validation steps 1-10 against local stack (if available) — document results
- [ ] T068 Update assurance ledger checkpoint in `specs/200-fullstacks/251-prompt-types-domain-rename/ai-ledger.md` — record final verification results, set STATUS to `checkpoint-ready`
- [ ] T069 Finalize ledger terminal status in `specs/200-fullstacks/251-prompt-types-domain-rename/ai-ledger.md` — set STATUS to `complete` after all acceptance criteria verified

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on T001 (SQL delta) — BLOCKS all user stories
- **US1 (Phase 3)**: Depends on Phase 2 completion (T010-T014: backend API ready)
- **US2 (Phase 4)**: Depends on Phase 2 completion (T001: DB column rename) — can run in parallel with US1
- **US3 (Phase 5)**: Depends on US1 (T022: unified page) + US2 (T035: types renamed) — must be last
- **Polish (Phase 6)**: Depends on all user stories complete

### User Story Dependencies

- **User Story 1 (P1)**: Depends on Foundational — No dependencies on other stories
- **User Story 2 (P2)**: Depends on Foundational — Can run in parallel with US1 (different files)
- **User Story 3 (P3)**: Depends on US1 + US2 — Must be last (prompt template rename requires both infrastructure + application rename)

### Within Each User Story

- Tests MUST be written and FAIL before implementation (TDD)
- Backend changes before frontend changes (within US2)
- Entity/type changes before service changes
- Service changes before UI changes

### Parallel Opportunities

- T001 + T002 can run in parallel (different files)
- T003-T006 (foundational tests) can all run in parallel
- T007-T009 (entity + DTOs) can run in parallel
- US1 (Phase 3) and US2 (Phase 4) can run in parallel by different developers
- T017-T018 (US1 tests) can run in parallel
- T029-T033 (US2 tests) can run in parallel
- T039-T040 (US2 controller/approve specs) can run in parallel
- T050-T051 (US2 i18n en/th) can run in parallel
- T054-T055 (US3 ADR + prompt file) can run in parallel
- T058-T059 (US3 verify + Feature 250 docs) can run in parallel

---

## Parallel Example: US1 + US2 Concurrent

```bash
# Developer A: User Story 1 (frontend prompt management)
Task T019: "Update frontend/lib/types/ai-prompts.ts"
Task T020: "Add listPromptTypes() to admin-ai.service.ts"
Task T021: "Rewrite PromptTypeDropdown.tsx"
Task T022: "Rewrite prompt-management/page.tsx"

# Developer B: User Story 2 (backend rename) — different files, no conflict
Task T034: "Update migration-review-queue.entity.ts"
Task T035: "Update ai-extraction-details.type.ts"
Task T036: "Update commit-migration-review.dto.ts"
Task T037: "Update migration-review.service.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001-T002: SQL delta + canonical schema)
2. Complete Phase 2: Foundational (T003-T016: entity, service, controller, dynamic validation)
3. Complete Phase 3: User Story 1 (T017-T028: unified page, dynamic dropdown, redirect)
4. **STOP and VALIDATE**: Test US1 independently — all 7 types in dropdown, old URL redirects
5. Deploy/demo if ready

### Incremental Delivery

1. Setup + Foundational → `ai_prompt_types` API ready
2. Add US1 → Unified prompt management page works → Deploy/Demo (MVP!)
3. Add US2 → `category` → `correspondenceType` rename complete → Deploy/Demo
4. Add US3 → Prompt template + ADR-050 updated → Deploy/Demo
5. Polish → Full verification + ledger finalization

### Atomic Deploy Note (FR-015)

US1 + US2 + US3 MUST deploy together in a single atomic release — the `category` → `correspondenceType` rename is a breaking change that requires backend + frontend + DB schema delta to deploy simultaneously. Do not deploy US2 without US1 and US3.

---

## FR Traceability Matrix

| FR | Task(s) | Status |
|---|---|---|
| FR-001 (ai_prompt_types table + FK) | T001, T002, T007 | Covered |
| FR-002 (seed 7 types) | T001, T002 | Covered |
| FR-003 (unified prompt management page) | T018, T022 | Covered |
| FR-004 (remove 2 pages + redirect 308) | T018, T023, T024 | Covered |
| FR-005 (all types manageable from UI) | T017, T021 | Covered |
| FR-006 (dynamic placeholder validation) | T013 | Covered |
| FR-007 (category → correspondenceType rename) | T001, T002, T029-T051 | Covered |
| FR-008 (prompt placeholder rename) | T054, T055, T056, T057 | Covered |
| FR-009 (ocr_system unchanged) | T058 | Covered |
| FR-010 (reject old category JSON key) | T033, T041, T043 | Covered |
| FR-011 (update ADR-050 + spec docs) | T054, T055, T059, T066 | Covered |
| FR-012 (delete protection FK RESTRICT) | T006, T010, T011 | Covered |
| FR-013 (RBAC super-admin for type CRUD) | T005, T011 | Covered |
| FR-014 (BusinessException for missing type) | T003, T010, T014 | Covered |
| FR-015 (atomic deploy) | T060-T069 (verification phase) | Covered |

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable (except US3 depends on US1+US2)
- Verify tests fail before implementing (TDD)
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Atomic deploy: US1+US2+US3 must release together (FR-015)
- Ledger: update `ai-ledger.md` after each phase checkpoint (T068-T069)
