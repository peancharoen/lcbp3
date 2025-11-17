# **🗂️ สรุปโครงสร้างไฟล์และโฟลเดอร์ (Backend NestJS) \- DMS v1.3.0**

นี่คือภาพรวมสถาปัตยกรรมโฟลเดอร์ทั้งหมดของโปรเจกต์ NestJS API ที่เราได้พัฒนาขึ้น โดยแบ่งตามหลักการ Separation of Concerns

## **📂 (Root) โฟลเดอร์หลักของโปรเจกต์**

ไฟล์เหล่านี้จะอยู่ที่ระดับบนสุดของโปรเจกต์ (นอก src/)

* Dockerfile  
  * **หน้าที่:** คำสั่งสำหรับ Build Docker Image (Multi-stage build) เพื่อนำไป Deploy  
* docker-compose.yml  
  * **หน้าที่:** ไฟล์ตั้งค่าสำหรับ QNAP Container Station ใช้กำหนด Services, Networks, และ (สำคัญที่สุด) Environment Variables (เช่น DATABASE\_HOST, JWT\_SECRET)  
* package.json  
  * **หน้าที่:** เก็บรายการ Dependencies ทั้งหมด (เช่น @nestjs/core, typeorm, bcrypt, @nestjs/elasticsearch)  
* .gitignore, tsconfig.json, nest-cli.json  
  * **หน้าที่:** ไฟล์ตั้งค่าพื้นฐานของโปรเจกต์ TypeScript และ NestJS

## **📂 src/ (Source Code)**

นี่คือหัวใจหลักของแอปพลิเคชัน

### **1\. src/ (Root Files)**

* main.ts  
  * **หน้าที่:** จุดเริ่มต้น (Entry Point) ของแอปพลิเคชัน  
  * **การตั้งค่า:**  
    * ใช้ helmet() (Security)  
    * ใช้ RateLimiterGuard (Security)  
    * ใช้ ValidationPipe (Global Pipe สำหรับ DTO)  
    * ใช้ HttpExceptionFilter (Global Filter สำหรับ Error Handling)  
    * ตั้งค่า SwaggerModule (สำหรับสร้าง API Docs)  
    * ตั้งค่า Global Prefix (/api/v1)  
* app.module.ts  
  * **หน้าที่:** โมดูลหลัก (Root Module)  
  * **การตั้งค่า:**  
    * Import ConfigModule (สำหรับ .env)  
    * Import TypeOrmModule (เชื่อมต่อฐานข้อมูล)  
    * **Import โมดูลหลักและโมดูล Feature ทั้งหมด** (เช่น CommonModule, UserModule, CorrespondenceModule, SearchModule ฯลฯ)

### **2\. src/common/ (The Foundation)**

โฟลเดอร์นี้คือ "รากฐาน" เก็บโค้ดที่โมดูลอื่นต้องใช้ร่วมกัน (Shared Logic)

* common.module.ts  
  * **หน้าที่:** ไฟล์ที่รวบรวมและ export Service/Module ทั้งหมดใน common/ ให้โมดูลอื่นเรียกใช้ง่ายๆ  
* auth/  
  * **หน้าที่:** จัดการการยืนยันตัวตน (Authentication) และสิทธิ์ (RBAC)  
  * auth.module.ts, auth.service.ts, auth.controller.ts (สำหรับ /login, /me)  
  * strategies/jwt.strategy.ts (ตรรกะการถอดรหัส JWT)  
  * guards/rbac.guard.ts (ตัวตรวจสอบสิทธิ์ RBACGuard)  
  * decorators/require-permission.decorator.ts (@RequirePermission)  
  * decorators/current-user.decorator.ts (@CurrentUser)  
* entities/  
  * **หน้าที่:** **ศูนย์รวม Entities ทั้งหมด (44+ ไฟล์)** ที่ Map กับตารางใน MariaDB  
  * เช่น user.entity.ts, role.entity.ts, correspondence.entity.ts, rfa.entity.ts, shop-drawing.entity.ts, circulation.entity.ts, attachment.entity.ts, audit-log.entity.ts ฯลฯ  
  * views/: โฟลเดอร์ย่อยสำหรับ View Entities (เช่น view-current-correspondence.entity.ts)  
* config/  
  * **หน้าที่:** เก็บ Config ที่ซับซ้อน เช่น typeorm.config.ts (ตั้งค่าการเชื่อมต่อ TypeORM)  
* exceptions/  
  * http-exception.filter.ts (Global Error Handler)  
* file-storage/  
  * file-storage.service.ts (Logic การบันทึกไฟล์ลง Disk)  
  * file.controller.ts (API Endpoint /files/upload)  
* audit-log/  
  * audit-log.service.ts (Service บันทึก Log)  
  * audit-log.interceptor.ts (Interceptor ดักจับการกระทำ)  
* security/  
  * rate-limiter.module.ts (ตั้งค่า Rate Limiting)

### **3\. src/modules/ (The Features)**

โฟลเดอร์นี้เก็บ "Business Logic" โดยแยกเป็น Feature Modules อย่างชัดเจน

* user/ (Phase 1\)  
  * **หน้าที่:** API สำหรับ Admin Panel (จัดการ Users, Roles, Permissions)  
  * admin-users.controller.ts, admin-roles.controller.ts, user.service.ts, roles.service.ts  
* project/ (Phase 2\)  
  * **หน้าที่:** API สำหรับจัดการโปรเจกต์ (ยังไม่ได้สร้างไฟล์ แต่มีในแผน)  
* document-numbering/ (Phase 2\)  
  * **หน้าที่:** API สำหรับ Admin (ตั้งค่า Format เลขที่) และ Service (generateNextDocumentNumber)  
* master-data/ (Phase 2\)  
  * **หน้าที่:** API สำหรับ Admin (จัดการ Master Data เช่น Tags, RFA Types, Corr. Types)  
* correspondence/ (Phase 2\)  
  * **หน้าที่:** Logic หลักในการสร้าง/ค้นหา เอกสารโต้ตอบ  
* rfa/ (Phase 3\)  
  * **หน้าที่:** Logic หลักในการสร้าง/ค้นหา เอกสารขออนุมัติ (RFA)  
* drawing/ (Phase 3\)  
  * **หน้าที่:** Logic หลักในการสร้าง/ค้นหา แบบแปลน (Contract & Shop Drawing)  
* circulation/ (Phase 3\)  
  * **หน้าที่:** Logic หลักในการสร้าง/ค้นหา ใบเวียนภายใน  
* transmittal/ (Phase 3\)  
  * **หน้าที่:** Logic หลักในการสร้าง/ค้นหา เอกสารนำส่ง  
* search/ (Phase 4\)  
  * **หน้าที่:** API (/search) และ Service ที่เชื่อมต่อกับ Elasticsearch  
* notification/ (Phase 4\)  
  * **หน้าที่:** Service สำหรับยิง Webhook ไปยัง N8N  
* caching/ (Phase 4\)  
  * **หน้าที่:** โมดูลตั้งค่า Caching (Global)  
* health/ (Phase 5 \- Deploy)  
  * **หน้าที่:** API (/health) สำหรับ Health Check