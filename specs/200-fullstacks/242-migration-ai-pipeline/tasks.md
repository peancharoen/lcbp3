// File: specs/200-fullstacks/242-migration-ai-pipeline/tasks.md
// Change Log:
// - 2026-08-06: Initial task list for Migration AI Pipeline Refactor

# Tasks: Migration AI Pipeline Refactor

**Input**: Design documents from `/specs/200-fullstacks/242-migration-ai-pipeline/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/, quickstart.md

**Tests**: Not explicitly requested in the feature specification. Test tasks are included for backend unit/integration coverage per Tier 2 (80% business logic, 70% backend overall).

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions (v1.9.0)

- **Backend (NestJS)**: `backend/src/`
- **Frontend (Next.js)**: `frontend/app/` (App Router) + `frontend/src/`
- **Specs (Hybrid)**: `specs/200-fullstacks/242-migration-ai-pipeline/`
- **Schema Deltas**: `specs/03-Data-and-Storage/deltas/`
- Paths assume standard LCBP3 mono-repo structure.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Schema delta, prompt seed, threshold seed, and shared type definitions

- [ ] T001 Create ADR-009 schema delta file with `migration_review_queue` columns (`temp_attachment_ids JSON`, `compare_status ENUM`, `compare_unavailable_reason VARCHAR`) and composite index `idx_migration_review_compare_status` in `specs/03-Data-and-Storage/deltas/2026-08-06-migration-multi-attachment-and-compare.sql`
- [ ] T002 [P] Create `migration_compare` prompt seed SQL (INSERT into `ai_prompts` with template, `field_schema`, placeholders `{{ocr_text}}`, `{{excel_metadata}}`, `{{ocr_truncated}}`) in `specs/03-Data-and-Storage/deltas/2026-08-06-migration-multi-attachment-and-compare.sql`
- [ ] T003 [P] Create `system_settings` seed rows for `MIGRATION_MAX_MISMATCH_FIELDS` (default `3`) and `MIGRATION_MIN_CONFIDENCE` (default `0.6`) in `specs/03-Data-and-Storage/deltas/2026-08-06-migration-multi-attachment-and-compare.sql`
- [ ] T004 [P] Create `CompareResult` and `CompareFieldResult` types with typed parser guard in `backend/src/modules/ai/types/migration-compare-result.type.ts`
- [ ] T005 [P] Create `FieldResolution` type (`field`, `source: 'EXCEL'|'DOCUMENT'|'MANUAL'`, `finalValue`) in `backend/src/modules/ai/types/migration-compare-result.type.ts`
- [ ] T006 [P] Create `ExcelMetadata` DTO with 9 register fields (`documentNumber` required, rest optional `string`) in `backend/src/modules/ai/dto/excel-metadata.dto.ts`
- [ ] T007 [P] Create `ReviewThresholdSetting` read model type (`maxMismatchFields`, `minConfidence`) in `backend/src/modules/migration/types/review-threshold.type.ts`
- [ ] T008 [P] Create `TagMappingRule` static constant (discipline→`discipline:`, correspondenceType→`type:`) in `backend/src/modules/migration/types/tag-mapping-rule.ts`
- [ ] T009 [P] Create shared DWG exclusion constant (MIME list + `.dwg`/`.dxf` extension fallback) in `backend/src/modules/migration/constants/dwg-exclusion.constant.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Entity changes, DTO modifications, and threshold service that ALL user stories depend on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T010 Modify `MigrationReviewQueue` entity: add `tempAttachmentIds` (JSON, `@Exclude()`), `compareStatus` (enum, default `COMPARED`), `compareUnavailableReason` (nullable), deprecate `tempAttachmentId` in `backend/src/modules/migration/entities/migration-review-queue.entity.ts`
- [ ] T011 Add `CompareStatus` enum (`COMPARED`, `UNAVAILABLE`) in `backend/src/modules/migration/entities/migration-review-queue.entity.ts`
- [ ] T012 [P] Create `ReviewThresholdService` (read `system_settings`, Redis cache `migration:thresholds` TTL 60s, `DEL` on update, validation min/max) in `backend/src/modules/migration/services/review-threshold.service.ts`
- [ ] T013 [P] Modify `ImportCorrespondenceDTO` to accept `tempAttachmentIds: number[]` and `sourceFilePaths: string[]` alongside legacy `tempAttachmentId` in `backend/src/modules/migration/dto/import-correspondence.dto.ts`
- [ ] T014 [P] Modify `EnqueueMigrationDTO` to accept `tempAttachmentIds`, `compareResult`, `compareStatus` in `backend/src/modules/migration/dto/enqueue-migration.dto.ts`
- [ ] T015 [P] Modify `CommitMigrationReviewDTO` to accept `fieldResolutions: FieldResolution[]` in `backend/src/modules/migration/dto/commit-migration-review.dto.ts`
- [ ] T016 [P] Create `ResolveBatchDTO` (optional `batchId: string`) in `backend/src/modules/migration/dto/resolve-batch.dto.ts`
- [ ] T017 [P] Create `TriggerRagBatchDTO` (optional `batchId: string`) in `backend/src/modules/migration/dto/trigger-rag-batch.dto.ts`
- [ ] T018 Add `resolveAttachmentIds()` private helper to `MigrationReviewService` (returns `tempAttachmentIds ?? [tempAttachmentId]`) in `backend/src/modules/migration/migration-review.service.ts`
- [ ] T019 Modify `FileStorageService` whitelist to verify full FR-004 file type set: PDF, DOCX, DWG, XLSX, ZIP (add any missing MIME types) in `backend/src/common/file-storage/file-storage.service.ts`
- [ ] T020 Modify `MigrationModule` imports to include `AiQueueModule` and register new services in `backend/src/modules/migration/migration.module.ts`

