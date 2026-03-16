# 📝 **Documents Management System Version 1.6.1: แนวทางการพัฒนา FullStackJS**

**สถานะ:**
**วันที่:** 2026-02-24
**อ้างอิง:** Requirements Specification v1.8.0
**Classification:** Internal Technical Documentation

## 🧠 **1. ปรัชญาทั่วไป (General Philosophy)**

แนวทางปฏิบัติที่ดีที่สุดแบบครบวงจรสำหรับการพัฒนา NestJS Backend, NextJS Frontend และ Tailwind-based UI/UX ในสภาพแวดล้อม TypeScript มุ่งเน้นที่ **"Data Integrity First"** (ความถูกต้องของข้อมูลต้องมาก่อน) ตามด้วย Security และ UX

- **ความชัดเจน (clarity), ความง่ายในการบำรุงรักษา (maintainability), ความสอดคล้องกัน (consistency) และ การเข้าถึงได้ (accessibility)** ตลอดทั้งสแต็ก
- **Strict Typing:** ใช้ TypeScript อย่างเคร่งครัด ห้าม `any`
- **Consistency:** ใช้ภาษาอังกฤษใน Code / ภาษาไทยใน Comment
- **Resilience:** ระบบต้องทนทานต่อ Network Failure และ Race Condition

## ⚙️ **2. แนวทางทั่วไปสำหรับ TypeScript**

### **2.1 หลักการพื้นฐาน**

- ใช้ **ภาษาอังกฤษ** สำหรับโค้ด
- ใช้ **ภาษาไทย** สำหรับ comment และเอกสารทั้งหมด
- กำหนดไทป์ (type) อย่างชัดเจนสำหรับตัวแปร, พารามิเตอร์ และค่าที่ส่งกลับ (return values) ทั้งหมด
- หลีกเลี่ยงการใช้ any; ให้สร้างไทป์ (types) หรืออินเทอร์เฟซ (interfaces) ที่กำหนดเอง
- ใช้ **JSDoc** สำหรับคลาส (classes) และเมธอด (methods) ที่เป็น public
- ส่งออก (Export) **สัญลักษณ์หลัก (main symbol) เพียงหนึ่งเดียว** ต่อไฟล์
- หลีกเลี่ยงบรรทัดว่างภายในฟังก์ชัน
- ระบุ // File: path/filename ในบรรทัดแรกของทุกไฟล์
- ระบุ // บันทึกการแก้ไข, หากมีการแก้ไขเพิ่มในอนาคต ให้เพิ่มบันทึก

### **2.2 Configuration & Secrets Management**

- **Production/Staging:**
  - ใช้ Docker secrets หรือ environment variables ที่ inject ผ่าน CI/CD
  - พิจารณา Hashicorp Vault หรือ AWS Secrets Manager สำหรับ production
  - ห้ามใส่ Secrets (Password, Keys) ใน `docker-compose.yml` หลัก
- **Development:**
  - ใช้ `docker-compose.override.yml` (gitignored) สำหรับ local secrets
  - ไฟล์ `docker-compose.yml` หลักใช้ค่า dummy/placeholder
- **Validation:**
  - ใช้ `joi` หรือ `zod` ในการ Validate Environment Variables ตอน Start App หากขาดตัวแปรสำคัญให้ Throw Error ทันที

### **2.3 Idempotency (ความสามารถในการทำซ้ำได้)**

- สำหรับการทำงานที่สำคัญ (Create Document, Approve, Transactional) **ต้อง** ออกแบบให้เป็น Idempotent
- Client **ต้อง** ส่ง Header `Idempotency-Key` (UUID) มากับ Request
- Server **ต้อง** ตรวจสอบว่า Key นี้เคยถูกประมวลผลสำเร็จไปแล้วหรือไม่ ถ้าใช่ ให้คืนค่าเดิมโดยไม่ทำซ้ำ

### **2.4 ข้อตกลงในการตั้งชื่อ (Naming Conventions)**

| Entity (สิ่งที่ตั้งชื่อ)      | Convention (รูปแบบ) | Example (ตัวอย่าง)                   |
| :-------------------- | :----------------- | :--------------------------------- |
| Classes               | PascalCase         | UserService                        |
| Property              | snake_case         | user_id                            |
| Variables & Functions | camelCase          | getUserInfo                        |
| Files & Folders       | kebab-case         | user-service.ts                    |
| Environment Variables | UPPERCASE          | DATABASE_URL                       |
| Booleans              | Verb + Noun        | isActive, canDelete, hasPermission |

ใช้คำเต็ม — ไม่ใช้อักษรย่อ — ยกเว้นคำมาตรฐาน (เช่น API, URL, req, res, err, ctx)

### 🧩**2.5 ฟังก์ชัน (Functions)**

- เขียนฟังก์ชันให้สั้น และทำ **หน้าที่เพียงอย่างเดียว** (single-purpose) (\< 20 บรรทัด)
- ใช้ **early returns** เพื่อลดการซ้อน (nesting) ของโค้ด
- ใช้ **map**, **filter**, **reduce** แทนการใช้ loops เมื่อเหมาะสม
- ควรใช้ **arrow functions** สำหรับตรรกะสั้นๆ, และใช้ **named functions** ในกรณีอื่น
- ใช้ **default parameters** แทนการตรวจสอบค่า null
- จัดกลุ่มพารามิเตอร์หลายตัวให้เป็นอ็อบเจกต์เดียว (RO-RO pattern)
- ส่งค่ากลับ (Return) เป็นอ็อบเจกต์ที่มีไทป์กำหนด (typed objects) ไม่ใช่ค่าพื้นฐาน (primitives)
- รักษาระดับของสิ่งที่เป็นนามธรรม (abstraction level) ให้เป็นระดับเดียวในแต่ละฟังก์ชัน

### 🧱**2.6 การจัดการข้อมูล (Data Handling)**

- ห่อหุ้มข้อมูล (Encapsulate) ในไทป์แบบผสม (composite types)
- ใช้ **immutability** (การไม่เปลี่ยนแปลงค่า) ด้วย readonly และ as const
- ทำการตรวจสอบความถูกต้องของข้อมูล (Validations) ในคลาสหรือ DTOs ไม่ใช่ภายในฟังก์ชันทางธุรกิจ
- ตรวจสอบความถูกต้องของข้อมูลโดยใช้ DTOs ที่มีไทป์กำหนดเสมอ

### 🧰**2.7 คลาส (Classes)**

- ปฏิบัติตามหลักการ **SOLID**
- ควรใช้ **composition มากกว่า inheritance** (Prefer composition over inheritance)
- กำหนด **interfaces** สำหรับสัญญา (contracts)
- ให้คลาสมุ่งเน้นการทำงานเฉพาะอย่างและมีขนาดเล็ก (\< 200 บรรทัด, \< 10 เมธอด, \< 10 properties)

### 🚨**2.8 การจัดการข้อผิดพลาด (Error Handling)**

- ใช้ Exceptions สำหรับข้อผิดพลาดที่ไม่คาดคิด
- ดักจับ (Catch) ข้อผิดพลาดเพื่อแก้ไขหรือเพิ่มบริบท (context) เท่านั้น; หากไม่เช่นนั้น ให้ใช้ global error handlers
- ระบุข้อความข้อผิดพลาด (error messages) ที่มีความหมายเสมอ

### 🧪**2.9 การทดสอบ (ทั่วไป) (Testing (General))**

- ใช้รูปแบบ **Arrange–Act–Assert**
- ใช้ชื่อตัวแปรในการทดสอบที่สื่อความหมาย (inputData, expectedOutput)
- เขียน **unit tests** สำหรับ public methods ทั้งหมด
- จำลอง (Mock) การพึ่งพาภายนอก (external dependencies)
- เพิ่ม **acceptance tests** ต่อโมดูลโดยใช้รูปแบบ Given–When-Then

### **Testing Strategy โดยละเอียด**

