# **ตารางฐานข้อมูล (Data Dictionary) - LCBP3-DMS (V1.4.2)**

เอกสารนี้สรุปโครงสร้างตาราง, Foreign Keys (FK), และ Constraints ที่สำคัญทั้งหมดในฐานข้อมูล LCBP3-DMS (v1.4.0) เพื่อใช้เป็นเอกสารอ้างอิงสำหรับทีมพัฒนา Backend (NestJS) และ Frontend (Next.js) โดยอิงจาก Requirements และ SQL Script ล่าสุด [GLM-4.6]

---

## **1. 🏢 Core & Master Data Tables (องค์กร, โครงการ, สัญญา)**

### 1.1 organization_roles

**Purpose**: Master table for organization role types in the system

| Column Name | Data Type   | Constraints                 | Description                                                      |
| ----------- | ----------- | --------------------------- | ---------------------------------------------------------------- |
| id          | INT         | PRIMARY KEY, AUTO_INCREMENT | Unique identifier for organization role                          |
| role_name   | VARCHAR(20) | NOT NULL, UNIQUE            | Role name (OWNER, DESIGNER, CONSULTANT, CONTRACTOR, THIRD PARTY) |

**Indexes**:

- PRIMARY KEY (id)
- UNIQUE (role_name)

**Business Rules**:

- Predefined system roles for organization types
- Cannot be deleted if referenced by organizations

---

### 1.2 organizations

**Purpose**: Master table storing all organizations involved in the system

| Column Name       | Data Type    | Constraints                         | Description                              |
| ----------------- | ------------ | ----------------------------------- | ---------------------------------------- |
| id                | INT          | PRIMARY KEY, AUTO_INCREMENT         | Unique identifier for organization       |
| organization_code | VARCHAR(20)  | NOT NULL, UNIQUE                    | Organization code (e.g., 'กทท.', 'TEAM') |
| organization_name | VARCHAR(255) | NOT NULL                            | Full organization name                   |
| is_active         | BOOLEAN      | DEFAULT TRUE                        | Active status (1=active, 0=inactive)     |
| created_at        | TIMESTAMP    | DEFAULT CURRENT_TIMESTAMP           | Record creation timestamp                |
| updated_at        | TIMESTAMP    | DEFAULT CURRENT_TIMESTAMP ON UPDATE | Last update timestamp                    |

**Indexes**:

- PRIMARY KEY (id)
- UNIQUE (organization_code)
- INDEX (is_active)

**Relationships**:

- Referenced by: users, project_organizations, contract_organizations, correspondences, circulations

**Seed Data**: Pre-populated with 15 organizations including:

- Port Authority of Thailand (กทท.)
- Project supervision consultants (สค©.3-xx)
- Design consultants (TEAM)
- Construction supervisors (คคง.)
- Contractors (ผรม.1-4)
- Third parties (EN, CAR)

---

### 1.3 projects

**Purpose**: Master table for all projects in the system

| Column Name  | Data Type    | Constraints                 | Description                   |
| ------------ | ------------ | --------------------------- | ----------------------------- |
| id           | INT          | PRIMARY KEY, AUTO_INCREMENT | Unique identifier for project |
| project_code | VARCHAR(50)  | NOT NULL, UNIQUE            | Project code (e.g., 'LCBP3')  |
| project_name | VARCHAR(255) | NOT NULL                    | Full project name             |
| is_active    | TINYINT(1)   | DEFAULT 1                   | Active status                 |

**Indexes**:

- PRIMARY KEY (id)
- UNIQUE (project_code)
- INDEX (is_active)

**Relationships**:

- Referenced by: contracts, correspondences, document_number_formats, drawings

**Seed Data**: 5 projects for Laem Chabang Port Phase 3 (LCBP3) including main project and 4 sub-contracts

---

### 1.4 contracts

**Purpose**: Master table for contracts within projects

| Column Name   | Data Type    | Constraints                         | Description                    |
| ------------- | ------------ | ----------------------------------- | ------------------------------ |
| id            | INT          | PRIMARY KEY, AUTO_INCREMENT         | Unique identifier for contract |
| project_id    | INT          | NOT NULL, FK                        | Reference to projects table    |
| contract_code | VARCHAR(50)  | NOT NULL, UNIQUE                    | Contract code                  |
| contract_name | VARCHAR(255) | NOT NULL                            | Full contract name             |
| description   | TEXT         | NULL                                | Contract description           |
| start_date    | DATE         | NULL                                | Contract start date            |
| end_date      | DATE         | NULL                                | Contract end date              |
| is_active     | BOOLEAN      | DEFAULT TRUE                        | Active status                  |
| created_at    | TIMESTAMP    | DEFAULT CURRENT_TIMESTAMP           | Record creation timestamp      |
| updated_at    | TIMESTAMP    | DEFAULT CURRENT_TIMESTAMP ON UPDATE | Last update timestamp          |

**Indexes**:

- PRIMARY KEY (id)
- UNIQUE (contract_code)
- FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
- INDEX (project_id, is_active)

**Relationships**:

- Parent: projects
- Referenced by: contract_organizations, user_assignments

**Seed Data**: 7 contracts including design, supervision, construction, and environmental monitoring

---

## **2. 👥 Users & RBAC Tables (ผู้ใช้, สิทธิ์, บทบาท)**

### 2.1 users

**Purpose**: Master table storing all system users

| Column Name             | Data Type    | Constraints                         | Description                      |
| ----------------------- | ------------ | ----------------------------------- | -------------------------------- |
| user_id                 | INT          | PRIMARY KEY, AUTO_INCREMENT         | Unique identifier for user       |
| username                | VARCHAR(50)  | NOT NULL, UNIQUE                    | Login username                   |
| password_hash           | VARCHAR(255) | NOT NULL                            | Hashed password (bcrypt)         |
| first_name              | VARCHAR(50)  | NULL                                | User's first name                |
| last_name               | VARCHAR(50)  | NULL                                | User's last name                 |
| email                   | VARCHAR(100) | NOT NULL, UNIQUE                    | Email address                    |
| line_id                 | VARCHAR(100) | NULL                                | LINE messenger ID                |
| primary_organization_id | INT          | NULL, FK                            | Primary organization affiliation |
| is_active               | TINYINT(1)   | DEFAULT 1                           | Active status                    |
| failed_attempts         | INT          | DEFAULT 0                           | Failed login attempts counter    |
| locked_until            | DATETIME     | NULL                                | Account lock expiration time     |
| last_login_at           | TIMESTAMP    | NULL                                | Last successful login timestamp  |
| created_at              | TIMESTAMP    | DEFAULT CURRENT_TIMESTAMP           | Record creation timestamp        |
| updated_at              | TIMESTAMP    | DEFAULT CURRENT_TIMESTAMP ON UPDATE | Last update timestamp            |

**Indexes**:

- PRIMARY KEY (user_id)
- UNIQUE (username)
- UNIQUE (email)
- FOREIGN KEY (primary_organization_id) REFERENCES organizations(id) ON DELETE SET NULL
- INDEX (is_active)
- INDEX (email)

**Relationships**:

- Parent: organizations (primary_organization_id)
- Referenced by: user_assignments, audit_logs, notifications, circulation_routings

**Security Features**:

- Password stored as bcrypt hash
- Account locking after failed attempts
- Last login tracking

**Seed Data**: 3 initial users (superadmin, editor01, viewer01)

---

### 2.2 roles

**Purpose**: Master table defining system roles with scope levels

| Column Name | Data Type    | Constraints                 | Description                                          |
| ----------- | ------------ | --------------------------- | ---------------------------------------------------- |
| role_id     | INT          | PRIMARY KEY, AUTO_INCREMENT | Unique identifier for role                           |
| role_name   | VARCHAR(100) | NOT NULL                    | Role name (e.g., 'Superadmin', 'Document Control')   |
| scope       | ENUM         | NOT NULL                    | Scope level: Global, Organization, Project, Contract |
| description | TEXT         | NULL                        | Role description                                     |
| is_system   | BOOLEAN      | DEFAULT FALSE               | System role flag (cannot be deleted)                 |

**Indexes**:

- PRIMARY KEY (role_id)
- INDEX (scope)

**Relationships**:

- Referenced by: role_permissions, user_assignments

**Seed Data**: 7 predefined roles

1. Superadmin (Global) - Full system access
2. Org Admin (Organization) - Organization management
3. Document Control (Organization) - Document lifecycle management
4. Editor (Organization) - Document creation and editing
5. Viewer (Organization) - Read-only access
6. Project Manager (Project) - Project-level management
7. Contract Admin (Contract) - Contract-specific administration

---

### 2.3 permissions

**Purpose**: Master table defining all system permissions

| Column Name     | Data Type    | Constraints                 | Description                                            |
| --------------- | ------------ | --------------------------- | ------------------------------------------------------ |
| permission_id   | INT          | PRIMARY KEY, AUTO_INCREMENT | Unique identifier for permission                       |
| permission_name | VARCHAR(100) | NOT NULL, UNIQUE            | Permission code (e.g., 'rfas.create', 'document.view') |
| description     | TEXT         | NULL                        | Permission description                                 |
| module          | VARCHAR(50)  | NULL                        | Related module name                                    |
| scope_level     | ENUM         | NULL                        | Scope: GLOBAL, ORG, PROJECT                            |
| is_active       | TINYINT(1)   | DEFAULT 1                   | Active status                                          |

**Indexes**:

- PRIMARY KEY (permission_id)
- UNIQUE (permission_name)
- INDEX (module)
- INDEX (scope_level)
- INDEX (is_active)

**Relationships**:

- Referenced by: role_permissions

**Permission Categories**:

1. **System Management** (1): system.manage_all
2. **Organization Management** (2-5): create, edit, delete, view
3. **Project Management** (6-9, 23-26): create, edit, delete, view, manage members/contracts/reports
4. **Role & Permission Management** (10-13): create, edit, delete roles, assign permissions
5. **Master Data Management** (14-17): document types, statuses, categories, tags
6. **User Management** (18-22): create, edit, delete, view, assign organization
7. **Contract Management** (27-28): manage members, view
8. **Document Management** (29-44): CRUD operations, workflows, circulation
9. **Search & Reporting** (48-49): advanced search, generate reports

**Total Permissions**: 49

---

### 2.4 role_permissions

**Purpose**: Junction table mapping roles to permissions (M:N)

| Column Name   | Data Type | Constraints     | Description                    |
| ------------- | --------- | --------------- | ------------------------------ |
| role_id       | INT       | PRIMARY KEY, FK | Reference to roles table       |
| permission_id | INT       | PRIMARY KEY, FK | Reference to permissions table |

**Indexes**:

- PRIMARY KEY (role_id, permission_id)
- FOREIGN KEY (role_id) REFERENCES roles(role_id) ON DELETE CASCADE
- FOREIGN KEY (permission_id) REFERENCES permissions(permission_id) ON DELETE CASCADE
- INDEX (permission_id)

**Relationships**:

- Parent: roles, permissions

**Seed Data**: Complete permission mappings for all 7 roles

- Superadmin: All 49 permissions
- Org Admin: 15 permissions (user/org/tag management, view access)
- Document Control: 26 permissions (full document lifecycle)
- Editor: 12 permissions (document CRUD without admin powers)
- Viewer: 2 permissions (view and search only)
- Project Manager: 23 permissions (project management + document CRUD)
- Contract Admin: 15 permissions (contract management + document CRUD)

---

### 2.5 user_assignments

**Purpose**: Junction table assigning users to roles with scope context

| Column Name         | Data Type | Constraints                 | Description                        |
| ------------------- | --------- | --------------------------- | ---------------------------------- |
| id                  | INT       | PRIMARY KEY, AUTO_INCREMENT | Unique identifier                  |
| user_id             | INT       | NOT NULL, FK                | Reference to users table           |
| role_id             | INT       | NOT NULL, FK                | Reference to roles table           |
| organization_id     | INT       | NULL, FK                    | Organization scope (if applicable) |
| project_id          | INT       | NULL, FK                    | Project scope (if applicable)      |
| contract_id         | INT       | NULL, FK                    | Contract scope (if applicable)     |
| assigned_by_user_id | INT       | NULL, FK                    | User who made the assignment       |
| assigned_at         | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP   | Assignment timestamp               |

