-- Delta: Add ocr_text to migration_review_queue (ADR-042 / ADR-047)
-- Date: 2026-08-20
-- Related ADR: ADR-042 (OCR Text Persistence), ADR-047 (Native Backend Legacy Ingestion)
-- Related Spec: specs/200-fullstacks/244-native-backend-legacy-ingestion/spec.md
-- Applied in: v1.9.14
--
-- เพิ่ม column ocr_text ใน migration_review_queue สำหรับเก็บข้อความ OCR 3 หน้าแรกถาวร
-- เพื่อเปิดให้ Admin/Reviewer ตรวจแก้คำผิดและ Re-embed ลง Qdrant (ADR-042 Parity)
-- ------------------------------------------------------------
-- Schema changes
-- ------------------------------------------------------------
ALTER TABLE `migration_review_queue`
  ADD COLUMN IF NOT EXISTS `ocr_text` LONGTEXT NULL COMMENT 'ข้อความ OCR 3 หน้าแรก (ADR-042/047)' AFTER `extracted_tags`;

-- ------------------------------------------------------------
-- Verification query
-- ------------------------------------------------------------
-- SELECT COLUMN_NAME, DATA_TYPE FROM information_schema.COLUMNS 
-- WHERE TABLE_SCHEMA = 'lcbp3' AND TABLE_NAME = 'migration_review_queue' AND COLUMN_NAME = 'ocr_text';