- **Test Pyramid Structure**

      /\

  / \ E2E Tests (10%)
  /\_**\_\ Integration Tests (20%)
  / \ Unit Tests (70%)
  /**\_\_\*\*\*\*\

- **Testing Tools Stack**

```typescript
// Backend Testing Stack
const backendTesting = {
  unit: ['Jest', 'ts-jest', '@nestjs/testing'],
  integration: ['Supertest', 'Testcontainers', 'Jest'],
  e2e: ['Supertest', 'Jest', 'Database Seeds'],
  security: ['Jest', 'Custom Security Test Helpers'],
  performance: ['Jest', 'autocannon', 'artillery'],
};

// Frontend Testing Stack
const frontendTesting = {
  unit: ['Vitest', 'React Testing Library'],
  integration: ['React Testing Library', 'MSW'],
  e2e: ['Playwright', 'Jest'],
  visual: ['Playwright', 'Loki'],
};
```

- **Test Data Management**

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
  performance: 'Load and stress conditions',
};
```

## 🏗️ **3. แบ็กเอนด์ (NestJS) - Implementation Details**

### **3.1 หลักการ**

- **สถาปัตยกรรมแบบโมดูลาร์ (Modular architecture)**:
  - หนึ่งโมดูลต่อหนึ่งโดเมน
  - โครงสร้างแบบ Controller → Service → Repository (Model)
- API-First: มุ่งเน้นการสร้าง API ที่มีคุณภาพสูง มีเอกสารประกอบ (Swagger) ที่ชัดเจนสำหรับ Frontend Team
- DTOs ที่ตรวจสอบความถูกต้องด้วย **class-validator**
- ใช้ **MikroORM** (หรือ TypeORM/Prisma) สำหรับการคงอยู่ของข้อมูล (persistence) ซึ่งสอดคล้องกับสคีมา MariaDB
- ห่อหุ้มโค้ดที่ใช้ซ้ำได้ไว้ใน **common module** (@app/common):
  - Configs, decorators, DTOs, guards, interceptors, notifications, shared services, types, validators

### **3.1.1 NestJS 11 Patterns (Updated 2026-03-16)**

| Pattern | คำอธิบาย |
| :--- | :--- |
| **`import type` สำหรับ decorated signatures** | เมื่อ `isolatedModules` + `emitDecoratorMetadata` เปิดอยู่ ต้องใช้ `import type` สำหรับ interface ที่ใช้ใน decorated parameter (เช่น `@Req() req: RequestWithUser`) |
| **Shared `RequestWithUser` interface** | ใช้ `src/common/interfaces/request-with-user.interface.ts` แทนการประกาศ local interface ในแต่ละ controller — ห้ามใช้ `req: any` |
| **`@nestjs/mapped-types` ถูกลบออก** | DTO utility types (`PartialType`, `OmitType`, `IntersectionType`) ต้อง import จาก `@nestjs/swagger` เท่านั้น |
| **Express v5** | `@nestjs/platform-express` v11 ใช้ Express 5 — path parameter syntax เปลี่ยน (`:id` → `:id` ยังใช้ได้ แต่ wildcard `*` → `*name`) |
| **Swagger version** | Swagger doc version ต้องตรงกับ project version ปัจจุบัน (`1.8.1`) |

```typescript
// ✅ ถูกต้อง — NestJS 11 pattern
import type { RequestWithUser } from '../interfaces/request-with-user.interface';

@Get('profile')
getProfile(@Req() req: RequestWithUser) {
  return req.user;
}

// ❌ ห้ามใช้
@Get('profile')
getProfile(@Req() req: any) { ... }
```

### **3.2 Database & Data Modeling (MariaDB + TypeORM)**

#### **3.2.1 Optimistic Locking & Versioning**

เพื่อป้องกัน Race Condition ในการแก้ไขข้อมูลพร้อมกัน (โดยเฉพาะการรันเลขที่เอกสาร) ให้เพิ่ม Column `@VersionColumn()` ใน Entity ที่สำคัญ

```typescript
@Entity()
export class DocumentCounter {
  // ... fields
  @Column()
  last_number: number;

  @VersionColumn() // เพิ่ม Versioning
  version: number;
}
```

#### **3.2.2 Virtual Columns for JSON Performance**

เนื่องจากเราใช้ MariaDB 11.8 และมีการเก็บข้อมูล JSON (Details) ให้ใช้ **Generated Columns (Virtual)** สำหรับ Field ที่ต้อง Search/Sort บ่อยๆ และทำ Index บน Virtual Column นั้น

```sql
-- ตัวอย่าง SQL Migration
ALTER TABLE correspondence_revisions
ADD COLUMN ref_project_id INT GENERATED ALWAYS AS (JSON_UNQUOTE(JSON_EXTRACT(details, '$.projectId'))) VIRTUAL;
CREATE INDEX idx_ref_project_id ON correspondence_revisions(ref_project_id);
```

#### **3.2.3 Partitioning Strategy**

- สำหรับตาราง `audit_logs` และ `notifications` ให้เตรียมออกแบบ Entity ให้รองรับ Partitioning (เช่น แยกตามปี) โดยใช้ Raw SQL Migration ในการสร้างตาราง
- Automated Partition Maintenance: ต้องมี Cron Job (Scheduled Task) เพื่อตรวจสอบและสร้าง Partition สำหรับปี/เดือนถัดไปล่วงหน้า (Pre-create partitions) อย่างน้อย 1 เดือน เพื่อป้องกัน Insert Error เมื่อขึ้นช่วงเวลาใหม่

### **3.3 File Storage Service (Two-Phase Storage)**

ปรับปรุง Service จัดการไฟล์ให้รองรับ Transactional Integrity

1. **Upload (Phase 1):**
   - รับไฟล์ → Scan Virus (ClamAV) → Save ลงโฟลเดอร์ `temp/`
   - Return `temp_id` และ Metadata กลับไปให้ Client
2. **Commit (Phase 2):**
   - เมื่อ Business Logic (เช่น Create Correspondence) ทำงานสำเร็จ
   - Service จะย้ายไฟล์จาก `temp/` ไปยัง `permanent/{YYYY}/{MM}/`
   - Update path ใน Database
   - ทั้งหมดนี้ต้องอยู่ภายใต้ Database Transaction เดียวกัน (ถ้า DB Fail, ไฟล์จะค้างที่ Temp และถูกลบโดย Cron Job)
3. **Cleanup:**
   - มี Cron Job ลบไฟล์ใน temp/ ที่ค้างเกิน 24 ชม. (Orphan Files) โดยต้องตรวจสอบเงื่อนไขความปลอดภัยเพิ่มเติม:
     - ไฟล์ต้องมี created_at เกิน 24 ชั่วโมง
     - ไฟล์ต้องไม่อยู่ในสถานะ 'Locked' หรือกำลังถูก Process อยู่ (ตรวจสอบจาก Lock flag หรือ Transaction ID ถ้ามี)

### **3.4 Document Numbering (Double-Lock Mechanism)**

การออกเลขที่เอกสารต้องใช้กลไกความปลอดภัย 2 ชั้น:

1. **Layer 1 (Redis Lock):** ใช้ `redlock` เพื่อ Block ไม่ให้ Process อื่นเข้ามายุ่งกับ Counter ของ Project/Type นั้นๆ ชั่วคราว
2. **Layer 2 (Optimistic Lock):** ตอน Update Database ให้เช็ค `version` ถ้า version เปลี่ยน (แสดงว่า Redis Lock หลุดหรือมีคนแทรก) ให้ Throw Error และ Retry ใหม่

### **3.5 Unified Workflow Engine**

Unified Workflow Engine (Core Architecture)

- ระบบใช้ Workflow Engine เป็นหัวใจหลักในการขับเคลื่อน State ของเอกสาร:
  - DSL Based: Logic ทั้งหมดอยู่ที่ workflow_definitions.dsl
  - Instance Based: สถานะปัจจุบันอยู่ที่ workflow_instances
  - Module Integration:
    - CorrespondenceModule -> เรียก WorkflowEngine
    - RfaModule -> เรียก WorkflowEngine
    - CirculationModule -> เรียก WorkflowEngine
- ห้าม สร้างตาราง Routing แยก (เช่น rfa_workflows หรือ correspondence_routings) อีกต่อไป
- Boot-time Validation:
  - เมื่อ Application Start (Backend Boot), ระบบต้องทำการ Validate Workflow DSL Definitions ทั้งหมด ว่า Syntax ถูกต้องและ State Transitions เชื่อมโยงกันสมบูรณ์ หากพบข้อผิดพลาดให้ Alert หรือ Block Startup (ใน Development Mode) เพื่อป้องกัน Runtime Error

### **3.6 ฟังก์ชันหลัก (Core Functionalities)**

- Global **filters** สำหรับการจัดการ exception
- **Middlewares** สำหรับการจัดการ request
- **Guards** สำหรับการอนุญาต (permissions) และ RBAC
- **Interceptors** สำหรับการแปลงข้อมูล response และการบันทึก log

### **3.7 ข้อจำกัดในการ Deploy (QNAP Container Station)**

- **ห้ามใช้ไฟล์ .env** ในการตั้งค่า Environment Variables [cite: 2.1]

### **3.8 ข้อจำกัดด้านความปลอดภัย (Security Constraints):**

- **File Upload Security:** ต้องมี virus scanning (ClamAV), file type validation (white-list), และ file size limits (50MB)
- **Input Validation:** ต้องป้องกัน OWASP Top 10 vulnerabilities (SQL Injection, XSS, CSRF)
- **Rate Limiting:** ต้อง implement rate limiting ตาม strategy ที่กำหนด
- **Secrets Management:** ต้องมี mechanism สำหรับจัดการ sensitive secrets อย่างปลอดภัย แม้จะใช้ docker-compose.yml

### **3.9 โครงสร้างโมดูลตามโดเมน (Domain-Driven Module Structure)**

เพื่อให้สอดคล้องกับสคีมา SQL (LCBP3-DMS) เราจะใช้โครงสร้างโมดูลแบบ **Domain-Driven (แบ่งตามขอบเขตธุรกิจ)** แทนการแบ่งตามฟังก์ชัน:

#### 3.9.1 **CommonModule:**

- เก็บ Services ที่ใช้ร่วมกัน เช่น DatabaseModule, FileStorageService (จัดการไฟล์ใน QNAP), AuditLogService, NotificationService
- จัดการ audit_logs
- NotificationService ต้องรองรับ Triggers ที่ระบุใน Requirement 6.7 [cite: 6.7]

#### 3.9.2 **AuthModule:**

- จัดการะการยืนยันตัวตน (JWT, Guards)
- **(สำคัญ)** ต้องรับผิดชอบการตรวจสอบสิทธิ์ **4 ระดับ** [cite: 4.2]: สิทธิ์ระดับระบบ (Global Role), สิทธิ์ระดับองกรณ์ (Organization Role), สิทธิ์ระดับโปรเจกต์ (Project Role), และ สิทธิ์ระดับสัญญา (Contract Role)
- **(สำคัญ)** ต้องมี API สำหรับ **Admin Panel** เพื่อ:
  - สร้างและจัดการ Role และการจับคู่ Permission แบบไดนามิก [cite: 4.3]
  - ให้ Superadmin สร้าง Organizations และกำหนด Org Admin ได้ [cite: 4.6]
  - ให้ Superadmin/Admin จัดการ document_number_formats (รูปแบบเลขที่เอกสาร), document_number_counters (Running Number) [cite: 3.10]

#### 3.9.3 **UserModule:**

- จัดการ users, roles, permissions, global_default_roles, role_permissions, user_roles, user_project_roles
- **(สำคัญ)** ต้องมี API สำหรับ **Admin Panel** เพื่อ:
  - สร้างและจัดการ Role และการจับคู่ Permission แบบไดนามิก [cite: 4.3]

#### 3.9.4 **ProjectModule:**

- จัดการ projects, organizations, contracts, project_parties, contract_parties

#### 3.9.5 **MasterModule:**

- จัดการ master data (correspondence_types, rfa_types, rfa_status_codes, rfa_approve_codes, circulation_status_codes, correspondence_types, correspondence_status, tags) [cite: 4.5]

#### 3.9.6 **CorrespondenceModule (โมดูลศูนย์กลาง):**

- จัดการ correspondences, correspondence_revisions, correspondence_tags
- **(สำคัญ)** Service นี้ต้อง Inject DocumentNumberingService เพื่อขอเลขที่เอกสารใหม่ก่อนการสร้าง
- **(สำคัญ)** ตรรกะการสร้าง/อัปเดต Revision จะอยู่ใน Service นี้
- จัดการ correspondence_attachments (ตารางเชื่อมไฟล์แนบ)
- รับผิดชอบ Routing **Correspondence WorkflowService** เป็น Adapter เชื่อมต่อกับ Engine สำหรับการส่งต่อเอกสารทั่วไประหว่างองค์กร

#### 3.9.7 **RfaModule:**

- จัดการ rfas, rfa_revisions, rfa_items
- รับผิดชอบเวิร์กโฟลว์ **"RFA WorkflowService"** เป็น Adapter เชื่อมต่อกับ Engine สำหรับการอนุมัติเอกสารทางเทคนิค

#### 3.9.8 **DrawingModule:**

- จัดการ shop_drawings, shop_drawing_revisions, contract_drawings, contract_drawing_volumes, contract_drawing_cats, contract_drawing_sub_cats, shop_drawing_main_categories, shop_drawing_sub_categories, contract_drawing_subcat_cat_maps, shop_drawing_revision_contract_refs
- จัดการ shop_drawing_revision_attachments และ contract_drawing_attachments(ตารางเชื่อมไฟล์แนบ)

#### 3.9.9 **CirculationModule:**

- จัดการ circulations, circulation_templates, circulation_assignees
- จัดการ circulation_attachments (ตารางเชื่อมไฟล์แนบ)
- รับผิดชอบเวิร์กโฟลว์ **"Circulations WorkflowService"** เป็น Adapter เชื่อมต่อกับ Engine สำหรับการเวียนเอกสาร **ภายในองค์กร**

#### 3.9.10 **TransmittalModule:**

- จัดการ transmittals และ transmittal_items

#### 3.9.11 **SearchModule:**

- ให้บริการค้นหาขั้นสูง (Advanced Search) [cite: 6.2] โดยใช้ **Elasticsearch** เพื่อรองรับการค้นหาแบบ Full-text จากชื่อเรื่อง, รายละเอียด, เลขที่เอกสาร, ประเภท, วันที่, และ Tags
- ระบบจะใช้ Elasticsearch Engine ในการจัดทำดัชนีเพื่อการค้นหาข้อมูลเชิงลึกจากเนื้อหาของเอกสาร โดยข้อมูลจะถูกส่งไปทำดัชนีจาก Backend (NestJS) ทุกครั้งที่มีการสร้างหรือแก้ไขเอกสาร

#### 3.9.12 **DocumentNumberingModule:**

- **สถานะ:** เป็น Module ภายใน (Internal Module) ไม่เปิด API สู่ภายนอก
- **หน้าที่:** ให้บริการ `DocumentNumberingService` แบบ **Token-Based Generator**
- **Logic ใหม่ (v1.4.4):**
  - รับ Context: `{ projectId, orgId, typeId, disciplineId?, subTypeId?, year }`
  - ดึง Template จาก DB
  - Parse Template เพื่อหาว่าต้องใช้ Key ใดบ้างในการทำ Grouping Counter (เช่น ถ้า Template มี `{DISCIPLINE}` ให้ใช้ `discipline_id` ในการ query counter)
  - ใช้ **Double-Lock Mechanism** (Redis + Optimistic DB Lock) ในการดึงและอัพเดทค่า `last_number`
    - Lock Timeout: การ Acquire Redis Lock ต้องกำหนด TTL (Time-to-Live) ที่สั้นและเหมาะสม (เช่น 2-5 วินาที) เพื่อป้องกัน Deadlock กรณี Service Crash ระหว่างทำงาน
    - Retry Logic: ต้องมี Retry mechanism แบบ Exponential Backoff (แนะนำ 3-5 ครั้ง) หากไม่สามารถ Acquire Lock ได้
- **Features:**
  - Application-level locking เพื่อป้องกัน race condition
  - Retry mechanism ด้วย exponential backoff
  - Fallback mechanism เมื่อการขอเลขล้มเหลว
  - Audit log ทุกครั้งที่มีการ generate เลขที่เอกสารใหม่

#### 3.9.13 **CorrespondenceRoutingModule:**

- **สถานะ:** โมดูลหลักสำหรับจัดการการส่งต่อเอกสาร
- **หน้าที่:** จัดการแม่แบบการส่งต่อและการส่งต่อจริง
- **Entities:**
  - CorrespondenceRoutingTemplate
  - CorrespondenceRoutingTemplateStep
  - CorrespondenceRouting
- **Features:**
  - สร้างและจัดการแม่แบบการส่งต่อ
  - ดำเนินการส่งต่อเอกสารตามแม่แบบ
  - ติดตามสถานะการส่งต่อ
  - คำนวณวันครบกำหนดอัตโนมัติ
  - ส่งการแจ้งเตือนเมื่อมีการส่งต่อใหม่

#### 3.9.14 WorkflowEngineModule (New Core)

- Entities: WorkflowDefinition, WorkflowInstance, WorkflowHistory
- Services: WorkflowEngineService, WorkflowDslService, WorkflowEventService
- Responsibility: จัดการ State Machine, Validate DSL, Execute Transitions

#### 3.9.15 **JsonSchemaModule:**

- **สถานะ:** Internal Module สำหรับจัดการ JSON schemas
- **หน้าที่:** Validate, transform, และ manage JSON data structures
- **Features:**
  - JSON schema validation ด้วย AJV
  - Schema versioning และ migration
  - Dynamic schema generation
  - Data transformation และ sanitization

#### 3.9.16 **DetailsService:**

- **สถานะ:** Shared Service สำหรับจัดการ details fields
- **หน้าที่:** Centralized service สำหรับ JSON details operations
- **Methods:**
  - validateDetails(type: string, data: any): ValidationResult
  - transformDetails(input: any, targetVersion: string): any
  - sanitizeDetails(data: any): any
  - getDefaultDetails(type: string): any

### **3.10 สถาปัตยกรรมระบบ (System Architecture)**

โครงสร้างโมดูล (Module Structure) อ้างถึง Backend Development Plan v1.8.0

### **3.11 กลยุทธ์ความทนทานและการจัดการข้อผิดพลาด (Resilience & Error Handling Strategy)**

- **Circuit Breaker Pattern:** ใช้สำหรับ external service calls (Email, LINE, Elasticsearch)
- **Retry Mechanism:** ด้วย exponential backoff สำหรับ transient failures
- **Fallback Strategies:** Graceful degradation เมื่อบริการภายนอกล้มเหลว
- **Error Handling:** Error messages ต้องไม่เปิดเผยข้อมูล sensitive
- **Monitoring:** Centralized error monitoring และ alerting system

### **3.12 FileStorageService (ปรับปรุงใหม่):**

- **Virus Scanning:** Integrate ClamAV สำหรับ scan ไฟล์ที่อัปโหลดทั้งหมด
- **File Type Validation:** ใช้ white-list approach (PDF, DWG, DOCX, XLSX, ZIP)
- **File Size Limits:** 50MB ต่อไฟล์
- **Security Measures:**
  - เก็บไฟล์นอก web root
  - Download ผ่าน authenticated endpoint เท่านั้น
  - Download links มี expiration time (24 ชั่วโมง)
  - File integrity checks (checksum)
  - Access control checks ก่อนดาวน์โหลด

### **3.13 เเทคโนโลยีที่ใช้ (Technology Stack)**

| ส่วน                     | Library/Tool                                         | หมายเหตุ                                |
| ----------------------- | ---------------------------------------------------- | -------------------------------------- |
| **Framework**           | `@nestjs/core`, `@nestjs/common`                     | Core Framework                         |
| **Language**            | `TypeScript`                                         | ใช้ TypeScript ทั้งระบบ                   |
| **Database**            | `MariaDB 11.8`                                       | ฐานข้อมูลหลัก                             |
| **ORM**                 | `@nestjs/typeorm`, `typeorm`                         | 🗃️จัดการการเชื่อมต่อและ Query ฐานข้อมูล       |
| **Validation**          | `class-validator`, `class-transformer`               | 📦ตรวจสอบและแปลงข้อมูลใน DTO              |
| **Auth**                | `@nestjs/jwt`, `@nestjs/passport`, `passport-jwt`    | 🔐การยืนยันตัวตนด้วย JWT                    |
| **Authorization**       | `casl`                                               | 🔐จัดการสิทธิ์แบบ RBAC                      |
| **File Upload**         | `multer`                                             | 📁จัดการการอัปโหลดไฟล์                     |
| **Search**              | `@nestjs/elasticsearch`                              | 🔍สำหรับการค้นหาขั้นสูง                       |
| **Notification**        | `nodemailer`                                         | 📬ส่งอีเมลแจ้งเตือน                         |
| **Scheduling**          | `@nestjs/schedule`                                   | 📬สำหรับ Cron Jobs (เช่น แจ้งเตือน Deadline) |
| **Logging**             | `winston`                                            | 📊บันทึก Log ที่มีประสิทธิภาพ                  |
| **Testing**             | `@nestjs/testing`, `jest`, `supertest`               | 🧪ทดสอบ Unit, Integration และ E2E       |
| **Documentation**       | `@nestjs/swagger`                                    | 🌐สร้าง API Documentation อัตโนมัติ         |
| **Security**            | `helmet`, `rate-limiter-flexible`                    | 🛡️เพิ่มความปลอดภัยให้ API                   |
| **Resilience**          | `@nestjs/circuit-breaker`                            | 🔄 Circuit breaker pattern              |
| **Caching**             | `@nestjs/cache-manager`, `cache-manager-redis-store` | 💾 Distributed caching                  |
| **Security**            | `helmet`, `csurf`, `rate-limiter-flexible`           | 🛡️ Security enhancements                |
| **Validation**          | `class-validator`, `class-transformer`               | ✅ Input validation                     |
| **Monitoring**          | `@nestjs/monitoring`, `winston`                      | 📊 Application monitoring               |
| **File Processing**     | `clamscan`                                           | 🦠 Virus scanning                       |
| **Cryptography**        | `bcrypt`, `crypto`                                   | 🔐 Password hashing และ checksums       |
| **JSON Validation**     | `ajv`, `ajv-formats`                                 | 🎯 JSON schema validation               |
| **JSON Processing**     | `jsonpath`, `json-schema-ref-parser`                 | 🔧 JSON manipulation                    |
| **Data Transformation** | `class-transformer`                                  | 🔄 Object transformation                |
| **Compression**         | `compression`                                        | 📦 JSON compression                     |

### **3.14 Security Testing:**

- **Penetration Testing:** ทดสอบ OWASP Top 10 vulnerabilities
- **Security Audit:** Review code สำหรับ security flaws
- **Virus Scanning Test:** ทดสอบ file upload security
- **Rate Limiting Test:** ทดสอบ rate limiting functionality

### **3.15 Performance Testing:**

- **Load Testing:** ทดสอบด้วย realistic workloads
- **Stress Testing:** หา breaking points ของระบบ
- **Endurance Testing:** ทดสอบการทำงานต่อเนื่องเป็นเวลานาน

### 🗄️**3.16 Backend State Management**

Backend (NestJS) ควรเป็น **Stateless** (ไม่เก็บสถานะ) "State" ทั้งหมดจะถูกจัดเก็บใน MariaDB

- **Request-Scoped State (สถานะภายใน Request เดียว):**
  - **ปัญหา:** จะส่งต่อข้อมูล (เช่น User ที่ล็อกอิน) ระหว่าง Guard และ Service ใน Request เดียวกันได้อย่างไร?
  - **วิธีแก้:** ใช้ **Request-Scoped Providers** ของ NestJS (เช่น AuthContextService) เพื่อเก็บข้อมูล User ปัจจุบันที่ได้จาก AuthGuard และให้ Service อื่น Inject ไปใช้
- **Application-Scoped State (การ Caching):**
  - **ปัญหา:** ข้อมูล Master (เช่น roles, permissions, organizations) ถูกเรียกใช้บ่อย
  - **วิธีแก้:** ใช้ **Caching** (เช่น @nestjs/cache-manager) เพื่อ Caching ข้อมูลเหล่านี้ และลดภาระ Database

### **3.17 Caching Strategy (ตามข้อ 6.4.2):**

- **Master Data Cache:** Roles, Permissions, Organizations (TTL: 1 hour)
- **User Session Cache:** User permissions และ profile (TTL: 30 minutes)
- **Search Result Cache:** Frequently searched queries (TTL: 15 minutes)
- **File Metadata Cache:** Attachment metadata (TTL: 1 hour)
- **Cache Invalidation:** Clear cache on update/delete operations

### **3.18 การไหลของข้อมูล (Data Flow)**

#### **3.18.1 Main Flow:**

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

#### **3.18.2 Workflow Data Flow:**

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

#### **3.18.3 JSON Details Processing Flow:**

1. **Receive Request** → Get JSON data from client
2. **Schema Validation** → Validate against predefined schema
3. **Data Sanitization** → Sanitize and transform data
4. **Version Check** → Handle schema version compatibility
5. **Storage** → Store validated JSON in database
6. **Retrieval** → Retrieve and transform on demand

### 📊**3.19 Monitoring & Observability (ตามข้อ 6.8)**

#### **Application Monitoring:**

- **Health Checks:** `/health` endpoint สำหรับ load balancer
- **Metrics Collection:** Response times, error rates, throughput
- **Distributed Tracing:** สำหรับ request tracing across services
- **Log Aggregation:** Structured logging ด้วย JSON format
- **Alerting:** สำหรับ critical errors และ performance degradation

#### **Business Metrics:**

- จำนวน documents created ต่อวัน
- Workflow completion rates
- User activity metrics
- System utilization rates
- Search query performance

#### **Performance Targets:**

- API Response Time:
  - Simple CRUD: < 100ms
  - Complex Search: < 500ms
  - File Processing: < 2s
- File Upload Performance: < 30 seconds สำหรับไฟล์ 50MB
- Cache Hit Ratio: > 80%

### **3.20 Logging Strategy for QNAP Environment**

เนื่องจากระบบรันบน QNAP Container Station ซึ่งอาจมีข้อจำกัดเรื่อง Disk I/O และ Storage:

- Log Levels: ให้กำหนด Log Level ของ Production เป็น WARN หรือ ERROR เป็นหลัก
- Info Logs: ใช้ INFO เฉพาะ Flow ที่สำคัญทางธุรกิจเท่านั้น (เช่น Workflow State Change, Login Success/Fail, File Upload Commit)
- Console Logging: หลีกเลี่ยง console.log ปริมาณมาก (Verbose) ให้ใช้ Winston Logger ที่ Config ให้จัดการ Rotation และ Format ได้ดีกว่า
- Disable Debug: ปิด Debug Log ทั้งหมดใน Production Mode

## 🖥️ **4. ฟรอนต์เอนด์ (Next.js) - Implementation Details**

### **4.1 State Management & Offline Support**

#### **4.1.1 Auto-Save Drafts**

ใช้ **React Hook Form** ร่วมกับ **persist** mechanism สำหรับฟอร์มที่มีขนาดใหญ่ (เช่น RFA, Correspondence):

```typescript
// hooks/useAutoSaveForm.ts
export const useAutoSaveForm = (formKey: string, defaultValues: any) => {
  const { register, watch, setValue } = useForm({ defaultValues });

  // Auto-save เมื่อ form เปลี่ยนแปลง
  useEffect(() => {
    const subscription = watch((value) => {
      localStorage.setItem(`draft-${formKey}`, JSON.stringify(value));
    });
    return () => subscription.unsubscribe();
  }, [watch, formKey]);

  // Load draft เมื่อ component mount
  useEffect(() => {
    const draft = localStorage.getItem(`draft-${formKey}`);
    if (draft) {
      const parsed = JSON.parse(draft);
      Object.keys(parsed).forEach((key) => {
        setValue(key, parsed[key]);
      });
    }
  }, [formKey, setValue]);

  return { register };
};
```

#### **4.1.2 Silent Refresh Strategy**

ใช้ React Query สำหรับจัดการ token refresh อัตโนมัติ

```typescript
// lib/api/client.ts
const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
});

// React Query จะจัดการ token refresh อัตโนมัติผ่าน interceptors
```

### **4.2 Dynamic Form Generator**

เพื่อรองรับ JSON Schema หลากหลายรูปแบบ ให้สร้าง Component กลางที่รับ Schema แล้ว Gen Form ออกมา (ลดการแก้ Code บ่อยๆ)

- **Libraries:** แนะนำ `react-jsonschema-form` หรือสร้าง Wrapper บน `react-hook-form` ที่ Recursively render field ตาม Type
- **Validation:** ใช้ `ajv` ที่ฝั่ง Client เพื่อ Validate JSON ก่อน Submit
- Schema Dependencies: ตัว Generator ต้องรองรับ dependencies keyword ของ JSON Schema (หรือ ui:schema logic) เพื่อรองรับเงื่อนไขซับซ้อน เช่น "ถ้าเลือกประเภทเอกสารเป็น 'Shop Drawing' ให้แสดง Dropdown เลือก 'Main Category' เพิ่มขึ้นมา" (Conditional Rendering)

### **4.3 Mobile Responsiveness (Card View)**

ตารางข้อมูล (`DataTable`) ต้องมีความฉลาดในการแสดงผล:

- **Desktop:** แสดงเป็น Table ปกติ
- **Mobile:** แปลงเป็น **Card View** โดยอัตโนมัติ (ซ่อน Header, แสดง Label คู่ Value ในแต่ละ Card)

```tsx
// components/ui/responsive-table.tsx
<div className="hidden md:block">
  <Table>{/* Desktop View */}</Table>
