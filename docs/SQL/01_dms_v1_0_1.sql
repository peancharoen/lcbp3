-- ==========================================================
-- DMS v1.0.2 Correspondence Improvements
-- Database v1.0 - Deploy Script Schema
-- Server: Container Station on QNAPQNAP TS-473A
-- Database service: MariaDB 10.11
-- database web ui: phpmyadmin 5-apache
-- database deelopment ui: DBeaver
-- backend sevice: NestJS
-- frontend sevice: next.js
-- reverse proxy: jc21/nginx-proxy-manager:latest
-- cron service: n8n
-- DMS v1.0.0 Initial Schema
-- DMS v1.0.1 Add missing relationship for Req 2.5.3,
-- Update: shop_drawing_revision_contract_refs Changed link to revision-level instead of master-level based on clarification.
-- DMS v1.0.2 Correspondence Improvements
-- Update: 
-- 1. (Files)      Consolidate file management:
--                  - DROPs `pdf_path` from `correspondences`
--                  - ADDs `is_main_document` to `attachments`
-- 2. (Recipients) Make recipients more flexible:
--                 - DROPs `recipient_id` from `correspondences`
--                 - DROPs `correspondence_cc_recipients` table
--                 - CREATES `correspondence_recipients` (M:N table with TO/CC type)
-- 3. (Search)     Remove keyword redundancy:
--                 - DROPs `keywords` from `correspondences` (use `tags` system instead)
-- 4. (Change)     corr_id -> correspondence_id for consistency
-- 5. (Change)     revision VARCHAR(50) NULL in correspondences to support alphanumeric revisions รูปแบบ (A-Z?) → ตัวอักษร A-Z ตามด้วยตัวเลข 0 ตัวหรือมากกว่า (เช่น A, A1, B10), ตัวเลขล้วน หรือ ตัวเลขทศนิยม (เช่น 1, 2.1, 10.5)
-- 6. (Change)     Changed tecnicaldoc to rfa (Requested_for_Approval)
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
DROP TABLE IF EXISTS correspondence_recipients;
DROP TABLE IF EXISTS correspondence_routing_steps;
DROP TABLE IF EXISTS correspondence_routing_template_steps;
DROP TABLE IF EXISTS transmittal_items;
DROP TABLE IF EXISTS rfa_workflows;
DROP TABLE IF EXISTS rfa_workflow_template_steps;
DROP TABLE IF EXISTS rfa_items;
DROP TABLE IF EXISTS rfa_revision;
DROP TABLE IF EXISTS shop_drawing_revision_contract_refs;
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
DROP TABLE IF EXISTS rfa_workflow_templates;
DROP TABLE IF EXISTS shop_drawings;
DROP TABLE IF EXISTS contract_drawings;
DROP TABLE IF EXISTS rfa_revisions 
DROP TABLE IF EXISTS rfas;
DROP TABLE IF EXISTS circulation_templates;
DROP TABLE IF EXISTS correspondence_tags;
DROP TABLE IF EXISTS tags;

-- Level 3: ตารางที่ถูกอ้างอิงโดย Level 2
DROP TABLE IF EXISTS correspondences;
DROP TABLE IF EXISTS shop_drawing_sub_categories;
DROP TABLE IF EXISTS shop_drawing_main_categories;
DROP TABLE IF EXISTS contract_dwg_sub_cat;
DROP TABLE IF EXISTS contract_dwg_cat;
DROP TABLE IF EXISTS rfa_approve_codes;
DROP TABLE IF EXISTS rfa_status_codes;
DROP TABLE IF EXISTS rfa_types;
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

-- Views
DROP VIEW IF EXISTS v_current_correspondences;

-- Procedure
DRO PROCEDURE IF EXISTS sp_create_correspondence_revision

