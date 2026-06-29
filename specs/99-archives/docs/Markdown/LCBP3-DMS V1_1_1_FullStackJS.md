# แนวทางการพัฒนา FullStackJS

## 🧠 ปรัชญาทั่วไป

แนวทางปฏิบัติที่ดีที่สุดแบบครบวงจรสำหรับการพัฒนา **NestJS Backend**, **NextJS Frontend** และ **Tailwind-based UI/UX** ในสภาพแวดล้อม TypeScript
มุ่งเน้นที่ **ความชัดเจน (clarity)**, **ความง่ายในการบำรุงรักษา (maintainability)**, **ความสอดคล้องกัน (consistency)** และ **การเข้าถึงได้ (accessibility)** ตลอดทั้งสแต็ก

---

## ⚙️ แนวทางทั่วไปสำหรับ TypeScript

### หลักการพื้นฐาน

- ใช้ **ภาษาอังกฤษ** สำหรับโค้ดและเอกสารทั้งหมด
- กำหนดไทป์ (type) อย่างชัดเจนสำหรับตัวแปร, พารามิเตอร์ และค่าที่ส่งกลับ (return values) ทั้งหมด
- หลีกเลี่ยงการใช้ `any`; ให้สร้างไทป์ (types) หรืออินเทอร์เฟซ (interfaces) ที่กำหนดเอง
- ใช้ **JSDoc** สำหรับคลาส (classes) และเมธอด (methods) ที่เป็น public
- ส่งออก (Export) **สัญลักษณ์หลัก (main symbol) เพียงหนึ่งเดียว** ต่อไฟล์
- หลีกเลี่ยงบรรทัดว่างภายในฟังก์ชัน

### ข้อตกลงในการตั้งชื่อ (Naming Conventions)

| Entity (สิ่งที่ตั้งชื่อ) | Convention (รูปแบบ) | Example (ตัวอย่าง)                       |
| :----------------------- | :------------------ | :--------------------------------------- |
| Classes                  | PascalCase          | `UserService`                            |
| Variables & Functions    | camelCase           | `getUserInfo`                            |
| Files & Folders          | kebab-case          | `user-service.ts`                        |
| Environment Variables    | UPPERCASE           | `DATABASE_URL`                           |
| Booleans                 | Verb + Noun         | `isActive`, `canDelete`, `hasPermission` |

ใช้คำเต็ม — ไม่ใช้อักษรย่อ — ยกเว้นคำมาตรฐาน (เช่น `API`, `URL`, `req`, `res`, `err`, `ctx`)

---

## 🧩 ฟังก์ชัน (Functions)

- เขียนฟังก์ชันให้สั้น และทำ **หน้าที่เพียงอย่างเดียว** (single-purpose) (\< 20 บรรทัด)
- ใช้ **early returns** เพื่อลดการซ้อน (nesting) ของโค้ด
- ใช้ **map**, **filter**, **reduce** แทนการใช้ loops เมื่อเหมาะสม
- ควรใช้ **arrow functions** สำหรับตรรกะสั้นๆ, และใช้ **named functions** ในกรณีอื่น
- ใช้ **default parameters** แทนการตรวจสอบค่า null
- จัดกลุ่มพารามิเตอร์หลายตัวให้เป็นอ็อบเจกต์เดียว (RO-RO pattern)
- ส่งค่ากลับ (Return) เป็นอ็อบเจกต์ที่มีไทป์กำหนด (typed objects) ไม่ใช่ค่าพื้นฐาน (primitives)
- รักษาระดับของสิ่งที่เป็นนามธรรม (abstraction level) ให้เป็นระดับเดียวในแต่ละฟังก์ชัน

---

## 🧱 การจัดการข้อมูล (Data Handling)