**Indexes**:

- PRIMARY KEY (id)
- FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
- FOREIGN KEY (role_id) REFERENCES roles(role_id) ON DELETE CASCADE
- FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
- FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
- FOREIGN KEY (contract_id) REFERENCES contracts(id) ON DELETE CASCADE
- FOREIGN KEY (assigned_by_user_id) REFERENCES users(user_id)
- INDEX (user_id, role_id)
- INDEX (organization_id)
- INDEX (project_id)
- INDEX (contract_id)

**Constraints**:

- CHECK: Only one scope field (organization_id, project_id, contract_id) can be NOT NULL, or all NULL for Global scope

**Relationships**:

- Parent: users, roles, organizations, projects, contracts

**Business Rules**:

- User can have multiple role assignments with different scopes
- Scope inheritance: Contract → Project → Organization → Global
- Global scope: all scope fields are NULL

---

### 2.6 project_organizations

**Purpose**: Junction table linking projects to participating organizations (M:N)

| Column Name     | Data Type | Constraints     | Description                      |
| --------------- | --------- | --------------- | -------------------------------- |
| project_id      | INT       | PRIMARY KEY, FK | Reference to projects table      |
| organization_id | INT       | PRIMARY KEY, FK | Reference to organizations table |

**Indexes**:

- PRIMARY KEY (project_id, organization_id)
- FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
- FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
- INDEX (organization_id)

**Relationships**:

- Parent: projects, organizations

**Seed Data**: Pre-populated with project-organization relationships

---

### 2.7 contract_organizations

**Purpose**: Junction table linking contracts to participating organizations with roles (M:N)

| Column Name      | Data Type    | Constraints     | Description                                                               |
| ---------------- | ------------ | --------------- | ------------------------------------------------------------------------- |
| contract_id      | INT          | PRIMARY KEY, FK | Reference to contracts table                                              |
| organization_id  | INT          | PRIMARY KEY, FK | Reference to organizations table                                          |
| role_in_contract | VARCHAR(100) | NULL            | Organization's role in contract (Owner, Designer, Consultant, Contractor) |

**Indexes**:

- PRIMARY KEY (contract_id, organization_id)
- FOREIGN KEY (contract_id) REFERENCES contracts(id) ON DELETE CASCADE
- FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
- INDEX (organization_id)
- INDEX (role_in_contract)

**Relationships**:

- Parent: contracts, organizations

**Seed Data**: Pre-populated with contract-organization-role relationships

---

## **3. ✉️ Correspondences Tables (เอกสารหลัก, Revisions, Workflows)**

### 3.1 correspondence_types

**Purpose**: Master table for correspondence document types

| Column Name | Data Type    | Constraints                 | Description                                   |
| ----------- | ------------ | --------------------------- | --------------------------------------------- |
| id          | INT          | PRIMARY KEY, AUTO_INCREMENT | Unique identifier                             |
| type_code   | VARCHAR(50)  | NOT NULL, UNIQUE            | Type code (e.g., 'RFA', 'RFI', 'TRANSMITTAL') |
| type_name   | VARCHAR(255) | NOT NULL                    | Full type name                                |
| sort_order  | INT          | DEFAULT 0                   | Display order                                 |
| is_active   | TINYINT(1)   | DEFAULT 1                   | Active status                                 |

**Indexes**:

- PRIMARY KEY (id)
- UNIQUE (type_code)
- INDEX (is_active)
- INDEX (sort_order)

**Relationships**:

- Referenced by: correspondences, document_number_formats, document_number_counters

**Seed Data**: 10 correspondence types including RFA, RFI, TRANSMITTAL, EMAIL, INSTRUCTION, LETTER, MEMO, MOM, NOTICE, OTHER

---

### 3.2 correspondence_status

**Purpose**: Master table for correspondence status codes

| Column Name | Data Type    | Constraints                 | Description                           |
| ----------- | ------------ | --------------------------- | ------------------------------------- |
| id          | INT          | PRIMARY KEY, AUTO_INCREMENT | Unique identifier                     |
| status_code | VARCHAR(50)  | NOT NULL, UNIQUE            | Status code (e.g., 'DRAFT', 'SUBOWN') |
| status_name | VARCHAR(255) | NOT NULL                    | Full status name                      |
| sort_order  | INT          | DEFAULT 0                   | Display order                         |
| is_active   | TINYINT(1)   | DEFAULT 1                   | Active status                         |

**Indexes**:

- PRIMARY KEY (id)
- UNIQUE (status_code)
- INDEX (is_active)
- INDEX (sort_order)

**Relationships**:

- Referenced by: correspondence_revisions

**Seed Data**: 23 status codes covering draft, submission, reply, resubmission, closure, and cancellation states by different parties (Owner, Designer, CSC, Contractor)

---

### 3.3 correspondences

**Purpose**: Master table for correspondence documents (non-revisioned data)

| Column Name               | Data Type    | Constraints                 | Description                                |
| ------------------------- | ------------ | --------------------------- | ------------------------------------------ |
| id                        | INT          | PRIMARY KEY, AUTO_INCREMENT | Master correspondence ID                   |
| correspondence_number     | VARCHAR(100) | NOT NULL                    | Document number (from numbering system)    |
| correspondence_type_id    | INT          | NOT NULL, FK                | Reference to correspondence_types          |
| is_internal_communication | TINYINT(1)   | DEFAULT 0                   | Internal (1) or external (0) communication |
| project_id                | INT          | NOT NULL, FK                | Reference to projects table                |
| originator_id             | INT          | NULL, FK                    | Originating organization                   |
| created_at                | DATETIME     | DEFAULT CURRENT_TIMESTAMP   | Record creation timestamp                  |
| created_by                | INT          | NULL, FK                    | User who created the record                |
| deleted_at                | DATETIME     | NULL                        | Soft delete timestamp                      |

**Indexes**:

- PRIMARY KEY (id)
- FOREIGN KEY (correspondence_type_id) REFERENCES correspondence_types(id) ON DELETE RESTRICT
- FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
- FOREIGN KEY (originator_id) REFERENCES organizations(id) ON DELETE SET NULL
- FOREIGN KEY (created_by) REFERENCES users(user_id) ON DELETE SET NULL
- UNIQUE KEY (project_id, correspondence_number)
- INDEX (correspondence_type_id)
- INDEX (originator_id)
- INDEX (deleted_at)

**Relationships**:

- Parent: correspondence_types, projects, organizations, users
- Children: correspondence_revisions, correspondence_recipients, correspondence_tags, correspondence_references, correspondence_attachments, circulations, transmittals

**Business Rules**:

- One correspondence can have multiple revisions
- Correspondence number must be unique within a project
- Soft delete preserves history

---

### 3.4 correspondence_revisions

**Purpose**: Child table storing revision history of correspondences (1:N)

| Column Name              | Data Type    | Constraints                       | Description                                              |
| ------------------------ | ------------ | --------------------------------- | -------------------------------------------------------- |
| id                       | INT          | PRIMARY KEY, AUTO_INCREMENT       | Unique revision ID                                       |
| correspondence_id        | INT          | NOT NULL, FK                      | Master correspondence ID                                 |
| revision_number          | INT          | NOT NULL                          | Revision sequence (0, 1, 2...)                           |
| revision_label           | VARCHAR(10)  | NULL                              | Display revision (A, B, 1.1...)                          |
| is_current               | BOOLEAN      | DEFAULT FALSE                     | Current revision flag                                    |
| correspondence_status_id | INT          | NOT NULL, FK                      | Current status of this revision                          |
| title                    | VARCHAR(255) | NOT NULL                          | Document title                                           |
| document_date            | DATE         | NULL                              | Document date                                            |
| issued_date              | DATETIME     | NULL                              | Issue date                                               |
| received_date            | DATETIME     | NULL                              | Received date                                            |
| due_date                 | DATETIME     | NULL                              | Due date for response                                    |
| description              | TEXT         | NULL                              | Revision description                                     |
| details                  | JSON         | NULL                              | Type-specific details (e.g., RFI questions)              |
| created_at               | DATETIME     | DEFAULT CURRENT_TIMESTAMP         | Revision creation timestamp                              |
| created_by               | INT          | NULL, FK                          | User who created revision                                |
| updated_by               | INT          | NULL, FK                          | User who last updated                                    |
| v_ref_project_id         | INT          | GENERATED ALWAYS AS (...) VIRTUAL | Virtual Column ดึง Project ID จาก JSON details เพื่อทำ Index |
| v_ref_type               | VARCHAR(50)  | GENERATED ALWAYS AS (...) VIRTUAL | Virtual Column ดึง Type จาก JSON details                  |

**Indexes**:

- PRIMARY KEY (id)
- FOREIGN KEY (correspondence_id) REFERENCES correspondences(id) ON DELETE CASCADE
- FOREIGN KEY (correspondence_status_id) REFERENCES correspondence_status(id) ON DELETE RESTRICT
- FOREIGN KEY (created_by) REFERENCES users(user_id) ON DELETE SET NULL
- FOREIGN KEY (updated_by) REFERENCES users(user_id) ON DELETE SET NULL
- UNIQUE KEY (correspondence_id, revision_number)
- UNIQUE KEY (correspondence_id, is_current) - Only one current revision per correspondence
- INDEX (correspondence_status_id)
- INDEX (is_current)
- INDEX (document_date)
- INDEX (issued_date)
- INDEX (v_ref_project_id)
- INDEX (v_ref_type)

**Relationships**:

- Parent: correspondences, correspondence_status, users

**Business Rules**:

- Only one revision can be marked as current (is_current=TRUE) per correspondence
- Revision numbers are sequential starting from 0
- JSON details field allows type-specific data storage

---

### 3.5 correspondence_recipients

**Purpose**: Junction table for correspondence recipients (TO/CC) (M:N)

| Column Name               | Data Type        | Constraints     | Description                  |
| ------------------------- | ---------------- | --------------- | ---------------------------- |
| correspondence_id         | INT              | PRIMARY KEY, FK | Reference to correspondences |
| recipient_organization_id | INT              | PRIMARY KEY, FK | Recipient organization       |
| recipient_type            | ENUM('TO', 'CC') | PRIMARY KEY     | Recipient type               |

**Indexes**:

- PRIMARY KEY (correspondence_id, recipient_organization_id, recipient_type)
- FOREIGN KEY (correspondence_id) REFERENCES correspondence_revisions(correspondence_id) ON DELETE CASCADE
- FOREIGN KEY (recipient_organization_id) REFERENCES organizations(id) ON DELETE RESTRICT
- INDEX (recipient_organization_id)
- INDEX (recipient_type)

**Relationships**:

- Parent: correspondences, organizations

**Business Rules**:

- One organization can be both TO and CC recipient
- Cascade delete when correspondence is deleted

---

### 3.6 tags

**Purpose**: Master table for document tagging system

| Column Name | Data Type    | Constraints                         | Description               |
| ----------- | ------------ | ----------------------------------- | ------------------------- |
| id          | INT          | PRIMARY KEY, AUTO_INCREMENT         | Unique tag ID             |
| tag_name    | VARCHAR(100) | NOT NULL, UNIQUE                    | Tag name                  |
| description | TEXT         | NULL                                | Tag description           |
| created_at  | TIMESTAMP    | DEFAULT CURRENT_TIMESTAMP           | Record creation timestamp |
| updated_at  | TIMESTAMP    | DEFAULT CURRENT_TIMESTAMP ON UPDATE | Last update timestamp     |

**Indexes**:

- PRIMARY KEY (id)
- UNIQUE (tag_name)
- INDEX (tag_name) - For autocomplete

**Relationships**:

- Referenced by: correspondence_tags

---

### 3.7 correspondence_tags

**Purpose**: Junction table linking correspondences to tags (M:N)

| Column Name       | Data Type | Constraints     | Description                  |
| ----------------- | --------- | --------------- | ---------------------------- |
| correspondence_id | INT       | PRIMARY KEY, FK | Reference to correspondences |
| tag_id            | INT       | PRIMARY KEY, FK | Reference to tags            |

