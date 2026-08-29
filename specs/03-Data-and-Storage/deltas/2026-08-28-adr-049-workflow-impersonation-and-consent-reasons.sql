-- Delta: ADR-049 Workflow State Machine Consolidation — impersonation audit + consent reasons + approve code scheme
-- Date: 2026-08-28
-- Related ADR: ADR-049 (amends ADR-001, ADR-021, ADR-016)
-- Related Spec: specs/200-fullstacks/249-adr-049-workflow-state-machine/spec.md
-- Applied in: v1.9.10 → v1.9.11
--
-- เป้าหมาย:
-- 1. เพิ่ม impersonation audit fields ใน workflow_histories (impersonated + on_behalf_of_user_id + on_behalf_of_user_uuid)
-- 2. สร้างตาราง rfa_consent_reasons (metadata ของ CONSULTANT consent — ไม่มีผลต่อ state)
-- 3. ปรับ rfa_approve_codes scheme จาก 1A/1C/1N/1R/3C/3R/4X/5N เป็น 1/2/3/4 (ลบ 5N)
--
-- ⚠️ Apply this SQL to the live database manually:
-- 1. รัน section 1 (ALTER TABLE workflow_histories)
-- 2. รัน section 2 (CREATE TABLE rfa_consent_reasons)
-- 3. รัน section 3 (UPDATE rfa_approve_codes — ปรับ data)
-- 4. รัน section 4 (verification queries)

-- ============================================================
-- Section 1: workflow_histories — add impersonation audit fields
-- ============================================================

ALTER TABLE `workflow_histories`
  ADD COLUMN IF NOT EXISTS `impersonated` TINYINT(1) NOT NULL DEFAULT 0
    COMMENT 'ADR-049: 1 = admin ทำ action แทน handler ดั้งเดิม (Superadmin/Org Admin impersonation)',
  ADD COLUMN IF NOT EXISTS `on_behalf_of_user_id` INT NULL
    COMMENT 'ADR-049: FK → users.id ของ handler ดั้งเดิม (เจ้าของเดิม) — NULL ถ้าไม่ใช่ impersonation',
  ADD COLUMN IF NOT EXISTS `on_behalf_of_user_uuid` VARCHAR(36) NULL
    COMMENT 'ADR-049: UUID ของ handler ดั้งเดิม สำหรับ API response (ADR-019) — NULL ถ้าไม่ใช่ impersonation';

-- Index สำหรับ query impersonation history ตาม user ดั้งเดิม
CREATE INDEX IF NOT EXISTS `idx_wf_hist_on_behalf_of_user_id`
  ON `workflow_histories` (`on_behalf_of_user_id`);

-- FK constraint (soft — ไม่บังคับเพราะ user อาจถูก deactivate แล้ว)
-- ไม่ใส่ FK เพราะ on_behalf_of_user_id อาจชี้ไป user ที่ inactive/deleted แล้ว (edge case T031a)
-- ใช้ application-level validation แทน

-- ============================================================
-- Section 2: rfa_consent_reasons — new table (CONSULTANT consent metadata)
-- ============================================================

