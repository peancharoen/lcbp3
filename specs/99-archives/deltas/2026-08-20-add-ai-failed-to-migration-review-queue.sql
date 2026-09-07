-- Delta: Add ai_failed to migration_review_queue (Edge Case 4 / ADR-047)
-- Date: 2026-08-20
-- Related ADR: ADR-047 (Native Backend Legacy Ingestion)
-- Related Spec: specs/200-fullstacks/244-native-backend-legacy-ingestion/spec.md (Edge Case 4)
-- Applied in: v1.9.14
--
-- เพิ่ม column ai_failed ใน migration_review_queue สำหรับ flag แสดงว่า AI enrichment
-- ล้มเหลวหลัง retry ครบ 3 ครั้ง เพื่อให้มนุษย์ตรวจทานเองได้โดยไม่ทำให้ Worker ค้าง
-- ------------------------------------------------------------
-- Schema changes
-- ------------------------------------------------------------
ALTER TABLE `migration_review_queue`
  ADD COLUMN IF NOT EXISTS `ai_failed` TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'Edge Case 4: AI enrichment failed after retries' AFTER `ai_job_id`;

-- ------------------------------------------------------------
-- Verification query
-- ------------------------------------------------------------
-- SELECT COLUMN_NAME, DATA_TYPE FROM information_schema.COLUMNS
-- WHERE TABLE_SCHEMA = 'lcbp3' AND TABLE_NAME = 'migration_review_queue' AND COLUMN_NAME = 'ai_failed';
