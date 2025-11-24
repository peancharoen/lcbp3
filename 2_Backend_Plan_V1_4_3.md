# 📋 **แผนการพัฒนา Backend (NestJS) - LCBP3-DMS v1.4.3 (ฉบับปรับปรุง)**

**สถานะ:** FINAL GUIDELINE Rev.01
**วันที่:** 2025-11-22
**อ้างอิง:** Requirements v1.4.3 & FullStackJS Guidelines v1.4.3
**Classification:** Internal Technical Documentation

-----

## 🎯 **ภาพรวมโครงการ**

พัฒนา Backend สำหรับระบบบริหารจัดการเอกสารโครงการ (Document Management System) ที่มีความปลอดภัยสูง รองรับการทำงานพร้อมกัน (Concurrency) ได้อย่างถูกต้องแม่นยำ มีสถาปัตยกรรมที่ยืดหยุ่นต่อการขยายตัว และรองรับการจัดการเอกสารที่ซับซ้อน มีระบบ Workflow การอนุมัติ และการควบคุมสิทธิ์แบบ RBAC 4 ระดับ พร้อมมาตรการความปลอดภัยที่ทันสมัย

-----

## 📐 **สถาปัตยกรรมระบบ**

### **Technology Stack (Updated)**

- **Framework:** NestJS (TypeScript, ESM)
- **Database:** MariaDB 10.11 (ใช้ Virtual Columns)
- **ORM:** TypeORM (ใช้ Optimistic Locking)
- **Authentication:** JWT + Passport
- **Authorization:** CASL (RBAC 4-level)
- **File Upload:** Multer + Virus Scanning (ClamAV) + Two-Phase Storage
- **Search:** Elasticsearch
- **Notification:** Nodemailer + n8n (Line Integration) + BullMQ Queue
- **Caching/Locking:** Redis (Redlock) สำหรับ Distributed Locking
- **Queue:** BullMQ (Redis) สำหรับ Notification Batching และ Async Jobs
- **Resilience:** Circuit Breaker, Retry Patterns
- **Security:** Helmet, CSRF Protection, Rate Limiting, Idempotency
- **Monitoring:** Winston, Health Checks, Metrics
- **Scheduling:** @nestjs/schedule (Cron Jobs)
- **Documentation:** Swagger
- **Validation:** Zod / Class-validator

### **โครงสร้างโมดูล (Domain-Driven)**

```tree
src/
├── common/                    # Shared Module
│   ├── auth/                 # JWT, Guards, RBAC
│   ├── config/               # Configuration Management
│   ├── decorators/           # @RequirePermission, @RateLimit
│   ├── entities/             # Base Entities
│   ├── exceptions/           # Global Filters
│   ├── file-storage/         # FileStorageService (Virus Scanning + Two-Phase)
│   ├── guards/               # RBAC Guard, RateLimitGuard
│   ├── interceptors/         # Audit, Transform, Performance, Idempotency
│   ├── resilience/           # Circuit Breaker, Retry Patterns
│   ├── security/             # Input Validation, XSS Protection
│   ├── idempotency/          # [New] Idempotency Logic
│   └── maintenance/          # [New] Maintenance Mode Guard
├── modules/
│   ├── user/                 # Users, Roles, Permissions
│   ├── project/              # Projects, Contracts, Organizations
│   ├── master/               # Master Data Management
│   ├── correspondence/       # Correspondence Management
│   ├── rfa/                  # RFA & Workflows
│   ├── drawing/              # Shop/Contract Drawings
│   ├── circulation/          # Internal Circulation
│   ├── transmittal/          # Transmittals
│   ├── search/               # Elasticsearch
│   ├── monitoring/           # Metrics, Health Checks
│   ├── workflow-engine/      # [New] Unified Workflow Logic
│   ├── document-numbering/   # [Update] Double-Locking Logic
│   ├── notification/         # [Update] Queue & Digest
│   └── file-storage/         # [Update] Two-Phase Commit
└── database/                 # Migrations & Seeds
```