**Indexes**:

- PRIMARY KEY (correspondence_id, tag_id)
- FOREIGN KEY (correspondence_id) REFERENCES correspondences(id) ON DELETE CASCADE
- FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
- INDEX (tag_id)

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

**Business Rules**:

- Allows tracing document relationships
- Bi-directional references should be created as separate records

### 3.9 ตาราง correspondence_routing_templates

**Purpose**: เก็บข้อมูลแม่แบบ (Template) ของสายงานการส่งต่อเอกสารเพื่อขออนุมัติ ทำให้ไม่ต้องกำหนดขั้นตอนซ้ำทุกครั้ง สามารถสร้างเป็นแม่แบบทั่วไป หรือเฉพาะสำหรับโครงการใดโครงการหนึ่งได้

| Column Name     | Data Type    | Constraints                                                     | Description                                                                                |
| --------------- | ------------ | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| id              | INT          | PRIMARY KEY, AUTO_INCREMENT                                     | ID หลัก (Primary Key) ของแม่แบบ รันค่าอัตโนมัติ                                                   |
| template_name   | VARCHAR(255) | NOT NULL                                                        | ชื่อของแม่แบบ เช่น "เสนอโครงการ", "ขออนุมัติจัดซื้อ"                                                 |
| description     | TEXT         | NULL                                                            | คำอธิบายรายละเอียดเกี่ยวกับแม่แบบนี้                                                                |
| project_id      | INT          | NULL                                                            | ID ของโครงการที่แม่แบบนี้สังกัดอยู่ (ถ้ามี) **ค่า NULL หมายถึง** เป็น "แม่แบบทั่วไป" ที่สามารถใช้กับทุกโครงการได้ |
| created_at      | TIMESTAMP    | NOT NULL, DEFAULT CURRENT_TIMESTAMP                             | วันที่และเวลาที่สร้างแม่แบบนี้                                                                      |
| updated_at      | TIMESTAMP    | NOT NULL,`DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP | วันที่และเวลาที่แก้ไขข้อมูลในแม่แบบนี้ล่าสุด                                                            |
| is_active       | BOOLEAN      | DEFAULT TRUE                                                    | สถานะใช้งาน                                                                                 |
| workflow_config | JSON         | NULL                                                            | เก็บ State Machine Configuration หรือ Rules เพิ่มเติมที่ซับซ้อนกว่า Column ปกติ                       |

**Indexes**:

- ux_routing_template_name_project (template_name, project_id): ดัชนีแบบ UNIQUE ป้องกันการมีชื่อแม่แบบซ้ำกันในแต่ละโครงการ หรือในส่วนของแม่แบบทั่วไป (ที่ project_id เป็น NULL)

**ความสัมพันธ์ Foreign Key:**

- fk_crt_project: อ้างอิงไปยัง projects(id)
- ON DELETE CASCAD`: ถ้าโครงการ (projects) ถูกลบ แม่แบบที่เกี่ยวข้องกับโครงการนั้นๆ จะถูกลบไปด้วยทั้งหมด

---

### 3.10 ตาราง correspondence_routing_template_steps

**Purpose**: เก็บรายละเอียดของแต่ละขั้นตอน (Steps) ภายในแม่แบบสายงาน (correspondence_routing_templates) กำหนดว่าจะส่งไปที่องค์กรไหน ลำดับเป็นเท่าไร และเพื่อวัตถุประสงค์อะไร

| Column Name        | Data Type | Constraints                 | Description                                                                                                                  |
| :----------------- | --------- | --------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| id                 | INT       | PRIMARY KEY, AUTO_INCREMENT | ID หลักของขั้นตอน                                                                                                               |
| template_id        | INT       | NOT NULL                    | ID ของแม่แบบที่ขั้นตอนนี้สังกัดอยู่                                                                                                     |
| sequence           | INT       | NOT NULL                    | ลำดับของขั้นตอน (1, 2, 3, ...)                                                                                                   |
| to_organization_id | INT       | NOT NULL                    | ID ขององค์กรที่เป็นผู้รับในขั้นตอนนี้                                                                                                   |
| step_purpose       | ENUM      | NOT NULL,DEFAULT FOR_REVIEW | วัตถุประสงค์ของการส่งต่อในขั้นตอนนี้ **ค่าที่เป็นไปได้:** [FOR_APPROVAL: เพื่ออนุมัติ, FOR_REVIEW: เพื่อตรวจสอบ/พิจารณา, FOR_INFORMATION: เพื่อทราบ] |
| expected_days      | INT       | NULL                        | วันที่คาดหวัง                                                                                                                    |

**Indexes**:

- ux_cor_template_sequence (template_id, sequence): ดัชนีแบบ UNIQUE ป้องกันการมีลำดับขั้นตอนซ้ำกันภายในแม่แบบเดียวกัน

**ความสัมพันธ์ Foreign Key:**

- fk_cwts_template: อ้างอิงไปยัง correspondence_routing_templates(id)
- ON DELETE CASCADE: ถ้าแม่แบบถูกลบ ขั้นตอนทั้งหมดภายในแม่แบบนั้นจะถูกลบไปด้วย
- fk_cwts_org: อ้างอิงไปยัง organizations(id)
- ON DELETE CASCADE: ถ้าองค์กรถูกลบ ขั้นตอนที่ชี้ไปยังองค์กรนั้นจะถูกลบ

---

### 3.11 ตาราง correspondence_routings

**Purpose**: เป็นตารางที่เก็บข้อมูลการส่งต่อเอกสารจริง (Instance/Run-time) ติดตามประวัติการเคลื่อนย้ายของแต่ละเอกสาร ว่าผ่านใครมาบ้าง อยู่ที่ใคร และสถานะปัจจุบันคืออะไร

| Column Name          | Data Type | Constraints                         | Description                                                                                                                                              |
| -------------------- | --------- | ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| id                   | INT       | PRIMARY KEY, AUTO_INCREMENT         | ID หลักของรายการส่งต่อ                                                                                                                                      |
| correspondence_id    | INT       | NOT NUL                             | ID ของเอกสาร (FK ไปยัง correspondence_revisions)                                                                                                          |
| template_id          | INT       | NULL                                | ID ของแม่แบบที่ใช้สร้างสายงานนี้ (เก็บไว้เป็นข้อมูลอ้างอิง)                                                                                                            |
| sequence             | INT       | NOT NULL                            | ลำดับของขั้นตอนการส่งต่อจริง                                                                                                                                    |
| from_organization_id | INT       | NOT NULL                            | ID ขององค์กรผู้ส่ง                                                                                                                                           |
| to_organization_id   | INT       | NOT NULL                            | ID ขององค์กรผู้รับ                                                                                                                                           |
| step_purpose         | ENUM      | NOT NULL, DEFAULT FOR_REVIEW        | วัตถุประสงค์ของการส่งต่อในขั้นตอนนี้จริง  **ค่าที่เป็นไปได้:** [FOR_APPROVAL: เพื่ออนุมัติ, FOR_REVIEW: เพื่อตรวจสอบ/พิจารณา, FOR_INFORMATION: เพื่อทราบ, FOR_ACTION: เพื่อดำเนินการ] |
| status               | ENUM      | NOT NULL, DEFAULT SENT              | [ACTIONED: ดำเนินการแล้ว, FORWARDED: ส่งต่อแล้ว, REPLIE: ตอบกลับแล้ว]                                                                                            |
| comments             | TEXT      | NULL                                | หมายเหตุหรือความคิดเห็นในการส่งต่อ                                                                                                                             |
| due_date             | DATETIME  | NULL                                | วันที่ครบกำหนดที่ต้องดำเนินการในขั้นตอนนี้                                                                                                                            |
| processed_by_user_id | INT       | NULL                                | ID ของผู้ใช้ที่ดำเนินการในขั้นตอนนี้จริงๆ                                                                                                                            |
| processed_at         | TIMESTAMP | NULL                                | เวลาที่ผู้ใช้ดำเนินการเสร็จสิ้น                                                                                                                                    |
| created_at           | TIMESTAMP | NOT NULL, DEFAULT CURRENT_TIMESTAMP | เวลาที่สร้างรายการส่งต่อนี้                                                                                                                                     |
| state_context        | JSON      | NULL                                | เก็บข้อมูล Context ของ Workflow ณ ขณะนั้น (Snapshot)                                                                                                          |

**Indexes**:

- ux_cor_routing_sequence (correspondence_id, sequence): ดัชนีแบบ UNIQUE ทำให้มั่นใจได้ว่าแต่ละเอกสารจะมีขั้นตอนการส่งต่อตามลำดับได้เพียงชุดเดียว

**ความสัมพันธ์ Foreign Key:**

- fk_crs_correspondence: อ้างอิงไปยัง correspondence_revisions(correspondence_id)
- ON DELETE CASCADE`: ถ้าเอกสาร (revision) ถูกลบ ประวัติการส่งต่อทั้งหมดจะถูกลบไปด้วย
- fk_crs_template: อ้างอิงไปยัง correspondence_routing_templates(id)
- ON DELETE SET NULL: ถ้าแม่แบบถูกลบ ค่า template_id ในตารางนี้จะถูกเปลี่ยนเป็น NULL เพื่อรักษาประวัติการส่งต่อไว้
- fk_crs_from_org: อ้างอิงไปยัง organizations(id)
- ON DELETE CASCADE: ถ้าองค์กรผู้ส่งถูกลบ รายการส่งต่อนี้จะถูกลบ
- fk_crs_to_org: อ้างอิงไปยัง organizations(id)
- ON DELETE CASCADE: ถ้าองค์กรผู้รับถูกลบ รายการส่งต่อนี้จะถูกลบ
- fk_crs_processed_by_user: อ้างอิงไปยัง users(user_id)
- ON DELETE SET NULL: ถ้าผู้ใช้ถูกลบ ค่า processed_by_user_id จะถูกเปลี่ยนเป็น NULL เพื่อรักษาประวัติการดำเนินการไว้

---

### 3.12 ตาราง correspondence_status_transitions

**Purpose**: ตารางนี้ใช้กำหนดกฎ (State Machine) ว่าสถานะใดสามารถเปลี่ยนไปเป็นสถานะใดได้บ้าง โดยขึ้นอยู่กับประเภทของหนังสือ เพื่อควบคุมการไหลของสถานะให้ถูกต้องตามข้อบังคับ

| Column Name    | Data Type | Constraints | Description                                     |
| -------------- | --------- | ----------- | ----------------------------------------------- |
| type_id        | INT       | PRIMARY KEY | ID ของประเภทหนังสือ (เช่น หนังสือภายใน, หนังสือภายนอก) |
| from_status_id | INT       | PRIMARY KEY | ID ของสถานะต้นทาง (เช่น ร่าง)                      |
| to_status_id   | INT       | PRIMARY KEY | ID ของสถานะปลายทาง (เช่น รออนุมัติ)                 |

**คีย์หลัก (Primary Key):**

- (type_id, from_status_id, to_status_id)`: คีย์หลักแบบประกอบ ทำให้แน่ใจว่าแต่ละประเภทหนังสือ การเปลี่ยนจากสถานะหนึ่งไปอีกสถานะหนึ่งจะซ้ำกันไม่ได้

**ความสัมพันธ์ Foreign Key:**

- fk_cst_type : อ้างอิงไปยัง correspondence_types(id)
- fk_cst_from : อ้างอิงไปยัง correspondence_status(id)
- fk_cst_to : อ้างอิงไปยัง correspondence_status(id)
- ไม่มีการกำหนด ON DELETE จึงเป็นค่าเริ่มต้น RESTRICT หมายความว่า จะลบประเภทหนังสือหรือสถานะไม่ได้ ถ้ายังมีการใช้งานอยู่ในตารางนี้

---

## **4. 📐 approval: RFA Tables (เอกสารขออนุมัติ, Workflows)**

### 4.1 rfa_types

**Purpose**: Master table for RFA (Request for Approval) types

