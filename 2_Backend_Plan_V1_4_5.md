# 📋 **แผนการพัฒนา Backend (NestJS) - LCBP3-DMS v1.4.5 (ฉบับปรับปรุง)**

**สถานะ:** FINAL GUIDELINE Rev.05
**วันที่:** 2025-11-29
**อ้างอิง:** Requirements v1.4.5 & FullStackJS Guidelines v1.4.5
**Classification:** Internal Technical Documentation

---

## 🎯 **ภาพรวมโครงการ**

พัฒนา Backend สำหรับระบบบริหารจัดการเอกสารโครงการ (Document Management System) ที่มีความปลอดภัยสูง รองรับการทำงานพร้อมกัน (Concurrency) ได้อย่างถูกต้องแม่นยำ มีสถาปัตยกรรมที่ยืดหยุ่นต่อการขยายตัว และรองรับการจัดการเอกสารที่ซับซ้อน มีระบบ Workflow การอนุมัติ และการควบคุมสิทธิ์แบบ RBAC 4 ระดับ พร้อมมาตรการความปลอดภัยที่ทันสมัย

---

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

```
📁backend
├── .editorconfig
├── .env
├── .gitignore
├── .prettierrc
├── docker-compose.override.yml.example
├── docker-compose.yml
├── eslint.config.mjs
├── Infrastructure Setup.yml
├── nest-cli.json
├── package-lock.json
├── package.json
├── pnpm-lock.yaml
├── README.md
├── tsconfig.build.json
├── tsconfig.json
├── 📁scripts
│   ├── debug-db.ts
│   └── verify-workflow.ts
├── 📁test
│   ├── app.e2e-spec.ts
│   ├── jest-e2e.json
│   ├── phase3-workflow.e2e-spec.ts
│   └── simple.e2e-spec.ts
├── 📁uploads
│   └── 📁temp
│       ├── 5a6d4c26-84b2-4c8a-b177-9fa267651a93.pdf
│       └── d60d9807-a22d-4ca0-b99a-5d5d8b81b3e8.pdf
└── 📁src
    ├── app.controller.spec.ts
    ├── app.controller.ts
    ├── app.module.ts
    ├── app.service.ts
    ├── main.ts
    ├── redlock.d.ts
    ├── 📁common
    │   ├── 📁auth
    │   │   ├── 📁dto
    │   │   │   ├── login.dto.ts
    │   │   │   └──  register.dto.ts
    │   │   ├── 📁strategies
    │   │   │   ├── jwt-refresh.strategy.ts
    │   │   │   └──  jwt.strategy.ts
    │   │   ├── auth.controller.spec.ts
    │   │   ├── auth.controller.ts
    │   │   ├── auth.module.ts
    │   │   ├── auth.service.spec.ts
    │   │   └── auth.service.ts
    │   ├── 📁config
    │   │   ├── env.validation.ts
    │   │   └──  redis.config.ts
    │   ├── 📁decorators
    │   │   ├── audit.decorator.ts
    │   │   ├── bypass-maintenance.decorator.ts
    │   │   ├── circuit-breaker.decorator.ts
    │   │   ├── current-user.decorator.ts
    │   │   ├── idempotency.decorator.ts
    │   │   ├── require-permission.decorator.ts
    │   │   └── retry.decorator.ts
    │   ├── 📁entities
    │   │   ├── audit-log.entity.ts
    │   │   └──  base.entity.ts
    │   ├── 📁exceptions
    │   │   └──  http-exception.filter.ts
    │   ├── 📁file-storage
    │   │   ├── 📁entities
    │   │   │   └──  attachment.entity.ts
    │   │   ├── file-cleanup.service.ts
    │   │   ├── file-storage.controller.spec.ts
    │   │   ├── file-storage.controller.ts
    │   │   ├── file-storage.module.ts
    │   │   ├── file-storage.service.spec.ts
    │   │   └──  file-storage.service.ts
    │   ├── 📁guards
    │   │   ├── jwt-auth.guard.ts
    │   │   ├── jwt-refresh.guard.ts
    │   │   ├── maintenance-mode.guard.ts
    │   │   └──  rbac.guard.ts
    │   ├── 📁idempotency
    │   │   ├── 📁interceptors
    │   │   ├── audit-log.interceptor.ts
    │   │   ├── idempotency.interceptor.ts
    │   │   ├── performance.interceptor.ts
    │   │   └── transform.interceptor.ts
    │   ├── 📁maintenance
    │   ├── 📁resilience
    │   │   └──  resilience.module.ts
    │   ├── 📁security
    │   ├── 📁services
    │   │   ├── crypto.service.ts
    │   │   └── request-context.service.ts
    │   └── common.module.ts
    ├── 📁database
    │   ├── 📁migrations
    │   └── 📁seeds
    │       ├── run-seed.ts
    │       └── workflow-definitions.seed.ts
    └── 📁modules
        ├── 📁circulation
        │   ├── 📁dto
        │   │   ├── create-circulation.dto.ts
        │   │   ├── search-circulation.dto.ts
        │   │   └── update-circulation-routing.dto.ts
        │   ├── 📁entities
        │   │   ├── circulation-routing.entity.ts
        │   │   ├── circulation-status-code.entity.ts
        │   │   └── circulation.entity.ts
        │   ├── circulation-workflow.service.ts
        │   ├── circulation.controller.ts
        │   ├── circulation.module.ts
        │   └── circulation.service.ts
        ├── 📁correspondence
        │   ├── 📁dto
        │   │   ├── add-reference.dto.ts
        │   │   ├── create-correspondence.dto.ts
        │   │   ├── create-routing-template.dto.ts
        │   │   ├── search-correspondence.dto.ts
        │   │   ├── submit-correspondence.dto.ts
        │   │   └── workflow-action.dto.ts
        │   ├── 📁entities
        │   │   ├── correspondence-reference.entity.ts
        │   │   ├── correspondence-revision.entity.ts
        │   │   ├── correspondence-routing.entity.ts
        │   │   ├── correspondence-status.entity.ts
        │   │   ├── correspondence-sub-type.entity.ts
        │   │   ├── correspondence-type.entity.ts
        │   │   ├── correspondence.entity.ts
        │   │   ├── routing-template-step.entity.ts
        │   │   └── routing-template.entity.ts
        │   ├── correspondence-workflow.service.ts
        │   ├── correspondence.controller.spec.ts
        │   ├── correspondence.controller.ts
        │   ├── correspondence.module.ts
        │   ├── correspondence.service.spec.ts
        │   └── correspondence.service.ts
        ├── 📁document-numbering
        │   ├── 📁entities
        │   │   ├── document-number-counter.entity.ts
        │   │   └── document-number-format.entity.ts
        │   ├── 📁interfaces
        │   │   └── document-numbering.interface.ts
        │   ├── document-numbering.module.ts
        │   ├── document-numbering.service.spec.ts
        │   └── document-numbering.service.ts
        ├── 📁drawing
        │   ├── 📁dto
        │   │   ├── create-contract-drawing.dto.ts
        │   │   ├── create-shop-drawing-revision.dto.ts
        │   │   ├── create-shop-drawing.dto.ts
        │   │   ├── search-contract-drawing.dto.ts
        │   │   ├── search-shop-drawing.dto.ts
        │   │   └── update-contract-drawing.dto.ts
        │   ├── 📁entities
        │   │   ├── contract-drawing-sub-category.entity.ts
        │   │   ├── contract-drawing-volume.entity.ts
        │   │   ├── contract-drawing.entity.ts
        │   │   ├── shop-drawing-main-category.entity.ts
        │   │   ├── shop-drawing-revision.entity.ts
        │   │   ├── shop-drawing-sub-category.entity.ts
        │   │   └── shop-drawing.entity.ts
        │   ├── contract-drawing.controller.ts
        │   ├── contract-drawing.service.ts
        │   ├── drawing-master-data.controller.ts
        │   ├── drawing-master-data.service.ts
        │   ├── drawing.module.ts
        │   ├── shop-drawing.controller.ts
        │   └── shop-drawing.service.ts
        ├── 📁json-schema
        │   ├── 📁dto
        │   │   ├── create-json-schema.dto.ts
        │   │   ├── migrate-data.dto.ts
        │   │   ├── search-json-schema.dto.ts
        │   │   └── update-json-schema.dto.ts
        │   ├── 📁entities
        │   │   └── json-schema.entity.ts
        │   ├── 📁interfaces
        │   │   ├── ui-schema.interface.ts
        │   │   └── validation-result.interface.ts
        │   ├── 📁services
        │   │   ├── json-security.service.ts
        │   │   ├── schema-migration.service.ts
        │   │   ├── ui-schema.service.ts
        │   │   └── virtual-column.service.ts
        │   ├── json-schema.controller.spec.ts
        │   ├── json-schema.controller.ts
        │   ├── json-schema.module.ts
        │   ├── json-schema.service.spec.ts
        │   └── json-schema.service.ts
        ├── 📁master
        │   ├── 📁dto
        │   │   ├── create-discipline.dto.ts
        │   │   ├── create-sub-type.dto.ts
        │   │   ├── create-tag.dto.ts
        │   │   ├── save-number-format.dto.ts
        │   │   ├── search-tag.dto.ts
        │   │   └── update-tag.dto.ts
        │   ├── 📁entities
        │   │   ├── discipline.entity.ts
        │   │   └── tag.entity.ts
        │   ├── master.controller.ts
        │   ├── master.module.ts
        │   └── master.service.ts
        ├── 📁monitoring
        │   ├── 📁controllers
        │   │   └── health.controller.ts
        │   ├── 📁dto
        │   │   └── set-maintenance.dto.ts
        │   ├── 📁logger
        │   │   └── winston.config.ts
        │   ├── 📁services
        │   │   └── metrics.service.ts
        │   ├── monitoring.controller.ts
        │   ├── monitoring.module.ts
        │   └── monitoring.service.ts
        ├── 📁notification
        │   ├── 📁dto
        │   │   ├── create-notification.dto.ts
        │   │   └── search-notification.dto.ts
        │   ├── 📁entities
        │   │   └── notification.entity.ts
        │   ├── notification-cleanup.service.ts
        │   ├── notification.controller.ts
        │   ├── notification.gateway.ts
        │   ├── notification.module.ts
        │   ├── notification.processor.ts
        │   └── notification.service.ts
        ├── 📁project
        │   ├── 📁dto
        │   │   ├── create-project.dto.ts
        │   │   ├── search-project.dto.ts
        │   │   └── update-project.dto.ts
        │   ├── 📁entities
        │   │   ├── contract-organization.entity.ts
        │   │   ├── contract.entity.ts
        │   │   ├── organization.entity.ts
        │   │   ├── project-organization.entity.ts
        │   │   └── project.entity.ts
        │   ├── project.controller.spec.ts
        │   ├── project.controller.ts
        │   ├── project.module.ts
        │   ├── project.service.spec.ts
        │   └── project.service.ts
        ├── 📁rfa
        │   ├── 📁dto
        │   │   ├── create-rfa-revision.dto.ts
        │   │   ├── create-rfa-workflow.dto.ts
        │   │   ├── create-rfa.dto.ts
        │   │   ├── search-rfa.dto.ts
        │   │   ├── submit-rfa.dto.ts
        │   │   └── update-rfa.dto.ts
        │   ├── 📁entities
        │   │   ├── rfa-approve-code.entity.ts
        │   │   ├── rfa-item.entity.ts
        │   │   ├── rfa-revision.entity.ts
        │   │   ├── rfa-status-code.entity.ts
        │   │   ├── rfa-type.entity.ts
        │   │   ├── rfa-workflow-template-step.entity.ts
        │   │   ├── rfa-workflow-template.entity.ts
        │   │   ├── rfa-workflow.entity.ts
        │   │   └── rfa.entity.ts
        │   ├── rfa-workflow.service.ts
        │   ├── rfa.controller.ts
        │   ├── rfa.module.ts
        │   └── rfa.service.ts
        ├── 📁search
        │   ├── 📁dto
        │   │   └── search-query.dto.ts
        │   ├── search.controller.ts
        │   ├── search.module.ts
        │   └── search.service.ts
        ├── 📁transmittal
        │   ├── 📁dto
        │   │   ├── create-transmittal.dto.ts
        │   │   ├── search-transmittal.dto.ts
        │   │   └── update-transmittal.dto.ts
        │   ├── 📁entities
        │   │   ├── transmittal-item.entity.ts
        │   │   └── transmittal.entity.ts
        │   ├── transmittal.controller.ts
        │   ├── transmittal.module.ts
        │   └── transmittal.service.ts
        ├── 📁user
        │   ├── 📁dto
        │   │   ├── assign-role.dto.ts
        │   │   ├── create-user.dto.ts
        │   │   ├── update-preference.dto.ts
        │   │   └── update-user.dto.ts
        │   ├── 📁entities
        │   │   ├── permission.entity.ts
        │   │   ├── role.entity.ts
        │   │   ├── user-assignment.entity.ts
        │   │   ├── user-preference.entity.ts
        │   │   └── user.entity.ts
        │   ├── user-assignment.service.ts
        │   ├── user-preference.service.ts
        │   ├── user.controller.ts
        │   ├── user.module.ts
        │   ├── user.service.spec.ts
        │   └── user.service.ts
        └── 📁workflow-engine
            ├── 📁dto
            │   ├── create-workflow-definition.dto.ts
            │   ├── evaluate-workflow.dto.ts
            │   ├── get-available-actions.dto.ts
            │   ├── update-workflow-definition.dto.ts
            │   └── workflow-transition.dto.ts
            ├── 📁entities
            │   └── workflow-definition.entity.ts
            ├── 📁interfaces
            │   ├── workflow-definition.entity.ts
            │   ├── workflow-history.entity.ts
            │   └── workflow-instance.entity.ts
            ├── 📁interfaces
            │   └── workflow.interface.ts
            ├── workflow-dsl.service.ts
            ├── workflow-engine.controller.ts
            ├── workflow-engine.module.ts
            ├── workflow-engine.service.spec.ts
            ├── workflow-engine.service.ts
            └── workflow-event.service.ts

```