- ห่อหุ้มข้อมูล (Encapsulate) ในไทป์แบบผสม (composite types)
- ใช้ **immutability** (การไม่เปลี่ยนแปลงค่า) ด้วย `readonly` และ `as const`
- ทำการตรวจสอบความถูกต้องของข้อมูล (Validations) ในคลาสหรือ DTOs ไม่ใช่ภายในฟังก์ชันทางธุรกิจ
- ตรวจสอบความถูกต้องของข้อมูลโดยใช้ DTOs ที่มีไทป์กำหนดเสมอ

---

## 🧰 คลาส (Classes)

- ปฏิบัติตามหลักการ **SOLID**
- ควรใช้ **composition มากกว่า inheritance** (Prefer composition over inheritance)
- กำหนด **interfaces** สำหรับสัญญา (contracts)
- ให้คลาสมุ่งเน้นการทำงานเฉพาะอย่างและมีขนาดเล็ก (\< 200 บรรทัด, \< 10 เมธอด, \< 10 properties)

---

## 🚨 การจัดการข้อผิดพลาด (Error Handling)

- ใช้ Exceptions สำหรับข้อผิดพลาดที่ไม่คาดคิด
- ดักจับ (Catch) ข้อผิดพลาดเพื่อแก้ไขหรือเพิ่มบริบท (context) เท่านั้น; หากไม่เช่นนั้น ให้ใช้ global error handlers
- ระบุข้อความข้อผิดพลาด (error messages) ที่มีความหมายเสมอ

---

## 🧪 การทดสอบ (ทั่วไป) (Testing (General))

- ใช้รูปแบบ **Arrange–Act–Assert**
- ใช้ชื่อตัวแปรในการทดสอบที่สื่อความหมาย (`inputData`, `expectedOutput`)
- เขียน **unit tests** สำหรับ public methods ทั้งหมด
- จำลอง (Mock) การพึ่งพาภายนอก (external dependencies)
- เพิ่ม **acceptance tests** ต่อโมดูลโดยใช้รูปแบบ Given–When–Then

---

# 🏗️ แบ็กเอนด์ (NestJS) (Backend (NestJS))

### หลักการ

- **สถาปัตยกรรมแบบโมดูลาร์ (Modular architecture)**:
  - หนึ่งโมดูลต่อหนึ่งโดเมน
  - โครงสร้างแบบ Controller → Service → Repository (Model)
- DTOs ที่ตรวจสอบความถูกต้องด้วย **class-validator**
- ใช้ **MikroORM** (หรือ TypeORM/Prisma) สำหรับการคงอยู่ของข้อมูล (persistence) ซึ่งสอดคล้องกับสคีมา MariaDB
- ห่อหุ้มโค้ดที่ใช้ซ้ำได้ไว้ใน **common module** (`@app/common`):
  - Configs, decorators, DTOs, guards, interceptors, notifications, shared services, types, validators

### ฟังก์ชันหลัก (Core Functionalities)

- Global **filters** สำหรับการจัดการ exception
- **Middlewares** สำหรับการจัดการ request
- **Guards** สำหรับการอนุญาต (permissions) และ RBAC
- **Interceptors** สำหรับการแปลงข้อมูล response และการบันทึก log

### ข้อจำกัดในการ Deploy (QNAP Container Station)

- **ห้ามใช้ไฟล์ `.env`** ในการตั้งค่า Environment Variables
- การตั้งค่าทั้งหมด (เช่น Database connection string, JWT secret) **จะต้องถูกกำหนดผ่าน Environment Variable ใน `docker-compose.yml` โดยตรง** ซึ่งจะจัดการผ่าน UI ของ QNAP Container Station

### โครงสร้างโมดูลตามโดเมน (Domain-Driven Module Structure)

เพื่อให้สอดคล้องกับสคีมา SQL (LCBP3-DMS) เราจะใช้โครงสร้างโมดูลแบบ **Domain-Driven (แบ่งตามขอบเขตธุรกิจ)** แทนการแบ่งตามฟังก์ชัน:

