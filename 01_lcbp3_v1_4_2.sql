-- ==========================================================
-- DMS v1.4.0 Document Management System Database
-- Deploy Script Schema
-- Server: Container Station on QNAPQNAP TS-473A
-- Database service: MariaDB 10.11
-- database web ui: phpmyadmin 5-apache
-- database deelopment ui: DBeaver
-- backend sevice: NestJS
-- frontend sevice: next.js
-- reverse proxy: jc21/nginx-proxy-manager:latest
-- cron service: n8n
-- DMS v1.4.2 Improvements
-- Update: revise fron v1.4.1 Gemini)
-- ==========================================================
SET NAMES utf8mb4;
SET time_zone = '+07:00';
-- ปิดการตรวจสอบ Foreign Key ชั่วคราวเพื่อให้สามารถลบตารางได้ทั้งหมด
SET FOREIGN_KEY_CHECKS = 0;
DROP VIEW IF EXISTS v_document_statistics;
DROP VIEW IF EXISTS v_documents_with_attachments;
DROP VIEW IF EXISTS v_user_all_permissions;
DROP VIEW IF EXISTS v_audit_log_details;
DROP VIEW IF EXISTS v_user_tasks;
DROP VIEW IF EXISTS v_contract_parties_all;
DROP VIEW IF EXISTS v_current_rfas;
DROP VIEW IF EXISTS v_current_correspondences;
DROP PROCEDURE IF EXISTS sp_get_next_document_number;
-- 🗑️ DROP TABLE SCRIPT: LCBP3-DMS v1.4.2
-- คำเตือน: ข้อมูลทั้งหมดจะหายไป กรุณา Backup ก่อนรันบน Production
SET FOREIGN_KEY_CHECKS = 0;
-- ============================================================
-- ส่วนที่ 1: ตาราง System, Logs & Preferences (ตารางปลายทาง/ส่วนเสริม)
-- ============================================================
DROP TABLE IF EXISTS backup_logs;
DROP TABLE IF EXISTS search_indices;
DROP TABLE IF EXISTS notifications;
DROP TABLE IF EXISTS audit_logs;
-- [NEW v1.4.2] ตารางการตั้งค่าส่วนตัวของผู้ใช้ (FK -> users)
DROP TABLE IF EXISTS user_preferencesว -- [NEW v1.4.2] ตารางเก็บ Schema สำหรับ Validate JSON (Stand-alone)
DROP TABLE IF EXISTS json_schemas;
-- ============================================================
-- ส่วนที่ 2: ตาราง Junction (เชื่อมโยงข้อมูล M:N)
-- ============================================================
DROP TABLE IF EXISTS correspondence_tags;
DROP TABLE IF EXISTS shop_drawing_revision_contract_refs;
DROP TABLE IF EXISTS contract_drawing_subcat_cat_maps;
-- ============================================================
-- ส่วนที่ 3: ตารางไฟล์แนบและการเชื่อมโยง (Attachments)
-- ============================================================
DROP TABLE IF EXISTS contract_drawing_attachments;
DROP TABLE IF EXISTS circulation_attachments;
DROP TABLE IF EXISTS shop_drawing_revision_attachments;
DROP TABLE IF EXISTS correspondence_attachments;
DROP TABLE IF EXISTS attachments;
-- ตารางหลักเก็บ path ไฟล์
-- ============================================================
-- ส่วนที่ 4: ตาราง Workflow & Routing (Process Logic)
-- ============================================================
-- Circulation Workflow
DROP TABLE IF EXISTS circulation_routings;
DROP TABLE IF EXISTS circulation_template_assignees;
DROP TABLE IF EXISTS circulation_templates;
-- RFA Workflow
DROP TABLE IF EXISTS rfa_workflows;
DROP TABLE IF EXISTS rfa_workflow_template_steps;
DROP TABLE IF EXISTS rfa_workflow_templates;
-- Correspondence Workflow
DROP TABLE IF EXISTS correspondence_routings;
DROP TABLE IF EXISTS correspondence_routing_template_steps;
DROP TABLE IF EXISTS correspondence_status_transitions;
DROP TABLE IF EXISTS correspondence_routing_templates;
-- ============================================================
-- ส่วนที่ 5: ตาราง Mapping สิทธิ์และโครงสร้าง (Access Control)
-- ============================================================
DROP TABLE IF EXISTS role_permissions;
DROP TABLE IF EXISTS user_assignments;
DROP TABLE IF EXISTS contract_organizations;
DROP TABLE IF EXISTS project_organizations;
-- ============================================================
-- ส่วนที่ 6: ตารางรายละเอียดของเอกสาร (Revisions & Items)
-- ============================================================
DROP TABLE IF EXISTS transmittal_items;
DROP TABLE IF EXISTS shop_drawing_revisions;
DROP TABLE IF EXISTS rfa_items;
DROP TABLE IF EXISTS rfa_revisions;
DROP TABLE IF EXISTS correspondence_references;
DROP TABLE IF EXISTS correspondence_recipients;
DROP TABLE IF EXISTS correspondence_revisions;
-- [Modified v1.4.2] มี Virtual Columns
-- ============================================================
-- ส่วนที่ 7: ตารางเอกสารหลัก (Core Documents)
-- ============================================================
DROP TABLE IF EXISTS circulations;
DROP TABLE IF EXISTS transmittals;
DROP TABLE IF EXISTS contract_drawings;
DROP TABLE IF EXISTS shop_drawings;
DROP TABLE IF EXISTS rfas;
DROP TABLE IF EXISTS correspondences;
-- ============================================================
-- ส่วนที่ 8: ตารางหมวดหมู่และข้อมูลหลัก (Master Data)
-- ============================================================
DROP TABLE IF EXISTS shop_drawing_sub_categories;
DROP TABLE IF EXISTS shop_drawing_main_categories;
DROP TABLE IF EXISTS contract_drawing_sub_cats;
DROP TABLE IF EXISTS contract_drawing_cats;
DROP TABLE IF EXISTS contract_drawing_volumes;
DROP TABLE IF EXISTS circulation_status_codes;
DROP TABLE IF EXISTS rfa_approve_codes;
DROP TABLE IF EXISTS rfa_status_codes;
DROP TABLE IF EXISTS rfa_types;
DROP TABLE IF EXISTS correspondence_status;
DROP TABLE IF EXISTS correspondence_types;
DROP TABLE IF EXISTS document_number_counters;
-- [Modified v1.4.2] มี version column
DROP TABLE IF EXISTS document_number_formats;
DROP TABLE IF EXISTS tags;
-- ============================================================
-- ส่วนที่ 9: ตารางผู้ใช้ บทบาท และโครงสร้างรากฐาน (Root Tables)
-- ============================================================
DROP TABLE IF EXISTS organization_roles;
DROP TABLE IF EXISTS roles;
DROP TABLE IF EXISTS permissions;
DROP TABLE IF EXISTS contracts;
DROP TABLE IF EXISTS projects;
DROP TABLE IF EXISTS users;
-- Referenced by user_preferences, audit_logs, etc.
DROP TABLE IF EXISTS organizations;
-- Referenced by users, projects, etc.
-- =====================================================
-- 1. 🏢 Core & Master Data (องค์กร, โครงการ, สัญญา)
-- =====================================================
-- ตาราง Master เก็บประเภทบทบาทขององค์กร
CREATE TABLE organization_roles (
    id INT PRIMARY KEY AUTO_INCREMENT COMMENT 'ID ของตาราง',
    role_name VARCHAR(20) NOT NULL UNIQUE COMMENT 'ชื่อบทบาท (OWNER, DESIGNER, CONSULTANT, CONTRACTOR, THIRD PARTY)'
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci COMMENT = 'ตาราง Master เก็บประเภทบทบาทขององค์กร';
-- ตาราง Master เก็บข้อมูลองค์กรทั้งหมดที่เกี่ยวข้องในระบบ
CREATE TABLE organizations (
    id INT PRIMARY KEY AUTO_INCREMENT COMMENT 'ID ของตาราง',
    organization_code VARCHAR(20) NOT NULL UNIQUE COMMENT 'รหัสองค์กร',
    organization_name VARCHAR(255) NOT NULL COMMENT 'ชื่อองค์กร',
    -- role_id INT COMMENT 'บทบาทขององค์กร',
    is_active BOOLEAN DEFAULT TRUE COMMENT 'สถานะการใช้งาน',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'วันที่สร้าง',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'วันที่แก้ไขล่าสุด' -- FOREIGN KEY (role_id) REFERENCES organization_roles(id) ON DELETE SET NULL
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci COMMENT = 'ตาราง Master เก็บข้อมูลองค์กรทั้งหมดที่เกี่ยวข้องในระบบ';
-- Seed organization
INSERT INTO organizations (id, organization_code, organization_name)
VALUES (1, 'กทท.', 'การท่าเรือแห่งประเทศไทย'),
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
-- ตาราง Master เก็บข้อมูลโครงการ
CREATE TABLE projects (
    id INT PRIMARY KEY AUTO_INCREMENT COMMENT 'ID ของตาราง',
    project_code VARCHAR(50) NOT NULL UNIQUE COMMENT 'รหัสโครงการ',
    project_name VARCHAR(255) NOT NULL COMMENT 'ชื่อโครงการ',
    -- parent_project_id INT COMMENT 'รหัสโครงการหลัก (ถ้ามี)',
    -- contractor_organization_id INT COMMENT 'รหัสองค์กรผู้รับเหมา (ถ้ามี)',
    is_active TINYINT(1) DEFAULT 1 COMMENT 'สถานะการใช้งาน' -- FOREIGN KEY (parent_project_id) REFERENCES projects(id) ON DELETE SET NULL,
    -- FOREIGN KEY (contractor_organization_id) REFERENCES organizations(id) ON DELETE SET NULL
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci COMMENT = 'ตาราง Master เก็บข้อมูลโครงการ';
INSERT INTO projects (project_code, project_name)
VALUES (
        'LCBP3',
        'โครงการพัฒนาท่าเรือแหลมฉบัง ระยะที่ 3 (ส่วนที่ 1-4)'
    ),
    (
        'LCBP3C1',
        'โครงการพัฒนาท่าเรือแหลมฉบัง ระยะที่ 3 (ส่วนที่ 1) งานก่อสร้างงานทางทะเล'
    ),
    (
        'LCBP3C2',
        'โครงการพัฒนาท่าเรือแหลมฉบัง ระยะที่ 3 (ส่วนที่ 2) งานก่อสร้างอาคาร ท่าเทียบเรือ ระบบถนน และระบบสาธารณูปโภค'
    ),
    (
        'LCBP3C3',
        'โครงการพัฒนาท่าเรือแหลมฉบัง ระยะที่ 3 (ส่วนที่ 3) งานก่อสร้าง'
    ),
    (
        'LCBP3C4',
        'โครงการพัฒนาท่าเรือแหลมฉบัง ระยะที่ 3 (ส่วนที่ 4) งานก่อสร้าง'
    );
-- ตาราง Master เก็บข้อมูลสัญญา
CREATE TABLE contracts (
    id INT PRIMARY KEY AUTO_INCREMENT COMMENT 'ID ของตาราง',
    project_id INT NOT NULL,
    contract_code VARCHAR(50) NOT NULL UNIQUE COMMENT 'รหัสสัญญา',
    contract_name VARCHAR(255) NOT NULL COMMENT 'ชื่อสัญญา',
    description TEXT COMMENT 'คำอธิบายสัญญา',
    start_date DATE COMMENT 'วันที่เริ่มสัญญา',
    end_date DATE COMMENT 'วันที่สิ้นสุดสัญญา',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'วันที่สร้าง',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'วันที่แก้ไขล่าสุด',
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci COMMENT = 'ตาราง Master เก็บข้อมูลสัญญา';
-- ใช้ Subquery เพื่อดึง project_id มาเชื่อมโยง ทำให้ไม่ต้องมานั่งจัดการ ID ด้วยตัวเอง
INSERT INTO contracts (
        contract_code,
        contract_name,
        project_id,
        is_active
    )
VALUES (
        'DSLCBP3',
        'งานจ้างที่ปรีกษาออกแบบ โครงการพัฒนาท่าเรือแหลมฉบัง ระยะที่ 3 (ส่วนที่ 1-4)',
        (
            SELECT id
            FROM projects
            WHERE project_code = 'LCBP3'
        ),
        TRUE
    ),
    (
        'PSLCBP3',
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
            WHERE project_code = 'LCBP3C1'
        ),
        TRUE
    ),
    (
        'LCBP3-C2',
        'งานก่อสร้าง โครงการพัฒนาท่าเรือแหลมฉบัง ระยะที่ 3 (ส่วนที่ 2) งานก่อสร้างอาคาร ท่าเทียบเรือ ระบบถนน และระบบสาธารณูปโภค',
        (
            SELECT id
            FROM projects
            WHERE project_code = 'LCBP3C2'
        ),
        TRUE
    ),
    (
        'LCBP3-C3',
        'งานก่อสร้าง โครงการพัฒนาท่าเรือแหลมฉบัง ระยะที่ 3 (ส่วนที่ 3) งานก่อสร้าง',
        (
            SELECT id
            FROM projects
            WHERE project_code = 'LCBP3C3'
        ),
        TRUE
    ),
    (
        'LCBP3-C4',
        'งานก่อสร้าง โครงการพัฒนาท่าเรือแหลมฉบัง ระยะที่ 3 (ส่วนที่ 4) งานก่อสร้าง',
        (
            SELECT id
            FROM projects
            WHERE project_code = 'LCBP3C4'
        ),
        TRUE
    ),
    (
        'ENLCBP3',
        'งานจ้างเหมาตรวจสอบผลกระทบสิ่งแวดล้อมนะหว่างงานก่อสร้างโครงการพัฒนาท่าเรือแหลมฉบัง ระยะที่ 3 (ส่วนที่ 1-4)',
        (
            SELECT id
            FROM projects
            WHERE project_code = 'LCBP3'
        ),
        TRUE
    );
-- =====================================================
-- 2. 👥 Users & RBAC (ผู้ใช้, สิทธิ์, บทบาท)
-- =====================================================
-- ตาราง Master เก็บข้อมูลผู้ใช้งาน (User)
CREATE TABLE users (
    user_id INT PRIMARY KEY AUTO_INCREMENT COMMENT 'ID ของตาราง',
    username VARCHAR(50) NOT NULL UNIQUE COMMENT 'ชื่อผู้ใช้งาน',
    password_hash VARCHAR(255) NOT NULL COMMENT 'รหัสผ่าน (Hashed)',
    first_name VARCHAR(50) COMMENT 'ชื่อจริง',
    last_name VARCHAR(50) COMMENT 'นามสกุล',
    email VARCHAR(100) NOT NULL UNIQUE COMMENT 'อีเมล',
    line_id VARCHAR(100) COMMENT 'LINE ID',
    primary_organization_id INT COMMENT 'สังกัดองค์กร',
    is_active TINYINT(1) DEFAULT 1 COMMENT 'สถานะการใช้งาน',
    failed_attempts INT DEFAULT 0 COMMENT 'จำนวนครั้งที่ล็อกอินล้มเหลว',
    locked_until DATETIME COMMENT 'ล็อกอินไม่ได้จนถึงเวลา',
    last_login_at TIMESTAMP NULL COMMENT 'วันที่และเวลาที่ล็อกอินล่าสุด',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'วันที่สร้าง',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'วันที่แก้ไขล่าสุด',
    FOREIGN KEY (primary_organization_id) REFERENCES organizations(id) ON DELETE
    SET NULL
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci COMMENT = 'ตาราง Master เก็บข้อมูลผู้ใช้งาน (User)';
-- Initial SUPER_ADMIN user
INSERT INTO users (username, password_hash, email, is_active)
VALUES (
        'superadmin',
        '$2y$10$0kjBMxWq7E4G7P.dc8r5i.cjiPBiup553AsFpDfxUt31gKg9h/udq',
        'superadmin@example.com',
        1
    ) ON DUPLICATE KEY
UPDATE email =
VALUES(email),
    is_active =
VALUES(is_active);
-- Create editor01 user
INSERT IGNORE INTO users (username, password_hash, email, is_active)
VALUES (
        'editor01',
        '$2y$10$0kjBMxWq7E4G7P.dc8r5i.cjiPBiup553AsFpDfxUt31gKg9h/udq',
        'editor01@example.com',
        1
    );
-- Create viewer01 user (password hash placeholder, must change later)
INSERT IGNORE INTO users (username, password_hash, email, is_active)
VALUES (
        'viewer01',
        '$2y$10$0kjBMxWq7E4G7P.dc8r5i.cjiPBiup553AsFpDfxUt31gKg9h/udq',
        'viewer01@example.com',
        1
    );
-- ตาราง Master เก็บ "บทบาท" ของผู้ใช้ในระบบ
CREATE TABLE roles (
    role_id INT PRIMARY KEY AUTO_INCREMENT COMMENT 'ID ของตาราง',
    -- role_code VARCHAR(50) NOT NULL UNIQUE COMMENT 'รหัสบทบาท (เช่น SUPER_ADMIN, ADMIN, EDITOR, VIEWER)',
    role_name VARCHAR(100) NOT NULL COMMENT 'ชื่อบทบาท',
    scope ENUM('Global', 'Organization', 'Project', 'Contract') NOT NULL,
    -- ขอบเขตของบทบาท (จากข้อ 4.3)
    description TEXT COMMENT 'คำอธิบายบทบาท',
    is_system BOOLEAN DEFAULT FALSE COMMENT '(1 = บทบาทของระบบ ลบไม่ได้)'
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci COMMENT = 'ตาราง Master เก็บ "บทบาท" ของผู้ใช้ในระบบ';
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
    );
-- 2. Org Admin (Organization)
INSERT INTO roles (role_id, role_name, scope, description)
VALUES (
        2,
        'Org Admin',
        'Organization',
        'ผู้ดูแลองค์กร: จัดการผู้ใช้ในองค์กร, จัดการบทบาท/สิทธิ์ภายในองค์กร, และดูรายงานขององค์กร'
    );
-- 3. Document Control (Organization)
INSERT INTO roles (role_id, role_name, scope, description)
VALUES (
        3,
        'Document Control',
        'Organization',
        'ควบคุมเอกสารขององค์กร: เพิ่ม/แก้ไข/ลบเอกสาร, และกำหนดสิทธิ์เอกสารภายในองค์กร'
    );
-- 4. Editor (Organization)
INSERT INTO roles (role_id, role_name, scope, description)
VALUES (
        4,
        'Editor',
        'Organization',
        'ผู้แก้ไขเอกสารขององค์กร: เพิ่ม/แก้ไขเอกสารที่ได้รับมอบหมาย'
    );
-- 5. Viewer (Organization)
INSERT INTO roles (role_id, role_name, scope, description)
VALUES (
        5,
        'Viewer',
        'Organization',
        'ผู้ดูเอกสารขององค์กร: ดูเอกสารที่มีสิทธิ์เข้าถึงเท่านั้น'
    );
-- 6. Project Manager (Project)
INSERT INTO roles (role_id, role_name, scope, description)
VALUES (
        6,
        'Project Manager',
        'Project',
        'ผู้จัดการโครงการ: จัดการสมาชิกในโครงการ, สร้าง/จัดการสัญญาในโครงการ, และดูรายงานโครงการ'
    );
-- 7. Contract Admin (Contract)
INSERT INTO roles (role_id, role_name, scope, description)
VALUES (
        7,
        'Contract Admin',
        'Contract',
        'ผู้ดูแลสัญญา: จัดการสมาชิกในสัญญา, สร้าง/จัดการข้อมูลหลักเฉพาะสัญญา, และอนุมัติเอกสารในสัญญา'
    );
-- ตาราง Master เก็บ "สิทธิ์" (Permission) หรือ "การกระทำ" ทั้งหมดในระบบ
CREATE TABLE permissions (
    permission_id INT PRIMARY KEY AUTO_INCREMENT COMMENT 'ID ของตาราง',
    permission_name VARCHAR(100) NOT NULL UNIQUE COMMENT 'รหัสสิทธิ์ (เช่น rfas.create, rfas.view)',
    description TEXT COMMENT 'คำอธิบายสิทธิ์',
    module VARCHAR(50) COMMENT 'โมดูลที่เกี่ยวข้อง',
    scope_level ENUM('GLOBAL', 'ORG', 'PROJECT') COMMENT 'ระดับขอบเขตของสิทธิ์',
    is_active TINYINT(1) DEFAULT 1 COMMENT 'สถานะการใช้งาน'
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci COMMENT = 'ตาราง Master เก็บ "สิทธิ์" (Permission) หรือ "การกระทำ" ทั้งหมดในระบบ';
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
    (20, 'user.delete', 'ลบ/ปิดการใช้งานผู้ใช้'),
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
        'จัดการสมาชิกในโครงการ (เชิญ/ถอดสมาชิก)'
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
        'สร้างเอกสารในสถานะฉบับร่าง (Draft)'
    ),
    (30, 'document.submit', 'ส่งเอกสาร (Submitted)'),
    (31, 'document.view', 'ดูเอกสาร'),
    (32, 'document.edit', 'แก้ไขเอกสาร (ทั่วไป)'),
    (
        33,
        'document.admin_edit',
        'แก้ไข/ถอน/ยกเลิกเอกสารที่ส่งแล้ว (Admin Power)'
    ),
    (34, 'document.delete', 'ลบเอกสาร'),
    (
        35,
        'document.attach',
        'จัดการไฟล์แนบ (อัปโหลด/ลบ)'
    ),
    -- สิทธิ์เฉพาะสำหรับ Correspondence
    (
        36,
        'correspondence.create',
        'สร้างเอกสารโต้ตอบ (Correspondence)'
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
        'สร้าง/แก้ไขข้อมูลแบบ (Shop/Contract Drawing)'
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
        'ตอบกลับใบเวียน (Main/Action)'
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
        'สร้างรายงานสรุป (รายวัน/สัปดาห์/เดือน/ปี)'
    );
-- ตารางเชื่อมระหว่าง roles และ permissions (M:N)
CREATE TABLE role_permissions (
    role_id INT COMMENT 'ID ของบทบาท',
    permission_id INT COMMENT 'ID ของสิทธิ์',
    PRIMARY KEY (role_id, permission_id),
    FOREIGN KEY (role_id) REFERENCES roles(role_id) ON DELETE CASCADE,
    FOREIGN KEY (permission_id) REFERENCES permissions(permission_id) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci COMMENT = 'ตารางเชื่อมระหว่าง roles และ permissions (M:N)';
-- ==========================================================
-- Seed Role-Permissions Mapping (จับคู่สิทธิ์เริ่มต้น)
-- ==========================================================
-- Seed data for the 'role_permissions' table
-- This table links roles to their specific permissions.
-- NOTE: This assumes the role_id and permission_id from the previous seed data files.
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
-- search.advanced
-- ตารางเชื่อมผู้ใช้ (users)
CREATE TABLE user_assignments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    role_id INT NOT NULL,
    -- คอลัมน์สำหรับกำหนดขอบเขต (จะใช้เพียงอันเดียวต่อแถว)
    organization_id INT NULL,
    project_id INT NULL,
    contract_id INT NULL,
    assigned_by_user_id INT,
    -- ผู้ที่มอบหมายบทบาทนี้
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (role_id) REFERENCES roles(role_id) ON DELETE CASCADE,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (contract_id) REFERENCES contracts(id) ON DELETE CASCADE,
    FOREIGN KEY (assigned_by_user_id) REFERENCES users(user_id),
    -- Constraint เพื่อให้แน่ใจว่ามีเพียงขอบเขตเดียวที่ถูกกำหนดในแต่ละแถว
    CONSTRAINT chk_scope CHECK (
        (
            organization_id IS NOT NULL
            AND project_id IS NULL
            AND contract_id IS NULL
        )
        OR (
            organization_id IS NULL
            AND project_id IS NOT NULL
            AND contract_id IS NULL
        )
        OR (
            organization_id IS NULL
            AND project_id IS NULL
            AND contract_id IS NOT NULL
        )
        OR (
            organization_id IS NULL
            AND project_id IS NULL
            AND contract_id IS NULL
        ) -- สำหรับ Global scope
    )
);
CREATE TABLE project_organizations (
    project_id INT NOT NULL,
    organization_id INT NOT NULL,
    PRIMARY KEY (project_id, organization_id),
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);
CREATE TABLE contract_organizations (
    contract_id INT NOT NULL,
    organization_id INT NOT NULL,
    role_in_contract VARCHAR(100),
    -- เช่น 'Owner', 'Designer', 'Consultant', 'Contractor'
    PRIMARY KEY (contract_id, organization_id),
    FOREIGN KEY (contract_id) REFERENCES contracts(id) ON DELETE CASCADE,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);
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
        WHERE project_code = 'LCBP3C1'
    ),
    id
FROM organizations
WHERE organization_code IN ('กทท.', 'สคฉ.3', 'สคฉ.3-02', 'คคง.', 'ผรม.1');
-- ทำเช่นเดียวกันสำหรับโครงการอื่นๆ (ตัวอย่าง)
INSERT INTO project_organizations (project_id, organization_id)
SELECT (
        SELECT id
        FROM projects
        WHERE project_code = 'LCBP3C2'
    ),
    id
FROM organizations
WHERE organization_code IN ('กทท.', 'สคฉ.3', 'สคฉ.3-03', 'คคง.', 'ผรม.2');
-- =====================================================
-- == 5. การเชื่อมโยงสัญญากับองค์กร (contract_organizations) ==
-- =====================================================
-- สัญญาที่ปรึกษาออกแบบ (DSLCBP3)
INSERT INTO contract_organizations (contract_id, organization_id, role_in_contract)
VALUES (
        (
            SELECT id
            FROM contracts
            WHERE contract_code = 'DSLCBP3'
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
            WHERE contract_code = 'DSLCBP3'
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
            WHERE contract_code = 'PSLCBP3'
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
            WHERE contract_code = 'PSLCBP3'
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
-- สัญญาตรวจสอบสิ่งแวดล้อม (ENLCBP3)
INSERT INTO contract_organizations (contract_id, organization_id, role_in_contract)
VALUES (
        (
            SELECT id
            FROM contracts
            WHERE contract_code = 'ENLCBP3'
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
            WHERE contract_code = 'ENLCBP3'
        ),
        (
            SELECT id
            FROM organizations
            WHERE organization_code = 'EN'
        ),
        'Consultant'
    );
-- =====================================================
-- 3. ✉️ Correspondences (เอกสารหลัก, Revisions)
-- =====================================================
-- ตาราง Master เก็บประเภทเอกสารโต้ตอบ
CREATE TABLE correspondence_types (
    id INT PRIMARY KEY AUTO_INCREMENT COMMENT 'ID ของตาราง',
    type_code VARCHAR(50) NOT NULL UNIQUE COMMENT 'รหัสประเภท (เช่น RFA, RFI)',
    type_name VARCHAR(255) NOT NULL COMMENT 'ชื่อประเภท',
    sort_order INT DEFAULT 0 COMMENT 'ลำดับการแสดงผล',
    is_active TINYINT(1) DEFAULT 1 COMMENT 'สถานะการใช้งาน'
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci COMMENT = 'ตาราง Master เก็บประเภทเอกสารโต้ตอบ';
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
    (
        'OTHER',
        'Other',
        10,
        1
    );
-- ตาราง Master เก็บสถานะของเอกสาร
CREATE TABLE correspondence_status (
    id INT PRIMARY KEY AUTO_INCREMENT COMMENT 'ID ของตาราง',
    status_code VARCHAR(50) NOT NULL UNIQUE COMMENT 'รหัสสถานะหนังสือ (เช่น DRAFT, SUBOWN)',
    status_name VARCHAR(255) NOT NULL COMMENT 'ชื่อสถานะหนังสือ',
    sort_order INT DEFAULT 0 COMMENT 'ลำดับการแสดงผล',
    is_active TINYINT(1) DEFAULT 1 COMMENT 'สถานะการใช้งาน'
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci COMMENT = 'ตาราง Master เก็บสถานะของเอกสาร';
INSERT INTO correspondence_status (status_code, status_name, sort_order, is_active)
VALUES ('DRAFT', 'Draft', 10, 1),
    ('SUBOWN', 'Submitted to Owner', 21, 1),
    ('SUBDSN', 'Submitted to Designer', 22, 1),
    ('SUBCSC', 'Submitted to CSC', 23, 1),
    ('SUBCON', 'Submitted to Contractor', 24, 1),
    ('SUBOTH', 'Submitted to Others', 25, 1),
    ('REPOWN', 'Reply by Owner', 31, 1),
    ('REPDSN', 'Reply by  Designer', 32, 1),
    ('REPCSC', 'Reply by  CSC', 33, 1),
    ('REPCON', 'Reply by  Contractor', 34, 1),
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
-- ตาราง "แม่" ของเอกสารโต้ตอบ เก็บข้อมูลที่ไม่เปลี่ยนตาม Revision
CREATE TABLE correspondences (
    id INT PRIMARY KEY AUTO_INCREMENT COMMENT 'ID ของตาราง (นี่คือ "Master ID" ที่ใช้เชื่อมโยง)',
    correspondence_number VARCHAR(100) NOT NULL COMMENT 'เลขที่เอกสาร (สร้างจาก DocumentNumberingModule)',
    correspondence_type_id INT NOT NULL COMMENT 'ประเภทเอกสาร',
    is_internal_communication TINYINT(1) DEFAULT 0 COMMENT '(1 = ภายใน, 0 = ภายนอก)',
    project_id INT NOT NULL COMMENT 'อยู่ในโครงการ',
    originator_id INT COMMENT 'องค์กรผู้ส่ง',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT 'วันที่สร้าง',
    created_by INT COMMENT 'ผู้สร้าง',
    deleted_at DATETIME NULL COMMENT 'สำหรับ Soft Delete',
    FOREIGN KEY (correspondence_type_id) REFERENCES correspondence_types(id) ON DELETE RESTRICT,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (originator_id) REFERENCES organizations(id) ON DELETE
    SET NULL,
        FOREIGN KEY (created_by) REFERENCES users(user_id) ON DELETE
    SET NULL,
        UNIQUE KEY uq_corr_no_per_project (project_id, correspondence_number)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci COMMENT = 'ตาราง "แม่" ของเอกสารโต้ตอบ เก็บข้อมูลที่ไม่เปลี่ยนตาม Revision';
-- ตาราง "ลูก" เก็บประวัติการแก้ไข (Revisions) ของ correspondences (1:N)
CREATE TABLE correspondence_revisions (
    id INT PRIMARY KEY AUTO_INCREMENT COMMENT 'ID ของ Revision',
    correspondence_id INT NOT NULL COMMENT 'Master ID',
    revision_number INT NOT NULL COMMENT 'หมายเลข Revision (0, 1, 2...)',
    revision_label VARCHAR(10) COMMENT 'Revision ที่แสดง (เช่น A, B, 1.1)',
    is_current BOOLEAN DEFAULT FALSE COMMENT '(1 = Revision ปัจจุบัน)',
    correspondence_status_id INT NOT NULL COMMENT 'สถานะของ Revision นี้',
    title VARCHAR(255) NOT NULL COMMENT 'เรื่อง',
    document_date DATE COMMENT 'วันที่ในเอกสาร',
    issued_date DATETIME COMMENT 'วันที่ออกเอกสาร',
    received_date DATETIME COMMENT 'วันที่ลงรับเอกสาร',
    due_date DATETIME COMMENT 'วันที่ครบกำหนด',
    description TEXT COMMENT 'คำอธิบายการแก้ไขใน Revision นี้',
    details JSON COMMENT 'ข้อมูลเฉพาะ (เช่น RFI details)',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT 'วันที่สร้างเอกสาร',
    created_by INT COMMENT 'ผู้สร้าง',
    updated_by INT COMMENT 'ผู้แก้ไขล่าสุด',
    FOREIGN KEY (correspondence_id) REFERENCES correspondences(id) ON DELETE CASCADE,
    FOREIGN KEY (correspondence_status_id) REFERENCES correspondence_status(id) ON DELETE RESTRICT,
    FOREIGN KEY (created_by) REFERENCES users(user_id) ON DELETE
    SET NULL,
        FOREIGN KEY (updated_by) REFERENCES users(user_id) ON DELETE
    SET NULL,
        UNIQUE KEY uq_master_revision_number (correspondence_id, revision_number),
        UNIQUE KEY uq_master_current (correspondence_id, is_current)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci COMMENT = 'ตาราง "ลูก" เก็บประวัติการแก้ไข (Revisions) ของ correspondences (1:N)';
-- ตารางเชื่อมผู้รับ (TO/CC) สำหรับเอกสารแต่ละฉบับ (M:N)
CREATE TABLE correspondence_recipients (
    correspondence_id INT COMMENT 'ID ของเอกสาร',
    recipient_organization_id INT COMMENT 'ID องค์กรผู้รับ',
    recipient_type ENUM('TO', 'CC') COMMENT 'ประเภทผู้รับ (TO หรือ CC)',
    PRIMARY KEY (
        correspondence_id,
        recipient_organization_id,
        recipient_type
    ),
    FOREIGN KEY (correspondence_id) REFERENCES correspondence_revisions(correspondence_id) ON DELETE CASCADE,
    FOREIGN KEY (recipient_organization_id) REFERENCES organizations(id) ON DELETE RESTRICT
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci COMMENT = 'ตารางเชื่อมผู้รับ (TO/CC) สำหรับเอกสารแต่ละฉบับ (M:N)';
-- ตาราง Master เก็บ Tags ทั้งหมดที่ใช้ในระบบ
CREATE TABLE tags (
    id INT PRIMARY KEY AUTO_INCREMENT COMMENT 'ID ของตาราง',
    tag_name VARCHAR(100) NOT NULL UNIQUE COMMENT 'ชื่อ Tag',
    description TEXT COMMENT 'คำอธิบายแท็ก',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'วันที่สร้าง',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'วันที่แก้ไขล่าสุด'
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci COMMENT = 'ตาราง Master เก็บ Tags ทั้งหมดที่ใช้ในระบบ';
-- ตารางเชื่อมระหว่าง correspondences และ tags (M:N)
CREATE TABLE correspondence_tags (
    correspondence_id INT COMMENT 'ID ของเอกสาร',
    tag_id INT COMMENT 'ID ของ Tag',
    PRIMARY KEY (correspondence_id, tag_id),
    FOREIGN KEY (correspondence_id) REFERENCES correspondences(id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci COMMENT = 'ตารางเชื่อมระหว่าง correspondences และ tags (M:N)';
-- ตารางเชื่อมการอ้างอิงระหว่างเอกสาร (M:N)
CREATE TABLE correspondence_references (
    src_correspondence_id INT COMMENT 'ID เอกสารต้นทาง',
    tgt_correspondence_id INT COMMENT 'ID เอกสารเป้าหมาย',
    PRIMARY KEY (src_correspondence_id, tgt_correspondence_id),
    FOREIGN KEY (src_correspondence_id) REFERENCES correspondences(id) ON DELETE CASCADE,
    FOREIGN KEY (tgt_correspondence_id) REFERENCES correspondences(id) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci COMMENT = 'ตารางเชื่อมการอ้างอิงระหว่างเอกสาร (M:N)';
-- =====================================================
-- 4. 📐 approval: RFA (เอกสารขออนุมัติ, Workflows)
-- =====================================================
-- 3.1 routing Config for Templates
-- รองรับ: Backend Plan T3.1
-- เหตุผล: เก็บ Logic การเดินเอกสารที่ซับซ้อนกว่า Column ปกติ
CREATE TABLE correspondence_routing_templates (
    id INT NOT NULL PRIMARY KEY AUTO_INCREMENT COMMENT 'ID ของแม่แบบ',
    template_name VARCHAR(255) NOT NULL COMMENT 'ชื่อแม่แบบ',
    description TEXT COMMENT 'คำอธิบาย',
    project_id INT NULL COMMENT 'ID โครงการ (ถ้าเป็นแม่แบบเฉพาะโครงการ)',
    -- NULL = แม่แบบทั่วไป
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'วันที่สร้าง',
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'วันที่แก้ไขล่าสุด',
    is_active BOOLEAN DEFAULT TRUE,
    workflow_config JSON NULL COMMENT 'Routing Logic Configuration',
    UNIQUE KEY ux_routing_template_name_project (template_name, project_id),
    CONSTRAINT fk_crt_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci COMMENT = 'แม่แบบสายงานการส่งต่อเอกสารขออนุมัติ';
CREATE TABLE correspondence_status_transitions(
    type_id INT NOT NULL COMMENT 'ID ของประเภทหนังสือ',
    from_status_id INT NOT NULL COMMENT 'ID ของสถานะต้นทาง',
    to_status_id INT NOT NULL COMMENT 'ID ของสถานะปลายทาง',
    PRIMARY KEY (type_id, from_status_id, to_status_id),
    CONSTRAINT fk_cst_type FOREIGN KEY (type_id) REFERENCES correspondence_types(id),
    CONSTRAINT fk_cst_from FOREIGN KEY (from_status_id) REFERENCES correspondence_status(id),
    CONSTRAINT fk_cst_to FOREIGN KEY (to_status_id) REFERENCES correspondence_status(id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci COMMENT = 'ตารางสถานะที่อนุญาตให้เปลี่ยนแปลงได้ตามประเภทหนังสือ';
-- 1.18.1 correspondence_routing_template_steps Table
CREATE TABLE correspondence_routing_template_steps (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY COMMENT 'ID ของขั้นตอน',
    template_id INT NOT NULL COMMENT 'ID ของแม่แบบ',
    sequence INT NOT NULL COMMENT 'ลำดับขั้นตอน',
    to_organization_id INT NOT NULL COMMENT 'ID องค์กรณ์ผู้รับในขั้นตอนนี้',
    step_purpose ENUM('FOR_APPROVAL', 'FOR_REVIEW', 'FOR_INFORMATION') NOT NULL DEFAULT 'FOR_REVIEW' COMMENT 'วัตถุประสงค์ของขั้นตอนนี้',
    expected_days INT NULL,
    UNIQUE KEY ux_cor_template_sequence (template_id, sequence),
    CONSTRAINT fk_cwts_template FOREIGN KEY (template_id) REFERENCES correspondence_routing_templates(id) ON DELETE CASCADE,
    CONSTRAINT fk_cwts_org FOREIGN KEY (to_organization_id) REFERENCES organizations(id) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci COMMENT = 'ขั้นตอนในแม่แบบ Workflow การส่งต่อเอกสาร';
-- 1.19.1 correspondence_routings
-- 3.2 State Context for Running Workflows
-- รองรับ: Backend Plan T3.1
-- เหตุผล: เก็บ Snapshot ข้อมูล ณ ขณะนั้นเพื่อใช้ตัดสินใจใน Step ถัดไป
CREATE TABLE correspondence_routings (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY COMMENT 'ID ของขั้นตอน',
    correspondence_id INT NOT NULL COMMENT 'ID ของเอกสาร(FK -> correspondence_revisions)',
    template_id INT NULL COMMENT 'ID ของแม่แบบที่ใช้ (ถ้ามี)',
    -- สำหรับอ้างอิงถึงแม่แบบ
    sequence INT NOT NULL COMMENT 'ลำดับของขั้นตอนการส่งต่อ',
    from_organization_id INT NOT NULL COMMENT 'ID ขององค์กรณ์ผู้ส่ง',
    to_organization_id INT NOT NULL COMMENT 'ID ขององค์กรณ์ผู้รับ',
    step_purpose ENUM(
        'FOR_APPROVAL',
        'FOR_REVIEW',
        'FOR_INFORMATION',
        'FOR_ACTION'
    ) NOT NULL DEFAULT 'FOR_REVIEW' COMMENT 'วัตถุประสงค์ของขั้นตอนนี้ เช่น เพื่ออนุมัติ, เพื่อตรวจสอบ, หรือเพื่อรับทราบ',
    status ENUM(
        'SENT',
        'RECEIVED',
        'ACTIONED',
        'FORWARDED',
        'REPLIED'
    ) NOT NULL DEFAULT 'SENT' COMMENT 'สถานะการดำเนินการของเอกสารในขั้นตอนนี้',
    comments TEXT COMMENT 'หมายเหตุ หรือความคิดเห็นในการส่งต่อ',
    due_date DATETIME NULL COMMENT 'วันที่ต้องตอบเอกสารในขั้นตอนนี้',
    processed_by_user_id INT NULL COMMENT 'ID ของผู้ใช้ที่ดำเนินการในขั้นตอนนี้',
    processed_at TIMESTAMP NULL COMMENT 'เวลาที่ดำเนินการ',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'เวลาที่สร้างขั้นตอนนี้',
    state_context JSON NULL COMMENT 'Snapshot of routing state context',
    UNIQUE KEY ux_cor_routing_sequence (correspondence_id, sequence),
    -- Foreign Keys
    CONSTRAINT fk_crs_correspondence FOREIGN KEY (correspondence_id) REFERENCES correspondence_revisions(correspondence_id) ON DELETE CASCADE,
    CONSTRAINT fk_crs_template FOREIGN KEY (template_id) REFERENCES correspondence_routing_templates(id) ON DELETE
    SET NULL,
        CONSTRAINT fk_crs_from_org FOREIGN KEY (from_organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
        CONSTRAINT fk_crs_to_org FOREIGN KEY (to_organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
        CONSTRAINT fk_crs_processed_by_user FOREIGN KEY (processed_by_user_id) REFERENCES users(user_id) ON DELETE
    SET NULL
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci COMMENT = 'ตารางติดตาม Workflow การส่งต่อเอกสารทั่วไป';
-- ตาราง Master สำหรับประเภท RFA
CREATE TABLE rfa_types (
    id INT PRIMARY KEY AUTO_INCREMENT COMMENT 'ID ของตาราง',
    type_code VARCHAR(20) NOT NULL UNIQUE COMMENT 'รหัสประเภท RFA (เช่น DWG, DOC, MAT)',
    type_name VARCHAR(100) NOT NULL COMMENT 'ชื่อประเภท RFA',
    description TEXT COMMENT 'คำอธิบาย',
    sort_order INT DEFAULT 0 COMMENT 'ลำดับการแสดงผล',
    is_active TINYINT(1) DEFAULT 1 COMMENT 'สถานะการใช้งาน'
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci COMMENT = 'ตาราง Master สำหรับประเภท RFA';
INSERT INTO rfa_types (type_code, type_name, sort_order, is_active)
VALUES ('DWG', 'Shop Drawing', 10, 1),
    ('DOC', 'Document', 20, 1),
    ('SPC', 'Specification', 21, 1),
    ('CAL', 'Calculation', 22, 1),
    ('TRP', 'Test Report', 23, 1),
    ('SRY', 'Survey Report', 24, 1),
    ('QAQC', 'QA/QC Document', 25, 1),
    ('MES', 'Method Statement', 30, 1),
    ('MAT', 'Material', 40, 1),
    ('ASB', 'As-Built', 50, 1),
    ('OTH', 'Other', 99, 1);
-- ตาราง Master สำหรับสถานะ RFA
CREATE TABLE rfa_status_codes (
    id INT PRIMARY KEY AUTO_INCREMENT COMMENT 'ID ของตาราง',
    status_code VARCHAR(20) NOT NULL UNIQUE COMMENT 'รหัสสถานะ RFA (เช่น DFT - Draft, FAP - For Approve)',
    status_name VARCHAR(100) NOT NULL COMMENT 'ชื่อสถานะ',
    description TEXT COMMENT 'คำอธิบาย',
    sort_order INT DEFAULT 0 COMMENT 'ลำดับการแสดงผล',
    is_active TINYINT(1) DEFAULT 1 COMMENT 'สถานะการใช้งาน'
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci COMMENT = 'ตาราง Master สำหรับสถานะ RFA';
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
    ('ASB', 'AS-Built', 'แบบก่อสร้างจริง', 30),
    ('OBS', 'Obsolete', 'ไม่ใช้งาน', 80),
    ('CC', 'Canceled', 'ยกเลิก', 99);
-- ตาราง Master สำหรับรหัสผลการอนุมัติ RFA
CREATE TABLE rfa_approve_codes (
    id INT PRIMARY KEY AUTO_INCREMENT COMMENT 'ID ของตาราง',
    approve_code VARCHAR(20) NOT NULL UNIQUE COMMENT 'รหัสผลการอนุมัติ (เช่น 1A - Approved, 3R - Revise and Resubmit)',
    approve_name VARCHAR(100) NOT NULL COMMENT 'ชื่อผลการอนุมัติ',
    description TEXT COMMENT 'คำอธิบาย',
    sort_order INT DEFAULT 0 COMMENT 'ลำดับการแสดงผล',
    is_active TINYINT(1) DEFAULT 1 COMMENT 'สถานะการใช้งาน'
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci COMMENT = 'ตาราง Master สำหรับรหัสผลการอนุมัติ RFA';
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
-- ตาราง "แม่" ของ RFA (มีความสัมพันธ์ 1:N กับ rfa_revisions)
CREATE TABLE rfas (
    id INT PRIMARY KEY AUTO_INCREMENT COMMENT 'ID ของตาราง (RFA Master ID)',
    rfa_type_id INT NOT NULL COMMENT 'ประเภท RFA',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT 'วันที่สร้าง',
    created_by INT COMMENT 'ผู้สร้าง',
    deleted_at DATETIME NULL COMMENT 'สำหรับ Soft Delete',
    FOREIGN KEY (rfa_type_id) REFERENCES rfa_types(id),
    FOREIGN KEY (created_by) REFERENCES users(user_id) ON DELETE
    SET NULL
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci COMMENT = 'ตาราง "แม่" ของ RFA (มีความสัมพันธ์ 1:N กับ rfa_revisions)';
-- ตาราง "ลูก" เก็บประวัติ (Revisions) ของ rfas (1:N)
CREATE TABLE rfa_revisions (
    id INT PRIMARY KEY AUTO_INCREMENT COMMENT 'ID ของ Revision',
    correspondence_id INT NOT NULL COMMENT 'Master ID ของ Correspondence',
    rfa_id INT NOT NULL COMMENT 'Master ID ของ RFA',
    revision_number INT NOT NULL COMMENT 'หมายเลข Revision (0, 1, 2...)',
    revision_label VARCHAR(10) COMMENT 'Revision ที่แสดง (เช่น A, B, 1.1)',
    is_current BOOLEAN DEFAULT FALSE COMMENT '(1 = Revision ปัจจุบัน)',
    rfa_status_code_id INT NOT NULL COMMENT 'สถานะ RFA',
    rfa_approve_code_id INT COMMENT 'ผลการอนุมัติ',
    title VARCHAR(255) NOT NULL COMMENT 'เรื่อง',
    document_date DATE COMMENT 'วันที่ในเอกสาร',
    issued_date DATE COMMENT 'วันที่ส่งขออนุมัติ',
    received_date DATETIME COMMENT 'วันที่ลงรับเอกสาร',
    approved_date DATE COMMENT 'วันที่อนุมัติ',
    description TEXT COMMENT 'คำอธิบายการแก้ไขใน Revision นี้',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT 'วันที่สร้างเอกสาร',
    created_by INT COMMENT 'ผู้สร้าง',
    updated_by INT COMMENT 'ผู้แก้ไขล่าสุด',
    FOREIGN KEY (correspondence_id) REFERENCES correspondences(id) ON DELETE CASCADE,
    FOREIGN KEY (rfa_id) REFERENCES rfas(id) ON DELETE CASCADE,
    FOREIGN KEY (rfa_status_code_id) REFERENCES rfa_status_codes(id),
    FOREIGN KEY (rfa_approve_code_id) REFERENCES rfa_approve_codes(id) ON DELETE
    SET NULL,
        FOREIGN KEY (created_by) REFERENCES users(user_id) ON DELETE
    SET NULL,
        FOREIGN KEY (updated_by) REFERENCES users(user_id) ON DELETE
    SET NULL,
        UNIQUE KEY uq_rr_rev_number (rfa_id, revision_number),
        UNIQUE KEY uq_rr_current (rfa_id, is_current)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci COMMENT = 'ตาราง "ลูก" เก็บประวัติ (Revisions) ของ rfas (1:N)';
-- ตารางเชื่อมระหว่าง rfa_revisions (ที่เป็นประเภท DWG) กับ shop_drawing_revisions (M:N)
CREATE TABLE rfa_items (
    rfarev_correspondence_id INT COMMENT 'ID ของ RFA Revision',
    shop_drawing_revision_id INT COMMENT 'ID ของ Shop Drawing Revision',
    PRIMARY KEY (
        rfarev_correspondence_id,
        shop_drawing_revision_id
    ),
    FOREIGN KEY (rfarev_correspondence_id) REFERENCES rfa_revisions(correspondence_id) ON DELETE CASCADE,
    FOREIGN KEY (shop_drawing_revision_id) REFERENCES shop_drawing_revisions(id) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci COMMENT = 'ตารางเชื่อมระหว่าง rfa_revisions (ที่เป็นประเภท DWG) กับ shop_drawing_revisions (M:N)';
-- ตาราง Master เก็บแม่แบบสายอนุมัติ
-- 3.1 Workflow Config for Templates
-- รองรับ: Backend Plan T3.1
-- เหตุผล: เก็บ Logic การเดินเอกสารที่ซับซ้อนกว่า Column ปกติ
CREATE TABLE rfa_workflow_templates (
    id INT PRIMARY KEY AUTO_INCREMENT COMMENT 'ID ของตาราง',
    template_name VARCHAR(100) NOT NULL COMMENT 'ชื่อแม่แบบสายอนุมัติ',
    description TEXT COMMENT 'คำอธิบาย',
    is_active TINYINT(1) DEFAULT 1 COMMENT 'สถานะการใช้งาน',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'วันที่สร้าง',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'วันที่แก้ไขล่าสุด',
    workflow_config JSON NULL COMMENT 'State Machine Configuration Rules'
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci COMMENT = 'ตาราง Master เก็บแม่แบบสายอนุมัติ';
-- ตารางลูก เก็บขั้นตอนในแม่แบบ
CREATE TABLE rfa_workflow_template_steps (
    id INT PRIMARY KEY AUTO_INCREMENT COMMENT 'ID ของตาราง',
    template_id INT NOT NULL COMMENT 'ID ของแม่แบบ',
    step_number INT NOT NULL COMMENT 'ลำดับขั้นตอน',
    organization_id INT NOT NULL COMMENT 'องค์กรที่รับผิดชอบ',
    role_id INT COMMENT 'บทบาทที่รับผิดชอบ',
    action_type ENUM('REVIEW', 'APPROVE', 'ACKNOWLEDGE') COMMENT 'ประเภทการกระทำ',
    duration_days INT COMMENT 'ระยะเวลาที่กำหนด (วัน)',
    is_optional BOOLEAN DEFAULT FALSE COMMENT 'เป็นขั้นตอนเลือกหรือไม่',
    FOREIGN KEY (template_id) REFERENCES rfa_workflow_templates(id) ON DELETE CASCADE,
    FOREIGN KEY (organization_id) REFERENCES organizations(id),
    FOREIGN KEY (role_id) REFERENCES roles(role_id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci COMMENT = 'ตารางลูก เก็บขั้นตอนในแม่แบบ';
-- ตารางประวัติ (Log) การอนุมัติของ RFA จริงตามสายงาน
-- 3.2 State Context for Running Workflows
-- รองรับ: Backend Plan T3.1
-- เหตุผล: เก็บ Snapshot ข้อมูล ณ ขณะนั้นเพื่อใช้ตัดสินใจใน Step ถัดไป
CREATE TABLE rfa_workflows (
    id INT PRIMARY KEY AUTO_INCREMENT COMMENT 'ID ของตาราง',
    rfa_revision_id INT NOT NULL COMMENT 'ID ของ RFA Revision',
    step_number INT NOT NULL COMMENT 'ลำดับขั้นตอน',
    organization_id INT NOT NULL COMMENT 'องค์กรที่รับผิดชอบ',
    assigned_to INT COMMENT 'ผู้ใช้ที่ได้รับมอบหมาย',
    action_type ENUM('REVIEW', 'APPROVE', 'ACKNOWLEDGE') COMMENT 'ประเภทการกระทำ',
    status ENUM(
        'PENDING',
        'IN_PROGRESS',
        'COMPLETED',
        'REJECTED'
    ) COMMENT 'สถานะ',
    comments TEXT COMMENT 'ความคิดเห็น',
    completed_at DATETIME COMMENT 'วันที่เสร็จสิ้น',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'วันที่สร้าง',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'วันที่แก้ไขล่าสุด',
    state_context JSON NULL COMMENT 'Snapshot of workflow state context',
    FOREIGN KEY (rfa_revision_id) REFERENCES rfa_revisions(id) ON DELETE CASCADE,
    FOREIGN KEY (organization_id) REFERENCES organizations(id),
    FOREIGN KEY (assigned_to) REFERENCES users(user_id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci COMMENT = 'ตารางประวัติ (Log) การอนุมัติของ RFA จริงตามสายงาน';
-- =====================================================
-- 5. 📐 Drawings (แบบ, หมวดหมู่)
-- =====================================================
-- ตาราง Master สำหรับ "เล่ม" ของแบบคู่สัญญา
CREATE TABLE contract_drawing_volumes (
    id INT PRIMARY KEY AUTO_INCREMENT COMMENT 'ID ของตาราง',
    project_id INT NOT NULL COMMENT 'โครงการ',
    volume_code VARCHAR(50) NOT NULL COMMENT 'รหัสเล่ม',
    volume_name VARCHAR(255) NOT NULL COMMENT 'ชื่อเล่ม',
    description TEXT COMMENT 'คำอธิบาย',
    sort_order INT DEFAULT 0 COMMENT 'ลำดับการแสดงผล',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'วันที่สร้าง',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'วันที่แก้ไขล่าสุด',
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    UNIQUE KEY ux_volume_project (project_id, volume_code)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci COMMENT = 'ตาราง Master สำหรับ "เล่ม" ของแบบคู่สัญญา';
-- ตาราง Master สำหรับ "หมวดหมู่หลัก" ของแบบคู่สัญญา
CREATE TABLE contract_drawing_cats (
    id INT PRIMARY KEY AUTO_INCREMENT COMMENT 'ID ของตาราง',
    project_id INT NOT NULL COMMENT 'โครงการ',
    cat_code VARCHAR(50) NOT NULL COMMENT 'รหัสหมวดหมู่หลัก',
    cat_name VARCHAR(255) NOT NULL COMMENT 'ชื่อหมวดหมู่หลัก',
    description TEXT COMMENT 'คำอธิบาย',
    sort_order INT DEFAULT 0 COMMENT 'ลำดับการแสดงผล',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'วันที่สร้าง',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'วันที่แก้ไขล่าสุด',
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    UNIQUE KEY ux_cat_project (project_id, cat_code)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci COMMENT = 'ตาราง Master สำหรับ "หมวดหมู่หลัก" ของแบบคู่สัญญา';
-- ตาราง Master สำหรับ "หมวดหมู่ย่อย" ของแบบคู่สัญญา
CREATE TABLE contract_drawing_sub_cats (
    id INT PRIMARY KEY AUTO_INCREMENT COMMENT 'ID ของตาราง',
    project_id INT NOT NULL COMMENT 'โครงการ',
    sub_cat_code VARCHAR(50) NOT NULL COMMENT 'รหัสหมวดหมู่ย่อย',
    sub_cat_name VARCHAR(255) NOT NULL COMMENT 'ชื่อหมวดหมู่ย่อย',
    description TEXT COMMENT 'คำอธิบาย',
    sort_order INT DEFAULT 0 COMMENT 'ลำดับการแสดงผล',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'วันที่สร้าง',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'วันที่แก้ไขล่าสุด',
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    UNIQUE KEY ux_subcat_project (project_id, sub_cat_code)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci COMMENT = 'ตาราง Master สำหรับ "หมวดหมู่ย่อย" ของแบบคู่สัญญา';
-- ตารางเชื่อมระหว่าง หมวดหมู่หลัก-ย่อย (M:N)
CREATE TABLE contract_drawing_subcat_cat_maps (
    project_id INT COMMENT 'ID ของโครงการ',
    sub_cat_id INT COMMENT 'ID ของหมวดหมู่ย่อย',
    cat_id INT COMMENT 'ID ของหมวดหมู่หลัก',
    PRIMARY KEY (project_id, sub_cat_id, cat_id),
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (sub_cat_id) REFERENCES contract_drawing_sub_cats(id) ON DELETE CASCADE,
    FOREIGN KEY (cat_id) REFERENCES contract_drawing_cats(id) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci COMMENT = 'ตารางเชื่อมระหว่าง หมวดหมู่หลัก-ย่อย (M:N)';
-- ตาราง Master เก็บข้อมูล "แบบคู่สัญญา"
CREATE TABLE contract_drawings (
    id INT PRIMARY KEY AUTO_INCREMENT COMMENT 'ID ของตาราง',
    project_id INT NOT NULL COMMENT 'โครงการ',
    condwg_no VARCHAR(255) NOT NULL COMMENT 'เลขที่แบบสัญญา',
    title VARCHAR(255) NOT NULL COMMENT 'ชื่อแบบสัญญา',
    sub_cat_id INT COMMENT 'หมวดหมู่ย่อย',
    volume_id INT COMMENT 'เล่ม',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'วันที่สร้าง',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'วันที่แก้ไขล่าสุด',
    deleted_at DATETIME NULL COMMENT 'วันที่ลบ',
    updated_by INT COMMENT 'ผู้แก้ไขล่าสุด',
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (sub_cat_id) REFERENCES contract_drawing_sub_cats(id) ON DELETE RESTRICT,
    FOREIGN KEY (volume_id) REFERENCES contract_drawing_volumes(id) ON DELETE RESTRICT,
    UNIQUE KEY ux_condwg_no_project (project_id, condwg_no)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci COMMENT = 'ตาราง Master เก็บข้อมูล "แบบคู่สัญญา"';
-- ตาราง Master สำหรับ "หมวดหมู่หลัก" ของแบบก่อสร้าง
CREATE TABLE shop_drawing_main_categories (
    id INT PRIMARY KEY AUTO_INCREMENT COMMENT 'ID ของตาราง',
    main_category_code VARCHAR(50) NOT NULL UNIQUE COMMENT 'รหัสหมวดหมู่หลัก (เช่น ARCH, STR)',
    main_category_name VARCHAR(255) NOT NULL COMMENT 'ชื่อหมวดหมู่หลัก',
    description TEXT COMMENT 'คำอธิบาย',
    sort_order INT DEFAULT 0 COMMENT 'ลำดับการแสดงผล',
    is_active TINYINT(1) DEFAULT 1 COMMENT 'สถานะการใช้งาน',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'วันที่สร้าง',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'วันที่แก้ไขล่าสุด'
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci COMMENT = 'ตาราง Master สำหรับ "หมวดหมู่หลัก" ของแบบก่อสร้าง';
-- ตาราง Master สำหรับ "หมวดหมู่ย่อย" ของแบบก่อสร้าง
CREATE TABLE shop_drawing_sub_categories (
    id INT PRIMARY KEY AUTO_INCREMENT COMMENT 'ID ของตาราง',
    sub_category_code VARCHAR(50) NOT NULL UNIQUE COMMENT 'รหัสหมวดหมู่ย่อย (เช่น STR-COLUMN)',
    sub_category_name VARCHAR(255) NOT NULL COMMENT 'ชื่อหมวดหมู่ย่อย',
    main_category_id INT NOT NULL COMMENT 'หมวดหมู่หลัก',
    description TEXT COMMENT 'คำอธิบาย',
    sort_order INT DEFAULT 0 COMMENT 'ลำดับการแสดงผล',
    is_active TINYINT(1) DEFAULT 1 COMMENT 'สถานะการใช้งาน',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'วันที่สร้าง',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'วันที่แก้ไขล่าสุด',
    FOREIGN KEY (main_category_id) REFERENCES shop_drawing_main_categories(id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci COMMENT = 'ตาราง Master สำหรับ "หมวดหมู่ย่อย" ของแบบก่อสร้าง';
-- ตาราง Master เก็บข้อมูล "แบบก่อสร้าง"
CREATE TABLE shop_drawings (
    id INT PRIMARY KEY AUTO_INCREMENT COMMENT 'ID ของตาราง',
    project_id INT NOT NULL COMMENT 'โครงการ',
    drawing_number VARCHAR(100) NOT NULL UNIQUE COMMENT 'เลขที่ Shop Drawing',
    title VARCHAR(500) NOT NULL COMMENT 'ชื่อแบบ',
    main_category_id INT NOT NULL COMMENT 'หมวดหมู่หลัก',
    sub_category_id INT NOT NULL COMMENT 'หมวดหมู่ย่อย',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'วันที่สร้าง',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'วันที่แก้ไขล่าสุด',
    deleted_at DATETIME NULL COMMENT 'วันที่ลบ',
    updated_by INT COMMENT 'ผู้แก้ไขล่าสุด',
    FOREIGN KEY (project_id) REFERENCES projects(id),
    FOREIGN KEY (main_category_id) REFERENCES shop_drawing_main_categories(id),
    FOREIGN KEY (sub_category_id) REFERENCES shop_drawing_sub_categories(id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci COMMENT = 'ตาราง Master เก็บข้อมูล "แบบก่อสร้าง"';
-- ตาราง "ลูก" เก็บประวัติ (Revisions) ของ shop_drawings (1:N)
CREATE TABLE shop_drawing_revisions (
    id INT PRIMARY KEY AUTO_INCREMENT COMMENT 'ID ของ Revision',
    shop_drawing_id INT NOT NULL COMMENT 'Master ID',
    revision_number INT NOT NULL COMMENT 'หมายเลข Revision (เช่น 0, 1, 2...)',
    revision_label VARCHAR(10) COMMENT 'Revision ที่แสดง (เช่น A, B, 1.1)',
    revision_date DATE COMMENT 'วันที่ของ Revision',
    description TEXT COMMENT 'คำอธิบายการแก้ไข',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'วันที่สร้าง',
    FOREIGN KEY (shop_drawing_id) REFERENCES shop_drawings(id) ON DELETE CASCADE,
    UNIQUE KEY ux_sd_rev_drawing_revision (shop_drawing_id, revision_number)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci COMMENT = 'ตาราง "ลูก" เก็บประวัติ (Revisions) ของ shop_drawings (1:N)';
-- ตารางเชื่อมระหว่าง shop_drawing_revisions กับ contract_drawings (M:N)
CREATE TABLE shop_drawing_revision_contract_refs (
    shop_drawing_revision_id INT COMMENT 'ID ของ Shop Drawing Revision',
    contract_drawing_id INT COMMENT 'ID ของ Contract Drawing',
    PRIMARY KEY (shop_drawing_revision_id, contract_drawing_id),
    FOREIGN KEY (shop_drawing_revision_id) REFERENCES shop_drawing_revisions(id) ON DELETE CASCADE,
    FOREIGN KEY (contract_drawing_id) REFERENCES contract_drawings(id) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci COMMENT = 'ตารางเชื่อมระหว่าง shop_drawing_revisions กับ contract_drawings (M:N)';
-- =====================================================
-- 6. 🔄 Circulations (ใบเวียนภายใน)
-- =====================================================
-- ตาราง Master เก็บสถานะใบเวียน
CREATE TABLE circulation_status_codes (
    id INT PRIMARY KEY AUTO_INCREMENT COMMENT 'ID ของตาราง',
    code VARCHAR(20) NOT NULL UNIQUE COMMENT 'รหัสสถานะการดำเนินงาน',
    description VARCHAR(50) NOT NULL COMMENT 'คำอธิบายสถานะการดำเนินงาน',
    sort_order INT DEFAULT 0 COMMENT 'ลำดับการแสดงผล',
    is_active TINYINT(1) DEFAULT 1 COMMENT 'สถานะการใช้งาน'
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci COMMENT = 'ตาราง Master เก็บสถานะใบเวียน';
INSERT INTO circulation_status_codes (code, description, sort_order)
VALUES ('OPEN', 'Open', 1),
    ('IN_REVIEW', 'In Review', 2),
    ('COMPLETED', 'ปCompleted', 3),
    ('CANCELLED', 'Cancelled/Withdrawn', 9);
-- ตาราง "แม่" ของใบเวียนเอกสารภายใน
CREATE TABLE circulations (
    id INT PRIMARY KEY AUTO_INCREMENT COMMENT 'ID ของตารางใบเวียน',
    correspondence_id INT UNIQUE COMMENT 'ID ของเอกสาร (จากตาราง correspondences)',
    organization_id INT NOT NULL COMMENT 'ID ขององค์กรณ์ที่เป็นเจ้าของใบเวียนนี้',
    circulation_no VARCHAR(100) NOT NULL COMMENT 'เลขที่ใบเวียน',
    circulation_subject VARCHAR(500) NOT NULL COMMENT 'เรื่องใบเวียน',
    circulation_status_code VARCHAR(20) NOT NULL COMMENT 'รหัสสถานะใบเวียน',
    created_by_user_id INT NOT NULL COMMENT 'ID ของผู้สร้างใบเวียน',
    submitted_at TIMESTAMP NULL COMMENT 'วันที่ส่งใบเวียน',
    closed_at TIMESTAMP NULL COMMENT 'วันที่ปิดใบเวียน',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'วันที่สร้าง',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'วันที่แก้ไขล่าสุด',
    FOREIGN KEY (correspondence_id) REFERENCES correspondences(id),
    FOREIGN KEY (organization_id) REFERENCES organizations(id),
    FOREIGN KEY (circulation_status_code) REFERENCES circulation_status_codes(code),
    FOREIGN KEY (created_by_user_id) REFERENCES users(user_id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci COMMENT = 'ตาราง "แม่" ของใบเวียนเอกสารภายใน';
-- ตาราง Master เก็บแม่แบบสายงาน
CREATE TABLE circulation_templates (
    id INT PRIMARY KEY AUTO_INCREMENT COMMENT 'ID ของตาราง',
    template_name VARCHAR(100) NOT NULL COMMENT 'ชื่อแม่แบบสายงาน',
    description TEXT COMMENT 'คำอธิบาย',
    organization_id INT NOT NULL COMMENT 'องค์กรเจ้าของแม่แบบ',
    is_active TINYINT(1) DEFAULT 1 COMMENT 'สถานะการใช้งาน',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'วันที่สร้าง',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'วันที่แก้ไขล่าสุด',
    FOREIGN KEY (organization_id) REFERENCES organizations(id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci COMMENT = 'ตาราง Master เก็บแม่แบบสายงาน';
-- ตารางลูก เก็บขั้นตอนในแม่แบบ
CREATE TABLE circulation_template_assignees (
    id INT PRIMARY KEY AUTO_INCREMENT COMMENT 'ID ของตาราง',
    template_id INT NOT NULL COMMENT 'ID ของแม่แบบ',
    step_number INT NOT NULL COMMENT 'ลำดับขั้นตอน',
    organization_id INT NOT NULL COMMENT 'องค์กรที่รับผิดชอบ',
    role_id INT COMMENT 'บทบาทที่รับผิดชอบ',
    duration_days INT COMMENT 'ระยะเวลาที่กำหนด (วัน)',
    is_optional BOOLEAN DEFAULT FALSE COMMENT 'เป็นขั้นตอนเลือกหรือไม่',
    FOREIGN KEY (template_id) REFERENCES circulation_templates(id) ON DELETE CASCADE,
    FOREIGN KEY (organization_id) REFERENCES organizations(id),
    FOREIGN KEY (role_id) REFERENCES roles(role_id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci COMMENT = 'ตารางลูก เก็บขั้นตอนในแม่แบบ';
-- ตารางประวัติ (Log) การส่งต่อของเอกสารจริงตาม Workflow
CREATE TABLE circulation_routings (
    id INT PRIMARY KEY AUTO_INCREMENT COMMENT 'ID ของตาราง',
    circulation_id INT NOT NULL COMMENT 'ID ของใบเวียน',
    step_number INT NOT NULL COMMENT 'ลำดับขั้นตอน',
    organization_id INT NOT NULL COMMENT 'องค์กรที่รับผิดชอบ',
    assigned_to INT COMMENT 'ผู้ใช้ที่ได้รับมอบหมาย',
    status ENUM(
        'PENDING',
        'IN_PROGRESS',
        'COMPLETED',
        'REJECTED'
    ) COMMENT 'สถานะ',
    comments TEXT COMMENT 'ความคิดเห็น',
    completed_at DATETIME COMMENT 'วันที่เสร็จสิ้น',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'วันที่สร้าง',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'วันที่แก้ไขล่าสุด',
    FOREIGN KEY (circulation_id) REFERENCES circulations(id) ON DELETE CASCADE,
    FOREIGN KEY (organization_id) REFERENCES organizations(id),
    FOREIGN KEY (assigned_to) REFERENCES users(user_id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci COMMENT = 'ตารางประวัติ (Log) การส่งต่อของเอกสารจริงตาม Workflow';
-- =====================================================
-- 7. 📤 Transmittals (เอกสารนำส่ง)
-- =====================================================
-- ตารางข้อมูลเฉพาะของเอกสารนำส่ง (เป็นตารางลูก 1:1 ของ correspondences)
CREATE TABLE transmittals (
    correspondence_id INT PRIMARY KEY COMMENT 'ID ของเอกสาร',
    purpose ENUM(
        'FOR_APPROVAL',
        'FOR_INFORMATION',
        'FOR_REVIEW',
        'OTHER'
    ) COMMENT 'วัตถุประสงค์',
    remarks TEXT COMMENT 'หมายเหตุ',
    FOREIGN KEY (correspondence_id) REFERENCES correspondences(id) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci COMMENT = 'ตารางข้อมูลเฉพาะของเอกสารนำส่ง (เป็นตารางลูก 1:1 ของ correspondences)';
-- ตารางเชื่อมระหว่าง transmittals และเอกสารที่นำส่ง (M:N)
CREATE TABLE transmittal_items (
    id INT PRIMARY KEY AUTO_INCREMENT COMMENT 'ID ของรายการ',
    transmittal_id INT NOT NULL COMMENT 'ID ของ Transmittal',
    item_correspondence_id INT NOT NULL COMMENT 'ID ของเอกสารที่แนบไป',
    quantity INT DEFAULT 1 COMMENT 'จำนวน',
    remarks VARCHAR(255) COMMENT 'หมายเหตุสำหรับรายการนี้',
    FOREIGN KEY (transmittal_id) REFERENCES transmittals(correspondence_id) ON DELETE CASCADE,
    FOREIGN KEY (item_correspondence_id) REFERENCES correspondences(id) ON DELETE CASCADE,
    UNIQUE KEY ux_transmittal_item (transmittal_id, item_correspondence_id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci COMMENT = 'ตารางเชื่อมระหว่าง transmittals และเอกสารที่นำส่ง (M:N)';
-- =====================================================
-- 8. 📎 File Management (ไฟล์แนบ)
-- =====================================================
-- ตาราง "กลาง" เก็บไฟล์แนบทั้งหมดของระบบ
-- 2.2 Attachments - Two-Phase Storage & Security
-- รองรับ: Backend Plan T2.2, Req 3.9.1
-- เหตุผล: จัดการไฟล์ขยะ (Orphan Files) และตรวจสอบความถูกต้องไฟล์
CREATE TABLE attachments (
    id INT PRIMARY KEY AUTO_INCREMENT COMMENT 'ID ของไฟล์แนบ',
    original_filename VARCHAR(255) NOT NULL COMMENT 'ชื่อไฟล์ดั้งเดิมตอนอัปโหลด',
    stored_filename VARCHAR(255) NOT NULL COMMENT 'ชื่อไฟล์ที่เก็บจริงบน Server (ป้องกันชื่อซ้ำ)',
    file_path VARCHAR(500) NOT NULL COMMENT 'Path ที่เก็บไฟล์ (บน QNAP /share/dms-data/)',
    mime_type VARCHAR(100) NOT NULL COMMENT 'ประเภทไฟล์ (เช่น application/pdf)',
    file_size INT NOT NULL COMMENT 'ขนาดไฟล์ (bytes)',
    is_temporary BOOLEAN DEFAULT TRUE COMMENT 'True=ยังไม่ Commit ลง DB จริง',
    temp_id VARCHAR(100) NULL COMMENT 'ID ชั่วคราวสำหรับอ้างอิงตอน Upload Phase 1' uploaded_by_user_id INT NOT NULL COMMENT 'ผู้อัปโหลดไฟล์',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'วันที่อัปโหลด',
    expires_at DATETIME NULL COMMENT 'เวลาหมดอายุของไฟล์ Temp' checksum VARCHAR(64) NULL COMMENT 'SHA-256 Checksum' FOREIGN KEY (uploaded_by_user_id) REFERENCES users(user_id) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci COMMENT = 'ตาราง "กลาง" เก็บไฟล์แนบทั้งหมดของระบบ';
-- ตารางเชื่อม correspondences กับ attachments (M:N)
CREATE TABLE correspondence_attachments (
    correspondence_id INT COMMENT 'ID ของเอกสาร',
    attachment_id INT COMMENT 'ID ของไฟล์แนบ',
    is_main_document BOOLEAN DEFAULT FALSE COMMENT '(1 = ไฟล์หลัก)',
    PRIMARY KEY (correspondence_id, attachment_id),
    FOREIGN KEY (correspondence_id) REFERENCES correspondences(id) ON DELETE CASCADE,
    FOREIGN KEY (attachment_id) REFERENCES attachments(id) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci COMMENT = 'ตารางเชื่อม correspondences กับ attachments (M:N)';
-- ตารางเชื่อม circulations กับ attachments (M:N)
CREATE TABLE circulation_attachments (
    circulation_id INT COMMENT 'ID ของใบเวียน',
    attachment_id INT COMMENT 'ID ของไฟล์แนบ',
    is_main_document BOOLEAN DEFAULT FALSE COMMENT '(1 = ไฟล์หลักของใบเวียน)',
    PRIMARY KEY (circulation_id, attachment_id),
    FOREIGN KEY (circulation_id) REFERENCES circulations(id) ON DELETE CASCADE,
    FOREIGN KEY (attachment_id) REFERENCES attachments(id) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci COMMENT = 'ตารางเชื่อม circulations กับ attachments (M:N)';
-- ตารางเชื่อม shop_drawing_revisions กับ attachments (M:N)
CREATE TABLE shop_drawing_revision_attachments (
    shop_drawing_revision_id INT COMMENT 'ID ของ Shop Drawing Revision',
    attachment_id INT COMMENT 'ID ของไฟล์แนบ',
    file_type ENUM('PDF', 'DWG', 'SOURCE', 'OTHER') COMMENT 'ประเภทไฟล์',
    is_main_document BOOLEAN DEFAULT FALSE COMMENT '(1 = ไฟล์หลัก)',
    PRIMARY KEY (shop_drawing_revision_id, attachment_id),
    FOREIGN KEY (shop_drawing_revision_id) REFERENCES shop_drawing_revisions(id) ON DELETE CASCADE,
    FOREIGN KEY (attachment_id) REFERENCES attachments(id) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci COMMENT = 'ตารางเชื่อม shop_drawing_revisions กับ attachments (M:N)';
-- ตารางเชื่อม contract_drawings กับ attachments (M:N)
CREATE TABLE contract_drawing_attachments (
    contract_drawing_id INT COMMENT 'ID ของ Contract Drawing',
    attachment_id INT COMMENT 'ID ของไฟล์แนบ',
    file_type ENUM('PDF', 'DWG', 'SOURCE', 'OTHER') COMMENT 'ประเภทไฟล์',
    is_main_document BOOLEAN DEFAULT FALSE COMMENT '(1 = ไฟล์หลัก)',
    PRIMARY KEY (contract_drawing_id, attachment_id),
    FOREIGN KEY (contract_drawing_id) REFERENCES contract_drawings(id) ON DELETE CASCADE,
    FOREIGN KEY (attachment_id) REFERENCES attachments(id) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci COMMENT = 'ตารางเชื่อม contract_drawings กับ attachments (M:N)';
-- =====================================================
-- 9. 🔢 Document Numbering (การสร้างเลขที่เอกสาร)
-- =====================================================
-- ตาราง Master เก็บ "รูปแบบ" Template ของเลขที่เอกสาร
CREATE TABLE document_number_formats (
    id INT PRIMARY KEY AUTO_INCREMENT COMMENT 'ID ของตาราง',
    project_id INT NOT NULL COMMENT 'โครงการ',
    correspondence_type_id INT NOT NULL COMMENT 'ประเภทเอกสาร',
    format_template VARCHAR(255) NOT NULL COMMENT 'รูปแบบ Template (เช่น {ORG_CODE}-{TYPE_CODE}-{SEQ:4})',
    description TEXT COMMENT 'คำอธิบายรูปแบบนี้',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'วันที่สร้าง',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'วันที่แก้ไขล่าสุด',
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (correspondence_type_id) REFERENCES correspondence_types(id) ON DELETE CASCADE,
    UNIQUE KEY uk_project_type (project_id, correspondence_type_id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci COMMENT = 'ตาราง Master เก็บ "รูปแบบ" Template ของเลขที่เอกสาร';
-- ตารางเก็บ "ตัวนับ" (Running Number) ล่าสุด
-- 2.1 Document Numbering - Optimistic Locking
-- รองรับ: Backend Plan T2.3, Req 3.10.5
-- เหตุผล: ป้องกัน Race Condition เวลาขอเลขที่เอกสารพร้อมกัน
CREATE TABLE document_number_counters (
    project_id INT COMMENT 'โครงการ',
    originator_organization_id INT COMMENT 'องค์กรผู้ส่ง',
    correspondence_type_id INT COMMENT 'ประเภทเอกสาร',
    current_year INT COMMENT 'ปี ค.ศ. ของตัวนับ',
    version INT DEFAULT 0 NOT NULL COMMENT 'Optimistic Lock Version',
    last_number INT DEFAULT 0 COMMENT 'เลขที่ล่าสุดที่ใช้ไปแล้ว',
    PRIMARY KEY (
        project_id,
        originator_organization_id,
        correspondence_type_id,
        current_year
    ),
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (originator_organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (correspondence_type_id) REFERENCES correspondence_types(id) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci COMMENT = 'ตารางเก็บ "ตัวนับ" (Running Number) ล่าสุด';
-- =====================================================
-- 10. ⚙️ System & Logs (ระบบและ Log)
-- =====================================================
-- 1.1 JSON Schemas Registry
-- รองรับ: Backend Plan T2.5.1, Req 6.11.1
-- เหตุผล: เพื่อ Validate โครงสร้าง JSON Details ของเอกสารแต่ละประเภทแบบ Centralized
CREATE TABLE IF NOT EXISTS json_schemas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    schema_code VARCHAR(100) NOT NULL UNIQUE COMMENT 'รหัส Schema เช่น RFA_DWG_V1, CORR_GENERIC',
    version INT NOT NULL DEFAULT 1 COMMENT 'เวอร์ชันของ Schema',
    schema_definition JSON NOT NULL COMMENT 'โครงสร้าง JSON Schema (Standard Format)',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_schema_code (schema_code)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;
-- 1.2 User Preferences
-- รองรับ: Req 5.5, 6.8.3
-- เหตุผล: แยกการตั้งค่า Notification และ UI ออกจากตาราง Users หลัก
CREATE TABLE IF NOT EXISTS user_preferences (
    user_id INT PRIMARY KEY,
    notify_email BOOLEAN DEFAULT TRUE,
    notify_line BOOLEAN DEFAULT TRUE,
    digest_mode BOOLEAN DEFAULT FALSE COMMENT 'รับแจ้งเตือนแบบรวม (Digest) แทน Real-time',
    ui_theme VARCHAR(20) DEFAULT 'light',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_user_prefs_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;
-- ตารางเก็บบันทึกการกระทำของผู้ใช้
-- 4.1 Audit Logs Enhancements
-- รองรับ: Req 6.1
-- เหตุผล: รองรับ Distributed Tracing และระบุความรุนแรง
CREATE TABLE audit_logs (
    audit_id BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT 'ID ของ Log',
    request_id VARCHAR(100) NULL COMMENT 'Trace ID linking to app logs',
    user_id INT COMMENT 'ผู้กระทำ',
    action VARCHAR(100) NOT NULL COMMENT 'การกระทำ (เช่น rfa.create, correspondence.update, login.success)',
    severity ENUM('INFO', 'WARN', 'ERROR', 'CRITICAL') DEFAULT 'INFO',
    entity_type VARCHAR(50) COMMENT 'ตาราง/โมดูล (เช่น ''rfa'', ''correspondence'')',
    entity_id VARCHAR(50) COMMENT 'Primary ID ของระเบียนที่ได้รับผลกระทำ',
    details_json JSON COMMENT 'ข้อมูลบริบท',
    ip_address VARCHAR(45) COMMENT 'IP Address',
    user_agent VARCHAR(255) COMMENT 'User Agent',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'เวลาที่กระทำ',
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE
    SET NULL
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci COMMENT = 'ตารางเก็บบันทึกการกระทำของผู้ใช้';
-- ตารางสำหรับจัดการการแจ้งเตือน (Email/Line/System)
CREATE TABLE notifications (
    id INT PRIMARY KEY AUTO_INCREMENT COMMENT 'ID ของการแจ้งเตือน',
    user_id INT NOT NULL COMMENT 'ID ผู้ใช้',
    title VARCHAR(255) NOT NULL COMMENT 'หัวข้อการแจ้งเตือน',
    message TEXT NOT NULL COMMENT 'รายละเอียดการแจ้งเตือน',
    notification_type ENUM('EMAIL', 'LINE', 'SYSTEM') NOT NULL COMMENT 'ประเภท (EMAIL, LINE, SYSTEM)',
    is_read BOOLEAN DEFAULT FALSE COMMENT 'สถานะการอ่าน',
    entity_type VARCHAR(50) COMMENT 'เช่น ''rfa'', ''circulation''',
    entity_id INT COMMENT 'ID ของเอนทิตีที่เกี่ยวข้อง',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'วันที่สร้าง',
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci COMMENT = 'ตารางสำหรับจัดการการแจ้งเตือน (Email/Line/System)';
-- ตารางสำหรับจัดการดัชนีการค้นหาขั้นสูง (Full-text Search)
CREATE TABLE search_indices (
    id INT PRIMARY KEY AUTO_INCREMENT COMMENT 'ID ของดัชนี',
    entity_type VARCHAR(50) NOT NULL COMMENT 'ชนิดเอนทิตี (เช่น ''correspondence'', ''rfa'')',
    entity_id INT NOT NULL COMMENT 'ID ของเอนทิตี',
    content TEXT NOT NULL COMMENT 'เนื้อหาที่จะค้นหา',
    indexed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'วันที่สร้าง/อัปเดตัชนี'
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci COMMENT = 'ตารางสำหรับจัดการดัชนีการค้นหาขั้นสูง (Full-text Search)';
-- ตารางสำหรับบันทึกประวัติการสำรองข้อมูล
CREATE TABLE backup_logs (
    id INT PRIMARY KEY AUTO_INCREMENT COMMENT 'ID ของการสำรอง',
    backup_type ENUM('DATABASE', 'FILES', 'FULL') NOT NULL COMMENT 'ประเภท (DATABASE, FILES, FULL)',
    backup_path VARCHAR(500) NOT NULL COMMENT 'ตำแหน่งไฟล์สำรอง',
    file_size BIGINT COMMENT 'ขนาดไฟล์',
    status ENUM('STARTED', 'COMPLETED', 'FAILED') NOT NULL COMMENT 'สถานะ',
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'เวลาเริ่มต้น',
    completed_at TIMESTAMP NULL COMMENT 'เวลาเสร็จสิ้น',
    error_message TEXT COMMENT 'ข้อความผิดพลาด (ถ้ามี)'
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci COMMENT = 'ตารางสำหรับบันทึกประวัติการสำรองข้อมูล';
-- 4.2 Virtual Columns for JSON Search (ตัวอย่างสำหรับ Correspondence)
-- รองรับ: Backend Plan T2.1, Req 3.11.3
-- เหตุผล: เพิ่มความเร็วในการ Search/Sort ข้อมูลที่อยู่ใน JSON details
-- หมายเหตุ: ต้องมั่นใจว่า MariaDB เวอร์ชัน 10.11+ รองรับ Syntax นี้
-- ตัวอย่าง: ดึง Project ID ที่อ้างอิงใน details ออกมาทำ Index
ALTER TABLE correspondence_revisions
ADD COLUMN v_ref_project_id INT GENERATED ALWAYS AS (
        JSON_UNQUOTE(JSON_EXTRACT(details, '$.projectId'))
    ) VIRTUAL,
    ADD INDEX idx_corr_rev_v_project (v_ref_project_id);
-- ตัวอย่าง: ดึง Document Type ย่อยจาก details
ALTER TABLE correspondence_revisions
ADD COLUMN v_doc_subtype VARCHAR(50) GENERATED ALWAYS AS (JSON_UNQUOTE(JSON_EXTRACT(details, '$.subType'))) VIRTUAL,
    ADD INDEX idx_corr_rev_v_subtype (v_doc_subtype);
-- ทำแบบเดียวกันกับ RFA Revisions หากมีการเก็บ JSON details
ALTER TABLE rfa_revisions
ADD COLUMN details JSON NULL COMMENT 'RFA Specific Details'
AFTER description;
ALTER TABLE rfa_revisions
ADD COLUMN v_ref_drawing_count INT GENERATED ALWAYS AS (
        JSON_UNQUOTE(JSON_EXTRACT(details, '$.drawingCount'))
    ) VIRTUAL;
-- ============================================================
-- 5. PARTITIONING PREPARATION (Advance - Optional)
-- ============================================================
-- หมายเหตุ: การทำ Partitioning บนตารางที่มีอยู่แล้ว (audit_logs, notifications)
-- มักจะต้อง Drop Primary Key เดิม แล้วสร้างใหม่โดยรวม Partition Key (created_at) เข้าไป
-- ขั้นตอนนี้ควรทำแยกต่างหากเมื่อระบบเริ่มมีข้อมูลเยอะ หรือทำใน Maintenance Window
--
-- ตัวอย่าง SQL สำหรับ Audit Logs (Reference Only):
-- ALTER TABLE audit_logs DROP PRIMARY KEY, ADD PRIMARY KEY (audit_id, created_at);
-- ALTER TABLE audit_logs PARTITION BY RANGE (YEAR(created_at)) (
--    PARTITION p2024 VALUES LESS THAN (2025),
--    PARTITION p2025 VALUES LESS THAN (2026),
--    PARTITION p_future VALUES LESS THAN MAXVALUE
-- );
-- =====================================================
-- CREATE INDEXES
-- =====================================================
-- Indexes for document_number_formats
CREATE INDEX idx_document_number_formats_project ON document_number_formats(project_id);
CREATE INDEX idx_document_number_formats_type ON document_number_formats(correspondence_type_id);
CREATE INDEX idx_document_number_formats_project_type ON document_number_formats(project_id, correspondence_type_id);
-- Indexes for document_number_counters
CREATE INDEX idx_document_number_counters_project ON document_number_counters(project_id);
CREATE INDEX idx_document_number_counters_org ON document_number_counters(originator_organization_id);
CREATE INDEX idx_document_number_counters_type ON document_number_counters(correspondence_type_id);
CREATE INDEX idx_document_number_counters_year ON document_number_counters(current_year);
-- Indexes for tags
CREATE INDEX idx_tags_name ON tags(tag_name);
CREATE INDEX idx_tags_created_at ON tags(created_at);
-- Indexes for correspondence_tags
CREATE INDEX idx_correspondence_tags_correspondence ON correspondence_tags(correspondence_id);
CREATE INDEX idx_correspondence_tags_tag ON correspondence_tags(tag_id);
-- Indexes for audit_logs
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX idx_audit_logs_ip ON audit_logs(ip_address);
-- Indexes for notifications
CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_type ON notifications(notification_type);
CREATE INDEX idx_notifications_read ON notifications(is_read);
CREATE INDEX idx_notifications_entity ON notifications(entity_type, entity_id);
CREATE INDEX idx_notifications_created_at ON notifications(created_at);
-- Indexes for search_indices
CREATE INDEX idx_search_indices_entity ON search_indices(entity_type, entity_id);
CREATE INDEX idx_search_indices_indexed_at ON search_indices(indexed_at);
-- Indexes for backup_logs
CREATE INDEX idx_backup_logs_type ON backup_logs(backup_type);
CREATE INDEX idx_backup_logs_status ON backup_logs(status);
CREATE INDEX idx_backup_logs_started_at ON backup_logs(started_at);
CREATE INDEX idx_backup_logs_completed_at ON backup_logs(completed_at);
-- =====================================================
-- Additional Composite Indexes for Performance
-- =====================================================
-- Composite index for document_number_counters for faster lookups
CREATE INDEX idx_doc_counter_composite ON document_number_counters(
    project_id,
    originator_organization_id,
    correspondence_type_id,
    current_year
);
-- Composite index for notifications for user-specific queries
CREATE INDEX idx_notifications_user_unread ON notifications(user_id, is_read, created_at);
-- Composite index for audit_logs for reporting
CREATE INDEX idx_audit_logs_reporting ON audit_logs(created_at, entity_type, action);
-- Composite index for search_indices for entity-based queries
CREATE INDEX idx_search_entities ON search_indices(entity_type, entity_id, indexed_at);
-- สร้าง Index สำหรับ Cleanup Job
CREATE INDEX idx_attachments_temp_cleanup ON attachments(is_temporary, expires_at);
CREATE INDEX idx_attachments_temp_id ON attachments(temp_id);
CREATE INDEX idx_audit_request_id ON audit_logs(request_id);
-- =====================================================
-- SQL Script for LCBP3-DMS (V1.4.0) - MariaDB
-- Generated from Data Dictionary
-- =====================================================
-- =====================================================
-- 11. 📊 Views & Procedures (วิว และ โปรซีเดอร์)
-- =====================================================
-- Stored Procedure ดึงเลขที่เอกสารถัดไป
DELIMITER // CREATE PROCEDURE sp_get_next_document_number(
    IN p_project_id INT,
    IN p_originator_organization_id INT,
    IN p_correspondence_type_id INT,
    IN p_current_year INT,
    OUT p_next_number INT
) BEGIN
DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN -- หากเกิดข้อผิดพลาด ให้ยกเลิก Transaction และส่ง Error กลับไป
    ROLLBACK;
END;
START TRANSACTION;
-- ล็อกแถวเพื่อป้องกัน Race Condition
SELECT last_number INTO p_next_number
FROM document_number_counters
WHERE project_id = p_project_id
    AND originator_organization_id = p_originator_organization_id
    AND correspondence_type_id = p_correspondence_type_id
    AND current_year = p_current_year FOR
UPDATE;
-- ถ้าไม่พบ record ให้สร้างใหม่
IF p_next_number IS NULL THEN
SET p_next_number = 1;
INSERT INTO document_number_counters (
        project_id,
        originator_organization_id,
        correspondence_type_id,
        current_year,
        last_number
    )
VALUES (
        p_project_id,
        p_originator_organization_id,
        p_correspondence_type_id,
        p_current_year,
        p_next_number
    );
ELSE -- อัพเดทเลขที่ล่าสุด
SET p_next_number = p_next_number + 1;
UPDATE document_number_counters
SET last_number = p_next_number
WHERE project_id = p_project_id
    AND originator_organization_id = p_originator_organization_id
    AND correspondence_type_id = p_correspondence_type_id
    AND current_year = p_current_year;
END IF;
COMMIT;
END // DELIMITER;
-- View แสดง Revision "ปัจจุบัน" ของ correspondences ทั้งหมด (ที่ไม่ใช่ RFA)
CREATE VIEW v_current_correspondences AS
SELECT c.id AS correspondence_id,
    c.correspondence_number,
    c.correspondence_type_id,
    ct.type_code AS correspondence_type_code,
    ct.type_name AS correspondence_type_name,
    c.project_id,
    p.project_code,
    p.project_name,
    c.originator_id,
    org.organization_code AS originator_code,
    org.organization_name AS originator_name,
    cr.id AS revision_id,
    cr.revision_number,
    cr.revision_label,
    cr.title,
    cr.document_date,
    cr.issued_date,
    cr.received_date,
    cr.due_date,
    cr.correspondence_status_id,
    cs.status_code,
    cs.status_name,
    cr.created_by,
    u.username AS created_by_username,
    cr.created_at AS revision_created_at
FROM correspondences c
    INNER JOIN correspondence_types ct ON c.correspondence_type_id = ct.id
    INNER JOIN projects p ON c.project_id = p.id
    LEFT JOIN organizations org ON c.originator_id = org.id
    INNER JOIN correspondence_revisions cr ON c.id = cr.correspondence_id
    INNER JOIN correspondence_status cs ON cr.correspondence_status_id = cs.id
    LEFT JOIN users u ON cr.created_by = u.user_id
WHERE cr.is_current = TRUE
    AND c.correspondence_type_id NOT IN (
        SELECT id
        FROM correspondence_types
        WHERE type_code = 'RFA'
    )
    AND c.deleted_at IS NULL;
-- View แสดง Revision "ปัจจุบัน" ของ rfa_revisions ทั้งหมด
CREATE VIEW v_current_rfas AS
SELECT r.id AS rfa_id,
    r.rfa_type_id,
    rt.type_code AS rfa_type_code,
    rt.type_name AS rfa_type_name,
    rr.correspondence_id,
    c.correspondence_number,
    c.project_id,
    p.project_code,
    p.project_name,
    c.originator_id,
    org.organization_name AS originator_name,
    rr.id AS revision_id,
    rr.revision_number,
    rr.revision_label,
    rr.title,
    rr.document_date,
    rr.issued_date,
    rr.received_date,
    rr.approved_date,
    rr.rfa_status_code_id,
    rsc.status_code AS rfa_status_code,
    rsc.status_name AS rfa_status_name,
    rr.rfa_approve_code_id,
    rac.approve_code AS rfa_approve_code,
    rac.approve_name AS rfa_approve_name,
    rr.created_by,
    u.username AS created_by_username,
    rr.created_at AS revision_created_at
FROM rfas r
    INNER JOIN rfa_types rt ON r.rfa_type_id = rt.id
    INNER JOIN rfa_revisions rr ON r.id = rr.rfa_id
    INNER JOIN correspondences c ON rr.correspondence_id = c.id
    INNER JOIN projects p ON c.project_id = p.id
    INNER JOIN organizations org ON c.originator_id = org.id
    INNER JOIN rfa_status_codes rsc ON rr.rfa_status_code_id = rsc.id
    LEFT JOIN rfa_approve_codes rac ON rr.rfa_approve_code_id = rac.id
    LEFT JOIN users u ON rr.created_by = u.user_id
WHERE rr.is_current = TRUE
    AND r.deleted_at IS NULL
    AND c.deleted_at IS NULL;
-- View แสดงความสัมพันธ์ทั้งหมดระหว่าง Contract, Project, และ Organization
CREATE VIEW v_contract_parties_all AS
SELECT c.id AS contract_id,
    c.contract_code,
    c.contract_name,
    p.id AS project_id,
    p.project_code,
    p.project_name,
    o.id AS organization_id,
    o.organization_code,
    o.organization_name,
    co.role_in_contract
FROM contracts c
    INNER JOIN projects p ON c.project_id = p.id
    INNER JOIN contract_organizations co ON c.id = co.contract_id
    INNER JOIN organizations o ON co.organization_id = o.id
WHERE c.is_active = TRUE;
-- View แสดงรายการ "งานของฉัน" (My Tasks) ที่ยังไม่เสร็จ
CREATE VIEW v_user_tasks AS
SELECT cr.id AS routing_id,
    c.id AS circulation_id,
    c.circulation_no,
    c.circulation_subject,
    c.correspondence_id,
    corr.correspondence_number,
    corr.project_id,
    p.project_code,
    p.project_name,
    cr.assigned_to AS user_id,
    u.username,
    u.first_name,
    u.last_name,
    cr.organization_id,
    org.organization_name,
    cr.step_number,
    cr.status AS task_status,
    cr.comments,
    cr.completed_at,
    cr.created_at AS assigned_at,
    c.created_at AS circulation_created_at
FROM circulation_routings cr
    INNER JOIN circulations c ON cr.circulation_id = c.id
    INNER JOIN correspondences corr ON c.correspondence_id = corr.id
    INNER JOIN projects p ON corr.project_id = p.id
    INNER JOIN organizations org ON cr.organization_id = org.id
    INNER JOIN users u ON cr.assigned_to = u.user_id
WHERE cr.status IN ('PENDING', 'IN_PROGRESS')
    AND cr.assigned_to IS NOT NULL;
-- View แสดง audit_logs พร้อมข้อมูล username และ email ของผู้กระทำ
CREATE VIEW v_audit_log_details AS
SELECT al.audit_id,
    al.user_id,
    u.username,
    u.email,
    u.first_name,
    u.last_name,
    al.action,
    al.entity_type,
    al.entity_id,
    al.details_json,
    al.ip_address,
    al.user_agent,
    al.created_at
FROM audit_logs al
    LEFT JOIN users u ON al.user_id = u.user_id;
-- View รวมสิทธิ์ทั้งหมด (Global + Project) ของผู้ใช้ทุกคน
CREATE VIEW v_user_all_permissions AS -- Global Permissions
SELECT ua.user_id,
    ua.role_id,
    r.role_name,
    rp.permission_id,
    p.permission_name,
    p.module,
    p.scope_level,
    ua.organization_id,
    NULL AS project_id,
    NULL AS contract_id,
    'GLOBAL' AS permission_scope
FROM user_assignments ua
    INNER JOIN roles r ON ua.role_id = r.role_id
    INNER JOIN role_permissions rp ON ua.role_id = rp.role_id
    INNER JOIN permissions p ON rp.permission_id = p.permission_id -- Global scope
WHERE p.is_active = 1
    AND ua.organization_id IS NULL
    AND ua.project_id IS NULL
    AND ua.contract_id IS NULL
UNION ALL
-- Organization-specific Permissions
SELECT ua.user_id,
    ua.role_id,
    r.role_name,
    rp.permission_id,
    p.permission_name,
    p.module,
    p.scope_level,
    ua.organization_id,
    NULL AS project_id,
    NULL AS contract_id,
    'ORGANIZATION' AS permission_scope
FROM user_assignments ua
    INNER JOIN roles r ON ua.role_id = r.role_id
    INNER JOIN role_permissions rp ON ua.role_id = rp.role_id
    INNER JOIN permissions p ON rp.permission_id = p.permission_id -- Organization scope
WHERE p.is_active = 1
    AND ua.organization_id IS NOT NULL
    AND ua.project_id IS NULL
    AND ua.contract_id IS NULL
UNION ALL
-- Project-specific Permissions
SELECT ua.user_id,
    ua.role_id,
    r.role_name,
    rp.permission_id,
    p.permission_name,
    p.module,
    p.scope_level,
    ua.organization_id,
    ua.project_id,
    NULL AS contract_id,
    'PROJECT' AS permission_scope
FROM user_assignments ua
    INNER JOIN roles r ON ua.role_id = r.role_id
    INNER JOIN role_permissions rp ON ua.role_id = rp.role_id
    INNER JOIN permissions p ON rp.permission_id = p.permission_id -- Project scope
WHERE p.is_active = 1
    AND ua.project_id IS NOT NULL
    AND ua.contract_id IS NULL
UNION ALL
-- Contract-specific Permissions
SELECT ua.user_id,
    ua.role_id,
    r.role_name,
    rp.permission_id,
    p.permission_name,
    p.module,
    p.scope_level,
    ua.organization_id,
    ua.project_id,
    ua.contract_id,
    'CONTRACT' AS permission_scope
FROM user_assignments ua
    INNER JOIN roles r ON ua.role_id = r.role_id
    INNER JOIN role_permissions rp ON ua.role_id = rp.role_id
    INNER JOIN permissions p ON rp.permission_id = p.permission_id -- Contract scope
WHERE p.is_active = 1
    AND ua.contract_id IS NOT NULL;
-- =====================================================
-- Additional Useful Views
-- =====================================================
-- View แสดงเอกสารทั้งหมดที่มีไฟล์แนบ
CREATE VIEW v_documents_with_attachments AS
SELECT 'CORRESPONDENCE' AS document_type,
    c.id AS document_id,
    c.correspondence_number AS document_number,
    c.project_id,
    p.project_code,
    p.project_name,
    COUNT(ca.attachment_id) AS attachment_count,
    MAX(a.created_at) AS latest_attachment_date
FROM correspondences c
    INNER JOIN projects p ON c.project_id = p.id
    LEFT JOIN correspondence_attachments ca ON c.id = ca.correspondence_id
    LEFT JOIN attachments a ON ca.attachment_id = a.id
WHERE c.deleted_at IS NULL
GROUP BY c.id,
    c.correspondence_number,
    c.project_id,
    p.project_code,
    p.project_name
UNION ALL
SELECT 'CIRCULATION' AS document_type,
    circ.id AS document_id,
    circ.circulation_no AS document_number,
    corr.project_id,
    p.project_code,
    p.project_name,
    COUNT(ca.attachment_id) AS attachment_count,
    MAX(a.created_at) AS latest_attachment_date
FROM circulations circ
    INNER JOIN correspondences corr ON circ.correspondence_id = corr.id
    INNER JOIN projects p ON corr.project_id = p.id
    LEFT JOIN circulation_attachments ca ON circ.id = ca.circulation_id
    LEFT JOIN attachments a ON ca.attachment_id = a.id
GROUP BY circ.id,
    circ.circulation_no,
    corr.project_id,
    p.project_code,
    p.project_name
UNION ALL
SELECT 'SHOP_DRAWING' AS document_type,
    sdr.id AS document_id,
    sd.drawing_number AS document_number,
    sd.project_id,
    p.project_code,
    p.project_name,
    COUNT(sdra.attachment_id) AS attachment_count,
    MAX(a.created_at) AS latest_attachment_date
FROM shop_drawing_revisions sdr
    INNER JOIN shop_drawings sd ON sdr.shop_drawing_id = sd.id
    INNER JOIN projects p ON sd.project_id = p.id
    LEFT JOIN shop_drawing_revision_attachments sdra ON sdr.id = sdra.shop_drawing_revision_id
    LEFT JOIN attachments a ON sdra.attachment_id = a.id
WHERE sd.deleted_at IS NULL
GROUP BY sdr.id,
    sd.drawing_number,
    sd.project_id,
    p.project_code,
    p.project_name
UNION ALL
SELECT 'CONTRACT_DRAWING' AS document_type,
    cd.id AS document_id,
    cd.condwg_no AS document_number,
    cd.project_id,
    p.project_code,
    p.project_name,
    COUNT(cda.attachment_id) AS attachment_count,
    MAX(a.created_at) AS latest_attachment_date
FROM contract_drawings cd
    INNER JOIN projects p ON cd.project_id = p.id
    LEFT JOIN contract_drawing_attachments cda ON cd.id = cda.contract_drawing_id
    LEFT JOIN attachments a ON cda.attachment_id = a.id
WHERE cd.deleted_at IS NULL
GROUP BY cd.id,
    cd.condwg_no,
    cd.project_id,
    p.project_code,
    p.project_name;
-- View แสดงสถิติเอกสารตามประเภทและสถานะ
CREATE VIEW v_document_statistics AS
SELECT p.id AS project_id,
    p.project_code,
    p.project_name,
    ct.id AS correspondence_type_id,
    ct.type_code,
    ct.type_name,
    cs.id AS status_id,
    cs.status_code,
    cs.status_name,
    COUNT(DISTINCT c.id) AS document_count,
    COUNT(DISTINCT cr.id) AS revision_count
FROM projects p
    CROSS JOIN correspondence_types ct
    CROSS JOIN correspondence_status cs
    LEFT JOIN correspondences c ON p.id = c.project_id
    AND ct.id = c.correspondence_type_id
    LEFT JOIN correspondence_revisions cr ON c.id = cr.correspondence_id
    AND cs.id = cr.correspondence_status_id
    AND cr.is_current = TRUE
WHERE p.is_active = 1
    AND ct.is_active = 1
    AND cs.is_active = 1
GROUP BY p.id,
    p.project_code,
    p.project_name,
    ct.id,
    ct.type_code,
    ct.type_name,
    cs.id,
    cs.status_code,
    cs.status_name;
-- =====================================================
-- Indexes for View Performance Optimization
-- =====================================================
-- Indexes for v_current_correspondences performance
CREATE INDEX idx_correspondences_type_project ON correspondences(correspondence_type_id, project_id);
CREATE INDEX idx_corr_revisions_current_status ON correspondence_revisions(is_current, correspondence_status_id);
CREATE INDEX idx_corr_revisions_correspondence_current ON correspondence_revisions(correspondence_id, is_current);
-- Indexes for v_current_rfas performance
CREATE INDEX idx_rfa_revisions_current_status ON rfa_revisions(is_current, rfa_status_code_id);
CREATE INDEX idx_rfa_revisions_rfa_current ON rfa_revisions(rfa_id, is_current);
-- Indexes for v_user_tasks performance
CREATE INDEX idx_circulation_routings_status_assigned ON circulation_routings(status, assigned_to);
CREATE INDEX idx_circulation_routings_circulation_status ON circulation_routings(circulation_id, status);
-- Indexes for document statistics performance
CREATE INDEX idx_correspondences_project_type ON correspondences(project_id, correspondence_type_id);
CREATE INDEX idx_corr_revisions_status_current ON correspondence_revisions(correspondence_status_id, is_current);
SET FOREIGN_KEY_CHECKS = 1;