</div>
<div className="md:hidden space-y-4">
  {data.map((item) => (
    <Card key={item.id}>
       {/* Mobile View: Render cells as list items */}
    </Card>
  ))}
</div>
```

### **4.4 Optimistic Updates**

ใช้ความสามารถของ **TanStack Query** (`onMutate`) เพื่ออัปเดต UI ทันที (เช่น เปลี่ยนสถานะจาก "รออ่าน" เป็น "อ่านแล้ว") แล้วค่อยส่ง Request ไป Server ถ้า Failed ค่อย Rollback

### **4.5 แนวทางการพัฒนาโค้ด (Code Implementation Guidelines)**

- ใช้ **early returns** เพื่อความชัดเจน
- ใช้คลาสของ **TailwindCSS** ในการกำหนดสไตล์เสมอ
- ควรใช้ class: syntax แบบมีเงื่อนไข (หรือ utility clsx) มากกว่าการใช้ ternary operators ใน class strings
- ใช้ **const arrow functions** สำหรับ components และ handlers
- Event handlers ให้ขึ้นต้นด้วย handle... (เช่น handleClick, handleSubmit)
- รวมแอตทริบิวต์สำหรับการเข้าถึง (accessibility) ด้วย:
  tabIndex="0", aria-label, onKeyDown, ฯลฯ
- ตรวจสอบให้แน่ใจว่าโค้ดทั้งหมด **สมบูรณ์**, **ผ่านการทดสอบ**, และ **ไม่ซ้ำซ้อน (DRY)**
- ต้อง import โมดูลที่จำเป็นต้องใช้อย่างชัดเจนเสมอ

### **4.6 UI/UX ด้วย React**

- ใช้ **semantic HTML**
- ใช้คลาสของ **Tailwind** ที่รองรับ responsive (sm:, md:, lg:)
- รักษาลำดับชั้นของการมองเห็น (visual hierarchy) ด้วยการใช้ typography และ spacing
- ใช้ **Shadcn** components (Button, Input, Card, ฯลฯ) เพื่อ UI ที่สอดคล้องกัน
- ทำให้ components มีขนาดเล็กและมุ่งเน้นการทำงานเฉพาะอย่าง
- ใช้ utility classes สำหรับการจัดสไตล์อย่างรวดเร็ว (spacing, colors, text, ฯลฯ)
- ตรวจสอบให้แน่ใจว่าสอดคล้องกับ **ARIA** และใช้ semantic markup

### **4.7 การตรวจสอบฟอร์มและข้อผิดพลาด (Form Validation & Errors)**

- ใช้ไลบรารีฝั่ง client เช่น zod และ react-hook-form
- แสดงข้อผิดพลาดด้วย **alert components** หรือข้อความ inline
- ต้องมี labels, placeholders, และข้อความ feedback

### **4.8 Error Handling & Resilience (Frontend)**

#### **4.8.1 Global Error Handling with React Query**

ใช้ **React Query** Error Boundaries สำหรับจัดการ errors แบบรวมศูนย์:

```typescript
// app/providers.tsx
export function QueryProvider({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: 1,
        staleTime: 5 * 60 * 1000, // 5 minutes
      },
      mutations: {
        onError: (error) => {
          // Global mutation error handling
          toast.error('Operation failed');
        },
      },
    },
  });

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
```

### **🧪4.9 Frontend Testing**

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

### **🗄️4.10 Frontend State Management (ปรับปรุง)**

### 🗄️4.10 Frontend State Management (ปรับปรุง)

สำหรับ Next.js App Router เราจะใช้ State Management แบบ Simplified โดยแบ่งเป็น 3 ระดับหลัก:

- 4.10.1. **Server State (สถานะข้อมูลจากเซิร์ฟเวอร์)**

  - **เครื่องมือ:** **TanStack Query (React Query)**
  - **ใช้เมื่อ:** จัดการข้อมูลที่ดึงมาจาก NestJS API ทั้งหมด
  - **ครอบคลุม:** รายการ correspondences, rfas, drawings, users, permissions
  - **ประโยชน์:** จัดการ Caching, Re-fetching, Background Sync อัตโนมัติ

- 4.10.2. **Form State (สถานะของฟอร์ม):**

  - **เครื่องมือ:** **React Hook Form** + **Zod** (สำหรับ validation)
  - **ใช้เมื่อ:** จัดการฟอร์มที่ซับซ้อนทั้งหมด
  - **ครอบคลุม:** ฟอร์มสร้าง/แก้ไข RFA, Correspondence, Circulation
  - **รวมฟีเจอร์:** Auto-save drafts ลง LocalStorage

- 4.10.3. **UI State (สถานะ UI ชั่วคราว):**

  - **เครื่องมือ:** **useState**, **useReducer** (ใน Component) หรือ **Zustand** (สำหรับ Global Client State เช่น Preferences, Auth)
  - **ใช้เมื่อ:** จัดการสถานะเฉพาะ Component หรือข้อมูลที่แชร์ทั้งแอปโดยไม่พึ่งพาเซิร์ฟเวอร์
  - **ครอบคลุม:** Modal เปิด/ปิด, Dropdown state, Loading states, Themes, Sidebar

- **ยกเลิกการใช้:**

  - ❌ Context API สำหรับ Server State (ใช้ React Query แทน)

- **ตัวอย่าง Implementation:**

```typescript
// ใช้ React Query สำหรับ data fetching
const { data: correspondences, isLoading } = useQuery({
  queryKey: ['correspondences', projectId],
  queryFn: () => api.getCorrespondences(projectId),
});