| Column Name | Data Type    | Constraints                 | Description                     |
| ----------- | ------------ | --------------------------- | ------------------------------- |
| id          | INT          | PRIMARY KEY, AUTO_INCREMENT | Unique identifier               |
| type_code   | VARCHAR(20)  | NOT NULL, UNIQUE            | Type code (DWG, DOC, MAT, etc.) |
| type_name   | VARCHAR(100) | NOT NULL                    | Full type name                  |
| description | TEXT         | NULL                        | Type description                |
| sort_order  | INT          | DEFAULT 0                   | Display order                   |
| is_active   | TINYINT(1)   | DEFAULT 1                   | Active status                   |

**Indexes**:

- PRIMARY KEY (id)
- UNIQUE (type_code)
- INDEX (is_active)
- INDEX (sort_order)

**Relationships**:

- Referenced by: rfas

**Seed Data**: 11 RFA types including Shop Drawing (DWG), Document (DOC), Specification (SPC), Calculation (CAL), Test Report (TRP), Survey Report (SRY), QA/QC Document, Method Statement (MES), Material (MAT), As-Built (ASB), Other (OTH)

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

**Seed Data**: 7 status codes

- DFT: Draft
- FAP: For Approve
- FRE: For Review
- FCO: For Construction
- ASB: AS-Built
- OBS: Obsolete
- CC: Canceled

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

**Seed Data**: 8 approval codes

- 1A: Approved by Authority
- 1C: Approved by CSC
- 1N: Approved As Note
- 1R: Approved with Remarks
- 3C: Consultant Comments
- 3R: Revise and Resubmit
- 4X: Reject
- 5N: No Further Action

---

### 4.4 rfas

**Purpose**: Master table for RFA documents (non-revisioned data)

| Column Name | Data Type | Constraints                 | Description                 |
| ----------- | --------- | --------------------------- | --------------------------- |
| id          | INT       | PRIMARY KEY, AUTO_INCREMENT | Master RFA ID               |
| rfa_type_id | INT       | NOT NULL, FK                | Reference to rfa_types      |
| created_at  | DATETIME  | DEFAULT CURRENT_TIMESTAMP   | Record creation timestamp   |
| created_by  | INT       | NULL, FK                    | User who created the record |
| deleted_at  | DATETIME  | NULL                        | Soft delete timestamp       |

**Indexes**:

- PRIMARY KEY (id)
- FOREIGN KEY (rfa_type_id) REFERENCES rfa_types(id)
- FOREIGN KEY (created_by) REFERENCES users(user_id) ON DELETE SET NULL
- INDEX (rfa_type_id)
- INDEX (deleted_at)

**Relationships**:

- Parent: rfa_types, users
- Children: rfa_revisions

**Business Rules**:

- One RFA can have multiple revisions
- Soft delete preserves history

---

### 4.5 rfa_revisions

**Purpose**: Child table storing revision history of RFAs (1:N)

| Column Name         | Data Type    | Constraints                 | Description                                    |
| ------------------- | ------------ | --------------------------- | ---------------------------------------------- |
| id                  | INT          | PRIMARY KEY, AUTO_INCREMENT | Unique revision ID                             |
| correspondence_id   | INT          | NOT NULL, FK                | Link to correspondence (RFA as correspondence) |
| rfa_id              | INT          | NOT NULL, FK                | Master RFA ID                                  |
| revision_number     | INT          | NOT NULL                    | Revision sequence (0, 1, 2...)                 |
| revision_label      | VARCHAR(10)  | NULL                        | Display revision (A, B, 1.1...)                |
| is_current          | BOOLEAN      | DEFAULT FALSE               | Current revision flag                          |
| rfa_status_code_id  | INT          | NOT NULL, FK                | Current RFA status                             |
| rfa_approve_code_id | INT          | NULL, FK                    | Approval result code                           |
| title               | VARCHAR(255) | NOT NULL                    | RFA title                                      |
| document_date       | DATE         | NULL                        | Document date                                  |
| issued_date         | DATE         | NULL                        | Issue date for approval                        |
| received_date       | DATETIME     | NULL                        | Received date                                  |
| approved_date       | DATE         | NULL                        | Approval date                                  |
| description         | TEXT         | NULL                        | Revision description                           |
| created_at          | DATETIME     | DEFAULT CURRENT_TIMESTAMP   | Revision creation timestamp                    |
| created_by          | INT          | NULL, FK                    | User who created revision                      |
| updated_by          | INT          | NULL, FK                    | User who last updated                          |

**Indexes**:

- PRIMARY KEY (id)
- FOREIGN KEY (correspondence_id) REFERENCES correspondences(id) ON DELETE CASCADE
- FOREIGN KEY (rfa_id) REFERENCES rfas(id) ON DELETE CASCADE
- FOREIGN KEY (rfa_status_code_id) REFERENCES rfa_status_codes(id)
- FOREIGN KEY (rfa_approve_code_id) REFERENCES rfa_approve_codes(id) ON DELETE SET NULL
- FOREIGN KEY (created_by) REFERENCES users(user_id) ON DELETE SET NULL
- FOREIGN KEY (updated_by) REFERENCES users(user_id) ON DELETE SET NULL
- UNIQUE KEY (rfa_id, revision_number)
- UNIQUE KEY (rfa_id, is_current)
- INDEX (rfa_status_code_id)
- INDEX (rfa_approve_code_id)
- INDEX (is_current)

**Relationships**:

- Parent: correspondences, rfas, rfa_status_codes, rfa_approve_codes, users
- Children: rfa_items, rfa_workflows

**Business Rules**:

- RFA is a specialized type of correspondence
- Only one revision can be current per RFA
- Links to shop drawings through rfa_items

---

### 4.6 rfa_items

**Purpose**: Junction table linking RFA revisions to shop drawing revisions (M:N)

| Column Name              | Data Type | Constraints     | Description                    |
| ------------------------ | --------- | --------------- | ------------------------------ |
| rfarev_correspondence_id | INT       | PRIMARY KEY, FK | RFA revision correspondence ID |
| shop_drawing_revision_id | INT       | PRIMARY KEY, FK | Shop drawing revision ID       |

**Indexes**:

- PRIMARY KEY (rfarev_correspondence_id, shop_drawing_revision_id)
- FOREIGN KEY (rfarev_correspondence_id) REFERENCES rfa_revisions(correspondence_id) ON DELETE CASCADE
- FOREIGN KEY (shop_drawing_revision_id) REFERENCES shop_drawing_revisions(id) ON DELETE CASCADE
- INDEX (shop_drawing_revision_id)

**Relationships**:

- Parent: rfa_revisions, shop_drawing_revisions

**Business Rules**:

- Used primarily for RFA type = 'DWG' (Shop Drawing)
- One RFA can contain multiple shop drawings
- One shop drawing can be referenced by multiple RFAs

---

### 4.7 rfa_workflow_templates

**Purpose**: Master table for RFA approval workflow templates

| Column Name     | Data Type    | Constraints                         | Description                                                          |
| --------------- | ------------ | ----------------------------------- | -------------------------------------------------------------------- |
| id              | INT          | PRIMARY KEY, AUTO_INCREMENT         | Unique template ID                                                   |
| template_name   | VARCHAR(100) | NOT NULL                            | Template name                                                        |
| description     | TEXT         | NULL                                | Template description                                                 |
| is_active       | TINYINT(1)   | DEFAULT 1                           | Active status                                                        |
| created_at      | TIMESTAMP    | DEFAULT CURRENT_TIMESTAMP           | Record creation timestamp                                            |
| updated_at      | TIMESTAMP    | DEFAULT CURRENT_TIMESTAMP ON UPDATE | Last update timestamp                                                |
| workflow_config | JSON         | NULL                                | เก็บ State Machine Configuration หรือ Rules เพิ่มเติมที่ซับซ้อนกว่า Column ปกติ |

**Indexes**:

- PRIMARY KEY (id)
- INDEX (is_active)
- INDEX (template_name)

**Relationships**:

- Children: rfa_workflow_template_steps

**Business Rules**:

- Defines reusable approval workflows for RFAs
- Can be assigned to specific RFA types or organizations

---

### 4.8 rfa_workflow_template_steps

**Purpose**: Child table defining steps in workflow templates

| Column Name     | Data Type | Constraints                 | Description                               |
| --------------- | --------- | --------------------------- | ----------------------------------------- |
| id              | INT       | PRIMARY KEY, AUTO_INCREMENT | Unique step ID                            |
| template_id     | INT       | NOT NULL, FK                | Reference to workflow template            |
| step_number     | INT       | NOT NULL                    | Step sequence order                       |
| organization_id | INT       | NOT NULL, FK                | Organization responsible for step         |
| role_id         | INT       | NULL, FK                    | Required role for this step               |
| action_type     | ENUM      | NULL                        | Action type: REVIEW, APPROVE, ACKNOWLEDGE |
| duration_days   | INT       | NULL                        | Expected duration in days                 |
| is_optional     | BOOLEAN   | DEFAULT FALSE               | Optional step flag                        |

**Indexes**:

- PRIMARY KEY (id)
- FOREIGN KEY (template_id) REFERENCES rfa_workflow_templates(id) ON DELETE CASCADE
- FOREIGN KEY (organization_id) REFERENCES organizations(id)
- FOREIGN KEY (role_id) REFERENCES roles(role_id)
- INDEX (template_id, step_number)
- INDEX (organization_id)

**Relationships**:

- Parent: rfa_workflow_templates, organizations, roles

**Business Rules**:

- Steps are executed in step_number order
- Optional steps can be skipped
- Duration used for deadline calculation

---

### 4.9 rfa_workflows

**Purpose**: Transaction log table tracking actual RFA approval workflow execution

| Column Name     | Data Type | Constraints                         | Description                                       |
| --------------- | --------- | ----------------------------------- | ------------------------------------------------- |
| id              | INT       | PRIMARY KEY, AUTO_INCREMENT         | Unique workflow log ID                            |
| rfa_revision_id | INT       | NOT NULL, FK                        | Reference to RFA revision                         |
| step_number     | INT       | NOT NULL                            | Current step number                               |
| organization_id | INT       | NOT NULL, FK                        | Organization responsible                          |
| assigned_to     | INT       | NULL, FK                            | Assigned user ID                                  |
| action_type     | ENUM      | NULL                                | Action type: REVIEW, APPROVE, ACKNOWLEDGE         |
| status          | ENUM      | NULL                                | Status: PENDING, IN_PROGRESS, COMPLETED, REJECTED |
| comments        | TEXT      | NULL                                | Comments/remarks                                  |
| completed_at    | DATETIME  | NULL                                | Completion timestamp                              |
| created_at      | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP           | Record creation timestamp                         |
| updated_at      | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP ON UPDATE | Last update timestamp                             |
| state_context   | JSON*     | NULL                                | เก็บข้อมูล Context ของ Workflow ณ ขณะนั้น (Snapshot)   |

**Indexes**:

- PRIMARY KEY (id)
- FOREIGN KEY (rfa_revision_id) REFERENCES rfa_revisions(id) ON DELETE CASCADE
- FOREIGN KEY (organization_id) REFERENCES organizations(id)
- FOREIGN KEY (assigned_to) REFERENCES users(user_id)
- INDEX (rfa_revision_id, step_number)
- INDEX (assigned_to, status)
- INDEX (status)

**Relationships**:

- Parent: rfa_revisions, organizations, users

**Business Rules**:

- Records actual workflow execution history
- Tracks who did what and when
- Multiple records per RFA revision (one per step)
- Status changes tracked via updated_at

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

### 5.4 contract_drawing_subcat_cat_maps

**Purpose**: Junction table mapping sub-categories to main categories (M:N)

| Column Name | Data Type | Constraints     | Description                |
| ----------- | --------- | --------------- | -------------------------- |
| project_id  | INT       | PRIMARY KEY, FK | Reference to projects      |
| sub_cat_id  | INT       | PRIMARY KEY, FK | Reference to sub-category  |
| cat_id      | INT       | PRIMARY KEY, FK | Reference to main category |

**Indexes**:

- PRIMARY KEY (project_id, sub_cat_id, cat_id)
- FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
- FOREIGN KEY (sub_cat_id) REFERENCES contract_drawing_sub_cats(id) ON DELETE CASCADE
- FOREIGN KEY (cat_id) REFERENCES contract_drawing_cats(id) ON DELETE CASCADE
- INDEX (sub_cat_id)
- INDEX (cat_id)