---

## 🗓️ **แผนการพัฒนาแบบ Phase-Based**

- _(Dependency Diagram ถูกละไว้เพื่อประหยัดพื้นที่ เนื่องจากมีการอ้างอิงจากแผนเดิม)_

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

---

## **Phase 1: Core Foundation & Security (สัปดาห์ที่ 2-3)**

**Milestone:** ระบบ Authentication, Authorization, Idempotency พื้นฐาน และ Security Baseline

### **Phase 1: Tasks**

- **[ ] T1.1 CommonModule - Base Infrastructure**

  - [ ] สร้าง Base Entity (id, created_at, updated_at, deleted_at)
  - [ ] สร้าง Global Exception Filter (ไม่เปิดเผย sensitive information)
  - [ ] สร้าง Response Transform Interceptor
  - [ ] สร้าง Audit Log Interceptor
  - [ ] **Idempotency Interceptor:** ตรวจสอบ Header `Idempotency-Key` และ Cache Response เดิมใน Redis
  - [ ] **Maintenance Mode Middleware:** ตรวจสอบ Flag ใน **Redis Key** เพื่อ Block API ระหว่างปรับปรุงระบบ **(Admin ใช้ Redis/Admin UI ในการ Toggle สถานะ)**
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

---

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
    - [ ] ใช้ **Double-Lock Mechanism**: 1. Acquire **Redis Lock** (Key: `doc_num:{project}:{type}`) 2. Read DB & Calculate Next Number 3. Update DB with **Optimistic Lock** Check (ใช้ `@VersionColumn()`) 4. Release Redis Lock 5. Retry on Failure ด้วย exponential backoff
    - [ ] Fallback mechanism เมื่อการขอเลขล้มเหลว
    - [ ] Format ตาม Template: {ORG_CODE}-{TYPE_CODE}-{YEAR_SHORT}-{SEQ:4}
  - **ไม่มี Controller** (Internal Service เท่านั้น)
  - [ ] **Security:** Implement audit log ทุกครั้งที่มีการ generate เลขที่
  - [ ] **Deliverable:** Service สร้างเลขที่เอกสารได้ถูกต้องและปลอดภัย ไม่มี Race Condition
  - [ ] **Dependencies:** T1.1, T0.3

