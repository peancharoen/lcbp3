# **สรุปตารางฐานข้อมูล (Data Dictionary) - LCBP3-DMS (V1.4.0)**

เอกสารนี้สรุปโครงสร้างตาราง, Foreign Keys (FK), และ Constraints ที่สำคัญทั้งหมดในฐานข้อมูล LCBP3-DMS (v1.4.0) เพื่อใช้เป็นเอกสารอ้างอิงสำหรับทีมพัฒนา Backend (NestJS) และ Frontend (Next.js) โดยอิงจาก Requirements และ SQL Script ล่าสุด

## **1. 🏢 Core & Master Data (องค์กร, โครงการ, สัญญา)**

#### **1.1. organization_roles**

ตาราง Master เก็บประเภทบทบาทขององค์กร (เช่น OWNER, CONTRACTOR)

| Column    | Type        | Key    | Description                                                      |
| :-------- | :---------- | :----- | :--------------------------------------------------------------- |
| id        | INT         | **PK** | ID ของตาราง                                                      |
| role_name | VARCHAR(20) | UK     | ชื่อบทบาท (OWNER, DESIGNER, CONSULTANT, CONTRACTOR, THIRD PARTY) |

- **Unique Keys (UK):** ux_roles_name (role_name)

---

#### **1.2. organizations**

ตาราง Master เก็บข้อมูลองค์กรทั้งหมดที่เกี่ยวข้องในระบบ

| Column            | Type         | Key    | Description                                    |
| :---------------- | :----------- | :----- | :--------------------------------------------- |
| id                | INT          | **PK** | ID ของตาราง                                    |
| organization_code | VARCHAR(20)  | UK     | รหัสองค์กร                                     |
| organization_name | VARCHAR(255) |        | ชื่อองค์กร                                     |
| role_id           | INT          | FK     | บทบาทขององค์กร (FK \-> organization_roles(id)) |
| is_active         | BOOLEAN      |        | สถานะการใช้งาน                                 |
| created_at        | TIMESTAMP    |        | วันที่สร้าง                                    |
| updated_at        | TIMESTAMP    |        | วันที่แก้ไขล่าสุด                              |

- **Foreign Keys (FK):**
  - role_id -> organization_roles(id) (ON DELETE SET NULL)
- **Unique Keys (UK):** ux_organizations_code (organization_code)

---

#### **1.3. projects**

ตาราง Master เก็บข้อมูลโครงการ (เช่น LCBP3C1, LCBP3C2)

| Column                     | Type         | Key    | Description                                             |
| :------------------------- | :----------- | :----- | :------------------------------------------------------ |
| id                         | INT          | **PK** | ID ของตาราง                                             |
| project_code               | VARCHAR(50)  | UK     | รหัสโครงการ                                             |
| project_name               | VARCHAR(255) |        | ชื่อโครงการ                                             |
| parent_project_id          | INT          | FK     | รหัสโครงการหลัก (ถ้ามี) (FK \-> projects(id))           |
| contractor_organization_id | INT          | FK     | รหัสองค์กรผู้รับเหมา (ถ้ามี) (FK \-> organizations(id)) |
| is_active                  | TINYINT(1)   |        | สถานะการใช้งาน                                          |

- **Foreign Keys (FK):**
  - parent_project_id -> projects(id) (ON DELETE SET NULL)
  - contractor_organization_id -> organizations(id) (ON DELETE SET NULL)
- **Unique Keys (UK):** uq_pro_code (project_code)

---

#### **1.4. contracts**

ตาราง Master เก็บข้อมูลสัญญา

| Column        | Type         | Key    | Description        |
| :------------ | :----------- | :----- | :----------------- |
| id            | INT          | **PK** | ID ของตาราง        |
| contract_code | VARCHAR(50)  | UK     | รหัสสัญญา          |
| contract_name | VARCHAR(255) |        | ชื่อสัญญา          |
| description   | TEXT         |        | คำอธิบายสัญญา      |
| start_date    | DATE         |        | วันที่เริ่มสัญญา   |
| end_date      | DATE         |        | วันที่สิ้นสุดสัญญา |
| created_at    | TIMESTAMP    |        | วันที่สร้าง        |
| updated_at    | TIMESTAMP    |        | วันที่แก้ไขล่าสุด  |

- **Unique Keys (UK):** ux_contracts_code (contract_code)

---

## **2. 👥 Users & RBAC (ผู้ใช้, สิทธิ์, บทบาท)**

#### **2.1. users**

ตาราง Master เก็บข้อมูลผู้ใช้งาน (User)

| Column          | Type         | Key    | Description                             |
| :-------------- | :----------- | :----- | :-------------------------------------- |
| user_id         | INT          | **PK** | ID ของตาราง                             |
| username        | VARCHAR(50)  | UK     | ชื่อผู้ใช้งาน                           |
| password_hash   | VARCHAR(255) |        | รหัสผ่าน (Hashed)                       |
| first_name      | VARCHAR(50)  |        | ชื่อจริง                                |
| last_name       | VARCHAR(50)  |        | นามสกุล                                 |
| email           | VARCHAR(100) | UK     | อีเมล                                   |
| line_id         | VARCHAR(100) |        | LINE ID                                 |
| organization_id | INT          | FK     | สังกัดองค์กร (FK \-> organizations(id)) |
| is_active       | TINYINT(1)   |        | สถานะการใช้งาน                          |
| failed_attempts | INT          |        | จำนวนครั้งที่ล็อกอินล้มเหลว             |
| locked_until    | DATETIME     |        | ล็อกอินไม่ได้จนถึงเวลา                  |
| last_login_at   | TIMESTAMP    |        | วันที่และเวลาที่ล็อกอินล่าสุด           |
| created_at      | TIMESTAMP    |        | วันที่สร้าง                             |
| updated_at      | TIMESTAMP    |        | วันที่แก้ไขล่าสุด                       |

- **Foreign Keys (FK):**
  - organization_id -> organizations(id) (ON DELETE SET NULL)
- **Unique Keys (UK):** ux_users_username (username), ux_users_email (email)

---

#### **2.2. roles**

ตาราง Master เก็บ "บทบาท" ของผู้ใช้ในระบบ (เช่น SUPER_ADMIN, ADMIN, EDITOR)

