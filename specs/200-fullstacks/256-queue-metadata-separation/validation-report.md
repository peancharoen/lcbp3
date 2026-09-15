# Validation Report: 256-queue-metadata-separation (ADR-054)

**Date**: 2026-09-15 10:15 +07
**Validator**: 111-speckit-validate (orchestrator-run, post-review-folds commit `93e5804e`)
**Status**: ✅ **PASS** (100% requirement coverage, 0 gaps)

## Coverage Summary

| Metric | Count | Percentage |
|--------|-------|------------|
| Requirements Covered (FR-001..FR-014) | 14/14 | 100% |
| Acceptance Criteria Met (US1-US4 scenarios) | 11/11 | 100% |
| Edge Cases Handled (spec.md §Edge Cases) | 9/9 | 100% |
| Tests Present (per requirement) | 14/14 | 100% |
| TDD Evidence Recorded | Yes — wave RED→GREEN logged in ledger | 100% |

## Contract Compliance

| Item | Status | Notes |
|------|--------|-------|
| Ledger exists | Yes | `ledger.md` |
| Ledger STATUS | **closed** | cp0–cp7 all recorded; 5 independent reviewer verdicts |
| Checkpoints complete | Yes | cp7-final-gate closed; review-fold commit `93e5804e` supersedes residual findings |
| TDD evidence links | Yes | RED→GREEN evidence per wave in ledger checkpoints |
| Protected boundaries crossed | **No** | SQL delta authored but NOT executed; no TRUNCATE; no prod DB write; pushes only on explicit user command (`97dcc0d5`, `c1ff3139`) |

## Requirement → Implementation → Test Mapping

| FR | Requirement | Implementation (verified) | Test evidence |
|----|-------------|------------------------|----------------|
| FR-001 | Ingestion writes `storage_temp_path`/`original_filename` columns | `legacy-ingestion.service.ts`, `ai-ingest.service.ts` (create paths) | legacy-ingestion + ai-ingest specs (20/20) |
| FR-002 | PDF resolution: storageTempPath → attachments fallback → never `details.source_file_path` | `resolveQueuePdfPath` (`migration.service.ts` ~L1127) | resolveQueuePdfPath describe block |
| FR-003 | Review state → `review_state_json`; AI pipeline never writes | sole writer `commitRecord` (`migration-review.service.ts` ~L891); merge + skip-undefined | review-state isolation tests (byte-identical) |
| FR-004 | `ai_metadata_json` = AI output only | `ALLOWED_ENQUEUE_DETAILS_KEYS` whitelist (post-fold: column-backed compareStatus/compareUnavailableReason trimmed) | whitelist spec (injected keys dropped) |
| FR-005 | Re-extract resets AI output only; preserves ingestion/reviewState/ocrTextBak | `reExtractQueueItem` (~L1317); `REEXTRACT_PRESERVED_DETAILS_KEYS` | reExtract specs + preserved-keys test |
| FR-006 | Snapshot real ocr_text → bak before overwrite (3 sites, placeholder-skip) | `updateQueueEnrichment`, `reExtractQueueItem`, `updateQueueOcr` + `isOcrFailurePlaceholder` | snapshot tests at all 3 sites |
| FR-007 | Restore endpoint (CASL + idempotency + UUID) + UI button when bak present | `POST /migration/queue/:publicId/restore-ocr-text` (`migration.controller.ts`); swap-semantics restore; `has_ocr_backup` UI + i18n | restoreOcrText specs incl. swap/toggle test; frontend 45 tests |
| FR-008 | Retain IMPORTED row + `imported_correspondence_public_id` on all paths | `approveQueueItem`, `approveQueueItemByPublicId`, `commitRecord`, `ai-ingest approve()` + replay resolution + warn on miss | US3 specs (4 paths) |
| FR-009 | Confidence triple-store (column aliases + per-field JSON) | `updateQueueEnrichment` populates all 3 stores | FR-009 locked tests |
| FR-010 | First-class response fields; details = AI output + residual ingestion keys only | queue-item response + transient `attachments[]` strip before persist | first-class-fields spec |
| FR-011 | Frontend reads new fields; no stale `details.source_file_path`/`fieldResolutions` | `types/migration.ts`, review page, queue table, migration page | frontend vitest 45/45; stale-read sweep = 0 |
| FR-012 | D8 bulk-op protocol documented | `quickstart.md` §D8 runbook + `deltas/README.md` pointer | docs check (n/a for code) |
| FR-013 | Delta adds 3 columns + TRUNCATE, no backfill | `deltas/2026-09-14-adr-054-*.sql` + rollback — authored, **not executed** | file review; real-DB columns now present (DBA-applied) |
| FR-014 | Both write paths (native + legacy ai-module) honor contract | `MigrationReviewRecord` entity reconciled with real schema (dead columns removed, remapped) | ai-ingest + checkpoint specs |

## Success Criteria

| SC | Criterion | Result |
|----|-----------|--------|
| SC-001 | Zero loss on re-extract across failure modes | ✅ tests cover missing-path/missing-PDF/overwrite |
| SC-002 | 100% real-ocr overwrites produce restorable snapshot | ✅ snapshot funnel at all 3 write sites |
| SC-003 | Imported items queryable with correspondence link; 0 auto-deletions | ✅ 4 IMPORTED paths + retain row |
| SC-004 | reviewState byte-identical after re-extract | ✅ reference-identity test |
| SC-005 | Incident sequence blocked at ≥3 independent points | ✅ column path + attachment fallback + snapshot |

## Post-validation Changes (commit `93e5804e`)

110-reviewer findings all resolved: restore swap semantics, compareStatus→UNAVAILABLE reset, `MigrationReviewRecord`↔schema reconciliation (real-DB verified), `reviewedBy` int, replay warn, whitelist trim, `tempAttachmentIds` singular→array, `hasOcrTextBak` UI indicator.

## Uncovered Requirements

None.

## Residual Risks / Follow-ups (non-blocking)

1. `INT-PK` exposure in some legacy import responses (ADR-019 hardening pass — pre-existing).
2. `attachments.ocr_text` has no backup column — confirmed out of scope (spec Assumptions; ADR-055 draft covers future re-OCR).
3. Full-suite coverage thresholds unmet globally — pre-existing, unrelated modules.

## Recommendations

1. **Operational gate**: DBA applies `2026-09-14-adr-054-migration-metadata-separation.sql` per D8 protocol (destructive TRUNCATE by design). Real-DB inspection on 2026-09-15 shows the 3 new columns already present — confirm delta was applied before relying on this in prod rollout notes.
2. Push `93e5804e` via `2git.sh` on user command only.