* **[ ] T2.3 DocumentNumberingModule - Token-Based & Double-Lock** (Updated)
  - [ ] Update Entity: `DocumentNumberCounter` (Add `discipline_id` to PK)
  - [ ] Implement Token Parser & Replacer Logic (`{DISCIPLINE}`, `{SUBTYPE_NUM}`)
  - [ ] Update `generateNextNumber` to handle optional keys (Discipline/SubType)
  - [ ] **Deliverable:** Flexible Numbering System

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

### 🚀 **T2.5 JSON Details & Schema Management - Enhanced Implementation Plan**

#### 📋 **Overview**

สร้างระบบจัดการ JSON Schema ที่ครอบคลุมสำหรับ dynamic document details, validation, transformation และ performance optimization

---

#### 🎯 **Enhanced Task Breakdown for T2.5**

##### **[ ] T2.5.1 JSON Schema Registry & Versioning System**

- [ ] **Schema Entity Design** สำหรับเก็บ JSON schemas ทุกประเภท
- [ ] **Version Control System** สำหรับ schema evolution
- [ ] **Migration Strategy** สำหรับ backward-compatible changes
- [ ] **Schema Inheritance** สำหรับ shared field definitions

```typescript
// Schema Entity Design
@Entity()
export class JsonSchema {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string; // 'CORRESPONDENCE_GENERIC', 'RFA_DWG', 'CIRCULATION_INTERNAL'

  @Column()
  entity_type: string; // 'correspondence', 'rfa', 'circulation'

  @Column()
  version: number;

  @Column('json')
  schema_definition: any; // AJV JSON Schema

  @Column('json')
  ui_schema: any; // UI configuration for form generation

  @Column({ default: true })
  is_active: boolean;

  @Column('json', { nullable: true })
  migration_script: any; // Data transformation rules

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  // Virtual columns configuration for performance
  @Column('json', { nullable: true })
  virtual_columns: VirtualColumnConfig[];
}

interface VirtualColumnConfig {
  json_path: string; // '$.projectId'
  column_name: string; // 'ref_project_id'
  data_type: 'INT' | 'VARCHAR' | 'BOOLEAN' | 'DATE';
  index_type?: 'INDEX' | 'UNIQUE' | 'FULLTEXT';
  is_required: boolean;
}
```

##### **[ ] T2.5.2 Schema Validation & Transformation Engine**

- [ ] **AJV Integration** สำหรับ high-performance JSON validation
- [ ] **Custom Validators** สำหรับ business rule validation
- [ ] **Data Transformation** สำหรับ schema version migration
- [ ] **Sanitization Service** สำหรับ data cleansing

```typescript
@Injectable()
export class JsonSchemaService {
  private ajv: Ajv;

  constructor() {
    this.ajv = new Ajv({
      allErrors: true,
      coerceTypes: true,
      useDefaults: true,
      removeAdditional: true,
      formats: {
        'date-time': true,
        email: true,
        uri: true,
        'document-number': this.documentNumberFormat,
      },
    });

    // Register custom formats and keywords
    this.registerCustomValidators();
  }

  async validateData(
    schemaName: string,
    data: any,
    options: ValidationOptions = {}
  ): Promise<ValidationResult> {
    const schema = await this.getSchema(schemaName);
    const validate = this.ajv.compile(schema);

    const isValid = validate(data);

    if (!isValid) {
      return {
        isValid: false,
        errors: validate.errors,
        sanitizedData: null,
      };
    }

    // Apply data transformation if needed
    const sanitizedData = await this.sanitizeData(data, schema, options);

    return {
      isValid: true,
      errors: [],
      sanitizedData,
    };
  }

  private async sanitizeData(
    data: any,
    schema: any,
    options: ValidationOptions
  ): Promise<any> {
    const sanitized = { ...data };

    // Remove unknown properties if not allowed
    if (options.removeAdditional !== false) {
      const allowedProperties = this.extractPropertyNames(schema);
      Object.keys(sanitized).forEach((key) => {
        if (!allowedProperties.includes(key)) {
          delete sanitized[key];
        }
      });
    }

    // Apply custom sanitizers based on field type
    await this.applyFieldSanitizers(sanitized, schema);

    return sanitized;
  }

  private registerCustomValidators(): void {
    // Custom format for document numbers
    this.ajv.addFormat('document-number', {
      type: 'string',
      validate: (value: string) => {
        return /^[A-Z]{3,5}-[A-Z]{2,4}-\d{4}-\d{3,5}$/.test(value);
      },
    });

    // Custom keyword for role-based access
    this.ajv.addKeyword({
      keyword: 'requiredRole',
      type: 'string',
      compile: (requiredRole: string) => {
        return (data: any, dataPath: string, parentData: any) => {
          // Check if user has required role for this field
          const userContext = this.getUserContext();
          return userContext.roles.includes(requiredRole);
        };
      },
    });
  }
}
```