**Checkpoint**: Foundation ready — schema applied, entities/dtos updated, threshold service available. User story implementation can now begin.

---

## Phase 3: User Story 1 — ผู้ตรวจสอบเห็นความไม่ตรงกันระหว่างทะเบียนกับเอกสารจริง (Priority: P1) 🎯 MVP

**Goal**: Replace `ocr_extraction` with `migration_compare` prompt; persist OCR text; show per-field compare results in the review queue with threshold-based grouping and per-field source selection

**Independent Test**: นำเข้าเอกสาร 20 ฉบับ (5 ฉบับข้อมูลไม่ตรงกัน) → คิวตรวจสอบแสดง 5 ฉบับที่ไม่ตรง และไม่แจ้งผิดพลาดในอีก 15 ฉบับ

### Tests for User Story 1

- [ ] T021 [P] [US1] Unit test: `CompareResult` parser guard accepts valid LLM output and rejects malformed JSON in `backend/src/modules/ai/types/migration-compare-result.type.spec.ts`
- [ ] T022 [P] [US1] Unit test: `ReviewThresholdService` reads defaults, caches in Redis, invalidates on update in `backend/src/modules/migration/services/review-threshold.service.spec.ts`
- [ ] T023 [P] [US1] Unit test: `reviewGroup` classification logic reads from **captured thresholds** in `ai_metadata_json` (not current `system_settings`), verifying that a threshold change does NOT retroactively reclassify an existing record (FR-010c) in `backend/src/modules/migration/migration-review.service.spec.ts`

### Implementation for User Story 1

