-- Delta: Create ai_rag_query_logs table for persistent RAG query logging
-- Date: 2026-09-08
-- Related ADR: ADR-023/023A (AI boundary), ADR-019 (UUID)
-- Related Spec: RAG/Retrieval Architecture Review — pain point: AiRagService.processQuery()
--   previously wrote results only to Redis (saveJobResult, 300s TTL), so no durable data
--   existed to evaluate proposed changes (Elasticsearch fusion, summary-index granularity).
-- Applied in: v1.9.17 → v1.9.18

-- ------------------------------------------------------------
-- Schema changes
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS ai_rag_query_logs (
  id INT AUTO_INCREMENT PRIMARY KEY COMMENT 'Internal PK (ห้าม expose ใน API)',
  public_id UUID NOT NULL UNIQUE COMMENT 'ADR-019 — ใช้ค่าเดียวกับ requestPublicId (BullMQ idempotencyKey), ไม่ generate ใหม่',
  project_public_id UUID NOT NULL COMMENT 'project ที่ query นี้ scope อยู่ (ADR-023A isolation)',
  user_public_id UUID NULL COMMENT 'NULL เมื่อเรียกจาก system/internal ไม่ใช่ user login จริง',
  question TEXT NOT NULL,
  answer TEXT NULL COMMENT 'NULL เมื่อ status = failed',
  status ENUM('completed', 'failed') NOT NULL,
  confidence_score FLOAT NULL COMMENT 'top-1 rerank score จาก finalResults[0].score',
  used_fallback_model TINYINT(1) NOT NULL DEFAULT 0,
  citations_json JSON NULL COMMENT 'AiRagCitation[] — pointId, score, docType, docNumber, snippet',
  error_message TEXT NULL,
  processing_time_ms INT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_rag_query_logs_project (project_public_id),
  KEY idx_rag_query_logs_status (status),
  KEY idx_rag_query_logs_created_at (created_at)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci
  COMMENT = 'Persistent log of RAG query interactions (question/answer/confidence/citations) — added to unblock data-driven decisions on ES fusion / summary-index routing, since prior RAG results only lived in Redis with a 300s TTL';

-- ------------------------------------------------------------
-- Verification query (optional)
-- ------------------------------------------------------------

-- SELECT status, COUNT(*), AVG(confidence_score) FROM ai_rag_query_logs GROUP BY status;
