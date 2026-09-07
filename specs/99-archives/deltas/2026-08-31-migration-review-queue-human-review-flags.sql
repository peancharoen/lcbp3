-- Delta: Add requires_human_review + ocr_quality_confidence to migration_review_queue (ADR-050)
-- Date: 2026-08-31
-- Related ADR: ADR-050 (AI Metadata Extraction Output Contract — supersedes/extends ADR-023/023A)
-- Related Spec: specs/200-fullstacks/250-ai-metadata-extraction-contract/data-model.md §1
--
-- เพิ่ม 2 column ที่ต้อง query/filter/sort ระดับ DB (promoted จาก details JSON bag ตาม
-- ADR-050 Decision 2 — "Storage: Bag + promoted flags"):
--   - requires_human_review: server-computed เสมอ (ไม่เชื่อค่าจาก LLM แม้ LLM จะส่งมาก็ตาม —
--     ADR-050 Decision 3) ใช้ filter คิว "ต้อง review" ในตาราง admin
--   - ocr_quality_confidence: promote จาก details.ocrQuality.confidence สำหรับ sort คิวตามคุณภาพ OCR
--
-- หมายเหตุ: ai_confidence เดิม (decimal(4,3)) คงไว้ตามเดิมเป็น backward-compat alias
-- (backend เขียน min(metadata.confidence.*)) — ไม่ใช่ column ใหม่นี้ (ADR-050 Decision 2)
--
-- ⚠️ ตาม ADR-044: รัน manual โดย DBA หลัง review — ไม่ auto-run ใน CI/CD
-- ------------------------------------------------------------
-- Schema changes
-- ------------------------------------------------------------
ALTER TABLE `migration_review_queue`
  ADD COLUMN IF NOT EXISTS `requires_human_review` TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'ADR-050: server-computed จาก min(confidence ทั้งหมด) < threshold — ไม่เชื่อค่าที่ LLM ส่งมา' AFTER `ocr_text`,
  ADD COLUMN IF NOT EXISTS `ocr_quality_confidence` DECIMAL(4, 3) NULL COMMENT 'ADR-050: promote จาก details.ocrQuality.confidence (0.000-1.000) สำหรับ sort/filter' AFTER `requires_human_review`;

-- ------------------------------------------------------------
-- Verification query
-- ------------------------------------------------------------
-- SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT FROM information_schema.COLUMNS
-- WHERE TABLE_SCHEMA = 'lcbp3' AND TABLE_NAME = 'migration_review_queue'
--   AND COLUMN_NAME IN ('requires_human_review', 'ocr_quality_confidence');