// ใช้ React Hook Form สำหรับ forms
const {
  register,
  handleSubmit,
  formState: { errors },
} = useForm({
  resolver: zodResolver(correspondenceSchema),
});
```

### 4.11 State Management Best Practices

#### **4.11.1 หลักการพื้นฐาน:**

- **Server State ≠ Client State:** แยก state ตามแหล่งที่มาให้ชัดเจน
- **ใช้ Tools ให้ถูกหน้าที่:** แต่ละ tool ใช้แก้ปัญหาที่เฉพาะเจาะจง
- **Avoid Over-engineering:** เริ่มจาก useState ก่อน แล้วค่อยขยายตามความจำเป็น

#### **4.11.2 Decision Framework:**

- **Server State:** ใช้ React Query หรือ SWR
- **Form State:** ใช้ React Hook Form หรือ Formik
- **UI State:** ใช้ useState/useReducer
- **Global App State:** ใช้ React Query หรือ Context API

#### **4.11.3 Performance Considerations:**

- ใช้ `useMemo` และ `useCallback` สำหรับ expensive computations
- ใช้ React Query's `select` option สำหรับ derived data
- หลีกเลี่ยง unnecessary re-renders ด้วย proper dependency arrays

## 🔐 **5. Security & Access Control (Full Stack Integration)**

### **5.1 CASL Integration (Shared Ability)**

- **Backend:** ใช้ CASL กำหนด Permission Rule
- **Frontend:** ให้ดึง Rule (JSON) จาก Backend มา Load ใส่ `@casl/react` เพื่อให้ Logic การ Show/Hide ปุ่ม ตรงกัน 100%

### **5.2 Maintenance Mode**

เพิ่ม Middleware (ทั้ง NestJS และ Next.js) เพื่อตรวจสอบ Flag ใน Redis:

- ถ้า `MAINTENANCE_MODE = true`
- **API:** Return `503 Service Unavailable` (ยกเว้น Admin IP)
- **Frontend:** Redirect ไปหน้า `/maintenance`

### **5.3 Idempotency Client**

สร้าง Axios Interceptor เพื่อ Generate `Idempotency-Key` สำหรับ POST/PUT/DELETE requests ทุกครั้ง

```typescript
// lib/api/client.ts
import { v4 as uuidv4 } from 'uuid';