##### **[ ] T2.5.3 Virtual Columns & Performance Optimization**

- [ ] **Virtual Column Generator** สำหรับ JSON field indexing
- [ ] **Migration Scripts** สำหรับสร้าง generated columns
- [ ] **Query Optimizer** สำหรับใช้ virtual columns ใน search
- [ ] **Performance Monitoring** สำหรับ JSON query performance

```typescript
@Injectable()
export class VirtualColumnService {
  constructor(
    private dataSource: DataSource,
    private configService: ConfigService
  ) {}

  async setupVirtualColumns(
    tableName: string,
    schemaConfig: VirtualColumnConfig[]
  ): Promise<void> {
    const connection = this.dataSource.manager.connection;

    for (const config of schemaConfig) {
      await this.createVirtualColumn(tableName, config);
    }
  }

  private async createVirtualColumn(
    tableName: string,
    config: VirtualColumnConfig
  ): Promise<void> {
    const columnDefinition = this.generateColumnDefinition(config);

    const sql = `
      ALTER TABLE ${tableName}
      ADD COLUMN ${config.column_name} ${columnDefinition}
    `;

    await this.dataSource.query(sql);

    // Create index if specified
    if (config.index_type) {
      await this.createIndex(tableName, config);
    }
  }

  private generateColumnDefinition(config: VirtualColumnConfig): string {
    const dataType = this.mapDataType(config.data_type);
    const jsonPath = this.escapeJsonPath(config.json_path);

    return `${dataType} GENERATED ALWAYS AS (JSON_UNQUOTE(JSON_EXTRACT(details, '${jsonPath}'))) VIRTUAL`;
  }

  private async createIndex(
    tableName: string,
    config: VirtualColumnConfig
  ): Promise<void> {
    const indexName = `idx_${tableName}_${config.column_name}`;
    const sql = `
      CREATE ${config.index_type} INDEX ${indexName}
      ON ${tableName} (${config.column_name})
    `;

    await this.dataSource.query(sql);
  }
}

// Example virtual column configuration for correspondence
const correspondenceVirtualColumns: VirtualColumnConfig[] = [
  {
    json_path: '$.projectId',
    column_name: 'ref_project_id',
    data_type: 'INT',
    index_type: 'INDEX',
    is_required: true,
  },
  {
    json_path: '$.priority',
    column_name: 'ref_priority',
    data_type: 'VARCHAR',
    index_type: 'INDEX',
    is_required: false,
  },
  {
    json_path: '$.dueDate',
    column_name: 'ref_due_date',
    data_type: 'DATE',
    index_type: 'INDEX',
    is_required: false,
  },
];
```

##### **[ ] T2.5.4 Dynamic Form Schema Management**

- [ ] **UI Schema Definition** สำหรับ frontend form generation
- [ ] **Field Dependency System** สำหรับ conditional fields
- [ ] **Validation Rule Sync** ระหว่าง backend-frontend
- [ ] **Form Template Registry** สำหรับ reusable form patterns

```typescript
interface UiSchema {
  type: 'object';
  properties: {
    [key: string]: UiSchemaField;
  };
  required?: string[];
  layout?: {
    type: 'tabs' | 'sections' | 'steps';
    groups: LayoutGroup[];
  };
}

interface UiSchemaField {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  widget?: 'text' | 'textarea' | 'select' | 'radio' | 'checkbox' | 'date';
  title: string;
  description?: string;
  placeholder?: string;
  enum?: string[];
  enumNames?: string[];
  dependencies?: FieldDependency[];
  conditions?: FieldCondition[];
  properties?: { [key: string]: UiSchemaField }; // for nested objects
  items?: UiSchemaField; // for arrays
}

interface FieldDependency {
  field: string;
  condition: {
    operator: 'equals' | 'notEquals' | 'contains' | 'greaterThan';
    value: any;
  };
  actions: {
    visibility?: boolean;
    required?: boolean;
    options?: string[];
  };
}

// Example: RFA Drawing Schema
const rfaDwgSchema: UiSchema = {
  type: 'object',
  layout: {
    type: 'tabs',
    groups: [
      {
        title: 'Basic Information',
        fields: ['title', 'description', 'discipline'],
      },
      {
        title: 'Drawing Details',
        fields: ['drawingReferences', 'revision', 'approvalType'],
      },
      {
        title: 'Technical Specifications',
        fields: ['materials', 'dimensions', 'tolerances'],
      },
    ],
  },
  properties: {
    title: {
      type: 'string',
      widget: 'text',
      title: 'Drawing Title',
      placeholder: 'Enter drawing title...',
      required: true,
    },
    discipline: {
      type: 'string',
      widget: 'select',
      title: 'Discipline',
      enum: ['CIVIL', 'STRUCTURAL', 'MECHANICAL', 'ELECTRICAL', 'PLUMBING'],
      enumNames: [
        'Civil',
        'Structural',
        'Mechanical',
        'Electrical',
        'Plumbing',
      ],
    },
    drawingReferences: {
      type: 'array',
      title: 'Related Contract Drawings',
      items: {
        type: 'string',
        widget: 'select',
        title: 'Drawing Number',
      },
    },
    approvalType: {
      type: 'string',
      widget: 'radio',
      title: 'Approval Type',
      enum: ['FULL_APPROVAL', 'PARTIAL_APPROVAL', 'COMMENTS_ONLY'],
      enumNames: ['Full Approval', 'Partial Approval', 'Comments Only'],
    },
  },
  required: ['title', 'discipline', 'approvalType'],
};
```

##### **[ ] T2.5.5 Data Migration & Version Compatibility**

- [ ] **Schema Migration Service** สำหรับอัพเกรด data ระหว่าง versions
- [ ] **Data Transformation Pipeline** สำหรับ backward compatibility
- [ ] **Version Rollback Mechanism** สำหรับ emergency situations
- [ ] **Migration Testing Framework** สำหรับ 确保 data integrity

