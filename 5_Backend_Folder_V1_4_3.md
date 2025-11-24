# โครงสร้างโฟลเดอร์และไฟล์ทั้งหมดสำหรับ **Backend (NestJS)** ตามแผนงาน **LCBP3-DMS v1.4.3** ตั้งแต่ Phase 0 ถึง Phase 6 (T0-T6.2) ที่ได้ดำเนินการไปแล้ว

โครงสร้างนี้ออกแบบตามหลัก **Domain-Driven Design** และ **Modular Architecture** ที่ระบุไว้ในแผนพัฒนา

---

## 📂 **backend/** (Backend Application)

* [x] `.env` (สำหรับ Local Dev เท่านั้น ห้าม commit)
* [x] `.gitignore`
* [x] `docker-compose.yml` (Configuration หลักสำหรับ Deploy)
* [x] `docker-compose.override.yml` (สำหรับ Inject Secrets ตอน Dev)
* [x] `package.json`
* [x] `pnpm-lock.yaml`
* [x] `tsconfig.json`
* [x] `nest-cli.json`
* [x] `README.md`

---

## 📂 **backend/src/** (Source Code)

### **📄 Entry Points**

* [x] `main.ts` (Application Bootstrap, Swagger, Global Pipes)
* [x] `app.module.ts` (Root Module ที่รวมทุก Modules เข้าด้วยกัน)

### **📁 src/common/** (Shared Resources)