apiClient.interceptors.request.use((config) => {
  if (['post', 'put', 'delete'].includes(config.method)) {
    config.headers['Idempotency-Key'] = uuidv4();
  }
  return config;
});
```

### **5.4 RBAC และการควบคุมสิทธิ์ (RBAC & Permission Control)**

ใช้ Decorators เพื่อบังคับใช้สิทธิ์การเข้าถึง โดยอ้างอิงสิทธิ์จากตาราง permissions

```typescript
@RequirePermission('rfas.respond') // ต้องตรงกับ 'permission_code'
@Put(':id')
updateRFA(@Param('id') id: string) {
  return this.rfaService.update(id);
}
```

#### **5.4.1 Roles (บทบาท)**

- **Superadmin**: ไม่มีข้อจำกัดใดๆ [cite: 4.3]
- **Admin**: มีสิทธิ์เต็มที่ในองค์กร [cite: 4.3]
- **Document Control**: เพิ่ม/แก้ไข/ลบ เอกสารในองค์กร [cite: 4.3]
- **Editor**: สามารถ เพิ่ม/แก้ไข เอกสารที่กำหนด [cite: 4.3]
- **Viewer**: สามารถดู เอกสาร [cite: 4.3]

#### **5.4.2 ตัวอย่าง Permissions (จากตาราง permissions)**

- rfas.view, rfas.create, rfas.respond, rfas.delete
- drawings.view, drawings.upload, drawings.delete
- corr.view, corr.manage
- transmittals.manage
- cirs.manage
- project_parties.manage

การจับคู่ระหว่าง roles และ permissions **เริ่มต้น** จะถูก seed ผ่านสคริปต์ (ดังที่เห็นในไฟล์ SQL)**อย่างไรก็ตาม AuthModule/UserModule ต้องมี API สำหรับ Admin เพื่อสร้าง Role ใหม่และกำหนดสิทธิ์ (Permissions) เพิ่มเติมได้ในภายหลัง** [cite: 4.3]

## 📊 **6. Notification & Background Jobs**

### **6.1 Digest Notification**

ห้ามส่ง Email ทันทีที่เกิด Event ให้:

1. Push Event ลง Queue (Redis/BullMQ)
2. มี Processor รอเวลา (เช่น 5 นาที) เพื่อ Group Events ที่คล้ายกัน (เช่น "คุณมีเอกสารรออนุมัติ 5 ฉบับ")
3. ส่ง Email เดียว (Digest) เพื่อลด Spam

## 🔗 **7. แนวทางการบูรณาการ Full Stack (Full Stack Integration Guidelines)**

| Aspect (แง่มุม)            | Backend (NestJS)           | Frontend (NextJS)             | UI Layer (Tailwind/Shadcn)             |
| :----------------------- | :------------------------- | :---------------------------- | :------------------------------------- |
| API                      | REST / GraphQL Controllers | API hooks ผ่าน fetch/axios/SWR | Components ที่รับข้อมูล                     |
| Validation (การตรวจสอบ)  | class-validator DTOs       | zod / react-hook-form         | สถานะของฟอร์ม/input ใน Shadcn           |
| Auth (การยืนยันตัวตน)       | Guards, JWT                | NextAuth / cookies            | สถานะ UI ของ Auth (loading, signed in) |
| Errors (ข้อผิดพลาด)        | Global filters             | Toasts / modals               | Alerts / ข้อความ feedback               |
| Testing (การทดสอบ)       | Jest (unit/e2e)            | Vitest / Playwright           | Visual regression                      |
| Styles (สไตล์)            | Scoped modules (ถ้าจำเป็น)    | Tailwind / Shadcn             | Tailwind utilities                     |
| Accessibility (การเข้าถึง) | Guards + filters           | ARIA attributes               | Semantic HTML                          |

## 🗂️ **8. ข้อตกลงเฉพาะสำหรับ DMS (LCBP3-DMS)**

ส่วนนี้ขยายแนวทาง FullStackJS ทั่วไปสำหรับโปรเจกต์ **LCBP3-DMS** โดยมุ่งเน้นไปที่เวิร์กโฟลว์การอนุมัติเอกสาร (Correspondence, RFA, Drawing, Contract, Transmittal, Circulation)

### 🧾**8.1 มาตรฐาน AuditLog (AuditLog Standard)**

บันทึกการดำเนินการ CRUD และการจับคู่ทั้งหมดลงในตาราง audit_logs

| Field (ฟิลด์)  | Type (จาก SQL) | Description (คำอธิบาย)                             |
| :----------- | :------------- | :----------------------------------------------- |
| audit_id     | BIGINT         | Primary Key                                      |
| user_id      | INT            | ผู้ใช้ที่ดำเนินการ (FK -> users)                        |
| action       | VARCHAR(100)   | rfa.create, correspondence.update, login.success |
| entity_type  | VARCHAR(50)    | ชื่อตาราง/โมดูล เช่น 'rfa', 'correspondence'         |
| entity_id    | VARCHAR(50)    | Primary ID ของระเบียนที่ได้รับผลกระทบ                 |
| details_json | JSON           | ข้อมูลบริบท (เช่น ฟิลด์ที่มีการเปลี่ยนแปลง)                 |
| ip_address   | VARCHAR(45)    | IP address ของผู้ดำเนินการ                           |
| user_agent   | VARCHAR(255)   | User Agent ของผู้ดำเนินการ                           |
| created_at   | TIMESTAMP      | Timestamp (UTC)                                  |

### 📂**8.2 การจัดการไฟล์ (File Handling)**

#### **8.2.1 มาตรฐานการอัปโหลดไฟล์ (File Upload Standard)**

- **Security-First Approach:** การอัปโหลดไฟล์ทั้งหมดจะถูกจัดการโดย FileStorageService ที่มี security measures ครบถ้วน
- ไฟล์จะถูกเชื่อมโยงไปยัง Entity ที่ถูกต้องผ่าน **ตารางเชื่อม (Junction Tables)** เท่านั้น:
  - correspondence_attachments (เชื่อม Correspondence กับ Attachments)
  - circulation_attachments (เชื่อม Circulation กับ Attachments)
  - shop_drawing_revision_attachments (เชื่อม Shop Drawing Revision กับ Attachments)
  - contract_drawing_attachments (เชื่อม Contract Drawing กับ Attachments)
- เส้นทางจัดเก็บไฟล์ (Upload path): อ้างอิงจาก Requirement 2.1 คือ /share/dms-data [cite: 2.1] โดย FileStorageService จะสร้างโฟลเดอร์ย่อยแบบรวมศูนย์ (เช่น /share/dms-data/uploads/{YYYY}/{MM}/[stored_filename])
- ประเภทไฟล์ที่อนุญาต: pdf, dwg, docx, xlsx, zip (ผ่าน white-list validation)
- ขนาดสูงสุด: **50 MB**
- จัดเก็บนอก webroot
- ให้บริการไฟล์ผ่าน endpoint ที่ปลอดภัย /files/:attachment_id/download

#### **8.2.2 Security Controls สำหรับ File Access:**

การเข้าถึงไฟล์ไม่ใช่การเข้าถึงโดยตรง endpoint /files/:attachment_id/download จะต้อง:

1. ค้นหาระเบียน attachment
2. ตรวจสอบว่า attachment_id นี้ เชื่อมโยงกับ Entity ใด (เช่น correspondence, circulation, shop_drawing_revision, contract_drawing) ผ่านตารางเชื่อม
3. ตรวจสอบว่าผู้ใช้มีสิทธิ์ (permission) ในการดู Entity ต้นทางนั้นๆ หรือไม่
4. ตรวจสอบ download token expiration (24 ชั่วโมง)
5. บันทึก audit log การดาวน์โหลด

### 🔟**8.3 การจัดการเลขที่เอกสาร (Document Numbering) [cite: 3.10]**

- **เป้าหมาย:** สร้างเลขที่เอกสาร (เช่น correspondence_number) โดยอัตโนมัติ ตามรูปแบบที่กำหนด
- **ตรรกะการนับ:** การนับ Running number (SEQ) จะนับแยกตาม Key: **Project + Originator Organization + Document Type + Year**
- **ตาราง SQL (Updated):**
  - `document_number_formats`: เก็บ Template String (เช่น `{PROJECT}-{CORR_TYPE}-{DISCIPLINE}-{SEQ:4}`)
  - `document_number_counters`: **Primary Key เปลี่ยนเป็น Composite Key ใหม่:** `(project_id, originator_id, type_id, discipline_id, current_year)` เพื่อรองรับการรันเลขแยกตามสาขา
- **การทำงาน:**
  - Service ต้องรองรับการ Resolve Token พิเศษ เช่น `{SUBTYPE_NUM}` ที่ต้องไป Join กับตาราง `correspondence_sub_types`
  - DocumentNumberingModule จะให้บริการ DocumentNumberingService
  - เมื่อ CorrespondenceModule ต้องการสร้างเอกสารใหม่, มันจะเรียก documentNumberingService.generateNextNumber(...)
  - Service นี้จะใช้ **Redis distributed locking** แทน stored procedure ซึ่งจะจัดการ Database Transaction และ Row Locking ภายใน Application Layer เพื่อรับประกันการป้องกัน Race Condition
  - มี retry mechanism และ fallback strategies

### 📊**8.4 การรายงานและการส่งออก (Reporting & Exports)**

#### **8.4.1 วิวสำหรับการรายงาน (Reporting Views) (จาก SQL)**

การรายงานควรสร้างขึ้นจาก Views ที่กำหนดไว้ล่วงหน้าในฐานข้อมูลเป็นหลัก:

- v_current_correspondences: สำหรับ revision ปัจจุบันทั้งหมดของเอกสารที่ไม่ใช่ RFA
- v_current_rfas: สำหรับ revision ปัจจุบันทั้งหมดของ RFA และข้อมูล master
- v_contract_parties_all: สำหรับการตรวจสอบความสัมพันธ์ของ project/contract/organization
- v_user_tasks: สำหรับ Dashboard "งานของฉัน"
- v_audit_log_details: สำหรับ Activity Feed

Views เหล่านี้ทำหน้าที่เป็นแหล่งข้อมูลหลักสำหรับการรายงานฝั่งเซิร์ฟเวอร์และการส่งออกข้อมูล

#### **8.4.2 กฎการส่งออก (Export Rules)**

- Export formats: CSV, Excel, PDF.
- จัดเตรียมมุมมองสำหรับพิมพ์ (Print view).
- รวมลิงก์ไปยังต้นทาง (เช่น /rfas/:id).

## 🧮 **9. ฟรอนต์เอนด์: รูปแบบ DataTable และฟอร์ม (Frontend: DataTable & Form Patterns)**

### **9.1 DataTable (Server‑Side)**

- Endpoint: /api/{module}?page=1&pageSize=20&sort=...&filter=...
- ต้องรองรับ: การแบ่งหน้า (pagination), การเรียงลำดับ (sorting), การค้นหา (search), การกรอง (filters)
- แสดง revision ล่าสุดแบบ inline เสมอ (สำหรับ RFA/Drawing)

### **9.2 มาตรฐานฟอร์ม (Form Standards)**

- ใช้ **React Hook Form** เป็นมาตรฐานสำหรับฟอร์มทั้งหมด
- ใช้ **Zod** สำหรับ schema validation ทั้งฝั่ง client และ server
- ต้องมีการใช้งาน Dropdowns แบบขึ้นต่อกัน (Dependent dropdowns) (ตามที่สคีมารองรับ) ด้วย React Query สำหรับ data fetching และ React Hook Form สำหรับ state management:
  - Project → Contract Drawing Volumes
  - Contract Drawing Category → Sub-Category
  - RFA (ประเภท Shop Drawing) → Shop Drawing Revisions ที่เชื่อมโยงได้
- **File Upload Security:** ต้องรองรับ **Multi-file upload (Drag-and-Drop)** ด้วย React Hook Form integration [cite: 5.7] พร้อม virus scanning feedback
- **File Type Indicators:** UI ต้องอนุญาตให้ผู้ใช้กำหนดว่าไฟล์ใดเป็น **"เอกสารหลัก"** หรือ "เอกสารแนบประกอบ" [cite: 5.7] พร้อมแสดง file type icons
- **Security Feedback:** แสดง security warnings สำหรับ file types ที่เสี่ยงหรือ files ที่ fail virus scan
- ส่ง (Submit) ผ่าน API พร้อม feedback แบบ toast

### **9.3 ข้อกำหนด Component เฉพาะ (Specific UI Requirements)**

- **Dashboard - My Tasks:** ต้องพัฒนา Component ตาราง "งานของฉัน" (My Tasks)ซึ่งดึงข้อมูลงานที่ผู้ใช้ล็อกอินอยู่ต้องรับผิดชอบ (Main/Action) จาก v_user_tasks [cite: 5.3]
- **Workflow Visualization:** ต้องพัฒนา Component สำหรับแสดงผล Workflow (โดยเฉพาะ RFA)ที่แสดงขั้นตอนทั้งหมดเป็นลำดับ โดยขั้นตอนปัจจุบัน (active) เท่านั้นที่ดำเนินการได้ และขั้นตอนอื่นเป็น disabled [cite: 5.6] ต้องมีตรรกะสำหรับ Admin ในการ override หรือย้อนกลับขั้นตอนได้ [cite: 5.6]
- **Admin Panel:** ต้องมีหน้า UI สำหรับ Superadmin/Admin เพื่อจัดการข้อมูลหลัก (Master Data [cite: 4.5]), การเริ่มต้นใช้งาน (Onboarding [cite: 4.6]), และ **รูปแบบเลขที่เอกสาร (Numbering Formats [cite: 3.10])**
- **Security Dashboard:** แสดง security metrics และ audit logs สำหรับ administrators

## 🧭 **10. แดชบอร์ดและฟีดกิจกรรม (Dashboard & Activity Feed)**

### **10.1 การ์ดบนแดชบอร์ด (Dashboard Cards)**

- แสดง Correspondences, RFAs, Circulations, Shop Drawing Revision ล่าสุด
- รวมสรุป KPI (เช่น "RFAs ที่รอการอนุมัติ", "Shop Drawing ที่รอการอนุมัติ") [cite: 5.3]
- รวมลิงก์ด่วนไปยังโมดูลต่างๆ
- **Security Metrics:** แสดงจำนวน files scanned, security incidents, failed login attempts

### **10.2 ฟีดกิจกรรม (Activity Feed)**

- แสดงรายการ v_audit_log_details ล่าสุด (10 รายการ) ที่เกี่ยวข้องกับผู้ใช้
- รวม security-related activities (failed logins, permission changes)

```typescript
// ตัวอย่าง API response
[
  {
    user: 'editor01',
    action: 'Updated RFA (LCBP3-RFA-001)',
    time: '2025-11-04T09:30Z',
  },
  {
    user: 'system',
    action: 'Virus scan completed - 0 threats found',
    time: '2025-11-04T09:25Z',
  },
];
```

## 🛡️ **11. ข้อกำหนดที่ไม่ใช่ฟังก์ชันการทำงาน (Non-Functional Requirements)**

ส่วนนี้สรุปข้อกำหนด Non-Functional จาก requirements.md เพื่อให้ทีมพัฒนาทาน

- **Audit Log [cite: 6.1]:** ทุกการกระทำที่สำคัญ (C/U/D) ต้องถูกบันทึกใน audit_logs
- **Performance [cite: 6.4]:** ต้องใช้ Caching สำหรับข้อมูลที่เรียกบ่อย และใช้ Pagination
- **Security [cite: 6.5]:** ต้องมี Rate Limiting และจัดการ Secret ผ่าน docker-compose.yml (ไม่ใช่ .env)
- **File Security [cite: 3.9.6]:** ต้องมี virus scanning, file type validation, access controls
- **Resilience [cite: 6.5.3]:** ต้องมี circuit breaker, retry mechanisms, graceful degradation
- **Backup & Recovery [cite: 6.6]:** ต้องมีแผนสำรองข้อมูลทั้ง Database (MariaDB) และ File Storage (/share/dms-data) อย่างน้อยวันละ 1 ครั้ง
- **Notification Strategy [cite: 6.7]:** ระบบแจ้งเตือน (Email/Line) ต้องถูก Trigger เมื่อมีเอกสารใหม่ส่งถึง, มีการมอบหมายงานใหม่ (Circulation), หรือ (ทางเลือก) เมื่องานเสร็จ/ใกล้ถึงกำหนด
- **Monitoring [cite: 6.8]:** ต้องมี health checks, metrics collection, alerting

## ✅ **12. มาตรฐานที่นำไปใช้แล้ว (จาก SQL v1.4.0) (Implemented Standards (from SQL v1.4.0))**

ส่วนนี้ยืนยันว่าแนวทางปฏิบัติที่ดีที่สุดต่อไปนี้เป็นส่วนหนึ่งของการออกแบบฐานข้อมูลอยู่แล้ว และควรถูกนำไปใช้ประโยชน์ ไม่ใช่สร้างขึ้นใหม่

- ✅ **Soft Delete:** นำไปใช้แล้วผ่านคอลัมน์ deleted_at ในตารางสำคัญ (เช่น correspondences, rfas, project_parties) ตรรกะการดึงข้อมูลต้องกรอง deleted_at IS NULL
- ✅ **Database Indexes:** สคีมาได้มีการทำ index ไว้อย่างหนักหน่วงบน foreign keys และคอลัมน์ที่ใช้ค้นหาบ่อย (เช่น idx_rr_rfa, idx_cor_project, idx_cr_is_current) เพื่อประสิทธิภาพ
- ✅ **โครงสร้าง RBAC:** มีระบบ users, roles, permissions, user_roles, และ user_project_roles ที่ครอบคลุมอยู่แล้ว
- ✅ **Data Seeding:** ข้อมูล Master (roles, permissions, organization_roles, initial users, project parties) ถูกรวมอยู่ในสคริปต์สคีมาแล้ว
- ✅ **Application-level Locking:** ใช้ Redis distributed lock แทน stored procedure
- ✅ **File Security:** Virus scanning, file type validation, access control
- ✅ **Resilience Patterns:** Circuit breaker, retry, fallback mechanisms
- ✅ **Security Measures:** Input validation, rate limiting, security headers
- ✅ **Monitoring:** Health checks, metrics collection, distributed tracing

## 🧩 **13. การปรับปรุงที่แนะนำ (สำหรับอนาคต) (Recommended Enhancements (Future))**

- ✅ สร้าง Background job (โดยใช้ **n8n** เพื่อเชื่อมต่อกับ **Line** [cite: 2.7] และ/หรือใช้สำหรับการแจ้งเตือน RFA ที่ใกล้ถึงกำหนด due_date [cite: 6.7])
- ✅ เพิ่ม job ล้างข้อมูลเป็นระยะสำหรับ attachments ที่ไม่ถูกเชื่อมโยงกับ Entity ใดๆ เลย (ไฟล์กำพร้า)
- 🔄 **AI-Powered Document Classification:** ใช้ machine learning สำหรับ automatic document categorization
- 🔄 **Advanced Analytics:** Predictive analytics สำหรับ workflow optimization
- 🔄 **Mobile App:** Native mobile application สำหรับ field workers
- 🔄 **Blockchain Integration:** สำหรับ document integrity verification ที่ต้องการความปลอดภัยสูงสุด

## ✅ **14. Summary Checklist for Developers**

ก่อนส่ง PR (Pull Request) นักพัฒนาต้องตรวจสอบหัวข้อต่อไปนี้:

- [ ] **Security:** ไม่มี Secrets ใน Code, ใช้ `docker-compose.override.yml` แล้ว
- [ ] **Concurrency:** ใช้ Optimistic Lock ใน Entity ที่เสี่ยง Race Condition แล้ว
- [ ] **Idempotency:** API รองรับ Idempotency Key แล้ว
- [ ] **File Upload:** ใช้ Flow Two-Phase (Temp -> Perm) แล้ว
- [ ] **Mobile:** หน้าจอแสดงผลแบบ Card View บนมือถือได้ถูกต้อง
- [ ] **Performance:** สร้าง Index สำหรับ JSON Virtual Columns แล้ว (ถ้ามี), ใช้ useMemo/useCallback ที่เหมาะสม
- [ ] **No Over-engineering:** ไม่ใช้ state management libraries เกินความจำเป็น
- [ ] **State Management:** ใช้ React Query สำหรับ server state, React Hook Form สำหรับ forms
- [ ] **Error Handling:** มี error boundaries และ proper error states
- [ ] **Type Safety:** มี proper TypeScript types สำหรับทั้งหมด state

---

## 📋 **15. Summary of Key Changes from Previous Version**

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

### **Performance Targets :**

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

## **Document Control:**

- **Document:** FullStackJS v1.8.0
- **Version:** 1.8
- **Date:** 2026-02-24
- **Author:** NAP LCBP3-DMS & Gemini
- **Status:** first-draft
- **Classification:** Internal Technical Documentation
- **Approved By:** Nattanin

---

`End of FullStackJS Guidelines v1.8.0`
