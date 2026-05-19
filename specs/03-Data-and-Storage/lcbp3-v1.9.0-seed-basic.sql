-- ==========================================================
-- DMS v1.9.0 Document Management System Database
-- Deploy Script Schema
-- Server: Container Station on QNAP TS-473A
-- Database service: MariaDB 11.8
-- database web ui: phpmyadmin 5-apache
-- database development ui: DBeaver
-- backend service: NestJS
-- frontend service: next.js
-- reverse proxy: jc21/nginx-proxy-manager:latest
-- cron service: n8n
-- ==========================================================
-- [v1.9.0 UPDATE] Prepare migration
-- Update: Upgraded from v1.7.0
-- Last Updated: 2026-02-27
-- Major Changes:
--   1. เพิ่ม:
--      2.1 username = migration_bot
--      2.2
-- ==========================================================
INSERT INTO organization_roles (id, role_name)
VALUES (1, 'OWNER'),
  (2, 'DESIGNER'),
  (3, 'CONSULTANT'),
  (4, 'CONTRACTOR'),
  (5, 'THIRD PARTY'),
  (6, 'GUEST');

INSERT INTO organizations (
    id,
    organization_code,
    organization_name,
    role_id
  )
VALUES (1, 'กทท.', 'การท่าเรือแห่งประเทศไทย', 1),
  (
    10,
    'สคฉ.3',
    'โครงการพัฒนาท่าเรือแหลมฉบัง ระยะที่ 3',
    1
  ),
  (
    11,
    'สคฉ.3-01',
    'ตรวจรับพัสดุ ที่ปรึกษาควบคุมงาน',
    1
  ),
  (12, 'สคฉ.3-02', 'ตรวจรับพัสดุ งานทางทะเล', 1),
  (
    13,
    'สคฉ.3-03',
    'ตรวจรับพัสดุ อาคารและระบบสาธารณูปโภค',
    1
  ),
  (
    14,
    'สคฉ.3-04',
    'ตรวจรับพัสดุ ตรวจสอบผลกระทบสิ่งแวดล้อม',
    1
  ),
  (
    15,
    'สคฉ.3-05',
    'ตรวจรับพัสดุ เยียวยาการประมง',
    1
  ),
  (
    16,
    'สคฉ.3-06',
    'ตรวจรับพัสดุ งานก่อสร้าง ส่วนที่ 3',
    1
  ),
  (
    17,
    'สคฉ.3-07',
    'ตรวจรับพัสดุ งานก่อสร้าง ส่วนที่ 4',
    1
  ),
  (
    18,
    'สคฉ.3-xx',
    'ตรวจรับพัสดุ ที่ปรึกษาออกแบบ ส่วนที่ 4',
    1
  ),
  (21, 'TEAM', 'Designer Consulting Ltd.', 2),
  (22, 'คคง.', 'Construction Supervision Ltd.', 3),
  (41, 'ผรม.1', 'Contractor งานทางทะเล', 4),
  (42, 'ผรม.2', 'Contractor งานก่อสร้าง', 4),
  (
    43,
    'ผรม.3',
    'Contractor งานก่อสร้าง ส่วนที่ 3',
    4
  ),
  (
    44,
    'ผรม.4',
    'Contractor งานก่อสร้าง ส่วนที่ 4',
    4
  ),
  (31, 'EN', 'Third Party Environment', 5),
  (32, 'CAR', 'Third Party Fishery Care', 5);

-- Seed project
INSERT INTO projects (project_code, project_name)
VALUES (
    'LCBP3',
    'โครงการพัฒนาท่าเรือแหลมฉบัง ระยะที่ 3 (ส่วนที่ 1-4)'
  ),
  (
    'LCBP3-C1',
    'โครงการพัฒนาท่าเรือแหลมฉบัง ระยะที่ 3 (ส่วนที่ 1) งานก่อสร้างงานทางทะเล'
  ),
  (
    'LCBP3-C2',
    'โครงการพัฒนาท่าเรือแหลมฉบัง ระยะที่ 3 (ส่วนที่ 2) งานก่อสร้างอาคาร ท่าเทียบเรือ ระบบถนน และระบบสาธารณูปโภค'
  ),
  (
    'LCBP3-C3',
    'โครงการพัฒนาท่าเรือแหลมฉบัง ระยะที่ 3 (ส่วนที่ 3) งานก่อสร้าง'
  ),
  (
    'LCBP3-C4',
    'โครงการพัฒนาท่าเรือแหลมฉบัง ระยะที่ 3 (ส่วนที่ 4) งานก่อสร้าง'
  ),
  (
    'LCBP3-EN',
    'โครงการพัฒนาท่าเรือแหลมฉบัง ระยะที่ 3 (ส่วนที่ 4) งานก่อสร้าง'
  );

-- Seed contract
-- ใช้ Subquery เพื่อดึง project_id มาเชื่อมโยง ทำให้ไม่ต้องมานั่งจัดการ ID ด้วยตัวเอง
INSERT INTO contracts (
    contract_code,
    contract_name,
    project_id,
    is_active
  )
VALUES (
    'LCBP3-DS',
    'งานจ้างที่ปรีกษาออกแบบ โครงการพัฒนาท่าเรือแหลมฉบัง ระยะที่ 3 (ส่วนที่ 1-4)',
    (
      SELECT id
      FROM projects
      WHERE project_code = 'LCBP3'
    ),
    TRUE
  ),
  (
    'LCBP3-PS',
    'งานจ้างที่ปรีกษาควบคุมงาน โครงการพัฒนาท่าเรือแหลมฉบัง ระยะที่ 3 (ส่วนที่ 1-4)',
    (
      SELECT id
      FROM projects
      WHERE project_code = 'LCBP3'
    ),
    TRUE
  ),
  (
    'LCBP3-C1',
    'งานก่อสร้าง โครงการพัฒนาท่าเรือแหลมฉบัง ระยะที่ 3 (ส่วนที่ 1) งานก่อสร้างงานทางทะเล',
    (
      SELECT id
      FROM projects
      WHERE project_code = 'LCBP3-C1'
    ),
    TRUE
  ),
  (
    'LCBP3-C2',
    'งานก่อสร้าง โครงการพัฒนาท่าเรือแหลมฉบัง ระยะที่ 3 (ส่วนที่ 2) งานก่อสร้างอาคาร ท่าเทียบเรือ ระบบถนน และระบบสาธารณูปโภค',
    (
      SELECT id
      FROM projects
      WHERE project_code = 'LCBP3-C2'
    ),
    TRUE
  ),
  (
    'LCBP3-C3',
    'งานก่อสร้าง โครงการพัฒนาท่าเรือแหลมฉบัง ระยะที่ 3 (ส่วนที่ 3) งานก่อสร้าง',
    (
      SELECT id
      FROM projects
      WHERE project_code = 'LCBP3-C3'
    ),
    TRUE
  ),
  (
    'LCBP3-C4',
    'งานก่อสร้าง โครงการพัฒนาท่าเรือแหลมฉบัง ระยะที่ 3 (ส่วนที่ 4) งานก่อสร้าง',
    (
      SELECT id
      FROM projects
      WHERE project_code = 'LCBP3-C4'
    ),
    TRUE
  ),
  (
    'LCBP3-EN',
    'งานก่อสร้าง โครงการพัฒนาท่าเรือแหลมฉบัง ระยะที่ 3 (ส่วนที่ 4) งานก่อสร้าง',
    (
      SELECT id
      FROM projects
      WHERE project_code = 'LCBP3-EN'
    ),
    TRUE
  );

-- Seed user
-- Initial SUPER_ADMIN user
INSERT INTO users (
    user_id,
    username,
    password_hash,
    first_name,
    last_name,
    email,
    line_id,
    primary_organization_id
  )
VALUES (
    1,
    'superadmin',
    '$2b$10$60HqaxJFZSF8.n.kOPubge2pK3SXbz4tmNTmrQB/coZ8QXrFMcdIK',
    'Super',
    'Admin',
    'superadmin @example.com',
    NULL,
    NULL
  ),
  (
    2,
    'admin',
    '$2b$10$60HqaxJFZSF8.n.kOPubge2pK3SXbz4tmNTmrQB/coZ8QXrFMcdIK',
    'Admin',
    'คคง.',
    'admin@example.com',
    NULL,
    1
  ),
  (
    3,
    'editor01',
    '$2b$10$60HqaxJFZSF8.n.kOPubge2pK3SXbz4tmNTmrQB/coZ8QXrFMcdIK',
    'DC',
    'C1',
    'editor01 @example.com',
    NULL,
    41
  ),
  (
    4,
    'viewer01',
    '$2b$10$60HqaxJFZSF8.n.kOPubge2pK3SXbz4tmNTmrQB/coZ8QXrFMcdIK',
    'Viewer',
    'สคฉ.03',
    'viewer01@example.com',
    NULL,
    10
  );

INSERT INTO users (
    user_id,
    username,
    password_hash,
    first_name,
    last_name,
    email,
    line_id,
    primary_organization_id
  )
VALUES (
    5,
    'migration_bot',
    '$2b$10$60HqaxJFZSF8.n.kOPubge2pK3SXbz4tmNTmrQB/coZ8QXrFMcdIK',
    'Migration',
    'Bot',
    'migration@system.internal',
    NULL,
    1
  );

