# 📋 **แผนการพัฒนา Backend (NestJS) - LCBP3-DMS v1.4.1 (ปรับปรุงโดย deepseek)**

**ปรับปรุงตาม Requirements v1.4.0 ที่อัปเดตแล้ว\*
**Routing และ รูปแบบ JSON details\*\*

---

## 🎯 **ภาพรวมโครงการ**

พัฒนา Backend สำหรับระบบบริหารจัดการเอกสารโครงการ (Document Management System) ที่รองรับการจัดการเอกสารที่ซับซ้อน มีระบบ Workflow การอนุมัติ และการควบคุมสิทธิ์แบบ RBAC 4 ระดับ พร้อมมาตรการความปลอดภัยที่ทันสมัย

---

## 📐 **สถาปัตยกรรมระบบ**

### **Technology Stack**

- **Framework:** NestJS (TypeScript, ESM)
- **Database:** MariaDB 10.11
- **ORM:** TypeORM
- **Authentication:** JWT + Passport
- **Authorization:** CASL (RBAC 4-level)
- **File Upload:** Multer + Virus Scanning (ClamAV)
- **Search:** Elasticsearch
- **Notification:** Nodemailer + n8n (Line Integration)
- **Caching:** Redis
- **Resilience:** Circuit Breaker, Retry Patterns
- **Security:** Helmet, CSRF Protection, Rate Limiting
- **Monitoring:** Winston, Health Checks, Metrics
- **Scheduling:** @nestjs/schedule (Cron Jobs)
- **Documentation:** Swagger

### **โครงสร้างโมดูล (Domain-Driven)**

```tree
src/
├── common/                    # Shared Module
│   ├── auth/                 # JWT, Guards, RBAC
│   ├── config/               # Configuration Management
│   ├── decorators/           # @RequirePermission, @RateLimit
│   ├── entities/             # Base Entities
│   ├── exceptions/           # Global Filters
│   ├── file-storage/         # FileStorageService (Virus Scanning)
│   ├── guards/               # RBAC Guard, RateLimitGuard
│   ├── interceptors/         # Audit, Transform, Performance
│   ├── resilience/           # Circuit Breaker, Retry Patterns
│   ├── security/             # Input Validation, XSS Protection
│   └── services/             # Notification, Caching, Monitoring
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
│   └── document-numbering/   # Internal Service (Redis Locking)
└── database/                 # Migrations & Seeds
```

---

## 🗓️ **แผนการพัฒนาแบบ Phase-Based**

### **Dependency Diagram (ภาพรวม)**

```mermaid
  %% Phase 0: Infrastructure
  subgraph Phase 0 [Phase 0: Infrastructure Setup]
      T0_1[T0.1: Setup QNAP Container Station]
      T0_2[T0.2: Initialize NestJS Project]
      T0_3[T0.3: Setup Database Connection]
      T0_4[T0.4: Setup Git Repository]
  end

  %% Phase 1: Core Foundation
  subgraph Phase 1 [Phase 1: Core Foundation & Security]
      T1_1[T1.1: CommonModule - Base Infrastructure]
      T1_2[T1.2: AuthModule - JWT Authentication]
      T1_3[T1.3: UserModule - User Management]
      T1_4[T1.4: RBAC Guard - 4-Level Authorization]
      T1_5[T1.5: ProjectModule - Base Structures]
  end

  %% Phase 2: Security & File Management
  subgraph Phase 2 [Phase 2: Security & File Management]
      T2_1[T2.1: MasterModule - Master Data Management]
      T2_2[T2.2: FileStorageService - Secure File Management]
      T2_3[T2.3: DocumentNumberingModule - App-Level Locking]
      T2_4[T2.4: SecurityModule - Enhanced Security]
      T2_5[T2.5: JSON Details & Schema Management]
  end

  %% Phase 3: Correspondence & RFA Core
  subgraph Phase 3 [Phase 3: Correspondence & RFA Core]
      T3_1[T3.1: CorrespondenceModule - Basic CRUD]
      T3_2[T3.2: CorrespondenceModule - Advanced Features]
      T3_3[T3.3: RfaModule - Basic CRUD]
      T3_4[T3.4: Correspondence Routing]
  end

  %% Phase 4: Drawing Management
  subgraph Phase 4 [Phase 4: Drawing Management]
      T4_1[T4.1: DrawingModule - Contract Drawings]
      T4_2[T4.2: DrawingModule - Shop Drawings]
  end

  %% Phase 5: Workflow Systems & Resilience
  subgraph Phase 5 [Phase 5: Workflow Systems & Resilience]
      T5_1[T5.1: RfaModule - Workflow Implementation]
      T5_2[T5.2: CirculationModule - Internal Routing]
      T5_3[T5.3: TransmittalModule - Document Forwarding]
  end

  %% Phase 6: Advanced Features & Monitoring
  subgraph Phase 6 [Phase 6: Advanced Features & Monitoring]
      T6_1[T6.1: SearchModule - Elasticsearch Integration]
      T6_2[T6.2: NotificationModule - Email & Line]
      T6_3[T6.3: MonitoringModule - Observability]
      T6_4[T6.4: ResilienceModule - Circuit Breaker & Retry]
  end

  %% Phase 7: Testing & Optimization
  subgraph Phase 7 [Phase 7: Testing & Optimization]
      T7_1[T7.1: Unit Testing]
      T7_2[T7.2: Integration Testing]
      T7_3[T7.3: E2E Testing]
      T7_4[T7.4: Performance Testing]
      T7_5[T7.5: Security Testing]
      T7_6[T7.6: Performance Optimization]
  end

  %% Phase 8: Documentation & Deployment
  subgraph Phase 8 [Phase 8: Documentation & Deployment]
      T8_1[T8.1: API Documentation]
      T8_2[T8.2: Technical Documentation]
      T8_3[T8.3: Security Hardening]
      T8_4[T8.4: Deployment Preparation]
      T8_5[T8.5: Production Deployment]
      T8_6[T8.6: Handover to Frontend Team]
  end

  %% Dependencies
  T0_1 --> T0_2
  T0_2 --> T0_3
  T0_3 --> T0_4

  T0_2 --> T1_1
  T0_3 --> T1_1
  T1_1 --> T1_2
  T1_1 --> T1_3
  T1_1 --> T1_4
  T1_1 --> T1_5
  T1_2 --> T1_3
  T1_3 --> T1_4

  T0_3 --> T2_1
  T1_1 --> T2_1
  T1_5 --> T2_1
  T1_1 --> T2_2
  T1_4 --> T2_2
  T1_1 --> T2_3
  T1_1 --> T2_4
  T1_1 --> T2_5

  T1_1 --> T3_1
  T1_2 --> T3_1
  T1_3 --> T3_1
  T1_4 --> T3_1
  T1_5 --> T3_1
  T2_3 --> T3_1
  T2_2 --> T3_1
  T2_5 --> T3_1
  T3_1 --> T3_2
  T3_1 --> T3_3
  T1_5 --> T3_3
  T3_1 --> T3_4
  T2_5 --> T3_4

  T1_1 --> T4_1
  T1_2 --> T4_1
  T1_4 --> T4_1
  T1_5 --> T4_1
  T2_2 --> T4_1
  T4_1 --> T4_2

  T3_3 --> T5_1
  T4_2 --> T5_1
  T2_5 --> T5_1
  T3_1 --> T5_2
  T2_5 --> T5_2
  T3_1 --> T5_3

  T3_1 --> T6_1
  T3_3 --> T6_1
  T4_2 --> T6_1
  T5_2 --> T6_1
  T5_3 --> T6_1
  T1_1 --> T6_2
  T6_4 --> T6_2
  T1_1 --> T6_3
  T1_1 --> T6_4

  %% All development phases must be complete before testing
  T1_5 --> T7_1
  T2_5 --> T7_1
  T3_4 --> T7_1
  T4_2 --> T7_1
  T5_3 --> T7_1
  T6_4 --> T7_1
  T7_1 --> T7_2
  T7_2 --> T7_3
  T7_3 --> T7_4
  T7_4 --> T7_5
  T7_5 --> T7_6

  %% Testing must be complete before deployment
  T7_6 --> T8_1
  T8_1 --> T8_2
  T8_2 --> T8_3
  T8_3 --> T8_4
  T8_4 --> T8_5
  T8_5 --> T8_6
```