- [ ] T024 [US1] Modify `processMigrateDocument()` in `ai-batch.processor.ts`: replace `getActive('ocr_extraction')` with `getActive('migration_compare')`, inject `excelMetadata` + `{{ocr_text}}` + `{{ocr_truncated}}` placeholders, parse via `CompareResult` guard. **Capture current threshold values** (`maxMismatchFields`, `minConfidence` from `ReviewThresholdService`) into `ai_metadata_json` alongside `CompareResult` at processing time (FR-010c — ensures threshold changes never retroactively reclassify existing records). Write `CompareResult` (or raw LLM response on failure) to `ai_audit_logs.ai_suggestion_json` (FR-028)
- [ ] T025 [US1] Modify `processMigrateDocument()`: persist `ocrResult.text` to `attachments.ocr_text` (mirror `processRagPrepare()` pattern), skip for DWG/textless files in `backend/src/modules/ai/processors/ai-batch.processor.ts`
- [ ] T026 [US1] Modify `processMigrateDocument()`: on compare failure (OCR fail, text too short, LLM unparseable), set `compareStatus = UNAVAILABLE` with Thai reason, still enqueue to review queue (FR-012a) in `backend/src/modules/ai/processors/ai-batch.processor.ts`
- [ ] T027 [US1] Modify `processMigrateDocument()`: delete Tag/UUID resolution block (lines ~1222–1334) — store raw register values only (FR-016) in `backend/src/modules/ai/processors/ai-batch.processor.ts`
- [ ] T028 [US1] Modify `AiService.submitMigrationJob()`: carry `excelMetadata` in job payload in `backend/src/modules/ai/ai.service.ts`
- [ ] T029 [US1] Modify `MigrationReviewService.enqueueRecord()`: accept `tempAttachmentIds[]`, `compareResult`, `compareStatus`, `compareUnavailableReason`, `capturedThresholds` (snapshot of `maxMismatchFields` + `minConfidence` at processing time); mirror `[0]` to legacy `tempAttachmentId`; persist `capturedThresholds` into `ai_metadata_json` alongside `compareResult` (FR-010c) in `backend/src/modules/migration/migration-review.service.ts`
- [ ] T030 [US1] Add `reviewGroup` computed property to review-queue read model — compute from **captured thresholds** stored in `ai_metadata_json` at processing time (NOT from current `system_settings`), so threshold changes never retroactively reclassify existing records (FR-010c). MANUAL_REVIEW if UNAVAILABLE, mismatches > captured `maxMismatchFields`, or confidence < captured `minConfidence`; else READY_TO_CONFIRM in `backend/src/modules/migration/migration-review.service.ts`
- [ ] T031 [US1] Modify review-queue list endpoint: support `compareStatus` filter (FR-012d) and `reviewGroup` filter (`READY_TO_CONFIRM`/`MANUAL_REVIEW` per contract), return `attachments[]` with `publicId` + `hasOcrText` + `isMainDocument`, return `compareResult` + `reviewGroup`. Apply same response shape changes to single-item GET endpoint `/migration/review-queue/{publicId}` in `backend/src/modules/migration/migration.controller.ts`
- [ ] T032 [US1] Modify `MigrationReviewService.commitRecord()`: validate `fieldResolutions[]`, reject `source='DOCUMENT'` when `foundInDocument=false` (FR-011c), persist resolutions to `ai_audit_logs.human_override_json` (R7) in `backend/src/modules/migration/migration-review.service.ts`
- [ ] T033 [US1] Add `GET /api/migration/review-thresholds` endpoint (admin-only, returns current `maxMismatchFields` + `minConfidence` + `updatedAt`) and `PATCH /api/migration/review-thresholds` endpoint (admin-only, `Idempotency-Key`, validates ranges, `DEL migration:thresholds` on update, audit log change with `updated_by` + old/new values) in `backend/src/modules/migration/migration.controller.ts`
- [ ] T034 [P] [US1] Create `compare-field-table.tsx` component: per-field 3-way source selector (EXCEL/DOCUMENT/MANUAL), register value preselected, "use document" hidden when `foundInDocument=false` in `frontend/app/(dashboard)/migration/review/_components/compare-field-table.tsx`
- [ ] T035 [P] [US1] Create `compare-unavailable-badge.tsx` component: "เปรียบเทียบไม่ได้" indicator with reason text in `frontend/app/(dashboard)/migration/review/_components/compare-unavailable-badge.tsx`
- [ ] T036 [US1] Modify `migration/review/page.tsx`: filter by `compareStatus` (FR-012d), render `compare-field-table` + `compare-unavailable-badge`, i18n keys only in `frontend/app/(dashboard)/migration/review/page.tsx`
- [ ] T037 [P] [US1] Create `admin/migration-settings/page.tsx`: threshold configuration form (both thresholds, validation, admin-only 403 for non-admin) in `frontend/app/(dashboard)/admin/migration-settings/page.tsx`
- [ ] T038 [US1] Add i18n keys for all new UI strings (field source labels, compare-unavailable badge, threshold labels, batch summary) in `frontend/messages/th/migration.json` and `frontend/messages/en/migration.json`

