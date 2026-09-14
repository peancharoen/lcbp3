// File: specs/200-fullstacks/256-queue-metadata-separation/research.md
// Change Log:
// - 2026-09-14: Phase 0 research — all decisions resolved via ADR-054 + clarify session
// - 2026-09-14: Sync with code-traced megaplan — R1/R4/R5/R6 amended; R10 added (legacy ai-module path in scope)

# Research: Migration Review Queue Metadata Separation

All material decisions were resolved in ADR-054 (D1–D10, confirmed with user 2026-09-14) plus the spec clarify session (Q1–Q3). This file consolidates them into implementation-ready decisions.

## R1: Where each data class lives (ADR-054 D1/D2/D9)

- **Decision**: Ingestion metadata → real columns (`storage_temp_path`, `original_filename` — both already exist in schema, currently unmapped/unused). AI output → `ai_metadata_json` (`ocrQuality`, `metadata.*`, `aiFailureReason`, `compareResult`, `capturedThresholds`). Review state → new `review_state_json` column (`fieldResolutions` + `fieldAcknowledgments`, per planning clarify P2). Ingestion keys with no dedicated column (`original_row_index`, `unresolved_orgs`, `original_document_number`, `revision_number`) stay in `details` as whitelisted residual keys.
- **Rationale**: Ownership-aligned storage — each writer owns exactly one location; resetting AI output cannot destroy human decisions or ingestion data.
- **Alternatives considered**: 3 JSON columns (rejected — ingestion data is stable + queryable, belongs in real columns); whitelist-only reset (kept as defense-in-depth, not as the primary mechanism).

## R2: PDF path resolution order (ADR-054 D1 + D4)

- **Decision**: Extractor resolves PDF path as: `queueItem.storageTempPath` → fallback `attachments.file_path` via `tempAttachmentIds[0]`. No fallback to `details.source_file_path` (dead after restart; ADR-054 explicitly rejects keeping it).
- **Rationale**: `attachments` is the source of truth for the actual file; queue metadata loss no longer causes spurious NO_PDF.
- **Alternatives considered**: filesystem search by `document_number` (rejected — slow/unreliable); no fallback (rejected — was the incident).
- **Note**: existing recursive-search fallback for filename-only paths (migration.service.ts D330 block, ~L1892-1925) stays — it operates on the resolved path, not the JSON bag.

## R3: `ocr_text_bak` snapshot policy (ADR-054 D5, amended by clarify Q2)

- **Decision**: Before overwriting non-empty `ocr_text`, copy it to `ocr_text_bak` — **except** when the current value is a known failure placeholder, in which case keep the existing bak (it holds the last real text). Placeholder detection: exact-match against the exported constant(s) used by the extractor for NO_PDF/OCR_FAILED placeholder strings.
- **Rationale**: prevents cascading failure — a failed re-extract followed by another re-extract must not overwrite the good backup with a placeholder.
- **Alternatives considered**: always-snapshot (ADR literal — rejected by user, loses last good copy on repeat failure); write-once-if-empty (rejected — bak goes stale on legitimate re-extractions).

## R4: API response shape + restore path (clarify Q1 + Q3)

- **Decision**: Queue-item responses expose `storageTempPath`, `originalFilename`, and `reviewState` (incl. `fieldResolutions`/`fieldAcknowledgments`) as first-class fields; `details` contains AI output + residual ingestion keys + transient `attachments[]` enrichment. Frontend types and review pages updated to match. Restore is a guarded endpoint `POST /migration/queue/:publicId/restore-ocr-text` (`JwtAuthGuard` + `RbacGuard` + `@RequirePermission('migration.commit')`, same pattern as `PATCH queue/:publicId/ocr`) + button on the review detail page, visible only when `ocr_text_bak` is non-empty; restore does not clear bak. Detail endpoint exposes full `ocrTextBak`; list endpoint MAY send a presence flag only (LONGTEXT payload size).
- **Rationale**: explicit fields are self-documenting and keep `details` honest (AI output only); per-item restore UX is materially better than manual SQL during an active migration review.
- **Alternatives considered**: merge-back response shape (rejected by user); manual-SQL-only restore (rejected by user).

## R5: Re-extract reset scope (ADR-054 D3 + D9)