**Relationships**:

- Parent: projects, contract_drawing_sub_cats, contract_drawing_cats

**Business Rules**:

- Allows flexible categorization
- One sub-category can belong to multiple main categories
- All three fields required for uniqueness

---

### 5.5 contract_drawings

**Purpose**: Master table for contract drawings (from contract specifications)

| Column Name | Data Type    | Constraints                         | Description               |
| ----------- | ------------ | ----------------------------------- | ------------------------- |
| id          | INT          | PRIMARY KEY, AUTO_INCREMENT         | Unique drawing ID         |
| project_id  | INT          | NOT NULL, FK                        | Reference to projects     |
| condwg_no   | VARCHAR(255) | NOT NULL                            | Contract drawing number   |
| title       | VARCHAR(255) | NOT NULL                            | Drawing title             |
| sub_cat_id  | INT          | NULL, FK                            | Reference to sub-category |
| volume_id   | INT          | NULL, FK                            | Reference to volume       |
| created_at  | TIMESTAMP    | DEFAULT CURRENT_TIMESTAMP           | Record creation timestamp |
| updated_at  | TIMESTAMP    | DEFAULT CURRENT_TIMESTAMP ON UPDATE | Last update timestamp     |
| deleted_at  | DATETIME     | NULL                                | Soft delete timestamp     |
| updated_by  | INT          | NULL, FK                            | User who last updated     |

**Indexes**:

- PRIMARY KEY (id)
- FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
- FOREIGN KEY (sub_cat_id) REFERENCES contract_drawing_sub_cats(id) ON DELETE RESTRICT
- FOREIGN KEY (volume_id) REFERENCES contract_drawing_volumes(id) ON DELETE RESTRICT
- FOREIGN KEY (updated_by) REFERENCES users(user_id)
- UNIQUE KEY (project_id, condwg_no)
- INDEX (sub_cat_id)
- INDEX (volume_id)
- INDEX (deleted_at)

**Relationships**:

- Parent: projects, contract_drawing_sub_cats, contract_drawing_volumes, users
- Referenced by: shop_drawing_revision_contract_refs, contract_drawing_attachments

**Business Rules**:

- Drawing numbers must be unique within a project
- Represents baseline/contract drawings
- Referenced by shop drawings for compliance tracking
- Soft delete preserves history

---

### 5.6 shop_drawing_main_categories

**Purpose**: Master table for shop drawing main categories (discipline-level)

| Column Name        | Data Type    | Constraints                         | Description                          |
| ------------------ | ------------ | ----------------------------------- | ------------------------------------ |
| id                 | INT          | PRIMARY KEY, AUTO_INCREMENT         | Unique category ID                   |
| main_category_code | VARCHAR(50)  | NOT NULL, UNIQUE                    | Category code (ARCH, STR, MEP, etc.) |
| main_category_name | VARCHAR(255) | NOT NULL                            | Category name                        |
| description        | TEXT         | NULL                                | Category description                 |
| sort_order         | INT          | DEFAULT 0                           | Display order                        |
| is_active          | TINYINT(1)   | DEFAULT 1                           | Active status                        |
| created_at         | TIMESTAMP    | DEFAULT CURRENT_TIMESTAMP           | Record creation timestamp            |
| updated_at         | TIMESTAMP    | DEFAULT CURRENT_TIMESTAMP ON UPDATE | Last update timestamp                |

**Indexes**:

- PRIMARY KEY (id)
- UNIQUE (main_category_code)
- INDEX (is_active)
- INDEX (sort_order)

**Relationships**:

- Referenced by: shop_drawing_sub_categories, shop_drawings

**Business Rules**:

- Global categories (not project-specific)
- Typically represents engineering disciplines

---

### 5.7 shop_drawing_sub_categories

**Purpose**: Master table for shop drawing sub-categories (component-level)

| Column Name       | Data Type    | Constraints                         | Description                                     |
| ----------------- | ------------ | ----------------------------------- | ----------------------------------------------- |
| id                | INT          | PRIMARY KEY, AUTO_INCREMENT         | Unique sub-category ID                          |
| sub_category_code | VARCHAR(50)  | NOT NULL, UNIQUE                    | Sub-category code (STR-COLUMN, ARCH-DOOR, etc.) |
| sub_category_name | VARCHAR(255) | NOT NULL                            | Sub-category name                               |
| main_category_id  | INT          | NOT NULL, FK                        | Reference to main category                      |
| description       | TEXT         | NULL                                | Sub-category description                        |
| sort_order        | INT          | DEFAULT 0                           | Display order                                   |
| is_active         | TINYINT(1)   | DEFAULT 1                           | Active status                                   |
| created_at        | TIMESTAMP    | DEFAULT CURRENT_TIMESTAMP           | Record creation timestamp                       |
| updated_at        | TIMESTAMP    | DEFAULT CURRENT_TIMESTAMP ON UPDATE | Last update timestamp                           |

**Indexes**:

- PRIMARY KEY (id)
- UNIQUE (sub_category_code)
- FOREIGN KEY (main_category_id) REFERENCES shop_drawing_main_categories(id)
- INDEX (main_category_id)
- INDEX (is_active)
- INDEX (sort_order)

**Relationships**:

- Parent: shop_drawing_main_categories
- Referenced by: shop_drawings

**Business Rules**:

- Global sub-categories (not project-specific)
- Hierarchical under main categories
- Represents specific drawing types or components

---

### 5.8 shop_drawings

**Purpose**: Master table for shop drawings (contractor-submitted)

| Column Name      | Data Type    | Constraints                         | Description                |
| ---------------- | ------------ | ----------------------------------- | -------------------------- |
| id               | INT          | PRIMARY KEY, AUTO_INCREMENT         | Unique drawing ID          |
| project_id       | INT          | NOT NULL, FK                        | Reference to projects      |
| drawing_number   | VARCHAR(100) | NOT NULL, UNIQUE                    | Shop drawing number        |
| title            | VARCHAR(500) | NOT NULL                            | Drawing title              |
| main_category_id | INT          | NOT NULL, FK                        | Reference to main category |
| sub_category_id  | INT          | NOT NULL, FK                        | Reference to sub-category  |
| created_at       | TIMESTAMP    | DEFAULT CURRENT_TIMESTAMP           | Record creation timestamp  |
| updated_at       | TIMESTAMP    | DEFAULT CURRENT_TIMESTAMP ON UPDATE | Last update timestamp      |
| deleted_at       | DATETIME     | NULL                                | Soft delete timestamp      |
| updated_by       | INT          | NULL, FK                            | User who last updated      |

**Indexes**:

- PRIMARY KEY (id)
- UNIQUE (drawing_number)
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

---

### 5.9 shop_drawing_revisions

**Purpose**: Child table storing revision history of shop drawings (1:N)

| Column Name     | Data Type   | Constraints                 | Description                    |
| --------------- | ----------- | --------------------------- | ------------------------------ |
| id              | INT         | PRIMARY KEY, AUTO_INCREMENT | Unique revision ID             |
| shop_drawing_id | INT         | NOT NULL, FK                | Master shop drawing ID         |
| revision_number | INT         | NOT NULL                    | Revision sequence (0, 1, 2...) |
| revision_label  | VARCHAR(10) | NULL                        | Display revision (A, B, C...)  |
| revision_date   | DATE        | NULL                        | Revision date                  |
| description     | TEXT        | NULL                        | Revision description/changes   |
| created_at      | TIMESTAMP   | DEFAULT CURRENT_TIMESTAMP   | Revision creation timestamp    |

**Indexes**:

- PRIMARY KEY (id)
- FOREIGN KEY (shop_drawing_id) REFERENCES shop_drawings(id) ON DELETE CASCADE
- UNIQUE KEY (shop_drawing_id, revision_number)
- INDEX (revision_date)

**Relationships**:

- Parent: shop_drawings
- Referenced by: rfa_items, shop_drawing_revision_contract_refs, shop_drawing_revision_attachments

**Business Rules**:

- Revision numbers are sequential starting from 0
- Each revision can reference multiple contract drawings
- Each revision can have multiple file attachments
- Linked to RFAs for approval tracking

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

### 6.3 circulation_templates

**Purpose**: Master table for circulation workflow templates

| Column Name     | Data Type    | Constraints                         | Description                 |
| --------------- | ------------ | ----------------------------------- | --------------------------- |
| id              | INT          | PRIMARY KEY, AUTO_INCREMENT         | Unique template ID          |
| template_name   | VARCHAR(100) | NOT NULL                            | Template name               |
| description     | TEXT         | NULL                                | Template description        |
| organization_id | INT          | NOT NULL, FK                        | Template owner organization |
| is_active       | TINYINT(1)   | DEFAULT 1                           | Active status               |
| created_at      | TIMESTAMP    | DEFAULT CURRENT_TIMESTAMP           | Record creation timestamp   |
| updated_at      | TIMESTAMP    | DEFAULT CURRENT_TIMESTAMP ON UPDATE | Last update timestamp       |

**Indexes**:

- PRIMARY KEY (id)
- FOREIGN KEY (organization_id) REFERENCES organizations(id)
- INDEX (organization_id)
- INDEX (is_active)

**Relationships**:

- Parent: organizations
- Children: circulation_template_assignees

**Business Rules**:

- Organization-specific templates
- Defines reusable routing workflows

---

### 6.4 circulation_template_assignees

**Purpose**: Child table defining steps in circulation templates

| Column Name     | Data Type | Constraints                 | Description                       |
| --------------- | --------- | --------------------------- | --------------------------------- |
| id              | INT       | PRIMARY KEY, AUTO_INCREMENT | Unique step ID                    |
| template_id     | INT       | NOT NULL, FK                | Reference to template             |
| step_number     | INT       | NOT NULL                    | Step sequence order               |
| organization_id | INT       | NOT NULL, FK                | Organization responsible for step |
| role_id         | INT       | NULL, FK                    | Required role for this step       |
| duration_days   | INT       | NULL                        | Expected duration in days         |
| is_optional     | BOOLEAN   | DEFAULT FALSE               | Optional step flag                |

**Indexes**:

- PRIMARY KEY (id)
- FOREIGN KEY (template_id) REFERENCES circulation_templates(id) ON DELETE CASCADE
- FOREIGN KEY (organization_id) REFERENCES organizations(id)
- FOREIGN KEY (role_id) REFERENCES roles(role_id)
- INDEX (template_id, step_number)
- INDEX (organization_id)

**Relationships**:

- Parent: circulation_templates, organizations, roles

**Business Rules**:

- Steps executed in step_number order
- Optional steps can be skipped
- Duration used for deadline calculation

---

### 6.5 circulation_routings

**Purpose**: Transaction log table tracking actual circulation routing execution

| Column Name     | Data Type | Constraints                         | Description                                       |
| --------------- | --------- | ----------------------------------- | ------------------------------------------------- |
| id              | INT       | PRIMARY KEY, AUTO_INCREMENT         | Unique routing log ID                             |
| circulation_id  | INT       | NOT NULL, FK                        | Reference to circulation                          |
| step_number     | INT       | NOT NULL                            | Current step number                               |
| organization_id | INT       | NOT NULL, FK                        | Organization responsible                          |
| assigned_to     | INT       | NULL, FK                            | Assigned user ID                                  |
| status          | ENUM      | NULL                                | Status: PENDING, IN_PROGRESS, COMPLETED, REJECTED |
| comments        | TEXT      | NULL                                | Comments/remarks                                  |
| completed_at    | DATETIME  | NULL                                | Completion timestamp                              |
| created_at      | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP           | Record creation timestamp                         |
| updated_at      | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP ON UPDATE | Last update timestamp                             |

**Indexes**:

- PRIMARY KEY (id)
- FOREIGN KEY (circulation_id) REFERENCES circulations(id) ON DELETE CASCADE
- FOREIGN KEY (organization_id) REFERENCES organizations(id)
- FOREIGN KEY (assigned_to) REFERENCES users(user_id)
- INDEX (circulation_id, step_number)
- INDEX (assigned_to, status)
- INDEX (status)

