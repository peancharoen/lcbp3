-- ==========================================================
-- DMS v1.8.0 Schema Part 2/3: CREATE TABLE Statements
-- รัน: mysql < 01-schema-drop.sql แล้วจึงรัน 02-schema-tables.sql
-- ==========================================================
SET NAMES utf8mb4;

SET time_zone = '+07:00';

SET FOREIGN_KEY_CHECKS = 0;

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
  uuid UUID NOT NULL DEFAULT UUID() COMMENT 'UUID Public Identifier (ADR-019)',
  organization_code VARCHAR(20) NOT NULL UNIQUE COMMENT 'รหัสองค์กร',
  organization_name VARCHAR(255) NOT NULL COMMENT 'ชื่อองค์กร',
  role_id INT COMMENT 'บทบาทขององค์กร',
  is_active BOOLEAN DEFAULT TRUE COMMENT 'สถานะการใช้งาน',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'วันที่สร้าง',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'วันที่แก้ไขล่าสุด',
  deleted_at DATETIME NULL COMMENT 'วันที่ลบ (Soft Delete)',
  FOREIGN KEY (role_id) REFERENCES organization_roles (id) ON DELETE
  SET NULL,
    UNIQUE INDEX idx_organizations_uuid (uuid)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci COMMENT = 'ตาราง Master เก็บข้อมูลองค์กรทั้งหมดที่เกี่ยวข้องในระบบ';