**Checkpoint**: User Story 1 fully functional — compare results visible in review queue, per-field source selection works, thresholds configurable. This is the MVP.

---

## Phase 4: User Story 2 — Correspondence หนึ่งฉบับมีไฟล์แนบหลายไฟล์ (Priority: P1)

**Goal**: Support linking N attachments to one Correspondence Revision via `correspondence_revision_attachments` junction table; first file is main document

**Independent Test**: นำเข้า Correspondence 1 ฉบับพร้อมไฟล์ 3 ประเภท → ไฟล์ทั้ง 3 ผูกกับ Correspondence เดียวกัน และมีเอกสารหลัก 1 ไฟล์

### Tests for User Story 2

- [ ] T039 [P] [US2] Unit test: `resolveAttachmentIds()` returns array from `tempAttachmentIds`, falls back to `[tempAttachmentId]`, returns `[]` for empty in `backend/src/modules/migration/migration-review.service.spec.ts`
- [ ] T040 [P] [US2] Unit test: commit with missing attachment ID returns 400 with Thai `userMessage` in `backend/src/modules/migration/migration-review.service.spec.ts`

### Implementation for User Story 2

- [ ] T041 [US2] Modify `MigrationReviewService.commitRecord()`: link N attachments via `correspondence_revision_attachments` junction, set `is_main_document=1` for element `[0]`, validate all IDs exist (Edge Case: missing attachment) in `backend/src/modules/migration/migration-review.service.ts`
- [ ] T042 [US2] Modify review-queue list response: return `attachments[]` array with `publicId`, `originalFilename`, `mimeType`, `hasOcrText`, `isMainDocument` (FR-005) in `backend/src/modules/migration/migration-review.service.ts`
- [ ] T043 [P] [US2] Create `attachment-list.tsx` component: multi-attachment display with file type icons in `frontend/app/(dashboard)/migration/review/_components/attachment-list.tsx`
- [ ] T044 [US2] Modify `migration/review/page.tsx`: render `attachment-list` for each queue item in `frontend/app/(dashboard)/migration/review/page.tsx`

**Checkpoint**: User Stories 1 AND 2 both work independently. Multi-attachment upload and display functional.

---

## Phase 5: User Story 4 — ข้อมูลอ้างอิงถูกเชื่อมโยงครบหลังนำเข้า (Priority: P2)

**Goal**: Batch SQL endpoint that resolves register-derived org/type/discipline values to system reference data and creates/links tags from register fields only

**Independent Test**: นำเข้าเอกสาร 100 ฉบับโดยยังไม่เชื่อมโยง → รัน batch → ทุกฉบับมีหน่วยงานและประเภทเอกสารเชื่อมโยงครบ

> **Note**: US4 is prioritized before US3 because it is on the critical path for SC-004 (per F1 in research.md — removing per-doc Tag/UUID resolution is the main performance lever).

### Tests for User Story 4

- [ ] T045 [P] [US4] Unit test: `MetadataResolutionService` resolves org/type/discipline by name, reports unresolved values (FR-019) in `backend/src/modules/migration/services/metadata-resolution.service.spec.ts`
- [ ] T046 [P] [US4] Unit test: tag creation from `TagMappingRule` is deterministic and idempotent (`INSERT IGNORE` / `ON DUPLICATE KEY UPDATE`) in `backend/src/modules/migration/services/metadata-resolution.service.spec.ts`

### Implementation for User Story 4

