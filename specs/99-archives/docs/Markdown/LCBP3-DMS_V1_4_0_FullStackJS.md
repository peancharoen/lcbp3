# **Documents Management Sytem Version 1.4.0: แนวทางการพัฒนา FullStackJS**

## **🧠 ปรัชญาทั่วไป**

แนวทางปฏิบัติที่ดีที่สุดแบบครบวงจรสำหรับการพัฒนา NestJS Backend, NextJS Frontend และ Tailwind-based UI/UX ในสภาพแวดล้อม TypeScript มุ่งเน้นที่ ความชัดเจน (clarity), ความง่ายในการบำรุงรักษา (maintainability), ความสอดคล้องกัน (consistency) และ การเข้าถึงได้ (accessibility) ตลอดทั้งสแต็ก

## **⚙️ แนวทางทั่วไปสำหรับ TypeScript**

### **หลักการพื้นฐาน**

- ใช้ **ภาษาอังกฤษ** สำหรับโค้ด
- ใช้ **ภาษาไทย** สำหรับ comment และเอกสารทั้งหมด
- กำหนดไทป์ (type) อย่างชัดเจนสำหรับตัวแปร, พารามิเตอร์ และค่าที่ส่งกลับ (return values) ทั้งหมด
- หลีกเลี่ยงการใช้ any; ให้สร้างไทป์ (types) หรืออินเทอร์เฟซ (interfaces) ที่กำหนดเอง
- ใช้ **JSDoc** สำหรับคลาส (classes) และเมธอด (methods) ที่เป็น public
- ส่งออก (Export) **สัญลักษณ์หลัก (main symbol) เพียงหนึ่งเดียว** ต่อไฟล์
- หลีกเลี่ยงบรรทัดว่างภายในฟังก์ชัน
- ระบุ // File: path/filename ในบรรทัดแรกของทุกไฟล์
- ระบุ // บันทึกการแก้ไข, หากมีการแก้ไขเพิ่มในอนาคต ให้เพิ่มบันทึก

### **ข้อตกลงในการตั้งชื่อ (Naming Conventions)**

| Entity (สิ่งที่ตั้งชื่อ) | Convention (รูปแบบ) | Example (ตัวอย่าง)                 |
| :----------------------- | :------------------ | :--------------------------------- |
| Classes                  | PascalCase          | UserService                        |
| Property                 | snake_sase          | user_id                            |
| Variables & Functions    | camelCase           | getUserInfo                        |
| Files & Folders          | kebab-case          | user-service.ts                    |
| Environment Variables    | UPPERCASE           | DATABASE\URL                       |
| Booleans                 | Verb \+ Noun        | isActive, canDelete, hasPermission |

ใช้คำเต็ม — ไม่ใช้อักษรย่อ — ยกเว้นคำมาตรฐาน (เช่น API, URL, req, res, err, ctx)

## **🧩 ฟังก์ชัน (Functions)**

- เขียนฟังก์ชันให้สั้น และทำ **หน้าที่เพียงอย่างเดียว** (single-purpose) (\< 20 บรรทัด)
- ใช้ **early returns** เพื่อลดการซ้อน (nesting) ของโค้ด
- ใช้ **map**, **filter**, **reduce** แทนการใช้ loops เมื่อเหมาะสม
- ควรใช้ **arrow functions** สำหรับตรรกะสั้นๆ, และใช้ **named functions** ในกรณีอื่น
- ใช้ **default parameters** แทนการตรวจสอบค่า null
- จัดกลุ่มพารามิเตอร์หลายตัวให้เป็นอ็อบเจกต์เดียว (RO-RO pattern)
- ส่งค่ากลับ (Return) เป็นอ็อบเจกต์ที่มีไทป์กำหนด (typed objects) ไม่ใช่ค่าพื้นฐาน (primitives)
- รักษาระดับของสิ่งที่เป็นนามธรรม (abstraction level) ให้เป็นระดับเดียวในแต่ละฟังก์ชัน

## **🧱 การจัดการข้อมูล (Data Handling)**

- ห่อหุ้มข้อมูล (Encapsulate) ในไทป์แบบผสม (composite types)
- ใช้ **immutability** (การไม่เปลี่ยนแปลงค่า) ด้วย readonly และ as const
- ทำการตรวจสอบความถูกต้องของข้อมูล (Validations) ในคลาสหรือ DTOs ไม่ใช่ภายในฟังก์ชันทางธุรกิจ
- ตรวจสอบความถูกต้องของข้อมูลโดยใช้ DTOs ที่มีไทป์กำหนดเสมอ

## **🧰 คลาส (Classes)**

- ปฏิบัติตามหลักการ **SOLID**
- ควรใช้ **composition มากกว่า inheritance** (Prefer composition over inheritance)
- กำหนด **interfaces** สำหรับสัญญา (contracts)
- ให้คลาสมุ่งเน้นการทำงานเฉพาะอย่างและมีขนาดเล็ก (\< 200 บรรทัด, \< 10 เมธอด, \< 10 properties)

## **🚨 การจัดการข้อผิดพลาด (Error Handling)**

- ใช้ Exceptions สำหรับข้อผิดพลาดที่ไม่คาดคิด
- ดักจับ (Catch) ข้อผิดพลาดเพื่อแก้ไขหรือเพิ่มบริบท (context) เท่านั้น; หากไม่เช่นนั้น ให้ใช้ global error handlers
- ระบุข้อความข้อผิดพลาด (error messages) ที่มีความหมายเสมอ

