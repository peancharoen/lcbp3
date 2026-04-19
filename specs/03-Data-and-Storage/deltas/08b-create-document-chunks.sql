-- Delta 08b: ADR-022 RAG — สร้างตาราง document_chunks สำหรับเก็บ vector metadata
-- Apply: 2026-04-19
-- Ref: specs/08-Tasks/ADR-022-Retrieval-Augmented-Generation/data-model.md §1.2

CREATE TABLE document_chunks (
  id                CHAR(36)      NOT NULL PRIMARY KEY COMMENT 'UUID = Qdrant point ID',
  document_id       CHAR(36)      NOT NULL COMMENT 'FK → attachments.public_id (UUIDv7)',
  chunk_index       INT           NOT NULL COMMENT 'ลำดับ chunk ภายใน document',
  content           TEXT          NOT NULL COMMENT 'เนื้อหา chunk หลัง PyThaiNLP normalize',
  doc_type          VARCHAR(20)   NOT NULL COMMENT 'CORR, RFA, DRAWING, CONTRACT, RPT, TRANS',
  doc_number        VARCHAR(100)  NULL     COMMENT 'หมายเลขเอกสาร เช่น REF-2026-001',
  revision          VARCHAR(20)   NULL     COMMENT 'Revision เช่น Rev.A',
  project_code      VARCHAR(50)   NOT NULL COMMENT 'รหัสโครงการ (ใช้ filter)',
  project_public_id CHAR(36)      NOT NULL COMMENT 'UUIDv7 ของโครงการ (Qdrant tenant key)',
  version           VARCHAR(20)   NULL     COMMENT 'เวอร์ชันเอกสาร เช่น 1.0, 2.1 (ถ้ามี)',
  classification    ENUM('PUBLIC', 'INTERNAL', 'CONFIDENTIAL')
                                  NOT NULL DEFAULT 'INTERNAL',
  embedding_model   VARCHAR(100)  NOT NULL DEFAULT 'nomic-embed-text',
  created_at        DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  INDEX idx_chunks_document_id     (document_id),
  INDEX idx_chunks_doc_number_rev  (doc_number, revision),
  INDEX idx_chunks_project         (project_public_id),
  FULLTEXT INDEX ft_chunks_content (content)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
