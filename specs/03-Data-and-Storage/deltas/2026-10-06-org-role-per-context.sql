-- Schema Change Delta
-- Date: 2026-10-06
-- Feature: ย้ายบทบาทองค์กรจาก global (organizations.role_id) ไปเป็น per-contract/project
-- Tables affected: organizations, project_organizations, contract_organizations
-- Related: v_contract_parties_all (views)
--
-- ⚠️ Apply this SQL to the live database manually (No-migration policy, ADR-044)
-- ลำดับที่แนะนำ: backfill ข้อมูลก่อน (step 2-4) แล้วค่อย drop column (step 5)

-- ============================================================
-- 1. เพิ่ม column role_id ให้ junction tables
-- ============================================================
ALTER TABLE project_organizations
  ADD COLUMN role_id INT NULL COMMENT 'บทบาทขององค์กรใน project นี้ (FK → organization_roles)' AFTER organization_id,
  ADD CONSTRAINT fk_po_role FOREIGN KEY (role_id) REFERENCES organization_roles (id) ON DELETE SET NULL;

ALTER TABLE contract_organizations
  ADD COLUMN role_id INT NULL COMMENT 'บทบาทขององค์กรใน contract นี้ (FK → organization_roles)' AFTER organization_id,
  ADD CONSTRAINT fk_co_role FOREIGN KEY (role_id) REFERENCES organization_roles (id) ON DELETE SET NULL;

-- ============================================================
-- 2. Backfill contract_organizations.role_id จาก role_in_contract (free-text)
--    mapping ตาม seed ปัจจุบัน — ตรวจสอบค่าจริงใน production ก่อนรัน
-- ============================================================
UPDATE contract_organizations co
  JOIN organization_roles r ON r.role_name = 'OWNER'
  SET co.role_id = r.id
  WHERE co.role_in_contract IN ('Owner', 'OWNER');

UPDATE contract_organizations co
  JOIN organization_roles r ON r.role_name = 'DESIGNER'
  SET co.role_id = r.id
  WHERE co.role_in_contract IN ('Designer', 'DESIGNER');

UPDATE contract_organizations co
  JOIN organization_roles r ON r.role_name = 'CONSULTANT'
  SET co.role_id = r.id
  WHERE co.role_in_contract IN ('Consultant', 'CONSULTANT');

UPDATE contract_organizations co
  JOIN organization_roles r ON r.role_name = 'CONTRACTOR'
  SET co.role_id = r.id
  WHERE co.role_in_contract IN ('Contractor', 'CONTRACTOR');

UPDATE contract_organizations co
  JOIN organization_roles r ON r.role_name = 'THIRD PARTY'
  SET co.role_id = r.id
  WHERE co.role_in_contract IN ('Third Party', 'THIRD PARTY', 'THIRD_PARTY');

-- ตรวจ orphan values ก่อน drop (ค่าที่ map ไม่ได้จะเหลือ NULL)
-- SELECT DISTINCT role_in_contract FROM contract_organizations WHERE role_id IS NULL;

-- ============================================================
-- 3. Backfill project_organizations.role_id จาก organizations.role_id เดิม
--    (องค์กรที่เคยมี global role — สันนิษฐานว่า role เดียวกันใน project ที่เป็นสมาชิก)
--    ⚠️ ทบทวนก่อนรัน: ถ้า role ใน project ไม่ควรตรงกับ global role เสมอไป ให้ปรับ mapping เอง
-- ============================================================
UPDATE project_organizations po
  JOIN organizations o ON o.id = po.organization_id
  SET po.role_id = o.role_id
  WHERE o.role_id IS NOT NULL;

-- ============================================================
-- 4. Backfill contract_organizations ที่ยังไม่มี role_id
--    จาก organizations.role_id เดิม (กรณี role_in_contract เป็น NULL)
-- ============================================================
UPDATE contract_organizations co
  JOIN organizations o ON o.id = co.organization_id
  SET co.role_id = o.role_id
  WHERE co.role_id IS NULL AND o.role_id IS NOT NULL;

-- ============================================================
-- 5. Drop columns เดิม (ต้อง drop FK constraint ของ organizations.role_id ก่อน)
--    ⚠️ ชื่อ constraint จริงอาจต่างจากนี้ — ตรวจด้วย
--    SHOW CREATE TABLE organizations;
-- ============================================================
ALTER TABLE contract_organizations DROP COLUMN role_in_contract;

ALTER TABLE organizations
  DROP FOREIGN KEY organizations_ibfk_1,   -- ⚠️ เปลี่ยนเป็นชื่อ constraint จริงถ้าต่าง
  DROP COLUMN role_id;

-- ============================================================
-- 6. Recreate view ที่อ้าง role_in_contract (ดู schema-03-views-indexes.sql)
-- ============================================================
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
  orole.role_name AS role_in_contract
FROM contracts c
  INNER JOIN projects p ON c.project_id = p.id
  INNER JOIN contract_organizations co ON c.id = co.contract_id
  INNER JOIN organizations o ON co.organization_id = o.id
  LEFT JOIN organization_roles orole ON co.role_id = orole.id
WHERE c.is_active = TRUE;