CREATE TABLE IF NOT EXISTS `rfa_consent_reasons` (
  `id` INT PRIMARY KEY AUTO_INCREMENT COMMENT 'ID ของตาราง',
  `public_id` CHAR(36) NOT NULL UNIQUE COMMENT 'ADR-019: UUIDv7 สำหรับ API response',
  `code` VARCHAR(20) NOT NULL UNIQUE COMMENT 'รหัส consent reason (เช่น NO_OBJECTION, COMMENTS_PROVIDED)',
  `description` VARCHAR(200) NOT NULL COMMENT 'คำอธิบาย consent reason',
  `sort_order` INT DEFAULT 0 COMMENT 'ลำดับการแสดงผล',
  `is_active` TINYINT(1) DEFAULT 1 COMMENT 'สถานะการใช้งาน',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'วันที่สร้าง',
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'วันที่อัปเดต'
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci
  COMMENT = 'ADR-049: ตาราง Master สำหรับ consent reason ของ CONSULTANT (metadata ไม่มีผลต่อ workflow state)';

-- ============================================================
-- Section 3: rfa_approve_codes — ปรับ scheme จากเดิมเป็น 1/2/3/4
-- ============================================================

-- 3.1 ปิด code เดิมทั้งหมดก่อน (soft delete — ไม่ drop เพื่อ preserve audit history)
UPDATE `rfa_approve_codes`
SET `is_active` = 0
WHERE `approve_code` IN ('1A', '1C', '1N', '1R', '3C', '3R', '4X', '5N');

-- 3.2 เพิ่ม code ใหม่ (idempotent — ใช้ INSERT IGNORE)
INSERT IGNORE INTO `rfa_approve_codes` (`approve_code`, `approve_name`, `description`, `sort_order`, `is_active`) VALUES
  ('1', 'Approved', 'ADR-049: Owner อนุมัติ — transition APPROVE → APPROVED', 10, 1),
  ('2', 'Approved with Comments', 'ADR-049: Owner อนุมัติพร้อมข้อสังเกต — transition APPROVE_WITH_COMMENTS → APPROVED_WITH_COMMENTS', 20, 1),
  ('3', 'Revise and Resubmit', 'ADR-049: สั่งแก้ไข — transition RESUBMIT → REVISE_REQUIRED (CONSULTANT) หรือ → CONSULTANT_REVIEW (OWNER)', 30, 1),
  ('4', 'Rejected', 'ADR-049: ปฏิเสธ — transition REJECT → REJECTED', 40, 1);

-- 3.3 ลบ code 5N (No Further Action) — ADR-049 ตัดสินใจเอาออก
-- ไม่ DROP row เพื่อ preserve audit history (เก็บไว้แต่ is_active = 0 จาก step 3.1)
-- การยกเลิกเอกสารใช้ cancel() ของ RfaService แทน

-- ============================================================
-- Section 4: Seed data สำหรับ rfa_consent_reasons
-- ============================================================

INSERT IGNORE INTO `rfa_consent_reasons` (`public_id`, `code`, `description`, `sort_order`, `is_active`) VALUES
  (UUID(), 'NO_OBJECTION', 'No objection to the design/submission', 10, 1),
  (UUID(), 'COMMENTS_PROVIDED', 'Comments provided but no objection', 20, 1),
  (UUID(), 'AGREED_WITH_CONDITIONS', 'Agreed with conditions to be addressed', 30, 1),
  (UUID(), 'FORWARDED_TO_DESIGNER', 'Forwarded to designer for review', 40, 1),
  (UUID(), 'REQUESTED_REVISION', 'Requested revision before consent', 50, 1);

-- ============================================================
-- Section 5: Verification queries
-- ============================================================

-- ตรวจ workflow_histories columns ใหม่
-- SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT
-- FROM INFORMATION_SCHEMA.COLUMNS
-- WHERE TABLE_NAME = 'workflow_histories'
--   AND COLUMN_NAME IN ('impersonated', 'on_behalf_of_user_id', 'on_behalf_of_user_uuid');

-- ตรวจ rfa_consent_reasons สร้างสำเร็จ
-- SELECT COUNT(*) AS consent_reasons_count FROM rfa_consent_reasons WHERE is_active = 1;

-- ตรวจ rfa_approve_codes scheme ใหม่
-- SELECT approve_code, approve_name, is_active, sort_order
-- FROM rfa_approve_codes
-- WHERE approve_code IN ('1', '2', '3', '4')
-- ORDER BY sort_order;

-- ตรวจ code เดิมถูกปิด
-- SELECT approve_code, approve_name, is_active
-- FROM rfa_approve_codes
-- WHERE approve_code IN ('1A', '1C', '1N', '1R', '3C', '3R', '4X', '5N');
