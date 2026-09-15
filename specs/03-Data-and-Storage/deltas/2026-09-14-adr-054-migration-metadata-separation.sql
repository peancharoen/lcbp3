-- Delta: Add ocr_text_bak + review_state_json + imported_correspondence_public_id
--        to migration_review_queue + intentional TRUNCATE (ADR-054)
-- Date: 2026-09-14
-- Related ADR: ADR-054 (Migration Review Queue Metadata Separation — แยก Ingestion /
--              AI Output / Review State + OCR Text Protection; supersedes ADR-050 ข้อ 2)
-- Related Spec: specs/200-fullstacks/256-queue-metadata-separation/data-model.md
--
-- เพิ่ม 3 columns เพื่อแก้ root cause ของ data loss incident (OCR text 183 records
-- หายถาวร 2026-09-14) — เดิม ingestion metadata / AI output / review state ปนกันใน
-- ai_metadata_json JSON bag ทำให้การ reset AI output ทำลายข้อมูลที่ไม่ใช่ AI output:
--   - review_state_json (D9): human review state เท่านั้น (fieldResolutions +
--     fieldAcknowledgments) — เขียนโดย MigrationReviewService เท่านั้น ห้าม reset
--     ตอน re-extract (AiBatchProcessor ไม่แตะ column นี้เลย)
--   - ocr_text_bak (D5): snapshot ของ ocr_text ก่อนถูกเขียนทับ — เก็บข้อความจริง
--     ล่าสุดไว้กู้คืนถ้า re-extract/manual edit เขียนทับผิดพลาด
--   - imported_correspondence_public_id (D10): audit link queue→correspondence —
--     publicId ของ correspondence ที่ import สำเร็จ (record ไม่ถูกลบหลัง import)
--
-- หมายเหตุ: storage_temp_path / original_filename (D1/D2 — ingestion metadata)
-- มี column อยู่แล้วในตาราง — ไม่ต้อง ALTER เพิ่ม (แก้เฉพาะ entity mapping + write path)
--
-- ⚠️ TRUNCATE ด้านล่างเป็นการตัดสินใจโดยเจตนา (ADR-054 — Schema Changes ข้อ 5):
-- migration เริ่มใหม่ทั้งหมดจาก Excel — 37 แถวปัจจุบันเป็น test/sandbox data
-- ก่อน go-live จริง ทิ้งได้ไม่ต้องกู้คืน (ไม่มี backfill) รวมถึงแถวที่อาจมี
-- status=IMPORTED แล้วก็ตาม — D10 (audit trail) คุ้มครองเฉพาะ record ที่เกิด
-- "หลัง" ADR-054 มีผลบังคับใช้เท่านั้น (ยืนยันกับ user 2026-09-14)
--
-- ⚠️ ตาม ADR-044: รัน manual โดย DBA หลัง review — ไม่ auto-run ใน CI/CD
-- ------------------------------------------------------------
-- Schema changes
-- ------------------------------------------------------------
ALTER TABLE `migration_review_queue`
  ADD COLUMN IF NOT EXISTS `review_state_json` LONGTEXT NULL COMMENT 'ADR-054 D9: human review state เท่านั้น (fieldResolutions + fieldAcknowledgments) — เขียนโดย MigrationReviewService เท่านั้น ห้าม reset ตอน re-extract' CHECK (json_valid(`review_state_json`)) AFTER `ai_metadata_json`,
  ADD COLUMN IF NOT EXISTS `imported_correspondence_public_id` VARCHAR(36) NULL COMMENT 'ADR-054 D10: audit link queue→correspondence — publicId (correspondences.uuid) ของ correspondence ที่ import สำเร็จ' AFTER `review_state_json`,
  ADD COLUMN IF NOT EXISTS `ocr_text_bak` LONGTEXT NULL COMMENT 'ADR-054 D5: snapshot ของ ocr_text ก่อนถูกเขียนทับ — เก็บข้อความจริงล่าสุด' AFTER `ocr_text`;

-- ------------------------------------------------------------
-- ⚠️ Data reset — intentional, one-time (ADR-054 ข้อ 5)
-- ------------------------------------------------------------
-- TRUNCATE นี้จงใจลบทุกแถว (ไม่มี backup, ไม่มี backfill) เพราะ migration จะ
-- re-ingest จาก Excel ใหม่ทั้งหมด — ข้อมูล 37 แถวเป็น pre-go-live sandbox data
-- ยอมทิ้งได้ตาม ADR-054 (ยืนยันกับ user 2026-09-14) — กู้คืนไม่ได้
TRUNCATE TABLE `migration_review_queue`;

-- ------------------------------------------------------------
-- Verification query
-- ------------------------------------------------------------
-- SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE FROM information_schema.COLUMNS
-- WHERE TABLE_SCHEMA = 'lcbp3' AND TABLE_NAME = 'migration_review_queue'
--   AND COLUMN_NAME IN ('ocr_text_bak', 'review_state_json', 'imported_correspondence_public_id');
-- -- Expected: 3 rows
--
-- SELECT COUNT(*) FROM migration_review_queue;
-- -- Expected: 0