**Relationships**:

- Parent: circulations, organizations, users

**Business Rules**:

- Records actual routing history
- Multiple records per circulation (one per step)
- Tracks who reviewed/approved and when
- Used in v_user_tasks view for pending items

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

| Column Name         | Data Type    | Constraints                 | Description                                                    |
| ------------------- | ------------ | --------------------------- | -------------------------------------------------------------- |
| id                  | INT          | PRIMARY KEY, AUTO_INCREMENT | Unique attachment ID                                           |
| original_filename   | VARCHAR(255) | NOT NULL                    | Original filename from upload                                  |
| stored_filename     | VARCHAR(255) | NOT NULL                    | System-generated unique filename                               |
| file_path           | VARCHAR(500) | NOT NULL                    | Full file path on server (/share/dms-data/)                    |
| mime_type           | VARCHAR(100) | NOT NULL                    | MIME type (application/pdf, image/jpeg, etc.)                  |
| file_size           | INT          | NOT NULL                    | File size in bytes                                             |
| uploaded_by_user_id | INT          | NOT NULL, FK                | User who uploaded file                                         |
| created_at          | TIMESTAMP    | DEFAULT CURRENT_TIMESTAMP   | Upload timestamp                                               |
| is_temporary        | BOOLEAN      | DEFAULT TRUE                | ระบุว่าเป็นไฟล์ชั่วคราว (ยังไม่ได้ Commit)                              |
| temp_id*            | VARCHAR(100) | NULL                        | ID ชั่วคราวสำหรับอ้างอิงตอน Upload Phase 1 (อาจใช้ร่วมกับ id หรือแยกก็ได้) |
| expires_at          | DATETIME     | NULL                        | เวลาหมดอายุของไฟล์ Temp (เพื่อให้ Cron Job ลบออก)                   |
| checksum            | VARCHAR(64)  | NULL                        | SHA-256 Checksum สำหรับ Verify File Integrity [Req 3.9.3]        |

**Indexes**:

- PRIMARY KEY (id)
- FOREIGN KEY (uploaded_by_user_id) REFERENCES users(user_id) ON DELETE CASCADE
- INDEX (stored_filename)
- INDEX (mime_type)
- INDEX (uploaded_by_user_id)
- INDEX (created_at)

**Relationships**:

- Parent: users
- Referenced by: correspondence_attachments, circulation_attachments, shop_drawing_revision_attachments, contract_drawing_attachments

**Business Rules**:

- Central storage prevents file duplication
- Stored filename prevents naming conflicts
- File path points to QNAP NAS storage
- Original filename preserved for download
- One file record can be linked to multiple documents

---

### 8.2 correspondence_attachments

**Purpose**: Junction table linking correspondences to file attachments (M:N)

| Column Name       | Data Type | Constraints     | Description                  |
| ----------------- | --------- | --------------- | ---------------------------- |
| correspondence_id | INT       | PRIMARY KEY, FK | Reference to correspondences |
| attachment_id     | INT       | PRIMARY KEY, FK | Reference to attachments     |
| is_main_document  | BOOLEAN   | DEFAULT FALSE   | Main/primary document flag   |

**Indexes**:

- PRIMARY KEY (correspondence_id, attachment_id)
- FOREIGN KEY (correspondence_id) REFERENCES correspondences(id) ON DELETE CASCADE
- FOREIGN KEY (attachment_id) REFERENCES attachments(id) ON DELETE CASCADE
- INDEX (attachment_id)
- INDEX (is_main_document)

**Relationships**:

- Parent: correspondences, attachments

**Business Rules**:

- One correspondence can have multiple attachments
- One attachment can be linked to multiple correspondences
- is_main_document identifies primary file (typically PDF)

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

## **9. 🔢 Document Numbering Tables (การสร้างเลขที่เอกสาร)**

### 9.1 document_number_formats

**Purpose**: Master table defining document numbering templates per project and type

| Column Name            | Data Type    | Constraints                         | Description                                              |
| ---------------------- | ------------ | ----------------------------------- | -------------------------------------------------------- |
| id                     | INT          | PRIMARY KEY, AUTO_INCREMENT         | Unique format ID                                         |
| project_id             | INT          | NOT NULL, FK                        | Reference to projects                                    |
| correspondence_type_id | INT          | NOT NULL, FK                        | Reference to correspondence types                        |
| format_template        | VARCHAR(255) | NOT NULL                            | Template string (e.g., '{ORG_CODE}-{TYPE_CODE}-{SEQ:4}') |
| description            | TEXT         | NULL                                | Format description                                       |
| created_at             | TIMESTAMP    | DEFAULT CURRENT_TIMESTAMP           | Record creation timestamp                                |
| updated_at             | TIMESTAMP    | DEFAULT CURRENT_TIMESTAMP ON UPDATE | Last update timestamp                                    |

**Indexes**:

- PRIMARY KEY (id)
- FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
- FOREIGN KEY (correspondence_type_id) REFERENCES correspondence_types(id) ON DELETE CASCADE
- UNIQUE KEY (project_id, correspondence_type_id)
- INDEX (project_id)
- INDEX (correspondence_type_id)

**Relationships**:

- Parent: projects, correspondence_types

**Business Rules**:

- One format template per project per correspondence type combination
- Template placeholders: {ORG_CODE}, {TYPE_CODE}, {YEAR}, {SEQ:n} where n is zero-padding length
- Used by document numbering module to generate unique document numbers

---

### 9.2 document_number_counters

**Purpose**: Transaction table maintaining running sequence numbers for document numbering

| Column Name                | Data Type | Constraints     | Description                                     |
| -------------------------- | --------- | --------------- | ----------------------------------------------- |
| project_id                 | INT       | PRIMARY KEY, FK | Reference to projects                           |
| originator_organization_id | INT       | PRIMARY KEY, FK | Originating organization                        |
| correspondence_type_id     | INT       | PRIMARY KEY, FK | Reference to correspondence types               |
| current_year               | INT       | PRIMARY KEY     | Year (Buddhist calendar)                        |
| version                    | INT       | DEFAULT 0       | ใช้สำหรับ Optimistic Locking (ตรวจสอบค่าก่อน Update) |
| last_number                | INT       | DEFAULT 0       | Last assigned sequence number                   |


**Indexes**:

- PRIMARY KEY (project_id, originator_organization_id, correspondence_type_id, current_year)
- FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
- FOREIGN KEY (originator_organization_id) REFERENCES organizations(id) ON DELETE CASCADE
- FOREIGN KEY (correspondence_type_id) REFERENCES correspondence_types(id) ON DELETE CASCADE
- INDEX (project_id)
- INDEX (originator_organization_id)
- INDEX (correspondence_type_id)
- INDEX (current_year)

**Relationships**:

- Parent: projects, organizations, correspondence_types

**Business Rules**:

- Composite primary key ensures unique counters per project/organization/type/year
- Counter resets each year
- Thread-safe increments handled by stored procedure sp_get_next_document_number
- last_number tracks highest assigned number
- Used with document_number_formats to generate complete document numbers

---

## **10. ⚙️ System & Logs Tables (ระบบและ Log)**

### 10.1 audit_logs

**Purpose**: Comprehensive audit trail for all significant system actions

| Column Name      | Data Type                                 | Constraints                       | Description                                              |
| ---------------- | ----------------------------------------- | --------------------------------- | -------------------------------------------------------- |
| audit_id         | BIGINT                                    | PRIMARY KEY, AUTO_INCREMENT       | Unique audit log ID                                      |
| user_id          | INT                                       | NULL, FK                          | User who performed action                                |
| action           | VARCHAR(100)                              | NOT NULL                          | Action code (e.g., 'rfa.create', 'login.success')        |
| entity_type      | VARCHAR(50)                               | NULL                              | Entity/module affected (e.g., 'rfa', 'correspondence')   |
| entity_id        | VARCHAR(50)                               | NULL                              | Primary ID of affected record                            |
| details_json     | JSON                                      | NULL                              | Additional context/details in JSON format                |
| ip_address       | VARCHAR(45)                               | NULL                              | Client IP address (supports IPv6)                        |
| user_agent       | VARCHAR(255)                              | NULL                              | Browser user agent string                                |
| created_at       | TIMESTAMP                                 | DEFAULT CURRENT_TIMESTAMP         | Action timestamp                                         |
| v_ref_project_id | INT                                       | GENERATED ALWAYS AS (...) VIRTUAL | Virtual Column ดึง Project ID จาก JSON details เพื่อทำ Index |
| v_ref_type       | VARCHAR(50)                               | GENERATED ALWAYS AS (...) VIRTUAL | Virtual Column ดึง Type จาก JSON details                  |
| request_id       | VARCHAR(100)                              | NULL                              | Request ID/Trace ID เพื่อเชื่อมโยงกับ App Logs                |
| severity         | ENUM('INFO', 'WARN', 'ERROR', 'CRITICAL') | NULL                              | ระดับความรุนแรงของเหตุการณ์                                  |

**Indexes**:

- PRIMARY KEY (audit_id)
- FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE SET NULL
- INDEX (user_id)
- INDEX (action)
- INDEX (entity_type, entity_id)
- INDEX (created_at)
- INDEX (ip_address)
- INDEX (v_ref_project_id)
- INDEX (v_ref_type)

**Relationships**:

- Parent: users

**Business Rules**:

- Immutable records (no updates/deletes)
- Captures all CRUD operations on sensitive data
- Includes authentication events (login, logout, failed attempts)
- JSON details field for flexible data storage
- Retention policy: typically 7 years for compliance
- Used for security audits, compliance reporting, and troubleshooting

**Common Actions**:

- Authentication: login.success, login.failed, logout
- Documents: correspondence.create, correspondence.update, rfa.submit
- Users: user.create, user.deactivate, role.assign
- Workflow: rfa.approve, rfa.reject, circulation.complete

---

### 10.2 notifications

**Purpose**: User notification queue for email, LINE, and in-system alerts

| Column Name       | Data Type    | Constraints                 | Description                                      |
| ----------------- | ------------ | --------------------------- | ------------------------------------------------ |
| id                | INT          | PRIMARY KEY, AUTO_INCREMENT | Unique notification ID                           |
| user_id           | INT          | NOT NULL, FK                | Recipient user ID                                |
| title             | VARCHAR(255) | NOT NULL                    | Notification title/subject                       |
| message           | TEXT         | NOT NULL                    | Notification message body                        |
| notification_type | ENUM         | NOT NULL                    | Type: EMAIL, LINE, SYSTEM                        |
| is_read           | BOOLEAN      | DEFAULT FALSE               | Read status flag                                 |
| entity_type       | VARCHAR(50)  | NULL                        | Related entity type (e.g., 'rfa', 'circulation') |
| entity_id         | INT          | NULL                        | Related entity ID                                |
| created_at        | TIMESTAMP    | DEFAULT CURRENT_TIMESTAMP   | Notification creation timestamp                  |

**Indexes**:

- PRIMARY KEY (id)
- FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
- INDEX (user_id)
- INDEX (notification_type)
- INDEX (is_read)
- INDEX (entity_type, entity_id)
- INDEX (created_at)
- COMPOSITE INDEX (user_id, is_read, created_at) - For user notification listing

**Relationships**:

- Parent: users

**Business Rules**:

- EMAIL: Sent via SMTP to user's email address
- LINE: Sent via LINE Notify API to user's LINE ID
- SYSTEM: In-app notifications displayed in user interface
- Same notification can trigger multiple types (EMAIL + SYSTEM)
- entity_type/entity_id allow deep-linking to related records
- is_read flag only applicable for SYSTEM notifications
- Auto-cleanup: delete read notifications older than 30 days

**Common Notification Triggers**:

- Task assignment (circulation routing, RFA workflow)
- Document status changes (submitted, approved, rejected)
- Approaching deadlines
- System announcements
- Mention in comments

---

### 10.3 search_indices

**Purpose**: Full-text search index for document content