-- ==========================================================
-- Seed Roles (บทบาทพื้นฐาน 5 บทบาท ตาม Req 4.3)
-- ==========================================================
-- 1. Superadmin (Global)
INSERT INTO roles (role_id, role_name, scope, description)
VALUES (
    1,
    'Superadmin',
    'Global',
    'ผู้ดูแลระบบสูงสุด: สามารถทำทุกอย่างในระบบ, จัดการองค์กร, และจัดการข้อมูลหลักระดับ Global'
  ),
  -- 2. Org Admin (Organization)
  (
    2,
    'Org Admin',
    'Organization',
    'ผู้ดูแลองค์กร: จัดการผู้ใช้ในองค์กร, จัดการบทบาท / สิทธิ์ภายในองค์กร, และดูรายงานขององค์กร'
  ),
  -- 3. Document Control (Organization)
  (
    3,
    'Document Control',
    'Organization',
    'ควบคุมเอกสารขององค์กร: เพิ่ม / แก้ไข / ลบเอกสาร, และกำหนดสิทธิ์เอกสารภายในองค์กร'
  ),
  -- 4. Editor (Organization)
  (
    4,
    'Editor',
    'Organization',
    'ผู้แก้ไขเอกสารขององค์กร: เพิ่ม / แก้ไขเอกสารที่ได้รับมอบหมาย'
  ),
  -- 5. Viewer (Organization)
  (
    5,
    'Viewer',
    'Organization',
    'ผู้ดูเอกสารขององค์กร: ดูเอกสารที่มีสิทธิ์เข้าถึงเท่านั้น'
  ),
  -- 6. Project Manager (Project)
  (
    6,
    'Project Manager',
    'Project',
    'ผู้จัดการโครงการ: จัดการสมาชิกในโครงการ, สร้าง / จัดการสัญญาในโครงการ, และดูรายงานโครงการ'
  ),
  -- 7. Contract Admin (Contract)
  (
    7,
    'Contract Admin',
    'Contract',
    'ผู้ดูแลสัญญา: จัดการสมาชิกในสัญญา, สร้าง / จัดการข้อมูลหลักเฉพาะสัญญา, และอนุมัติเอกสารในสัญญา'
  );

-- ==========================================================
-- Seed Role-Permissions Mapping (จับคู่สิทธิ์เริ่มต้น)
-- ==========================================================
-- Seed data for the 'role_permissions 'table
-- This table links roles to their specific permissions.
-- NOTE: This assumes the role_id and permission_id FROM the previous seed data files.
-- Superadmin (role_id = 1), Org Admin (role_id = 2), Document Control (role_id = 3), etc.
-- ==========================================================
-- SECTION 2: ROLE-PERMISSION MAPPINGS
-- ==========================================================
-- Seed data for the 'user_assignments' table
INSERT INTO user_assignments (
    id,
    user_id,
    role_id,
    organization_id,
    project_id,
    contract_id,
    assigned_by_user_id
  )
VALUES (1, 1, 1, NULL, NULL, NULL, NULL),
  -- superadmin: Global scope (organization_id = NULL)
  (2, 2, 2, 1, NULL, NULL, NULL),
  -- admin: Organization scope (org_id=1 = กทท.)
  (3, 3, 4, 41, NULL, NULL, 1),
  -- editor01: Editor role (role_id=4) at organization 41 (คคง.), assigned by superadmin
  (4, 4, 5, 10, NULL, NULL, 1),
  -- viewer01: Viewer role (role_id=5) at organization 10 (สคฉ.03), assigned by superadmin
  (5, 5, 1, NULL, NULL, NULL, 1);

-- migration_bot: Superadmin role (role_id=1) for migration scripts, assigned by superadmin
-- =====================================================
-- == 4. การเชื่อมโยงโครงการกับองค์กร (project_organizations) ==
-- =====================================================
-- โครงการหลัก (LCBP3) จะมีองค์กรหลักๆ เข้ามาเกี่ยวข้องทั้งหมด
INSERT INTO project_organizations (project_id, organization_id)
SELECT (
    SELECT id
    FROM projects
    WHERE project_code = 'LCBP3'
  ),
  id
FROM organizations
WHERE organization_code IN (
    'กทท.',
    'สคฉ.3',
    'TEAM',
    'คคง.',
    'ผรม.1',
    'ผรม.2',
    'ผรม.3',
    'ผรม.4',
    'EN',
    'CAR'
  );

-- โครงการย่อย (LCBP3C1) จะมีเฉพาะองค์กรที่เกี่ยวข้อง
INSERT INTO project_organizations (project_id, organization_id)
SELECT (
    SELECT id
    FROM projects
    WHERE project_code = 'LCBP3-C1'
  ),
  id
FROM organizations
WHERE organization_code IN (
    'กทท.',
    'สคฉ.3',
    'สคฉ.3 -02',
    'คคง.',
    'ผรม.1 '
  );

-- ทำเช่นเดียวกันสำหรับโครงการอื่นๆ (ตัวอย่าง)
INSERT INTO project_organizations (project_id, organization_id)
SELECT (
    SELECT id
    FROM projects
    WHERE project_code = 'LCBP3-C2'
  ),
  id
FROM organizations
WHERE organization_code IN (
    'กทท.',
    'สคฉ.3',
    'สคฉ.3 -03',
    'คคง.',
    'ผรม.2'
  );

-- =====================================================
-- == 5. การเชื่อมโยงสัญญากับองค์กร (contract_organizations) ==
-- =====================================================
-- สัญญาที่ปรึกษาออกแบบ (DSLCBP3)
INSERT INTO contract_organizations (contract_id, organization_id, role_in_contract)
VALUES (
    (
      SELECT id
      FROM contracts
      WHERE contract_code = 'LCBP3-DS'
    ),
    (
      SELECT id
      FROM organizations
      WHERE organization_code = 'กทท.'
    ),
    'Owner'
  ),
  (
    (
      SELECT id
      FROM contracts
      WHERE contract_code = 'LCBP3-DS'
    ),
    (
      SELECT id
      FROM organizations
      WHERE organization_code = 'TEAM'
    ),
    'Designer'
  );

-- สัญญาที่ปรึกษาควบคุมงาน (PSLCBP3)
INSERT INTO contract_organizations (contract_id, organization_id, role_in_contract)
VALUES (
    (
      SELECT id
      FROM contracts
      WHERE contract_code = 'LCBP3-PS'
    ),
    (
      SELECT id
      FROM organizations
      WHERE organization_code = 'กทท.'
    ),
    'Owner'
  ),
  (
    (
      SELECT id
      FROM contracts
      WHERE contract_code = 'LCBP3-PS'
    ),
    (
      SELECT id
      FROM organizations
      WHERE organization_code = 'คคง.'
    ),
    'Consultant'
  );

-- สัญญางานก่อสร้าง ส่วนที่ 1 (LCBP3-C1)
INSERT INTO contract_organizations (contract_id, organization_id, role_in_contract)
VALUES (
    (
      SELECT id
      FROM contracts
      WHERE contract_code = 'LCBP3-C1'
    ),
    (
      SELECT id
      FROM organizations
      WHERE organization_code = 'กทท.'
    ),
    'Owner'
  ),
  (
    (
      SELECT id
      FROM contracts
      WHERE contract_code = 'LCBP3-C1'
    ),
    (
      SELECT id
      FROM organizations
      WHERE organization_code = 'ผรม.1'
    ),
    'Contractor'
  );

-- สัญญางานก่อสร้าง ส่วนที่ 2 (LCBP3-C2)
INSERT INTO contract_organizations (contract_id, organization_id, role_in_contract)
VALUES (
    (
      SELECT id
      FROM contracts
      WHERE contract_code = 'LCBP3-C2'
    ),
    (
      SELECT id
      FROM organizations
      WHERE organization_code = 'กทท.'
    ),
    'Owner'
  ),
  (
    (
      SELECT id
      FROM contracts
      WHERE contract_code = 'LCBP3-C2'
    ),
    (
      SELECT id
      FROM organizations
      WHERE organization_code = 'ผรม.2'
    ),
    'Contractor'
  );

-- สัญญาตรวจสอบสิ่งแวดล้อม (LCBP3-EN)
INSERT INTO contract_organizations (contract_id, organization_id, role_in_contract)
VALUES (
    (
      SELECT id
      FROM contracts
      WHERE contract_code = 'LCBP3-EN'
    ),
    (
      SELECT id
      FROM organizations
      WHERE organization_code = 'กทท.'
    ),
    'Owner'
  ),
  (
    (
      SELECT id
      FROM contracts
      WHERE contract_code = 'LCBP3-EN'
    ),
    (
      SELECT id
      FROM organizations
      WHERE organization_code = 'EN'
    ),
    'Consultant'
  );

-- Seed correspondence_status
INSERT INTO correspondence_status (
    status_code,
    status_name,
    sort_order,
    is_active
  )
VALUES ('DRAFT', 'Draft', 10, 1),
  ('SUBOWN', 'Submitted to Owner', 21, 1),
  ('SUBDSN', 'Submitted to Designer', 22, 1),
  ('SUBCSC', 'Submitted to CSC', 23, 1),
  ('SUBCON', 'Submitted to Contractor', 24, 1),
  ('SUBOTH', 'Submitted to Others', 25, 1),
  ('REPOWN', 'Reply by Owner', 31, 1),
  ('REPDSN', 'Reply by Designer', 32, 1),
  ('REPCSC', 'Reply by CSC', 33, 1),
  ('REPCON', 'Reply by Contractor', 34, 1),
  ('REPOTH', 'Reply by Others', 35, 1),
  ('RSBOWN', 'Resubmited by Owner', 41, 1),
  ('RSBDSN', 'Resubmited by Designer', 42, 1),
  ('RSBCSC', 'Resubmited by CSC', 43, 1),
  ('RSBCON', 'Resubmited by Contractor', 44, 1),
  ('CLBOWN', 'Closed by Owner', 51, 1),
  ('CLBDSN', 'Closed by Designer', 52, 1),
  ('CLBCSC', 'Closed by CSC', 53, 1),
  ('CLBCON', 'Closed by Contractor', 54, 1),
  ('CCBOWN', 'Canceled by Owner', 91, 1),
  ('CCBDSN', 'Canceled by Designer', 92, 1),
  ('CCBCSC', 'Canceled by CSC', 93, 1),
  ('CCBCON', 'Canceled by Contractor', 94, 1);

