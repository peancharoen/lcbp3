-- ==========================================================
-- Delta 07: Add contract_id to workflow_instances (C3 Contract Scoping)
-- ==========================================================
-- Purpose  : เพิ่ม contract_id FK ใน workflow_instances เพื่อให้ Workflow Engine
--            แยก scope ตาม Contract ได้ (C3 ตาม analysis ADR-021)
-- Why      : RFA / Correspondence / Transmittal → contract-scoped (contractId ถูกตั้ง)
--            Circulation → organization-scoped (contractId = NULL, ใช้ Level 2 org check)
--            Guard Level 2.5 ตรวจ contract_organizations membership เฉพาะ contractId ≠ NULL
-- ADR      : ADR-009 (no migrations — direct SQL only)
-- ==========================================================
ALTER TABLE workflow_instances
ADD COLUMN contract_id INT NULL COMMENT 'Contract ที่ Workflow นี้เป็นส่วนหนึ่ง (NULL = global/legacy)'
AFTER definition_id,
  ADD CONSTRAINT fk_wf_inst_contract FOREIGN KEY (contract_id) REFERENCES contracts (id) ON DELETE
SET NULL;

-- Index สำหรับ Guard lookup: "Instances ทั้งหมดในสัญญา X"
CREATE INDEX idx_wf_inst_contract ON workflow_instances (contract_id, entity_type, STATUS);

-- Verify
-- DESCRIBE workflow_instances;
-- SHOW INDEX FROM workflow_instances WHERE Key_name = 'idx_wf_inst_contract';
