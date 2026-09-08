-- File: specs/03-Data-and-Storage/deltas/2026-09-08-feature-253-optimistic-lock-and-cancel-delete-columns.rollback.sql
-- Change Log:
-- - 2026-09-08: Rollback for Feature 253 optimistic lock + cancel/delete columns

-- ⚠️ Rollback will fail if any row has non-default values in these columns
-- (e.g. version > 0, cancel_reason set, delete_reason set, force_close_reason set)

ALTER TABLE `circulations` DROP COLUMN IF EXISTS `force_close_reason`, DROP COLUMN IF EXISTS `version`;
ALTER TABLE `asbuilt_drawings` DROP COLUMN IF EXISTS `delete_reason`, DROP COLUMN IF EXISTS `version`;
ALTER TABLE `shop_drawings` DROP COLUMN IF EXISTS `delete_reason`, DROP COLUMN IF EXISTS `version`;
ALTER TABLE `contract_drawings` DROP COLUMN IF EXISTS `delete_reason`, DROP COLUMN IF EXISTS `version`;
ALTER TABLE `transmittals` DROP FOREIGN KEY IF EXISTS `fk_transmittals_cancelled_by`;
ALTER TABLE `transmittals` DROP FOREIGN KEY IF EXISTS `fk_transmittals_status`;
ALTER TABLE `transmittals` DROP COLUMN IF EXISTS `cancelled_by`, DROP COLUMN IF EXISTS `cancelled_at`, DROP COLUMN IF EXISTS `cancel_reason`, DROP COLUMN IF EXISTS `status_id`, DROP COLUMN IF EXISTS `version`;
ALTER TABLE `rfas` DROP COLUMN IF EXISTS `version`;
ALTER TABLE `correspondences` DROP COLUMN IF EXISTS `version`;