-- Seed correspondence_types
INSERT INTO correspondence_types (type_code, type_name, sort_order, is_active)
VALUES ('RFA', 'Request for Approval', 1, 1),
  ('RFI', 'Request for Information', 2, 1),
  ('TRANSMITTAL', 'Transmittal', 3, 1),
  ('EMAIL', 'Email', 4, 1),
  ('INSTRUCTION', 'Instruction', 5, 1),
  ('LETTER', 'Letter', 6, 1),
  ('MEMO', 'Memorandum', 7, 1),
  ('MOM', 'Minutes of Meeting', 8, 1),
  ('NOTICE', 'Notice', 9, 1),
  ('OTHER', 'Other', 10, 1);

-- Seed rfa_types
INSERT INTO rfa_types (
    contract_id,
    type_code,
    type_name_en,
    type_name_th
  )
SELECT id,
  'ADW',
  'As Built Drawing',
  'แบบร่างหลังการก่อสร้าง'
FROM contracts
WHERE contract_code = 'LCBP3-C1'
UNION ALL
SELECT id,
  'BC',
  'Box Culvert',
  'ท่อระบายน้ำรูปกล่อง'
FROM contracts
WHERE contract_code = 'LCBP3-C1'
UNION ALL
SELECT id,
  'BM',
  'Benchmark',
  'หมุดหลักฐาน'
FROM contracts
WHERE contract_code = 'LCBP3-C1'
UNION ALL
SELECT id,
  'CER',
  'Certificates',
  'ใบรับรอง'
FROM contracts
WHERE contract_code = 'LCBP3-C1'
UNION ALL
SELECT id,
  'CN',
  'Canal Drainage',
  'ระบบระบายน้ำในคลอง'
FROM contracts
WHERE contract_code = 'LCBP3-C1'
UNION ALL
SELECT id,
  'CON',
  'Contract',
  'สัญญา'
FROM contracts
WHERE contract_code = 'LCBP3-C1'
UNION ALL
SELECT id,
  'DDS',
  'Design Data Submission',
  'นำส่งข้อมูลการออกแบบ'
FROM contracts
WHERE contract_code = 'LCBP3-C1'
UNION ALL
SELECT id,
  'DDW',
  'Draft Drawing',
  'แบบร่าง'
FROM contracts
WHERE contract_code = 'LCBP3-C1'
UNION ALL
SELECT id,
  'DRW',
  'Drawings (All Types)',
  'แบบก่อสร้าง'
FROM contracts
WHERE contract_code = 'LCBP3-C1'
UNION ALL
SELECT id,
  'DSN',
  'Design/Calculation/Manual (All Stages)',
  'ออกแบบ / คำนวณ / คู่มือ'
FROM contracts
WHERE contract_code = 'LCBP3-C1'
UNION ALL
SELECT id,
  'GEN',
  'General',
  'ทั่วไป'
FROM contracts
WHERE contract_code = 'LCBP3-C1'
UNION ALL
SELECT id,
  'ICR',
  'Incident Report',
  'รายงานการเกิดอุบัติเหตุและการบาดเจ็บ'
FROM contracts
WHERE contract_code = 'LCBP3-C1'
UNION ALL
SELECT id,
  'INS',
  'Insurances/Bond/Guarantee',
  'การประกัน / พันธบัตร / การค้ำประกัน'
FROM contracts
WHERE contract_code = 'LCBP3-C1'
UNION ALL
SELECT id,
  'INR',
  'Inspection/Audit/Surveillance Report',
  'รายงานการตรวจสอบ / การตรวจสอบ / รายงานการเฝ้าระวัง'
FROM contracts
WHERE contract_code = 'LCBP3-C1'
UNION ALL
SELECT id,
  'ITP',
  'Inspection and Test Plan',
  'แผนการตรวจสอบและทดสอบ'
FROM contracts
WHERE contract_code = 'LCBP3-C1'
UNION ALL
SELECT id,
  'JSA',
  'Jobs Analysis',
  'รายงานการวิเคราะห์ความปลอดภัย'
FROM contracts
WHERE contract_code = 'LCBP3-C1'
UNION ALL
SELECT id,
  'MAN',
  'Manual',
  'คู่มือ'
FROM contracts
WHERE contract_code = 'LCBP3-C1'
UNION ALL
SELECT id,
  'MAT',
  'Materials/Equipment/Plant',
  'วัสดุ / อุปกรณ์ / โรงงาน'
FROM contracts
WHERE contract_code = 'LCBP3-C1'
UNION ALL
SELECT id,
  'MOM',
  'Minutes of Meeting',
  'รายงานการประชุม'
FROM contracts
WHERE contract_code = 'LCBP3-C1'
UNION ALL
SELECT id,
  'MPR',
  'Monthly Progress Report',
  'รายงานความคืบหน้าประจำเดือน'
FROM contracts
WHERE contract_code = 'LCBP3-C1'
UNION ALL
SELECT id,
  'MST',
  'Method Statement for Construction/Installation',
  'ขั้นตอนการก่อสร้าง / ติดตั้ง'
FROM contracts
WHERE contract_code = 'LCBP3-C1'
UNION ALL
SELECT id,
  'NDS',
  'Non-Design Data Submission',
  'นำส่งข้อมูลที่ไม่เกี่ยวข้องกับการออกแบบ'
FROM contracts
WHERE contract_code = 'LCBP3-C1'
UNION ALL
SELECT id,
  'PMA',
  'Payment/Invoice/Retention/Estimate',
  'การชำระเงิน / ใบแจ้งหนี้ / ประกันผลงาน / ประมาณการ'
FROM contracts
WHERE contract_code = 'LCBP3-C1'
UNION ALL
SELECT id,
  'PRD',
  'Procedure',
  'ระเบียบปฏิบัติ'
FROM contracts
WHERE contract_code = 'LCBP3-C1'
UNION ALL
SELECT id,
  'PRG',
  'Progress of Construction',
  'ความคืบหน้าของการก่อสร้าง / ภาพถ่าย / วิดีโอ'
FROM contracts
WHERE contract_code = 'LCBP3-C1'
UNION ALL
SELECT id,
  'QMS',
  'Quality Document (Plan/Work Instruction)',
  'เอกสารด้านคุณภาพ (แผนงาน / ข้อแนะนำในการทำงาน)'
FROM contracts
WHERE contract_code = 'LCBP3-C1'
UNION ALL
SELECT id,
  'RPT',
  'Report',
  'รายงาน'
FROM contracts
WHERE contract_code = 'LCBP3-C1'
UNION ALL
SELECT id,
  'SAR',
  'Semi Annual Report',
  'รายงานประจำหกเดือน'
FROM contracts
WHERE contract_code = 'LCBP3-C1'
UNION ALL
SELECT id,
  'SCH',
  'Schedule and Program',
  'แผนงาน'
FROM contracts
WHERE contract_code = 'LCBP3-C1'
UNION ALL
SELECT id,
  'SDW',
  'Shop Drawing',
  'แบบขยายรายละเอียด'
FROM contracts
WHERE contract_code = 'LCBP3-C1'
UNION ALL
SELECT id,
  'SI',
  'Soil Investigation',
  'การตรวจสอบดิน'
FROM contracts
WHERE contract_code = 'LCBP3-C1'
UNION ALL
SELECT id,
  'SPE',
  'Specification',
  'ข้อกำหนด'
FROM contracts
WHERE contract_code = 'LCBP3-C1'
UNION ALL
SELECT id,
  'TNR',
  'Training Report',
  'รายงานการฝึกปฏิบัติ'
FROM contracts
WHERE contract_code = 'LCBP3-C1'
UNION ALL
SELECT id,
  'UC',
  'Underground Construction',
  'โครงสร้างใต้ดิน'
FROM contracts
WHERE contract_code = 'LCBP3-C1'
UNION ALL
SELECT id,
  'VEN',
  'Vendor',
  'ผู้ขาย'
FROM contracts
WHERE contract_code = 'LCBP3-C1'
UNION ALL
SELECT id,
  'VRO',
  'Variation Request/Instruction/Order',
  'คำขอเปลี่ยนแปลง / ข้อเสนอแนะ / ข้อเรียกร้อง'
FROM contracts
WHERE contract_code = 'LCBP3-C1'
UNION ALL
SELECT id,
  'WTY',
  'Warranty',
  'การประกัน'
FROM contracts
WHERE contract_code = 'LCBP3-C1'
UNION ALL
SELECT id,
  'GEN',
  'General',
  'ทั่วไป'
FROM contracts
WHERE contract_code = 'LCBP3-C2'
UNION ALL
SELECT id,
  'CON',
  'Contract',
  'สัญญา'
FROM contracts
WHERE contract_code = 'LCBP3-C2'
UNION ALL
SELECT id,
  'INS',
  'Insurances/Bond/Guarantee',
  'การประกัน / พันธบัตร / การค้ำประกัน'
FROM contracts
WHERE contract_code = 'LCBP3-C2'
UNION ALL
SELECT id,
  'SCH',
  'Schedule and Program',
  'แผนงาน'
