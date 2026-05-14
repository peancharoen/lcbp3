---
title: 'Data & Storage: Data Dictionary and Data Model Architecture'
version: 1.9.0
status: released
owner: Nattanin Peancharoen
last_updated: 2026-04-14
related:
  - specs/01-requirements/02-architecture.md
  - specs/01-requirements/03-functional-requirements.md
---

# 1. Data Model Architecture Overview

## 📋 1.1 Overview

เอกสารนี้อธิบายสถาปัตยกรรมของ Data Model สำหรับระบบ LCBP3-DMS โดยครอบคลุมโครงสร้างฐานข้อมูล, ความสัมพันธ์ระหว่างตาราง, และหลักการออกแบบที่สำคัญ

## 🎯 1.2 Design Principles

### 1. Separation of Concerns

- **Master-Revision Pattern**: แยกข้อมูลที่ไม่เปลี่ยนแปลง (Master) จากข้อมูลที่มีการแก้ไข (Revisions)
  - `correspondences` (Master) ↔ `correspondence_revisions` (Revisions)
  - `rfas` (Master) ↔ `rfa_revisions` (Revisions)
  - `shop_drawings` (Master) ↔ `shop_drawing_revisions` (Revisions)

### 2. Data Integrity

- **Foreign Key Constraints**: ใช้ FK ทุกความสัมพันธ์เพื่อรักษาความสมบูรณ์ของข้อมูล
- **Soft Delete**: ใช้ `deleted_at` แทนการลบข้อมูลจริง เพื่อรักษาประวัติ
- **Optimistic Locking**: ใช้ `version` column ใน `document_number_counters` ป้องกัน Race Condition

### 3. Flexibility & Extensibility

- **JSON Details Field**: เก็บข้อมูลเฉพาะประเภทใน `correspondence_revisions.details`
- **Virtual Columns**: สร้าง Index จาก JSON fields สำหรับ Performance
- **Master Data Tables**: แยกข้อมูล Master (Types, Status, Codes) เพื่อความยืดหยุ่น

### 4. Security & Audit

- **RBAC (Role-Based Access Control)**: ระบบสิทธิ์แบบ Hierarchical Scope
- **Audit Trail**: บันทึกผู้สร้าง/แก้ไข และเวลาในทุกตาราง
- **Two-Phase File Upload**: ป้องกันไฟล์ขยะด้วย Temporary Storage

# 2. Database Schema Overview (ERD)

### Entity Relationship Diagram

```mermaid
erDiagram
    %% Core Entities
    organizations ||--o{ users : "employs"
    projects ||--o{ contracts : "contains"
    projects ||--o{ correspondences : "manages"

    %% RBAC
    users ||--o{ user_assignments : "has"
    roles ||--o{ user_assignments : "assigned_to"
    roles ||--o{ role_permissions : "has"
    permissions ||--o{ role_permissions : "granted_by"

    %% Correspondences
    correspondences ||--o{ correspondence_revisions : "has_revisions"
    correspondence_types ||--o{ correspondences : "categorizes"
    correspondence_status ||--o{ correspondence_revisions : "defines_state"
    disciplines ||--o{ correspondences : "classifies"

    %% RFAs
    rfas ||--o{ rfa_revisions : "has_revisions"
    rfa_types ||--o{ rfas : "categorizes"
    rfa_status_codes ||--o{ rfa_revisions : "defines_state"
    rfa_approve_codes ||--o{ rfa_revisions : "defines_result"
    disciplines ||--o{ rfas : "classifies"

    %% Drawings
    shop_drawings ||--o{ shop_drawing_revisions : "has_revisions"
    shop_drawing_main_categories ||--o{ shop_drawings : "categorizes"
    shop_drawing_sub_categories ||--o{ shop_drawings : "sub_categorizes"

    %% Attachments
    attachments ||--o{ correspondence_revision_attachments : "attached_to"
    correspondence_revisions ||--o{ correspondence_revision_attachments : "has"
```

---

# 3. Data Dictionary V1.9.0

> หมายเหตุ: PK = Primary Key, FK = Foreign Key, AI = AUTO_INCREMENT. รูปแบบ Soft Delete จะปรากฏ Column `deleted_at DATETIME NULL` เป็นมาตรฐาน

## **1. 🏢 Core & Master Data Tables (องค์กร, โครงการ, สัญญา)**

### 1.1 organization_roles

- - Purpose **: MASTER TABLE FOR organization role TYPES IN the system | COLUMN Name | Data TYPE | Constraints | Description | | ----------- | ----------- | --------------------------- | ---------------------------------------------------------------- |
    | id | INT | PRIMARY KEY,
    AUTO_INCREMENT | UNIQUE identifier FOR organization role | | role_name | VARCHAR(20) | NOT NULL,
    UNIQUE | Role name (
    CONTRACTOR,
    THIRD PARTY
    ) |
    | created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Record creation timestamp |
    | updated_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP ON UPDATE | Last update timestamp |
    | deleted_at | DATETIME | NULL | Soft delete timestamp | ** INDEXES **: - PRIMARY KEY (id) - UNIQUE (role_name) ** Business Rules \*\*: - Predefined system roles FOR organization TYPES - Cannot be deleted IF referenced by organizations ---

### 1.2 organizations

- - Purpose **: MASTER TABLE storing ALL organizations involved IN the system | COLUMN Name | Data TYPE | Constraints | Description | | ----------------- | ------------ | ----------------------------------- | ---------------------------------------- |
    | id | INT | PRIMARY KEY,
    AUTO_INCREMENT | UNIQUE identifier FOR organization | | uuid | UUID | NOT NULL, UNIQUE, DEFAULT UUID() | UUID Public Identifier (ADR-019) | | organization_code | VARCHAR(20) | NOT NULL,
    UNIQUE | Organization code (e.g., 'กทท.', 'TEAM') | | organization_name | VARCHAR(255) | NOT NULL | FULL organization name | | is_active | BOOLEAN | DEFAULT TRUE | Active STATUS (1 = active, 0 = inactive) | | created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Record creation timestamp | | updated_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP ON UPDATE | Last
    UPDATE timestamp |
    | deleted_at | DATETIME | NULL | Soft delete timestamp | ** INDEXES **: - PRIMARY KEY (id) - UNIQUE (organization_code) - INDEX (is_active) ** Relationships \*\*: - Referenced by: users,
    project_organizations,
    contract_organizations,
    correspondences,
    circulations ---

    ### 1.3 projects
    - - Purpose **: MASTER TABLE FOR ALL projects IN the system | COLUMN Name | Data TYPE | Constraints | Description | | ------------ | ------------ | --------------------------- | ----------------------------- |
        | id | INT | PRIMARY KEY,
        AUTO_INCREMENT | UNIQUE identifier FOR project | | uuid | UUID | NOT NULL, UNIQUE, DEFAULT UUID() | UUID Public Identifier (ADR-019) | | project_code | VARCHAR(50) | NOT NULL,
        UNIQUE | Project code (e.g., 'LCBP3') | | project_name | VARCHAR(255) | NOT NULL | FULL project name | | is_active | TINYINT(1) | DEFAULT 1 | Active STATUS |
        | created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Record creation timestamp |
        | updated_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP ON UPDATE | Last update timestamp |
        | deleted_at | DATETIME | NULL | Soft delete timestamp |
        ** INDEXES **: - PRIMARY KEY (id) - UNIQUE (project_code) - INDEX (is_active) ** Relationships \*\*: - Referenced by: contracts,
        correspondences,
        document_number_formats,
        drawings ---

    ### 1.4 contracts
    - - Purpose **: MASTER TABLE FOR contracts within projects | COLUMN Name | Data TYPE | Constraints | Description | | ------------- | ------------ | ----------------------------------- | ------------------------------ |
        | id | INT | PRIMARY KEY,
        AUTO_INCREMENT | UNIQUE identifier FOR contract | | uuid | UUID | NOT NULL, UNIQUE, DEFAULT UUID() | UUID Public Identifier (ADR-019) | | project_id | INT | NOT NULL,
        FK | Reference TO projects TABLE | | contract_code | VARCHAR(50) | NOT NULL,
        UNIQUE | Contract code | | contract_name | VARCHAR(255) | NOT NULL | FULL contract name | | description | TEXT | NULL | Contract description | | start_date | DATE | NULL | Contract START date | | end_date | DATE | NULL | Contract
        END date | | is_active | BOOLEAN | DEFAULT TRUE | Active STATUS | | created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Record creation timestamp | | updated_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP ON UPDATE | Last
        UPDATE timestamp |
        | deleted_at | DATETIME | NULL | Soft delete timestamp | ** INDEXES **: - PRIMARY KEY (id) - UNIQUE (contract_code) - FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE - INDEX (project_id, is_active) ** Relationships \*\*: - Parent: projects - Referenced by: contract_organizations,
        user_assignments ---

    ### 1.5 disciplines (NEW v1.5.1)
    - - Purpose **: เก็บข้อมูลสาขางาน (Disciplines) แยกตามสัญญา (Req 6B) | COLUMN Name | Data TYPE | Constraints | Description | |: -------------- | :----------- | :----------- | :--------------------- |
        | id | INT | PK,
        AI | UNIQUE identifier | | contract_id | INT | FK,
        NOT NULL | ผูกกับสัญญา | | discipline_code | VARCHAR(10) | NOT NULL | รหัสสาขา (เช่น GEN, STR) | | code_name_th | VARCHAR(255) | NULL | ชื่อไทย | | code_name_en | VARCHAR(255) | NULL | ชื่ออังกฤษ | | is_active | TINYINT(1) | DEFAULT 1 | สถานะการใช้งาน | ** INDEXES \*\*: - UNIQUE (contract_id, discipline_code) ---

    ## **2. 👥 Users & RBAC Tables (ผู้ใช้, สิทธิ์, บทบาท)**

    ### 2.1 users
    - - Purpose **: MASTER TABLE storing ALL system users | COLUMN Name | Data TYPE | Constraints | Description | | ----------------------- | ------------ | ----------------------------------- | -------------------------------- |
        | user_id | INT | PRIMARY KEY,
        AUTO_INCREMENT | UNIQUE identifier FOR user | | uuid | UUID | NOT NULL, UNIQUE, DEFAULT UUID() | UUID Public Identifier (ADR-019) | | username | VARCHAR(50) | NOT NULL,
        UNIQUE | Login username | | password_hash | VARCHAR(255) | NOT NULL | Hashed PASSWORD (bcrypt) | | first_name | VARCHAR(50) | NULL | User 's first name |
        | last_name | VARCHAR(50) | NULL | User' s last name | | email | VARCHAR(100) | NOT NULL,
        UNIQUE | Email address | | line_id | VARCHAR(100) | NULL | LINE messenger ID | | primary_organization_id | INT | NULL,
        FK | PRIMARY organization affiliation | | is_active | TINYINT(1) | DEFAULT 1 | Active STATUS | | failed_attempts | INT | DEFAULT 0 | Failed login attempts counter | | locked_until | DATETIME | NULL | Account LOCK expiration time | | last_login_at | TIMESTAMP | NULL | Last successful login timestamp | | created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Record creation timestamp | | updated_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP ON UPDATE | Last
        UPDATE timestamp | | deleted_at | DATETIME | NULL | Deleted at | ** INDEXES **: - PRIMARY KEY (user_id) - UNIQUE (username) - UNIQUE (email) - FOREIGN KEY (primary_organization_id) REFERENCES organizations(id) ON DELETE
        SET NULL - INDEX (is_active) - INDEX (email) ** Relationships \*\*: - Parent: organizations (primary_organization_id) - Referenced by: user_assignments,
        audit_logs,
        notifications,
        circulation_routings ---

    ### 2.2 roles
    - - Purpose **: MASTER TABLE defining system roles WITH scope levels | COLUMN Name | Data TYPE | Constraints | Description | | ----------- | ------------ | --------------------------- | ---------------------------------------------------- |
        | role_id | INT | PRIMARY KEY,
        AUTO_INCREMENT | UNIQUE identifier FOR role | | **uuid** | **UUID** | **NOT NULL, DEFAULT (UUID()), UNIQUE** | **[delta-11] UUID Public Identifier (ADR-019) — ใช้ใน API Response / distribution_recipients** | | role_name | VARCHAR(100) | NOT NULL | Role name (e.g., 'Superadmin', 'Document Control') | | scope | ENUM | NOT NULL | Scope LEVEL: GLOBAL,
        Organization,
        Project,
        Contract | | description | TEXT | NULL | Role description | | is_system | BOOLEAN | DEFAULT FALSE | System role flag (cannot be deleted) |
        | created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Record creation timestamp |
        | updated_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP ON UPDATE | Last update timestamp |
        | deleted_at | DATETIME | NULL | Soft delete timestamp |
        ** INDEXES **: - PRIMARY KEY (role_id) - **UNIQUE INDEX idx_roles_uuid (uuid) [delta-11]** - INDEX (scope) ** Relationships \*\*: - Referenced by: role_permissions,
        user_assignments ---

    ### 2.3 permissions
    - - Purpose **: MASTER TABLE defining ALL system permissions | COLUMN Name | Data TYPE | Constraints | Description | | --------------- | ------------ | --------------------------- | ------------------------------------------------------ |
        | permission_id | INT | PRIMARY KEY,
        AUTO_INCREMENT | UNIQUE identifier FOR permission | | permission_name | VARCHAR(100) | NOT NULL,
        UNIQUE | Permission code (e.g., 'rfas.create', 'document.view') | | description | TEXT | NULL | Permission description | | module | VARCHAR(50) | NULL | Related module name | | scope_level | ENUM | NULL | Scope: GLOBAL,
        ORG,
        PROJECT | | is_active | TINYINT(1) | DEFAULT 1 | Active STATUS |
        | created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Record creation timestamp |
        | updated_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP ON UPDATE | Last update timestamp |
        | deleted_at | DATETIME | NULL | Soft delete timestamp |
        ** INDEXES **: - PRIMARY KEY (permission_id) - UNIQUE (permission_name) - INDEX (module) - INDEX (scope_level) - INDEX (is_active) ** Relationships \*\*: - Referenced by: role_permissions ---

    ### 2.4 role_permissions
    - - Purpose **: Junction TABLE mapping roles TO permissions (M :N) | COLUMN Name | Data TYPE | Constraints | Description | | ------------- | --------- | --------------- | ------------------------------ |
        | role_id | INT | PRIMARY KEY,
        FK | Reference TO roles TABLE | | permission_id | INT | PRIMARY KEY,
        FK | Reference TO permissions TABLE | ** INDEXES **: - PRIMARY KEY (role_id, permission_id) - FOREIGN KEY (role_id) REFERENCES roles(role_id) ON DELETE CASCADE - FOREIGN KEY (permission_id) REFERENCES permissions(permission_id) ON DELETE CASCADE - INDEX (permission_id) ** Relationships \*\*: - Parent: roles,
        permissions ---

    ### 2.5 user_assignments
    - - Purpose **: Junction TABLE assigning users TO roles WITH scope context | COLUMN Name | Data TYPE | Constraints | Description | | ------------------- | --------- | --------------------------- | ---------------------------------- |
        | id | INT | PRIMARY KEY,
        AUTO_INCREMENT | UNIQUE identifier | | user_id | INT | NOT NULL,
        FK | Reference TO users TABLE | | role_id | INT | NOT NULL,
        FK | Reference TO roles TABLE | | organization_id | INT | NULL,
        FK | Organization scope (IF applicable) | | project_id | INT | NULL,
        FK | Project scope (IF applicable) | | contract_id | INT | NULL,
        FK | Contract scope (IF applicable) | | assigned_by_user_id | INT | NULL,
        FK | User who made the assignment | | assigned_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Assignment timestamp | ** INDEXES **: - PRIMARY KEY (id) - FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE - FOREIGN KEY (role_id) REFERENCES roles(role_id) ON DELETE CASCADE - FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE - FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE - FOREIGN KEY (contract_id) REFERENCES contracts(id) ON DELETE CASCADE - FOREIGN KEY (assigned_by_user_id) REFERENCES users(user_id) - INDEX (user_id, role_id) - INDEX (organization_id) - INDEX (project_id) - INDEX (contract_id) ** Relationships \*\*: - Parent: users,
        roles,
        organizations,
        projects,
        contracts ---

    ### 2.6 project_organizations
    - - Purpose **: Junction TABLE linking projects TO participating organizations (M :N) | COLUMN Name | Data TYPE | Constraints | Description | | --------------- | --------- | --------------- | -------------------------------- |
        | project_id | INT | PRIMARY KEY,
        FK | Reference TO projects TABLE | | organization_id | INT | PRIMARY KEY,
        FK | Reference TO organizations TABLE | ** INDEXES **: - PRIMARY KEY (project_id, organization_id) - FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE - FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE - INDEX (organization_id) ** Relationships \*\*: - Parent: projects,
        organizations ---

    ### 2.7 contract_organizations
    - - Purpose \*\*: Junction TABLE linking contracts TO participating organizations WITH roles (M :N) | COLUMN Name | Data TYPE | Constraints | Description | | ---------------- | ------------ | --------------- | ------------------------------------------------------------------------- |
        | contract_id | INT | PRIMARY KEY,
        FK | Reference TO contracts TABLE | | organization_id | INT | PRIMARY KEY,
        FK | Reference TO organizations TABLE | | role_in_contract | VARCHAR(100) | NULL | Organization 's role in contract (Owner, Designer, Consultant, Contractor) |