* [x] **common.module.ts**
* **auth/**
  * **dto/**
    * [x] **login.dto.ts**
    * [x] **register.dto.ts**
  * [x] **auth.controller.spec.ts**
  * [x] **auth.controller.ts**
  * [x] **auth.module.ts**
  * [x] **auth.service.spec.ts**
  * [x] **auth.service.ts**
* **config/** (Configuration Service)
  * [x] **env.validation.ts**
* **decorators/**
  * [x] **audit.decorator.ts**
  * [x] `current-user.decorator.ts`
  * [x] `require-permission.decorator.ts`
* **entities/**
  * [x] **audit-log.entity.ts**
  * [x] **base.entity.ts**
* **exceptions/**
  * [x] `http-exception.filter.ts` (Global Filter)
* **file-storage/** (Two-Phase Storage System)
  * **entities/**
    * [x] **attachment.entity.ts**
  * [x] **file-storage.controller.spec.ts**
  * [x] **file-storage.controller.ts**
  * [x] **file-storage.module.ts**
  * [x] **file-storage.service.spec.ts**
  * [x] `file-storage.service.ts` (Upload, Scan Virus, Commit)
* [x] `guards/`
  * [x] `jwt-auth.guard.ts`
  * [x] **jwt.strategy.ts**
  * [x] `rbac.guard.ts` (ตรวจสอบสิทธิ์ 4 ระดับ)
* **interceptors/**
  * [x] `audit-log.interceptor.ts` (เก็บ Log ลง DB)
  * [x] `transform.interceptor.ts` (Standard Response Format)
* **resilience/** (Circuit Breaker & Retry)

### **📁 src/modules/** (Feature Modules)

1. **user/** (User Management & RBAC)
    * [x] `dto/`
      * [x] **assign-user-role.dto.ts**
      * [x] `create-user.dto.ts`
      * [x] `update-user.dto.ts`
    * [x] `entities/`
      * [x] `user.entity.ts`
      * [x] `role.entity.ts`
      * [x] `permission.entity.ts`
      * [x] `user-preference.entity.ts`
    * [x] **user-assignment.service.ts**
    * [x] `user.controller.ts`
    * [x] `user.module.ts`
    * [x] `user.service.ts`
    * [x] **user.service.spec.ts**

2. **project/** (Project Structure)
    * [x] `dto/`
      * [x] **create-project.dto.ts**
      * [x] `search-project.dto.ts`
      * [x] `update-project.dto.ts`
    * [x] `entities/`
      * [x] `contract-organization.entity.ts`
      * [x] `contract.entity.ts`
      * [x] `organization.entity.ts`
      * [x] `project-organization.entity.ts` (Junction)
      * [x] **project.entity.ts**
    * [x] **project.controller.spec.ts**
    * [x] `project.controller.ts`
    * [x] `project.module.ts`
    * [x] **project.service.spec.ts**
    * [x] `project.service.ts`

3. **correspondence/** (Core Document System)
    * [x] `dto/`
      * [x] `add-reference.dto.ts`
      * [x] `create-correspondence.dto.ts`
      * [x] `search-correspondence.dto.ts`
      * [x] **submit-correspondence.dto.ts**
      * [x] `workflow-action.dto.ts`
    * [x] `entities/`
      * [x] `correspondence-reference.entity.ts`
      * [x] `correspondence-revision.entity.ts`
      * [x] `correspondence-routing.entity.ts` (Unified Workflow)
      * [x] `correspondence-status.entity.ts`
      * [x] `correspondence-type.entity.ts`
      * [x] `correspondence.entity.ts`
      * [x] **routing-template-step.entity.ts**
      * [x] `routing-template.entity.ts`
    * [x] **correspondence.controller.spec.ts**
    * [x] `correspondence.controller.ts`
    * [x] `correspondence.module.ts`
    * [x] **correspondence.service.spec.ts**
    * [x] `correspondence.service.ts` (Impersonation & Workflow Logic)

4. **drawing/** (Contract & Shop Drawings)
    * [x] `dto/`
      * [x] `create-contract-drawing.dto.ts`
      * [x] `create-shop-drawing-revision.dto.ts`
      * [x] `create-shop-drawing.dto.ts`
      * [x] `search-contract-drawing.dto.ts`
      * [x] `search-shop-drawing.dto.ts`
      * [x] `update-contract-drawing.dto.ts`
    * [x] `entities/`
      * [x] `contract-drawing-sub-category.entity.ts`
      * [x] `contract-drawing-volume.entity.ts`
      * [x] `contract-drawing.entity.ts`
      * [x] `shop-drawing-main-category.entity.ts`
      * [x] `shop-drawing-revision.entity.ts`
      * [x] `shop-drawing-sub-category.entity.ts`
      * [x] `shop-drawing.entity.ts`
    * [x] `contract-drawing.controller.ts`
    * [x] `contract-drawing.service.ts`
    * [x] `drawing-master-data.controller.ts`
    * [x] `drawing-master-data.service.ts`
    * [x] `drawing.module.ts`
    * [x] `shop-drawing.controller.ts`
    * [x] `shop-drawing.service.ts`

4. **rfa/** (Request for Approval & Advanced Workflow)
    * [x] `dto/`
      * [x] `create-rfa.dto.ts`
      * [x] `search-rfa.dto.ts`
      * [x] `update-rfa.dto.ts`
    * [x] `entities/`
      * [x] `rfa-approve-code.entity.ts`
      * [x] `rfa-item.entity.ts`
      * [x] `rfa-revision.entity.ts`
      * [x] `rfa-status-code.entity.ts`
      * [x] `rfa-type.entity.ts`
      * [x] `rfa-workflow-template-step.entity.ts`
      * [x] `rfa-workflow-template.entity.ts`
      * [x] `rfa-workflow.entity.ts`
      * [x] `rfa.entity.ts`
    * [x] `rfa.controller.ts`
    * [x] `rfa.module.ts`
    * [x] `rfa.service.ts` (Unified Workflow Integration)

5. **circulation/** (Internal Routing)
    * [x] `dto/`
      * [x] `create-circulation.dto.ts`
      * [x] `update-circulation-routing.dto.ts`
      * [x] `search-circulation.dto.ts`
    * [x] `entities/`
      * [x] `circulation-routing.entity.ts`
      * [x] `circulation-status-code.entity.ts`
      * [x] `circulation.entity.ts`
    * [x] `circulation.controller.ts`
    * [x] `circulation.module.ts`
    * [x] `circulation.service.ts`

6. **transmittal/** (Document Forwarding)
    * [x] `dto/`
      * [x] `create-transmittal.dto.ts`
      * [x] `search-transmittal.dto.ts`
      * [x] **update-transmittal.dto.ts**
    * [x] `entities/`
      * [x] `transmittal-item.entity.ts`
      * [x] `transmittal.entity.ts`
    * [x] `transmittal.controller.ts`
    * [x] `transmittal.module.ts`
    * [x] `transmittal.service.ts`

7. **notification/** (System Alerts)
    * [x] `dto/`
      * [x] `create-notification.dto.ts`
      * [x] `search-notification.dto.ts`
    * [x] `entities/`
      * [x] `notification.entity.ts`
    * [x] `notification-cleanup.service.ts` (Cron Job)
    * [x] `notification.controller.ts`
    * [x] `notification.gateway.ts`
    * [x] `notification.module.ts` (Real-time WebSocket)
    * [x] `notification.processor.ts` (Consumer/Worker for Email & Line)
    * [x] `notification.service.ts` (Producer)

8. **search/** (Elasticsearch)
    * [x] `dto/search-query.dto.ts`
    * [x] `search.controller.ts`
    * [x] `search.module.ts`
    * [x] `search.service.ts` (Indexing & Searching)

9. **document-numbering/** (Internal Service)
    * [x] `entities/`
      * [x] `document-number-format.entity.ts`
      * [x] `document-number-counter.entity.ts`
    * [x] `document-numbering.module.ts`
    * [x] **document-numbering.service.spec.ts**
    * [x] `document-numbering.service.ts` (Double-Lock Mechanism)

10. **workflow-engine/** (Unified Logic)
    * [x] `interfaces/workflow.interface.ts`
    * [x] `workflow-engine.module.ts`
    * [x] **workflow-engine.service.spec.ts**
    * [x] `workflow-engine.service.ts` (State Machine Logic)

11. **json-schema/** (Validation)
    * [x] `dto/`
      * [x] `create-json-schema.dto.ts`+
      * [x] `search-json-schema.dto.ts`
      * [x] `update-json-schema.dto.ts`
    * [x] `entities/`
      * [x] `json-schema.entity.ts`
    * [x] **json-schema.controller.spec.ts**
    * [x] **json-schema.controller.ts**
    * [x] `json-schema.module.ts`
    * [x] **json-schema.service.spec.ts**
    * [x] `json-schema.service.ts`

## **Folder Structure ของ Backend (NestJS)** ที่

---

### 📁 Backend Folder Structure (LCBP3-DMS v1.4.3)

```text
backend/
├── .env                    # Environment variables for local development only (not committed)
├── .gitignore              # Git ignore rules
├── docker-compose.yml      # Main deployment container configuration
├── docker-compose.override.yml  # Dev-time secret/environment injection
├── package.json            # Node dependencies and NPM scripts
├── pnpm-lock.yaml          # Dependency lock file for pnpm
├── tsconfig.json           # TypeScript compiler configuration
├── nest-cli.json           # NestJS project configuration
├── README.md               # Project documentation
└── src/
    ├── main.ts             # Application bootstrap and initialization
    ├── app.module.ts       # Root application module
    │
    │
    ├── common/             # 🛠️ Shared framework resources used across modules
    │   ├── common.module.ts        # Registers shared providers
    │   │
    │   ├── auth/                   # 🛡️ Authentication module
    │   │   ├── dto/
    │   │   │   ├── login.dto.ts                # Login request payload
    │   │   │   └── register.dto.ts             # Registration payload
    │   │   ├── auth.module.ts                  # Auth DI module
    │   │   ├── auth.controller.ts              # Auth REST endpoints
    │   │   ├── auth.controller.spec.ts         # Unit tests for controller
    │   │   ├── auth.service.ts                 # Authentication logic
    │   │   └── auth.service.spec.ts            # Unit test for service
    │   │
    │   ├── config/                 # 📄 Configuration
    │   │   └── env.validation.ts               # Zod/Joi validation for environment variables
    │   │
    │   ├── decorators/             # 📡 Decorators for common use cases
    │   │   ├── audit.decorator.ts              # Enables audit logging for a method
    │   │   ├── current-user.decorator.ts       # Extracts logged-in user from request
    │   │   └── require-permission.decorator.ts # Declares RBAC permission requirement
    │   │
    │   ├── entities/               # 📚 Database entities
    │   │   ├── audit-log.entity.ts             # Audit log database entity
    │   │   └── base.entity.ts                  # Base abstraction containing core columns
    │   │
    │   ├── exceptions/             # 🛡️ Global exception trap/formatter
    │   │   └── http-exception.filter.ts        # Global exception trap/formatter
    │   │
    │   ├── file-storage/           # 📂 Two-Phase document storage (upload → scan → commit)
    │   │   ├── entities/
    │   │   │   └── attachment.entity.ts        # Represents stored file metadata
    │   │   ├── file-storage.controller.ts      # Upload/download endpoints
    │   │   ├── file-storage.controller.spec.ts # Unit tests
    │   │   ├── file-storage.module.ts          # Module DI bindings
    │   │   ├── file-storage.service.ts         # File handling logic
    │   │   └── file-storage.service.spec.ts
    │   │
    │   ├── guards/                  # 🛡️ JWT authentication guard
    │   │   ├── jwt-auth.guard.ts               # JWT authentication guard
    │   │   ├── jwt.strategy.ts                 # JWT strategy configuration
    │   │   └── rbac.guard.ts                   # Role-based access control enforcement
    │   │
    │   ├── interceptors/            # 📡 Interceptors for common use cases
    │   │   ├── audit-log.interceptor.ts        # Automatically logs certain operations
    │   │   └── transform.interceptor.ts        # Standardized response formatting
    │   │
    │   └── resilience/              # 🛡️ Circuit-breaker / retry logic (if implemented)
    │
    │
    ├── modules/             # 📦 Module-specific resources
    │   ├── user/                    # 👤 User + RBAC module
    │   │   ├── dto/
    │   │   │   ├── assign-user-role.dto.ts     # Assign roles to users
    │   │   │   ├── create-user.dto.ts
    │   │   │   └── update-user.dto.ts
    │   │   ├── entities/
    │   │   │   ├── user.entity.ts              # User table definition
    │   │   │   ├── role.entity.ts              # Role definition
    │   │   │   ├── permission.entity.ts        # Permission entity
    │   │   │   └── user-preference.entity.ts   # User preference settings
    │   │   ├── user.controller.ts              # REST endpoints
    │   │   ├── user.service.ts                 # Business logic
    │   │   ├── user.service.spec.ts            # Unit tests
    │   │   └── user.module.ts                  # Module DI container
    │   │
    │   ├── project/                # 🏢 Project/Organization/Contract structure
    │   │   ├── dto/
    │   │   │   ├── create-project.dto.ts
    │   │   │   ├── search-project.dto.ts
    │   │   │   └── update-project.dto.ts
    │   │   ├── entities/
    │   │   │   ├── project.entity.ts
    │   │   │   ├── contract.entity.ts
    │   │   │   ├── organization.entity.ts
    │   │   │   ├── project-organization.entity.ts
    │   │   │   └── contract-organization.entity.ts
    │   │   ├── project.controller.ts
    │   │   ├── project.controller.spec.ts
    │   │   └── project.service.ts
    │
    │   ├── correspondence/        # ✉️ Formal letters with routing workflow
    │   │   ├── dto/
    │   │   │   ├── add-reference.dto.ts
    │   │   │   ├── create-correspondence.dto.ts
    │   │   │   ├── search-correspondence.dto.ts
    │   │   │   ├── submit-correspondence.dto.ts
    │   │   │   └── workflow-action.dto.ts
    │   │   ├── entities/
    │   │   │   ├── correspondence.entity.ts
    │   │   │   ├── correspondence-revision.entity.ts
    │   │   │   ├── correspondence-routing.entity.ts
    │   │   │   ├── correspondence-status.entity.ts
    │   │   │   ├── correspondence-type.entity.ts
    │   │   │   ├── correspondence-reference.entity.ts
    │   │   │   ├── routing-template.entity.ts
    │   │   │   └── routing-template-step.entity.ts
    │   │   ├── correspondence.controller.ts
    │   │   ├── correspondence.controller.spec.ts
    │   │   └── correspondence.service.ts
    │
    │   ├── drawing/               # 📐Contract & Shop drawing tracking
    │   │   ├── dto/
    │   │   │   ├── create-contract-drawing.dto.ts
    │   │   │   ├── create-shop-drawing.dto.ts
    │   │   │   ├── create-shop-drawing-revision.dto.ts
    │   │   │   ├── search-contract-drawing.dto.ts
    │   │   │   ├── search-shop-drawing.dto.ts
    │   │   │   └── update-contract-drawing.dto.ts
    │   │   ├── entities/
    │   │   │   ├── contract-drawing.entity.ts
    │   │   │   ├── contract-drawing-volume.entity.ts
    │   │   │   ├── contract-drawing-sub-category.entity.ts
    │   │   │   ├── shop-drawing.entity.ts
    │   │   │   ├── shop-drawing-revision.entity.ts
    │   │   │   ├── shop-drawing-main-category.entity.ts
    │   │   │   └── shop-drawing-sub-category.entity.ts
    │   │   ├── drawing.module.ts
    │   │   ├── contract-drawing.controller.ts
    │   │   ├── contract-drawing.service.ts
    │   │   ├── drawing-master-data.controller.ts
    │   │   ├── drawing-master-data.service.ts
    │   │   ├── shop-drawing.controller.ts
    │   │   └── shop-drawing.service.ts
    │
    │   ├── rfa/                   # ✅ Request for Approval (multi-step workflow)
    │   │   ├── dto/
    │   │   │   ├── create-rfa.dto.ts
    │   │   │   ├── search-rfa.dto.ts
    │   │   │   └── update-rfa.dto.ts
    │   │   ├── entities/
    │   │   │   ├── rfa.entity.ts
    │   │   │   ├── rfa-revision.entity.ts
    │   │   │   ├── rfa-item.entity.ts
    │   │   │   ├── rfa-type.entity.ts
    │   │   │   ├── rfa-status-code.entity.ts
    │   │   │   ├── rfa-approve-code.entity.ts
    │   │   │   ├── rfa-workflow.entity.ts
    │   │   │   ├── rfa-workflow-template.entity.ts
    │   │   │   └── rfa-workflow-template-step.entity.ts
    │   │   ├── rfa.controller.ts
    │   │   ├── rfa.module.ts
    │   │   └── rfa.service.ts
    │
    │   ├── circulation/           # 🔄 Internal routing workflow
    │   │   ├── dto/
    │   │   │   ├── create-circulation.dto.ts
    │   │   │   ├── update-circulation-routing.dto.ts
    │   │   │   └── search-circulation.dto.ts
    │   │   ├── entities/
    │   │   │   ├── circulation.entity.ts
    │   │   │   ├── circulation-routing.entity.ts
    │   │   │   └── circulation-status-code.entity.ts
    │   │   ├── circulation.controller.ts
    │   │   ├── circulation.module.ts
    │   │   └── circulation.service.ts
    │
    │   ├── transmittal/            # 📤 Document forwarding
    │   │   ├── dto/
    │   │   │   ├── create-transmittal.dto.ts
    │   │   │   ├── search-transmittal.dto.ts
    │   │   │   └── update-transmittal.dto.ts
    │   │   ├── entities/
    │   │   │   ├── transmittal.entity.ts
    │   │   │   └── transmittal-item.entity.ts
    │   │   ├── transmittal.controller.ts
    │   │   ├── transmittal.module.ts
    │   │   └── transmittal.service.ts
    │
    │   ├── notification/           # 🔔 Real-Time notification system
    │   │   ├── dto/
    │   │   │   ├── create-notification.dto.ts
    │   │   │   └── search-notification.dto.ts
    │   │   ├── entities/
    │   │   │   └── notification.entity.ts
    │   │   ├── notification.module.ts           # WebSocket + Processor registration
    │   │   ├── notification.controller.ts
    │   │   ├── notification.gateway.ts          # WebSocket gateway
    │   │   ├── notification.processor.ts        # Message consumer (e.g. mail worker)
    │   │   ├── notification.service.ts
    │   │   └── notification-cleanup.service.ts  # Cron-based cleanup job
    │
    │   ├── search/                 # 🔍 Elasticsearch integration
    │   │   ├── dto/
    │   │   │   └── search-query.dto.ts
    │   │   ├── search.module.ts
    │   │   ├── search.controller.ts
    │   │   └── search.service.ts                # Indexing/search logic
    │
    │   ├── document-numbering/     # 🔢 Auto-increment controlled ID generation
    │   │   ├── entities/
    │   │   │   ├── document-number-format.entity.ts
    │   │   │   └── document-number-counter.entity.ts
    │   │   ├── document-numbering.module.ts
    │   │   ├── document-numbering.service.ts
    │   │   └── document-numbering.service.spec.ts
    │
    │   ├── workflow-engine/        # ⚙️ Unified state-machine workflow engine
    │   │   ├── interfaces/
    │   │   │   └── workflow.interface.ts
    │   │   ├── workflow-engine.module.ts
    │   │   ├── workflow-engine.service.ts
    │   │   └── workflow-engine.service.spec.ts
    │
    │   └── json-schema/            # 📋 Dynamic request schema validation
    │       ├── dto/
    │       │   ├── create-json-schema.dto.ts
    │       │   ├── update-json-schema.dto.ts
    │       │   └── search-json-schema.dto.ts
    │       ├── entities/
    │       │   └── json-schema.entity.ts
    │       ├── json-schema.module.ts
    │       ├── json-schema.controller.ts
    │       ├── json-schema.controller.spec.ts
    │       ├── json-schema.service.ts
    │       └── json-schema.service.spec.ts
```

---