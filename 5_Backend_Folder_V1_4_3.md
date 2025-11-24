# โครงสร้างโฟลเดอร์และไฟล์ทั้งหมดสำหรับ **Backend (NestJS)** ตามแผนงาน **LCBP3-DMS v1.4.3** ตั้งแต่ Phase 0 ถึง Phase 6 (T0-T6.2) ที่ได้ดำเนินการไปแล้ว

โครงสร้างนี้ออกแบบตามหลัก **Domain-Driven Design** และ **Modular Architecture** ที่ระบุไว้ในแผนพัฒนา

---

## 📂 **backend/** (Backend Application)

* [x] .env (สำหรับ Local Dev เท่านั้น ห้าม commit)
* [x] .gitignore
* [x] .prettierrc
* [x] docker-compose.override.yml
* [x] docker-compose.yml
* [x] nest-cli.json
* [x] tsconfig.build.json
* [x] tsconfig.json
* [x] package.json
* [x] pnpm-lock.yaml
* [x] README.md

---

## 📂 **backend/src/** (Source Code)

### **📄 Entry Points

* [x] main.ts
* [x] app.module.ts
* [x] app.service.ts
* [x] app.controller.ts
* [x] app.controller.spec.ts
* [x] redlock.d.ts

### **📁 src/common/** (Shared Resources)