-----

## 🗓️ **แผนการพัฒนาแบบ Phase-Based**

- *(Dependency Diagram ถูกละไว้เพื่อประหยัดพื้นที่ เนื่องจากมีการอ้างอิงจากแผนเดิม)*

## **Phase 0: Infrastructure & Configuration (สัปดาห์ที่ 1)**

**Milestone:** โครงสร้างพื้นฐานพร้อม รองรับ Secrets ที่ปลอดภัย และ Redis พร้อมใช้งาน

### **Phase 0: Tasks**

- **[ ] T0.1 Secure Configuration Setup**

  - [ ] ปรับปรุง `ConfigModule` ให้รองรับการอ่านค่าจาก Environment Variables
  - [ ] สร้าง Template `docker-compose.override.yml.example` สำหรับ Dev
  - [ ] Validate Config ด้วย Joi/Zod ตอน Start App (Throw error ถ้าขาด Secrets)
  - [ ] **Security:** Setup network segmentation และ firewall rules
  - [ ] **Deliverable:** Configuration Management พร้อมใช้งานอย่างปลอดภัย
  - [ ] **Dependencies:** None (Task เริ่มต้น)

- **[ ] T0.2 Redis & Queue Infrastructure**

  - [ ] Setup Redis Container
  - [ ] Setup BullMQ Module ใน NestJS สำหรับจัดการ Background Jobs
  - [ ] Setup Redis Client สำหรับ Distributed Lock (Redlock)
  - [ ] **Security:** Setup Redis authentication และ encryption
  - [ ] **Deliverable:** Redis และ Queue System พร้อมใช้งาน
  - [ ] **Dependencies:** T0.1

- **[ ] T0.3 Setup Database Connection**

  - [ ] Import SQL Schema v1.4.2 เข้า MariaDB
  - [ ] Run Seed Data (organizations, users, roles, permissions)
  - [ ] Configure TypeORM ใน AppModule
  - [ ] **Security:** Setup database connection encryption
  - [ ] ทดสอบ Connection
  - [ ] **Deliverable:** Database พร้อมใช้งาน, มี Seed Data
  - [ ] **Dependencies:** T0.1

- **[ ] T0.4 Setup Git Repository**

  - [ ] สร้าง Repository ใน Gitea (git.np-dms.work)
  - [ ] Setup .gitignore, README.md, SECURITY.md
  - [ ] Commit Initial Project
  - [ ] **Deliverable:** Code อยู่ใน Version Control
  - [ ] **Dependencies:** T0.1, T0.2, T0.3

-----

## **Phase 1: Core Foundation & Security (สัปดาห์ที่ 2-3)**

**Milestone:** ระบบ Authentication, Authorization, Idempotency พื้นฐาน และ Security Baseline

### **Phase 1: Tasks**

- **[ ] T1.1 CommonModule - Base Infrastructure**

  - [ ] สร้าง Base Entity (id, created_at, updated_at, deleted_at)
  - [ ] สร้าง Global Exception Filter (ไม่เปิดเผย sensitive information)
  - [ ] สร้าง Response Transform Interceptor
  - [ ] สร้าง Audit Log Interceptor
  - [ ] **[New] Idempotency Interceptor:** ตรวจสอบ Header `Idempotency-Key` และ Cache Response เดิมใน Redis
  - [ ] **[New] Maintenance Mode Middleware:** ตรวจสอบ Flag ใน **Redis Key** เพื่อ Block API ระหว่างปรับปรุงระบบ **(Admin ใช้ Redis/Admin UI ในการ Toggle สถานะ)**
  - [ ] สร้าง RequestContextService - สำหรับเก็บข้อมูลระหว่าง Request
  - [ ] สร้าง ConfigService - Centralized configuration management
  - [ ] สร้าง CryptoService - สำหรับ encryption/decryption
  - [ ] **Security:** Implement input validation pipeline
  - [ ] **Deliverable:** Common Services พร้อมใช้ รวมถึง Idempotency และ Maintenance Mode
  - [ ] **Dependencies:** T0.2, T0.3

