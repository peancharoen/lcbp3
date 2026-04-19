-- Delta 08: ADR-022 RAG — เพิ่ม rag_status และ rag_last_error ในตาราง attachments
-- Apply: 2026-04-19
-- Ref: specs/08-Tasks/ADR-022-Retrieval-Augmented-Generation/data-model.md §1.1

ALTER TABLE attachments
  ADD COLUMN rag_status ENUM('PENDING', 'PROCESSING', 'INDEXED', 'FAILED')
    NOT NULL DEFAULT 'PENDING'
    COMMENT 'สถานะ RAG ingestion ระดับ file',
  ADD COLUMN rag_last_error TEXT NULL
    COMMENT 'Error message ล่าสุดเมื่อ rag_status = FAILED',
  ADD INDEX idx_attachments_rag_status (rag_status);
