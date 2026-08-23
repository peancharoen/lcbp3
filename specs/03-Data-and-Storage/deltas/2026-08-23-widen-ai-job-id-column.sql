-- Delta: Widen ai_job_id column in migration_review_queue (ADR-047 bugfix)
-- Date: 2026-08-23
-- Related ADR: ADR-047 (Native Backend Legacy Ingestion)
-- Related Bug: AI_PARSE_ERROR / "Data too long for column 'ai_job_id'" on every row
--   during Legacy Ingestion (Start Ingest) and Start Extract.
--
-- Root cause: ai_job_id was VARCHAR(36) (sized for a bare UUID), but the code
-- assigns BullMQ's *custom* jobId, which is much longer than a UUID:
--   - Batch ingestion:  `legacy-enrich-<publicId>`                          (~50 chars)
--   - Single extract:   `legacy-enrich-<publicId>-<idempotencyKey>`        (up to ~110 chars)
-- Every row that enqueues a `legacy-ai-enrichment` job then fails to save the
-- queue item back (MariaDB strict mode → truncation error), which the generic
-- per-row catch block in LegacyIngestionService mislabels as AI_PARSE_ERROR.
-- ------------------------------------------------------------
-- Schema changes
-- ------------------------------------------------------------
ALTER TABLE `migration_review_queue`
  MODIFY COLUMN `ai_job_id` VARCHAR(150) NULL COMMENT 'BullMQ Job ID สำหรับงานประมวลผล AI (custom jobId เช่น legacy-enrich-<publicId>-<idempotencyKey> ยาวเกิน UUID เปล่า — ADR-047 bugfix 2026-08-23)';

-- ------------------------------------------------------------
-- Verification query
-- ------------------------------------------------------------
-- SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH FROM information_schema.COLUMNS
-- WHERE TABLE_SCHEMA = 'lcbp3' AND TABLE_NAME = 'migration_review_queue' AND COLUMN_NAME = 'ai_job_id';
