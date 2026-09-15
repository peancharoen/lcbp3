-- Delta: เพิ่ม is_ai_suggested + confidence + created_by + created_at
--        ให้ correspondence_tags (schema drift — prod มีแค่ 2 columns)
-- Date: 2026-09-15
-- Related: ADR-050 (AI metadata extraction contract — tag accept/reject + audit),
--          CorrespondenceTag entity (backend/src/modules/tags/entities/correspondence-tag.entity.ts)
--
-- Root cause: canonical schema (lcbp3-v1.9.0-schema-02-tables.sql §correspondence_tags)
-- กำหนด 6 columns แต่ prod DB สร้างจาก schema เก่าก่อน ADR-050 จึงมีแค่
-- (correspondence_id, tag_id) — entity INSERT ที่ใส่ is_ai_suggested/created_by/created_at
-- ล้มด้วย "Unknown column" → MigrationReviewService.commitRecord → 500 ทุกรายการ
-- ที่มี tag link (พบระหว่าง E2E test ของ ADR-054 test plan)
--
-- Column definitions คัดลอกตรงจาก canonical schema — เป็น additive change
-- (เพิ่ม column ใหม่ทั้งหมด ไม่แตะข้อมูลเดิม, row เดิมได้ค่า default/NULL)

ALTER TABLE correspondence_tags
  ADD COLUMN is_ai_suggested BOOLEAN DEFAULT FALSE COMMENT 'แท็กนี้แนะนำโดย AI หรือไม่' AFTER tag_id,
  ADD COLUMN confidence DECIMAL(4, 3) NULL COMMENT 'ค่าความมั่นใจของ AI (0.000–1.000)' AFTER is_ai_suggested,
  ADD COLUMN created_by INT NULL COMMENT 'ผู้เชื่อมโยงแท็ก' AFTER confidence,
  ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'วันที่เชื่อมโยง' AFTER created_by,
  ADD CONSTRAINT fk_correspondence_tags_created_by
    FOREIGN KEY (created_by) REFERENCES users (user_id) ON DELETE SET NULL;

-- หมายเหตุ: index บน tag_id / correspondence_id มีอยู่แล้วใน prod
-- (idx_tag_lookup, idx_correspondence_tags_correspondence, idx_correspondence_tags_tag)
-- จึงไม่ต้อง ADD INDEX ซ้ำ — canonical index idx_correspondence_tags_lookup
-- มีหน้าที่เดียวกับ idx_tag_lookup ที่มีอยู่
