-- File: specs/03-Data-and-Storage/deltas/2026-09-10-rag-admin-permissions-rollback.sql
-- Change Log:
-- - 2026-09-10: Feature 255 — Rollback สำหรับ rag.admin.write + rag.retry permissions
--
-- Rollback: ลบ rag.retry grant จาก Org Admin + ลบ permissions 189, 190
-- Forward: 2026-09-10-rag-admin-permissions.sql

-- ==========================================================
-- Feature 255: RAG Admin Console Permissions — Rollback
-- ==========================================================

-- 1. ลบ rag.retry grant จาก Org Admin (Role 2)
DELETE FROM role_permissions
WHERE role_id = 2 AND permission_id = 190;

-- 2. ลบ permissions 189, 190
DELETE FROM permissions
WHERE permission_id IN (189, 190);