1.  **CoreModule / CommonModule:**
    - เก็บ Services ที่ใช้ร่วมกัน เช่น `DatabaseModule`, `FileStorageService` (จัดการไฟล์ใน QNAP), `AuditLogService`, และ `NotificationService`
2.  **AuthModule / UserModule:**
    - จัดการ `users`, `roles`, `permissions` และการยืนยันตัวตน (JWT, Guards)
    - **(สำคัญ)** ต้องรับผิดชอบการตรวจสอบสิทธิ์ **3 ระดับ**: สิทธิ์ระดับระบบ (Global Role), สิทธิ์ระดับโปรเจกต์ (Project Role), และ **สิทธิ์ระดับสัญญา (Contract Role)**
    - **(สำคัญ)** ต้องมี API สำหรับ Admin เพื่อ **สร้างและจัดการ Role และการจับคู่ Permission แบบไดนามิก** (ไม่ใช่แค่ seed ข้อมูลเริ่มต้น)
3.  **ProjectModule:**
    - จัดการ `projects`, `organizations`, `contracts`, `project_parties`, `contract_parties`
4.  **CorrespondenceModule (โมดูลศูนย์กลาง):**
    - จัดการ `correspondences`, `correspondence_revisions`
    - จัดการ `correspondence_attachments` (ตารางเชื่อมไฟล์แนบ)
    - รับผิดชอบเวิร์กโฟลว์ **"Correspondence Routings"** (`correspondence_routings`) สำหรับการส่งต่อเอกสารทั่วไประหว่างองค์กร
5.  **RfaModule:**
    - จัดการ `rfas`, `rfa_revisions`, `rfa_items`
    - รับผิดชอบเวิร์กโฟลว์ **"RFA Workflows"** (`rfa_workflows`) สำหรับการอนุมัติเอกสารทางเทคนิค
6.  **DrawingModule:**
    - จัดการ `shop_drawings`, `shop_drawing_revisions`, `contract_drawings` และหมวดหมู่ต่างๆ
    - จัดการ `shop_drawing_revision_attachments` (ตารางเชื่อมไฟล์แนบ)
7.  **CirculationModule:**
    - จัดการ `circulations`, `circulation_templates`, `circulation_assignees`
    - จัดการ `circulation_attachments` (ตารางเชื่อมไฟล์แนบ)
    - รับผิดชอบเวิร์กโฟลGว์ **"Circulations"** สำหรับการเวียนเอกสาร **ภายในองค์กร**
8.  **TransmittalModule:**
    - จัดการ `transmittals` และ `transmittal_items`
9.  **SearchModule:**
    - **(สำหรับ V1)** ให้บริการค้นหาขั้นสูง (Advanced Search) โดยต้องรองรับการกรองจาก ชื่อเรื่อง (LIKE), ประเภท, วันที่, และ **Tags** (ผ่านการ Join ตาราง) โดยค้นหาผ่าน Views (`v_current_rfas`, `v_current_correspondences`)

### เครื่องมือและไลบรารีที่แนะนำ (Recommended Tools & Libraries)

🔐 **Authentication & Authorization**

- `@nestjs/passport`
- `@nestjs/jwt`
- `casl` – สำหรับ RBAC (Role-Based Access Control)

🗃️ **Database & ORM**

- `@nestjs/typeorm` – ORM สำหรับ SQL (หรือ `Prisma` เป็นทางเลือก)
- `typeorm-seeding` – สำหรับสร้างข้อมูลจำลอง (seeding)

📦 **Validation & Transformation**

- `class-validator`
- `class-transformer`

📁 **File Upload & Storage**

- `@nestjs/platform-express`
- `multer` – สำหรับจัดการไฟล์

🔍 **Search**

- **(สำหรับ V1)** เน้นการค้นหาขั้นสูงตาม Requirement 6.2 (Full-text search/Elasticsearch จะพิจารณาใน V2)

📬 **Notification**