FROM contracts
WHERE contract_code = 'LCBP3-C2'
UNION ALL
SELECT id,
  'PMA',
  'Payment/Invoice/Retention/Estimate',
  'การชำระเงิน / ใบแจ้งหนี้ / ประกันผลงาน / ประมาณการ'
FROM contracts
WHERE contract_code = 'LCBP3-C2'
UNION ALL
SELECT id,
  'VRO',
  'Variation Request/Instruction/Order',
  'คำขอเปลี่ยนแปลง / ข้อเสนอแนะ / ข้อเรียกร้อง'
FROM contracts
WHERE contract_code = 'LCBP3-C2'
UNION ALL
SELECT id,
  'VEN',
  'Vendor',
  'ผู้ขาย'
FROM contracts
WHERE contract_code = 'LCBP3-C2'
UNION ALL
SELECT id,
  'WTY',
  'Warranty',
  'การประกัน'
FROM contracts
WHERE contract_code = 'LCBP3-C2'
UNION ALL
SELECT id,
  'DRW',
  'Drawings (All Types)',
  'แบบก่อสร้าง'
FROM contracts
WHERE contract_code = 'LCBP3-C2'
UNION ALL
SELECT id,
  'DDW',
  'Draft Drawing',
  'แบบร่าง'
FROM contracts
WHERE contract_code = 'LCBP3-C2'
UNION ALL
SELECT id,
  'SDW',
  'Shop Drawing',
  'แบบขยายรายละเอียด'
FROM contracts
WHERE contract_code = 'LCBP3-C2'
UNION ALL
SELECT id,
  'ADW',
  'As Built Drawing',
  'แบบร่างหลังการก่อสร้าง'
FROM contracts
WHERE contract_code = 'LCBP3-C2'
UNION ALL
SELECT id,
  'DDS',
  'Design Data Submission',
  'นำส่งข้อมูลการออกแบบ'
FROM contracts
WHERE contract_code = 'LCBP3-C2'
UNION ALL
SELECT id,
  'DSN',
  'Design/Calculation/Manual (All Stages)',
  'ออกแบบ / คำนวณ / คู่มือ'
FROM contracts
WHERE contract_code = 'LCBP3-C2'
UNION ALL
SELECT id,
  'NDS',
  'Non-Design Data Submission',
  'นำส่งข้อมูลที่ไม่เกี่ยวข้องกับการออกแบบ'
FROM contracts
WHERE contract_code = 'LCBP3-C2'
UNION ALL
SELECT id,
  'PRD',
  'Procedure',
  'ระเบียบปฏิบัติ'
FROM contracts
WHERE contract_code = 'LCBP3-C2'
UNION ALL
SELECT id,
  'MST',
  'Method Statement for Construction/Installation',
  'ขั้นตอนการก่อสร้าง / ติดตั้ง'
FROM contracts
WHERE contract_code = 'LCBP3-C2'
UNION ALL
SELECT id,
  'QMS',
  'Quality Document (Plan/Work Instruction)',
  'เอกสารด้านคุณภาพ (แผนงาน / ข้อแนะนำในการทำงาน)'
FROM contracts
WHERE contract_code = 'LCBP3-C2'
UNION ALL
SELECT id,
  'INR',
  'Inspection/Audit/Surveillance Report',
  'รายงานการตรวจสอบ / การตรวจสอบ / รายงานการเฝ้าระวัง'
FROM contracts
WHERE contract_code = 'LCBP3-C2'
UNION ALL
SELECT id,
  'ITP',
  'Inspection and Test Plan',
  'แผนการตรวจสอบและทดสอบ'
FROM contracts
WHERE contract_code = 'LCBP3-C2'
UNION ALL
SELECT id,
  'MAT',
  'Materials/Equipment/Plant',
  'วัสดุ / อุปกรณ์ / โรงงาน'
FROM contracts
WHERE contract_code = 'LCBP3-C2'
UNION ALL
SELECT id,
  'SPE',
  'Specification',
  'ข้อกำหนด'
FROM contracts
WHERE contract_code = 'LCBP3-C2'
UNION ALL
SELECT id,
  'MAN',
  'Manual',
  'คู่มือ'
FROM contracts
WHERE contract_code = 'LCBP3-C2'
UNION ALL
SELECT id,
  'CER',
  'Certificates',
  'ใบรับรอง'
FROM contracts
WHERE contract_code = 'LCBP3-C2'
UNION ALL
SELECT id,
  'SAR',
  'Semi Annual Report',
  'รายงานประจำหกเดือน'
FROM contracts
WHERE contract_code = 'LCBP3-C2'
UNION ALL
SELECT id,
  'JSA',
  'Jobs Analysis',
  'รายงานการวิเคราะห์ความปลอดภัย'
FROM contracts
WHERE contract_code = 'LCBP3-C2'
UNION ALL
SELECT id,
  'MOM',
  'Minutes of Meeting',
  'รายงานการประชุม'
FROM contracts
WHERE contract_code = 'LCBP3-C2'
UNION ALL
SELECT id,
  'MPR',
  'Monthly Progress Report',
  'รายงานความคืบหน้าประจำเดือน'
FROM contracts
WHERE contract_code = 'LCBP3-C2'
UNION ALL
SELECT id,
  'ICR',
  'Incident Report',
  'รายงานการเกิดอุบัติเหตุและการบาดเจ็บ'
FROM contracts
WHERE contract_code = 'LCBP3-C2'
UNION ALL
SELECT id,
  'PRG',
  'Progress of Construction',
  'ความคืบหน้าของการก่อสร้าง / ภาพถ่าย / วิดีโอ'
FROM contracts
WHERE contract_code = 'LCBP3-C2'
UNION ALL
SELECT id,
  'RPT',
  'Report',
  'รายงาน'
FROM contracts
WHERE contract_code = 'LCBP3-C2'
UNION ALL
SELECT id,
  'TNR',
  'Training Report',
  'รายงานการฝึกปฏิบัติ'
FROM contracts
WHERE contract_code = 'LCBP3-C2';

-- Seed rfa_status_codes
INSERT INTO rfa_status_codes (
    status_code,
    status_name,
    description,
    sort_order
  )
VALUES ('DFT', 'Draft', 'ฉบับร่าง', 1),
  ('FAP', 'For Approve', 'เพื่อขออนุมัติ', 11),
  ('FRE', 'For Review', 'เพื่อตรวจสอบ', 12),
  ('FCO', 'For Construction', 'เพื่อก่อสร้าง', 20),
  ('ASB', 'AS - Built', 'แบบก่อสร้างจริง', 30),
  ('OBS', 'Obsolete', 'ไม่ใช้งาน', 80),
  ('CC', 'Canceled', 'ยกเลิก', 99);

INSERT INTO rfa_approve_codes (
    approve_code,
    approve_name,
    sort_order,
    is_active
  )
VALUES ('1A', 'Approved by Authority', 10, 1),
  ('1C', 'Approved by CSC', 11, 1),
  ('1N', 'Approved As Note', 12, 1),
  ('1R', 'Approved with Remarks', 13, 1),
  ('3C', 'Consultant Comments', 31, 1),
  ('3R', 'Revise and Resubmit', 32, 1),
  ('4X', 'Reject', 40, 1),
  ('5N', 'No Further Action', 50, 1);

-- Seed circulation_status_codes
INSERT INTO circulation_status_codes (code, description, sort_order)
VALUES ('OPEN', 'Open', 1),
  ('IN_REVIEW', 'In Review', 2),
  ('COMPLETED', 'ปCompleted', 3),
  ('CANCELLED', 'Cancelled / Withdrawn', 9);

-- ตาราง "แม่" ของ RFA (มีความสัมพันธ์ 1:N กับ rfa_revisions)
-- ==========================================================
-- SEED DATA 6B.md (Disciplines, RFA Types, Sub Types)
-- ==========================================================
-- 1. Seed ข้อมูล Disciplines (สาขางาน)
-- LCBP3-C1
INSERT INTO disciplines (
    contract_id,
    discipline_code,
    code_name_th,
    code_name_en
  )
SELECT id,
  'GEN',
  'งานบริหารโครงการ',
  'General Management'
FROM contracts
WHERE contract_code = 'LCBP3-C1'
UNION ALL
SELECT id,
  'COD',
  'สัญญาและข้อโต้แย้ง',
  'Contracting'
FROM contracts
WHERE contract_code = 'LCBP3-C1'
UNION ALL
SELECT id,
  'QSB',
  'สำรวจปริมาณและควบคุมงบประมาณ',
  'Quantity Survey and Budget Control'
FROM contracts
WHERE contract_code = 'LCBP3-C1'
UNION ALL
SELECT id,
  'PPG',
  'บริหารแผนและความก้าวหน้า',
  'Plan and Progress Management'
FROM contracts
WHERE contract_code = 'LCBP3-C1'
UNION ALL
SELECT id,
  'PRC',
  'งานจัดซื้อ',
  'Procurement'
FROM contracts
WHERE contract_code = 'LCBP3-C1'
UNION ALL
SELECT id,
  'SUB',
  'ผู้รับเหมาช่วง',
  'Subcontractor'
FROM contracts
WHERE contract_code = 'LCBP3-C1'
UNION ALL
SELECT id,
  'ODC',
  'สำนักงาน-ควบคุมเอกสาร',
  'Operation Docment Control'
FROM contracts
WHERE contract_code = 'LCBP3-C1'
UNION ALL
SELECT id,
  'LAW',
  'กฎหมาย',
  'Law'
FROM contracts
WHERE contract_code = 'LCBP3-C1'
UNION ALL
SELECT id,
  'TRF',
  'จราจร',
  'Traffic'
