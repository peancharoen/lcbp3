# 📝 **Documents Management System Version 1.4.1: แนวทางการพัฒนา FullStackJS (ปรับปรุงโดย deepseek)**

**ปรับปรุงตาม Requirements v1.4.0 ที่อัปเดตแล้ว*

## 🧠**1. ปรัชญาทั่วไป**

แนวทางปฏิบัติที่ดีที่สุดแบบครบวงจรสำหรับการพัฒนา NestJS Backend, NextJS Frontend และ Tailwind-based UI/UX ในสภาพแวดล้อม TypeScript มุ่งเน้นที่ ความชัดเจน (clarity), ความง่ายในการบำรุงรักษา (maintainability), ความสอดคล้องกัน (consistency) และ การเข้าถึงได้ (accessibility) ตลอดทั้งสแต็ก

## ⚙️**2. แนวทางทั่วไปสำหรับ TypeScript**

### **2.1 หลักการพื้นฐาน**

* ใช้ **ภาษาอังกฤษ** สำหรับโค้ด
* ใช้ **ภาษาไทย** สำหรับ comment และเอกสารทั้งหมด
* กำหนดไทป์ (type) อย่างชัดเจนสำหรับตัวแปร, พารามิเตอร์ และค่าที่ส่งกลับ (return values) ทั้งหมด
* หลีกเลี่ยงการใช้ any; ให้สร้างไทป์ (types) หรืออินเทอร์เฟซ (interfaces) ที่กำหนดเอง
* ใช้ **JSDoc** สำหรับคลาส (classes) และเมธอด (methods) ที่เป็น public
* ส่งออก (Export) **สัญลักษณ์หลัก (main symbol) เพียงหนึ่งเดียว** ต่อไฟล์
* หลีกเลี่ยงบรรทัดว่างภายในฟังก์ชัน
* ระบุ // File: path/filename ในบรรทัดแรกของทุกไฟล์
* ระบุ // บันทึกการแก้ไข, หากมีการแก้ไขเพิ่มในอนาคต ให้เพิ่มบันทึก

### **2.2 ข้อตกลงในการตั้งชื่อ (Naming Conventions)**

| Entity (สิ่งที่ตั้งชื่อ) | Convention (รูปแบบ) | Example (ตัวอย่าง) |
| :---- | :---- | :---- |
| Classes | PascalCase | UserService |
| Property | snake_case | user_id |
| Variables & Functions | camelCase | getUserInfo |
| Files & Folders | kebab-case | user-service.ts |
| Environment Variables | UPPERCASE | DATABASE_URL |
| Booleans | Verb + Noun | isActive, canDelete, hasPermission |

ใช้คำเต็ม — ไม่ใช้อักษรย่อ — ยกเว้นคำมาตรฐาน (เช่น API, URL, req, res, err, ctx)

### 🧩**2.3 ฟังก์ชัน (Functions)**

* เขียนฟังก์ชันให้สั้น และทำ **หน้าที่เพียงอย่างเดียว** (single-purpose) (\< 20 บรรทัด)
* ใช้ **early returns** เพื่อลดการซ้อน (nesting) ของโค้ด
* ใช้ **map**, **filter**, **reduce** แทนการใช้ loops เมื่อเหมาะสม
* ควรใช้ **arrow functions** สำหรับตรรกะสั้นๆ, และใช้ **named functions** ในกรณีอื่น
* ใช้ **default parameters** แทนการตรวจสอบค่า null
* จัดกลุ่มพารามิเตอร์หลายตัวให้เป็นอ็อบเจกต์เดียว (RO-RO pattern)
* ส่งค่ากลับ (Return) เป็นอ็อบเจกต์ที่มีไทป์กำหนด (typed objects) ไม่ใช่ค่าพื้นฐาน (primitives)  
* รักษาระดับของสิ่งที่เป็นนามธรรม (abstraction level) ให้เป็นระดับเดียวในแต่ละฟังก์ชัน

### 🧱**2.4 การจัดการข้อมูล (Data Handling)**

* ห่อหุ้มข้อมูล (Encapsulate) ในไทป์แบบผสม (composite types)
* ใช้ **immutability** (การไม่เปลี่ยนแปลงค่า) ด้วย readonly และ as const
* ทำการตรวจสอบความถูกต้องของข้อมูล (Validations) ในคลาสหรือ DTOs ไม่ใช่ภายในฟังก์ชันทางธุรกิจ
* ตรวจสอบความถูกต้องของข้อมูลโดยใช้ DTOs ที่มีไทป์กำหนดเสมอ

### 🧰**2.5 คลาส (Classes)**

* ปฏิบัติตามหลักการ **SOLID**
* ควรใช้ **composition มากกว่า inheritance** (Prefer composition over inheritance)
* กำหนด **interfaces** สำหรับสัญญา (contracts)
* ให้คลาสมุ่งเน้นการทำงานเฉพาะอย่างและมีขนาดเล็ก (\< 200 บรรทัด, \< 10 เมธอด, \< 10 properties)

### 🚨**2.6 การจัดการข้อผิดพลาด (Error Handling)**

* ใช้ Exceptions สำหรับข้อผิดพลาดที่ไม่คาดคิด
* ดักจับ (Catch) ข้อผิดพลาดเพื่อแก้ไขหรือเพิ่มบริบท (context) เท่านั้น; หากไม่เช่นนั้น ให้ใช้ global error handlers
* ระบุข้อความข้อผิดพลาด (error messages) ที่มีความหมายเสมอ

### 🧪**2.7 การทดสอบ (ทั่วไป) (Testing (General))**

* ใช้รูปแบบ **Arrange–Act–Assert**
* ใช้ชื่อตัวแปรในการทดสอบที่สื่อความหมาย (inputData, expectedOutput)
* เขียน **unit tests** สำหรับ public methods ทั้งหมด
* จำลอง (Mock) การพึ่งพาภายนอก (external dependencies)
* เพิ่ม **acceptance tests** ต่อโมดูลโดยใช้รูปแบบ Given–When-Then

### **Testing Strategy โดยละเอียด**

* **Test Pyramid Structure**

      /\
     /  \        E2E Tests (10%)
    /____\       Integration Tests (20%)
   /      \      Unit Tests (70%)
  /________\

* **Testing Tools Stack**

  ```typescript
  // Backend Testing Stack
  const backendTesting = {
    unit: ['Jest', 'ts-jest', '@nestjs/testing'],
    integration: ['Supertest', 'Testcontainers', 'Jest'],
    e2e: ['Supertest', 'Jest', 'Database Seeds'],
    security: ['Jest', 'Custom Security Test Helpers'],
    performance: ['Jest', 'autocannon', 'artillery']
  };

  // Frontend Testing Stack  
  const frontendTesting = {
    unit: ['Vitest', 'React Testing Library'],
    integration: ['React Testing Library', 'MSW'],
    e2e: ['Playwright', 'Jest'],
    visual: ['Playwright', 'Loki']
  };

  ```

* **Test Data Managemen**

  ```typescript
  // Test Data Factories
  interface TestDataFactory {
    createUser(overrides?: Partial<User>): User;
    createCorrespondence(overrides?: Partial<Correspondence>): Correspondence;
    createRoutingTemplate(overrides?: Partial<RoutingTemplate>): RoutingTemplate;
  }

  // Test Scenarios
  const testScenarios = {
    happyPath: 'Normal workflow execution',
    edgeCases: 'Boundary conditions and limits',
    errorConditions: 'Error handling and recovery',
    security: 'Authentication and authorization',
    performance: 'Load and stress conditions'
  };
  ```

## 🏗️**3. แบ็กเอนด์ (NestJS) (Backend (NestJS))**

### **3.1 หลักการ**

* **สถาปัตยกรรมแบบโมดูลาร์ (Modular architecture)**:
  * หนึ่งโมดูลต่อหนึ่งโดเมน
  * โครงสร้างแบบ Controller → Service → Repository (Model)
* API-First: มุ่งเน้นการสร้าง API ที่มีคุณภาพสูง มีเอกสารประกอบ (Swagger) ที่ชัดเจนสำหรับ Frontend Team
* DTOs ที่ตรวจสอบความถูกต้องด้วย **class-validator**
* ใช้ **MikroORM** (หรือ TypeORM/Prisma) สำหรับการคงอยู่ของข้อมูล (persistence) ซึ่งสอดคล้องกับสคีมา MariaDB
* ห่อหุ้มโค้ดที่ใช้ซ้ำได้ไว้ใน **common module** (@app/common):
  * Configs, decorators, DTOs, guards, interceptors, notifications, shared services, types, validators

### **3.2 ฟังก์ชันหลัก (Core Functionalities)**

* Global **filters** สำหรับการจัดการ exception
* **Middlewares** สำหรับการจัดการ request
* **Guards** สำหรับการอนุญาต (permissions) และ RBAC
* **Interceptors** สำหรับการแปลงข้อมูล response และการบันทึก log

### **3.3 ข้อจำกัดในการ Deploy (QNAP Container Station)**

* **ห้ามใช้ไฟล์ .env** ในการตั้งค่า Environment Variables [cite: 2.1]
* การตั้งค่าทั้งหมด (เช่น Database connection string, JWT secret) **จะต้องถูกกำหนดผ่าน Environment Variable ใน docker-compose.yml โดยตรง** [cite: 6.5] ซึ่งจะจัดการผ่าน UI ของ QNAP Container Station [cite: 2.1]

### **3.4 ข้อจำกัดด้านความปลอดภัย (Security Constraints):**