```typescript
@Injectable()
export class SchemaMigrationService {
  async migrateData(
    entityType: string,
    entityId: string,
    targetVersion: number
  ): Promise<MigrationResult> {
    const currentData = await this.getCurrentData(entityType, entityId);
    const currentVersion = await this.getCurrentSchemaVersion(
      entityType,
      entityId
    );

    const migrationPath = await this.findMigrationPath(
      currentVersion,
      targetVersion
    );

    let migratedData = currentData;

    for (const migrationStep of migrationPath) {
      migratedData = await this.applyMigrationStep(migrationStep, migratedData);
    }

    // Validate migrated data against target schema
    const validationResult = await this.validateAgainstSchema(
      migratedData,
      targetVersion
    );

    if (!validationResult.isValid) {
      throw new MigrationError(
        'MIGRATION_VALIDATION_FAILED',
        validationResult.errors
      );
    }

    await this.saveMigratedData(
      entityType,
      entityId,
      migratedData,
      targetVersion
    );

    return {
      success: true,
      fromVersion: currentVersion,
      toVersion: targetVersion,
      migratedFields: this.getMigratedFields(currentData, migratedData),
    };
  }

  private async applyMigrationStep(
    step: MigrationStep,
    data: any
  ): Promise<any> {
    switch (step.type) {
      case 'FIELD_RENAME':
        return this.renameField(data, step.config);
      case 'FIELD_TRANSFORM':
        return this.transformField(data, step.config);
      case 'FIELD_ADD':
        return this.addField(data, step.config);
      case 'FIELD_REMOVE':
        return this.removeField(data, step.config);
      case 'STRUCTURE_CHANGE':
        return this.restructureData(data, step.config);
      default:
        throw new MigrationError('UNKNOWN_MIGRATION_TYPE');
    }
  }
}

// Example migration configuration
const migrationSteps = [
  {
    from_version: 1,
    to_version: 2,
    type: 'FIELD_RENAME',
    config: {
      old_field: 'project_id',
      new_field: 'ref_project_id',
    },
  },
  {
    from_version: 2,
    to_version: 3,
    type: 'FIELD_TRANSFORM',
    config: {
      field: 'priority',
      transform: 'MAP_VALUES',
      mapping: {
        HIGH: 'URGENT',
        MEDIUM: 'NORMAL',
        LOW: 'LOW',
      },
    },
  },
];
```

##### **[ ] T2.5.6 Security & Access Control for JSON Data**

- [ ] **Field-level Security** 基于 user roles
- [ ] **Data Encryption** สำหรับ sensitive fields
- [ ] **Audit Logging** สำหรับ JSON data changes
- [ ] **Input Sanitization** สำหรับป้องกัน XSS และ injection

```typescript
@Injectable()
export class JsonSecurityService {
  async applyFieldLevelSecurity(
    data: any,
    schema: any,
    userContext: UserContext
  ): Promise<any> {
    const securedData = { ...data };
    const securityRules = await this.getSecurityRules(schema.name);

    for (const [fieldPath, fieldConfig] of Object.entries(schema.properties)) {
      const fieldRules = securityRules[fieldPath];

      if (fieldRules && !this.hasFieldAccess(fieldRules, userContext)) {
        // Remove or mask field based on security rules
        if (fieldRules.on_deny === 'REMOVE') {
          this.deleteField(securedData, fieldPath);
        } else if (fieldRules.on_deny === 'MASK') {
          this.maskField(securedData, fieldPath, fieldRules.mask_pattern);
        }
      }
    }

    return securedData;
  }

  async encryptSensitiveFields(data: any, schema: any): Promise<any> {
    const encryptedData = { ...data };
    const sensitiveFields = this.getSensitiveFields(schema);

    for (const fieldPath of sensitiveFields) {
      const fieldValue = this.getFieldValue(data, fieldPath);
      if (fieldValue) {
        const encrypted = await this.cryptoService.encrypt(
          fieldValue,
          'field-level'
        );
        this.setFieldValue(encryptedData, fieldPath, encrypted);
      }
    }

    return encryptedData;
  }

  private getSensitiveFields(schema: any): string[] {
    const sensitiveFields: string[] = [];

    const traverseSchema = (obj: any, path: string = '') => {
      if (obj.properties) {
        for (const [key, value] of Object.entries(obj.properties)) {
          const currentPath = path ? `${path}.${key}` : key;

          if (value.sensitive) {
            sensitiveFields.push(currentPath);
          }

          if (value.properties || value.items) {
            traverseSchema(value, currentPath);
          }
        }
      }
    };

    traverseSchema(schema);
    return sensitiveFields;
  }
}
```

##### **[ ] T2.5.7 API Design & Integration**

- [ ] **Schema Management API** สำหรับ CRUD operations
- [ ] **Validation API** สำหรับ validate data against schemas
- [ ] **Migration API** สำหรับ manage data migrations
- [ ] **Integration Hooks** สำหรับ other modules

```typescript
@Controller('json-schema')
export class JsonSchemaController {
  @Post('validate/:schemaName')
  @RequirePermission('schema.validate')
  async validateData(
    @Param('schemaName') schemaName: string,
    @Body() dto: ValidateDataDto
  ): Promise<ValidationResult> {
    return this.jsonSchemaService.validateData(
      schemaName,
      dto.data,
      dto.options
    );
  }

  @Post('schemas')
  @RequirePermission('schema.manage')
  async createSchema(@Body() dto: CreateSchemaDto): Promise<JsonSchema> {
    return this.jsonSchemaService.createSchema(dto);
  }

  @Post('migrate/:entityType/:entityId')
  @RequirePermission('data.migrate')
  async migrateData(
    @Param('entityType') entityType: string,
    @Param('entityId') entityId: string,
    @Body() dto: MigrateDataDto
  ): Promise<MigrationResult> {
    return this.migrationService.migrateData(
      entityType,
      entityId,
      dto.targetVersion
    );
  }

  @Get('ui-schema/:schemaName')
  @RequirePermission('schema.view')
  async getUiSchema(
    @Param('schemaName') schemaName: string
  ): Promise<UiSchema> {
    return this.schemaService.getUiSchema(schemaName);
  }
}
```

### **[ ] T2.5.8 Integration with Document Modules**

- [ ] **Correspondence Module Integration**
- [ ] **RFA Module Integration**
- [ ] **Circulation Module Integration**
- [ ] **Drawing Module Integration**

```typescript
// Example: Correspondence Service Integration
@Injectable()
export class CorrespondenceService {
  constructor(
    private jsonSchemaService: JsonSchemaService,
    private detailsService: DetailsService
  ) {}

  async createCorrespondence(
    dto: CreateCorrespondenceDto
  ): Promise<Correspondence> {
    // 1. Validate details against schema
    const validationResult = await this.jsonSchemaService.validateData(
      `CORRESPONDENCE_${dto.type}`,
      dto.details
    );

    if (!validationResult.isValid) {
      throw new ValidationError('INVALID_DETAILS', validationResult.errors);
    }

    // 2. Apply security and sanitization
    const secureDetails = await this.detailsService.sanitizeDetails(
      validationResult.sanitizedData,
      dto.type
    );

    // 3. Create correspondence entity
    const correspondence = this.correspondenceRepository.create({
      ...dto,
      details: secureDetails,
      schema_version: await this.getCurrentSchemaVersion(
        `CORRESPONDENCE_${dto.type}`
      ),
    });

    // 4. Setup virtual columns for performance
    await this.setupVirtualColumns(correspondence);

    return this.correspondenceRepository.save(correspondence);
  }

  async searchCorrespondences(
    filters: SearchFilters
  ): Promise<Correspondence[]> {
    // Use virtual columns for efficient filtering
    const query = this.correspondenceRepository.createQueryBuilder('c');

    if (filters.projectId) {
      query.andWhere('c.ref_project_id = :projectId', {
        projectId: filters.projectId,
      });
    }

    if (filters.priority) {
      query.andWhere('c.ref_priority = :priority', {
        priority: filters.priority,
      });
    }

    return query.getMany();
  }
}
```

