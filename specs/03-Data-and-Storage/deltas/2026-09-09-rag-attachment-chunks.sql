-- File: specs/03-Data-and-Storage/deltas/2026-09-09-rag-attachment-chunks.sql
-- Feature: 254-rag-attachment-chunks
-- ADR-044: Apply manually; do not create a TypeORM migration.
-- Precondition: verify document_chunks has zero rows and take a schema backup.
-- This delta intentionally removes the legacy document_chunks table.

ALTER TABLE attachments
  ADD COLUMN IF NOT EXISTS classification ENUM('PUBLIC', 'INTERNAL', 'CONFIDENTIAL') NOT NULL DEFAULT 'INTERNAL' COMMENT 'Effective document security classification for RAG retrieval';

CREATE TABLE IF NOT EXISTS rag_attachment_generations (
  generation_uuid UUID NOT NULL PRIMARY KEY,
  attachment_uuid UUID NOT NULL,
  attachment_checksum_snapshot CHAR(64) NOT NULL,
  verified_content_checksum CHAR(64) NULL,
  status ENUM('BUILDING', 'ACTIVE', 'RETIRED', 'FAILED') NOT NULL DEFAULT 'BUILDING',
  embedding_model VARCHAR(100) NOT NULL DEFAULT 'bge-m3',
  embedding_model_version VARCHAR(100) NULL,
  embedding_schema JSON NULL,
  error_code VARCHAR(100) NULL,
  error_message TEXT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  activated_at DATETIME(3) NULL,
  retired_at DATETIME(3) NULL,
  failed_at DATETIME(3) NULL,
  active_generation_marker TINYINT AS (IF(status = 'ACTIVE', 1, NULL)) PERSISTENT,
  FOREIGN KEY (attachment_uuid) REFERENCES attachments (uuid) ON DELETE CASCADE,
  UNIQUE KEY uq_rag_active_generation (attachment_uuid, active_generation_marker),
  INDEX idx_rag_generation_attachment (attachment_uuid),
  INDEX idx_rag_generation_status (status),
  INDEX idx_rag_generation_failed (status, failed_at)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS rag_attachment_pages (
  page_uuid UUID NOT NULL PRIMARY KEY,
  generation_uuid UUID NOT NULL,
  attachment_uuid UUID NOT NULL,
  segment_type ENUM('PAGE', 'SECTION', 'SHEET', 'WHOLE_DOCUMENT') NOT NULL,
  segment_number INT NULL,
  segment_label VARCHAR(255) NULL,
  source_locator VARCHAR(1000) NULL,
  normalized_text LONGTEXT NOT NULL,
  normalized_start_offset BIGINT NOT NULL DEFAULT 0,
  normalized_end_offset BIGINT NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  FOREIGN KEY (generation_uuid) REFERENCES rag_attachment_generations (generation_uuid) ON DELETE CASCADE,
  FOREIGN KEY (attachment_uuid) REFERENCES attachments (uuid) ON DELETE CASCADE,
  INDEX idx_rag_pages_generation (generation_uuid),
  INDEX idx_rag_pages_attachment (attachment_uuid),
  UNIQUE KEY uq_rag_page_segment (generation_uuid, segment_type, segment_number, source_locator(191))
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS rag_attachment_chunks (
  chunk_public_id UUID NOT NULL PRIMARY KEY,
  generation_uuid UUID NOT NULL,
  attachment_uuid UUID NOT NULL,
  chunk_index INT NOT NULL,
  content TEXT NOT NULL,
  source_page_uuid UUID NOT NULL,
  segment_type ENUM('PAGE', 'SECTION', 'SHEET', 'WHOLE_DOCUMENT') NOT NULL,
  segment_number INT NULL,
  segment_label VARCHAR(255) NULL,
  source_locator VARCHAR(1000) NULL,
  start_offset BIGINT NOT NULL,
  end_offset BIGINT NOT NULL,
  doc_type VARCHAR(50) NULL,
  doc_number VARCHAR(100) NULL,
  revision VARCHAR(50) NULL,
  owner_type VARCHAR(50) NOT NULL,
  owner_public_id UUID NOT NULL,
  project_public_id UUID NOT NULL,
  classification ENUM('PUBLIC', 'INTERNAL', 'CONFIDENTIAL') NOT NULL DEFAULT 'INTERNAL',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  FOREIGN KEY (generation_uuid) REFERENCES rag_attachment_generations (generation_uuid) ON DELETE CASCADE,
  FOREIGN KEY (attachment_uuid) REFERENCES attachments (uuid) ON DELETE CASCADE,
  FOREIGN KEY (source_page_uuid) REFERENCES rag_attachment_pages (page_uuid) ON DELETE CASCADE,
  UNIQUE KEY uq_rag_chunk_order (generation_uuid, chunk_index),
  INDEX idx_rag_chunks_attachment (attachment_uuid),
  INDEX idx_rag_chunks_generation (generation_uuid),
  INDEX idx_rag_chunks_project (project_public_id),
  INDEX idx_rag_chunks_owner (owner_type, owner_public_id),
  FULLTEXT INDEX ft_rag_chunks_content (content)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- Precondition is required: this intentionally removes the legacy RAG table.
DROP TABLE IF EXISTS document_chunks;