- **[ ] T1.2 AuthModule - JWT Authentication**

  - [ ] สร้าง Entity: User
  - [ ] สร้าง AuthService:
    - [ ] login(username, password) → JWT Token
    - [ ] validateUser(username, password) → User | null
    - [ ] Password Hashing (bcrypt) + salt
  - [ ] สร้าง JWT Strategy (Passport)
  - [ ] สร้าง JwtAuthGuard
  - [ ] สร้าง Controllers:
    - [ ] POST /auth/login → { access_token, refresh_token }
    - [ ] POST /auth/register → Create User (Admin only)
    - [ ] POST /auth/refresh → Refresh token
    - [ ] POST /auth/logout → Revoke token
    - [ ] GET /auth/profile (Protected)
  - [ ] **Security:** Implement rate limiting สำหรับ authentication endpoints
  - [ ] **Deliverable:** ล็อกอิน/ล็อกเอาต์ทำงานได้อย่างปลอดภัย
  - [ ] **Dependencies:** T1.1, T0.3

- **[ ] T1.3 UserModule - User Management**

  - [ ] สร้าง Entities: User, Role, Permission, UserRole, UserAssignment, **UserPreference**
  - [ ] สร้าง UserService CRUD (พร้อม soft delete)
  - [ ] สร้าง RoleService CRUD
  - [ ] สร้าง PermissionService (Read-Only, จาก Seed)
  - [ ] สร้าง UserAssignmentService - สำหรับจัดการ user assignments ตาม scope
  - [ ] สร้าง **UserPreferenceService** - สำหรับจัดการการตั้งค่า Notification และ UI
  - [ ] สร้าง Controllers:
    - [ ] GET /users → List Users (Paginated)
    - [ ] GET /users/:id → User Detail
    - [ ] POST /users → Create User (ต้องบังคับเปลี่ยน password ครั้งแรก)
    - [ ] PUT /users/:id → Update User
    - [ ] DELETE /users/:id → Soft Delete
    - [ ] GET /roles → List Roles
    - [ ] POST /roles → Create Role (Admin)
    - [ ] PUT /roles/:id/permissions → Assign Permissions
  - [ ] **Security:** Implement permission checks สำหรับ user management
  - [ ] **Deliverable:** จัดการผู้ใช้, Role, และ Preferences ได้
  - [ ] **Dependencies:** T1.1, T1.2

- **[ ] T1.4 RBAC Guard - 4-Level Authorization**

  - [ ] สร้าง @RequirePermission() Decorator
  - [ ] สร้าง RbacGuard ที่ตรวจสอบ 4 ระดับ:
    - [ ] Global Permissions
    - [ ] Organization Permissions
    - [ ] Project Permissions
    - [ ] Contract Permissions
  - [ ] Permission Hierarchy Logic
  - [ ] Integration กับ CASL
  - [ ] **Security:** Implement audit logging สำหรับ permission checks
  - [ ] **Deliverable:** ระบบสิทธิ์ทำงานได้ทั้ง 4 ระดับ
  - [ ] **Dependencies:** T1.1, T1.3

- **[ ] T1.5 ProjectModule - Base Structures**

  - [ ] สร้าง Entities:
    - [ ] Organization
    - [ ] Project
    - [ ] Contract
    - [ ] ProjectOrganization (Junction)
    - [ ] ContractOrganization (Junction)
  - [ ] สร้าง Services & Controllers:
    - [ ] GET /organizations → List
    - [ ] POST /projects → Create (Superadmin)
    - [ ] GET /projects/:id/contracts → List Contracts
    - [ ] POST /projects/:id/contracts → Create Contract
  - [ ] **Security:** Implement data isolation ระหว่าง organizations
  - [ ] **Deliverable:** จัดการโครงสร้างโปรเจกต์ได้
  - [ ] **Dependencies:** T1.1, T1.2, T0.3

