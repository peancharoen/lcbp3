# 📋 แผนการพัฒนา Backend (NestJS) - LCBP3-DMS v1.4.0

## 🎯 ภาพรวมโครงการ

พัฒนา Backend สำหรับระบบบริหารจัดการเอกสารโครงการ (Document Management System) ที่รองรับการจัดการเอกสารที่ซับซ้อน มีระบบ Workflow การอนุมัติ และการควบคุมสิทธิ์แบบ RBAC 3 ระดับ

---

## 📐 สถาปัตยกรรมระบบ

### Technology Stack

- **Framework:** NestJS (TypeScript, ESM)
- **Database:** MariaDB 10.11
- **ORM:** TypeORM
- **Authentication:** JWT + Passport
- **Authorization:** CASL (RBAC)
- **File Upload:** Multer
- **Search:** Elasticsearch
- **Notification:** Nodemailer + n8n (Line Integration)
- **Scheduling:** @nestjs/schedule (Cron Jobs)
- **Documentation:** Swagger

### โครงสร้างโมดูล (Domain-Driven)

```tree
src/
├── common/                    # Shared Module
│   ├── auth/                 # JWT, Guards
│   ├── config/               # Configuration
│   ├── decorators/           # @RequirePermission
│   ├── entities/             # Base Entities
│   ├── exceptions/           # Global Filters
│   ├── file-storage/         # FileStorageService
│   ├── guards/               # RBAC Guard
│   ├── interceptors/         # Audit, Transform
│   └── services/             # Notification, etc.
├── modules/
│   ├── user/                 # Users, Roles, Permissions
│   ├── project/              # Projects, Contracts, Organizations
│   ├── master/               # Master Data
│   ├── correspondence/       # Correspondence Management
│   ├── rfa/                  # RFA & Workflows
│   ├── drawing/              # Shop/Contract Drawings
│   ├── circulation/          # Internal Circulation
│   ├── transmittal/          # Transmittals
│   ├── search/               # Elasticsearch
│   └── document-numbering/   # Internal Service
└── database/                 # Migrations & Seeds
```

---

## 🗓️ แผนการพัฒนาแบบ Phase-Based

## **Phase 0: Infrastructure Setup (สัปดาห์ที่ 1)**

Milestone: สร้างโครงสร้างพื้นฐานและเชื่อมต่อ Services

### Phase 0: Tasks

- **[✅]T0.1 Setup QNAP Container Station**
  - สร้าง Docker Network: `lcbp3`
  - Setup docker-compose.yml สำหรับ:
    - MariaDB (db.np-dms.work)
    - PHPMyAdmin (pma.np-dms.work)
    - Backend (backend.np-dms.work)
    - Nginx Proxy Manager (npm.np-dms.work)
  - กำหนด Environment Variables ใน docker-compose.yml (ไม่ใช้ .env)
  - Deliverable: Services ทั้งหมดรันได้และเชื่อมต่อกันผ่าน Network

- **[✅]T0.2 Initialize NestJS Project**
  - สร้างโปรเจกต์ใหม่ด้วย Nest CLI
  - ติดตั้ง Dependencies:

  ```bash
  npm install @nestjs/typeorm typeorm mysql2
  npm install @nestjs/config
  npm install class-validator class-transformer
  npm install @nestjs/jwt @nestjs/passport passport passport-jwt
  npm install casl
  npm install @nestjs/platform-express multer
  npm install @nestjs/swagger
  npm install helmet rate-limiter-flexible
  npm install bcrypt
  npm install --save-dev @nestjs/testing jest @types/jest @types/passport-jwt @types/multer supertest
  npm install @nestjs/cache-manager cache-manager
  npm install @nestjs/schedule
  npm install @nestjs/config
  npm install @nestjs/elasticsearch @elastic/elasticsearch
  npm install nodemailer @types/nodemailer
  npm install uuid @types/uuid
  ```