##### **[ ] T2.5.9 Testing Strategy**

- [ ] **Unit Tests** สำหรับ schema validation และ transformation
- [ ] **Integration Tests** สำหรับ end-to-end data flow
- [ ] **Performance Tests** สำหรับ virtual columns และ large datasets
- [ ] **Security Tests** สำหรับ field-level security

```typescript
describe('JsonSchemaService', () => {
  describe('validateData', () => {
    it('should validate correct RFA_DWG data successfully', async () => {
      const testData = {
        title: 'Structural Beam Details',
        discipline: 'STRUCTURAL',
        drawingReferences: ['CD-STR-001', 'CD-STR-002'],
        approvalType: 'FULL_APPROVAL',
        materials: ['STEEL_A36', 'CONCRETE_40MPA'],
      };

      const result = await jsonSchemaService.validateData('RFA_DWG', testData);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid discipline value', async () => {
      const testData = {
        title: 'Test Drawing',
        discipline: 'INVALID_DISCIPLINE', // Not in enum
        approvalType: 'FULL_APPROVAL',
      };

      const result = await jsonSchemaService.validateData('RFA_DWG', testData);

      expect(result.isValid).toBe(false);
      expect(result.errors[0].message).toContain('discipline');
    });
  });
});

describe('VirtualColumnService', () => {
  it('should improve search performance with virtual columns', async () => {
    // Create test data with JSON details
    await createTestCorrespondences(1000);

    // Search without virtual column (JSON_EXTRACT)
    const startTime1 = Date.now();
    const result1 = await correspondenceRepository
      .createQueryBuilder('c')
      .where("JSON_EXTRACT(c.details, '$.projectId') = :projectId", {
        projectId: 123,
      })
      .getMany();
    const time1 = Date.now() - startTime1;

    // Search with virtual column
    const startTime2 = Date.now();
    const result2 = await correspondenceRepository
      .createQueryBuilder('c')
      .where('c.ref_project_id = :projectId', { projectId: 123 })
      .getMany();
    const time2 = Date.now() - startTime2;

    expect(time2).toBeLessThan(time1 * 0.5); // At least 2x faster
    expect(result1.length).toEqual(result2.length);
  });
});
```

#### 🔗 **Critical Dependencies**

- **T1.1** (Common Module) - สำหรับ base entities และ shared services
- **T1.4** (RBAC Guard) - สำหรับ field-level security
- **T0.3** (Database) - สำหรับ virtual columns implementation
- **T3.2** (Correspondence) - สำหรับ integration testing

#### 🎯 **Success Metrics**

- ✅ JSON validation performance: < 10ms ต่อ request
- ✅ Virtual columns improve search performance 5x+
- ✅ Support schema evolution without data loss
- ✅ Field-level security enforced across all modules
- ✅ 100% test coverage สำหรับ core validation logic

* **[ ] T2.6 MasterModule - Advanced Data (Req 6B)** (New)
  - [ ] Update Entities: `Discipline`, `CorrespondenceSubType`
  - [ ] Create Services/Controllers for CRUD Operations (Admin Panel Support)
  - [ ] Implement Seeding Logic for initial 6B data
  - [ ] **Deliverable:** API for managing Disciplines and Sub-types
  - [ ] **Dependencies:** T1.1, T0.3

---

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

- **[ ] T3.1.1 Workflow DSL Specification & Grammar**
  - [ ] Define EBNF Grammar สำหรับ Workflow DSL
  - [ ] Create YAML Schema สำหรับ human-friendly workflow definitions
  - [ ] Design JSON Schema สำหรับ compiled workflow representations

```yaml
# ตัวอย่าง DSL Structure

workflow: RFA_APPROVAL
version: 1.0
description: "RFA Approval Workflow with Parallel Reviews"

states:

- name: DRAFT
  initial: true
  metadata:
  color: "gray"
  icon: "draft"
  on:
  SUBMIT:
  to: TECHNICAL_REVIEW
  conditions: - expression: "user.hasRole('ENGINEER')"
  requirements: - role: "ENGINEER"
  events: - type: "notify"
  target: "reviewers"
  template: "NEW_RFA_SUBMITTED" - type: "assign"
  target: "technical_lead"

- name: TECHNICAL_REVIEW
  metadata:
  color: "blue"
  icon: "review"
  on:
  APPROVE:
  to: MANAGERIAL_REVIEW
  conditions: - expression: "user.department === context.document.department"
  REQUEST_CHANGES:
  to: DRAFT
  events: - type: "notify"
  target: "creator"
  template: "CHANGES_REQUESTED"
  ESCALATE:
  to: ESCALATED_REVIEW
  conditions: - expression: "document.priority === 'HIGH'"

- name: PARALLEL_APPROVAL
  parallel: true
  branches:

  - MANAGERIAL_REVIEW
  - FINANCIAL_REVIEW
    on:
    ALL_APPROVED:
    to: APPROVED
    ANY_REJECTED:
    to: REJECTED

- name: APPROVED
  terminal: true
  metadata:
  color: "green"
  icon: "approved"
  Versioning Strategy สำหรับ workflow definitions
```

- **[ ] T3.1.2 Workflow Core Entities & Database Schema**

  - [ ] WorkflowDefinition Entity
  - [ ] WorkflowInstance Entity
  - [ ] WorkflowHistory Entity
  - [ ] WorkflowTransition Entity

```typescript
// Core Entities Design
@Entity()
export class WorkflowDefinition {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column()
  version: number;

  @Column('json')
  dsl_raw: any; // YAML/JSON DSL

  @Column('json')
  compiled_schema: any; // Normalized JSON

  @Column({ default: true })
  is_active: boolean;

  @CreateDateColumn()
  created_at: Date;

  @VersionColumn()
  version: number;
}

@Entity()
export class WorkflowInstance {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => WorkflowDefinition)
  definition: WorkflowDefinition;

  @Column()
  entity_type: string; // 'correspondence', 'rfa', 'circulation'

  @Column()
  entity_id: string;

  @Column()
  current_state: string;

  @Column('json')
  context: any; // Workflow-specific data

  @Column('json')
  history: any[]; // State transition history

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
```

- **[ ] T3.1.3 DSL Parser & Compiler Service**

  - [ ] YAML Parser สำหรับอ่าน DSL definitions
  - [ ] Syntax Validator สำหรับ compile-time validation
  - [ ] Schema Compiler สำหรับแปลง DSL → Normalized JSON
  - [ ] Version Migration สำหรับอัพเกรด workflow definitions