- `nodemailer` – สำหรับส่งอีเมล
- `@nestjs/schedule` – สำหรับ cron job หรือแจ้งเตือนตามเวลา

📊 **Logging & Monitoring**

- `winston` หรือ `nestjs-pino` – ระบบ log ที่ยืดหยุ่น
- `@nestjs/terminus` – สำหรับ health check

🧪 **Testing**

- `@nestjs/testing`
- `jest` – สำหรับ unit/integration test

🌐 **API Documentation**

- `@nestjs/swagger` – **(สำคัญมาก)** สร้าง Swagger UI อัตโนมัติ ต้องใช้ DTOs อย่างเคร่งครัดเพื่อความชัดเจนของ API สำหรับทีม Frontend

🛡️ **Security**

- `helmet` – ป้องกันช่องโหว่ HTTP
- `rate-limiter-flexible` – ป้องกัน brute force

### การทดสอบ (Testing)

- ใช้ **Jest** สำหรับการทดสอบ
- ทดสอบทุก controller และ service
- เพิ่ม endpoint `admin/test` เพื่อใช้เป็น smoke test

---

# 🖥️ ฟรอนต์เอนด์ (NextJS / React / UI) (Frontend (NextJS / React / UI))

### โปรไฟล์นักพัฒนา (Developer Profile)

วิศวกร TypeScript + React/NextJS ระดับ Senior
เชี่ยวชาญ **TailwindCSS**, **Shadcn/UI**, และ **Radix** สำหรับการพัฒนา UI

### แนวทางการพัฒนาโค้ด (Code Implementation Guidelines)

- ใช้ **early returns** เพื่อความชัดเจน
- ใช้คลาสของ **TailwindCSS** ในการกำหนดสไตล์เสมอ
- ควรใช้ `class:` syntax แบบมีเงื่อนไข (หรือ utility `clsx`) มากกว่าการใช้ ternary operators ใน class strings
- ใช้ **const arrow functions** สำหรับ components และ handlers
- Event handlers ให้ขึ้นต้นด้วย `handle...` (เช่น `handleClick`, `handleSubmit`)
- รวมแอตทริบิวต์สำหรับการเข้าถึง (accessibility) ด้วย:
  `tabIndex="0"`, `aria-label`, `onKeyDown`, ฯลฯ
- ตรวจสอบให้แน่ใจว่าโค้ดทั้งหมด **สมบูรณ์**, **ผ่านการทดสอบ**, และ **ไม่ซ้ำซ้อน (DRY)**
- ต้อง import โมดูลที่จำเป็นต้องใช้อย่างชัดเจนเสมอ

### UI/UX ด้วย React

- ใช้ **semantic HTML**
- ใช้คลาสของ **Tailwind** ที่รองรับ responsive (`sm:`, `md:`, `lg:`)
- รักษาลำดับชั้นของการมองเห็น (visual hierarchy) ด้วยการใช้ typography และ spacing
- ใช้ **Shadcn** components (Button, Input, Card, ฯลฯ) เพื่อ UI ที่สอดคล้องกัน
- ทำให้ components มีขนาดเล็กและมุ่งเน้นการทำงานเฉพาะอย่าง
- ใช้ utility classes สำหรับการจัดสไตล์อย่างรวดเร็ว (spacing, colors, text, ฯลฯ)
- ตรวจสอบให้แน่ใจว่าสอดคล้องกับ **ARIA** และใช้ semantic markup

### การตรวจสอบฟอร์มและข้อผิดพลาด (Form Validation & Errors)

- ใช้ไลบรารีฝั่ง client เช่น `zod` และ `react-hook-form`
- แสดงข้อผิดพลาดด้วย **alert components** หรือข้อความ inline
- ต้องมี labels, placeholders, และข้อความ feedback

---

# 🔗 แนวทางการบูรณาการ Full Stack (Full Stack Integration Guidelines)

