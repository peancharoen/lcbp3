-- File: specs/03-Data-and-Storage/deltas/2026-09-10-rag-admin-permissions.sql
-- Change Log:
-- - 2026-09-10: Feature 255 — เพิ่ม rag.admin.write + rag.retry permissions สำหรับ RAG Admin Console
--
-- Production delta: เพิ่ม 2 permissions ใหม่ + grant rag.retry ให้ Org Admin (Role 2)
-- Rollback: 2026-09-10-rag-admin-permissions-rollback.sql

-- ==========================================================
-- Feature 255: RAG Admin Console Permissions
-- Added: 2026-09-10
-- ==========================================================

-- 1. เพิ่ม permissions ใหม่ (ID 189, 190)
INSERT INTO permissions (
    permission_id,
    permission_name,
    description,
    module,
    is_active
  )
VALUES (
    189,
    'rag.admin.write',
    'บังคับ re-ingest และ reset RAG metrics (Superadmin เท่านั้น)',
    'rag',
    1
  ),
  (
    190,
    'rag.retry',
    'Batch retry failed RAG ingestions (Superadmin + Org Admin)',
    'rag',
    1
  );

-- 2. Grant rag.retry (190) ให้ Org Admin (Role 2)
--    Superadmin (Role 1) ได้รับทุก permission โดยอัตโนมัติผ่าน SELECT-all pattern
INSERT IGNORE INTO role_permissions (role_id, permission_id)
VALUES (2, 190);

-- rag.admin.write (189) — Superadmin เท่านั้น, ไม่ grant ให้ Role อื่น
-- rag.retry (190) — Superadmin + Org Admin (Role 2)