FROM contracts
WHERE contract_code = 'LCBP3-C1'
UNION ALL
SELECT id,
  'BIM',
  'BIM',
  'Building information modeling'
FROM contracts
WHERE contract_code = 'LCBP3-C1'
UNION ALL
SELECT id,
  'SRV',
  'งานสำรวจ',
  'Survey'
FROM contracts
WHERE contract_code = 'LCBP3-C1'
UNION ALL
SELECT id,
  'SFT',
  'ความปลอดภัย',
  'Safety'
FROM contracts
WHERE contract_code = 'LCBP3-C1'
UNION ALL
SELECT id,
  'BST',
  'งานโครงสร้างอาคาร',
  'Building Structure Work'
FROM contracts
WHERE contract_code = 'LCBP3-C1'
UNION ALL
SELECT id,
  'TEM',
  'งานชั่วคราว',
  'Temporary Work'
FROM contracts
WHERE contract_code = 'LCBP3-C1'
UNION ALL
SELECT id,
  'UTL',
  'งานระบบสาธารณูปโภค',
  'Utility'
FROM contracts
WHERE contract_code = 'LCBP3-C1'
UNION ALL
SELECT id,
  'EPW',
  'งานระบบไฟฟ้า',
  'Electrical Power Work'
FROM contracts
WHERE contract_code = 'LCBP3-C1'
UNION ALL
SELECT id,
  'ECM',
  'งานระบบไฟฟ้าสื่อสาร',
  'Electrical Communication Work'
FROM contracts
WHERE contract_code = 'LCBP3-C1'
UNION ALL
SELECT id,
  'ENV',
  'สิ่งแวดล้อม',
  'Environment'
FROM contracts
WHERE contract_code = 'LCBP3-C1'
UNION ALL
SELECT id,
  'AQV',
  'คุณภาพอากาศและความสั่นสะเทือน',
  'Air quality and vibration'
FROM contracts
WHERE contract_code = 'LCBP3-C1'
UNION ALL
SELECT id,
  'WAB',
  'คุณภาพน้ำและชีววิทยาทางน้ำ',
  'Water quality and Aquatic biology'
FROM contracts
WHERE contract_code = 'LCBP3-C1'
UNION ALL
SELECT id,
  'ONS',
  'วิศวกรรมชายฝั่ง',
  'Onshore Engineer Work'
FROM contracts
WHERE contract_code = 'LCBP3-C1'
UNION ALL
SELECT id,
  'PPR',
  'มวลชนสัมพันธ์และการประชาสัมพันธ์',
  'Public Relations'
FROM contracts
WHERE contract_code = 'LCBP3-C1'
UNION ALL
SELECT id,
  'OSW',
  'งานก่อสร้างงานทางทะเล',
  'Offshore Work'
FROM contracts
WHERE contract_code = 'LCBP3-C1'
UNION ALL
SELECT id,
  'DRE',
  'งานขุดและถมทะเล',
  'Dredging and Reclamation'
FROM contracts
WHERE contract_code = 'LCBP3-C1'
UNION ALL
SELECT id,
  'REV',
  'งานคันหินล้อมพื้นที่ถมทะเล',
  'Revetment'
FROM contracts
WHERE contract_code = 'LCBP3-C1'
UNION ALL
SELECT id,
  'BRW',
  'งานเขื่อนกันคลื่น',
  'Breakwater'
FROM contracts
WHERE contract_code = 'LCBP3-C1'
UNION ALL
SELECT id,
  'SOI',
  'ปรับปรุงคุณภาพดิน',
  'Soil Improvement'
FROM contracts
WHERE contract_code = 'LCBP3-C1'
UNION ALL
SELECT id,
  'BLC',
  'งานปรับปรุงคลองบางละมุง',
  'Bang Lamung Canal Bank Protection'
FROM contracts
WHERE contract_code = 'LCBP3-C1'
UNION ALL
SELECT id,
  'FUP',
  'งานประตูระบายน้ำและท่อลอด',
  'Floodgate & Under Ground Piping Works'
FROM contracts
WHERE contract_code = 'LCBP3-C1'
UNION ALL
SELECT id,
  'SWP',
  'งานอาคารควบคุมสถานีสูบน้ำทะเล',
  'Sea Water Pumping Station Control BuilDing'
FROM contracts
WHERE contract_code = 'LCBP3-C1'
UNION ALL
SELECT id,
  'NAV',
  'งานติดตั้งเครื่องหมายช่วงการเดินเรือ',
  'Navigations Aids'
FROM contracts
WHERE contract_code = 'LCBP3-C1'
UNION ALL
SELECT id,
  'GEO',
  'งานด้านธรณีเทคนิค',
  'Geotechnical'
FROM contracts
WHERE contract_code = 'LCBP3-C1'
UNION ALL
SELECT id,
  'CRW',
  'งานด้านโยธา - Rock Works',
  'Civil-Rock work'
FROM contracts
WHERE contract_code = 'LCBP3-C1'
UNION ALL
SELECT id,
  'DVR',
  'ทีมนักประดาน้ำ',
  'Dive Work'
FROM contracts
WHERE contract_code = 'LCBP3-C1'
UNION ALL
SELECT id,
  'MTS',
  'งานทดสอบวัสดุและธรณีเทคนิค',
  'Materials and Geotechnical Testing'
FROM contracts
WHERE contract_code = 'LCBP3-C1'
UNION ALL
SELECT id,
  'OTH',
  'อื่นๆ',
  'Other'
FROM contracts
WHERE contract_code = 'LCBP3-C1';

-- LCBP3-C2
INSERT INTO disciplines (
    contract_id,
    discipline_code,
    code_name_th,
    code_name_en
  )
SELECT id,
  'GEN',
  'งานบริหารโครงการ',
  'Project Management'
FROM contracts
WHERE contract_code = 'LCBP3-C2'
UNION ALL
SELECT id,
  'COD',
  'สัญญาและข้อโต้แย้ง',
  'Contracts and arguments'
FROM contracts
WHERE contract_code = 'LCBP3-C2'
UNION ALL
SELECT id,
  'QSB',
  'สำรวจปริมาณและควบคุมงบประมาณ',
  'Survey the quantity and control the budget'
FROM contracts
WHERE contract_code = 'LCBP3-C2'
UNION ALL
SELECT id,
  'PPM',
  'บริหารแผนและความก้าวหน้า',
  'Plan Management & Progress'
FROM contracts
WHERE contract_code = 'LCBP3-C2'
UNION ALL
SELECT id,
  'ODC',
  'สำนักงาน-ควบคุมเอกสาร',
  'Document Control Office'
FROM contracts
WHERE contract_code = 'LCBP3-C2'
UNION ALL
SELECT id,
  'LAW',
  'กฎหมาย',
  'Law'
FROM contracts
WHERE contract_code = 'LCBP3-C2'
UNION ALL
SELECT id,
  'TRF',
  'จราจร',
  'Traffic'
FROM contracts
WHERE contract_code = 'LCBP3-C2'
UNION ALL
SELECT id,
  'BIM',
  'Building Information Modeling',
  'Building Information Modeling'
FROM contracts
WHERE contract_code = 'LCBP3-C2'
UNION ALL
SELECT id,
  'SRV',
  'งานสำรวจ',
  'Survey'
FROM contracts
WHERE contract_code = 'LCBP3-C2'
UNION ALL
SELECT id,
  'SFT',
  'ความปลอดภัย',
  'Safety'
FROM contracts
WHERE contract_code = 'LCBP3-C2'
UNION ALL
SELECT id,
  'BST',
  'งานโครงสร้างอาคาร',
  'Building Structure'
FROM contracts
WHERE contract_code = 'LCBP3-C2'
UNION ALL
SELECT id,
  'UTL',
  'งานะบบสาธารณูปโภค',
  'Public Utilities'
FROM contracts
WHERE contract_code = 'LCBP3-C2'
UNION ALL
SELECT id,
  'EPW',
  'งานระบบไฟฟ้า',
  'Electrical Systems'
FROM contracts
WHERE contract_code = 'LCBP3-C2'
UNION ALL
SELECT id,
  'ECM',
  'งานระบบไฟฟ้าสื่อสาร',
  'Electrical Communication System'
FROM contracts
WHERE contract_code = 'LCBP3-C2'
UNION ALL
SELECT id,
  'ENV',
  'สิ่งแวดล้อม',
  'Environment'
FROM contracts
WHERE contract_code = 'LCBP3-C2'
UNION ALL
SELECT id,
  'AQV',
  'คุณภาพอากาศและความสั่นสะเทือน',
  'Air Quality and Vibration'
FROM contracts
WHERE contract_code = 'LCBP3-C2'
UNION ALL
SELECT id,
  'WAB',
  'คุณภาพน้ำและชีววิทยาทางน้ำ',
  'Water Quality and Aquatic Biology'
FROM contracts
WHERE contract_code = 'LCBP3-C2'
UNION ALL
SELECT id,
  'ONS',
  'วิศวกรรมชายฝั่ง',
  'Coastal Engineering'
FROM contracts
WHERE contract_code = 'LCBP3-C2'
UNION ALL
SELECT id,
  'PPR',
  'มวลชนสัมพันธ์และประชาสัมพันธ์',
  'Mass Relations and Public Relations'
FROM contracts
WHERE contract_code = 'LCBP3-C2'
UNION ALL
SELECT id,
  'OFW',
  'งานก่อสร้างทางทะเล',
  'Marine Construction'
FROM contracts
WHERE contract_code = 'LCBP3-C2'
UNION ALL
SELECT id,
  'EXR',
  'งานขุดและถมทะเล',
  'Excavation and reclamation'
