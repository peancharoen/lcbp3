-- Rollback: 2026-09-17-ai-rag-query-logs-retrieval-mode.sql
-- Date: 2026-09-17

ALTER TABLE ai_rag_query_logs
  DROP COLUMN IF EXISTS retrieval_mode;
