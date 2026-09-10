-- File: specs/03-Data-and-Storage/deltas/2026-09-09-feature-253-document-tags.sql
-- Feature: 253-unified-doc-crud
-- ADR-044: Apply manually; do not create a TypeORM migration.

CREATE TABLE document_tags (
  document_type VARCHAR(30) NOT NULL COMMENT 'ประเภทเอกสารตาม domain glossary',
  document_id INT NOT NULL COMMENT 'INT PK ภายในของเอกสารตาม document_type',
  tag_id INT NOT NULL COMMENT 'ID ของแท็ก',
  created_by INT NULL COMMENT 'ผู้เชื่อมโยงแท็ก',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (document_type, document_id, tag_id),
  FOREIGN KEY (tag_id) REFERENCES tags (id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users (user_id) ON DELETE SET NULL,
  INDEX idx_document_tags_tag (tag_id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci COMMENT = 'ตาราง M:N สำหรับแท็กของ RFA, Transmittal, Drawing และ Circulation';