FROM contracts
WHERE contract_code = 'LCBP3-C2'
UNION ALL
SELECT id,
  'GEO',
  'งานด้านธรณีเทคนิค',
  'Geotechnical work'
FROM contracts
WHERE contract_code = 'LCBP3-C2'
UNION ALL
SELECT id,
  'CRW',
  'งานด้านโยธา - Rock Works',
  'Civil Works - Rock Works'
FROM contracts
WHERE contract_code = 'LCBP3-C2'
UNION ALL
SELECT id,
  'DVW',
  'ทีมนักประดาน้ำ',
  'Team of Divers'
FROM contracts
WHERE contract_code = 'LCBP3-C2'
UNION ALL
SELECT id,
  'MTT',
  'งานทดสอบวัสดุ',
  'Materials Testing'
FROM contracts
WHERE contract_code = 'LCBP3-C2'
UNION ALL
SELECT id,
  'ARC',
  'งานสถาปัตยกรรม',
  'Architecture'
FROM contracts
WHERE contract_code = 'LCBP3-C2'
UNION ALL
SELECT id,
  'STR',
  'งานโครงสร้าง',
  'Structural work'
FROM contracts
WHERE contract_code = 'LCBP3-C2'
UNION ALL
SELECT id,
  'SAN',
  'งานระบบสุขาภิบาล',
  'Sanitation System'
FROM contracts
WHERE contract_code = 'LCBP3-C2'
UNION ALL
SELECT id,
  'DRA',
  'งานระบบระบายน้ำ',
  'Drainage system work'
FROM contracts
WHERE contract_code = 'LCBP3-C2'
UNION ALL
SELECT id,
  'TER',
  'งานท่าเทียบเรือ',
  'Terminal Work work'
FROM contracts
WHERE contract_code = 'LCBP3-C2'
UNION ALL
SELECT id,
  'BUD',
  'งานอาคาร',
  'Building'
FROM contracts
WHERE contract_code = 'LCBP3-C2'
UNION ALL
SELECT id,
  'ROW',
  'งานถนนและสะพาน',
  'Road and Bridge Work'
FROM contracts
WHERE contract_code = 'LCBP3-C2'
UNION ALL
SELECT id,
  'MEC',
  'งานเคริองกล',
  'Mechanical work'
FROM contracts
WHERE contract_code = 'LCBP3-C2'
UNION ALL
SELECT id,
  'OTH',
  'อื่น ๆ',
  'Others'
FROM contracts
WHERE contract_code = 'LCBP3-C2';

-- 2. Seed ข้อมูล Correspondence Sub Types (Mapping RFA Types กับ Number)
-- เนื่องจาก sub_type_code ตรงกับ RFA Type Code แต่ Req ต้องการ Mapping เป็น Number
-- LCBP3-C1
-- LCBP3-C1
INSERT INTO correspondence_sub_types (
    contract_id,
    correspondence_type_id,
    sub_type_code,
    sub_type_name,
    sub_type_number
  )
SELECT c.id,
  ct.id,
  'MAT',
  'Material Approval',
  '11'
FROM contracts c,
  correspondence_types ct
WHERE c.contract_code = 'LCBP3-C1'
  AND ct.type_code = 'RFA'
UNION ALL
SELECT c.id,
  ct.id,
  'SHP',
  'Shop Drawing Submittal',
  '12'
FROM contracts c,
  correspondence_types ct
WHERE c.contract_code = 'LCBP3-C1'
  AND ct.type_code = 'RFA'
UNION ALL
SELECT c.id,
  ct.id,
  'DWG',
  'Document Approval',
  '13'
FROM contracts c,
  correspondence_types ct
WHERE c.contract_code = 'LCBP3-C1'
  AND ct.type_code = 'RFA'
UNION ALL
SELECT c.id,
  ct.id,
  'MET',
  'Engineering Document Submittal',
  '14'
FROM contracts c,
  correspondence_types ct
WHERE c.contract_code = 'LCBP3-C1'
  AND ct.type_code = 'RFA';

-- LCBP3-C2
INSERT INTO correspondence_sub_types (
    contract_id,
    correspondence_type_id,
    sub_type_code,
    sub_type_name,
    sub_type_number
  )
SELECT c.id,
  ct.id,
  'MAT',
  'Material Approval',
  '21'
FROM contracts c,
  correspondence_types ct
WHERE c.contract_code = 'LCBP3-C2'
  AND ct.type_code = 'RFA'
UNION ALL
SELECT c.id,
  ct.id,
  'SHP',
  'Shop Drawing Submittal',
  '22'
FROM contracts c,
  correspondence_types ct
WHERE c.contract_code = 'LCBP3-C2'
  AND ct.type_code = 'RFA'
UNION ALL
SELECT c.id,
  ct.id,
  'DWG',
  'Document Approval',
  '23'
FROM contracts c,
  correspondence_types ct
WHERE c.contract_code = 'LCBP3-C2'
  AND ct.type_code = 'RFA'
UNION ALL
SELECT c.id,
  ct.id,
  'MET',
  'Engineering Document Submittal',
  '24'
FROM contracts c,
  correspondence_types ct
WHERE c.contract_code = 'LCBP3-C2'
  AND ct.type_code = 'RFA';

-- LCBP3-C3
INSERT INTO correspondence_sub_types (
    contract_id,
    correspondence_type_id,
    sub_type_code,
    sub_type_name,
    sub_type_number
  )
SELECT c.id,
  ct.id,
  'MAT',
  'Material Approval',
  '31'
FROM contracts c,
  correspondence_types ct
WHERE c.contract_code = 'LCBP3-C3'
  AND ct.type_code = 'RFA'
UNION ALL
SELECT c.id,
  ct.id,
  'SHP',
  'Shop Drawing Submittal',
  '32'
FROM contracts c,
  correspondence_types ct
WHERE c.contract_code = 'LCBP3-C3'
  AND ct.type_code = 'RFA'
UNION ALL
SELECT c.id,
  ct.id,
  'DWG',
  'Document Approval',
  '33'
FROM contracts c,
  correspondence_types ct
WHERE c.contract_code = 'LCBP3-C3'
  AND ct.type_code = 'RFA'
UNION ALL
SELECT c.id,
  ct.id,
  'MET',
  'Engineering Document Submittal',
  '34'
FROM contracts c,
  correspondence_types ct
WHERE c.contract_code = 'LCBP3-C3'
  AND ct.type_code = 'RFA';

-- LCBP3-C4
INSERT INTO correspondence_sub_types (
    contract_id,
    correspondence_type_id,
    sub_type_code,
    sub_type_name,
    sub_type_number
  )
SELECT c.id,
  ct.id,
  'MAT',
  'Material Approval',
  '41'
FROM contracts c,
  correspondence_types ct
WHERE c.contract_code = 'LCBP3-C4'
  AND ct.type_code = 'RFA'
UNION ALL
SELECT c.id,
  ct.id,
  'SHP',
  'Shop Drawing Submittal',
  '42'
FROM contracts c,
  correspondence_types ct
WHERE c.contract_code = 'LCBP3-C4'
  AND ct.type_code = 'RFA'
UNION ALL
SELECT c.id,
  ct.id,
  'DWG',
  'Document Approval',
  '43'
FROM contracts c,
  correspondence_types ct
WHERE c.contract_code = 'LCBP3-C4'
  AND ct.type_code = 'RFA'
UNION ALL
SELECT c.id,
  ct.id,
  'MET',
  'Engineering Document Submittal',
  '44'
FROM contracts c,
  correspondence_types ct
WHERE c.contract_code = 'LCBP3-C4'
  AND ct.type_code = 'RFA';

INSERT INTO `correspondences` (
    `id`,
    `correspondence_number`,
    `correspondence_type_id`,
    `discipline_id`,
    `is_internal_communication`,
    `project_id`,
    `originator_id`,
    `created_at`,
    `created_by`,
    `deleted_at`
  )
VALUES (
    1,
    'ผรม.1-คคง.-0242-2568',
    6,
    1,
    0,
    2,
    41,
    '2025-12-06 05:25:58',
    1,
    NULL
  ),
  (
    2,
    'LCBP3-C2-RFA-ROW-RPT-0059-A',
    1,
    95,
    0,
    3,
    42,
    '2025-12-06 05:36:52',
    1,
    NULL
  );

INSERT INTO `correspondence_revisions` (
    `id`,
    `correspondence_id`,
    `revision_number`,
    `revision_label`,
    `is_current`,
    `correspondence_status_id`,
    `subject`,
    `document_date`,
    `issued_date`,
    `received_date`,
    `due_date`,
    `description`,
    `details`,
    `schema_version`,
    `created_at`,
    `created_by`,
    `updated_by`
  )
VALUES (
    1,
    1,
    0,
    NULL,
    1,
    4,
    'นำส่งวีดิทัศน์ความก้าวหน้างานก่อสร้างงานทางทะเล (ฉบับสมบูรณ์) ประจำเดือนตุลาคม พ.ศ.2568 โครงการพัฒนาท่าเรือแหลมฉบัง ระยะที่ 3 (ส่วนที่ 1) งานก่อสร้างงานทางทะเล',
    '2025-11-28',
    '2025-11-28 12:26:29',
    '2025-12-01 12:26:29',
    NULL,
    NULL,
    NULL,
    1,
    '2025-12-06 05:30:17',
    1,
    NULL
  );