-----

## **Phase 2: High-Integrity Data & File Management (สัปดาห์ที่ 4)**

**Milestone:** Master Data, ระบบจัดการไฟล์แบบ Transactional, Document Numbering ที่ไม่มี Race Condition, JSON details system พร้อมใช้งาน

### **Phase 2: Tasks**

- **[ ] T2.1 Virtual Columns for JSON**

  - [ ] ออกแบบ Migration Script สำหรับตารางที่มี JSON Details
  - [ ] เพิ่ม **Generated Columns (Virtual)** สำหรับฟิลด์ที่ใช้ Search บ่อยๆ (เช่น `project_id`, `type`) พร้อม Index
  - [ ] **Security:** Implement admin-only access สำหรับ master data
  - [ ] **Deliverable:** JSON Data Search Performance ดีขึ้น
  - [ ] **Dependencies:** T0.3, T1.1, T1.5

- **[ ] T2.2 FileStorageService - Two-Phase Storage**

  - [ ] สร้าง Attachment Entity
  - [ ] สร้าง FileStorageService:
    - [ ] **Phase 1 (Upload):** API รับไฟล์ → Scan Virus → Save ลง `temp/` → Return `temp_id`
    - [ ] **Phase 2 (Commit):** Method `commitFiles(tempIds[])` → ย้ายจาก `temp/` ไป `permanent/{YYYY}/{MM}/` → Update DB
    - [ ] File type validation (white-list: PDF, DWG, DOCX, XLSX, PPTX, ZIP)
    - [ ] File size check (max 50MB)
    - [ ] Generate checksum (SHA-256)
    - [ ] **Cleanup Job:** สร้าง Cron Job ลบไฟล์ใน `temp/` ที่ค้างเกิน 24 ชม. **โดยตรวจสอบจากคอลัมน์ `expires_at` ในตาราง `attachments`**
  - [ ] สร้าง Controller:
    - [ ] POST /files/upload → { temp_id } (Protected)
    - [ ] POST /files/commit → { attachment_id, url } (Protected)
    - [ ] GET /files/:id/download → File Stream (Protected + Expiration)
  - [ ] **Security:** Access Control - ตรวจสอบสิทธิ์ผ่าน Junction Table
  - [ ] **Deliverable:** อัปโหลด/ดาวน์โหลดไฟล์ได้อย่างปลอดภัย แบบ Transactional
  - [ ] **Dependencies:** T1.1, T1.4

- **[ ] T2.3 DocumentNumberingModule - Double-Lock Mechanism**

  - [ ] สร้าง Entities:
    - [ ] DocumentNumberFormat
    - [ ] DocumentNumberCounter
  - [ ] สร้าง DocumentNumberingService:
    - [ ] generateNextNumber(projectId, orgId, typeId, year) → string
    - [ ] ใช้ **Double-Lock Mechanism**:
            1. Acquire **Redis Lock** (Key: `doc_num:{project}:{type}`)
            2. Read DB & Calculate Next Number
            3. Update DB with **Optimistic Lock** Check (ใช้ `@VersionColumn()`)
            4. Release Redis Lock
            5. Retry on Failure ด้วย exponential backoff
    - [ ] Fallback mechanism เมื่อการขอเลขล้มเหลว
    - [ ] Format ตาม Template: {ORG_CODE}-{TYPE_CODE}-{YEAR_SHORT}-{SEQ:4}
  - **ไม่มี Controller** (Internal Service เท่านั้น)
  - [ ] **Security:** Implement audit log ทุกครั้งที่มีการ generate เลขที่
  - [ ] **Deliverable:** Service สร้างเลขที่เอกสารได้ถูกต้องและปลอดภัย ไม่มี Race Condition
  - [ ] **Dependencies:** T1.1, T0.3