```typescript
@Injectable()
export class WorkflowDslService {
  async parseAndValidate(dslContent: string): Promise<CompiledWorkflow> {
    // 1. Parse YAML
    const rawDefinition = yaml.parse(dslContent);

    // 2. Validate Syntax
    await this.validateSyntax(rawDefinition);

    // 3. Compile to Normalized JSON
    const compiled = await this.compileDefinition(rawDefinition);

    // 4. Validate Business Rules
    await this.validateBusinessRules(compiled);

    return compiled;
  }

  private async validateSyntax(definition: any): Promise<void> {
    const rules = [
      // ต้องมีอย่างน้อย 1 initial state
      () => definition.states.some((s) => s.initial),
      // Terminal states ต้องไม่มี transitions
      () => !definition.states.filter((s) => s.terminal).some((s) => s.on),
      // State names must be unique
      () =>
        new Set(definition.states.map((s) => s.name)).size ===
        definition.states.length,
      // Transition targets must exist
      () => this.validateTransitionTargets(definition),
    ];

    for (const rule of rules) {
      if (!rule()) {
        throw new WorkflowValidationError('DSL_VALIDATION_FAILED');
      }
    }
  }
}
```

- **[ ] T3.1.4 Workflow Runtime Engine**
  - [ ] State Machine Engine สำหรับจัดการ state transitions
  - [ ] Condition Evaluator สำหรับประเมิน conditional transitions
  - [ ] Permission Checker สำหรับตรวจสอบสิทธิ์ในการเปลี่ยนสถานะ
  - [ ] Event Dispatcher สำหรับจัดการ workflow events

```typescript
****@Injectable()
export class WorkflowEngineService {
  async processTransition(
    instanceId: string,
    action: string,
    context: WorkflowContext
  ): Promise<TransitionResult> {
    // 1. Load Workflow Instance
    const instance = await this.findInstance(instanceId);
    const definition = await this.getCompiledDefinition(instance.definition_id);

    // 2. Validate Current State & Action
    const currentState = definition.states[instance.current_state];
    const transition = currentState.transitions[action];

    if (!transition) {
      throw new WorkflowError('INVALID_TRANSITION');
    }

    // 3. Check Permissions & Conditions
    await this.validatePermissions(transition, context);
    await this.validateConditions(transition, context);

    // 4. Execute Pre-Transition Hooks
    await this.executeHooks('pre_transition', instance, transition, context);

    // 5. Perform State Transition
    const previousState = instance.current_state;
    instance.current_state = transition.to;

    // 6. Record History
    await this.recordTransitionHistory(instance, {
      from: previousState,
      to: transition.to,
      action,
      user: context.userId,
      timestamp: new Date(),
      metadata: context.metadata
    });

    // 7. Execute Post-Transition Events
    await this.executeEvents(transition.events, instance, context);

    // 8. Execute Post-Transition Hooks
    await this.executeHooks('post_transition', instance, transition, context);

    // 9. Save Instance
    await this.saveInstance(instance);

    return {
      success: true,
      previousState,
      newState: transition.to,
      instanceId: instance.id
    };
  }

  async getAvailableActions(
    instanceId: string,
    context: WorkflowContext
  ): Promise<string[]> {
    const instance = await this.findInstance(instanceId);
    const definition = await this.getCompiledDefinition(instance.definition_id);
    const currentState = definition.states[instance.current_state];

    return Object.keys(currentState.transitions).filter(action => {
      const transition = currentState.transitions[action];
      return this.isActionAvailable(transition, context);
    });
  }
}
```

- **[ ] T3.1.5 Advanced Feature Implementation**
  - [ ] Parallel Approval Flows สำหรับ multi-department approvals
  - [ ] Conditional Transitions ด้วย expression evaluation
  - [ ] Timeout & Escalation สำหรับขั้นตอนที่เกินกำหนด
  - [ ] Rollback & Compensation สำหรับย้อนกลับสถานะ

```typescript
// Parallel Workflow Support
interface ParallelState {
  parallel: true;
  branches: string[];
  completion_policy: 'ALL' | 'ANY' | 'MAJORITY';
  on: {
    [completionType: string]: {
      to: string;
      conditions?: Condition[];
    };
  };
}

// Conditional Transition Support
interface ConditionalTransition {
  to: string;
  conditions: Array<{
    expression: string; // "user.role === 'MANAGER' && document.value > 10000"
    evaluator?: 'javascript' | 'jsonlogic';
  }>;
  requirements?: PermissionRequirement[];
}

// Timeout & Escalation
interface StateWithTimeout {
  timeout_seconds: number;
  on_timeout: {
    action: string;
    escalate_to?: string;
    notify?: string[];
  };
}
```

- **[ ] T3.1.6 Event System & Integration**
  - [ ] Event Types (notify, assign, webhook, auto_action)
  - [ ] Template Engine สำหรับ dynamic messages
  - [ ] Webhook Support สำหรับ external integrations
  - [ ] Notification Service Integration

```typescript
@Injectable()
export class WorkflowEventService {
  async executeEvents(
    events: WorkflowEvent[],
    instance: WorkflowInstance,
    context: WorkflowContext
  ): Promise<void> {
    for (const event of events) {
      switch (event.type) {
        case 'notify':
          await this.handleNotifyEvent(event, instance, context);
          break;
        case 'assign':
          await this.handleAssignEvent(event, instance, context);
          break;
        case 'webhook':
          await this.handleWebhookEvent(event, instance, context);
          break;
        case 'auto_action':
          await this.handleAutoActionEvent(event, instance, context);
          break;
      }
    }
  }

  private async handleNotifyEvent(
    event: NotifyEvent,
    instance: WorkflowInstance,
    context: WorkflowContext
  ): Promise<void> {
    const recipients = await this.resolveRecipients(
      event.target,
      instance,
      context
    );
    const message = await this.renderTemplate(
      event.template,
      instance,
      context
    );

    await this.notificationService.send({
      type: 'workflow',
      recipients,
      subject: message.subject,
      body: message.body,
      metadata: {
        workflow_instance_id: instance.id,
        state: instance.current_state,
        action: context.action,
      },
    });
  }
}
```

- **[ ] T3.1.7 API Design & Controllers**
  - [ ] REST API Endpoints สำหรับ workflow management
  - [ ] WebSocket Support สำหรับ real-time updates
  - [ ] Admin API สำหรับ workflow definition management
  - [ ] Integration Hooks สำหรับ external systems

```typescript
@Controller('workflow')
export class WorkflowEngineController {
  @Post('instances/:id/transition')
  @RequirePermission('workflow.execute')
  async processTransition(
    @Param('id') instanceId: string,
    @Body() dto: WorkflowTransitionDto
  ): Promise<TransitionResult> {
    return this.workflowEngine.processTransition(
      instanceId,
      dto.action,
      dto.context
    );
  }

  @Get('instances/:id/actions')
  @RequirePermission('workflow.view')
  async getAvailableActions(
    @Param('id') instanceId: string,
    @Query() context: WorkflowContext
  ): Promise<string[]> {
    return this.workflowEngine.getAvailableActions(instanceId, context);
  }

  @Post('definitions')
  @RequirePermission('workflow.manage')
  async createWorkflowDefinition(
    @Body() dto: CreateWorkflowDefinitionDto
  ): Promise<WorkflowDefinition> {
    return this.workflowDslService.compileAndSave(dto.dslContent);
  }

  @Get('instances/:id/history')
  @RequirePermission('workflow.view')
  async getWorkflowHistory(
    @Param('id') instanceId: string
  ): Promise<WorkflowHistory[]> {
    return this.workflowHistoryService.getHistory(instanceId);
  }
}
```

