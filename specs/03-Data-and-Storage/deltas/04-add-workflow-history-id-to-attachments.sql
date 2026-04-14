-- ============================================================
-- Delta 04: ADR-021 — Step-specific Attachments
-- เพิ่ม FK workflow_history_id ใน attachments table
-- ============================================================
-- ข้อควรระวัง: ค่า NULL = ไฟล์แนบหลัก (Main Document)
--              ค่าไม่ NULL = ไฟล์ประจำ Workflow Step นั้น

ALTER TABLE attachments
  ADD COLUMN workflow_history_id CHAR(36) NULL
    COMMENT 'FK to workflow_histories.id สำหรับไฟล์แนบประจำ Step (ADR-021). NULL = ไฟล์แนบหลัก',
  ADD CONSTRAINT fk_attachments_workflow_history
    FOREIGN KEY (workflow_history_id)
    REFERENCES workflow_histories (id)
    ON DELETE SET NULL
    ON UPDATE CASCADE;

-- Index สำหรับ optimize การดึงไฟล์แนบตาม Step + เรียงตามวันที่
CREATE INDEX idx_att_wfhist_created
  ON attachments (workflow_history_id, created_at);

-- ============================================================
-- Rollback:
-- ALTER TABLE attachments DROP FOREIGN KEY fk_attachments_workflow_history;
-- ALTER TABLE attachments DROP COLUMN workflow_history_id;
-- ============================================================