- **[ ] T2.4 SecurityModule - Enhanced Security**

  - [ ] สร้าง Input Validation Service:
    - [ ] XSS Prevention
    - [ ] SQL Injection Prevention
    - [ ] CSRF Protection
  - [ ] สร้าง RateLimitGuard:
    - [ ] Implement rate limiting ตาม strategy (anonymous: 100/hr, authenticated: 500-5000/hr)
    - [ ] Different limits สำหรับ endpoints ต่างๆ
  - [ ] สร้าง Security Headers Middleware
  - [ ] **Security:** Implement content security policy (CSP)
  - [ ] **Deliverable:** Security layers ทำงานได้
  - [ ] **Dependencies:** T1.1

- **[ ] T2.5 JSON Details & Schema Management**

  - [ ] T2.5.1 JsonSchemaModule - Schema Management: สร้าง Service สำหรับ Validate, get, register JSON schemas
  - [ ] T2.5.2 DetailsService - Data Processing: สร้าง Service สำหรับ sanitize, transform, compress/decompress JSON
  - [ ] T2.5.3 JSON Security & Validation: Implement security checks และ validation rules
  - [ ] **Deliverable:** JSON schema system ทำงานได้
  - [ ] **Dependencies:** T1.1

-----

## **Phase 3: Unified Workflow Engine (สัปดาห์ที่ 5-6)**

**Milestone:** ระบบ Workflow กลางที่รองรับทั้ง Routing ปกติ และ RFA

### **Phase 3: Tasks**

- **[ ] T3.1 WorkflowEngineModule (New)**

  - [ ] ออกแบบ Generic Schema สำหรับ Workflow State Machine
  - [ ] Implement Service: `initializeWorkflow()`, `processAction()`, `getNextStep()`
  - [ ] รองรับ Logic การ "ข้ามขั้นตอน" และ "ส่งกลับ" ภายใน Engine เดียว
  - [ ] **Security:** Implement audit logging สำหรับ workflow actions
  - [ ] **Deliverable:** Unified Workflow Engine พร้อมใช้งาน
  - [ ] **Dependencies:** T1.1

- **[ ] T3.2 CorrespondenceModule - Basic CRUD**

  - [ ] สร้าง Entities (Correspondence, Revision, Recipient, Tag, Reference, Attachment)
  - [ ] สร้าง CorrespondenceService (Create with Document Numbering, Update with new Revision, Soft Delete)
  - [ ] สร้าง Controllers (POST/GET/PUT/DELETE /correspondences)
  - [ ] [New] Implement Impersonation Logic: ตรวจสอบ originatorId ใน DTO หากมีการส่งมา ต้องเช็คว่า User ปัจจุบันมีสิทธิ์กระทำการแทนหรือไม่ (Superadmin)
  - [ ] **Security:** Implement permission checks สำหรับ document access
  - [ ] **Deliverable:** สร้าง/แก้ไข/ดูเอกสารได้
  - [ ] **Dependencies:** T1.1, T1.2, T1.3, T1.4, T1.5, T2.3, T2.2, T2.5

- **[ ] T3.3 CorrespondenceModule - Advanced Features**

  - [ ] Implement Status Transitions (DRAFT → SUBMITTED)
  - [ ] Implement References (Link Documents)
  - [ ] Implement Search (Basic)
  - [ ] **Security:** Implement state transition validation
  - [ ] **Deliverable:** Workflow พื้นฐานทำงานได้
  - [ ] **Dependencies:** T3.2

- **[ ] T3.4 Correspondence Integration with Workflow**

  - [ ] เชื่อมต่อ `CorrespondenceService` เข้ากับ `WorkflowEngineModule`
  - [ ] ย้าย Logic การ Routing เดิมมาใช้ Engine ใหม่
  - [ ] สร้าง API endpoints สำหรับ Frontend (Templates, Pending Tasks, Bulk Action)
  - [ ] **Security:** Implement permission checks สำหรับ workflow operations
  - [ ] **Deliverable:** ระบบส่งต่อเอกสารทำงานได้สมบูรณ์ด้วย Unified Engine
  - [ ] **Dependencies:** T3.1, T3.2

