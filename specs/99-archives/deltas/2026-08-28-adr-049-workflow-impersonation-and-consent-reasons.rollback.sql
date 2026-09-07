-- Rollback: ADR-049 Workflow State Machine Consolidation — impersonation audit + consent reasons + approve code scheme
-- Date: 2026-08-28
-- Related Delta: 2026-08-28-adr-049-workflow-impersonation-and-consent-reasons.sql
--
-- ⚠️ Rollback notes:
-- - ปิด code ใหม่ (1/2/3/4) และเปิด code เดิม (1A/1C/1N/1R/3C/3R/4X/5N) กลับ
-- - DROP rfa_consent_reasons (สูญหายทั้งหมด — รวม consent reasons ที่ใช้แล้ว)
-- - DROP columns ใน workflow_histories (สูญหาย audit history ของ impersonation)
-- - ไม่สามารถ rollback ได้ถ้ามี workflow_histories ที่ใช้ impersonation แล้ว — ต้อง backup ก่อน

-- ============================================================
-- Section 1: workflow_histories — drop impersonation audit fields
-- ============================================================

ALTER TABLE `workflow_histories`
  DROP COLUMN IF EXISTS `impersonated`,
  DROP COLUMN IF EXISTS `on_behalf_of_user_id`,
  DROP COLUMN IF EXISTS `on_behalf_of_user_uuid`;

-- ============================================================
-- Section 2: rfa_consent_reasons — drop table
-- ============================================================

DROP TABLE IF EXISTS `rfa_consent_reasons`;

-- ============================================================
-- Section 3: rfa_approve_codes — เปิด code เดิม + ปิด code ใหม่
-- ============================================================

-- ปิด code ใหม่
UPDATE `rfa_approve_codes`
SET `is_active` = 0
WHERE `approve_code` IN ('1', '2', '3', '4');

-- เปิด code เดิม
UPDATE `rfa_approve_codes`
SET `is_active` = 1
WHERE `approve_code` IN ('1A', '1C', '1N', '1R', '3C', '3R', '4X', '5N');