**Indexes**:

- PRIMARY KEY (contract_id, organization_id)
- FOREIGN KEY (contract_id) REFERENCES contracts(id) ON DELETE CASCADE
- FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
- INDEX (organization_id)
- INDEX (role_in_contract)

**Relationships**:

- Parent: contracts, organizations

---

### 2.8 user_preferences (NEW v1.5.1)

**Purpose**: เก็บการตั้งค่าส่วนตัวของผู้ใช้ (Req 5.5, 6.8.3)

| Column Name  | Data Type   | Constraints       | Description        |
| :----------- | :---------- | :---------------- | :----------------- |
| user_id      | INT         | PK, FK            | User ID            |
| notify_email | BOOLEAN     | DEFAULT TRUE      | รับอีเมลแจ้งเตือน  |
| notify_line  | BOOLEAN     | DEFAULT TRUE      | รับไลน์แจ้งเตือน   |
| digest_mode  | BOOLEAN     | DEFAULT FALSE     | รับแจ้งเตือนแบบรวม |
| ui_theme     | VARCHAR(20) | DEFAULT ' light ' | UI Theme           |

---

### 2.9 refresh_tokens (UPDATE v1.8.1)

**Purpose**: เก็บ Refresh Tokens สำหรับการทำ Authentication และ Token Rotation (รองรับ Grace Period)

| Column Name       | Data Type    | Constraints               | Description                                                |
| :---------------- | :----------- | :------------------------ | :--------------------------------------------------------- |
| token_id          | INT          | PK, AI                    | Unique Token ID                                            |
| user_id           | INT          | FK, NOT NULL              | เจ้าของ Token                                              |
| token_hash        | VARCHAR(255) | NOT NULL                  | Hash ของ Refresh Token (Security)                          |
| expires_at        | DATETIME     | NOT NULL                  | วันหมดอายุของ Token                                        |
| is_revoked        | BOOLEAN      | DEFAULT FALSE             | สถานะถูกยกเลิก (True = ใช้งานไม่ได้)                       |
| created_at        | TIMESTAMP    | DEFAULT CURRENT_TIMESTAMP | เวลาที่สร้าง                                               |
| updated_at        | TIMESTAMP    | DEFAULT CURRENT_TIMESTAMP | เวลาที่แก้ไขล่าสุด (ใช้ตรวจสอบ Grace Period ขณะหมุน Token) |
| replaced_by_token | VARCHAR(255) | NULL                      | Token ใหม่ที่มาแทนที่ (กรณี Token Rotation)                |

**Indexes**:

- PRIMARY KEY (token_id)
- FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
- INDEX (user_id)

**Relationships**:

- Parent: users

---

## **3. ✉️ Correspondences Tables (เอกสารหลัก, Revisions, Workflows)**

### 3.1 correspondence_types

**Purpose**: Master table for correspondence document types

| Column Name | Data Type    | Constraints                 | Description                                         |
| ----------- | ------------ | --------------------------- | --------------------------------------------------- |
| id          | INT          | PRIMARY KEY, AUTO_INCREMENT | Unique identifier                                   |
| type_code   | VARCHAR(50)  | NOT NULL, UNIQUE            | Type code (e.g., ' RFA ', ' RFI ', ' TRANSMITTAL ') |
| type_name   | VARCHAR(255) | NOT NULL                    | Full type name                                      |
| sort_order  | INT          | DEFAULT 0                   | Display order                                       |
| is_active   | TINYINT(1)   | DEFAULT 1                   | Active status                                       |
| created_at  | TIMESTAMP    | DEFAULT CURRENT_TIMESTAMP   | Record creation timestamp                           |
| updated_at  | TIMESTAMP    | DEFAULT CURRENT_TIMESTAMP   | Last update timestamp                               |
| deleted_at  | DATETIME     | NULL                        | Soft delete timestamp                               |

**Indexes**:

- PRIMARY KEY (id)
- UNIQUE (type_code)
- INDEX (is_active)
- INDEX (sort_order)

**Relationships**:

- Referenced by: correspondences, document_number_formats, document_number_counters

---

### 3.2 correspondence_sub_types (NEW v1.5.1)

**Purpose**: เก็บประเภทหนังสือย่อย (Sub Types) สำหรับ Mapping เลขรหัส (Req 6B)

| Column Name            | Data Type    | Constraints  | Description                  |
| :--------------------- | :----------- | :----------- | :--------------------------- |
| id                     | INT          | PK, AI       | Unique identifier            |
| contract_id            | INT          | FK, NOT NULL | ผูกกับสัญญา                  |
| correspondence_type_id | INT          | FK, NOT NULL | ผูกกับประเภทเอกสารหลัก       |
| sub_type_code          | VARCHAR(20)  | NOT NULL     | รหัสย่อย (เช่น MAT, SHP)     |
| sub_type_name          | VARCHAR(255) | NULL         | ชื่อประเภทหนังสือย่อย        |
| sub_type_number        | VARCHAR(10)  | NULL         | เลขรหัสสำหรับ Running Number |

---

### 3.3 correspondences (UPDATE v1.7.0)

**Purpose**: Master table for correspondence documents (non-revisioned data)

| Column Name               | Data Type    | Constraints                 | Description                                |
| ------------------------- | ------------ | --------------------------- | ------------------------------------------ |
| id                        | INT          | PRIMARY KEY, AUTO_INCREMENT | Master correspondence ID                   |
| uuid                      | UUID         | NOT NULL, UNIQUE, DEFAULT   | UUID Public Identifier (ADR-019)           |
| correspondence_number     | VARCHAR(100) | NOT NULL                    | Document number (from numbering system)    |
| correspondence_type_id    | INT          | NOT NULL, FK                | Reference to correspondence_types          |
| **discipline_id**         | **INT**      | **NULL, FK**                | **[NEW] สาขางาน (ถ้ามี)**                  |
| is_internal_communication | TINYINT(1)   | DEFAULT 0                   | Internal (1) or external (0) communication |
| project_id                | INT          | NOT NULL, FK                | Reference to projects table                |
| originator_id             | INT          | NULL, FK                    | Originating organization                   |
| created_at                | DATETIME     | DEFAULT CURRENT_TIMESTAMP   | Record creation timestamp                  |
| created_by                | INT          | NULL, FK                    | User who created the record                |
| deleted_at                | DATETIME     | NULL                        | Soft delete timestamp                      |

**Indexes**:

- PRIMARY KEY (id)
- FOREIGN KEY (correspondence_type_id) REFERENCES correspondence_types(id) ON DELETE RESTRICT
- **FOREIGN KEY (discipline_id) REFERENCES disciplines(id) ON DELETE SET NULL**
- FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
- FOREIGN KEY (originator_id) REFERENCES organizations(id) ON DELETE SET NULL
- FOREIGN KEY (created_by) REFERENCES users(user_id) ON DELETE SET NULL
- UNIQUE KEY (project_id, correspondence_number)
- UNIQUE INDEX idx_correspondences_uuid (uuid)
- INDEX (correspondence_type_id)
- INDEX (originator_id)
- INDEX (deleted_at)

**Relationships**:

- Parent: correspondence_types, **disciplines**, projects, organizations, users
- Children: correspondence_revisions, correspondence_recipients, correspondence_tags, correspondence_references, circulations, transmittals

---

### 3.4 correspondence_revisions (UPDATE v1.7.0)

**Purpose**: Child table storing revision history of correspondences (1:N)

| Column Name              | Data Type    | Constraints                       | Description                                                  |
| ------------------------ | ------------ | --------------------------------- | ------------------------------------------------------------ |
| id                       | INT          | PRIMARY KEY, AUTO_INCREMENT       | Unique revision ID                                           |
| uuid                     | UUID         | NOT NULL, UNIQUE, DEFAULT         | UUID Public Identifier (ADR-019)                             |
| correspondence_id        | INT          | NOT NULL, FK                      | Master correspondence ID                                     |
| revision_number          | INT          | NOT NULL                          | Revision sequence (0, 1, 2...)                               |
| revision_label           | VARCHAR(10)  | NULL                              | Display revision (A, B, 1.1...)                              |
| is_current               | BOOLEAN      | DEFAULT FALSE                     | Current revision flag                                        |
| correspondence_status_id | INT          | NOT NULL, FK                      | Current status of this revision                              |
| title                    | VARCHAR(255) | NOT NULL                          | Document title                                               |
| document_date            | DATE         | NULL                              | Document date                                                |
| issued_date              | DATETIME     | NULL                              | Issue date                                                   |
| received_date            | DATETIME     | NULL                              | Received date                                                |
| due_date                 | DATETIME     | NULL                              | Due date for response                                        |
| description              | TEXT         | NULL                              | Revision description                                         |
| details                  | JSON         | NULL                              | Type-specific details (e.g., RFI questions)                  |
| created_at               | DATETIME     | DEFAULT CURRENT_TIMESTAMP         | Revision creation timestamp                                  |
| created_by               | INT          | NULL, FK                          | User who created revision                                    |
| updated_by               | INT          | NULL, FK                          | User who last updated                                        |
| v_ref_project_id         | INT          | GENERATED ALWAYS AS (...) VIRTUAL | Virtual Column ดึง Project ID จาก JSON details เพื่อทำ Index |

| v_doc_subtype | VARCHAR(50) | GENERATED ALWAYS AS (...) VIRTUAL | Virtual Column ดึง Type จาก JSON details |
| schema_version | INT | DEFAULT 1 | Version of the schema used with this details |

**Indexes**:

- PRIMARY KEY (id)
- FOREIGN KEY (correspondence_id) REFERENCES correspondences(id) ON DELETE CASCADE
- FOREIGN KEY (correspondence_status_id) REFERENCES correspondence_status(id) ON DELETE RESTRICT
- FOREIGN KEY (created_by) REFERENCES users(user_id) ON DELETE SET NULL
- FOREIGN KEY (updated_by) REFERENCES users(user_id) ON DELETE SET NULL
- UNIQUE KEY (correspondence_id, revision_number)
- UNIQUE KEY (correspondence_id, is_current)
- INDEX (correspondence_status_id)
- INDEX (is_current)
- INDEX (document_date)
- INDEX (issued_date)
- INDEX (v_ref_project_id)
- INDEX (v_doc_subtype)

---

### 3.5 correspondence_recipients

**Purpose**: Junction table for correspondence recipients (TO/CC) (M:N)

| Column Name               | Data Type            | Constraints     | Description                  |
| ------------------------- | -------------------- | --------------- | ---------------------------- |
| correspondence_id         | INT                  | PRIMARY KEY, FK | Reference to correspondences |
| recipient_organization_id | INT                  | PRIMARY KEY, FK | Recipient organization       |
| recipient_type            | ENUM(' TO ', ' CC ') | PRIMARY KEY     | Recipient type               |

**Indexes**:

- PRIMARY KEY (correspondence_id, recipient_organization_id, recipient_type)
- FOREIGN KEY (correspondence_id) REFERENCES correspondence_revisions(correspondence_id) ON DELETE CASCADE
- FOREIGN KEY (recipient_organization_id) REFERENCES organizations(id) ON DELETE RESTRICT
- INDEX (recipient_organization_id)
- INDEX (recipient_type)

**Relationships**:

- Parent: correspondences, organizations

---

### 3.6 tags (UPDATE v1.8.0)

**Purpose**: Master table for document tagging system (Supports multi-tenant per project)

| Column Name    | Data Type       | Constraints                         | Description                             |
| -------------- | --------------- | ----------------------------------- | --------------------------------------- |
| id             | INT             | PRIMARY KEY, AUTO_INCREMENT         | Unique tag ID                           |
| **project_id** | **INT**         | **NULL, FK**                        | **[NEW] Project scope (NULL = Global)** |
| tag_name       | VARCHAR(100)    | NOT NULL                            | Tag name                                |
| **color_code** | **VARCHAR(30)** | **DEFAULT 'default'**               | **[NEW] UI Color/Class Code**           |
| description    | TEXT            | NULL                                | Tag description                         |
| created_at     | TIMESTAMP       | DEFAULT CURRENT_TIMESTAMP           | Record creation timestamp               |
| updated_at     | TIMESTAMP       | DEFAULT CURRENT_TIMESTAMP ON UPDATE | Last update timestamp                   |
| **created_by** | **INT**         | **NULL, FK**                        | **[NEW] User who created the tag**      |
| **deleted_at** | **DATETIME**    | **NULL**                            | **[NEW] Soft delete timestamp**         |

**Indexes**:

- PRIMARY KEY (id)
- **FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE**
- **FOREIGN KEY (created_by) REFERENCES users(user_id) ON DELETE SET NULL**
- **UNIQUE KEY (project_id, tag_name)**
- INDEX (deleted_at)

**Relationships**:

- Parent: projects, users
- Referenced by: correspondence_tags

---

### 3.7 correspondence_tags (UPDATE v1.8.0)

**Purpose**: Junction table linking correspondences to tags (M:N)

| Column Name       | Data Type | Constraints     | Description                  |
| ----------------- | --------- | --------------- | ---------------------------- |
| correspondence_id | INT       | PRIMARY KEY, FK | Reference to correspondences |
| tag_id            | INT       | PRIMARY KEY, FK | Reference to tags            |

**Indexes**:

- PRIMARY KEY (correspondence_id, tag_id)
- FOREIGN KEY (correspondence_id) REFERENCES correspondences(id) ON DELETE CASCADE
- FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
- **INDEX idx_tag_lookup (tag_id) - For reverse lookup (Find documents by tag)**

**Relationships**:

- Parent: correspondences, tags

---

### 3.8 correspondence_references

**Purpose**: Junction table for cross-referencing correspondences (M:N)

| Column Name           | Data Type | Constraints     | Description                           |
| --------------------- | --------- | --------------- | ------------------------------------- |
| src_correspondence_id | INT       | PRIMARY KEY, FK | Source correspondence ID              |
| tgt_correspondence_id | INT       | PRIMARY KEY, FK | Target (referenced) correspondence ID |

**Indexes**:

- PRIMARY KEY (src_correspondence_id, tgt_correspondence_id)
- FOREIGN KEY (src_correspondence_id) REFERENCES correspondences(id) ON DELETE CASCADE
- FOREIGN KEY (tgt_correspondence_id) REFERENCES correspondences(id) ON DELETE CASCADE
- INDEX (tgt_correspondence_id)

**Relationships**:

- Parent: correspondences (both sides)

---

## **4. 📐 approval: RFA Tables (เอกสารขออนุมัติ, Workflows)**

### 4.1 rfa_types (UPDATE v1.7.0)

**Purpose**: Master table for RFA (Request for Approval) types

| Column Name  | Data Type    | Constraints                 | Description                               |
| :----------- | :----------- | :-------------------------- | :---------------------------------------- |
| id           | INT          | PRIMARY KEY, AUTO_INCREMENT | Unique identifier                         |
| contract_id  | INT          | NOT NULL, FK                | Contract reference                        |
| type_code    | VARCHAR(20)  | NOT NULL                    | Type code (DDW, SDW, ADW, DOC, MAT, etc.) |
| type_name_th | VARCHAR(100) | NOT NULL                    | Full type name (TH)                       |
| type_name_en | VARCHAR(100) | NOT NULL                    | Full type name (EN)                       |
| remark       | TEXT         | NULL                        | Remark                                    |
| is_active    | TINYINT(1)   | DEFAULT 1                   | Active status                             |

**Indexes**:

- PRIMARY KEY (id)
- UNIQUE (contract_id, type_code)
- FOREIGN KEY (contract_id) REFERENCES contracts(id) ON DELETE CASCADE
- INDEX (is_active)

**Relationships**:

- Referenced by: rfas

---

### 4.2 rfa_status_codes

**Purpose**: Master table for RFA status codes

| Column Name | Data Type    | Constraints                 | Description                       |
| ----------- | ------------ | --------------------------- | --------------------------------- |
| id          | INT          | PRIMARY KEY, AUTO_INCREMENT | Unique identifier                 |
| status_code | VARCHAR(20)  | NOT NULL, UNIQUE            | Status code (DFT, FAP, FRE, etc.) |
| status_name | VARCHAR(100) | NOT NULL                    | Full status name                  |
| description | TEXT         | NULL                        | Status description                |
| sort_order  | INT          | DEFAULT 0                   | Display order                     |
| is_active   | TINYINT(1)   | DEFAULT 1                   | Active status                     |

**Indexes**:

- PRIMARY KEY (id)
- UNIQUE (status_code)
- INDEX (is_active)
- INDEX (sort_order)

**Relationships**:

- Referenced by: rfa_revisions

---

### 4.3 rfa_approve_codes

**Purpose**: Master table for RFA approval result codes

| Column Name  | Data Type    | Constraints                 | Description                      |
| ------------ | ------------ | --------------------------- | -------------------------------- |
| id           | INT          | PRIMARY KEY, AUTO_INCREMENT | Unique identifier                |
| approve_code | VARCHAR(20)  | NOT NULL, UNIQUE            | Approval code (1A, 1C, 3R, etc.) |
| approve_name | VARCHAR(100) | NOT NULL                    | Full approval name               |
| description  | TEXT         | NULL                        | Code description                 |
| sort_order   | INT          | DEFAULT 0                   | Display order                    |
| is_active    | TINYINT(1)   | DEFAULT 1                   | Active status                    |