## **Phase 0: Infrastructure Setup (สัปดาห์ที่ 1)**

**Milestone:** สร้างโครงสร้างพื้นฐานและเชื่อมต่อ Services พร้อม Security Baseline

### **Phase 0: Tasks**

- **[✅] T0.1 Setup QNAP Container Station**
  - [✅]สร้าง Docker Network: `lcbp3`
  - [✅]Setup docker-compose.yml สำหรับ:
    - [✅]MariaDB (db.np-dms.work) -> MariaDB_setting.md
    - [✅]PHPMyAdmin (pma.np-dms.work) -> MariaDB_setting.md
    - [✅]Gitea (git.np-dms.work) -> Gitea_setting.md
    - [✅]Nginx Proxy Manager (npm.np-dms.work) -> NPM_setting.md
    - [✅]n8n (n8n.np-dms.work) -> n8n_setting.md
    - [✅]Backend (backend.np-dms.work)
    - [✅]Redis
    - [✅]Elasticsearch
    - [✅]ClamAV
  - กำหนด Environment Variables ใน docker-compose.yml (ไม่ใช้ .env)
  - **Security:** Setup network segmentation และ firewall rules
  - [✅] **Deliverable:** Services ทั้งหมดรันได้และเชื่อมต่อกันผ่าน Network
  - **Dependencies:** None (Task เริ่มต้น)

- **[✅] T0.2 Initialize NestJS Project**
  - [ ] สร้างโปรเจกต์ใหม่ด้วย Nest CLI
  - [ ] ติดตั้ง Dependencies:
  - [ ] ตั้งค่า ESLint และ Prettier สำหรับรักษามาตรฐานโค้ด

  ```bash
  # Core
  npm install @nestjs/core @nestjs/common @nestjs/platform-express
  npm install @nestjs/typeorm typeorm mysql2
  npm install @nestjs/config class-validator class-transformer

  # Auth & Security
  npm install @nestjs/jwt @nestjs/passport passport passport-jwt
  npm install casl helmet csurf rate-limiter-flexible bcrypt crypto

  # File & Search
  npm install multer @nestjs/elasticsearch @elastic/elasticsearch
  npm install clamscan @types/multer

  # Resilience & Caching
  npm install @nestjs/cache-manager cache-manager cache-manager-redis-store
  npm install @nestjs/circuit-breaker

  # Monitoring & Scheduling
  npm install @nestjs/schedule @nestjs/monitoring winston

  # Documentation
  npm install @nestjs/swagger

  # Development
  npm install --save-dev @nestjs/testing jest @types/jest supertest
  npm install --save-dev @types/passport-jwt @types/bcrypt @types/crypto
  ```

  - Setup โครงสร้างโฟลเดอร์ตาม Domain-Driven Architecture
  - **Security:** Initialize security headers และ CORS configuration
  - [ ] **Deliverable:** Project Structure พร้อม, แสดง Swagger ที่ `/api`
  - **Dependencies:** T0.1 (ต้องมี Docker Network และ Environment พร้อมก่อนสร้าง Project)

- **[✅] T0.3 Setup Database Connection**
  - Import SQL Schema v1.4.0 เข้า MariaDB
  - Run Seed Data (organizations, users, roles, permissions)
  - Configure TypeORM ใน AppModule
  - **Security:** Setup database connection encryption
  - ทดสอบ Connection
  - [ ] **Deliverable:** Database พร้อมใช้งาน, มี Seed Data
  - **Dependencies:** T0.1 (ต้องมี MariaDB Container รันแล้ว), T0.2 (ต้องมี NestJS Project พร้อมสำหรับตั้งค่า TypeORM)

- **[✅] T0.4 Setup Git Repository**
  - สร้าง Repository ใน Gitea (git.np-dms.work)
  - Setup .gitignore, README.md, SECURITY.md
  - Commit Initial Project
  - [ ] **Deliverable:** Code อยู่ใน Version Control
  - **Dependencies:** T0.2 (ต้องมี Project และโครงสร้างพื้นฐานก่อนจะ Commit)

### **Phase 0: Testing - Infrastructure Validation**

#### **T0.T1 Database Connectivity Tests**

- [ ] **Unit Tests:**
  - [ ] Test database connection configuration
  - [ ] Test connection pooling settings
  - [ ] Test connection error handling
- [ ] **Integration Tests:**
  - [ ] Test actual database connection
  - [ ] Test database migrations
  - [ ] Test seed data loading
  - [ ] Test backup/restore procedures
- [ ] **Performance Tests:**
  - [ ] Test connection acquisition time < 100ms
  - [ ] Test concurrent connections handling
- **Exit Criteria:** Database tests 100% passed

#### **T0.T2 Service Connectivity Tests**

- [ ] **Integration Tests:**
  - [ ] Test Docker network connectivity
  - [ ] Test inter-service communication
  - [ ] Test Nginx proxy configuration
  - [ ] Test SSL certificate setup
- [ ] **Security Tests:**
  - [ ] Test firewall rules
  - [ ] Test port exposure
  - [ ] Test environment variables security
- **Exit Criteria:** All services can communicate securely

#### **T0.T3 Project Setup Tests**

- [ ] **Unit Tests:**
  - [ ] Test NestJS project structure
  - [ ] Test dependency configurations
  - [ ] Test build process
- [ ] **Integration Tests:**
  - [ ] Test Swagger documentation generation
  - [ ] Test health check endpoints
  - [ ] Test error handling setup
- **Exit Criteria:** Project setup verified and documented

---

## **Phase 1: Core Foundation & Security (สัปดาห์ที่ 2-3)**

**Milestone:** ระบบ Authentication, Authorization, Security Baseline และ Base Entities

### **Phase 1: Tasks**

- **[ ] T1.1 CommonModule - Base Infrastructure**
  - [ ] สร้าง Base Entity (id, created_at, updated_at, deleted_at)
  - [ ] สร้าง Global Exception Filter (ไม่เปิดเผย sensitive information)
  - [ ] สร้าง Response Transform Interceptor
  - [ ] สร้าง Audit Log Interceptor
  - [ ] สร้าง RequestContextService - สำหรับเก็บข้อมูลระหว่าง Request
  - [ ] สร้าง ConfigService - Centralized configuration management
  - [ ] สร้าง CryptoService - สำหรับ encryption/decryption
  - [ ] **Security:** Implement input validation pipeline
  - [ ] **Deliverable:** Common Services พร้อมใช้
  - [ ] **Dependencies:** T0.2, T0.3 (ต้องมี Project และ Database Connection พร้อมสำหรับสร้าง Base Entity และ Services)

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
  - [ ] **Dependencies:** T1.1 (ต้องใช้ Base Entity, ConfigService, CryptoService), T0.3 (ต้องเชื่อมต่อกับ User table)

