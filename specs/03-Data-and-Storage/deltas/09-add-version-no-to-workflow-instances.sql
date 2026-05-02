-- ============================================================
-- Delta 09: ADR-001 v1.1 — Optimistic Lock for Workflow Transitions
-- เพิ่ม version_no ใน workflow_instances สำหรับ Optimistic Concurrency Control
-- ============================================================
-- Feature: 003-unified-workflow-engine (FR-002)
-- Date: 2026-05-03
-- ข้อควรระวัง: Existing rows จะได้ค่า DEFAULT 1 อัตโนมัติ — ไม่มี Data Loss
-- Rollback: ALTER TABLE workflow_instances DROP INDEX idx_wf_inst_version;
--           ALTER TABLE workflow_instances DROP COLUMN version_no;

ALTER TABLE workflow_instances
  ADD COLUMN version_no INT NOT NULL DEFAULT 1
    COMMENT 'Optimistic lock counter — incremented on every successful transition (ADR-001 v1.1 FR-002). Client sends current value; server rejects with 409 if mismatch.';

-- Index เพื่อรองรับ CAS check: WHERE id = ? AND version_no = ?
CREATE INDEX idx_wf_inst_version
  ON workflow_instances (id, version_no);