- **[ ] T3.1.8 Integration (Clean Migration)**
  - [ ] Correspondence: เชื่อมต่อ CorrespondenceWorkflowService
  - [ ] RFA: เชื่อมต่อ RfaWorkflowService กับ Engine (ลบ Code เก่าที่ใช้ตาราง rfa_workflows)
  - [ ] Circulation: เชื่อมต่อ CirculationWorkflowService กับ Engine (ลบ Code เก่าที่ใช้ตาราง circulation_routings)
  - [ ] Notification Module Integration

```typescript
// Correspondence Integration Example
@Injectable()
export class CorrespondenceWorkflowService {
  constructor(
    private workflowEngine: WorkflowEngineService,
    private correspondenceService: CorrespondenceService
  ) {}

  async submitCorrespondence(
    correspondenceId: string,
    userId: string
  ): Promise<void> {
    const correspondence = await this.correspondenceService.findById(
      correspondenceId
    );

    // Create workflow instance
    const instance = await this.workflowEngine.createInstance({
      definition: 'CORRESPONDENCE_ROUTING',
      entity_type: 'correspondence',
      entity_id: correspondenceId,
      context: {
        document: correspondence,
        user: userId,
      },
    });

    // Process initial transition
    await this.workflowEngine.processTransition(instance.id, 'SUBMIT', {
      userId,
      metadata: { correspondenceId },
    });
  }
}
```

- [ ] **T3.1.9 Cleanup Legacy Code:**

  - [ ] ลบ Entity/Repository ของตารางเก่า (_\_routings, _\_templates) ออกจาก Codebase
  - [ ] อัปเดต SQL Migration ให้ Drop ตารางเก่าทิ้ง

- [ ] **T3.1.10 Testing Strategy**
  - [ ] Unit Tests สำหรับ DSL parser และ state machine
  - [ ] Integration Tests สำหรับ end-to-end workflow execution
  - [ ] Performance Tests สำหรับ high-concurrency scenarios
  - [ ] Security Tests สำหรับ permission validation.

```typescript
describe('WorkflowEngineService', () => {
  describe('processTransition', () => {
    it('should successfully transition state with valid permissions', async () => {
      // Arrange
      const instance = await createTestInstance();
      const context = { userId: 'user1', roles: ['APPROVER'] };

      // Act
      const result = await workflowEngine.processTransition(
        instance.id,
        'APPROVE',
        context
      );

      // Assert
      expect(result.success).toBe(true);
      expect(result.newState).toBe('APPROVED');
    });

    it('should reject transition without required permissions', async () => {
      // Arrange
      const instance = await createTestInstance();
      const context = { userId: 'user2', roles: ['VIEWER'] };

      // Act & Assert
      await expect(
        workflowEngine.processTransition(instance.id, 'APPROVE', context)
      ).rejects.toThrow(WorkflowError);
    });
  });
});
```

- **🔗 Critical Dependencies of T3.1.1-T3.1.8**

  - T1.1 (Common Module) - สำหรับ base entities และ shared services
  - T1.4 (RBAC Guard) - สำหรับ permission checking
  - T2.5 (JSON Schema) - สำหรับ DSL validation
  - T6.2 (Notification) - สำหรับ event handling

- **🎯 Success Metrics**

  - ✅ Support ทั้ง Correspondence Routing และ RFA Workflow
  - ✅ DSL ที่ human-readable และ editable โดยไม่ต้องแก้โค้ด
  - ✅ Performance: < 50ms ต่อ state transition
  - ✅ 100% test coverage สำหรับ core workflow logic
  - ✅ Complete audit trail สำหรับทุก workflow instance

- **[ ] T3.2 CorrespondenceModule - Basic CRUD**

  - [ ] สร้าง Entities (Correspondence, Revision, Recipient, Tag, Reference, Attachment)
  - [ ] สร้าง CorrespondenceService (Create with Document Numbering, Update with new Revision, Soft Delete)
  - [ ] สร้าง Controllers (POST/GET/PUT/DELETE /correspondences)
  - [ ] Implement Impersonation Logic: ตรวจสอบ originatorId ใน DTO หากมีการส่งมา ต้องเช็คว่า User ปัจจุบันมีสิทธิ์กระทำการแทนหรือไม่ (Superadmin)
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

---

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

---

## **Phase 5: Workflow Systems & Resilience (สัปดาห์ที่ 8-9)**

**Milestone:** ระบบ Workflow ทั้งหมดพร้อม Resilience Patterns

### **Phase 5: Tasks**

- **[ ] T5.1 RfaModule with Unified Workflow**

  - [ ] สร้าง Entities (Rfa, RfaRevision, RfaItem)
  - [ ] สร้าง RfaService (Create RFA, Link Shop Drawings)
  - [ ] Implement RFA Workflow โดยใช้ Configuration ของ `WorkflowEngineModule`
  - [ ] สร้าง Controllers (POST/GET /rfas, POST /rfas/:id/workflow/...)
  - [ ] **Resilience:** Implement circuit breaker สำหรับ notification services
  - [ ] **Deliverable:** RFA Workflow ทำงานได้ด้วย Unified Engine
  - [ ] **Dependencies:** T3.2, T4.2, T2.5, T6.2

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

---

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

---

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
  - [ ] **Deliverable:** Security และ Idempotency ทำงานได้ตาม 设计要求

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

---

## **Phase 8: Documentation & Deployment (สัปดาห์ที่ 14)**

**Milestone:** เอกสารและ Deploy สู่ Production พร้อม Security Hardening

### **Phase 8: Tasks**

- **[ ] T8.1 API Documentation (Swagger)**
- **[ ] T8.2 Technical Documentation**
- **[ ] T8.3 Security Hardening**
- **[ ] T8.4 Deployment Preparation (QNAP Setup, Nginx Proxy Manager)**
- **[ ] T8.5 Production Deployment**
- **[ ] T8.6 Handover to Frontend Team**

---

## 📊 **สรุป Timeline**

| Phase   | ระยะเวลา       | จำนวนงาน     | Output หลัก                                    |
| :------ | :------------- | :----------- | :--------------------------------------------- |
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

- **Document:** Backend Development Plan v1.4.5
- **Version:** 1.4
- **Date:** 2025-11-29
- **Author:** NAP LCBP3-DMS & Gemini
- **Status:** FINAL-Rev.05
- **Classification:** Internal Technical Documentation
- **Approved By:** Nattanin

---

`End of Backend Development Plan v1.4.5`
