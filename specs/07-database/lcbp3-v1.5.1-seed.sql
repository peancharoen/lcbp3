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
    '$2b$10$E6d5k.f46jr.POGWKHhiQ.X1ZsFrMpZox//sCxeOiLUULGuAHO0NW',
    'Super',
    'Admin',
    'superadmin @example.com',
    NULL,
    NULL
  ),
  (
    2,
    'admin',
    '$2b$10$E6d5k.f46jr.POGWKHhiQ.X1ZsFrMpZox//sCxeOiLUULGuAHO0NW',
    'Admin',
    'คคง.',
    'admin@example.com',
    NULL,
    1
  ),
  (
    3,
    'editor01',
    '$2b$10$E6d5k.f46jr.POGWKHhiQ.X1ZsFrMpZox//sCxeOiLUULGuAHO0NW',
    'DC',
    'C1',
    'editor01 @example.com',
    NULL,
    41
  ),
  (
    4,
    'viewer01',
    '$2b$10$E6d5k.f46jr.POGWKHhiQ.X1ZsFrMpZox//sCxeOiLUULGuAHO0NW',
    'Viewer',
    'สคฉ.03',
    'viewer01 @example.com',
    NULL,
    10
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

-- =====================================================
-- 2. Seed Permissions (สิทธิ์การใช้งานทั้งหมด)
-- สิทธิ์ระดับระบบและการจัดการหลัก (System & Master Data)
-- =====================================================
INSERT INTO permissions (permission_id, permission_name, description)
VALUES (
    1,
    'system.manage_all',
    'ทำทุกอย่างในระบบ (Superadmin Power)'
  ),
  -- การจัดการองค์กร
  (2, 'organization.create', 'สร้างองค์กรใหม่'),
  (3, 'organization.edit', 'แก้ไขข้อมูลองค์กร'),
  (4, 'organization.delete', 'ลบองค์กร'),
  (5, 'organization.view', 'ดูรายการองค์กร'),
  -- การจัดการโครงการ
  (6, 'project.create', 'สร้างโครงการใหม่'),
  (7, 'project.edit', 'แก้ไขข้อมูลโครงการ'),
  (8, 'project.delete', 'ลบโครงการ'),
  (9, 'project.view', 'ดูรายการโครงการ'),
  -- การจัดการบทบาทและสิทธิ์ (Roles & Permissions)
  (10, 'role.create', 'สร้างบทบาท (Role) ใหม่'),
  (11, 'role.edit', 'แก้ไขบทบาท (Role)'),
  (12, 'role.delete', 'ลบบทบาท (Role)'),
  (
    13,
    'permission.assign',
    'มอบสิทธิ์ให้กับบทบาท (Role)'
  ),
  -- การจัดการข้อมูลหลัก (Master Data)
  (
    14,
    'master_data.document_type.manage',
    'จัดการประเภทเอกสาร (Document Types)'
  ),
  (
    15,
    'master_data.document_status.manage',
    'จัดการสถานะเอกสาร (Document Statuses)'
  ),
  (
    16,
    'master_data.drawing_category.manage',
    'จัดการหมวดหมู่แบบ (Drawing Categories)'
  ),
  (17, 'master_data.tag.manage', 'จัดการ Tags'),
  -- การจัดการผู้ใช้งาน
  (18, 'user.create', 'สร้างผู้ใช้งานใหม่'),
  (19, 'user.edit', 'แก้ไขข้อมูลผู้ใช้งาน'),
  (20, 'user.delete', 'ลบ / ปิดการใช้งานผู้ใช้'),
  (21, 'user.view', 'ดูข้อมูลผู้ใช้งาน'),
  (
    22,
    'user.assign_organization',
    'มอบผู้ใช้งานให้กับองค์กร'
  );

-- =====================================================
-- == 2. สิทธิ์การจัดการโครงการและสัญญา (Project & Contract) ==
-- =====================================================
INSERT INTO permissions (permission_id, permission_name, description)
VALUES (
    23,
    'project.manage_members',
    'จัดการสมาชิกในโครงการ (เชิญ / ถอดสมาชิก)'
  ),
  (
    24,
    'project.create_contracts',
    'สร้างสัญญาในโครงการ'
  ),
  (
    25,
    'project.manage_contracts',
    'จัดการสัญญาในโครงการ'
  ),
  (
    26,
    'project.view_reports',
    'ดูรายงานระดับโครงการ'
  ),
  (
    27,
    'contract.manage_members',
    'จัดการสมาชิกในสัญญา'
  ),
  (28, 'contract.view', 'ดูข้อมูลสัญญา');

-- =====================================================
-- == 3. สิทธิ์การจัดการเอกสาร (Document Management) ==
-- =====================================================
-- สิทธิ์ทั่วไปสำหรับเอกสารทุกประเภท
INSERT INTO permissions (permission_id, permission_name, description)
VALUES (
    29,
    'document.create_draft',
    'สร้างเอกสารในสถานะฉบับร่าง (Draft) '
  ),
  (30, 'document.submit', 'ส่งเอกสาร (Submitted)'),
  (31, 'document.view', 'ดูเอกสาร'),
  (32, 'document.edit', 'แก้ไขเอกสาร (ทั่วไป)'),
  (
    33,
    'document.admin_edit',
    'แก้ไข / ถอน / ยกเลิกเอกสารที่ส่งแล้ว (Admin Power) '
  ),
  (34, 'document.delete', 'ลบเอกสาร'),
  (
    35,
    'document.attach',
    'จัดการไฟล์แนบ (อัปโหลด / ลบ) '
  ),
  -- สิทธิ์เฉพาะสำหรับ Correspondence
  (
    36,
    'correspondence.create',
    'สร้างเอกสารโต้ตอบ (Correspondence) '
  ),
  -- สิทธิ์เฉพาะสำหรับ Request for Approval (RFA)
  (37, 'rfa.create', 'สร้างเอกสารขออนุมัติ (RFA)'),
  (
    38,
    'rfa.manage_shop_drawings',
    'จัดการข้อมูล Shop Drawing และ Contract Drawing ที่เกี่ยวข้อง'
  ),
  -- สิทธิ์เฉพาะสำหรับ Shop Drawing & Contract Drawing
  (
    39,
    'drawing.create',
    'สร้าง / แก้ไขข้อมูลแบบ (Shop / Contract Drawing)'
  ),
  -- สิทธิ์เฉพาะสำหรับ Transmittal
  (
    40,
    'transmittal.create',
    'สร้างเอกสารนำส่ง (Transmittal)'
  ),
  -- สิทธิ์เฉพาะสำหรับ Circulation Sheet (ใบเวียน)
  (
    41,
    'circulation.create',
    'สร้างใบเวียนเอกสาร (Circulation)'
  ),
  (
    42,
    'circulation.respond',
    'ตอบกลับใบเวียน (Main / Action)'
  ),
  (
    43,
    'circulation.acknowledge',
    'รับทราบใบเวียน (Information)'
  ),
  (44, 'circulation.close', 'ปิดใบเวียน');

-- =====================================================
-- == 4. สิทธิ์การจัดการ Workflow ==
-- =====================================================
INSERT INTO permissions (permission_id, permission_name, description)
VALUES (
    45,
    'workflow.action_review',
    'ดำเนินการในขั้นตอนปัจจุบัน (เช่น ตรวจสอบแล้ว)'
  ),
  (
    46,
    'workflow.force_proceed',
    'บังคับไปยังขั้นตอนถัดไป (Document Control Power)'
  ),
  (
    47,
    'workflow.revert',
    'ย้อนกลับไปยังขั้นตอนก่อนหน้า (Document Control Power)'
  );

-- =====================================================
-- == 5. สิทธิ์ด้านการค้นหาและรายงาน (Search & Reporting) ==
-- =====================================================
INSERT INTO permissions (permission_id, permission_name, description)
VALUES (48, 'search.advanced', 'ใช้งานการค้นหาขั้นสูง'),
  (
    49,
    'report.generate',
    'สร้างรายงานสรุป (รายวัน / สัปดาห์ / เดือน / ปี)'
  );

-- ==========================================================
-- Seed Role-Permissions Mapping (จับคู่สิทธิ์เริ่มต้น)
-- ==========================================================
-- Seed data for the 'role_permissions 'table
-- This table links roles to their specific permissions.
-- NOTE: This assumes the role_id and permission_id FROM the previous seed data files.
-- Superadmin (role_id = 1), Org Admin (role_id = 2), Document Control (role_id = 3), etc.
-- =====================================================
-- == 1. Superadmin (role_id = 1) - Gets ALL permissions ==
-- =====================================================
-- Superadmin can do everything. We can dynamically link all permissions to this role.
-- This is a robust way to ensure Superadmin always has full power.
INSERT INTO role_permissions (role_id, permission_id)
SELECT 1,
  permission_id
FROM permissions;

-- =====================================================
-- == 2. Org Admin (role_id = 2) ==
-- =====================================================
INSERT INTO role_permissions (role_id, permission_id)
VALUES -- จัดการผู้ใช้ในองค์กร
  (2, 18),
  -- user.create
  (2, 19),
  -- user.edit
  (2, 20),
  -- user.delete
  (2, 21),
  -- user.view
  (2, 22),
  -- user.assign_organization
  -- จัดการองค์กร
  (2, 3),
  -- organization.edit
  (2, 5),
  -- organization.view
  -- จัดการข้อมูลหลักที่อนุญาต (เฉพาะ Tags)
  (2, 17),
  -- master_data.tag.manage
  -- ดูข้อมูลต่างๆ ในองค์กร
  (2, 31),
  -- document.view
  (2, 9),
  -- project.view
  (2, 28),
  -- contract.view
  -- การค้นหาและรายงาน
  (2, 48),
  -- search.advanced
  (2, 49);

-- report.generate
-- =====================================================
-- == 3. Document Control (role_id = 3) ==
-- =====================================================
INSERT INTO role_permissions (role_id, permission_id)
VALUES -- สิทธิ์จัดการเอกสารทั้งหมด
  (3, 29),
  -- document.create_draft
  (3, 30),
  -- document.submit
  (3, 31),
  -- document.view
  (3, 32),
  -- document.edit
  (3, 33),
  -- document.admin_edit
  (3, 34),
  -- document.delete
  (3, 35),
  -- document.attach
  -- สิทธิ์สร้างเอกสารแต่ละประเภท
  (3, 36),
  -- correspondence.create
  (3, 37),
  -- rfa.create
  (3, 39),
  -- drawing.create
  (3, 40),
  -- transmittal.create
  (3, 41),
  -- circulation.create
  -- สิทธิ์จัดการ Workflow
  (3, 45),
  -- workflow.action_review
  (3, 46),
  -- workflow.force_proceed
  (3, 47),
  -- workflow.revert
  -- สิทธิ์จัดการ Circulation
  (3, 42),
  -- circulation.respond
  (3, 43),
  -- circulation.acknowledge
  (3, 44),
  -- circulation.close
  -- สิทธิ์อื่นๆ ที่จำเป็น
  (3, 38),
  -- rfa.manage_shop_drawings
  (3, 48),
  -- search.advanced
  (3, 49);

-- report.generate
-- =====================================================
-- == 4. Editor (role_id = 4) ==
-- =====================================================
INSERT INTO role_permissions (role_id, permission_id)
VALUES -- สิทธิ์แก้ไขเอกสาร (แต่ไม่ใช่สิทธิ์ Admin)
  (4, 29),
  -- document.create_draft
  (4, 30),
  -- document.submit
  (4, 31),
  -- document.view
  (4, 32),
  -- document.edit
  (4, 35),
  -- document.attach
  -- สิทธิ์สร้างเอกสารแต่ละประเภท
  (4, 36),
  -- correspondence.create
  (4, 37),
  -- rfa.create
  (4, 39),
  -- drawing.create
  (4, 40),
  -- transmittal.create
  (4, 41),
  -- circulation.create
  -- สิทธิ์อื่นๆ ที่จำเป็น
  (4, 38),
  -- rfa.manage_shop_drawings
  (4, 48);

-- search.advanced
-- =====================================================
-- == 5. Viewer (role_id = 5) ==
-- =====================================================
INSERT INTO role_permissions (role_id, permission_id)
VALUES -- สิทธิ์ดูเท่านั้น
  (5, 31),
  -- document.view
  (5, 48);

-- search.advanced
-- =====================================================
-- == 6. Project Manager (role_id = 6) ==
-- =====================================================
INSERT INTO role_permissions (role_id, permission_id)
VALUES -- สิทธิ์จัดการโครงการ
  (6, 23),
  -- project.manage_members
  (6, 24),
  -- project.create_contracts
  (6, 25),
  -- project.manage_contracts
  (6, 26),
  -- project.view_reports
  (6, 9),
  -- project.view
  -- สิทธิ์จัดการข้อมูลหลักระดับโครงการ
  (6, 16),
  -- master_data.drawing_category.manage
  -- สิทธิ์ดูข้อมูลในสัญญา
  (6, 28),
  -- contract.view
  -- สิทธิ์ในการจัดการเอกสาร (ระดับ Editor)
  (6, 29),
  -- document.create_draft
  (6, 30),
  -- document.submit
  (6, 31),
  -- document.view
  (6, 32),
  -- document.edit
  (6, 35),
  -- document.attach
  (6, 36),
  -- correspondence.create
  (6, 37),
  -- rfa.create
  (6, 39),
  -- drawing.create
  (6, 40),
  -- transmittal.create
  (6, 41),
  -- circulation.create
  (6, 38),
  -- rfa.manage_shop_drawings
  (6, 48),
  -- search.advanced
  (6, 49);

-- report.generate
-- =====================================================
-- == 7. Contract Admin (role_id = 7) ==
-- =====================================================
INSERT INTO role_permissions (role_id, permission_id)
VALUES -- สิทธิ์จัดการสัญญา
  (7, 27),
  -- contract.manage_members
  (7, 28),
  -- contract.view
  -- สิทธิ์ในการอนุมัติ (ส่วนหนึ่งของ Workflow)
  (7, 45),
  -- workflow.action_review
  -- สิทธิ์จัดการข้อมูลเฉพาะสัญญา
  (7, 38),
  -- rfa.manage_shop_drawings
  (7, 39),
  -- drawing.create
  -- สิทธิ์ในการจัดการเอกสาร (ระดับ Editor)
  (7, 29),
  -- document.create_draft
  (7, 30),
  -- document.submit
  (7, 31),
  -- document.view
  (7, 32),
  -- document.edit
  (7, 35),
  -- document.attach
  (7, 36),
  -- correspondence.create
  (7, 37),
  -- rfa.create
  (7, 40),
  -- transmittal.create
  (7, 41),
  -- circulation.create
  (7, 48);

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
VALUES (1, 1, 1, 1, NULL, NULL, NULL),
  (2, 2, 2, 1, NULL, NULL, NULL);

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
    `title`,
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

INSERT INTO `rfas` (
    `id`,
    `rfa_type_id`,
    `discipline_id`,
    `created_at`,
    `created_by`,
    `deleted_at`
  )
VALUES (1, 68, 75, '2025-12-06 05:40:02', 1, NULL);

INSERT INTO `rfa_revisions` (
    `id`,
    `correspondence_id`,
    `rfa_id`,
    `revision_number`,
    `revision_label`,
    `is_current`,
    `rfa_status_code_id`,
    `rfa_approve_code_id`,
    `title`,
    `document_date`,
    `issued_date`,
    `received_date`,
    `approved_date`,
    `description`,
    `details`,
    `schema_version`,
    `created_at`,
    `created_by`,
    `updated_by`
  )
VALUES (
    1,
    2,
    1,
    1,
    'A',
    0,
    2,
    NULL,
    'ขออนุมัติผลการทดสอบเสาเข็มแบบ Dynamic Load Test สำหรับงานเสาเข็มตอกของอาคารสถานีไฟฟ้าย่อย 22 kV. No. 6',
    '2025-12-03',
    '2025-12-04',
    '2025-12-04 12:40:19',
    NULL,
    NULL,
    NULL,
    1,
    '2025-12-06 05:41:25',
    NULL,
    NULL
  );
