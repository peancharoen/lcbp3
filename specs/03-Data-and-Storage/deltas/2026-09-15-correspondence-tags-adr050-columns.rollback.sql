-- Rollback: 2026-09-15-correspondence-tags-adr050-columns.sql
-- คืน correspondence_tags กลับเป็น 2 columns เดิม (correspondence_id, tag_id)
-- ⚠️ ข้อมูลใน 4 columns ที่เพิ่มจะหาย — ใช้เฉพาะตอนต้อง rollback จริง

ALTER TABLE correspondence_tags
  DROP FOREIGN KEY fk_correspondence_tags_created_by,
  DROP COLUMN is_ai_suggested,
  DROP COLUMN confidence,
  DROP COLUMN created_by,
  DROP COLUMN created_at;