## **🧪 การทดสอบ (ทั่วไป) (Testing (General))**

- ใช้รูปแบบ **Arrange–Act–Assert**
- ใช้ชื่อตัวแปรในการทดสอบที่สื่อความหมาย (inputData, expectedOutput)
- เขียน **unit tests** สำหรับ public methods ทั้งหมด
- จำลอง (Mock) การพึ่งพาภายนอก (external dependencies)
- เพิ่ม **acceptance tests** ต่อโมดูลโดยใช้รูปแบบ Given–When-Then

## **🏗️ แบ็กเอนด์ (NestJS) (Backend (NestJS))**

### **หลักการ**

- **สถาปัตยกรรมแบบโมดูลาร์ (Modular architecture)**:
  - หนึ่งโมดูลต่อหนึ่งโดเมน
  - โครงสร้างแบบ Controller → Service → Repository (Model)
- API-First: มุ่งเน้นการสร้าง API ที่มีคุณภาพสูง มีเอกสารประกอบ (Swagger) ที่ชัดเจนสำหรับ Frontend Team
- DTOs ที่ตรวจสอบความถูกต้องด้วย **class-validator**
- ใช้ **MikroORM** (หรือ TypeORM/Prisma) สำหรับการคงอยู่ของข้อมูล (persistence) ซึ่งสอดคล้องกับสคีมา MariaDB
- ห่อหุ้มโค้ดที่ใช้ซ้ำได้ไว้ใน **common module** (@app/common):
  - Configs, decorators, DTOs, guards, interceptors, notifications, shared services, types, validators

### **ฟังก์ชันหลัก (Core Functionalities)**

- Global **filters** สำหรับการจัดการ exception
- **Middlewares** สำหรับการจัดการ request
- **Guards** สำหรับการอนุญาต (permissions) และ RBAC
- **Interceptors** สำหรับการแปลงข้อมูล response และการบันทึก log

### **ข้อจำกัดในการ Deploy (QNAP Container Station)**

- **ห้ามใช้ไฟล์ .env** ในการตั้งค่า Environment Variables [cite: 2.1]
- การตั้งค่าทั้งหมด (เช่น Database connection string, JWT secret) **จะต้องถูกกำหนดผ่าน Environment Variable ใน docker-compose.yml โดยตรง** [cite: 6.5] ซึ่งจะจัดการผ่าน UI ของ QNAP Container Station [cite: 2.1]

### **โครงสร้างโมดูลตามโดเมน (Domain-Driven Module Structure)**

เพื่อให้สอดคล้องกับสคีมา SQL (LCBP3-DMS) เราจะใช้โครงสร้างโมดูลแบบ **Domain-Driven (แบ่งตามขอบเขตธุรกิจ)** แทนการแบ่งตามฟังก์ชัน:

1. **CommonModule:**
   - เก็บ Services ที่ใช้ร่วมกัน เช่น DatabaseModule, FileStorageService (จัดการไฟล์ใน QNAP), AuditLogService, NotificationService
   - จัดการ audit_logs
   - NotificationService ต้องรองรับ Triggers ที่ระบุใน Requirement 6.7 [cite: 6.7]
2. **AuthModule:**
   - จัดการะการยืนยันตัวตน (JWT, Guards)
   - **(สำคัญ)** ต้องรับผิดชอบการตรวจสอบสิทธิ์ **4 ระดับ** [cite: 4.2]: สิทธิ์ระดับระบบ (Global Role), สิทธิ์ระดับองกรณ์ (Organization Role), สิทธิ์ระดับโปรเจกต์ (Project Role), และ สิทธิ์ระดับสัญญา (Contract Role)
   - **(สำคัญ)** ต้องมี API สำหรับ **Admin Panel** เพื่อ:
     - สร้างและจัดการ Role และการจับคู่ Permission แบบไดนามิก [cite: 4.3]
     - ให้ Superadmin สร้าง Organizations และกำหนด Org Admin ได้ [cite: 4.6]
     - ให้ Superadmin/Admin จัดการ document_number_formats (รูปแบบเลขที่เอกสาร), document_number_counters (Running Number) [cite: 3.10]
3. **UserModule:**
   - จัดการ users, roles, permissions, global_default_roles, role_permissions, user_roles, user_project_roles
   - **(สำคัญ)** ต้องมี API สำหรับ **Admin Panel** เพื่อ:
     - สร้างและจัดการ Role และการจับคู่ Permission แบบไดนามิก [cite: 4.3]
4. **ProjectModule:**
   - จัดการ projects, organizations, contracts, project_parties, contract_parties
5. **MasterModule:**
   - จัดการ master data (correspondence_types, rfa_types, rfa_status_codes, rfa_approve_codes, circulation_status_codes, correspondence_types, correspondence_status, tags) [cite: 4.5]
6. **CorrespondenceModule (โมดูลศูนย์กลาง):**
   - จัดการ correspondences, correspondence_revisions, correspondence_tags
   - **(สำคัญ)** Service นี้ต้อง Inject DocumentNumberingService เพื่อขอเลขที่เอกสารใหม่ก่อนการสร้าง
   - **(สำคัญ)** ตรรกะการสร้าง/อัปเดต Revision จะอยู่ใน Service นี้
   - จัดการ correspondence_attachments (ตารางเชื่อมไฟล์แนบ)
   - รับผิดชอบ Routing **Correspondence Routing** (correspondence_routings, correspondence_routing_template_steps, correspondence_routing_templates, correspondence_status_transitions) สำหรับการส่งต่อเอกสารทั่วไประหว่างองค์กร