- **[ ] T1.3 UserModule - User Management**
  - [ ] สร้าง Entities: User, Role, Permission, UserRole, UserAssignment
  - [ ] สร้าง UserService CRUD (พร้อม soft delete)
  - [ ] สร้าง RoleService CRUD
  - [ ] สร้าง PermissionService (Read-Only, จาก Seed)
  - [ ] สร้าง UserAssignmentService - สำหรับจัดการ user assignments ตาม scope
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
  - [ ] **Deliverable:** จัดการผู้ใช้และ Role ได้
  - [ ] **Dependencies:** T1.1 (Base Entity, Global Exception Filter), T1.2 (สำหรับ Authentication และ Authorization)

- **[ ] T1.4 RBAC Guard - 4-Level Authorization**
  - [ ] สร้าง @RequirePermission() Decorator
  - [ ] สร้าง RbacGuard ที่ตรวจสอบ 4 ระดับ:
    - [ ] Global Permissions
    - [ ] Organization Permissions
    - [ ] Project Permissions
    - [ ] Contract Permissions
  - [ ] Permission Hierarchy Logic:
  - [ ] Integration กับ CASL
  - [ ] **Security:** Implement audit logging สำหรับ permission checks
  - [ ] **Deliverable:** ระบบสิทธิ์ทำงานได้ทั้ง 4 ระดับ
  - [ ] **Dependencies:** T1.1 (Decorators, RequestContextService), T1.3 (ต้องมีโครงสร้าง User, Role, Permission ที่สมบูรณ์)

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
  - [ ] **Dependencies:** T1.1 (Base Entity, Security), T1.2 (สำหรับการป้องกันการเข้าถึง), T0.3 (ต้องเชื่อมต่อกับ project/organization tables)

### **Phase 1: Testing - Core Foundation**

#### **T1.T1 Authentication Test Suite**

- [ ] **Unit Tests (25+ test cases):**
  - [ ] AuthService.authenticate() - success and failure cases
  - [ ] AuthService.validateUser() - various user states
  - [ ] JWT token generation and validation
  - [ ] Password hashing and verification
  - [ ] Token refresh mechanism
- [ ] **Integration Tests (15+ test cases):**
  - [ ] Complete login/logout flow
  - [ ] Token expiration handling
  - [ ] Concurrent session management
  - [ ] Rate limiting on auth endpoints
- [ ] **Security Tests (10+ test cases):**
  - [ ] SQL injection attempts on login
  - [ ] Brute force attack simulation
  - [ ] Token tampering attempts
  - [ ] Session fixation tests
- [ ] **Performance Tests:**
  - [ ] Login response time < 500ms under load
  - [ ] Token validation < 50ms
- **Exit Criteria:** Authentication system secure and performant

#### **T1.T2 RBAC Test Suite**

- [ ] **Unit Tests (30+ test cases):**
  - [ ] RbacGuard - all 4 permission levels
  - [ ] Permission hierarchy logic
  - [ ] Role-permission mappings
  - [ ] Scope-based access control
- [ ] **Integration Tests (20+ test cases):**
  - [ ] End-to-end permission checks
  - [ ] Multi-organization access control
  - [ ] Project/contract scope isolation
  - [ ] Permission escalation attempts
- [ ] **Security Tests (15+ test cases):**
  - [ ] Unauthorized access attempts
  - [ ] Privilege escalation attempts
  - [ ] Role manipulation attempts
- **Exit Criteria:** RBAC system working correctly for all scenarios

#### **T1.T3 User Management Test Suite**

- [ ] **Unit Tests (20+ test cases):**
  - [ ] User CRUD operations
  - [ ] Role assignment logic
  - [ ] Soft delete functionality
  - [ ] User search and filtering
- [ ] **Integration Tests (15+ test cases):**
  - [ ] User creation with role assignment
  - [ ] User deactivation workflow
  - [ ] Bulk user operations
  - [ ] User permission inheritance
- **Exit Criteria:** User management complete and secure

---

## **Phase 2: Security & File Management (สัปดาห์ที่ 4)**

**Milestone:** Master Data, ระบบจัดการไฟล์ที่มีความปลอดภัย, Document Numbering, JSON details system พร้อมใช้งาน พร้อม validation และ security

### **Phase 2: Tasks**

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
    - [ ] GET /master/correspondence-types
    - [ ] POST /master/tags → Create Tag
    - [ ] GET /master/tags → List Tags (Autocomplete)
  - [ ] **Security:** Implement admin-only access สำหรับ master data
  - [ ] **Deliverable:** Admin จัดการ Master Data ได้
  - [ ] **Dependencies:** T0.3 (ต้องเชื่อมต่อกับ master tables), T1.1 (Security patterns), T1.5 (Project context สำหรับ master data บางอย่าง)

