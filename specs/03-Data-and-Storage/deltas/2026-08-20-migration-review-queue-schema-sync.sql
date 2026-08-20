-- Delta: Sync migration_review_queue schema with entity definition
-- Date: 2026-08-20
-- Related ADR: ADR-023A (AI Migration), ADR-044 (direct SQL schema changes)
-- Related Spec: specs/03-Data-and-Storage/03-01-data-dictionary.md
-- Applied in: v1.9.13 → v1.9.14
--
-- เพิ่ม columns ที่ entity MigrationReviewQueue (src/modules/migration/entities/) คาดหวัง
-- แต่ไม่มีใน DB เนื่องจาก schema drift ระหว่างการ refactor entity
-- Columns เหล่านี้จำเป็นสำหรับ business logic ใน migration.service.ts enqueueRecord()
-- ------------------------------------------------------------
-- Schema changes
-- ------------------------------------------------------------
-- 1) Relax NOT NULL constraints สำหรับ columns ที่ entity เก่า (MigrationReviewQueue) ไม่ได้ใช้
--    entity เก่าไม่ได้ define idempotency_key/original_filename/storage_temp_path/confidence_score
--    แต่ DB เดิมเป็น NOT NULL ทำให้ INSERT ล้มเหลว
ALTER TABLE `migration_review_queue`
MODIFY COLUMN `idempotency_key` VARCHAR(200) NULL,
  MODIFY COLUMN `original_filename` VARCHAR(500) NULL,
  MODIFY COLUMN `storage_temp_path` VARCHAR(1000) NULL,
  MODIFY COLUMN `confidence_score` DECIMAL(5, 4) NULL;

-- 2) เพิ่ม columns ที่ entity MigrationReviewQueue คาดหวังแต่ไม่มีใน DB
ALTER TABLE `migration_review_queue`
ADD COLUMN IF NOT EXISTS `document_number` VARCHAR(100) NULL COMMENT 'เลขที่เอกสารเก่า (จาก OCR/Excel)',
  ADD COLUMN IF NOT EXISTS `subject` TEXT NULL COMMENT 'หัวข้อเรื่อง (ตรงกับ correspondence_revisions.subject)',
  ADD COLUMN IF NOT EXISTS `original_subject` TEXT NULL COMMENT 'หัวข้อเดิมจาก Excel (ก่อน AI แก้ไข)',
  ADD COLUMN IF NOT EXISTS `body` TEXT NULL COMMENT 'เนื้อความสรุปจาก AI',
  ADD COLUMN IF NOT EXISTS `ai_suggested_category` VARCHAR(50) NULL COMMENT 'หมวดหมู่ที่ AI แนะนำ',
  ADD COLUMN IF NOT EXISTS `ai_confidence` DECIMAL(4, 3) NULL COMMENT 'ค่าความมั่นใจของ AI (0.000 - 1.000)',
  ADD COLUMN IF NOT EXISTS `ai_issues` JSON NULL COMMENT 'รายละเอียดปัญหาที่ AI พบ',
  ADD COLUMN IF NOT EXISTS `review_reason` VARCHAR(255) NULL COMMENT 'เหตุผลที่ต้องตรวจสอบ',
  ADD COLUMN IF NOT EXISTS `project_id` INT NULL COMMENT 'Project ID จาก Lookups',
  ADD COLUMN IF NOT EXISTS `sender_organization_id` INT NULL COMMENT 'Sender ID จาก Lookups',
  ADD COLUMN IF NOT EXISTS `receiver_organization_id` INT NULL COMMENT 'Receiver ID จาก Lookups',
  ADD COLUMN IF NOT EXISTS `received_date` DATE NULL COMMENT 'วันที่รับเอกสาร',
  ADD COLUMN IF NOT EXISTS `issued_date` DATE NULL COMMENT 'วันที่ออกเอกสาร',
  ADD COLUMN IF NOT EXISTS `remarks` TEXT NULL COMMENT 'หมายเหตุจากหน้างาน',
  ADD COLUMN IF NOT EXISTS `ai_summary` TEXT NULL COMMENT 'สรุปเนื้อหาจาก AI (4-5 บรรทัด)',
  ADD COLUMN IF NOT EXISTS `extracted_tags` JSON NULL COMMENT 'Tag ที่ AI นำเสนอหรือจับคู่ได้';

-- ------------------------------------------------------------
-- Indexes
-- ------------------------------------------------------------
-- document_number unique index สำหรับ upsert lookup
ALTER TABLE `migration_review_queue`
ADD UNIQUE INDEX IF NOT EXISTS `uq_doc_number` (`document_number`);

-- ------------------------------------------------------------
-- Verification query
-- ------------------------------------------------------------
-- SELECT column_name FROM information_schema.columns
-- WHERE table_schema = 'lcbp3' AND table_name = 'migration_review_queue'
-- ORDER BY ordinal_position;
