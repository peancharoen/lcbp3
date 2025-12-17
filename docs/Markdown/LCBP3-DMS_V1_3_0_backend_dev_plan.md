
# แผนการพัฒนา Backend NestJS สำหรับ DMS v1.3.0

## การเตรียมความพร้อมและการติดตั้ง (Prerequisites & Setup)

- [ ] สร้าง NestJS Project ใหม่ (backend/src)
- [✅] ติดตั้ง Dependencies หลักๆ ตาม Technology Stack
  - [✅] `@nestjs/core`, `@nestjs/common`
  - [✅] `@nestjs/typeorm`, `typeorm`
  - [✅] `@nestjs/jwt`, `@nestjs/passport`, `passport-jwt`
  - [✅] `casl`
  - [✅] `class-validator`, `class-transformer`
  - [✅] `@nestjs/swagger`
  - [✅] `winston`, `helmet`, `rate-limiter-flexible`
- [✅] ตั้งค่า `tsconfig.json`, `nest-cli.json` และไฟล์ config อื่นๆ
- [ ] ตั้งค่าการเชื่อมต่อ MariaDB ผ่าน TypeORM
  - [ ] **(สำคัญ)** กำหนดค่าตัวแปรสภาพแวดล้อม (DATABASE_URL, JWT_SECRET) ผ่าน `docker-compose.yml`

---

## Phase 1: การสร้างรากฐาน (Foundation) - สัปดาห์ที่ 1-2

- [ ] พัฒนา Core Auth Module (`AuthModule`)
  - [✅] สร้าง Entities: `Users`, `Roles`, `Permissions`
  - [✅] สร้าง `AuthService` สำหรับ Login, Register, JWT Generation
  - [✅] สร้าง `JwtStrategy` สำหรับ Passport
  - [✅] สร้าง `RBACGuard` โดยใช้ CASL
  - [✅] สร้าง API Endpoints: `/auth/login`, `/auth/me`
- [✅] พัฒนา Common Module (`@app/common`)
  - [✅] สร้าง `FileStorageService` สำหรับจัดการไฟล์ (อัปโหลด/ดาวน์โหลด)
  - [✅] สร้าง `AuditLogInterceptor` สำหรับบันทึกการกระทำโดยอัตโนมัติ
  - [✅] สร้าง Global Exception Filter
  - [✅] สร้าง DTOs และ Interfaces พื้นฐาน

---

## Phase 2: พัฒนาเอนทิตีหลัก (Core Entities) - สัปดาห์ที่ 3-4

- [✅] พัฒนา Project Module (`ProjectModule`)
  - [✅] สร้าง Entities: `Project`, `Organization`, `Contract`, `ProjectParty`
  - [✅] สร้าง Services สำหรับ CRUD และจัดการความสัมพันธ์
  - [✅] สร้าง Controller พร้อม Swagger Decorators
- [ ] พัฒนา Correspondence Module (`CorrespondenceModule`)
  - [ ] สร้าง Entities: `Correspondence`, `CorrespondenceRevision`, `CorrespondenceAttachment`
  - [ ] สร้าง Services สำหรับจัดการเอกสาร การสร้าง Revision
  - [ ] เชื่อมโยงกับ `FileStorageService` และ `DocumentNumberingService`
- [ ] พัฒนา Attachment Management
  - [ ] พัฒนา API อัปโหลดไฟล์ (`POST /correspondences/:id/attachments`)
  - [ ] พัฒนา API ดาวน์โหลดไฟล์ (`GET /attachments/:id/download`)
  - [ ] ใช้ Junction Tables (`correspondence_attachments`) ในการเชื่อมโยง

---

## Phase 3: พัฒนาเวิร์กโฟลว์เฉพาะทาง (Specialized Workflows) - สัปดาห์ที่ 5-7

- [ ] พัฒนา RFA Module (`RfaModule`)
  - [ ] สร้าง Entities: `Rfa`, `RfaRevision`, `RfaWorkflow`, `RfaItem`
  - [ ] สร้าง Service สำหรับจัดการ Workflow การอนุมัติ (ส่ง -> อนุมัติ/ปฏิเสธ -> ส่งกลับ)
  - [ ] จัดการ State Transitions ตาม `rfa_status_transitions`