**Indexes**:

- PRIMARY KEY (id)
- UNIQUE (approve_code)
- INDEX (is_active)
- INDEX (sort_order)

**Relationships**:

- Referenced by: rfa_revisions

---

### 4.4 rfas (UPDATE v1.7.0)

**Purpose**: Master table for RFA documents (non-revisioned data)

| Column Name | Data Type | Constraints               | Description                                 |
| :---------- | :-------- | :------------------------ | :------------------------------------------ |
| id          | INT       | PK, FK                    | Master RFA ID (Shared with correspondences) |
| rfa_type_id | INT       | NOT NULL, FK              | Reference to rfa_types                      |
| created_at  | DATETIME  | DEFAULT CURRENT_TIMESTAMP | Record creation timestamp                   |
| created_by  | INT       | NULL, FK                  | User who created the record                 |
| deleted_at  | DATETIME  | NULL                      | Soft delete timestamp                       |

**Indexes**:

- PRIMARY KEY (id)
- FOREIGN KEY (id) REFERENCES correspondences(id) ON DELETE CASCADE
- FOREIGN KEY (rfa_type_id) REFERENCES rfa_types(id)
- FOREIGN KEY (created_by) REFERENCES users(user_id) ON DELETE SET NULL
- INDEX (rfa_type_id)
- INDEX (deleted_at)

**Relationships**:

- Parent: correspondences, rfa_types, users
- Children: rfa_revisions

---

### 4.5 rfa_revisions (UPDATE v1.7.0)

**Purpose**: Child table storing revision history of RFAs (1:N)

| Column Name         | Data Type | Constraints                       | Description                                                     |
| ------------------- | --------- | --------------------------------- | --------------------------------------------------------------- |
| id                  | INT       | PK, FK                            | Master Revision ID (Shared with correspondence_revisions)       |
| rfa_status_code_id  | INT       | NOT NULL, FK                      | Current RFA status                                              |
| rfa_approve_code_id | INT       | NULL, FK                          | Approval result code                                            |
| details             | JSON      | NULL                              | Type-specific details (e.g., RFI questions)                     |
| v_ref_drawing_count | INT       | GENERATED ALWAYS AS (...) VIRTUAL | Virtual Column ดึง Drawing Count จาก JSON details เพื่อทำ Index |
| schema_version      | INT       | DEFAULT 1                         | Version of the schema used with this details                    |

**Indexes**:

- PRIMARY KEY (id)
- FOREIGN KEY (id) REFERENCES correspondence_revisions(id) ON DELETE CASCADE
- FOREIGN KEY (rfa_status_code_id) REFERENCES rfa_status_codes(id)
- FOREIGN KEY (rfa_approve_code_id) REFERENCES rfa_approve_codes(id) ON DELETE SET NULL
- INDEX (rfa_status_code_id)
- INDEX (rfa_approve_code_id)
- INDEX (v_ref_drawing_count): ตัวอย่างการ Index ข้อมูลตัวเลขใน JSON

**Relationships**:

- Parent: correspondence_revisions, rfas, rfa_status_codes, rfa_approve_codes
- Children: rfa_items

---

### 4.6 rfa_items

**Purpose**: Child table linking RFA revisions to drawing revisions that require approval

| Column Name                 | Data Type               | Constraints     | Description                  |
| :-------------------------- | :---------------------- | :-------------- | :--------------------------- |
| id                          | INT                     | PRIMARY KEY, AI | Unique identifier            |
| rfa_revision_id             | INT                     | NOT NULL, FK    | RFA Revision ID              |
| item_type                   | ENUM('SHOP','AS_BUILT') | NOT NULL        | Drawing reference type       |
| shop_drawing_revision_id    | INT                     | NULL, FK        | Shop drawing revision ID     |
| asbuilt_drawing_revision_id | INT                     | NULL, FK        | As-Built drawing revision ID |

**Indexes**:

- PRIMARY KEY (id)
- FOREIGN KEY (rfa_revision_id) REFERENCES rfa_revisions(id) ON DELETE CASCADE
- FOREIGN KEY (shop_drawing_revision_id) REFERENCES shop_drawing_revisions(id) ON DELETE CASCADE
- FOREIGN KEY (asbuilt_drawing_revision_id) REFERENCES asbuilt_drawing_revisions(id) ON DELETE CASCADE
- UNIQUE KEY (rfa_revision_id, shop_drawing_revision_id)
- UNIQUE KEY (rfa_revision_id, asbuilt_drawing_revision_id)
- INDEX (item_type)
- INDEX (shop_drawing_revision_id)
- INDEX (asbuilt_drawing_revision_id)

**Relationships**:

- Parent: rfa_revisions, shop_drawing_revisions, asbuilt_drawing_revisions

**Business Rules**:

- `correspondences.correspondence_type_id` for an RFA must always point to `correspondence_types.type_code = 'RFA'`
- `rfas.rfa_type_id` stores the selected RFA subtype
- `DDW` and `SDW` RFA types must reference `shop_drawing_revisions`
- `ADW` RFA types must reference `asbuilt_drawing_revisions`
- Each `rfa_items` row must reference exactly one drawing revision target according to `item_type`
- One RFA can contain multiple drawing references
- One drawing revision can be referenced by multiple RFAs

---

---

## **5. 📐 Drawings Tables (แบบ, หมวดหมู่)**

### 5.1 contract_drawing_volumes

**Purpose**: Master table for contract drawing volume classification

| Column Name | Data Type    | Constraints                         | Description               |
| ----------- | ------------ | ----------------------------------- | ------------------------- |
| id          | INT          | PRIMARY KEY, AUTO_INCREMENT         | Unique volume ID          |
| project_id  | INT          | NOT NULL, FK                        | Reference to projects     |
| volume_code | VARCHAR(50)  | NOT NULL                            | Volume code               |
| volume_name | VARCHAR(255) | NOT NULL                            | Volume name               |
| description | TEXT         | NULL                                | Volume description        |
| sort_order  | INT          | DEFAULT 0                           | Display order             |
| created_at  | TIMESTAMP    | DEFAULT CURRENT_TIMESTAMP           | Record creation timestamp |
| updated_at  | TIMESTAMP    | DEFAULT CURRENT_TIMESTAMP ON UPDATE | Last update timestamp     |

**Indexes**:

- PRIMARY KEY (id)
- FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
- UNIQUE KEY (project_id, volume_code)
- INDEX (sort_order)

**Relationships**:

- Parent: projects
- Referenced by: contract_drawings

**Business Rules**:

- Volume codes must be unique within a project
- Used for organizing large sets of contract drawings

---

### 5.2 contract_drawing_cats

**Purpose**: Master table for contract drawing main categories

| Column Name | Data Type    | Constraints                         | Description               |
| ----------- | ------------ | ----------------------------------- | ------------------------- |
| id          | INT          | PRIMARY KEY, AUTO_INCREMENT         | Unique category ID        |
| project_id  | INT          | NOT NULL, FK                        | Reference to projects     |
| cat_code    | VARCHAR(50)  | NOT NULL                            | Category code             |
| cat_name    | VARCHAR(255) | NOT NULL                            | Category name             |
| description | TEXT         | NULL                                | Category description      |
| sort_order  | INT          | DEFAULT 0                           | Display order             |
| created_at  | TIMESTAMP    | DEFAULT CURRENT_TIMESTAMP           | Record creation timestamp |
| updated_at  | TIMESTAMP    | DEFAULT CURRENT_TIMESTAMP ON UPDATE | Last update timestamp     |

**Indexes**:

- PRIMARY KEY (id)
- FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
- UNIQUE KEY (project_id, cat_code)
- INDEX (sort_order)

**Relationships**:

- Parent: projects
- Referenced by: contract_drawing_subcat_cat_maps

**Business Rules**:

- Category codes must be unique within a project
- Hierarchical relationship with sub-categories via mapping table

---

### 5.3 contract_drawing_sub_cats

**Purpose**: Master table for contract drawing sub-categories

| Column Name  | Data Type    | Constraints                         | Description               |
| ------------ | ------------ | ----------------------------------- | ------------------------- |
| id           | INT          | PRIMARY KEY, AUTO_INCREMENT         | Unique sub-category ID    |
| project_id   | INT          | NOT NULL, FK                        | Reference to projects     |
| sub_cat_code | VARCHAR(50)  | NOT NULL                            | Sub-category code         |
| sub_cat_name | VARCHAR(255) | NOT NULL                            | Sub-category name         |
| description  | TEXT         | NULL                                | Sub-category description  |
| sort_order   | INT          | DEFAULT 0                           | Display order             |
| created_at   | TIMESTAMP    | DEFAULT CURRENT_TIMESTAMP           | Record creation timestamp |
| updated_at   | TIMESTAMP    | DEFAULT CURRENT_TIMESTAMP ON UPDATE | Last update timestamp     |

**Indexes**:

- PRIMARY KEY (id)
- FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
- UNIQUE KEY (project_id, sub_cat_code)
- INDEX (sort_order)

**Relationships**:

- Parent: projects
- Referenced by: contract_drawings, contract_drawing_subcat_cat_maps

**Business Rules**:

- Sub-category codes must be unique within a project
- Can be mapped to multiple main categories via mapping table

---

### 5.4 contract_drawing_subcat_cat_maps (UPDATE v1.7.0)

**Purpose**: Junction table mapping sub-categories to main categories (M:N)

| Column Name | Data Type | Constraints                     | Description                |
| ----------- | --------- | ------------------------------- | -------------------------- |
| **id**      | **INT**   | **PRIMARY KEY, AUTO_INCREMENT** | **Unique mapping ID**      |
| project_id  | INT       | NOT NULL, FK                    | Reference to projects      |
| sub_cat_id  | INT       | NOT NULL, FK                    | Reference to sub-category  |
| cat_id      | INT       | NOT NULL, FK                    | Reference to main category |

**Indexes**:

- PRIMARY KEY (id)
- **UNIQUE KEY (project_id, sub_cat_id, cat_id)**
- FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
- FOREIGN KEY (sub_cat_id) REFERENCES contract_drawing_sub_cats(id) ON DELETE CASCADE
- FOREIGN KEY (cat_id) REFERENCES contract_drawing_cats(id) ON DELETE CASCADE
- INDEX (sub_cat_id)
- INDEX (cat_id)

**Relationships**:

- Parent: projects, contract_drawing_sub_cats, contract_drawing_cats
- Referenced by: contract_drawings

**Business Rules**:

- Allows flexible categorization
- One sub-category can belong to multiple main categories
- Composite uniqueness enforced via UNIQUE constraint

---

### 5.5 contract_drawings (UPDATE v1.7.0)

**Purpose**: Master table for contract drawings (from contract specifications)

| Column Name     | Data Type    | Constraints                         | Description                              |
| --------------- | ------------ | ----------------------------------- | ---------------------------------------- |
| id              | INT          | PRIMARY KEY, AUTO_INCREMENT         | Unique drawing ID                        |
| uuid            | UUID         | NOT NULL, UNIQUE, DEFAULT           | UUID Public Identifier (ADR-019)         |
| project_id      | INT          | NOT NULL, FK                        | Reference to projects                    |
| condwg_no       | VARCHAR(255) | NOT NULL                            | Contract drawing number                  |
| title           | VARCHAR(255) | NOT NULL                            | Drawing title                            |
| **map_cat_id**  | **INT**      | **NULL, FK**                        | **[CHANGED] Reference to mapping table** |
| volume_id       | INT          | NULL, FK                            | Reference to volume                      |
| **volume_page** | **INT**      | **NULL**                            | **[NEW] Page number within volume**      |
| created_at      | TIMESTAMP    | DEFAULT CURRENT_TIMESTAMP           | Record creation timestamp                |
| updated_at      | TIMESTAMP    | DEFAULT CURRENT_TIMESTAMP ON UPDATE | Last update timestamp                    |
| deleted_at      | DATETIME     | NULL                                | Soft delete timestamp                    |
| updated_by      | INT          | NULL, FK                            | User who last updated                    |

**Indexes**:

- PRIMARY KEY (id)
- FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
- **FOREIGN KEY (map_cat_id) REFERENCES contract_drawing_subcat_cat_maps(id) ON DELETE RESTRICT**
- FOREIGN KEY (volume_id) REFERENCES contract_drawing_volumes(id) ON DELETE RESTRICT
- FOREIGN KEY (updated_by) REFERENCES users(user_id)
- UNIQUE KEY (project_id, condwg_no)
- UNIQUE INDEX idx_contract_drawings_uuid (uuid)
- INDEX (map_cat_id)
- INDEX (volume_id)
- INDEX (deleted_at)

**Relationships**:

- Parent: projects, contract_drawing_subcat_cat_maps, contract_drawing_volumes, users
- Referenced by: shop_drawing_revision_contract_refs, contract_drawing_attachments

**Business Rules**:

- Drawing numbers must be unique within a project
- Represents baseline/contract drawings
- Referenced by shop drawings for compliance tracking
- Soft delete preserves history
- **map_cat_id references the mapping table for flexible categorization**

---

### 5.6 shop_drawing_main_categories (UPDATE v1.7.0)

**Purpose**: Master table for shop drawing main categories (discipline-level)

| Column Name        | Data Type    | Constraints                         | Description                          |
| ------------------ | ------------ | ----------------------------------- | ------------------------------------ |
| id                 | INT          | PRIMARY KEY, AUTO_INCREMENT         | Unique category ID                   |
| **project_id**     | **INT**      | **NOT NULL, FK**                    | **[NEW] Reference to projects**      |
| main_category_code | VARCHAR(50)  | NOT NULL, UNIQUE                    | Category code (ARCH, STR, MEP, etc.) |
| main_category_name | VARCHAR(255) | NOT NULL                            | Category name                        |
| description        | TEXT         | NULL                                | Category description                 |
| sort_order         | INT          | DEFAULT 0                           | Display order                        |
| is_active          | TINYINT(1)   | DEFAULT 1                           | Active status                        |
| created_at         | TIMESTAMP    | DEFAULT CURRENT_TIMESTAMP           | Record creation timestamp            |
| updated_at         | TIMESTAMP    | DEFAULT CURRENT_TIMESTAMP ON UPDATE | Last update timestamp                |

**Indexes**:

- PRIMARY KEY (id)
- **FOREIGN KEY (project_id) REFERENCES projects(id)**
- UNIQUE (main_category_code)
- INDEX (is_active)
- INDEX (sort_order)

**Relationships**:

- **Parent: projects**
- Referenced by: shop_drawings, asbuilt_drawings

**Business Rules**:

- **[CHANGED] Project-specific categories (was global)**
- Typically represents engineering disciplines

---

### 5.7 shop_drawing_sub_categories (UPDATE v1.7.0)

**Purpose**: Master table for shop drawing sub-categories (component-level)

| Column Name       | Data Type    | Constraints                         | Description                                     |
| ----------------- | ------------ | ----------------------------------- | ----------------------------------------------- |
| id                | INT          | PRIMARY KEY, AUTO_INCREMENT         | Unique sub-category ID                          |
| **project_id**    | **INT**      | **NOT NULL, FK**                    | **[NEW] Reference to projects**                 |
| sub_category_code | VARCHAR(50)  | NOT NULL, UNIQUE                    | Sub-category code (STR-COLUMN, ARCH-DOOR, etc.) |
| sub_category_name | VARCHAR(255) | NOT NULL                            | Sub-category name                               |
| description       | TEXT         | NULL                                | Sub-category description                        |
| sort_order        | INT          | DEFAULT 0                           | Display order                                   |
| is_active         | TINYINT(1)   | DEFAULT 1                           | Active status                                   |
| created_at        | TIMESTAMP    | DEFAULT CURRENT_TIMESTAMP           | Record creation timestamp                       |
| updated_at        | TIMESTAMP    | DEFAULT CURRENT_TIMESTAMP ON UPDATE | Last update timestamp                           |

**Indexes**:

- PRIMARY KEY (id)
- **FOREIGN KEY (project_id) REFERENCES projects(id)**
- UNIQUE (sub_category_code)
- INDEX (is_active)
- INDEX (sort_order)

**Relationships**:

- **Parent: projects**
- Referenced by: shop_drawings, asbuilt_drawings

**Business Rules**:

- **[CHANGED] Project-specific sub-categories (was global)**
- **[REMOVED] No longer hierarchical under main categories**
- Represents specific drawing types or components

---

### 5.8 shop_drawings (UPDATE v1.7.0)

**Purpose**: Master table for shop drawings (contractor-submitted)

| Column Name      | Data Type    | Constraints                         | Description                      |
| ---------------- | ------------ | ----------------------------------- | -------------------------------- |
| id               | INT          | PRIMARY KEY, AUTO_INCREMENT         | Unique drawing ID                |
| uuid             | UUID         | NOT NULL, UNIQUE, DEFAULT           | UUID Public Identifier (ADR-019) |
| project_id       | INT          | NOT NULL, FK                        | Reference to projects            |
| drawing_number   | VARCHAR(100) | NOT NULL, UNIQUE                    | Shop drawing number              |
| main_category_id | INT          | NOT NULL, FK                        | Reference to main category       |
| sub_category_id  | INT          | NOT NULL, FK                        | Reference to sub-category        |
| created_at       | TIMESTAMP    | DEFAULT CURRENT_TIMESTAMP           | Record creation timestamp        |
| updated_at       | TIMESTAMP    | DEFAULT CURRENT_TIMESTAMP ON UPDATE | Last update timestamp            |
| deleted_at       | DATETIME     | NULL                                | Soft delete timestamp            |
| updated_by       | INT          | NULL, FK                            | User who last updated            |