- [ ] T047 [US4] Create `MetadataResolutionService`: set-based SQL resolution of org/type/discipline by register value, scope by `batchId` or all pending (FR-020a), report per-item failures with unresolved value (FR-019) in `backend/src/modules/migration/services/metadata-resolution.service.ts`
- [ ] T048 [US4] Implement tag creation in `MetadataResolutionService`: derive tag names from `TagMappingRule` (discipline→`discipline:VALUE`, type→`type:VALUE`), `INSERT IGNORE` into `correspondence_tags` with `is_ai_suggested=0` (FR-018, FR-018a, R7), idempotent via PK in `backend/src/modules/migration/services/metadata-resolution.service.ts`
- [ ] T049 [US4] Create `POST /api/migration/resolve-batch` endpoint: admin-only (`system.manage_all`), `Idempotency-Key` required (FR-029), returns `{ succeeded, skipped, failed, failures[] }` in `backend/src/modules/migration/migration.controller.ts`
- [ ] T050 [US4] Add runtime guard: if batch exceeds the configured timeout (default 30s, sourced from `system_settings` key `MIGRATION_RESOLVE_BATCH_TIMEOUT_MS` with fallback to 30000), log warning and recommend promoting to `ai-batch` queue (Complexity Tracking deviation) in `backend/src/modules/migration/services/metadata-resolution.service.ts`

**Checkpoint**: Reference data resolution batch functional. SC-004 performance lever delivered.

---

## Phase 6: User Story 3 — เอกสารที่นำเข้าแล้วค้นหาเชิงความหมายได้ (Priority: P2)

**Goal**: Batch endpoint that enqueues `rag-prepare` jobs for committed attachments with persisted OCR text, skipping DWG and already-embedded files

**Independent Test**: นำเข้าเอกสาร 100 ฉบับ → รัน batch → ค้นหาด้วยคำที่ไม่ตรงตัว → พบเอกสารเก่าที่นำเข้ามา

### Tests for User Story 3

- [ ] T051 [P] [US3] Unit test: `RagBatchService` candidate query skips DWG (MIME + extension), skips `ai_processing_status='DONE'`, skips empty `ocr_text` in `backend/src/modules/migration/services/rag-batch.service.spec.ts`
- [ ] T052 [P] [US3] Unit test: re-run with new `Idempotency-Key` reports `alreadyEmbedded` count, `enqueued=0` (FR-025) in `backend/src/modules/migration/services/rag-batch.service.spec.ts`

### Implementation for User Story 3

- [ ] T053 [US3] Create `RagBatchService`: query RAG candidates per data-model §8.1 (DISTINCT, `ocr_text IS NOT NULL`, `is_temporary=0`, `ai_processing_status <> 'DONE'`, DWG exclusion), scope by `batchId` or all pending (FR-026a), enqueue `rag-prepare` BullMQ jobs (concurrency=1, FR-024) in `backend/src/modules/migration/services/rag-batch.service.ts`
- [ ] T054 [US3] Create `POST /api/migration/trigger-rag-batch` endpoint: admin-only, `Idempotency-Key` required, returns `202` with `{ enqueued, skipBreakdown: { noTextLayer, alreadyEmbedded, noOcrText }, batchId }` (FR-026b). Check for active import batches (status `PENDING`/`PROCESSING`) and include `warning: 'IMPORT_IN_PROGRESS'` in response when applicable (spec edge case: warn and recommend running after import completes) in `backend/src/modules/migration/migration.controller.ts`
- [ ] T055 [US3] Verify `rag-prepare` worker reuses persisted `ocr_text` (FR-014, SC-006) — no re-OCR call to sidecar for files with stored text in `backend/src/modules/ai/processors/ai-batch.processor.ts`

**Checkpoint**: All user stories independently functional. Semantic search batch operational.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Batch UI, audit verification, forbidden-pattern scan, and quickstart validation

