-- Delta: Widen rfa_consent_reasons.code VARCHAR(20) → VARCHAR(50)
-- Date: 2026-09-07
-- Related Delta: 2026-08-28-adr-049-workflow-impersonation-and-consent-reasons.sql
-- Related ADR: ADR-049, ADR-044
--
-- Bug: seed codes 'AGREED_WITH_CONDITIONS' (22 ตัวอักษร) และ 'FORWARDED_TO_DESIGNER'
-- (21 ตัวอักษร) ยาวเกิน VARCHAR(20) — INSERT IGNORE ทำให้ถูก truncate เงียบ ๆ
-- เป็น 'AGREED_WITH_CONDITIO' และ 'FORWARDED_TO_DESIGNE'
--
-- Fix 2 ส่วน:
--   1. ขยาย column code เป็น VARCHAR(50)
--   2. แก้ data ที่ถูก truncate กลับเป็นค่าเต็ม
-- ------------------------------------------------------------
-- Schema changes
-- ------------------------------------------------------------
ALTER TABLE `rfa_consent_reasons`
  MODIFY COLUMN `code` VARCHAR(50) NOT NULL COMMENT 'รหัส consent reason (เช่น NO_OBJECTION, COMMENTS_PROVIDED)';

-- ------------------------------------------------------------
-- Data fix (กรณี apply delta 2026-08-28 ไปแล้วก่อน fix นี้)
-- ------------------------------------------------------------
UPDATE `rfa_consent_reasons`
SET `code` = 'AGREED_WITH_CONDITIONS'
WHERE `code` = 'AGREED_WITH_CONDITIO';

UPDATE `rfa_consent_reasons`
SET `code` = 'FORWARDED_TO_DESIGNER'
WHERE `code` = 'FORWARDED_TO_DESIGNE';

-- ------------------------------------------------------------
-- Verification query
-- ------------------------------------------------------------
-- SELECT code, CHAR_LENGTH(code) FROM rfa_consent_reasons ORDER BY sort_order;
-- ต้องได้: NO_OBJECTION, COMMENTS_PROVIDED, AGREED_WITH_CONDITIONS,
--          FORWARDED_TO_DESIGNER, REQUESTED_REVISION (ไม่มี truncation)
