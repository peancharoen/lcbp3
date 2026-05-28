# Tasks: Context-Aware Prompt Templates & Database Typo Cleanup

**Input**: Design documents from `/specs/200-fullstacks/230-context-aware-prompt-templates/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, quickstart.md

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [x] T001 Create project directory structure for `specs/200-fullstacks/230-context-aware-prompt-templates/`
- [x] T002 Ensure the git branch `main` is active and clean

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core database and entity modifications that blocking all other user stories

- [x] T003 [P] Modify `schema-02-tables.sql` line 338 to change ENUM('TO', 'CC ') to ENUM('TO', 'CC') in `specs/03-Data-and-Storage/lcbp3-v1.9.0-schema-02-tables.sql`
- [x] T004 Create MariaDB SQL delta file at `specs/03-Data-and-Storage/deltas/2026-05-27-add-context-aware-prompts-and-cleanup.sql` to alter `correspondence_recipients` enum and `ai_prompts` context_config column
- [x] T005 [P] Create MariaDB SQL rollback delta file at `specs/03-Data-and-Storage/deltas/2026-05-27-add-context-aware-prompts-and-cleanup.rollback.sql`
- [x] T006 Update `AiPrompt` entity inside `backend/src/modules/ai/entities/ai-prompt.entity.ts` to include `contextConfig` column mapping to `context_config` JSON

**Checkpoint**: Foundation ready - database structures and base entities mapped.

---

## Phase 3: User Story 1 - OCR Metadata Extraction with Project Context (Priority: P1) 🎯 MVP

**Goal**: Implement contextual master data aggregation and injection into OCR prompts.

**Independent Test**: Verify that prompt generation includes project context master data, and recipients are successfully outputted as an Object Array.

### Implementation for User Story 1

- [x] T007 [P] [US1] Define `CreateAiPromptDto` and `UpdateAiPromptDto` enhancements inside `backend/src/modules/ai/dto/` to support `contextConfig` fields
- [x] T008 [US1] Implement `AiPromptsService.resolveContext()` in `backend/src/modules/ai/services/ai-prompts.service.ts` to fetch projects, tags, organizations based on `context_config` filters
- [x] T009 [US1] Update `AiBatchProcessor` inside `backend/src/modules/ai/processors/ai-batch.processor.ts` to inject resolved master data context into the OCR template execution flow
- [x] T010 [US1] Update OCR JSON output parse rules in `backend/src/modules/ai/processors/ai-batch.processor.ts` to extract `recipients` from the newly defined array of objects model
- [x] T011 [US1] Add Thai prompt template seed script as version 2 inside `specs/03-Data-and-Storage/deltas/2026-05-27-add-context-aware-prompts-and-cleanup.sql`

**Checkpoint**: User Story 1 MVP fully functional.

---

## Phase 4: User Story 2 - Cross-Project Data Isolation Safeguard (Priority: P2)

**Goal**: Secure endpoints against unauthorized cross-project data leakage.

**Independent Test**: API throws ForbiddenException when requesting a project override that is not allowed by prompt config.

### Implementation for User Story 2

- [x] T012 [US2] Implement override verification logic inside `AiPromptsService.resolveContext()` in `backend/src/modules/ai/services/ai-prompts.service.ts` to block cross-project requests
- [x] T013 [US2] Implement unit testing inside `backend/tests/unit/ai-prompts.service.spec.ts` asserting strict `ForbiddenException` throws on override attempts

**Checkpoint**: Security barriers tested and locked.

---

## Phase 5: User Story 3 - Database Cleanup of Typo Whitespaces (Priority: P3)

**Goal**: Sanitize all database records and frontend detail filtering to remove the whitespace CC bug.

**Independent Test**: Details page handles filtering of recipient types correctly without whitespace checks.

### Implementation for User Story 3

- [x] T014 [US3] Execute SQL data modification script inside `2026-05-27-add-context-aware-prompts-and-cleanup.sql` to update all existing `'CC '` values to `'CC'`
- [x] T015 [P] [US3] Normalize frontend detail CC filter checks inside `frontend/components/correspondences/detail.tsx`

**Checkpoint**: Typo fully cleaned up.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Run checks, type checking, and compile validations.

- [x] T016 Run type verification using `pnpm --filter backend build`
- [x] T017 Run unit and integration tests inside backend suite
- [x] T018 Execute validation using `quickstart.md` procedures

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Can start immediately.
- **Foundational (Phase 2)**: Depends on Phase 1 - Blocks all User Stories.
- **User Stories (Phase 3+)**: All depend on Phase 2.
- **Polish (Phase 6)**: Depends on all user stories being complete.

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3: User Story 1
4. Validate Story 1 (MVP is functional)