| Column      | Type         | Key    | Description                                         |
| :---------- | :----------- | :----- | :-------------------------------------------------- |
| role_id     | INT          | **PK** | ID ของตาราง                                         |
| role_code   | VARCHAR(50)  | UK     | รหัสบทบาท (เช่น SUPER_ADMIN, ADMIN, EDITOR, VIEWER) |
| role_name   | VARCHAR(100) |        | ชื่อบทบาท                                           |
| description | TEXT         |        | คำอธิบายบทบาท                                       |
| is_system   | BOOLEAN      |        | (1 = บทบาทของระบบ ลบไม่ได้)                         |

- **Unique Keys (UK):** role_code

---

#### **2.3. permissions**

ตาราง Master เก็บ "สิทธิ์" (Permission) หรือ "การกระทำ" ทั้งหมดในระบบ

| Column          | Type         | Key    | Description                                 |
| :-------------- | :----------- | :----- | :------------------------------------------ |
| permission_id   | INT          | **PK** | ID ของตาราง                                 |
| permission_code | VARCHAR(100) | UK     | รหัสสิทธิ์ (เช่น rfas.create, rfas.view)    |
| description     | TEXT         |        | คำอธิบายสิทธิ์                              |
| module          | VARCHAR(50)  |        | โมดูลที่เกี่ยวข้อง                          |
| scope_level     | ENUM(...)    |        | ระดับขอบเขตของสิทธิ์ (GLOBAL, ORG, PROJECT) |
| is_active       | TINYINT(1)   |        | สถานะการใช้งาน                              |

- **Unique Keys (UK):** ux_permissions_code (permission_code)

---

#### **2.4. role_permissions (ตารางเชื่อม)**

ตารางเชื่อมระหว่าง roles และ permissions (M:N)

| Column        | Type | Key        | Description                                      |
| :------------ | :--- | :--------- | :----------------------------------------------- |
| role_id       | INT  | **PK**, FK | ID ของบทบาท (FK \-> roles(role_id))              |
| permission_id | INT  | **PK**, FK | ID ของสิทธิ์ (FK \-> permissions(permission_id)) |

- **Foreign Keys (FK):**
  - role_id -> roles(role_id) (ON DELETE CASCADE)
  - permission_id -> permissions(permission_id) (ON DELETE CASCADE)

---

#### **2.5. user_roles (ตารางเชื่อม)**

ตารางเชื่อมผู้ใช้ (users) กับบทบาท (roles) ในระดับ **Global** (M:N)

| Column  | Type | Key        | Description                          |
| :------ | :--- | :--------- | :----------------------------------- |
| user_id | INT  | **PK**, FK | ID ของผู้ใช้ (FK \-> users(user_id)) |
| role_id | INT  | **PK**, FK | ID ของบทบาท (FK \-> roles(role_id))  |

- **Foreign Keys (FK):**
  - user_id -> users(user_id) (ON DELETE CASCADE)
  - role_id -> roles(role_id) (ON DELETE CASCADE)

---

#### **2.6. user_project_roles (ตารางเชื่อม)**

ตารางเชื่อมผู้ใช้ (users) กับบทบาท (roles) ในระดับ **Project-Specific** (M:N)

| Column     | Type | Key        | Description                          |
| :--------- | :--- | :--------- | :----------------------------------- |
| user_id    | INT  | **PK**, FK | ID ของผู้ใช้ (FK \-> users(user_id)) |
| project_id | INT  | **PK**, FK | ID ของโครงการ (FK \-> projects(id))  |
| role_id    | INT  | **PK**, FK | ID ของบทบาท (FK \-> roles(role_id))  |

- **Foreign Keys (FK):**
  - user_id -> users(user_id) (ON DELETE CASCADE)
  - project_id -> projects(id) (ON DELETE CASCADE)
  - role_id -> roles(role_id) (ON DELETE CASCADE)

---

## **3. ✉️ Correspondences (เอกสารหลัก, Revisions)**

#### **3.1. correspondence_types**

ตาราง Master เก็บประเภทเอกสารโต้ตอบ (เช่น RFA, RFI, LETTER, MOM)

| Column     | Type         | Key    | Description                |
| :--------- | :----------- | :----- | :------------------------- |
| id         | INT          | **PK** | ID ของตาราง                |
| type_code  | VARCHAR(50)  | UK     | รหัสประเภท (เช่น RFA, RFI) |
| type_name  | VARCHAR(255) |        | ชื่อประเภท                 |
| sort_order | INT          |        | ลำดับการแสดงผล             |
| is_active  | TINYINT(1)   |        | สถานะการใช้งาน             |

- **Unique Keys (UK):** type_code

---

#### **3.2. correspondence_status**

ตาราง Master เก็บสถานะของเอกสาร (เช่น DRAFT, SUBMITTED, CLOSED)

| Column      | Type         | Key    | Description                           |
| :---------- | :----------- | :----- | :------------------------------------ |
| id          | INT          | **PK** | ID ของตาราง                           |
| status_code | VARCHAR(50)  | UK     | รหัสสถานะหนังสือ (เช่น DRAFT, SUBOWN) |
| status_name | VARCHAR(255) |        | ชื่อสถานะหนังสือ                      |
| sort_order  | INT          |        | ลำดับการแสดงผล                        |
| is_active   | TINYINT(1)   |        | สถานะการใช้งาน                        |

- **Unique Keys (UK):** status_code

---

#### **3.3. correspondences (Master)**

ตาราง "แม่" ของเอกสารโต้ตอบ เก็บข้อมูลที่ไม่เปลี่ยนตาม Revision (เช่น เลขที่เอกสาร)

| Column                    | Type         | Key    | Description                                      |
| :------------------------ | :----------- | :----- | :----------------------------------------------- |
| id                        | INT          | **PK** | ID ของตาราง (นี่คือ "Master ID" ที่ใช้เชื่อมโยง) |
| correspondence_number     | VARCHAR(100) | UK     | เลขที่เอกสาร (สร้างจาก DocumentNumberingModule)  |
| correspondence_type_id    | INT          | FK     | ประเภทเอกสาร (FK \-> correspondence_types(id))   |
| is_internal_communication | TINYINT(1)   |        | (1 = ภายใน, 0 = ภายนอก)                          |
| project_id                | INT          | FK     | อยู่ในโครงการ (FK \-> projects(id))              |
| originator_id             | INT          | FK     | องค์กรผู้ส่ง (FK \-> organizations(id))          |
| created_at                | DATETIME     |        | วันที่สร้าง                                      |
| created_by                | INT          | FK     | ผู้สร้าง (FK \-> users(user_id))                 |
| deleted_at                | DATETIME     |        | สำหรับ Soft Delete                               |

