// File: specs/200-fullstacks/250-ai-metadata-extraction-contract/validation-report.md
// Change Log:
// - 2026-08-31: Post-implementation validation for ADR-050 / 250-ai-metadata-extraction-contract

# Validation Report: AI Metadata Extraction Output Contract

**Date**: 2026-08-31
**Status**: PARTIAL
**Feature Path**: `specs/200-fullstacks/250-ai-metadata-extraction-contract`

## Executive Summary

Implementation coverage is complete at the code/test level. All 14 functional requirements and 4 edge cases from `spec.md` have corresponding implementation and at least one test. The `ai-ledger.md` is in `complete` status and all but one Phase 6 task are verified. Status is `PARTIAL` because the manual `quickstart.md` walkthrough (T048) and the live `ai_prompts` prompt application (T003 operational half) remain unverified in this session.

## Coverage Summary

| Metric                  | Count | Percentage |
| ----------------------- | ----- | ---------- |
| Requirements Covered    | 14/14 | 100%       |
| Acceptance Criteria Met | 12/12 | 100%       |
| Edge Cases Handled      | 4/4   | 100%       |
| Tests Present           | 14/14 | 100%       |
| TDD Evidence Recorded   | 7/7 backend behavior tasks + 3/3 story tests | 100% |

> Coverage is well above the 80% threshold, but the feature is not production-ready until the residual gaps below are closed.

## Contract Compliance

| Item                                               | Status     | Notes |
| -------------------------------------------------- | ---------- | ----- |
| Ledger exists                                      | Yes        | `specs/200-fullstacks/250-ai-metadata-extraction-contract/ai-ledger.md` |
| Ledger STATUS                                      | complete   | T048 manual walk excluded by capability-honesty contract |
| Checkpoints complete                               | Yes        | CP-2 through CP-6 verified; CP-1 blocked but recovered inline |
| TDD evidence links                                 | Yes        | RED→GREEN recorded for T020–T026 (backend) and frontend regression tests (CP-5/CP-6) |
| Protected boundaries crossed without authorization | No         | No deploy, merge, migration execution, or production auth changes performed |

## Requirement → Implementation Mapping

| Requirement | Acceptance Criteria / Edge Case | Implementation File(s) | Tests |
| ----------- | ------------------------------- | ---------------------- | ----- |
| FR-001 | Distinct `ocrQuality` and per-field `metadata.confidence` | `backend/src/modules/migration/types/ai-extraction-details.type.ts`, `backend/src/modules/migration/entities/migration-review-queue.entity.ts`, `frontend/types/migration.ts` | T020, T035 |
| FR-002 | Server-computed `requiresHumanReview` ignores LLM value | `backend/src/modules/migration/migration.service.ts` (`computeRequiresHumanReview`, `updateQueueEnrichment`) | T020 |
| FR-003 | Filter queue by `requiresHumanReview` | `backend/src/modules/migration/dto/migration-queue-query.dto.ts`, `backend/src/modules/migration/migration.service.ts` `getReviewQueue`, `frontend/components/migration/review-queue-table.tsx` | T019, T028 |
| FR-004 | Sort queue by OCR quality | `backend/src/modules/migration/dto/migration-queue-query.dto.ts`, `backend/src/modules/migration/migration.service.ts` `getReviewQueue`, `frontend/components/migration/review-queue-table.tsx` | T019, T028 |
| FR-005 | Category restricted to `correspondence_types.typeCode` | `backend/src/modules/migration/migration.service.ts` `getAllowedCategoryCodes`, `backend/src/modules/migration/migration-review.service.ts` category commit gate | T007, T017, T025 |
| FR-006 | Tags shown with `name`, `isNew`, evidence | `frontend/app/(admin)/admin/migration/review/[id]/page.tsx`, `frontend/types/migration.ts`, `backend/src/modules/migration/types/ai-extraction-details.type.ts` | T041, T042 |
| FR-007 | Accept/reject each tag independently | `backend/src/modules/migration/dto/commit-migration-review.dto.ts` `TagDecisionDto`, `frontend/app/(admin)/admin/migration/review/[id]/page.tsx` | T026, T041 |
| FR-008 | Rejected tag audit trail | `backend/src/modules/migration/migration-review.service.ts` `recordTagRejectionAudit`, `backend/src/modules/ai/entities/ai-audit-log.entity.ts` | T026 |
| FR-009 | `aiIssues` and `ocrQuality.issues` remain distinct | `backend/src/modules/migration/types/ai-extraction-details.type.ts`, `frontend/app/(admin)/admin/migration/review/[id]/page.tsx` | T037 |
| FR-010 | Schema-invalid AI output flagged, not silently stored | `backend/src/modules/ai/processors/ai-batch.processor.ts` `validateExtractionOutput` | T022 |
| FR-011 | Legacy items unreviewable until re-extract; server-side guard | `backend/src/modules/migration/migration.service.ts` `isLegacyExtractionShape`, `getQueueItemByPublicId`, `backend/src/modules/migration/migration-review.service.ts` | T023, T014 |
| FR-012 | Category/tags committed only after human review | `backend/src/modules/migration/migration-review.service.ts` `commitRecord` commit gate + `linkTagToCorrespondence` | T024, T026 |
| FR-013 | Commit blocked while `requiresHumanReview` unresolved | `backend/src/modules/migration/migration-review.service.ts` `computeUnresolvedFields`, `UnresolvedFieldsException` | T024 |
| FR-014 | Resolution tracked per triggering field | `backend/src/modules/migration/migration-review.service.ts` `computeUnresolvedFields`, `fieldAcknowledgments` handling, `frontend/app/(admin)/admin/migration/review/[id]/page.tsx` | T024, T039, T045 |