- [ ] T056 [P] Create `batch-run-summary.tsx` component: success/skip/fail counts per batch run (FR-026b) in `frontend/app/(dashboard)/migration/review/_components/batch-run-summary.tsx`
- [ ] T057 Modify `migration/review/page.tsx`: render `batch-run-summary` after batch operations in `frontend/app/(dashboard)/migration/review/page.tsx`
- [ ] T058 [P] Add audit log entry for threshold changes (FR-010d: `updated_by`, old/new values) in `backend/src/modules/migration/services/review-threshold.service.ts`
- [ ] T059 [P] Verify `correspondence_tags.is_ai_suggested = 0` for all register-derived tags (R7 correctness fix) in `backend/src/modules/migration/services/metadata-resolution.service.ts`
- [ ] T060 Update `ai-batch.processor.spec.ts`: add test cases for compare + persist + no-tag-resolution paths in `backend/src/modules/ai/processors/ai-batch.processor.spec.ts`
- [ ] T061 Run forbidden-pattern scan: `grep -rn "parseInt\|Number(" backend/src/modules/migration backend/src/modules/ai | grep -i "uuid\|publicId"` and `grep -rn ": any\|console\.log" backend/src/modules/migration backend/src/modules/ai` — all must return empty
- [ ] T062 Run `npx tsc --noEmit` and `npm run lint` in `backend/` — zero errors
- [ ] T063 Run `npx tsc --noEmit` and `npm run lint` in `frontend/` — zero errors
- [ ] T064 Run quickstart.md validation steps 1–12 end-to-end, including FR-030 verification: confirm semantic search results are isolated by `projectPublicId` for migrated documents (verify via Qdrant query with and without project filter)
- [ ] T065 Run backend test coverage: `npm test -- --coverage --collectCoverageFrom='src/modules/migration/**'` — verify ≥70% overall, ≥80% business logic

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion (T001–T009) — BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends on Foundational — MVP, highest priority
- **User Story 2 (Phase 4)**: Depends on Foundational — can run in parallel with US1 after foundation
- **User Story 4 (Phase 5)**: Depends on Foundational — can run in parallel with US1/US2; prioritized before US3 per F1 (SC-004 critical path)
- **User Story 3 (Phase 6)**: Depends on Foundational + US2 (needs committed attachments with `ocr_text`)
- **Polish (Phase 7)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Depends on Foundational only — no dependencies on other stories
- **User Story 2 (P1)**: Depends on Foundational only — independent of US1 except T044 which modifies the same file as T036 (`migration/review/page.tsx`) and must follow T036 sequentially
- **User Story 4 (P2)**: Depends on Foundational only — independent of US1/US2; needs committed records but the batch endpoint itself doesn't require compare results
- **User Story 3 (P2)**: Depends on Foundational + US2 (attachments must be committed and have `ocr_text` persisted)

### Within Each User Story

- Types/DTOs before services
- Services before controllers/endpoints
- Backend before frontend
- Core implementation before integration
- Story complete before moving to next priority

### Parallel Opportunities

- All Setup tasks marked [P] can run in parallel (T002–T009)
- All Foundational tasks marked [P] can run in parallel (T012–T017)
- Once Foundational completes, US1 and US2 can start in parallel (different files)
- US4 can start in parallel with US1/US2 after Foundational
- Frontend components within a story marked [P] can run in parallel (T034, T035, T043)
- Test tasks within a story marked [P] can run in parallel

---

## Parallel Example: User Story 1

```bash
# Launch all types/DTOs for User Story 1 together:
Task: T004 "Create CompareResult types in migration-compare-result.type.ts"
Task: T005 "Create FieldResolution type in migration-compare-result.type.ts"
Task: T006 "Create ExcelMetadata DTO in excel-metadata.dto.ts"

# Launch all frontend components for User Story 1 together:
Task: T034 "Create compare-field-table.tsx"
Task: T035 "Create compare-unavailable-badge.tsx"
Task: T037 "Create admin/migration-settings/page.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (schema delta, prompt seed, types)
2. Complete Phase 2: Foundational (entity, DTOs, threshold service)
3. Complete Phase 3: User Story 1 (compare prompt, OCR persist, review queue, frontend)
4. **STOP and VALIDATE**: Run quickstart.md steps 1–6 independently
5. Deploy/demo if ready

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Deploy/Demo (MVP!)
3. Add User Story 2 → Test independently → Multi-attachment works
4. Add User Story 4 → Test independently → Batch resolution works (SC-004 delivered)
5. Add User Story 3 → Test independently → Semantic search works
6. Polish → Full feature complete

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 1 (compare + review queue UI)
   - Developer B: User Story 2 (multi-attachment commit + display)
   - Developer C: User Story 4 (batch resolution service + endpoint)
3. After US2 commits: Developer C picks up User Story 3 (RAG batch)
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
- US4 is ordered before US3 because F1 (research.md) identifies batch resolution as the SC-004 critical path
