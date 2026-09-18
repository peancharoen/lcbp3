-- Delta: เพิ่ม retrieval_mode ให้ ai_rag_query_logs
-- Date: 2026-09-17
-- Related: RAG Admin Console metrics (Phase 3 — DB-derived lifetime stats),
--          AiRagService.processQuery() T040 (retrievalMode: VECTOR | FULL_TEXT | HYBRID)
--
-- วัตถุประสงค์: persist โหมด retrieval ที่ใช้ผลิตคำตอบแต่ละครั้ง เพื่อให้
--   RAG Admin Console derive fallback rate จาก DB ได้ (historical accuracy)
--   แทนการพึ่ง in-memory counters ที่หายเมื่อ backend restart
--
-- Column definitions:
--   retrieval_mode — โหมด retrieval ตาม T040
--     VECTOR    = ใช้ vector search เพียงอย่างเดียว (ACTIVE chunks ≥ threshold)
--     FULL_TEXT = fall back สู่ MariaDB FULLTEXT (ไม่มี ACTIVE vector chunks)
--     HYBRID    = merge vector + full-text (vector < threshold แต่ full-text มีผล)
--   NULL สำหรับ rows ที่สร้างก่อน column นี้มี (ไม่ทราบ mode ย้อนหลัง)

ALTER TABLE ai_rag_query_logs
  ADD COLUMN IF NOT EXISTS retrieval_mode ENUM('VECTOR', 'FULL_TEXT', 'HYBRID') NULL
    COMMENT 'โหมด retrieval ที่ใช้ผลิตคำตอบ (T040) — NULL สำหรับ rows ก่อน column นี้มี'
    AFTER used_fallback_model;

-- ------------------------------------------------------------
-- Verification query (optional)
-- ------------------------------------------------------------

-- SELECT retrieval_mode, COUNT(*) FROM ai_rag_query_logs GROUP BY retrieval_mode;