**Indexes**:

- PRIMARY KEY (id)
- UNIQUE (drawing_number)
- UNIQUE INDEX idx_shop_drawings_uuid (uuid)
- FOREIGN KEY (project_id) REFERENCES projects(id)
- FOREIGN KEY (main_category_id) REFERENCES shop_drawing_main_categories(id)
- FOREIGN KEY (sub_category_id) REFERENCES shop_drawing_sub_categories(id)
- FOREIGN KEY (updated_by) REFERENCES users(user_id)
- INDEX (project_id)
- INDEX (main_category_id)
- INDEX (sub_category_id)
- INDEX (deleted_at)

**Relationships**:

- Parent: projects, shop_drawing_main_categories, shop_drawing_sub_categories, users
- Children: shop_drawing_revisions

**Business Rules**:

- Drawing numbers are globally unique across all projects
- Represents contractor shop drawings
- Can have multiple revisions
- Soft delete preserves history
- **[CHANGED] Title moved to shop_drawing_revisions table**

---

### 5.9 shop_drawing_revisions (UPDATE v1.7.0)

**Purpose**: Child table storing revision history of shop drawings (1:N)

| Column Name               | Data Type        | Constraints                 | Description                              |
| ------------------------- | ---------------- | --------------------------- | ---------------------------------------- |
| id                        | INT              | PRIMARY KEY, AUTO_INCREMENT | Unique revision ID                       |
| uuid                      | UUID             | NOT NULL, UNIQUE, DEFAULT   | UUID Public Identifier (ADR-019)         |
| shop_drawing_id           | INT              | NOT NULL, FK                | Master shop drawing ID                   |
| revision_number           | INT              | NOT NULL                    | Revision sequence (0, 1, 2...)           |
| revision_label            | VARCHAR(10)      | NULL                        | Display revision (A, B, C...)            |
| revision_date             | DATE             | NULL                        | Revision date                            |
| **title**                 | **VARCHAR(500)** | **NOT NULL**                | **[NEW] Drawing title**                  |
| description               | TEXT             | NULL                        | Revision description/changes             |
| **legacy_drawing_number** | **VARCHAR(100)** | **NULL**                    | **[NEW] Original/legacy drawing number** |
| created_at                | TIMESTAMP        | DEFAULT CURRENT_TIMESTAMP   | Revision creation timestamp              |

**Indexes**:

- PRIMARY KEY (id)
- FOREIGN KEY (shop_drawing_id) REFERENCES shop_drawings(id) ON DELETE CASCADE
- UNIQUE KEY (shop_drawing_id, revision_number)
- UNIQUE INDEX idx_shop_drawing_revisions_uuid (uuid)
- INDEX (revision_date)

**Relationships**:

- Parent: shop_drawings
- Referenced by: rfa_items, shop_drawing_revision_contract_refs, shop_drawing_revision_attachments, asbuilt_revision_shop_revisions_refs

**Business Rules**:

- Revision numbers are sequential starting from 0
- Each revision can reference multiple contract drawings
- Each revision can have multiple file attachments
- Linked to RFAs for approval tracking
- **[NEW] Title stored at revision level for version-specific naming**
- **[NEW] legacy_drawing_number supports data migration from old systems**

---

### 5.10 shop_drawing_revision_contract_refs

**Purpose**: Junction table linking shop drawing revisions to referenced contract drawings (M:N)

| Column Name              | Data Type | Constraints     | Description                        |
| ------------------------ | --------- | --------------- | ---------------------------------- |
| shop_drawing_revision_id | INT       | PRIMARY KEY, FK | Reference to shop drawing revision |
| contract_drawing_id      | INT       | PRIMARY KEY, FK | Reference to contract drawing      |

**Indexes**:

- PRIMARY KEY (shop_drawing_revision_id, contract_drawing_id)
- FOREIGN KEY (shop_drawing_revision_id) REFERENCES shop_drawing_revisions(id) ON DELETE CASCADE
- FOREIGN KEY (contract_drawing_id) REFERENCES contract_drawings(id) ON DELETE CASCADE
- INDEX (contract_drawing_id)

**Relationships**:

- Parent: shop_drawing_revisions, contract_drawings

**Business Rules**:

- Tracks which contract drawings each shop drawing revision is based on
- Ensures compliance with contract specifications
- One shop drawing revision can reference multiple contract drawings

---

### 5.11 asbuilt_drawings (NEW v1.7.0)

**Purpose**: Master table for AS Built drawings (final construction records)

| Column Name      | Data Type    | Constraints                         | Description                      |
| ---------------- | ------------ | ----------------------------------- | -------------------------------- |
| id               | INT          | PRIMARY KEY, AUTO_INCREMENT         | Unique drawing ID                |
| uuid             | UUID         | NOT NULL, UNIQUE, DEFAULT           | UUID Public Identifier (ADR-019) |
| project_id       | INT          | NOT NULL, FK                        | Reference to projects            |
| drawing_number   | VARCHAR(100) | NOT NULL, UNIQUE                    | AS Built drawing number          |
| main_category_id | INT          | NOT NULL, FK                        | Reference to main category       |
| sub_category_id  | INT          | NOT NULL, FK                        | Reference to sub-category        |
| created_at       | TIMESTAMP    | DEFAULT CURRENT_TIMESTAMP           | Record creation timestamp        |
| updated_at       | TIMESTAMP    | DEFAULT CURRENT_TIMESTAMP ON UPDATE | Last update timestamp            |
| deleted_at       | DATETIME     | NULL                                | Soft delete timestamp            |
| updated_by       | INT          | NULL, FK                            | User who last updated            |

**Indexes**:

- PRIMARY KEY (id)
- UNIQUE (drawing_number)
- UNIQUE INDEX idx_asbuilt_drawings_uuid (uuid)
- FOREIGN KEY (project_id) REFERENCES projects(id)
- FOREIGN KEY (main_category_id) REFERENCES shop_drawing_main_categories(id)
- FOREIGN KEY (sub_category_id) REFERENCES shop_drawing_sub_categories(id)
- FOREIGN KEY (updated_by) REFERENCES users(user_id)
- INDEX (project_id)
- INDEX (main_category_id)
- INDEX (sub_category_id)
- INDEX (deleted_at)

**Relationships**:

- Parent: projects, shop_drawing_main_categories, shop_drawing_sub_categories, users
- Children: asbuilt_drawing_revisions

**Business Rules**:

- Drawing numbers are globally unique across all projects
- Represents final as-built construction drawings
- Can have multiple revisions
- Soft delete preserves history
- Uses same category structure as shop drawings

---

### 5.12 asbuilt_drawing_revisions (NEW v1.7.0)

**Purpose**: Child table storing revision history of AS Built drawings (1:N)

| Column Name           | Data Type    | Constraints                 | Description                      |
| --------------------- | ------------ | --------------------------- | -------------------------------- |
| id                    | INT          | PRIMARY KEY, AUTO_INCREMENT | Unique revision ID               |
| uuid                  | UUID         | NOT NULL, UNIQUE, DEFAULT   | UUID Public Identifier (ADR-019) |
| asbuilt_drawing_id    | INT          | NOT NULL, FK                | Master AS Built drawing ID       |
| revision_number       | INT          | NOT NULL                    | Revision sequence (0, 1, 2...)   |
| revision_label        | VARCHAR(10)  | NULL                        | Display revision (A, B, C...)    |
| revision_date         | DATE         | NULL                        | Revision date                    |
| title                 | VARCHAR(500) | NOT NULL                    | Drawing title                    |
| description           | TEXT         | NULL                        | Revision description/changes     |
| legacy_drawing_number | VARCHAR(100) | NULL                        | Original/legacy drawing number   |
| created_at            | TIMESTAMP    | DEFAULT CURRENT_TIMESTAMP   | Revision creation timestamp      |

**Indexes**:

- PRIMARY KEY (id)
- FOREIGN KEY (asbuilt_drawing_id) REFERENCES asbuilt_drawings(id) ON DELETE CASCADE
- UNIQUE KEY (asbuilt_drawing_id, revision_number)
- UNIQUE INDEX idx_asbuilt_drawing_revisions_uuid (uuid)
- INDEX (revision_date)

**Relationships**:

- Parent: asbuilt_drawings
- Referenced by: asbuilt_revision_shop_revisions_refs, asbuilt_drawing_revision_attachments

**Business Rules**:

- Revision numbers are sequential starting from 0
- Each revision can reference multiple shop drawing revisions
- Each revision can have multiple file attachments
- Title stored at revision level for version-specific naming
- legacy_drawing_number supports data migration from old systems

---

### 5.13 asbuilt_revision_shop_revisions_refs (NEW v1.7.0)

**Purpose**: Junction table linking AS Built drawing revisions to shop drawing revisions (M:N)

| Column Name                 | Data Type | Constraints     | Description                        |
| --------------------------- | --------- | --------------- | ---------------------------------- |
| asbuilt_drawing_revision_id | INT       | PRIMARY KEY, FK | Reference to AS Built revision     |
| shop_drawing_revision_id    | INT       | PRIMARY KEY, FK | Reference to shop drawing revision |

**Indexes**:

- PRIMARY KEY (asbuilt_drawing_revision_id, shop_drawing_revision_id)
- FOREIGN KEY (asbuilt_drawing_revision_id) REFERENCES asbuilt_drawing_revisions(id) ON DELETE CASCADE
- FOREIGN KEY (shop_drawing_revision_id) REFERENCES shop_drawing_revisions(id) ON DELETE CASCADE
- INDEX (shop_drawing_revision_id)

**Relationships**:

- Parent: asbuilt_drawing_revisions, shop_drawing_revisions

**Business Rules**:

- Tracks which shop drawings each AS Built drawing revision is based on
- Maintains construction document lineage
- One AS Built revision can reference multiple shop drawing revisions
- Supports traceability from final construction to approved shop drawings

---

### 5.14 asbuilt_drawing_revision_attachments (NEW v1.7.0)

**Purpose**: Junction table linking AS Built drawing revisions to file attachments (M:N)

| Column Name                 | Data Type                             | Constraints     | Description                           |
| --------------------------- | ------------------------------------- | --------------- | ------------------------------------- |
| asbuilt_drawing_revision_id | INT                                   | PRIMARY KEY, FK | Reference to AS Built revision        |
| attachment_id               | INT                                   | PRIMARY KEY, FK | Reference to attachment file          |
| file_type                   | ENUM('PDF', 'DWG', 'SOURCE', 'OTHER') | NULL            | File type classification              |
| is_main_document            | BOOLEAN                               | DEFAULT FALSE   | Main document flag (1 = primary file) |

**Indexes**:

- PRIMARY KEY (asbuilt_drawing_revision_id, attachment_id)
- FOREIGN KEY (asbuilt_drawing_revision_id) REFERENCES asbuilt_drawing_revisions(id) ON DELETE CASCADE
- FOREIGN KEY (attachment_id) REFERENCES attachments(id) ON DELETE CASCADE
- INDEX (attachment_id)

**Relationships**:

- Parent: asbuilt_drawing_revisions, attachments

**Business Rules**:

- Each AS Built revision can have multiple file attachments
- File types: PDF (documents), DWG (CAD files), SOURCE (source files), OTHER (miscellaneous)
- One attachment can be marked as main document per revision
- Cascade delete when revision is deleted

---

## **6. 🔄 Circulations Tables (ใบเวียนภายใน)**

### 6.1 circulation_status_codes

**Purpose**: Master table for circulation workflow status codes

| Column Name | Data Type   | Constraints                 | Description                                         |
| ----------- | ----------- | --------------------------- | --------------------------------------------------- |
| id          | INT         | PRIMARY KEY, AUTO_INCREMENT | Unique status ID                                    |
| code        | VARCHAR(20) | NOT NULL, UNIQUE            | Status code (OPEN, IN_REVIEW, COMPLETED, CANCELLED) |
| description | VARCHAR(50) | NOT NULL                    | Status description                                  |
| sort_order  | INT         | DEFAULT 0                   | Display order                                       |
| is_active   | TINYINT(1)  | DEFAULT 1                   | Active status                                       |

**Indexes**:

- PRIMARY KEY (id)
- UNIQUE (code)
- INDEX (is_active)
- INDEX (sort_order)

**Relationships**:

- Referenced by: circulations

**Seed Data**: 4 status codes

- OPEN: Initial status when created
- IN_REVIEW: Under review by recipients
- COMPLETED: All recipients have responded
- CANCELLED: Withdrawn/cancelled

---

### 6.2 circulations

**Purpose**: Master table for internal circulation sheets (document routing)

| Column Name             | Data Type    | Constraints                         | Description                               |
| ----------------------- | ------------ | ----------------------------------- | ----------------------------------------- |
| id                      | INT          | PRIMARY KEY, AUTO_INCREMENT         | Unique circulation ID                     |
| uuid                    | UUID         | NOT NULL, UNIQUE, DEFAULT           | UUID Public Identifier (ADR-019)          |
| correspondence_id       | INT          | UNIQUE, FK                          | Link to correspondence (1:1 relationship) |
| organization_id         | INT          | NOT NULL, FK                        | Organization that owns this circulation   |
| circulation_no          | VARCHAR(100) | NOT NULL                            | Circulation sheet number                  |
| circulation_subject     | VARCHAR(500) | NOT NULL                            | Subject/title                             |
| circulation_status_code | VARCHAR(20)  | NOT NULL, FK                        | Current status code                       |
| created_by_user_id      | INT          | NOT NULL, FK                        | User who created circulation              |
| submitted_at            | TIMESTAMP    | NULL                                | Submission timestamp                      |
| closed_at               | TIMESTAMP    | NULL                                | Closure timestamp                         |
| created_at              | TIMESTAMP    | DEFAULT CURRENT_TIMESTAMP           | Record creation timestamp                 |
| updated_at              | TIMESTAMP    | DEFAULT CURRENT_TIMESTAMP ON UPDATE | Last update timestamp                     |

**Indexes**:

- PRIMARY KEY (id)
- UNIQUE (correspondence_id)
- FOREIGN KEY (correspondence_id) REFERENCES correspondences(id)
- FOREIGN KEY (organization_id) REFERENCES organizations(id)
- FOREIGN KEY (circulation_status_code) REFERENCES circulation_status_codes(code)
- FOREIGN KEY (created_by_user_id) REFERENCES users(user_id)
- INDEX (organization_id)
- UNIQUE INDEX idx_circulations_uuid (uuid)
- INDEX (circulation_status_code)
- INDEX (created_by_user_id)

**Relationships**:

- Parent: correspondences, organizations, circulation_status_codes, users
- Children: circulation_routings, circulation_attachments

**Business Rules**:

- Internal document routing within organization
- One-to-one relationship with correspondences
- Tracks document review/approval workflow
- Status progression: OPEN → IN_REVIEW → COMPLETED/CANCELLED

---

## **7. 📤 Transmittals Tables (เอกสารนำส่ง)**

### 7.1 transmittals

**Purpose**: Child table for transmittal-specific data (1:1 with correspondences)

| Column Name       | Data Type | Constraints     | Description                                               |
| ----------------- | --------- | --------------- | --------------------------------------------------------- |
| correspondence_id | INT       | PRIMARY KEY, FK | Reference to correspondences (1:1)                        |
| purpose           | ENUM      | NULL            | Purpose: FOR_APPROVAL, FOR_INFORMATION, FOR_REVIEW, OTHER |
| remarks           | TEXT      | NULL            | Additional remarks                                        |

**Indexes**:

- PRIMARY KEY (correspondence_id)
- FOREIGN KEY (correspondence_id) REFERENCES correspondences(id) ON DELETE CASCADE
- INDEX (purpose)

**Relationships**:

- Parent: correspondences
- Children: transmittal_items

**Business Rules**:

- One-to-one relationship with correspondences
- Transmittal is a correspondence type for forwarding documents
- Contains metadata about the transmission

---

### 7.2 transmittal_items

**Purpose**: Junction table listing documents included in transmittal (M:N)

| Column Name            | Data Type    | Constraints                 | Description                             |
| ---------------------- | ------------ | --------------------------- | --------------------------------------- |
| id                     | INT          | PRIMARY KEY, AUTO_INCREMENT | Unique item ID                          |
| transmittal_id         | INT          | NOT NULL, FK                | Reference to transmittal                |
| item_correspondence_id | INT          | NOT NULL, FK                | Reference to document being transmitted |
| quantity               | INT          | DEFAULT 1                   | Number of copies                        |
| remarks                | VARCHAR(255) | NULL                        | Item-specific remarks                   |

**Indexes**:

