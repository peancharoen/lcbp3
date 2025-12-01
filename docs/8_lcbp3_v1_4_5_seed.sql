-- ==========================================================
-- DMS v1.4.5 Document Management System Database
-- Deploy Seed Data
-- ==========================================================
-- Seed organization
insert into organizations (id, organization_code, organization_name)
values (1, 'กทท.', 'การท่าเรือแห่งประเทศไทย'),
  (
    10,
    'สคฉ.3',
    'โครงการพัฒนาท่าเรือแหลมฉบัง ระยะที่ 3'
  ),
  (
    11,
    'สคฉ.3-01',
    'ตรวจรับพัสดุ ที่ปรึกษาควบคุมงาน'
  ),
  (12, 'สคฉ.3-02', 'ตรวจรับพัสดุ งานทางทะเล'),
  (
    13,
    'สคฉ.3-03',
    'ตรวจรับพัสดุ อาคารและระบบสาธารณูปโภค'
  ),
  (
    14,
    'สคฉ.3-04',
    'ตรวจรับพัสดุ ตรวจสอบผลกระทบสิ่งแวดล้อม'
  ),
  (15, 'สคฉ.3-05', 'ตรวจรับพัสดุ เยียวยาการประมง'),
  (
    16,
    'สคฉ.3-06',
    'ตรวจรับพัสดุ งานก่อสร้าง ส่วนที่ 3'
  ),
  (
    17,
    'สคฉ.3-07',
    'ตรวจรับพัสดุ งานก่อสร้าง ส่วนที่ 4'
  ),
  (
    18,
    'สคฉ.3-xx',
    'ตรวจรับพัสดุ ที่ปรึกษาออกแบบ ส่วนที่ 4'
  ),
  (21, 'TEAM', 'Designer Consulting Ltd.'),
  (22, 'คคง.', 'Construction Supervision Ltd.'),
  (41, 'ผรม.1', 'Contractor งานทางทะเล'),
  (42, 'ผรม.2', 'Contractor อาคารและระบบ'),
  (43, 'ผรม.3', 'Contractor #3 Ltd.'),
  (44, 'ผรม.4', 'Contractor #4 Ltd.'),
  (31, 'EN', 'Third Party Environment'),
  (32, 'CAR', 'Third Party Fishery Care');