* **File Upload Security:** ต้องมี virus scanning (ClamAV), file type validation (white-list), และ file size limits (50MB)
* **Input Validation:** ต้องป้องกัน OWASP Top 10 vulnerabilities (SQL Injection, XSS, CSRF)
* **Rate Limiting:** ต้อง implement rate limiting ตาม strategy ที่กำหนด
* **Secrets Management:** ต้องมี mechanism สำหรับจัดการ sensitive secrets อย่างปลอดภัย แม้จะใช้ docker-compose.yml

### **3.5 โครงสร้างโมดูลตามโดเมน (Domain-Driven Module Structure)**

เพื่อให้สอดคล้องกับสคีมา SQL (LCBP3-DMS) เราจะใช้โครงสร้างโมดูลแบบ **Domain-Driven (แบ่งตามขอบเขตธุรกิจ)** แทนการแบ่งตามฟังก์ชัน:

#### 3.5.1 **CommonModule:**

* เก็บ Services ที่ใช้ร่วมกัน เช่น DatabaseModule, FileStorageService (จัดการไฟล์ใน QNAP), AuditLogService, NotificationService
* จัดการ audit_logs
* NotificationService ต้องรองรับ Triggers ที่ระบุใน Requirement 6.7 [cite: 6.7]

#### 3.5.2 **AuthModule:**

* จัดการะการยืนยันตัวตน (JWT, Guards)
* **(สำคัญ)** ต้องรับผิดชอบการตรวจสอบสิทธิ์ **4 ระดับ** [cite: 4.2]: สิทธิ์ระดับระบบ (Global Role), สิทธิ์ระดับองกรณ์ (Organization Role), สิทธิ์ระดับโปรเจกต์ (Project Role), และ สิทธิ์ระดับสัญญา (Contract Role)
* **(สำคัญ)** ต้องมี API สำหรับ **Admin Panel** เพื่อ:
  * สร้างและจัดการ Role และการจับคู่ Permission แบบไดนามิก [cite: 4.3]
  * ให้ Superadmin สร้าง Organizations และกำหนด Org Admin ได้ [cite: 4.6]
  * ให้ Superadmin/Admin จัดการ document_number_formats (รูปแบบเลขที่เอกสาร), document_number_counters (Running Number) [cite: 3.10]

#### 3.5.3 **UserModule:**

* จัดการ users, roles, permissions, global_default_roles, role_permissions, user_roles, user_project_roles
* **(สำคัญ)** ต้องมี API สำหรับ **Admin Panel** เพื่อ:
  * สร้างและจัดการ Role และการจับคู่ Permission แบบไดนามิก [cite: 4.3]

#### 3.5.4 **ProjectModule:**

* จัดการ projects, organizations, contracts, project_parties, contract_parties

#### 3.5.6 **MasterModule:**

* จัดการ master data (correspondence_types, rfa_types, rfa_status_codes, rfa_approve_codes, circulation_status_codes, correspondence_types, correspondence_status, tags) [cite: 4.5]

#### 3.5.7**CorrespondenceModule (โมดูลศูนย์กลาง):**

* จัดการ correspondences, correspondence_revisions, correspondence_tags
* **(สำคัญ)** Service นี้ต้อง Inject DocumentNumberingService เพื่อขอเลขที่เอกสารใหม่ก่อนการสร้าง
* **(สำคัญ)** ตรรกะการสร้าง/อัปเดต Revision จะอยู่ใน Service นี้
* จัดการ correspondence_attachments (ตารางเชื่อมไฟล์แนบ)
* รับผิดชอบ Routing **Correspondence Routing** (correspondence_routings, correspondence_routing_template_steps, correspondence_routing_templates, correspondence_status_transitions) สำหรับการส่งต่อเอกสารทั่วไประหว่างองค์กร

#### 3.5.8 **RfaModule:**

* จัดการ rfas, rfa_revisions, rfa_items
* รับผิดชอบเวิร์กโฟลว์ **"RFA Workflows"** (rfa_workflows, rfa_workflow_templates, rfa_workflow_template_steps, rfa_status_transitions) สำหรับการอนุมัติเอกสารทางเทคนิค

#### 3.5.9 **DrawingModule:**

* จัดการ shop_drawings, shop_drawing_revisions, contract_drawings, contract_drawing_volumes, contract_drawing_cats, contract_drawing_sub_cats, shop_drawing_main_categories, shop_drawing_sub_categories, contract_drawing_subcat_cat_maps, shop_drawing_revision_contract_refs
* จัดการ shop_drawing_revision_attachments และ contract_drawing_attachments(ตารางเชื่อมไฟล์แนบ)

#### 3.5.10 **CirculationModule:**

* จัดการ circulations, circulation_templates, circulation_assignees
* จัดการ circulation_attachments (ตารางเชื่อมไฟล์แนบ)
* รับผิดชอบเวิร์กโฟลว์ **"Circulations"** (circulation_status_transitions, circulation_template_assignees, circulation_assignees, circulation_recipients, circulation_actions, circulation_action_documents)สำหรับการเวียนเอกสาร **ภายในองค์กร**

#### 3.5.11 **TransmittalModule:**

* จัดการ transmittals และ transmittal_items

#### 3.5.12 **SearchModule:**

* ให้บริการค้นหาขั้นสูง (Advanced Search) [cite: 6.2] โดยใช้ **Elasticsearch** เพื่อรองรับการค้นหาแบบ Full-text จากชื่อเรื่อง, รายละเอียด, เลขที่เอกสาร, ประเภท, วันที่, และ Tags
* ระบบจะใช้ Elasticsearch Engine ในการจัดทำดัชนีเพื่อการค้นหาข้อมูลเชิงลึกจากเนื้อหาของเอกสาร โดยข้อมูลจะถูกส่งไปทำดัชนีจาก Backend (NestJS) ทุกครั้งที่มีการสร้างหรือแก้ไขเอกสาร

#### 3.5.13 **DocumentNumberingModule:**

* **สถานะ:** เป็น Module ภายใน (Internal Module) ไม่เปิด API สู่ภายนอก
* **หน้าที่:** ให้บริการ DocumentNumberingService ที่ Module อื่น (เช่น CorrespondenceModule) จะ Inject ไปใช้งาน
* **ตรรกะ:** รับผิดชอบการสร้างเลขที่เอกสารโดยใช้ **Redis distributed locking** แทน stored procedure
* **Features:**
  * Application-level locking เพื่อป้องกัน race condition
  * Retry mechanism ด้วย exponential backoff
  * Fallback mechanism เมื่อการขอเลขล้มเหลว
  * Audit log ทุกครั้งที่มีการ generate เลขที่เอกสารใหม่

#### 3.5.14 **CorrespondenceRoutingModule:**

* **สถานะ:** โมดูลหลักสำหรับจัดการการส่งต่อเอกสาร
* **หน้าที่:** จัดการแม่แบบการส่งต่อและการส่งต่อจริง
* **Entities:**
  * CorrespondenceRoutingTemplate
  * CorrespondenceRoutingTemplateStep
  * CorrespondenceRouting
* **Features:**
  * สร้างและจัดการแม่แบบการส่งต่อ
  * ดำเนินการส่งต่อเอกสารตามแม่แบบ
  * ติดตามสถานะการส่งต่อ
  * คำนวณวันครบกำหนดอัตโนมัติ
  * ส่งการแจ้งเตือนเมื่อมีการส่งต่อใหม่

#### 3.5.15 **WorkflowEngineModule:**

* **สถานะ:** Internal Module สำหรับจัดการ workflow logic
* **หน้าที่:** ประมวลผล state transitions และ business rules
* **Features:**
  * State machine สำหรับสถานะเอกสาร
  * Validation rules สำหรับการเปลี่ยนสถานะ
  * Automatic status updates
  * Deadline management และ escalation

### 3.5.16 **JsonSchemaModule:**

* **สถานะ:** Internal Module สำหรับจัดการ JSON schemas
* **หน้าที่:** Validate, transform, และ manage JSON data structures
* **Features:**
  * JSON schema validation ด้วย AJV
  * Schema versioning และ migration
  * Dynamic schema generation
  * Data transformation และ sanitization

### 3.5.17 **DetailsService:**

* **สถานะ:** Shared Service สำหรับจัดการ details fields
* **หน้าที่:** Centralized service สำหรับ JSON details operations
* **Methods:**
  * validateDetails(type: string, data: any): ValidationResult
  * transformDetails(input: any, targetVersion: string): any
  * sanitizeDetails(data: any): any
  * getDefaultDetails(type: string): any

### **3.6 สถาปัตยกรรมระบบ (System Architecture)**

โครงสร้างโมดูล (Module Structure)