-----

## **Phase 4: Drawing & Advanced Workflows (สัปดาห์ที่ 7-8)**

**Milestone:** การจัดการแบบและ RFA โดยใช้ Unified Engine

### **Phase 4: Tasks**

- **[ ] T4.1 DrawingModule - Contract Drawings**

  - [ ] สร้าง Entities (ContractDrawing, Volume, Category, SubCategory, Attachment)
  - [ ] สร้าง ContractDrawingService CRUD
  - [ ] สร้าง Controllers (GET/POST /drawings/contract)
  - [ ] **Security:** Implement access control สำหรับ contract drawings
  - [ ] **Deliverable:** จัดการ Contract Drawings ได้
  - [ ] **Dependencies:** T1.1, T1.2, T1.4, T1.5, T2.2

- **[ ] T4.2 DrawingModule - Shop Drawings**

  - [ ] สร้าง Entities (ShopDrawing, Revision, Main/SubCategory, ContractRef, RevisionAttachment)
  - [ ] สร้าง ShopDrawingService CRUD (รวมการสร้าง Revision)
  - [ ] สร้าง Controllers (GET/POST /drawings/shop, /drawings/shop/:id/revisions)
  - [ ] Link Shop Drawing Revision → Contract Drawings
  - [ ] **Security:** Implement virus scanning สำหรับ drawing files
  - [ ] **Deliverable:** จัดการ Shop Drawings และ Revisions ได้
  - [ ] **Dependencies:** T4.1

- **[ ] T5.1 RfaModule with Unified Workflow**

  - [ ] สร้าง Entities (Rfa, RfaRevision, RfaItem, RfaWorkflowTemplate/Step)
  - [ ] สร้าง RfaService (Create RFA, Link Shop Drawings)
  - [ ] Implement RFA Workflow โดยใช้ Configuration ของ `WorkflowEngineModule`
  - [ ] สร้าง Controllers (POST/GET /rfas, POST /rfas/:id/workflow/...)
  - [ ] **Resilience:** Implement circuit breaker สำหรับ notification services
  - [ ] **Deliverable:** RFA Workflow ทำงานได้ด้วย Unified Engine
  - [ ] **Dependencies:** T3.2, T4.2, T2.5, T6.2

-----

## **Phase 5: Workflow Systems & Resilience (สัปดาห์ที่ 8-9)**

**Milestone:** ระบบ Workflow ทั้งหมดพร้อม Resilience Patterns

### **Phase 5: Tasks**

- **[ ] T5.2 CirculationModule - Internal Routing**

  - [ ] สร้าง Entities (Circulation, Template, Routing, Attachment)
  - [ ] สร้าง CirculationService (Create 1:1 with Correspondence, Assign User, Complete/Close Step)
  - [ ] สร้าง Controllers (POST/GET /circulations, POST /circulations/:id/steps/...)
  - [ ] **Resilience:** Implement retry mechanism สำหรับ assignment notifications
  - [ ] **Deliverable:** ใบเวียนภายในองค์กรทำงานได้
  - [ ] **Dependencies:** T3.2, T2.5, T6.2

- **[ ] T5.3 TransmittalModule - Document Forwarding**

  - [ ] สร้าง Entities (Transmittal, TransmittalItem)
  - [ ] สร้าง TransmittalService (Create Correspondence + Transmittal, Link Multiple Correspondences)
  - [ ] สร้าง Controllers (POST/GET /transmittals)
  - [ ] **Security:** Implement access control สำหรับ transmittal items
  - [ ] **Deliverable:** สร้าง Transmittal ได้
  - [ ] **Dependencies:** T3.2

-----

## **Phase 6: Notification & Resilience (สัปดาห์ที่ 9)**

**Milestone:** ระบบแจ้งเตือนแบบ Digest และการจัดการข้อมูลขนาดใหญ่

