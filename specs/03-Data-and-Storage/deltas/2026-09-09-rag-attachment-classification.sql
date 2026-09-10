-- File: specs/03-Data-and-Storage/deltas/2026-09-09-rag-attachment-classification.sql
-- Feature: 254-rag-attachment-chunks (Phase 7 US5, T067)
-- Date: 2026-09-09
-- Related ADR: ADR-044 (SQL deltas, no TypeORM migrations),
--              ADR-016 (Security/Classification),
--              ADR-019 (Hybrid Identifier Strategy — UUIDv7 publicId)
-- Related Spec: specs/200-fullstacks/254-rag-attachment-chunks/
-- Applied in: v1.9.0 → v1.9.x
-- NOTE: Apply manually; do not create a TypeORM migration. The canonical schema
--   file (lcbp3-v1.9.0-schema-02-tables.sql) is the source of truth for fresh
--   installs — update it in the same PR per ADR-044.
-- Idempotent: uses ADD COLUMN IF NOT EXISTS / CREATE INDEX IF NOT EXISTS
--   (MariaDB 10.5+). Re-running is safe.

-- ============================================================
-- Section 1: attachments — effective classification + override audit
-- ============================================================
-- เพิ่ม canonical effective classification fields สำหรับ RAG retrieval filtering
-- effective_classification = ค่า classification ที่ resolve แล้ว (หลัง inheritance/override)
-- classification_override   = ค่า override ที่ผู้ใจัดการระบุชัดเจน (NULL = สืบทอดจาก parent)
-- ฟิลด์ override_* เก็บ audit trail สำหรับการเปลี่ยนแปลง classification (ADR-016)
ALTER TABLE `attachments`
  ADD COLUMN IF NOT EXISTS `effective_classification` VARCHAR(50) NOT NULL DEFAULT 'INTERNAL'
    COMMENT 'ค่า classification ที่ resolve แล้วหลัง inheritance/override สำหรับ RAG retrieval',
  ADD COLUMN IF NOT EXISTS `classification_override` VARCHAR(50) NULL
    COMMENT 'ค่า override ที่ระบุชัดเจน (NULL = สืบทอดจาก parent document/project)',
  ADD COLUMN IF NOT EXISTS `classification_override_reason` TEXT NULL
    COMMENT 'เหตุผลการ override (audit trail, ADR-016)',
  ADD COLUMN IF NOT EXISTS `classification_override_actor_user_public_id` VARCHAR(36) NULL
    COMMENT 'UUIDv7 ของผู้กระทำการ override (ADR-019, publicId ของ user)',
  ADD COLUMN IF NOT EXISTS `classification_overridden_at` DATETIME NULL
    COMMENT 'วันเวลาที่มีการ override ครั้งล่าสุด';

-- ============================================================
-- Section 2: Indexes for retrieval filtering
-- ============================================================
-- Index บน effective_classification สำหรับกรอง chunk/retrieval ตามระดับความลับ
CREATE INDEX IF NOT EXISTS `idx_attachments_effective_classification`
  ON `attachments` (`effective_classification`);

-- Composite index สำหรับ query attachment ที่ active และมี classification เฉพาะ
CREATE INDEX IF NOT EXISTS `idx_attachments_classification_rag`
  ON `attachments` (`effective_classification`, `rag_status`);

-- ============================================================
-- Section 3: Backfill effective_classification จาก classification เดิม
-- ============================================================
-- การ backfill ทำผ่าน n8n workflow ตาม ADR-044 §4 (data backfill ไม่อยู่ใน delta)
-- ค่าเริ่มต้น DEFAULT 'INTERNAL' ทำให้ row เดิมปลอดภัย ก่อน backfill จริง
-- แนะนำ: UPDATE attachments SET effective_classification = classification
--   WHERE effective_classification = 'INTERNAL' AND classification <> 'INTERNAL';

-- ============================================================
-- Verification queries
-- ============================================================
-- SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT
--   FROM information_schema.COLUMNS
--   WHERE TABLE_SCHEMA = 'lcbp3' AND TABLE_NAME = 'attachments'
--     AND COLUMN_NAME IN (
--       'effective_classification',
--       'classification_override',
--       'classification_override_reason',
--       'classification_override_actor_user_public_id',
--       'classification_overridden_at'
--     )
--   ORDER BY ORDINAL_POSITION;
-- -- Expected: 5 rows
--
-- SELECT INDEX_NAME FROM information_schema.STATISTICS
--   WHERE TABLE_SCHEMA = 'lcbp3' AND TABLE_NAME = 'attachments'
--     AND INDEX_NAME IN (
--       'idx_attachments_effective_classification',
--       'idx_attachments_classification_rag'
--     );
-- -- Expected: 2 rows