- **Decision**: `reExtractQueueItem` resets `ai_metadata_json` (rebuilt via whitelist of residual ingestion keys — `original_row_index`, `unresolved_orgs`, `original_document_number`, `revision_number`) plus the AI-derived flat columns (`ocrText`, `aiSummary`, `aiSuggestedCorrespondenceType`, `extractedTags`, `aiConfidence`, `aiIssues`, `requiresHumanReview`, `ocrQualityConfidence`, `reviewReason`, status→PENDING). It MUST NOT touch `storageTempPath`, `originalFilename`, `reviewState`, `ocrTextBak`, `tempAttachmentIds`. Whitelist preservation is applied to the bag as defense-in-depth even though post-D9 the bag holds AI output + residual ingestion keys only.
- **Rationale**: after D9, whole-bag reset is safe by construction; whitelist is belt-and-suspenders only.
- **Alternatives considered**: blacklist reset (rejected — new AI fields would leak through); per-field reset (rejected — fragile).

## R6: Post-import retention + audit link (ADR-054 D10)

- **Decision**: All three IMPORTED write paths set `imported_correspondence_public_id`: `MigrationService.approveQueueItem`, `MigrationService.approveQueueItemByPublicId`, and `MigrationReviewService.commitRecord` (the latter has `correspondence.publicId` in scope inside its transaction; the former two need `importCorrespondence` extended to return `correspondencePublicId`). The legacy ai-module `approve()` path in `ai-ingest.service.ts` also sets it. No auto-cleanup; deletion only via existing `deleteReviewQueueByBatch`.
- **Rationale**: audit trail + bidirectional lookup; migration is one-time so table growth is bounded.
- **Alternatives considered**: delete-on-import (rejected — loses trail); archive table (rejected — complexity); cron cleanup (rejected — destroys trail).

## R7: Confidence values scope (ADR-054 D7)

- **Decision**: Keep all three stores with defined roles — `ai_confidence` column = alias (min of `metadata.confidence.*`) for legacy queries; `ocr_quality_confidence` column = sortable/filterable truth; `metadata.confidence.*` + `ocrQuality.confidence` in JSON = per-field truth for review UI.
- **Rationale**: removing JSON fields breaks review UI; removing columns forces `JSON_EXTRACT` in filters/sorts.
- **Alternatives considered**: column-only / JSON-only / per-field columns (all rejected in ADR-054).

## R8: Operational protocol + restart mechanics (ADR-054 D8 + delta ordering)

- **Decision**: D8 protocol is documented (quickstart runbook), not code-enforced. Apply order: (1) SQL delta = ALTER + TRUNCATE in one file, run before deploying code; (2) backend deploy; (3) frontend deploy; (4) manual re-ingest from Excel. No backfill.
- **Rationale**: new columns are nullable so old code tolerates them briefly; new code requires the columns, so schema must land first.
- **Alternatives considered**: code-first deploy (rejected — breaks immediately); blue-green with dual-write (rejected — no legacy rows worth protecting post-TRUNCATE).

## R10: Legacy ai-module path + enqueueRecord details persistence (planning clarify P3 + code trace)

- **Decision**: The older ai-module path is in scope. `ai/entities/migration-review.entity.ts` (`MigrationReviewRecord`) maps the same `migration_review_queue` table — it gets the same new column mappings so both paths stay consistent. `ai-ingest.service.ts` `ingest()` writes `storageTempPath`/`originalFilename`; `approve()` sets `importedCorrespondencePublicId`. `MigrationService.enqueueRecord` currently drops `dto.details` entirely — it now merges `dto.details` into `queueItem.details` so `compareResult`/`capturedThresholds`/`disciplineId` passed by `processMigrateDocument` are persisted in `ai_metadata_json` (where they belong per R1). `ai-migration-checkpoint.service.ts` / `ai/services/migration.service.ts` get an audit-only pass.
- **Rationale**: user confirmed the legacy path is in scope (P3); `enqueueRecord` dropping `details` is a latent bug that also explains why the frontend's top-level `compareResult` reads are always undefined.
- **Alternatives considered**: leaving the dormant path unmapped (rejected — two entities on one table with drifting column sets is exactly the failure mode ADR-054 exists to prevent).

## R9: Out of scope confirmations

- `attachments.ocr_text_bak` (former D6): dropped — verified no overwrite path exists (`importCorrespondence` always creates new attachments; `processRagPrepare` is write-once per FR-014/SC-006).
- `ai_issues` column: untouched (has own write path for `NEW_TAG_SUGGESTED`).
- Production re-OCR capability: separate ADR (ADR-055 draft exists).
