-- ==========================================================
-- Delta: 2026-09-10-org-admin-manage-members
-- Fix: BUG-001 — MIGRATION_STAGING ใช้ไม่ได้กับ Org Admin
--
-- ปัญหา: code เดิมตรวจ `organization.manage_users` ซึ่งไม่มีใน DB
--   - seed SQL มี `organization.manage_members` (permission_id=15)
--   - Superadmin ได้รับผ่าน SELECT-all pattern
--   - Org Admin (role_id=2) ไม่ได้รับ permission นี้
--
-- ผลกระทบ:
--   - MIGRATION_STAGING (Feature 252) ใช้ไม่ได้กับ Org Admin ทั้งที่ spec อนุญาต
--   - WorkflowTransitionGuard Level 2 ใช้ไม่ได้กับ Org Admin
--   - WorkflowEngineService impersonation ใช้ไม่ได้กับ Org Admin
--
-- แก้ไข:
--   1. Code: เปลี่ยน `organization.manage_users` → `organization.manage_members`
--   2. DB (delta นี้): Grant `organization.manage_members` ให้ Org Admin (role_id=2)
--
-- อ้างอิง:
--   - ADR-052 §User Story 3: "System Administrator หรือ Org Admin" สำหรับ MIGRATION_STAGING
--   - ADR-016: CASL 4-Level RBAC Matrix
--   - Feature 252 phase-a-verification-report.md BUG-001
-- ==========================================================

INSERT IGNORE INTO role_permissions (role_id, permission_id)
VALUES (2, 15);
-- organization.manage_members — Org Admin จัดการสมาชิกในองค์กร + ใช้ MIGRATION_STAGING
