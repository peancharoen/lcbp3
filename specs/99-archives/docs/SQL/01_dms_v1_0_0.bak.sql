-- ==========================================================
-- DMS v1.0.0
-- Database v1.0 - Deploy Script Schema
-- Server: Container Station on QNAPQNAP TS-473A
-- Database service: MariaDB 10.11
-- database web ui: phpmyadmin 5-apache
-- database deelopment ui: DBeaver
-- backend sevice: NestJS
-- frontend sevice: next.js
-- reverse proxy: jc21/nginx-proxy-manager:latest
-- cron service: n8n
-- Notes:
-- ==========================================================

SET NAMES utf8mb4;
SET time_zone = '+07:00';

-- ปิดการตรวจสอบ Foreign Key ชั่วคราวเพื่อให้สามารถลบตารางได้ทั้งหมด
SET FOREIGN_KEY_CHECKS=0;

-- Level 1: ตารางที่มีความสัมพันธ์มากที่สุด (Junction Tables & Detail Tables)
DROP TABLE IF EXISTS audit_logs;
DROP TABLE IF EXISTS user_project_roles;
DROP TABLE IF EXISTS user_roles;
DROP TABLE IF EXISTS role_permissions;
DROP TABLE IF EXISTS contract_parties;
DROP TABLE IF EXISTS project_parties;
DROP TABLE IF EXISTS correspondence_references;
DROP TABLE IF EXISTS correspondence_cc_recipients;
DROP TABLE IF EXISTS correspondence_routing_steps;
DROP TABLE IF EXISTS correspondence_routing_template_steps;
DROP TABLE IF EXISTS rfa_items;
DROP TABLE IF EXISTS transmittal_items;
DROP TABLE IF EXISTS technicaldoc_workflows;
DROP TABLE IF EXISTS technicaldoc_workflow_template_steps;
DROP TABLE IF EXISTS shop_drawing_revisions;
DROP TABLE IF EXISTS contract_dwg_subcat_cat_map;
DROP TABLE IF EXISTS circulation_template_assignees;
DROP TABLE IF EXISTS cir_action_documents;
DROP TABLE IF EXISTS cir_actions;
DROP TABLE IF EXISTS attachments;
DROP TABLE IF EXISTS cir_recipients;
DROP TABLE IF EXISTS circulation_assignees;
DROP TABLE IF EXISTS correspondence_status_transitions;
DROP TABLE IF EXISTS global_default_roles;

-- Level 2: ตารางที่ถูกอ้างอิงโดย Level 1
DROP TABLE IF EXISTS correspondence_revisions;
DROP TABLE IF EXISTS transmittals;
DROP TABLE IF EXISTS circulations;
DROP TABLE IF EXISTS correspondence_routing_templates;
DROP TABLE IF EXISTS technicaldoc_workflow_templates;
DROP TABLE IF EXISTS shop_drawings;
DROP TABLE IF EXISTS contract_drawings;
DROP TABLE IF EXISTS technicaldocs;
DROP TABLE IF EXISTS circulation_templates;
DROP TABLE IF EXISTS correspondence_tags;
DROP TABLE IF EXISTS tags;

-- Level 3: ตารางที่ถูกอ้างอิงโดย Level 2
DROP TABLE IF EXISTS correspondences;
DROP TABLE IF EXISTS shop_drawing_sub_categories;
DROP TABLE IF EXISTS shop_drawing_main_categories;
DROP TABLE IF EXISTS contract_dwg_sub_cat;
DROP TABLE IF EXISTS contract_dwg_cat;
DROP TABLE IF EXISTS technicaldoc_approve_codes;
DROP TABLE IF EXISTS technicaldoc_status_codes;
DROP TABLE IF EXISTS technicaldoc_types;
DROP TABLE IF EXISTS contract_dwg_volume;

-- Level 4: ตาราง Master Data หลัก และตารางที่ถูกอ้างอิงโดย Level 3
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS projects;
DROP TABLE IF EXISTS contracts;
DROP TABLE IF EXISTS correspondence_status; -- Using this name from your list
DROP TABLE IF EXISTS correspondence_types;
DROP TABLE IF EXISTS cir_status_codes;
DROP TABLE IF EXISTS permissions;
DROP TABLE IF EXISTS roles;

-- Level 5: ตารางที่เป็นรากฐานที่สุด
DROP TABLE IF EXISTS organizations;
DROP TABLE IF EXISTS organization_roles;

-- เปิดการตรวจสอบ Foreign Key กลับมาเหมือนเดิม
SET FOREIGN_KEY_CHECKS=1;