```bash
📁 src
├── 📄 app.module.ts
├── 📄 main.ts
├── 📁 common                    # @app/common (โมดูลส่วนกลาง)
│   ├── 📁 auth                  # AuthModule (JWT, Guards)
│   ├── 📁 config                # Configuration
│   ├── 📁 decorators            # Custom Decorators (เช่น @RequirePermission)
│   ├── 📁 entities              # Shared Entities (User, Role, Permission)
│   ├── 📁 exceptions            # Global Exception Filters
│   ├── 📁 file-storage          # FileStorageService (Virus Scanning, Security)
│   ├── 📁 guards                # Custom Guards (RBAC Guard, RateLimitGuard)
│   ├── 📁 interceptors          # Interceptors (Audit Log, Transform, Performance)
│   ├── 📁 resilience            # Circuit Breaker, Retry Patterns
│   └── 📁 services              # Shared Services (NotificationService, CachingService)
├── 📁 modules
│   ├── 📁 user                  # UserModule (จัดการ Users, Roles, Permissions)
│   ├── 📁 project               # ProjectModule (จัดการ Projects, Organizations, Contracts)
│   ├── 📁 correspondence        # CorrespondenceModule (จัดการเอกสารโต้ตอบ)
│   ├── 📁 rfa                   # RfaModule (จัดการเอกสารขออนุมัติ)
│   ├── 📁 drawing               # DrawingModule (จัดการแบบแปลน)
│   ├── 📁 circulation           # CirculationModule (จัดการใบเวียน)
│   ├── 📁 transmittal           # TransmittalModule (จัดการเอกสารนำส่ง)
│   ├── 📁 search                # SearchModule (ค้นหาขั้นสูงด้วย Elasticsearch)
│   ├── 📁 monitoring            # MonitoringModule (Metrics, Health Checks)
│   └── 📁 document-numbering    # DocumentNumberingModule (Internal Module)
└── 📁 database                  # Database Migration & Seeding Scripts
```

### **3.7 กลยุทธ์ความทนทานและการจัดการข้อผิดพลาด (Resilience & Error Handling Strategy)**

* **2.10.1 Circuit Breaker Pattern:** ใช้สำหรับ external service calls (Email, LINE, Elasticsearch)
* **2.10.2 Retry Mechanism:** ด้วย exponential backoff สำหรับ transient failures
* **2.10.3 Fallback Strategies:** Graceful degradation เมื่อบริการภายนอกล้มเหลว
* **2.10.4 Error Handling:** Error messages ต้องไม่เปิดเผยข้อมูล sensitive
* **2.10.5 Monitoring:** Centralized error monitoring และ alerting system

### **3.8 FileStorageService (ปรับปรุงใหม่):**

* **Virus Scanning:** Integrate ClamAV สำหรับ scan ไฟล์ที่อัปโหลดทั้งหมด
* **File Type Validation:** ใช้ white-list approach (PDF, DWG, DOCX, XLSX, ZIP)
* **File Size Limits:** 50MB ต่อไฟล์
* **Security Measures:**
  * เก็บไฟล์นอก web root
  * Download ผ่าน authenticated endpoint เท่านั้น
  * Download links มี expiration time (24 ชั่วโมง)
  * File integrity checks (checksum)
  * Access control checks ก่อนดาวน์โหลด

### **3.9 เเทคโนโลยีที่ใช้ (Technology Stack)**

| ส่วน | Library/Tool | หมายเหตุ |
|---|---|---|
| **Framework** | `@nestjs/core`, `@nestjs/common` | Core Framework |
| **Language** | `TypeScript` | ใช้ TypeScript ทั้งระบบ |
| **Database** | `MariaDB 10.11` | ฐานข้อมูลหลัก |
| **ORM** | `@nestjs/typeorm`, `typeorm` | 🗃️จัดการการเชื่อมต่อและ Query ฐานข้อมูล |
| **Validation** | `class-validator`, `class-transformer` | 📦ตรวจสอบและแปลงข้อมูลใน DTO |
| **Auth** | `@nestjs/jwt`, `@nestjs/passport`, `passport-jwt` | 🔐การยืนยันตัวตนด้วย JWT |
|**Authorization** | `casl` | 🔐จัดการสิทธิ์แบบ RBAC |
| **File Upload** | `multer` | 📁จัดการการอัปโหลดไฟล์ |
| **Search** | `@nestjs/elasticsearch` | 🔍สำหรับการค้นหาขั้นสูง |
| **Notification** | `nodemailer` | 📬ส่งอีเมลแจ้งเตือน |
| **Scheduling** | `@nestjs/schedule` | 📬สำหรับ Cron Jobs (เช่น แจ้งเตือน Deadline) |
| **Logging** | `winston` | 📊บันทึก Log ที่มีประสิทธิภาพ |
| **Testing** | `@nestjs/testing`, `jest`, `supertest` | 🧪ทดสอบ Unit, Integration และ E2E |
| **Documentation** | `@nestjs/swagger` | 🌐สร้าง API Documentation อัตโนมัติ |
| **Security** | `helmet`, `rate-limiter-flexible` | 🛡️เพิ่มความปลอดภัยให้ API |
| **Resilience** | `@nestjs/circuit-breaker` | 🔄 Circuit breaker pattern |
| **Caching** | `@nestjs/cache-manager`, `cache-manager-redis-store` | 💾 Distributed caching |
| **Security** | `helmet`, `csurf`, `rate-limiter-flexible` | 🛡️ Security enhancements |
| **Validation** | `class-validator`, `class-transformer` | ✅ Input validation |
| **Monitoring** | `@nestjs/monitoring`, `winston` | 📊 Application monitoring |
| **File Processing** | `clamscan` | 🦠 Virus scanning |
| **Cryptography** | `bcrypt`, `crypto` | 🔐 Password hashing และ checksums |
| **JSON Validation** | `ajv`, `ajv-formats` | 🎯 JSON schema validation |
| **JSON Processing** | `jsonpath`, `json-schema-ref-parser` | 🔧 JSON manipulation |
| **Data Transformation** | `class-transformer` | 🔄 Object transformation |
| **Compression** | `compression` | 📦 JSON compression |

เราจะแบ่งการทดสอบเป็น 3 ระดับ โดยใช้ **Jest** และ @nestjs/testing:

* **Unit Tests (การทดสอบหน่วยย่อย):**
  * **เป้าหมาย:** ทดสอบ Logic ภายใน Service, Guard, หรือ Pipe โดยจำลอง (Mock) Dependencies ทั้งหมด
  * **สิ่งที่ต้องทดสอบ:** Business Logic (เช่น การเปลี่ยนสถานะ Workflow, การตรวจสอบ Deadline) [cite: 2.9.1], ตรรกะการตรวจสอบสิทธิ์ (Auth Guard) ทั้ง 4 ระดับ
* **Integration Tests (การทดสอบการบูรณาการ):**
  * **เป้าหมาย:** ทดสอบการทำงานร่วมกันของ Controller -> Service -> Repository (Database)
  * **เทคนิค:** ใช้ **Test Database แยกต่างหาก** (ห้ามใช้ Dev DB) และใช้ supertest เพื่อยิง HTTP Request จริงไปยัง App
  * **สิ่งที่ต้องทดสอบ:** การเรียก document numbering service, และการทำงานของ Views (เช่น v_user_tasks)
* **E2E (End-to-End) Tests:**
  * **เป้าหมาย:** ทดสอบ API Contract ว่า Response Body Shape ตรงตามเอกสาร Swagger เพื่อรับประกันทีม Frontend

### **3.10 Security Testing:**

* **Penetration Testing:** ทดสอบ OWASP Top 10 vulnerabilities
* **Security Audit:** Review code สำหรับ security flaws
* **Virus Scanning Test:** ทดสอบ file upload security
* **Rate Limiting Test:** ทดสอบ rate limiting functionality

### **3.11 Performance Testing:**

* **Load Testing:** ทดสอบด้วย realistic workloads
* **Stress Testing:** หา breaking points ของระบบ
* **Endurance Testing:** ทดสอบการทำงานต่อเนื่องเป็นเวลานาน

### 🗄️**3.12 Backend State Management**

Backend (NestJS) ควรเป็น **Stateless** (ไม่เก็บสถานะ) "State" ทั้งหมดจะถูกจัดเก็บใน MariaDB

* **Request-Scoped State (สถานะภายใน Request เดียว):**
  * **ปัญหา:** จะส่งต่อข้อมูล (เช่น User ที่ล็อกอิน) ระหว่าง Guard และ Service ใน Request เดียวกันได้อย่างไร?
  * **วิธีแก้:** ใช้ **Request-Scoped Providers** ของ NestJS (เช่น AuthContextService) เพื่อเก็บข้อมูล User ปัจจุบันที่ได้จาก AuthGuard และให้ Service อื่น Inject ไปใช้
* **Application-Scoped State (การ Caching):**
  * **ปัญหา:** ข้อมูล Master (เช่น roles, permissions, organizations) ถูกเรียกใช้บ่อย
  * **วิธีแก้:** ใช้ **Caching** (เช่น @nestjs/cache-manager) เพื่อ Caching ข้อมูลเหล่านี้ และลดภาระ Database

### **3.13 Caching Strategy (ตามข้อ 6.4.2):**

* **Master Data Cache:** Roles, Permissions, Organizations (TTL: 1 hour)
* **User Session Cache:** User permissions และ profile (TTL: 30 minutes)
* **Search Result Cache:** Frequently searched queries (TTL: 15 minutes)
* **File Metadata Cache:** Attachment metadata (TTL: 1 hour)
* **Cache Invalidation:** Clear cache on update/delete operations

### **3.14 การไหลของข้อมูล (Data Flow)**

#### **3.14.1 Main Flow:**

  1. Request: ผ่าน Nginx Proxy Manager -> NestJS Controller
  2. **Rate Limiting:** RateLimitGuard ตรวจสอบ request limits
  3. **Input Validation:** Validation Pipe ตรวจสอบและ sanitize inputs
  4. Authentication: JWT Guard ตรวจสอบ Token และดึงข้อมูล User
  5. Authorization: RBAC Guard ตรวจสอบสิทธิ์
  6. **Security Checks:** Virus scanning (สำหรับ file upload), XSS protection
  7. Business Logic: Service Layer ประมวลผลตรรกะทางธุรกิจ
  8. **Resilience:** Circuit breaker และ retry logic สำหรับ external calls
  9. Data Access: Repository Layer ติดต่อกับฐานข้อมูล
  10. **Caching:** Cache frequently accessed data
  11. **Audit Log:** บันทึกการกระทำสำคัญ
  12. Response: ส่งกลับไปยัง Frontend