- PRIMARY KEY (id)
- FOREIGN KEY (transmittal_id) REFERENCES transmittals(correspondence_id) ON DELETE CASCADE
- FOREIGN KEY (item_correspondence_id) REFERENCES correspondences(id) ON DELETE CASCADE
- UNIQUE KEY (transmittal_id, item_correspondence_id)
- INDEX (item_correspondence_id)

**Relationships**:

- Parent: transmittals, correspondences

**Business Rules**:

- One transmittal can contain multiple documents
- Tracks quantity of physical copies (if applicable)
- Links to any type of correspondence document

---

## **8. 📎 File Management Tables (ไฟล์แนบ)**

### 8.1 attachments

**Purpose**: Central repository for all file attachments in the system

| Column Name         | Data Type    | Constraints                 | Description                                                                |
| ------------------- | ------------ | --------------------------- | -------------------------------------------------------------------------- |
| id                  | INT          | PRIMARY KEY, AUTO_INCREMENT | Unique attachment ID                                                       |
| uuid                | UUID         | NOT NULL, UNIQUE, DEFAULT   | UUID Public Identifier (ADR-019)                                           |
| original_filename   | VARCHAR(255) | NOT NULL                    | Original filename from upload                                              |
| stored_filename     | VARCHAR(255) | NOT NULL                    | System-generated unique filename                                           |
| file_path           | VARCHAR(500) | NOT NULL                    | Full file path on server (/share/dms-data/)                                |
| mime_type           | VARCHAR(100) | NOT NULL                    | MIME type (application/pdf, image/jpeg, etc.)                              |
| file_size           | INT          | NOT NULL                    | File size in bytes                                                         |
| uploaded_by_user_id | INT          | NOT NULL, FK                | User who uploaded file                                                     |
| created_at          | TIMESTAMP    | DEFAULT CURRENT_TIMESTAMP   | Upload timestamp                                                           |
| is_temporary        | BOOLEAN      | DEFAULT TRUE                | ระบุว่าเป็นไฟล์ชั่วคราว (ยังไม่ได้ Commit)                                 |
| temp_id\*           | VARCHAR(100) | NULL                        | ID ชั่วคราวสำหรับอ้างอิงตอน Upload Phase 1 (อาจใช้ร่วมกับ id หรือแยกก็ได้) |
| expires_at          | DATETIME     | NULL                        | เวลาหมดอายุของไฟล์ Temp (เพื่อให้ Cron Job ลบออก)                          |
| checksum            | VARCHAR(64)  | NULL                        | SHA-256 Checksum สำหรับ Verify File Integrity [Req 3.9.3]                  |
| reference_date      | DATE         | NULL                        | Date used for folder structure (e.g. Issue Date) to prevent broken paths   |
| workflow_history_id | VARCHAR(36)  | NULL, FK                    | **[ADR-021]** อ้างอิง workflow_histories.publicId — NULL = ไฟล์แนบหลักของเอกสาร; NOT NULL = ไฟล์หลักฐานประจำ Workflow Step |

**Indexes**:

- PRIMARY KEY (id)
- FOREIGN KEY (uploaded_by_user_id) REFERENCES users(user_id) ON DELETE CASCADE
- INDEX (stored_filename)
- INDEX (mime_type)
- INDEX (uploaded_by_user_id)
- UNIQUE INDEX idx_attachments_uuid (uuid)
- INDEX (created_at)
- INDEX (reference_date)
- INDEX (workflow_history_id)

**Relationships**:

- Parent: users, workflow_histories (via workflow_history_id)
- Referenced by: correspondence_revision_attachments, circulation_attachments, shop_drawing_revision_attachments, contract_drawing_attachments

**Business Rules**:

- Central storage prevents file duplication
- Stored filename prevents naming conflicts
- File path points to QNAP NAS storage
- Original filename preserved for download
- One file record can be linked to multiple documents
- **[ADR-021]** `workflow_history_id = NULL` → Main Document attachment (linked via junction tables)
- **[ADR-021]** `workflow_history_id IS NOT NULL` → Step-evidence attachment — linked exclusively to a single workflow transition history record (Approve/Reject/Return evidence)
- Step-evidence attachments are committed (is_temporary = false) during `processTransition()` in the same transaction as the history record
- Cleanup jobs MUST NOT delete attachments where `workflow_history_id IS NOT NULL`

---

### 8.2 correspondence_revision_attachments (UPDATE v1.8.1)

**Purpose**: Junction table linking **correspondence_revisions** to file attachments (M:N)

> **[FIX v1.8.1]** เปลี่ยนจาก `correspondence_attachments` (FK → `correspondences.id`) → `correspondence_revision_attachments` (FK → `correspondence_revisions.id`)
> เหตุผล: ไฟล์แนบผูกกับ revision ไม่ใช่ correspondence master เพราะแต่ละ revision อาจมีไฟล์แนบต่างกัน

| Column Name                  | Data Type | Constraints     | Description                             |
| ---------------------------- | --------- | --------------- | --------------------------------------- |
| correspondence_revision_id   | INT       | PRIMARY KEY, FK | Reference to correspondence_revisions   |
| attachment_id                | INT       | PRIMARY KEY, FK | Reference to attachments                |
| is_main_document             | BOOLEAN   | DEFAULT FALSE   | Main/primary document flag of revision  |

**Indexes**:

- PRIMARY KEY (correspondence_revision_id, attachment_id)
- FOREIGN KEY (correspondence_revision_id) REFERENCES correspondence_revisions(id) ON DELETE CASCADE
- FOREIGN KEY (attachment_id) REFERENCES attachments(id) ON DELETE CASCADE
- INDEX idx_corr_rev_att_revision (correspondence_revision_id)

**Relationships**:

- Parent: correspondence_revisions, attachments
- correspondence_revisions has `attachmentLinks` OneToMany relation

**Business Rules**:

- One revision can have multiple attachments
- One attachment can be linked to multiple revisions
- is_main_document identifies primary file of that revision (typically PDF)
- เมื่อ create/update correspondence → commit attachments → บันทึก revision_id ลงตารางนี้

---

### 8.3 circulation_attachments

**Purpose**: Junction table linking circulations to file attachments (M:N)

| Column Name      | Data Type | Constraints     | Description                |
| ---------------- | --------- | --------------- | -------------------------- |
| circulation_id   | INT       | PRIMARY KEY, FK | Reference to circulations  |
| attachment_id    | INT       | PRIMARY KEY, FK | Reference to attachments   |
| is_main_document | BOOLEAN   | DEFAULT FALSE   | Main/primary document flag |

**Indexes**:

- PRIMARY KEY (circulation_id, attachment_id)
- FOREIGN KEY (circulation_id) REFERENCES circulations(id) ON DELETE CASCADE
- FOREIGN KEY (attachment_id) REFERENCES attachments(id) ON DELETE CASCADE
- INDEX (attachment_id)
- INDEX (is_main_document)

**Relationships**:

- Parent: circulations, attachments

---

### 8.4 shop_drawing_revision_attachments

**Purpose**: Junction table linking shop drawing revisions to file attachments (M:N)

| Column Name              | Data Type | Constraints     | Description                        |
| ------------------------ | --------- | --------------- | ---------------------------------- |
| shop_drawing_revision_id | INT       | PRIMARY KEY, FK | Reference to shop drawing revision |
| attachment_id            | INT       | PRIMARY KEY, FK | Reference to attachments           |
| file_type                | ENUM      | NULL            | File type: PDF, DWG, SOURCE, OTHER |
| is_main_document         | BOOLEAN   | DEFAULT FALSE   | Main/primary document flag         |

**Indexes**:

- PRIMARY KEY (shop_drawing_revision_id, attachment_id)
- FOREIGN KEY (shop_drawing_revision_id) REFERENCES shop_drawing_revisions(id) ON DELETE CASCADE
- FOREIGN KEY (attachment_id) REFERENCES attachments(id) ON DELETE CASCADE
- INDEX (attachment_id)
- INDEX (file_type)
- INDEX (is_main_document)

**Relationships**:

- Parent: shop_drawing_revisions, attachments

**Business Rules**:

- file_type categorizes drawing file formats
- Typically includes PDF for viewing and DWG for editing
- SOURCE may include native CAD files

---

### 8.5 contract_drawing_attachments

**Purpose**: Junction table linking contract drawings to file attachments (M:N)

| Column Name         | Data Type | Constraints     | Description                        |
| ------------------- | --------- | --------------- | ---------------------------------- |
| contract_drawing_id | INT       | PRIMARY KEY, FK | Reference to contract drawing      |
| attachment_id       | INT       | PRIMARY KEY, FK | Reference to attachments           |
| file_type           | ENUM      | NULL            | File type: PDF, DWG, SOURCE, OTHER |
| is_main_document    | BOOLEAN   | DEFAULT FALSE   | Main/primary document flag         |

**Indexes**:

- PRIMARY KEY (contract_drawing_id, attachment_id)
- FOREIGN KEY (contract_drawing_id) REFERENCES contract_drawings(id) ON DELETE CASCADE
- FOREIGN KEY (attachment_id) REFERENCES attachments(id) ON DELETE CASCADE
- INDEX (attachment_id)
- INDEX (file_type)
- INDEX (is_main_document)

**Relationships**:

- Parent: contract_drawings, attachments

---

## **9. 🔢 Document Numbering System Tables (ระบบเลขที่เอกสาร)**

### 9.1 document_number_formats

**Purpose**: Master table defining numbering formats for each document type

