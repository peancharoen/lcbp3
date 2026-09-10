-- File: specs/03-Data-and-Storage/deltas/2026-09-09-rag-classification-permission.sql
-- Feature: 254-rag-attachment-chunks
-- ADR-016: Protected classification downgrade permission.
-- Apply manually after review; this delta has not been applied automatically.

INSERT INTO permissions (
  permission_id,
  permission_name,
  description,
  module,
  is_active
)
VALUES (
  238,
  'document.classification_override',
  'ลดระดับ Document Security Classification สำหรับ RAG Attachment (Superadmin only)',
  'document',
  1
)
ON DUPLICATE KEY UPDATE
  description = VALUES(description),
  module = VALUES(module),
  is_active = VALUES(is_active);

INSERT IGNORE INTO role_permissions (role_id, permission_id)
VALUES (1, 238);
