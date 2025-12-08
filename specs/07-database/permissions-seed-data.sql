-- ==========================================================
-- DMS v1.5.1 - Permissions Seed Data (REORGANIZED)
-- File: specs/07-database/permissions-seed-data.sql
-- Total Permissions: 85 (Reorganized with systematic ID allocation)
-- Created: 2025-12-08
-- ==========================================================
-- Clear existing data
TRUNCATE TABLE role_permissions;

DELETE FROM permissions;

-- ==========================================================
-- SECTION 1: PERMISSIONS INSERT STATEMENTS
-- ==========================================================
-- ==========================================================
-- 1. System & Global Permissions (ID 1-10)
-- ==========================================================
INSERT INTO permissions (
    permission_id,
    permission_name,
    description,
    module,
    is_active
  )
VALUES (
    1,
    'system.manage_all',
    'ทำทุกอย่างในระบบ (Superadmin Power)',
    'system',
    1
  ),
  (
    2,
    'system.impersonate',
    'แอบอ้างผู้ใช้อื่น (For Support/Debug)',
    'system',
    1
  ),
  (
    3,
    'system.maintenance_mode',
    'เปิด/ปิด Maintenance Mode',
    'system',
    1
  ),
  (
    4,
    'system.view_logs',
    'ดู System Logs',
    'system',
    1
  ),
  (
    5,
    'system.manage_cache',
    'จัดการ Cache (Clear/Flush)',
    'system',
    1
  );

-- ==========================================================
-- 2. Organization Management (ID 11-20)
-- ==========================================================
INSERT INTO permissions (
    permission_id,
    permission_name,
    description,
    module,
    is_active
  )
VALUES (
    11,
    'organization.create',
    'สร้างองค์กรใหม่',
    'organization',
    1
  ),
  (
    12,
    'organization.view',
    'ดูรายการองค์กร',
    'organization',
    1
  ),
  (
    13,
    'organization.edit',
    'แก้ไขข้อมูลองค์กร',
    'organization',
    1
  ),
  (
    14,
    'organization.delete',
    'ลบองค์กร',
    'organization',
    1
  ),
  (
    15,
    'organization.manage_members',
    'จัดการสมาชิกในองค์กร',
    'organization',
    1
  );

-- ==========================================================
-- 3. User & Role Management (ID 21-40) - PRIORITIZED
-- ==========================================================
INSERT INTO permissions (
    permission_id,
    permission_name,
    description,
    module,
    is_active
  )
VALUES (
    21,
    'user.create',
    'สร้างผู้ใช้งานใหม่',
    'user',
    1
  ),
  (22, 'user.view', 'ดูข้อมูลผู้ใช้งาน', 'user', 1),
  (
    23,
    'user.edit',
    'แก้ไขข้อมูลผู้ใช้งาน',
    'user',
    1
  ),
  (
    24,
    'user.delete',
    'ลบ/ปิดการใช้งานผู้ใช้',
    'user',
    1
  ),
  (
    25,
    'user.manage_assignments',
    'มอบหมาย Role/Project ให้ผู้ใช้',
    'user',
    1
  ),
  (
    26,
    'role.create',
    'สร้างบทบาท (Role) ใหม่',
    'role',
    1
  ),
  (27, 'role.view', 'ดูบทบาท', 'role', 1),
  (28, 'role.edit', 'แก้ไขบทบาท', 'role', 1),
  (29, 'role.delete', 'ลบบทบาท', 'role', 1),
  (
    30,
    'role.assign_permissions',
    'มอบสิทธิ์ให้กับบทบาท',
    'role',
    1
  );

-- ==========================================================
-- 4. Master Data Management (ID 41-50)
-- ==========================================================
INSERT INTO permissions (
    permission_id,
    permission_name,
    description,
    module,
    is_active
  )
VALUES (
    41,
    'master_data.view',
    'ดูข้อมูลหลัก (Read-Only Dropdowns)',
    'master',
    1
  ),
  (
    42,
    'master_data.manage',
    'จัดการข้อมูลหลักทั่วไป',
    'master',
    1
  ),
  (
    43,
    'master_data.correspondence_type.manage',
    'จัดการประเภทเอกสาร',
    'master',
    1
  ),
  (
    44,
    'master_data.document_status.manage',
    'จัดการสถานะเอกสาร',
    'master',
    1
  ),
  (
    45,
    'master_data.drawing_category.manage',
    'จัดการหมวดหมู่แบบ',
    'master',
    1
  ),
  (
    46,
    'master_data.tag.manage',
    'จัดการ Tags',
    'master',
    1
  ),
  (
    47,
    'master_data.discipline.manage',
    'จัดการสาขางาน (Disciplines)',
    'master',
    1
  ),
  (
    48,
    'master_data.number_format.manage',
    'จัดการ Document Number Format',
    'master',
    1
  );