-- ==========================================================
-- Table Creation
-- ==========================================================
-- Level 5: Organizations 
-- ==========================================================
-- 5.1 Organizations_roles Table
CREATE TABLE organization_roles (
  role_id   INT NOT NULL AUTO_INCREMENT PRIMARY KEY COMMENT 'ID ของตาราง', 
  role_name VARCHAR(20) NOT NULL COMMENT 'ชื่อบทบาทขององค์กร',
  UNIQUE KEY ux_roles_name (role_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='Organizations Roles';

-- Seed organization_roles
INSERT INTO organization_roles (role_name) VALUES
('OWNER'),
('DESIGNER'),
('CONSULTANT'),
('CONTRACTOR'),
('THIRD PARTY');

-- 5.2 Organizations Table
CREATE TABLE organizations (
  org_id        INT NOT NULL PRIMARY KEY COMMENT 'ID ของตาราง',
  org_code      VARCHAR(20) NOT NULL COMMENT 'รหัสองค์กร',
  org_name      VARCHAR(255) NOT NULL COMMENT 'ชื่อองค์กร',
  role_id       INT NULL COMMENT 'บทบาทขององค์กร (FK -> organization_roles)',
  is_active     BOOLEAN NOT NULL DEFAULT TRUE COMMENT 'สถานะการใช้งาน',
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'วันที่สร้าง',
  updated_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'วันที่แก้ไขล่าสุด',
  -- PRIMARY KEY (org_id),
  UNIQUE KEY ux_organizations_code (org_code),
  FOREIGN KEY (role_id) REFERENCES organization_roles(role_id)
    ON DELETE SET NULL
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='Organizations Table';

INSERT INTO organizations (org_id, org_code, org_name, role_id) VALUES (1, 'กทท.','การท่าเรือแห่งประเทศไทย',1);
INSERT INTO organizations (org_id, org_code, org_name, role_id) VALUES (10, 'สคฉ.3','สำนักงานโครงการพัฒนาท่าเรือแหลมฉบัง ระยะที่ 3 (ส่วนที่ 1-4)', 1);
INSERT INTO organizations (org_id, org_code, org_name, role_id) VALUES (11, 'สคฉ.3-01','คณะกรรมการตรวจรับพัสดุ งานจ้างที่ปรีกษาควบคุมงาน โครงการพัฒนาท่าเรือแหลมฉบัง ระยะที่ 3 (ส่วนที่ 1-4)', 1);
INSERT INTO organizations (org_id, org_code, org_name, role_id) VALUES (12, 'สคฉ.3-02','คณะกรรมการตรวจรับพัสดุ งานก่อสร้าง โครงการพัฒนาท่าเรือแหลมฉบัง ระยะที่ 3 (ส่วนที่ 1) งานก่อสร้างงานทางทะเล', 1);
INSERT INTO organizations (org_id, org_code, org_name, role_id) VALUES (13, 'สคฉ.3-03','คณะกรรมการตรวจรับพัสดุ งานก่อสร้าง โครงการพัฒนาท่าเรือแหลมฉบัง ระยะที่ 3 (ส่วนที่ 2) งานก่อสร้างอาคาร ท่าเทียบเรือ ระบบถนน และระบบสาธารณูปโภค',1);
INSERT INTO organizations (org_id, org_code, org_name, role_id) VALUES (16, 'สคฉ.3-06','คณะกรรมการตรวจรับพัสดุ งานก่อสร้าง โครงการพัฒนาท่าเรือแหลมฉบัง ระยะที่ 3 (ส่วนที่ 3) งานก่อสร้าง', 1);
INSERT INTO organizations (org_id, org_code, org_name, role_id) VALUES (17, 'สคฉ.3-07','คณะกรรมการตรวจรับพัสดุ งานก่อสร้าง โครงการพัฒนาท่าเรือแหลมฉบัง ระยะที่ 3 (ส่วนที่ 4) งานก่อสร้าง', 1);
INSERT INTO organizations (org_id, org_code, org_name, role_id) VALUES (18, 'สคฉ.3-xx','คณะกรรมการตรวจรับพัสดุ งานจ้างที่ปรีกษาออกแบบ โครงการพัฒนาท่าเรือแหลมฉบัง ระยะที่ 3 (ส่วนที่ 4) งานก่อสร้าง', 1);
INSERT INTO organizations (org_id, org_code, org_name, role_id) VALUES (14, 'สคฉ.3-04','คณะกรรมการตรวจรับพัสด งานจ้างเหมาตรวจสอบผลกระทบสิ่งแวดล้อมระหว่างงานก่อสร้างโครงการพัฒนาท่าเรือแหลมฉบัง ระยะที่ 3 (ส่วนที่ 1-4)', 1);
INSERT INTO organizations (org_id, org_code, org_name, role_id) VALUES (15, 'สคฉ.3-05','คณะกรรมการตรวจรับพัสดุ งานเยียวยาการประมงและเพาะเลี้ยงสัตว์น้ำ', 1);
INSERT INTO organizations (org_id, org_code, org_name, role_id) VALUES (21, 'TEAM',' Designer Consulting Ltd.', 2);
INSERT INTO organizations (org_id, org_code, org_name, role_id) VALUES (22, 'คคง.','Construction Supervision Ltd.', 3);
INSERT INTO organizations (org_id, org_code, org_name, role_id) VALUES (41, 'ผรม.1',' โครงการพัฒนาท่าเรือแหลมฉบังระยะที่ 3 (ส่วนที่ 1) งานก่อสร้างงานทางทะเล', 4);
INSERT INTO organizations (org_id, org_code, org_name, role_id) VALUES (42, 'ผรม.2','ผรม.2 โครงการพัฒนาท่าเรือแหลมฉบัง ระยะที่ 3 (ส่วนที่ 2) งานก่อสร้างอาคาร ท่าเทียบเรือ ระบบถนน และระบบสาธารณูปโภค', 4);
INSERT INTO organizations (org_id, org_code, org_name, role_id) VALUES (43, 'ผรม.3','ผรม.3 Contractor Company #3 Ltd.', 4);
INSERT INTO organizations (org_id, org_code, org_name, role_id) VALUES (44, 'ผรม.4','ผรม.4 Contractor Company #4 Ltd.', 4);
INSERT INTO organizations (org_id, org_code, org_name, role_id) VALUES (31, 'EN','Third Party Environment', 5);
INSERT INTO organizations (org_id, org_code, org_name, role_id) VALUES (32, 'CAR','Third Party Care for Fishery', 5);

-- ==========================================================
-- Level 4: ตาราง Master Data หลัก
-- ==========================================================
-- 4.1 Roles Table (RBAC)
CREATE TABLE roles (
  role_id     INT AUTO_INCREMENT PRIMARY KEY COMMENT 'ID ของตาราง',
  role_code   VARCHAR(50) NOT NULL UNIQUE COMMENT 'รหัสบทบาท', -- SUPER_ADMIN / ADMIN / EDITOR / VIEWER
  role_name   VARCHAR(100) NOT NULL COMMENT 'ชื่อบทบาท',
  description TEXT COMMENT 'คำอธิบายบทบาท',
  is_system   BOOLEAN NOT NULL DEFAULT FALSE COMMENT 'ระบุว่าบทบาทนี้เป็นระบบหรือไม่ (ไม่สามารถลบได้ถ้าเป็นระบบ)'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='Roles Table';

INSERT INTO roles (role_code, role_name, description, is_system) VALUES
  ('SUPER_ADMIN','Super Administrator', 'Full access to entire system, cross-organization' ,1),
  ('ADMIN',      'Administrator',       'Full access but limited to their own organization',1),
  ('EDITOR',     'Editor',              'Can create/edit RFA/Drawings/Docs/Transmittals'   ,1),
  ('VIEWER',     'Viewer',              'Read-only access'                                  ,0),
  ('GUEST',      'Guest',               'Limited read-only access'                          ,0)
ON DUPLICATE KEY UPDATE
  role_name=VALUES(role_name),
  description=VALUES(description),
  is_system=VALUES(is_system);

-- 4.2 Permissions Table (RBAC)
CREATE TABLE permissions (
  permission_id   INT NOT NULL AUTO_INCREMENT PRIMARY KEY COMMENT 'ID ของตาราง',
  permission_code VARCHAR(100) NOT NULL COMMENT 'รหัสสิทธิ์การใช้งาน', -- e.g., drawings.view, drawings.upload, drawings.delete
  description     TEXT COMMENT 'คำอธิบายสิทธิ์การใช้งาน',
  module          VARCHAR(50) NULL COMMENT 'โมดูลที่เกี่ยวข้อง',
  scope_level     ENUM('GLOBAL','ORG','PROJECT') DEFAULT 'GLOBAL' COMMENT 'ระดับขอบเขตของสิทธิ์การใช้งาน',
  is_active       TINYINT(1) NOT NULL DEFAULT 1 COMMENT 'สถานะการใช้งาน',
  UNIQUE KEY ux_permissions_code (permission_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='Permissions Table';

INSERT INTO permissions (permission_code, description, module, scope_level) VALUES
 -- System
 ('superadmin.access','Access Everything (All Orgs)','admin','GLOBAL'),
 ('admin.access','Access Admin Panel (scoped)','admin','ORG'),
 ('settings.manage','Manage Settings','admin','GLOBAL'),
 -- Projects & Parties
 ('projects.view','View Projects','projects','ORG'),
 ('projects.manage','Create/Edit/Delete Projects','projects','ORG'),
 ('project_parties.manage','Manage Project Parties','projects','ORG'),
 -- Organizations
 ('organizations.view','View Organizations','organizations','GLOBAL'),
 ('organizations.manage','Manage Organizations','organizations','GLOBAL'),
 -- Drawings
 ('drawings.view','View Drawings','drawings','PROJECT'),
 ('drawings.upload','Upload Drawing Revisions','drawings','PROJECT'),
 ('drawings.delete','Delete Drawings/Revisions','drawings','PROJECT'),
 -- Documents/Materials/MS
 ('documents.view','View Documents','documents','PROJECT'),
 ('documents.manage','Manage Documents/Revisions','documents','PROJECT'),
 ('materials.view','View Materials','materials','PROJECT'),
 ('materials.manage','Manage Materials/Revisions','materials','PROJECT'),
 ('ms.view','View Method Statements','ms','PROJECT'),
 ('ms.manage','Manage Method Statements/Revisions','ms','PROJECT'),
 -- RFAs
 ('rfas.view','View RFAs','rfas','PROJECT'),
 ('rfas.create','Create RFA','rfas','PROJECT'),
 ('rfas.respond','Respond / Update RFA','rfas','PROJECT'),
 ('rfas.delete','Delete RFA','rfas','PROJECT'),
 -- Correspondence & Transmittal & Circulation
 ('corr.view','View Correspondences','correspondence','PROJECT'),
 ('corr.manage','Manage Correspondences','correspondence','PROJECT'),
 ('transmittals.manage','Manage Transmittals','transmittal','PROJECT'),
 ('cirs.manage','Manage Circulations','circulation','ORG'),
 -- Reports
 ('reports.view','View Reports','reports','GLOBAL')
ON DUPLICATE KEY UPDATE
  description=VALUES(description),
  module=VALUES(module),
  scope_level=VALUES(scope_level),
  is_active=1;

-- 4.5 cir_status_codes Table
CREATE TABLE cir_status_codes (
  cir_status_code_id INT AUTO_INCREMENT PRIMARY KEY COMMENT 'ID ของตาราง',
  code        VARCHAR(20) NOT NULL UNIQUE COMMENT 'รหัสสถานะการดำเนินงาน',
  description VARCHAR(50) NULL COMMENT 'คำอธิบายสถานะการดำเนินงาน',
  sort_order  INT DEFAULT 0 COMMENT 'ลำดับการแสดงผล',
  is_active   TINYINT(1) DEFAULT 1 COMMENT 'สถานะการใช้งาน'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='รหัสสถานะการดำเนินงาน';

INSERT INTO cir_status_codes (code, description, sort_order) VALUES
('OPEN', 'Open', 10),
('IN_REVIEW', 'In Review', 20),
('COMPLETED', 'Completed', 30),
('CANCELLED', 'Cancelled/Withdrawn', 99);

-- 4.6 correspondence_types Table
CREATE TABLE correspondence_types (
  type_id     INT AUTO_INCREMENT PRIMARY KEY COMMENT 'ID ของตาราง',
  type_code   VARCHAR(50) UNIQUE COMMENT 'รหัสประเภทหนังสือ',
  type_name   VARCHAR(255) NOT NULL COMMENT 'ชื่อประเภทหนังสือ',
  sort_order  INT DEFAULT 0 COMMENT 'ลำดับการแสดงผล',
  is_active   TINYINT(1) DEFAULT 1 COMMENT 'สถานะการใช้งาน'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='ตารางประเภทหนังสือ';

INSERT INTO correspondence_types (type_code, type_name, sort_order, is_active) VALUES
 ('RFA',         'Request for Approval',       10,1),
 ('EMAIL',       'Email',                      20,1), 
 ('INSTRUCTION', 'Instruction',                30,1),
 ('LETTER',      'Letter',                     40,1),
 ('MEMO',        'Memorandum',                 50,1),
 ('MOM',         'Minutes of Meeting',         60,1),
 ('RFI',         'Request for Information',    70,1),
 ('TRANSMITTAL', 'Transmittal',                80,1);

-- 4.7 correspondence_status Table
CREATE TABLE correspondence_status (
  status_id   INT AUTO_INCREMENT PRIMARY KEY COMMENT 'ID ของตาราง',
  status_code VARCHAR(50) UNIQUE COMMENT 'รหัสสถานะหนังสือ',
  status_name VARCHAR(255) NOT NULL COMMENT 'ชื่อสถานะหนังสือ',
  sort_order  INT DEFAULT 0 COMMENT 'ลำดับการแสดงผล',
  is_active   TINYINT(1) DEFAULT 1 COMMENT 'สถานะการใช้งาน'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='ตารางสถานะหนังสือ';

INSERT INTO correspondence_status (status_code, status_name, sort_order, is_active) VALUES
 ('DRAFT',  'Draft',                    10,1),
 ('SUBOWN', 'Submitted to Owner',       21,1),
 ('SUBDSN', 'Submitted to Designer',    22,1),
 ('SUBCSC', 'Submitted to CSC',         23,1),
 ('SUBCON', 'Submitted to Contractor',  24,1),
 ('SUBOTH', 'Submitted to Others',      25,1),
 ('REPOWN', 'Reply by Owner',           31,1),
 ('REPDSN', 'Reply by  Designer',       32,1),
 ('REPCSC', 'Reply by  CSC',            33,1),
 ('REPCON', 'Reply by  Contractor',     34,1),
 ('REPOTH', 'Reply by Others',          35,1),
 ('RSBOWN', 'Resubmited by Owner',      41,1),
 ('RSBDSN', 'Resubmited by Designer',   42,1),
 ('RSBCSC', 'Resubmited by CSC',        43,1),
 ('RSBCON', 'Resubmited by Contractor', 44,1),
 ('CLBOWN', 'Closed by Owner',          51,1),
 ('CLBDSN', 'Closed by Designer',       52,1),
 ('CLBCSC', 'Closed by CSC',            53,1),
 ('CLBCON', 'Closed by Contractor',     54,1),
 ('CCBOWN', 'Canceled by Owner',        91,1),
 ('CCBDSN', 'Canceled by Designer',     92,1),
 ('CCBCSC', 'Canceled by CSC',          93,1),
 ('CCBCON', 'Canceled by Contractor',   94,1);

-- 4.8 contracts Table: Stores information about each contract.
CREATE TABLE contracts (
  contract_id   INT NOT NULL AUTO_INCREMENT PRIMARY KEY COMMENT 'ID ของตาราง',
  contract_code VARCHAR(50) NOT NULL COMMENT 'รหัสสัญญา',
  contract_name VARCHAR(255) NOT NULL COMMENT 'ชื่อสัญญา',
  description   TEXT COMMENT 'คำอธิบายสัญญา',
  start_date    DATE COMMENT 'วันที่เริ่มสัญญา',
  end_date      DATE COMMENT 'วันที่สิ้นสุดสัญญา',
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'วันที่สร้าง',
  updated_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'วันที่แก้ไขล่าสุด',
  UNIQUE KEY ux_contracts_code (contract_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='ตารางสัญญา';

INSERT INTO contracts (contract_code, contract_name) VALUES
('DSLCBP3', 'งานจ้างที่ปรีกษาออกแบบ โครงการพัฒนาท่าเรือแหลมฉบัง ระยะที่ 3 (ส่วนที่ 1-4)'),
('PSLCBP3', 'งานจ้างที่ปรีกษาควบคุมงาน โครงการพัฒนาท่าเรือแหลมฉบัง ระยะที่ 3 (ส่วนที่ 1-4)'),
('LCBP3-C1', 'งานก่อสร้าง โครงการพัฒนาท่าเรือแหลมฉบัง ระยะที่ 3 (ส่วนที่ 1) งานก่อสร้างงานทางทะเล'),
('LCBP3-C2', 'งานก่อสร้าง โครงการพัฒนาท่าเรือแหลมฉบัง ระยะที่ 3 (ส่วนที่ 2) งานก่อสร้างอาคาร ท่าเทียบเรือ ระบบถนน และระบบสาธารณูปโภค'),
('LCBP3-C3', 'งานก่อสร้าง โครงการพัฒนาท่าเรือแหลมฉบัง ระยะที่ 3 (ส่วนที่ 3) งานก่อสร้าง'),
('LCBP3-C4', 'งานก่อสร้าง โครงการพัฒนาท่าเรือแหลมฉบัง ระยะที่ 3 (ส่วนที่ 4) งานก่อสร้าง'),
('ENLCBP3', 'งานจ้างเหมาตรวจสอบผลกระทบสิ่งแวดล้อมนะหว่างงานก่อสร้างโครงการพัฒนาท่าเรือแหลมฉบัง ระยะที่ 3 (ส่วนที่ 1-4)');

-- 4.9 Projects (contractor optional, FK -> organizations with SET NULL)
CREATE TABLE projects (
  project_id         INT AUTO_INCREMENT PRIMARY KEY COMMENT 'ID ของตาราง',
  project_code       VARCHAR(50)  NOT NULL UNIQUE COMMENT 'รหัสโครงการ',
  project_name       VARCHAR(255) NOT NULL COMMENT 'ชื่อโครงการ',
  parent_project_id  INT NULL COMMENT 'รหัสโครงการหลัก (ถ้ามี)',
  contractor_org_id  INT NULL COMMENT 'รหัสองค์กรผู้รับเหมา (ถ้ามี)',
  is_active          TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'สถานะการใช้งาน',
  CONSTRAINT uq_pro_code UNIQUE (project_code),
  CONSTRAINT fk_pro_parent      FOREIGN KEY (parent_project_id) REFERENCES projects(project_id) ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT fk_proj_contractor  FOREIGN KEY (contractor_org_id) REFERENCES organizations(org_id) ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='ตารางโครงการ';
CREATE INDEX idx_pp_parent ON projects(parent_project_id);
CREATE INDEX idx_pp_contractor ON projects(contractor_org_id);

INSERT INTO projects (project_code, project_name) VALUES
 ('LCBP3','โครงการพัฒนาท่าเรือแหลมฉบัง ระยะที่ 3 (ส่วนที่ 1-4)'),
 ('LCBP3C1','โครงการพัฒนาท่าเรือแหลมฉบัง ระยะที่ 3 (ส่วนที่ 1) งานก่อสร้างงานทางทะเล'),
 ('LCBP3C2','โครงการพัฒนาท่าเรือแหลมฉบัง ระยะที่ 3 (ส่วนที่ 2) งานก่อสร้างอาคาร ท่าเทียบเรือ ระบบถนน และระบบสาธารณูปโภค'),
 ('LCBP3C3','โครงการพัฒนาท่าเรือแหลมฉบัง ระยะที่ 3 (ส่วนที่ 3) งานก่อสร้าง'),
 ('LCBP3C4','โครงการพัฒนาท่าเรือแหลมฉบัง ระยะที่ 3 (ส่วนที่ 4) งานก่อสร้าง');

-- 4.10 Users Table (RBAC)
CREATE TABLE users (
  user_id         INT NOT NULL AUTO_INCREMENT PRIMARY KEY COMMENT 'ID ของตาราง',
  username        VARCHAR(50) NOT NULL UNIQUE COMMENT 'ชื่อผู้ใช้งาน',
  password_hash   VARCHAR(255) NOT NULL COMMENT 'รหัสผ่านแบบแฮช',
  first_name      VARCHAR(50) NULL DEFAULT NULL COMMENT 'ชื่อจริง',
  last_name       VARCHAR(50) NULL DEFAULT NULL COMMENT 'นามสกุล',
  email           VARCHAR(100) NULL UNIQUE COMMENT 'อีเมลผู้ใช้งาน',
  line_id         VARCHAR(100) NULL COMMENT 'LINE ID',  
  org_id          INT NULL COMMENT 'รหัสองค์กร (FK -> organizations)', -- link to organizations for ADMIN scope
  is_active       TINYINT(1) NOT NULL DEFAULT 1 COMMENT 'สถานะการใช้งาน',
  failed_attempts INT NOT NULL DEFAULT 0 COMMENT 'จำนวนครั้งที่ล็อกอินล้มเหลว',
  locked_until    DATETIME NULL COMMENT 'ล็อกอินไม่ได้จนถึงเวลา',
  last_login_at   TIMESTAMP NULL COMMENT 'วันที่และเวลาที่ล็อกอินล่าสุด',
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'วันที่สร้าง',
  updated_at      TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP COMMENT 'วันที่แก้ไขล่าสุด',
  UNIQUE KEY ux_users_username (username),
  UNIQUE KEY ux_users_email (email),
  CONSTRAINT fk_users_org FOREIGN KEY (org_id) REFERENCES organizations(org_id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='ตารางผู้ใช้งาน';

-- Initial SUPER_ADMIN user
INSERT INTO users (username, password_hash, email, is_active)
VALUES ('superadmin', '$2y$10$0kjBMxWq7E4G7P.dc8r5i.cjiPBiup553AsFpDfxUt31gKg9h/udq', 'superadmin@example.com', 1)
ON DUPLICATE KEY UPDATE email=VALUES(email), is_active=VALUES(is_active);

-- Create editor01 user
INSERT IGNORE INTO users (username, password_hash, email, is_active)
VALUES ('editor01', '$2y$10$0kjBMxWq7E4G7P.dc8r5i.cjiPBiup553AsFpDfxUt31gKg9h/udq', 'editor01@example.com', 1);

-- Create viewer01 user (password hash placeholder, must change later)
INSERT IGNORE INTO users (username, password_hash, email, is_active)
VALUES ('viewer01', '$2y$10$0kjBMxWq7E4G7P.dc8r5i.cjiPBiup553AsFpDfxUt31gKg9h/udq', 'viewer01@example.com', 1);

-- ==========================================================
-- Level 3: ตารางที่ถูกอ้างอิงโดย Level 2
-- ==========================================================
-- 3.1 technicaldocs_types Table
CREATE TABLE technicaldoc_types (
  document_types_id INT AUTO_INCREMENT PRIMARY KEY COMMENT 'ID ของตาราง',
  code        VARCHAR(20)  NOT NULL UNIQUE COMMENT 'รหัสประเภทเอกสาร',
  name        VARCHAR(100) NOT NULL COMMENT 'ชื่อประเภทเอกสาร',
  sort_order  INT DEFAULT 0 COMMENT 'ลำดับการแสดงผล',
  is_active   TINYINT(1) DEFAULT 1 COMMENT 'สถานะการใช้งาน'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='ประเภทเอกสาร';

INSERT INTO technicaldoc_types (code, name, sort_order, is_active) VALUES
  ('DWG',    'Shop Drawing',       10, 1),
  ('DOC',    'Document',           20, 1),
  ('SPC',    'Specification',      21, 1),
  ('CAL',    'Calculation',        22, 1),
  ('TRP',    'Test Report',        23, 1),
  ('SRY',    'Survey Report',      24, 1),
  ('QAQC',   'QA/QC Document',     25, 1),
  ('MES',    'Method Statement',   30, 1),
  ('MAT',    'Material',           40, 1),
  ('ASB',    'As-Built',           50, 1),
  ('OTH',    'Other',              99, 1);

-- 3.2 technicaldocs_status_codes Table
CREATE TABLE technicaldoc_status_codes (
  status_code_id INT AUTO_INCREMENT PRIMARY KEY COMMENT 'ID ของตาราง',
  code        VARCHAR(20) NOT NULL UNIQUE COMMENT 'รหัสสถานะเอกสาร',
  description VARCHAR(255) NULL COMMENT 'คำอธิบายสถานะเอกสาร',
  sort_order  INT DEFAULT 0 COMMENT 'ลำดับการแสดงผล',
  is_active   TINYINT(1) DEFAULT 1 COMMENT 'สถานะการใช้งาน'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='รหัสสถานะเอกสาร';

INSERT INTO technicaldoc_status_codes (code, description, sort_order) VALUES
('DFT', 'Draft', 1),
('FAP', 'For Approve', 11),
('FRE', 'For Review', 12),
('FCO', 'For Construction', 20),
('ASB', 'AS-Built', 30),
('OBS', 'Obsolete', 80),
('CC', 'Canceled', 99);

-- 3.3 technicaldocs_approve_codes Table
CREATE TABLE technicaldoc_approve_codes (
  approve_code_id INT AUTO_INCREMENT PRIMARY KEY COMMENT 'ID ของตาราง',
  code        VARCHAR(20) NOT NULL UNIQUE COMMENT 'รหัสการอนุมัติเอกสาร',
  description VARCHAR(255) NULL COMMENT 'คำอธิบายการอนุมัติเอกสาร',
  sort_order  INT DEFAULT 0 COMMENT 'ลำดับการแสดงผล',
  is_active   TINYINT(1) DEFAULT 1 COMMENT 'สถานะการใช้งาน'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='รหัสการอนุมัติเอกสาร';

INSERT INTO technicaldoc_approve_codes (code, description, sort_order, is_active) VALUES
('1A', 'Approved by Authority', 10, 1),
('1C', 'Approved by CSC',       11, 1),
('1N', 'Approved As Note',      12, 1),
('1R', 'Approved with Remarks', 13, 1),
('3C', 'Consultant Comments',   31, 1),
('3R', 'Revise and Resubmit',   32, 1),
('4X', 'Reject',                40, 1),
('5N', 'No Further Action',     50, 1);

-- 3.4 contract_dwg_cat Table: Category (ต่อโปรเจกต์)
CREATE TABLE contract_dwg_cat (
  cat_id     INT AUTO_INCREMENT PRIMARY KEY COMMENT 'ID ของตาราง',
  project_id INT NOT NULL COMMENT 'รหัสโปรเจกต์',
  cat_code   VARCHAR(100) NULL COMMENT 'รหัสหมวดหมู่',
  cat_name   VARCHAR(255) NOT NULL COMMENT 'ชื่อหมวดหมู่',

  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'วันที่สร้าง',
  updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP COMMENT 'วันที่แก้ไขล่าสุด',

  UNIQUE KEY ux_cat_project_name   (project_id, cat_name), -- unique: (project_id, cat_name)
  UNIQUE KEY ux_cat_project_catid  (project_id, cat_id), -- เพิ่ม unique (project_id, cat_id) เพื่อรองรับ composite FK

  KEY idx_cat_project              (project_id),
  KEY idx_cat_project_code         (project_id, cat_code),

  CONSTRAINT fk_cat_project
    FOREIGN KEY (project_id) REFERENCES projects(project_id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='ตารางหมวดหมู่ของแบบสัญญา';

-- 3.5 contract_dwg_sub_cat Table: Sub-Category (ต่อโปรเจกต์)
CREATE TABLE contract_dwg_sub_cat (
  sub_cat_id    INT AUTO_INCREMENT PRIMARY KEY COMMENT 'ID ของตาราง',
  project_id    INT NOT NULL COMMENT 'รหัสโปรเจกต์',
  sub_cat_code  VARCHAR(100) NULL COMMENT 'รหัสหมวดหมู่ย่อย',
  sub_cat_name  VARCHAR(255) NOT NULL COMMENT 'ชื่อหมวดหมู่ย่อย',

  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'วันที่สร้าง',
  updated_at    TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP COMMENT 'วันที่แก้ไขล่าสุด',

  UNIQUE KEY ux_subcat_project_name    (project_id, sub_cat_name), -- unique: (project_id, sub_cat_name)
  UNIQUE KEY ux_subcat_project_subcatid(project_id, sub_cat_id), -- เพิ่ม unique (project_id, sub_cat_id) เพื่อรองรับ composite FK

  KEY idx_subcat_project               (project_id), 
  KEY idx_subcat_project_code          (project_id, sub_cat_code),

  CONSTRAINT fk_subcat_project
    FOREIGN KEY (project_id) REFERENCES projects(project_id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='ตารางหมวดหมู่ย่อยของแบบสัญญา';

-- 3.6 shop_drawing_main_categories Table: ตารางหมวดหมู่หลักของ Shop Drawing
CREATE TABLE shop_drawing_main_categories (
  id          INT NOT NULL AUTO_INCREMENT PRIMARY KEY COMMENT 'ID ของตาราง',
  code        VARCHAR(20) NOT NULL COMMENT 'รหัสหมวดหมู่หลัก',
  name        VARCHAR(255) NOT NULL COMMENT 'ชื่อหมวดหมู่หลัก',
  sort_order  INT NOT NULL DEFAULT 0 COMMENT 'ลำดับการแสดงผล',
  UNIQUE KEY ux_sd_main_cat_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='หมวดหมู่หลักของ Shop Drawing';

-- 3.7 shop_drawing_sub_categories Table: ตารางหมวดหมู่ย่อยของ Shop Drawing
CREATE TABLE shop_drawing_sub_categories (
  id                INT NOT NULL AUTO_INCREMENT PRIMARY KEY COMMENT 'ID ของตาราง',
  main_category_id  INT NOT NULL COMMENT 'ID ของหมวดหมู่หลัก',
  code              VARCHAR(20) NOT NULL COMMENT 'รหัสหมวดหมู่ย่อย',
  name              VARCHAR(255) NOT NULL COMMENT 'ชื่อหมวดหมู่ย่อย',
  sort_order        INT NOT NULL DEFAULT 0 COMMENT 'ลำดับการแสดงผล',
  UNIQUE KEY ux_sd_sub_cat_code (code),
  CONSTRAINT fk_sd_sub_cat_main FOREIGN KEY (main_category_id) REFERENCES shop_drawing_main_categories(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='หมวดหมู่ย่อยของ Shop Drawing';

-- 3.8 correspondences Table: 
-- details [email_details, instruction_details, letter_details, memorandum_details, minutes_of_meeting_details, rfi_details]
CREATE TABLE correspondences (
  corr_id        INT AUTO_INCREMENT PRIMARY KEY COMMENT 'ID ของตาราง',

  -- root of a document family (first revision)
  root_id        INT NULL COMMENT 'รหัสเอกสารต้นทาง (NULL ถ้าเป็นเอกสารต้นทาง)',

  correspondence_number    VARCHAR(100) NOT NULL COMMENT 'เลขที่หนังสือ',
  correspondence_type_id   INT NOT NULL COMMENT 'ประเภทหนังสือ',
  correspondence_status_id INT NOT NULL COMMENT 'สถานะหนังสือ',

  is_internal_communication TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'ระบุว่าเป็นหนังสือสื่อสารภายใน (1=ใช่,0=ไม่ใช่)',
  revision       VARCHAR(50) NULL COMMENT 'หมายเลขแก้ไขของหนังสือ', -- e.g., A,B or 1,2; NULL for first issue if desired
  project_id     INT NOT NULL COMMENT 'รหัสโครงการ',
  originator_id  INT NULL COMMENT 'รหัสองค์กรผู้ส่ง',
  recipient_id   INT NULL COMMENT 'รหัสองค์กรผู้รับ',
  title          VARCHAR(255) NOT NULL COMMENT 'หัวเรื่องหนังสือ',
  keywords       VARCHAR(255) NULL COMMENT 'คำสำคัญของหนังสือ (คั่นด้วย comma)',
  created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'วันที่สร้าง',
  created_by     INT NULL COMMENT 'รหัสผู้สร้าง',
  issued_date    DATETIME NULL COMMENT 'วันที่ออกหนังสือ',
  updated_by     INT NULL COMMENT 'รหัสผู้แก้ไข',
  deleted_at     DATETIME NULL COMMENT 'วันที่ลบ',
  deleted_by     INT NULL COMMENT 'รหัสผู้ลบ',
  pdf_path       VARCHAR(500) NULL COMMENT 'ที่เก็บไฟล์ PDF ของหนังสือ',
  details        JSON NULL COMMENT 'เก็บข้อมูลเฉพาะของเอกสารแต่ละประเภทในรูปแบบ JSON',
  CONSTRAINT chk_cor_internal CHECK (is_internal_communication IN (0,1)),

  -- doc number uniqueness per project
  CONSTRAINT uq_cor_no_per_project UNIQUE (project_id, correspondence_number),

  -- enforce unique revision per root per project
  CONSTRAINT uq_root_rev_per_project UNIQUE (root_id, revision, project_id),

  -- FKs
  CONSTRAINT fk_cor_project     FOREIGN KEY (project_id)     REFERENCES projects(project_id)      ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_cor_originator  FOREIGN KEY (originator_id)  REFERENCES organizations(org_id)     ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT fk_cor_recipient   FOREIGN KEY (recipient_id)   REFERENCES organizations(org_id)     ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT fk_cor_created_by  FOREIGN KEY (created_by)     REFERENCES users(user_id)            ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT fk_cor_updated_by  FOREIGN KEY (updated_by)     REFERENCES users(user_id)            ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT fk_cor_type        FOREIGN KEY (correspondence_type_id)   REFERENCES correspondence_types(type_id)     ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_cor_status      FOREIGN KEY (correspondence_status_id) REFERENCES correspondence_status(status_id)  ON UPDATE CASCADE ON DELETE RESTRICT,

  -- self reference; prevent deleting root accidentally
  CONSTRAINT fk_cor_root        FOREIGN KEY (root_id)        REFERENCES correspondences(corr_id)  ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='ตารางเก็บข้อมูลหนังสือสื่อสารต่างๆ';

CREATE INDEX idx_cor_project     ON correspondences(project_id);
CREATE INDEX idx_cor_originator  ON correspondences(originator_id);
CREATE INDEX idx_cor_recipient   ON correspondences(recipient_id);
CREATE INDEX idx_cor_type        ON correspondences(correspondence_type_id);
CREATE INDEX idx_cor_status      ON correspondences(correspondence_status_id);
CREATE INDEX idx_cor_created_at  ON correspondences(created_at);

-- 3.9 contract_dwg_volume Table: 
CREATE TABLE contract_dwg_volume (
  volume_id   INT AUTO_INCREMENT PRIMARY KEY COMMENT 'ID ของตาราง',
  project_id  INT NOT NULL COMMENT 'รหัสโปรเจกต์',
  volume_code VARCHAR(100) NOT NULL COMMENT 'รหัสเล่ม',
  volume_name VARCHAR(255) NULL COMMENT 'ชื่อเล่ม',
  description TEXT NULL COMMENT 'คำอธิบายเล่ม',
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'วันที่สร้าง',
  updated_at  TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP COMMENT 'วันที่แก้ไขล่าสุด',

  UNIQUE KEY ux_volume_project_code  (project_id, volume_code),
  UNIQUE KEY ux_volume_project_volid (project_id, volume_id),

  KEY idx_volume_project            (project_id),
  KEY idx_volume_project_code       (project_id, volume_code),

  CONSTRAINT fk_volume_project
    FOREIGN KEY (project_id) REFERENCES projects(project_id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ==========================================================
-- Level 2: ตารางที่ถูกอ้างอิงโดย Level 1
-- ==========================================================
-- 2.1 circulation_templates Table: ตารางหลักสำหรับเก็บชื่อแม่แบบใบเวียน
CREATE TABLE circulation_templates (
  template_id   INT NOT NULL AUTO_INCREMENT PRIMARY KEY COMMENT 'ID ของแม่แบบ',
  template_name VARCHAR(255) NOT NULL COMMENT 'ชื่อแม่แบบ (เช่น "สำหรับเอกสารการเงิน", "สำหรับ Drawing โครงสร้าง")',
  org_id        INT NOT NULL COMMENT 'ID ขององค์กรที่เป็นเจ้าของแม่แบบนี้ (สำคัญมาก)',
  description   TEXT COMMENT 'คำอธิบายแม่แบบ',
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'วันที่สร้าง',
  updated_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'วันที่แก้ไขล่าสุด',
  
  -- ป้องกันการสร้างชื่อแม่แบบซ้ำในองค์กรเดียวกัน
  UNIQUE KEY ux_circulation_template_name_org (template_name, org_id),
  
  -- Foreign Key
  CONSTRAINT fk_ct_org FOREIGN KEY (org_id) REFERENCES organizations(org_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='แม่แบบสำหรับใบเวียนเอกสารภายในองค์กร';

-- 2.2 technicaldocs Table
CREATE TABLE technicaldocs (
  id               INT AUTO_INCREMENT PRIMARY KEY COMMENT 'ID ของตาราง',
  document_type_id INT NOT NULL COMMENT 'ประเภทเอกสาร',
  original_id      INT NOT NULL COMMENT 'รหัสเอกสารต้นฉบับ (root document)',
  revision         VARCHAR(50) NOT NULL COMMENT 'หมายเลขแก้ไขของเอกสาร', -- e.g., A,B or 1,2; NULL for first issue if desired
  title            VARCHAR(255) NOT NULL COMMENT 'หัวเรื่องเอกสาร',
  project_id       INT NOT NULL COMMENT 'รหัสโครงการ',
  status_code_id   INT NOT NULL COMMENT 'รหัสสถานะเอกสาร',
  approve_code_id  INT NULL COMMENT 'รหัสการอนุมัติเอกสาร',
  created_at       DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT 'วันที่สร้าง',
  updated_at       DATETIME NULL COMMENT 'วันที่แก้ไขล่าสุด',
  created_by       INT NULL COMMENT 'รหัสผู้สร้าง',
  updated_by       INT NULL COMMENT 'รหัสผู้แก้ไข',
  deleted_at       DATETIME NULL COMMENT 'วันที่ลบ',
  pdf_path         VARCHAR(500) NULL COMMENT 'ที่เก็บไฟล์ PDF ของเอกสาร',
  CONSTRAINT fk_techdoc_created_by FOREIGN KEY (created_by) REFERENCES users(user_id) ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT fk_techdoc_updated_by FOREIGN KEY (updated_by) REFERENCES users(user_id) ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT fk_techdoc_status  FOREIGN KEY (status_code_id)  REFERENCES technicaldoc_status_codes(status_code_id),
  CONSTRAINT fk_techdoc_approve FOREIGN KEY (approve_code_id)  REFERENCES technicaldoc_approve_codes(approve_code_id)      ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT fk_techdoc_type    FOREIGN KEY (document_type_id) REFERENCES technicaldoc_types(document_types_id),
  CONSTRAINT fk_techdoc_project FOREIGN KEY (project_id)       REFERENCES projects(project_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='ตารางเก็บข้อมูลเอกสารทางเทคนิค';

CREATE UNIQUE INDEX idx_unique_techdoc_revision ON technicaldocs (original_id, revision, project_id);

/* ===========================================================
2.3 Drawings (ต่อโปรเจกต์)
  - 1 drawing ∈ 1 project
  - ชี้ 1 sub-category (ในโปรเจกต์เดียวกัน)
  - ชี้ 1 volume     (ในโปรเจกต์เดียวกัน)
  - unique: (project_id, condwg_no)
  =========================================================== */

CREATE TABLE contract_drawings (
  condwg_id   INT AUTO_INCREMENT PRIMARY KEY COMMENT 'ID ของตาราง',
  project_id  INT NOT NULL COMMENT 'รหัสโปรเจกต์',
  condwg_no   VARCHAR(255) NOT NULL COMMENT 'เลขที่แบบ Drawing',      -- รหัส/เลขดรอว์อิง
  title       VARCHAR(255) NULL COMMENT 'ชื่อแบบ Drawing',
  sub_cat_id  INT NOT NULL COMMENT 'รหัสหมวดหมู่ย่อย',               -- 1 drawing → 1 sub-category
  volume_id   INT NOT NULL COMMENT 'รหัสเล่ม',               -- 1 drawing → 1 volume
  sub_no      INT NULL COMMENT 'หมายเลขย่อย',                   -- หมายเลขย่อย (ถ้ามี)
  remark      VARCHAR(500) NULL COMMENT 'หมายเหตุ',

  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'วันที่สร้าง',
  updated_at  TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP COMMENT 'วันที่แก้ไขล่าสุด',

  UNIQUE KEY ux_condwg_no_project (project_id, condwg_no),

  KEY idx_condwg_project      (project_id),
  KEY idx_condwg_sub_cat      (project_id, sub_cat_id),
  KEY idx_condwg_volume       (project_id, volume_id),
  KEY idx_condwg_no           (condwg_no),

  CONSTRAINT fk_condwg_project
    FOREIGN KEY (project_id) REFERENCES projects(project_id)
    ON UPDATE CASCADE ON DELETE CASCADE,

  /* same-project guard ด้วย composite FK */
  CONSTRAINT fk_condwg_subcat_same_project
    FOREIGN KEY (project_id, sub_cat_id)
    REFERENCES contract_dwg_sub_cat (project_id, sub_cat_id)
    ON UPDATE CASCADE ON DELETE RESTRICT,

  CONSTRAINT fk_condwg_volume_same_project
    FOREIGN KEY (project_id, volume_id)
    REFERENCES contract_dwg_volume (project_id, volume_id)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='ตารางเก็บข้อมูล Drawing ต่อโปรเจกต์';

-- 2.4 shop_drawings Table: ตารางหลักสำหรับข้อมูล Shop Drawing
CREATE TABLE shop_drawings (
  id                INT NOT NULL AUTO_INCREMENT PRIMARY KEY COMMENT 'ID ของตาราง',
  drawing_number    VARCHAR(100) NOT NULL COMMENT 'เลขที่แบบ Shop Drawing',
  title             VARCHAR(500) NOT NULL COMMENT 'ชื่อแบบ',
  main_category_id  INT NOT NULL COMMENT 'ID หมวดหมู่หลัก',
  sub_category_id   INT NOT NULL COMMENT 'ID หมวดหมู่ย่อย',
  remark            VARCHAR(500) NULL COMMENT 'หมายเหตุ',
  created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'วันที่สร้าง',
  updated_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'วันที่แก้ไขล่าสุด',
  UNIQUE KEY ux_sd_drawing_number (drawing_number),
  CONSTRAINT fk_sd_main_cat FOREIGN KEY (main_category_id) REFERENCES shop_drawing_main_categories(id),
  CONSTRAINT fk_sd_sub_cat FOREIGN KEY (sub_category_id) REFERENCES shop_drawing_sub_categories(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='ข้อมูลหลักของ Shop Drawing';

-- 2.5 technicaldoc_workflow_templates Table: ตารางหลักสำหรับเก็บชื่อแม่แบบ
CREATE TABLE technicaldoc_workflow_templates (
  template_id   INT NOT NULL AUTO_INCREMENT PRIMARY KEY COMMENT 'ID ของแม่แบบ',
  template_name VARCHAR(255) NOT NULL COMMENT 'ชื่อแม่แบบ',
  description   TEXT COMMENT 'คำอธิบายแม่แบบ',
  project_id    INT NULL COMMENT 'รหัสโครงการ', -- (Optional) ทำให้สามารถสร้างแม่แบบเฉพาะโครงการได้
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'วันที่สร้าง',
  updated_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'วันที่แก้ไขล่าสุด',
   UNIQUE KEY ux_template_name_project (template_name, project_id),
  CONSTRAINT fk_wt_project FOREIGN KEY (project_id) REFERENCES projects(project_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- 2.6 correspondence_routing_templates Table:ตารางหลักสำหรับเก็บชื่อแม่แบบการส่งต่อ
CREATE TABLE correspondence_routing_templates (
  template_id   INT NOT NULL AUTO_INCREMENT  PRIMARY KEY COMMENT 'ID ของแม่แบบ',
  template_name VARCHAR(255) NOT NULL COMMENT 'ชื่อแม่แบบ',
  description   TEXT COMMENT 'คำอธิบาย',
  project_id    INT NULL COMMENT 'ID โครงการ (ถ้าเป็นแม่แบบเฉพาะโครงการ)',
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'วันที่สร้าง',
  updated_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'วันที่แก้ไขล่าสุด',
  UNIQUE KEY ux_routing_template_name_project (template_name, project_id),
  CONSTRAINT fk_crt_project FOREIGN KEY (project_id) REFERENCES projects(project_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='แม่แบบสายงานการส่งต่อเอกสารทั่วไป';

-- 2.7 circulations Table:
CREATE TABLE circulations (
  cir_id              INT NOT NULL AUTO_INCREMENT  PRIMARY KEY COMMENT 'ID ของตาราง',
  correspondence_id   INT UNIQUE COMMENT 'ID ของเอกสาร (จากตาราง correspondences)', -- one circulation record per correspondence (optional)
  org_id              INT NOT NULL COMMENT 'ID ขององค์กรที่เป็นเจ้าของใบเวียนนี้',
  cir_no              VARCHAR(100) NOT NULL COMMENT 'เลขที่ใบเวียน',
  cir_subject         VARCHAR(500) NOT NULL COMMENT 'หัวเรื่องใบเวียน',
  cir_status_code     VARCHAR(20) NOT NULL DEFAULT 'DRAFT' COMMENT 'รหัสสถานะใบเวียน',
  created_by_user_id  INT NOT NULL COMMENT 'ID ของผู้สร้างใบเวียน',
  submitted_at        TIMESTAMP NULL COMMENT 'เวลาที่ส่งใบเวียน',
  closed_at           TIMESTAMP NULL COMMENT 'เวลาที่ปิดใบเวียน',
  created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'วันที่สร้าง',
  updated_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'วันที่แก้ไขล่าสุด',
  pdf_path            VARCHAR(500) NULL COMMENT 'ที่เก็บไฟล์ PDF ของใบเวียน',
  CONSTRAINT uq_cir_org_no UNIQUE(org_id, cir_no),
  CONSTRAINT fk_cir_correspondence FOREIGN KEY (correspondence_id) REFERENCES correspondences(corr_id),
  CONSTRAINT fk_cir_org FOREIGN KEY (org_id) REFERENCES organizations(org_id),
  CONSTRAINT fk_cir_status FOREIGN KEY (cir_status_code) REFERENCES cir_status_codes(code),
  CONSTRAINT fk_cir_user FOREIGN KEY (created_by_user_id) REFERENCES users(user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='ตารางเก็บข้อมูลใบเวียนเอกสารภายในองค์กร';

CREATE INDEX idx_cir_org    ON circulations(org_id);
CREATE INDEX idx_cir_status ON circulations(cir_status_code);
CREATE INDEX idx_cir_corr   ON circulations(correspondence_id);

-- 2.8 transmittal Table: ตารางสำหรับเก็บข้อมูลเฉพาะของ Transmittal (เป็นตารางลูกของ correspondences)
CREATE TABLE transmittals (
  -- ใช้ corr_id เป็นทั้ง Primary Key และ Foreign Key เพื่อสร้างความสัมพันธ์แบบ One-to-One
  corr_id   INT NOT NULL   PRIMARY KEY COMMENT 'ID ของเอกสาร (จากตาราง correspondences)',
  purpose   ENUM('FOR_APPROVAL', 'FOR_INFORMATION', 'FOR_CONSTRUCTION', 'AS_BUILT') NOT NULL DEFAULT 'FOR_INFORMATION' COMMENT 'วัตถุประสงค์ในการส่ง',
  remarks   TEXT COMMENT 'หมายเหตุเพิ่มเติม',
  created_by_user_id INT NOT NULL COMMENT 'ID ของผู้สร้าง Transmittal',
  submitted_at TIMESTAMP NULL COMMENT 'เวลาที่ส่ง Transmittal',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'วันที่สร้าง',
  
  -- Foreign Key
  CONSTRAINT fk_transmittal_correspondence FOREIGN KEY (corr_id) REFERENCES correspondences(corr_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='ตารางเก็บข้อมูลเฉพาะของเอกสารนำส่ง (Transmittal)';

-- 2.9 correspondence_revisions Table: ตารางสำหรับเก็บประวัติการแก้ไขเอกสาร (Revision History)
CREATE TABLE correspondence_revisions (
    revision_id         INT NOT NULL AUTO_INCREMENT PRIMARY KEY COMMENT 'ID ของตาราง',
    correspondence_id   INT NOT NULL COMMENT 'ID ของเอกสาร (จากตาราง correspondences)',
    version_number      INT NOT NULL COMMENT 'หมายเลขเวอร์ชันของเอกสาร',
    change_reason       TEXT NOT NULL COMMENT 'สาเหตุการแก้ไข',
    changed_by_user_id  INT NOT NULL COMMENT 'ID ของผู้ที่ทำการแก้ไข',
    changed_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'วันที่และเวลาที่แก้ไข',
    -- คอลัมน์ที่ต้องการเก็บประวัติ (Snapshot of data before change)
    document_data_json  JSON NOT NULL COMMENT 'ข้อมูลเอกสารในรูปแบบ JSON ณ เวลาที่แก้ไข',
    CONSTRAINT fk_cr_correspondence FOREIGN KEY (correspondence_id) REFERENCES correspondences(corr_id) ON DELETE CASCADE,
    CONSTRAINT fk_cr_user FOREIGN KEY (changed_by_user_id) REFERENCES users(user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='ตารางเก็บประวัติการแก้ไขเอกสาร (Revision History)';

-- 2.10 ตารางหลักสำหรับเก็บ Tag ทั้งหมด (Master Data)
CREATE TABLE tags (
  tag_id    INT NOT NULL AUTO_INCREMENT PRIMARY KEY COMMENT 'ID ของ Tag',
  tag_name  VARCHAR(50) NOT NULL COMMENT 'ชื่อ Tag',

  -- ป้องกันการสร้างชื่อ Tag ซ้ำ
  UNIQUE KEY ux_tag_name (tag_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='ตารางเก็บ Master Data ของ Tags';


-- 2.11 ตารางเชื่อม (Junction Table) ระหว่างเอกสารและ Tag
CREATE TABLE correspondence_tags (
  correspondence_id INT NOT NULL COMMENT 'ID ของเอกสาร',
  tag_id            INT NOT NULL COMMENT 'ID ของ Tag',
  
  -- กำหนดให้ ID ทั้งสองเป็น Primary Key ร่วมกัน เพื่อป้องกันการผูก Tag เดียวกันกับเอกสารเดิมซ้ำ
  PRIMARY KEY (correspondence_id, tag_id),
  
  -- Foreign Keys
  CONSTRAINT fk_ct_correspondence FOREIGN KEY (correspondence_id) REFERENCES correspondences(corr_id) ON DELETE CASCADE,
  CONSTRAINT fk_ct_tag FOREIGN KEY (tag_id) REFERENCES tags(tag_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='ตารางเชื่อมความสัมพันธ์ระหว่างเอกสารและ Tags';

-- ==========================================================
-- Level 1: ตารางที่มีความสัมพันธ์มากที่สุด (Junction Tables & Detail Tables)
-- ==========================================================
-- 1.1 global_default_roles Table: Global default roles (template defaults)
CREATE TABLE global_default_roles (
  id        TINYINT NOT NULL DEFAULT 1 COMMENT 'ID ของตาราง',
  role      ENUM('OWNER','DESIGNER','CONSULTANT') NOT NULL COMMENT 'บทบาทมาตรฐาน',
  position  TINYINT NOT NULL COMMENT 'ลำดับที่ของบทบาทในแต่ละประเภท',
  org_id    INT NOT NULL COMMENT 'ID ขององค์กรที่ถูกกำหนดเป็นบทบาทนี้',
  PRIMARY KEY (id, role, position),
  UNIQUE KEY ux_gdr_unique_org_per_role (id, role, org_id),
  CONSTRAINT fk_gdr_org FOREIGN KEY (org_id) REFERENCES organizations(org_id) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='ตารางเก็บบทบาทมาตรฐานระดับองค์กร';

-- global default roles seed: OWNER x7, DESIGNER x1, CONSULTANT x1 (from organizations.primary_role)
-- OWNER
INSERT INTO global_default_roles (id, role, position, org_id)
SELECT 1, 'OWNER', pos, org_id
FROM (
  SELECT org_id, ROW_NUMBER() OVER (ORDER BY org_id) AS pos
  FROM organizations
  -- WHERE primary_role='OWNER'
  WHERE role_id = 1
) t
WHERE t.pos BETWEEN 1 AND 7
ON DUPLICATE KEY UPDATE org_id=VALUES(org_id);

-- DESIGNER
INSERT INTO global_default_roles (id, role, position, org_id)
SELECT 1, 'DESIGNER', 1, org_id
FROM organizations
-- WHERE primary_role='DESIGNER'
WHERE role_id = 2
ORDER BY org_id
LIMIT 1
ON DUPLICATE KEY UPDATE org_id=VALUES(org_id);

-- CONSULTANT
INSERT INTO global_default_roles (id, role, position, org_id)
SELECT 1, 'CONSULTANT', 1, org_id
FROM organizations
-- WHERE primary_role='CONSULTANT'
WHERE role_id = 3
ORDER BY org_id
LIMIT 1
ON DUPLICATE KEY UPDATE org_id=VALUES(org_id);

-- 1.2 correspondence_status_transitions Table: เพิ่ม “ตาราง/วิว Allowed Status Transition” เพื่อตรวจ business rule บน 
-- sp_correspondence_update_status (ยังทำแบบ soft rule ใน proc)
-- NEW: table of allowed transitions (per type)
DROP TABLE IF EXISTS correspondence_status_transitions;
CREATE TABLE correspondence_status_transitions(
  type_id INT NOT NULL COMMENT 'ID ของประเภทหนังสือ',
  from_status_id INT NOT NULL COMMENT 'ID ของสถานะเดิม',
  to_status_id   INT NOT NULL COMMENT 'ID ของสถานะใหม่',
  PRIMARY KEY (type_id, from_status_id, to_status_id),
  CONSTRAINT fk_cst_type   FOREIGN KEY (type_id)        REFERENCES correspondence_types(type_id),
  CONSTRAINT fk_cst_from   FOREIGN KEY (from_status_id)  REFERENCES correspondence_status(status_id),
  CONSTRAINT fk_cst_to     FOREIGN KEY (to_status_id)    REFERENCES correspondence_status(status_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='ตารางเก็บสถานะที่อนุญาตให้เปลี่ยนแปลงได้ของหนังสือแต่ละประเภท';

-- 1.3 circulation_assignees Table: ตารางสำหรับระบุผู้รับผิดชอบใน Circulation Sheet แต่ละใบ
CREATE TABLE circulation_assignees (
    assignee_id         INT NOT NULL AUTO_INCREMENT PRIMARY KEY COMMENT 'ID ของรายการ',
    cir_id              INT NOT NULL COMMENT 'ID ของใบเวียน (จากตาราง circulations)',
    user_id             INT NOT NULL COMMENT 'ID ของผู้ใช้ที่รับผิดชอบ',
    assignee_type       ENUM('MAIN', 'ACTION', 'INFO') NOT NULL COMMENT 'ประเภทผู้รับผิดชอบ',
    deadline            DATE NULL COMMENT 'กำหนดวันแล้วเสร็จ (สำหรับ Main/Action)',
    action_taken        TEXT NULL COMMENT 'หมายเหตุการดำเนินการ',
    is_completed        BOOLEAN NOT NULL DEFAULT FALSE COMMENT 'สถานะการดำเนินการ',
    completed_at        TIMESTAMP NULL COMMENT 'เวลาที่ดำเนินการเสร็จ',
    completed_by_user_id INT NULL COMMENT 'ID ของผู้ใช้ที่ดำเนินการเสร็จ',
    UNIQUE KEY ux_cir_user_type (cir_id, user_id, assignee_type),
    CONSTRAINT fk_ca_cir FOREIGN KEY (cir_id) REFERENCES circulations(cir_id) ON DELETE CASCADE,
    CONSTRAINT fk_ca_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='ตารางเก็บรายชื่อผู้รับผิดชอบในใบเวียนเอกสาร';

-- 1.4 cir_recipients Table: ตารางสำหรับเก็บรายชื่อผู้รับในใบเวียน (เพิ่มเติมจาก assignees)
CREATE TABLE cir_recipients (
  recipient_id  INT NOT NULL AUTO_INCREMENT PRIMARY KEY COMMENT 'ID ของรายการ',
  cir_id        INT NOT NULL COMMENT 'ID ของใบเวียน (จากตาราง circulations)',
  user_id       INT NOT NULL COMMENT 'ID ของผู้ใช้ที่เป็นผู้รับ',
  recipient_role ENUM('TO', 'CC') NOT NULL DEFAULT 'TO' COMMENT 'บทบาทของผู้รับ (ถึง, สำเนาถึง)',
  read_status   BOOLEAN NOT NULL DEFAULT FALSE COMMENT 'สถานะการเปิดอ่าน',
  read_at       TIMESTAMP NULL COMMENT 'เวลาที่เปิดอ่าน',
  
  UNIQUE KEY ux_cir_recipient (cir_id, user_id, recipient_role),
  -- Foreign Keys
  CONSTRAINT fk_cir_recipients_circulation FOREIGN KEY (cir_id) REFERENCES circulations(cir_id) ON DELETE CASCADE,
  CONSTRAINT fk_cir_recipients_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='รายชื่อผู้รับในใบเวียนเอกสาร';

-- 1.5 attachments Table: ตารางสำหรับเก็บ Metadata ของไฟล์แนบทั้งหมดในระบบ
CREATE TABLE attachments (
  attachment_id   INT NOT NULL AUTO_INCREMENT PRIMARY KEY COMMENT 'ID ของไฟล์แนบ',
  correspondence_id INT NOT NULL COMMENT 'ID ของเอกสารหลักที่ไฟล์นี้สังกัด',
  original_filename VARCHAR(255) NOT NULL COMMENT 'ชื่อไฟล์ดั้งเดิมตอนอัปโหลด',
  stored_filename VARCHAR(255) NOT NULL COMMENT 'ชื่อไฟล์ที่ถูกเก็บจริงบน Server (ป้องกันชื่อซ้ำ)',
  file_path       VARCHAR(500) NOT NULL COMMENT 'ที่อยู่ (Path) ของไฟล์บน Server',
  mime_type       VARCHAR(100) NOT NULL COMMENT 'ประเภทของไฟล์ (เช่น application/pdf)',
  file_size       INT NOT NULL COMMENT 'ขนาดไฟล์ (หน่วยเป็น bytes)',
  uploaded_by_user_id INT NOT NULL COMMENT 'ID ของผู้ใช้ที่อัปโหลดไฟล์',
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'เวลาที่อัปโหลด',
 
  -- Foreign Keys
  CONSTRAINT fk_attach_correspondence FOREIGN KEY (correspondence_id) REFERENCES correspondences(corr_id) ON DELETE CASCADE,
  CONSTRAINT fk_attach_user FOREIGN KEY (uploaded_by_user_id) REFERENCES users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='ตารางกลางสำหรับเก็บข้อมูลไฟล์แนบ';

-- 1.6 cir_actions Table: ตารางสำหรับบันทึกประวัติการดำเนินการในใบเวียน
CREATE TABLE cir_actions (
  action_id          INT NOT NULL AUTO_INCREMENT PRIMARY KEY COMMENT 'ID ของการกระทำ',
  cir_id             INT NOT NULL COMMENT 'ID ของใบเวียน',
  action_by_user_id  INT NOT NULL COMMENT 'ID ของผู้ใช้ที่ดำเนินการ',
  action_type        ENUM('COMMENT', 'FORWARD', 'CLOSE', 'REOPEN') NOT NULL COMMENT 'ประเภทของการกระทำ',
  comments           TEXT COMMENT 'ความคิดเห็นหรือหมายเหตุประกอบ',
  created_at         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'เวลาที่ดำเนินการ',
    
  -- Foreign Keys
  CONSTRAINT fk_cir_actions_circulation FOREIGN KEY (cir_id) REFERENCES circulations(cir_id) ON DELETE CASCADE,
  CONSTRAINT fk_cir_actions_user FOREIGN KEY (action_by_user_id) REFERENCES users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='ประวัติการดำเนินการในใบเวียนเอกสาร';


-- 1.7 cir_action_documents Table: ตารางเชื่อมระหว่างการดำเนินการและไฟล์แนบ
CREATE TABLE cir_action_documents (
  action_id      INT NOT NULL COMMENT 'ID ของการกระทำ (จากตาราง cir_actions)',
  attachment_id  INT NOT NULL COMMENT 'ID ของไฟล์แนบ (จากตาราง attachments)',
  
  PRIMARY KEY (action_id, attachment_id),
  
  -- Foreign Keys
  CONSTRAINT fk_cad_action FOREIGN KEY (action_id) REFERENCES cir_actions(action_id) ON DELETE CASCADE,
  CONSTRAINT fk_cad_attachment FOREIGN KEY (attachment_id) REFERENCES attachments(attachment_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='ตารางเชื่อมไฟล์แนบกับการดำเนินการในใบเวียน';

-- 1.8 circulation_template_assignees Table: ตารางสำหรับเก็บรายชื่อผู้รับผิดชอบในแต่ละแม่แบบ
CREATE TABLE circulation_template_assignees (
  assignee_template_id INT NOT NULL AUTO_INCREMENT COMMENT 'ID ของรายการ',
  template_id          INT NOT NULL COMMENT 'ID ของแม่แบบ',
  user_id              INT NOT NULL COMMENT 'ID ของผู้ใช้ที่ถูกกำหนดไว้',
  assignee_type        ENUM('MAIN', 'ACTION', 'INFO') NOT NULL COMMENT 'บทบาทของผู้ใช้ในแม่แบบนี้',
  
  PRIMARY KEY (assignee_template_id),

  -- ป้องกันการกำหนด User คนเดิมในบทบาทเดิมซ้ำในแม่แบบเดียวกัน
  UNIQUE KEY ux_cta_template_user_type (template_id, user_id, assignee_type),

  -- Foreign Keys
  CONSTRAINT fk_cta_template FOREIGN KEY (template_id) REFERENCES circulation_templates(template_id) ON DELETE CASCADE,
  CONSTRAINT fk_cta_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='รายชื่อผู้รับผิดชอบในแม่แบบใบเวียน';

/* ===========================================================
   1.9 contract_dwg_subcat_cat_map Table: 
   Mapping: Sub-Category ↔ Category (Many-to-Many ภายในโปรเจกต์)
   - บังคับให้อยู่ project เดียวกัน ผ่าน composite FK
   - unique: (project_id, sub_cat_id, cat_id)
   =========================================================== */
CREATE TABLE contract_dwg_subcat_cat_map (
  project_id INT NOT NULL COMMENT 'รหัสโปรเจกต์',
  sub_cat_id INT NOT NULL COMMENT 'รหัสหมวดหมู่ย่อย',
  cat_id     INT NOT NULL COMMENT 'รหัสหมวดหมู่หลัก',

  UNIQUE KEY ux_map_unique           (project_id, sub_cat_id, cat_id),

  KEY idx_map_project_subcat         (project_id, sub_cat_id),
  KEY idx_map_project_cat            (project_id, cat_id),

  CONSTRAINT fk_map_subcat
    FOREIGN KEY (project_id, sub_cat_id)
    REFERENCES contract_dwg_sub_cat (project_id, sub_cat_id)
    ON UPDATE CASCADE ON DELETE CASCADE,

  CONSTRAINT fk_map_cat
    FOREIGN KEY (project_id, cat_id)
    REFERENCES contract_dwg_cat (project_id, cat_id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='ตารางแมปความสัมพันธ์ระหว่างหมวดหมู่ย่อยและหมวดหมู่หลักของ Drawing';

-- 1.10 shop_drawing_revisions Table: ตารางสำหรับเก็บประวัติการแก้ไข (Revision) ของ Shop Drawing
CREATE TABLE shop_drawing_revisions (
  id              INT NOT NULL AUTO_INCREMENT PRIMARY KEY COMMENT 'ID ของตาราง',
  shop_drawing_id INT NOT NULL COMMENT 'ID ของ Shop Drawing หลัก',
  revision_number VARCHAR(10) NOT NULL COMMENT 'หมายเลข Revision (เช่น A, B, 0, 1)',
  revision_date   DATE NOT NULL COMMENT 'วันที่ของ Revision',
  description     TEXT COMMENT 'คำอธิบายการแก้ไขใน Revision นี้',
  file_path       VARCHAR(500) NULL COMMENT 'Path ไปยังไฟล์ Drawing ของ Revision นี้ (ถ้ามี)',
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'วันที่สร้าง',

  UNIQUE KEY ux_sd_rev_drawing_revision (shop_drawing_id, revision_number),
  CONSTRAINT fk_sdr_shop_drawing FOREIGN KEY (shop_drawing_id) REFERENCES shop_drawings(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='ประวัติการแก้ไขของ Shop Drawing';

-- 1.11 technicaldoc_workflow_template_steps Table: ตารางสำหรับเก็บขั้นตอนของแต่ละแม่แบบ
CREATE TABLE technicaldoc_workflow_template_steps (
  step_id       INT NOT NULL AUTO_INCREMENT PRIMARY KEY COMMENT 'ID ของขั้นตอน',
  template_id   INT NOT NULL COMMENT 'ID ของแม่แบบ',
  sequence      INT NOT NULL COMMENT 'ลำดับขั้นตอน',
  org_id        INT NOT NULL COMMENT 'ID องค์กรที่ต้องพิจารณาในขั้นตอนนี้',
  step_purpose  ENUM('FOR_APPROVAL', 'FOR_REVIEW', 'FOR_INFORMATION') NOT NULL DEFAULT 'FOR_APPROVAL' COMMENT 'วัตถุประสงค์ของขั้นตอนนี้ เช่น เพื่ออนุมัติ, เพื่อตรวจสอบ, หรือเพื่อรับทราบ',
 
  UNIQUE KEY ux_template_sequence (template_id, sequence),
  CONSTRAINT fk_wts_template FOREIGN KEY (template_id) REFERENCES technicaldoc_workflow_templates(template_id) ON DELETE CASCADE,
  CONSTRAINT fk_wts_org FOREIGN KEY (org_id) REFERENCES organizations(org_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='ขั้นตอนในแม่แบบ Workflow ของเอกสาร Technical';

-- 1.12 technicaldoc_workflows Table: ตารางสำหรับติดตามสถานะ Workflow ของเอกสาร Technical (RFA)
CREATE TABLE technicaldoc_workflows (
    workflow_id         INT NOT NULL AUTO_INCREMENT PRIMARY KEY COMMENT 'ID ของขั้นตอน',
    correspondence_id   INT NOT NULL COMMENT 'ID ของเอกสาร Technical',
    sequence            INT NOT NULL COMMENT 'ลำดับขั้นตอน',
    org_id              INT NOT NULL COMMENT 'ID ขององค์กรที่ต้องพิจารณาในขั้นตอนนี้',
    status              ENUM('PENDING', 'APPROVED', 'REJECTED', 'APPROVED_WITH_COMMENTS', 'FORWARDED', 'RETURNED') NOT NULL DEFAULT 'PENDING' COMMENT 'สถานะของขั้นตอนนี้',
    comments            TEXT NULL COMMENT 'หมายเหตุหรือความคิดเห็นจากองค์กร',
    processed_by_user_id INT NULL COMMENT 'ID ของผู้ใช้ที่ดำเนินการในขั้นตอนนี้',
    processed_at        TIMESTAMP NULL COMMENT 'เวลาที่ดำเนินการ',
    created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'วันที่สร้าง',

    UNIQUE KEY ux_workflow_corr_sequence (correspondence_id, sequence),
    CONSTRAINT fk_tdw_correspondence FOREIGN KEY (correspondence_id) REFERENCES correspondences(corr_id) ON DELETE CASCADE,
    CONSTRAINT fk_tdw_org FOREIGN KEY (org_id) REFERENCES organizations(org_id),
    CONSTRAINT fk_tdw_user FOREIGN KEY (processed_by_user_id) REFERENCES users(user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='ตารางติดตามสถานะ Workflow ของเอกสาร Technical';

-- 1.13 transmittal_items Table: ตารางสำหรับเก็บรายการเอกสารที่ถูกส่งใน Transmittal แต่ละฉบับ
CREATE TABLE transmittal_items (
  item_id           INT NOT NULL AUTO_INCREMENT PRIMARY KEY COMMENT 'ID ของรายการ',
  transmittal_id    INT NOT NULL COMMENT 'ID ของ Transmittal (จากตาราง transmittals)',
  technical_doc_id  INT NOT NULL COMMENT 'ID ของเอกสารทางเทคนิคที่แนบไป',
  quantity          INT NOT NULL DEFAULT 1 COMMENT 'จำนวน',
  remarks           VARCHAR(255) COMMENT 'หมายเหตุสำหรับรายการนี้',
  
  -- ป้องกันการเพิ่มเอกสารเดิมซ้ำใน Transmittal ฉบับเดียวกัน
  UNIQUE KEY ux_transmittal_item (transmittal_id, technical_doc_id),
  
  -- Foreign Keys
  CONSTRAINT fk_ti_transmittal FOREIGN KEY (transmittal_id) REFERENCES transmittals(corr_id) ON DELETE CASCADE,
  CONSTRAINT fk_ti_technical_doc FOREIGN KEY (technical_doc_id) REFERENCES technicaldocs(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='รายการเอกสารที่แนบใน Transmittal';

-- 1.14 rfa_items Table: RFA ↔ TechnicalDocs (RFA เป็นชนิดหนึ่งของ correspondences)
CREATE TABLE rfa_items (
  rfa_corr_id      INT NOT NULL COMMENT 'ID ของเอกสาร RFA (จากตาราง correspondences)',  -- FK to correspondences.corr_id (type=RFA)
  technical_doc_id INT NOT NULL UNIQUE COMMENT 'ID ของเอกสารทางเทคนิคที่เกี่ยวข้อง', -- one techdoc appears in at most one RFA
  PRIMARY KEY (rfa_corr_id, technical_doc_id),
  CONSTRAINT fk_rfa_corr  FOREIGN KEY (rfa_corr_id)      REFERENCES correspondences(corr_id) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_rfa_tech  FOREIGN KEY (technical_doc_id) REFERENCES technicaldocs(id)        ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='ตารางเชื่อมระหว่าง RFA และเอกสารทางเทคนิค';

CREATE INDEX idx_rfaitems_rfa     ON rfa_items(rfa_corr_id);
CREATE INDEX idx_rfaitems_techdoc ON rfa_items(technical_doc_id);

-- 1.15 correspondence_routing_template_steps Table: ตารางสำหรับเก็บขั้นตอนของแต่ละแม่แบบ
CREATE TABLE correspondence_routing_template_steps (
  step_id       INT NOT NULL AUTO_INCREMENT PRIMARY KEY COMMENT 'ID ของขั้นตอน',
  template_id   INT NOT NULL COMMENT 'ID ของแม่แบบ',
  sequence      INT NOT NULL COMMENT 'ลำดับขั้นตอน',
  to_org_id     INT NOT NULL COMMENT 'ID องค์กรผู้รับในขั้นตอนนี้',
  step_purpose  ENUM('FOR_APPROVAL', 'FOR_REVIEW', 'FOR_INFORMATION') NOT NULL DEFAULT 'FOR_REVIEW' COMMENT 'วัตถุประสงค์ของขั้นตอนนี้',

  UNIQUE KEY ux_routing_template_sequence (template_id, sequence),
  CONSTRAINT fk_crts_template FOREIGN KEY (template_id) REFERENCES correspondence_routing_templates(template_id) ON DELETE CASCADE,
  CONSTRAINT fk_crts_org FOREIGN KEY (to_org_id) REFERENCES organizations(org_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='ขั้นตอนในแม่แบบการส่งต่อเอกสาร';

-- 1.16 correspondence_routing_steps Table: ตารางสำหรับติดตามขั้นตอนการส่งต่อเอกสารทั่วไป
CREATE TABLE correspondence_routing_steps (
  routing_step_id   INT NOT NULL AUTO_INCREMENT PRIMARY KEY COMMENT 'ID ของขั้นตอน',
  correspondence_id INT NOT NULL COMMENT 'ID ของเอกสารที่ถูกส่งต่อ',
    -- [ปรับปรุง] เพิ่มคอลัมน์สำหรับอ้างอิงถึงแม่แบบ
  template_id       INT NULL COMMENT 'ID ของแม่แบบที่ใช้ (ถ้ามี)',
  sequence          INT NOT NULL COMMENT 'ลำดับของขั้นตอนการส่งต่อ',
  from_org_id       INT NOT NULL COMMENT 'ID ขององค์กรผู้ส่ง',
  to_org_id         INT NOT NULL COMMENT 'ID ขององค์กรผู้รับ',
  step_purpose      ENUM('FOR_APPROVAL', 'FOR_REVIEW', 'FOR_INFORMATION') NOT NULL DEFAULT 'FOR_REVIEW' COMMENT 'วัตถุประสงค์ของขั้นตอนนี้ เช่น เพื่ออนุมัติ, เพื่อตรวจสอบ, หรือเพื่อรับทราบ',
  status            ENUM('SENT', 'RECEIVED', 'ACTIONED', 'FORWARDED', 'REPLIED') NOT NULL DEFAULT 'SENT' COMMENT 'สถานะการดำเนินการของเอกสารในขั้นตอนนี้',
  comments          TEXT COMMENT 'หมายเหตุ หรือความคิดเห็นในการส่งต่อ',
  processed_by_user_id INT NULL COMMENT 'ID ของผู้ใช้ที่ดำเนินการในขั้นตอนนี้',
  processed_at      TIMESTAMP NULL COMMENT 'เวลาที่ดำเนินการ',
  created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'เวลาที่สร้างขั้นตอนนี้',

  UNIQUE KEY ux_corr_routing_sequence (correspondence_id, sequence),
  -- Foreign Keys
  CONSTRAINT fk_crs_correspondence FOREIGN KEY (correspondence_id) REFERENCES correspondences(corr_id) ON DELETE CASCADE,
  -- หมายเหตุ: Script สำหรับสร้างตาราง correspondence_routing_templates ต้องถูกรันก่อนไฟล์นี้
  CONSTRAINT fk_crs_template FOREIGN KEY (template_id) REFERENCES correspondence_routing_templates(template_id) ON DELETE SET NULL,
  CONSTRAINT fk_crs_from_org FOREIGN KEY (from_org_id) REFERENCES organizations(org_id) ON DELETE CASCADE,
  CONSTRAINT fk_crs_to_org   FOREIGN KEY (to_org_id)   REFERENCES organizations(org_id) ON DELETE CASCADE,
  CONSTRAINT fk_crs_user     FOREIGN KEY (processed_by_user_id) REFERENCES users(user_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='ตารางติดตาม Workflow การส่งต่อเอกสารทั่วไป';

-- 1.17 correspondence_cc_recipients Table: CC recipients (org-level)
CREATE TABLE correspondence_cc_recipients (
  corr_id INT NOT NULL COMMENT 'ID ของเอกสาร',
  org_id  INT NOT NULL COMMENT 'ID ขององค์กรที่ได้รับสำเนา',
  PRIMARY KEY (corr_id, org_id),
  CONSTRAINT fk_cc_cor  FOREIGN KEY (corr_id) REFERENCES correspondences(corr_id) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_cc_org  FOREIGN KEY (org_id)  REFERENCES organizations(org_id)   ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='ตารางเก็บรายชื่อองค์กรที่ได้รับสำเนาเอกสาร';

-- 1.18 correspondence_references Table: cross references between correspondences
CREATE TABLE correspondence_references (
  src_corr_id INT NOT NULL COMMENT 'ID ของเอกสารต้นทาง',
  tgt_corr_id INT NOT NULL COMMENT 'ID ของเอกสารปลายทาง',
  PRIMARY KEY (src_corr_id, tgt_corr_id),
  CONSTRAINT fk_ref_src FOREIGN KEY (src_corr_id) REFERENCES correspondences(corr_id) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_ref_tgt FOREIGN KEY (tgt_corr_id) REFERENCES correspondences(corr_id) ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='ตารางเก็บความสัมพันธ์อ้างอิงระหว่างเอกสาร';

-- 1.19 project_parties Table: enforce <=1 contractor per project via generated column + unique index
CREATE TABLE project_parties (
  project_id INT NOT NULL COMMENT 'ID ของโปรเจกต์',
  org_id     INT NOT NULL COMMENT 'ID ขององค์กร',
  role       ENUM('OWNER','DESIGNER','CONSULTANT','CONTRACTOR','THIRD_PARTY') NOT NULL COMMENT 'บทบาทขององค์กรในโปรเจกต์',
  is_contractor TINYINT(1) GENERATED ALWAYS AS (IF(role = 'CONTRACTOR', 1, NULL)) STORED COMMENT 'คอลัมน์สร้างเพื่อบังคับบทบาท CONTRACTOR',
  PRIMARY KEY (project_id, org_id, role),
  UNIQUE KEY uq_project_parties_contractor (project_id, is_contractor),
  CONSTRAINT fk_pp_project FOREIGN KEY (project_id) REFERENCES projects(project_id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_pp_org FOREIGN KEY (org_id) REFERENCES organizations(org_id) ON DELETE RESTRICT ON UPDATE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='ตารางเก็บข้อมูลบทบาทขององค์กรในโปรเจกต์';

INSERT INTO project_parties (`project_id`, `org_id`, `role`) VALUES
-- 1 LCBP3
  ('1', '1', 'OWNER'), ('1', '10', 'OWNER'), ('1', '11', 'OWNER'), ('1', '12', 'OWNER'), ('1', '13', 'OWNER'), ('1', '14', 'OWNER'), ('1', '15', 'OWNER'), ('1', '16', 'OWNER'), ('1', '17', 'OWNER'), ('1', '18', 'OWNER'), ('1', '21', 'DESIGNER'), ('1', '22', 'CONSULTANT'),
-- 2-5 LCBP3 C1-C4
  ('2', '1', 'OWNER'), ('2', '10', 'OWNER'), ('2', '11', 'OWNER'), ('2', '12', 'OWNER'), ('2', '13', 'OWNER'), ('2', '14', 'OWNER'), ('2', '15', 'OWNER'), ('2', '16', 'OWNER'), ('2', '17', 'OWNER'), ('2', '18', 'OWNER'),  ('2', '21', 'DESIGNER'), ('2', '22', 'CONSULTANT'),
  ('3', '1', 'OWNER'), ('3', '10', 'OWNER'), ('3', '11', 'OWNER'), ('3', '12', 'OWNER'), ('3', '13', 'OWNER'), ('3', '14', 'OWNER'), ('3', '15', 'OWNER'), ('3', '16', 'OWNER'), ('3', '17', 'OWNER'), ('3', '18', 'OWNER'),  ('3', '21', 'DESIGNER'), ('3', '22', 'CONSULTANT'),
  ('4', '1', 'OWNER'), ('4', '10', 'OWNER'), ('4', '11', 'OWNER'), ('4', '12', 'OWNER'), ('4', '13', 'OWNER'), ('4', '14', 'OWNER'), ('4', '15', 'OWNER'), ('4', '16', 'OWNER'), ('4', '17', 'OWNER'), ('4', '18', 'OWNER'),  ('4', '21', 'DESIGNER'), ('4', '22', 'CONSULTANT'),
  ('5', '1', 'OWNER'), ('5', '10', 'OWNER'), ('5', '11', 'OWNER'), ('5', '12', 'OWNER'), ('5', '13', 'OWNER'), ('5', '14', 'OWNER'), ('5', '15', 'OWNER'), ('5', '16', 'OWNER'), ('5', '17', 'OWNER'), ('5', '18', 'OWNER'),  ('5', '21', 'DESIGNER'), ('5', '22', 'CONSULTANT')
  ;

-- 1.20 contract_parties Table: Links contracts, projects, and organizations together.
CREATE TABLE contract_parties (
  contract_id INT NOT NULL COMMENT 'ID ของสัญญา',
  project_id  INT NOT NULL COMMENT 'ID ของโปรเจกต์',
  org_id      INT NOT NULL COMMENT 'ID ขององค์กร',
  PRIMARY KEY (contract_id, project_id, org_id),
  CONSTRAINT fk_cp_contract FOREIGN KEY (contract_id) REFERENCES contracts(contract_id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_cp_project FOREIGN KEY (project_id) REFERENCES projects(project_id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_cp_org FOREIGN KEY (org_id) REFERENCES organizations(org_id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='ตารางเชื่อมระหว่างสัญญา โปรเจกต์ และองค์กร';

INSERT INTO contract_parties (org_id, project_id, contract_id) VALUES
(1, 1, 1), (1, 1, 2), (1, 1, 7), (1, 2, 1), (1, 2, 2), (1, 2, 7), (1, 2, 3), (1, 3, 1), (1, 3, 2),
(1, 3, 7), (1, 3, 4), (1, 4, 1), (1, 4, 2), (1, 4, 7), (1, 4, 5), (1, 5, 1), (1, 5, 2), (1, 5, 7),
(1, 5, 6), (10, 1, 1), (10, 1, 2), (10, 1, 7), (10, 2, 1), (10, 2, 2), (10, 2, 7), (10, 2, 3), (10, 3, 1),
(10, 3, 2), (10, 3, 7), (10, 3, 4), (10, 4, 1), (10, 4, 2), (10, 4, 7), (10, 4, 5), (10, 5, 1), (10, 5, 2),
(10, 5, 7), (10, 5, 6), (11, 1, 2), (11, 2, 2), (11, 3, 2), (11, 4, 2), (11, 5, 2), (12, 2, 3), (13, 3, 4),
(14, 1, 7), (14, 2, 7), (14, 2, 3), (14, 3, 7), (14, 3, 4), (14, 4, 7), (14, 4, 5), (14, 5, 7), (14, 5, 6),
(15, 2, 3), (15, 3, 4), (15, 4, 5), (15, 5, 6), (16, 4, 5), (17, 5, 6), (18, 1, 1), (18, 2, 1), (18, 2, 3),
(18, 3, 1), (18, 3, 4), (18, 4, 1), (18, 4, 5), (18, 5, 1), (18, 5, 6), (21, 1, 1), (21, 2, 1), (21, 2, 3),
(21, 3, 1), (21, 3, 4), (21, 4, 1), (21, 4, 5), (21, 5, 1), (21, 5, 6), (22, 1, 2), (22, 2, 2), (22, 2, 3),
(22, 3, 2), (22, 3, 4), (22, 4, 2), (22, 4, 5), (22, 5, 2), (22, 5, 6), (31, 1, 7), (31, 2, 7), (31, 2, 3),
(31, 3, 7), (31, 3, 4), (31, 4, 7), (31, 4, 5), (31, 5, 7), (31, 5, 6), (32, 2, 3), (32, 3, 4), (32, 4, 5),
(32, 5, 6), (41, 2, 3), (41, 3, 4), (41, 4, 5), (41, 5, 6);

-- 1.21 role_permissions Table: Role Permissions Junction Table (RBAC) - For global/system-level roles
CREATE TABLE role_permissions (
  role_id       INT NOT NULL COMMENT 'ID ของบทบาท',
  permission_id INT NOT NULL COMMENT 'ID ของสิทธิ์การใช้งาน',
  PRIMARY KEY (role_id, permission_id),
  CONSTRAINT fk_rp_role FOREIGN KEY (role_id) REFERENCES roles(role_id) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_rp_perm FOREIGN KEY (permission_id) REFERENCES permissions(permission_id) ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='ตารางเชื่อมระหว่างบทบาทและสิทธิ์การใช้งาน';

-- xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
-- SUPER_ADMIN: all permissions (disambiguated columns with aliases)
INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.role_id, p.permission_id
FROM roles AS r
CROSS JOIN permissions AS p
WHERE r.role_code='SUPER_ADMIN';

-- ADMIN: all except superadmin.access (scope enforced app-side)
INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.role_id, p.permission_id
FROM roles AS r
JOIN permissions AS p ON p.permission_code <> 'superadmin.access'
WHERE r.role_code='ADMIN';

-- EDITOR: operational set
INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.role_id, p.permission_id
FROM roles AS r
JOIN permissions AS p ON p.permission_code IN (
  'projects.view','project_parties.manage',
  'drawings.view','drawings.upload',
  'documents.view','documents.manage',
  'materials.view','materials.manage',
  'ms.view','ms.manage',
  'rfas.view','rfas.create','rfas.respond',
  'corr.view','corr.manage',
  'transmittals.manage','reports.view'
)
WHERE r.role_code='EDITOR';

-- VIEWER: read-only set
INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.role_id, p.permission_id
FROM roles AS r
JOIN permissions AS p ON p.permission_code IN (
  'projects.view','organizations.view','drawings.view','documents.view','materials.view','ms.view','rfas.view','corr.view','reports.view'
)
WHERE r.role_code='VIEWER';

-- 1.22 user_roles Table: User Roles Junction Table (RBAC) - For global/system-level roles
CREATE TABLE user_roles (
  user_id INT NOT NULL COMMENT 'ID ของผู้ใช้',
  role_id INT NOT NULL COMMENT 'ID ของบทบาท',
  PRIMARY KEY (user_id, role_id),
  CONSTRAINT fk_ur_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_ur_role FOREIGN KEY (role_id) REFERENCES roles(role_id) ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='ตารางเชื่อมระหว่างผู้ใช้และบทบาท';

-- Initial SUPER_ADMIN
INSERT IGNORE INTO user_roles (user_id, role_id)
SELECT u.user_id, r.role_id
FROM users AS u
JOIN roles AS r ON r.role_code='SUPER_ADMIN'
WHERE u.username='superadmin';

-- 1.23 Table: User Project Roles Junction Table (RBAC) - For project-specific roles
CREATE TABLE user_project_roles (
  user_id    INT NOT NULL COMMENT 'ID ของผู้ใช้',
  project_id INT NOT NULL COMMENT 'ID ของโปรเจกต์',
  role_id    INT NOT NULL COMMENT 'ID ของบทบาท',
  PRIMARY KEY (user_id, project_id, role_id),
  CONSTRAINT fk_upr_user    FOREIGN KEY (user_id)    REFERENCES users(user_id)      ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_upr_project FOREIGN KEY (project_id) REFERENCES projects(project_id) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_upr_role    FOREIGN KEY (role_id)    REFERENCES roles(role_id)      ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='ตารางเชื่อมระหว่างผู้ใช้ โปรเจกต์ และบทบาท';

-- Sample seed for user_project_roles (assign superadmin as EDITOR in project LCBP3C1)
INSERT IGNORE INTO user_project_roles (user_id, project_id, role_id)
SELECT u.user_id, p.project_id, r.role_id
FROM users u
JOIN projects p ON p.project_code='LCBP3C1'
JOIN roles r ON r.role_code='EDITOR'
WHERE u.username='superadmin';

-- Sample seed for user_project_roles (assign superadmin as VIEWER in project LCBP3C2)
INSERT IGNORE INTO user_project_roles (user_id, project_id, role_id)
SELECT u.user_id, p.project_id, r.role_id
FROM users u
JOIN projects p ON p.project_code='LCBP3C2'
JOIN roles r ON r.role_code='VIEWER'
WHERE u.username='superadmin';

-- Assign editor01 as EDITOR in project LCBP3C1
INSERT IGNORE INTO user_project_roles (user_id, project_id, role_id)
SELECT u.user_id, p.project_id, r.role_id
FROM users u
JOIN projects p ON p.project_code='LCBP3C1'
JOIN roles r ON r.role_code='EDITOR'
WHERE u.username='editor01';

-- Assign viewer01 as VIEWER in project LCBP3C2
INSERT IGNORE INTO user_project_roles (user_id, project_id, role_id)
SELECT u.user_id, p.project_id, r.role_id
FROM users u
JOIN projects p ON p.project_code='LCBP3C2'
JOIN roles r ON r.role_code='VIEWER'
WHERE u.username='viewer01';

-- 1.24 audit_logs Table: (optional)
CREATE TABLE audit_logs (
  audit_id     BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT 'ID ของบันทึก',
  user_id      INT NULL COMMENT 'ID ของผู้ใช้ที่ทำการกระทำ',
  action       VARCHAR(100) NOT NULL COMMENT 'ประเภทของการกระทำ',   -- e.g., login.success, rfa.create
  entity_type  VARCHAR(50) NULL COMMENT 'ประเภทของข้อมูลที่ถูกกระทำ',        -- table/model name
  entity_id    VARCHAR(50) NULL COMMENT 'ID ของข้อมูลที่ถูกกระทำ',          -- primary key value
  details_json JSON NULL COMMENT 'รายละเอียดเพิ่มเติมในรูปแบบ JSON',
  ip_address   VARCHAR(45) NULL COMMENT 'ที่อยู่ IP ของผู้ใช้',
  user_agent   VARCHAR(255) NULL COMMENT 'User-Agent ของเบราว์เซอร์',
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'เวลาที่กระทำ',
  CONSTRAINT fk_audit_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='ตารางบันทึกการกระทำของผู้ใช้ในระบบ';
CREATE INDEX idx_audit_created ON audit_logs(created_at);

SET FOREIGN_KEY_CHECKS=1;