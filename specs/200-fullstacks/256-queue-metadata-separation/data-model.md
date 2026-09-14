// File: specs/200-fullstacks/256-queue-metadata-separation/data-model.md
// Change Log:
// - 2026-09-14: Phase 1 data model for ADR-054
// - 2026-09-14: Sync with code trace — review_state_json stores fieldResolutions + fieldAcknowledgments;
//   residual ingestion keys enumerated; commitRecord added as IMPORTED writer; manual OCR edit snapshots

# Data Model: Migration Review Queue Metadata Separation

## Ownership Matrix (authoritative)

| Data | Storage | Written by | Reset on re-extract? |
|------|---------|-----------|----------------------|
| `storage_temp_path`, `original_filename`, `temp_attachment_ids` | Real columns | `LegacyIngestionService` (ingest) | ❌ Never |
| `original_row_index`, `unresolved_orgs`, `original_document_number`, `revision_number` | `details` (whitelisted ingestion keys — no dedicated columns, per ADR-054 D3 preservedFields) | `LegacyIngestionService` (ingest) | ❌ Never (preserved across reset) |
| `ocrQuality`, `metadata.*`, `aiFailureReason`, `compareResult`, `capturedThresholds` | `ai_metadata_json` | `AiBatchProcessor` | ✅ Yes (whole bag) |
| `fieldResolutions`, `fieldAcknowledgments` | `review_state_json` (new) | `MigrationReviewService.commitRecord` | ❌ Never |
| `ocr_text` | `ocr_text` column | `AiBatchProcessor` / manual edit (`updateQueueOcr`) | ✅ Reset to NULL, after snapshot |
| last real `ocr_text` | `ocr_text_bak` (new) | snapshot-on-overwrite (extraction + manual edit) | ❌ Never |
| `imported_correspondence_public_id` | new column | `MigrationService.approve*` / `MigrationReviewService.commitRecord` / `ai-ingest approve` | ❌ Never |
| `attachments[]` | transient — injected into `details` at response serialization by `enrichWithAttachments` | `MigrationService` (read-time only) | n/a (not persisted) |

## Entity: `migration_review_queue` (deltas only)

```text
+ review_state_json                  JSON      NULL  -- D9: { fieldResolutions, fieldAcknowledgments }
+ ocr_text_bak                       LONGTEXT  NULL  -- D5: last real OCR text before overwrite
+ imported_correspondence_public_id  VARCHAR(36) NULL -- D10: audit link to correspondences.public_id
~ storage_temp_path                  VARCHAR(1000)    -- existing column, NOW MAPPED in entity + written at ingest
~ original_filename                  VARCHAR(500)     -- existing column, NOW MAPPED in entity + written at ingest
~ ai_metadata_json                   JSON             -- contract narrowed: AI output only
```

Existing columns kept unchanged: `ocr_text`, `ai_confidence` (alias), `ocr_quality_confidence` (promoted), `ai_suggested_correspondence_type`, `extracted_tags`, `ai_issues`, `requires_human_review`, `review_reason`, `reviewed_by`, `reviewed_at`, `ai_status`, `ai_job_id`, `ai_failed`, `status`.

## Type changes

```typescript
// ai-extraction-details.type.ts
// REMOVE from MigrationAiExtractionDetails:
//   fieldResolutions?: FieldResolutionState;   // moves to ReviewState
//   source_file_path / attachment_ids          // move to columns / temp_attachment_ids
// KEEP (residual ingestion keys — still live in details, no dedicated column):
//   original_row_index / unresolved_orgs / original_document_number / revision_number

// NEW type:
interface MigrationReviewState {
  fieldResolutions?: FieldResolutionDto[];        // per-field accept/reject/source decisions
  fieldAcknowledgments?: AcknowledgeableField[];  // low-confidence acknowledgments (ADR-050)
}
```

`FieldResolutionState` shape is unchanged (Feature 242 contract) — only its storage location moves.

## Entity mappings (TypeORM)

```text
storageTempPath                  → storage_temp_path
originalFilename                 → original_filename
ocrTextBak                       → ocr_text_bak
reviewState                      → review_state_json   (type: MigrationReviewState | null)
importedCorrespondencePublicId   → imported_correspondence_public_id
details                          → ai_metadata_json    (AI output + whitelisted residual ingestion keys)
```

Both entities mapped to `migration_review_queue` MUST map the new columns:
`migration/entities/migration-review-queue.entity.ts` (`MigrationReviewQueue`) AND
`ai/entities/migration-review.entity.ts` (`MigrationReviewRecord` — legacy ai-module path).

## State transitions affected

| Transition | Writer | Guard |
|-----------|--------|-------|
| PENDING → RUNNING(extract) → PENDING_REVIEW | `AiBatchProcessor` | BullMQ `ai-batch` |
| PENDING/PENDING_REVIEW → PENDING (re-extract) | `MigrationService.reExtractQueueItem` | resets `ai_metadata_json` (whitelist-preserve residual ingestion keys) + AI flat columns incl. `requiresHumanReview`/`ocrQualityConfidence`/`reviewReason`; snapshots `ocr_text`→`ocr_text_bak` (skip if placeholder); never touches `review_state_json`/ingestion columns |
| PENDING_REVIEW → IMPORTED | `MigrationService.approveQueueItem` / `approveQueueItemByPublicId` / `MigrationReviewService.commitRecord` (3 write paths) | all set `imported_correspondence_public_id`; record retained |
| any → any (manual OCR edit) | `MigrationReviewService.updateQueueOcr` | snapshots `ocr_text`→`ocr_text_bak` before overwrite (same placeholder-skip rule) |
| any → any (restore) | `MigrationService.restoreOcrText` | requires non-empty `ocr_text_bak`; writes bak→`ocr_text`; bak kept |
| * → deleted | `deleteReviewQueueByBatch` only | manual, scoped (batchId / all / publicIds) |

## Validation rules

- `imported_correspondence_public_id` must equal `correspondences.public_id` of the created record (UUID string, no parseInt).
- Snapshot rule: write `ocr_text_bak` only when current `ocr_text` is non-empty AND not equal to a known failure-placeholder constant — applies to extraction overwrites AND manual edits (`updateQueueOcr`) AND the `reExtractQueueItem` reset.
- Restore rule: reject (BusinessException `MIGRATION_NO_BACKUP`) when `ocr_text_bak` is NULL/empty.
- `review_state_json` must never be written by `AiBatchProcessor` (asserted by code review + test: extraction run leaves the column byte-identical).