| Column Name            | Data Type    | Constraints                 | Description                                  |
| ---------------------- | ------------ | --------------------------- | -------------------------------------------- |
| id                     | INT          | PRIMARY KEY, AUTO_INCREMENT | Unique format ID                             |
| project_id             | INT          | NOT NULL, FK                | Reference to projects                        |
| correspondence_type_id | INT          | NULL, FK                    | Reference to correspondence_types            |
| discipline_id          | INT          | DEFAULT 0, FK               | Reference to disciplines (0 = all)           |
| format_string          | VARCHAR(100) | NOT NULL                    | Format pattern (e.g., {ORG}-{TYPE}-{YYYY}-#) |
| description            | TEXT         | NULL                        | Format description                           |
| reset_annually         | BOOLEAN      | DEFAULT TRUE                | Start sequence new every year                |
| is_active              | TINYINT(1)   | DEFAULT 1                   | Active status                                |

**Indexes**:

- PRIMARY KEY (id)
- FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
- FOREIGN KEY (correspondence_type_id) REFERENCES correspondence_types(id) ON DELETE CASCADE
- UNIQUE KEY (project_id, correspondence_type_id, discipline_id)
- INDEX (is_active)

**Relationships**:

- Parent: projects, correspondence_types

**Business Rules**:

- Defines how document numbers are constructed
- Supports placeholders: {PROJ}, {ORG}, {TYPE}, {YYYY}, {MM}, {#}

---

### 9.2 document_number_counters (UPDATE v1.7.0)

**Purpose**: Transaction table tracking running numbers (High Concurrency)

| Column Name                | Data Type   | Constraints   | Description                                     |
| -------------------------- | ----------- | ------------- | ----------------------------------------------- |
| project_id                 | INT         | PK, NOT NULL  | โครงการ                                         |
| originator_organization_id | INT         | PK, NOT NULL  | องค์กรผู้ส่ง                                    |
| recipient_organization_id  | INT         | PK, NOT NULL  | องค์กรผู้รับ (0 = no recipient / RFA)           |
| correspondence_type_id     | INT         | PK, NULL      | ประเภทเอกสาร (NULL = default)                   |
| sub_type_id                | INT         | PK, DEFAULT 0 | ประเภทย่อย สำหรับ TRANSMITTAL (0 = ไม่ระบุ)     |
| rfa_type_id                | INT         | PK, DEFAULT 0 | ประเภท RFA (0 = ไม่ใช่ RFA)                     |
| discipline_id              | INT         | PK, DEFAULT 0 | สาขางาน (0 = ไม่ระบุ)                           |
| reset_scope                | VARCHAR(20) | PK, NOT NULL  | Scope of reset (YEAR_2024, MONTH_2024_01, NONE) |
| last_number                | INT         | DEFAULT 0     | เลขล่าสุดที่ถูกใช้งานไปแล้ว                     |
| version                    | INT         | DEFAULT 0     | Optimistic Lock Version                         |
| updated_at                 | DATETIME(6) | ON UPDATE     | เวลาที่อัปเดตล่าสุด                             |

**Indexes**:

- **PRIMARY KEY (project_id, originator_organization_id, recipient_organization_id, correspondence_type_id, sub_type_id, rfa_type_id, discipline_id, reset_scope)**
- INDEX idx_counter_lookup (project_id, correspondence_type_id, reset_scope)
- INDEX idx_counter_org (originator_organization_id, reset_scope)

**Business Rules**:

- **Composite Primary Key 8 Columns**: เพื่อรองรับการรันเลขที่ซับซ้อนและ Reset Scope ที่หลากหลาย
- **Concurrency Control**: ใช้ Redis Lock หรือ Optimistic Locking (version)
- **Reset Scope**: ใช้ Field `reset_scope` ควบคุมการ Reset แทน `current_year` แบบเดิม

---

### 9.3 document_number_audit (UPDATE v1.7.0)

**Purpose**: Audit log for document number generation (Debugging & Tracking)

| Column Name                | Data Type    | Constraints        | Description                                 |
| :------------------------- | :----------- | :----------------- | :------------------------------------------ |
| id                         | INT          | PK, AI             | ID ของ audit record                         |
| document_id                | INT          | NULL, FK           | ID ของเอกสารที่สร้างเลขที่ (NULL if failed) |
| document_type              | VARCHAR(50)  | NULL               | ประเภทเอกสาร                                |
| document_number            | VARCHAR(100) | NOT NULL           | เลขที่เอกสารที่สร้าง (ผลลัพธ์)              |
| operation                  | ENUM         | DEFAULT 'CONFIRM'  | RESERVE, CONFIRM, MANUAL_OVERRIDE, etc.     |
| status                     | ENUM         | DEFAULT 'RESERVED' | RESERVED, CONFIRMED, CANCELLED, VOID        |
| counter_key                | JSON         | NOT NULL           | Counter key ที่ใช้ (JSON 8 fields)          |
| reservation_token          | VARCHAR(36)  | NULL               | Token การจอง                                |
| idempotency_key            | VARCHAR(128) | NULL               | Idempotency Key from request                |
| originator_organization_id | INT          | NULL               | องค์กรผู้ส่ง                                |
| recipient_organization_id  | INT          | NULL               | องค์กรผู้รับ                                |
| template_used              | VARCHAR(200) | NOT NULL           | Template ที่ใช้ในการสร้าง                   |
| old_value                  | TEXT         | NULL               | Previous value                              |
| new_value                  | TEXT         | NULL               | New value                                   |
| user_id                    | INT          | NULL, FK           | ผู้ขอสร้างเลขที่                            |
| is_success                 | BOOLEAN      | DEFAULT TRUE       | สถานะความสำเร็จ                             |
| created_at                 | TIMESTAMP    | DEFAULT NOW        | วันที่/เวลาที่สร้าง                         |
| total_duration_ms          | INT          | NULL               | เวลารวมทั้งหมดในการสร้าง (ms)               |

**Indexes**:

- PRIMARY KEY (id)
- FOREIGN KEY (document_id) REFERENCES correspondences(id) ON DELETE CASCADE
- FOREIGN KEY (user_id) REFERENCES users(user_id)
- INDEX (document_id)
- INDEX (user_id)
- INDEX (status)
- INDEX (operation)
- INDEX (document_number)
- INDEX (reservation_token)
- INDEX (created_at)

---

### 9.4 document_number_errors (UPDATE v1.7.0)

**Purpose**: Error log for failed document number generation

| Column Name   | Data Type | Constraints | Description                                    |
| :------------ | :-------- | :---------- | :--------------------------------------------- |
| id            | INT       | PK, AI      | ID ของ error record                            |
| error_type    | ENUM      | NOT NULL    | LOCK_TIMEOUT, VERSION_CONFLICT, DB_ERROR, etc. |
| error_message | TEXT      | NULL        | ข้อความ error                                  |
| stack_trace   | TEXT      | NULL        | Stack trace สำหรับ debugging                   |
| context_data  | JSON      | NULL        | Context ของ request                            |
| user_id       | INT       | NULL        | ผู้ที่เกิด error                               |
| created_at    | TIMESTAMP | DEFAULT NOW | วันที่เกิด error                               |
| resolved_at   | TIMESTAMP | NULL        | วันที่แก้ไขแล้ว                                |

**Indexes**:

- PRIMARY KEY (id)
- INDEX (error_type)
- INDEX (created_at)
- INDEX (user_id)
- INDEX (resolved_at)

---

### 9.5 document_number_reservations (NEW v1.7.0)

**Purpose**: Two-Phase Commit table for document number reservation

| Column Name            | Data Type    | Constraints      | Description                          |
| :--------------------- | :----------- | :--------------- | :----------------------------------- |
| id                     | INT          | PK, AI           | Unique ID                            |
| token                  | VARCHAR(36)  | UNIQUE, NOT NULL | UUID v4 Reservation Token            |
| document_number        | VARCHAR(100) | UNIQUE, NOT NULL | เลขที่เอกสารที่จอง                   |
| document_number_status | ENUM         | DEFAULT RESERVED | RESERVED, CONFIRMED, CANCELLED, VOID |
| document_id            | INT          | NULL, FK         | ID ของเอกสาร (เมื่อ Confirm แล้ว)    |
| expires_at             | DATETIME(6)  | NOT NULL         | เวลาหมดอายุการจอง                    |
| project_id             | INT          | NOT NULL, FK     | Project Context                      |
| user_id                | INT          | NOT NULL, FK     | User Context                         |

**Indexes**:

- PRIMARY KEY (id)
- FOREIGN KEY (document_id) REFERENCES correspondence_revisions(id) ON DELETE SET NULL
- FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
- FOREIGN KEY (correspondence_type_id) REFERENCES correspondence_types(id) ON DELETE CASCADE
- FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
- INDEX idx_token (token)
- INDEX idx_status (document_number_status)
- INDEX idx_status_expires (document_number_status, expires_at)
- INDEX idx_document_id (document_id)
- INDEX idx_user_id (user_id)
- INDEX idx_reserved_at (reserved_at)

---

## **10. ⚙️ Unified Workflow Engine Tables (UPDATE v1.7.0)**

### 10.1 workflow_definitions

**Purpose**: เก็บแม่แบบ (Template) ของ Workflow (Definition / DSL)

| Column Name   | Data Type   | Constraints  | Description                               |
| :------------ | :---------- | :----------- | :---------------------------------------- |
| id            | CHAR(36)    | PK, UUID     | Unique Workflow Definition ID             |
| workflow_code | VARCHAR(50) | NOT NULL     | รหัส Workflow (เช่น RFA_FLOW_V1)          |
| version       | INT         | DEFAULT 1    | หมายเลข Version                           |
| description   | TEXT        | NULL         | คำอธิบาย Workflow                         |
| dsl           | JSON        | NOT NULL     | นิยาม Workflow ต้นฉบับ (YAML/JSON Format) |
| compiled      | JSON        | NOT NULL     | โครงสร้าง Execution Tree ที่ Compile แล้ว |
| is_active     | BOOLEAN     | DEFAULT TRUE | สถานะการใช้งาน                            |
| created_at    | TIMESTAMP   | DEFAULT NOW  | วันที่สร้าง                               |
| updated_at    | TIMESTAMP   | ON UPDATE    | วันที่แก้ไขล่าสุด                         |

**Indexes**:

- PRIMARY KEY (id)
- UNIQUE KEY (workflow_code, version)
- INDEX (is_active)

---

### 10.2 workflow_instances

**Purpose**: เก็บสถานะของ Workflow ที่กำลังรันอยู่จริง (Runtime)

| Column Name   | Data Type   | Constraints                | Description                                                                                     |
| :------------ | :---------- | :------------------------- | :---------------------------------------------------------------------------------------------- |
| id            | CHAR(36)    | PK, UUID                   | Unique Instance ID                                                                              |
| definition_id | CHAR(36)    | FK, NOT NULL               | อ้างอิง Definition ที่ใช้                                                                           |
| **contract_id** | **INT**   | **NULL, FK**               | **[delta-07 / ADR-021 C3]** Contract ที่ Workflow นี้สังกัด (NULL = org-scoped เช่น Circulation) |
| entity_type   | VARCHAR(50) | NOT NULL                   | ประเภทเอกสาร (rfa, correspondence, transmittal, circulation)                             |
| entity_id     | VARCHAR(50) | NOT NULL                   | ID ของเอกสาร                                                                                    |
| current_state | VARCHAR(50) | NOT NULL                   | สถานะปัจจุบัน                                                                                   |
| status        | ENUM        | DEFAULT 'ACTIVE'           | ACTIVE, COMPLETED, CANCELLED, TERMINATED                                                        |
| context       | JSON        | NULL                       | ตัวแปร Context สำหรับตัดสินใจ (รวม contractId, projectId, initiatorId เป็นต้น)                      |
| **version_no** | **INT**   | **NOT NULL, DEFAULT 1**   | **[ADR-001 v1.1 FR-002] Optimistic lock counter — incremented on every successful transition. Client sends current value; server rejects with 409 if mismatch.** |
| created_at    | TIMESTAMP   | DEFAULT NOW                | เวลาที่สร้าง                                                                                    |
| updated_at    | TIMESTAMP   | ON UPDATE                  | เวลาที่อัปเดตล่าสุด                                                                         |

**Business Rules**:

- `contract_id` = NOT NULL → contract-scoped workflow (RFA, Correspondence, Transmittal) — Guard Level 2.5 ตรวจ membership
- `contract_id` = NULL → org-scoped workflow (Circulation) — Guard Level 2 (org match only)
- `context.contractId` mirrors `contract_id` column — redundant by design (ฟิลเตอร์ได้ทั้งสองทาง)

**Indexes**:

- PRIMARY KEY (id)
- FOREIGN KEY (definition_id) REFERENCES workflow_definitions(id) ON DELETE CASCADE
- FOREIGN KEY (contract_id) REFERENCES contracts(id) ON DELETE SET NULL
- INDEX (entity_type, entity_id)
- INDEX (current_state)
- INDEX (contract_id, entity_type, status)
- INDEX (id, version_no) — `idx_wf_inst_version` [ADR-001 v1.1 FR-002] — Supports CAS check: WHERE id = ? AND version_no = ?

### 10.3 workflow_histories

**Purpose**: เก็บประวัติการดำเนินการในแต่ละ Step (Audit Trail)

| Column Name       | Data Type   | Constraints  | Description               |
| :---------------- | :---------- | :----------- | :------------------------ |
| id                | CHAR(36)    | PK, UUID     | Unique ID                 |
| instance_id       | CHAR(36)    | FK, NOT NULL | อ้างอิง Instance          |
| from_state        | VARCHAR(50) | NOT NULL     | สถานะต้นทาง               |
| to_state          | VARCHAR(50) | NOT NULL     | สถานะปลายทาง              |
| action            | VARCHAR(50) | NOT NULL     | Action ที่กระทำ           |
| action_by_user_id | INT         | FK, NULL     | User ID ผู้กระทำ          |
| **action_by_user_uuid** | **VARCHAR(36)** | **NULL** | **[ADR-019 FR-003] UUID ของ User ผู้ดำเนินการ — ใช้ใน API Response แทน INT FK. NULL = System Action หรือ Pre-migration record** |
| comment           | TEXT        | NULL         | ความเห็น                  |
| metadata          | JSON        | NULL         | Snapshot ข้อมูล ณ ขณะนั้น |
| created_at        | TIMESTAMP   | DEFAULT NOW  | เวลาที่กระทำ              |

**Indexes**:

- PRIMARY KEY (id)
- FOREIGN KEY (instance_id) REFERENCES workflow_instances(id) ON DELETE CASCADE
- INDEX (instance_id)
- INDEX (action_by_user_id)

---

## **11. 🖥️ System & Logs Tables (ระบบ, บันทึก)**

> **Audit Logging Architecture:**

### 1. Audit Logging

**Table: `audit_logs`**

บันทึกการเปลี่ยนแปลงสำคัญ:

- User actions (CREATE, UPDATE, DELETE)
- Entity type และ Entity ID
- Old/New values (JSON)
- IP Address, User Agent

### 2. User Preferences

**Table: `user_preferences`**

เก็บการตั้งค่าส่วนตัว:

- Language preference
- Notification settings
- UI preferences (JSON)

### 3. JSON Schema Validation

**Table: `json_schemas`**

เก็บ Schema สำหรับ Validate JSON fields:

- `correspondence_revisions.details`
- `user_preferences.preferences`

---

### 11.1 json_schemas (UPDATE v1.7.0)

**Purpose**: เก็บ Schema สำหรับ Validate JSON Columns (Req 3.12)

| Column Name       | Data Type    | Constraints  | Description                         |
| :---------------- | :----------- | :----------- | :---------------------------------- |
| id                | INT          | PK, AI       | Unique ID                           |
| schema_code       | VARCHAR(100) | NOT NULL     | รหัส Schema (เช่น RFA_DWG)          |
| version           | INT          | DEFAULT 1    | เวอร์ชันของ Schema                  |
| table_name        | VARCHAR(100) | NOT NULL     | ชื่อตารางเป้าหมาย                   |
| schema_definition | JSON         | NOT NULL     | JSON Schema Definition              |
| ui_schema         | JSON         | NULL         | โครงสร้าง UI Schema สำหรับ Frontend |
| virtual_columns   | JSON         | NULL         | Config สำหรับสร้าง Virtual Columns  |
| migration_script  | JSON         | NULL         | Script สำหรับแปลงข้อมูล             |
| is_active         | BOOLEAN      | DEFAULT TRUE | สถานะการใช้งาน                      |

---

### 11.2 audit_logs (UPDATE v1.7.0)

**Purpose**: Centralized audit logging for all system actions (Req 6.1)

| Column Name  | Data Type    | Constraints               | Description                                  |
| :----------- | :----------- | :------------------------ | :------------------------------------------- |
| audit_id     | BIGINT       | PK, AI                    | Unique log ID                                |
| request_id   | VARCHAR(100) | NULL                      | Trace ID linking to app logs                 |
| user_id      | INT          | NULL, FK                  | User who performed action                    |
| action       | VARCHAR(100) | NOT NULL                  | Action name (e.g. rfa.create)                |
| severity     | ENUM         | DEFAULT 'INFO'            | INFO, WARN, ERROR, CRITICAL                  |
| entity_type  | VARCHAR(50)  | NULL                      | Module/Table name (e.g. rfa, correspondence) |
| entity_id    | VARCHAR(50)  | NULL                      | ID of affected entity                        |
| details_json | JSON         | NULL                      | Context data / Old & New values              |
| ip_address   | VARCHAR(45)  | NULL                      | User IP address                              |
| user_agent   | VARCHAR(255) | NULL                      | User browser/client info                     |
| created_at   | DATETIME     | DEFAULT CURRENT_TIMESTAMP | Log timestamp                                |

**Indexes**:

- PRIMARY KEY (audit_id, created_at) -- **Partition Key**
- INDEX idx_audit_user (user_id)
- INDEX idx_audit_action (action)
- INDEX idx_audit_entity (entity_type, entity_id)
- INDEX idx_audit_created (created_at)

**Partitioning**:

- **PARTITION BY RANGE (YEAR(created_at))**: แบ่ง Partition รายปี เพื่อประสิทธิภาพในการเก็บข้อมูลระยะยาว

---

### 11.3 notifications (UPDATE v1.7.0)

**Purpose**: System notifications for users

| Column Name       | Data Type    | Constraints                 | Description                      |
| :---------------- | :----------- | :-------------------------- | :------------------------------- |
| id                | INT          | PRIMARY KEY, AUTO_INCREMENT | Unique notification ID           |
| uuid              | UUID         | NOT NULL, DEFAULT           | UUID Public Identifier (ADR-019) |
| user_id           | INT          | NOT NULL, FK                | Recipient user ID                |
| title             | VARCHAR(255) | NOT NULL                    | Notification title               |
| message           | TEXT         | NOT NULL                    | Notification body                |
| notification_type | ENUM         | NOT NULL                    | Type: EMAIL, LINE, SYSTEM        |
| is_read           | BOOLEAN      | DEFAULT FALSE               | Read status                      |
| entity_type       | VARCHAR(50)  | NULL                        | Related Entity Type              |
| entity_id         | INT          | NULL                        | Related Entity ID                |
| created_at        | DATETIME     | DEFAULT CURRENT_TIMESTAMP   | Notification timestamp           |

**Indexes**:

- PRIMARY KEY (id, created_at) -- **Partition Key**
- INDEX idx_notif_user (user_id)
- INDEX idx_notif_type (notification_type)
- INDEX idx_notif_read (is_read)
- INDEX idx_notif_created (created_at)
- INDEX idx_notifications_uuid (uuid)

**Partitioning**:

- **PARTITION BY RANGE (YEAR(created_at))**: แบ่ง Partition รายปี

---

## **12. 🔍 Views (มุมมองข้อมูล)**

### 12.1 v_current_correspondences

**Purpose**: แสดงข้อมูล Correspondence Revision ล่าสุด (is_current = TRUE)

### 12.2 v_current_rfas

**Purpose**: แสดงข้อมูล RFA Revision ล่าสุด พร้อม Status และ Approve Code

### 12.3 v_user_tasks (Unified Workflow)

**Purpose**: รวมรายการงานที่ยังค้างอยู่ (Status = ACTIVE) จากทุกระบบ (RFA, Circulation, Correspondence) เพื่อนำไปแสดงใน Dashboard

### 12.4 v_audit_log_details

**Purpose**: แสดง audit_logs พร้อมข้อมูล username และ email ของผู้กระทำ

### 12.5 v_user_all_permissions

**Purpose**: รวมสิทธิ์ทั้งหมด (Global + Project + Organization) ของผู้ใช้ทุกคน

### 12.6 v_documents_with_attachments

**Purpose**: แสดงเอกสารทั้งหมดที่มีไฟล์แนบ (Correspondence, Circulation, Drawings)

### 12.7 v_document_statistics

**Purpose**: แสดงสถิติเอกสารตามประเภทและสถานะ

---

## **13. 📊 Index Summaries (สรุป Index)**

> **Performance Optimization Strategy:**

### 1. Indexing Strategy

**Primary Indexes:**

- Primary Keys (AUTO_INCREMENT)
- Foreign Keys (automatic in InnoDB)
- Unique Constraints (business keys)

**Secondary Indexes:**

```sql
-- Correspondence search
CREATE INDEX idx_corr_type_status ON correspondence_revisions(correspondence_type_id, correspondence_status_id);
CREATE INDEX idx_corr_date ON correspondence_revisions(document_date);

-- Virtual columns for JSON
CREATE INDEX idx_v_ref_project ON correspondence_revisions(v_ref_project_id);
CREATE INDEX idx_v_doc_subtype ON correspondence_revisions(v_doc_subtype);

-- User lookup
CREATE INDEX idx_user_email ON users(email);
CREATE INDEX idx_user_org ON users(primary_organization_id, is_active);
```

### 2. Virtual Columns

ใช้ Virtual Columns สำหรับ Index JSON fields:

```sql
ALTER TABLE correspondence_revisions
ADD COLUMN v_ref_project_id INT GENERATED ALWAYS AS (JSON_UNQUOTE(JSON_EXTRACT(details, '$.ref_project_id'))) VIRTUAL,
ADD INDEX idx_v_ref_project(v_ref_project_id);
```

### 3. Partitioning (Future)

พิจารณา Partition ตาราง `audit_logs` ตามปี:

```sql
ALTER TABLE audit_logs
PARTITION BY RANGE (YEAR(created_at)) (
  PARTITION p2024 VALUES LESS THAN (2025),
  PARTITION p2025 VALUES LESS THAN (2026),
  PARTITION p_future VALUES LESS THAN MAXVALUE
);
```

---

### 13.1 Performance Indexes

| Table Name               | Index Columns                                     | Purpose                        |
| :----------------------- | :------------------------------------------------ | :----------------------------- |
| correspondences          | (project_id, correspondence_number)               | Fast lookup by document number |
| correspondences          | (correspondence_type_id)                          | Filter by type                 |
| correspondence_revisions | (correspondence_id, is_current)                   | Get current revision           |
| rfas                     | (rfa_type_id)                                     | Filter by RFA type             |
| rfa_revisions            | (rfa_id, is_current)                              | Get current RFA revision       |
| rfa_revisions            | (rfa_status_code_id)                              | Filter by status               |
| audit_logs               | (created_at)                                      | Date range queries             |
| audit_logs               | (user_id)                                         | User activity history          |
| audit_logs               | (module, action)                                  | Action type analysis           |
| notifications            | (user_id, is_read)                                | Unread notifications query     |
| document_number_counters | (project_id, correspondence_type_id, reset_scope) | Running number generation      |
| workflow_instances       | (entity_type, entity_id)                          | Workflow lookup by document ID                            |
| workflow_instances       | (current_state)                                   | Monitor active workflows                                  |
| workflow_instances       | (contract_id, entity_type, status)                | **[delta-07]** Guard contract-membership + dashboard filter |

### 13.2 Unique Constraints

| Table Name              | Columns                              | Description                        |
| :---------------------- | :----------------------------------- | :--------------------------------- |
| users                   | (username)                           | Unique login name                  |
| users                   | (email)                              | Unique email address               |
| organizations           | (organization_code)                  | Unique organization code           |
| projects                | (project_code)                       | Unique project code                |
| contracts               | (contract_code)                      | Unique contract code               |
| correspondences         | (project_id, correspondence_number)  | Unique document number per project |
| shop_drawings           | (drawing_number)                     | Unique shop drawing number         |
| document_number_formats | (project_id, correspondence_type_id) | One format per type per project    |
| workflow_definitions    | (workflow_code, version)             | Unique workflow code per version   |

---

## **14. 🛡️ Data Integrity Constraints (ความถูกต้องของข้อมูล)**

### 14.1 Soft Delete Policy

- **Tables with `deleted_at`**:
  - users
  - organizations
  - projects
  - contracts
  - correspondences
  - rfas
  - shop_drawings
  - contract_drawings
- **Rule**: Records are never physically deleted. `deleted_at` is set to timestamp.
- **Query Rule**: All standard queries MUST include `WHERE deleted_at IS NULL`.

### 14.2 Foreign Key Cascades

- **ON DELETE CASCADE**:
  - Used for child tables that cannot exist without parent (e.g., `correspondence_revisions`, `rfa_revisions`, `correspondence_attachments`).
- **ON DELETE RESTRICT**:
  - Used for master data references to prevent accidental deletion of used data (e.g., `correspondence_types`, `organizations`).
- **ON DELETE SET NULL**:
  - Used for optional references (e.g., `created_by`, `originator_id`).

---

## **15. 🔐 Security & Permissions Model (ความปลอดภัย)**

### 15.1 Row-Level Security (RLS) Logic

- **Organization Scope**: Users can only see documents where `originator_id` OR `recipient_organization_id` matches their organization.
- **Project Scope**: Users can only see documents within projects they are assigned to.
- **Confidentiality**: Documents marked `is_confidential` are visible ONLY to specific roles or users.

### 15.2 Role-Based Access Control (RBAC)

- **Permissions** are granular (e.g., `correspondence.view`, `correspondence.create`).
- **Roles** aggregate permissions (e.g., `Document Controller` = `view` + `create` + `edit`).
- **Assignments** link Users to Roles within a Context (Global, Project, or Organization).

---

## **16. 🔄 Data Migration & Seeding (การย้ายข้อมูล)**

### 16.1 Initial Seeding (V1.7.0)

1. **Master Data**:
   - `organizations`: Owner, Consultant, Contractor
   - `projects`: LCBP3
   - `correspondence_types`: LETTER, MEMO, TRANSMITTAL, RFA
   - `rfa_types`: DWG, MAT, DOC, RFI
   - `rfa_status_codes`: DFT, PEND, APPR, REJ
   - `disciplines`: GEN, STR, ARC, MEP
2. **System Users**:
   - `admin`: Super Admin
   - `system`: System Bot for automated tasks

### 16.2 Migration Strategy

- **Schema Migration**: Use TypeORM Migrations or raw SQL scripts (versioned).
- **Data Migration**:
  - **V1.6.0 -> V1.7.0**:
    - Run SQL script `9_lcbp3_v1_7_0.sql`
    - Migrate `document_number_counters` to 8-col composite PK.
    - Initialize `document_number_reservations`.
    - Update `json_schemas` with new columns.

---

### 16.3 Temporary Migration Tracking Tables (V1.8.0 n8n Migration)

ตารางเหล่านี้ถูกใช้ชั่วคราวระหว่างกระบวนการ Migrate เอกสาร PDF 20,000 ฉบับด้วย n8n (ดูรายละเอียดใน  3-05-n8n-migration-setup-guide.md) และไม่ใช่ตาราง Business หลักของระบบ

#### 16.3.1 migration_progress

**Purpose**: เก็บ Checkpoint สถานะการ Migrate

| Column Name          | Data Type   | Constraints                         | Description                        |
| :------------------- | :---------- | :---------------------------------- | :--------------------------------- |
| batch_id             | VARCHAR(50) | PRIMARY KEY                         | รหัสชุดการ Migrate                 |
| last_processed_index | INT         | DEFAULT 0                           | ลำดับล่าสุดที่ประมวลผลผ่าน         |
| status               | ENUM        | DEFAULT 'RUNNING'                   | สถานะ (RUNNING, COMPLETED, FAILED) |
| updated_at           | TIMESTAMP   | DEFAULT CURRENT_TIMESTAMP ON UPDATE | เวลาอัปเดตล่าสุด                   |

#### 16.3.2 migration_review_queue

**Purpose**: คิวเอกสารที่ต้องการให้เจ้าหน้าที่ตรวจสอบ (Confidence ต่ำกว่าเกณฑ์)
_หมายเหตุ: เมื่อตรวจสอบผ่านและสร้าง Correspondence จริงแล้ว ข้อมูลในนี้อาจถูกลบหรือเก็บเป็น Log ได้_

| Column Name           | Data Type    | Constraints                 | Description                                |
| :-------------------- | :----------- | :-------------------------- | :----------------------------------------- |
| id                    | INT          | PRIMARY KEY, AUTO_INCREMENT | Unique ID                                  |
| document_number       | VARCHAR(100) | NOT NULL, UNIQUE            | เลขที่เอกสาร (จาก OCR)                     |
| title                 | TEXT         |                             | ชื่อเรื่อง                                 |
| original_title        | TEXT         |                             | ชื่อเรื่องต้นฉบับก่อนตรวจสอบ               |
| ai_suggested_category | VARCHAR(50)  |                             | หมวดหมู่ที่ AI แนะนำ                       |
| ai_confidence         | DECIMAL(4,3) |                             | ค่าความมั่นใจของ AI (0.000 - 1.000)        |
| ai_issues             | JSON         |                             | รายละเอียดปัญหาที่ AI พบ                   |
| review_reason         | VARCHAR(255) |                             | เหตุผลที่ต้องตรวจสอบ (เช่น Confidence ต่ำ) |
| status                | ENUM         | DEFAULT 'PENDING'           | PENDING, APPROVED, REJECTED                |
| reviewed_by           | VARCHAR(100) |                             | ผู้ตรวจสอบ                                 |
| reviewed_at           | TIMESTAMP    | NULL                        | เวลาที่ตรวจสอบ                             |
| created_at            | TIMESTAMP    | DEFAULT CURRENT_TIMESTAMP   | วันที่บันทึกเข้าคิว                        |

#### 16.3.3 migration_errors

**Purpose**: บันทึกข้อผิดพลาด (Errors) ระหว่างการทำงานของ n8n workflow

| Column Name     | Data Type    | Constraints                 | Description                                         |
| :-------------- | :----------- | :-------------------------- | :-------------------------------------------------- |
| id              | INT          | PRIMARY KEY, AUTO_INCREMENT | Unique ID                                           |
| batch_id        | VARCHAR(50)  | INDEX                       | รหัสชุดการ Migrate                                  |
| document_number | VARCHAR(100) |                             | เลขที่เอกสาร                                        |
| error_type      | ENUM         | INDEX                       | ประเภท Error (FILE_NOT_FOUND, AI_PARSE_ERROR, etc.) |
| error_message   | TEXT         |                             | รายละเอียด Error                                    |
| raw_ai_response | TEXT         |                             | Raw response จาก AI กรณีแปลผลไม่ได้                 |
| created_at      | TIMESTAMP    | DEFAULT CURRENT_TIMESTAMP   | วันที่บันทึก                                        |

#### 16.3.4 migration_fallback_state

**Purpose**: ติดตามสถานะ Fallback ของ AI (เช่น เปลี่ยน Model เมื่อ Error ถี่)

| Column Name        | Data Type   | Constraints                         | Description                   |
| :----------------- | :---------- | :---------------------------------- | :---------------------------- |
| id                 | INT         | PRIMARY KEY, AUTO_INCREMENT         | Unique ID                     |
| batch_id           | VARCHAR(50) | UNIQUE                              | รหัสชุดการ Migrate            |
| recent_error_count | INT         | DEFAULT 0                           | จำนวน Error รวดล่าสุด         |
| is_fallback_active | BOOLEAN     | DEFAULT FALSE                       | สถานะการใช้งาน Fallback Model |
| updated_at         | TIMESTAMP   | DEFAULT CURRENT_TIMESTAMP ON UPDATE | เวลาอัปเดตล่าสุด              |

#### 16.3.5 import_transactions

**Purpose**: ป้องกันข้อมูลซ้ำ (Idempotency) ระหว่างการ Patch ข้อมูล

| Column Name     | Data Type    | Constraints                 | Description               |
| :-------------- | :----------- | :-------------------------- | :------------------------ |
| id              | INT          | PRIMARY KEY, AUTO_INCREMENT | Unique ID                 |
| idempotency_key | VARCHAR(255) | UNIQUE, NOT NULL            | Key สำหรับเช็คซ้ำ         |
| document_number | VARCHAR(100) |                             | เลขที่เอกสาร              |
| batch_id        | VARCHAR(100) |                             | รหัสชุดการ Migrate        |
| status_code     | INT          | DEFAULT 201                 | HTTP Status ของการ Import |
| created_at      | TIMESTAMP    | DEFAULT CURRENT_TIMESTAMP   | วันที่บันทึก              |

#### 16.3.6 migration_daily_summary

**Purpose**: สรุปยอดการทำงานรายวันแยกตาม Batch

| Column Name     | Data Type   | Constraints                 | Description               |
| :-------------- | :---------- | :-------------------------- | :------------------------ |
| id              | INT         | PRIMARY KEY, AUTO_INCREMENT | Unique ID                 |
| batch_id        | VARCHAR(50) | UNIQUE KEY PART 1           | รหัสชุดการ Migrate        |
| summary_date    | DATE        | UNIQUE KEY PART 2           | วันที่สรุป                |
| total_processed | INT         | DEFAULT 0                   | จำนวนที่ประมวลผลรวม       |
| auto_ingested   | INT         | DEFAULT 0                   | จำนวนที่เข้าสู่ระบบสำเร็จ |
| sent_to_review  | INT         | DEFAULT 0                   | จำนวนที่ส่งคิวตรวจสอบ     |
| rejected        | INT         | DEFAULT 0                   | จำนวนที่ถูกปฏิเสธ         |
| errors          | INT         | DEFAULT 0                   | จำนวนที่เกิด Error        |
| created_at      | TIMESTAMP   | DEFAULT CURRENT_TIMESTAMP   | วันที่บันทึก              |

---

## **17. 📈 Monitoring & Maintenance (การดูแลรักษา)**

### 17.1 Database Maintenance

- **Daily**: Incremental Backup.
- **Weekly**: Full Backup + `OPTIMIZE TABLE` for heavy tables (`audit_logs`, `notifications`).
- **Monthly**: Archive old `audit_logs` partitions to cold storage.

### 17.2 Health Checks

- Monitor `document_number_errors` for numbering failures.
- Monitor `workflow_instances` for stuck workflows (`status = ' IN_PROGRESS '` > 7 days).
- Check `document_number_counters` for gaps or resets.

---

## **18. 📚 Best Practices**

### 1. Naming Conventions

- **Tables**: `snake_case`, plural (e.g., `correspondences`, `users`)
- **Columns**: `snake_case` (e.g., `correspondence_number`, `created_at`)
- **Foreign Keys**: `{referenced_table_singular}_id` (e.g., `project_id`, `user_id`)
- **Junction Tables**: `{table1}_{table2}` (e.g., `correspondence_tags`)

### 2. Timestamp Columns

ทุกตารางควรมี:

- `created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`
- `updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`

### 3. Soft Delete

ใช้ `deleted_at DATETIME NULL` แทนการลบจริง:

```sql
-- Soft delete
UPDATE correspondences SET deleted_at = NOW() WHERE id = 1;

-- Query active records
SELECT * FROM correspondences WHERE deleted_at IS NULL;
```

### 4. JSON Field Guidelines

- ใช้สำหรับข้อมูลที่ไม่ต้อง Query บ่อย
- สร้าง Virtual Columns สำหรับ fields ที่ต้อง Index
- Validate ด้วย JSON Schema
- Document structure ใน Data Dictionary

---

---

## **19. 🤖 AI Gateway Tables (ADR-018, ADR-020)**

> เพิ่มใน v1.9.0 — Task BE-AI-02 | ตารางสำหรับ AI Intelligence Integration

### 19.1 `migration_logs`

**วัตถุประสงค์:** ติดตามสถานะการประมวลผล AI สำหรับเอกสารแต่ละรายการ ใช้ในกระบวนการ Legacy Migration และ New Ingestion

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | INT AUTO_INCREMENT | NO | Internal PK — ห้าม expose ใน API (ADR-019) |
| `uuid` | UUID | NO | Public Identifier (UUIDv7) — ใช้ใน API response เป็น `publicId` |
| `source_file` | VARCHAR(255) | NO | Path หรือ publicId ของไฟล์ต้นทาง |
| `source_metadata` | JSON | YES | Metadata จากแหล่งต้นทาง (Excel, manual input) |
| `ai_extracted_metadata` | JSON | YES | Metadata ที่ AI สกัดได้ — ประกอบด้วย subject, date, discipline, drawingReference, contractNumber |
| `confidence_score` | DECIMAL(3,2) | YES | คะแนนความมั่นใจของ AI (0.00–1.00) ตาม ADR-020 Confidence Strategy |
| `status` | ENUM | NO | สถานะปัจจุบัน (ดู State Machine ด้านล่าง) |
| `admin_feedback` | TEXT | YES | ความเห็นของ Admin ผู้ตรวจสอบ |
| `reviewed_by` | INT | YES | FK → `users.user_id` — Admin ที่ทำการตรวจสอบ |
| `reviewed_at` | TIMESTAMP | YES | เวลาที่ Admin ตรวจสอบ |
| `created_at` | TIMESTAMP | NO | วันที่สร้าง record |
| `updated_at` | TIMESTAMP | NO | วันที่แก้ไขล่าสุด (Auto-update) |

#### Status Enum Values

| Status | Description | Action Required |
|--------|-------------|-----------------|
| `PENDING_REVIEW` | รอ Admin ตรวจสอบ (Default) | Admin ต้องตรวจสอบและเปลี่ยนสถานะ |
| `VERIFIED` | Admin ยืนยันแล้ว พร้อม Import | ระบบนำเข้าหรือรอ Batch Import |
| `IMPORTED` | นำเข้าสู่ระบบสำเร็จ (Terminal State) | ไม่สามารถแก้ไขได้อีก |
| `FAILED` | ล้มเหลว — AI หรือ Validation ไม่ผ่าน | สามารถ Retry ได้ (→ PENDING_REVIEW) |

#### State Machine (Status Transitions)

```
PENDING_REVIEW ──→ VERIFIED ──→ IMPORTED (terminal)
      │                │
      ↓                ↓
    FAILED ──────→ PENDING_REVIEW (retry)
```

**กฎ:**
- `IMPORTED` เป็น Terminal State — ห้ามเปลี่ยนสถานะ
- Admin สามารถเปลี่ยนได้เฉพาะ `PENDING_REVIEW → VERIFIED` หรือ `PENDING_REVIEW → FAILED`
- `FAILED → PENDING_REVIEW` สำหรับ Retry

#### `ai_extracted_metadata` JSON Schema

```json
{
  "subject": "string — หัวเรื่องเอกสาร",
  "date": "YYYY-MM-DD — วันที่เอกสาร",
  "discipline": "Civil | Mechanical | Electrical | Architectural",
  "drawingReference": "string — รหัสแบบอ้างอิง",
  "contractNumber": "string — เลขสัญญา",
  "discrepancies": ["string — รายการที่ไม่สอดคล้องกับต้นทาง"]
}
```

---

### 19.2 `ai_audit_logs`

**วัตถุประสงค์:** บันทึก Audit Trail ของ AI Interaction ทุกครั้ง ตาม ADR-018 Rule 5 — ห้ามลบ record ออก

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | INT AUTO_INCREMENT | NO | Internal PK — ห้าม expose ใน API (ADR-019) |
| `uuid` | UUID | NO | Public Identifier (UUIDv7) |
| `document_public_id` | UUID | YES | UUID ของ `migration_logs` ที่เกี่ยวข้อง (Soft Reference — ไม่ใช่ FK ในระดับ TypeORM) |
| `ai_model` | VARCHAR(50) | NO | ชื่อ AI Model เช่น `gemma4`, `paddleocr`, `gemma4:27b` |
| `processing_time_ms` | INT | YES | เวลาประมวลผล (milliseconds) — เป้าหมาย < 15,000ms ตาม ADR-020 |
| `confidence_score` | DECIMAL(3,2) | YES | คะแนนความมั่นใจ (0.00–1.00) |
| `input_hash` | VARCHAR(64) | YES | SHA-256 hash ของ Input — เพื่อ Integrity Verification |
| `output_hash` | VARCHAR(64) | YES | SHA-256 hash ของ Output — เพื่อ Integrity Verification |
| `status` | ENUM | NO | ผลการประมวลผล: SUCCESS / FAILED / TIMEOUT |
| `error_message` | TEXT | YES | รายละเอียด Error (เมื่อ status = FAILED หรือ TIMEOUT) |
| `created_at` | TIMESTAMP | NO | วันที่สร้าง — เรียงตาม timestamp เพื่อ Audit |

#### Business Rules

1. **Immutable Records** — ห้ามแก้ไขหรือลบ `ai_audit_logs` หลังสร้าง (Audit Trail)
2. **Data Retention** — เก็บไว้อย่างน้อย 90 วัน ตาม ADR-020 Data Privacy
3. **No FK Constraint** — `document_public_id` เป็น Soft Reference เพื่อให้ Log ยังคงอยู่แม้ MigrationLog ถูกลบ

---

### 19.3 Confidence Scoring Strategy (ADR-020)

| Score Range | Action | Description |
|-------------|--------|-------------|
| **0.95–1.00** | `auto_approve` | นำเข้าอัตโนมัติ (Migration mode เท่านั้น) |
| **0.85–0.94** | `low_priority_review` | รอ Admin ตรวจสอบ — ลำดับต่ำ |
| **0.60–0.84** | `high_priority_review` | รอ Admin ตรวจสอบ — ลำดับสูง |
| **< 0.60** | `reject` | ปฏิเสธ — Admin ต้องกรอกข้อมูลเอง |

---

## **20. 📖 Glossary (คำศัพท์)**

- **RFA**: Request for Approval (เอกสารขออนุมัติ)
- **Transmittal**: Document Transmittal Sheet (ใบนำส่งเอกสาร)
- **Shop Drawing**: แบบก่อสร้างที่ผู้รับเหมาจัดทำ
- **Contract Drawing**: แบบสัญญา (แบบตั้งต้น)
- **Revision**: ฉบับแก้ไข (0, 1, 2, A, B, C)
- **Originator**: ผู้จัดทำ/ผู้ส่งเอกสาร
- **Recipient**: ผู้รับเอกสาร
- **Workflow**: กระบวนการทำงาน/อนุมัติ
- **Discipline**: สาขางาน (เช่น โยธา, สถาปัตย์, ไฟฟ้า)

---

**End of Data Dictionary V1.9.0**

---

## **20. 🔍 RFA Approval System Tables (NEW v1.9.0)**

> Feature Branch: `1-rfa-approval-refactor` | Schema File: `lcbp3-v1.9.0-rfa-approval-schema.sql`

### 20.1 review_teams

**Purpose**: ทีมตรวจสอบแยกตาม Discipline สำหรับ RFA Approval

| Column Name           | Data Type    | Constraints                     | Description                                   |
| --------------------- | ------------ | ------------------------------- | --------------------------------------------- |
| id                    | INT          | PRIMARY KEY, AUTO_INCREMENT     | Internal ID                                   |
| uuid                  | UUID         | NOT NULL, UNIQUE, DEFAULT UUID()| UUID Public Identifier (ADR-019)              |
| project_id            | INT          | NOT NULL, FK                    | Reference to projects                         |
| name                  | VARCHAR(100) | NOT NULL                        | Team name                                     |
| description           | VARCHAR(255) | NULL                            | Team description                              |
| default_for_rfa_types | TEXT         | NULL                            | Comma-separated RFA type codes (e.g. SDW,DDW) |
| is_active             | TINYINT(1)   | NOT NULL, DEFAULT 1             | Active status                                 |
| created_at            | DATETIME(6)  | NOT NULL, DEFAULT NOW           | Record creation timestamp                     |
| updated_at            | DATETIME(6)  | NOT NULL, ON UPDATE             | Last update timestamp                         |

**Indexes**:

- PRIMARY KEY (id)
- UNIQUE KEY uq_review_teams_uuid (uuid)
- KEY idx_review_teams_project (project_id, is_active)
- FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE

**Relationships**:

- Parent: projects
- Children: review_team_members, review_tasks
- Referenced by: distribution_recipients (recipient_type='TEAM')

---

### 20.2 review_team_members

**Purpose**: สมาชิกในทีมแยกตาม Discipline (M:N ระหว่าง review_teams และ users)

| Column Name    | Data Type   | Constraints                     | Description                           |
| -------------- | ----------- | ------------------------------- | ------------------------------------- |
| id             | INT         | PRIMARY KEY, AUTO_INCREMENT     | Internal ID                           |
| uuid           | UUID        | NOT NULL, UNIQUE, DEFAULT UUID()| UUID Public Identifier (ADR-019)      |
| team_id        | INT         | NOT NULL, FK                    | Reference to review_teams             |
| user_id        | INT         | NOT NULL, FK                    | Reference to users (user_id)          |
| discipline_id  | INT         | NOT NULL, FK                    | Reference to disciplines              |
| role           | ENUM        | NOT NULL, DEFAULT 'REVIEWER'    | REVIEWER, LEAD, MANAGER               |
| priority_order | INT         | NOT NULL, DEFAULT 0             | Assignment priority within discipline |
| created_at     | DATETIME(6) | NOT NULL, DEFAULT NOW           | Record creation timestamp             |

**Indexes**:

- PRIMARY KEY (id)
- UNIQUE KEY uq_review_team_members_uuid (uuid)
- UNIQUE KEY uq_team_user_discipline (team_id, user_id, discipline_id)
- FOREIGN KEY (team_id) REFERENCES review_teams(id) ON DELETE CASCADE
- FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
- FOREIGN KEY (discipline_id) REFERENCES disciplines(id)

---

### 20.3 response_codes

**Purpose**: รหัสตอบกลับมาตรฐาน (Approval Matrix) สำหรับ RFA Review

| Column Name     | Data Type | Constraints                         | Description                                                          |
| --------------- | --------- | ----------------------------------- | -------------------------------------------------------------------- |
| id              | INT       | PRIMARY KEY, AUTO_INCREMENT         | Internal ID                                                          |
| uuid            | UUID      | NOT NULL, UNIQUE, DEFAULT UUID()    | UUID Public Identifier (ADR-019)                                     |
| code            | VARCHAR(10)| NOT NULL                           | Response code (1A, 1B, 1C, 1D, 1E, 1F, 1G, 2, 3, 4)               |
| sub_status      | VARCHAR(10)| NULL                               | Optional sub-status                                                  |
| category        | ENUM      | NOT NULL                            | ENGINEERING, MATERIAL, CONTRACT, TESTING, ESG                        |
| description_th  | TEXT      | NOT NULL                            | Thai description                                                     |
| description_en  | TEXT      | NOT NULL                            | English description                                                  |
| implications    | JSON      | NULL                                | {affectsSchedule, affectsCost, requiresContractReview}              |
| notify_roles    | TEXT      | NULL                                | Comma-separated roles to notify (e.g. CONTRACT_MANAGER,QS_MANAGER)  |
| is_active       | TINYINT(1)| NOT NULL, DEFAULT 1                 | Active status                                                        |
| is_system       | TINYINT(1)| NOT NULL, DEFAULT 0                 | System default — cannot delete                                       |
| created_at      | DATETIME(6)| NOT NULL, DEFAULT NOW              | Record creation timestamp                                            |

**Indexes**:

- PRIMARY KEY (id)
- UNIQUE KEY uq_response_codes_uuid (uuid)
- UNIQUE KEY uq_response_code_category (code, category)
- KEY idx_rc_category_active (category, is_active)

---

### 20.4 response_code_rules

**Purpose**: กฎการใช้ Response Code ต่อโครงการ/ประเภทเอกสาร (Project-level Override)

| Column Name            | Data Type   | Constraints                  | Description                              |
| ---------------------- | ----------- | ---------------------------- | ---------------------------------------- |
| id                     | INT         | PRIMARY KEY, AUTO_INCREMENT  | Internal ID                              |
| uuid                   | UUID        | NOT NULL, UNIQUE             | UUID Public Identifier (ADR-019)         |
| project_id             | INT         | NULL, FK                     | NULL = global default                    |
| document_type_id       | INT         | NOT NULL, FK                 | Reference to correspondence_types        |
| response_code_id       | INT         | NOT NULL, FK                 | Reference to response_codes              |
| is_enabled             | TINYINT(1)  | NOT NULL, DEFAULT 1          | Enable/disable this code for the context |
| requires_comments      | TINYINT(1)  | NOT NULL, DEFAULT 0          | Force comment when selecting this code   |
| triggers_notification  | TINYINT(1)  | NOT NULL, DEFAULT 0          | Send notification when used              |
| parent_rule_id         | INT         | NULL, FK                     | For inheritance tracking                 |
| created_at             | DATETIME(6) | NOT NULL, DEFAULT NOW        | Record creation timestamp                |
| updated_at             | DATETIME(6) | NOT NULL, ON UPDATE          | Last update timestamp                    |

**Business Rules**:

- `project_id = NULL` = Global default rule (applies to all projects)
- Project-level rules override global defaults
- UNIQUE constraint: (project_id, document_type_id, response_code_id)

---

### 20.5 review_tasks

**Purpose**: งานตรวจสอบสำหรับแต่ละ Discipline ใน Parallel Review Flow

| Column Name              | Data Type   | Constraints                         | Description                                   |
| ------------------------ | ----------- | ----------------------------------- | --------------------------------------------- |
| id                       | INT         | PRIMARY KEY, AUTO_INCREMENT         | Internal ID                                   |
| uuid                     | UUID        | NOT NULL, UNIQUE, DEFAULT UUID()    | UUID Public Identifier (ADR-019)              |
| rfa_revision_id          | INT         | NOT NULL, FK                        | Reference to rfa_revisions                    |
| team_id                  | INT         | NOT NULL, FK                        | Reference to review_teams                     |
| discipline_id            | INT         | NOT NULL, FK                        | Reference to disciplines                      |
| assigned_to_user_id      | INT         | NULL, FK                            | Assigned reviewer (NULL = auto-assign)        |
| status                   | ENUM        | NOT NULL, DEFAULT 'PENDING'         | PENDING, IN_PROGRESS, COMPLETED, DELEGATED, EXPIRED, CANCELLED |
| due_date                 | DATE        | NULL                                | Review due date                               |
| response_code_id         | INT         | NULL, FK                            | Selected response code                        |
| comments                 | TEXT        | NULL                                | Reviewer comments                             |
| attachments              | JSON        | NULL                                | Array of attachment publicIds (ADR-021)       |
| delegated_from_user_id   | INT         | NULL                                | Original assignee when task was delegated     |
| completed_at             | TIMESTAMP   | NULL                                | Completion timestamp                          |
| version                  | INT         | NOT NULL, DEFAULT 1                 | Optimistic locking (ADR-002)                  |
| created_at               | DATETIME(6) | NOT NULL, DEFAULT NOW               | Record creation timestamp                     |
| updated_at               | DATETIME(6) | NOT NULL, ON UPDATE                 | Last update timestamp                         |

**Indexes**:

- UNIQUE KEY uq_review_task_per_revision_discipline (rfa_revision_id, team_id, discipline_id)
- KEY idx_review_tasks_assigned (assigned_to_user_id, status)
- FOREIGN KEY (assigned_to_user_id) REFERENCES users(user_id) ON DELETE SET NULL

**Business Rules**:

- One task per revision + team + discipline combination (UNIQUE enforced)
- `version` column used for optimistic locking (ADR-002)
- `attachments` JSON stores publicIds — resolved via AttachmentsService (no FK)

---

### 20.6 delegations

**Purpose**: การมอบหมายงาน (Task Delegation) ระหว่างผู้ใช้

| Column Name        | Data Type   | Constraints                     | Description                                                 |
| ------------------ | ----------- | ------------------------------- | ----------------------------------------------------------- |
| id                 | INT         | PRIMARY KEY, AUTO_INCREMENT     | Internal ID                                                 |
| uuid               | UUID        | NOT NULL, UNIQUE, DEFAULT UUID()| UUID Public Identifier (ADR-019)                            |
| delegator_user_id  | INT         | NOT NULL, FK                    | ผู้มอบหมาย → users(user_id)                                 |
| delegate_user_id   | INT         | NOT NULL, FK                    | ผู้รับมอบหมาย → users(user_id)                              |
| start_date         | DATE        | NOT NULL                        | วันที่เริ่มการมอบหมาย                                       |
| end_date           | DATE        | NULL                            | วันที่สิ้นสุด — BullMQ job flip is_active=0 เมื่อผ่าน (ADR-008) |
| scope              | ENUM        | NOT NULL, DEFAULT 'ALL'         | ALL, RFA_ONLY, CORRESPONDENCE_ONLY, SPECIFIC_TYPES          |
| document_types     | TEXT        | NULL                            | Comma-separated doc type codes when scope=SPECIFIC_TYPES    |
| is_active          | TINYINT(1)  | NOT NULL, DEFAULT 1             | Managed by BullMQ scheduler — ห้าม flip manual              |
| reason             | TEXT        | NULL                            | เหตุผลการมอบหมาย                                            |
| created_at         | DATETIME(6) | NOT NULL, DEFAULT NOW           | Record creation timestamp                                   |
| updated_at         | DATETIME(6) | NOT NULL, ON UPDATE             | Last update timestamp                                       |

**Business Rules**:

- **Auto-expiry**: BullMQ Scheduled Job ตรวจ `end_date < NOW()` และ flip `is_active = 0` (ADR-008)
- **Active check query**: `WHERE delegator_user_id = ? AND is_active = 1 AND start_date <= NOW() AND (end_date IS NULL OR end_date >= NOW())`
- ห้ามเปลี่ยน `is_active` โดยตรงในระดับ Service — ใช้ BullMQ เท่านั้น

---

### 20.7 reminder_rules

**Purpose**: กฎการแจ้งเตือน (Reminder/Escalation) สำหรับ Review Tasks

| Column Name                | Data Type   | Constraints              | Description                                              |
| -------------------------- | ----------- | ------------------------ | -------------------------------------------------------- |
| id                         | INT         | PRIMARY KEY, AUTO_INCREMENT | Internal ID                                           |
| uuid                       | UUID        | NOT NULL, UNIQUE         | UUID Public Identifier (ADR-019)                         |
| name                       | VARCHAR(100)| NOT NULL                 | Rule name                                                |
| project_id                 | INT         | NULL, FK                 | NULL = global rule                                       |
| document_type_id           | INT         | NULL, FK                 | NULL = applies to all types                              |
| trigger_days_before_due    | INT         | NOT NULL, DEFAULT 2      | วันก่อน due date ที่จะแจ้งเตือน                          |
| escalation_days_after_due  | INT         | NOT NULL, DEFAULT 1      | วันหลัง due date ที่จะ escalate                           |
| reminder_type              | ENUM        | NOT NULL                 | DUE_SOON, ON_DUE, OVERDUE, ESCALATION_L1, ESCALATION_L2 |
| recipients                 | TEXT        | NOT NULL                 | Comma-separated: ASSIGNEE, MANAGER, PROJECT_MANAGER      |
| message_template_th        | TEXT        | NOT NULL                 | Thai message template                                    |
| message_template_en        | TEXT        | NOT NULL                 | English message template                                 |
| is_active                  | TINYINT(1)  | NOT NULL, DEFAULT 1      | Active status                                            |
| created_at                 | DATETIME(6) | NOT NULL, DEFAULT NOW    | Record creation timestamp                                |
| updated_at                 | DATETIME(6) | NOT NULL, ON UPDATE      | Last update timestamp                                    |

---

### 20.8 distribution_matrices

**Purpose**: ตารางกำหนดกฎการกระจายเอกสาร (Distribution Matrix) ตาม Response Code

| Column Name      | Data Type   | Constraints              | Description                                    |
| ---------------- | ----------- | ------------------------ | ---------------------------------------------- |
| id               | INT         | PRIMARY KEY, AUTO_INCREMENT | Internal ID                                 |
| uuid             | UUID        | NOT NULL, UNIQUE         | UUID Public Identifier (ADR-019)               |
| name             | VARCHAR(100)| NOT NULL                 | Matrix name                                    |
| project_id       | INT         | NULL, FK                 | NULL = global matrix                           |
| document_type_id | INT         | NOT NULL, FK             | Reference to correspondence_types              |
| response_code_id | INT         | NULL, FK                 | NULL = applies to all codes                    |
| conditions       | JSON        | NULL                     | {codes:["1A","1B"], excludeCodes:["3","4"]}   |
| is_active        | TINYINT(1)  | NOT NULL, DEFAULT 1      | Active status                                  |
| created_at       | DATETIME(6) | NOT NULL, DEFAULT NOW    | Record creation timestamp                      |

---

### 20.9 distribution_recipients

**Purpose**: ผู้รับเอกสารใน Distribution Matrix (Polymorphic Reference)

| Column Name          | Data Type   | Constraints              | Description                                                       |
| -------------------- | ----------- | ------------------------ | ----------------------------------------------------------------- |
| id                   | INT         | PRIMARY KEY, AUTO_INCREMENT | Internal ID                                                    |
| uuid                 | UUID        | NOT NULL, UNIQUE         | UUID Public Identifier (ADR-019)                                  |
| matrix_id            | INT         | NOT NULL, FK             | Reference to distribution_matrices                                |
| recipient_type       | ENUM        | NOT NULL                 | USER, ORGANIZATION, TEAM, ROLE                                    |
| recipient_public_id  | UUID        | NOT NULL                 | publicId ของ target entity (ดูตาราง Polymorphic Resolution ด้านล่าง) |
| delivery_method      | ENUM        | NOT NULL, DEFAULT 'BOTH' | EMAIL, IN_APP, BOTH                                               |
| sequence             | INT         | NULL                     | For ordered delivery                                              |
| created_at           | DATETIME(6) | NOT NULL, DEFAULT NOW    | Record creation timestamp                                         |

**Polymorphic Resolution Table**:

| recipient_type | recipient_public_id อ้างอิง | FK | หมายเหตุ |
|---|---|---|---|
| USER | users.uuid | Soft (no FK) | Resolved via UserService |
| ORGANIZATION | organizations.uuid | Soft (no FK) | Resolved via OrgService |
| TEAM | review_teams.uuid | Soft (no FK) | Q4A — ทีมตรวจสอบ RFA |
| ROLE | roles.uuid | Soft (no FK) | Q4B — ต้องใช้หลัง Apply delta-11 |

**Business Rules**:

- **ไม่มี FK constraint** บน recipient_public_id โดยออกแบบ (Polymorphic Pattern)
- Service Layer ต้องตรวจสอบ existence ก่อน save
- ใช้ index `idx_dr_type_recipient (recipient_type, recipient_public_id)` สำหรับ lookup performance

---