-- ==========================================================
-- 5. Document Management - Generic (ID 51-70)
-- ==========================================================
INSERT INTO permissions (
    permission_id,
    permission_name,
    description,
    module,
    is_active
  )
VALUES (
    51,
    'document.view',
    'ดูเอกสาร (ทุกประเภท)',
    'document',
    1
  ),
  (
    52,
    'document.create',
    'สร้างเอกสาร (Draft)',
    'document',
    1
  ),
  (
    53,
    'document.edit',
    'แก้ไขเอกสาร',
    'document',
    1
  ),
  (54, 'document.delete', 'ลบเอกสาร', 'document', 1),
  (
    55,
    'document.submit',
    'ส่งเอกสาร (Submitted)',
    'document',
    1
  ),
  (
    56,
    'document.admin_edit',
    'แก้ไข/ถอน/ยกเลิกเอกสารที่ส่งแล้ว (Admin Power)',
    'document',
    1
  ),
  (
    57,
    'document.attach_files',
    'จัดการไฟล์แนบ (Upload/Delete)',
    'document',
    1
  ),
  (
    58,
    'document.manage_references',
    'จัดการการอ้างอิงเอกสาร',
    'document',
    1
  );

-- ==========================================================
-- 6. Correspondence Module (ID 71-80)
-- ==========================================================
INSERT INTO permissions (
    permission_id,
    permission_name,
    description,
    module,
    is_active
  )
VALUES (
    71,
    'correspondence.create',
    'สร้างเอกสารโต้ตอบ',
    'correspondence',
    1
  ),
  (
    72,
    'correspondence.view',
    'ดูเอกสารโต้ตอบ',
    'correspondence',
    1
  ),
  (
    73,
    'correspondence.edit',
    'แก้ไขเอกสารโต้ตอบ',
    'correspondence',
    1
  ),
  (
    74,
    'correspondence.delete',
    'ลบเอกสารโต้ตอบ',
    'correspondence',
    1
  ),
  (
    75,
    'correspondence.submit',
    'ส่งเอกสารโต้ตอบ',
    'correspondence',
    1
  );

-- ==========================================================
-- 7. RFA Module (ID 81-90)
-- ==========================================================
INSERT INTO permissions (
    permission_id,
    permission_name,
    description,
    module,
    is_active
  )
VALUES (81, 'rfa.create', 'สร้างเอกสาร RFA', 'rfa', 1),
  (82, 'rfa.view', 'ดูเอกสาร RFA', 'rfa', 1),
  (83, 'rfa.edit', 'แก้ไขเอกสาร RFA', 'rfa', 1),
  (84, 'rfa.delete', 'ลบเอกสาร RFA', 'rfa', 1),
  (
    85,
    'rfa.submit',
    'ส่ง RFA เข้า Workflow',
    'rfa',
    1
  ),
  (
    86,
    'rfa.manage_items',
    'จัดการ RFA Items (Link Drawings)',
    'rfa',
    1
  );

-- ==========================================================
-- 8. Drawing Module (ID 91-100)
-- ==========================================================
INSERT INTO permissions (
    permission_id,
    permission_name,
    description,
    module,
    is_active
  )
VALUES (
    91,
    'drawing.view',
    'ดูข้อมูลแบบ (Shop/Contract)',
    'drawing',
    1
  ),
  (
    92,
    'drawing.create',
    'สร้าง/แก้ไขแบบ',
    'drawing',
    1
  ),
  (93, 'drawing.delete', 'ลบแบบ', 'drawing', 1),
  (
    94,
    'drawing.manage_revisions',
    'จัดการ Revisions แบบ',
    'drawing',
    1
  ),
  (
    95,
    'drawing.link_contract',
    'เชื่อมโยง Shop Drawing กับ Contract Drawing',
    'drawing',
    1
  );

-- ==========================================================
-- 9. Circulation Module (ID 101-110)
-- ==========================================================
INSERT INTO permissions (
    permission_id,
    permission_name,
    description,
    module,
    is_active
  )