````

  - Setup โครงสร้างโฟลเดอร์ตาม Domain-Driven Architecture
  - Deliverable: Project Structure พร้อม, แสดง Swagger ที่ `/api`

- **[✅]T0.3 Setup Database Connection**

  - Import SQL Schema v1.4.0 เข้า MariaDB
  - Run Seed Data (organizations, users, roles, permissions)
  - Configure TypeORM ใน AppModule
  - ทดสอบ Connection
  - Deliverable: Database พร้อมใช้งาน, มี Seed Data

- **[✅]T0.4 Setup Git Repository**
  - สร้าง Repository ใน Gitea (git.np-dms.work)
  - Setup .gitignore, README.md
  - Commit Initial Project
  - Deliverable: Code อยู่ใน Version Control

---

## **Phase 1: Core Foundation (สัปดาห์ที่ 2-3)**

Milestone: ระบบ Authentication, Authorization และ Base Entities

### Phase 1: Tasks

- **[ ] T1.1 CommonModule - Base Infrastructure**
  - [ ] สร้าง Base Entity (id, created_at, updated_at, deleted_at)
  - [ ] สร้าง Global Exception Filter
  - [ ] สร้าง Response Transform Interceptor
  - [ ] สร้าง Audit Log Interceptor
  - [ ] สร้าง RequestContextService - สำหรับเก็บข้อมูลระหว่าง Request
  - [ ] สร้าง ConfigService - Centralized configuration management
  - [ ] สร้าง CryptoService - สำหรับ encryption/decryption
  - [ ] Deliverable: Common Services พร้อมใช้

- **[ ] T1.2 AuthModule - JWT Authentication**
  - [ ] สร้าง Entity: User
  - [ ] สร้าง AuthService:
    - [ ] `login(username, password)` → JWT Token
    - [ ] `validateUser(username, password)` → User | null
    - [ ] Password Hashing (bcrypt)
  - [ ] สร้าง JWT Strategy (Passport)
  - [ ] สร้าง JwtAuthGuard
  - [ ] สร้าง Controllers:
    - [ ] `POST /auth/login` → { access_token }
    - [ ] `POST /auth/register` (Admin only)
    - [ ] `GET /auth/profile` (Protected)
  - [ ] Deliverable: ล็อกอิน/ล็อกเอาต์ทำงานได้

- **[ ] T1.3 UserModule - User Management**
  - [ ] สร้าง Entities: User, Role, Permission, UserRole
  - [ ] สร้าง UserService CRUD
  - [ ] สร้าง RoleService CRUD
  - [ ] สร้าง PermissionService (Read-Only, จาก Seed)
  - [ ] สร้าง Controllers:
    - [ ] `GET /users` → List Users (Paginated)
    - [ ] `GET /users/:id` → User Detail
    - [ ] `POST /users` → Create User
    - [ ] `PUT /users/:id` → Update User
    - [ ] `DELETE /users/:id` → Soft Delete
    - [ ] `GET /roles` → List Roles
    - [ ] `POST /roles` → Create Role (Admin)
    - [ ] `PUT /roles/:id/permissions` → Assign Permissions
  - [ ] Deliverable: จัดการผู้ใช้และ Role ได้

- **[ ] T1.4 RBAC Guard - Authorization**
  - [ ] สร้าง `@RequirePermission()` Decorator
  - [ ] สร้าง RbacGuard ที่ตรวจสอบ:
    - [ ] Global Permissions
    - [ ] Organization Permissions
    - [ ] Project Permissions
    - [ ] Contract Permissions
  - [ ] Permission Hierarchy Logic