| Column Name | Data Type   | Constraints                 | Description                                 |
| ----------- | ----------- | --------------------------- | ------------------------------------------- |
| id          | INT         | PRIMARY KEY, AUTO_INCREMENT | Unique index ID                             |
| entity_type | VARCHAR(50) | NOT NULL                    | Entity type (e.g., 'correspondence', 'rfa') |
| entity_id   | INT         | NOT NULL                    | Entity primary ID                           |
| content     | TEXT        | NOT NULL                    | Searchable text content                     |
| indexed_at  | TIMESTAMP   | DEFAULT CURRENT_TIMESTAMP   | Last indexing timestamp                     |

**Indexes**:

- PRIMARY KEY (id)
- INDEX (entity_type, entity_id)
- INDEX (indexed_at)

**Business Rules**:

- Automatically populated/updated when documents change
- Content includes: title, description, document number, metadata
- May include OCR text from PDF attachments (future enhancement)
- Used by advanced search functionality
- Periodic re-indexing to catch missed updates
- Supports Boolean operators, phrase searching

**Search Features**:

- Natural language queries
- Wildcard support (\*, ?)
- Boolean operators (AND, OR, NOT)
- Phrase matching with quotes
- Result ranking by relevance

---

### 10.4 backup_logs

**Purpose**: Log table tracking database and file backup operations

| Column Name   | Data Type    | Constraints                 | Description                        |
| ------------- | ------------ | --------------------------- | ---------------------------------- |
| id            | INT          | PRIMARY KEY, AUTO_INCREMENT | Unique backup log ID               |
| backup_type   | ENUM         | NOT NULL                    | Type: DATABASE, FILES, FULL        |
| backup_path   | VARCHAR(500) | NOT NULL                    | Path to backup file/directory      |
| file_size     | BIGINT       | NULL                        | Backup file size in bytes          |
| status        | ENUM         | NOT NULL                    | Status: STARTED, COMPLETED, FAILED |
| started_at    | TIMESTAMP    | DEFAULT CURRENT_TIMESTAMP   | Backup start timestamp             |
| completed_at  | TIMESTAMP    | NULL                        | Backup completion timestamp        |
| error_message | TEXT         | NULL                        | Error details if failed            |

**Indexes**:

- PRIMARY KEY (id)
- INDEX (backup_type)
- INDEX (status)
- INDEX (started_at)
- INDEX (completed_at)

**Business Rules**:

- DATABASE: MariaDB dump of database schema and data
- FILES: Backup of attachment files from QNAP storage
- FULL: Complete system backup (database + files)
- Triggered by n8n cron jobs
- Backup retention policy defined in backup strategy
- Failed backups trigger alert notifications
- completed_at - started_at = backup duration

**Monitoring**:

- Alert if no successful backup in 24 hours
- Track backup size trends over time
- Verify backup integrity with test restores

---

### 10.5 json_schemas

**Purpose**: องรับ **Centralized JSON Schema Registry** เพื่อ Validate ข้อมูล JSON Details ของเอกสารแต่ละประเภท ตาม Requirements 6.11.1 และ Backend Plan T2.5.1

| Column Name           | Data Type      | Constraints      | Description                                        |
| :-------------------- | :------------- | :--------------- | :------------------------------------------------- |
| **id**                | `INT`          | PK, AI           | Unique Identifier                                  |
| **schema_code**       | `VARCHAR(100)` | UNIQUE, NOT NULL | รหัส Schema (เช่น `RFA_DWG_V1`, `CORR_RFI_V1`)       |
| **version**           | `INT`          | NOT NULL         | เวอร์ชันของ Schema                                   |
| **schema_definition** | `JSON`         | NOT NULL         | โครงสร้าง JSON Schema (Standard JSON Schema format) |
| **is_active**         | `BOOLEAN`      | DEFAULT TRUE     | สถานะการใช้งาน                                      |
| **created_at**        | `TIMESTAMP`    |                  | วันที่สร้าง                                            |

### 10.6 user_preferences

**Purpose**: แยกข้อมูลการตั้งค่าส่วนตัว (เช่น Notification Settings) ออกจากตาราง Users เพื่อความยืดหยุ่น ตาม Requirements 5.5 และ 6.8.3

| Column Name      | Data Type     | Constraints     | Description                            |
| :--------------- | :------------ | :-------------- | :------------------------------------- |
| **user_id**      | `INT`         | PK, FK          | อ้างอิงตาราง users                       |
| **notify_email** | `BOOLEAN`     | DEFAULT TRUE    | รับแจ้งเตือนทางอีเมล                       |
| **notify_line**  | `BOOLEAN`     | DEFAULT TRUE    | รับแจ้งเตือนทาง LINE                      |
| **digest_mode**  | `BOOLEAN`     | DEFAULT TRUE    | รับแจ้งเตือนแบบรวม (Digest) แทน Real-time |
| **ui_theme**     | `VARCHAR(20)` | DEFAULT 'light' | ธีมหน้าจอ (Light/Dark)                   |
| **updated_at**   | `TIMESTAMP`   |                 | วันที่แก้ไขล่าสุด                            |

## **11. 📊 Views & Procedures (วิว และ โปรซีเดอร์)**

### 11.1 v_current_correspondences

**Purpose**: View showing current revision of all non-RFA correspondences

**Columns**:

- correspondence_id, correspondence_number, correspondence_type_id/code/name
- project_id, project_code, project_iname
- organization_id, organization_code, organization_name
- revision_id, revision_number, revision_label
- title, document_date, issued_date, received_date, due_date
- correspondence_status_id, correspondence_status_code, correspondence_status_name
- created_by, created_by_username, revision_created_at

**Filters**:

- is_current = TRUE (only latest revision)
- correspondence_type NOT IN ('RFA') (excludes RFAs)
- deleted_at IS NULL (excludes soft-deleted records)

**Business Rules**:

- Provides flattened view of current correspondence state
- Joins correspondence_revisions with is_current flag
- Used by dashboard, document listing screens
- Excludes RFAs (they have separate view)

---

### 11.2 v_current_rfas

**Purpose**: View showing current revision of all RFA documents

**Columns**:

- rfa_id, rfa_type_id, rfa_type_code, rfa_type_name
- correspondence_id, correspondence_number
- project_id, project_code, project_iname
- organization_id, organization_name
- revision_id, revision_number, revision_label
- title, document_date, issued_date, received_date, approved_date
- rfa_status_code_id, rfa_status_code, rfa_status_name
- rfa_approve_code_id, rfa_approve_code, rfa_approve_code_name
- created_by, created_by_username, revision_created_at

**Filters**:

- is_current = TRUE
- deleted_at IS NULL (both rfas and correspondences)

**Business Rules**:

- Specialized view for RFA documents
- Includes RFA-specific fields (approval codes, approved date)
- Joins across rfas → rfa_revisions → correspondences
- Used by RFA management screens

---

### 11.3 v_contract_parties_all

**Purpose**: View showing all organization relationships across contracts and projects

**Columns**:

- contract_id, contract_code, contract_name
- project_id, project_code, project_iname
- organization_id, organization_code, organization_name
- role_in_contract

**Business Rules**:

- Joins contracts → projects → contract_organizations → organizations
- Shows only active contracts (is_active = TRUE)
- Used for permission checks and document routing
- Supports multi-organization projects/contracts

---

### 11.4 v_user_tasks

**Purpose**: View showing pending tasks assigned to users (action items)

**Columns**:

- routing_id, circulation_id, circulation_no, circulation_subject
- correspondence_id, correspondence_number
- project_id, project_code, project_name
- user_id, username, first_name, last_name
- organization_id, organization_name
- step_number, task_status, comments
- completed_at, assigned_at, circulation_created_at

**Filters**:

- status IN ('PENDING', 'IN_PROGRESS')
- assigned_to IS NOT NULL

**Business Rules**:

- Shows circulation routings requiring user action
- Used for "My Tasks" / "Inbox" functionality
- Excludes completed/cancelled tasks
- Ordered by creation date (oldest first)

---

### 11.5 v_audit_log_details

**Purpose**: View enriching audit logs with user information

**Columns**:

- audit_id, user_id, username, email, first_name, last_name
- action, entity_type, entity_id
- details_json, ip_address, user_agent
- created_at

**Business Rules**:

- Joins audit_logs with users table
- Used for audit trail reports
- Includes user details even if user later deleted (LEFT JOIN)

---

### 11.6 v_user_all_permissions

**Purpose**: View showing all effective permissions for users across all scopes

**Columns**:

- user_id, role_id, role_name
- permission_id, permission_name
- module, scope_level
- organization_id, project_id, contract_id
- permission_scope (GLOBAL, ORGANIZATION, PROJECT, CONTRACT)

**Business Rules**:

- UNION of permissions from Global, Organization, Project, and Contract scopes
- Used for authorization checks
- Considers role-permission mappings at all levels
- Only shows active permissions (is_active = 1)
- One row per user-permission-scope combination

**Usage Example**:

```sql
SELECT permission_name
FROM v_user_all_permissions
WHERE user_id = ?
  AND project_id = ?
  AND permission_name = 'document.edit';
```

---

### 11.7 v_documents_with_attachments

**Purpose**: View showing all documents and their attachment counts

**Columns**:

- document_type (CORRESPONDENCE, CIRCULATION, SHOP_DRAWING, CONTRACT_DRAWING)
- document_id, document_number
- project_id, project_code, project_name
- attachment_count, latest_attachment_date

**Business Rules**:

- UNION of all document types with attachments
- Used for document listing with file indicators
- Helps identify documents missing attachments
- Aggregates count per document

---

### 11.8 v_document_statistics

**Purpose**: View providing aggregated document statistics by project, type, and status

**Columns**:

- project_id, project_code, project_name
- correspondence_type_id, correspondence_type_code, correspondence_type_name
- status_id, status_code, status_name
- document_count, revision_count

**Business Rules**:

- CROSS JOIN creates all possible combinations
- LEFT JOIN shows zeros for combinations with no documents
- Only includes active projects, types, and statuses
- Used for dashboard charts and reports
- Groups by project → type → status

---

### 11.9 sp_get_next_document_number

**Purpose**: Stored procedure to safely generate next sequential document number

**Parameters**:

- IN p_project_id INT
- IN p_originator_organization_id INT
- IN p_correspondence_type_id INT
- IN p_current_year INT
- OUT p_next_number INT

**Logic**:

1. Start transaction
2. SELECT last_number FOR UPDATE (locks row)
3. If record doesn't exist, INSERT with last_number = 1
4. Else UPDATE last_number = last_number + 1
5. Return new number via OUT parameter
6. COMMIT transaction

**Business Rules**:

- Thread-safe counter increment
- FOR UPDATE lock prevents race conditions
- Handles first-time counter initialization
- Rolls back on any error
- Must be called within document creation transaction
- Used in conjunction with document_number_formats template

**Usage Example**:

```sql
CALL sp_get_next_document_number(
  1,    -- project_id
  10,   -- organization_id
  1,    -- type_id (RFA)
  2568, -- Buddhist year
  @next_number
);
-- @next_number now contains next sequence
```

---

## Database Indexes Summary

### Performance Optimization Indexes

**Primary Indexes** (automatic with PRIMARY KEY):

- All tables have PRIMARY KEY with AUTO_INCREMENT

**Foreign Key Indexes** (automatic with FOREIGN KEY):

- All FK relationships automatically indexed

**Additional Performance Indexes**:

1. **Correspondence Tables**:

   - `idx_correspondences_type_project` on (correspondence_type_id, project_id)
   - `idx_corr_revisions_current_status` on (is_current, correspondence_status_id)
   - `idx_corr_revisions_correspondence_current` on (correspondence_id, is_current)
   - `idx_correspondences_project_type` on (project_id, correspondence_type_id)

2. **RFA Tables**:

   - `idx_rfa_revisions_current_status` on (is_current, rfa_status_code_id)
   - `idx_rfa_revisions_rfa_current` on (rfa_id, is_current)

3. **Circulation Tables**:

   - `idx_circulation_routings_status_assigned` on (status, assigned_to)
   - `idx_circulation_routings_circulation_status` on (circulation_id, status)

4. **Document Numbering**:

   - `idx_doc_counter_composite` on (project_id, originator_organization_id, correspondence_type_id, current_year)