VALUES (
    101,
    'circulation.create',
    'สร้างใบเวียน',
    'circulation',
    1
  ),
  (
    102,
    'circulation.view',
    'ดูใบเวียน',
    'circulation',
    1
  ),
  (
    103,
    'circulation.respond',
    'ตอบกลับใบเวียน (Main/Action)',
    'circulation',
    1
  ),
  (
    104,
    'circulation.acknowledge',
    'รับทราบใบเวียน (Information)',
    'circulation',
    1
  ),
  (
    105,
    'circulation.close',
    'ปิดใบเวียน',
    'circulation',
    1
  );

-- ==========================================================
-- 10. Transmittal Module (ID 111-120)
-- ==========================================================
INSERT INTO permissions (
    permission_id,
    permission_name,
    description,
    module,
    is_active
  )
VALUES (
    111,
    'transmittal.create',
    'สร้าง Transmittal',
    'transmittal',
    1
  ),
  (
    112,
    'transmittal.view',
    'ดู Transmittal',
    'transmittal',
    1
  ),
  (
    113,
    'transmittal.edit',
    'แก้ไข Transmittal',
    'transmittal',
    1
  ),
  (
    114,
    'transmittal.delete',
    'ลบ Transmittal',
    'transmittal',
    1
  ),
  (
    115,
    'transmittal.print',
    'พิมพ์ Transmittal Letter',
    'transmittal',
    1
  );

-- ==========================================================
-- 11. Workflow Engine (ID 121-130)
-- ==========================================================
INSERT INTO permissions (
    permission_id,
    permission_name,
    description,
    module,
    is_active
  )
VALUES (
    121,
    'workflow.view_definitions',
    'ดู Workflow Definitions',
    'workflow',
    1
  ),
  (
    122,
    'workflow.manage_definitions',
    'จัดการ Workflow Definitions',
    'workflow',
    1
  ),
  (
    123,
    'workflow.action_review',
    'ดำเนินการในขั้นตอนปัจจุบัน (Approve/Reject)',
    'workflow',
    1
  ),
  (
    124,
    'workflow.force_proceed',
    'บังคับไปยังขั้นตอนถัดไป (Document Control Power)',
    'workflow',
    1
  ),
  (
    125,
    'workflow.revert',
    'ย้อนกลับไปยังขั้นตอนก่อนหน้า (Document Control Power)',
    'workflow',
    1
  );

-- ==========================================================
-- 12. Document Numbering (ID 131-140)
-- ==========================================================
INSERT INTO permissions (
    permission_id,
    permission_name,
    description,
    module,
    is_active
  )
VALUES (
    131,
    'numbering.view_formats',
    'ดู Number Formats',
    'numbering',
    1
  ),
  (
    132,
    'numbering.manage_formats',
    'จัดการ Number Formats',
    'numbering',
    1
  ),
  (
    133,
    'numbering.view_counters',
    'ดู Counters',
    'numbering',
    1
  ),
  (
    134,
    'numbering.reset_counter',
    'Reset Counter (Dangerous Operation)',
    'numbering',
    1
  );

-- ==========================================================
-- 13. Search & Reporting (ID 141-150)
-- ==========================================================
INSERT INTO permissions (
    permission_id,
    permission_name,
    description,
    module,
    is_active
  )
VALUES (141, 'search.basic', 'ค้นหาพื้นฐาน', 'search', 1),
  (
    142,
    'search.advanced',
    'ใช้งานการค้นหาขั้นสูง',
    'search',
    1
  ),
  (
    143,
    'search.export',
    'Export ผลการค้นหา',
    'search',
    1
  ),
  (144, 'report.view', 'ดูรายงาน', 'report', 1),
  (
    145,
    'report.generate',
    'สร้างรายงานสรุป',
    'report',
    1
  ),
  (
    146,
    'report.schedule',
    'กำหนดรายงานอัตโนมัติ',
    'report',
    1
  );

-- ==========================================================
-- 14. Notification & Dashboard (ID 151-160)
-- ==========================================================
INSERT INTO permissions (
    permission_id,
    permission_name,
    description,
    module,
    is_active
  )
VALUES (
    151,
    'notification.view',
    'ดูการแจ้งเตือนของตัวเอง',
    'notification',
    1
  ),
  (
    152,
    'notification.manage_all',
    'จัดการการแจ้งเตือนทั้งหมด (Admin)',
    'notification',
    1
  ),
  (
    153,
    'dashboard.view_own',
    'ดู Dashboard ของตัวเอง',
    'dashboard',
    1
  ),
  (
    154,
    'dashboard.view_all',
    'ดู Dashboard ทุกคน (Admin)',
    'dashboard',
    1
  ),
  (
    155,
    'dashboard.view_analytics',
    'ดู Analytics & Statistics',
    'dashboard',
    1
  );

