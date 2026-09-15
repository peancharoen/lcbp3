-- File: specs/03-Data-and-Storage/deltas/2026-09-14-adr-054-migration-metadata-separation.rollback.sql
-- Change Log:
-- - 2026-09-14: Rollback for ADR-054 delta — drop 3 columns จาก migration_review_queue

-- ⚠️ TRUNCATE ใน delta ต้นทางย้อนกลับไม่ได้ — rollback นี้กู้คืนเฉพาะ schema
-- (ลบ 3 columns ที่เพิ่ม) แถวที่ถูก TRUNCATE ทิ้งกู้คืนไม่ได้ — เป็น tradeoff
-- ที่ยอมรับไว้แล้วใน ADR-054 D8/ข้อ 5 (37 แถว pre-go-live sandbox data ทิ้งได้
-- โดยเจตนา — ไม่มี path กู้คืน)

ALTER TABLE `migration_review_queue`
  DROP COLUMN IF EXISTS `ocr_text_bak`,
  DROP COLUMN IF EXISTS `review_state_json`,
  DROP COLUMN IF EXISTS `imported_correspondence_public_id`;