- **Foreign Keys (FK):**
  - correspondence_type_id -> correspondence_types(id) (ON DELETE RESTRICT)
  - project_id -> projects(id) (ON DELETE CASCADE)
  - originator_id -> organizations(id) (ON DELETE SET NULL)
  - created_by -> users(user_id) (ON DELETE SET NULL)
- **Unique Keys (UK):** uq_corr_no_per_project (project_id, correspondence_number)

---

#### **3.4. correspondence_revisions (Revisions)**

ตาราง "ลูก" เก็บประวัติการแก้ไข (Revisions) ของ correspondences (1:N) **(ปรับปรุง V1.4.0)**

| Column                   | Type         | Key    | Description                                              |
| :----------------------- | :----------- | :----- | :------------------------------------------------------- |
| id                       | INT          | **PK** | **ID ของ Revision**                                      |
| correspondence_id        | INT          | FK, UK | Master ID (FK \-> correspondences(id))                   |
| revision_number          | INT          | UK     | หมายเลข Revision (0, 1, 2...)                            |
| revision_label           | VARCHAR(10)  |        | **(ใหม่)** Revision ที่แสดง (เช่น A, B, 1.1)             |
| is_current               | BOOLEAN      | UK     | (1 = Revision ปัจจุบัน)                                  |
| correspondence_status_id | INT          | FK     | สถานะของ Revision นี้ (FK \-> correspondence_status(id)) |
| title                    | VARCHAR(255) |        | เรื่อง                                                   |
| document_date            | DATE         |        | วันที่ในเอกสาร                                           |
| issued_date              | DATETIME     |        | วันที่ออกเอกสาร                                          |
| received_date            | DATETIME     |        | วันที่ลงรับเอกสาร                                        |
| due_date                 | DATETIME     |        | **(ใหม่)** วันที่ครบกำหนด (ตาม Requirements 3.2.5)       |
| description              | TEXT         |        | **(ใหม่)** คำอธิบายการแก้ไขใน Revision นี้               |
| details                  | JSON         |        | ข้อมูลเฉพาะ (เช่น RFI details)                           |
| created_at               | DATETIME     |        | **(ใหม่)** วันที่สร้างเอกสาร                             |
| created_by               | INT          | FK     | ผู้สร้าง (FK \-> users(user_id))                         |
| updated_by               | INT          | **FK** | **(ใหม่)** ผู้แก้ไขล่าสุด (FK \-> users(user_id))        |

- **Foreign Keys (FK):**
  - correspondence_id -> correspondences(id) (ON DELETE CASCADE)
  - correspondence_status_id -> correspondence_status(id) (ON DELETE RESTRICT)
  - created_by -> users(user_id) (ON DELETE SET NULL)
  - updated_by -> users(user_id) (ON DELETE SET NULL)
- **Unique Keys (UK):**
  - uq_master_revision_number (correspondence_id, revision_number) (ป้องกัน Rev ซ้ำใน Master เดียว)
  - uq_master_current (correspondence_id, is_current) (ป้องกัน is_current = TRUE ซ้ำใน Master เดียว)
- **Check Constraints (CHK):** chk_rev_format (ตรวจสอบรูปแบบ revision_label)

---

#### **3.5. correspondence_recipients (ตารางเชื่อม)**

ตารางเชื่อมผู้รับ (TO/CC) สำหรับเอกสารแต่ละฉบับ (M:N)

| Column                    | Type             | Key        | Description                                                       |
| :------------------------ | :--------------- | :--------- | :---------------------------------------------------------------- |
| correspondence_id         | INT              | **PK**, FK | ID ของเอกสาร (FK \-> correspondence_revisions(correspondence_id)) |
| recipient_organization_id | INT              | **PK**, FK | ID องค์กรผู้รับ (FK \-> organizations(id))                        |
| recipient_type            | ENUM('TO', 'CC') | **PK**     | ประเภทผู้รับ (TO หรือ CC)                                         |

- **Foreign Keys (FK):**
  - correspondence_id -> correspondence_revisions(correspondence_id) (ON DELETE CASCADE)
  - recipient_organization_id -> organizations(id) (ON DELETE RESTRICT)

---

#### **3.6. correspondence_tags (ตารางเชื่อม)**

ตารางเชื่อมระหว่าง correspondences และ tags (M:N)

| Column            | Type | Key        | Description                               |
| :---------------- | :--- | :--------- | :---------------------------------------- |
| correspondence_id | INT  | **PK**, FK | ID ของเอกสาร (FK \-> correspondences(id)) |
| tag_id            | INT  | **PK**, FK | ID ของ Tag (FK \-> tags(id))              |

- **Foreign Keys (FK):**
  - correspondence_id -> correspondences(id) (ON DELETE CASCADE)
  - tag_id -> tags(id) (ON DELETE CASCADE)

---

#### **3.7. correspondence_references (ตารางเชื่อม)**

ตารางเชื่อมการอ้างอิงระหว่างเอกสาร (M:N)

| Column                | Type | Key        | Description                                    |
| :-------------------- | :--- | :--------- | :--------------------------------------------- |
| src_correspondence_id | INT  | **PK**, FK | ID เอกสารต้นทาง (FK \-> correspondences(id))   |
| tgt_correspondence_id | INT  | **PK**, FK | ID เอกสารเป้าหมาย (FK \-> correspondences(id)) |

- **Foreign Keys (FK):**
  - src_correspondence_id -> correspondences(id) (ON DELETE CASCADE)
  - tgt_correspondence_id -> correspondences(id) (ON DELETE CASCADE)

---

## **4. 📐 approval: RFA (เอกสารขออนุมัติ, Workflows)**

#### **4.1. rfa_types / ...\_status_codes / ...\_approve_codes**

ตาราง Master สำหรับ RFA

- **rfa_types:** ประเภท RFA (เช่น DWG, DOC, MAT)
- **rfa_status_codes:** สถานะ RFA (เช่น DFT \- Draft, FAP \- For Approve)
- **rfa_approve_codes:** รหัสผลการอนุมัติ (เช่น 1A \- Approved, 3R \- Revise and Resubmit)

---

#### **4.2. rfas (Master)**

ตาราง "แม่" ของ RFA (มีความสัมพันธ์ 1:N กับ rfa_revisions)