#### **3.14.2 Workflow Data Flow:**

  1. User สร้างเอกสาร → เลือก routing template
  2. System สร้าง routing instances ตาม template
  3. สำหรับแต่ละ routing step:
    - กำหนด due date (จาก expected_days)
    - ส่ง notification ไปยังองค์กรผู้รับ
    - อัพเดทสถานะเป็น SENT
  4. เมื่อองค์กรผู้รับดำเนินการ:
    - อัพเดทสถานะเป็น ACTIONED/FORWARDED/REPLIED
    - บันทึก processed_by และ processed_at
    - ส่ง notification ไปยังขั้นตอนต่อไป (ถ้ามี)
  5. เมื่อครบทุกขั้นตอน → อัพเดทสถานะเอกสารเป็น COMPLETED

#### **3.14.3 JSON Details Processing Flow:**

  1. **Receive Request** → Get JSON data from client
  2. **Schema Validation** → Validate against predefined schema
  3. **Data Sanitization** → Sanitize and transform data
  4. **Version Check** → Handle schema version compatibility
  5. **Storage** → Store validated JSON in database
  6. **Retrieval** → Retrieve and transform on demand

### 📊**3.15 Monitoring & Observability (ตามข้อ 6.8)**

#### **Application Monitoring:**

* **Health Checks:** `/health` endpoint สำหรับ load balancer
* **Metrics Collection:** Response times, error rates, throughput
* **Distributed Tracing:** สำหรับ request tracing across services
* **Log Aggregation:** Structured logging ด้วย JSON format
* **Alerting:** สำหรับ critical errors และ performance degradation

#### **Business Metrics:**

* จำนวน documents created ต่อวัน
* Workflow completion rates
* User activity metrics
* System utilization rates
* Search query performance

#### **Performance Targets:**

* API Response Time: < 200ms (90th percentile)
* Search Query Performance: < 500ms
* File Upload Performance: < 30 seconds สำหรับไฟล์ 50MB
* Cache Hit Ratio: > 80%

## 🖥️**4. ฟรอนต์เอนด์ (NextJS / React / UI) (Frontend (NextJS / React / UI))**