7. **RfaModule:**
   - จัดการ rfas, rfa_revisions, rfa_items
   - รับผิดชอบเวิร์กโฟลว์ **"RFA Workflows"** (rfa_workflows, rfa_workflow_templates, rfa_workflow_template_steps, rfa_status_transitions) สำหรับการอนุมัติเอกสารทางเทคนิค
8. **DrawingModule:**
   - จัดการ shop_drawings, shop_drawing_revisions, contract_drawings, contract_drawing_volumes, contract_drawing_cats, contract_drawing_sub_cats, shop_drawing_main_categories, shop_drawing_sub_categories, contract_drawing_subcat_cat_maps, shop_drawing_revision_contract_refs
   - จัดการ shop_drawing_revision_attachments และ contract_drawing_attachments(ตารางเชื่อมไฟล์แนบ)
9. **CirculationModule:**
   - จัดการ circulations, circulation_templates, circulation_assignees
   - จัดการ circulation_attachments (ตารางเชื่อมไฟล์แนบ)
   - รับผิดชอบเวิร์กโฟลว์ **"Circulations"** (circulation_status_transitions, circulation_template_assignees, circulation_assignees, circulation_recipients, circulation_actions, circulation_action_documents)สำหรับการเวียนเอกสาร **ภายในองค์กร**
10. **TransmittalModule:**
    - จัดการ transmittals และ transmittal_items
11. **SearchModule:**
    - ให้บริการค้นหาขั้นสูง (Advanced Search) [cite: 6.2] โดยใช้ **Elasticsearch** เพื่อรองรับการค้นหาแบบ Full-text จากชื่อเรื่อง, รายละเอียด, เลขที่เอกสาร, ประเภท, วันที่, และ Tags
    - ระบบจะใช้ Elasticsearch Engine ในการจัดทำดัชนีเพื่อการค้นหาข้อมูลเชิงลึกจากเนื้อหาของเอกสาร โดยข้อมูลจะถูกส่งไปทำดัชนีจาก Backend (NestJS) ทุกครั้งที่มีการสร้างหรือแก้ไขเอกสาร
12. **DocumentNumberingModule:**
    - **สถานะ:** เป็น Module ภายใน (Internal Module) ไม่เปิด API สู่ภายนอก
    - **หน้าที่:** ให้บริการ DocumentNumberingService ที่ Module อื่น (เช่น CorrespondenceModule) จะ Inject ไปใช้งาน
    - **ตรรกะ:** รับผิดชอบการสร้างเลขที่เอกสาร โดยการเรียกใช้ Stored Procedure \*sp_get_next_document_number\*\* เพื่อป้องกัน Race Condition

