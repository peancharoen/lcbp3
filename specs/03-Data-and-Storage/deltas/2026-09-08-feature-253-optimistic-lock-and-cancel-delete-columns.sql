-- File: specs/03-Data-and-Storage/deltas/2026-09-08-feature-253-optimistic-lock-and-cancel-delete-columns.sql
-- Change Log:
-- - 2026-09-08: Create delta to apply Feature 253 ALTER TABLE statements that were
--   added to lcbp3-v1.9.0-schema-02-tables.sql (lines 2019-2061) on 2026-09-06 but
--   never applied to the running DB. This caused "Unknown column 'corr.version' in
--   'SELECT'" errors across correspondences, rfas, transmittals, contract_drawings,
--   shop_drawings, asbuilt_drawings, and circulations list/search endpoints.
-- - 2026-09-08: Fix FK reference — users PK is `user_id` not `id` (schema file bug).

-- Delta: Feature 253 — Optimistic locking (@VersionColumn) + Cancel/Delete support
-- Date: 2026-09-08
-- Related ADR: ADR-002 (Optimistic Locking), ADR-019 (UUID)
-- Related Spec: specs/200-fullstacks/253-unified-doc-crud/spec.md
-- Applied in: v1.9.0 → v1.9.18
-- NOTE: These ALTER TABLE statements already exist in the canonical schema file
--   (lcbp3-v1.9.0-schema-02-tables.sql §21, lines 2019-2061) for fresh installs.
--   This delta applies them to EXISTING databases that were created before 2026-09-06.

-- ============================================================
-- Section 1: correspondences — optimistic lock for metadata patch
-- ============================================================
ALTER TABLE `correspondences`
ADD COLUMN IF NOT EXISTS `version` INT NOT NULL DEFAULT 0 COMMENT 'Optimistic lock version (TypeORM @VersionColumn)';

-- ============================================================
-- Section 2: rfas — optimistic lock for metadata patch
-- ============================================================
ALTER TABLE `rfas`
ADD COLUMN IF NOT EXISTS `version` INT NOT NULL DEFAULT 0 COMMENT 'Optimistic lock version';

-- ============================================================
-- Section 3: transmittals — optimistic lock + cancel support
-- ============================================================
ALTER TABLE `transmittals`
ADD COLUMN IF NOT EXISTS `version` INT NOT NULL DEFAULT 0 COMMENT 'Optimistic lock version',
  ADD COLUMN IF NOT EXISTS `status_id` INT NULL COMMENT 'FK to correspondence_status — DRAFT/SUBMITTED/CANCELLED',
  ADD COLUMN IF NOT EXISTS `cancel_reason` VARCHAR(500) NULL COMMENT 'เหตุผลการยกเลิก',
  ADD COLUMN IF NOT EXISTS `cancelled_at` DATETIME NULL COMMENT 'วันที่ยกเลิก',
  ADD COLUMN IF NOT EXISTS `cancelled_by` INT NULL COMMENT 'ผู้ยกเลิก (FK to users)';

-- FK constraints (separate ALTER for idempotency — MariaDB ไม่มี ADD CONSTRAINT IF NOT EXISTS)
ALTER TABLE `transmittals`
ADD CONSTRAINT `fk_transmittals_status` FOREIGN KEY (`status_id`) REFERENCES `correspondence_status` (`id`) ON DELETE SET NULL;

ALTER TABLE `transmittals`
ADD CONSTRAINT `fk_transmittals_cancelled_by` FOREIGN KEY (`cancelled_by`) REFERENCES `users` (`user_id`) ON DELETE SET NULL;

-- ============================================================
-- Section 4: contract_drawings — optimistic lock + soft-delete tracking
-- ============================================================
ALTER TABLE `contract_drawings`
ADD COLUMN IF NOT EXISTS `version` INT NOT NULL DEFAULT 0 COMMENT 'Optimistic lock version',
  ADD COLUMN IF NOT EXISTS `delete_reason` VARCHAR(500) NULL COMMENT 'เหตุผลการลบ (soft-delete)';

-- ============================================================
-- Section 5: shop_drawings — optimistic lock + soft-delete tracking
-- ============================================================
ALTER TABLE `shop_drawings`
ADD COLUMN IF NOT EXISTS `version` INT NOT NULL DEFAULT 0 COMMENT 'Optimistic lock version',
  ADD COLUMN IF NOT EXISTS `delete_reason` VARCHAR(500) NULL COMMENT 'เหตุผลการลบ (soft-delete)';

-- ============================================================
-- Section 6: asbuilt_drawings — optimistic lock + soft-delete tracking
-- ============================================================
ALTER TABLE `asbuilt_drawings`
ADD COLUMN IF NOT EXISTS `version` INT NOT NULL DEFAULT 0 COMMENT 'Optimistic lock version',
  ADD COLUMN IF NOT EXISTS `delete_reason` VARCHAR(500) NULL COMMENT 'เหตุผลการลบ (soft-delete)';

-- ============================================================
-- Section 7: circulations — optimistic lock + force-close tracking
-- ============================================================
ALTER TABLE `circulations`
ADD COLUMN IF NOT EXISTS `version` INT NOT NULL DEFAULT 0 COMMENT 'Optimistic lock version',
  ADD COLUMN IF NOT EXISTS `force_close_reason` VARCHAR(500) NULL COMMENT 'เหตุผล Force Close';

-- ============================================================
-- Verification queries
-- ============================================================
-- SELECT TABLE_NAME, COLUMN_NAME FROM information_schema.COLUMNS
--   WHERE TABLE_SCHEMA='lcbp3' AND COLUMN_NAME='version'
--   AND TABLE_NAME IN ('correspondences','rfas','transmittals','contract_drawings','shop_drawings','asbuilt_drawings','circulations')
--   ORDER BY TABLE_NAME;
-- -- Expected: 7 rows
--
-- SELECT TABLE_NAME, COLUMN_NAME FROM information_schema.COLUMNS
--   WHERE TABLE_SCHEMA='lcbp3' AND COLUMN_NAME IN ('status_id','cancel_reason','cancelled_at','cancelled_by','delete_reason','force_close_reason')
--   ORDER BY TABLE_NAME, COLUMN_NAME;
-- -- Expected: 8 rows (transmittals: 4, contract_drawings: 1, shop_drawings: 1, asbuilt_drawings: 1, circulations: 1)
