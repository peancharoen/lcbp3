-- File: specs/03-Data-and-Storage/deltas/2026-06-05-add-rag-chunking-prompt.rollback.sql
-- Rollback การเพิ่ม Prompt สำหรับ Semantic Chunking
-- Change Log:
-- - 2026-06-05: Initial rollback (T002)

DELETE FROM ai_prompts
WHERE prompt_type = 'rag_chunking'
  AND version_number = 1;