-- ==========================================================
-- 15. JSON Schema Management (ID 161-170)
-- ==========================================================
INSERT INTO permissions (
    permission_id,
    permission_name,
    description,
    module,
    is_active
  )
VALUES (
    161,
    'json_schema.view',
    'ดู JSON Schemas',
    'json_schema',
    1
  ),
  (
    162,
    'json_schema.manage',
    'จัดการ JSON Schemas',
    'json_schema',
    1
  ),
  (
    163,
    'json_schema.migrate_data',
    'Migrate Data ระหว่าง Schema Versions',
    'json_schema',
    1
  );

-- ==========================================================
-- 16. Monitoring & Admin Tools (ID 171-180)
-- ==========================================================
INSERT INTO permissions (
    permission_id,
    permission_name,
    description,
    module,
    is_active
  )
VALUES (
    171,
    'monitoring.view_health',
    'ดู Health Check Status',
    'monitoring',
    1
  ),
  (
    172,
    'monitoring.view_metrics',
    'ดู System Metrics',
    'monitoring',
    1
  ),
  (
    173,
    'monitoring.manage_maintenance',
    'จัดการ Maintenance Mode',
    'monitoring',
    1
  ),
  (
    174,
    'audit.view_own',
    'ดู Audit Logs ของตัวเอง',
    'audit',
    1
  ),
  (
    175,
    'audit.view_all',
    'ดู Audit Logs ทั้งหมด (Admin)',
    'audit',
    1
  );

-- ==========================================================
-- 17. Project & Contract Management (ID 201-220) - DEPRIORITIZED
-- ==========================================================
INSERT INTO permissions (
    permission_id,
    permission_name,
    description,
    module,
    is_active
  )
VALUES (
    201,
    'project.create',
    'สร้างโครงการใหม่',
    'project',
    1
  ),
  (
    202,
    'project.view',
    'ดูรายการโครงการ',
    'project',
    1
  ),
  (
    203,
    'project.edit',
    'แก้ไขข้อมูลโครงการ',
    'project',
    1
  ),
  (204, 'project.delete', 'ลบโครงการ', 'project', 1),
  (
    205,
    'project.manage_members',
    'จัดการสมาชิกในโครงการ',
    'project',
    1
  ),
  (
    211,
    'contract.create',
    'สร้างสัญญา',
    'contract',
    1
  ),
  (
    212,
    'contract.view',
    'ดูข้อมูลสัญญา',
    'contract',
    1
  ),
  (
    213,
    'contract.edit',
    'แก้ไขสัญญา',
    'contract',
    1
  ),
  (214, 'contract.delete', 'ลบสัญญา', 'contract', 1),
  (
    215,
    'contract.manage_members',
    'จัดการสมาชิกในสัญญา',
    'contract',
    1
  );

-- ==========================================================
-- SECTION 2: ROLE-PERMISSION MAPPINGS
-- ==========================================================
-- ==========================================================
-- Role 1: Superadmin - Gets ALL Permissions
-- ==========================================================
INSERT INTO role_permissions (role_id, permission_id)
SELECT 1,
  permission_id
FROM permissions
WHERE is_active = 1;

-- ==========================================================
-- Role 2: Org Admin (Organization Scope)
-- Permissions: 22 total
-- ==========================================================
INSERT INTO role_permissions (role_id, permission_id)
VALUES -- User Management
  (2, 21),
  -- user.create
  (2, 22),
  -- user.view
  (2, 23),
  -- user.edit
  (2, 24),
  -- user.delete
  (2, 25),
  -- user.manage_assignments
  -- Organization
  (2, 12),
  -- organization.view
  -- Master Data
  (2, 46),
  -- master_data.tag.manage
  -- Documents
  (2, 51),
  -- document.view
  -- Project/Contract
  (2, 202),
  -- project.view
  (2, 212),
  -- contract.view
  -- Search & Reports
  (2, 141),
  -- search.basic
  (2, 142),
  -- search.advanced
  (2, 144),
  -- report.view
  (2, 145),
  -- report.generate
  -- Dashboard & Notification
  (2, 153),
  -- dashboard.view_own
  (2, 151),
  -- notification.view
  -- Audit
  (2, 174);