5. **Audit & Notifications**:

   - `idx_audit_logs_reporting` on (created_at, entity_type, action)
   - `idx_notifications_user_unread` on (user_id, is_read, created_at)

---

## Data Integrity Constraints

### Foreign Key Constraints

**Cascade Delete**:

- Parent-child relationships where child should be deleted with parent
- Examples: correspondence_revisions, shop_drawing_revisions, project/contract relationships

**Restrict Delete**:

- Prevents deletion if references exist
- Examples: correspondence_types, rfa_status_codes, organizations (when referenced)

**Set NULL**:

- Preserves record but removes reference
- Examples: originator_id, created_by, updated_by

### Unique Constraints

1. **Globally Unique**:

   - usernames, emails
   - shop_drawing.drawing_number

2. **Unique Within Scope**:

   - (project_id, correspondence_number)
   - (project_id, condwg_no)
   - (correspondence_id, revision_number)
   - (rfa_id, revision_number)

3. **Composite Unique**:
   - (correspondence_id, is_current) - ensures only one current revision
   - (project_id, correspondence_type_id) - in document_number_formats

### Check Constraints

1. **user_assignments.chk_scope**:
   - Ensures only one scope field (organization_id, project_id, contract_id) is NOT NULL
   - OR all are NULL for Global scope

### Business Rule Constraints

1. **Soft Delete Pattern**:

   - deleted_at timestamp instead of hard delete
   - Preserves audit trail and relationships
   - Applied to: correspondences, rfas, shop_drawings, contract_drawings

2. **Current Revision Pattern**:

   - is_current flag with UNIQUE constraint
   - Ensures only one current revision per document

3. **Sequential Numbering**:
   - revision_number starts at 0, increments by 1
   - Enforced by application logic + stored procedure

---

## Security & Permissions Model

### Access Control Hierarchy

```tree
Global Scope (Superadmin)
  └── Organization Scope (Org Admin, Document Control)
      └── Project Scope (Project Manager)
          └── Contract Scope (Contract Admin)
```

### Permission Inheritance

- Users can have multiple role assignments at different scopes
- More specific scopes inherit access from broader scopes
- Permission checks evaluate all applicable scopes
- View v_user_all_permissions aggregates effective permissions

### Role-Based Access Control (RBAC)

**7 Predefined Roles**:

1. Superadmin (Global) - Full system access
2. Org Admin (Organization) - Organization management
3. Document Control (Organization) - Document lifecycle + admin powers
4. Editor (Organization) - Document CRUD
5. Viewer (Organization) - Read-only
6. Project Manager (Project) - Project + document management
7. Contract Admin (Contract) - Contract-specific management

### Permission Categories (49 total)

1. **System Management** (1): Full system control
2. **Organization Management** (4): CRUD on organizations
3. **Project Management** (8): CRUD + member/contract management
4. **Role & Permission Management** (4): RBAC administration
5. **Master Data Management** (4): Document types, categories, tags
6. **User Management** (5): User CRUD + organization assignment
7. **Contract Management** (2): Contract administration
8. **Document Management** (16): Full document lifecycle
9. **Workflow Management** (3): Approval workflow control
10. **Search & Reporting** (2): Advanced search, report generation

---

## Data Migration & Seeding

### Pre-populated Master Data

1. **organization_roles**: Not used in current implementation
2. **organizations**: 15 organizations (Owner, Consultants, Contractors, Third parties)
3. **projects**: 5 projects (LCBP3 + 4 sub-contracts)
4. **contracts**: 7 contracts
5. **users**: 3 initial users (superadmin, editor01, viewer01)
6. **roles**: 7 predefined roles
7. **permissions**: 49 system permissions
8. **role_permissions**: Complete permission mappings
9. **project_organizations**: Project-organization relationships
10. **contract_organizations**: Contract-organization-role relationships
11. **correspondence_types**: 10 types
12. **correspondence_status**: 23 status codes
13. **rfa_types**: 11 types
14. **rfa_status_codes**: 7 statuses
15. **rfa_approve_codes**: 8 approval codes
16. **circulation_status_codes**: 4 statuses

### Initial Passwords

All seed users have password: `password123`

- Hashed as: `$2y$10$0kjBMxWq7E4G7P.dc8r5i.cjiPBiup553AsFpDfxUt31gKg9h/udq`
- **Must be changed on first login in production**

---

## Backup & Recovery Strategy

### Database Backup

**Strategy**:

- Daily full database backups
- Hourly incremental backups (transaction logs)
- Retention: 30 days online, 7 years archived

**Backup Method**:

- MariaDB mysqldump for logical backups
- MariaDB Backup (Mariabackup) for physical backups
- Automated via n8n cron workflows

### File Backup

**Strategy**:

- Daily backup of /share/dms-data/ directory
- QNAP snapshot every 4 hours
- Offsite replication to secondary NAS

**File Organization**:

```tree
/share/dms-data/
  ├── attachments/
  │   ├── 2025/
  │   │   ├── 01/
  │   │   │   └── {uuid}-{filename}
  │   │   └── 02/
  │   └── 2024/
  └── temp/
```

### Recovery Procedures

1. **Point-in-Time Recovery**: Using transaction logs
2. **Full Restore**: From latest full backup
3. **Selective Restore**: Individual tables or records
4. **File Recovery**: From QNAP snapshots or backup

---

## Performance Optimization

### Query Optimization

1. **Use Indexed Columns**: WHERE, JOIN, ORDER BY clauses
2. **Avoid SELECT**: Specify needed columns
3. **Use Views**: For complex, frequently-used queries
4. **Limit Result Sets**: Use LIMIT and pagination
5. **Analyze Slow Queries**: Enable slow query log

### Index Maintenance

```sql
-- Check index usage
SELECT * FROM information_schema.STATISTICS
WHERE TABLE_SCHEMA = 'lcbp3';

-- Optimize tables
OPTIMIZE TABLE correspondences;

-- Analyze tables
ANALYZE TABLE correspondences;
```

### Connection Pooling

- Backend uses connection pool (NestJS TypeORM)
- Min pool size: 5
- Max pool size: 20
- Idle timeout: 10 minutes

---

## Data Validation Rules

### Required Fields Validation

**At Application Level**:

- Email format validation
- Date range validation (start_date < end_date)
- File size limits (5MB per attachment)
- File type restrictions (PDF, DWG, DOC, XLS, images)

**At Database Level**:

- NOT NULL constraints
- UNIQUE constraints
- Foreign key constraints
- Check constraints (user_assignments scope)

### Business Logic Validation

1. **Document Workflow**:

   - Cannot edit submitted documents (unless Document Control)
   - Cannot skip workflow steps (unless forced)
   - Must provide approval comments

2. **User Management**:

   - Cannot delete users with active assignments
   - Cannot deactivate own account
   - Must have valid organization for non-Global roles

3. **File Management**:
   - Original filename preserved for audit
   - Unique stored filename prevents conflicts
   - File path must exist and be accessible

---

## Change Log & Versioning

### Database Version: v1.4.0

**Changes from v1.3.0**:

- Added comprehensive RBAC system (roles, permissions, user_assignments)
- Refactored organization-project-contract relationships
- Added junction tables for M:N relationships
- Implemented soft delete pattern
- Added full-text search support
- Enhanced audit logging with JSON details
- Added circulation workflow templates
- Improved document numbering with stored procedure
- Added comprehensive views for common queries
- Optimized indexes for performance

**Migration Path**:

- v1.3.0 → v1.4.0: Run migration script (not provided in this excerpt)
- Backup database before migration
- Test migration on staging environment first

---

## Technical Specifications

### Database Configuration

**MariaDB Server**:

- Version: 10.11
- Character Set: utf8mb4
- Collation: utf8mb4_general_ci
- Time Zone: +07:00 (Bangkok/Asia)
- SQL Mode: STRICT_TRANS_TABLES, NO_ENGINE_SUBSTITUTION

**Connection Settings**:

- Host: Container on QNAP TS-473A
- Port: 3306 (default)
- Max Connections: 100
- Max Packet Size: 64MB

### Table Engine

**InnoDB Features Used**:

- ACID compliance
- Foreign key constraints
- Row-level locking
- Crash recovery
- Transaction support

### Storage Requirements

**Estimated Initial Size**:

- Database: ~50 MB (with seed data)
- Indexes: ~20 MB
- Total: ~70 MB

**Growth Estimates**:

- 1,000 documents/month: +100 MB/month (database)
- 10 attachments/document @ 2MB avg: +20 GB/month (files)
- Plan for 1TB+ storage within first year

---

## Application Integration

### Backend (NestJS)

**TypeORM Entities**:

- One entity class per table
- Decorators for columns, relationships
- DTOs for data transfer
- Repositories for data access

**Key Modules**:

- AuthModule: Authentication, authorization
- DocumentsModule: Correspondence, RFA management
- DrawingsModule: Shop drawing, contract drawing
- WorkflowModule: Circulation, approval workflows
- FilesModule: Attachment management
- UsersModule: User, role, permission management

### Frontend (Next.js)

**Key Features**:

- Document listing/search
- Document creation wizards
- Workflow approval interface
- File upload/download
- User management console
- Dashboard analytics

### Integration Points

1. **Document Numbering**:

   - Call sp_get_next_document_number
   - Format with template from document_number_formats
   - Store in correspondences.correspondence_number

2. **File Upload**:

   - Upload to QNAP /share/dms-data/
   - Create attachment record
   - Link via junction table

3. **Workflow Execution**:

   - Check rfa_workflow_templates
   - Create rfa_workflows records
   - Update status as steps complete
   - Send notifications

4. **Permission Checks**:
   - Query v_user_all_permissions
   - Cache results per session
   - Re-check on sensitive operations

---

## Monitoring & Maintenance

### Health Checks

```sql
-- Database size
SELECT
  table_schema,
  SUM(data_length + index_length) / 1024 / 1024 AS size_mb
FROM information_schema.TABLES
WHERE table_schema = 'dms_db'
GROUP BY table_schema;

-- Table sizes
SELECT
  table_name,
  (data_length + index_length) / 1024 / 1024 AS size_mb,
  table_rows
FROM information_schema.TABLES
WHERE table_schema = 'dms_db'
ORDER BY (data_length + index_length) DESC;

-- Active connections
SHOW PROCESSLIST;

-- Lock wait statistics
SELECT * FROM information_schema.INNODB_LOCK_WAITS;
```

### Scheduled Maintenance

**Daily**:

- Full database backup
- Check backup log for failures
- Monitor disk space

**Weekly**:

- OPTIMIZE tables
- ANALYZE tables
- Review slow query log
- Check for deadlocks

**Monthly**:

- Review audit logs
- Clean up old notifications (30+ days)
- Archive old audit logs (7+ years)
- Verify backup integrity (test restore)

**Quarterly**:

- Review and optimize indexes
- Update database statistics
- Capacity planning review

---

## Glossary

**Terms**:

- **Correspondence**: Any formal document exchanged between parties
- **RFA**: Request for Approval - formal submittal for review/approval
- **Circulation**: Internal document routing workflow
- **Transmittal**: Cover sheet for forwarding multiple documents
- **Shop Drawing**: Detailed construction drawing from contractor
- **Contract Drawing**: Baseline drawing from contract specifications
- **Revision**: Version of a document
- **Originator**: Organization that creates/sends a document
- **Recipient**: Organization that receives a document (TO or CC)
- **Scope**: Level of permission application (Global, Organization, Project, Contract)

**Acronyms**:

- **DMS**: Document Management System
- **LCBP3**: Laem Chabang Port Phase 3
- **RBAC**: Role-Based Access Control
- **RFA**: Request for Approval
- **RFI**: Request for Information
- **CSC**: Construction Supervision Consultant
- **TO**: Primary recipient (action required)
- **CC**: Carbon copy (for information)
- **QNAP**: Network Attached Storage device manufacturer

---

**Document Control**:

- Document: Data Dictionary - DMS v1.4.0
- Version: 1.0
- Date: 2025-01-XX
- Author: System Architecture Team
- Status: FINAL
- Classification: Internal Technical Documentation

---

`End of Data Dictionary v1.4.2 (ฉบับปรับปรุง)`