### Edge Cases

| Edge Case | Handling |
| --------- | -------- |
| AI output fails schema validation | `ai-batch.processor.ts` returns `null` from `validateExtractionOutput` and sets `aiFailed=true` + `aiFailureReason='SCHEMA_VALIDATION_FAILED'` (FR-010) |
| Legacy items with pre-ADR-050 `details` | `isLegacyExtractionShape` returns `true`; `getQueueItemByPublicId` and commit path throw `BusinessException`; frontend shows re-extract affordance (FR-011) |
| OCR produced no readable text | `validateExtractionOutput` requires `ocrQuality.confidence` ∈ [0,1]; `computeRequiresHumanReview` defaults `true` when confidence values are missing (spec Edge Case) |
| Tag exists with different casing/spacing | Relies on LLM prompt compliance (`{{existing_tags}}` case-insensitive matching); no backend `tags` table normalization added — logged as accepted risk in `ai-ledger.md` |

## Success Criteria Coverage

| Success Criterion | Status | Evidence |
| ----------------- | ------ | -------- |
| SC-001 | Pass | `review-queue-table.tsx` renders `requiresHumanReview` badge and filter/sort controls (T032/T033, T028) |
| SC-002 | Pass | `review/[id]/page.tsx` renders `ocrQuality` and `metadata.confidence` as separate sections (T037/T038, T035) |
| SC-003 | Pass | Category validated server-side against `correspondence_types.typeCode` at prompt time (T007) and commit time (T017) |
| SC-004 | Pass | Each rejected tag writes `ai_audit_logs` row via `recordTagRejectionAudit` (T026, T041) |
| SC-005 | Pass | Schema-invalid output sets `aiFailed=true` + `aiFailureReason` (T022) |
| SC-006 | Pass | Legacy items rejected server-side on review fetch and commit (T023, T014) |
| SC-007 | Pass | Per-field commit gate blocks commit until all triggering fields resolved/acknowledged (T024, T039, T045) |

## Verification Evidence

| Check | Command / Observation | Result |
| ----- | --------------------- | ------ |
| Backend build (TS) | `pnpm --filter backend build` | Pass (exit 0) |
| Backend migration review tests | `pnpm --filter backend exec jest --config jest.config.js --testPathPatterns=migration-review.service --coverage=false` | 61/61 pass |
| Backend ai-batch tests | `pnpm --filter backend exec jest --config jest.config.js --testPathPatterns=ai-batch.processor --coverage=false` | 38/38 pass |
| Full backend suite (from `ai-ledger.md`) | `pnpm --filter backend test` | 2244/2255 tests, 0 failures (not rerun this session; recorded in CP-6) |
| Full frontend suite (from `ai-ledger.md`) | `npx vitest run` | 996/996 tests, tsc 0 errors (CP-6) |
| SQL delta exists | `specs/03-Data-and-Storage/deltas/2026-08-31-migration-review-queue-human-review-flags.sql` | Present |
| Prompt reference exists | `specs/200-fullstacks/250-ai-metadata-extraction-contract/prompts/ocr_extraction.md` | Present |

## Uncovered Requirements / Residual Gaps

| Item | Status | Notes / Fix |
| ---- | ------ | ----------- |
| T048 manual `quickstart.md` walkthrough | Not executed | Requires running deployed stack (DB + Redis + Ollama + frontend). Not a code gap; must be done before production readiness. |
| T003 live `ai_prompts` application | Pending | Reference file `prompts/ocr_extraction.md` exists; live `ai_prompts` row must be applied by admin/DBA (documented in CP-2). |
| Dead `CATEGORY_ALIAS` map | Non-blocking | Left in `migration-review.service.ts`; cleanup deferred per ledger. |
| `useRejectMigrationReview` uses `id` not `publicId` | Pre-existing | Not introduced by this feature; not fixed in this unit. |
| Manual reconciliation of uncommitted working tree | Open | All changes are uncommitted on `main` per explicit instruction. No commit/push/merge performed. |

## Recommendations

1. **Execute T048**: Run `quickstart.md` steps 1-9 against a live stack (DB + Ollama + frontend) before marking the feature production-ready.
2. **Apply T003**: Insert the `ocr_extraction` prompt version into the live `ai_prompts` table and activate it; coordinate with DBA so the new placeholders (`{{allowed_categories}}`, `{{existing_tags}}`) are available to `processLegacyAiEnrichment`.
3. **Deploy coordination**: Backend and frontend must land together because `CommitMigrationReviewDto` changed from `tags: string[]` to `tagDecisions[]` (breaking DTO).
4. **Cleanup**: Remove the now-dead `CATEGORY_ALIAS` map in `migration-review.service.ts` in a follow-up hygiene pass.
5. **Consider opening a feature branch**: The working tree is large (multiple specs/ADRs + code); committing to `250-ai-metadata-extraction-contract` before final merge is recommended.