-- audit.view_own
-- ==========================================================
-- Role 3: Document Control (Organization Scope)
-- Permissions: 50+ total
-- ==========================================================
INSERT INTO role_permissions (role_id, permission_id)
VALUES -- All Document Operations
  (3, 51),
  (3, 52),
  (3, 53),
  (3, 54),
  (3, 55),
  (3, 56),
  (3, 57),
  (3, 58),
  -- All Correspondence
  (3, 71),
  (3, 72),
  (3, 73),
  (3, 74),
  (3, 75),
  -- All RFA
  (3, 81),
  (3, 82),
  (3, 83),
  (3, 84),
  (3, 85),
  (3, 86),
  -- All Drawing
  (3, 91),
  (3, 92),
  (3, 93),
  (3, 94),
  (3, 95),
  -- All Circulation
  (3, 101),
  (3, 102),
  (3, 103),
  (3, 104),
  (3, 105),
  -- All Transmittal
  (3, 111),
  (3, 112),
  (3, 113),
  (3, 114),
  (3, 115),
  -- Workflow Actions
  (3, 123),
  (3, 124),
  (3, 125),
  -- Master Data
  (3, 41),
  (3, 42),
  (3, 43),
  (3, 44),
  (3, 45),
  (3, 46),
  (3, 47),
  (3, 48),
  -- Search & Report
  (3, 141),
  (3, 142),
  (3, 143),
  (3, 144),
  (3, 145),
  -- Dashboard
  (3, 153),
  (3, 154),
  -- Notification
  (3, 151);

-- ==========================================================
-- Role 4: Editor (Organization Scope)
-- Permissions: 30 total
-- ==========================================================
INSERT INTO role_permissions (role_id, permission_id)
VALUES -- Document
  (4, 51),
  (4, 52),
  (4, 53),
  (4, 55),
  (4, 57),
  -- Correspondence
  (4, 71),
  (4, 72),
  (4, 73),
  (4, 75),
  -- RFA
  (4, 81),
  (4, 82),
  (4, 83),
  (4, 85),
  (4, 86),
  -- Drawing
  (4, 91),
  (4, 92),
  (4, 94),
  -- Circulation
  (4, 101),
  (4, 102),
  (4, 103),
  (4, 104),
  -- Transmittal
  (4, 111),
  (4, 112),
  (4, 113),
  -- Search
  (4, 141),
  (4, 142),
  -- Dashboard & Notification
  (4, 153),
  (4, 151);

-- ==========================================================
-- Role 5: Viewer (Organization Scope)
-- Permissions: 15 total
-- ==========================================================
INSERT INTO role_permissions (role_id, permission_id)
VALUES -- View Only
  (5, 51),
  -- document.view
  (5, 72),
  -- correspondence.view
  (5, 82),
  -- rfa.view
  (5, 91),
  -- drawing.view
  (5, 102),
  -- circulation.view
  (5, 104),
  -- circulation.acknowledge
  (5, 112),
  -- transmittal.view
  (5, 41),
  -- master_data.view
  (5, 141),
  -- search.basic
  (5, 153),
  -- dashboard.view_own
  (5, 151);

-- notification.view
-- ==========================================================
-- Role 6: Project Manager (Project Scope)
-- Permissions: All Editor + Project Management + Reports
-- ==========================================================
INSERT INTO role_permissions (role_id, permission_id)
SELECT 6,
  permission_id
FROM role_permissions
WHERE role_id = 4 -- Copy all Editor permissions
UNION
VALUES -- Project Management
  (6, 201),
  (6, 202),
  (6, 203),
  (6, 204),
  (6, 205),
  -- Reports & Analytics
  (6, 144),
  (6, 145),
  (6, 155);

-- ==========================================================
-- Role 7: Contract Admin (Contract Scope)
-- Permissions: All Editor + Contract Management + Workflow
-- ==========================================================
INSERT INTO role_permissions (role_id, permission_id)
SELECT 7,
  permission_id
FROM role_permissions
WHERE role_id = 4 -- Copy all Editor permissions
UNION
VALUES -- Contract Management
  (7, 211),
  (7, 212),
  (7, 213),
  (7, 214),
  (7, 215),
  -- Workflow
  (7, 123),
  -- All Drawings
  (7, 91),
  (7, 92),
  (7, 93),
  (7, 94),
  (7, 95);

-- ==========================================================
-- VERIFICATION: Run permissions-verification.sql after this
-- ==========================================================