| Column      | Type     | Key    | Description                       |
| :---------- | :------- | :----- | :-------------------------------- |
| id          | INT      | **PK** | ID ของตาราง (RFA Master ID)       |
| rfa_type_id | INT      | FK     | ประเภท RFA (FK \-> rfa_types(id)) |
| created_at  | DATETIME |        | วันที่สร้าง                       |
| created_by  | INT      | FK     | ผู้สร้าง (FK \-> users(user_id))  |
| deleted_at  | DATETIME |        | สำหรับ Soft Delete                |

- **Foreign Keys (FK):**
  - rfa_type_id -> rfa_types(id)
  - created_by -> users(user_id) (ON DELETE SET NULL)

---

#### **4.3. rfa_revisions (Revisions)**

ตาราง "ลูก" เก็บประวัติ (Revisions) ของ rfas (1:N) **(ปรับปรุง V1.4.0)**

| Column              | Type         | Key    | Description                                               |
| :------------------ | :----------- | :----- | :-------------------------------------------------------- |
| id                  | INT          | **PK** | **ID ของ Revision**                                       |
| correspondence_id   | INT          | FK     | Master ID ของ Correspondence (FK \-> correspondences(id)) |
| rfa_id              | INT          | FK, UK | Master ID ของ RFA (FK \-> rfas(id))                       |
| revision_number     | INT          | UK     | หมายเลข Revision (0, 1, 2...)                             |
| revision_label      | VARCHAR(10)  |        | **(ใหม่)** Revision ที่แสดง (เช่น A, B, 1.1)              |
| is_current          | BOOLEAN      | UK     | (1 = Revision ปัจจุบัน)                                   |
| rfa_status_code_id  | INT          | FK     | สถานะ RFA (FK \-> rfa_status_codes(id))                   |
| rfa_approve_code_id | INT          | FK     | ผลการอนุมัติ (FK \-> rfa_approve_codes(id))               |
| title               | VARCHAR(255) |        | เรื่อง                                                    |
| document_date       | DATE         |        | **(ใหม่)** วันที่ในเอกสาร                                 |
| issued_date         | DATE         |        | **(ใหม่)** วันที่ส่งขออนุมัติ                             |
| received_date       | DATETIME     |        | **(ใหม่)** วันที่ลงรับเอกสาร                              |
| approved_date       | DATE         |        | **(ใหม่)** วันที่อนุมัติ                                  |
| description         | TEXT         |        | **(ใหม่)** คำอธิบายการแก้ไขใน Revision นี้                |
| created_at          | DATETIME     |        | **(ใหม่)** วันที่สร้างเอกสาร                              |
| created_by          | INT          | FK     | ผู้สร้าง (FK \-> users(user_id))                          |
| updated_by          | INT          | **FK** | **(ใหม่)** ผู้แก้ไขล่าสุด (FK \-> users(user_id))         |

- **Foreign Keys (FK):**
  - correspondence_id -> correspondences(id) (ON DELETE CASCADE)
  - rfa_id -> rfas(id) (ON DELETE CASCADE)
  - rfa_status_code_id -> rfa_status_codes(id)
  - rfa_approve_code_id -> rfa_approve_codes(id) (ON DELETE SET NULL)
  - created_by -> users(user_id) (ON DELETE SET NULL)
  - updated_by -> users(user_id) (ON DELETE SET NULL)
- **Unique Keys (UK):**
  - uq_rr_rev_number (rfa_id, revision_number) (ป้องกัน Rev ซ้ำใน Master เดียว)
  - uq_rr_current (rfa_id, is_current) (ป้องกัน is_current=TRUE ซ้ำใน Master เดียว)

---

#### **4.4. rfa_items (ตารางเชื่อม)**

ตารางเชื่อมระหว่าง rfa_revisions (ที่เป็นประเภท DWG) กับ shop_drawing_revisions (M:N)

| Column                   | Type | Key            | Description                                                      |
| :----------------------- | :--- | :------------- | :--------------------------------------------------------------- |
| rfarev_correspondence_id | INT  | **PK**, FK     | ID ของ RFA Revision (FK \-> rfa_revisions(correspondence_id))    |
| shop_drawing_revision_id | INT  | **PK**, UK, FK | ID ของ Shop Drawing Revision (FK \-> shop_drawing_revisions(id)) |

- **Foreign Keys (FK):**
  - rfarev_correspondence_id -> rfa_revisions(correspondence_id) (ON DELETE CASCADE)
  - shop_drawing_revision_id -> shop_drawing_revisions(id) (ON DELETE CASCADE)

---

#### **4.5. rfa_workflow_templates / ...\_steps / ...\_workflows**

ตารางที่เกี่ยวข้องกับ Workflow การอนุมัติ RFA

- **rfa_workflow_templates:** ตาราง Master เก็บแม่แบบสายอนุมัติ (เช่น "สายอนุมัติ 3 ขั้นตอน")
- **rfa_workflow_template_steps:** ตารางลูก เก็บขั้นตอนในแม่แบบ (เช่น Step 1: Org A (Review), Step 2: Org B (Approve))
- **rfa_workflows:** ตารางประวัติ (Log) การอนุมัติของ RFA จริงตามสายงงาน

---

## **5. 📐 Drawings (แบบ, หมวดหมู่)**

#### **5.1. contract_drawing_volumes / ...\_cats / ...\_sub_cats**

ตาราง Master สำหรับ "แบบคู่สัญญา" (Contract Drawings)

- **contract_drawing_volumes:** เก็บ "เล่ม" ของแบบ
- **contract_drawing_cats:** เก็บ "หมวดหมู่หลัก" ของแบบ
- **contract_drawing_sub_cats:** เก็บ "หมวดหมู่ย่อย" ของแบบ

---

#### **5.2. contract_drawing_subcat_cat_maps (ตารางเชื่อม - ใหม่)**

**(ใหม่)** ตารางเชื่อมระหว่าง หมวดหมู่หลัก-ย่อย (M:N)

| Column     | Type | Key        | Description        |
| :--------- | :--- | :--------- | :----------------- |
| project_id | INT  | **PK**, FK | ID ของโครงการ      |
| sub_cat_id | INT  | **PK**, FK | ID ของหมวดหมู่ย่อย |
| cat_id     | INT  | **PK**, FK | ID ของหมวดหมู่หลัก |