-- เปิดการตรวจสอบ Foreign Key กลับมาเหมือนเดิม
-- SET FOREIGN_KEY_CHECKS=1;

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
('COMPLETED', 'ปCompleted', 30),
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
-- 3.1 rfas_types Table
CREATE TABLE rfa_types (
  rfa_type_id INT AUTO_INCREMENT PRIMARY KEY COMMENT 'ID ของตาราง',
  code        VARCHAR(20)  NOT NULL UNIQUE COMMENT 'รหัสประเภทเอกสาร',
  name        VARCHAR(100) NOT NULL COMMENT 'ชื่อประเภทเอกสาร',
  sort_order  INT DEFAULT 0 COMMENT 'ลำดับการแสดงผล',
  is_active   TINYINT(1) DEFAULT 1 COMMENT 'สถานะการใช้งาน'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='ประเภทเอกสาร';
INSERT INTO rfa_types (code, name, sort_order, is_active) VALUES
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

-- 3.2 rfas_status_codes Table
CREATE TABLE rfa_status_codes (
  status_code_id INT AUTO_INCREMENT PRIMARY KEY COMMENT 'ID ของตาราง',
  code        VARCHAR(20) NOT NULL UNIQUE COMMENT 'รหัสสถานะเอกสาร',
  description VARCHAR(255) NULL COMMENT 'คำอธิบายสถานะเอกสาร',
  sort_order  INT DEFAULT 0 COMMENT 'ลำดับการแสดงผล',
  is_active   TINYINT(1) DEFAULT 1 COMMENT 'สถานะการใช้งาน'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='รหัสสถานะเอกสาร';
INSERT INTO rfa_status_codes (code, description, sort_order) VALUES
('DFT', 'Draft', 1),
('FAP', 'For Approve', 11),
('FRE', 'For Review', 12),
('FCO', 'For Construction', 20),
('ASB', 'AS-Built', 30),
('OBS', 'Obsolete', 80),
('CC', 'Canceled', 99);

-- 3.3 rfas_approve_codes Table
CREATE TABLE rfa_approve_codes (
  approve_code_id INT AUTO_INCREMENT PRIMARY KEY COMMENT 'ID ของตาราง',
  code        VARCHAR(20) NOT NULL UNIQUE COMMENT 'รหัสการอนุมัติเอกสาร',
  description VARCHAR(255) NULL COMMENT 'คำอธิบายการอนุมัติเอกสาร',
  sort_order  INT DEFAULT 0 COMMENT 'ลำดับการแสดงผล',
  is_active   TINYINT(1) DEFAULT 1 COMMENT 'สถานะการใช้งาน'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='รหัสการอนุมัติเอกสาร';
INSERT INTO rfa_approve_codes (code, description, sort_order, is_active) VALUES
('1A', 'Approved by Authority', 10, 1),
('1C', 'Approved by CSC',       11, 1),
('1N', 'Approved As Note',      12, 1),
('1R', 'Approved with Remarks', 13, 1),
('3C', 'Consultant Comments',   31, 1),
('3R', 'Revise and Resubmit',   32, 1),
('4X', 'Reject',                40, 1),
('5N', 'No Further Action',     50, 1);

-- 3.4 contract_dwg_cat Table: Category (ต่อโครงการ)
CREATE TABLE contract_dwg_cat (
  cat_id     INT AUTO_INCREMENT PRIMARY KEY COMMENT 'ID ของตาราง',
  project_id INT NOT NULL COMMENT 'รหัสโครงการ',
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

-- 3.5 contract_dwg_sub_cat Table: Sub-Category (ต่อโครงการ)
CREATE TABLE contract_dwg_sub_cat (
  sub_cat_id    INT AUTO_INCREMENT PRIMARY KEY COMMENT 'ID ของตาราง',
  project_id    INT NOT NULL COMMENT 'รหัสโครงการ',
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

-- 3.9 contract_dwg_volume Table: 
CREATE TABLE contract_dwg_volume (
  volume_id   INT AUTO_INCREMENT PRIMARY KEY COMMENT 'ID ของตาราง',
  project_id  INT NOT NULL COMMENT 'รหัสโครงการ',
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='เล่มของ Contract Drawing';

-- 3.8 correspondences Table ตารางเก็บข้อมูลการสื่อสาร : 
-- details [email_details, instruction_details, letter_details, memorandum_details, minutes_of_meeting_details, rfi_details]
CREATE TABLE correspondences (
  correspondence_id        INT AUTO_INCREMENT PRIMARY KEY COMMENT 'ID ของตาราง',
  correspondence_number    VARCHAR(100) NOT NULL COMMENT 'เลขที่หนังสือ',
  correspondence_type_id   INT NOT NULL COMMENT 'ประเภทหนังสือ',

  is_internal_communication TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'ระบุว่าเป็นหนังสือสื่อสารภายใน (1=ใช่,0=ไม่ใช่)',
  project_id     INT NOT NULL COMMENT 'รหัสโครงการ',
  originator_id  INT NULL COMMENT 'องกรณ์ที่เป็นผู้ออกเอกสาร', -- organizations.org_id
  recipient_id               INT NULL COMMENT 'องกรณ์ที่เป็นปู้รับเอกสาร', -- organizations.org_id

  created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'วันที่สร้าง',
  created_by     INT NULL 'รหัสผู้สร้าง',
  deleted_at     DATETIME NULL COMMENT 'วันที่ลบ',

  -- Track current/latest revision
  current_revision_id   INT NULL COMMENT 'ระบุ Revision ปัจจุบัน', -- FK -> correspondence_revisions.correspondence_revision_id
  latest_revision_number INT NOT NULL DEFAULT 0 COMMENT 'หมายเลข Revision ล่าสุด', -- INT เพื่อง่ายต่อการเรียงลำดับ References correspondence_revisions.revision_number

  CONSTRAINT chk_cor_internal CHECK (is_internal_communication IN (0,1)),
  
  -- correspondences number uniqueness per project
  CONSTRAINT uq_corr_no_per_project UNIQUE (project_id, correspondence_number),

  -- FKs
  CONSTRAINT fk_cor_project     FOREIGN KEY (project_id)     REFERENCES projects(project_id)      ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_cor_originator  FOREIGN KEY (originator_id)  REFERENCES organizations(org_id)     ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT fk_cor_recipient   FOREIGN KEY (recipient_id)   REFERENCES organizations(org_id)     ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT fk_cor_created_by  FOREIGN KEY (created_by)     REFERENCES users(user_id)            ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT fk_cor_type        FOREIGN KEY (correspondence_type_id)   REFERENCES correspondence_types(type_id)     ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_cm_current_revision FOREIGN KEY (current_revision_id) REFERENCES correspondence_revisions(correspondence_revision_id) ON UPDATE CASCADE ON DELETE SET NULL;
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT = 'ตารางหนังสือหลัก';
-- Indexes for correspondences table
CREATE INDEX idx_cor_project     ON correspondences(project_id);
CREATE INDEX idx_cor_originator  ON correspondences(originator_id);
CREATE INDEX idx_cor_type        ON correspondences(correspondence_type_id);
CREATE INDEX idx_cor_created_at  ON correspondences(created_at);
CREATE INDEX idx_attach_main_doc ON correspondences(correspondence_id, is_main_document);
CREATE INDEX idx_cor_current_rev ON correspondences(current_revision_id);


-- ==========================================================
-- Level 2: ตารางที่ถูกอ้างอิงโดย Level 1
-- ==========================================================
-- 2.1 circulation_templates Table: ตารางหลักสำหรับเก็บชื่อแม่แบบใบเวียน
CREATE TABLE circulation_templates (
  template_id   INT NOT NULL AUTO_INCREMENT COMMENT 'ID ของแม่แบบ',
  template_name VARCHAR(255) NOT NULL COMMENT 'ชื่อแม่แบบ (เช่น "สำหรับเอกสารการเงิน", "สำหรับ Drawing โครงสร้าง")',
  org_id        INT NOT NULL COMMENT 'ID ขององค์กรที่เป็นเจ้าของแม่แบบนี้ (สำคัญมาก)',
  description   TEXT COMMENT 'คำอธิบายแม่แบบ',
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'วันที่สร้าง',
  updated_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'วันที่แก้ไขล่าสุด',
  PRIMARY KEY (template_id),
  
  -- ป้องกันการสร้างชื่อแม่แบบซ้ำในองค์กรเดียวกัน
  UNIQUE KEY ux_circulation_template_name_org (template_name, org_id),
  
  -- Foreign Key
  CONSTRAINT fk_ct_org FOREIGN KEY (org_id) REFERENCES organizations(org_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='แม่แบบสำหรับใบเวียนเอกสารภายในองค์กร';

-- 2.2 rfas Table ตารางเก็บข้อมูลเอกสารขออนุมัติ (Request for Approval): rfas 1 to many rfa_revision
CREATE TABLE rfas (
  rfa_id               INT AUTO_INCREMENT PRIMARY KEY COMMENT 'ID ของตาราง',
  -- rfa_number   VARCHAR(100) NOT NULL,
  rfa_type_id INT NOT NULL COMMENT 'ประเภทเอกสารขออนุมัติ',
  -- project_id       INT NOT NULL COMMENT 'รหัสโครงการ',

  original_id      INT NOT NULL COMMENT 'รหัสเอกสารต้นฉบับ (สำหรับเชื่อมโยง revision)',
  revision         VARCHAR(50) NOT NULL COMMENT 'หมายเลข revision (e.g., A, B, 1, 2.1)',
  title            VARCHAR(255) NOT NULL COMMENT 'หัวข้อเอกสาร',
  
  -- status_code_id   INT NOT NULL COMMENT 'รหัสสถานะเอกสาร',
  -- approve_code_id  INT NULL COMMENT 'รหัสการอนุมัติเอกสาร',
  created_at       DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL COMMENT 'วันที่สร้าง',
  created_by       INT NULL COMMENT 'ผู้สร้าง',
  -- updated_by       INT NULL COMMENT 'ผู้แก้ไขล่าสุด',
  deleted_at       DATETIME NULL COMMENT 'วันที่ลบ',

  -- Track current/latest revision
  current_revision_id   INT NULL COMMENT 'ระบุ Revision ปัจจุบัน', -- FK -> correspondence_revisions.correspondence_revision_id
  latest_revision_number INT NOT NULL DEFAULT 0 COMMENT 'หมายเลข Revision ล่าสุด', -- INT เพื่อง่ายต่อการเรียงลำดับ References correspondence_revisions.revision_number

  CONSTRAINT fk_techdoc_created_by FOREIGN KEY (created_by) REFERENCES users(user_id) ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT fk_techdoc_updated_by FOREIGN KEY (updated_by) REFERENCES users(user_id) ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT fk_techdoc_status  FOREIGN KEY (status_code_id)  REFERENCES rfa_status_codes(status_code_id),
  CONSTRAINT fk_techdoc_approve FOREIGN KEY (approve_code_id)  REFERENCES rfa_approve_codes(approve_code_id)      ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT fk_techdoc_type    FOREIGN KEY (rfa_type_id) REFERENCES rfa_types(rfa_type_id),
  CONSTRAINT fk_techdoc_project FOREIGN KEY (project_id)       REFERENCES projects(project_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='ตารางเก็บเอกสารขออนุมัติ';

CREATE UNIQUE INDEX idx_unique_techdoc_revision ON rfas (original_id, revision, project_id);

-- 2.2 rfas_revisions Table
CREATE TABLE rfa_revisions (
  rfa_revision_id   INT AUTO_INCREMENT PRIMARY KEY COMMENT 'ID ของตาราง',
  rfa_id            INT COMMENT 'rfa id', -- FK -> rfas.rfa_id
  correspondence_id          INT NOT NULL COMMENT 'Master correspondence ID',

  rfa_type_id INT NOT NULL COMMENT 'ประเภทเอกสาร',

  master_id         INT NOT NULL,
  revision_number   INT NOT NULL,
  revision_label    VARCHAR(10) NULL, -- A, B, C
  
  status_code_id    INT NOT NULL,
  approve_code_id   INT NULL,
  is_current        BOOLEAN NOT NULL DEFAULT FALSE,
  
  -- File references
  pdf_path          VARCHAR(500) NULL,
  dwg_path          VARCHAR(500) NULL, -- สำหรับ DWG type
  
  -- Metadata
  revision_description TEXT NULL,
  submitted_date    DATE NULL,
  approved_date     DATE NULL,
  
  created_at        DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_by        INT NULL,
  updated_by        INT NULL,
  
  CONSTRAINT uq_master_rev_number UNIQUE (master_id, revision_number),
  
  CONSTRAINT chk_rev_format   CHECK (revision_label IS NULL OR revision_label REGEXP '^(A-Z?|[0-9]+(\\.[0-9]+)?)$'), -- validate format
  CONSTRAINT fk_rr_correspondence FOREIGN KEY (correspondence_id)        REFERENCES correspondences(correspondence_id) ON UPDATE CASCADE ON DELETE CASCADE, -- link to master correspondence
  CONSTRAINT fk_rr_status         FOREIGN KEY (correspondence_status_id) REFERENCES correspondence_status(status_id) ON UPDATE CASCADE ON DELETE RESTRICT, -- link to correspondence status
  CONSTRAINT fk_rr_type           FOREIGN KEY (rfa_type_id)            REFERENCES rfa_types(rfa_type_id) ON DELETE RESTRICT, -- link to rfa types
  CONSTRAINT fk_rr_status_code    FOREIGN KEY (status_code_id)         REFERENCES rfa_status_codes(status_code_id) ON DELETE RESTRICT, -- link to rfa status codes
  CONSTRAINT fk_rr_approve       FOREIGN KEY (approve_code_id)        REFERENCES rfa_approve_codes(approve_code_id) ON DELETE RESTRICT, -- link to rfa approve codes
  CONSTRAINT fk_rr_created_by     FOREIGN KEY (created_by)           REFERENCES users(user_id) ON DELETE SET NULL, -- link to users
  CONSTRAINT fk_rr_updated_by     FOREIGN KEY (updated_by)           REFERENCES users(user_id) ON DELETE SET NULL  -- link to users
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='ตารางเก็บ revision ของเอกสารขออนุมัติ';


/* ===========================================================
2.3 Drawings (ต่อโครงการ)
  - 1 drawing ∈ 1 project
  - ชี้ 1 sub-category (ในโครงการเดียวกัน)
  - ชี้ 1 volume     (ในโครงการเดียวกัน)
  - unique: (project_id, condwg_no)
  =========================================================== */

CREATE TABLE contract_drawings (
  condwg_id   INT AUTO_INCREMENT PRIMARY KEY COMMENT 'ID ของตาราง',
  project_id  INT NOT NULL COMMENT 'รหัสโครงการ',
  condwg_no   VARCHAR(255) NOT NULL COMMENT 'เลขที่แบบสัญญา',      -- รหัส/เลขดรอว์อิง
  title       VARCHAR(255) NULL COMMENT 'ชื่อแบบสัญญา',          -- ชื่อดรอว์อิง
  sub_cat_id  INT NOT NULL COMMENT 'รหัสหมวดหมู่ย่อย',               -- 1 drawing → 1 sub-category
  volume_id   INT NOT NULL COMMENT 'รหัสเล่ม',                    -- 1 drawing → 1 volume
  sub_no      INT NULL COMMENT 'หมายเลขย่อย',                    -- หมายเลขย่อย (ถ้ามี)
  remark      VARCHAR(500) NULL COMMENT 'หมายเหตุ',                  -- หมายเหตุเพิ่มเติม

  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'วันที่สร้าง',
  updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP COMMENT 'วันที่แก้ไขล่าสุด',

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='ตารางเก็บแบบสัญญาต่อโครงการ';

-- 2.4 shop_drawings Table: ตารางหลักสำหรับข้อมูล Shop Drawing
CREATE TABLE shop_drawings (
  id                  INT NOT NULL AUTO_INCREMENT COMMENT 'ID ของตาราง',
  drawing_number      VARCHAR(100) NOT NULL COMMENT 'เลขที่แบบ Shop Drawing',
  title               VARCHAR(500) NOT NULL COMMENT 'ชื่อแบบ',
  main_category_id    INT NOT NULL COMMENT 'ID หมวดหมู่หลัก',
  sub_category_id     INT NOT NULL COMMENT 'ID หมวดหมู่ย่อย',
  created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'วันที่สร้าง',
  updated_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'วันที่แก้ไขล่าสุด',   
  PRIMARY KEY (id),
  UNIQUE KEY ux_sd_drawing_number (drawing_number),
  CONSTRAINT fk_sd_main_cat FOREIGN KEY (main_category_id) REFERENCES shop_drawing_main_categories(id),
  CONSTRAINT fk_sd_sub_cat FOREIGN KEY (sub_category_id) REFERENCES shop_drawing_sub_categories(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='ข้อมูลหลักของ Shop Drawing';

-- 2.x rfa_revision Table ตารางเก็บข้อมูล Revision ของเอกสารขออนุมัติ : rfa_revision many to 1 rfas, rfa_revision 1 to 1 correwpondence
CREATE TABLE rfa_revision (
  rfa_revision_id     INT AUTO_INCREMENT PRIMARY KEY COMMENT 'ID ของตาราง',
  rfa_id           INT COMMENT 'ID ของเอกสารขออนุมัติ (จากตาราง rfas)', -- FK -> rfas.rfa_id
  correspondence_id          INT NOT NULL COMMENT 'Master correspondence ID', -- FK -> correspondences.correspondence_id
  revision_number            INT NOT NULL COMMENT 'หมายเลข Revision', -- เปลี่ยนเป็น INT เพื่อง่ายต่อการเรียงลำดับ
  revision_label             VARCHAR(10) NULL COMMENT 'ตัวหนงสือ/ตัวเลข กำกับ Revision', -- e.g., A, A1, B10, 1, 2.1, 10.5 ; NULL for first issue if desired
  
  -- project_id       INT NOT NULL COMMENT 'รหัสโครงการ', refer by correspondences
  -- rfa_number       VARCHAR(100) NOT NULL COMMENT 'เลขที่เอกสารขออนุมัติ', refer by correspondences 
  title            VARCHAR(255) NOT NULL COMMENT 'เรื่อง',

  -- สถานะเฉพาะของ Revision นี้
  status_code_id   INT NOT NULL COMMENT 'รหัสสถานะเอกสาร',
  approve_code_id  INT NULL COMMENT 'รหัสการอนุมัติเอกสาร',
  is_current       BOOLEAN NOT NULL DEFAULT FALSE COMMENT 'ระบุว่าเป็น Revision ปัจจุบัน (1=ใช่,0=ไม่ใช่)',

  -- Metadata
  revision_description TEXT NULL COMMENT 'คำอธิบายการแก้ไขใน Revision นี้',
  submitted_date    DATE NULL COMMENT 'วันที่ส่งขออนุมัติ',
  received_date              DATETIME NULL COMMENT 'วันที่ลงรับเอกสาร',
  due_date                   DATETIME NULL COMMENT 'วันที่ต้องตอบเอกสาร',
  approved_date     DATE NULL COMMENT 'วันที่อนุมัติ',
  updated_by       INT NULL COMMENT 'ผู้แก้ไขล่าสุด',
  
  -- pdf_path   เก็บไฟล์ PDF ที่ ตาราง rfa_attachments,

  -- Audit
  created_at                 DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'วันที่สร้างเอกสาร',
  created_by                 INT NULL COMMENT 'ผู้สร้างเอกสาร',
  change_reason              TEXT NULL COMMENT 'เหตุผลที่แก้ไขเอกสาร',

  CONSTRAINT uq_rr_rev_number UNIQUE (rfa_id, revision_number), -- ป้องกันการมี revision_number ซ้ำกันใน rfa_id เดียวกัน
  CONSTRAINT uq_rr_current UNIQUE (rfa_id, is_current), -- ใช้ partial unique index ได้ดีกว่า

  -- รูปแบบ (A-Z?) → ตัวอักษร A-Z ตามด้วยตัวเลข 0 ตัวหรือมากกว่า (เช่น A, A1, B10), ตัวเลขล้วน หรือ ตัวเลขทศนิยม (เช่น 1, 2.1, 10.5)
  CONSTRAINT chk_rev_format   CHECK (revision_label IS NULL OR revision_label REGEXP '^(A-Z?|[0-9]+(\\.[0-9]+)?)$'),
  CONSTRAINT chk_is_current  CHECK (is_current IN (0,1)),
  CONSTRAINT chk_rev_number_positive CHECK (revision_number >= 0),
  CONSTRAINT chk_due_after_received CHECK (due_date IS NULL OR received_date IS NULL OR due_date >= received_date),
  CONSTRAINT chk_approved_after_received CHECK (approved_date IS NULL OR received_date IS NULL OR approved_date >= DATE(received_date)),
  CONSTRAINT chk_approved_after_submitted CHECK (approved_date IS NULL OR submitted_date IS NULL OR approved_date >= submitted_date),
  CONSTRAINT chk_submitted_after_created CHECK (submitted_date IS NULL OR created_at IS NULL OR submitted_date >= DATE(created_at)),
  CONSTRAINT chk_received_after_created CHECK (received_date IS NULL OR created_at IS NULL OR received_date >= created_at),
  CONSTRAINT chk_updated_by_diff_created_by CHECK (updated_by IS NULL OR updated_by <> created_by),
  CONSTRAINT chk_rfa_id_not_null_if_correspondence FOREIGN KEY (correspondence_id) REFERENCES correspondences(correspondence_id), -- ถ้า correspondence_id ไม่เป็น NULL ต้องมี rfa_id ด้วย
  CONSTRAINT chk_rfa_id_null_if_no_correspondence CHECK ((correspondence_id IS NULL AND rfa_id IS NULL) OR (correspondence_id IS NOT NULL AND rfa_id IS NOT NULL)), -- ถ้า correspondence_id เป็น NULL rfa_id ต้องเป็น NULL ด้วย
  CONSTRAINT chk_only_one_current_revision_per_rfa CHECK (
    is_current = 0 OR
    (is_current = 1 AND rfa_id IS NOT NULL)
  ), -- ถ้า is_current=1 ต้องมี rfa_id ด้วย
  CONSTRAINT chk_only_one_current_revision_per_correspondence CHECK (
    is_current = 0 OR
    (is_current = 1 AND correspondence_id IS NOT NULL)
  ), -- ถ้า is_current=1 ต้องมี correspondence_id ด้วย
  CONSTRAINT chk_either_rfa_or_correspondence CHECK (
    (rfa_id IS NOT NULL AND correspondence_id IS NULL) OR
    (rfa_id IS NULL AND correspondence_id IS NOT NULL)
  ), -- ต้องมีแค่ rfa_id หรือ correspondence_id เท่านั้น ไม่สามารถมีทั้งสองอย่างพร้อมกัน
  CONSTRAINT 

  -- FKs
  CONSTRAINT fk_rr_correspondence FOREIGN KEY (correspondence_id) REFERENCES correspondences(correspondence_id) ON DELETE CASCADE, -- ถ้าเอกสารถูกลบ ให้ลบ revision ด้วย  
  CONSTRAINT fk_rr_rfa FOREIGN KEY (rfa_id) REFERENCES rfas(rfa_id) ON DELETE CASCADE, -- ถ้าเอกสารถูกลบ ให้ลบ revision ด้วย
  CONSTRAINT fk_rr_status FOREIGN KEY (status_code_id) REFERENCES rfa_status_codes(status_code_id),
  CONSTRAINT fk_rr_approve FOREIGN KEY (approve_code_id) REFERENCES rfa_approve_codes(approve_code_id) ON DELETE SET NULL,
  CONSTRAINT fk_rr_updated_by FOREIGN KEY (updated_by) REFERENCES users(user_id) ON UPDATE CASCADE ON DELETE SET NULL
)

-- 2.5 rfa_workflow_templates Table: ตารางหลักสำหรับเก็บชื่อแม่แบบ
CREATE TABLE rfa_workflow_templates (
  template_id   INT NOT NULL AUTO_INCREMENT COMMENT 'ID ของแม่แบบ',
  template_name VARCHAR(255) NOT NULL COMMENT 'ชื่อแม่แบบ',
  description   TEXT COMMENT 'คำอธิบาย',
  project_id    INT NULL, -- (Optional) ทำให้สามารถสร้างแม่แบบเฉพาะโครงการได้
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE COMMENT 'วันที่สร้าง',
  updated_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'วันที่แก้ไขล่าสุด',
  PRIMARY KEY (template_id),
  UNIQUE KEY ux_template_name_project (template_name, project_id),
  CONSTRAINT fk_wt_project FOREIGN KEY (project_id) REFERENCES projects(project_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='แม่แบบ Workflow การอนุมัติเอกสารทางเทคนิค';

-- 2.6 correspondence_routing_templates Table:ตารางหลักสำหรับเก็บชื่อแม่แบบการส่งต่อ
CREATE TABLE correspondence_routing_templates (
  template_id   INT NOT NULL AUTO_INCREMENT COMMENT 'ID ของแม่แบบ',
  template_name VARCHAR(255) NOT NULL COMMENT 'ชื่อแม่แบบ',
  description   TEXT COMMENT 'คำอธิบาย',
  project_id    INT NULL COMMENT 'ID โครงการ (ถ้าเป็นแม่แบบเฉพาะโครงการ)',
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'วันที่สร้าง',
  updated_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'วันที่แก้ไขล่าสุด',
  PRIMARY KEY (template_id),
  UNIQUE KEY ux_routing_template_name_project (template_name, project_id),
  CONSTRAINT fk_crt_project FOREIGN KEY (project_id) REFERENCES projects(project_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='แม่แบบสายงานการส่งต่อเอกสารทั่วไป';

-- 2.7 circulations Table:
CREATE TABLE circulations (
  cir_id    INT NOT NULL AUTO_INCREMENT COMMENT 'ID ของตารางใบเวียน',
  correspondence_id   INT UNIQUE NOT NULL COMMENT 'ID ของเอกสาร (จากตาราง correspondences)', -- one circulation record per correspondence (optional)
  org_id    INT NOT NULL COMMENT 'ID ขององค์กรที่เป็นเจ้าของใบเวียนนี้', -- องค์กรที่เป็นเจ้าของใบเวียนนี้
  cir_no    VARCHAR(100) NOT NULL COMMENT 'เลขที่ใบเวียน', -- unique per organization
  cir_subject         VARCHAR(500) NOT NULL COMMENT 'เรื่องใบเวียน',
  cir_status_code     VARCHAR(20) NOT NULL DEFAULT 'DRAFT' COMMENT 'รหัสสถานะใบเวียน',
  created_by_user_id  INT NOT NULL COMMENT 'ID ของผู้สร้างใบเวียน',
  submitted_at        TIMESTAMP NULL COMMENT 'วันที่ส่งใบเวียน',
  closed_at           TIMESTAMP NULL COMMENT 'วันที่ปิดใบเวียน',
  created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'วันที่สร้าง',
  updated_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'วันที่แก้ไขล่าสุด',
  -- pdf_path  VARCHAR(500) NULL,
  PRIMARY KEY (cir_id),
  CONSTRAINT uq_cir_org_no UNIQUE(org_id, cir_no),
  CONSTRAINT fk_cir_correspondence FOREIGN KEY (correspondence_id) REFERENCES correspondences(correspondence_id),
  CONSTRAINT fk_cir_org FOREIGN KEY (org_id) REFERENCES organizations(org_id),
  CONSTRAINT fk_cir_status FOREIGN KEY (cir_status_code) REFERENCES cir_status_codes(code),
  CONSTRAINT fk_cir_user FOREIGN KEY (created_by_user_id) REFERENCES users(user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='ตารางเก็บข้อมูลใบเวียนเอกสาร';

CREATE INDEX idx_cir_org    ON circulations(org_id);
CREATE INDEX idx_cir_status ON circulations(cir_status_code);
CREATE INDEX idx_cir_corr   ON circulations(correspondence_id);

-- 2.8 transmittal Table: ตารางสำหรับเก็บข้อมูลเฉพาะของ Transmittal (เป็นตารางลูกของ correspondences)
CREATE TABLE transmittals (
  -- ใช้ correspondence_id เป็นทั้ง Primary Key และ Foreign Key เพื่อสร้างความสัมพันธ์แบบ One-to-One
  correspondence_id   INT NOT NULL COMMENT 'ID ของเอกสาร (จากตาราง correspondences)',
  purpose   ENUM('FOR_APPROVAL', 'FOR_INFORMATION', 'FOR_CONSTRUCTION', 'AS_BUILT') NOT NULL DEFAULT 'FOR_INFORMATION' COMMENT 'วัตถุประสงค์ในการส่ง',
  remarks   TEXT COMMENT 'หมายเหตุเพิ่มเติม',
  
  PRIMARY KEY (correspondence_id),
  
  -- Foreign Key
  CONSTRAINT fk_transmittal_correspondence FOREIGN KEY (correspondence_id) REFERENCES correspondences(correspondence_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='ตารางเก็บข้อมูลเฉพาะของเอกสารนำส่ง (Transmittal)';

-- 2.9 correspondence_revisions Table: ตารางสำหรับเก็บประวัติการแก้ไขเอกสาร (Revision History)
CREATE TABLE correspondence_revisions (
  correspondence_revision_id INT AUTO_INCREMENT PRIMARY KEY COMMENT 'ID ของตาราง',
  correspondence_id          INT NOT NULL COMMENT 'Master correspondence ID',
  revision_number            INT NOT NULL COMMENT 'หมายเลข Revision', -- เปลี่ยนเป็น INT เพื่อง่ายต่อการเรียงลำดับ
  revision_label             VARCHAR(10) NULL COMMENT 'ตัวหนงสือ/ตัวเลข กำกับ Revision', -- e.g., A, A1, B10, 1, 2.1, 10.5 ; NULL for first issue if desired

  -- สถานะเฉพาะของ Revision นี้
  correspondence_status_id   INT NOT NULL COMMENT 'สถานะหนังสือ',
  is_current                 BOOLEAN NOT NULL DEFAULT FALSE COMMENT 'ระบุว่าเป็น Revision ปัจจุบัน (1=ใช่,0=ไม่ใช่)',
  
  -- ข้อมูลที่เปลี่ยนแปลงตาม Revision
  title                     VARCHAR(255) NOT NULL COMMENT 'เรื่อง',
  -- keywords              VARCHAR(255) NULL, ใช้ tag แทน
  issued_date                DATETIME NULL COMMENT 'วันที่ออกเอกสาร',
  received_date              DATETIME NULL COMMENT 'วันที่ลงรับเอกสาร',
  due_date                   DATETIME NULL COMMENT 'วันที่ต้องตอบเอกสาร',
 
  -- pdf_path              เก็บไฟล์ PDF ที่ ตาราง correspondence_attachments,

  details                    JSON NULL COMMENT 'เก็บข้อมูลเฉพาะของเอกสารแต่ละประเภทในรูปแบบ JSON',
  -- Audit
  created_at                 DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'วันที่สร้างเอกสาร',
  created_by                 INT NULL COMMENT 'ผู้สร้างเอกสาร',
  change_reason              TEXT NULL COMMENT 'เหตุผลที่แก้ไขเอกสาร',
  
  CONSTRAINT uq_master_revision_number UNIQUE (master_id, revision_number),
  CONSTRAINT uq_master_current UNIQUE (master_id, is_current), -- ใช้ partial unique index ได้ดีกว่า
  
  -- รูปแบบ (A-Z?) → ตัวอักษร A-Z ตามด้วยตัวเลข 0 ตัวหรือมากกว่า (เช่น A, A1, B10), ตัวเลขล้วน หรือ ตัวเลขทศนิยม (เช่น 1, 2.1, 10.5)
  CONSTRAINT chk_rev_format   CHECK (revision_label IS NULL OR revision_label REGEXP '^(A-Z?|[0-9]+(\\.[0-9]+)?)$'),
  CONSTRAINT fk_cr_correspondence FOREIGN KEY (correspondence_id)        REFERENCES correspondences(correspondence_id) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_cr_status         FOREIGN KEY (correspondence_status_id) REFERENCES correspondence_status(status_id) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_cr_created_by     FOREIGN KEY (created_by)               REFERENCES users(user_id) ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT = 'ตารางเก็บ Revision ของหนังสือ';

CREATE INDEX idx_cr_correspondence ON correspondence_revisions(correspondence_id);
CREATE INDEX idx_cr_revision_number ON correspondence_revisions(correspondence_id, revision_number);
CREATE INDEX idx_cr_is_current ON correspondence_revisions(correspondence_id, is_current);
CREATE INDEX idx_cr_status ON correspondence_revisions(correspondence_status_id);

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
  CONSTRAINT fk_ct_correspondence FOREIGN KEY (correspondence_id) REFERENCES correspondences(correspondence_id) ON DELETE CASCADE,
  CONSTRAINT fk_ct_tag FOREIGN KEY (tag_id) REFERENCES tags(tag_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='ตารางเชื่อมความสัมพันธ์ระหว่างเอกสารและ Tags';

-- ==========================================================
-- Level 1: ตารางที่มีความสัมพันธ์มากที่สุด (Junction Tables & Detail Tables)
-- ==========================================================
-- 1.1 global_default_roles Table: Global default roles (template defaults)
CREATE TABLE global_default_roles (
  id        TINYINT NOT NULL DEFAULT 1 COMMENT 'ID คงที่ = 1',
  role      ENUM('OWNER','DESIGNER','CONSULTANT') NOT NULL COMMENT 'บทบาท',
  position  TINYINT NOT NULL COMMENT 'ลำดับที่ในบทบาทนั้นๆ (1..n)',
  org_id    INT NOT NULL COMMENT 'ID ขององค์กรที่ถูกกำหนดเป็นค่าเริ่มต้น',
  PRIMARY KEY (id, role, position),
  UNIQUE KEY ux_gdr_unique_org_per_role (id, role, org_id),
  CONSTRAINT fk_gdr_org FOREIGN KEY (org_id) REFERENCES organizations(org_id) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='บทบาทเริ่มต้นทั่วโลกสำหรับองค์กร';

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
CREATE TABLE correspondence_status_transitions(
  type_id INT NOT NULL COMMENT 'ID ของประเภทหนังสือ',
  from_status_id INT NOT NULL COMMENT 'ID ของสถานะต้นทาง',
  to_status_id   INT NOT NULL COMMENT 'ID ของสถานะปลายทาง',
  PRIMARY KEY (type_id, from_status_id, to_status_id),
  CONSTRAINT fk_cst_type   FOREIGN KEY (type_id)        REFERENCES correspondence_types(type_id),
  CONSTRAINT fk_cst_from   FOREIGN KEY (from_status_id)  REFERENCES correspondence_status(status_id),
  CONSTRAINT fk_cst_to     FOREIGN KEY (to_status_id)    REFERENCES correspondence_status(status_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='ตารางสถานะที่อนุญาตให้เปลี่ยนแปลงได้ตามประเภทหนังสือ';

-- 1.3 circulation_assignees Table: ตารางสำหรับระบุผู้รับผิดชอบใน Circulation Sheet แต่ละใบ
CREATE TABLE circulation_assignees (
    assignee_id         INT NOT NULL AUTO_INCREMENT PRIMARY KEY COMMENT 'ID ของผู้รับผิดชอบ',
    cir_id              INT NOT NULL COMMENT 'ID ของใบเวียน (จากตาราง circulations)',
    user_id             INT NOT NULL COMMENT 'ID ของผู้ใช้ที่รับผิดชอบ',
    assignee_type       ENUM('MAIN', 'ACTION', 'INFO') NOT NULL COMMENT 'ประเภทผู้รับผิดชอบ (Main, Action, Info)',
    deadline            DATE NULL COMMENT 'กำหนดวันแล้วเสร็จ (สำหรับ Main/Action)', 
    action_taken        TEXT NULL COMMENT 'หมายเหตุการดำเนินการ',
    is_completed        BOOLEAN NOT NULL DEFAULT FALSE COMMENT 'สถานะการดำเนินการ (1=เสร็จสิ้น,0=ยังไม่เสร็จ)',
    completed_at        TIMESTAMP NULL COMMENT 'เวลาที่ดำเนินการเสร็จสิ้น',
   
    UNIQUE KEY ux_cir_user_type (cir_id, user_id, assignee_type),
    CONSTRAINT fk_ca_cir FOREIGN KEY (cir_id) REFERENCES circulations(cir_id) ON DELETE CASCADE,
    CONSTRAINT fk_ca_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='ตารางผู้รับผิดชอบในใบเวียนเอกสาร';

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
  CONSTRAINT fk_attach_correspondence FOREIGN KEY (correspondence_id) REFERENCES correspondences(correspondence_id) ON DELETE CASCADE,
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
   Mapping: Sub-Category ↔ Category (Many-to-Many ภายในโครงการ)
   - บังคับให้อยู่ project เดียวกัน ผ่าน composite FK
   - unique: (project_id, sub_cat_id, cat_id)
   =========================================================== */
CREATE TABLE contract_dwg_subcat_cat_map (
  project_id INT NOT NULL COMMENT 'ID ของโครงการ',
  sub_cat_id INT NOT NULL COMMENT 'ID ของหมวดหมู่ย่อย',
  cat_id     INT NOT NULL  COMMENT 'ID ของหมวดหมู่หลัก',

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='ตารางเชื่อมระหว่างหมวดหมู่ย่อยและหมวดหมู่หลักของแบบสัญญา';

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

CREATE INDEX idx_sdr_shop_drawing ON shop_drawing_revisions(shop_drawing_id);

-- สร้างตารางเชื่อมระหว่าง shop_drawing_revisions (ตารางลูก) กับ contract_drawings (Master)
-- เพื่อรองรับ Requirement 2.5.3 ที่ระบุว่า Shop Drawing "แต่ละ revision" สามารถอ้างอิง Contract Drawing ที่แตกต่างกันได้
CREATE TABLE shop_drawing_revision_contract_refs (
  shop_drawing_revision_id INT NOT NULL COMMENT 'ID ของ Shop Drawing Revision (FK -> shop_drawing_revisions.id)',
  contract_drawing_id      INT NOT NULL COMMENT 'ID ของ Contract Drawing ที่อ้างอิง (FK -> contract_drawings.condwg_id)',
  
  -- PRIMARY KEY (shop_drawing_revision_id, contract_drawing_id),
  
  -- เพิ่ม KEY เพื่อประสิทธิภาพในการค้นหา
  KEY idx_sdrcr_rev (shop_drawing_revision_id),
  KEY idx_sdrcr_cd (contract_drawing_id),

  -- Foreign Keys
  CONSTRAINT fk_sdrcr_revision 
    FOREIGN KEY (shop_drawing_revision_id) 
    REFERENCES shop_drawing_revisions(id) -- เชื่อมโยงกับตาราง Revision
    ON DELETE CASCADE
    ON UPDATE CASCADE,
    
  CONSTRAINT fk_sdrcr_contract_drawing
    FOREIGN KEY (contract_drawing_id) 
    REFERENCES contract_drawings(condwg_id) 
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='ตารางเชื่อมระหว่าง Shop Drawing Revisions กับ Contract Drawings';


-- 1.11 rfa_workflow_template_steps Table: ตารางสำหรับเก็บขั้นตอนของแต่ละแม่แบบ
CREATE TABLE rfa_workflow_template_steps (
  step_id       INT NOT NULL AUTO_INCREMENT PRIMARY KEY COMMENT 'ID ของขั้นตอน',
  template_id   INT NOT NULL COMMENT 'ID ของแม่แบบ',
  sequence      INT NOT NULL COMMENT 'ลำดับขั้นตอน',
  org_id        INT NOT NULL COMMENT 'ID องค์กรที่ต้องพิจารณาในขั้นตอนนี้',
  step_purpose  ENUM('FOR_APPROVAL', 'FOR_REVIEW', 'FOR_INFORMATION') NOT NULL DEFAULT 'FOR_APPROVAL' COMMENT 'วัตถุประสงค์ของขั้นตอนนี้ เช่น เพื่ออนุมัติ, เพื่อตรวจสอบ, หรือเพื่อรับทราบ',
  
  UNIQUE KEY ux_template_sequence (template_id, sequence),
  CONSTRAINT fk_wts_template FOREIGN KEY (template_id) REFERENCES rfa_workflow_templates(template_id) ON DELETE CASCADE,
  CONSTRAINT fk_wts_org FOREIGN KEY (org_id) REFERENCES organizations(org_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='ขั้นตอนในแม่แบบ Workflow การอนุมัติเอกสารทางเทคนิค';

-- 1.12 rfa_workflows Table: ตารางสำหรับติดตามสถานะ Workflow ของเอกสาร Technical (RFA)
CREATE TABLE rfa_workflows (
    workflow_id         INT NOT NULL AUTO_INCREMENT PRIMARY KEY COMMENT 'ID ของ Workflow',
    correspondence_id   INT NOT NULL COMMENT 'ID ของเอกสาร (FK -> correspondences)',
    sequence            INT NOT NULL COMMENT 'ลำดับขั้นตอน',
    org_id              INT NOT NULL COMMENT 'ID ขององค์กรที่ต้องพิจารณาในขั้นตอนนี้',
    status              ENUM('PENDING', 'APPROVED', 'REJECTED', 'APPROVED_WITH_COMMENTS', 'FORWARDED', 'RETURNED') NOT NULL DEFAULT 'PENDING' COMMENT 'สถานะของขั้นตอนนี้',
    comments            TEXT NULL COMMENT 'ความคิดเห็นหรือหมายเหตุจากองค์กร',
    processed_by_user_id INT NULL COMMENT 'ID ของผู้ใช้ที่ดำเนินการในขั้นตอนนี้',
    processed_at        TIMESTAMP NULL COMMENT 'เวลาที่ดำเนินการในขั้นตอนนี้',
    created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'วันที่สร้าง',

    UNIQUE KEY ux_workflow_corr_sequence (correspondence_id, sequence),
    CONSTRAINT fk_tdw_correspondence FOREIGN KEY (correspondence_id) REFERENCES correspondences(correspondence_id) ON DELETE CASCADE,
    CONSTRAINT fk_tdw_org FOREIGN KEY (org_id) REFERENCES organizations(org_id),
    CONSTRAINT fk_tdw_user FOREIGN KEY (processed_by_user_id) REFERENCES users(user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='ตารางติดตามสถานะ Workflow การอนุมัติเอกสารทางเทคนิค';

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
  CONSTRAINT fk_ti_transmittal FOREIGN KEY (transmittal_id) REFERENCES transmittals(correspondence_id) ON DELETE CASCADE,
  CONSTRAINT fk_ti_technical_doc FOREIGN KEY (technical_doc_id) REFERENCES rfas(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='รายการเอกสารที่แนบใน Transmittal';

-- 1.14 rfa_items Table: RFA ↔ rfas (RFA เป็นชนิดหนึ่งของ correspondences)
CREATE TABLE rfa_items (
  rfa_correspondence_id      INT NOT NULL,  -- FK to correspondences.correspondence_id (type=RFA)
  technical_doc_id INT NOT NULL UNIQUE, -- one techdoc appears in at most one RFA
  PRIMARY KEY (rfa_correspondence_id, technical_doc_id),
  CONSTRAINT fk_rfa_corr  FOREIGN KEY (rfa_correspondence_id)      REFERENCES correspondences(correspondence_id) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_rfa_tech  FOREIGN KEY (technical_doc_id) REFERENCES rfas(id)        ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE INDEX idx_rfaitems_rfa     ON rfa_items(rfa_correspondence_id);
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
  CONSTRAINT fk_crs_correspondence FOREIGN KEY (correspondence_id) REFERENCES correspondences(correspondence_id) ON DELETE CASCADE,
  -- หมายเหตุ: Script สำหรับสร้างตาราง correspondence_routing_templates ต้องถูกรันก่อนไฟล์นี้
  CONSTRAINT fk_crs_template FOREIGN KEY (template_id) REFERENCES correspondence_routing_templates(template_id) ON DELETE SET NULL,
  CONSTRAINT fk_crs_from_org FOREIGN KEY (from_org_id) REFERENCES organizations(org_id) ON DELETE CASCADE,
  CONSTRAINT fk_crs_to_org   FOREIGN KEY (to_org_id)   REFERENCES organizations(org_id) ON DELETE CASCADE,
  CONSTRAINT fk_crs_user     FOREIGN KEY (processed_by_user_id) REFERENCES users(user_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='ตารางติดตาม Workflow การส่งต่อเอกสารทั่วไป';

-- 1.17 Create a new, unified recipients table
CREATE TABLE correspondence_recipients (
  correspondence_id        INT NOT NULL COMMENT 'ID ของเอกสาร (FK -> correspondences)',
  recipient_org_id         INT NOT NULL COMMENT 'ID ขององค์กรผู้รับ (FK -> organizations)',
  recipient_type ENUM('TO', 'CC') NOT NULL COMMENT 'ประเภทผู้รับ (To=หลัก, CC=สำเนา)',
  
  PRIMARY KEY (correspondence_id, recipient_org_id, recipient_type),
  
  KEY idx_cr_corr (correspondence_id),
  KEY idx_cr_org (recipient_org_id),
  
  CONSTRAINT fk_cr_correspondence FOREIGN KEY (correspondence_id) REFERENCES correspondences(correspondence_id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_cr_organization FOREIGN KEY (recipient_org_id) REFERENCES organizations(org_id) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='ตารางเชื่อมผู้รับเอกสาร (รองรับ To/CC หลายองค์กร)';

-- 1.18 correspondence_references Table: cross references between correspondences
CREATE TABLE correspondence_references (
  src_correspondence_id INT NOT NULL COMMENT 'Source correspondence ID',
  tgt_correspondence_id INT NOT NULL, COMMENT 'Target correspondence ID',
  PRIMARY KEY (src_correspondence_id, tgt_correspondence_id),
  CONSTRAINT fk_ref_src FOREIGN KEY (src_correspondence_id) REFERENCES correspondences(correspondence_id) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_ref_tgt FOREIGN KEY (tgt_correspondence_id) REFERENCES correspondences(correspondence_id) ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='ตารางเชื่อมโยงความสัมพันธ์ระหว่างหนังสือ';

-- 1.19 project_parties Table: enforce <=1 contractor per project via generated column + unique index
CREATE TABLE project_parties (
  project_id INT NOT NULL COMMENT 'ID ของโครงการ',
  org_id     INT NOT NULL COMMENT,
  role       ENUM('OWNER','DESIGNER','CONSULTANT','CONTRACTOR','THIRD_PARTY') NOT NULL COMMENT 'บทบาทขององค์กรในโครงการ',
  is_contractor TINYINT(1) GENERATED ALWAYS AS (IF(role = 'CONTRACTOR', 1, NULL)) STORED COMMENT 'คอลัมน์สร้างเพื่อบังคับ unique contractor ต่อโครงการ',
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL COMMENT 'วันที่สร้าง',
  created_by INT NULL COMMENT 'ผู้สร้าง',
  updated_by INT NULL COMMENT 'ผู้แก้ไขล่าสุด',
  deleted_at DATETIME NULL COMMENT 'วันที่ลบ (สำหรับ soft delete)',
  PRIMARY KEY (project_id, org_id, role),
  UNIQUE KEY uq_project_parties_contractor (project_id, is_contractor),
  CONSTRAINT fk_pp_project FOREIGN KEY (project_id) REFERENCES projects(project_id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_pp_org FOREIGN KEY (org_id) REFERENCES organizations(org_id) ON DELETE RESTRICT ON UPDATE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='ตารางเชื่อมระหว่างโครงการและองค์กรที่มีบทบาทต่างๆ';

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
  project_id  INT NOT NULL COMMENT 'ID ของโครงการ',
  org_id      INT NOT NULL COMMENT 'ID ขององค์กร',
  PRIMARY KEY (contract_id, project_id, org_id),
  CONSTRAINT fk_cp_contract FOREIGN KEY (contract_id) REFERENCES contracts(contract_id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_cp_project FOREIGN KEY (project_id) REFERENCES projects(project_id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_cp_org FOREIGN KEY (org_id) REFERENCES organizations(org_id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='ตารางเชื่อมระหว่างสัญญา โครงการ และองค์กรที่เกี่ยวข้อง';

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
  permission_id INT NOT NULL COMMENT 'ID ของสิทธิ์',
  PRIMARY KEY (role_id, permission_id),
  CONSTRAINT fk_rp_role FOREIGN KEY (role_id) REFERENCES roles(role_id) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_rp_perm FOREIGN KEY (permission_id) REFERENCES permissions(permission_id) ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='ตารางเชื่อมระหว่างบทบาทและสิทธิ์ (RBAC)';

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='ตารางเชื่อมระหว่างผู้ใช้และบทบาท (RBAC)';

-- Initial SUPER_ADMIN
INSERT IGNORE INTO user_roles (user_id, role_id)
SELECT u.user_id, r.role_id
FROM users AS u
JOIN roles AS r ON r.role_code='SUPER_ADMIN'
WHERE u.username='superadmin';

-- 1.23 Table: User Project Roles Junction Table (RBAC) - For project-specific roles
CREATE TABLE user_project_roles (
  user_id    INT NOT NULL COMMENT 'ID ของผู้ใช้',
  project_id INT NOT NULL COMMENT 'ID ของโครงการ',
  role_id    INT NOT NULL COMMENT 'ID ของบทบาท',
  PRIMARY KEY (user_id, project_id, role_id),
  CONSTRAINT fk_upr_user    FOREIGN KEY (user_id)    REFERENCES users(user_id)      ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_upr_project FOREIGN KEY (project_id) REFERENCES projects(project_id) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_upr_role    FOREIGN KEY (role_id)    REFERENCES roles(role_id)      ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='ตารางเชื่อมระหว่างผู้ใช้ โครงการ และบทบาท (RBAC)';

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
  audit_id     BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT 'ID ของบันทึกการตรวจสอบ',
  user_id      INT NULL COMMENT 'ID ของผู้ใช้ที่ทำการกระทำ',
  action       VARCHAR(100) NOT NULL COMMENT 'Action ที่ทำ', -- e.g., login.success, rfa.create
  entity_type  VARCHAR(50) NULL COMMENT 'table/model name',
  entity_id    VARCHAR(50) NULL COMMENT 'primary key of the entity',
  details_json JSON NULL COMMENT 'รายละเอียดเพิ่มเติมในรูปแบบ JSON',
  ip_address   VARCHAR(45) NULL COMMENT 'IP Address ของผู้ใช้',
  user_agent   VARCHAR(255) NULL COMMENT 'User Agent ของผู้ใช้',
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL COMMENT 'เวลาที่กระทำ',
  CONSTRAINT fk_audit_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='ตารางบันทึกการตรวจสอบกิจกรรมของผู้ใช้';
CREATE INDEX idx_audit_created ON audit_logs(created_at);

-- ==========================================================
-- View Creation
-- ==========================================================
-- V.1. View สำหรับ Query ง่าย (รวม Master + Current Revision)
CREATE VIEW v_current_correspondences AS
SELECT 
  co.correspondence_id,
  co.correspondence_number,
  co.project_id,
  co.correspondence_type_id,
  cr.correspondence_revision_id,
  cr.revision_number,
  cr.revision_label,
  cr.correspondence_status_id,
  cr.title,
  cr.keywords,
  co.originator_id,
  co.recipient_id,
  cr.issued_date,
  -- cr.pdf_path,
  cr.details,
  co.created_at AS correspondence_created_at,
  cr.created_at AS revision_created_at,
  co.latest_revision_number
FROM correspondences co
INNER JOIN correspondence_revisions cr 
  ON co.current_revision_id = cr.correspondence_revision_id
WHERE co.deleted_at IS NULL;

-- ==========================================================
-- Procedure Creation
-- ==========================================================
-- P.1. Stored Procedure สำหรับสร้าง Revision ใหม่
DELIMITER $$

CREATE PROCEDURE sp_create_correspondence_revision(
  IN p_correspondence_id INT,
  IN p_title VARCHAR(255),
  IN p_originator_id INT,
  IN p_recipient_id INT,
  IN p_status_id INT,
  IN p_created_by INT,
  IN p_change_reason TEXT,
  OUT p_revision_id INT
)
BEGIN
  DECLARE v_next_revision_number INT;
  DECLARE v_revision_label VARCHAR(10);
  DECLARE v_correspondence_type_id INT;
  
  -- Get correspondence_type
  SELECT correspondence_type_id
  INTO v_correspondence_type_id
  FROM correspondences
  WHERE correspondence_id = p_correspondence_id;
  
  -- Get next revision number
  SELECT COALESCE(MAX(revision_number), 0) + 1 
  INTO v_next_revision_number
  FROM correspondence_revisions
  WHERE correspondence_id = p_correspondence_id;
  
  -- Generate label (A, B, C... or 0, 1, 2...)
  IF v_correspondence_type_id = 1 THEN
  IF v_next_revision_number = 0 THEN
      SET v_revision_label = 'A';
  ELSE
      SET v_revision_label = CHAR(65 + v_next_revision_number); -- B, C, D...
    END IF;
  ELSE
    SET v_revision_label = CHAR(v_next_revision_number);
  END IF;
  
  -- Mark all previous revisions as not current
  UPDATE correspondence_revisions 
  SET is_current = FALSE 
  WHERE correspondence_id = p_correspondence_id;
  
  -- Insert new revision
  INSERT INTO correspondence_revisions (
    correspondencer_id, revision_number, revision_label,
    correspondence_status_id, is_current,
    title, originator_id, recipient_id,
    created_by, change_reason
  ) VALUES (
    p_correspondence_id, v_next_revision_number, v_revision_label,
    p_status_id, TRUE,
    p_title, p_originator_id, p_recipient_id,
    p_created_by, p_change_reason
  );
  
  SET p_revision_id = LAST_INSERT_ID();
  
  -- Update master
  UPDATE correspondence_master
  SET 
    current_revision_id = p_revision_id,
    latest_revision_number = v_next_revision_number
  WHERE correspondence_id = p_correspondence_id;
END$$

DELIMITER ;

SET FOREIGN_KEY_CHECKS=1;