### **Phase 6: Tasks**

- **[ ] T6.1 SearchModule - Elasticsearch Integration**

  - [ ] Setup Elasticsearch Container
  - [ ] สร้าง SearchService (index/update/delete documents, search)
  - [ ] Index ทุก Document Type
  - [ ] สร้าง Controllers (GET /search)
  - [ ] **Resilience:** Implement circuit breaker สำหรับ Elasticsearch
  - [ ] **Deliverable:** ค้นหาขั้นสูงทำงานได้
  - [ ] **Dependencies:** T3.2, T5.1, T4.2, T5.2, T5.3

- **[ ] T6.2 Notification Queue & Digest**

  - [ ] สร้าง NotificationService (sendEmail/Line/System)
  - [ ] **Producer:** Push Event ลง BullMQ Queue
  - [ ] **Consumer:** จัดกลุ่ม Notification (Digest Message) และส่งผ่าน Email/Line
  - [ ] Integrate กับ Workflow Events (แจ้ง Recipients, Assignees, Deadline)
  - [ ] สร้าง Controllers (GET /notifications, PUT /notifications/:id/read)
  - [ ] **Resilience:** Implement retry mechanism ด้วย exponential backoff
  - [ ] **Deliverable:** ระบบแจ้งเตือนทำงานได้แบบ Digest
  - [ ] **Dependencies:** T1.1, T6.4

- **[ ] T6.3 MonitoringModule - Observability**

  - [ ] สร้าง Health Check Controller (GET /health)
  - [ ] สร้าง Metrics Service (API response times, Error rates)
  - [ ] สร้าง Performance Interceptor (Track request duration)
  - [ ] สร้าง Logging Service (Structured logging)
  - [ ] **Deliverable:** Monitoring system ทำงานได้
  - [ ] **Dependencies:** T1.1

- **[ ] T6.4 ResilienceModule - Circuit Breaker & Retry**

  - [ ] สร้าง Circuit Breaker Service (@CircuitBreaker() decorator)
  - [ ] สร้าง Retry Service (@Retry() decorator)
  - [ ] สร้าง Fallback Strategies
  - [ ] Implement สำหรับ Email, LINE, Elasticsearch, Virus Scanning
  - [ ] **Deliverable:** Resilience patterns ทำงานได้
  - [ ] **Dependencies:** T1.1

- **[ ] T6.5 Data Partitioning Strategy**

  - [ ] ออกแบบ Table Partitioning สำหรับ `audit_logs` และ `notifications` (แบ่งตาม Range: Year)
  - [ ] เขียน Raw SQL Migration สำหรับสร้าง Partition Table
  - [ ] **Deliverable:** Database Performance และ Scalability ดีขึ้น
  - [ ] **Dependencies:** T0.3

-----

## **Phase 7: Testing & Hardening (สัปดาห์ที่ 10-12)**

**Milestone:** ทดสอบความทนทานต่อ Race Condition, Security, และ Performance

### **Phase 7: Tasks**

- **[ ] T7.1 Concurrency Testing**

  - [ ] เขียน Test Scenarios ยิง Request ขอเลขที่เอกสารพร้อมกัน 100 Request (ต้องไม่ซ้ำและไม่ข้าม)
  - [ ] ทดสอบ Optimistic Lock ทำงานถูกต้องเมื่อ Redis ถูกปิด
  - [ ] ทดสอบ File Upload พร้อมกันหลายไฟล์
  - [ ] **Deliverable:** ระบบทนทานต่อ Concurrency Issues

- **[ ] T7.2 Transaction Integrity Testing**

  - [ ] ทดสอบ Upload ไฟล์แล้ว Kill Process ก่อน Commit
  - [ ] ทดสอบ Two-Phase File Storage ทำงานถูกต้อง
  - [ ] ทดสอบ Database Transaction Rollback Scenarios
  - [ ] **Deliverable:** Data Integrity รับประกันได้