| Aspect (แง่มุม)            | Backend (NestJS)           | Frontend (NextJS)              | UI Layer (Tailwind/Shadcn)             |
| :------------------------- | :------------------------- | :----------------------------- | :------------------------------------- |
| API                        | REST / GraphQL Controllers | API hooks ผ่าน fetch/axios/SWR | Components ที่รับข้อมูล                |
| Validation (การตรวจสอบ)    | `class-validator` DTOs     | `zod` / `react-hook-form`      | สถานะของฟอร์ม/input ใน Shadcn          |
| Auth (การยืนยันตัวตน)      | Guards, JWT                | NextAuth / cookies             | สถานะ UI ของ Auth (loading, signed in) |
| Errors (ข้อผิดพลาด)        | Global filters             | Toasts / modals                | Alerts / ข้อความ feedback              |
| Testing (การทดสอบ)         | Jest (unit/e2e)            | Vitest / Playwright            | Visual regression                      |
| Styles (สไตล์)             | Scoped modules (ถ้าจำเป็น) | Tailwind / Shadcn              | Tailwind utilities                     |
| Accessibility (การเข้าถึง) | Guards + filters           | ARIA attributes                | Semantic HTML                          |

---

# 🗂️ ข้อตกลงเฉพาะสำหรับ DMS (LCBP3-DMS)

ส่วนนี้ขยายแนวทาง FullStackJS ทั่วไปสำหรับโปรเจกต์ **LCBP3-DMS** โดยมุ่งเน้นไปที่เวิร์กโฟลว์การอนุมัติเอกสาร (Correspondence, RFA, Drawing, Contract, Transmittal, Circulation)

## 🧱 โมดูลโดเมนฝั่งแบ็กเอนด์ (Backend Domain Modules)

ใช้โครงสร้างโดเมนแบบโมดูลาร์ที่สะท้อนสคีมา SQL โดย `correspondences` จะทำหน้าที่เป็นศูนย์กลาง (โครงสร้างนี้จะอยู่ภายใต้ "Functional Modules" ที่กล่าวถึงข้างต้น)

```
src/
 ├─ modules/
 │   ├─ correspondences/ (Core: Master documents, Revisions, correspondence_attachments)
 │   ├─ rfas/             (RFA logic, Revisions, Workflows, Items)
 │   ├─ drawings/         (ShopDrawings, Revisions, shop_drawing_revision_attachments)
 │   ├─ circulations/     (Internal circulation, Templates, circulation_attachments)
 │   ├─ transmittals/     (Transmittal logic, Items)
 │   ├─ projects-contracts/ (Projects, Contracts, Organizations, Parties)
 │   ├─ users-auth/       (Users, Roles, Permissions, Auth)
 │   ├─ audit-log/
 │   └─ common/
```

### ข้อตกลงการตั้งชื่อ (Naming Convention)

| Entity (สิ่งที่ตั้งชื่อ) | Example (ตัวอย่างจาก SQL)                              |
| :----------------------- | :----------------------------------------------------- |
| Table                    | `correspondences`, `rfa_revisions`, `contract_parties` |
| Column                   | `correspondence_id`, `created_by`, `is_current`        |
| DTO                      | `CreateRfaDto`, `UpdateCorrespondenceDto`              |
| Controller               | `rfas.controller.ts`                                   |
| Service                  | `correspondences.service.ts`                           |

---

## 🧩 RBAC และการควบคุมสิทธิ์ (RBAC & Permission Control)

ใช้ Decorators เพื่อบังคับใช้สิทธิ์การเข้าถึง โดยอ้างอิงสิทธิ์จากตาราง `permissions`

```ts
@RequirePermission('rfas.respond') // ต้องตรงกับ 'permission_code'
@Put(':id')
updateRFA(@Param('id') id: string) {
  return this.rfaService.update(id);
}
```

### Roles (บทบาท)