* [x] common.module.ts
* **auth/**
  * **dto/**
    * [x] login.dto.ts
    * [x] register.dto.ts
  * **strategies/**
    * [x] local.strategy.ts
    * [x] jwt.strategy.ts
  * [x] auth.controller.spec.ts
  * [x] auth.controller.ts
  * [x] auth.module.ts
  * [x] auth.service.spec.ts
  * [x] auth.service.ts
* **config/**
  * [x] env.validation.ts
  * [x] redis.config.ts
* **decorators/**
  * [x] audit.decorator.ts
  * [x] bypass-maintenance.decorator.ts
  * [x] current-user.decorator.ts
  * [x] idempotency.decorator.ts
  * [x] require-permission.decorator.ts
  * [x] retry.decorator.ts
  * [x] circuit-breaker.decorator.ts
* **entities/**
  * [x] audit-log.entity.ts
  * [x] base.entity.ts
* **exceptions/**
  * [x] http-exception.filter.ts
* **file-storage/**
  * **entities/**
    * [x] attachment.entity.ts
  * [x] file-storage.controller.spec.ts
  * [x] file-storage.controller.ts
  * [x] file-storage.module.ts
  * [x] file-storage.service.spec.ts
  * [x] file-storage.service.ts
  * [x] file-cleanup.service.ts
* [x] guards/`
  * [x] jwt-auth.guard.ts
  * [x] jwt-refresh.guard.ts
  * [x] maintenance-mode.guard.ts
  * [x] rbac.guard.ts
* **interceptors/**
  * [x] audit-log.interceptor.ts
  * [x] idempotency.interceptor.ts
  * [x] performance.interceptor.ts
  * [x] transform.interceptor.ts
* **resilience/**
  * [x] resilience.module.ts
* **services/**
  * [x] crypto.service.ts
  * [x] request-context.service.ts

### **📁 src/modules/** (Feature Modules)

1. **user/** (User Management & RBAC)
    * [x] **dto/**
      * [x] assign-user-role.dto.ts
      * [x] create-user.dto.ts
      * [x] update-user.dto.ts
      * [x] update-user-preference.dto.ts
    * [x] **entities/**
      * [x] user.entity.ts
      * [x] role.entity.ts
      * [x] permission.entity.ts
      * [x] user-assignment.entity.ts
      * [x] user-preference.entity.ts
    * [x] user-assignment.service.ts
    * [x] user-preference.service.ts
    * [x] user.controller.ts
    * [x] user.module.ts
    * [x] user.service.ts
    * [x] user.service.spec.ts

2. **project/** (Project Structure)
    * [x] **dto/**
      * [x] create-project.dto.ts
      * [x] search-project.dto.ts
      * [x] update-project.dto.ts
    * [x] **entities/**
      * [x] contract-organization.entity.ts
      * [x] contract.entity.ts
      * [x] organization.entity.ts
      * [x] project-organization.entity.ts
      * [x] project.entity.ts
    * [x] project.controller.spec.ts
    * [x] project.controller.ts
    * [x] project.module.ts
    * [x] project.service.spec.ts
    * [x] project.service.ts

3. **correspondence/** (Core Document System)
    * [x] **dto/**
      * [x] add-reference.dto.ts
      * [x] create-correspondence.dto.ts
      * [x] search-correspondence.dto.ts
      * [x] submit-correspondence.dto.ts
      * [x] workflow-action.dto.ts
    * [x] **entities/**
      * [x] correspondence-reference.entity.ts
      * [x] correspondence-revision.entity.ts
      * [x] correspondence-routing.entity.ts
      * [x] correspondence-status.entity.ts
      * [x] correspondence-type.entity.ts
      * [x] correspondence.entity.ts
      * [x] routing-template-step.entity.ts
      * [x] routing-template.entity.ts
    * [x] correspondence.controller.spec.ts
    * [x] correspondence.controller.ts
    * [x] correspondence.module.ts
    * [x] correspondence.service.spec.ts
    * [x] correspondence.service.ts

4. **drawing/** (Contract & Shop Drawings)
    * [x] **dto/**
      * [x] create-contract-drawing.dto.ts
      * [x] create-shop-drawing-revision.dto.ts
      * [x] create-shop-drawing.dto.ts
      * [x] search-contract-drawing.dto.ts
      * [x] search-shop-drawing.dto.ts
      * [x] update-contract-drawing.dto.ts
    * [x] **entities/**
      * [x] contract-drawing-sub-category.entity.ts
      * [x] contract-drawing-volume.entity.ts
      * [x] contract-drawing.entity.ts
      * [x] shop-drawing-main-category.entity.ts
      * [x] shop-drawing-revision.entity.ts
      * [x] shop-drawing-sub-category.entity.ts
      * [x] shop-drawing.entity.ts
    * [x] contract-drawing.controller.ts
    * [x] contract-drawing.service.ts
    * [x] drawing-master-data.controller.ts
    * [x] drawing-master-data.service.ts
    * [x] drawing.module.ts
    * [x] shop-drawing.controller.ts
    * [x] shop-drawing.service.ts

5. **rfa/** (Request for Approval & Advanced Workflow)
    * [x] **dto/**
      * [x] create-rfa.dto.ts
      * [x] search-rfa.dto.ts
      * [x] update-rfa.dto.ts
    * [x] **entities/**
      * [x] rfa-approve-code.entity.ts
      * [x] rfa-item.entity.ts
      * [x] rfa-revision.entity.ts
      * [x] rfa-status-code.entity.ts
      * [x] rfa-type.entity.ts
      * [x] rfa-workflow-template-step.entity.ts
      * [x] rfa-workflow-template.entity.ts
      * [x] rfa-workflow.entity.ts
      * [x] rfa.entity.ts
    * [x] rfa.controller.ts
    * [x] rfa.module.ts
    * [x] rfa.service.ts

6. **circulation/** (Internal Routing)
    * [x] **dto/**
      * [x] create-circulation.dto.ts
      * [x] update-circulation-routing.dto.ts
      * [x] search-circulation.dto.ts
    * [x] **entities/**
      * [x] circulation-routing.entity.ts
      * [x] circulation-status-code.entity.ts
      * [x] circulation.entity.ts
    * [x] circulation.controller.ts
    * [x] circulation.module.ts
    * [x] circulation.service.ts

7. **transmittal/** (Document Forwarding)
    * [x] **dto/**
      * [x] create-transmittal.dto.ts
      * [x] search-transmittal.dto.ts
      * [x] update-transmittal.dto.ts
    * [x] **entities/**
      * [x] transmittal-item.entity.ts
      * [x] transmittal.entity.ts
    * [x] transmittal.controller.ts
    * [x] transmittal.module.ts
    * [x] transmittal.service.ts

8. **notification/** (System Alerts)
    * [x] **dto/**
      * [x] create-notification.dto.ts
      * [x] search-notification.dto.ts
    * [x] **entities/**
      * [x] notification.entity.ts
    * [x] notification-cleanup.service.ts
    * [x] notification.controller.ts
    * [x] notification.gateway.ts
    * [x] notification.module.ts
    * [x] notification.processor.ts
    * [x] notification.service.ts

9. **search/** (Elasticsearch)
    * [x] dto/search-query.dto.ts
    * [x] search.controller.ts
    * [x] search.module.ts
    * [x] search.service.ts

10. **document-numbering/**
    * [x] **entities/**
      * [x] document-number-format.entity.ts
      * [x] document-number-counter.entity.ts
    * [x] document-numbering.module.ts
    * [x] document-numbering.service.spec.ts
    * [x] document-numbering.service.ts

11. **workflow-engine/** (Unified Logic)
    * [x] **dto/**
      * [x] create-workflow-definition.dto.ts
      * [x] evaluate-workflow.dto.ts
      * [x] get-available-actions.dto.ts
      * [x] update-workflow-definition.dto.ts
    * [x] interfaces/workflow.interface.ts
    * [x] workflow-dsl.service.ts
    * [x] workflow-engine.module.ts
    * [x] workflow-engine.service.spec.ts
    * [x] workflow-engine.service.ts 

12. **json-schema/** (Validation)
    * [x] **dto/**
      * [x] create-json-schema.dto.ts+
      * [x] search-json-schema.dto.ts
      * [x] update-json-schema.dto.ts
    * [x] **entities/**
      * [x] json-schema.entity.ts
    * [x] json-schema.controller.spec.ts
    * [x] json-schema.controller.ts
    * [x] json-schema.module.ts
    * [x] json-schema.service.spec.ts
    * [x] json-schema.service.ts

13. **monitoring/** (Monitoring & Metrics)
    * [x] **controllers/**
      * [x] health.controller.ts
    * [x] **dto/**
      * [ ] set-maintenance.dto.ts
    * [x] **logger/**
      * [x] winston.config.ts
    * [x] **services/**
      * [x] metrics.service.ts
    * [x] monitoring.controller.ts
    * [x] monitoring.service.ts
    * [x] monitoring.module.ts

## **Folder Structure ของ Backend (NestJS)** ที่

---

### 📁 Backend Folder Structure (LCBP3-DMS v1.4.3)

```text
backend/
├── .env                         # Environment variables for local development only (not committed)
├── .gitignore                   # Git ignore rules
├── .prettierrc                  # Prettier configuration
├── docker-compose.yml           # Main deployment container configuration
├── docker-compose.override.yml  # Dev-time secret/environment injection
├── package.json                 # Node dependencies and NPM scripts
├── pnpm-lock.yaml               # Dependency lock file for pnpm
├── tsconfig.json                # TypeScript compiler configuration
├── tsconfig.build.json          # TypeScript compiler configuration for production
├── nest-cli.json                # NestJS project configuration
├── README.md                    # Project documentation
└── src/
    ├── main.ts                  # Application bootstrap and initialization
    ├── app.module.ts            # Root application module
    ├── app.service.ts           # Root application service
    ├── app.controller.ts        # Root application controller
    ├── app.controller.spec.ts   # Root application unit tests
    ├── redlock.d.ts             # Redlock configuration
    │
    ├── common/                  # 🛠️ Shared framework resources used across modules
    │   ├── common.module.ts     # Registers shared providers
    │   │
    │   ├── auth/                # 🛡️ Authentication module
    │   │   ├── dto/
    │   │   │   ├── login.dto.ts                # Login request payload
    │   │   │   └── register.dto.ts             # Registration payload
    │   │   ├── strategies/
    │   │   │   ├── local.strategy.ts           # Local strategy for authentication
    │   │   │   └── jwt.strategy.ts             # JWT strategy for authentication
    │   │   ├── auth.module.ts                  # Auth DI module
    │   │   ├── auth.controller.ts              # Auth REST endpoints
    │   │   ├── auth.controller.spec.ts         # Unit tests for controller
    │   │   ├── auth.service.ts                 # Authentication logic
    │   │   └── auth.service.spec.ts            # Unit test for service
    │   │
    │   ├── config/               # 📄 Configuration
    │   │   ├── env.validation.ts              # Zod/Joi validation for environment variables
    │   │   └── redis.config.ts                # Redis configuration
    │   │
    │   ├── decorators/           # 📡 Decorators for common use cases
    │   │   ├── audit.decorator.ts              # Enables audit logging for a method
    │   │   ├── bypass-maintenance.decorator.ts # Declares bypass maintenance requirement
    │   │   ├── current-user.decorator.ts       # Extracts logged-in user from request
    │   │   ├── idempotency.decorator.ts        # Declares idempotency requirement
    │   │   ├── require-permission.decorator.ts # Declares RBAC permission requirement
    │   │   ├── retry.decorator.ts              # Declares retry requirement
    │   │   └── circuit-breaker.decorator.ts    # Declares circuit breaker requirement
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
    │   │   ├── file-storage.service.spec.ts    # Unit tests
    │   │   └── file-cleanup.service.ts         # Cleanup temporary files
    │   │
    │   ├── guards/                  # 🛡️ JWT authentication guard
    │   │   ├── jwt-auth.guard.ts               # JWT authentication guard
    │   │   ├── jwt-refresh.guard.ts            # JWT refresh guard
    │   │   ├── maintenance-mode.guard.ts       # Maintenance mode guard
    │   │   └── rbac.guard.ts                   # Role-based access control enforcement (ตรวจสอบสิทธิ์ 4 ระดับ)
    │   │
    │   ├── interceptors/           # 📡 Interceptors for common use cases
    │   │   ├── audit-log.interceptor.ts        # Automatically logs certain operations
    │   │   ├── idempotency.interceptor.ts      # Idempotency interceptor
    │   │   ├── performance.interceptor.ts      #
    │   │   └── transform.interceptor.ts        # Standardized response formatting
    │   │
    │   ├─── resilience/             # 🛡️ Circuit-breaker / retry logic (if implemented)
    │   │   └── resilience.module.ts            # Resilience module
    │   │
    │   └──── services/              # 🔐 Security service
    │       ├── crypto.service.ts               # Crypto service
    │       └── request-context.service.ts      # Request context service (for logging)
    │
    ├── modules/             # 📦 Module-specific resources
    │   ├── user/                    # 👤 User + RBAC module
    │   │   ├── dto/
    │   │   │   ├── assign-user-role.dto.ts     # Assign roles to users
    │   │   │   ├── create-user.dto.ts          # Create new user
    │   │   │   ├── update-user.dto.ts          # Update user details
    │   │   │   └── update-user-preference.dto.ts # Update user preferences
    │   │   ├── entities/
    │   │   │   ├── user.entity.ts              # User table definition
    │   │   │   ├── role.entity.ts              # Role definition
    │   │   │   ├── permission.entity.ts        # Permission entity
    │   │   │   ├── user-assignment.entity.ts   # User assignment entity
    │   │   │   └── user-preference.entity.ts   # User preference settings
    │   │   ├── user-assignment.service.ts      # User assignment service
    │   │   ├── user-preference.service.ts      # User preference service
    │   │   ├── user.controller.ts              # REST endpoints
    │   │   ├── user.module.ts                  # Module DI container
    │   │   ├── user.service.ts                 # Business logic
    │   │   └── user.service.spec.ts            # Unit tests
    │   │
    │   ├── project/              # 🏢 Project/Organization/Contract structure
    │   │   ├── dto/
    │   │   │   ├── create-project.dto.ts       # Create new project
    │   │   │   ├── search-project.dto.ts       # Search projects
    │   │   │   └── update-project.dto.ts       # Update project
    │   │   ├── entities/
    │   │   │   ├── project.entity.ts           # Project table definition
    │   │   │   ├── contract.entity.ts          # Contract table definition
    │   │   │   ├── organization.entity.ts      # Organization table definition
    │   │   │   ├── project-organization.entity.ts  # Project organization entity
    │   │   │   └── contract-organization.entity.ts  # Contract organization entity
    │   │   ├── project.controller.ts           # REST endpoints
    │   │   ├── project.controller.spec.ts      # Unit tests
    │   │   ├── project.module.ts               # Module DI container
    │   │   ├── project.service.ts              # Business logic
    │   │   └── project.service.spec.ts         # Unit tests
    │   │
    │   ├── correspondence/        # ✉️ Formal letters with routing workflow
    │   │   ├── dto/
    │   │   │   ├── add-reference.dto.ts                # Add reference to correspondence
    │   │   │   ├── create-correspondence.dto.ts        # Create new correspondence
    │   │   │   ├── search-correspondence.dto.ts        # Search correspondences
    │   │   │   ├── submit-correspondence.dto.ts        # Submit correspondence
    │   │   │   └── workflow-action.dto.ts              # Workflow action
    │   │   ├── entities/
    │   │   │   ├── correspondence.entity.ts            # Correspondence table definition
    │   │   │   ├── correspondence-revision.entity.ts   # Correspondence revision entity
    │   │   │   ├── correspondence-routing.entity.ts    # Correspondence routing entity (Unified Workflow)
    │   │   │   ├── correspondence-status.entity.ts     # Correspondence status entity
    │   │   │   ├── correspondence-type.entity.ts       # Correspondence type entity
    │   │   │   ├── correspondence-reference.entity.ts  # Correspondence reference entity
    │   │   │   ├── routing-template.entity.ts          # Routing template entity
    │   │   │   └── routing-template-step.entity.ts     # Routing template step entity
    │   │   ├── correspondence.controller.ts            # REST endpoints
    │   │   ├── correspondence.controller.spec.ts       # Unit tests
    │   │   ├── correspondence.module.ts                # Module DI container
    │   │   ├── correspondence.service.ts               # Business logic
    │   │   └── correspondence.service.spec.ts          # Unit tests
    │   │
    │   ├── drawing/               # 📐Contract & Shop drawing tracking
    │   │   ├── dto/
    │   │   │   ├── create-contract-drawing.dto.ts      # Create new contract drawing
    │   │   │   ├── create-shop-drawing.dto.ts          # Create new shop drawing
    │   │   │   ├── create-shop-drawing-revision.dto.ts # Create new shop drawing revision
    │   │   │   ├── search-contract-drawing.dto.ts      # Search contract drawings
    │   │   │   ├── search-shop-drawing.dto.ts          # Search shop drawings
    │   │   │   └── update-contract-drawing.dto.ts      # Update contract drawing
    │   │   ├── entities/
    │   │   │   ├── contract-drawing.entity.ts          # Contract drawing entity
    │   │   │   ├── contract-drawing-volume.entity.ts   # Contract drawing volume entity
    │   │   │   ├── contract-drawing-sub-category.entity.ts  # Contract drawing sub category entity
    │   │   │   ├── shop-drawing.entity.ts              # Shop drawing entity
    │   │   │   ├── shop-drawing-revision.entity.ts     # Shop drawing revision entity
    │   │   │   ├── shop-drawing-main-category.entity.ts  # Shop drawing main category entity
    │   │   │   └── shop-drawing-sub-category.entity.ts # Shop drawing sub category entity
    │   │   ├── drawing.module.ts                   # Module DI container
    │   │   ├── contract-drawing.controller.ts      # REST endpoints
    │   │   ├── contract-drawing.service.ts         # Business logic
    │   │   ├── drawing-master-data.controller.ts   # REST endpoints
    │   │   ├── drawing-master-data.service.ts      # Business logic
    │   │   ├── shop-drawing.controller.ts          # REST endpoints
    │   │   └── shop-drawing.service.ts             # Business logic
    │   │
    │   ├── rfa/                   # ✅ Request for Approval (multi-step workflow)
    │   │   ├── dto/
    │   │   │   ├── create-rfa.dto.ts               # Create new RFA
    │   │   │   ├── search-rfa.dto.ts               # Search RFAs
    │   │   │   └── update-rfa.dto.ts               # Update RFA
    │   │   ├── entities/
    │   │   │   ├── rfa.entity.ts                   # RFA entity
    │   │   │   ├── rfa-revision.entity.ts          # RFA revision entity
    │   │   │   ├── rfa-item.entity.ts              # RFA item entity
    │   │   │   ├── rfa-type.entity.ts              # RFA type entity
    │   │   │   ├── rfa-status-code.entity.ts       # RFA status code entity
    │   │   │   ├── rfa-approve-code.entity.ts      # RFA approve code entity
    │   │   │   ├── rfa-workflow.entity.ts          # RFA workflow entity
    │   │   │   ├── rfa-workflow-template.entity.ts # RFA workflow template entity
    │   │   │   └── rfa-workflow-template-step.entity.ts  # RFA workflow template step entity
    │   │   ├── rfa.controller.ts                   # REST endpoints
    │   │   ├── rfa.module.ts                       # Module DI container
    │   │   └── rfa.service.ts                      # Business logic
    │   │
    │   ├── circulation/           # 🔄 Internal routing workflow
    │   │   ├── dto/
    │   │   │   ├── create-circulation.dto.ts       # Create new circulation
    │   │   │   ├── update-circulation-routing.dto.ts  # Update circulation routing
    │   │   │   └── search-circulation.dto.ts       # Search circulation
    │   │   ├── entities/
    │   │   │   ├── circulation.entity.ts           # Circulation entity
    │   │   │   ├── circulation-routing.entity.ts   # Circulation routing entity
    │   │   │   └── circulation-status-code.entity.ts  # Circulation status code entity
    │   │   ├── circulation.controller.ts           # REST endpoints
    │   │   ├── circulation.module.ts               # Module DI container
    │   │   └── circulation.service.ts              # Business logic
    │   │
    │   ├── transmittal/            # 📤 Document forwarding
    │   │   ├── dto/
    │   │   │   ├── create-transmittal.dto.ts       # Create new transmittal
    │   │   │   ├── search-transmittal.dto.ts       # Search transmittal
    │   │   │   └── update-transmittal.dto.ts       # Update transmittal
    │   │   ├── entities/
    │   │   │   ├── transmittal.entity.ts           # Transmittal entity
    │   │   │   └── transmittal-item.entity.ts      # Transmittal item entity
    │   │   ├── transmittal.controller.ts           # REST endpoints
    │   │   ├── transmittal.module.ts               # Module DI container
    │   │   └── transmittal.service.ts              # Business logic
    │   │
    │   ├── notification/           # 🔔 Real-Time notification system
    │   │   ├── dto/
    │   │   │   ├── create-notification.dto.ts      # Create new notification
    │   │   │   └── search-notification.dto.ts      # Search notification
    │   │   ├── entities/
    │   │   │   └── notification.entity.ts          # Notification entity
    │   │   ├── notification.module.ts              # WebSocket + Processor registration
    │   │   ├── notification.controller.ts          # REST endpoints
    │   │   ├── notification.gateway.ts             # WebSocket gateway
    │   │   ├── notification.processor.ts           # Message consumer (Consumer/Worker for Email & Line)
    │   │   ├── notification.service.ts             # Business logic
    │   │   └── notification-cleanup.service.ts     # Cron-based cleanup job
    │   │
    │   ├── search/                 # 🔍 Elasticsearch integration
    │   │   ├── dto/
    │   │   │   └── search-query.dto.ts             # Search query
    │   │   ├── search.module.ts                    # Module DI container
    │   │   ├── search.controller.ts                # REST endpoints
    │   │   └── search.service.ts                   # Indexing/search logic
    │   │
    │   ├── document-numbering/     # 🔢 Auto-increment controlled ID generation
    │   │   ├── entities/
    │   │   │   ├── document-number-format.entity.ts  # Document number format entity
    │   │   │   └── document-number-counter.entity.ts # Document number counter entity
    │   │   ├── document-numbering.module.ts          # Module DI container
    │   │   ├── document-numbering.service.ts         # Business logic
    │   │   └── document-numbering.service.spec.ts    # Unit tests
    │   │
    │   ├── workflow-engine/        # ⚙️ Unified state-machine workflow engine
    │   │   ├── dto/
    │   │   │   ├── create-workflow-definition.dto.ts # Create new workflow definition
    │   │   │   ├── evaluate-workflow.dto.ts          # Evaluate workflow
    │   │   │   ├── get-available-actions.dto.ts      # Get available actions
    │   │   │   └── update-workflow-definition.dto.ts # Update workflow definition
    │   │   ├── entities/
    │   │   │   └── workflow-definition.entity.ts     # Workflow definition entity
    │   │   ├── interfaces/
    │   │   │   └── workflow.interface.ts             # Workflow interface
    │   │   ├── workflow-engine.controller.ts         # REST endpoints
    │   │   ├── workflow-engine.module.ts             # Module DI container
    │   │   ├── workflow-engine.service.ts            # State Machine Logic
    │   │   └── workflow-engine.service.spec.ts       # Unit tests
    │   │
    │   ├── json-schema/            # 📋 Dynamic request schema validation
    │   │   ├── dto/
    │   │   │   ├── create-json-schema.dto.ts     # Create new JSON schema
    │   │   │   ├── update-json-schema.dto.ts     # Update JSON schema
    │   │   │   └── search-json-schema.dto.ts     # Search JSON schema
    │   │   ├── entities/
    │   │   │   └── json-schema.entity.ts         # JSON schema entity
    │   │   ├── json-schema.module.ts             # Module DI container
    │   │   ├── json-schema.controller.ts         # REST endpoints
    │   │   ├── json-schema.controller.spec.ts    # Unit tests
    │   │   ├── json-schema.service.ts            # Business logic
    │   │   └── json-schema.service.spec.ts       # Unit tests
    │   │
    │   └── monitoring/            # 📋 Dynamic request schema validation
    │       ├── controllers/
    │       │   └── health.controller.ts          # Create new JSON schema
    │       ├── dto/
    │       │   └── set-maintenance.dto.ts        # Create new JSON schema
    │       ├── logger/
    │       │   └── winston.config.ts             # JSON schema entity
    │       ├── services/
    │       │   └── metrics.service.ts            # JSON schema entity
    │       ├── monitoring.controller.ts          # REST endpoints
    │       ├── monitoring.service.ts             # Business logic
    │       └── monitoring.module.ts              # Module DI container

```

---