-- ==========================================================
-- 20. Workflow Definitions (Unified Workflow Engine)
-- ==========================================================
INSERT INTO `workflow_definitions` (
    `id`,
    `workflow_code`,
    `version`,
    `description`,
    `dsl`,
    `compiled`,
    `is_active`,
    `created_at`,
    `updated_at`
  )
VALUES (
    -- CORRESPONDENCE_FLOW_V1
    UUID(),
    'CORRESPONDENCE_FLOW_V1',
    1,
    'Standard Correspondence Workflow - Draft → Submit → Review → Approve/Reject',
    JSON_OBJECT(
      'workflow',
      'CORRESPONDENCE_FLOW_V1',
      'version',
      1,
      'states',
      JSON_ARRAY(
        JSON_OBJECT(
          'name',
          'DRAFT',
          'initial',
          TRUE,
          'on',
          JSON_OBJECT(
            'SUBMIT',
            JSON_OBJECT('to', 'IN_REVIEW')
          )
        ),
        JSON_OBJECT(
          'name',
          'IN_REVIEW',
          'on',
          JSON_OBJECT(
            'APPROVE',
            JSON_OBJECT('to', 'APPROVED'),
            'REJECT',
            JSON_OBJECT('to', 'REJECTED'),
            'RETURN',
            JSON_OBJECT('to', 'DRAFT')
          )
        ),
        JSON_OBJECT('name', 'APPROVED', 'terminal', TRUE),
        JSON_OBJECT('name', 'REJECTED', 'terminal', TRUE)
      )
    ),
    JSON_OBJECT(
      'initialState',
      'DRAFT',
      'states',
      JSON_OBJECT(
        'DRAFT',
        JSON_OBJECT(
          'initial',
          TRUE,
          'terminal',
          false,
          'transitions',
          JSON_OBJECT(
            'SUBMIT',
            JSON_OBJECT('to', 'IN_REVIEW', 'events', JSON_ARRAY())
          )
        ),
        'IN_REVIEW',
        JSON_OBJECT(
          'initial',
          false,
          'terminal',
          false,
          'transitions',
          JSON_OBJECT(
            'APPROVE',
            JSON_OBJECT('to', 'APPROVED', 'events', JSON_ARRAY()),
            'REJECT',
            JSON_OBJECT('to', 'REJECTED', 'events', JSON_ARRAY()),
            'RETURN',
            JSON_OBJECT('to', 'DRAFT', 'events', JSON_ARRAY())
          )
        ),
        'APPROVED',
        JSON_OBJECT(
          'initial',
          false,
          'terminal',
          TRUE,
          'transitions',
          JSON_OBJECT()
        ),
        'REJECTED',
        JSON_OBJECT(
          'initial',
          false,
          'terminal',
          TRUE,
          'transitions',
          JSON_OBJECT()
        )
      )
    ),
    TRUE,
    NOW(),
    NOW()
  ),
  (
    -- RFA_APPROVAL
    UUID(),
    'RFA_APPROVAL',
    1,
    'Request for Approval Workflow - Contractor Submit → Consultant Review → Owner Review',
    JSON_OBJECT(
      'workflow',
      'RFA_APPROVAL',
      'version',
      1,
      'states',
      JSON_ARRAY(
        JSON_OBJECT(
          'name',
          'DRAFT',
          'initial',
          TRUE,
          'on',
          JSON_OBJECT(
            'SUBMIT',
            JSON_OBJECT(
              'to',
              'CONSULTANT_REVIEW',
              'require',
              JSON_OBJECT('role', 'CONTRACTOR')
            )
          )
        ),
        JSON_OBJECT(
          'name',
          'CONSULTANT_REVIEW',
          'on',
          JSON_OBJECT(
            'APPROVE',
            JSON_OBJECT('to', 'OWNER_REVIEW'),
            'REJECT',
            JSON_OBJECT('to', 'DRAFT')
          )
        ),
        JSON_OBJECT(
          'name',
          'OWNER_REVIEW',
          'on',
          JSON_OBJECT(
            'APPROVE',
            JSON_OBJECT('to', 'APPROVED'),
            'REJECT',
            JSON_OBJECT('to', 'CONSULTANT_REVIEW')
          )
        ),
        JSON_OBJECT('name', 'APPROVED', 'terminal', TRUE)
      )
    ),
    JSON_OBJECT(
      'initialState',
      'DRAFT',
      'states',
      JSON_OBJECT(
        'DRAFT',
        JSON_OBJECT(
          'initial',
          TRUE,
          'terminal',
          false,
          'transitions',
          JSON_OBJECT(
            'SUBMIT',
            JSON_OBJECT(
              'target',
              'CONSULTANT_REVIEW',
              'events',
              JSON_ARRAY()
            )
          )
        ),
        'CONSULTANT_REVIEW',
        JSON_OBJECT(
          'initial',
          false,
          'terminal',
          false,
          'transitions',
          JSON_OBJECT(
            'APPROVE',
            JSON_OBJECT('target', 'OWNER_REVIEW', 'events', JSON_ARRAY()),
            'REJECT',
            JSON_OBJECT('target', 'DRAFT', 'events', JSON_ARRAY())
          )
        ),
        'OWNER_REVIEW',
        JSON_OBJECT(
          'initial',
          false,
          'terminal',
          false,
          'transitions',
          JSON_OBJECT(
            'APPROVE',
            JSON_OBJECT('target', 'APPROVED', 'events', JSON_ARRAY()),
            'REJECT',
            JSON_OBJECT(
              'target',
              'CONSULTANT_REVIEW',
              'events',
              JSON_ARRAY()
            )
          )
        ),
        'APPROVED',
        JSON_OBJECT(
          'initial',
          false,
          'terminal',
          TRUE,
          'transitions',
          JSON_OBJECT()
        )
      )
    ),
    TRUE,
    NOW(),
    NOW()
  );

INSERT INTO `document_number_formats` (
    `id`,
    `project_id`,
    `correspondence_type_id`,
    `discipline_id`,
    `format_string`,
    `reset_annually`,
    `is_active`,
    `description`,
    `created_at`,
    `updated_at`
  )
VALUES (
    1,
    1,
    NULL,
    0,
    '{ORG}-{RECIPIENT}-{SEQ:4}/{YEAR}',
    1,
    1,
    NULL,
    '2025-12-16 09:33:36',
    '2025-12-16 09:33:36'
  ),
  (
    2,
    2,
    NULL,
    0,
    '{ORG}-{RECIPIENT}-{SEQ:4}/{YEAR}',
    1,
    1,
    NULL,
    '2025-12-16 09:34:10',
    '2025-12-16 09:34:10'
  );

-- =====================================================
-- Intent Classification Seed (ADR-024)
-- =====================================================
-- Intent Definitions (v1) — 12 รายการ
INSERT IGNORE INTO ai_intent_definitions (
    intent_code,
    description_th,
    description_en,
    category
  )
VALUES -- Read Intents
  (
    'RAG_QUERY',
    'ถามคำถามธรรมชาติ ตอบจาก vector + doc context',
    'Natural language query from vector DB + document context',
    'read'
  ),
  (
    'GET_RFA',
    'ดึง RFA ตาม filter',
    'Get RFA by filters',
    'read'
  ),
  (
    'GET_DRAWING',
    'ดึง Drawing revision',
    'Get Drawing revision',
    'read'
  ),
  (
    'GET_TRANSMITTAL',
    'ดึง Transmittal',
    'Get Transmittal',
    'read'
  ),
  (
    'GET_CORRESPONDENCE',
    'ดึง Correspondence ทั่วไป',
    'Get Correspondence',
    'read'
  ),
  (
    'GET_CIRCULATION',
    'ดึง Circulation',
    'Get Circulation',
    'read'
  ),
  (
    'GET_RFA_DRAWINGS',
    'ดึง Drawings ที่ผูกกับ RFA',
    'Get Drawings linked to RFA',
    'read'
  ),
  (
    'SUMMARIZE_DOCUMENT',
    'สรุปเอกสารที่เปิดอยู่',
    'Summarize current document',
    'read'
  ),
  (
    'LIST_OVERDUE',
    'รายการ cross-entity ที่เกินกำหนด',
    'List overdue items across entities',
    'read'
  ),
  -- Suggest Intents
  (
    'SUGGEST_METADATA',
    'แนะนำ metadata สำหรับเอกสารที่อัปโหลด',
    'Suggest metadata for uploaded document',
    'suggest'
  ),
  (
    'SUGGEST_ACTION',
    'แจ้งเตือนว่าควรทำอะไรต่อ',
    'Suggest next actions',
    'suggest'
  ),
  -- Utility Intents
  (
    'FALLBACK',
    'ไม่เข้า intent ไหน / ไม่เกี่ยวกับระบบ',
    'No matching intent / unrelated to system',
    'utility'
  );

-- Intent Patterns Seed (ADR-024)
-- =====================================================
-- RAG_QUERY patterns
INSERT IGNORE INTO ai_intent_patterns (
    intent_code,
    language,
    pattern_type,
    pattern_value,
    priority
  )
VALUES ('RAG_QUERY', 'th', 'keyword', 'ค้นหา', 10),
  ('RAG_QUERY', 'th', 'keyword', 'หาข้อมูล', 10),
  ('RAG_QUERY', 'en', 'keyword', 'search', 10),
  ('RAG_QUERY', 'en', 'keyword', 'find', 10),
  (
    'RAG_QUERY',
    'any',
    'regex',
    '(?i)(what|where|who|when|how|why).*\\?',
    50
  );

-- GET_RFA patterns
INSERT IGNORE INTO ai_intent_patterns (
    intent_code,
    language,
    pattern_type,
    pattern_value,
    priority
  )