-- ตาราง Master เก็บข้อมูลโครงการ
CREATE TABLE projects (
  id INT PRIMARY KEY AUTO_INCREMENT COMMENT 'ID ของตาราง',
  uuid UUID NOT NULL DEFAULT UUID() COMMENT 'UUID Public Identifier (ADR-019)',
  project_code VARCHAR(50) NOT NULL UNIQUE COMMENT 'รหัสโครงการ',
  project_name VARCHAR(255) NOT NULL COMMENT 'ชื่อโครงการ',
  -- parent_project_id INT COMMENT 'รหัสโครงการหลัก (ถ้ามี)',
  -- contractor_organization_id INT COMMENT 'รหัสองค์กรผู้รับเหมา (ถ้ามี)',
  is_active TINYINT(1) DEFAULT 1 COMMENT 'สถานะการใช้งาน',
  -- FOREIGN KEY (parent_project_id) REFERENCES projects(id) ON DELETE SET NULL,
  -- FOREIGN KEY (contractor_organization_id) REFERENCES organizations(id) ON DELETE SET NULL
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'วันที่สร้าง',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'วันที่แก้ไขล่าสุด',
  deleted_at DATETIME NULL COMMENT 'วันที่ลบ (Soft Delete)',
  UNIQUE INDEX idx_projects_uuid (uuid)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci COMMENT = 'ตาราง Master เก็บข้อมูลโครงการ';

-- ตาราง Master เก็บข้อมูลสัญญา
CREATE TABLE contracts (
  id INT PRIMARY KEY AUTO_INCREMENT COMMENT 'ID ของตาราง',
  uuid UUID NOT NULL DEFAULT UUID() COMMENT 'UUID Public Identifier (ADR-019)',
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
  FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE,
  UNIQUE INDEX idx_contracts_uuid (uuid)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci COMMENT = 'ตาราง Master เก็บข้อมูลสัญญา';

-- =====================================================
-- 2. 👥 Users & RBAC (ผู้ใช้, สิทธิ์, บทบาท)
-- =====================================================
-- ตาราง Master เก็บข้อมูลผู้ใช้งาน (User)
CREATE TABLE users (
  user_id INT PRIMARY KEY AUTO_INCREMENT COMMENT 'ID ของตาราง',
  uuid UUID NOT NULL DEFAULT UUID() COMMENT 'UUID Public Identifier (ADR-019)',
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
  SET NULL,
    UNIQUE INDEX idx_users_uuid (uuid)
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
  uuid UUID NOT NULL DEFAULT UUID() COMMENT 'UUID Public Identifier (ADR-019)',
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
    UNIQUE KEY uq_corr_no_per_project (project_id, correspondence_number),
    UNIQUE INDEX idx_correspondences_uuid (uuid)
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
  uuid UUID NOT NULL DEFAULT UUID() COMMENT 'UUID Public Identifier (ADR-019)',
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
    INDEX idx_corr_rev_v_subtype (v_doc_subtype),
    UNIQUE INDEX idx_correspondence_revisions_uuid (uuid)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci COMMENT = 'ตาราง "ลูก" เก็บประวัติการแก้ไข (Revisions) ของ correspondences (1 :N)';

-- ตาราง Master เก็บ Tags ทั้งหมดที่ใช้ในระบบ
CREATE TABLE tags (
  id INT PRIMARY KEY AUTO_INCREMENT COMMENT 'ID ของตาราง',
  project_id INT NULL COMMENT 'ID โครงการ (NULL = Global Tag)',
  tag_name VARCHAR(100) NOT NULL COMMENT 'ชื่อ Tag',
  color_code VARCHAR(30) DEFAULT 'default' COMMENT 'รหัสสี หรือชื่อคลาสสำหรับ UI',
  description TEXT COMMENT 'คำอธิบายแท็ก',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'วันที่สร้าง',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'วันที่แก้ไขล่าสุด',
  created_by INT COMMENT 'ผู้สร้าง',
  deleted_at DATETIME NULL COMMENT 'ลบแบบ Soft Delete',
  -- Constraints & Indexes
  FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users (user_id) ON DELETE
  SET NULL,
    UNIQUE KEY ux_tag_project (project_id, tag_name),
    INDEX idx_tags_deleted_at (deleted_at)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci COMMENT = 'ตาราง Master เก็บ Tags ย่อยตาม Project';

-- ตารางเชื่อมระหว่าง correspondences และ tags (M:N)
CREATE TABLE correspondence_tags (
  correspondence_id INT COMMENT 'ID ของเอกสาร',
  tag_id INT COMMENT 'ID ของ Tag',
  PRIMARY KEY (correspondence_id, tag_id),
  FOREIGN KEY (correspondence_id) REFERENCES correspondences (id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES tags (id) ON DELETE CASCADE,
  INDEX idx_tag_lookup (tag_id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci COMMENT = 'ตารางเชื่อมระหว่าง correspondences และ tags (M:N)';

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
  id INT PRIMARY KEY COMMENT 'ID (แชร์กับ correspondence_revisions)',
  rfa_status_code_id INT NOT NULL COMMENT 'สถานะ RFA',
  rfa_approve_code_id INT COMMENT 'ผลการอนุมัติ',
  approved_date DATE COMMENT 'วันที่อนุมัติ',
  details JSON NULL COMMENT 'RFA Specific Details',
  schema_version INT DEFAULT 1 COMMENT 'Version ของ JSON Schema',
  v_ref_drawing_count INT GENERATED ALWAYS AS (
    JSON_UNQUOTE(
      JSON_EXTRACT(details, '$.drawingCount')
    )
  ) VIRTUAL,
  FOREIGN KEY (id) REFERENCES correspondence_revisions (id) ON DELETE CASCADE,
  FOREIGN KEY (rfa_status_code_id) REFERENCES rfa_status_codes (id),
  FOREIGN KEY (rfa_approve_code_id) REFERENCES rfa_approve_codes (id) ON DELETE
  SET NULL
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci COMMENT = 'ตารางขยายของ correspondence_revisions สำหรับ RFA (1:1)';

-- ตารางรายการอ้างอิง Drawing Revision ของ RFA (รองรับ Shop Drawing และ As-Built Drawing)
CREATE TABLE rfa_items (
  id INT PRIMARY KEY AUTO_INCREMENT COMMENT 'ID ของตาราง',
  rfa_revision_id INT NOT NULL COMMENT 'ID ของ RFA Revision',
  item_type ENUM('SHOP', 'AS_BUILT') NOT NULL COMMENT 'ประเภท Drawing Revision ที่ถูกอ้างอิง',
  shop_drawing_revision_id INT NULL COMMENT 'ID ของ Shop Drawing Revision',
  asbuilt_drawing_revision_id INT NULL COMMENT 'ID ของ As-Built Drawing Revision',
  FOREIGN KEY (rfa_revision_id) REFERENCES rfa_revisions (id) ON DELETE CASCADE,
  FOREIGN KEY (shop_drawing_revision_id) REFERENCES shop_drawing_revisions (id) ON DELETE CASCADE,
  FOREIGN KEY (asbuilt_drawing_revision_id) REFERENCES asbuilt_drawing_revisions (id) ON DELETE CASCADE,
  UNIQUE KEY uq_rfa_items_shop (rfa_revision_id, shop_drawing_revision_id),
  UNIQUE KEY uq_rfa_items_asbuilt (rfa_revision_id, asbuilt_drawing_revision_id),
  INDEX idx_rfa_items_type (item_type),
  INDEX idx_rfa_items_shop (shop_drawing_revision_id),
  INDEX idx_rfa_items_asbuilt (asbuilt_drawing_revision_id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci COMMENT = 'ตารางรายการอ้างอิง Drawing Revision ของ RFA โดย 1 แถวต้องอ้างอิง Shop Drawing Revision หรือ As-Built Drawing Revision อย่างใดอย่างหนึ่ง';

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
  uuid UUID NOT NULL DEFAULT UUID() COMMENT 'UUID Public Identifier (ADR-019)',
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
  UNIQUE KEY ux_condwg_no_project (project_id, condwg_no),
  UNIQUE INDEX idx_contract_drawings_uuid (uuid)
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
  uuid UUID NOT NULL DEFAULT UUID() COMMENT 'UUID Public Identifier (ADR-019)',
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
  UNIQUE KEY ux_shop_dwg_no_project (project_id, drawing_number),
  UNIQUE INDEX idx_shop_drawings_uuid (uuid)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci COMMENT = 'ตาราง Master เก็บข้อมูล "แบบก่อสร้าง"';

-- ตาราง "ลูก" เก็บประวัติ (Revisions) ของ shop_drawings (1:N)
CREATE TABLE shop_drawing_revisions (
  id INT PRIMARY KEY AUTO_INCREMENT COMMENT 'ID ของ Revision',
  uuid UUID NOT NULL DEFAULT UUID() COMMENT 'UUID Public Identifier (ADR-019)',
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
    UNIQUE KEY uq_sd_current (shop_drawing_id, is_current),
    UNIQUE INDEX idx_shop_drawing_revisions_uuid (uuid)
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
  uuid UUID NOT NULL DEFAULT UUID() COMMENT 'UUID Public Identifier (ADR-019)',
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
  UNIQUE KEY ux_asbuilt_no_project (project_id, drawing_number),
  UNIQUE INDEX idx_asbuilt_drawings_uuid (uuid)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci COMMENT = 'ตาราง Master เก็บข้อมูล "แบบ AS Built"';

-- ตาราง "ลูก" เก็บประวัติ (Revisions) ของ AS Built (1:N)
CREATE TABLE asbuilt_drawing_revisions (
  id INT PRIMARY KEY AUTO_INCREMENT COMMENT 'ID ของ Revision',
  uuid UUID NOT NULL DEFAULT UUID() COMMENT 'UUID Public Identifier (ADR-019)',
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
    UNIQUE KEY uq_asbuilt_current (asbuilt_drawing_id, is_current),
    UNIQUE INDEX idx_asbuilt_drawing_revisions_uuid (uuid)
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
  uuid UUID NOT NULL DEFAULT UUID() COMMENT 'UUID Public Identifier (ADR-019)',
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
  FOREIGN KEY (created_by_user_id) REFERENCES users (user_id),
  UNIQUE INDEX idx_circulations_uuid (uuid)
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
  uuid UUID NOT NULL DEFAULT UUID() COMMENT 'UUID Public Identifier (ADR-019)',
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
  INDEX idx_attachments_reference_date (reference_date),
  UNIQUE INDEX idx_attachments_uuid (uuid)
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
    'CANCEL',
    'VOID',
    'GENERATE'
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
    'VALIDATION_ERROR',
    -- Template/input validation error
    'SEQUENCE_EXHAUSTED',
    -- Counter reached maximum value
    'RESERVATION_EXPIRED',
    -- Reservation token expired
    'DUPLICATE_NUMBER',
    -- Duplicate document number detected
    'GENERATE_ERROR' -- General generation error
  ) NOT NULL COMMENT 'ประเภท error (9 types)',
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
  uuid UUID NOT NULL DEFAULT UUID() COMMENT 'UUID Public Identifier (ADR-019)',
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
  INDEX idx_notif_created (created_at),
  INDEX idx_notifications_uuid (uuid)
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