-- Seed project
insert into projects (project_code, project_name)
values (
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
insert into contracts (
    contract_code,
    contract_name,
    project_id,
    is_active
  )
values (
    'LCBP3-DS',
    'งานจ้างที่ปรีกษาออกแบบ โครงการพัฒนาท่าเรือแหลมฉบัง ระยะที่ 3 (ส่วนที่ 1-4)',
    (
      select id
      from projects
      where project_code = 'LCBP3'
    ),
    true
  ),
  (
    'LCBP3-PS',
    'งานจ้างที่ปรีกษาควบคุมงาน โครงการพัฒนาท่าเรือแหลมฉบัง ระยะที่ 3 (ส่วนที่ 1-4)',
    (
      select id
      from projects
      where project_code = 'LCBP3'
    ),
    true
  ),
  (
    'LCBP3-C1',
    'งานก่อสร้าง โครงการพัฒนาท่าเรือแหลมฉบัง ระยะที่ 3 (ส่วนที่ 1) งานก่อสร้างงานทางทะเล',
    (
      select id
      from projects
      where project_code = 'LCBP3-C1'
    ),
    true
  ),
  (
    'LCBP3-C2',
    'งานก่อสร้าง โครงการพัฒนาท่าเรือแหลมฉบัง ระยะที่ 3 (ส่วนที่ 2) งานก่อสร้างอาคาร ท่าเทียบเรือ ระบบถนน และระบบสาธารณูปโภค',
    (
      select id
      from projects
      where project_code = 'LCBP3-C2'
    ),
    true
  ),
  (
    'LCBP3-C3',
    'งานก่อสร้าง โครงการพัฒนาท่าเรือแหลมฉบัง ระยะที่ 3 (ส่วนที่ 3) งานก่อสร้าง',
    (
      select id
      from projects
      where project_code = 'LCBP3-C3'
    ),
    true
  ),
  (
    'LCBP3-C4',
    'งานก่อสร้าง โครงการพัฒนาท่าเรือแหลมฉบัง ระยะที่ 3 (ส่วนที่ 4) งานก่อสร้าง',
    (
      select id
      from projects
      where project_code = 'LCBP3-C4'
    ),
    true
  ),
  (
    'LCBP3-EN',
    'งานจ้างเหมาตรวจสอบผลกระทบสิ่งแวดล้อมนะหว่างงานก่อสร้างโครงการพัฒนาท่าเรือแหลมฉบัง ระยะที่ 3 (ส่วนที่ 1-4)',
    (
      select id
      from projects
      where project_code = 'LCBP3'
    ),
    true
  );
-- Seed user
-- Initial SUPER_ADMIN user
insert into `users` (
    `user_id`,
    `username`,
    `password_hash`,
    `first_name`,
    `last_name`,
    `email`,
    `line_id`,
    `primary_organization_id`
  )
values (
    1,
    'superadmin',
    '$2b$10$E6d5k.f46jr.POGWKHhiQ.X1ZsFrMpZox//sCxeOiLUULGuAHO0NW',
    'Super',
    'Admin',
    'superadmin @example.com',
    null,
    null
  ),
  (
    2,
    'admin',
    '$2b$10$E6d5k.f46jr.POGWKHhiQ.X1ZsFrMpZox//sCxeOiLUULGuAHO0NW',
    'Admin',
    'คคง.',
    'admin@example.com',
    null,
    1
  ),
  (
    3,
    'editor01',
    '$2b$10$E6d5k.f46jr.POGWKHhiQ.X1ZsFrMpZox//sCxeOiLUULGuAHO0NW',
    'DC',
    'C1',
    'editor01 @example.com',
    null,
    41
  ),
  (
    4,
    'viewer01',
    '$2b$10$E6d5k.f46jr.POGWKHhiQ.X1ZsFrMpZox//sCxeOiLUULGuAHO0NW',
    'Viewer',
    'สคฉ.03',
    'viewer01 @example.com',
    null,
    10
  );
-- ==========================================================
-- Seed Roles (บทบาทพื้นฐาน 5 บทบาท ตาม Req 4.3)
-- ==========================================================
-- 1. Superadmin (Global)
insert into roles (role_id, role_name, scope, description)
values (
    1,
    'Superadmin',
    'Global',
    'ผู้ดูแลระบบสูงสุด: สามารถทำทุกอย่างในระบบ, จัดการองค์กร, และจัดการข้อมูลหลักระดับ Global'
  );
-- 2. Org Admin (Organization)
insert into roles (role_id, role_name, scope, description)
values (
    2,
    'Org Admin',
    'Organization',
    'ผู้ดูแลองค์กร: จัดการผู้ใช้ในองค์กร, จัดการบทบาท / สิทธิ์ภายในองค์กร, และดูรายงานขององค์กร'
  );
-- 3. Document Control (Organization)
insert into roles (role_id, role_name, scope, description)
values (
    3,
    'Document Control',
    'Organization',
    'ควบคุมเอกสารขององค์กร: เพิ่ม / แก้ไข / ลบเอกสาร, และกำหนดสิทธิ์เอกสารภายในองค์กร'
  );
-- 4. Editor (Organization)
insert into roles (role_id, role_name, scope, description)
values (
    4,
    'Editor',
    'Organization',
    'ผู้แก้ไขเอกสารขององค์กร: เพิ่ม / แก้ไขเอกสารที่ได้รับมอบหมาย'
  );
-- 5. Viewer (Organization)
insert into roles (role_id, role_name, scope, description)
values (
    5,
    'Viewer',
    'Organization',
    'ผู้ดูเอกสารขององค์กร: ดูเอกสารที่มีสิทธิ์เข้าถึงเท่านั้น'
  );
-- 6. Project Manager (Project)
insert into roles (role_id, role_name, scope, description)
values (
    6,
    'Project Manager',
    'Project',
    'ผู้จัดการโครงการ: จัดการสมาชิกในโครงการ, สร้าง / จัดการสัญญาในโครงการ, และดูรายงานโครงการ'
  );
-- 7. Contract Admin (Contract)
insert into roles (role_id, role_name, scope, description)
values (
    7,
    'Contract Admin',
    'Contract',
    'ผู้ดูแลสัญญา: จัดการสมาชิกในสัญญา, สร้าง / จัดการข้อมูลหลักเฉพาะสัญญา, และอนุมัติเอกสารในสัญญา'
  );
-- =====================================================
-- 2. Seed Permissions (สิทธิ์การใช้งานทั้งหมด)
-- สิทธิ์ระดับระบบและการจัดการหลัก (System & Master Data)
-- =====================================================
insert into permissions (permission_id, permission_name, description)
values (
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
insert into permissions (permission_id, permission_name, description)
values (
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
insert into permissions (permission_id, permission_name, description)
values (
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
insert into permissions (permission_id, permission_name, description)
values (
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
insert into permissions (permission_id, permission_name, description)
values (48, 'search.advanced', 'ใช้งานการค้นหาขั้นสูง'),
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
-- NOTE: This assumes the role_id and permission_id from the previous seed data files.
-- Superadmin (role_id = 1), Org Admin (role_id = 2), Document Control (role_id = 3), etc.
-- =====================================================
-- == 1. Superadmin (role_id = 1) - Gets ALL permissions ==
-- =====================================================
-- Superadmin can do everything. We can dynamically link all permissions to this role.
-- This is a robust way to ensure Superadmin always has full power.
insert into role_permissions (role_id, permission_id)
select 1,
  permission_id
from permissions;
-- =====================================================
-- == 2. Org Admin (role_id = 2) ==
-- =====================================================
insert into role_permissions (role_id, permission_id)
values -- จัดการผู้ใช้ในองค์กร
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
insert into role_permissions (role_id, permission_id)
values -- สิทธิ์จัดการเอกสารทั้งหมด
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
insert into role_permissions (role_id, permission_id)
values -- สิทธิ์แก้ไขเอกสาร (แต่ไม่ใช่สิทธิ์ Admin)
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
insert into role_permissions (role_id, permission_id)
values -- สิทธิ์ดูเท่านั้น
  (5, 31),
  -- document.view
  (5, 48);
-- search.advanced
-- =====================================================
-- == 6. Project Manager (role_id = 6) ==
-- =====================================================
insert into role_permissions (role_id, permission_id)
values -- สิทธิ์จัดการโครงการ
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
insert into role_permissions (role_id, permission_id)
values -- สิทธิ์จัดการสัญญา
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
insert into `user_assignments` (
    `id`,
    `user_id`,
    `role_id`,
    `organization_id`,
    `project_id`,
    `contract_id`,
    `assigned_by_user_id`
  )
values (1, 1, 1, null, null, null, null),
  (2, 2, 2, 1, null, null, null);
-- =====================================================
-- == 4. การเชื่อมโยงโครงการกับองค์กร (project_organizations) ==
-- =====================================================
-- โครงการหลัก (LCBP3) จะมีองค์กรหลักๆ เข้ามาเกี่ยวข้องทั้งหมด
insert into project_organizations (project_id, organization_id)
select (
    select id
    from projects
    where project_code = 'LCBP3 '
  ),
  id
from organizations
where organization_code in (
    'กทท.',
    'สคฉ.3',
    'TEAM',
    'คคง.',
    'ผรม.1',
    'ผรม.2',
    'ผรม.3',
    'ผรม.4',
    'EN',
    'CAR '
  );
-- โครงการย่อย (LCBP3C1) จะมีเฉพาะองค์กรที่เกี่ยวข้อง
insert into project_organizations (project_id, organization_id)
select (
    select id
    from projects
    where project_code = 'LCBP3-C1 '
  ),
  id
from organizations
where organization_code in ('กทท.', 'สคฉ.3', 'สคฉ.3 -02', 'คคง.', 'ผรม.1 ');
-- ทำเช่นเดียวกันสำหรับโครงการอื่นๆ (ตัวอย่าง)
insert into project_organizations (project_id, organization_id)
select (
    select id
    from projects
    where project_code = 'LCBP3-C2 '
  ),
  id
from organizations
where organization_code in ('กทท.', 'สคฉ.3', 'สคฉ.3 -03', 'คคง.', 'ผรม.2 ');
-- =====================================================
-- == 5. การเชื่อมโยงสัญญากับองค์กร (contract_organizations) ==
-- =====================================================
-- สัญญาที่ปรึกษาออกแบบ (DSLCBP3)
insert into contract_organizations (contract_id, organization_id, role_in_contract)
values (
    (
      select id
      from contracts
      where contract_code = 'LCBP3-DS'
    ),
    (
      select id
      from organizations
      where organization_code = 'กทท.'
    ),
    'Owner'
  ),
  (
    (
      select id
      from contracts
      where contract_code = 'LCBP3-DS'
    ),
    (
      select id
      from organizations
      where organization_code = 'TEAM'
    ),
    'Designer'
  );
-- สัญญาที่ปรึกษาควบคุมงาน (PSLCBP3)
insert into contract_organizations (contract_id, organization_id, role_in_contract)
values (
    (
      select id
      from contracts
      where contract_code = 'LCBP3-PS'
    ),
    (
      select id
      from organizations
      where organization_code = 'กทท.'
    ),
    'Owner'
  ),
  (
    (
      select id
      from contracts
      where contract_code = 'LCBP3-PS'
    ),
    (
      select id
      from organizations
      where organization_code = 'คคง.'
    ),
    'Consultant'
  );
-- สัญญางานก่อสร้าง ส่วนที่ 1 (LCBP3-C1)
insert into contract_organizations (contract_id, organization_id, role_in_contract)
values (
    (
      select id
      from contracts
      where contract_code = 'LCBP3-C1'
    ),
    (
      select id
      from organizations
      where organization_code = 'กทท.'
    ),
    'Owner'
  ),
  (
    (
      select id
      from contracts
      where contract_code = 'LCBP3-C1'
    ),
    (
      select id
      from organizations
      where organization_code = 'ผรม.1'
    ),
    'Contractor'
  );
-- สัญญางานก่อสร้าง ส่วนที่ 2 (LCBP3-C2)
insert into contract_organizations (contract_id, organization_id, role_in_contract)
values (
    (
      select id
      from contracts
      where contract_code = 'LCBP3-C2'
    ),
    (
      select id
      from organizations
      where organization_code = 'กทท.'
    ),
    'Owner'
  ),
  (
    (
      select id
      from contracts
      where contract_code = 'LCBP3-C2'
    ),
    (
      select id
      from organizations
      where organization_code = 'ผรม.2'
    ),
    'Contractor'
  );
-- สัญญาตรวจสอบสิ่งแวดล้อม (LCBP3-EN)
insert into contract_organizations (contract_id, organization_id, role_in_contract)
values (
    (
      select id
      from contracts
      where contract_code = 'LCBP3-EN'
    ),
    (
      select id
      from organizations
      where organization_code = 'กทท.'
    ),
    'Owner'
  ),
  (
    (
      select id
      from contracts
      where contract_code = 'LCBP3-EN'
    ),
    (
      select id
      from organizations
      where organization_code = 'EN'
    ),
    'Consultant'
  );
-- Seed correspondence_status
insert into correspondence_status (status_code, status_name, sort_order, is_active)
values ('DRAFT', 'Draft', 10, 1),
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
insert into correspondence_types (type_code, type_name, sort_order, is_active)
values ('RFA', 'Request for Approval', 1, 1),
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
insert into rfa_types (
    contract_id,
    type_code,
    type_name_en,
    type_name_th
  )
select id,
  'ADW',
  'As Built Drawing',
  'แบบร่างหลังการก่อสร้าง'
from contracts
where contract_code = 'LCBP3-C1'
union all
select id,
  'BC',
  'Box Culvert',
  'ท่อระบายน้ำรูปกล่อง'
from contracts
where contract_code = 'LCBP3-C1'
union all
select id,
  'BM',
  'Benchmark',
  'หมุดหลักฐาน'
from contracts
where contract_code = 'LCBP3-C1'
union all
select id,
  'CER',
  'Certificates',
  'ใบรับรอง'
from contracts
where contract_code = 'LCBP3-C1'
union all
select id,
  'CN',
  'Canal Drainage',
  'ระบบระบายน้ำในคลอง'
from contracts
where contract_code = 'LCBP3-C1'
union all
select id,
  'CON',
  'Contract',
  'สัญญา'
from contracts
where contract_code = 'LCBP3-C1'
union all
select id,
  'DDS',
  'Design Data Submission',
  'นำส่งข้อมูลการออกแบบ'
from contracts
where contract_code = 'LCBP3-C1'
union all
select id,
  'DDW',
  'Draft Drawing',
  'แบบร่าง'
from contracts
where contract_code = 'LCBP3-C1'
union all
select id,
  'DRW',
  'Drawings (All Types)',
  'แบบก่อสร้าง'
from contracts
where contract_code = 'LCBP3-C1'
union all
select id,
  'DSN',
  'Design/Calculation/Manual (All Stages)',
  'ออกแบบ / คำนวณ / คู่มือ'
from contracts
where contract_code = 'LCBP3-C1'
union all
select id,
  'GEN',
  'General',
  'ทั่วไป'
from contracts
where contract_code = 'LCBP3-C1'
union all
select id,
  'ICR',
  'Incident Report',
  'รายงานการเกิดอุบัติเหตุและการบาดเจ็บ'
from contracts
where contract_code = 'LCBP3-C1'
union all
select id,
  'INS',
  'Insurances/Bond/Guarantee',
  'การประกัน / พันธบัตร / การค้ำประกัน'
from contracts
where contract_code = 'LCBP3-C1'
union all
select id,
  'INR',
  'Inspection/Audit/Surveillance Report',
  'รายงานการตรวจสอบ / การตรวจสอบ / รายงานการเฝ้าระวัง'
from contracts
where contract_code = 'LCBP3-C1'
union all
select id,
  'ITP',
  'Inspection and Test Plan',
  'แผนการตรวจสอบและทดสอบ'
from contracts
where contract_code = 'LCBP3-C1'
union all
select id,
  'JSA',
  'Jobs Analysis',
  'รายงานการวิเคราะห์ความปลอดภัย'
from contracts
where contract_code = 'LCBP3-C1'
union all
select id,
  'MAN',
  'Manual',
  'คู่มือ'
from contracts
where contract_code = 'LCBP3-C1'
union all
select id,
  'MAT',
  'Materials/Equipment/Plant',
  'วัสดุ / อุปกรณ์ / โรงงาน'
from contracts
where contract_code = 'LCBP3-C1'
union all
select id,
  'MOM',
  'Minutes of Meeting',
  'รายงานการประชุม'
from contracts
where contract_code = 'LCBP3-C1'
union all
select id,
  'MPR',
  'Monthly Progress Report',
  'รายงานความคืบหน้าประจำเดือน'
from contracts
where contract_code = 'LCBP3-C1'
union all
select id,
  'MST',
  'Method Statement for Construction/Installation',
  'ขั้นตอนการก่อสร้าง / ติดตั้ง'
from contracts
where contract_code = 'LCBP3-C1'
union all
select id,
  'NDS',
  'Non-Design Data Submission',
  'นำส่งข้อมูลที่ไม่เกี่ยวข้องกับการออกแบบ'
from contracts
where contract_code = 'LCBP3-C1'
union all
select id,
  'PMA',
  'Payment/Invoice/Retention/Estimate',
  'การชำระเงิน / ใบแจ้งหนี้ / ประกันผลงาน / ประมาณการ'
from contracts
where contract_code = 'LCBP3-C1'
union all
select id,
  'PRD',
  'Procedure',
  'ระเบียบปฏิบัติ'
from contracts
where contract_code = 'LCBP3-C1'
union all
select id,
  'PRG',
  'Progress of Construction',
  'ความคืบหน้าของการก่อสร้าง / ภาพถ่าย / วิดีโอ'
from contracts
where contract_code = 'LCBP3-C1'
union all
select id,
  'QMS',
  'Quality Document (Plan/Work Instruction)',
  'เอกสารด้านคุณภาพ (แผนงาน / ข้อแนะนำในการทำงาน)'
from contracts
where contract_code = 'LCBP3-C1'
union all
select id,
  'RPT',
  'Report',
  'รายงาน'
from contracts
where contract_code = 'LCBP3-C1'
union all
select id,
  'SAR',
  'Semi Annual Report',
  'รายงานประจำหกเดือน'
from contracts
where contract_code = 'LCBP3-C1'
union all
select id,
  'SCH',
  'Schedule and Program',
  'แผนงาน'
from contracts
where contract_code = 'LCBP3-C1'
union all
select id,
  'SDW',
  'Shop Drawing',
  'แบบขยายรายละเอียด'
from contracts
where contract_code = 'LCBP3-C1'
union all
select id,
  'SI',
  'Soil Investigation',
  'การตรวจสอบดิน'
from contracts
where contract_code = 'LCBP3-C1'
union all
select id,
  'SPE',
  'Specification',
  'ข้อกำหนด'
from contracts
where contract_code = 'LCBP3-C1'
union all
select id,
  'TNR',
  'Training Report',
  'รายงานการฝึกปฏิบัติ'
from contracts
where contract_code = 'LCBP3-C1'
union all
select id,
  'UC',
  'Underground Construction',
  'โครงสร้างใต้ดิน'
from contracts
where contract_code = 'LCBP3-C1'
union all
select id,
  'VEN',
  'Vendor',
  'ผู้ขาย'
from contracts
where contract_code = 'LCBP3-C1'
union all
select id,
  'VRO',
  'Variation Request/Instruction/Order',
  'คำขอเปลี่ยนแปลง / ข้อเสนอแนะ / ข้อเรียกร้อง'
from contracts
where contract_code = 'LCBP3-C1'
union all
select id,
  'WTY',
  'Warranty',
  'การประกัน'
from contracts
where contract_code = 'LCBP3-C1'
union all
select id,
  'GEN',
  'General',
  'ทั่วไป'
from contracts
where contract_code = 'LCBP3-C2'
union all
select id,
  'CON',
  'Contract',
  'สัญญา'
from contracts
where contract_code = 'LCBP3-C2'
union all
select id,
  'INS',
  'Insurances/Bond/Guarantee',
  'การประกัน / พันธบัตร / การค้ำประกัน'
from contracts
where contract_code = 'LCBP3-C2'
union all
select id,
  'SCH',
  'Schedule and Program',
  'แผนงาน'
from contracts
where contract_code = 'LCBP3-C2'
union all
select id,
  'PMA',
  'Payment/Invoice/Retention/Estimate',
  'การชำระเงิน / ใบแจ้งหนี้ / ประกันผลงาน / ประมาณการ'
from contracts
where contract_code = 'LCBP3-C2'
union all
select id,
  'VRO',
  'Variation Request/Instruction/Order',
  'คำขอเปลี่ยนแปลง / ข้อเสนอแนะ / ข้อเรียกร้อง'
from contracts
where contract_code = 'LCBP3-C2'
union all
select id,
  'VEN',
  'Vendor',
  'ผู้ขาย'
from contracts
where contract_code = 'LCBP3-C2'
union all
select id,
  'WTY',
  'Warranty',
  'การประกัน'
from contracts
where contract_code = 'LCBP3-C2'
union all
select id,
  'DRW',
  'Drawings (All Types)',
  'แบบก่อสร้าง'
from contracts
where contract_code = 'LCBP3-C2'
union all
select id,
  'DDW',
  'Draft Drawing',
  'แบบร่าง'
from contracts
where contract_code = 'LCBP3-C2'
union all
select id,
  'SDW',
  'Shop Drawing',
  'แบบขยายรายละเอียด'
from contracts
where contract_code = 'LCBP3-C2'
union all
select id,
  'ADW',
  'As Built Drawing',
  'แบบร่างหลังการก่อสร้าง'
from contracts
where contract_code = 'LCBP3-C2'
union all
select id,
  'DDS',
  'Design Data Submission',
  'นำส่งข้อมูลการออกแบบ'
from contracts
where contract_code = 'LCBP3-C2'
union all
select id,
  'DSN',
  'Design/Calculation/Manual (All Stages)',
  'ออกแบบ / คำนวณ / คู่มือ'
from contracts
where contract_code = 'LCBP3-C2'
union all
select id,
  'NDS',
  'Non-Design Data Submission',
  'นำส่งข้อมูลที่ไม่เกี่ยวข้องกับการออกแบบ'
from contracts
where contract_code = 'LCBP3-C2'
union all
select id,
  'PRD',
  'Procedure',
  'ระเบียบปฏิบัติ'
from contracts
where contract_code = 'LCBP3-C2'
union all
select id,
  'MST',
  'Method Statement for Construction/Installation',
  'ขั้นตอนการก่อสร้าง / ติดตั้ง'
from contracts
where contract_code = 'LCBP3-C2'
union all
select id,
  'QMS',
  'Quality Document (Plan/Work Instruction)',
  'เอกสารด้านคุณภาพ (แผนงาน / ข้อแนะนำในการทำงาน)'
from contracts
where contract_code = 'LCBP3-C2'
union all
select id,
  'INR',
  'Inspection/Audit/Surveillance Report',
  'รายงานการตรวจสอบ / การตรวจสอบ / รายงานการเฝ้าระวัง'
from contracts
where contract_code = 'LCBP3-C2'
union all
select id,
  'ITP',
  'Inspection and Test Plan',
  'แผนการตรวจสอบและทดสอบ'
from contracts
where contract_code = 'LCBP3-C2'
union all
select id,
  'MAT',
  'Materials/Equipment/Plant',
  'วัสดุ / อุปกรณ์ / โรงงาน'
from contracts
where contract_code = 'LCBP3-C2'
union all
select id,
  'SPE',
  'Specification',
  'ข้อกำหนด'
from contracts
where contract_code = 'LCBP3-C2'
union all
select id,
  'MAN',
  'Manual',
  'คู่มือ'
from contracts
where contract_code = 'LCBP3-C2'
union all
select id,
  'CER',
  'Certificates',
  'ใบรับรอง'
from contracts
where contract_code = 'LCBP3-C2'
union all
select id,
  'SAR',
  'Semi Annual Report',
  'รายงานประจำหกเดือน'
from contracts
where contract_code = 'LCBP3-C2'
union all
select id,
  'JSA',
  'Jobs Analysis',
  'รายงานการวิเคราะห์ความปลอดภัย'
from contracts
where contract_code = 'LCBP3-C2'
union all
select id,
  'MOM',
  'Minutes of Meeting',
  'รายงานการประชุม'
from contracts
where contract_code = 'LCBP3-C2'
union all
select id,
  'MPR',
  'Monthly Progress Report',
  'รายงานความคืบหน้าประจำเดือน'
from contracts
where contract_code = 'LCBP3-C2'
union all
select id,
  'ICR',
  'Incident Report',
  'รายงานการเกิดอุบัติเหตุและการบาดเจ็บ'
from contracts
where contract_code = 'LCBP3-C2'
union all
select id,
  'PRG',
  'Progress of Construction',
  'ความคืบหน้าของการก่อสร้าง / ภาพถ่าย / วิดีโอ'
from contracts
where contract_code = 'LCBP3-C2'
union all
select id,
  'RPT',
  'Report',
  'รายงาน'
from contracts
where contract_code = 'LCBP3-C2'
union all
select id,
  'TNR',
  'Training Report',
  'รายงานการฝึกปฏิบัติ'
from contracts
where contract_code = 'LCBP3-C2';
-- Seed rfa_status_codes
insert into rfa_status_codes (
    status_code,
    status_name,
    description,
    sort_order
  )
values ('DFT', 'Draft', 'ฉบับร่าง', 1),
  ('FAP', 'For Approve', 'เพื่อขออนุมัติ', 11),
  ('FRE', 'For Review', 'เพื่อตรวจสอบ', 12),
  ('FCO', 'For Construction', 'เพื่อก่อสร้าง', 20),
  ('ASB', 'AS - Built', 'แบบก่อสร้างจริง', 30),
  ('OBS', 'Obsolete', 'ไม่ใช้งาน', 80),
  ('CC', 'Canceled', 'ยกเลิก', 99);
insert into rfa_approve_codes (
    approve_code,
    approve_name,
    sort_order,
    is_active
  )
values ('1A', 'Approved by Authority', 10, 1),
  ('1C', 'Approved by CSC', 11, 1),
  ('1N', 'Approved As Note', 12, 1),
  ('1R', 'Approved with Remarks', 13, 1),
  ('3C', 'Consultant Comments', 31, 1),
  ('3R', 'Revise
    and Resubmit', 32, 1),
  ('4X', 'Reject', 40, 1),
  ('5N', 'No Further Action', 50, 1);
-- Seed circulation_status_codes
insert into circulation_status_codes (code, description, sort_order)
values ('OPEN', 'Open', 1),
  ('IN_REVIEW', 'In Review', 2),
  ('COMPLETED', 'ปCompleted', 3),
  ('CANCELLED', 'Cancelled / Withdrawn', 9);
-- ตาราง "แม่" ของ RFA (มีความสัมพันธ์ 1:N กับ rfa_revisions)
-- ==========================================================
-- SEED DATA 6B.md (Disciplines, RFA Types, Sub Types)
-- ==========================================================
-- 1. Seed ข้อมูล Disciplines (สาขางาน)
-- LCBP3-C1
insert into disciplines (
    contract_id,
    discipline_code,
    code_name_th,
    code_name_en
  )
select id,
  'GEN',
  'งานบริหารโครงการ',
  'General Management'
from contracts
where contract_code = 'LCBP3-C1'
union all
select id,
  'COD',
  'สัญญาและข้อโต้แย้ง',
  'Contracting'
from contracts
where contract_code = 'LCBP3-C1'
union all
select id,
  'QSB',
  'สำรวจปริมาณและควบคุมงบประมาณ',
  'Quantity Survey and Budget Control'
from contracts
where contract_code = 'LCBP3-C1'
union all
select id,
  'PPG',
  'บริหารแผนและความก้าวหน้า',
  'Plan and Progress Management'
from contracts
where contract_code = 'LCBP3-C1'
union all
select id,
  'PRC',
  'งานจัดซื้อ',
  'Procurement'
from contracts
where contract_code = 'LCBP3-C1'
union all
select id,
  'SUB',
  'ผู้รับเหมาช่วง',
  'Subcontractor'
from contracts
where contract_code = 'LCBP3-C1'
union all
select id,
  'ODC',
  'สำนักงาน-ควบคุมเอกสาร',
  'Operation Docment Control'
from contracts
where contract_code = 'LCBP3-C1'
union all
select id,
  'LAW',
  'กฎหมาย',
  'Law'
from contracts
where contract_code = 'LCBP3-C1'
union all
select id,
  'TRF',
  'จราจร',
  'Traffic'
from contracts
where contract_code = 'LCBP3-C1'
union all
select id,
  'BIM',
  'BIM',
  'Building information modeling'
from contracts
where contract_code = 'LCBP3-C1'
union all
select id,
  'SRV',
  'งานสำรวจ',
  'Survey'
from contracts
where contract_code = 'LCBP3-C1'
union all
select id,
  'SFT',
  'ความปลอดภัย',
  'Safety'
from contracts
where contract_code = 'LCBP3-C1'
union all
select id,
  'BST',
  'งานโครงสร้างอาคาร',
  'Building Structure Work'
from contracts
where contract_code = 'LCBP3-C1'
union all
select id,
  'TEM',
  'งานชั่วคราว',
  'Temporary Work'
from contracts
where contract_code = 'LCBP3-C1'
union all
select id,
  'UTL',
  'งานระบบสาธารณูปโภค',
  'Utility'
from contracts
where contract_code = 'LCBP3-C1'
union all
select id,
  'EPW',
  'งานระบบไฟฟ้า',
  'Electrical Power Work'
from contracts
where contract_code = 'LCBP3-C1'
union all
select id,
  'ECM',
  'งานระบบไฟฟ้าสื่อสาร',
  'Electrical Communication Work'
from contracts
where contract_code = 'LCBP3-C1'
union all
select id,
  'ENV',
  'สิ่งแวดล้อม',
  'Environment'
from contracts
where contract_code = 'LCBP3-C1'
union all
select id,
  'AQV',
  'คุณภาพอากาศและความสั่นสะเทือน',
  'Air quality and vibration'
from contracts
where contract_code = 'LCBP3-C1'
union all
select id,
  'WAB',
  'คุณภาพน้ำและชีววิทยาทางน้ำ',
  'Water quality and Aquatic biology'
from contracts
where contract_code = 'LCBP3-C1'
union all
select id,
  'ONS',
  'วิศวกรรมชายฝั่ง',
  'Onshore Engineer Work'
from contracts
where contract_code = 'LCBP3-C1'
union all
select id,
  'PPR',
  'มวลชนสัมพันธ์และการประชาสัมพันธ์',
  'Public Relations'
from contracts
where contract_code = 'LCBP3-C1'
union all
select id,
  'OSW',
  'งานก่อสร้างงานทางทะเล',
  'Offshore Work'
from contracts
where contract_code = 'LCBP3-C1'
union all
select id,
  'DRE',
  'งานขุดและถมทะเล',
  'Dredging and Reclamation'
from contracts
where contract_code = 'LCBP3-C1'
union all
select id,
  'REV',
  'งานคันหินล้อมพื้นที่ถมทะเล',
  'Revetment'
from contracts
where contract_code = 'LCBP3-C1'
union all
select id,
  'BRW',
  'งานเขื่อนกันคลื่น',
  'Breakwater'
from contracts
where contract_code = 'LCBP3-C1'
union all
select id,
  'SOI',
  'ปรับปรุงคุณภาพดิน',
  'Soil Improvement'
from contracts
where contract_code = 'LCBP3-C1'
union all
select id,
  'BLC',
  'งานปรับปรุงคลองบางละมุง',
  'Bang Lamung Canal Bank Protection'
from contracts
where contract_code = 'LCBP3-C1'
union all
select id,
  'FUP',
  'งานประตูระบายน้ำและท่อลอด',
  'Floodgate & Under Ground Piping Works'
from contracts
where contract_code = 'LCBP3-C1'
union all
select id,
  'SWP',
  'งานอาคารควบคุมสถานีสูบน้ำทะเล',
  'Sea Water Pumping Station Control BuilDing'
from contracts
where contract_code = 'LCBP3-C1'
union all
select id,
  'NAV',
  'งานติดตั้งเครื่องหมายช่วงการเดินเรือ',
  'Navigations Aids'
from contracts
where contract_code = 'LCBP3-C1'
union all
select id,
  'GEO',
  'งานด้านธรณีเทคนิค',
  'Geotechnical'
from contracts
where contract_code = 'LCBP3-C1'
union all
select id,
  'CRW',
  'งานด้านโยธา - Rock Works',
  'Civil-Rock work'
from contracts
where contract_code = 'LCBP3-C1'
union all
select id,
  'DVR',
  'ทีมนักประดาน้ำ',
  'Dive Work'
from contracts
where contract_code = 'LCBP3-C1'
union all
select id,
  'MTS',
  'งานทดสอบวัสดุและธรณีเทคนิค',
  'Materials and Geotechnical Testing'
from contracts
where contract_code = 'LCBP3-C1'
union all
select id,
  'OTH',
  'อื่นๆ',
  'Other'
from contracts
where contract_code = 'LCBP3-C1';
-- LCBP3-C2
insert into disciplines (
    contract_id,
    discipline_code,
    code_name_th,
    code_name_en
  )
select id,
  'GEN',
  'งานบริหารโครงการ',
  'Project Management'
from contracts
where contract_code = 'LCBP3-C2'
union all
select id,
  'COD',
  'สัญญาและข้อโต้แย้ง',
  'Contracts and arguments'
from contracts
where contract_code = 'LCBP3-C2'
union all
select id,
  'QSB',
  'สำรวจปริมาณและควบคุมงบประมาณ',
  'Survey the quantity and control the budget'
from contracts
where contract_code = 'LCBP3-C2'
union all
select id,
  'PPM',
  'บริหารแผนและความก้าวหน้า',
  'Plan Management & Progress'
from contracts
where contract_code = 'LCBP3-C2'
union all
select id,
  'ODC',
  'สำนักงาน-ควบคุมเอกสาร',
  'Document Control Office'
from contracts
where contract_code = 'LCBP3-C2'
union all
select id,
  'LAW',
  'กฎหมาย',
  'Law'
from contracts
where contract_code = 'LCBP3-C2'
union all
select id,
  'TRF',
  'จราจร',
  'Traffic'
from contracts
where contract_code = 'LCBP3-C2'
union all
select id,
  'BIM',
  'Building Information Modeling',
  'Building Information Modeling'
from contracts
where contract_code = 'LCBP3-C2'
union all
select id,
  'SRV',
  'งานสำรวจ',
  'Survey'
from contracts
where contract_code = 'LCBP3-C2'
union all
select id,
  'SFT',
  'ความปลอดภัย',
  'Safety'
from contracts
where contract_code = 'LCBP3-C2'
union all
select id,
  'BST',
  'งานโครงสร้างอาคาร',
  'Building Structure'
from contracts
where contract_code = 'LCBP3-C2'
union all
select id,
  'UTL',
  'งานะบบสาธารณูปโภค',
  'Public Utilities'
from contracts
where contract_code = 'LCBP3-C2'
union all
select id,
  'EPW',
  'งานระบบไฟฟ้า',
  'Electrical Systems'
from contracts
where contract_code = 'LCBP3-C2'
union all
select id,
  'ECM',
  'งานระบบไฟฟ้าสื่อสาร',
  'Electrical Communication System'
from contracts
where contract_code = 'LCBP3-C2'
union all
select id,
  'ENV',
  'สิ่งแวดล้อม',
  'Environment'
from contracts
where contract_code = 'LCBP3-C2'
union all
select id,
  'AQV',
  'คุณภาพอากาศและความสั่นสะเทือน',
  'Air Quality and Vibration'
from contracts
where contract_code = 'LCBP3-C2'
union all
select id,
  'WAB',
  'คุณภาพน้ำและชีววิทยาทางน้ำ',
  'Water Quality and Aquatic Biology'
from contracts
where contract_code = 'LCBP3-C2'
union all
select id,
  'ONS',
  'วิศวกรรมชายฝั่ง',
  'Coastal Engineering'
from contracts
where contract_code = 'LCBP3-C2'
union all
select id,
  'PPR',
  'มวลชนสัมพันธ์และประชาสัมพันธ์',
  'Mass Relations and Public Relations'
from contracts
where contract_code = 'LCBP3-C2'
union all
select id,
  'OFW',
  'งานก่อสร้างทางทะเล',
  'Marine Construction'
from contracts
where contract_code = 'LCBP3-C2'
union all
select id,
  'EXR',
  'งานขุดและถมทะเล',
  'Excavation and reclamation'
from contracts
where contract_code = 'LCBP3-C2'
union all
select id,
  'GEO',
  'งานด้านธรณีเทคนิค',
  'Geotechnical work'
from contracts
where contract_code = 'LCBP3-C2'
union all
select id,
  'CRW',
  'งานด้านโยธา - Rock Works',
  'Civil Works - Rock Works'
from contracts
where contract_code = 'LCBP3-C2'
union all
select id,
  'DVW',
  'ทีมนักประดาน้ำ',
  'Team of Divers'
from contracts
where contract_code = 'LCBP3-C2'
union all
select id,
  'MTT',
  'งานทดสอบวัสดุ',
  'Materials Testing'
from contracts
where contract_code = 'LCBP3-C2'
union all
select id,
  'ARC',
  'งานสถาปัตยกรรม',
  'Architecture'
from contracts
where contract_code = 'LCBP3-C2'
union all
select id,
  'STR',
  'งานโครงสร้าง',
  'Structural work'
from contracts
where contract_code = 'LCBP3-C2'
union all
select id,
  'SAN',
  'งานระบบสุขาภิบาล',
  'Sanitation System'
from contracts
where contract_code = 'LCBP3-C2'
union all
select id,
  'DRA',
  'งานระบบระบายน้ำ',
  'Drainage system work'
from contracts
where contract_code = 'LCBP3-C2'
union all
select id,
  'TER',
  'งานท่าเทียบเรือ',
  'Terminal Work work'
from contracts
where contract_code = 'LCBP3-C2'
union all
select id,
  'BUD',
  'งานอาคาร',
  'Building'
from contracts
where contract_code = 'LCBP3-C2'
union all
select id,
  'ROW',
  'งานถนนและสะพาน',
  'Road and Bridge Work'
from contracts
where contract_code = 'LCBP3-C2'
union all
select id,
  'MEC',
  'งานเคริองกล',
  'Mechanical work'
from contracts
where contract_code = 'LCBP3-C2'
union all
select id,
  'OTH',
  'อื่น ๆ',
  'Others'
from contracts
where contract_code = 'LCBP3-C2';
-- 2. Seed ข้อมูล Correspondence Sub Types (Mapping RFA Types กับ Number)
-- เนื่องจาก sub_type_code ตรงกับ RFA Type Code แต่ Req ต้องการ Mapping เป็น Number
-- LCBP3-C1
insert into correspondence_sub_types (
    contract_id,
    correspondence_type_id,
    sub_type_code,
    sub_type_name,
    sub_type_number
  )
select c.id,
  ct.id,
  'MAT',
  'Material Approval',
  '11'
from contracts c,
  correspondence_types ct
where c.contract_code = 'LCBP3-C1'
  and ct.type_code = 'RFA'
union all
select c.id,
  ct.id,
  'SHP',
  'Shop Drawing Submittal',
  '12'
from contracts c,
  correspondence_types ct
where c.contract_code = 'LCBP3-C1'
  and ct.type_code = 'RFA'
union all
select c.id,
  ct.id,
  'DWG',
  'Document Approval',
  '13'
from contracts c,
  correspondence_types ct
where c.contract_code = 'LCBP3-C1'
  and ct.type_code = 'RFA'
union all
select c.id,
  ct.id,
  'MET',
  'Engineering Document Submittal',
  '14'
from contracts c,
  correspondence_types ct
where c.contract_code = 'LCBP3-C1'
  and ct.type_code = 'RFA';
-- LCBP3-C2
insert into correspondence_sub_types (
    contract_id,
    correspondence_type_id,
    sub_type_code,
    sub_type_name,
    sub_type_number
  )
select c.id,
  ct.id,
  'MAT',
  'Material Approval',
  '21'
from contracts c,
  correspondence_types ct
where c.contract_code = 'LCBP3-C2'
  and ct.type_code = 'RFA'
union all
select c.id,
  ct.id,
  'SHP',
  'Shop Drawing Submittal',
  '22'
from contracts c,
  correspondence_types ct
where c.contract_code = 'LCBP3-C2'
  and ct.type_code = 'RFA'
union all
select c.id,
  ct.id,
  'DWG',
  'Document Approval',
  '23'
from contracts c,
  correspondence_types ct
where c.contract_code = 'LCBP3-C2'
  and ct.type_code = 'RFA'
union all
select c.id,
  ct.id,
  'MET',
  'Engineering Document Submittal',
  '24'
from contracts c,
  correspondence_types ct
where c.contract_code = 'LCBP3-C2'
  and ct.type_code = 'RFA';
-- LCBP3-C3
insert into correspondence_sub_types (
    contract_id,
    correspondence_type_id,
    sub_type_code,
    sub_type_name,
    sub_type_number
  )
select c.id,
  ct.id,
  'MAT',
  'Material Approval',
  '31'
from contracts c,
  correspondence_types ct
where c.contract_code = 'LCBP3-C3'
  and ct.type_code = 'RFA'
union all
select c.id,
  ct.id,
  'SHP',
  'Shop Drawing Submittal',
  '32'
from contracts c,
  correspondence_types ct
where c.contract_code = 'LCBP3-C3'
  and ct.type_code = 'RFA'
union all
select c.id,
  ct.id,
  'DWG',
  'Document Approval',
  '33'
from contracts c,
  correspondence_types ct
where c.contract_code = 'LCBP3-C3'
  and ct.type_code = 'RFA'
union all
select c.id,
  ct.id,
  'MET',
  'Engineering Document Submittal',
  '34'
from contracts c,
  correspondence_types ct
where c.contract_code = 'LCBP3-C4'
  and ct.type_code = 'RFA';
-- Note: 6B data has C4 on the right column for MET but C3 on left, checking logic... MD says C3 for first 3 rows, then C4 mixed. I will assume C4 starts at row 12 in the MD table.
-- LCBP3-C4
insert into correspondence_sub_types (
    contract_id,
    correspondence_type_id,
    sub_type_code,
    sub_type_name,
    sub_type_number
  )
select c.id,
  ct.id,
  'MAT',
  'Material Approval',
  '41'
from contracts c,
  correspondence_types ct
where c.contract_code = 'LCBP3-C4'
  and ct.type_code = 'RFA'
union all
select c.id,
  ct.id,
  'SHP',
  'Shop Drawing Submittal',
  '42'
from contracts c,
  correspondence_types ct
where c.contract_code = 'LCBP3-C4'
  and ct.type_code = 'RFA'
union all
select c.id,
  ct.id,
  'DWG',
  'Document Approval',
  '43'
from contracts c,
  correspondence_types ct
where c.contract_code = 'LCBP3-C4'
  and ct.type_code = 'RFA'
union all
select c.id,
  ct.id,
  'MET',
  'Engineering Document Submittal',
  '44'
from contracts c,
  correspondence_types ct
where c.contract_code = 'LCBP3-C4'
  and ct.type_code = 'RFA';