**โปรไฟล์นักพัฒนา (Developer Profile:** วิศวกร TypeScript + React/NextJS ระดับ Senior
เชี่ยวชาญ TailwindCSS, Shadcn/UI, และ Radix สำหรับการพัฒนา UI

### **4.1 แนวทางการพัฒนาโค้ด (Code Implementation Guidelines)**

* ใช้ **early returns** เพื่อความชัดเจน
* ใช้คลาสของ **TailwindCSS** ในการกำหนดสไตล์เสมอ
* ควรใช้ class: syntax แบบมีเงื่อนไข (หรือ utility clsx) มากกว่าการใช้ ternary operators ใน class strings
* ใช้ **const arrow functions** สำหรับ components และ handlers
* Event handlers ให้ขึ้นต้นด้วย handle... (เช่น handleClick, handleSubmit)
* รวมแอตทริบิวต์สำหรับการเข้าถึง (accessibility) ด้วย:
  tabIndex="0", aria-label, onKeyDown, ฯลฯ
* ตรวจสอบให้แน่ใจว่าโค้ดทั้งหมด **สมบูรณ์**, **ผ่านการทดสอบ**, และ **ไม่ซ้ำซ้อน (DRY)**
* ต้อง import โมดูลที่จำเป็นต้องใช้อย่างชัดเจนเสมอ

### **4.2 UI/UX ด้วย React**

* ใช้ **semantic HTML**
* ใช้คลาสของ **Tailwind** ที่รองรับ responsive (sm:, md:, lg:)
* รักษาลำดับชั้นของการมองเห็น (visual hierarchy) ด้วยการใช้ typography และ spacing
* ใช้ **Shadcn** components (Button, Input, Card, ฯลฯ) เพื่อ UI ที่สอดคล้องกัน
* ทำให้ components มีขนาดเล็กและมุ่งเน้นการทำงานเฉพาะอย่าง
* ใช้ utility classes สำหรับการจัดสไตล์อย่างรวดเร็ว (spacing, colors, text, ฯลฯ)
* ตรวจสอบให้แน่ใจว่าสอดคล้องกับ **ARIA** และใช้ semantic markup

### **4.3 การตรวจสอบฟอร์มและข้อผิดพลาด (Form Validation & Errors)**

* ใช้ไลบรารีฝั่ง client เช่น zod และ react-hook-form
* แสดงข้อผิดพลาดด้วย **alert components** หรือข้อความ inline
* ต้องมี labels, placeholders, และข้อความ feedback

### **🧪4.4 Frontend Testing**

เราจะใช้ **React Testing Library (RTL)** สำหรับการทดสอบ Component และ **Playwright** สำหรับ E2E:

* **Unit Tests (การทดสอบหน่วยย่อย):**
  * **เครื่องมือ:** Vitest + RTL
  * **เป้าหมาย:** ทดสอบ Component ขนาดเล็ก (เช่น Buttons, Inputs) หรือ Utility functions
* **Integration Tests (การทดสอบการบูรณาการ):**
  * **เครื่องมือ:** RTL + **Mock Service Worker (MSW)**
  * **เป้าหมาย:** ทดสอบว่า Component หรือ Page ทำงานกับ API (ที่จำลองขึ้น) ได้ถูกต้อง
  * **เทคนิค:** ใช้ MSW เพื่อจำลอง NestJS API และทดสอบว่า Component แสดงผลข้อมูลจำลองได้ถูกต้องหรือไม่ (เช่น ทดสอบหน้า Dashboard [cite: 5.3] ที่ดึงข้อมูลจาก v_user_tasks)
* **E2E (End-to-End) Tests:**
  * **เครื่องมือ:** **Playwright**
  * **เป้าหมาย:** ทดสอบ User Flow ทั้งระบบโดยอัตโนมัติ (เช่น ล็อกอิน -> สร้าง RFA -> ตรวจสอบ Workflow Visualization [cite: 5.6])

### **🗄️4.5 Frontend State Management**

สำหรับ Next.js App Router เราจะแบ่ง State เป็น 4 ระดับ:

1. **Local UI State (สถานะ UI ชั่วคราว):**
   * **เครื่องมือ:** useState, useReducer
   * **ใช้เมื่อ:** จัดการสถานะเล็กๆ ที่จบใน Component เดียว (เช่น Modal เปิด/ปิด, ค่าใน Input)
2. **Server State (สถานะข้อมูลจากเซิร์ฟเวอร์):**
   * **เครื่องมือ:** **React Query (TanStack Query)** หรือ SWR
   * **ใช้เมื่อ:** จัดการข้อมูลที่ดึงมาจาก NestJS API (เช่น รายการ correspondences, rfas, drawings)
   * **ทำไม:** React Query เป็น "Cache" ที่จัดการ Caching, Re-fetching, และ Invalidation ให้โดยอัตโนมัติ
3. **Global Client State (สถานะส่วนกลางฝั่ง Client):**
   * **เครื่องมือ:** **Zustand** (แนะนำ) หรือ Context API
   * **ใช้เมื่อ:** จัดการข้อมูลที่ต้องใช้ร่วมกันทั่วทั้งแอป และ *ไม่ใช่* ข้อมูลจากเซิร์ฟเวอร์ (เช่น ข้อมูล User ที่ล็อกอิน, สิทธิ์ Permissions)
4. **Form State (สถานะของฟอร์ม):**
   * **เครื่องมือ:** **React Hook Form** + **Zod**
   * **ใช้เมื่อ:** จัดการฟอร์มที่ซับซ้อน (เช่น ฟอร์มสร้าง RFA, ฟอร์ม Circulation [cite: 3.7])

## 🔗**5. แนวทางการบูรณาการ Full Stack (Full Stack Integration Guidelines)**

| Aspect (แง่มุม) | Backend (NestJS) | Frontend (NextJS) | UI Layer (Tailwind/Shadcn) |
| :---- | :---- | :---- | :---- |
| API | REST / GraphQL Controllers | API hooks ผ่าน fetch/axios/SWR | Components ที่รับข้อมูล |
| Validation (การตรวจสอบ) | class-validator DTOs | zod / react-hook-form | สถานะของฟอร์ม/input ใน Shadcn |
| Auth (การยืนยันตัวตน) | Guards, JWT | NextAuth / cookies | สถานะ UI ของ Auth (loading, signed in) |
| Errors (ข้อผิดพลาด) | Global filters | Toasts / modals | Alerts / ข้อความ feedback |
| Testing (การทดสอบ) | Jest (unit/e2e) | Vitest / Playwright | Visual regression |
| Styles (สไตล์) | Scoped modules (ถ้าจำเป็น) | Tailwind / Shadcn | Tailwind utilities |
| Accessibility (การเข้าถึง) | Guards + filters | ARIA attributes | Semantic HTML |

## 🗂️**6. ข้อตกลงเฉพาะสำหรับ DMS (LCBP3-DMS)**

ส่วนนี้ขยายแนวทาง FullStackJS ทั่วไปสำหรับโปรเจกต์ **LCBP3-DMS** โดยมุ่งเน้นไปที่เวิร์กโฟลว์การอนุมัติเอกสาร (Correspondence, RFA, Drawing, Contract, Transmittal, Circulation)

### 🧩**6.1 RBAC และการควบคุมสิทธิ์ (RBAC & Permission Control)**

ใช้ Decorators เพื่อบังคับใช้สิทธิ์การเข้าถึง โดยอ้างอิงสิทธิ์จากตาราง permissions

```typescript
@RequirePermission('rfas.respond') // ต้องตรงกับ 'permission_code'
@Put(':id')
updateRFA(@Param('id') id: string) {
  return this.rfaService.update(id);
}
```

#### **6.1.1 Roles (บทบาท)**

* **Superadmin**: ไม่มีข้อจำกัดใดๆ [cite: 4.3]
* **Admin**: มีสิทธิ์เต็มที่ในองค์กร [cite: 4.3]
* **Document Control**: เพิ่ม/แก้ไข/ลบ เอกสารในองค์กร [cite: 4.3]
* **Editor**: สามารถ เพิ่ม/แก้ไข เอกสารที่กำหนด [cite: 4.3]
* **Viewer**: สามารถดู เอกสาร [cite: 4.3]

#### **6.1.2 ตัวอย่าง Permissions (จากตาราง permissions)**

* rfas.view, rfas.create, rfas.respond, rfas.delete
* drawings.view, drawings.upload, drawings.delete
* corr.view, corr.manage
* transmittals.manage
* cirs.manage
* project_parties.manage

การจับคู่ระหว่าง roles และ permissions **เริ่มต้น** จะถูก seed ผ่านสคริปต์ (ดังที่เห็นในไฟล์ SQL)**อย่างไรก็ตาม AuthModule/UserModule ต้องมี API สำหรับ Admin เพื่อสร้าง Role ใหม่และกำหนดสิทธิ์ (Permissions) เพิ่มเติมได้ในภายหลัง** [cite: 4.3]

### 🧾**6.2 มาตรฐาน AuditLog (AuditLog Standard)**

บันทึกการดำเนินการ CRUD และการจับคู่ทั้งหมดลงในตาราง audit_logs

| Field (ฟิลด์) | Type (จาก SQL) | Description (คำอธิบาย) |
| :---- | :---- | :---- |
| audit_id | BIGINT | Primary Key |
| user_id | INT | ผู้ใช้ที่ดำเนินการ (FK -> users) |
| action | VARCHAR(100) | rfa.create, correspondence.update, login.success |
| entity_type | VARCHAR(50) | ชื่อตาราง/โมดูล เช่น 'rfa', 'correspondence' |
| entity_id | VARCHAR(50) | Primary ID ของระเบียนที่ได้รับผลกระทบ |
| details_json | JSON | ข้อมูลบริบท (เช่น ฟิลด์ที่มีการเปลี่ยนแปลง) |
| ip_address | VARCHAR(45) | IP address ของผู้ดำเนินการ |
| user_agent | VARCHAR(255) | User Agent ของผู้ดำเนินการ |
| created_at | TIMESTAMP | Timestamp (UTC) |

### 📂**6.3 การจัดการไฟล์ (File Handling)**

#### **6.3.1 มาตรฐานการอัปโหลดไฟล์ (File Upload Standard)**

* **Security-First Approach:** การอัปโหลดไฟล์ทั้งหมดจะถูกจัดการโดย FileStorageService ที่มี security measures ครบถ้วน
* ไฟล์จะถูกเชื่อมโยงไปยัง Entity ที่ถูกต้องผ่าน **ตารางเชื่อม (Junction Tables)** เท่านั้น:
  * correspondence_attachments (เชื่อม Correspondence กับ Attachments)
  * circulation_attachments (เชื่อม Circulation กับ Attachments)
  * shop_drawing_revision_attachments (เชื่อม Shop Drawing Revision กับ Attachments)
  * contract_drawing_attachments (เชื่อม Contract Drawing กับ Attachments)
* เส้นทางจัดเก็บไฟล์ (Upload path): อ้างอิงจาก Requirement 2.1 คือ /share/dms-data [cite: 2.1] โดย FileStorageService จะสร้างโฟลเดอร์ย่อยแบบรวมศูนย์ (เช่น /share/dms-data/uploads/{YYYY}/{MM}/[stored_filename])
* ประเภทไฟล์ที่อนุญาต: pdf, dwg, docx, xlsx, zip (ผ่าน white-list validation)
* ขนาดสูงสุด: **50 MB**
* จัดเก็บนอก webroot
* ให้บริการไฟล์ผ่าน endpoint ที่ปลอดภัย /files/:attachment_id/download

#### **6.3.2 Security Controls สำหรับ File Access:**

การเข้าถึงไฟล์ไม่ใช่การเข้าถึงโดยตรง endpoint /files/:attachment_id/download จะต้อง:

1. ค้นหาระเบียน attachment
2. ตรวจสอบว่า attachment_id นี้ เชื่อมโยงกับ Entity ใด (เช่น correspondence, circulation, shop_drawing_revision, contract_drawing) ผ่านตารางเชื่อม
3. ตรวจสอบว่าผู้ใช้มีสิทธิ์ (permission) ในการดู Entity ต้นทางนั้นๆ หรือไม่
4. ตรวจสอบ download token expiration (24 ชั่วโมง)
5. บันทึก audit log การดาวน์โหลด

### 🔟**6.4 การจัดการเลขที่เอกสาร (Document Numbering) [cite: 3.10]**

* **เป้าหมาย:** สร้างเลขที่เอกสาร (เช่น correspondence_number) โดยอัตโนมัติ ตามรูปแบบที่กำหนด
* **ตรรกะการนับ:** การนับ Running number (SEQ) จะนับแยกตาม Key: **Project + Originator Organization + Document Type + Year**
* **ตาราง SQL:**
  * document_number_formats: Admin ใช้กำหนด "รูปแบบ" (Template) ของเลขที่ (เช่น {ORG_CODE}-{TYPE_CODE}-{YEAR_SHORT}-{SEQ:4}) โดยกำหนดตาม **Project** และ **Document Type** [cite: 4.5]
  * document_number_counters: ระบบใช้เก็บ "ตัวนับ" ล่าสุดของ Key (Project+Org+Type+Year)
* **การทำงาน (Backend):**
  * DocumentNumberingModule จะให้บริการ DocumentNumberingService
  * เมื่อ CorrespondenceModule ต้องการสร้างเอกสารใหม่, มันจะเรียก documentNumberingService.generateNextNumber(...)
  * Service นี้จะใช้ **Redis distributed locking** แทน stored procedure ซึ่งจะจัดการ Database Transaction และ Row Locking ภายใน Application Layer เพื่อรับประกันการป้องกัน Race Condition
  * มี retry mechanism และ fallback strategies

### 📊**6.5 การรายงานและการส่งออก (Reporting & Exports)**

#### **5.8.1 วิวสำหรับการรายงาน (Reporting Views) (จาก SQL)**

การรายงานควรสร้างขึ้นจาก Views ที่กำหนดไว้ล่วงหน้าในฐานข้อมูลเป็นหลัก:

* v_current_correspondences: สำหรับ revision ปัจจุบันทั้งหมดของเอกสารที่ไม่ใช่ RFA
* v_current_rfas: สำหรับ revision ปัจจุบันทั้งหมดของ RFA และข้อมูล master
* v_contract_parties_all: สำหรับการตรวจสอบความสัมพันธ์ของ project/contract/organization
* v_user_tasks: สำหรับ Dashboard "งานของฉัน"
* v_audit_log_details: สำหรับ Activity Feed

Views เหล่านี้ทำหน้าที่เป็นแหล่งข้อมูลหลักสำหรับการรายงานฝั่งเซิร์ฟเวอร์และการส่งออกข้อมูล

#### **5.8.2 กฎการส่งออก (Export Rules)**

* Export formats: CSV, Excel, PDF.
* จัดเตรียมมุมมองสำหรับพิมพ์ (Print view).
* รวมลิงก์ไปยังต้นทาง (เช่น /rfas/:id).

## 🧮**7. ฟรอนต์เอนด์: รูปแบบ DataTable และฟอร์ม (Frontend: DataTable & Form Patterns)**

### **7.1 DataTable (Server‑Side)**

* Endpoint: /api/{module}?page=1&pageSize=20&sort=...&filter=...
* ต้องรองรับ: การแบ่งหน้า (pagination), การเรียงลำดับ (sorting), การค้นหา (search), การกรอง (filters)
* แสดง revision ล่าสุดแบบ inline เสมอ (สำหรับ RFA/Drawing)

### **7.2 มาตรฐานฟอร์ม (Form Standards)**

* ต้องมีการใช้งาน Dropdowns แบบขึ้นต่อกัน (Dependent dropdowns) (ตามที่สคีมารองรับ):
  * Project → Contract Drawing Volumes
  * Contract Drawing Category → Sub-Category
  * RFA (ประเภท Shop Drawing) → Shop Drawing Revisions ที่เชื่อมโยงได้
* **File Upload Security:** ต้องรองรับ **Multi-file upload (Drag-and-Drop)** [cite: 5.7] พร้อม virus scanning feedback
* **File Type Indicators:** UI ต้องอนุญาตให้ผู้ใช้กำหนดว่าไฟล์ใดเป็น **"เอกสารหลัก"** หรือ "เอกสารแนบประกอบ" [cite: 5.7] พร้อมแสดง file type icons
* **Security Feedback:** แสดง security warnings สำหรับ file types ที่เสี่ยงหรือ files ที่ fail virus scan
* ส่ง (Submit) ผ่าน API พร้อม feedback แบบ toast

### **7.3 ข้อกำหนด Component เฉพาะ (Specific UI Requirements)**

* **Dashboard - My Tasks:** ต้องพัฒนา Component ตาราง "งานของฉัน" (My Tasks)ซึ่งดึงข้อมูลงานที่ผู้ใช้ล็อกอินอยู่ต้องรับผิดชอบ (Main/Action) จาก v_user_tasks [cite: 5.3]
* **Workflow Visualization:** ต้องพัฒนา Component สำหรับแสดงผล Workflow (โดยเฉพาะ RFA)ที่แสดงขั้นตอนทั้งหมดเป็นลำดับ โดยขั้นตอนปัจจุบัน (active) เท่านั้นที่ดำเนินการได้ และขั้นตอนอื่นเป็น disabled [cite: 5.6] ต้องมีตรรกะสำหรับ Admin ในการ override หรือย้อนกลับขั้นตอนได้ [cite: 5.6]
* **Admin Panel:** ต้องมีหน้า UI สำหรับ Superadmin/Admin เพื่อจัดการข้อมูลหลัก (Master Data [cite: 4.5]), การเริ่มต้นใช้งาน (Onboarding [cite: 4.6]), และ **รูปแบบเลขที่เอกสาร (Numbering Formats [cite: 3.10])**
* **Security Dashboard:** แสดง security metrics และ audit logs สำหรับ administrators

## 🧭**8. แดชบอร์ดและฟีดกิจกรรม (Dashboard & Activity Feed)**

### **8.1 การ์ดบนแดชบอร์ด (Dashboard Cards)**

* แสดง Correspondences, RFAs, Circulations, Shop Drawing Revision ล่าสุด
* รวมสรุป KPI (เช่น "RFAs ที่รอการอนุมัติ", "Shop Drawing ที่รอการอนุมัติ") [cite: 5.3]
* รวมลิงก์ด่วนไปยังโมดูลต่างๆ
* **Security Metrics:** แสดงจำนวน files scanned, security incidents, failed login attempts

### **8.2 ฟีดกิจกรรม (Activity Feed)**

* แสดงรายการ v_audit_log_details ล่าสุด (10 รายการ) ที่เกี่ยวข้องกับผู้ใช้
* รวม security-related activities (failed logins, permission changes)

```typescript
// ตัวอย่าง API response
[
  { user: 'editor01', action: 'Updated RFA (LCBP3-RFA-001)', time: '2025-11-04T09:30Z' },
  { user: 'system', action: 'Virus scan completed - 0 threats found', time: '2025-11-04T09:25Z' }
]
```

## 🛡️**9. ข้อกำหนดที่ไม่ใช่ฟังก์ชันการทำงาน (Non-Functional Requirements)**

ส่วนนี้สรุปข้อกำหนด Non-Functional จาก requirements.md เพื่อให้ทีมพัฒนาทาน

* **Audit Log [cite: 6.1]:** ทุกการกระทำที่สำคัญ (C/U/D) ต้องถูกบันทึกใน audit_logs
* **Performance [cite: 6.4]:** ต้องใช้ Caching สำหรับข้อมูลที่เรียกบ่อย และใช้ Pagination
* **Security [cite: 6.5]:** ต้องมี Rate Limiting และจัดการ Secret ผ่าน docker-compose.yml (ไม่ใช่ .env)
* **File Security [cite: 3.9.6]:** ต้องมี virus scanning, file type validation, access controls
* **Resilience [cite: 6.5.3]:** ต้องมี circuit breaker, retry mechanisms, graceful degradation
* **Backup & Recovery [cite: 6.6]:** ต้องมีแผนสำรองข้อมูลทั้ง Database (MariaDB) และ File Storage (/share/dms-data) อย่างน้อยวันละ 1 ครั้ง
* **Notification Strategy [cite: 6.7]:** ระบบแจ้งเตือน (Email/Line) ต้องถูก Trigger เมื่อมีเอกสารใหม่ส่งถึง, มีการมอบหมายงานใหม่ (Circulation), หรือ (ทางเลือก) เมื่องานเสร็จ/ใกล้ถึงกำหนด
* **Monitoring [cite: 6.8]:** ต้องมี health checks, metrics collection, alerting

## ✅**10. มาตรฐานที่นำไปใช้แล้ว (จาก SQL v1.4.0) (Implemented Standards (from SQL v1.4.0))**

ส่วนนี้ยืนยันว่าแนวทางปฏิบัติที่ดีที่สุดต่อไปนี้เป็นส่วนหนึ่งของการออกแบบฐานข้อมูลอยู่แล้ว และควรถูกนำไปใช้ประโยชน์ ไม่ใช่สร้างขึ้นใหม่

* ✅ **Soft Delete:** นำไปใช้แล้วผ่านคอลัมน์ deleted_at ในตารางสำคัญ (เช่น correspondences, rfas, project_parties) ตรรกะการดึงข้อมูลต้องกรอง deleted_at IS NULL
* ✅ **Database Indexes:** สคีมาได้มีการทำ index ไว้อย่างหนักหน่วงบน foreign keys และคอลัมน์ที่ใช้ค้นหาบ่อย (เช่น idx_rr_rfa, idx_cor_project, idx_cr_is_current) เพื่อประสิทธิภาพ
* ✅ **โครงสร้าง RBAC:** มีระบบ users, roles, permissions, user_roles, และ user_project_roles ที่ครอบคลุมอยู่แล้ว
* ✅ **Data Seeding:** ข้อมูล Master (roles, permissions, organization_roles, initial users, project parties) ถูกรวมอยู่ในสคริปต์สคีมาแล้ว
* ✅ **Application-level Locking:** ใช้ Redis distributed lock แทน stored procedure
* ✅ **File Security:** Virus scanning, file type validation, access control
* ✅ **Resilience Patterns:** Circuit breaker, retry, fallback mechanisms
* ✅ **Security Measures:** Input validation, rate limiting, security headers
* ✅ **Monitoring:** Health checks, metrics collection, distributed tracing

## **11. ตัวอย่าง Implementation Details**

* **Permission Hierarchy Logic:**

```typescript
@Injectable()
export class RbacGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermission = this.getRequiredPermission(context);
    const user = this.getUser(context);
    const resourceContext = this.getResourceContext(context);

    // Check permissions in hierarchy order
    return await this.checkPermissions(user, requiredPermission, resourceContext);
  }

  private async checkPermissions(user: User, permission: string, context: any) {
    // 1. Check Global permissions
    if (await this.hasGlobalPermission(user, permission)) return true;

    // 2. Check Organization permissions
    if (await this.hasOrganizationPermission(user, permission, context.organizationId)) return true;

    // 3. Check Project permissions  
    if (await this.hasProjectPermission(user, permission, context.projectId)) return true;

    // 4. Check Contract permissions
    if (await this.hasContractPermission(user, permission, context.contractId)) return true;

    return false;
  }
}
```

* **CorrespondenceRoutingService:**

```typescript
@Injectable()
export class CorrespondenceRoutingService {
  async initiateRouting(correspondenceId: number, templateId: number): Promise<void> {
    const correspondence = await this.getCorrespondence(correspondenceId);
    const template = await this.getTemplate(templateId);
    const steps = await this.getTemplateSteps(templateId);

    let currentDate = new Date();

    for (const step of steps.sort((a, b) => a.sequence - b.sequence)) {
      const dueDate = this.calculateDueDate(currentDate, step.expected_days);

      await this.createRoutingInstance({
        correspondence_id: correspondenceId,
        template_id: templateId,
        sequence: step.sequence,
        from_organization_id: correspondence.originator_id,
        to_organization_id: step.to_organization_id,
        step_purpose: step.step_purpose,
        status: step.sequence === 1 ? 'SENT' : 'PENDING',
        due_date: dueDate
      });

      // สำหรับขั้นตอนแรก ส่ง notification ทันที
      if (step.sequence === 1) {
        await this.notificationService.sendRoutingNotification(
          step.to_organization_id,
          correspondenceId,
          'NEW_ROUTING'
        );
      }

      currentDate = dueDate;
    }
  }

  async processRoutingStep(routingId: number, action: string, comments?: string): Promise<void> {
    const routing = await this.getRouting(routingId);
    const nextStep = await this.getNextStep(routing.correspondence_id, routing.sequence);

    // อัพเดทขั้นตอนปัจจุบัน
    await this.updateRoutingStatus(routingId, action, comments);

    // ถ้ามีขั้นตอนต่อไป ส่ง notification
    if (nextStep) {
      await this.advanceToNextStep(nextStep);
      await this.notificationService.sendRoutingNotification(
        nextStep.to_organization_id,
        routing.correspondence_id,
        'NEXT_STEP'
      );
    } else {
      // ถ้าไม่มีขั้นตอนต่อไป แสดงว่าเสร็จสิ้น
      await this.completeCorrespondence(routing.correspondence_id);
    }
  }
}
```

* **Frontend Components สำหรับ Routing:**

```typescript
// Routing Template Management
export const RoutingTemplateManager: React.FC = () => {
  // จัดการแม่แบบการส่งต่อ
};

// Routing Visualization
export const RoutingWorkflowVisualization: React.FC<{ correspondenceId: number }> = ({ correspondenceId }) => {
  // แสดงสถานะการส่งต่อเป็น workflow diagram
};

// Pending Routings List
export const PendingRoutingsList: React.FC = () => {
  // แสดงรายการ routing ที่รอดำเนินการ
};
```

* **JsonSchemaService Implementation**

```typescript

@Injectable()
export class JsonSchemaService {
  private ajv: Ajv;
  private schemas: Map<string, JsonSchemaDefinition> = new Map();

  constructor() {
    this.ajv = new Ajv({
      allErrors: true,
      strict: false,
      formats: {
        email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        date: /^\d{4}-\d{2}-\d{2}$/,
        datetime: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/
      }
    });

    this.registerPredefinedSchemas();
  }

  async validate(schemaId: string, data: any): Promise<ValidationResult> {
    const schema = this.getSchema(schemaId);
    if (!schema) {
      throw new Error(`Schema ${schemaId} not found`);
    }

    const isValid = this.ajv.validate(schema.schema, data);

    return {
      isValid,
      errors: this.ajv.errors || [],
      sanitizedData: isValid ? this.sanitizeData(data, schema) : undefined,
      warnings: this.generateWarnings(data, schema)
    };
  }

  private sanitizeData(data: any, schema: JsonSchemaDefinition): any {
    // Remove any properties not defined in schema
    const sanitized = {};
    Object.keys(schema.schema.properties || {}).forEach(key => {
      if (data.hasOwnProperty(key)) {
        sanitized[key] = data[key];
      } else if (schema.schema.properties[key].default !== undefined) {
        sanitized[key] = schema.schema.properties[key].default;
      }
    });
    return sanitized;
  }
}
```

* **Predefined Schemas**

```typescript
// schemas/correspondence-rfi.json
export const RFI_SCHEMA = {
  $schema: "http://json-schema.org/draft-07/schema#",
  type: "object",
  properties: {
    metadata: {
      type: "object",
      properties: {
        version: { type: "string", pattern: "^\\d+\\.\\d+$" },
        type: { type: "string", const: "RFI" },
        rfi_category: { 
          type: "string", 
          enum: ["TECHNICAL", "ADMINISTRATIVE", "SAFETY", "QUALITY"] 
        },
        urgency: { 
          type: "string", 
          enum: ["LOW", "NORMAL", "HIGH", "URGENT"],
          default: "NORMAL"
        }
      },
      required: ["version", "type"]
    },
    questions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          question_id: { type: "integer" },
          question_text: { type: "string", maxLength: 1000 },
          reference_drawing: { type: "string" },
          response_required: { type: "boolean", default: true },
          deadline: { type: "string", format: "datetime" }
        },
        required: ["question_id", "question_text"]
      },
      maxItems: 50
    }
  },
  required: ["metadata"],
  additionalProperties: false
};

```

* **DetailsService Integration**

```typescript
@Injectable()
export class CorrespondenceService {
  constructor(
    private readonly detailsService: DetailsService,
    private readonly jsonSchemaService: JsonSchemaService
  ) {}

  async createCorrespondence(dto: CreateCorrespondenceDto) {
    // Validate details against schema
    const validation = await this.jsonSchemaService.validate(
      `correspondence-${dto.correspondence_type_id}`,
      dto.details
    );

    if (!validation.isValid) {
      throw new BadRequestException({
        message: 'Invalid details structure',
        errors: validation.errors
      });
    }

    // Process and sanitize details
    const processedDetails = await this.detailsService.processDetails(
      `correspondence-${dto.correspondence_type_id}`,
      dto.details
    );

    const correspondence = this.correspondenceRepository.create({
      ...dto,
      details: processedDetails.sanitizedData
    });

    return await this.correspondenceRepository.save(correspondence);
  }
}

```

* **Frontend JSON Details Components**

```typescript
// React component สำหรับจัดการ JSON details
export const CorrespondenceDetailsForm: React.FC<{
  correspondenceType: string;
  initialData?: any;
  onChange: (data: any, isValid: boolean) => void;
}> = ({ correspondenceType, initialData, onChange }) => {
  const [formData, setFormData] = useState(initialData || {});
  const [errors, setErrors] = useState<string[]>([]);

  const schema = useJsonSchema(correspondenceType);

  const handleFieldChange = (fieldPath: string, value: any) => {
    const newData = set(formData, fieldPath, value);
    setFormData(newData);

    // Validate against schema
    const validation = validateAgainstSchema(schema, newData);
    setErrors(validation.errors);
    onChange(newData, validation.isValid);
  };

  return (
    <div className="json-details-form">
      {schema && (
        <JsonForm 
          schema={schema}
          data={formData}
          errors={errors}
          onChange={handleFieldChange}
        />
      )}
    </div>
  );
};
```

* **API Endpoints สำหรับ JSON Management**

```typescript
@Controller('json-schemas')
export class JsonSchemaController {
  @Get(':schemaId')
  async getSchema(@Param('schemaId') schemaId: string) {
    return this.jsonSchemaService.getSchema(schemaId);
  }

  @Post('validate/:schemaId')
  async validateData(
    @Param('schemaId') schemaId: string,
    @Body() data: any
  ) {
    return this.jsonSchemaService.validate(schemaId, data);
  }

  @Get('types/correspondence')
  async getCorrespondenceSchemas() {
    return this.jsonSchemaService.getSchemasByType('correspondence');
  }
}
```

* **Correspondence Revision Details**
  * Generic Correspondence Details

  ```typescript
  {
    "metadata": {
      "version": "1.0",
      "type": "CORRESPONDENCE",
      "created_at": "2024-01-15T10:30:00Z",
      "updated_at": "2024-01-15T10:30:00Z"
    },
    "content": {
      "subject": "เรื่องขออนุญาตดำเนินงาน",
      "description": "รายละเอียดเพิ่มเติมเกี่ยวกับเอกสาร",
      "priority": "HIGH",
      "confidentiality": "INTERNAL",
      "references": [
        {
          "type": "RELATED",
          "correspondence_id": 123,
          "description": "เอกสารเกี่ยวข้อง"
        }
      ]
    },
    "attachments_metadata": {
      "main_documents": [
        {
          "attachment_id": 456,
          "filename": "main_document.pdf",
         "description": "เอกสารหลัก"
       }
     ],
     "supporting_documents": [
       {
         "attachment_id": 457,
          "filename": "supporting_data.xlsx",
          "description": "ข้อมูลประกอบ"
       }
     ]
    }
  }
  ```

  * RFI (Request for Information) Details

  ```typescript
  {
   "metadata": {
     "version": "1.0",
     "type": "RFI",
     "rfi_category": "TECHNICAL",
     "urgency": "NORMAL"
   },
   "questions": [
     {
       "question_id": 1,
       "question_text": "ต้องการทราบรายละเอียด specification ของ material",
       "reference_drawing": "DRG-2024-001",
       "response_required": true,
       "deadline": "2024-01-25T17:00:00Z"
     },
     {
       "question_id": 2,
       "question_text": "ขอทราบวิธีการติดตั้ง",
       "response_required": false,
       "clarification_needed": true
     }
   ],
   "technical_details": {
     "discipline": "CIVIL",
     "related_drawings": ["DRG-2024-001", "DRG-2024-002"],
     "specification_references": ["SPEC-CIV-001", "SPEC-CIV-005"]
   }
  }
  ```

  * Transmittal Details

  ```typescript
  {
   "metadata": {
     "version": "1.0",
     "type": "TRANSMITTAL",
     "purpose": "FOR_APPROVAL",
     "transmittal_category": "SHOP_DRAWING"
   },
   "items": [
     {
       "item_number": 1,
       "correspondence_id": 123,
       "description": "Shop Drawing - Structural Plan",
       "revision": "A",
       "quantity": 3,
       "remarks": "สำหรับตรวจสอบและอนุมัติ"
     },
     {
       "item_number": 2,
       "correspondence_id": 124,
       "description": "Calculation Sheet",
       "revision": "0",
       "quantity": 2,
       "remarks": "ประกอบการพิจารณา"
     }
   ],
   "delivery_info": {
     "method": "ELECTRONIC",
     "carrier": null,
     "tracking_number": null,
     "expected_delivery": "2024-01-16T09:00:00Z"
   }
  }
  ```

* **Routing Details**
  * Routing Template Details

  ```typescript
  {
  "metadata": {
    "version": "1.0",
    "type": "ROUTING_TEMPLATE",
    "scope": "PROJECT_SPECIFIC",
    "applicable_projects": ["LCBP3", "LCBP3-SUB1"],
    "created_by": 101,
    "last_modified": "2024-01-10T14:20:00Z"
  },
  "workflow_rules": {
    "allow_parallel_processing": false,
    "allow_step_skipping": true,
    "require_approval_before_next": true,
    "escalation_rules": {
      "overdue_action": "NOTIFY_SUPERVISOR",
      "overdue_days": 3,
      "escalation_recipients": [201, 202]
    }
  },
  "step_configurations": [
    {
      "sequence": 1,
      "conditional_logic": {
        "condition": "DOCUMENT_TYPE == 'RFA'",
        "action": "AUTO_ASSIGN_TO_PROJECT_MANAGER"
      },
      "auto_actions": {
        "on_receive": "CALCULATE_DUE_DATE",
        "on_approve": "NOTIFY_NEXT_STEP",
        "on_reject": "RETURN_TO_ORIGINATOR"
      }
    }
  ]
  }

  ```

* Routing Instance Details

  ```typescript
  {
  "metadata": {
    "version": "1.0",
    "type": "ROUTING_INSTANCE",
    "template_id": 15,
    "initiated_by": 101,
    "started_at": "2024-01-15T10:30:00Z"
  },
  "current_status": {
    "current_step": 2,
    "overall_progress": 50,
    "estimated_completion": "2024-01-22T17:00:00Z",
    "blocked_reason": null
  },
  "step_history": [
    {
      "step_sequence": 1,
      "organization_id": 301,
      "assigned_to": 201,
      "assigned_at": "2024-01-15T10:30:00Z",
      "status": "COMPLETED",
      "completed_at": "2024-01-16T09:15:00Z",
      "action_taken": "APPROVED",
      "comments": "ตรวจสอบแล้วเห็นควรดำเนินการต่อ",
      "processing_time_hours": 22.75,
      "attachments_added": [501, 502]
    },
    {
      "step_sequence": 2,
      "organization_id": 302,
      "assigned_to": null,
      "assigned_at": "2024-01-16T09:15:00Z",
      "status": "IN_PROGRESS",
      "due_date": "2024-01-19T17:00:00Z",
      "time_remaining_hours": 72,
      "reminders_sent": 0
    }
  ],
  "performance_metrics": {
    "total_processing_time": 22.75,
    "average_step_time": 22.75,
    "steps_completed": 1,
    "steps_pending": 2,
    "on_track": true
  }
  }
  ```

* Routing Step Action Details

  ```typescript
  {
  "metadata": {
    "version": "1.0",
    "type": "ROUTING_ACTION",
    "action_type": "APPROVE_WITH_COMMENTS",
    "performed_by": 201,
    "performed_at": "2024-01-16T09:15:00Z"
  },
  "action_details": {
    "decision": "APPROVED",
    "approval_code": "1A",
    "conditions": [
      {
        "condition_id": 1,
        "description": "ต้องส่งแบบแก้ไขก่อนเริ่มงาน",
        "deadline": "2024-01-20T17:00:00Z"
      }
    ],
    "remarks": "แบบแปลนถูกต้องตามข้อกำหนด แต่ต้องแก้ไขรายละเอียดการติดตั้ง"
  },
  "technical_review": {
    "compliance_status": "COMPLIANT",
    "exceptions": [
      {
        "item": "Material Specification",
        "issue": "ไม่ได้ระบุ brand ที่ต้องการ",
        "severity": "LOW",
        "recommendation": "เพิ่มรายละเอียด brand ที่อนุญาต"
      }
    ],
    "reviewer_comments": "โดยรวมเป็นไปตามข้อกำหนดของโครงการ"
  },
  "attachments": {
    "review_documents": [503],
    "reference_standards": ["ASTM-A36", "JIS-G3101"]
  },
  "next_steps": {
    "auto_assign_to": 202,
    "required_actions": ["UPDATE_DRAWING", "RESUBMIT"],
    "deadline_extension_days": 5
  }
  }

  ```

* **Audit & Security Details**

  * Audit Log Details

  ```typescript
  {
  "metadata": {
    "version": "1.0",
    "type": "AUDIT_LOG",
    "security_level": "SENSITIVE"
  },
  "action_context": {
    "ip_address": "192.168.1.100",
    "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "session_id": "sess_abc123def456",
    "request_id": "req_789ghi012jkl"
  },
  "changes_made": {
    "before": {
      "status": "DRAFT",
      "title": "ร่างเอกสารขออนุมัติ"
    },
    "after": {
      "status": "SUBMITTED", 
      "title": "เอกสารขออนุมัติแบบก่อสร้าง"
    },
    "fields_modified": ["status", "title"]
  },
  "security_metadata": {
    "authentication_method": "JWT",
    "permissions_checked": ["correspondence.update", "workflow.submit"],
    "risk_level": "LOW",
    "compliance_checked": true
  }
  }

  ```

  * File Upload Security Details

  ```typescript
  {
  "metadata": {
    "version": "1.0",
    "type": "FILE_SECURITY_SCAN",
    "scan_timestamp": "2024-01-15T10:35:22Z"
  },
  "scan_results": {
    "virus_scan": {
      "engine": "ClamAV",
      "version": "1.0.1",
      "status": "CLEAN",
      "signatures": "20240115001",
      "scan_duration_ms": 245
    },
    "file_validation": {
      "expected_type": "application/pdf",
      "detected_type": "application/pdf",
      "file_size_bytes": 2547896,
      "checksum_sha256": "a1b2c3d4e5f6789012345678901234567890123456789012345678901234",
      "validation_passed": true
    },
    "security_assessment": {
      "risk_level": "LOW",
      "threats_detected": [],
      "recommendations": ["None"]
    }
  },
  "access_control": {
    "uploaded_by": 101,
    "organization_id": 301,
    "allowed_roles": ["VIEWER", "EDITOR", "DOCUMENT_CONTROL"],
    "download_count": 0,
    "last_accessed": null
  }
  }

  ```

* **Reporting & Analytics Details**

  * Correspondence Statistics

  ```typescript
  {
  "metadata": {
    "version": "1.0",
    "type": "CORRESPONDENCE_STATS",
    "period": "MONTHLY",
    "generated_at": "2024-01-31T23:59:59Z"
  },
  "summary": {
    "total_correspondences": 156,
    "new_this_period": 45,
    "closed_this_period": 38,
    "outstanding": 67
  },
  "by_type": {
    "RFA": {
      "count": 89,
      "approval_rate": 72.5,
      "average_processing_days": 12.3
    },
    "RFI": {
      "count": 45,
      "response_rate": 95.6,
      "average_response_hours": 48.2
    },
    "LETTER": {
      "count": 22,
      "action_required": 15,
      "pending_actions": 8
    }
  },
  "performance_metrics": {
    "on_time_completion_rate": 78.4,
    "average_cycle_time_days": 8.7,
    "escalation_count": 12,
    "sla_violations": 5
  }
  }

  ```

* **Usage Guidelines**
  * Schema Validation Rules

  ```typescript
  {
  "validation_rules": {
    "required_fields": ["metadata.version", "metadata.type"],
    "version_control": {
      "current_version": "1.0",
      "backward_compatible": true
    },
    "size_limits": {
      "max_json_size_kb": 50,
      "max_array_elements": 1000
    },
    "data_types": {
      "timestamps": "ISO8601",
      "numbers": "integer_or_float",
      "enums": "predefined_values"
    }
  }
  }
  ```

  * Example TypeScript Interfaces

  ```typescript
  interface CorrespondenceDetails {
  metadata: {
    version: string;
    type: string;
    created_at: string;
    updated_at: string;
  };
  content: {
    subject: string;
    description?: string;
    priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
    confidentiality: 'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL';
    references?: Array<{
      type: string;
      correspondence_id: number;
      description: string;
    }>;
  };
  }

  interface RoutingInstanceDetails {
  metadata: {
    version: string;
    type: string;
    template_id: number;
    initiated_by: number;
    started_at: string;
  };
  current_status: {
    current_step: number;
    overall_progress: number;
    estimated_completion: string;
    blocked_reason: string | null;
  };
  step_history: Array<{
    step_sequence: number;
    organization_id: number;
    assigned_to: number | null;
    assigned_at: string;
    status: string;
    completed_at?: string;
    action_taken?: string;
    comments?: string;
    processing_time_hours?: number;
  }>;
  }
  ```

## 🧩**12. การปรับปรุงที่แนะนำ (สำหรับอนาคต) (Recommended Enhancements (Future))**

* ✅ สร้าง Background job (โดยใช้ **n8n** เพื่อเชื่อมต่อกับ **Line** [cite: 2.7] และ/หรือใช้สำหรับการแจ้งเตือน RFA ที่ใกล้ถึงกำหนด due_date [cite: 6.7])
* ✅ เพิ่ม job ล้างข้อมูลเป็นระยะสำหรับ attachments ที่ไม่ถูกเชื่อมโยงกับ Entity ใดๆ เลย (ไฟล์กำพร้า)
* 🔄 **AI-Powered Document Classification:** ใช้ machine learning สำหรับ automatic document categorization
* 🔄 **Advanced Analytics:** Predictive analytics สำหรับ workflow optimization
* 🔄 **Mobile App:** Native mobile application สำหรับ field workers
* 🔄 **Blockchain Integration:** สำหรับ document integrity verification ที่ต้องการความปลอดภัยสูงสุด

---

## 📋**13 Summary of Key Changes from Previous Version**

### **Security Enhancements:**

1. **File Upload Security** - Virus scanning, file type validation, access controls
2. **Input Validation** - OWASP Top 10 protection, XSS/CSRF prevention
3. **Rate Limiting** - Comprehensive rate limiting strategy
4. **Secrets Management** - Secure handling of sensitive configuration

### **Architecture Improvements:**

1. **Document Numbering** - Changed from Stored Procedure to Application-level Locking
2. **Resilience Patterns** - Circuit breaker, retry mechanisms, fallback strategies
3. **Monitoring & Observability** - Health checks, metrics, distributed tracing
4. **Caching Strategy** - Comprehensive caching with proper invalidation

### **Performance Targets:**

1. **API Response Time** - < 200ms (90th percentile)
2. **Search Performance** - < 500ms
3. **File Upload** - < 30 seconds for 50MB files
4. **Cache Hit Ratio** - > 80%

### **Operational Excellence:**

1. **Disaster Recovery** - RTO < 4 hours, RPO < 1 hour
2. **Backup Procedures** - Comprehensive backup and restoration
3. **Security Testing** - Penetration testing and security audits
4. **Performance Testing** - Load testing with realistic workloads

เอกสารนี้สะท้อนถึงความมุ่งมั่นในการสร้างระบบที่มีความปลอดภัย, มีความทนทาน, และมีประสิทธิภาพสูง พร้อมรองรับการเติบโตในอนาคตและความต้องการทางธุรกิจที่เปลี่ยนแปลงไป

**หมายเหตุ:** แนวทางนี้จะถูกทบทวนและปรับปรุงเป็นระยะตาม feedback จากทีมพัฒนาและความต้องการทางธุรกิจที่เปลี่ยนแปลงไป