- **Superadmin**: ไม่มีข้อจำกัดใดๆ
- **Admin**: มีสิทธิ์เต็มที่ในองค์กร
- **Document Control**: เพิ่ม/แก้ไข/ลบ เอกสารในองค์กร
- **Editor**: สามารถ เพิ่ม/แก้ไข เอกสารที่กำหนด
- **Viewer**: สามารถดู เอกสาร

### ตัวอย่าง Permissions (จากตาราง `permissions`)

- `rfas.view`, `rfas.create`, `rfas.respond`, `rfas.delete`
- `drawings.view`, `drawings.upload`, `drawings.delete`
- `corr.view`, `corr.manage`
- `transmittals.manage`
- `cirs.manage`
- `project_parties.manage`

การจับคู่ระหว่าง roles และ permissions **เริ่มต้น** จะถูก seed ผ่านสคริปต์ (ดังที่เห็นในไฟล์ SQL) **อย่างไรก็ตาม `AuthModule`/`UserModule` ต้องมี API สำหรับ Admin เพื่อสร้าง Role ใหม่และกำหนดสิทธิ์ (Permissions) เพิ่มเติมได้ในภายหลัง**

---

## 🧾 มาตรฐาน AuditLog (AuditLog Standard)

บันทึกการดำเนินการ CRUD และการจับคู่ทั้งหมดลงในตาราง `audit_logs`

| Field (ฟิลด์)  | Type (จาก SQL) | Description (คำอธิบาย)                                 |
| :------------- | :------------- | :----------------------------------------------------- |
| `audit_id`     | `BIGINT`       | Primary Key                                            |
| `user_id`      | `INT`          | ผู้ใช้ที่ดำเนินการ (FK -\> users)                      |
| `action`       | `VARCHAR(100)` | `rfa.create`, `correspondence.update`, `login.success` |
| `entity_type`  | `VARCHAR(50)`  | ชื่อตาราง/โมดูล เช่น 'rfa', 'correspondence'           |
| `entity_id`    | `VARCHAR(50)`  | Primary ID ของระเบียนที่ได้รับผลกระทบ                  |
| `details_json` | `JSON`         | ข้อมูลบริบท (เช่น ฟิลด์ที่มีการเปลี่ยนแปลง)            |
| `ip_address`   | `VARCHAR(45)`  | IP address ของผู้ดำเนินการ                             |
| `user_agent`   | `VARCHAR(255)` | User Agent ของผู้ดำเนินการ                             |
| `created_at`   | `TIMESTAMP`    | Timestamp (UTC)                                        |

ตัวอย่างการใช้งาน:

```ts
await this.auditLogService.log({
  userId: user.id,
  action: 'rfa.update_status',
  entityType: 'rfa_revisions',
  entityId: rfaRevision.id,
  detailsJson: { from: 'DFT', to: 'FAP' },
  ipAddress: req.ip,
});
```

---

## 📂 การจัดการไฟล์ (File Handling) (ปรับปรุงใหม่)

### มาตรฐานการอัปโหลดไฟล์ (File Upload Standard)

- **ตรรกะใหม่:** การอัปโหลดไฟล์ทั้งหมดจะถูกจัดการโดย `FileStorageService` และบันทึกข้อมูลไฟล์ลงในตาราง `attachments` (ตารางกลาง)
- ไฟล์จะถูกเชื่อมโยงไปยัง Entity ที่ถูกต้องผ่าน **ตารางเชื่อม (Junction Tables)** เท่านั้น:
  - `correspondence_attachments` (เชื่อม Correspondence กับ Attachments)
  - `circulation_attachments` (เชื่อม Circulation กับ Attachments)
  - `shop_drawing_revision_attachments` (เชื่อม Drawing Revision กับ Attachments)
