// File: specs/200-fullstacks/256-queue-metadata-separation/quickstart.md
// Change Log:
// - 2026-09-14: Phase 1 quickstart + D8 bulk-operation runbook
// - 2026-09-14: Sync with code trace — known traps updated (residual ingestion keys, legacy ai path, manual OCR snapshot)

# Quickstart: ADR-054 Metadata Separation

## Apply order (strict)

```text
1. SQL delta  →  specs/03-Data-and-Storage/deltas/2026-09-14-adr-054-migration-metadata-separation.sql
                 (ALTER +3 columns, TRUNCATE migration_review_queue — intentional, see ADR-054 note)
2. Backend    →  entity mappings + ingestion writes + processor reads + reset/restore logic
3. Frontend   →  types/migration.ts + review detail page + compare-result-table
4. Manual     →  re-ingest from Excel (no backfill)
```

⚠️ Schema MUST land before backend deploy — new code requires the new columns; old code tolerates them (nullable).

## Verification

```bash
# backend focused tests
cd backend && npx jest src/modules/migration/migration.service.spec.ts \
              src/modules/ai/processors/ai-batch.processor.spec.ts

# frontend focused tests
cd frontend && npx vitest run components/migration/__tests__/

# manual smoke (post-deploy)
# 1. ingest a small Excel batch → confirm storage_temp_path + original_filename populated, details has no source_file_path
# 2. run extraction → details = AI output only; review_state_json NULL until review
# 3. re-extract → ocr_text_bak = previous ocr_text (if real text); review_state_json unchanged
# 4. commit review with fieldResolutions → lands in review_state_json, NOT ai_metadata_json
# 5. approve/import → status=IMPORTED + imported_correspondence_public_id set; row retained
# 6. (admin) POST .../restore-ocr-text → ocr_text = ocr_text_bak; bak retained
```

## D8 Bulk-Operation Protocol (runbook — applies to ANY bulk UPDATE/DELETE >10 rows)

```text
1. BACKUP    CREATE TABLE migration_review_queue_backup_YYYYMMDD AS
             SELECT id, document_number, ai_metadata_json, review_state_json,
                    ocr_text, ocr_text_bak, ai_status
             FROM migration_review_queue WHERE <condition>;
2. PREFLIGHT SELECT ai_metadata_json FROM migration_review_queue
             WHERE <condition> LIMIT 2;   -- inspect actual JSON keys first
3. CANARY    run the operation on ONE row; verify result end-to-end
4. VERIFY    check DB state, file path resolution, queue state, output shape
5. BULK      execute the full batch only after canary passes
6. LOG       record scope + affected row count (operation journal)
7. ROLLBACK  restore from backup table if verification fails:
             UPDATE migration_review_queue q
             JOIN migration_review_queue_backup_YYYYMMDD b ON b.id = q.id
             SET q.ocr_text = b.ocr_text, q.ai_metadata_json = b.ai_metadata_json,
                 q.review_state_json = b.review_state_json;
```

## Emergency OCR restore (manual fallback)

Prefer the UI button / endpoint. Manual SQL only if endpoint unavailable:

```sql
UPDATE migration_review_queue
SET ocr_text = ocr_text_bak
WHERE uuid = '<queue-public-id>' AND ocr_text_bak IS NOT NULL;
```

## Known traps

- `details` no longer contains `source_file_path` / `fieldResolutions` — grep for stale reads before shipping. It DOES still contain whitelisted residual ingestion keys (`original_row_index`, `unresolved_orgs`, `original_document_number`, `revision_number`) and a transient `attachments[]` injected at response serialization.
- Two entities map `migration_review_queue` (`MigrationReviewQueue` + `MigrationReviewRecord` in the ai module) — both must map new columns; both write paths (`LegacyIngestionService` + `ai-ingest.service.ts`) are in scope per FR-014.
- `tempAttachmentId` (singular) is deprecated — always use `tempAttachmentIds[0]` for the PDF fallback.
- Placeholder skip on snapshot uses exact-match against the extractor's placeholder constants — keep the constant list single-sourced (`NO_PDF_OCR_PLACEHOLDER` / `OCR_FAILURE_PLACEHOLDERS` in `migration/constants/migration.constants.ts`).
- Snapshot rule applies to THREE overwrite paths: `updateQueueEnrichment` (all extraction writes funnel here), `reExtractQueueItem` (before nulling), and `updateQueueOcr` (manual edit).
- `importCorrespondence` return must carry `correspondencePublicId` — three IMPORTED write paths depend on it.