- [ ] พัฒนา Drawing Module (`DrawingModule`)
  - [ ] สร้าง Entities: `ShopDrawing`, `ShopDrawingRevision`, `ContractDrawing`
  - [ ] สร้าง Services สำหรับจัดการแบบแปลนและการอ้างอิงระหว่าง Shop และ Contract Drawing
- [ ] พัฒนา Circulation Module (`CirculationModule`)
  - [ ] สร้าง Entities: `Circulation`, `CirculationAssignee`
  - [ ] สร้าง Service สำหรับการสร้างใบเวียน มอบหมายงาน และติดตามสถานะ
- [ ] พัฒนา Transmittal Module (`TransmittalModule`)
  - [ ] สร้าง Entities: `Transmittal`, `TransmittalItem`
  - [ ] สร้าง Service สำหรับการสร้างเอกสารนำส่ง

---

## Phase 4: คุณสมบัติขั้นสูงและการเชื่อมโยง (Advanced Features) - สัปดาห์ที่ 8-9

- [ ] พัฒนา Document Numbering Module (`DocumentNumberingModule`)
  - [ ] สร้าง `DocumentNumberingService` (Internal Module)
  - [ ] Implement การเรียกใช้ Stored Procedure `sp_get_next_document_number`
  - [ ] ให้บริการแก่ `CorrespondenceModule` และโมดูลอื่นๆ
- [ ] พัฒนา Search Module (`SearchModule`)
  - [ ] ตั้งค่า Elasticsearch
  - [ ] สร้าง Service สำหรับ Index ข้อมูลจาก Views (`v_current_correspondences`, `v_current_rfas`)
  - [ ] สร้าง API ค้นหาขั้นสูง (`/search`)
- [ ] พัฒนา Notification Service
  - [ ] สร้าง `NotificationService` ใน `CommonModule`
  - [ ] Implement การส่ง Email ผ่าน `nodemailer`
  - [ ] สร้าง Trigger สำหรับส่งการแจ้งเตือน (เอกสารใหม่, เปลี่ยนสถานะ, ใกล้ถึง Deadline)
  - [ ] เตรียมพร้อมสำหรับการเชื่อมต่อกับ N8N สำหรับ Line Notification

---

## Phase 5: การทดสอบและเพิ่มประสิทธิภาพ (Testing & Optimization) - สัปดาห์ที่ 10

- [ ] ดำเนินการทดสอบ (Testing)
  - [ ] เขียน Unit Tests สำหรับ Business Logic ใน Services และ Guards
  - [ ] เขียน Integration Tests สำหรับ Controller -> Service -> Repository (โดยใช้ Test Database)
  - [ ] เขียน E2E Tests สำหรับตรวจสอบ API Contract ว่าตรงตาม Swagger
- [ ] ปรับปรุงประสิทธิภาพ (Performance)
  - [ ] ใช้ Caching (`@nestjs/cache-manager`) สำหรับข้อมูลที่ถูกเรียกบ่อย (Roles, Permissions)
  - [ ] ตรวจสอบ Query และใช้ Database Indexes ให้เป็นประโยชน์ (มีอยู่แล้วใน SQL)
  - [ ] ใช้ Pagination สำหรับข้อมูลจำนวนมาก
- [ ] เพิ่มความปลอดภัย (Security)
  - [ ] ติดตั้ง `helmet` สำหรับตั้งค่า HTTP Headers
  - [ ] ติดตั้ง `rate-limiter-flexible` สำหรับป้องกัน Brute-force
- [ ] จัดเตรียมเอกสาร (Documentation)
  - [ ] ตรวจสอบความสมบูรณ์ของ Swagger Documentation
  - [ ] เพิ่ม JSDoc Comments สำหรับ Methods และ Classes ที่สำคัญ

---

## การ Deploy บน QNAP Container Station

- [ ] เตรียมการ Deploy บน QNAP Container Station
  - [ ] สร้าง `Dockerfile` สำหรับ NestJS App
  - [ ] สร้างไฟล์ `docker-compose.yml` สำหรับ `backend` service
  - [ ] กำหนด `environment` สำหรับ `DATABASE_HOST`, `DATABASE_USER`, `DATABASE_PASSWORD`, `JWT_SECRET`
  - [ ] เชื่อมต่อกับ `lcbp3` network
  - [ ] ทดสอบ Build และ Run บน Container Station UI
  - [ ] ตั้งค่า Health Check endpoint (`/health`) โดยใช้ `@nestjs/terminus`