- **Foreign Keys (FK) (ตามเจตนา):**
  - (project_id, sub_cat_id) -> contract_drawing_sub_cats(project_id, id)
  - (project_id, cat_id) -> contract_drawing_cats(project_id, id)
- **Unique Keys (UK):**
  - ux_map_unique (project_id, sub_cat_id, cat_id)

---

#### **5.3. contract_drawings (Master)**

ตาราง Master เก็บข้อมูล "แบบคู่สัญญา"

| Column     | Type         | Key    | Description                                         |
| :--------- | :----------- | :----- | :-------------------------------------------------- |
| id         | INT          | **PK** | ID ของตาราง                                         |
| project_id | INT          | FK, UK | โครงการ (FK \-> projects(id))                       |
| condwg_no  | VARCHAR(255) | UK     | เลขที่แบบสัญญา                                      |
| title      | VARCHAR(255) |        | ชื่อแบบสัญญา                                        |
| sub_cat_id | INT          | FK     | หมวดหมู่ย่อย (FK \-> contract_drawing_sub_cats(id)) |
| volume_id  | INT          | FK     | เล่ม (FK \-> contract_drawing_volumes(id))          |
| created_at | TIMESTAMP    |        | วันที่สร้าง                                         |
| updated_at | TIMESTAMP    |        | วันที่แก้ไขล่าสุด                                   |
| deleted_at | DATETIME     |        | **(ใหม่)** วันที่ลบ                                 |
| updated_by | INT          | FK     | **(ใหม่)** ผู้แก้ไขล่าสุด                           |

- **Foreign Keys (FK):**
  - fk_condwg_project (project_id) -> projects(id) (ON DELETE CASCADE)
  - fk_condwg_subcat_same_project (project_id, sub_cat_id) -> contract_drawing_sub_cats(project_id, id) (ON DELETE RESTRICT)
  - fk_condwg_volume_same_project (project_id, volume_id) -> contract_drawing_volumes(project_id, id) (ON DELETE RESTRICT)
- **Unique Keys (UK):** ux_condwg_no_project (project_id, condwg_no)

---

#### **5.4. shop_drawing_main_categories / ...\_sub_categories**

ตาราง Master สำหรับ "แบบก่อสร้าง" (Shop Drawings)

- **shop_drawing_main_categories:** เก็บ "หมวดหมู่หลัก" (เช่น ARCH, STR)
- **shop_drawing_sub_categories:** เก็บ "หมวดหมู่ย่อย" (เช่น STR-COLUMN)

---

#### **5.5. shop_drawings (Master)**

ตาราง Master เก็บข้อมูล "แบบก่อสร้าง"

| Column           | Type         | Key    | Description                                            |
| :--------------- | :----------- | :----- | :----------------------------------------------------- |
| id               | INT          | **PK** | ID ของตาราง                                            |
| project_id       | INT          | FK     | โครงการ (FK \-> projects(id))                          |
| drawing_number   | VARCHAR(100) | UK     | เลขที่ Shop Drawing                                    |
| title            | VARCHAR(500) |        | ชื่อแบบ                                                |
| main_category_id | INT          | FK     | หมวดหมู่หลัก (FK \-> shop_drawing_main_categories(id)) |
| sub_category_id  | INT          | FK     | หมวดหมู่ย่อย (FK \-> shop_drawing_sub_categories(id))  |
| created_at       | TIMESTAMP    |        | วันที่สร้าง                                            |
| updated_at       | TIMESTAMP    |        | วันที่แก้ไขล่าสุด                                      |
| deleted_at       | DATETIME     |        | **(ใหม่)** วันที่ลบ                                    |
| updated_by       | INT          | FK     | **(ใหม่)** ผู้แก้ไขล่าสุด                              |

- **Foreign Keys (FK):** project_id, main_category_id, sub_category_id
- **Unique Keys (UK):** ux_sd_drawing_number (drawing_number)

---

#### **5.6. shop_drawing_revisions (Revisions)**

ตาราง "ลูก" เก็บประวัติ (Revisions) ของ shop_drawings (1:N)

| Column          | Type        | Key    | Description                                       |
| :-------------- | :---------- | :----- | :------------------------------------------------ |
| id              | INT         | **PK** | ID ของ Revision                                   |
| shop_drawing_id | INT         | FK, UK | Master ID (FK \-> shop_drawings(id))              |
| revision_number | INT         | UK     | **(ปรับปรุง)** หมายเลข Revision (เช่น 0, 1, 2...) |
| revision_label  | VARCHAR(10) |        | **(ปรับปรุง)** Revision ที่แสดง (เช่น A, B, 1.1)  |
| revision_date   | DATE        |        | วันที่ของ Revision                                |
| description     | TEXT        |        | คำอธิบายการแก้ไข                                  |
| created_at      | TIMESTAMP   |        | วันที่สร้าง                                       |

- **Foreign Keys (FK):**
  - shop_drawing_id -> shop_drawings(id) (ON DELETE CASCADE)
- **Unique Keys (UK):** ux_sd_rev_drawing_revision (shop_drawing_id, revision_number)

---

#### **5.7. shop_drawing_revision_contract_refs (ตารางเชื่อม)**

ตารางเชื่อมระหว่าง shop_drawing_revisions กับ contract_drawings (M:N)

| Column                   | Type | Key        | Description                                                      |
| :----------------------- | :--- | :--------- | :--------------------------------------------------------------- |
| shop_drawing_revision_id | INT  | **PK**, FK | ID ของ Shop Drawing Revision (FK \-> shop_drawing_revisions(id)) |
| contract_drawing_id      | INT  | **PK**, FK | ID ของ Contract Drawing (FK \-> contract_drawings(id))           |

- **Foreign Keys (FK):**
  - shop_drawing_revision_id -> shop_drawing_revisions(id) (ON DELETE CASCADE)
  - contract_drawing_id -> contract_drawings(id) (ON DELETE CASCADE)

---

## **6. 🔄 Circulations (ใบเวียนภายใน)**

#### **6.1. circulation_status_codes**

ตาราง Master เก็บสถานะใบเวียน (เช่น OPEN, IN_REVIEW, COMPLETED)

| Column      | Type        | Key    | Description               |
| :---------- | :---------- | :----- | :------------------------ |
| id          | INT         | **PK** | ID ของตาราง               |
| code        | VARCHAR(20) | UK     | รหัสสถานะการดำเนินงาน     |
| description | VARCHAR(50) |        | คำอธิบายสถานะการดำเนินงาน |
| sort_order  | INT         |        | ลำดับการแสดงผล            |
| is_active   | TINYINT(1)  |        | สถานะการใช้งาน            |

