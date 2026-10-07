-- Rollback: 2026-10-06-org-role-per-context.sql
-- คืน schema เดิม (organizations.role_id + contract_organizations.role_in_contract)
-- ⚠️ ข้อมูล free-text เดิมใน role_in_contract จะหาย — rollback จะคืนค่าจาก role_id โดย map role_name กลับเป็น title-case

-- 1. คืน columns เดิม
ALTER TABLE contract_organizations
  ADD COLUMN role_in_contract VARCHAR(100) NULL AFTER organization_id;

ALTER TABLE organizations
  ADD COLUMN role_id INT NULL COMMENT 'บทบาทขององค์กร' AFTER organization_name,
  ADD FOREIGN KEY (role_id) REFERENCES organization_roles (id) ON DELETE SET NULL;

-- 2. คืน role_in_contract จาก role_id (map กลับเป็น title-case ตาม seed เดิม)
UPDATE contract_organizations co
  JOIN organization_roles r ON r.id = co.role_id
  SET co.role_in_contract = CASE r.role_name
    WHEN 'OWNER' THEN 'Owner'
    WHEN 'DESIGNER' THEN 'Designer'
    WHEN 'CONSULTANT' THEN 'Consultant'
    WHEN 'CONTRACTOR' THEN 'Contractor'
    WHEN 'THIRD PARTY' THEN 'Third Party'
    ELSE r.role_name
  END;

-- 3. คืน organizations.role_id จาก contract role แรกที่พบ (best effort — global role เดิมอาจไม่ตรง)
UPDATE organizations o
  SET o.role_id = (
    SELECT co.role_id FROM contract_organizations co
    WHERE co.organization_id = o.id AND co.role_id IS NOT NULL
    LIMIT 1
  );

-- 4. Drop columns ใหม่
ALTER TABLE contract_organizations
  DROP FOREIGN KEY fk_co_role,
  DROP COLUMN role_id;

ALTER TABLE project_organizations
  DROP FOREIGN KEY fk_po_role,
  DROP COLUMN role_id;

-- 5. คืน view เดิม
DROP VIEW IF EXISTS v_contract_parties_all;
CREATE VIEW v_contract_parties_all AS
SELECT c.id AS contract_id,
  c.uuid AS contract_uuid,
  c.contract_code,
  c.contract_name,
  p.id AS project_id,
  p.uuid AS project_uuid,
  p.project_code,
  p.project_name,
  o.id AS organization_id,
  o.uuid AS organization_uuid,
  o.organization_code,
  o.organization_name,
  co.role_in_contract
FROM contracts c
  INNER JOIN projects p ON c.project_id = p.id
  INNER JOIN contract_organizations co ON c.id = co.contract_id
  INNER JOIN organizations o ON co.organization_id = o.id
WHERE c.is_active = TRUE;