- **[ ] T2.2 FileStorageService - Secure File Management**
  - [ ] สร้าง Attachment Entity
  - [ ] สร้าง FileStorageService:
    - [ ] uploadFile(file: Express.Multer.File, userId: number)` → Attachment
      - [ ] Virus scanning ด้วย ClamAV
      - [ ] File type validation (white-list: PDF, DWG, DOCX, XLSX, PPTX, ZIP)
      - [ ] File size check (max 50MB)
      - [ ] Generate checksum (SHA-256)
    - [ ] getFilePath(attachmentId)` → string
    - [ ] deleteFile(attachmentId)` → boolean
  - [ ] จัดเก็บไฟล์ใน /share/dms-data/uploads/{YYYY}/{MM}/
  - [ ] สร้าง Controller:
    - [ ] POST /files/upload → { attachment_id, url } (Protected)
    - [ ] GET /files/:id/download → File Stream (Protected + Expiration)
  - [ ] **Security:** Access Control - ตรวจสอบสิทธิ์ผ่าน Junction Table
  - [ ] **Deliverable:** อัปโหลด/ดาวน์โหลดไฟล์ได้อย่างปลอดภัย
  - [ ] **Dependencies:** T1.1 (Base Entity สำหรับ Attachment, CryptoService สำหรับ checksum), T1.4 (RBAC Guard สำหรับการควบคุมการเข้าถึงไฟล์)

- **[ ] T2.3 DocumentNumberingModule - Application-Level Locking**
  - [ ] สร้าง Entities:
    - [ ] DocumentNumberFormat
    - [ ] DocumentNumberCounter
  - [ ] สร้าง DocumentNumberingService:
    - [ ] generateNextNumber(projectId, orgId, typeId, year) → string
    - [ ] ใช้ **Redis distributed locking** แทน stored procedure
    - [ ] Retry mechanism ด้วย exponential backoff
    - [ ] Fallback mechanism เมื่อการขอเลขล้มเหลว
    - [ ] Format ตาม Template: {ORG_CODE}-{TYPE_CODE}-{YEAR_SHORT}-{SEQ:4}
  - **ไม่มี Controller** (Internal Service เท่านั้น)
  - [ ] **Security:** Implement audit log ทุกครั้งที่มีการ generate เลขที่
  - [ ] **Deliverable:** Service สร้างเลขที่เอกสารได้ถูกต้องและปลอดภัย
  - [ ] **Dependencies:** T1.1 (Base patterns, Audit Log), T0.3 (ต้องเชื่อมต่อกับ document_number_formats/counters)

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
  - [ ] **Dependencies:** T1.1 (Input Validation Pipeline)

### **Phase 2.5: JSON Details & Schema Management (สัปดาห์ที่ 4)**

- [ ]Dependencies: T1.1 (Validation patterns, Security)
- **[ ] T2.5.1 JsonSchemaModule - Schema Management**
  - [ ] สร้าง JsonSchemaService:
    - [ ] validate(schemaId: string, data: any): ValidationResult
    - [ ] getSchema(schemaId: string, version?: string): object
    - [ ] registerSchema(schemaId: string, schema: object): void
    - [ ] migrateData(data: any, fromVersion: string, toVersion: string): any
  - [ ] สร้าง predefined schemas สำหรับ:
    - [ ] Correspondence types (RFI, RFA, TRANSMITTAL, etc.)
    - [ ] Routing types (TEMPLATE, INSTANCE, ACTION)
    - [ ] Audit types (AUDIT_LOG, SECURITY_SCAN)
  - [ ] Implement schema versioning และ compatibility
  - [ ] **Deliverable:** JSON schema system ทำงานได้

- **[ ] T2.5.2 DetailsService - Data Processing**
  - [ ] สร้าง DetailsService:
    - [ ] processDetails(type: string, input: any): ProcessedDetails
    - [ ] sanitize(input: any): any (XSS prevention, SQL injection protection)
    - [ ] compress(data: any): string (JSON compression)
    - [ ] decompress(compressed: string): any
  - [ ] Implement data transformation pipelines:
    - [ ] Input validation และ sanitization
    - [ ] Data normalization
    - [ ] Default value population
  - [ ] **Deliverable:** Data processing service ทำงานได้

- **[ ] T2.5.3 JSON Security & Validation**
  - [ ] สร้าง SecurityService สำหรับ JSON:
    - [ ] sanitizeJson(input: any): any (Remove dangerous properties)
    - [ ] validateSize(data: any): boolean (Max 50KB check)
    - [ ] encryptSensitiveFields(data: any): any
  - [ ] Implement validation rules:
    - [ ] Type validation
    - [ ] Format validation (email, date, URL)
    - [ ] Custom validation rules
  - [ ] **Deliverable:** JSON security measures ทำงานได้

- **T2.5.4 Integration with Existing Modules**
  - [ ] Integrate กับ CorrespondenceModule:
    - [ ] Auto-validate details ก่อน save
    - [ ] Auto-populate default values
    - [ ] Handle version migration
  - [ ] Integrate กับ RoutingModule:
    - [ ] Validate routing configuration details
    - [ ] Process step action details
  - [ ] Integrate กับ AuditModule:
    - [ ] Validate audit log details
    - [ ] Compress large audit data
  - [ ] **Deliverable:** JSON details integrated กับทุก modules

### **Phase 2: Testing - Security & File Management**

#### **T2.T1 File Upload Security Test Suite**

- [ ] **Unit Tests (15+ test cases):**
  - [ ] File type validation (white-list)
  - [ ] File size validation
  - [ ] Virus scanning integration
  - [ ] Checksum generation
- [ ] **Integration Tests (10+ test cases):**
  - [ ] Complete file upload flow
  - [ ] File download with access control
  - [ ] Concurrent file operations
  - [ ] File cleanup procedures
- [ ] **Security Tests (20+ test cases):**
  - [ ] Malicious file upload attempts
  - [ ] Path traversal attacks
  - [ ] File type spoofing
  - [ ] Access control bypass attempts
- [ ] **Performance Tests:**
  - [ ] File upload < 30s for 50MB files
  - [ ] Concurrent upload handling
- **Exit Criteria:** File system secure and performant

#### **T2.T2 JSON Schema Test Suite**

- [ ] **Unit Tests (25+ test cases):**
  - [ ] JSON schema validation
  - [ ] Schema versioning
  - [ ] Data transformation
  - [ ] Default value population
- [ ] **Integration Tests (15+ test cases):**
  - [ ] End-to-end JSON processing
  - [ ] Schema migration scenarios
  - [ ] Error handling and recovery
  - [ ] Backward compatibility
- [ ] **Security Tests (10+ test cases):**
  - [ ] JSON injection attempts
  - [ ] Schema manipulation
  - [ ] Large payload attacks
- **Exit Criteria:** JSON system robust and secure

#### **T2.T3 Document Numbering Test Suite**

- [ ] **Unit Tests (10+ test cases):**
  - [ ] Redis locking mechanism
  - [ ] Number generation logic
  - [ ] Retry mechanism
  - [ ] Error scenarios
- [ ] **Integration Tests (8+ test cases):**
  - [ ] Concurrent number generation
  - [ ] Database transaction handling
  - [ ] Failure recovery
- [ ] **Performance Tests:**
  - [ ] Number generation < 100ms under load
  - [ ] Concurrent request handling
- **Exit Criteria:** Document numbering system race-condition free

---

## **Phase 3: Correspondence & RFA Core (สัปดาห์ที่ 5-6)**

**Milestone:** ระบบเอกสารโต้ตอบและ RFA พร้อม Security และ Audit, ระบบส่งต่อเอกสารระหว่างองค์กรทำงานได้

### **Phase 3A: Tasks (สัปดาห์ที่ 5)**

- **[ ] T3.1 CorrespondenceModule - Basic CRUD**
  - [ ] สร้าง Entities:
    - [ ] Correspondence
    - [ ] CorrespondenceRevision
    - [ ] CorrespondenceRecipient
    - [ ] CorrespondenceTag
    - [ ] CorrespondenceReference
    - [ ] CorrespondenceAttachment
  - [ ] สร้าง CorrespondenceService:
    - [ ] create(dto) → Correspondence
      - [ ] สร้าง Correspondence + Revision แรก (rev 0)
      - [ ] เรียก DocumentNumberingService (Redis locking)
      - [ ] สร้าง Recipients (TO/CC)
      - [ ] สร้าง Tags
      - [ ] สร้าง Attachments (ผ่าน FileStorageService)
    - [ ] update(id, dto) → Correspondence
      - [ ] สร้าง Revision ใหม่
      - [ ] Update is_current flag
    - [ ] findAll(filters) → Paginated List
    - [ ] findById(id) → Correspondence with Current Revision
  - [ ] สร้าง Controllers:
    - [ ] POST /correspondences → Create
    - [ ] GET /correspondences → List (Filter by type, status, org)
    - [ ] GET /correspondences/:id → Detail
    - [ ] PUT /correspondences/:id → Update (Create new revision)
    - [ ] DELETE /correspondences/:id → Soft Delete (Admin only)
  - [ ] **Security:** Implement permission checks สำหรับ document access
  - [ ] **Deliverable:** สร้าง/แก้ไข/ดูเอกสารได้
  - [ ] **Dependencies:** T1.1 (Base Entity, Audit, Transform), T1.2 (Authentication), T1.3 (User context), T1.4 (RBAC), T1.5 (Project/Organization context), T2.3 (DocumentNumberingService), T2.2 (FileStorageService), T2.5 (JSON Details Validation)

- **[ ] T3.2 CorrespondenceModule - Advanced Features**
  - [ ] Implement Status Transitions:
    - [ ] DRAFT → SUBMITTED (Document Control)
    - [ ] SUBMITTED → CLOSED (Admin)
    - [ ] SUBMITTED → CANCELLED (Admin + Reason)
  - [ ] Implement References:
    - [ ] POST /correspondences/:id/references → Link Documents
  - [ ] Implement Search (Basic):
    - [ ] GET /correspondences/search?q=...
  - [ ] **Security:** Implement state transition validation
  - [ ] **Deliverable:** Workflow พื้นฐานทำงานได้
  - [ ] **Dependencies:** T3.1 (ต้องมี Basic CRUD ก่อน)

- **[ ] T3.3 RfaModule - Basic CRUD**
  - [ ] สร้าง Entities:
    - [ ] Rfa
    - [ ] RfaRevision
    - [ ] RfaItem (Junction to Shop Drawings)
  - [ ] สร้าง RfaService:
    - [ ] create(dto) → Rfa
      - [ ] สร้าง Correspondence + Rfa + RfaRevision
      - [ ] เชื่อม Shop Drawing Revisions (สำหรับ RFA_DWG)
    - [ ] findAll(filters) → Paginated List
    - [ ] findById(id) → Rfa with Items
  - [ ] สร้าง Controllers:
    - [ ] POST /rfas → Create
    - [ ] GET /rfas → List
    - [ ] GET /rfas/:id → Detail
  - [ ] **Security:** Implement permission checks สำหรับ RFA operations
  - [ ] **Deliverable:** สร้าง RFA และเชื่อม Shop Drawings ได้
  - [ ] **Dependencies:** T3.1 (RFA คือ Correspondence ประเภทหนึ่ง), T1.5 (Project context), T4.2 (สำหรับการเชื่อมโยงกับ Shop Drawings)

### **Phase 3B: Correspondence Routing (สัปดาห์ที่ 6)**

- [ ] **Dependencies:** T3.1 (ต้องมี Correspondence ก่อนจะส่งต่อได้), T2.5 (สำหรับ JSON Details ของ Routing)

- **[ ] T3.4.1 CorrespondenceRoutingModule - Template Management**
  - [ ] สร้าง Entities:
    - [ ] CorrespondenceRoutingTemplate
    - [ ] CorrespondenceRoutingTemplateStep
  - [ ] สร้าง Services:
    - [ ] createTemplate(dto) → Create routing template
    - [ ] addStep(templateId, stepDto) → Add step to template
    - [ ] getTemplates(projectId) → List available templates
  - [ ] สร้าง Controllers:
    - [ ] POST /routing/templates → Create template (Admin only)
    - [ ] GET /routing/templates → List templates
    - [ ] POST /routing/templates/:id/steps → Add step

- **[ ] T3.4.2 CorrespondenceRoutingModule - Routing Execution**
  - [ ] สร้าง Entity: CorrespondenceRouting
  - [ ] สร้าง RoutingService:
    - [ ] initiateRouting(correspondenceId, templateId) → void
      - [ ] สร้าง routing instances ตาม template steps
      - [ ] คำนวณ due dates จาก expected_days
      - [ ] ส่ง notifications ไปยังองค์กรแรก
    - [ ] processStep(routingId, action, comments) → void
      - [ ] อัพเดทสถานะขั้นตอนปัจจุบัน
      - [ ] ส่ง notification ไปยังขั้นตอนต่อไป
      - [ ] อัพเดท due dates สำหรับขั้นตอนต่อไป
  - [ ] สร้าง Controllers:
    - [ ] POST /correspondences/:id/routing/start → Start routing
    - [ ] POST /routing/:id/process → Process routing step
    - [ ] GET /correspondences/:id/routing → Get routing status
    - [ ] ตัวอย่าง Implementation Details

- **[ ] T3.4.3 WorkflowEngineModule - State Management**
  - [ ] สร้าง WorkflowEngineService:
    - [ ] validateTransition(currentStatus, targetStatus) → boolean
    - [ ] getAllowedTransitions(status) → string[]
    - [ ] autoAdvanceStatus(correspondenceId) → void
  - [ ] สร้าง DeadlineService:
    - [ ] checkDeadlines() → void (Cron job)
    - [ ] sendReminder(routingId) → void
    - [ ] escalateOverdue(routingId) → void

- **[ ] T3.4.4 Routing UI Integration**
  - [ ] สร้าง API endpoints สำหรับ frontend:
    - [ ] GET /routing/available-templates → Templates for current project
      - [ ] GET /routing/my-pending → Pending routing steps for current user
  - [ ] POST /routing/bulk-action → Process multiple routing steps
  - [ ] **Security:** Implement permission checks สำหรับ routing operations
  - [ ] **Deliverable:** ระบบส่งต่อเอกสารทำงานได้สมบูรณ์

### **Phase 3: Testing - Correspondence & Routing**

#### **T3.T1 Correspondence Test Suite**

- [ ] **Unit Tests (30+ test cases):**
  - [ ] Correspondence creation with auto-numbering
  - [ ] Revision management
  - [ ] Status transitions
  - [ ] Recipient management
- [ ] **Integration Tests (25+ test cases):**
  - [ ] Complete correspondence lifecycle
  - [ ] File attachment handling
  - [ ] Reference management
  - [ ] Search and filtering
- [ ] **Business Logic Tests (20+ test cases):**
  - [ ] Workflow state validation
  - [ ] Permission-based access
  - [ ] Data validation rules
  - [ ] Business rule enforcement
- **Exit Criteria:** Correspondence system handles all business scenarios

#### **T3.T2 Routing Test Suite**

- [ ] **Unit Tests (25+ test cases):**
  - [ ] Template management
  - [ ] Step sequencing
  - [ ] Due date calculation
  - [ ] Status transitions
- [ ] **Integration Tests (20+ test cases):**
  - [ ] Complete routing workflow
  - [ ] Multi-organization routing
  - [ ] Deadline management
  - [ ] Notification triggers
- [ ] **Edge Case Tests (15+ test cases):**
  - [ ] Parallel processing scenarios
  - [ ] Step skipping conditions
  - [ ] Escalation procedures
  - [ ] Error recovery
- **Exit Criteria:** Routing system handles complex workflows

#### **T3.T3 JSON Details Integration Test Suite**

- [ ] **Integration Tests (15+ test cases):**
  - [ ] RFI details validation and processing
  - [ ] RFA details for different types
  - [ ] Transmittal details management
  - [ ] Routing details in workflows
- [ ] **Data Migration Tests (10+ test cases):**
  - [ ] Schema version upgrades
  - [ ] Data transformation scenarios
  - [ ] Backward compatibility
        民主- **Exit Criteria:** JSON details integrated across all modules

---

## **Phase 4: Drawing Management (สัปดาห์ที่ 7)**

**Milestone:** ระบบจัดการแบบพร้อม File Security

### **Phase 4: Tasks**

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
    - [ ] GET /drawings/contract → List
    - [ ] POST /drawings/contract → Create (Admin)
    - [ ] GET /drawings/contract/:id → Detail
  - [ ] **Security:** Implement access control สำหรับ contract drawings
  - [ ] **Deliverable:** จัดการ Contract Drawings ได้
  - [ ] **Dependencies:** T1.1 (Base Entity, Security), T1.2 (Authentication), T1.4 (RBAC), T1.5 (Project context), T2.2 (FileStorageService)

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
    - [ ] GET /drawings/shop → List
    - [ ] POST /drawings/shop → Create
    - [ ] POST /drawings/shop/:id/revisions → Create Revision
    - [ ] GET /drawings/shop/:id → Detail with Revisions
  - [ ] Link Shop Drawing Revision → Contract Drawings
  - [ ] **Security:** Implement virus scanning สำหรับ drawing files
  - [ ] **Deliverable:** จัดการ Shop Drawings และ Revisions ได้
  - [ ] ependencies: T4.1 (Shop Drawings อ้างอิงถึง Contract Drawings)

---

## **Phase 5: Workflow Systems & Resilience (สัปดาห์ที่ 8-9)**

**Milestone:** ระบบ Workflow ทั้งหมดพร้อม Resilience Patterns

### **Phase 5: Tasks**

- **[ ] T5.1 RfaModule - Workflow Implementation**
  - [ ] สร้าง Entities:
    - [ ] RfaWorkflowTemplate
    - [ ] RfaWorkflowTemplateStep
    - [ ] RfaWorkflow (Transaction Log)
  - [ ] สร้าง RfaWorkflowService:
    - [ ] initiateWorkflow(rfaId, templateId) → void
      - [ ] สร้าง RfaWorkflow records ตาม Template
      - [ ] กำหนด Step 1 เป็น PENDING
    - [ ] completeStep(rfaId, stepNumber, action, comments) → void
      - [ ] Update Status → COMPLETED
      - [ ] Set Next Step → PENDING
      - [ ] Send Notifications
    - [ ] rejectStep(rfaId, stepNumber, reason) → void
      - [ ] Update Status → REJECTED
      - [ ] Send back to Originator
  - [ ] สร้าง Controllers:
    - [ ] POST /rfas/:id/workflow/start → Start Workflow
    - [ ] POST /rfas/:id/workflow/steps/:stepNumber/complete → Complete Step
    - [ ] GET /rfas/:id/workflow → Get Workflow Status
  - [ ] **Resilience:** Implement circuit breaker สำหรับ notification services
  - [ ] **Deliverable:** RFA Workflow ทำงานได้
  - [ ] **Dependencies:** T3.3 (ต้องมี RFA Basic CRUD ก่อน), T4.2 (RFA_DWG ต้องเชื่อมโยงกับ Shop Drawings), T2.5 (JSON Details สำหรับ Workflow), T6.2 (NotificationService สำหรับแจ้งเตือน)

- **[ ] T5.2 CirculationModule - Internal Routing**
  - [ ] สร้าง Entities:
    - [ ] Circulation
    - [ ] CirculationTemplate
    - [ ] CirculationTemplateAssignee
    - [ ] CirculationRouting (Transaction Log)
    - [ ] CirculationAttachment
  - [ ] สร้าง CirculationService:
    - [ ] create(correspondenceId, dto) → Circulation
      - [ ] สร้าง Circulation (1:1 กับ Correspondence)
      - [ ] สร้าง Routing ตาม Template
    - [ ] assignUser(circulationId, stepNumber, userId) → void
    - [ ] completeStep(circulationId, stepNumber, comments) → void
    - [ ] close(circulationId) → void (เมื่อตอบกลับองค์กรผู้ส่งแล้ว)
  - สร้าง Controllers:
    - [ ] POST /circulations → Create
    - [ ] GET /circulations/:id → Detail
    - [ ] POST /circulations/:id/steps/:stepNumber/complete → Complete
    - [ ] POST /circulations/:id/close → Close
  - [ ] **Resilience:** Implement retry mechanism สำหรับ assignment notifications
  - [ ] **Deliverable:** ใบเวียนภายในองค์กรทำงานได้
  - [ ] **Dependencies:** T3.1 (Circulation คือ Correspondence ประเภทหนึ่ง), T2.5 (JSON Details), T6.2 (NotificationService)

- **[ ] T5.3 TransmittalModule - Document Forwarding**
  - [ ] สร้าง Entities:
    - [ ] Transmittal
    - [ ] TransmittalItem
  - [ ] สร้าง TransmittalService:
    - [ ] create(dto) → Transmittal
      - [ ] สร้าง Correspondence + Transmittal
      - [ ] เชื่อม Multiple Correspondences เป็น Items
  - [ ] สร้าง Controllers:
    - [ ] POST /transmittals → Create
    - [ ] GET /transmittals → List
    - [ ] GET /transmittals/:id → Detail with Items
  - [ ] **Security:** Implement access control สำหรับ transmittal items
  - [ ] **Deliverable:** สร้าง Transmittal ได้
  - [ ] **Dependencies:** T3.1 (Transmittal คือ Correspondence ประเภทหนึ่ง)

---

## **Phase 6: Advanced Features & Monitoring (สัปดาห์ที่ 10-11)**

**Milestone:** ฟีเจอร์ขั้นสูงพร้อม Monitoring และ Observability

### **Phase 6: Tasks**

- **[ ] T6.1 SearchModule - Elasticsearch Integration**
  - [ ] Setup Elasticsearch Container ใน docker-compose.yml
  - [ ] สร้าง SearchService:
    - [ ] indexDocument(entity) → void
    - [ ] updateDocument(entity) → void
    - [ ] deleteDocument(entity) → void
    - [ ] search(query, filters) → SearchResult[]
  - [ ] Index ทุกครั้งที่ Create/Update:
    - [ ] Correspondence
    - [ ] RFA
    - [ ] Shop Drawing
    - [ ] Contract Drawing
    - [ ] Circulation
    - [ ] Transmittal
  - [ ] สร้าง Controllers:
    - [ ] GET /search?q=...&type=...&from=...&to=... → Results
  - [ ] **Resilience:** Implement circuit breaker สำหรับ Elasticsearch
  - [ ] **Deliverable:** ค้นหาขั้นสูงทำงานได้
  - [ ] **Dependencies:** T3.1, T3.3, T4.2, T5.2, T5.3 (ต้องมีข้อมูลจาก Modules หลักเหล่านี้ให้ทำการ Index)

- **[ ] T6.2 NotificationModule - Email & Line**
  - [ ] สร้าง NotificationService:
    - [ ] sendEmail(to, subject, body) → void (Nodemailer)
    - [ ] sendLine(userId, message) → void (ผ่าน n8n Webhook)
    - [ ] createSystemNotification(userId, message, entityType, entityId) → void
  - [ ] Integrate กับ Workflow Events:
    - [ ] เมื่อสร้าง Correspondence ใหม่ → แจ้ง Recipients
    - [ ] เมื่อสร้าง Circulation → แจ้ง Assignees
    - [ ] เมื่อ RFA Workflow ถึง Step → แจ้ง Responsible Org
    - [ ] เมื่อใกล้ถึง Deadline → แจ้ง (Optional)
  - [ ] สร้าง Controllers:
    - [ ] GET /notifications → List User's Notifications
    - [ ] PUT /notifications/:id/read → Mark as Read
  - [ ] **Resilience:** Implement retry mechanism ด้วย exponential backoff
  - [ ] **Deliverable:** ระบบแจ้งเตือนทำงานได้
  - [ ] **Dependencies:** T1.1 (ConfigService สำหรับ Email credentials), T6.4 (Resilience patterns สำหรับการส่งภายนอก)

- **[ ] T6.3 MonitoringModule - Observability**
  - [ ] สร้าง Health Check Controller:
    - [ ] GET /health → Database, Redis, Elasticsearch status
  - [ ] สร้าง Metrics Service:
    - [ ] API response times
    - [ ] Error rates
    - [ ] Cache hit ratios
    - [ ] Business metrics (documents created, workflow completion)
  - [ ] สร้าง Performance Interceptor:
    - [ ] Track request duration
    - [ ] Alert if response time > 200ms
  - [ ] สร้าง Logging Service:
    - [ ] Structured logging (JSON format)
    - [ ] Log aggregation
  - [ ] **Deliverable:** Monitoring system ทำงานได้
  - [ ] **Dependencies:** T1.1 (Base patterns)

- **[ ] T6.4 ResilienceModule - Circuit Breaker & Retry**
  - [ ] สร้าง Circuit Breaker Service:
    - [ ] @CircuitBreaker() decorator สำหรับ external calls
    - [ ] Configurable timeout และ error thresholds
  - [ ] สร้าง Retry Service:
    - [ ] @Retry() decorator ด้วย exponential backoff
  - [ ] สร้าง Fallback Strategies:
    - [ ] Graceful degradation สำหรับ non-critical features
  - [ ] Implement สำหรับ:
    - [ ] Email notifications
    - [ ] LINE notifications
    - [ ] Elasticsearch queries
    - [ ] File virus scanning
  - [ ] **Deliverable:** Resilience patterns ทำงานได้
  - [ ] **Dependencies:** T1.1 (Base patterns)

---

## **Phase 7: Testing & Optimization (สัปดาห์ที่ 12-13)**

**Milestone:** ทดสอบและปรับปรุงประสิทธิภาพพร้อม Security Audit

### **Phase 7: Tasks- Testing Automation & CI/CD**

- [ ] **Setup Test Environment:**
  - [ ] Dockerized test database
  - [ ] Test Redis instance
  - [ ] Mock external services
  - [ ] Test data management
- [ ] **CI/CD Pipeline:**
  - [ ] GitHub Actions workflow
  - [ ] Automated test execution
  - [ ] Test reporting and metrics
  - [ ] Quality gates

- **Test Quality Gates**

```yaml
# GitHub Actions Quality Gates
quality_gates:
  unit_tests:
    coverage: 80%
    required: true
  integration_tests:
    scenarios: all_core
    required: true
  security_tests:
    vulnerabilities: 0
    required: true
  performance_tests:
    response_time: 200ms
    required: true