---

#### **6.2. circulations (Master)**

ตาราง "แม่" ของใบเวียนเอกสารภายใน

| Column                  | Type         | Key    | Description                                                       |
| :---------------------- | :----------- | :----- | :---------------------------------------------------------------- |
| id                      | INT          | **PK** | ID ของตารางใบเวียน                                                |
| correspondence_id       | INT          | UNIQUE | ID ของเอกสาร (จากตาราง correspondences)                           |
| organization_id         | INT          | FK     | ID ขององค์กรณ์ที่เป็นเจ้าของใบเวียนนี้ (FK \-> organizations(id)) |
| circulation_no          | VARCHAR(100) |        | เลขที่ใบเวียน                                                     |
| circulation_subject     | VARCHAR(500) |        | เรื่องใบเวียน                                                     |
| circulation_status_code | VARCHAR(20)  | FK     | รหัสสถานะใบเวียน (FK \-> circulation_status_codes(code))          |
| created_by_user_id      | INT          | FK     | ID ของผู้สร้างใบเวียน (FK \-> users(user_id))                     |
| submitted_at            | TIMESTAMP    |        | วันที่ส่งใบเวียน                                                  |
| closed_at               | TIMESTAMP    |        | วันที่ปิดใบเวียน                                                  |
| created_at              | TIMESTAMP    |        | วันที่สร้าง                                                       |
| updated_at              | TIMESTAMP    |        | วันที่แก้ไขล่าสุด                                                 |

- **Foreign Keys (FK):**
  - correspondence_id -> correspondences(id)
  - organization_id -> organizations(id)
  - circulation_status_code -> circulation_status_codes(code)
  - created_by_user_id -> users(user_id)

---

#### **6.3. circulation_templates / ...\_assignees / ...\_routings**

ตารางที่เกี่ยวข้องกับ Workflow การส่งต่อเอกสาร (Req 3.5.4)

- **circulation_templates:** ตาราง Master เก็บแม่แบบสายงาน (เช่น "ส่งให้ CSC ตรวจสอบ")
- **circulation_template_assignees:** ตารางลูก เก็บขั้นตอนในแม่แบบ (เช่น Step 1: ส่งไป Org A, Step 2: ส่งไป Org B)
- **circulation_routings:** ตารางประวัติ (Log) การส่งต่อของเอกสารจริงตาม Workflow

---

## **7. 📤 Transmittals (เอกสารนำส่ง)**

#### **7.1. transmittals**

ตารางข้อมูลเฉพาะของเอกสารนำส่ง (เป็นตารางลูก 1:1 ของ correspondences)

| Column            | Type      | Key        | Description                                       |
| :---------------- | :-------- | :--------- | :------------------------------------------------ |
| correspondence_id | INT       | **PK**, FK | ID ของเอกสาร (FK \-> correspondences(id))         |
| purpose           | ENUM(...) |            | วัตถุประสงค์ (FOR_APPROVAL, FOR_INFORMATION, ...) |
| remarks           | TEXT      |            | หมายเหตุ                                          |

- **Foreign Keys (FK):** correspondence_id -> correspondences(id) (ON DELETE CASCADE)

---

#### **7.2. transmittal_items (ตารางเชื่อม)**

ตารางเชื่อมระหว่าง transmittals และเอกสารที่นำส่ง (M:N) **(ปรับปรุง V1.4.0)**

| Column                     | Type             | Key        | Description                                                     |
| :------------------------- | :--------------- | :--------- | :-------------------------------------------------------------- |
| **id**                     | **INT**          | **PK**     | **(ใหม่)** ID ของรายการ                                         |
| transmittal_id             | INT              | **FK**, UK | ID ของ Transmittal (FK \-> transmittals(correspondence_id))     |
| **item_correspondence_id** | INT              | **FK**, UK | **(เปลี่ยน)** ID ของเอกสารที่แนบไป (FK \-> correspondences(id)) |
| **quantity**               | **INT**          |            | **(ใหม่)** จำนวน                                                |
| **remarks**                | **VARCHAR(255)** |            | **(ใหม่)** หมายเหตุสำหรับรายการนี้                              |

- **Foreign Keys (FK):**
  - transmittal_id -> transmittals(correspondence_id) (ON DELETE CASCADE)
  - item_correspondence_id -> correspondences(id) (ON DELETE CASCADE)
- **Unique Keys (UK):** ux_transmittal_item (transmittal_id, item_correspondence_id)

---

## **8. 📎 File Management (ไฟล์แนบ)**

#### **8.1. attachments (Master)**

ตาราง "กลาง" เก็บไฟล์แนบทั้งหมดของระบบ (ตาม Requirements 3.9)

| Column              | Type         | Key    | Description                                   |
| :------------------ | :----------- | :----- | :-------------------------------------------- |
| id                  | INT          | **PK** | ID ของไฟล์แนบ                                 |
| original_filename   | VARCHAR(255) |        | ชื่อไฟล์ดั้งเดิมตอนอัปโหลด                    |
| stored_filename     | VARCHAR(255) |        | ชื่อไฟล์ที่เก็บจริงบน Server (ป้องกันชื่อซ้ำ) |
| file_path           | VARCHAR(500) |        | Path ที่เก็บไฟล์ (บน QNAP /share/dms-data/)   |
| mime_type           | VARCHAR(100) |        | ประเภทไฟล์ (เช่น application/pdf)             |
| file_size           | INT          |        | ขนาดไฟล์ (bytes)                              |
| uploaded_by_user_id | INT          | FK     | ผู้อัปโหลดไฟล์ (FK \-> users(user_id))        |

- **Foreign Keys (FK):** uploaded_by_user_id -> users(user_id) (ON DELETE CASCADE)

---

#### **8.2. correspondence_attachments (ตารางเชื่อม - ใหม่)**

ตารางเชื่อม correspondences กับ attachments (M:N)

| Column            | Type    | Key        | Description                               |
| :---------------- | :------ | :--------- | :---------------------------------------- |
| correspondence_id | INT     | **PK**, FK | ID ของเอกสาร (FK \-> correspondences(id)) |
| attachment_id     | INT     | **PK**, FK | ID ของไฟล์แนบ (FK \-> attachments(id))    |
| is_main_document  | BOOLEAN |            | (1 = ไฟล์หลัก)                            |

