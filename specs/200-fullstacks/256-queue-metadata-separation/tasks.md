// File: specs/200-fullstacks/256-queue-metadata-separation/tasks.md
// Change Log:
// - 2026-09-14: Initial task breakdown for ADR-054 implementation
// - 2026-09-14: Sync with code-traced megaplan — fix restore route/guard; reviewState adds fieldAcknowledgments;
//   add tasks for legacy ai-module path (FR-014), commitRecord (3rd IMPORTED path), updateQueueOcr snapshot,
//   enqueueRecord details persistence, importCorrespondence publicId return; reExtract flat-column list completed

# Tasks: Migration Review Queue Metadata Separation + OCR Text Protection

**Input**: Design documents from `/specs/200-fullstacks/256-queue-metadata-separation/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/queue-item-api.md, quickstart.md

**Tests**: INCLUDED — spec Success Criteria require automated proof of data-loss prevention (SC-001–SC-005); TDD evidence required per `_LCBP3-CONTRACTS.md` for all behavior changes.

**Ledger**: `ledger.md` exists (Tier 3 migration work) — checkpoint tasks included.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: parallelizable (different files, no blocking dependency)
- **[Story]**: US1–US4 map to spec.md user stories

---

## Phase 1: Setup

**Purpose**: Schema delta authoring (execution is a protected boundary — authored only, run by operator)

- [X] T001 Author SQL delta `specs/03-Data-and-Storage/deltas/2026-09-14-adr-054-migration-metadata-separation.sql` per `specs/03-Data-and-Storage/deltas/README.md` rules — idempotent `ALTER TABLE migration_review_queue ADD COLUMN IF NOT EXISTS` for `ocr_text_bak` LONGTEXT, `review_state_json` JSON, `imported_correspondence_public_id` VARCHAR(36); `TRUNCATE migration_review_queue`; header comment cites ADR-054 + intentional-discard note (D8 exception documented); companion `.rollback.sql` per directory convention (DROP columns — TRUNCATE rows are unrecoverable, note that). ALSO: update canonical `lcbp3-v1.9.0-schema-02-tables.sql` (add 3 columns — schema file is updated FIRST per README rule 1) and `03-01-data-dictionary.md` entries. DO NOT execute.

---

## Phase 2: Foundational (Blocking Prerequisites)

**⚠️ CRITICAL**: Entity + type contract must land before any story work

- [X] T002 Map new/existing columns in `backend/src/modules/migration/entities/migration-review-queue.entity.ts` — add `storageTempPath` (storage_temp_path), `originalFilename` (original_filename), `ocrTextBak` (ocr_text_bak), `reviewState` (review_state_json, type `MigrationReviewState | null`), `importedCorrespondencePublicId` (imported_correspondence_public_id); update `details` docblock (AI output + residual ingestion keys + transient attachments). ALSO map `ocrTextBak`/`reviewState`/`importedCorrespondencePublicId` on `backend/src/modules/ai/entities/migration-review.entity.ts` (`MigrationReviewRecord` — same table, FR-014)
- [X] T003 [P] Update `backend/src/modules/migration/types/ai-extraction-details.type.ts` — remove `fieldResolutions`, `source_file_path`, `attachment_ids` from AI-output type (moved to reviewState / columns / `temp_attachment_ids`); KEEP `original_row_index`, `unresolved_orgs`, `original_document_number`, `revision_number` (residual ingestion keys still live in `details`); add exported `MigrationReviewState` type (`{ fieldResolutions?: FieldResolutionDto[]; fieldAcknowledgments?: AcknowledgeableField[] }` — reusing types from `dto/commit-migration-review.dto.ts` or structural equivalents)
- [X] T004 Single-source OCR failure placeholder in `backend/src/modules/migration/constants/migration.constants.ts` — `export const NO_PDF_OCR_PLACEHOLDER = 'ไม่มี ไฟล์ PDF (ยกเลิก/ถอน)'`, `OCR_FAILURE_PLACEHOLDERS` list, `isOcrFailurePlaceholder(v)` helper; replace the 3 hardcoded strings in `backend/src/modules/ai/processors/ai-batch.processor.ts` (~L2473, L2495, L2595) — required by snapshot-skip rule (R3)
- [X] T005 Write ingestion metadata to columns in `backend/src/modules/migration/services/legacy-ingestion.service.ts` (~L387-415) — set `storageTempPath = resolvedPdfPath || rawFileName` + `originalFilename = basename(resolvedPdfPath) || rawFileName` on the queue item; `details` keeps `{ unresolved_orgs, original_row_index, original_document_number, revision_number }`; stop writing `details.source_file_path`; `attachment_ids` duplicates `temp_attachment_ids` column — do not write it
- [X] T006 Persist `dto.details` in `MigrationService.enqueueRecord` (`backend/src/modules/migration/migration.service.ts` ~L770-843) — `queueItem.details = { ...(existing ?? {}), ...(dto.details ?? {}) }` so `compareResult`/`capturedThresholds`/`disciplineId` from `processMigrateDocument` land in `ai_metadata_json` (currently dropped entirely — latent bug)
- [X] T007 [FR-014] Legacy ai-path ingestion writes in `backend/src/modules/ai/ai-ingest.service.ts` `ingest()` — set `storageTempPath` (from the stored attachment file path) + `originalFilename` (`file.originalname`) on created `MigrationReviewRecord`s

**Checkpoint**: New columns mapped on BOTH entities; ingestion writes land in columns on both paths; `details` holds AI output + residual ingestion keys only.

---

## Phase 3: User Story 1 — Re-extract without data loss (Priority: P1) 🎯 MVP

**Goal**: Re-extraction can never destroy OCR text, file path, or review state; prior OCR text is always recoverable.

**Independent Test**: Queue an item with real OCR text; trigger re-extract under missing-path / missing-PDF / extraction-failure modes; verify path survives, fallback finds the attachment file, `ocr_text_bak` holds the last real text, and restore endpoint returns it.

### Tests (write first — RED)

- [X] T008 [P] [US1] Add failing tests in `backend/src/modules/ai/processors/ai-batch.processor.spec.ts` — (a) snapshot happens inside `updateQueueEnrichment` for all write paths that funnel through it (single-doc, batch phase-1 interim ~L2602, batch phase-2 ~L2712, failure path ~L2494); (b) placeholder constant used at all write sites; (c) `persistLegacyEnrichmentResult` never writes `reviewState`
- [X] T009 [P] [US1] Add failing tests in `backend/src/modules/migration/migration.service.spec.ts` — (a) `reExtractQueueItem` preserves `storageTempPath`/`originalFilename`/`reviewState`/`ocrTextBak` + residual `details` keys while clearing AI output; (b) `resolveQueuePdfPath` falls back to `attachments.file_path` via `tempAttachmentIds[0]`; (c) `restoreOcrText` writes bak→`ocr_text`, keeps bak, rejects `MIGRATION_NO_BACKUP` when empty; (d) `updateQueueOcr` snapshots before manual overwrite

### Implementation

- [X] T010 [US1] PDF path resolution in `backend/src/modules/migration/migration.service.ts` — new private `resolveQueuePdfPath(queueItem)`: `storageTempPath` → fallback `Attachment.filePath` via `tempAttachmentIds[0]` (`dataSource.manager.findOne(Attachment, { where: { id }, select: ['filePath'] })`); replace `details.source_file_path` reads in `startExtractQueueItem` (~L1044-1049) and `startExtractBatch` loop (~L1265-1269) — fallback resolves at ENQUEUE time (job payload is frozen)
- [X] T011 [US1] Snapshot-on-overwrite in `backend/src/modules/migration/migration.service.ts` `updateQueueEnrichment` (~L957) — before writing new `ocrText` over a non-empty current value, copy current to `ocrTextBak` unless `isOcrFailurePlaceholder(current)`; single funnel covers all extraction write paths
- [X] T012 [US1] Reset scope in `backend/src/modules/migration/migration.service.ts` `reExtractQueueItem` (~L1137-1190) — snapshot `ocrText`→`ocrTextBak` before nulling; rebuild `details` via whitelist `{ original_row_index, unresolved_orgs, original_document_number, revision_number }` (drop all AI output keys); reset `requiresHumanReview=false`, `ocrQualityConfidence=null`, `reviewReason=null` alongside the existing flat-column resets; never write `reviewState`, `ocrTextBak` beyond snapshot, or ingestion columns
- [X] T013 [US1] Snapshot manual OCR edits in `backend/src/modules/migration/migration-review.service.ts` `updateQueueOcr` (~L161-186) — before `queueItem.ocrText = dto.ocrText`, apply the same snapshot rule (non-empty + not placeholder) via the shared helper
- [X] T014 [US1] Add `restoreOcrText(publicId, userId)` in `backend/src/modules/migration/migration.service.ts` — guard `MIGRATION_NO_BACKUP` BusinessException (Thai `userMessage` + recovery, ADR-007) when bak empty; write bak→`ocr_text`; retain bak; log actor; return `{ publicId, ocrTextLength, restored: true }`
- [X] T015 [US1] Add endpoint `POST /migration/queue/:publicId/restore-ocr-text` in `migration.controller.ts` (beside `PATCH queue/:publicId/ocr` ~L635) — `JwtAuthGuard` + `RbacGuard` + `@RequirePermission('migration.commit')`, `Idempotency-Key` required, `ParseUUIDPipe`
- [X] T016 [US1] Add "กู้คืน OCR เดิม" action in `frontend/app/(admin)/admin/migration/review/[id]/page.tsx` near `OcrTextEditor` — visible only when `ocrTextBak` non-empty; confirm dialog; TanStack Query mutation + invalidate queue-item query; i18n keys (no hardcoded text). Add `restoreQueueOcrText(publicId, idempotencyKey)` to `frontend/lib/services/migration.service.ts`
- [X] T017 [US1] Update assurance ledger checkpoint (US1 scope, verification evidence) in `specs/200-fullstacks/256-queue-metadata-separation/ledger.md`

---

## Phase 4: User Story 2 — Review state isolation (Priority: P1)

**Goal**: Human review decisions live in `review_state_json`; AI re-processing can never overwrite them.

**Independent Test**: Record `fieldResolutions`/`fieldAcknowledgments` on an item → re-extract → assert `review_state_json` byte-identical and `ai_metadata_json` regenerated; frontend renders resolutions from `reviewState`.

### Tests (write first — RED)

- [X] T018 [P] [US2] Add failing tests in `backend/src/modules/migration/migration.service.spec.ts` (or review spec) — `commitRecord` with `fieldResolutions`+`fieldAcknowledgments` persists them to `review_state_json` not `ai_metadata_json`; re-extract leaves `review_state_json` unchanged; queue-item GET response exposes `storageTempPath`/`originalFilename`/`reviewState`/`ocrTextBak`/`importedCorrespondencePublicId` as first-class fields with `source_file_path`/`fieldResolutions` absent from `details`
- [X] T019 [P] [US2] Update `frontend/components/migration/__tests__/review-detail-page.test.tsx` + `review-queue-table.test.tsx` — fixtures use `reviewState.fieldResolutions` and `storageTempPath` (assert old `details.*` reads gone); add restore-button render/behavior test

### Implementation

- [X] T020 [US2] Persist review decisions in `backend/src/modules/migration/migration-review.service.ts` `commitRecord` (~L859, inside queryRunner tx) — `queueItem.reviewState = { ...(existing ?? {}), fieldResolutions: dto.fieldResolutions, fieldAcknowledgments: dto.fieldAcknowledgments }` (skip undefined keys); this is a NEW write path — today they only reach the revision audit trail (~L743); never write them into `details`
- [X] T021 [US2] Ensure `AiBatchProcessor`/`updateQueueEnrichment` never writes `review_state_json` in `backend/src/modules/ai/processors/ai-batch.processor.ts` + `migration.service.ts` — details payload carries AI output only (`ocrQuality`, `metadata.*`, `aiFailureReason`, `compareResult`, `capturedThresholds`); also assert all three confidence stores remain populated per FR-009 (`ai_confidence` alias column, `ocr_quality_confidence` column, `metadata.confidence.*`/`ocrQuality.confidence` in JSON)
- [X] T022 [US2] Update `frontend/types/migration.ts` — add `storageTempPath`, `originalFilename`, `ocrTextBak`, `reviewState` (`{ fieldResolutions?, fieldAcknowledgments? }`), `importedCorrespondencePublicId`; remove `fieldResolutions` from `MigrationAiExtractionDetails` (~L122); keep residual ingestion keys
- [X] T023 [US2] Update reads in `frontend/app/(admin)/admin/migration/review/[id]/page.tsx` + `frontend/components/migration/compare-result-table.tsx` — `item.storageTempPath` (not `details.source_file_path`, ~L416-417), `item.reviewState?.fieldResolutions` (not `details.fieldResolutions`); `getOcrQuality`/`getMetadataConfidence`/`getTagSuggestions(item.details)` stay (AI output); pass `item.details?.compareResult`/`item.details?.capturedThresholds` to `CompareResultTable` (~L464-466 — currently read top-level, always undefined until T006 persists them)
- [X] T024 [US2] Update assurance ledger checkpoint (US2 scope) in `specs/200-fullstacks/256-queue-metadata-separation/ledger.md`

---

## Phase 5: User Story 3 — Import audit trail (Priority: P2)

**Goal**: Imported items retained with a direct link to the created Correspondence.

**Independent Test**: Approve a queue item → row remains with status IMPORTED + `imported_correspondence_public_id` = new correspondence publicId; reverse lookup works; only manual delete removes it.

### Tests (write first — RED)

- [X] T025 [P] [US3] Add failing test in `backend/src/modules/migration/migration.service.spec.ts` — all three paths (`approveQueueItem`, `approveQueueItemByPublicId`, `commitRecord`) set `importedCorrespondencePublicId`, `reviewedBy`, `reviewedAt`, status IMPORTED; record retained

### Implementation

- [X] T026 [US3] Set `importedCorrespondencePublicId` on all IMPORTED paths — (a) extend `importCorrespondence` success return (~L735) with `correspondencePublicId: correspondence.publicId`; (b) `approveQueueItem` (~L1737) + `approveQueueItemByPublicId` (~L1789) set it from the result; (c) `commitRecord` in `migration-review.service.ts` (~L859) sets it from `correspondence.publicId` in scope; (d) `ai-ingest.service.ts` `approve()` sets `record.importedCorrespondencePublicId` (FR-014)
- [X] T027 [US3] Update assurance ledger checkpoint (US3 scope) in `specs/200-fullstacks/256-queue-metadata-separation/ledger.md`

---

## Phase 6: User Story 4 — Bulk-operation safety protocol (Priority: P2)

**Goal**: D8 protocol is documented and discoverable for operators (convention, not code-enforced).

**Independent Test**: Protocol text exists in `quickstart.md` with backup/canary/rollback SQL; linked from ops entry point.

- [X] T028 [P] [US4] Verify D8 runbook in `specs/200-fullstacks/256-queue-metadata-separation/quickstart.md` and add a pointer to it from the migration ops doc (e.g. `specs/100-Infrastructures/145-server-cli-tools/quickstart.md` or the migration module README — whichever exists)

---

## Phase 7: Polish & Cross-Cutting

- [X] T029 Audit legacy ai-path services (`backend/src/modules/ai/services/migration.service.ts`, `ai-migration-checkpoint.service.ts`) — confirm no writes to `details`/`ocr_text` bypass the snapshot rule; fix if found (FR-014)
- [X] T030 Grep-sweep for stale reads — `details.source_file_path`, `details.fieldResolutions`, `details.attachment_ids` in `backend/src` and `frontend/`; remove all (deprecated `tempAttachmentId` singular must not be referenced by new code)
- [X] T031 [P] Run backend focused tests: `npx jest src/modules/migration/ src/modules/ai/processors/ src/modules/ai/ai-ingest.service.spec.ts` in `backend/`
- [X] T032 [P] Run frontend focused tests: `npx vitest run components/migration/__tests__/` in `frontend/`
- [X] T033 Run builds/lint: `npm run build` + `npm run lint` in `backend/` and `frontend/`; zero `any`, zero `console.log`, Thai business comments
- [X] T034 Finalize ledger terminal status in `specs/200-fullstacks/256-queue-metadata-separation/ledger.md` before handoff

---

## Dependencies

```text
T001 (delta) ─┐
T002 entity ──┤
T003 types ───┤──► Phase 3 (US1) ──┐
T004 consts ──┤                    ├──► Phase 7 polish
T005 ingest ──┤──► Phase 4 (US2) ──┤     (US2 must follow T003 types;
T006 enqueue ─┤──► Phase 5 (US3) ──┘      frontend T022/T023 follow backend contract)
T007 ai-ingest┘
```

- US1 and US2 both touch `migration.service.ts` and `review/[id]/page.tsx` — execute sequentially or coordinate file ownership.
- T006 is independent (same file as T010-T012 — serialize `migration.service.ts` edits).
- US3 depends on Phase 2 entity mapping (T002) + T026(a) ordering inside the task — can run parallel to US1/US2 by a different worker IF `migration.service.ts` ownership is serialized.
- US4 is documentation — fully parallel.

## Parallel Execution Examples

- After Phase 2: `T008` ∥ `T009` ∥ `T018` ∥ `T019` ∥ `T025` ∥ `T028` (all test/doc tasks, different files)
- Backend: `T010`→`T011`→`T012` (same file, sequential); `T013` (review service); `T014`→`T015` (service→controller)

## MVP Scope

Phase 1 + Phase 2 + Phase 3 (US1) — delivers the core guarantee (re-extract cannot lose OCR text/path) and is independently testable without US2–US4.

## Summary

- Total tasks: 34 (incl. 3 ledger checkpoints + finalize)
- Per story: US1 = 10, US2 = 7, US3 = 3, US4 = 1; Setup/Foundational = 7; Polish = 6
- Parallel opportunities: all RED test tasks (T008/T009/T018/T019/T025), T003 ∥ T002-adjacent type work, T028 anytime
- Independent tests: per-story criteria listed in each phase header