- **(สำคัญ)** คอลัมน์ `file_path` ถูกลบออกจาก `shop_drawing_revisions` แล้ว ต้องใช้ระบบตารางเชื่อมใหม่นี้เท่านั้น
- เส้นทางจัดเก็บไฟล์ (Upload path): อ้างอิงจาก Requirement 2.1 คือ `/share/dms-data` โดย `FileStorageService` จะสร้างโฟลเดอร์ย่อยแบบรวมศูนย์ (เช่น `/share/dms-data/uploads/{YYYY}/{MM}/[stored_filename]`)
  - **(หมายเหตุ)**: โครงสร้างนี้ _แทนที่_ โครงสร้างแบบแยกโมดูลที่ระบุใน Requirement 3.9 เนื่องจากการออกแบบใหม่ได้รวมศูนย์ไฟล์ไว้ที่ตาราง `attachments` กลางแล้ว
- ประเภทไฟล์ที่อนุญาต: `pdf, dwg, docx, xlsx, zip`
- ขนาดสูงสุด: **50 MB**
- จัดเก็บนอก webroot
- ให้บริการไฟล์ผ่าน endpoint ที่ปลอดภัย `/files/:attachment_id/download`

### การควบคุมการเข้าถึง (Access Control)

การเข้าถึงไฟล์ไม่ใช่การเข้าถึงโดยตรง endpoint `/files/:attachment_id/download` จะต้อง:

1.  ค้นหาระเบียน `attachment`
2.  ตรวจสอบว่า `attachment_id` นี้ เชื่อมโยงกับ Entity ใด (เช่น `correspondence`, `circulation`, `shop_drawing_revision`) ผ่านตารางเชื่อม
3.  ตรวจสอบว่าผู้ใช้มีสิทธิ์ (permission) ในการดู Entity ต้นทางนั้นๆ หรือไม่

---

## 📊 การรายงานและการส่งออก (Reporting & Exports)

### วิวสำหรับการรายงาน (Reporting Views) (จาก SQL)

การรายงานควรสร้างขึ้นจาก Views ที่กำหนดไว้ล่วงหน้าในฐานข้อมูลเป็นหลัก:

- `v_current_correspondences`: สำหรับ revision ปัจจุบันทั้งหมดของเอกสารที่ไม่ใช่ RFA
- `v_current_rfas`: สำหรับ revision ปัจจุบันทั้งหมดของ RFA และข้อมูล master
- `v_contract_parties_all`: สำหรับการตรวจสอบความสัมพันธ์ของ project/contract/organization

Views เหล่านี้ทำหน้าที่เป็นแหล่งข้อมูลหลักสำหรับการรายงานฝั่งเซิร์ฟเวอร์และการส่งออกข้อมูล

### กฎการส่งออก (Export Rules)

- Export formats: CSV, Excel, PDF.
- จัดเตรียมมุมมองสำหรับพิมพ์ (Print view).
- รวมลิงก์ไปยังต้นทาง (เช่น `/rfas/:id`).

---

## 🧮 ฟรอนต์เอนด์: รูปแบบ DataTable และฟอร์ม (Frontend: DataTable & Form Patterns)

### DataTable (Server‑Side)

- Endpoint: `/api/{module}?page=1&pageSize=20&sort=...&filter=...`
- ต้องรองรับ: การแบ่งหน้า (pagination), การเรียงลำดับ (sorting), การค้นหา (search), การกรอง (filters)
- แสดง revision ล่าสุดแบบ inline เสมอ (สำหรับ RFA/Drawing)

### มาตรฐานฟอร์ม (Form Standards)

- ต้องมีการใช้งาน Dropdowns แบบขึ้นต่อกัน (Dependent dropdowns) (ตามที่สคีมารองรับ):
  - Project → Contract Drawing Volumes
  - Contract Drawing Category → Sub-Category
  - RFA (ประเภท Shop Drawing) → Shop Drawing Revisions ที่เชื่อมโยงได้
- การอัปโหลดไฟล์: ต้องมี preview + validation (ผ่านตรรกะของ `attachments` และตารางเชื่อมใหม่)
- ส่ง (Submit) ผ่าน API พร้อม feedback แบบ toast