- **Foreign Keys (FK):** correspondence_id, attachment_id

---

#### **8.3. circulation_attachments (ตารางเชื่อม - ใหม่)**

ตารางเชื่อม circulations กับ attachments (M:N)

| Column           | Type    | Key        | Description                             |
| :--------------- | :------ | :--------- | :-------------------------------------- |
| circulation_id   | INT     | **PK**, FK | ID ของใบเวียน (FK \-> circulations(id)) |
| attachment_id    | INT     | **PK**, FK | ID ของไฟล์แนบ (FK \-> attachments(id))  |
| is_main_document | BOOLEAN |            | (1 = ไฟล์หลักของใบเวียน)                |

- **Foreign Keys (FK):** circulation_id, attachment_id

---

#### **8.4. shop_drawing_revision_attachments (ตารางเชื่อม - ใหม่)**

ตารางเชื่อม shop_drawing_revisions กับ attachments (M:N) **(ปรับปรุง V1.2.0)**

| Column                   | Type        | Key        | Description                                                      |
| :----------------------- | :---------- | :--------- | :--------------------------------------------------------------- |
| shop_drawing_revision_id | INT         | **PK**, FK | ID ของ Shop Drawing Revision (FK \-> shop_drawing_revisions(id)) |
| attachment_id            | INT         | **PK**, FK | ID ของไฟล์แนบ (FK \-> attachments(id))                           |
| file_type                | ENUM(...)   |            | ประเภทไฟล์ (PDF, DWG, SOURCE, OTHER)                             |
| **is_main_document**     | **BOOLEAN** |            | **(ใหม่)** (1 = ไฟล์หลัก)                                        |

- **Foreign Keys (FK):** shop_drawing_revision_id, attachment_id

---

#### **8.5. contract_drawing_attachments (ตารางเชื่อม - ใหม่)**

**(ใหม่)** ตารางเชื่อม contract_drawings กับ attachments (M:N)

| Column              | Type      | Key        | Description                                            |
| :------------------ | :-------- | :--------- | :----------------------------------------------------- |
| contract_drawing_id | INT       | **PK**, FK | ID ของ Contract Drawing (FK \-> contract_drawings(id)) |
| attachment_id       | INT       | **PK**, FK | ID ของไฟล์แนบ (FK \-> attachments(id))                 |
| file_type           | ENUM(...) |            | ประเภทไฟล์ (PDF, DWG, SOURCE, OTHER)                   |
| is_main_document    | BOOLEAN   |            | (1 = ไฟล์หลัก)                                         |

- **Foreign Keys (FK):**
  - contract_drawing_id -> contract_drawings(id) (ON DELETE CASCADE)
  - attachment_id -> attachments(id) (ON DELETE CASCADE)

---

## **9. 🔢 Document Numbering (การสร้างเลขที่เอกสาร)**

#### **9.1. document_number_formats (ตารางตั้งค่า - ใหม่)**

ตาราง Master เก็บ "รูปแบบ" Template ของเลขที่เอกสาร (ตาม Requirements 3.10.3)

| Column                 | Type         | Key    | Description                                           |
| :--------------------- | :----------- | :----- | :---------------------------------------------------- |
| id                     | INT          | **PK** | ID ของตาราง                                           |
| project_id             | INT          | FK, UK | โครงการ (FK \-> projects(id))                         |
| correspondence_type_id | INT          | FK, UK | ประเภทเอกสาร (FK \-> correspondence_types(id))        |
| format_template        | VARCHAR(255) |        | รูปแบบ Template (เช่น {ORG_CODE}-{TYPE_CODE}-{SEQ:4}) |
| description            | TEXT         |        | คำอธิบายรูปแบบนี้                                     |

- **Foreign Keys (FK):** project_id, correspondence_type_id
- **Unique Keys (UK):** uk_project_type (project_id, correspondence_type_id)

---

#### **9.2. document_number_counters (ตารางตัวนับ - ใหม่)**

ตารางเก็บ "ตัวนับ" (Running Number) ล่าสุด (ตาม Requirements 3.10.2)

| Column                     | Type | Key        | Description                                    |
| :------------------------- | :--- | :--------- | :--------------------------------------------- |
| project_id                 | INT  | **PK**, FK | โครงการ (FK \-> projects(id))                  |
| originator_organization_id | INT  | **PK**, FK | องค์กรผู้ส่ง (FK \-> organizations(id))        |
| correspondence_type_id     | INT  | **PK**, FK | ประเภทเอกสาร (FK \-> correspondence_types(id)) |
| current_year               | INT  | **PK**     | ปี ค.ศ. ของตัวนับ                              |
| last_number                | INT  |            | เลขที่ล่าสุดที่ใช้ไปแล้ว                       |

- **Foreign Keys (FK):** project_id, originator_organization_id, correspondence_type_id

---

## **10. ⚙️ System & Logs (ระบบและ Log)**

#### **10.1. tags**

ตาราง Master เก็บ Tags ทั้งหมดที่ใช้ในระบบ

| Column      | Type         | Key    | Description       |
| :---------- | :----------- | :----- | :---------------- |
| id          | INT          | **PK** | ID ของตาราง       |
| tag_name    | VARCHAR(100) | UK     | ชื่อ Tag          |
| description | TEXT         |        | คำอธิบายแท็ก      |
| created_at  | TIMESTAMP    |        | วันที่สร้าง       |
| updated_at  | TIMESTAMP    |        | วันที่แก้ไขล่าสุด |

- **Unique Keys (UK):** ux_tag_name (tag_name)

---

#### **10.2. correspondence_tags (ตารางเชื่อม)**

ตารางเชื่อมระหว่าง correspondences และ tags (M:N)

| Column            | Type | Key        | Description                               |
| :---------------- | :--- | :--------- | :---------------------------------------- |
| correspondence_id | INT  | **PK**, FK | ID ของเอกสาร (FK \-> correspondences(id)) |
| tag_id            | INT  | **PK**, FK | ID ของ Tag (FK \-> tags(id))              |

- **Foreign Keys (FK):** correspondence_id, tag_id

---

#### **10.3. audit_logs**

ตารางเก็บบันทึกการกระทำของผู้ใช้ (ตาม Requirements 6.1)