- **[ ] T7.3 Security & Idempotency Test**

  - [ ] ทดสอบ Replay Attack โดยใช้ `Idempotency-Key` ซ้ำ
  - [ ] ทดสอบ Maintenance Mode Block API ได้จริง
  - [ ] ทดสอบ RBAC 4-Level ทำงานถูกต้อง 100%
  - [ ] **Deliverable:** Security และ Idempotency ทำงานได้ตาม设计要求

- **[ ] T7.4 Unit Testing (80% Coverage)**

- **[ ] T7.5 Integration Testing**

- **[ ] T7.6 E2E Testing**

- **[ ] T7.7 Performance Testing**

  - [ ] Load Testing: 100 concurrent users
  - [ ] **(สำคัญ)** การจูนและทดสอบ Load Test จะต้องทำในสภาพแวดล้อมที่จำลอง Spec ของ QNAP Server (TS-473A, AMD Ryzen V1500B) เพื่อให้ได้ค่า Response Time และ Connection Pool ที่เที่ยงตรง
  - [ ] Stress Testing
  - [ ] Endurance Testing
  - [ ] **Deliverable:** Performance targets บรรลุ

- **[ ] T7.8 Security Testing**

  - [ ] Penetration Testing (OWASP Top 10)
  - [ ] Security Audit (Code review, Dependency scanning)
  - [ ] File Upload Security Testing
  - [ ] **Deliverable:** Security tests ผ่าน

- **[ ] T7.9 Performance Optimization**

  - [ ] Implement Caching (Master Data, User Permissions, Search Results)
  - [ ] Database Optimization (Review Indexes, Query Optimization, Pagination)
  - [ ] **Deliverable:** Response Time < 200ms (90th percentile)

-----

## **Phase 8: Documentation & Deployment (สัปดาห์ที่ 14)**

**Milestone:** เอกสารและ Deploy สู่ Production พร้อม Security Hardening

### **Phase 8: Tasks**

- **[ ] T8.1 API Documentation (Swagger)**
- **[ ] T8.2 Technical Documentation**
- **[ ] T8.3 Security Hardening**
- **[ ] T8.4 Deployment Preparation (QNAP Setup, Nginx Proxy Manager)**
- **[ ] T8.5 Production Deployment**
- **[ ] T8.6 Handover to Frontend Team**

-----

## 📊 **สรุป Timeline**

| Phase   | ระยะเวลา     | จำนวนงาน      | Output หลัก                                     |
| :------ | :----------- | :----------- | :--------------------------------------------- |
| Phase 0 | 1 สัปดาห์      | 4            | Infrastructure Ready + Security Base           |
| Phase 1 | 2 สัปดาห์      | 5            | Auth & User Management + RBAC + Idempotency    |
| Phase 2 | 1 สัปดาห์      | 5            | High-Integrity Data & File Management          |
| Phase 3 | 2 สัปดาห์      | 4            | Unified Workflow Engine + Correspondence       |
| Phase 4 | 2 สัปดาห์      | 3            | Drawing Management + RFA with Unified Workflow |
| Phase 5 | 2 สัปดาห์      | 2            | Workflow Systems + Resilience                  |
| Phase 6 | 1 สัปดาห์      | 5            | Notification & Resilience + Data Partitioning  |
| Phase 7 | 3 สัปดาห์      | 9            | Testing & Hardening                            |
| Phase 8 | 1 สัปดาห์      | 6            | Documentation & Deploy                         |
| **รวม** | **15 สัปดาห์** | **39 Tasks** | **Production-Ready Backend v1.4.2**            |

## **Document Control:**

- **Document:** Backend Development Plan v1.4.3
- **Version:** 1.4
- **Date:** 2025-11-22
- **Author:** NAP LCBP3-DMS & Gemini
- **Status:** FINAL
- **Classification:** Internal Technical Documentation
- **Approved By:** Nattanin

-----

`End of Backend Development Plan v1.4.3`
