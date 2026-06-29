-- ==========================================================
-- DMS v1.8.0 Document Management System Database
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
-- [v1.8.0 UPDATE] Prepare migration
-- Update: Upgraded from v1.7.0
-- Last Updated: 2026-02-27
-- Major Changes:
--   1. ปรับปรุง:
--     1.1 TABLE correspondences
--       - INDEX idx_doc_number (correspondence_number),
--       - INDEX idx_deleted_at (deleted_at),
--       - INDEX idx_created_by (created_by),
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

-- DROP PROCEDURE IF EXISTS sp_get_next_document_number;
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
DROP TABLE IF EXISTS user_preferences;

-- [NEW v1.4.2] ตารางเก็บ Schema สำหรับ Validate JSON (Stand-alone)
DROP TABLE IF EXISTS json_schemas;

-- [v1.5.1 NEW] ตาราง Audit และ Error Log สำหรับ Document Numbering
DROP TABLE IF EXISTS document_number_errors;

DROP TABLE IF EXISTS document_number_audit;

DROP TABLE IF EXISTS document_number_reservations;

-- ============================================================
-- ส่วนที่ 2: ตาราง Junction (เชื่อมโยงข้อมูล M:N)
-- ============================================================
DROP TABLE IF EXISTS correspondence_tags;

DROP TABLE IF EXISTS asbuilt_revision_shop_revisions_refs;

DROP TABLE IF EXISTS shop_drawing_revision_contract_refs;

DROP TABLE IF EXISTS contract_drawing_subcat_cat_maps;

-- ============================================================
-- ส่วนที่ 3: ตารางไฟล์แนบและการเชื่อมโยง (Attachments)
-- ============================================================
DROP TABLE IF EXISTS contract_drawing_attachments;

DROP TABLE IF EXISTS circulation_attachments;

DROP TABLE IF EXISTS shop_drawing_revision_attachments;

DROP TABLE IF EXISTS asbuilt_drawing_revision_attachments;

DROP TABLE IF EXISTS correspondence_attachments;

DROP TABLE IF EXISTS attachments;

-- ตารางหลักเก็บ path ไฟล์
-- ============================================================
-- ส่วนที่ 4: ตาราง Workflow & Routing (Process Logic)
-- ============================================================
-- Correspondence Workflow
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

DROP TABLE IF EXISTS asbuilt_drawing_revisions;

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

DROP TABLE IF EXISTS asbuilt_drawings;

DROP TABLE IF EXISTS rfas;

DROP TABLE IF EXISTS correspondences;

-- ============================================================
-- ส่วนที่ 8: ตารางหมวดหมู่และข้อมูลหลัก (Master Data)
-- ============================================================
-- [NEW 6B] ลบตารางใหม่ที่เพิ่มเข้ามาเพื่อป้องกัน Error เวลา Re-deploy
DROP TABLE IF EXISTS correspondence_sub_types;

DROP TABLE IF EXISTS disciplines;

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

DROP TABLE IF EXISTS refresh_tokens;

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
  role_name VARCHAR(20) NOT NULL UNIQUE COMMENT 'ชื่อบทบาท (OWNER, DESIGNER, CONSULTANT, CONTRACTOR, THIRD PARTY)',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'วันที่สร้าง',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'วันที่แก้ไขล่าสุด',
  deleted_at DATETIME NULL COMMENT 'วันที่ลบ (Soft Delete)'
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci COMMENT = 'ตาราง Master เก็บประเภทบทบาทขององค์กร';