| Column       | Type         | Key    | Description                                                      |
| :----------- | :----------- | :----- | :--------------------------------------------------------------- |
| audit_id     | BIGINT       | **PK** | ID ของ Log                                                       |
| user_id      | INT          | FK     | ผู้กระทำ (FK \-> users(user_id))                                 |
| action       | VARCHAR(100) |        | การกระทำ (เช่น rfa.create, correspondence.update, login.success) |
| entity_type  | VARCHAR(50)  |        | ตาราง/โมดูล (เช่น 'rfa', 'correspondence')                       |
| entity_id    | VARCHAR(50)  |        | Primary ID ของระเบียนที่ได้รับผลกระทำ                            |
| details_json | JSON         |        | ข้อมูลบริบที่                                                    |
| ip_address   | VARCHAR(45)  |        | IP Address                                                       |
| user_agent   | VARCHAR(255) |        | User Agent                                                       |
| created_at   | TIMESTAMP    |        | เวลาที่กระทำ                                                     |

- **Foreign Keys (FK):** user_id -> users(user_id) (ON DELETE SET NULL)

---

#### **10.4. notifications (ตารางใหม่ - ตาม Requirements 6.7)**

ตารางสำหรับจัดการการแจ้งเตือน (Email/Line/System)

| Column            | Type                            | Key    | Description                       |
| :---------------- | :------------------------------ | :----- | :-------------------------------- |
| id                | INT                             | **PK** | ID ของการแจ้งเตือน                |
| user_id           | INT                             | FK     | ID ผู้ใช้ (FK \-> users(user_id)) |
| title             | VARCHAR(255)                    |        | หัวข้อการแจ้งเตือน                |
| message           | TEXT                            |        | รายละเอียดการแจ้งเตือน            |
| notification_type | ENUM('EMAIL', 'LINE', 'SYSTEM') |        | ประเภท (EMAIL, LINE, SYSTEM)      |
| is_read           | BOOLEAN                         |        | สถานะการอ่าน                      |
| entity_type       | VARCHAR(50)                     |        | เช่น 'rfa', 'circulation'         |
| entity_id         | INT                             |        | ID ของเอนทิตีที่เกี่ยวข้อง        |
| created_at        | TIMESTAMP                       |        | วันที่สร้าง                       |

- **Foreign Keys (FK):** user_id -> users(user_id)

---

#### **10.5. search_indices (ตารางใหม่ - ตาม Requirements 6.2)**

ตารางสำหรับจัดการดัชนีการค้นหาขั้นสูง (Full-text Search)

| Column      | Type        | Key    | Description                                |
| :---------- | :---------- | :----- | :----------------------------------------- |
| id          | INT         | **PK** | ID ของดัชนี                                |
| entity_type | VARCHAR(50) |        | ชนิดเอนทิตี (เช่น 'correspondence', 'rfa') |
| entity_id   | INT         |        | ID ของเอนทิตี                              |
| content     | TEXT        |        | เนื้อหาที่จะค้นหา                          |
| indexed_at  | TIMESTAMP   |        | วันที่สร้าง/อัปเดตัชนี                     |

- **Indexes:** `idx_entity (entity_type, entity_id)`, `FULLTEXT INDEX idx_content (content)`

---

#### **10.6. backup_logs (ตารางใหม่ - ตาม Requirements 6.6)**

ตารางสำหรับบันทึกประวัติการสำรองข้อมูล

| Column        | Type                                   | Key    | Description                    |
| :------------ | :------------------------------------- | :----- | :----------------------------- |
| id            | INT                                    | **PK** | ID ของการสำรอง                 |
| backup_type   | ENUM('DATABASE', 'FILES', 'FULL')      |        | ประเภท (DATABASE, FILES, FULL) |
| backup_path   | VARCHAR(500)                           |        | ตำแหน่งไฟล์สำรอง               |
| file_size     | BIGINT                                 |        | ขนาดไฟล์                       |
| status        | ENUM('STARTED', 'COMPLETED', 'FAILED') |        | สถานะ                          |
| started_at    | TIMESTAMP                              |        | เวลาเริ่มต้น                   |
| completed_at  | TIMESTAMP                              |        | เวลาเสร็จสิ้น                  |
| error_message | TEXT                                   |        | ข้อความผิดพลาด (ถ้ามี)         |

---

## **11. 📊 Views & Procedures (วิว และ โปรซีเดอร์)**

#### **11.1. sp_get_next_document_number (Procedure)**

**(ใหม่)** Stored Procedure ดึงเดียวที่ใช้ในระบบ

- **หน้าที่:** ดึงเลขที่เอกสารถัดไป (Next Running Number) จากตาราง document_number_counters
- **ตรรกะ:** ใช้ `SELECT ... FOR UPDATE` เพื่อ "ล็อก" แถว ป้องกัน Race Condition (การที่ผู้ใช้ 2 คนได้เลขที่ซ้ำกัน) ตาม Requirement 3.10.2

---

#### **11.2. v_current_correspondences (View)**

- **หน้าที่:** แสดง Revision "ปัจจุบัน" (is_current \= TRUE) ของ correspondences ทั้งหมด (ที่ไม่ใช่ RFA)

---

#### **11.3. v_current_rfas (View)**

- **หน้าที่:** แสดง Revision "ปัจจุบัน" (is_current \= TRUE) ของ rfa_revisions ทั้งหมด

---

#### **11.4. v_contract_parties_all (View)**

- **หน้าที่:** แสดงความสัมพันธ์ทั้งหมดระหว่าง Contract, Project, และ Organization

---

#### **11.5. v_user_tasks (View - ใหม่)**

**(ใหม่)**

- **หน้าที่:** แสดงรายการ "งานของฉัน" (My Tasks) ที่ยังไม่เสร็จ (ตาม Requirement 5.3)
- **ตรรกะ:** JOIN ตาราง circulations กับ circulation_assignees (ที่ is_completed \= FALSE)

---

#### **11.6. v_audit_log_details (View - ใหม่)**

**(ใหม่)**

- **หน้าที่:** แสดง audit_logs พร้อมข้อมูล username และ email ของผู้กระทำ

---

#### **11.7. v_user_all_permissions (View - ใหม่)**

**(ใหม่)**

- **หน้าที่:** รวมสิทธิ์ทั้งหมด (Global \+ Project) ของผู้ใช้ทุกคน เพื่อให้ Backend ตรวจสอบสิทธิ์ได้ง่าย
- **ตรรกะ:** UNION ข้อมูลจาก user_roles และ user_project_roles

---
