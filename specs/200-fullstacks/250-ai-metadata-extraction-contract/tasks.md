// File: specs/200-fullstacks/250-ai-metadata-extraction-contract/tasks.md
// Change Log:
// - 2026-08-31: Initial task breakdown for AI Metadata Extraction Output Contract
// - 2026-08-31: Remediated /106-speckit-analyze findings C1/C2/U1/I1/A1/A2 — added commit-time
//   category validation (C1) + server-side legacy-item guard (C2) with paired tests, tightened
//   T003/T004 (A2/A1), clarified aiIssues/ocrQuality separation (I1). Renumbered T024+ by +4.

# Tasks: AI Metadata Extraction Output Contract

**Input**: Design documents from `specs/200-fullstacks/250-ai-metadata-extraction-contract/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md, ADR-050, ai-ledger.md

**Tests**: Included — `_LCBP3-CONTRACTS.md` requires TDD evidence for every feature/behavior change in this repo; not optional here. Write each test task FIRST and confirm it FAILS before its paired implementation task.

**Organization**: Tasks are grouped by user story (spec.md P1/P2/P3) after a shared Foundational phase, since all three stories depend on the backend producing the new contract before any UI can render it.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: US1 / US2 / US3 maps to spec.md priorities
- File paths are exact, relative to repo root

---

## Phase 1: Setup

**Purpose**: Schema delta + prompt content + i18n scaffolding — no business logic yet

- [X] T001 Create SQL delta `specs/03-Data-and-Storage/deltas/2026-08-31-migration-review-queue-human-review-flags.sql` adding `requires_human_review TINYINT(1) NOT NULL DEFAULT 0` and `ocr_quality_confidence DECIMAL(4,3) NULL` to `migration_review_queue` (verify against canonical schema first — ADR-044 gate)
- [X] T002 [P] Update `specs/03-Data-and-Storage/lcbp3-v1.9.0-schema-02-tables.sql` comment block for `migration_review_queue` to document the 2 new columns (keep canonical schema in sync with the delta)
- [X] T003 [P] Update the active `ocr_extraction` prompt via a new versioned `ai_prompts` row (`INSERT ... is_active=1`, same pattern as existing prompt seeds — reproducible across environments, not a manual Admin Console click-through) to the Markdown template in ADR-050 §9, adding `{{allowed_categories}}` and `{{existing_tags}}` placeholders alongside existing `{{ocr_text}}`/`{{master_data_context}}` — **scope note**: landed as a reference file (`prompts/ocr_extraction.md`) instead of a live SQL INSERT, because `ocr_extraction` (unlike brand-new prompt types) already has a live `version_number` in the DB that can't be safely introspected from the filesystem; applying it is a deliberate follow-up admin/DBA action, documented in the reference file
- [X] T004 [P] Add new i18n keys (th + en) for: requiresHumanReview badge, ocrQuality section labels, tag `isNew`/evidence labels, category dropdown, unresolved-field commit error — in `frontend/public/locales/en/ai.json` and `frontend/public/locales/th/ai.json` (existing AI-namespace files, closest fit — no new namespace file)

**Checkpoint**: Schema + prompt content ready for backend implementation.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Backend produces and gates the new contract. **No user story UI is meaningful until this phase is complete.**

⚠️ **CRITICAL**: No User Story phase can begin until this phase's checkpoint is reached.

### Entity & types

- [X] T005 [P] Add `requiresHumanReview: boolean`, `ocrQualityConfidence: number | null` columns and extend the `details` JSON type to include `fieldResolutions`/`aiFailureReason` in `backend/src/modules/migration/entities/migration-review-queue.entity.ts` (data-model.md §1)
- [X] T006 [P] Define `MigrationAiExtractionDetails`, `OcrQualityAssessment`, `TagSuggestion`, `FieldResolutionState` types in `backend/src/modules/migration/types/ai-extraction-details.type.ts` (new file, data-model.md §1-4)

### Category source + legacy prompt refactor

- [X] T007 Remove the `CATEGORY_ALIAS` hardcode map in `backend/src/modules/migration/migration.service.ts` (~line 154-160) and wire `correspondence_types.typeCode` as the `allowed_categories` source (research.md Decision 2)
- [X] T008 Refactor `processLegacyAiEnrichment` in `backend/src/modules/ai/processors/ai-batch.processor.ts` (~line 2050-2110) to call `aiPromptsService.getActive('ocr_extraction')` instead of the inline hardcoded prompt string, injecting `{{allowed_categories}}` and `{{existing_tags}}` — matching the pattern already used by `processOcrExtract`/`processMigrateDocument` (depends on T007)

### Validation + confidence gate

- [X] T009 Implement schema validation of the parsed LLM JSON against the shape in data-model.md §2-3 (confidence in `[0,1]`, `category` ∈ `allowed_categories`, well-formed `tags[]`) in `ai-batch.processor.ts`; on failure set `aiFailed=true` + `details.aiFailureReason='SCHEMA_VALIDATION_FAILED'` (FR-010, research.md Decision 7) (depends on T008)
- [X] T010 Implement deterministic `requiresHumanReview` computation in `backend/src/modules/migration/migration.service.ts` as `min(ocrQuality.confidence, metadata.confidence.*) < ReviewThresholdService.getThresholds().minConfidence`, ignoring any LLM-provided value (research.md Decision 3 — reuses existing `MIGRATION_MIN_CONFIDENCE` setting, not a new constant) (depends on T005, T009)
- [X] T011 Persist `ocrQualityConfidence` and `requiresHumanReview` promoted columns on the extraction write path in `migration.service.ts`/`ai-batch.processor.ts` (depends on T010)
- [X] T012 Compute and persist the backward-compat `ai_confidence` scalar as `min(metadata.confidence.*)` on the same write path (research.md Decision 1) (depends on T010)
- [X] T013 Add legacy-item detection (queue items whose `details` lacks `metadata.confidence`) and expose a "requires re-extraction" reviewable-state flag from `backend/src/modules/migration/migration.service.ts` (FR-011) (depends on T005)
- [X] T014 Add a **server-side** guard rejecting review/commit actions on legacy-shaped items — reject `getQueueItemByPublicId` review-mode access and `POST /ai/migration/review` with a `BusinessException` when `details.metadata.confidence` is absent, in `backend/src/modules/migration/migration.service.ts` and `migration-review.service.ts` (FR-011/SC-006 — closes gap found in `/106-speckit-analyze` finding C2: frontend-only hiding via T034 is not sufficient) (depends on T013)

### Commit DTO + gate + audit

- [X] T015 [P] Update `CommitMigrationReviewDto` in `backend/src/modules/migration/dto/commit-migration-review.dto.ts`: replace `tags: string[]` with `tagDecisions: {name, accepted, evidence?}[]`, add optional `fieldAcknowledgments: ('ocrQuality'|'summary'|'category'|'tags')[]` (data-model.md §6)
- [X] T016 Implement the per-field commit gate in `backend/src/modules/migration/migration-review.service.ts`: for every field below `minConfidence` without a matching edit or `fieldAcknowledgments` entry, throw a `BusinessException` listing `unresolvedFields` (FR-013/FR-014) (depends on T010, T015)
- [X] T017 Validate `CommitMigrationReviewDto.category` against the current `correspondence_types.typeCode` list in `migration-review.service.ts` commit handler; reject with a `BusinessException` if not found (FR-005/SC-003 — closes gap found in `/106-speckit-analyze` finding C1: T007 only restricted the *extraction prompt*, not the commit write path) (depends on T007, T015)
- [X] T018 Implement `tagDecisions` processing in `migration-review.service.ts`: apply only `accepted=true` tags to the document, write one `ai_audit_logs` row (`action='TAG_REJECTED'`) per rejected tag with `tagName`/`evidence`/`actorUserId` (FR-006/FR-007/FR-008) (depends on T015)
- [X] T019 Add `requiresHumanReview` filter and `sortBy=ocrQualityConfidence` query params to `GET /migration/queue` — `backend/src/modules/migration/dto/migration-queue-query.dto.ts` + `migration.controller.ts` + `migration.service.ts` query builder (FR-003/FR-004) (depends on T005)

### Foundational tests (write first, confirm RED, then implement)

- [X] T020 [P] Unit test: `requiresHumanReview` uses `ReviewThresholdService.minConfidence` and ignores any LLM-supplied value — `backend/src/modules/migration/migration.service.spec.ts` (RED before T010)
- [X] T021 [P] Unit test: `processLegacyAiEnrichment` calls `aiPromptsService.getActive('ocr_extraction')`, no hardcoded prompt string remains — `backend/src/modules/ai/processors/ai-batch.processor.spec.ts` (RED before T008)
- [X] T022 [P] Unit test: schema-invalid LLM output sets `aiFailed=true` + `aiFailureReason='SCHEMA_VALIDATION_FAILED'` — `ai-batch.processor.spec.ts` (RED before T009)
- [X] T023 [P] Unit test: a legacy-shaped queue item is rejected server-side on review-mode fetch and on commit, independent of any frontend state — `backend/src/modules/migration/migration.service.spec.ts` / `migration-review.service.spec.ts` (RED before T014)
- [X] T024 [P] Unit test: commit request with an unresolved low-confidence field is rejected with `unresolvedFields` listing that field — `backend/src/modules/migration/migration-review.service.spec.ts` (RED before T016)
- [X] T025 [P] Unit test: commit request with a `category` not in `correspondence_types.typeCode` is rejected with a `BusinessException` — `migration-review.service.spec.ts` (RED before T017)
- [X] T026 [P] Unit test: rejecting a tag in `tagDecisions` writes an `ai_audit_logs` `TAG_REJECTED` row with evidence and actor; accepted tags are applied to the document — `migration-review.service.spec.ts` (RED before T018)

### Ledger

- [X] T027 Update `specs/200-fullstacks/250-ai-metadata-extraction-contract/ai-ledger.md` checkpoint (CP-1): scope = Foundational backend contract (including the C1/C2 remediation tasks T014/T017), verification = `pnpm --filter backend test migration` + `pnpm --filter backend test ai-batch` green, status = checkpoint-ready. Also record the accepted risk from `/106-speckit-analyze` finding U1 (tag-casing dedup relies on prompt compliance only, no backend normalization cross-check against master `tags`) in the ledger's **AI-Specific Risks** section.

**Checkpoint**: Backend produces and gates the full new contract (`ocrQuality`, per-field confidence, `requiresHumanReview`, `tagDecisions`, audit trail, legacy detection — all enforced server-side, not just in the UI). All 3 user stories can now proceed, in parallel if staffed.

---

## Phase 3: User Story 1 - Reviewer scans the queue for items that need attention (Priority: P1) 🎯 MVP

**Goal**: Reviewer can tell, from the queue list alone, which items need attention — and filter/sort to them directly.

**Independent Test**: Load the queue with mixed-confidence items; confirm flagged items are visually distinguishable, the "needs review" filter narrows the list, and sort-by-OCR-quality reorders it.

### Tests for User Story 1

- [X] T028 [P] [US1] Component test: queue row renders a `requiresHumanReview` badge and the "needs review" filter narrows the visible rows — new/updated test alongside `frontend/components/migration/review-queue-table.tsx` (RED before T032/T033)

### Implementation for User Story 1

- [X] T029 [P] [US1] Add `ocrQuality`, `metadata.confidence.*`, `requiresHumanReview`, `ocrQualityConfidence` fields to `MigrationReviewQueueItem` in `frontend/types/migration.ts` (data-model.md, contracts/migration-review-queue.openapi.yaml)
- [X] T030 [P] [US1] Add `requiresHumanReview` and `sortBy`/`sortOrder` query params to `getReviewQueue` in `frontend/lib/services/migration.service.ts`
- [X] T031 [US1] Pass through the new params in `useMigrationReviewQueue` — `frontend/hooks/use-migration-review.ts` (depends on T030)
- [X] T032 [US1] Render `requiresHumanReview` badge + `ocrQualityConfidence` indicator per row in `frontend/components/migration/review-queue-table.tsx` (depends on T029)
- [X] T033 [US1] Add "needs review" filter control and sort-by-OCR-quality control to `review-queue-table.tsx` header (depends on T031)
- [X] T034 [US1] Render legacy (pre-refactor) items as an unreviewable "re-extract required" row state with a re-extract action (existing `POST /migration/queue/:publicId/re-extract` endpoint) in `review-queue-table.tsx` — UI reflects the server-side guard from T014; this is a UX affordance, not the enforcement point (FR-011) (depends on T029)

**Checkpoint**: User Story 1 fully functional and independently testable — reviewer can triage the queue without opening items.

---

## Phase 4: User Story 2 - Reviewer distinguishes "hard to read" from "hard to classify" (Priority: P2)

**Goal**: Opening a flagged item explains *why* it was flagged, with OCR readability and per-field metadata confidence shown as clearly separate diagnostics.

**Independent Test**: Open a detail page for a flagged item; confirm OCR quality confidence/issues and metadata field confidence render as distinct, independently-labeled sections.

### Tests for User Story 2

- [X] T035 [P] [US2] Component test: detail page renders `ocrQuality` and `metadata.confidence` as separate labeled sections, never merged — test alongside `frontend/app/(admin)/admin/migration/review/[id]/page.tsx` (RED before T037/T038)

### Implementation for User Story 2

- [X] T036 [P] [US2] Replace the free-text category input with a dropdown sourced from `correspondence_types` (existing `useCorrespondenceTypes` hook / `GET /master/correspondence-types`) in `frontend/app/(admin)/admin/migration/review/[id]/page.tsx` (FR-005) — dropdown constrains the *input*; the T017 backend check remains the actual enforcement point
- [X] T037 [US2] Render the `ocrQuality` section (confidence + `issues[]` with type/message/evidence) as a distinct block from metadata confidence **and** from the existing `aiIssues` business-validation list (do not merge or relabel `aiIssues` — it stays a separate section, per FR-009 and `/106-speckit-analyze` finding I1) in `review/[id]/page.tsx` (depends on T036)
- [X] T038 [US2] Render per-field `metadata.confidence.{summary,category,tags}` badges separately in `review/[id]/page.tsx` (depends on T037)
- [X] T039 [US2] Add per-field edit/acknowledge resolution controls (for `ocrQuality`/`summary`/`category`) wired into the `fieldAcknowledgments` commit payload (FR-013/FR-014) (depends on T038)
- [X] T040 [US2] Surface the `422 unresolvedFields` commit error (and the new `category`-invalid error from T017) as inline per-field warnings in `review/[id]/page.tsx` (depends on T039)

**Checkpoint**: User Story 2 fully functional and independently testable — reviewer can diagnose why an item was flagged and act on each field.

---

## Phase 5: User Story 3 - Reviewer accepts or rejects each suggested tag individually (Priority: P3)

**Goal**: Reviewer accepts/rejects each AI-suggested tag on its own, sees the supporting evidence, and has rejections recorded.

**Independent Test**: Open an item with several suggested tags (mixed new/existing), accept some and reject others, submit, and confirm only accepted tags apply while rejections are recorded with reviewer/evidence.

### Tests for User Story 3

- [X] T041 [P] [US3] Component test: rejecting a tag excludes it from the submitted `tagDecisions[]` payload while accepted tags remain — test alongside `review/[id]/page.tsx` tag section (RED before T043/T044)

### Implementation for User Story 3

- [X] T042 [P] [US3] Render suggested tags as chips showing name, `isNew` badge, and evidence tooltip in `review/[id]/page.tsx` (FR-006)
- [X] T043 [US3] Add accept/reject control per tag chip with local decision state (depends on T042)
- [X] T044 [US3] Replace the `tags: string[]` commit payload with `tagDecisions[]` in the commit call in `frontend/lib/services/migration.service.ts` (data-model.md §6) (depends on T043)
- [X] T045 [US3] Wire tag review completion into the `tags` field's resolution state so reviewing tags satisfies the "tags" commit-gate requirement (FR-014) (depends on T044, T039)

**Checkpoint**: User Story 3 fully functional and independently testable — reviewer can accept/reject tags with a full audit trail.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T046 [P] Verify no hardcoded Thai/English strings were introduced in any changed frontend component — wire remaining literals to the i18n keys added in T004
- [X] T047 [P] Update existing frontend/backend test fixtures and mocks that still reference the old `aiConfidence`/`extractedTags`/`tags: string[]` shapes
- [ ] T048 Manually walk `quickstart.md` steps 1-9 and record pass/fail per step
- [X] T049 Run CANDIDATE_CHECKS (`pnpm --filter backend test`, `pnpm --filter frontend build`) and update `ai-ledger.md` with results; update Checkpoints table (CP-2)
- [X] T050 Finalize `ai-ledger.md` Terminal Status (`FINAL_STATUS`, residual risks) before handoff/PR

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately.
- **Foundational (Phase 2)**: Depends on Setup (needs T001-T002 schema delta and T003 prompt content) — **BLOCKS all user stories**.
- **User Stories (Phase 3-5)**: All depend on Foundational (Phase 2) completion (checkpoint after T027). Independently testable and deliverable once Foundational is done; can proceed in parallel if staffed.
- **Polish (Phase 6)**: Depends on all desired user stories being complete.

### User Story Dependencies

- **US1 (P1)**: No dependency on US2/US3 — the queue list only needs the fields Foundational already produces.
- **US2 (P2)**: No hard dependency on US1, but naturally follows it (detail page is reached from the queue list). Shares the commit-gate resolution mechanism (T039) that US3 also plugs into (T045).
- **US3 (P3)**: Depends on T039 (US2) for the shared field-resolution wiring pattern, but is otherwise a self-contained addition to the same detail page.

### Within Each Phase

- Tests are written first and must FAIL before their paired implementation task.
- Entity/types before service logic; service logic before controller/query changes; backend before dependent frontend tasks.

### Parallel Opportunities

- T002, T003, T004 (Setup) — different files, run in parallel.
- T005, T006 (Foundational entity/types) — different files, run in parallel.
- T020-T026 (Foundational tests) — different test files/cases, run in parallel.
- T029, T030 (US1 frontend types/service) — different files, run in parallel.
- T035 (US2 test) can be written in parallel with T028 (US1 test) and T041 (US3 test) since they touch different components.

---

## Parallel Example: Foundational Phase

```bash
# Launch foundational tests together (write first, confirm RED):
Task: "Unit test requiresHumanReview threshold usage in migration.service.spec.ts"
Task: "Unit test processLegacyAiEnrichment prompt routing in ai-batch.processor.spec.ts"
Task: "Unit test schema-invalid output handling in ai-batch.processor.spec.ts"
Task: "Unit test legacy-item server-side rejection in migration.service.spec.ts / migration-review.service.spec.ts"
Task: "Unit test commit gate unresolvedFields in migration-review.service.spec.ts"
Task: "Unit test invalid-category commit rejection in migration-review.service.spec.ts"
Task: "Unit test tagDecisions audit trail in migration-review.service.spec.ts"

# Launch entity/type tasks together:
Task: "Extend migration-review-queue.entity.ts with new columns"
Task: "Define ai-extraction-details.type.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup.
2. Complete Phase 2: Foundational (**critical — blocks everything**; this is also where the breaking `CommitMigrationReviewDto` change, the `processLegacyAiEnrichment` governance fix, and the two server-side validation gates (T014, T017) land).
3. Complete Phase 3: User Story 1.
4. **STOP and VALIDATE**: Walk quickstart.md steps 1-4 independently.
5. Deploy/demo if ready — reviewers already get the highest-leverage triage capability.

### Incremental Delivery

1. Setup + Foundational → backend contract complete and gated (server-side, not just UI-side).
2. Add US1 → validate independently → deploy (MVP).
3. Add US2 → validate independently → deploy.
4. Add US3 → validate independently → deploy.
5. Polish (Phase 6) → final ledger checkpoint → handoff/PR.

**Note on coordinated deploy**: Per ADR-050 Consequences, the `CommitMigrationReviewDto` change (`tags[]` → `tagDecisions[]`, landing across Foundational T015-T018 and US3 T044) is a breaking change — backend and the frontend commit call (T044) must ship in the same deploy, even though US1/US2 frontend work can ship incrementally ahead of US3.