VALUES ('GET_RFA', 'th', 'keyword', 'rfa', 10),
  ('GET_RFA', 'th', 'keyword', 'อาร์เอฟเอ', 10),
  (
    'GET_RFA',
    'en',
    'keyword',
    'request for approval',
    15
  ),
  ('GET_RFA', 'any', 'regex', '(?i)rfa[- ]?\\d+', 5);

-- GET_DRAWING patterns
INSERT IGNORE INTO ai_intent_patterns (
    intent_code,
    language,
    pattern_type,
    pattern_value,
    priority
  )
VALUES ('GET_DRAWING', 'th', 'keyword', 'แบบ', 20),
  ('GET_DRAWING', 'th', 'keyword', 'drawing', 10),
  ('GET_DRAWING', 'en', 'keyword', 'drawing', 10),
  ('GET_DRAWING', 'en', 'keyword', 'revision', 20),
  (
    'GET_DRAWING',
    'any',
    'regex',
    '(?i)(shop.?draw|dwg|rev\\.?\\s*\\d)',
    5
  );

-- GET_TRANSMITTAL patterns
INSERT IGNORE INTO ai_intent_patterns (
    intent_code,
    language,
    pattern_type,
    pattern_value,
    priority
  )
VALUES (
    'GET_TRANSMITTAL',
    'th',
    'keyword',
    'transmittal',
    10
  ),
  (
    'GET_TRANSMITTAL',
    'th',
    'keyword',
    'ทรานส์มิตทอล',
    10
  ),
  (
    'GET_TRANSMITTAL',
    'en',
    'keyword',
    'transmittal',
    10
  ),
  (
    'GET_TRANSMITTAL',
    'any',
    'regex',
    '(?i)tr[- ]?\\d+',
    5
  );

-- GET_CORRESPONDENCE patterns
INSERT IGNORE INTO ai_intent_patterns (
    intent_code,
    language,
    pattern_type,
    pattern_value,
    priority
  )
VALUES (
    'GET_CORRESPONDENCE',
    'th',
    'keyword',
    'จดหมาย',
    10
  ),
  (
    'GET_CORRESPONDENCE',
    'th',
    'keyword',
    'หนังสือ',
    15
  ),
  (
    'GET_CORRESPONDENCE',
    'en',
    'keyword',
    'correspondence',
    10
  ),
  (
    'GET_CORRESPONDENCE',
    'en',
    'keyword',
    'letter',
    15
  );

-- GET_CIRCULATION patterns
INSERT IGNORE INTO ai_intent_patterns (
    intent_code,
    language,
    pattern_type,
    pattern_value,
    priority
  )
VALUES ('GET_CIRCULATION', 'th', 'keyword', 'เวียน', 10),
  (
    'GET_CIRCULATION',
    'th',
    'keyword',
    'circulation',
    10
  ),
  (
    'GET_CIRCULATION',
    'en',
    'keyword',
    'circulation',
    10
  ),
  (
    'GET_CIRCULATION',
    'en',
    'keyword',
    'distribute',
    15
  );

-- GET_RFA_DRAWINGS patterns
INSERT IGNORE INTO ai_intent_patterns (
    intent_code,
    language,
    pattern_type,
    pattern_value,
    priority
  )
VALUES (
    'GET_RFA_DRAWINGS',
    'th',
    'keyword',
    'แบบใน rfa',
    5
  ),
  (
    'GET_RFA_DRAWINGS',
    'en',
    'keyword',
    'drawings in rfa',
    5
  ),
  (
    'GET_RFA_DRAWINGS',
    'any',
    'regex',
    '(?i)(draw|แบบ).*(rfa|อาร์เอฟเอ)',
    5
  );

-- SUMMARIZE_DOCUMENT patterns
INSERT IGNORE INTO ai_intent_patterns (
    intent_code,
    language,
    pattern_type,
    pattern_value,
    priority
  )
VALUES (
    'SUMMARIZE_DOCUMENT',
    'th',
    'keyword',
    'สรุป',
    10
  ),
  (
    'SUMMARIZE_DOCUMENT',
    'th',
    'keyword',
    'สรุปเอกสาร',
    5
  ),
  (
    'SUMMARIZE_DOCUMENT',
    'en',
    'keyword',
    'summarize',
    10
  ),
  (
    'SUMMARIZE_DOCUMENT',
    'en',
    'keyword',
    'summary',
    10
  ),
  (
    'SUMMARIZE_DOCUMENT',
    'any',
    'regex',
    '(?i)(สรุป|summar|tldr|tl;dr)',
    5
  );

-- LIST_OVERDUE patterns
INSERT IGNORE INTO ai_intent_patterns (
    intent_code,
    language,
    pattern_type,
    pattern_value,
    priority
  )
VALUES ('LIST_OVERDUE', 'th', 'keyword', 'เกินกำหนด', 10),
  ('LIST_OVERDUE', 'th', 'keyword', 'ค้าง', 15),
  ('LIST_OVERDUE', 'th', 'keyword', 'overdue', 10),
  ('LIST_OVERDUE', 'en', 'keyword', 'overdue', 10),
  ('LIST_OVERDUE', 'en', 'keyword', 'late', 20),
  (
    'LIST_OVERDUE',
    'any',
    'regex',
    '(?i)(overdue|เกินกำหนด|ล่าช้า)',
    5
  );

-- SUGGEST_METADATA patterns
INSERT IGNORE INTO ai_intent_patterns (
    intent_code,
    language,
    pattern_type,
    pattern_value,
    priority
  )
VALUES (
    'SUGGEST_METADATA',
    'th',
    'keyword',
    'แนะนำ metadata',
    5
  ),
  ('SUGGEST_METADATA', 'th', 'keyword', 'แท็ก', 15),
  (
    'SUGGEST_METADATA',
    'en',
    'keyword',
    'suggest metadata',
    5
  ),
  ('SUGGEST_METADATA', 'en', 'keyword', 'tag', 15),
  (
    'SUGGEST_METADATA',
    'any',
    'regex',
    '(?i)(suggest|แนะนำ).*(tag|meta|ประเภท)',
    5
  );

-- SUGGEST_ACTION patterns
INSERT IGNORE INTO ai_intent_patterns (
    intent_code,
    language,
    pattern_type,
    pattern_value,
    priority
  )
VALUES (
    'SUGGEST_ACTION',
    'th',
    'keyword',
    'ทำอะไรต่อ',
    10
  ),
  ('SUGGEST_ACTION', 'th', 'keyword', 'แนะนำ', 20),
  (
    'SUGGEST_ACTION',
    'en',
    'keyword',
    'what should i do',
    10
  ),
  (
    'SUGGEST_ACTION',
    'en',
    'keyword',
    'next step',
    10
  ),
  (
    'SUGGEST_ACTION',
    'any',
    'regex',
    '(?i)(next.?step|ทำอะไร|ควรทำ|what.*do)',
    10
  );

-- FALLBACK: ไม่ต้อง seed pattern — ใช้เป็น default เมื่อไม่ match อะไรเลย
-- =====================================================
-- Workflow Definitions Seed (ADR-001)
-- =====================================================
-- CIRCULATION_FLOW_V1 Workflow Definition
INSERT IGNORE INTO workflow_definitions (
    id,
    workflow_code,
    version,
    description,
    dsl,
    compiled,
    is_active,
    created_at,
    updated_at
  )
VALUES (
    UUID(),
    'CIRCULATION_FLOW_V1',
    1,
    'Circulation Workflow — DRAFT → ROUTING → COMPLETED | CANCELLED',
    JSON_OBJECT(
      'workflow',
      'CIRCULATION_FLOW_V1',
      'version',
      1,
      'states',
      JSON_ARRAY(
        JSON_OBJECT(
          'name',
          'DRAFT',
          'initial',
          TRUE,
          'on',
          JSON_OBJECT(
            'START',
            JSON_OBJECT('to', 'ROUTING')
          )
        ),
        JSON_OBJECT(
          'name',
          'ROUTING',
          'on',
          JSON_OBJECT(
            'COMPLETE',
            JSON_OBJECT('to', 'COMPLETED'),
            'FORCE_CLOSE',
            JSON_OBJECT('to', 'CANCELLED')
          )
        ),
        JSON_OBJECT('name', 'COMPLETED', 'terminal', TRUE),
        JSON_OBJECT('name', 'CANCELLED', 'terminal', TRUE)
      )
    ),
    JSON_OBJECT(
      'initialState',
      'DRAFT',
      'states',
      JSON_OBJECT(
        'DRAFT',
        JSON_OBJECT(
          'initial',
          TRUE,
          'terminal',
          FALSE,
          'transitions',
          JSON_OBJECT(
            'START',
            JSON_OBJECT('to', 'ROUTING', 'events', JSON_ARRAY())
          )
        ),
        'ROUTING',
        JSON_OBJECT(
          'initial',
          FALSE,
          'terminal',
          FALSE,
          'transitions',
          JSON_OBJECT(
            'COMPLETE',
            JSON_OBJECT('to', 'COMPLETED', 'events', JSON_ARRAY()),
            'FORCE_CLOSE',
            JSON_OBJECT('to', 'CANCELLED', 'events', JSON_ARRAY())
          )
        ),
        'COMPLETED',
        JSON_OBJECT(
          'initial',
          FALSE,
          'terminal',
          TRUE,
          'transitions',
          JSON_OBJECT()
        ),
        'CANCELLED',
        JSON_OBJECT(
          'initial',
          FALSE,
          'terminal',
          TRUE,
          'transitions',
          JSON_OBJECT()
        )
      )
    ),
    TRUE,
    NOW(),
    NOW()
  );
