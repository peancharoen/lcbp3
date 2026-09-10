-- File: specs/03-Data-and-Storage/deltas/2026-09-09-rag-attachment-chunks.rollback.sql
-- Feature: 254-rag-attachment-chunks
-- ADR-044: Apply manually; do not create a TypeORM migration.
-- WARNING: This rollback restores an empty legacy document_chunks table only.
-- It cannot restore rows that were intentionally dropped by the forward delta.

DROP TABLE IF EXISTS rag_attachment_chunks;
DROP TABLE IF EXISTS rag_attachment_pages;
DROP TABLE IF EXISTS rag_attachment_generations;

ALTER TABLE attachments
  DROP COLUMN IF EXISTS classification;

CREATE TABLE IF NOT EXISTS document_chunks (
  id CHAR(36) NOT NULL PRIMARY KEY COMMENT 'Legacy Qdrant point ID',
  document_id CHAR(36) NOT NULL COMMENT 'Legacy attachment identifier',
  chunk_index INT NOT NULL,
  content TEXT NOT NULL,
  doc_type VARCHAR(20) NOT NULL,
  doc_number VARCHAR(100) NULL,
  revision VARCHAR(20) NULL,
  project_code VARCHAR(50) NOT NULL,
  project_public_id CHAR(36) NOT NULL,
  version VARCHAR(20) NULL,
  classification ENUM('PUBLIC', 'INTERNAL', 'CONFIDENTIAL') NOT NULL DEFAULT 'INTERNAL',
  embedding_model VARCHAR(100) NOT NULL DEFAULT 'nomic-embed-text',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX idx_chunks_document_id (document_id),
  INDEX idx_chunks_doc_number_rev (doc_number, revision),
  INDEX idx_chunks_project (project_public_id),
  FULLTEXT INDEX ft_chunks_content (content)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;