### ข้อกำหนด Component เฉพาะ (Specific UI Requirements)

- **Dashboard - My Tasks:** ต้องพัฒนา Component ตาราง "งานของฉัน" (My Tasks) ซึ่งดึงข้อมูลงานที่ผู้ใช้ล็อกอินอยู่ต้องรับผิดชอบ (Main/Action) จากโมดูล `Circulations`
- **Workflow Visualization:** ต้องพัฒนา Component สำหรับแสดงผล Workflow (โดยเฉพาะ RFA) ที่แสดงขั้นตอนทั้งหมดเป็นลำดับ โดยขั้นตอนปัจจุบัน (active) เท่านั้นที่ดำเนินการได้ และขั้นตอนอื่นเป็น `disabled` ต้องมีตรรกะสำหรับ Admin ในการ override หรือย้อนกลับขั้นตอนได้

---

## 🧭 แดชบอร์ดและฟีดกิจกรรม (Dashboard & Activity Feed)

### การ์ดบนแดชบอร์ด (Dashboard Cards)

- แสดง Correspondences, RFAs, Circulations ล่าสุด
- รวมสรุป KPI (เช่น "RFAs ที่รอการอนุมัติ")
- รวมลิงก์ด่วนไปยังโมดูลต่างๆ

### ฟีดกิจกรรม (Activity Feed)

- แสดงรายการ `audit_logs` ล่าสุด (10 รายการ) ที่เกี่ยวข้องกับผู้ใช้

<!-- end list -->

```ts
// ตัวอย่าง API response
[{ user: 'editor01', action: 'Updated RFA (LCBP3-RFA-001)', time: '2025-11-04T09:30Z' }];
```

---

## ✅ มาตรฐานที่นำไปใช้แล้ว (จาก SQL v1.1.0) (Implemented Standards (from SQL v1.1.0))

ส่วนนี้ยืนยันว่าแนวทางปฏิบัติที่ดีที่สุดต่อไปนี้เป็นส่วนหนึ่งของการออกแบบฐานข้อมูลอยู่แล้ว และควรถูกนำไปใช้ประโยชน์ ไม่ใช่สร้างขึ้นใหม่

- ✅ **Soft Delete:** นำไปใช้แล้วผ่านคอลัมน์ `deleted_at` ในตารางสำคัญ (เช่น `correspondences`, `rfas`, `project_parties`) ตรรกะการดึงข้อมูลต้องกรอง `deleted_at IS NULL`
- ✅ **Database Indexes:** สคีมาได้มีการทำ index ไว้อย่างหนักหน่วงบน foreign keys และคอลัมน์ที่ใช้ค้นหาบ่อย (เช่น `idx_rr_rfa`, `idx_cor_project`, `idx_cr_is_current`) เพื่อประสิทธิภาพ
- ✅ **โครงสร้าง RBAC:** มีระบบ `users`, `roles`, `permissions`, `user_roles`, และ `user_project_roles` ที่ครอบคลุมอยู่แล้ว
- ✅ **Data Seeding:** ข้อมูล Master (roles, permissions, organization_roles, initial users, project parties) ถูกรวมอยู่ในสคริปต์สคีมาแล้ว

## 🧩 การปรับปรุงที่แนะนำ (สำหรับอนาคต) (Recommended Enhancements (Future))

- ✅ **(V2)** นำ Fulltext search หรือ Elasticsearch มาใช้กับฟิลด์เช่น `correspondence_revisions.title` หรือ `details`
- ✅ สร้าง Background job (โดยใช้ **n8n** เพื่อเชื่อมต่อกับ **Line** และ/หรือใช้สำหรับการแจ้งเตือน RFA ที่ใกล้ถึงกำหนด `due_date`)
- ✅ เพิ่ม job ล้างข้อมูลเป็นระยะสำหรับ `attachments` ที่ไม่ถูกเชื่อมโยงกับ Entity ใดๆ เลย (ไฟล์กำพร้า)

---
