-- =============================================================================
-- Delta 11: เพิ่ม uuid column ให้ roles table
-- =============================================================================
-- เหตุผล: roles ไม่มี uuid column ทำให้ distribution_recipients ไม่สามารถ
--         อ้างอิง ROLE type ด้วย publicId ได้ตาม ADR-019
-- ใช้ใน: distribution_recipients.recipient_public_id (recipient_type = 'ROLE')
-- ADR: ADR-019 (Hybrid Identifier Strategy)
-- Feature: v1.9.0 RFA Approval Refactor (1-rfa-approval-refactor)
-- Created: 2026-05-13
-- =============================================================================

ALTER TABLE `roles`
  ADD COLUMN `uuid` UUID NOT NULL DEFAULT (UUID())
    COMMENT 'UUID Public Identifier (ADR-019) — ใช้ใน API Response แทน role_id'
  AFTER `role_id`;

-- สร้าง Unique Index สำหรับ uuid
CREATE UNIQUE INDEX `idx_roles_uuid` ON `roles` (`uuid`);

-- =============================================================================
-- หมายเหตุ: หลัง Apply delta นี้แล้ว
--   - roles ที่มีอยู่แล้วจะได้ uuid อัตโนมัติจาก DEFAULT (UUID())
--   - distribution_recipients.recipient_public_id (type=ROLE) ให้ใช้ roles.uuid
--   - TypeORM Entity: เพิ่ม @Column({ unique: true }) uuid: string; ใน RoleEntity
-- =============================================================================