```

- **[ ] T7.1 Unit Testing**
  - [ ] เขียน Unit Tests สำหรับ Services สำคัญ:
    - [ ] AuthService (login, validateUser)
    - [ ] RbacGuard (permission checks ทั้ง 4 ระดับ)
    - [ ] DocumentNumberingService (Redis locking)
    - [ ] FileStorageService (virus scanning, validation)
    - [ ] CorrespondenceService (create, update, status transitions)
    - [ ] RfaWorkflowService (workflow logic)
  - [ ] **Security:** ทดสอบ security scenarios (SQL injection, XSS attempts)
  - [ ] Target: 80% Code Coverage
  - [ ] **Deliverable:** Unit Tests ผ่านทั้งหมด
  - [ ] **Dependencies:** ทุก Development Tasks ใน Phase 1-6 ต้องเสร็จสิ้นก่อนเริ่มเขียน Tests อย่างจริงจัง (โดยเฉพาะ T1.4, T2.3, T3.1, T5.1)

- **[ ] T7.2 Integration Testing**
  - [ ] เขียน Integration Tests:
    - [ ] Authentication Flow (login → access protected route)
    - [ ] Document Creation Flow (create correspondence → attach files → virus scan)
    - [ ] RFA Workflow Flow (start → step 1 → step 2 → complete)
    - [ ] Circulation Flow (create → assign → complete → close)
    - [ ] ทดสอบ SQL Views (v_user_all_permissions, v_user_tasks)
  - [ ] ใช้ Test Database แยกต่างหาก
  - [ ] **Security:** ทดสอบ rate limiting และ permission enforcement
  - [ ] **Deliverable:** Integration Tests ผ่าน
  - [ ] **Dependencies:** T7.1 (Unit Tests ควรผ่านก่อน)

- **[ ] T7.3 E2E Testing**
  - [ ] เขียน E2E Tests:
    - [ ] User Registration & Login
    - [ ] Create Correspondence (Full Flow)
    - [ ] Create RFA with Shop Drawings
    - [ ] Complete RFA Workflow
    - [ ] Search Documents
  - [ ] **Security:** ทดสอบ file upload security
  - [ ] **Deliverable:** E2E Tests ผ่าน
  - [ ] **Dependencies:** T7.2 (Integration Tests ควรผ่านก่อน)

- **[ ] T7.4 Performance Testing**
  - [ ] Load Testing:
    - [ ] 100 concurrent users
    - [ ] API response time < 200ms (90th percentile)
    - [ ] Search performance < 500ms
  - [ ] Stress Testing:
    - [ ] Find breaking points
    - [ ] Database connection limits
  - [ ] Endurance Testing:
    - [ ] 24-hour continuous operation
  - [ ] **Deliverable:** Performance targets บรรลุ
  - [ ] **Dependencies:** T7.3 (E2E Tests ควรผ่านก่อน)

- **[ ] T7.5 Security Testing**
  - [ ] Penetration Testing:
    - [ ] OWASP Top 10 vulnerabilities
    - [ ] SQL Injection attempts
    - [ ] XSS attempts
    - [ ] CSRF attempts
  - [ ] Security Audit:
    - [ ] Code review สำหรับ security flaws
    - [ ] Dependency vulnerability scanning
  - [ ] File Upload Security Testing:
    - [ ] Virus scanning effectiveness
    - [ ] File type bypass attempts
  - [ ] **Deliverable:** Security tests ผ่าน
  - [ ] **Dependencies:** T7.4 (Performance Tests ควรผ่านก่อน)

- **[ ] T7.6 Performance Optimization**
  - [ ] Implement Caching:
    - [ ] Cache Master Data (Roles, Permissions, Organizations)
    - [ ] Cache User Permissions
    - [ ] Cache Search Results
  - [ ] Database Optimization:
    - [ ] Review Indexes
    - [ ] Optimize Queries (N+1 Problem)
    - [ ] Implement Pagination ทุก List Endpoint
  - [ ] **Deliverable:** Response Time < 200ms (90th percentile)
  - [ ] **Dependencies:** T7.4 (ผลจาก Performance Testing จะบอกว่าจุดไหนต้อง Optimization)

### 📊 **Testing Metrics & Exit Criteria**

**แต่ละ Phase ต้องผ่าน Metrics เหล่านี้:**

#### **Phase Completion Metrics**

- [ ] **Code Quality Metrics**
  - [ ] Unit test coverage: ≥ 80%
  - [ ] Integration test coverage: 100% core scenarios
  - [ ] Static analysis: 0 critical issues
  - [ ] Code duplication: < 5%

- [ ] **Performance Metrics**
  - [ ] API response time: < 200ms (90th percentile)
  - [ ] Database query performance: < 100ms
  - [ ] Memory usage: Within limits
  - [ ] Concurrent users: Meets targets

- [ ] **Security Metrics**
  - [ ] Security vulnerabilities: 0
  - [ ] Authentication tests: 100% passed
  - [ ] Authorization tests: 100% passed
  - [ ] Data validation tests: 100% passed

- [ ] **Business Metrics**
  - [ ] Core workflows: 100% tested
  - [ ] Edge cases: Covered
  - [ ] Error scenarios: Handled appropriately
  - [ ] User acceptance: Meets requirements

---

## **Phase 8: Documentation & Deployment (สัปดาห์ที่ 14)**

**Milestone:** เอกสารและ Deploy สู่ Production พร้อม Security Hardening

### **Phase 8: Tasks**

- **[ ] T8.1 API Documentation**
  - [ ] ครบทุก Endpoint ใน Swagger:
    - [ ] ใส่ Description, Example Request/Response
    - [ ] ระบุ Required Permissions
    - [ ] ใส่ Error Responses
  - [ ] Export Swagger JSON → Frontend Team
  - [ ] **Security:** เอกสารต้องไม่เปิดเผย sensitive information
  - [ ] **Deliverable:** Swagger Docs สมบูรณ์
  - [ ] **Dependencies:** ทุก Development Tasks ต้องเสร็จสิ้น

- **[ ] T8.2 Technical Documentation**
  - [ ] เขียนเอกสาร:
    - [ ] Architecture Overview
    - [ ] Module Structure
    - [ ] Database Schema Diagram
    - [ ] API Design Patterns
    - [ ] Security Implementation Guide
    - [ ] Deployment Guide
    - [ ] Disaster Recovery Procedures
  - [ ] **Deliverable:** Technical Docs พร้อม
  - [ ] **Dependencies:** T8.1

- **[ ] T8.3 Security Hardening**
  - [ ] Final Security Review:
    - [ ] Environment variables security
    - [ ] Database encryption
    - [ ] File storage security
    - [ ] API security headers
  - [ ] Implement Security Monitoring:
    - [ ] Failed login attempts tracking
    - [ ] Suspicious activity alerts
    - [ ] Rate limiting monitoring
  - [ ] **Deliverable:** Security checklist ผ่าน
  - [ ] **Dependencies:** T7.5 (Security Testing ต้องผ่าน)

- **[ ] T8.4 Deployment Preparation**
  - [ ] สร้าง Production docker-compose.yml
  - [ ] Setup Environment Variables ใน QNAP
  - [ ] Setup Nginx Proxy Manager (SSL Certificate)
  - [ ] Setup Backup Scripts (Database + Files)
  - [ ] Setup Monitoring และ Alerting
  - [ ] **Deliverable:** Deployment Guide พร้อม
  - [ ] **Dependencies:** T8.2, T8.3

- **[ ] T8.5 Production Deployment**
  - [ ] Deploy Backend ไปยัง backend.np-dms.work
  - [ ] ทดสอบ API ผ่าน Postman
  - [ ] Monitor Logs (Winston)
  - [ ] Setup Health Check Endpoint (GET /health)
  - [ ] Verify Security Measures:
    - [ ] HTTPS enforcement
    - [ ] Security headers
    - [ ] Rate limiting
    - [ ] Virus scanning
  - [ ] **Deliverable:** Backend รันบน Production
  - [ ] **Dependencies:** T8.4

- **[ ] T8.6 Handover to Frontend Team**
  - [ ] Demo API ให้ Frontend Team
  - [ ] ส่งมอบ Swagger Documentation
  - [ ] ส่งมอบ Postman Collection
  - [ ] Workshop: วิธีใช้ Authentication & RBAC
  - [ ] **Deliverable:** Frontend เริ่มพัฒนาได้
  - [ ] **Dependencies:** T8.5

---

## 📊 **สรุป Timeline**

| Phase   | ระยะเวลา       | จำนวนงาน     | Output หลัก                          |
| ------- | -------------- | ------------ | ------------------------------------ |
| Phase 0 | 1 สัปดาห์      | 4            | Infrastructure Ready + Security Base |
| Phase 1 | 2 สัปดาห์      | 5            | Auth & User Management + RBAC        |
| Phase 2 | 1 สัปดาห์      | 4            | Security & File Management           |
| Phase 3 | 2 สัปดาห์      | 3            | Correspondence & RFA Core            |
| Phase 4 | 1 สัปดาห์      | 2            | Drawing Management                   |
| Phase 5 | 2 สัปดาห์      | 3            | Workflow Systems + Resilience        |
| Phase 6 | 2 สัปดาห์      | 4            | Advanced Features + Monitoring       |
| Phase 7 | 2 สัปดาห์      | 6            | Testing & Optimization               |
| Phase 8 | 1 สัปดาห์      | 6            | Documentation & Deploy               |
| **รวม** | **14 สัปดาห์** | **37 Tasks** | **Production-Ready Backend**         |

---

## 🎯 **Critical Success Factors**

1. **Security First:** ทุก Task ต้องพิจารณาด้านความปลอดภัยเป็นหลัก
2. **Database Integrity:** ใช้ Schema v1.4.1 เป็นหลัก ไม่แก้ไข Schema โดยไม่จำเป็น
3. **Soft Delete:** Service ทั้งหมดต้องใช้ Global Filter กรอง WHERE deleted_at IS NULL
4. **API Contract:** ทุก Endpoint ต้องมี Swagger Documentation สมบูรณ์
5. **Security Compliance:** RBAC ต้องทำงานถูกต้อง 100% ก่อน Deploy
6. **Testing Coverage:** Code Coverage อย่างน้อย 80% ก่อน Production
7. **Performance Targets:** Response Time < 200ms (90th percentile)
8. **Resilience:** ระบบต้องทนทานต่อ failures ของ external services
9. **Monitoring:** ต้องมี comprehensive monitoring และ alerting
10. **Documentation:** เอกสารต้องครบถ้วนเพื่อ Handover ให้ Frontend Team

---

## 🚀 **ขั้นตอนถัดไป**

1. **Approve แผนนี้** → ปรับแต่งตาม Feedback
2. **Setup Phase 0** → เริ่มสร้าง Infrastructure
3. **Daily Standup** → รายงานความก้าวหน้าทุกวัน
4. **Weekly Review** → ทบทวนความก้าวหน้าทุกสัปดาห์
5. **Security Review** → ทุก Phase ต้องผ่าน security review
6. **Deploy to Production** → Week 14

---

## 📋 **Security Checklist ทุก Phase**

- **Phase 1-2: Foundation Security**
  - [ ] Input validation implemented
  - [ ] XSS protection enabled
  - [ ] CSRF protection implemented
  - [ ] Rate limiting configured
  - [ ] Secure password hashing (bcrypt)

- **Phase 3-5: Application Security**
  - [ ] RBAC 4-level working correctly
  - [ ] File upload security (virus scanning, type validation)
  - [ ] Audit logging for critical operations
  - [ ] SQL injection prevention

- **Phase 6-8: Production Security**
  - [ ] HTTPS enforcement
  - [ ] Security headers configured
  - [ ] Environment variables secured
  - [ ] Monitoring and alerting active
  - [ ] Backup and recovery tested

## **หมายเหตุ:** แผนนี้สามารถปรับแต่งได้ตามความต้องการและข้อจำกัดของทีม หาก Phase ใดใช้เวลามากกว่าที่คาดการณ์ ควรปรับ Timeline ให้เหมาะสม โดยให้ความสำคัญกับ Security และ Quality