### **สถาปัตยกรรมระบบ (System Architecture)**

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
│   ├── 📁 file-storage          # FileStorageService
│   ├── 📁 guards                # Custom Guards (RBAC Guard)
│   ├── 📁 interceptors          # Interceptors (Audit Log, Transform)
│   └── 📁 services              # Shared Services (NotificationService)
├── 📁 modules
│   ├── 📁 user                  # UserModule (จัดการ Users, Roles, Permissions)
│   ├── 📁 project               # ProjectModule (จัดการ Projects, Organizations, Contracts)
│   ├── 📁 correspondence        # CorrespondenceModule (จัดการเอกสารโต้ตอบ)
│   ├── 📁 rfa                   # RfaModule (จัดการเอกสารขออนุมัติ)
│   ├── 📁 drawing               # DrawingModule (จัดการแบบแปลน)
│   ├── 📁 circulation           # CirculationModule (จัดการใบเวียน)
│   ├── 📁 transmittal           # TransmittalModule (จัดการเอกสารนำส่ง)
│   ├── 📁 search                # SearchModule (ค้นหาขั้นสูงด้วย Elasticsearch)
│   └── 📁 document-numbering    # DocumentNumberingModule (Internal Module)
└── 📁 database                  # Database Migration & Seeding Scripts
```

### **เเทคโนโลยีที่ใช้ (Technology Stack)**

| ส่วน              | Library/Tool                                      | หมายเหตุ                                     |
| ----------------- | ------------------------------------------------- | -------------------------------------------- |
| **Framework**     | `@nestjs/core`, `@nestjs/common`                  | Core Framework                               |
| **Language**      | `TypeScript`                                      | ใช้ TypeScript ทั้งระบบ                      |
| **Database**      | `MariaDB 10.11`                                   | ฐานข้อมูลหลัก                                |
| **ORM**           | `@nestjs/typeorm`, `typeorm`                      | 🗃️จัดการการเชื่อมต่อและ Query ฐานข้อมูล      |
| **Validation**    | `class-validator`, `class-transformer`            | 📦ตรวจสอบและแปลงข้อมูลใน DTO                 |
| **Auth**          | `@nestjs/jwt`, `@nestjs/passport`, `passport-jwt` | 🔐การยืนยันตัวตนด้วย JWT                     |
| **Authorization** | `casl`                                            | 🔐จัดการสิทธิ์แบบ RBAC                       |
| **File Upload**   | `multer`                                          | 📁จัดการการอัปโหลดไฟล์                       |
| **Search**        | `@nestjs/elasticsearch`                           | 🔍สำหรับการค้นหาขั้นสูง                      |
| **Notification**  | `nodemailer`                                      | 📬ส่งอีเมลแจ้งเตือน                          |
| **Scheduling**    | `@nestjs/schedule`                                | 📬สำหรับ Cron Jobs (เช่น แจ้งเตือน Deadline) |
| **Logging**       | `winston`                                         | 📊บันทึก Log ที่มีประสิทธิภาพ                |
| **Testing**       | `@nestjs/testing`, `jest`, `supertest`            | 🧪ทดสอบ Unit, Integration และ E2E            |
| **Documentation** | `@nestjs/swagger`                                 | 🌐สร้าง API Documentation อัตโนมัติ          |
| **Security**      | `helmet`, `rate-limiter-flexible`                 | 🛡️เพิ่มความปลอดภัยให้ API                    |

เราจะแบ่งการทดสอบเป็น 3 ระดับ โดยใช้ **Jest** และ @nestjs/testing:

- **Unit Tests (การทดสอบหน่วยย่อย):**
  - **เป้าหมาย:** ทดสอบ Logic ภายใน Service, Guard, หรือ Pipe โดยจำลอง (Mock) Dependencies ทั้งหมด
  - **สิ่งที่ต้องทดสอบ:** Business Logic (เช่น การเปลี่ยนสถานะ Workflow, การตรวจสอบ Deadline) [cite: 2.9.1], ตรรกะการตรวจสอบสิทธิ์ (Auth Guard) ทั้ง 4 ระดับ
- **Integration Tests (การทดสอบการบูรณาการ):**
  - **เป้าหมาย:** ทดสอบการทำงานร่วมกันของ Controller -> Service -> Repository (Database)
  - **เทคนิค:** ใช้ **Test Database แยกต่างหาก** (ห้ามใช้ Dev DB) และใช้ supertest เพื่อยิง HTTP Request จริงไปยัง App
  - **สิ่งที่ต้องทดสอบ:** การเรียก sp\get\next\document\number [cite: 2.9.3] และการทำงานของ Views (เช่น v_user_tasks)
- **E2E (End-to-End) Tests:**
  - **เป้าหมาย:** ทดสอบ API Contract ว่า Response Body Shape ตรงตามเอกสาร Swagger เพื่อรับประกันทีม Frontend

### **🗄️ Backend State Management**

Backend (NestJS) ควรเป็น **Stateless** (ไม่เก็บสถานะ) "State" ทั้งหมดจะถูกจัดเก็บใน MariaDB

- **Request-Scoped State (สถานะภายใน Request เดียว):**
  - **ปัญหา:** จะส่งต่อข้อมูล (เช่น User ที่ล็อกอิน) ระหว่าง Guard และ Service ใน Request เดียวกันได้อย่างไร?
  - **วิธีแก้:** ใช้ **Request-Scoped Providers** ของ NestJS (เช่น AuthContextService) เพื่อเก็บข้อมูล User ปัจจุบันที่ได้จาก AuthGuard และให้ Service อื่น Inject ไปใช้
- **Application-Scoped State (การ Caching):**
  - **ปัญหา:** ข้อมูล Master (เช่น roles, permissions, organizations) ถูกเรียกใช้บ่อย
  - **วิธีแก้:** ใช้ **Caching** (เช่น @nestjs/cache-manager) เพื่อ Caching ข้อมูลเหล่านี้ และลดภาระ Database

### **การไหลของข้อมูล (Data Flow)**

1. Request: ผ่าน Nginx Proxy Manager -> NestJS Controller
2. Authentication: JWT Guard ตรวจสอบ Token และดึงข้อมูล User
3. Authorization: RBAC Guard (ใช้ CASL) ตรวจสอบสิทธิ์จาก Decorators (@RequirePermission)
4. Validation: Validation Pipe (ใช้ class-validator) ตรวจสอบ DTO
5. Business Logic: Service Layer ประมวลผลตรรกะทางธุรกิจ
6. Data Access: Repository Layer (ใช้ TypeORM) ติดต่อกับฐานข้อมูล MariaDB
7. Response: ส่งกลับไปยัง Frontend พร้อมสถานะและข้อมูลที่เหมาะสม

# **🖥️ ฟรอนต์เอนด์ (NextJS / React / UI) (Frontend (NextJS / React / UI))**

### **โปรไฟล์นักพัฒนา (Developer Profile)**

วิศวกร TypeScript + React/NextJS ระดับ Senior
เชี่ยวชาญ TailwindCSS, Shadcn/UI, และ Radix สำหรับการพัฒนา UI

### **แนวทางการพัฒนาโค้ด (Code Implementation Guidelines)**

- ใช้ **early returns** เพื่อความชัดเจน
- ใช้คลาสของ **TailwindCSS** ในการกำหนดสไตล์เสมอ
- ควรใช้ class: syntax แบบมีเงื่อนไข (หรือ utility clsx) มากกว่าการใช้ ternary operators ใน class strings
- ใช้ **const arrow functions** สำหรับ components และ handlers
- Event handlers ให้ขึ้นต้นด้วย handle... (เช่น handleClick, handleSubmit)
- รวมแอตทริบิวต์สำหรับการเข้าถึง (accessibility) ด้วย:
  tabIndex="0", aria-label, onKeyDown, ฯลฯ
- ตรวจสอบให้แน่ใจว่าโค้ดทั้งหมด **สมบูรณ์**, **ผ่านการทดสอบ**, และ **ไม่ซ้ำซ้อน (DRY)**
- ต้อง import โมดูลที่จำเป็นต้องใช้อย่างชัดเจนเสมอ

### **UI/UX ด้วย React**

- ใช้ **semantic HTML**
- ใช้คลาสของ **Tailwind** ที่รองรับ responsive (sm:, md:, lg:)
- รักษาลำดับชั้นของการมองเห็น (visual hierarchy) ด้วยการใช้ typography และ spacing
- ใช้ **Shadcn** components (Button, Input, Card, ฯลฯ) เพื่อ UI ที่สอดคล้องกัน
- ทำให้ components มีขนาดเล็กและมุ่งเน้นการทำงานเฉพาะอย่าง
- ใช้ utility classes สำหรับการจัดสไตล์อย่างรวดเร็ว (spacing, colors, text, ฯลฯ)
- ตรวจสอบให้แน่ใจว่าสอดคล้องกับ **ARIA** และใช้ semantic markup

### **การตรวจสอบฟอร์มและข้อผิดพลาด (Form Validation & Errors)**

- ใช้ไลบรารีฝั่ง client เช่น zod และ react-hook-form
- แสดงข้อผิดพลาดด้วย **alert components** หรือข้อความ inline
- ต้องมี labels, placeholders, และข้อความ feedback

### **🧪 Frontend Testing**

เราจะใช้ **React Testing Library (RTL)** สำหรับการทดสอบ Component และ **Playwright** สำหรับ E2E:

- **Unit Tests (การทดสอบหน่วยย่อย):**
  - **เครื่องมือ:** Vitest + RTL
  - **เป้าหมาย:** ทดสอบ Component ขนาดเล็ก (เช่น Buttons, Inputs) หรือ Utility functions
- **Integration Tests (การทดสอบการบูรณาการ):**
  - **เครื่องมือ:** RTL + **Mock Service Worker (MSW)**
  - **เป้าหมาย:** ทดสอบว่า Component หรือ Page ทำงานกับ API (ที่จำลองขึ้น) ได้ถูกต้อง
  - **เทคนิค:** ใช้ MSW เพื่อจำลอง NestJS API และทดสอบว่า Component แสดงผลข้อมูลจำลองได้ถูกต้องหรือไม่ (เช่น ทดสอบหน้า Dashboard [cite: 5.3] ที่ดึงข้อมูลจาก v_user_tasks)
- **E2E (End-to-End) Tests:**
  - **เครื่องมือ:** **Playwright**
  - **เป้าหมาย:** ทดสอบ User Flow ทั้งระบบโดยอัตโนมัติ (เช่น ล็อกอิน -> สร้าง RFA -> ตรวจสอบ Workflow Visualization [cite: 5.6])

### **🗄️ Frontend State Management**

สำหรับ Next.js App Router เราจะแบ่ง State เป็น 4 ระดับ:

1. **Local UI State (สถานะ UI ชั่วคราว):**
   - **เครื่องมือ:** useState, useReducer
   - **ใช้เมื่อ:** จัดการสถานะเล็กๆ ที่จบใน Component เดียว (เช่น Modal เปิด/ปิด, ค่าใน Input)
2. **Server State (สถานะข้อมูลจากเซิร์ฟเวอร์):**
   - **เครื่องมือ:** **React Query (TanStack Query)** หรือ SWR
   - **ใช้เมื่อ:** จัดการข้อมูลที่ดึงมาจาก NestJS API (เช่น รายการ correspondences, rfas, drawings)
   - **ทำไม:** React Query เป็น "Cache" ที่จัดการ Caching, Re-fetching, และ Invalidation ให้โดยอัตโนมัติ
3. **Global Client State (สถานะส่วนกลางฝั่ง Client):**
   - **เครื่องมือ:** **Zustand** (แนะนำ) หรือ Context API
   - **ใช้เมื่อ:** จัดการข้อมูลที่ต้องใช้ร่วมกันทั่วทั้งแอป และ _ไม่ใช่_ ข้อมูลจากเซิร์ฟเวอร์ (เช่น ข้อมูล User ที่ล็อกอิน, สิทธิ์ Permissions)
4. **Form State (สถานะของฟอร์ม):**
   - **เครื่องมือ:** **React Hook Form** + **Zod**
   - **ใช้เมื่อ:** จัดการฟอร์มที่ซับซ้อน (เช่น ฟอร์มสร้าง RFA, ฟอร์ม Circulation [cite: 3.7])

# **🔗 แนวทางการบูรณาการ Full Stack (Full Stack Integration Guidelines)**

| Aspect (แง่มุม)            | Backend (NestJS)           | Frontend (NextJS)              | UI Layer (Tailwind/Shadcn)             |
| :------------------------- | :------------------------- | :----------------------------- | :------------------------------------- |
| API                        | REST / GraphQL Controllers | API hooks ผ่าน fetch/axios/SWR | Components ที่รับข้อมูล                |
| Validation (การตรวจสอบ)    | class-validator DTOs       | zod / react-hook-form          | สถานะของฟอร์ม/input ใน Shadcn          |
| Auth (การยืนยันตัวตน)      | Guards, JWT                | NextAuth / cookies             | สถานะ UI ของ Auth (loading, signed in) |
| Errors (ข้อผิดพลาด)        | Global filters             | Toasts / modals                | Alerts / ข้อความ feedback              |
| Testing (การทดสอบ)         | Jest (unit/e2e)            | Vitest / Playwright            | Visual regression                      |
| Styles (สไตล์)             | Scoped modules (ถ้าจำเป็น) | Tailwind / Shadcn              | Tailwind utilities                     |
| Accessibility (การเข้าถึง) | Guards + filters           | ARIA attributes                | Semantic HTML                          |

## **🗂️ ข้อตกลงเฉพาะสำหรับ DMS (LCBP3-DMS)**

ส่วนนี้ขยายแนวทาง FullStackJS ทั่วไปสำหรับโปรเจกต์ **LCBP3-DMS** โดยมุ่งเน้นไปที่เวิร์กโฟลว์การอนุมัติเอกสาร (Correspondence, RFA, Drawing, Contract, Transmittal, Circulation)

### **🧩 RBAC และการควบคุมสิทธิ์ (RBAC & Permission Control)**

ใช้ Decorators เพื่อบังคับใช้สิทธิ์การเข้าถึง โดยอ้างอิงสิทธิ์จากตาราง permissions

@RequirePermission('rfas.respond') // ต้องตรงกับ 'permission\code'
@Put(':id')
updateRFA(@Param('id') id: string) {
return this.rfaService.update(id);
}

### **Roles (บทบาท)**

- **Superadmin**: ไม่มีข้อจำกัดใดๆ [cite: 4.3]
- **Admin**: มีสิทธิ์เต็มที่ในองค์กร [cite: 4.3]
- **Document Control**: เพิ่ม/แก้ไข/ลบ เอกสารในองค์กร [cite: 4.3]
- **Editor**: สามารถ เพิ่ม/แก้ไข เอกสารที่กำหนด [cite: 4.3]
- **Viewer**: สามารถดู เอกสาร [cite: 4.3]

### **ตัวอย่าง Permissions (จากตาราง permissions)**

- rfas.view, rfas.create, rfas.respond, rfas.delete
- drawings.view, drawings.upload, drawings.delete
- corr.view, corr.manage
- transmittals.manage
- cirs.manage
- project\parties.manage

การจับคู่ระหว่าง roles และ permissions **เริ่มต้น** จะถูก seed ผ่านสคริปต์ (ดังที่เห็นในไฟล์ SQL)**อย่างไรก็ตาม AuthModule/UserModule ต้องมี API สำหรับ Admin เพื่อสร้าง Role ใหม่และกำหนดสิทธิ์ (Permissions) เพิ่มเติมได้ในภายหลัง** [cite: 4.3]

## **🧾 มาตรฐาน AuditLog (AuditLog Standard)**

บันทึกการดำเนินการ CRUD และการจับคู่ทั้งหมดลงในตาราง audit_logs

| Field (ฟิลด์) | Type (จาก SQL) | Description (คำอธิบาย)                           |
| :------------ | :------------- | :----------------------------------------------- |
| audit_id      | BIGINT         | Primary Key                                      |
| user_id       | INT            | ผู้ใช้ที่ดำเนินการ (FK -> users)                 |
| action        | VARCHAR(100)   | rfa.create, correspondence.update, login.success |
| entity_type   | VARCHAR(50)    | ชื่อตาราง/โมดูล เช่น 'rfa', 'correspondence'     |
| entity_id     | VARCHAR(50)    | Primary ID ของระเบียนที่ได้รับผลกระทบ            |
| details_json  | JSON           | ข้อมูลบริบท (เช่น ฟิลด์ที่มีการเปลี่ยนแปลง)      |
| ip_address    | VARCHAR(45)    | IP address ของผู้ดำเนินการ                       |
| user_agent    | VARCHAR(255)   | User Agent ของผู้ดำเนินการ                       |
| created_at    | TIMESTAMP      | Timestamp (UTC)                                  |

## **📂 การจัดการไฟล์ (File Handling) (ปรับปรุงใหม่)**

### **มาตรฐานการอัปโหลดไฟล์ (File Upload Standard)**

- **ตรรกะใหม่:** การอัปโหลดไฟล์ทั้งหมดจะถูกจัดการโดย FileStorageService และบันทึกข้อมูลไฟล์ลงในตาราง attachments (ตารางกลาง)
- ไฟล์จะถูกเชื่อมโยงไปยัง Entity ที่ถูกต้องผ่าน **ตารางเชื่อม (Junction Tables)** เท่านั้น:
  - correspondence_attachments (เชื่อม Correspondence กับ Attachments)
  - circulation_attachments (เชื่อม Circulation กับ Attachments)
  - shop_drawing_revision_attachments (เชื่อม Shop Drawing Revision กับ Attachments)
  - contract_drawing_attachments (เชื่อม Contract Drawing กับ Attachments)
- เส้นทางจัดเก็บไฟล์ (Upload path): อ้างอิงจาก Requirement 2.1 คือ /share/dms-data [cite: 2.1] โดย FileStorageService จะสร้างโฟลเดอร์ย่อยแบบรวมศูนย์ (เช่น /share/dms-data/uploads/{YYYY}/{MM}/[stored\filename])
- ประเภทไฟล์ที่อนุญาต: pdf, dwg, docx, xlsx, zip
- ขนาดสูงสุด: **50 MB**
- จัดเก็บนอก webroot
- ให้บริการไฟล์ผ่าน endpoint ที่ปลอดภัย /files/:attachment_id/download

### **การควบคุมการเข้าถึง (Access Control)**

การเข้าถึงไฟล์ไม่ใช่การเข้าถึงโดยตรง endpoint /files/:attachment_id/download จะต้อง:

1. ค้นหาระเบียน attachment
2. ตรวจสอบว่า attachment_id นี้ เชื่อมโยงกับ Entity ใด (เช่น correspondence, circulation, shop_drawing_revision, contract_drawing) ผ่านตารางเชื่อม
3. ตรวจสอบว่าผู้ใช้มีสิทธิ์ (permission) ในการดู Entity ต้นทางนั้นๆ หรือไม่

## **🔟 การจัดการเลขที่เอกสาร (Document Numbering) [cite: 3.10]**

- **เป้าหมาย:** สร้างเลขที่เอกสาร (เช่น correspondence\number) โดยอัตโนมัติ ตามรูปแบบที่กำหนด
- **ตรรกะการนับ:** การนับ Running number (SEQ) จะนับแยกตาม Key: **Project + Originator Organization + Document Type + Year**
- **ตาราง SQL:**
  - document_number_formats: Admin ใช้กำหนด "รูปแบบ" (Template) ของเลขที่ (เช่น {ORG\CODE}-{TYPE\CODE}-{YEAR\SHORT}-{SEQ:4}) โดยกำหนดตาม **Project** และ **Document Type** [cite: 4.5]
  - document_number_counters: ระบบใช้เก็บ "ตัวนับ" ล่าสุดของ Key (Project+Org+Type+Year)
- **การทำงาน (Backend):**
  - DocumentNumberingModule จะให้บริการ DocumentNumberingService
  - เมื่อ CorrespondenceModule ต้องการสร้างเอกสารใหม่, มันจะเรียก documentNumberingService.generateNextNumber(...)
  - Service นี้จะเรียกใช้ Stored Procedure **sp_get_next_document_number** [cite: 2.9.3] ซึ่ง Procedure นี้จะจัดการ Database Transaction และ Row Lock (FOR UPDATE) ภายใน DB เพื่อรับประกันการป้องกัน Race Condition

## **📊 การรายงานและการส่งออก (Reporting & Exports)**

### **วิวสำหรับการรายงาน (Reporting Views) (จาก SQL)**

การรายงานควรสร้างขึ้นจาก Views ที่กำหนดไว้ล่วงหน้าในฐานข้อมูลเป็นหลัก:

- v_current_correspondences: สำหรับ revision ปัจจุบันทั้งหมดของเอกสารที่ไม่ใช่ RFA
- v_current_rfas: สำหรับ revision ปัจจุบันทั้งหมดของ RFA และข้อมูล master
- v_contract_parties_all: สำหรับการตรวจสอบความสัมพันธ์ของ project/contract/organization
- v_user_tasks: สำหรับ Dashboard "งานของฉัน"
- v_audit_log_details: สำหรับ Activity Feed

Views เหล่านี้ทำหน้าที่เป็นแหล่งข้อมูลหลักสำหรับการรายงานฝั่งเซิร์ฟเวอร์และการส่งออกข้อมูล

### **กฎการส่งออก (Export Rules)**

- Export formats: CSV, Excel, PDF.
- จัดเตรียมมุมมองสำหรับพิมพ์ (Print view).
- รวมลิงก์ไปยังต้นทาง (เช่น /rfas/:id).

## **🧮 ฟรอนต์เอนด์: รูปแบบ DataTable และฟอร์ม (Frontend: DataTable & Form Patterns)**

### **DataTable (Server‑Side)**

- Endpoint: /api/{module}?page=1\&pageSize=20\&sort=...\&filter=...
- ต้องรองรับ: การแบ่งหน้า (pagination), การเรียงลำดับ (sorting), การค้นหา (search), การกรอง (filters)
- แสดง revision ล่าสุดแบบ inline เสมอ (สำหรับ RFA/Drawing)

### **มาตรฐานฟอร์ม (Form Standards)**

- ต้องมีการใช้งาน Dropdowns แบบขึ้นต่อกัน (Dependent dropdowns) (ตามที่สคีมารองรับ):
  - Project → Contract Drawing Volumes
  - Contract Drawing Category → Sub-Category
  - RFA (ประเภท Shop Drawing) → Shop Drawing Revisions ที่เชื่อมโยงได้
- **(ใหม่)** การอัปโหลดไฟล์: ต้องรองรับ **Multi-file upload (Drag-and-Drop)** [cite: 5.7]
- **(ใหม่)** UI ต้องอนุญาตให้ผู้ใช้กำหนดว่าไฟล์ใดเป็น **"เอกสารหลัก"** หรือ "เอกสารแนบประกอบ" [cite: 5.7]
- ส่ง (Submit) ผ่าน API พร้อม feedback แบบ toast

### **ข้อกำหนด Component เฉพาะ (Specific UI Requirements)**

- **Dashboard \- My Tasks:** ต้องพัฒนา Component ตาราง "งานของฉัน" (My Tasks)ซึ่งดึงข้อมูลงานที่ผู้ใช้ล็อกอินอยู่ต้องรับผิดชอบ (Main/Action) จาก v\user\tasks [cite: 5.3]
- **Workflow Visualization:** ต้องพัฒนา Component สำหรับแสดงผล Workflow (โดยเฉพาะ RFA)ที่แสดงขั้นตอนทั้งหมดเป็นลำดับ โดยขั้นตอนปัจจุบัน (active) เท่านั้นที่ดำเนินการได้ และขั้นตอนอื่นเป็น disabled [cite: 5.6] ต้องมีตรรกะสำหรับ Admin ในการ override หรือย้อนกลับขั้นตอนได้ [cite: 5.6]
- ** Admin Panel:** ต้องมีหน้า UI สำหรับ Superadmin/Admin เพื่อจัดการข้อมูลหลัก (Master Data [cite: 4.5]), การเริ่มต้นใช้งาน (Onboarding [cite: 4.6]), และ **รูปแบบเลขที่เอกสาร (Numbering Formats [cite: 3.10])**

## **🧭 แดชบอร์ดและฟีดกิจกรรม (Dashboard & Activity Feed)**

### **การ์ดบนแดชบอร์ด (Dashboard Cards)**

- แสดง Correspondences, RFAs, Circulations, Shop Drawing Revision ล่าสุด
- รวมสรุป KPI (เช่น "RFAs ที่รอการอนุมัติ", "Shop Drawing ที่รอการอนุมัติ") [cite: 5.3]
- รวมลิงก์ด่วนไปยังโมดูลต่างๆ

### **ฟีดกิจกรรม (Activity Feed)**

- แสดงรายการ v\audit\log\details ล่าสุด (10 รายการ) ที่เกี่ยวข้องกับผู้ใช้

// ตัวอย่าง API response
[
{ user: 'editor01', action: 'Updated RFA (LCBP3-RFA-001)', time: '2025-11-04T09:30Z' }
]

## **🛡️ ข้อกำหนดที่ไม่ใช่ฟังก์ชันการทำงาน (Non-Functional Requirements)**

ส่วนนี้สรุปข้อกำหนด Non-Functional จาก requirements.md เพื่อให้ทีมพัฒนาทราบ

- **Audit Log [cite: 6.1]:** ทุกการกระทำที่สำคัญ (C/U/D) ต้องถูกบันทึกใน audit_logs
- **Performance [cite: 6.4]:** ต้องใช้ Caching สำหรับข้อมูลที่เรียกบ่อย และใช้ Pagination
- **Security [cite: 6.5]:** ต้องมี Rate Limiting และจัดการ Secret ผ่าน docker-compose.yml (ไม่ใช่ .env)
- **(ใหม่) Backup & Recovery [cite: 6.6]:** ต้องมีแผนสำรองข้อมูลทั้ง Database (MariaDB) และ File Storage (/share/dms-data) อย่างน้อยวันละ 1 ครั้ง
- **(ใหม่) Notification Strategy [cite: 6.7]:** ระบบแจ้งเตือน (Email/Line) ต้องถูก Trigger เมื่อมีเอกสารใหม่ส่งถึง, มีการมอบหมายงานใหม่ (Circulation), หรือ (ทางเลือก) เมื่องานเสร็จ/ใกล้ถึงกำหนด

## **✅ มาตรฐานที่นำไปใช้แล้ว (จาก SQL v1.1.0) (Implemented Standards (from SQL v1.1.0))**

ส่วนนี้ยืนยันว่าแนวทางปฏิบัติที่ดีที่สุดต่อไปนี้เป็นส่วนหนึ่งของการออกแบบฐานข้อมูลอยู่แล้ว และควรถูกนำไปใช้ประโยชน์ ไม่ใช่สร้างขึ้นใหม่

- ✅ **Soft Delete:** นำไปใช้แล้วผ่านคอลัมน์ deleted_at ในตารางสำคัญ (เช่น correspondences, rfas, project_parties) ตรรกะการดึงข้อมูลต้องกรอง deleted_at IS NULL
- ✅ **Database Indexes:** สคีมาได้มีการทำ index ไว้อย่างหนักหน่วงบน foreign keys และคอลัมน์ที่ใช้ค้นหาบ่อย (เช่น idx_rr_rfa, idx_cor_project, idx_cr_is_current) เพื่อประสิทธิภาพ
- ✅ **โครงสร้าง RBAC:** มีระบบ users, roles, permissions, user_roles, และ user_project_roles ที่ครอบคลุมอยู่แล้ว
- ✅ **Data Seeding:** ข้อมูล Master (roles, permissions, organization_roles, initial users, project parties) ถูกรวมอยู่ในสคริปต์สคีมาแล้ว

## **🧩 การปรับปรุงที่แนะนำ (สำหรับอนาคต) (Recommended Enhancements (Future))**

- ✅ สร้าง Background job (โดยใช้ **n8n** เพื่อเชื่อมต่อกับ **Line** [cite: 2.7] และ/หรือใช้สำหรับการแจ้งเตือน RFA ที่ใกล้ถึงกำหนด due_date [cite: 6.7])
- ✅ เพิ่ม job ล้างข้อมูลเป็นระยะสำหรับ attachments ที่ไม่ถูกเชื่อมโยงกับ Entity ใดๆ เลย (ไฟล์กำพร้า)
