-- Delta 08c: ADR-022 RAG — เพิ่ม permissions สำหรับ RAG feature
-- Apply: 2026-04-19
-- Ref: specs/08-Tasks/ADR-022-Retrieval-Augmented-Generation/tasks.md T014

INSERT IGNORE INTO permissions (permission_name, description, module, created_at, updated_at)
VALUES
  ('rag.query',  'ใช้งาน RAG Q&A เพื่อค้นหาคำตอบจากเอกสาร',      'rag', NOW(), NOW()),
  ('rag.manage', 'จัดการ RAG ingestion, re-index, ลบ vectors',     'rag', NOW(), NOW());