```bash
  // Current: 3-level hierarchy
  // Recommended: 4-level hierarchy (Global → Organization → Project → Contract)
  @Injectable()
  export class RbacGuard implements CanActivate {
    async canActivate(context: ExecutionContext): Promise<boolean> {
      const requiredPermission = this.getRequiredPermission(context);
      const user = this.getUser(context);

      // Check permissions in order: Global → Org → Project → Contract
      return await this.checkGlobalPermissions(user, requiredPermission) ||
             await this.checkOrgPermissions(user, requiredPermission) ||
             await this.checkProjectPermissions(user, requiredPermission) ||
             await this.checkContractPermissions(user, requiredPermission);
    }
  }

````

- [ ] Integration กับ CASL
- [ ] Deliverable: ระบบสิทธิ์ทำงานได้ทั้ง 4 ระดับ

- **T1.5 ProjectModule - Base Structures**
  - [ ] สร้าง Entities:
    - [ ] Organization
    - [ ] Project
    - [ ] Contract
    - [ ] ProjectOrganization (Junction)
    - [ ] ContractOrganization (Junction)
    - [ ] UserAssignment Entity - สำหรับจัดการ user assignments ตาม scope
  - [ ] สร้าง Services & Controllers:
    - [ ] `GET /organizations` → List
    - [ ] `POST /projects` → Create (Superadmin)
    - [ ] `GET /projects/:id/contracts` → List Contracts
    - [ ] `POST /projects/:id/contracts` → Create Contract
    - [ ] UserAssignment - สำหรับจัดการ user assignments ตาม scope
    - [ ] ProjectOrganization - สำหรับจัดการความสัมพันธ์ project-organization
    - [ ] ContractOrganization - สำหรับจัดการความสัมพันธ์ contract-organization
  - [ ] Deliverable: จัดการโครงสร้างโปรเจกต์ได้

---

## **Phase 2: Master Data & File Management (สัปดาห์ที่ 4)**

Milestone: Master Data และระบบจัดการไฟล์

### Phase 2: Tasks

- **[ ] T2.1 MasterModule - Master Data Management**
  - [ ] สร้าง Entities:
    - [ ] CorrespondenceType
    - [ ] CorrespondenceStatus
    - [ ] RfaType
    - [ ] RfaStatusCode
    - [ ] RfaApproveCode
    - [ ] CirculationStatusCode
    - [ ] Tag
  - [ ] สร้าง Services & Controllers (CRUD):
    - [ ] `GET /master/correspondence-types`
    - [ ] `POST /master/tags` → Create Tag
    - [ ] `GET /master/tags` → List Tags (Autocomplete)
  - [ ] Deliverable: Admin จัดการ Master Data ได้

- **[ ] T2.2 FileStorageService - Central File Management**
  - [ ] สร้าง Attachment Entity
  - [ ] สร้าง FileStorageService: (การจัดเก็บไฟล์ในรูปแบบ centralized storage, ครอบคลุมการจัดการไฟล์แนบทั้งหมด, Security Measures)
    - [ ] `uploadFile(file: Express.Multer.File)` → Attachment
    - [ ] `getFilePath(attachmentId)` → string
    - [ ] `deleteFile(attachmentId)` → boolean
  - [ ] จัดเก็บไฟล์ใน `/share/dms-data/uploads/{YYYY}/{MM}/`
  - [ ] สร้าง Controller:
    - [ ] `POST /files/upload` → { attachment_id, url }
    - [ ] `GET /files/:id/download` → File Stream (Protected)
  - [ ] Access Control: ตรวจสอบสิทธิ์ผ่าน Junction Table
  - [ ] Deliverable: อัปโหลด/ดาวน์โหลดไฟล์ได้อย่างปลอดภัย

- **[ ] T2.3 DocumentNumberingModule - Internal Service**
  - [ ] สร้าง Entities:
    - [ ] DocumentNumberFormat
    - [ ] DocumentNumberCounter
  - [ ] สร้าง DocumentNumberingService: รวม Stored Procedure (sp_get_next_document_number), Error Handling และ Retry Logic
    - [ ] `generateNextNumber(projectId, orgId, typeId, year)` → string
    - [ ] เรียก Stored Procedure: `sp_get_next_document_number`
    - [ ] Format ตาม Template: `{ORG_CODE}-{TYPE_CODE}-{YEAR_SHORT}-{SEQ:4}`
  - **ไม่มี Controller** (Internal Service เท่านั้น)
  - [ ] Deliverable: Service สร้างเลขที่เอกสารได้ถูกต้อง

---

## **Phase 3: Correspondence & RFA Core (สัปดาห์ที่ 5-6)**

Milestone: ระบบเอกสารโต้ตอบและ RFA

### Phase 3: Tasks

- **[ ] T3.1 CorrespondenceModule - Basic CRUD**
  - [ ] สร้าง Entities:
    - [ ] Correspondence
    - [ ] CorrespondenceRevision
    - [ ] CorrespondenceRecipient
    - [ ] CorrespondenceTag
    - [ ] CorrespondenceReference
    - [ ] CorrespondenceAttachment
  - [ ] สร้าง CorrespondenceService: Complex Business Rules, State Machine สำหรับ Status Transitions
    - [ ] `create(dto)` → Correspondence
      - [ ] สร้าง Correspondence + Revision แรก (rev 0)
      - [ ] เรียก DocumentNumberingService
      - [ ] สร้าง Recipients (TO/CC)
      - [ ] สร้าง Tags
      - [ ] สร้าง Attachments
    - [ ] `update(id, dto)` → Correspondence
      - [ ] สร้าง Revision ใหม่
      - [ ] Update `is_current` flag
    - [ ] `findAll(filters)` → Paginated List
    - [ ] `findById(id)` → Correspondence with Current Revision
  - [ ] สร้าง Controllers:
    - [ ] `POST /correspondences` → Create
    - [ ] `GET /correspondences` → List (Filter by type, status, org)
    - [ ] `GET /correspondences/:id` → Detail
    - [ ] `PUT /correspondences/:id` → Update (Create new revision)
    - [ ] `DELETE /correspondences/:id` → Soft Delete (Admin only)
  - [ ] Deliverable: สร้าง/แก้ไข/ดูเอกสารได้

- **[ ] T3.2 CorrespondenceModule - Advanced Features**
  - [ ] Implement Status Transitions:
    - [ ] `DRAFT` → `SUBMITTED` (Document Control)
    - [ ] `SUBMITTED` → `CLOSED` (Admin)
    - [ ] `SUBMITTED` → `CANCELLED` (Admin + Reason)
  - [ ] Implement References:
    - [ ] `POST /correspondences/:id/references` → Link Documents
  - [ ] Implement Search (Basic):
  - `GET /correspondences/search?q=...`
  - [ ] Deliverable: Workflow พื้นฐานทำงานได้

- **[ ] T3.3 RfaModule - Basic CRUD**
  - [ ] สร้าง Entities:
    - [ ] Rfa
    - [ ] RfaRevision
    - [ ] RfaItem (Junction to Shop Drawings)
  - [ ] สร้าง RfaService: Complex Business Rules
    - [ ] `create(dto)` → Rfa
      - [ ] สร้าง Correspondence + Rfa + RfaRevision
      - [ ] เชื่อม Shop Drawing Revisions (สำหรับ RFA_DWG)
    - [ ] `findAll(filters)` → Paginated List
    - [ ] `findById(id)` → Rfa with Items
  - [ ] สร้าง Controllers:
    - [ ] `POST /rfas` → Create
    - [ ] `GET /rfas` → List
    - [ ] `GET /rfas/:id` → Detail
  - [ ] Deliverable: สร้าง RFA และเชื่อม Shop Drawings ได้

---

## **Phase 4: Drawing Management (สัปดาห์ที่ 7)**

Milestone: ระบบจัดการแบบ

### Phase 4: Tasks

- **[ ] T4.1 DrawingModule - Contract Drawings**
  - [ ] สร้าง Entities:
    - [ ] ContractDrawing
    - [ ] ContractDrawingVolume
    - [ ] ContractDrawingCat
    - [ ] ContractDrawingSubCat
    - [ ] ContractDrawingSubcatCatMap
    - [ ] ContractDrawingAttachment
  - [ ] สร้าง ContractDrawingService CRUD
  - [ ] สร้าง Controllers:
    - [ ] `GET /drawings/contract` → List
    - [ ] `POST /drawings/contract` → Create (Admin)
    - [ ] `GET /drawings/contract/:id` → Detail
  - [ ] Deliverable: จัดการ Contract Drawings ได้

- **[ ] T4.2 DrawingModule - Shop Drawings**
  - [ ] สร้าง Entities:
    - [ ] ShopDrawing
    - [ ] ShopDrawingRevision
    - [ ] ShopDrawingMainCategory
    - [ ] ShopDrawingSubCategory
    - [ ] ShopDrawingRevisionContractRef
    - [ ] ShopDrawingRevisionAttachment
  - [ ] สร้าง ShopDrawingService CRUD
  - [ ] สร้าง Controllers:
    - [ ] `GET /drawings/shop` → List
    - [ ] `POST /drawings/shop` → Create
    - [ ] `POST /drawings/shop/:id/revisions` → Create Revision
    - [ ] `GET /drawings/shop/:id` → Detail with Revisions
  - [ ] Link Shop Drawing Revision → Contract Drawings
  - [ ] Deliverable: จัดการ Shop Drawings และ Revisions ได้

---

## **Phase 5: Workflow Systems (สัปดาห์ที่ 8-9)**

Milestone: ระบบ Workflow ทั้งหมด

### Phase 5: Tasks

- **[ ] T5.1 RfaModule - Workflow Implementation**
  - [ ] สร้าง Entities:
    - [ ] RfaWorkflowTemplate
    - [ ] RfaWorkflowTemplateStep
    - [ ] RfaWorkflow (Transaction Log)
  - [ ] สร้าง RfaWorkflowService: Advanced Workflow Features
    - [ ] `initiateWorkflow(rfaId, templateId)` → void
      - [ ] สร้าง RfaWorkflow records ตาม Template
      - [ ] กำหนด Step 1 เป็น PENDING
    - [ ] `completeStep(rfaId, stepNumber, action, comments)` → void
      - [ ] Update Status → COMPLETED
      - [ ] Set Next Step → PENDING
      - [ ] Send Notifications
    - [ ] `rejectStep(rfaId, stepNumber, reason)` → void
      - [ ] Update Status → REJECTED
      - [ ] Send back to Originator
  - [ ] สร้าง Controllers:
    - [ ] `POST /rfas/:id/workflow/start` → Start Workflow
    - [ ] `POST /rfas/:id/workflow/steps/:stepNumber/complete` → Complete Step
    - [ ] `GET /rfas/:id/workflow` → Get Workflow Status
  - [ ] Deliverable: RFA Workflow ทำงานได้

- **[ ] T5.2 CirculationModule - Internal Routing**
  - [ ] สร้าง Entities:
    - [ ] Circulation
    - [ ] CirculationTemplate
    - [ ] CirculationTemplateAssignee
    - [ ] CirculationRouting (Transaction Log)
    - [ ] CirculationAttachment
  - [ ] สร้าง CirculationService:
    - [ ] `create(correspondenceId, dto)` → Circulation
      - [ ] สร้าง Circulation (1:1 กับ Correspondence)
      - [ ] สร้าง Routing ตาม Template
    - [ ] `assignUser(circulationId, stepNumber, userId)` → void
    - [ ] `completeStep(circulationId, stepNumber, comments)` → void
    - [ ] `close(circulationId)` → void (เมื่อตอบกลับองค์กรผู้ส่งแล้ว)
  - สร้าง Controllers:
    - [ ] `POST /circulations` → Create
    - [ ] `GET /circulations/:id` → Detail
    - [ ] `POST /circulations/:id/steps/:stepNumber/complete` → Complete
    - [ ] `POST /circulations/:id/close` → Close
  - [ ] Deliverable: ใบเวียนภายในองค์กรทำงานได้

- **[ ] T5.3 TransmittalModule - Document Forwarding**
  - [ ] สร้าง Entities:
    - [ ] Transmittal
    - [ ] TransmittalItem
  - [ ] สร้าง TransmittalService:
    - [ ] `create(dto)` → Transmittal
      - [ ] สร้าง Correspondence + Transmittal
      - [ ] เชื่อม Multiple Correspondences เป็น Items
  - [ ] สร้าง Controllers:
    - [ ] `POST /transmittals` → Create
    - [ ] `GET /transmittals` → List
    - [ ] `GET /transmittals/:id` → Detail with Items
  - [ ] Deliverable: สร้าง Transmittal ได้

---

## **Phase 6: Advanced Features (สัปดาห์ที่ 10-11)**

Milestone: ฟีเจอร์ขั้นสูง

### Phase 6: Tasks

- **[ ] T6.1 SearchModule - Elasticsearch Integration**
  - [ ] Setup Elasticsearch Container ใน docker-compose.yml
  - [ ] สร้าง SearchService:
    - [ ] `indexDocument(entity)` → void
    - [ ] `updateDocument(entity)` → void
    - [ ] `deleteDocument(entity)` → void
    - [ ] `search(query, filters)` → SearchResult[]
  - [ ] Index ทุกครั้งที่ Create/Update:
    - [ ] Correspondence
    - [ ] RFA
    - [ ] Shop Drawing
    - [ ] Contract Drawing
    - [ ] Circulation
    - [ ] Transmittal
  - [ ] สร้าง Controllers:
    - [ ] `GET /search?q=...&type=...&from=...&to=...` → Results
  - [ ] Deliverable: ค้นหาขั้นสูงทำงานได้

- **[ ] T6.2 NotificationModule - Email & Line**
  - [ ] สร้าง NotificationService:
    - [ ] `sendEmail(to, subject, body)` → void (Nodemailer)
    - [ ] `sendLine(userId, message)` → void (ผ่าน n8n Webhook)
    - [ ] `createSystemNotification(userId, message, entityType, entityId)` → void
  - [ ] Integrate กับ Workflow Events:
    - [ ] เมื่อสร้าง Correspondence ใหม่ → แจ้ง Recipients
    - [ ] เมื่อสร้าง Circulation → แจ้ง Assignees
    - [ ] เมื่อ RFA Workflow ถึง Step → แจ้ง Responsible Org
    - [ ] เมื่อใกล้ถึง Deadline → แจ้ง (Optional)
  - [ ] สร้าง Controllers:
    - [ ] `GET /notifications` → List User's Notifications
    - [ ] `PUT /notifications/:id/read` → Mark as Read
  - [ ] Deliverable: ระบบแจ้งเตือนทำงานได้

- **[ ] T6.3 Reporting & Analytics**
  - [ ] สร้าง ReportService:
    - [ ] `getCorrespondenceSummary(projectId, from, to)` → Report
    - [ ] `getRfaSummary(projectId, from, to)` → Report
    - [ ] `getActivityLog(userId, from, to)` → Report
  - [ ] ใช้ Views จาก Database:
    - [ ] `v_current_correspondences`
    - [ ] `v_current_rfas`
    - [ ] `v_user_tasks`
    - [ ] `v_audit_log_details`
  - [ ] สร้าง Controllers:
    - [ ] `GET /reports/correspondence` → Summary (CSV, PDF)
    - [ ] `GET /reports/rfa` → Summary
    - [ ] `GET /reports/activity` → User Activity
  - [ ] Deliverable: สร้างรายงานได้

- **T6.4 Audit Log & Activity Feed**
  - [ ] AuditLogInterceptor ทำงานอัตโนมัติแล้ว (Phase 1)
  - [ ] สร้าง AuditLogService:
    - [ ] `log(userId, action, entityType, entityId, details)` → void
    - [ ] `getUserActivity(userId, limit)` → AuditLog[]
  - [ ] สร้าง Controllers:
    - [ ] `GET /audit-logs` → List (Admin only)
    - [ ] `GET /audit-logs/user/:userId` → User's Activity
  - [ ] Deliverable: ดู Audit Log ได้

---

## **Phase 7: Testing & Optimization (สัปดาห์ที่ 12-13)**

Milestone: ทดสอบและปรับปรุงประสิทธิภาพ

### Phase 7: Tasks

- **[ ] T7.1 Unit Testing**
  - [ ] เขียน Unit Tests สำหรับ Services สำคัญ:
    - [ ] AuthService (login, validateUser)
    - [ ] RbacGuard (permission checks)
    - [ ] DocumentNumberingService (number generation)
    - [ ] CorrespondenceService (create, update)
    - [ ] RfaWorkflowService (workflow logic)
  - [ ] Target: 70% Code Coverage
  - [ ] Deliverable: Unit Tests ผ่านทั้งหมด

- **[ ] T7.2 Integration Testing**
  - [ ] เขียน Integration Tests:
    - [ ] Authentication Flow (login → access protected route)
    - [ ] Document Creation Flow (create correspondence → attach files)
    - [ ] RFA Workflow Flow (start → step 1 → step 2 → complete)
    - [ ] Circulation Flow (create → assign → complete → close)
    - [ ] ทดสอบ SQL Views (v_user_all_permissions, v_user_tasks)
  - [ ] ใช้ Test Database แยกต่างหาก
  - [ ] Deliverable: Integration Tests ผ่าน

- **[ ] T7.3 E2E Testing**
  - [ ] เขียน E2E Tests:
    - [ ] User Registration & Login
    - [ ] Create Correspondence (Full Flow)
    - [ ] Create RFA with Shop Drawings
    - [ ] Complete RFA Workflow
    - [ ] Search Documents
  - [ ] Deliverable: E2E Tests ผ่าน

- **[ ] T7.4 Performance Optimization**
  - [ ] Implement Caching:
    - [ ] Cache Master Data (Roles, Permissions)
    - [ ] Cache User Permissions (ใช้ @nestjs/cache-manager)
  - [ ] Database Optimization:
    - [ ] Review Indexes
    - [ ] Optimize Queries (N+1 Problem)
    - I[ ] mplement Pagination ทุก List Endpoint
  - [ ] Deliverable: Response Time < 200ms (90th percentile)

- **[ ] T7.5 Security Hardening**
  - [ ] Implement Rate Limiting (ใช้ rate-limiter-flexible)
  - [ ] Setup Helmet (Security Headers)
  - [ ] Review CORS Configuration
  - [ ] Input Validation (ตรวจสอบ DTOs ทั้งหมด)
  - [ ] Deliverable: Security Checklist ผ่าน

---

## **Phase 8: Documentation & Deployment (สัปดาห์ที่ 14)**

Milestone: เอกสารและ Deploy สู่ Production

### Phase 8: Tasks

- **[ ] T8.1 API Documentation**
  - [ ] ครบทุก Endpoint ใน Swagger:
    - [ ] ใส่ Description, Example Request/Response
    - [ ] ระบุ Required Permissions
    - [ ] ใส่ Error Responses
  - [ ] Export Swagger JSON → Frontend Team
  - [ ] Deliverable: Swagger Docs สมบูรณ์

- **[ ] T8.2 Technical Documentation**
  - [ ] เขียนเอกสาร:
    - [ ] Architecture Overview
    - [ ] Module Structure
    - [ ] Database Schema Diagram
    - [ ] API Design Patterns
    - [ ] Deployment Guide
  - [ ] Deliverable: Technical Docs พร้อม

- **[ ] T8.3 Deployment Preparation**
  - [ ] สร้าง Production docker-compose.yml
  - [ ] Setup Environment Variables ใน QNAP
  - [ ] Setup Nginx Proxy Manager (SSL Certificate)
  - [ ] Setup Backup Scripts (Database + Files)
  - [ ] Deliverable: Deployment Guide พร้อม

- **[ ] T8.4 Production Deployment**
  - [ ] Deploy Backend ไปยัง backend.np-dms.work
  - [ ] ทดสอบ API ผ่าน Postman
  - [ ] Monitor Logs (Winston)
  - [ ] Setup Health Check Endpoint (`GET /health`)
  - [ ] Deliverable: Backend รันบน Production

- **T8.5 Handover to Frontend Team**
  - [ ] Demo API ให้ Frontend Team
  - [ ] ส่งมอบ Swagger Documentation
  - [ ] ส่งมอบ Postman Collection
  - [ ] Workshop: วิธีใช้ Authentication & RBAC
  - [ ] Deliverable: Frontend เริ่มพัฒนาได้

---

## 📊 สรุป Timeline

| Phase   | ระยะเวลา       | จำนวนงาน     | Output หลัก                  |
| ------- | -------------- | ------------ | ---------------------------- |
| Phase 0 | 1 สัปดาห์      | 4            | Infrastructure Ready         |
| Phase 1 | 2 สัปดาห์      | 5            | Auth & User Management       |
| Phase 2 | 1 สัปดาห์      | 3            | Master Data & File Storage   |
| Phase 3 | 2 สัปดาห์      | 3            | Correspondence & RFA Core    |
| Phase 4 | 1 สัปดาห์      | 2            | Drawing Management           |
| Phase 5 | 2 สัปดาห์      | 3            | Workflow Systems             |
| Phase 6 | 2 สัปดาห์      | 4            | Advanced Features            |
| Phase 7 | 2 สัปดาห์      | 5            | Testing & Optimization       |
| Phase 8 | 1 สัปดาห์      | 5            | Documentation & Deploy       |
| **รวม** | **14 สัปดาห์** | **34 Tasks** | **Production-Ready Backend** |

---

## 🎯 Critical Success Factors

1. **Database First**: ใช้ Schema v1.4.0 เป็นหลัก ไม่แก้ไข Schema โดยไม่จำเป็น
2. **Emphasizing Soft Delete**: Service ทั้งหมดที่ทำการ Query ข้อมูล (เช่น findAll, findById) ต้อง ใช้ Global Filter หรือ Default Scope ของ TypeORM เพื่อกรอง WHERE deleted_at IS NULL เสมอ
3. **API Contract**: ทุก Endpoint ต้องมี Swagger Documentation สมบูรณ์
4. **Security**: RBAC ต้องทำงานถูกต้อง 100% ก่อน Deploy
5. **Testing**: Code Coverage อย่างน้อย 70% ก่อน Production
6. **Performance**: Response Time < 200ms (90th percentile)
7. **Documentation**: เอกสารต้องครบถ้วนเพื่อ Handover ให้ Frontend Team

---

## 🚀 ขั้นตอนถัดไป

1. **Approve แผนนี้** → ปรับแต่งตาม Feedback
2. **Setup Phase 0** → เริ่มสร้าง Infrastructure
3. **Daily Standup** → รายงานความก้าวหน้าทุกวัน
4. **Weekly Review** → ทบทวนความก้าวหน้าทุกสัปดาห์
5. **Deploy to Production** → Week 14

---

**หมายเหตุ:** แผนนี้สามารถปรับแต่งได้ตามความต้องการและข้อจำกัดของทีม หาก Phase ใดใช้เวลามากกว่าที่คาดการณ์ ควรปรับ Timeline ให้เหมาะสม