-- ตาราง Master เก็บข้อมูลองค์กรทั้งหมดที่เกี่ยวข้องในระบบ
CREATE TABLE organizations (
  id INT PRIMARY KEY AUTO_INCREMENT COMMENT 'ID ของตาราง',
  organization_code VARCHAR(20) NOT NULL UNIQUE COMMENT 'รหัสองค์กร',
  organization_name VARCHAR(255) NOT NULL COMMENT 'ชื่อองค์กร',
  role_id INT COMMENT 'บทบาทขององค์กร',
  is_active BOOLEAN DEFAULT TRUE COMMENT 'สถานะการใช้งาน',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'วันที่สร้าง',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'วันที่แก้ไขล่าสุด',
  deleted_at DATETIME NULL COMMENT 'วันที่ลบ (Soft Delete)',
  FOREIGN KEY (role_id) REFERENCES organization_roles (id) ON DELETE
  SET NULL
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci COMMENT = 'ตาราง Master เก็บข้อมูลองค์กรทั้งหมดที่เกี่ยวข้องในระบบ';

-- ตาราง Master เก็บข้อมูลโครงการ
CREATE TABLE projects (
  id INT PRIMARY KEY AUTO_INCREMENT COMMENT 'ID ของตาราง',
  project_code VARCHAR(50) NOT NULL UNIQUE COMMENT 'รหัสโครงการ',
  project_name VARCHAR(255) NOT NULL COMMENT 'ชื่อโครงการ',
  -- parent_project_id INT COMMENT 'รหัสโครงการหลัก (ถ้ามี)',
  -- contractor_organization_id INT COMMENT 'รหัสองค์กรผู้รับเหมา (ถ้ามี)',
  is_active TINYINT(1) DEFAULT 1 COMMENT 'สถานะการใช้งาน',
  -- FOREIGN KEY (parent_project_id) REFERENCES projects(id) ON DELETE SET NULL,
  -- FOREIGN KEY (contractor_organization_id) REFERENCES organizations(id) ON DELETE SET NULL
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'วันที่สร้าง',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'วันที่แก้ไขล่าสุด',
  deleted_at DATETIME NULL COMMENT 'วันที่ลบ (Soft Delete)'
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci COMMENT = 'ตาราง Master เก็บข้อมูลโครงการ';

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
  deleted_at DATETIME NULL COMMENT 'วันที่ลบ (Soft Delete)',
  FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci COMMENT = 'ตาราง Master เก็บข้อมูลสัญญา';

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
  deleted_at DATETIME NULL DEFAULT NULL COMMENT 'วันที่ลบ',
  FOREIGN KEY (primary_organization_id) REFERENCES organizations (id) ON DELETE
  SET NULL
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci COMMENT = 'ตาราง Master เก็บข้อมูลผู้ใช้งาน (User)';

-- ตารางเก็บ Refresh Tokens สำหรับ Authentication
CREATE TABLE refresh_tokens (
  token_id INT PRIMARY KEY AUTO_INCREMENT COMMENT 'ID ของตาราง',
  user_id INT NOT NULL COMMENT 'เจ้าของ Token',
  token_hash VARCHAR(255) NOT NULL COMMENT 'Hash ของ Refresh Token',
  expires_at DATETIME NOT NULL COMMENT 'วันหมดอายุ',
  is_revoked TINYINT(1) DEFAULT 0 COMMENT 'สถานะยกเลิก (1=Revoked)',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'วันที่สร้าง',
  replaced_by_token VARCHAR(255) NULL COMMENT 'Token ใหม่ที่มาแทนที่ (Rotation)',
  FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci COMMENT = 'ตารางเก็บ Refresh Tokens สำหรับ Authentication';

-- ตาราง Master เก็บ "บทบาท" ของผู้ใช้ในระบบ
CREATE TABLE roles (
  role_id INT PRIMARY KEY AUTO_INCREMENT COMMENT 'ID ของตาราง',
  -- role_code VARCHAR(50) NOT NULL UNIQUE COMMENT 'รหัสบทบาท (เช่น SUPER_ADMIN, ADMIN, EDITOR, VIEWER)',
  role_name VARCHAR(100) NOT NULL COMMENT 'ชื่อบทบาท',
  scope ENUM(
    'Global',
    'Organization',
    'Project',
    'Contract'
  ) NOT NULL,
  -- ขอบเขตของบทบาท (จากข้อ 4.3)
  description TEXT COMMENT 'คำอธิบายบทบาท',
  is_system BOOLEAN DEFAULT FALSE COMMENT '(1 = บทบาทของระบบ ลบไม่ได้)',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'วันที่สร้าง',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'วันที่แก้ไขล่าสุด',
  deleted_at DATETIME NULL COMMENT 'วันที่ลบ (Soft Delete)'
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci COMMENT = 'ตาราง Master เก็บ "บทบาท" ของผู้ใช้ในระบบ';

-- ตาราง Master เก็บ "สิทธิ์" (Permission) หรือ "การกระทำ" ทั้งหมดในระบบ
CREATE TABLE permissions (
  permission_id INT PRIMARY KEY AUTO_INCREMENT COMMENT 'ID ของตาราง',
  permission_name VARCHAR(100) NOT NULL UNIQUE COMMENT 'รหัสสิทธิ์ (เช่น rfas.create, rfas.view)',
  description TEXT COMMENT 'คำอธิบายสิทธิ์',
  module VARCHAR(50) COMMENT 'โมดูลที่เกี่ยวข้อง',
  scope_level ENUM('GLOBAL', 'ORG', 'PROJECT') COMMENT 'ระดับขอบเขตของสิทธิ์',
  is_active TINYINT(1) DEFAULT 1 COMMENT 'สถานะการใช้งาน',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'วันที่สร้าง',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'วันที่แก้ไขล่าสุด',
  deleted_at DATETIME NULL COMMENT 'วันที่ลบ (Soft Delete)'
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci COMMENT = 'ตาราง Master เก็บ "สิทธิ์" (Permission) หรือ "การกระทำ" ทั้งหมดในระบบ';

-- ตารางเชื่อมระหว่าง roles และ permissions (M:N)
CREATE TABLE role_permissions (
  role_id INT COMMENT 'ID ของบทบาท',
  permission_id INT COMMENT 'ID ของสิทธิ์',
  PRIMARY KEY (role_id, permission_id),
  FOREIGN KEY (role_id) REFERENCES roles (role_id) ON DELETE CASCADE,
  FOREIGN KEY (permission_id) REFERENCES permissions (permission_id) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci COMMENT = 'ตารางเชื่อมระหว่าง roles และ permissions (M :N)';

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
  FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE,
  FOREIGN KEY (role_id) REFERENCES roles (role_id) ON DELETE CASCADE,
  FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE,
  FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE,
  FOREIGN KEY (contract_id) REFERENCES contracts (id) ON DELETE CASCADE,
  FOREIGN KEY (assigned_by_user_id) REFERENCES users (user_id),
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
  FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE,
  FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE
);

CREATE TABLE contract_organizations (
  contract_id INT NOT NULL,
  organization_id INT NOT NULL,
  role_in_contract VARCHAR(100),
  -- เช่น 'Owner', 'Designer', 'Consultant', 'Contractor '
  PRIMARY KEY (contract_id, organization_id),
  FOREIGN KEY (contract_id) REFERENCES contracts (id) ON DELETE CASCADE,
  FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE
);

-- =====================================================
-- 3. ✉️ Correspondences (เอกสารหลัก, Revisions)
-- =====================================================
-- ตารางเก็บข้อมูลสาขางาน (Disciplines) แยกตามสัญญา
CREATE TABLE disciplines (
  id INT PRIMARY KEY AUTO_INCREMENT COMMENT 'ID ของตาราง',
  contract_id INT NOT NULL COMMENT 'ผูกกับสัญญา',
  discipline_code VARCHAR(10) NOT NULL COMMENT 'รหัสสาขา (เช่น GEN, STR)',
  code_name_th VARCHAR(255) COMMENT 'ชื่อไทย',
  code_name_en VARCHAR(255) COMMENT 'ชื่ออังกฤษ',
  is_active TINYINT(1) DEFAULT 1 COMMENT 'สถานะการใช้งาน',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (contract_id) REFERENCES contracts (id) ON DELETE CASCADE,
  UNIQUE KEY uk_discipline_contract (contract_id, discipline_code)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci COMMENT = 'ตารางเก็บข้อมูลสาขางาน (Disciplines) ตาม Req 6B';

-- ตาราง Master เก็บประเภทเอกสารโต้ตอบ
CREATE TABLE correspondence_types (
  id INT PRIMARY KEY AUTO_INCREMENT COMMENT 'ID ของตาราง',
  type_code VARCHAR(50) NOT NULL UNIQUE COMMENT 'รหัสประเภท (เช่น RFA, RFI)',
  type_name VARCHAR(255) NOT NULL COMMENT 'ชื่อประเภท',
  sort_order INT DEFAULT 0 COMMENT 'ลำดับการแสดงผล',
  is_active TINYINT(1) DEFAULT 1 COMMENT 'สถานะการใช้งาน ',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'วันที่สร้าง',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'วันที่แก้ไขล่าสุด',
  deleted_at DATETIME NULL COMMENT 'วันที่ลบ (Soft Delete)'
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci COMMENT = 'ตาราง Master เก็บประเภทเอกสารโต้ตอบ';

-- ตารางเก็บประเภทหนังสือย่อย (Sub Types) สำหรับ Mapping เลขรหัส
CREATE TABLE correspondence_sub_types (
  id INT PRIMARY KEY AUTO_INCREMENT COMMENT 'ID ของตาราง',
  contract_id INT NOT NULL COMMENT 'ผูกกับสัญญา',
  correspondence_type_id INT NOT NULL COMMENT 'ผูกกับประเภทเอกสารหลัก (เช่น RFA)',
  sub_type_code VARCHAR(20) NOT NULL COMMENT 'รหัสย่อย (เช่น MAT, SHP)',
  sub_type_name VARCHAR(255) COMMENT 'ชื่อประเภทหนังสือย่อย',
  sub_type_number VARCHAR(10) COMMENT 'เลขรหัสสำหรับ Running Number (เช่น 11, 22)',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (contract_id) REFERENCES contracts (id) ON DELETE CASCADE,
  FOREIGN KEY (correspondence_type_id) REFERENCES correspondence_types (id) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci COMMENT = 'ตารางเก็บประเภทหนังสือย่อย (Sub Types) ตาม Req 6B';

-- ตาราง Master เก็บสถานะของเอกสาร
CREATE TABLE correspondence_status (
  id INT PRIMARY KEY AUTO_INCREMENT COMMENT 'ID ของตาราง',
  status_code VARCHAR(50) NOT NULL UNIQUE COMMENT 'รหัสสถานะหนังสือ (เช่น DRAFT, SUBOWN)',
  status_name VARCHAR(255) NOT NULL COMMENT 'ชื่อสถานะหนังสือ',
  sort_order INT DEFAULT 0 COMMENT 'ลำดับการแสดงผล',
  is_active TINYINT(1) DEFAULT 1 COMMENT 'สถานะการใช้งาน '
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci COMMENT = 'ตาราง Master เก็บสถานะของเอกสาร';

-- ตาราง "แม่" ของเอกสารโต้ตอบ เก็บข้อมูลที่ไม่เปลี่ยนตาม Revision
CREATE TABLE correspondences (
  id INT PRIMARY KEY AUTO_INCREMENT COMMENT 'ID ของตาราง (นี่คือ "Master ID" ที่ใช้เชื่อมโยง)',
  correspondence_type_id INT NOT NULL COMMENT 'ประเภทเอกสาร ใช้แบ่งแยกว่าเป็น RFA หรือ อื่นๆ',
  correspondence_number VARCHAR(100) NOT NULL COMMENT 'เลขที่เอกสาร (สร้างจาก DocumentNumberingModule)',
  discipline_id INT NULL COMMENT 'สาขางาน (ถ้ามี)',
  is_internal_communication TINYINT(1) DEFAULT 0 COMMENT '(1 = ภายใน, 0 = ภายนอก)',
  project_id INT NOT NULL COMMENT 'อยู่ในโครงการ',
  originator_id INT COMMENT 'องค์กรผู้ส่ง',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT 'วันที่สร้าง',
  created_by INT COMMENT 'ผู้สร้าง',
  deleted_at DATETIME NULL COMMENT 'สำหรับ Soft Delete',
  INDEX idx_corr_number (correspondence_number),
  INDEX idx_deleted_at (deleted_at),
  INDEX idx_created_by (created_by),
  FOREIGN KEY (correspondence_type_id) REFERENCES correspondence_types (id) ON DELETE RESTRICT,
  FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE,
  FOREIGN KEY (originator_id) REFERENCES organizations (id) ON DELETE
  SET NULL,
    FOREIGN KEY (created_by) REFERENCES users (user_id) ON DELETE
  SET NULL,
    -- Foreign Key ที่รวมเข้ามาจาก ALTER (ระบุชื่อ Constraint ตามที่ต้องการ)
    CONSTRAINT fk_corr_discipline FOREIGN KEY (discipline_id) REFERENCES disciplines (id) ON DELETE
  SET NULL,
    UNIQUE KEY uq_corr_no_per_project (project_id, correspondence_number)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci COMMENT = 'ตาราง "แม่" ของเอกสารโต้ตอบ เก็บข้อมูลที่ไม่เปลี่ยนตาม Revision';

-- ตารางเชื่อมผู้รับ (TO/CC) สำหรับเอกสารแต่ละฉบับ (M:N)
CREATE TABLE correspondence_recipients (
  correspondence_id INT COMMENT 'ID ของเอกสาร',
  recipient_organization_id INT COMMENT 'ID องค์กรผู้รับ',
  recipient_type ENUM('TO', 'CC ') COMMENT 'ประเภทผู้รับ (TO หรือ CC)',
  PRIMARY KEY (
    correspondence_id,
    recipient_organization_id,
    recipient_type
  ),
  FOREIGN KEY (correspondence_id) REFERENCES correspondences (id) ON DELETE CASCADE,
  FOREIGN KEY (recipient_organization_id) REFERENCES organizations (id) ON DELETE RESTRICT
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci COMMENT = 'ตารางเชื่อมผู้รับ (TO / CC) สำหรับเอกสารแต่ละฉบับ (M :N)';

-- ตาราง "ลูก" เก็บประวัติการแก้ไข (Revisions) ของ correspondences (1:N)
CREATE TABLE correspondence_revisions (
  id INT PRIMARY KEY AUTO_INCREMENT COMMENT 'ID ของ Revision',
  correspondence_id INT NOT NULL COMMENT 'Master ID',
  revision_number INT NOT NULL COMMENT 'หมายเลข Revision (0, 1, 2...)',
  revision_label VARCHAR(10) COMMENT 'Revision ที่แสดง (เช่น A, B, 1.1)',
  is_current BOOLEAN DEFAULT FALSE COMMENT '(1 = Revision ปัจจุบัน)',
  -- ข้อมูลเนื้อหาที่เปลี่ยนได้
  correspondence_status_id INT NOT NULL COMMENT 'สถานะของ Revision นี้',
  subject VARCHAR(500) NOT NULL COMMENT 'หัวข้อเรื่อง',
  description TEXT COMMENT 'คำอธิบายการแก้ไขใน Revision นี้',
  body TEXT NULL COMMENT 'เนื้อความ (ถ้ามี)',
  remarks TEXT COMMENT 'หมายเหตุ',
  document_date DATE COMMENT 'วันที่ในเอกสาร',
  issued_date DATETIME COMMENT 'วันที่ออกเอกสาร',
  received_date DATETIME COMMENT 'วันที่ลงรับเอกสาร',
  due_date DATETIME COMMENT 'วันที่ครบกำหนด',
  -- Standard Meta Columns
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT 'วันที่สร้างเอกสาร',
  created_by INT COMMENT 'ผู้สร้าง',
  updated_by INT COMMENT 'ผู้แก้ไขล่าสุด',
  -- ส่วนของ JSON และ Schema Version
  details JSON COMMENT 'ข้อมูลเฉพาะ (เช่น LETTET details)',
  schema_version INT DEFAULT 1 COMMENT 'เวอร์ชันของ Schema ที่ใช้กับ details',
  -- Generated Virtual Columns (ดึงค่าจาก JSON โดยอัตโนมัติ)
  v_ref_project_id INT GENERATED ALWAYS AS (
    CAST(
      JSON_UNQUOTE(JSON_EXTRACT(details, '$.projectId')) AS UNSIGNED
    )
  ) VIRTUAL COMMENT 'Virtual Column: Project ID จาก JSON',
  v_doc_subtype VARCHAR(50) GENERATED ALWAYS AS (
    JSON_UNQUOTE(JSON_EXTRACT(details, '$.subType'))
  ) VIRTUAL COMMENT 'Virtual Column: Document Subtype จาก JSON',
  FOREIGN KEY (correspondence_id) REFERENCES correspondences (id) ON DELETE CASCADE,
  FOREIGN KEY (correspondence_status_id) REFERENCES correspondence_status (id) ON DELETE RESTRICT,
  FOREIGN KEY (created_by) REFERENCES users (user_id) ON DELETE
  SET NULL,
    FOREIGN KEY (updated_by) REFERENCES users (user_id) ON DELETE
  SET NULL,
    UNIQUE KEY uq_master_revision_number (correspondence_id, revision_number),
    UNIQUE KEY uq_master_current (correspondence_id, is_current),
    INDEX idx_corr_rev_v_project (v_ref_project_id),
    INDEX idx_corr_rev_v_subtype (v_doc_subtype)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci COMMENT = 'ตาราง "ลูก" เก็บประวัติการแก้ไข (Revisions) ของ correspondences (1 :N)';

-- ตาราง Master เก็บ Tags ทั้งหมดที่ใช้ในระบบ
CREATE TABLE tags (
  id INT PRIMARY KEY AUTO_INCREMENT COMMENT 'ID ของตาราง',
  tag_name VARCHAR(100) NOT NULL UNIQUE COMMENT 'ชื่อ Tag',
  description TEXT COMMENT 'คำอธิบายแท็ก',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'วันที่สร้าง',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'วันที่แก้ไขล่าสุด '
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci COMMENT = 'ตาราง Master เก็บ Tags ทั้งหมดที่ใช้ในระบบ';

-- ตารางเชื่อมระหว่าง correspondences และ tags (M:N)
CREATE TABLE correspondence_tags (
  correspondence_id INT COMMENT 'ID ของเอกสาร',
  tag_id INT COMMENT 'ID ของ Tag',
  PRIMARY KEY (correspondence_id, tag_id),
  FOREIGN KEY (correspondence_id) REFERENCES correspondences (id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES tags (id) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci COMMENT = 'ตารางเชื่อมระหว่าง correspondences และ tags (M :N)';

-- ตารางเชื่อมการอ้างอิงระหว่างเอกสาร (M:N)
CREATE TABLE correspondence_references (
  src_correspondence_id INT COMMENT 'ID เอกสารต้นทาง',
  tgt_correspondence_id INT COMMENT 'ID เอกสารเป้าหมาย',
  PRIMARY KEY (
    src_correspondence_id,
    tgt_correspondence_id
  ),
  FOREIGN KEY (src_correspondence_id) REFERENCES correspondences (id) ON DELETE CASCADE,
  FOREIGN KEY (tgt_correspondence_id) REFERENCES correspondences (id) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci COMMENT = 'ตารางเชื่อมการอ้างอิงระหว่างเอกสาร (M :N)';

-- =====================================================
-- 4. 📐 approval: RFA (เอกสารขออนุมัติ, Workflows)
-- =====================================================
-- ตาราง Master สำหรับประเภท RFA
CREATE TABLE rfa_types (
  id INT PRIMARY KEY NOT NULL AUTO_INCREMENT COMMENT 'ID ของตาราง',
  contract_id INT NOT NULL COMMENT 'ผูกกับสัญญา',
  type_code VARCHAR(20) NOT NULL COMMENT 'รหัสประเภท RFA (เช่น DWG, DOC, MAT)',
  type_name_th VARCHAR(100) NOT NULL COMMENT 'ชื่อประเภท RFA th',
  type_name_en VARCHAR(100) NOT NULL COMMENT 'ชื่อประเภท RFA en',
  remark TEXT COMMENT 'หมายเหตุ',
  -- sort_order INT DEFAULT 0 COMMENT 'ลำดับการแสดงผล',
  is_active TINYINT(1) DEFAULT 1 COMMENT 'สถานะการใช้งาน ',
  UNIQUE KEY uk_rfa_types_contract_code (contract_id, type_code),
  FOREIGN KEY (contract_id) REFERENCES contracts (id) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci COMMENT = 'ตาราง Master สำหรับประเภท RFA';

-- ตาราง Master สำหรับสถานะ RFA
CREATE TABLE rfa_status_codes (
  id INT PRIMARY KEY AUTO_INCREMENT COMMENT 'ID ของตาราง',
  status_code VARCHAR(20) NOT NULL UNIQUE COMMENT 'รหัสสถานะ RFA (เช่น DFT - Draft, FAP - For Approve)',
  status_name VARCHAR(100) NOT NULL COMMENT 'ชื่อสถานะ',
  description TEXT COMMENT 'คำอธิบาย',
  sort_order INT DEFAULT 0 COMMENT 'ลำดับการแสดงผล',
  is_active TINYINT(1) DEFAULT 1 COMMENT 'สถานะการใช้งาน '
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci COMMENT = 'ตาราง Master สำหรับสถานะ RFA';

-- ตาราง Master สำหรับรหัสผลการอนุมัติ RFA
CREATE TABLE rfa_approve_codes (
  id INT PRIMARY KEY AUTO_INCREMENT COMMENT 'ID ของตาราง',
  approve_code VARCHAR(20) NOT NULL UNIQUE COMMENT 'รหัสผลการอนุมัติ (
        เช่น 1A - Approved,
        3R - Revise
        and Resubmit
    )',
  approve_name VARCHAR(100) NOT NULL COMMENT 'ชื่อผลการอนุมัติ',
  description TEXT COMMENT 'คำอธิบาย',
  sort_order INT DEFAULT 0 COMMENT 'ลำดับการแสดงผล',
  is_active TINYINT(1) DEFAULT 1 COMMENT 'สถานะการใช้งาน '
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci COMMENT = 'ตาราง Master สำหรับรหัสผลการอนุมัติ RFA';

CREATE TABLE rfas (
  id INT PRIMARY KEY COMMENT 'ID ของตาราง (RFA Master ID)',
  -- ❌ ไม่มี AUTO_INCREMENT
  rfa_type_id INT NOT NULL COMMENT 'ประเภท RFA',
  -- discipline_id INT NULL COMMENT 'สาขางาน (ถ้ามี)',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT 'วันที่สร้าง',
  created_by INT COMMENT 'ผู้สร้าง',
  deleted_at DATETIME NULL COMMENT 'สำหรับ Soft Delete',
  FOREIGN KEY (rfa_type_id) REFERENCES rfa_types (id),
  FOREIGN KEY (created_by) REFERENCES users (user_id) ON DELETE
  SET NULL,
    -- CONSTRAINT fk_rfa_discipline FOREIGN KEY (discipline_id) REFERENCES disciplines (id) ON DELETE SET NULL,
    CONSTRAINT fk_rfas_parent FOREIGN KEY (id) REFERENCES correspondences (id) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci COMMENT = 'ตาราง "แม่" ของ RFA (มีความสัมพันธ์ 1 :N กับ rfa_revisions)';

-- ตาราง "ลูก" เก็บประวัติ (Revisions) ของ rfas (1:N)
CREATE TABLE rfa_revisions (
  id INT PRIMARY KEY AUTO_INCREMENT COMMENT 'ID ของ Revision',
  rfa_id INT NOT NULL COMMENT 'Master ID ของ RFA',
  revision_number INT NOT NULL COMMENT 'หมายเลข Revision (0, 1, 2...)',
  revision_label VARCHAR(10) COMMENT 'Revision ที่แสดง (เช่น A, B, 1.1)',
  is_current BOOLEAN DEFAULT FALSE COMMENT '(1 = Revision ปัจจุบัน)',
  -- ข้อมูลเฉพาะของ RFA Revision ที่ซับซ้อน
  rfa_status_code_id INT NOT NULL COMMENT 'สถานะ RFA',
  rfa_approve_code_id INT COMMENT 'ผลการอนุมัติ',
  subject VARCHAR(500) NOT NULL COMMENT 'หัวข้อเรื่อง',
  description TEXT COMMENT 'คำอธิบายการแก้ไขใน Revision นี้',
  body TEXT NULL COMMENT 'เนื้อความ (ถ้ามี)',
  remarks TEXT COMMENT 'หมายเหตุ',
  document_date DATE COMMENT 'วันที่ในเอกสาร',
  issued_date DATE COMMENT 'วันที่ส่งขออนุมัติ',
  received_date DATETIME COMMENT 'วันที่ลงรับเอกสาร',
  due_date DATETIME COMMENT 'วันที่ครบกำหนด',
  approved_date DATE COMMENT 'วันที่อนุมัติ',
  -- Standard Meta Columns
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT 'วันที่สร้างเอกสาร',
  created_by INT COMMENT 'ผู้สร้าง',
  updated_by INT COMMENT 'ผู้แก้ไขล่าสุด',
  -- ส่วนของ JSON และ Schema Version
  details JSON NULL COMMENT 'RFA Specific Details',
  schema_version INT DEFAULT 1 COMMENT 'Version ของ JSON Schema',
  -- Generated Virtual Columns (ดึงค่าจาก JSON โดยอัตโนมัติ)
  v_ref_drawing_count INT GENERATED ALWAYS AS (
    JSON_UNQUOTE(
      JSON_EXTRACT(details, '$.drawingCount')
    )
  ) VIRTUAL,
  FOREIGN KEY (rfa_id) REFERENCES rfas (id) ON DELETE CASCADE,
  FOREIGN KEY (rfa_status_code_id) REFERENCES rfa_status_codes (id),
  FOREIGN KEY (rfa_approve_code_id) REFERENCES rfa_approve_codes (id) ON DELETE
  SET NULL,
    FOREIGN KEY (created_by) REFERENCES users (user_id) ON DELETE
  SET NULL,
    FOREIGN KEY (updated_by) REFERENCES users (user_id) ON DELETE
  SET NULL,
    UNIQUE KEY uq_rr_rev_number (rfa_id, revision_number),
    UNIQUE KEY uq_rr_current (rfa_id, is_current)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci COMMENT = 'ตาราง "ลูก" เก็บประวัติ (Revisions) ของ rfas (1 :N)';

-- ตารางเชื่อมระหว่าง rfa_revisions (ที่เป็นประเภท DWG) กับ shop_drawing_revisions (M:N)
CREATE TABLE rfa_items (
  rfa_revision_id INT COMMENT 'ID ของ RFA Revision',
  shop_drawing_revision_id INT COMMENT 'ID ของ Shop Drawing Revision',
  PRIMARY KEY (
    rfa_revision_id,
    shop_drawing_revision_id
  ),
  FOREIGN KEY (rfa_revision_id) REFERENCES rfa_revisions (id) ON DELETE CASCADE,
  FOREIGN KEY (shop_drawing_revision_id) REFERENCES shop_drawing_revisions (id) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci COMMENT = 'ตารางเชื่อมระหว่าง rfa_revisions (ที่เป็นประเภท DWG) กับ shop_drawing_revisions (M :N)';

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
  FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE,
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
  FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE,
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
  FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE,
  UNIQUE KEY ux_subcat_project (project_id, sub_cat_code)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci COMMENT = 'ตาราง Master สำหรับ "หมวดหมู่ย่อย" ของแบบคู่สัญญา';

-- ตารางเชื่อมระหว่าง หมวดหมู่หลัก-ย่อย (M:N)
CREATE TABLE contract_drawing_subcat_cat_maps (
  id INT PRIMARY KEY AUTO_INCREMENT COMMENT 'ID ของตาราง',
  project_id INT COMMENT 'ID ของโครงการ',
  sub_cat_id INT COMMENT 'ID ของหมวดหมู่ย่อย',
  cat_id INT COMMENT 'ID ของหมวดหมู่หลัก',
  UNIQUE KEY ux_map_unique (project_id, sub_cat_id, cat_id),
  FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE,
  FOREIGN KEY (sub_cat_id) REFERENCES contract_drawing_sub_cats (id) ON DELETE CASCADE,
  FOREIGN KEY (cat_id) REFERENCES contract_drawing_cats (id) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci COMMENT = 'ตารางเชื่อมระหว่าง หมวดหมู่หลัก - ย่อย (M :N)';

-- ตาราง Master เก็บข้อมูล "แบบคู่สัญญา"
CREATE TABLE contract_drawings (
  id INT PRIMARY KEY AUTO_INCREMENT COMMENT 'ID ของตาราง',
  project_id INT NOT NULL COMMENT 'โครงการ',
  condwg_no VARCHAR(255) NOT NULL COMMENT 'เลขที่แบบสัญญา',
  title VARCHAR(255) NOT NULL COMMENT 'ชื่อแบบสัญญา',
  map_cat_id INT COMMENT 'หมวดหมู่ย่อย',
  volume_id INT COMMENT 'เล่ม',
  volume_page INT COMMENT 'หน้าที่',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'วันที่สร้าง',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'วันที่แก้ไขล่าสุด',
  deleted_at DATETIME NULL COMMENT 'วันที่ลบ',
  updated_by INT COMMENT 'ผู้แก้ไขล่าสุด',
  FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE,
  FOREIGN KEY (map_cat_id) REFERENCES contract_drawing_subcat_cat_maps (id) ON DELETE RESTRICT,
  FOREIGN KEY (volume_id) REFERENCES contract_drawing_volumes (id) ON DELETE RESTRICT,
  UNIQUE KEY ux_condwg_no_project (project_id, condwg_no)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci COMMENT = 'ตาราง Master เก็บข้อมูล "แบบคู่สัญญา"';

-- ตาราง Master สำหรับ "หมวดหมู่หลัก" ของแบบก่อสร้าง
CREATE TABLE shop_drawing_main_categories (
  id INT PRIMARY KEY AUTO_INCREMENT COMMENT 'ID ของตาราง',
  project_id INT NOT NULL COMMENT 'โครงการ',
  main_category_code VARCHAR(50) NOT NULL UNIQUE COMMENT 'รหัสหมวดหมู่หลัก (เช่น ARCH, STR)',
  main_category_name VARCHAR(255) NOT NULL COMMENT 'ชื่อหมวดหมู่หลัก',
  description TEXT COMMENT 'คำอธิบาย',
  sort_order INT DEFAULT 0 COMMENT 'ลำดับการแสดงผล',
  is_active TINYINT(1) DEFAULT 1 COMMENT 'สถานะการใช้งาน',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'วันที่สร้าง',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'วันที่แก้ไขล่าสุด ',
  FOREIGN KEY (project_id) REFERENCES projects (id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci COMMENT = 'ตาราง Master สำหรับ "หมวดหมู่หลัก" ของแบบก่อสร้าง';

-- ตาราง Master สำหรับ "หมวดหมู่ย่อย" ของแบบก่อสร้าง
CREATE TABLE shop_drawing_sub_categories (
  id INT PRIMARY KEY AUTO_INCREMENT COMMENT 'ID ของตาราง',
  project_id INT NOT NULL COMMENT 'โครงการ',
  sub_category_code VARCHAR(50) NOT NULL UNIQUE COMMENT 'รหัสหมวดหมู่ย่อย (เช่น STR - COLUMN)',
  sub_category_name VARCHAR(255) NOT NULL COMMENT 'ชื่อหมวดหมู่ย่อย',
  description TEXT COMMENT 'คำอธิบาย',
  sort_order INT DEFAULT 0 COMMENT 'ลำดับการแสดงผล',
  is_active TINYINT(1) DEFAULT 1 COMMENT 'สถานะการใช้งาน',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'วันที่สร้าง',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'วันที่แก้ไขล่าสุด',
  FOREIGN KEY (project_id) REFERENCES projects (id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci COMMENT = 'ตาราง Master สำหรับ "หมวดหมู่ย่อย" ของแบบก่อสร้าง';

-- ตาราง Master เก็บข้อมูล "แบบก่อสร้าง"
CREATE TABLE shop_drawings (
  id INT PRIMARY KEY AUTO_INCREMENT COMMENT 'ID ของตาราง',
  project_id INT NOT NULL COMMENT 'โครงการ',
  drawing_number VARCHAR(100) NOT NULL COMMENT 'เลขที่ Shop Drawing',
  main_category_id INT NOT NULL COMMENT 'หมวดหมู่หลัก',
  sub_category_id INT NOT NULL COMMENT 'หมวดหมู่ย่อย',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'วันที่สร้าง',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'วันที่แก้ไขล่าสุด',
  deleted_at DATETIME NULL COMMENT 'วันที่ลบ',
  updated_by INT COMMENT 'ผู้แก้ไขล่าสุด',
  FOREIGN KEY (project_id) REFERENCES projects (id),
  FOREIGN KEY (main_category_id) REFERENCES shop_drawing_main_categories (id),
  FOREIGN KEY (sub_category_id) REFERENCES shop_drawing_sub_categories (id),
  UNIQUE KEY ux_shop_dwg_no_project (project_id, drawing_number)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci COMMENT = 'ตาราง Master เก็บข้อมูล "แบบก่อสร้าง"';

-- ตาราง "ลูก" เก็บประวัติ (Revisions) ของ shop_drawings (1:N)
CREATE TABLE shop_drawing_revisions (
  id INT PRIMARY KEY AUTO_INCREMENT COMMENT 'ID ของ Revision',
  shop_drawing_id INT NOT NULL COMMENT 'Master ID',
  revision_number INT NOT NULL COMMENT 'หมายเลข Revision (เช่น 0, 1, 2...)',
  revision_label VARCHAR(10) COMMENT 'Revision ที่แสดง (เช่น A, B, 1.1)',
  is_current BOOLEAN DEFAULT NULL COMMENT '(TRUE = Revision ปัจจุบัน, NULL = ไม่ใช่ปัจจุบัน)',
  revision_date DATE COMMENT 'วันที่ของ Revision',
  title VARCHAR(500) NOT NULL COMMENT 'ชื่อแบบ',
  description TEXT COMMENT 'คำอธิบายการแก้ไข',
  legacy_drawing_number VARCHAR(100) NULL COMMENT 'เลขที่เดิมของ Shop Drawing',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'วันที่สร้าง',
  created_by INT COMMENT 'ผู้สร้าง',
  updated_by INT COMMENT 'ผู้แก้ไขล่าสุด',
  FOREIGN KEY (shop_drawing_id) REFERENCES shop_drawings (id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users (user_id) ON DELETE
  SET NULL,
    FOREIGN KEY (updated_by) REFERENCES users (user_id) ON DELETE
  SET NULL,
    UNIQUE KEY ux_sd_rev_drawing_revision (shop_drawing_id, revision_number),
    UNIQUE KEY uq_sd_current (shop_drawing_id, is_current)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci COMMENT = 'ตาราง "ลูก" เก็บประวัติ (Revisions) ของ shop_drawings (1:N)';

-- ตารางเชื่อมระหว่าง shop_drawing_revisions กับ contract_drawings (M:N)
CREATE TABLE shop_drawing_revision_contract_refs (
  shop_drawing_revision_id INT COMMENT 'ID ของ Shop Drawing Revision',
  contract_drawing_id INT COMMENT 'ID ของ Contract Drawing',
  PRIMARY KEY (
    shop_drawing_revision_id,
    contract_drawing_id
  ),
  FOREIGN KEY (shop_drawing_revision_id) REFERENCES shop_drawing_revisions (id) ON DELETE CASCADE,
  FOREIGN KEY (contract_drawing_id) REFERENCES contract_drawings (id) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci COMMENT = 'ตารางเชื่อมระหว่าง shop_drawing_revisions กับ contract_drawings (M :N)';

-- ตาราง Master เก็บข้อมูล "AS Built"
CREATE TABLE asbuilt_drawings (
  id INT PRIMARY KEY AUTO_INCREMENT COMMENT 'ID ของตาราง',
  project_id INT NOT NULL COMMENT 'โครงการ',
  drawing_number VARCHAR(100) NOT NULL COMMENT 'เลขที่ AS Built Drawing',
  main_category_id INT NOT NULL COMMENT 'หมวดหมู่หลัก',
  sub_category_id INT NOT NULL COMMENT 'หมวดหมู่ย่อย',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'วันที่สร้าง',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'วันที่แก้ไขล่าสุด',
  deleted_at DATETIME NULL COMMENT 'วันที่ลบ',
  updated_by INT COMMENT 'ผู้แก้ไขล่าสุด',
  FOREIGN KEY (project_id) REFERENCES projects (id),
  FOREIGN KEY (main_category_id) REFERENCES shop_drawing_main_categories (id),
  FOREIGN KEY (sub_category_id) REFERENCES shop_drawing_sub_categories (id),
  UNIQUE KEY ux_asbuilt_no_project (project_id, drawing_number)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci COMMENT = 'ตาราง Master เก็บข้อมูล "แบบ AS Built"';

-- ตาราง "ลูก" เก็บประวัติ (Revisions) ของ AS Built (1:N)
CREATE TABLE asbuilt_drawing_revisions (
  id INT PRIMARY KEY AUTO_INCREMENT COMMENT 'ID ของ Revision',
  asbuilt_drawing_id INT NOT NULL COMMENT 'Master ID',
  revision_number INT NOT NULL COMMENT 'หมายเลข Revision (เช่น 0, 1, 2...)',
  revision_label VARCHAR(10) COMMENT 'Revision ที่แสดง (เช่น A, B, 1.1)',
  is_current BOOLEAN DEFAULT NULL COMMENT '(TRUE = Revision ปัจจุบัน, NULL = ไม่ใช่ปัจจุบัน)',
  revision_date DATE COMMENT 'วันที่ของ Revision',
  title VARCHAR(500) NOT NULL COMMENT 'ชื่อแบบ',
  description TEXT COMMENT 'คำอธิบายการแก้ไข',
  legacy_drawing_number VARCHAR(100) NULL COMMENT 'เลขที่เดิมของ AS Built Drawing',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'วันที่สร้าง',
  created_by INT COMMENT 'ผู้สร้าง',
  updated_by INT COMMENT 'ผู้แก้ไขล่าสุด',
  FOREIGN KEY (asbuilt_drawing_id) REFERENCES asbuilt_drawings (id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users (user_id) ON DELETE
  SET NULL,
    FOREIGN KEY (updated_by) REFERENCES users (user_id) ON DELETE
  SET NULL,
    UNIQUE KEY ux_asbuilt_rev_drawing_revision (asbuilt_drawing_id, revision_number),
    UNIQUE KEY uq_asbuilt_current (asbuilt_drawing_id, is_current)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci COMMENT = 'ตาราง "ลูก" เก็บประวัติ (Revisions) ของ asbuilt_drawings (1:N)';

-- ตารางเชื่อมระหว่าง asbuilt_drawing_revisions กับ shop_drawing_revisions (M:N)
CREATE TABLE asbuilt_revision_shop_revisions_refs (
  asbuilt_drawing_revision_id INT COMMENT 'ID ของ AS Built Drawing Revision',
  shop_drawing_revision_id INT COMMENT 'ID ของ Shop Drawing Revision',
  PRIMARY KEY (
    asbuilt_drawing_revision_id,
    shop_drawing_revision_id
  ),
  FOREIGN KEY (asbuilt_drawing_revision_id) REFERENCES asbuilt_drawing_revisions (id) ON DELETE CASCADE,
  FOREIGN KEY (shop_drawing_revision_id) REFERENCES shop_drawing_revisions (id) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci COMMENT = 'ตารางเชื่อมระหว่าง asbuilt_drawing_revisions กับ shop_drawing_revisions (M :N)';

-- =====================================================
-- View: Shop Drawing พร้อม Current Revision
-- =====================================================
CREATE OR REPLACE VIEW vw_shop_drawing_current AS
SELECT sd.id,
  sd.project_id,
  sd.drawing_number,
  sd.main_category_id,
  sd.sub_category_id,
  sd.created_at,
  sd.updated_at,
  sd.deleted_at,
  sd.updated_by,
  sdr.id AS revision_id,
  sdr.revision_number,
  sdr.revision_label,
  sdr.revision_date,
  sdr.title AS revision_title,
  sdr.description AS revision_description,
  sdr.legacy_drawing_number,
  sdr.created_by AS revision_created_by,
  sdr.updated_by AS revision_updated_by
FROM shop_drawings sd
  LEFT JOIN shop_drawing_revisions sdr ON sd.id = sdr.shop_drawing_id
  AND sdr.is_current = TRUE;

-- =====================================================
-- View: As Built Drawing พร้อม Current Revision
-- =====================================================
CREATE OR REPLACE VIEW vw_asbuilt_drawing_current AS
SELECT ad.id,
  ad.project_id,
  ad.drawing_number,
  ad.main_category_id,
  ad.sub_category_id,
  ad.created_at,
  ad.updated_at,
  ad.deleted_at,
  ad.updated_by,
  adr.id AS revision_id,
  adr.revision_number,
  adr.revision_label,
  adr.revision_date,
  adr.title AS revision_title,
  adr.description AS revision_description,
  adr.legacy_drawing_number,
  adr.created_by AS revision_created_by,
  adr.updated_by AS revision_updated_by
FROM asbuilt_drawings ad
  LEFT JOIN asbuilt_drawing_revisions adr ON ad.id = adr.asbuilt_drawing_id
  AND adr.is_current = TRUE;

-- =====================================================
-- 6. 🔄 Circulations (ใบเวียนภายใน)
-- =====================================================
-- ตาราง Master เก็บสถานะใบเวียน
CREATE TABLE circulation_status_codes (
  id INT PRIMARY KEY AUTO_INCREMENT COMMENT 'ID ของตาราง',
  code VARCHAR(20) NOT NULL UNIQUE COMMENT 'รหัสสถานะการดำเนินงาน',
  description VARCHAR(50) NOT NULL COMMENT 'คำอธิบายสถานะการดำเนินงาน',
  sort_order INT DEFAULT 0 COMMENT 'ลำดับการแสดงผล',
  is_active TINYINT(1) DEFAULT 1 COMMENT 'สถานะการใช้งาน '
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci COMMENT = 'ตาราง Master เก็บสถานะใบเวียน';

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
  FOREIGN KEY (correspondence_id) REFERENCES correspondences (id),
  FOREIGN KEY (organization_id) REFERENCES organizations (id),
  FOREIGN KEY (circulation_status_code) REFERENCES circulation_status_codes (code),
  FOREIGN KEY (created_by_user_id) REFERENCES users (user_id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci COMMENT = 'ตาราง "แม่" ของใบเวียนเอกสารภายใน';

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
    'OTHER '
  ) COMMENT 'วัตถุประสงค์',
  remarks TEXT COMMENT 'หมายเหตุ',
  FOREIGN KEY (correspondence_id) REFERENCES correspondences (id) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci COMMENT = 'ตารางข้อมูลเฉพาะของเอกสารนำส่ง (เป็นตารางลูก 1 :1 ของ correspondences)';

-- ตารางเชื่อมระหว่าง transmittals และเอกสารที่นำส่ง (M:N)
CREATE TABLE transmittal_items (
  id INT PRIMARY KEY AUTO_INCREMENT COMMENT 'ID ของรายการ',
  transmittal_id INT NOT NULL COMMENT 'ID ของ Transmittal',
  item_correspondence_id INT NOT NULL COMMENT 'ID ของเอกสารที่แนบไป',
  quantity INT DEFAULT 1 COMMENT 'จำนวน',
  remarks VARCHAR(255) COMMENT 'หมายเหตุสำหรับรายการนี้',
  FOREIGN KEY (transmittal_id) REFERENCES transmittals (correspondence_id) ON DELETE CASCADE,
  FOREIGN KEY (item_correspondence_id) REFERENCES correspondences (id) ON DELETE CASCADE,
  UNIQUE KEY ux_transmittal_item (
    transmittal_id,
    item_correspondence_id
  )
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci COMMENT = 'ตารางเชื่อมระหว่าง transmittals และเอกสารที่นำส่ง (M :N)';

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
  file_path VARCHAR(500) NOT NULL COMMENT 'Path ที่เก็บไฟล์ (บน QNAP / share / dms - data /)',
  mime_type VARCHAR(100) NOT NULL COMMENT 'ประเภทไฟล์ (เช่น application / pdf)',
  file_size INT NOT NULL COMMENT 'ขนาดไฟล์ (bytes)',
  is_temporary BOOLEAN DEFAULT TRUE COMMENT 'True = ยังไม่ Commit ลง DB จริง',
  temp_id VARCHAR(100) NULL COMMENT 'ID ชั่วคราวสำหรับอ้างอิงตอน Upload Phase 1',
  uploaded_by_user_id INT NOT NULL COMMENT 'ผู้อัปโหลดไฟล์',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'วันที่อัปโหลด',
  expires_at DATETIME NULL COMMENT 'เวลาหมดอายุของไฟล์ Temp',
  CHECKSUM VARCHAR(64) NULL COMMENT 'SHA-256 Checksum',
  reference_date DATE NULL COMMENT 'Date used for folder structure (e.g. Issue Date) to prevent broken paths',
  FOREIGN KEY (uploaded_by_user_id) REFERENCES users (user_id) ON DELETE CASCADE,
  INDEX idx_attachments_reference_date (reference_date)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci COMMENT = 'ตาราง "กลาง" เก็บไฟล์แนบทั้งหมดของระบบ';

-- ตารางเชื่อม correspondences กับ attachments (M:N)
CREATE TABLE correspondence_attachments (
  correspondence_id INT COMMENT 'ID ของเอกสาร',
  attachment_id INT COMMENT 'ID ของไฟล์แนบ',
  is_main_document BOOLEAN DEFAULT FALSE COMMENT '(1 = ไฟล์หลัก)',
  PRIMARY KEY (correspondence_id, attachment_id),
  FOREIGN KEY (correspondence_id) REFERENCES correspondences (id) ON DELETE CASCADE,
  FOREIGN KEY (attachment_id) REFERENCES attachments (id) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci COMMENT = 'ตารางเชื่อม correspondences กับ attachments (M :N)';

-- ตารางเชื่อม circulations กับ attachments (M:N)
CREATE TABLE circulation_attachments (
  circulation_id INT COMMENT 'ID ของใบเวียน',
  attachment_id INT COMMENT 'ID ของไฟล์แนบ',
  is_main_document BOOLEAN DEFAULT FALSE COMMENT '(1 = ไฟล์หลักของใบเวียน)',
  PRIMARY KEY (circulation_id, attachment_id),
  FOREIGN KEY (circulation_id) REFERENCES circulations (id) ON DELETE CASCADE,
  FOREIGN KEY (attachment_id) REFERENCES attachments (id) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci COMMENT = 'ตารางเชื่อม circulations กับ attachments (M :N)';

-- ตารางเชื่อม shop_drawing_revisions กับ attachments (M:N)
CREATE TABLE asbuilt_drawing_revision_attachments (
  asbuilt_drawing_revision_id INT COMMENT 'ID ของ asbuilt Drawing Revision',
  attachment_id INT COMMENT 'ID ของไฟล์แนบ',
  file_type ENUM(
    'PDF',
    'DWG',
    'SOURCE',
    'OTHER '
  ) COMMENT 'ประเภทไฟล์',
  is_main_document BOOLEAN DEFAULT FALSE COMMENT '(1 = ไฟล์หลัก)',
  PRIMARY KEY (
    asbuilt_drawing_revision_id,
    attachment_id
  ),
  FOREIGN KEY (asbuilt_drawing_revision_id) REFERENCES asbuilt_drawing_revisions (id) ON DELETE CASCADE,
  FOREIGN KEY (attachment_id) REFERENCES attachments (id) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci COMMENT = 'ตารางเชื่อม asbuilt_drawing_revisions กับ attachments (M :N)';

-- ตารางเชื่อม shop_drawing_revisions กับ attachments (M:N)
CREATE TABLE shop_drawing_revision_attachments (
  shop_drawing_revision_id INT COMMENT 'ID ของ Shop Drawing Revision',
  attachment_id INT COMMENT 'ID ของไฟล์แนบ',
  file_type ENUM(
    'PDF',
    'DWG',
    'SOURCE',
    'OTHER '
  ) COMMENT 'ประเภทไฟล์',
  is_main_document BOOLEAN DEFAULT FALSE COMMENT '(1 = ไฟล์หลัก)',
  PRIMARY KEY (
    shop_drawing_revision_id,
    attachment_id
  ),
  FOREIGN KEY (shop_drawing_revision_id) REFERENCES shop_drawing_revisions (id) ON DELETE CASCADE,
  FOREIGN KEY (attachment_id) REFERENCES attachments (id) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci COMMENT = 'ตารางเชื่อม shop_drawing_revisions กับ attachments (M :N)';

-- ตารางเชื่อม contract_drawings กับ attachments (M:N)
CREATE TABLE contract_drawing_attachments (
  contract_drawing_id INT COMMENT 'ID ของ Contract Drawing',
  attachment_id INT COMMENT 'ID ของไฟล์แนบ',
  file_type ENUM(
    'PDF',
    'DWG',
    'SOURCE',
    'OTHER '
  ) COMMENT 'ประเภทไฟล์',
  is_main_document BOOLEAN DEFAULT FALSE COMMENT '(1 = ไฟล์หลัก)',
  PRIMARY KEY (
    contract_drawing_id,
    attachment_id
  ),
  FOREIGN KEY (contract_drawing_id) REFERENCES contract_drawings (id) ON DELETE CASCADE,
  FOREIGN KEY (attachment_id) REFERENCES attachments (id) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci COMMENT = 'ตารางเชื่อม contract_drawings กับ attachments (M :N)';

-- =====================================================
-- 9. 🔢 Document Numbering (การสร้างเลขที่เอกสาร)
-- =====================================================
-- ตาราง Master เก็บ "รูปแบบ" Template ของเลขที่เอกสาร
CREATE TABLE document_number_formats (
  id INT PRIMARY KEY AUTO_INCREMENT COMMENT 'ID ของตาราง',
  project_id INT NOT NULL COMMENT 'โครงการ',
  correspondence_type_id INT NULL COMMENT 'ประเภทเอกสาร',
  discipline_id INT DEFAULT 0 COMMENT 'สาขางาน (0 = ทุกสาขา/ไม่ระบุ)',
  format_string VARCHAR(100) NOT NULL COMMENT 'Format pattern (e.g., {ORG}-{TYPE}-{YYYY}-#)',
  description TEXT COMMENT 'Format description',
  reset_annually BOOLEAN DEFAULT TRUE COMMENT 'เริ่มนับใหม่ทุกปี',
  is_active TINYINT(1) DEFAULT 1 COMMENT 'สถานะการใช้งาน',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'วันที่สร้าง',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'วันที่แก้ไขล่าสุด',
  FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE,
  FOREIGN KEY (correspondence_type_id) REFERENCES correspondence_types (id) ON DELETE CASCADE,
  UNIQUE KEY unique_format (
    project_id,
    correspondence_type_id
  )
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci COMMENT = 'ตาราง Master เก็บ "รูปแบบ" Template ของเลขที่เอกสาร';

-- ==========================================================
-- [v1.5.1 UPDATE] ตารางเก็บ "ตัวนับ" (Running Number) ล่าสุด
-- เปลี่ยนแปลงหลัก:
--   - PRIMARY KEY: เปลี่ยนจาก 5 คอลัมน์เป็น 8 คอลัมน์
--   - เพิ่มคอลัมน์: recipient_organization_id, sub_type_id, rfa_type_id
--   - เพิ่ม INDEXES สำหรับ performance
--   - เพิ่ม CONSTRAINTS สำหรับ data validation
-- เหตุผล: รองรับ 10 token types และ granular counter management
-- รองรับ: Backend Plan T2.3, Req 3.11.5, specs v1.5.1
-- ==========================================================
CREATE TABLE document_number_counters (
  -- [v1.5.1] Composite Primary Key Columns (8 columns total)
  project_id INT NOT NULL COMMENT 'โครงการ',
  correspondence_type_id INT NULL COMMENT 'ประเภทเอกสาร (LETTER, RFA, TRANSMITTAL, etc.) NULL = default format for project',
  originator_organization_id INT NOT NULL COMMENT 'องค์กรผู้ส่ง',
  -- เปลี่ยนจาก NULL เป็น DEFAULT 0
  recipient_organization_id INT NOT NULL DEFAULT 0 COMMENT '[v1.7.0] องค์กรผู้รับ 0 = no recipient (RFA)',
  sub_type_id INT DEFAULT 0 COMMENT '[v1.5.1 NEW] ประเภทย่อย สำหรับ TRANSMITTAL (0 = ไม่ระบุ)',
  rfa_type_id INT DEFAULT 0 COMMENT '[v1.5.1 NEW] ประเภท RFA เช่น SHD, RPT, MAT (0 = ไม่ใช่ RFA)',
  discipline_id INT DEFAULT 0 COMMENT 'สาขางาน เช่น TER, STR, GEO (0 = ไม่ระบุ)',
  reset_scope VARCHAR(20) NOT NULL COMMENT 'Scope of reset (PROJECT, ORGANIZATION, etc.)',
  -- Counter Data
  last_number INT DEFAULT 0 NOT NULL COMMENT 'เลขที่ล่าสุดที่ใช้ไปแล้ว (auto-increment)',
  version INT DEFAULT 0 NOT NULL COMMENT 'Optimistic Lock Version (TypeORM @VersionColumn)',
  -- Metadata
  created_at DATETIME(6) DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  -- [v1.7.0 UPDATE] Primary Key: 5 columns -> 8 columns
  PRIMARY KEY (
    project_id,
    originator_organization_id,
    recipient_organization_id,
    correspondence_type_id,
    sub_type_id,
    rfa_type_id,
    discipline_id,
    reset_scope
  ),
  -- Foreign Keys
  FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE,
  FOREIGN KEY (originator_organization_id) REFERENCES organizations (id) ON DELETE CASCADE,
  FOREIGN KEY (correspondence_type_id) REFERENCES correspondence_types (id) ON DELETE CASCADE,
  -- Performance Indexes
  INDEX idx_counter_lookup (project_id, correspondence_type_id, reset_scope),
  INDEX idx_counter_org (originator_organization_id, reset_scope),
  -- Constraints
  CONSTRAINT chk_last_number_positive CHECK (last_number >= 0),
  CONSTRAINT chk_reset_scope_format CHECK (
    reset_scope IN ('NONE')
    OR reset_scope LIKE 'YEAR_%'
    OR reset_scope LIKE 'MONTH_%'
    OR reset_scope LIKE 'CONTRACT_%'
  )
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci COMMENT = 'ตารางเก็บ Running Number Counters - รองรับ 8-column composite PK';

-- ==========================================================
-- ตารางเก็บ Audit Trail สำหรับการสร้างเลขที่เอกสาร
-- เพิ่มตาราง: document_number_audit
-- เหตุผล: บันทึกประวัติการสร้างเลขที่ รองรับ audit requirement ≥ 7 ปี
-- ==========================================================
CREATE TABLE document_number_audit (
  id INT AUTO_INCREMENT PRIMARY KEY COMMENT 'ID ของ audit record',
  -- Document Info
  document_id INT NULL COMMENT 'ID ของเอกสารที่สร้างเลขที่ (correspondences.id) - NULL if failed/reserved',
  document_type VARCHAR(50),
  document_number VARCHAR(100) NOT NULL COMMENT 'เลขที่เอกสารที่สร้าง (ผลลัพธ์)',
  operation ENUM(
    'RESERVE',
    'CONFIRM',
    'MANUAL_OVERRIDE',
    'VOID_REPLACE',
    'CANCEL'
  ) NOT NULL DEFAULT 'CONFIRM' COMMENT 'ประเภทการดำเนินการ',
  STATUS ENUM(
    'RESERVED',
    'CONFIRMED',
    'CANCELLED',
    'VOID',
    'MANUAL'
  ) NOT NULL DEFAULT 'RESERVED' COMMENT 'สถานะเลขที่เอกสาร',
  counter_key JSON NOT NULL COMMENT 'Counter key ที่ใช้ (JSON format) - 8 fields',
  reservation_token VARCHAR(36) NULL,
  idempotency_key VARCHAR(128) NULL COMMENT 'Idempotency Key from request',
  originator_organization_id INT NULL,
  recipient_organization_id INT NULL,
  template_used VARCHAR(200) NOT NULL COMMENT 'Template ที่ใช้ในการสร้าง',
  old_value TEXT NULL COMMENT 'Previous value for audit',
  new_value TEXT NULL COMMENT 'New value for audit',
  -- User Info
  user_id INT NULL COMMENT 'ผู้ขอสร้างเลขที่',
  ip_address VARCHAR(45) COMMENT 'IP address ของผู้ขอ (IPv4/IPv6)',
  user_agent TEXT COMMENT 'User agent string (browser info)',
  is_success BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'วันที่/เวลาที่สร้าง',
  -- Performance & Error Tracking
  retry_count INT DEFAULT 0 COMMENT 'จำนวนครั้งที่ retry ก่อนสำเร็จ',
  lock_wait_ms INT COMMENT 'เวลารอ Redis lock (milliseconds)',
  total_duration_ms INT COMMENT 'เวลารวมทั้งหมดในการสร้าง (milliseconds)',
  fallback_used ENUM('NONE', 'DB_LOCK', 'RETRY') DEFAULT 'NONE' COMMENT 'Fallback strategy ที่ถูกใช้ (NONE=normal, DB_LOCK=Redis down, RETRY=conflict)',
  metadata JSON COMMENT 'Additional context data',
  -- Indexes for performance
  INDEX idx_document_id (document_id),
  INDEX idx_user_id (user_id),
  INDEX idx_status (STATUS),
  INDEX idx_operation (operation),
  INDEX idx_document_number (document_number),
  INDEX idx_reservation_token (reservation_token),
  INDEX idx_idempotency_key (idempotency_key),
  INDEX idx_created_at (created_at),
  -- Foreign Keys
  FOREIGN KEY (document_id) REFERENCES correspondences (id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users (user_id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci COMMENT = '[v1.5.1 NEW] Audit Trail สำหรับการสร้างเลขที่เอกสาร - เก็บ ≥ 7 ปี';

-- ==========================================================
-- [v1.5.1 NEW] ตารางเก็บ Error Logs สำหรับ Document Numbering
-- เพิ่มตาราง: document_number_errors
-- เหตุผล: ติดตาม errors, troubleshooting, monitoring
-- รองรับ: Req 3.11.6, Ops monitoring requirements
-- ==========================================================
CREATE TABLE document_number_errors (
  id INT AUTO_INCREMENT PRIMARY KEY COMMENT 'ID ของ error record',
  -- Error Classification
  error_type ENUM(
    'LOCK_TIMEOUT',
    -- Redis lock timeout
    'VERSION_CONFLICT',
    -- Optimistic lock version mismatch
    'DB_ERROR',
    -- Database connection/query error
    'REDIS_ERROR',
    -- Redis connection error
    'VALIDATION_ERROR' -- Template/input validation error
  ) NOT NULL COMMENT 'ประเภท error (5 types)',
  -- Error Details
  error_message TEXT COMMENT 'ข้อความ error (stack top)',
  stack_trace TEXT COMMENT 'Stack trace แบบเต็ม (สำหรับ debugging)',
  context_data JSON COMMENT 'Context ของ request (user, project, counter_key, etc.)',
  -- User Info
  user_id INT COMMENT 'ผู้ที่เกิด error',
  ip_address VARCHAR(45) COMMENT 'IP address',
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'วันที่เกิด error',
  resolved_at TIMESTAMP NULL COMMENT 'วันที่แก้ไขแล้ว (NULL = ยังไม่แก้)',
  -- Indexes for troubleshooting
  INDEX idx_error_type (error_type),
  INDEX idx_created_at (created_at),
  INDEX idx_user_id (user_id),
  INDEX idx_unresolved (resolved_at) -- Find unresolved errors
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci COMMENT = '[v1.5.1 NEW] Error Log สำหรับ Document Numbering System';

-- =====================================================
CREATE TABLE document_number_reservations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  -- Reservation Details
  token VARCHAR(36) NOT NULL UNIQUE COMMENT 'UUID v4',
  document_number VARCHAR(100) NOT NULL UNIQUE,
  document_number_status ENUM('RESERVED', 'CONFIRMED', 'CANCELLED', 'VOID') NOT NULL DEFAULT 'RESERVED',
  -- Linkage
  document_id INT NULL COMMENT 'FK to documents (NULL until confirmed)',
  -- Context (for debugging)
  project_id INT NOT NULL,
  correspondence_type_id INT NOT NULL,
  originator_organization_id INT NOT NULL,
  recipient_organization_id INT DEFAULT 0,
  user_id INT NOT NULL,
  -- Timestamps
  reserved_at DATETIME(6) DEFAULT CURRENT_TIMESTAMP(6),
  expires_at DATETIME(6) NOT NULL,
  confirmed_at DATETIME(6) NULL,
  cancelled_at DATETIME(6) NULL,
  -- Audit
  ip_address VARCHAR(45),
  user_agent TEXT,
  metadata JSON NULL COMMENT 'Additional context',
  -- Indexes
  INDEX idx_token (token),
  INDEX idx_status (document_number_status),
  INDEX idx_status_expires (document_number_status, expires_at),
  INDEX idx_document_id (document_id),
  INDEX idx_user_id (user_id),
  INDEX idx_reserved_at (reserved_at),
  -- Foreign Keys
  FOREIGN KEY (document_id) REFERENCES correspondence_revisions(id) ON DELETE
  SET NULL,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (correspondence_type_id) REFERENCES correspondence_types(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci COMMENT = 'Document Number Reservations - Two-Phase Commit';

-- =====================================================
-- 10. ⚙️ System & Logs (ระบบและ Log)
-- =====================================================
-- 1.1 JSON Schemas Registry
-- รองรับ: Backend Plan T2.5.1, Req 6.11.1
-- เหตุผล: เพื่อ Validate โครงสร้าง JSON Details ของเอกสารแต่ละประเภทแบบ Centralized
CREATE TABLE json_schemas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  schema_code VARCHAR(100) NOT NULL COMMENT 'รหัส Schema (เช่น RFA_DWG)',
  version INT NOT NULL DEFAULT 1 COMMENT 'เวอร์ชันของ Schema',
  table_name VARCHAR(100) NOT NULL COMMENT 'ชื่อตารางเป้าหมาย (เช่น rfa_revisions)',
  schema_definition JSON NOT NULL COMMENT 'โครงสร้าง Data Schema (AJV Standard)',
  ui_schema JSON NULL COMMENT 'โครงสร้าง UI Schema สำหรับ Frontend',
  virtual_columns JSON NULL COMMENT 'Config สำหรับสร้าง Virtual Columns',
  migration_script JSON NULL COMMENT 'Script สำหรับแปลงข้อมูลจากเวอร์ชันก่อนหน้า',
  is_active BOOLEAN DEFAULT TRUE COMMENT 'สถานะการใช้งาน',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  -- ป้องกัน Schema Code ซ้ำกันใน Version เดียวกัน
  UNIQUE KEY uk_schema_version (schema_code, version)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = 'ตารางเก็บ JSON Schema และ Configuration';

-- 1.2 User Preferences
-- รองรับ: Req 5.5, 6.8.3
-- เหตุผล: แยกการตั้งค่า Notification และ UI ออกจากตาราง Users หลัก
CREATE TABLE user_preferences (
  user_id INT PRIMARY KEY,
  notify_email BOOLEAN DEFAULT TRUE,
  notify_line BOOLEAN DEFAULT TRUE,
  digest_mode BOOLEAN DEFAULT FALSE COMMENT 'รับแจ้งเตือนแบบรวม (Digest) แทน Real - time',
  ui_theme VARCHAR(20) DEFAULT 'light',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_user_prefs_user FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- ตารางเก็บบันทึกการกระทำของผู้ใช้
-- 4.1 Audit Logs Enhancements
-- รองรับ: Req 6.1
-- เหตุผล: รองรับ Distributed Tracing และระบุความรุนแรง
CREATE TABLE audit_logs (
  audit_id BIGINT NOT NULL AUTO_INCREMENT COMMENT 'ID ของ Log',
  request_id VARCHAR(100) NULL COMMENT 'Trace ID linking to app logs',
  user_id INT COMMENT 'ผู้กระทำ',
  ACTION VARCHAR(100) NOT NULL COMMENT 'การกระทำ (
        เช่น rfa.create,
        correspondence.update,
        login.success
    )',
  severity ENUM(
    'INFO',
    'WARN',
    'ERROR',
    'CRITICAL '
  ) DEFAULT 'INFO',
  entity_type VARCHAR(50) COMMENT 'ตาราง / โมดูล (เช่น ''rfa '', ''correspondence '')',
  entity_id VARCHAR(50) COMMENT 'Primary ID ของระเบียนที่ได้รับผลกระทำ',
  details_json JSON COMMENT 'ข้อมูลบริบท',
  ip_address VARCHAR(45) COMMENT 'IP Address',
  user_agent VARCHAR(255) COMMENT 'User Agent',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT 'เวลาที่กระทำ',
  -- [แก้ไข] รวม created_at เข้ามาใน Primary Key เพื่อรองรับ Partition
  PRIMARY KEY (audit_id, created_at),
  -- [แก้ไข] ใช้ Index ธรรมดาแทน Foreign Key เพื่อไม่ให้ติดข้อจำกัดของ Partition Table
  INDEX idx_audit_user (user_id),
  INDEX idx_audit_action (ACTION),
  INDEX idx_audit_entity (entity_type, entity_id),
  INDEX idx_audit_created (created_at)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci COMMENT = 'ตารางเก็บบันทึกการกระทำของผู้ใช้' -- [เพิ่ม] คำสั่ง Partition
PARTITION BY RANGE (YEAR(created_at)) (
  PARTITION p_old
  VALUES LESS THAN (2024),
    PARTITION p2024
  VALUES LESS THAN (2025),
    PARTITION p2025
  VALUES LESS THAN (2026),
    PARTITION p2026
  VALUES LESS THAN (2027),
    PARTITION p2027
  VALUES LESS THAN (2028),
    PARTITION p2028
  VALUES LESS THAN (2029),
    PARTITION p2029
  VALUES LESS THAN (2030),
    PARTITION p2030
  VALUES LESS THAN (2031),
    PARTITION p_future
  VALUES LESS THAN MAXVALUE
);

-- ตารางสำหรับจัดการการแจ้งเตือน (Email/Line/System)
CREATE TABLE notifications (
  id INT NOT NULL AUTO_INCREMENT COMMENT 'ID ของการแจ้งเตือน',
  user_id INT NOT NULL COMMENT 'ID ผู้ใช้',
  title VARCHAR(255) NOT NULL COMMENT 'หัวข้อการแจ้งเตือน',
  message TEXT NOT NULL COMMENT 'รายละเอียดการแจ้งเตือน',
  notification_type ENUM('EMAIL', 'LINE', 'SYSTEM ') NOT NULL COMMENT 'ประเภท (EMAIL, LINE, SYSTEM)',
  is_read BOOLEAN DEFAULT FALSE COMMENT 'สถานะการอ่าน',
  entity_type VARCHAR(50) COMMENT 'เช่น ''rfa '',
    ''circulation ''',
  entity_id INT COMMENT 'ID ของเอนทิตีที่เกี่ยวข้อง',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT 'วันที่สร้าง',
  -- [แก้ไข] รวม created_at เข้ามาใน Primary Key
  PRIMARY KEY (id, created_at),
  -- [แก้ไข] ใช้ Index ธรรมดาแทน Foreign Key
  INDEX idx_notif_user (user_id),
  INDEX idx_notif_type (notification_type),
  INDEX idx_notif_read (is_read),
  INDEX idx_notif_created (created_at)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci COMMENT = 'ตารางสำหรับจัดการการแจ้งเตือน (Email / Line / System)' -- [เพิ่ม] คำสั่ง Partition
PARTITION BY RANGE (YEAR(created_at)) (
  PARTITION p_old
  VALUES LESS THAN (2024),
    PARTITION p2024
  VALUES LESS THAN (2025),
    PARTITION p2025
  VALUES LESS THAN (2026),
    PARTITION p2026
  VALUES LESS THAN (2027),
    PARTITION p2027
  VALUES LESS THAN (2028),
    PARTITION p2028
  VALUES LESS THAN (2029),
    PARTITION p2029
  VALUES LESS THAN (2030),
    PARTITION p2030
  VALUES LESS THAN (2031),
    PARTITION p_future
  VALUES LESS THAN MAXVALUE
);

-- ตารางสำหรับจัดการดัชนีการค้นหาขั้นสูง (Full-text Search)
CREATE TABLE search_indices (
  id INT PRIMARY KEY AUTO_INCREMENT COMMENT 'ID ของดัชนี',
  entity_type VARCHAR(50) NOT NULL COMMENT 'ชนิดเอนทิตี (เช่น ''correspondence '', ''rfa '')',
  entity_id INT NOT NULL COMMENT 'ID ของเอนทิตี',
  content TEXT NOT NULL COMMENT 'เนื้อหาที่จะค้นหา',
  indexed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'วันที่สร้าง / อัปเดตัชนี '
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci COMMENT = 'ตารางสำหรับจัดการดัชนีการค้นหาขั้นสูง (Full - text Search)';

-- ตารางสำหรับบันทึกประวัติการสำรองข้อมูล
CREATE TABLE backup_logs (
  id INT PRIMARY KEY AUTO_INCREMENT COMMENT 'ID ของการสำรอง',
  backup_type ENUM('DATABASE', 'FILES', 'FULL') NOT NULL COMMENT 'ประเภท (DATABASE, FILES, FULL)',
  backup_path VARCHAR(500) NOT NULL COMMENT 'ตำแหน่งไฟล์สำรอง',
  file_size BIGINT COMMENT 'ขนาดไฟล์',
  STATUS ENUM(
    'STARTED',
    'COMPLETED',
    'FAILED'
  ) NOT NULL COMMENT 'สถานะ',
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'เวลาเริ่มต้น',
  completed_at TIMESTAMP NULL COMMENT 'เวลาเสร็จสิ้น',
  error_message TEXT COMMENT 'ข้อความผิดพลาด (ถ้ามี)'
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci COMMENT = 'ตารางสำหรับบันทึกประวัติการสำรองข้อมูล';

-- ============================================================
-- ส่วนที่ 11: Unified Workflow Engine (Phase 6A/Phase 3)
-- ============================================================
DROP TABLE IF EXISTS workflow_histories;

DROP TABLE IF EXISTS workflow_instances;

DROP TABLE IF EXISTS workflow_definitions;

-- 1. ตารางเก็บนิยาม Workflow (Definition / DSL)
CREATE TABLE workflow_definitions (
  id CHAR(36) NOT NULL PRIMARY KEY COMMENT 'UUID ของ Workflow Definition',
  workflow_code VARCHAR(50) NOT NULL COMMENT 'รหัส Workflow เช่น RFA_FLOW_V1, CORRESPONDENCE_FLOW_V1',
  version INT NOT NULL DEFAULT 1 COMMENT 'หมายเลข Version',
  description TEXT NULL COMMENT 'คำอธิบาย Workflow',
  dsl JSON NOT NULL COMMENT 'นิยาม Workflow ต้นฉบับ (YAML/JSON Format)',
  compiled JSON NOT NULL COMMENT 'โครงสร้าง Execution Tree ที่ Compile แล้ว',
  is_active BOOLEAN DEFAULT TRUE COMMENT 'สถานะการใช้งาน',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'วันที่สร้าง',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'วันที่แก้ไขล่าสุด',
  -- ป้องกันการมี Workflow Code และ Version ซ้ำกัน
  UNIQUE KEY uq_workflow_version (workflow_code, version)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = 'ตารางเก็บนิยามกฎการเดินเอกสาร (Workflow DSL)';

-- สร้าง Index สำหรับการค้นหา Workflow ที่ Active ล่าสุดได้เร็วขึ้น
CREATE INDEX idx_workflow_active ON workflow_definitions (workflow_code, is_active, version);

-- 2. ตารางเก็บ Workflow Instance (สถานะเอกสารจริง)
CREATE TABLE workflow_instances (
  id CHAR(36) NOT NULL PRIMARY KEY COMMENT 'UUID ของ Instance',
  definition_id CHAR(36) NOT NULL COMMENT 'อ้างอิง Definition ที่ใช้',
  entity_type VARCHAR(50) NOT NULL COMMENT 'ประเภทเอกสาร (rfa_revision, correspondence_revision, circulation)',
  entity_id VARCHAR(50) NOT NULL COMMENT 'ID ของเอกสาร (String/Int)',
  current_state VARCHAR(50) NOT NULL COMMENT 'สถานะปัจจุบัน',
  STATUS ENUM(
    'ACTIVE',
    'COMPLETED',
    'CANCELLED',
    'TERMINATED'
  ) DEFAULT 'ACTIVE' COMMENT 'สถานะภาพรวม',
  context JSON NULL COMMENT 'ตัวแปร Context สำหรับตัดสินใจ',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_wf_inst_def FOREIGN KEY (definition_id) REFERENCES workflow_definitions (id) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = 'ตารางเก็บสถานะการเดินเรื่องของเอกสาร';

CREATE INDEX idx_wf_inst_entity ON workflow_instances (entity_type, entity_id);

CREATE INDEX idx_wf_inst_state ON workflow_instances (current_state);

-- 3. ตารางเก็บประวัติ (Audit Log / History)
CREATE TABLE workflow_histories (
  id CHAR(36) NOT NULL PRIMARY KEY COMMENT 'UUID',
  instance_id CHAR(36) NOT NULL COMMENT 'อ้างอิง Instance',
  from_state VARCHAR(50) NOT NULL COMMENT 'สถานะต้นทาง',
  to_state VARCHAR(50) NOT NULL COMMENT 'สถานะปลายทาง',
  ACTION VARCHAR(50) NOT NULL COMMENT 'Action ที่กระทำ',
  action_by_user_id INT NULL COMMENT 'User ID ผู้กระทำ',
  COMMENT TEXT NULL COMMENT 'ความเห็น',
  metadata JSON NULL COMMENT 'Snapshot ข้อมูล ณ ขณะนั้น',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_wf_hist_inst FOREIGN KEY (instance_id) REFERENCES workflow_instances (id) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = 'ตารางประวัติการเปลี่ยนสถานะ Workflow';

CREATE INDEX idx_wf_hist_instance ON workflow_histories (instance_id);

CREATE INDEX idx_wf_hist_user ON workflow_histories (action_by_user_id);


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
-- Indexes for correspondences
CREATE INDEX idx_corr_type ON correspondences(correspondence_type_id);

CREATE INDEX idx_corr_project ON correspondences(project_id);

CREATE INDEX idx_rfa_rev_v_drawing_count ON rfa_revisions (v_ref_drawing_count);

-- Indexes for document_number_formats
CREATE INDEX idx_document_number_formats_project ON document_number_formats (project_id);

CREATE INDEX idx_document_number_formats_type ON document_number_formats (correspondence_type_id);

CREATE INDEX idx_document_number_formats_project_type ON document_number_formats (project_id, correspondence_type_id);

-- Indexes for document_number_counters
CREATE INDEX idx_document_number_counters_project ON document_number_counters (project_id);

CREATE INDEX idx_document_number_counters_org ON document_number_counters (originator_organization_id);

CREATE INDEX idx_document_number_counters_type ON document_number_counters (correspondence_type_id);

-- Indexes for tags
CREATE INDEX idx_tags_name ON tags (tag_name);

CREATE INDEX idx_tags_created_at ON tags (created_at);

-- Indexes for correspondence_tags
CREATE INDEX idx_correspondence_tags_correspondence ON correspondence_tags (correspondence_id);

CREATE INDEX idx_correspondence_tags_tag ON correspondence_tags (tag_id);

-- Indexes for audit_logs
CREATE INDEX idx_audit_logs_user ON audit_logs (user_id);

CREATE INDEX idx_audit_logs_action ON audit_logs (ACTION);

CREATE INDEX idx_audit_logs_entity ON audit_logs (entity_type, entity_id);

CREATE INDEX idx_audit_logs_created_at ON audit_logs (created_at);

CREATE INDEX idx_audit_logs_ip ON audit_logs (ip_address);

-- Indexes for notifications
CREATE INDEX idx_notifications_user ON notifications (user_id);

CREATE INDEX idx_notifications_type ON notifications (notification_type);

CREATE INDEX idx_notifications_read ON notifications (is_read);

CREATE INDEX idx_notifications_entity ON notifications (entity_type, entity_id);

CREATE INDEX idx_notifications_created_at ON notifications (created_at);

-- Indexes for search_indices
CREATE INDEX idx_search_indices_entity ON search_indices (entity_type, entity_id);

CREATE INDEX idx_search_indices_indexed_at ON search_indices (indexed_at);

-- Indexes for backup_logs
CREATE INDEX idx_backup_logs_type ON backup_logs (backup_type);

CREATE INDEX idx_backup_logs_status ON backup_logs (STATUS);

CREATE INDEX idx_backup_logs_started_at ON backup_logs (started_at);

CREATE INDEX idx_backup_logs_completed_at ON backup_logs (completed_at);

-- =====================================================
-- Additional Composite Indexes for Performance
-- =====================================================
-- Composite index for document_number_counters for faster lookups
-- Composite index for notifications for user-specific queries
CREATE INDEX idx_notifications_user_unread ON notifications (user_id, is_read, created_at);

-- Composite index for audit_logs for reporting
CREATE INDEX idx_audit_logs_reporting ON audit_logs (created_at, entity_type, ACTION);

-- Composite index for search_indices for entity-based queries
CREATE INDEX idx_search_entities ON search_indices (entity_type, entity_id, indexed_at);

-- สร้าง Index สำหรับ Cleanup Job
CREATE INDEX idx_attachments_temp_cleanup ON attachments (is_temporary, expires_at);

CREATE INDEX idx_attachments_temp_id ON attachments (temp_id);

CREATE INDEX idx_audit_request_id ON audit_logs (request_id);

-- =====================================================
-- SQL Script for LCBP3-DMS (V1.4.0) - MariaDB
-- Generated from Data Dictionary
-- =====================================================
-- =====================================================
-- 11. 📊 Views & Procedures (วิว และ โปรซีเดอร์)
-- =====================================================
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
  cr.subject,
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
  AND c.correspondence_type_id NOT IN(
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
  rt.type_name_th AS rfa_type_name_th,
  rt.type_name_en AS rfa_type_name_en,
  c.correspondence_number,
  c.discipline_id,
  -- ✅ ดึงจาก Correspondences
  d.discipline_code,
  -- ✅ Join เพิ่มเพื่อแสดง code
  c.project_id,
  p.project_code,
  p.project_name,
  c.originator_id,
  org.organization_name AS originator_name,
  rr.id AS revision_id,
  rr.revision_number,
  rr.revision_label,
  rr.subject,
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
  INNER JOIN rfa_revisions rr ON r.id = rr.rfa_id -- RFA uses shared primary key with correspondences (1:1)
  INNER JOIN correspondences c ON r.id = c.id -- [FIX 1] เพิ่มการ Join ตาราง disciplines
  LEFT JOIN disciplines d ON c.discipline_id = d.id
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

-- ============================================================
-- View: v_user_tasks (Unified Workflow Engine Edition)
-- ============================================================
-- หน้าที่: รวมรายการงานที่ยังค้างอยู่ (Status = ACTIVE) จากทุกระบบ (RFA, Circulation, Correspondence)
-- เพื่อนำไปแสดงในหน้า Dashboard "My Tasks"
-- ============================================================
CREATE OR REPLACE VIEW v_user_tasks AS
SELECT -- 1. Workflow Instance Info
  wi.id AS instance_id,
  wd.workflow_code,
  wi.current_state,
  wi.status AS workflow_status,
  wi.created_at AS assigned_at,
  -- 2. Entity Info (Polymorphic Identity)
  wi.entity_type,
  wi.entity_id,
  -- 3. Normalized Document Info (ดึงข้อมูลจริงจากตารางลูกตามประเภท)
  -- ใช้ CASE WHEN เพื่อรวมคอลัมน์ที่ชื่อต่างกันให้เป็นชื่อกลาง (document_number, subject)
  CASE
    WHEN wi.entity_type = 'rfa_revision' THEN rfa_corr.correspondence_number
    WHEN wi.entity_type = 'circulation' THEN circ.circulation_no
    WHEN wi.entity_type = 'correspondence_revision' THEN corr_corr.correspondence_number
    ELSE 'N/A'
  END AS document_number,
  CASE
    WHEN wi.entity_type = 'rfa_revision' THEN rfa_rev.subject
    WHEN wi.entity_type = 'circulation' THEN circ.circulation_subject
    WHEN wi.entity_type = 'correspondence_revision' THEN corr_rev.subject
    ELSE 'Unknown Document'
  END AS subject,
  -- 4. Context Info (สำหรับ Filter สิทธิ์การมองเห็นที่ Backend)
  -- ดึงเป็น JSON String เพื่อให้ Backend ไป Parse หรือใช้ JSON_CONTAINS
  JSON_UNQUOTE(JSON_EXTRACT(wi.context, '$.ownerId')) AS owner_id,
  JSON_EXTRACT(wi.context, '$.assigneeIds') AS assignee_ids_json
FROM workflow_instances wi
  JOIN workflow_definitions wd ON wi.definition_id = wd.id -- 5. Joins for RFA (ซับซ้อนหน่อยเพราะ RFA ผูกกับ Correspondence อีกที)
  LEFT JOIN rfa_revisions rfa_rev ON wi.entity_type = 'rfa_revision'
  AND wi.entity_id = CAST(rfa_rev.id AS CHAR)
  LEFT JOIN correspondences rfa_corr ON rfa_rev.id = rfa_corr.id -- 6. Joins for Circulation
  LEFT JOIN circulations circ ON wi.entity_type = 'circulation'
  AND wi.entity_id = CAST(circ.id AS CHAR) -- 7. Joins for Correspondence
  LEFT JOIN correspondence_revisions corr_rev ON wi.entity_type = 'correspondence_revision'
  AND wi.entity_id = CAST(corr_rev.id AS CHAR)
  LEFT JOIN correspondences corr_corr ON corr_rev.correspondence_id = corr_corr.id -- 8. Filter เฉพาะงานที่ยัง Active อยู่
WHERE wi.status = 'ACTIVE';

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
CREATE INDEX idx_correspondences_type_project ON correspondences (correspondence_type_id, project_id);

CREATE INDEX idx_corr_revisions_current_status ON correspondence_revisions (is_current, correspondence_status_id);

CREATE INDEX idx_corr_revisions_correspondence_current ON correspondence_revisions (correspondence_id, is_current);

-- Indexes for v_current_rfas performance
CREATE INDEX idx_rfa_revisions_current_status ON rfa_revisions (is_current, rfa_status_code_id);

CREATE INDEX idx_rfa_revisions_rfa_current ON rfa_revisions (rfa_id, is_current);

-- Indexes for document statistics performance
CREATE INDEX idx_correspondences_project_type ON correspondences (project_id, correspondence_type_id);

CREATE INDEX idx_corr_revisions_status_current ON correspondence_revisions (correspondence_status_id, is_current);

CREATE INDEX IDX_AUDIT_DOC_ID ON document_number_audit (document_id);

CREATE INDEX IDX_AUDIT_STATUS ON document_number_audit (STATUS);

CREATE INDEX IDX_AUDIT_OPERATION ON document_number_audit (operation);

SET FOREIGN_KEY_CHECKS = 1;
