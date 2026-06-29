# 📝 **Documents Management System Version 1.4.5: Application Requirements Specification**

**สถานะ:** FINAL-Rev.05
**วันที่:** 2025-11-29
**อ้างอิงพื้นฐาน:** v1.4.4
**Classification:** Internal Technical Documentation

## 📌 **1. วัตถุประสงค์**

สร้างเว็บแอปพลิเคชันสำหรับระบบบริหารจัดการเอกสารโครงการ (Document Management System - DMS) แบบครบวงจร ที่เน้นความปลอดภัยสูงสุด ความถูกต้องของข้อมูล (Data Integrity) และรองรับการขยายตัวในอนาคต (Scalability) โดยแก้ไขปัญหา Race Condition และเพิ่มความเสถียรในการจัดการไฟล์ และใช้ Unified Workflow Engine ในการจัดการกระบวนการอนุมัติทั้งหมดเพื่อความยืดหยุ่น

- มีฟังก์ชันหลักในการอัปโหลด จัดเก็บ ค้นหา แชร์ และควบคุมสิทธิ์การเข้าถึงเอกสาร
- ช่วยลดการใช้เอกสารกระดาษ เพิ่มความปลอดภัยในการจัดเก็บข้อมูล
- เพิ่มความสะดวกในการทำงานร่วมกันระหว่างองกรณ์
- **เสริม:** ปรับปรุงความปลอดภัยของระบบด้วยมาตรการป้องกันที่ทันสมัย
- **เสริม:** เพิ่มความทนทานของระบบด้วยกลไก resilience patterns
- **เสริม:** สร้างระบบ monitoring และ observability ที่ครอบคลุม

## 🛠️ **2. สถาปัตยกรรมและเทคโนโลยี (System Architecture & Technology Stack)**

ใช้สถาปัตยกรรมแบบ Headless/API-First ที่ทันสมัย ทำงานทั้งหมดบน QNAP Server ผ่าน Container Station เพื่อความสะดวกในการจัดการและบำรุงรักษา

**Domain:** `np-dms.work`, `www.np-dms.work`
**IP:** 159.192.126.103
**Docker Network:** ทุก Service จะเชื่อมต่อผ่านเครือข่ายกลางชื่อ `lcbp3` เพื่อให้สามารถสื่อสารกันได้

### **2.1 Infrastructure & Environment:**

- **Server:** QNAP (Model: TS-473A, RAM: 32GB, CPU: AMD Ryzen V1500B)
- **Containerization:** Container Station (Docker & Docker Compose) ใช้ UI ของ Container Station เป็นหลัก ในการ configuration และการรัน docker command
- **Development Environment:** VS Code/Cursor on Windows 11
- **Data Storage:** `/share/dms-data` บน QNAP
- **ข้อจำกัด:** ไม่สามารถใช้ .env ในการกำหนดตัวแปรภายนอกได้ ต้องกำหนดใน docker-compose.yml เท่านั้น

### **2.2 การจัดการ Configuration (ปรับปรุง):**

- ใช้ `docker-compose.yml` สำหรับ environment variables ตามข้อจำกัดของ QNAP
- **Secrets Management (ใหม่):**
  - ห้ามระบุ Sensitive Secrets (Password, Keys) ใน `docker-compose.yml` หลัก
  - ต้องใช้ไฟล์ `docker-compose.override.yml` (ที่ถูก gitignore) สำหรับ Inject Environment Variables ที่เป็นความลับในแต่ละ Environment (Dev/Prod)
  - ไฟล์ `docker-compose.yml` หลักให้ใส่ค่า Dummy หรือว่างไว้
- **แต่ต้องมี mechanism สำหรับจัดการ sensitive secrets อย่างปลอดภัย** โดยใช้:
  - Docker secrets (ถ้ารองรับ)
  - External secret management (Hashicorp Vault) หรือ
  - Encrypted environment variables
- Development environment ยังใช้ .env ได้ แต่ต้องไม่ commit เข้า version control
- ต้องมี configuration validation during application startup
- ต้องแยก configuration ตาม environment (development, staging, production)

### **2.3 Core Services:**

- **Code Hosting:** Gitea (Self-hosted on QNAP)
  - Application name: git
  - Service name: gitea
  - Domain: `git.np-dms.work`
  - หน้าที่: เป็นศูนย์กลางในการเก็บและจัดการเวอร์ชันของโค้ด (Source Code) สำหรับทุกส่วน

- **Backend / Data Platform:** NestJS
  - Application name: lcbp3-backend
  - Service name: backend
  - Domain: `backend.np-dms.work`
  - Framework: NestJS (Node.js, TypeScript, ESM)
  - หน้าที่: จัดการโครงสร้างข้อมูล (Data Models), สร้าง API, จัดการสิทธิ์ผู้ใช้ (Roles & Permissions), และสร้าง Workflow ทั้งหมดของระบบ

- **Database:** MariaDB 10.11
  - Application name: lcbp3-db
  - Service name: mariadb
  - Domain: `db.np-dms.work`
  - หน้าที่: ฐานข้อมูลหลักสำหรับเก็บข้อมูลทั้งหมด
  - Tooling: DBeaver (Community Edition), phpmyadmin สำหรับการออกแบบและจัดการฐานข้อมูล

- **Database Management:** phpMyAdmin
  - Application name: lcbp3-db
  - Service: phpmyadmin:5-apache
  - Service name: pma
  - Domain: `pma.np-dms.work`
  - หน้าที่: จัดการฐานข้อมูล mariadb ผ่าน Web UI

- **Frontend:** Next.js
  - Application name: lcbp3-frontend
  - Service name: frontend
  - Domain: `lcbp3.np-dms.work`
  - Framework: Next.js (App Router, React, TypeScript, ESM)
  - Styling: Tailwind CSS + PostCSS
  - Component Library: shadcn/ui
  - หน้าที่: สร้างหน้าตาเว็บแอปพลิเคชันสำหรับให้ผู้ใช้งานเข้ามาดู Dashboard, จัดการเอกสาร, และติดตามงาน โดยจะสื่อสารกับ Backend ผ่าน API

- **Workflow Automation:** n8n
  - Application name: lcbp3-n8n
  - Service: n8nio/n8n:latest
  - Service name: n8n
  - Domain: `n8n.np-dms.work`
  - หน้าที่: จัดการ workflow ระหว่าง Backend และ Line

- **Reverse Proxy:** Nginx Proxy Manager
  - Application name: lcbp3-npm
  - Service: Nginx Proxy Manager (nginx-proxy-manage: latest)
  - Service name: npm
  - Domain: `npm.np-dms.work`
  - หน้าที่: เป็นด่านหน้าในการรับ-ส่งข้อมูล จัดการโดเมนทั้งหมด, ทำหน้าที่เป็น Proxy ชี้ไปยัง Service ที่ถูกต้อง, และจัดการ SSL Certificate (HTTPS) ให้อัตโนมัติ

- **Search Engine:** Elasticsearch
- **Cache:** Redis

### **2.4 Business Logic & Consistency (ปรับปรุง):**

- **2.4.1 Unified Workflow Engine (หลัก):**
  - ระบบการเดินเอกสารทั้งหมด (Correspondence, RFA, Circulation) ต้อง ใช้ Engine กลางเดียวกัน โดยกำหนด Logic ผ่าน Workflow DSL (JSON Configuration) แทนการเขียน Hard-coded ลงในตาราง
  - Workflow Versioning (เพิ่ม): ระบบต้องรองรับการกำหนด Version ของ Workflow Definition โดยเอกสารที่เริ่มกระบวนการไปแล้ว (In-progress instances) จะต้องใช้ Workflow Version เดิม จนกว่าจะสิ้นสุดกระบวนการ หรือได้รับคำสั่ง Migrate จาก Admin เพื่อป้องกันความขัดแย้งของ State

- **2.4.2 Separation of Concerns:**
  - Module ต่างๆ (Correspondence, RFA, Circulation) จะเก็บเฉพาะข้อมูลของเอกสาร (Data) ส่วนสถานะและการเปลี่ยนสถานะ (State Transition) จะถูกจัดการโดย Workflow Engine

- **2.4.3 Idempotency & Locking:**
  - ใช้กลไกเดิมในการป้องกันการทำรายการซ้ำ

- **2.4.4 Optimistic Locking (ใหม่):**
  - ใช้ Version Column ใน Database ควบคู่กับ Redis Lock สำหรับการสร้างเลขที่เอกสาร เพื่อเป็น Safety Net ชั้นสุดท้าย

- **2.4.5** **จะไม่มีการใช้ SQL Triggers**
  - เพื่อป้องกันตรรกะซ่อนเร้น (Hidden Logic) และความซับซ้อนในการดีบัก

### **2.5 Data Migration และ Schema Versioning:**

- ต้องมี database migration scripts สำหรับทุก schema change โดยใช้ TypeORM migrations
- ต้องรองรับ rollback ของ migration ได้
- ต้องมี data seeding strategy สำหรับ environment ต่างๆ (development, staging, production)
- ต้องมี version compatibility between schema versions
- Migration scripts ต้องผ่านการทดสอบใน staging environment ก่อน production
- ต้องมี database backup ก่อนทำ migration ใน production

### **2.6 กลยุทธ์ความทนทานและการจัดการข้อผิดพลาด (Resilience & Error Handling Strategy)**

- 2.6.1 Circuit Breaker Pattern: ใช้สำหรับ external service calls (Email, LINE, Elasticsearch)
- 2.6.2 Retry Mechanism: ด้วย exponential backoff สำหรับ transient failures
- 2.6.3 Fallback Strategies: Graceful degradation เมื่อบริการภายนอกล้มเหลว
- 2.6.4 Error Handling: Error messages ต้องไม่เปิดเผยข้อมูล sensitive
- 2.6.5 Monitoring: Centralized error monitoring และ alerting system

## **📦 3. ข้อกำหนดด้านฟังก์ชันการทำงาน (Functional Requirements)**

### **3.1. การจัดการโครงสร้างโครงการและองค์กร**

- 3.1.1. โครงการ (Projects): ระบบต้องสามารถจัดการเอกสารภายในหลายโครงการได้ (ปัจจุบันมี 4 โครงการ และจะเพิ่มขึ้นในอนาคต)
- 3.1.2. สัญญา (Contracts): ระบบต้องสามารถจัดการเอกสารภายในแต่ละสัญญาได้ ในแต่ละโครงการ มีได้หลายสัญญา หรืออย่างน้อย 1 สัญญา
- 3.1.3. องค์กร (Organizations):
  - มีหลายองค์กรในโครงการ องค์กรณ์ที่เป็น Owner, Designer และ Consultant สามารถอยู่ในหลายโครงการและหลายสัญญาได้
  - Contractor จะถือ 1 สัญญา และอยู่ใน 1 โครงการเท่านั้น

### **3.2. การจัดการเอกสารโต้ตอบ (Correspondence Management)**

- 3.2.1. วัตถุประสงค์:
  - เอกสารโต้ตอบ (correspondences) ระหว่างองค์กรณ์-องค์กรณ์ ภายใน โครงการ (Projects) และระหว่าง องค์กรณ์-องค์กรณ์ ภายนอก โครงการ (Projects), รองรับ To (ผู้รับหลัก) และ CC (ผู้รับสำเนา) หลายองค์กรณ์
- 3.2.2. ประเภทเอกสาร:
  - ระบบต้องรองรับเอกสารรูปแบบ ไฟล์ PDF, ZIP
  - เอกสารโต้ตอบ (Correspondence) สามารถมีได้หลายประเภท (Types) เช่น จดหมาย (Letter), อีเมล์ (Email), Request for Information (RFI), รวมถึง เอกสารขออนุมัติ (RFA) แต่ละ revision และสามารถเพิ่มประเภทใหม่ได้ในภายหลัง
- 3.2.3. การสร้างเอกสาร (Correspondence):
  - ผู้ใช้ที่มีสิทธิ์ (เช่น Document Control) สามารถสร้างเอกสารรอไว้ในสถานะ ฉบับร่าง" (Draft) ได้ ซึ่งผู้ใช้งานต่างองค์กรจะมองไม่เห็น
  - เมื่อกด "Submitted" แล้ว การแก้ไข, ถอนเอกสารกลับไปสถานะ Draft, หรือยกเลิก (Cancel) จะต้องทำโดยผู้ใช้ระดับ Admin ขึ้นไป พร้อมระบุเหตุผล
- 3.2.4. การอ้างอิงและจัดกลุ่ม:
  - เอกสารสามารถอ้างถึง (Reference) เอกสารฉบับก่อนหน้าได้หลายฉบับ
  - สามารถกำหนด Tag ได้หลาย Tag เพื่อจัดกลุ่มและใช้ในการค้นหาขั้นสูง
- 3.2.5. Workflow (Unified Workflow):
  - ระบบต้องรองรับ Workflow ที่เป็นแบบ Unified Workflow

### **3.3. การจัดการเอกสาขออนุมัติ (Request for Approval / RFA)**

- 3.3.1. วัตถุประสงค์:
  - เอกสารขออนุมัติ (RFA) ภายใน โครงการ (Projects)
- 3.3.2. ประเภทเอกสาร:
  - ระบบต้องรองรับเอกสารรูปแบบ ไฟล์ PDF
  - เอกสารขออนุมัติ (RFA) สามารถมีได้หลาย revision
  - มีประถทของเอกสาร ได้หลายประเภท (RFA Types) และสามารถเพิ่มประเภทใหม่ได้ในภายหลัง
- 3.3.3. การสร้างเอกสาร:
  - ผู้ใช้ที่มีสิทธิ์ (เช่น Document Control) สามารถสร้างเอกสารขออนุมัติ (RFA) รอไว้ในสถานะ ฉบับร่าง" (Draft) ได้ ซึ่งผู้ใช้งานต่างองค์กรจะมองไม่เห็น
  - เมื่อกด "Submitted" แล้ว การแก้ไข, ถอนเอกสารกลับไปสถานะ Draft, หรือยกเลิก (Cancel) จะต้องทำโดยผู้ใช้ระดับ Admin ขึ้นไป พร้อมระบุเหตุผล
- 3.3.4. การอ้างอิงและจัดกลุ่ม:
  - RFA สามารถอ้างถึง (Reference) แบบก่อสร้าง (Shop Drawing) ได้หลายฉบับ
- 3.3.5. Workflow (Unified Workflow):
  - ระบบต้องรองรับ Workflow ที่เป็นแบบ Unified Workflow ซึ่งจะมีสถานะและกิจกรรมที่ไม่เหมือนกันกับเอกสารโต้ตอบ (Correspondence)

### **3.4. การจัดการแบบคู่สัญญา (Contract Drawing)**

- 3.4.1. วัตถุประสงค์: แบบคู่สัญญา (Contract Drawing) ใช้เพื่ออ้างอิงและใช้ในการตรวจสอบ
- 3.4.2. ประเภทเอกสาร: ไฟล์ PDF
- 3.4.3. การสร้างเอกสาร: ผู้ใช้ที่มีสิทธิ์ สามารถสร้างและแก้ไขได้
- 3.4.4. การอ้างอิงและจัดกลุ่ม: ใช้สำหรับอ้างอิง ใน Shop Drawings, มีการจัดหมวดหมู่ของ Contract Drawing

### **3.5. การจัดกาแบบก่อสร้าง (Shop Drawing)**

- 3.5.1. วัตถุประสงค์: แบบก่อสร้าง (Shop Drawing) ใช้เในการตรวจสอบ โดยจัดส่งด้วย Request for Approval (RFA)
- 3.5.2. ประเภทเอกสาร: ไฟล์ PDF, DWG, ZIP
- 3.5.3. การสร้างเอกสาร: ผู้ใช้ที่มีสิทธิ์ สามารถสร้างและแก้ไขได้ โดยผู้ใช้ที่มีสิทธิ์ (เช่น Document Control) สามารถสร้างเอกสารรอไว้ในสถานะ ฉบับร่าง" (Draft) ได้ ซึ่งผู้ใช้งานต่างองค์กรจะมองไม่เห็น
- 3.5.4. การอ้างอิงและจัดกลุ่ม: ใช้สำหรับอ้างอิง ใน RFA, มีการจัดหมวดหมู่ของ Shop Drawings โดยทุก แบบก่อสร้าง (Shop Drawing) แต่ละ revision ต้องมี RFA ได้เพียง 1 ฉบับ

### **3.6. การจัดการ Workflow (Unified Workflow)**

- 3.6.1 Workflow Definition:
  - Admin ต้องสามารถสร้าง/แก้ไข Workflow Rule ได้ผ่านหน้าจอ UI (DSL Editor)
  - รองรับการกำหนด State, Transition, Required Role, Condition (JS Expression)

- 3.6.2 Workflow Execution:
  - ระบบต้องรองรับการสร้าง Instance ของ Workflow ผูกกับเอกสาร (Polymorphic)
  - รองรับการเปลี่ยนสถานะ (Action) เช่น Approve, Reject, Comment, Return
  - Auto-Action: รองรับการเปลี่ยนสถานะอัตโนมัติเมื่อครบเงื่อนไข (เช่น Review ครบทุกคน)

- 3.6.3 Flexibility:
  - รองรับ Parallel Review (ส่งให้หลายคนตรวจพร้อมกัน)
  - รองรับ Conditional Flow (เช่น ถ้ายอดเงิน > X ให้เพิ่มผู้อนุมัติ)

- 3.6.4 Workflow การอนุมัติ:
  - รองรับกระบวนการอนุมัติที่ซับซ้อนและเป็นลำดับ เช่น ส่งจาก Originator -> Organization 1 -> Organization 2 -> Organization 3 แล้วส่งผลกลับตามลำดับเดิม (โดยถ้า องกรณ์ใดใน Workflow ให้ส่งกลับ ก็สามารถส่งผลกลับตามลำดับเดิมโดยไม่ต้องรอให้ถึง องกรณืในลำดับถัดไป)

- 3.6.5 การจัดการ:
  - สามารถกำหนดวันแล้วเสร็จ (Deadline) สำหรับผู้รับผิดชอบของ องกรณ์ ที่อยู่ใน Workflow ได้
  - มีระบบแจ้งเตือน ให้ผู้รับผิดชอบของ องกรณ์ ที่อยู่ใน Workflow ทราบ เมื่อมี RFA ใหม่ หรือมีการเปลี่ยนสถานะ
  - สามารถข้ามขั้นตอนได้ในกรณีพิเศษ (โดยผู้มีสิทธิ์)
  - สามารถส่งกลับขั้นตอนก่อนหน้าได้

### **3.7.การจัดการเอกสารนำส่ง (Transmittals)**

- 3.7.1. วัตถุประสงค์: เอกสารนำส่ง ใช้สำหรับ นำส่ง Request for Approval (RFAS) หลายฉบับ ไปยังองค์กรอื่น
- 3.7.2. ประเภทเอกสาร: ไฟล์ PDF
- 3.7.3. การสร้างเอกสาร: ผู้ใช้ที่มีสิทธิ์ สามารถสร้างและแก้ไขได้
- 3.7.4. การอ้างอิงและจัดกลุ่ม: เอกสารนำส่ง เป็นส่วนหนึ่งใน Correspondence

### **3.8.ใบเวียนเอกสาร (Circulation Sheet)**

- 3.8.1. วัตถุประสงค์: การสื่อสาร เอกสาร (Correspondence) ทุกฉบับ จะมีใบเวียนเอกสารเพื่อควบคุมและมอบหมายงานภายในองค์กร (สามารถดูและแก้ไขได้เฉพาะคนในองค์กร)
- 3.8.2. ประเภทเอกสาร: ไฟล์ PDF
- 3.8.3. การสร้างเอกสาร: ผู้ใช้ที่มีสิทธิ์ในองค์กรนั้น สามารถสร้างและแก้ไขได้
- 3.8.4. การอ้างอิงและจัดกลุ่ม: การระบุผู้รับผิดชอบ:
  - ผู้รับผิดชอบหลัก (Main): มีได้หลายคน
  - ผู้ร่วมปฏิบัติงาน (Action): มีได้หลายคน
  - ผู้ที่ต้องรับทราบ (Information): มีได้หลายคน
- 3.8.5. การติดตามงาน:
  - สามารถกำหนดวันแล้วเสร็จ (Deadline) สำหรับผู้รับผิดชอบประเภท Main และ Action ได้
  - มีระบบแจ้งเตือนเมื่อมี Circulation ใหม่ และแจ้งเตือนล่วงหน้าก่อนถึงวันแล้วเสร็จ
  - สามารถปิด Circulation ได้เมื่อดำเนินการตอบกลับไปยังองค์กรผู้ส่ง (Originator) แล้ว หรือ รับทราบแล้ว (For Information)

### **3.9. ประวัติการแก้ไข (Revisions):** ระบบจะเก็บประวัติการสร้างและแก้ไข เอกสารทั้งหมด

### **3.10. การจัดเก็บไฟล์ (File Handling - ปรับปรุงใหญ่)**

- **3.10.1 Two-Phase Storage Strategy:**
  1. **Phase 1 (Upload):** ไฟล์ถูกอัปโหลดเข้าโฟลเดอร์ `temp/` และได้รับ `temp_id`
  2. **Phase 2 (Commit):** เมื่อ User กด Submit ฟอร์มสำเร็จ ระบบจะย้ายไฟล์จาก `temp/` ไปยัง `permanent/{YYYY}/{MM}/` และบันทึกลง Database ภายใน Transaction เดียวกัน
  3. **Cleanup:** มี Cron Job ลบไฟล์ใน `temp/` ที่ค้างเกิน 24 ชม. (Orphan Files)

- **3.10.2 Security:**
  - Virus Scan (ClamAV) ก่อนย้ายเข้า Permanent
  - Whitelist File Types: PDF, DWG, DOCX, XLSX, ZIP
  - Max Size: 50MB
  - Access Control: ตรวจสอบสิทธิ์ผ่าน Junction Table ก่อนให้ Download Link

- **3.10.3 ความปลอดภัยของการจัดเก็บไฟล์:**
  - ต้องมีการ scan virus สำหรับไฟล์ที่อัปโหลดทั้งหมด โดยใช้ ClamAV หรือบริการ third-party
  - จำกัดประเภทไฟล์ที่อนุญาต: PDF, DWG, DOCX, XLSX, ZIP (ต้องระบุรายการที่ชัดเจน)
  - ขนาดไฟล์สูงสุด: 50MB ต่อไฟล์
  - ไฟล์ต้องถูกเก็บนอก web root และเข้าถึงได้ผ่าน authenticated endpoint เท่านั้น
  - ต้องมี file integrity check (checksum) เพื่อป้องกันการแก้ไขไฟล์
  - Download links ต้องมี expiration time (default: 24 ชั่วโมง)
  - ต้องบันทึก audit log ทุกครั้งที่มีการดาวน์โหลดไฟล์สำคัญ

### **3.11. การจัดการเลขที่เอกสาร (Document Numbering - ปรับปรุง)**

- 3.11.1. ระบบต้องสามารถสร้างเลขที่เอกสาร (Running Number) ได้โดยอัตโนมัติและยืดหยุ่นสูง
- 3.11.2. Logic การนับเลข (Counter Logic): การนับเลขจะต้องรองรับการแยกตาม Key ที่ซับซ้อนขึ้น:
  - **Project** + **Originator** + **Type** + **Discipline** (ถ้ามี) + **Sub-Type** (ถ้ามี) + **Year**
- 3.11.3. Format Template:
  - รองรับการกำหนดรูปแบบด้วย Token Replacement เช่น:
    - `{ORG}-{TYPE}-{DISCIPLINE}-{SEQ:4}-{REV}` -> `TEAM-RFA-STR-0001-A`
  - รองรับ Token: `{PROJECT}`, `{ORG}`, `{TYPE}`, `{DISCIPLINE}`, `{SUBTYPE}`, `{SUBTYPE_NUM}`, `{YEAR}`, `{YEAR_SHORT}`, `{SEQ:n}`
- 3.11.4. Transmittal Logic: รองรับเงื่อนไขพิเศษสำหรับ Transmittal ที่เลขอาจเปลี่ยนตามผู้รับ (To Owner vs To Contractor)
- 3.11.5. กลไกความปลอดภัย: ยังคงใช้ Redis Distributed Lock และ Optimistic Locking เพื่อป้องกันเลขซ้ำหรือข้าม
- 3.11.6. ต้องมี retry mechanism และ fallback strategy เมื่อการ generate เลขที่เอกสารล้มเหลว
- 3.11.7 Fallback Logic (เพิ่ม):
  - กรณีที่เอกสารประเภทนั้นไม่มี discipline_id หรือ sub_type_id (เป็นค่า NULL หรือไม่ระบุ) ให้ระบบใช้ค่า Default (เช่น 0) ในการจัดกลุ่ม Counter เพื่อป้องกัน Error และรับประกันความถูกต้องของ Running Number (Uniqueness Guarantee)
  - Scenario 1: Redis Unavailable
    - Fallback เป็น database-only locking (pessimistic lock)
    - Log warning และแจ้ง ops team
    - ระบบยังใช้งานได้แต่ performance ลดลง
  - Scenario 2: Lock Acquisition Timeout
    - Retry 5 ครั้งด้วย exponential backoff (1s, 2s, 4s, 8s, 16s)
    - หลัง 5 ครั้ง: Return error 503 "Service Temporarily Unavailable"
    - Frontend แสดง user-friendly message: "ระบบกำลังยุ่ง กรุณาลองใหม่ภายหลัง"
  - Scenario 3: Version Conflict After Lock
    - Retry transaction อีก 2 ครั้ง
    - หากยังล้มเหลว: Log error พร้อม context และ return 409 Conflict
    - Frontend แสดง user-friendly message: "เลขที่เอกสารถูกเปลี่ยน กรุณาลองใหม่"
  - Monitoring:
    - Alert ถ้า lock acquisition failures > 5% ใน 5 นาที
    - Dashboard แสดง lock wait time percentiles

### **3.12. การจัดการ JSON Details (JSON & Performance - ปรับปรุง)**

- **3.12.1 วัตถุประสงค์**
  - จัดเก็บข้อมูลแบบไดนามิกที่เฉพาะเจาะจงกับแต่ละประเภทของเอกสาร
  - รองรับการขยายตัวของระบบโดยไม่ต้องเปลี่ยนแปลง database schema
  - จัดการ metadata และข้อมูลประกอบสำหรับ correspondence, routing, และ workflows

- **3.12.2 โครงสร้าง JSON Schema**
  ระบบต้องมี predefined JSON schemas สำหรับประเภทเอกสารต่างๆ:
  - 3.12.2.1 Correspondence Types
    - GENERIC: ข้อมูลพื้นฐานสำหรับเอกสารทั่วไป
    - RFI: รายละเอียดคำถามและข้อมูลทางเทคนิค
    - RFA: ข้อมูลการขออนุมัติแบบและวัสดุ
    - TRANSMITTAL: รายการเอกสารที่ส่งต่อ
    - LETTER: ข้อมูลจดหมายทางการ
    - EMAIL: ข้อมูลอีเมล
  - 3.12.2.2 Rworkflow Types
    - workflow_definitions: กฎและเงื่อนไขการส่งต่อ
    - workflow_histories: สถานะและประวัติการส่งต่อ
    - workflow_instances: การดำเนินการในแต่ละขั้นตอน
  - 3.12.2.3 Audit Types
    - AUDIT_LOG: ข้อมูลการตรวจสอบ
    - SECURITY_SCAN: ผลการตรวจสอบความปลอดภัย

- **3.12.3 Virtual Columns (ปรับปรุง):**
  - สำหรับ Field ใน JSON ที่ต้องใช้ในการค้นหา (Search) หรือจัดเรียง (Sort) บ่อยๆ ต้องสร้าง Generated Column (Virtual Column) ใน Database และทำ Index ไว้ เพื่อประสิทธิภาพสูงสุด
  - Schema Consistency: Field ที่ถูกกำหนดเป็น Virtual Column ห้าม เปลี่ยนแปลง Key Name หรือ Data Type ใน JSON Schema Version ถัดไป หากจำเป็นต้องเปลี่ยน ต้องมีแผนการ Re-index หรือ Migration ข้อมูลเดิมที่ชัดเจน

- **3.12.4 Validation Rules**
  - ต้องมี JSON schema validation สำหรับแต่ละประเภท
  - ต้องรองรับ versioning ของ schema
  - ต้องมี default values สำหรับ field ที่ไม่บังคับ
  - ต้องตรวจสอบ data types และ format ให้ถูกต้อง

- **3.12.5 Performance Requirements**
  - JSON field ต้องมีขนาดไม่เกิน 50KB
  - ต้องรองรับ indexing สำหรับ field ที่ใช้ค้นหาบ่อย
  - ต้องมี compression สำหรับ JSON ขนาดใหญ่

- **3.12.6 Security Requirements**
  - ต้อง sanitize JSON input เพื่อป้องกัน injection attacks
  - ต้อง validate JSON structure ก่อนบันทึก
  - ต้อง encrypt sensitive data ใน JSON fields

- 3.12.7 JSON Schema Migration Strategy (เพิ่มเติม)
  สำหรับ Schema Breaking Changes:
  - Phase 1 - Add New Column
    ALTER TABLE correspondence_revisions
    ADD COLUMN ref_project_id_v2 INT GENERATED ALWAYS AS
    (JSON_UNQUOTE(JSON_EXTRACT(details, '$.newProjectIdPath'))) VIRTUAL;

  - Phase 2 - Backfill Old Records
    - ใช้ background job แปลง JSON format เก่าเป็นใหม่
    - Update `details` JSON ทีละ batch (1000 records)
  - Phase 3 - Switch Application Code
    - Deploy code ที่ใช้ path ใหม่
  - Phase 4 - Remove Old Column
    - หลังจาก verify แล้วว่าไม่มี error
    - Drop old virtual column

  - สำหรับ Non-Breaking Changes
    - เพิ่ม optional field ใน schema
    - Old records ที่ไม่มี field = ใช้ default value

### **3.13. ข้อกำหนดพิเศษ**

- ผู้ใช้งานที่มีสิทธิ์ระดับสูง (Global) หรือผู้ได้รับอนุญาตเป็นกรณีพิเศษ
  - สามารถเลือก สร้างในนามองค์กร (Create on behalf of) ได้ เพื่อให้สามารถออกเลขที่เอกสาร (Running Number) ขององค์กรอื่นได้โดยไม่ต้องล็อกอินใหม่
  - สามารถทำงานแทนผู้ใช้งานอื่นได้ Routing & Workflow ของ Correspondence, RFA, Circulation Sheet

### **3.14. การจัดการข้อมูลหลักขั้นสูง (Admin Panel for Master Data)**

- 3.14.1. Disciplines Management: Admin ต้องสามารถ เพิ่ม/ลบ/แก้ไข สาขางาน (Disciplines) แยกตามสัญญา (Contract) ได้
- 3.14.2. Sub-Type Mapping: Admin ต้องสามารถกำหนด Correspondence Sub-types และ Mapping รหัสตัวเลข (เช่น MAT = 11) ได้
- 3.14.3. Numbering Format Configuration: Admin ต้องมี UI สำหรับตั้งค่า Format Template ของแต่ละ Project/Type ได้โดยไม่ต้องแก้โค้ด

## **🔐 4. ข้อกำหนดด้านสิทธิ์และการเข้าถึง (Access Control Requirements)**

### **4.1. ภาพรวม:**

- ผู้ใช้และองค์กรสามารถดูและแก้ไขเอกสารได้ตามสิทธิ์ที่ได้รับ โดยระบบสิทธิ์จะเป็นแบบ Role-Based Access Control (RBAC)

### **4.2. ลำดับชั้นของสิทธิ์ (Permission Hierarchy):**

- Global: สิทธิ์สูงสุดของระบบ
- Organization: สิทธิ์ภายในองค์กร เป็นสิทธิ์พื้นฐานของผู้ใช้
- Project: สิทธิ์เฉพาะในโครงการ จะถูกพิจารณาเมื่อผู้ใช้อยู่ในโครงการนั้น
- Contract: สิทธิ์เฉพาะในสัญญา จะถูกพิจารณาเมื่อผู้ใช้อยู่ในสัญญานั้น (สัญญาเป็นส่วนหนึ่งของโครงการ)

### **4.3. กฎการบังคับใช้:**

- เมื่อตรวจสอบสิทธิ์ ระบบจะพิจารณาสิทธิ์จากทุกระดับที่ผู้ใช้มี และใช้ สิทธิ์ที่มากที่สุด (Most Permissive) เป็นตัวตัดสิน
- ตัวอย่าง: ผู้ใช้ A เป็น Viewer ในองค์กร แต่ถูกมอบหมายเป็น Editor ในโครงการ X เมื่ออยู่ในโครงการ X ผู้ใช้ A จะมีสิทธิ์แก้ไขได้

### **4.4. การกำหนดบทบาท (Roles) และขอบเขต (Scope):**

| บทบาท (Role)         | ขอบเขต (Scope) | คำอธิบาย                | สิทธิ์หลัก (Key Permissions)                                                           |
| :------------------- | :------------- | :---------------------- | :------------------------------------------------------------------------------------- |
| **Superadmin**       | Global         | ผู้ดูแลระบบสูงสุด       | ทำทุกอย่างในระบบ, จัดการองค์กร, จัดการข้อมูลหลักระดับ Global                           |
| **Org Admin**        | Organization   | ผู้ดูแลองค์กร           | จัดการผู้ใช้ในองค์กร, จัดการบทบาท/สิทธิ์ภายในองค์กร, ดูรายงานขององค์กร                 |
| **Document Control** | Organization   | ควบคุมเอกสารขององค์กร   | เพิ่ม/แก้ไข/ลบเอกสาร, กำหนดสิทธิ์เอกสารภายในองค์กร                                     |
| **Editor**           | Organization   | ผู้แก้ไขเอกสารขององค์กร | เพิ่ม/แก้ไขเอกสารที่ได้รับมอบหมาย                                                      |
| **Viewer**           | Organization   | ผู้ดูเอกสารขององค์กร    | ดูเอกสารที่มีสิทธิ์เข้าถึง                                                             |
| **Project Manager**  | Project        | ผู้จัดการโครงการ        | จัดการสมาชิกในโครงการ (เพิ่ม/ลบ/มอบบทบาท), สร้าง/จัดการสัญญาในโครงการ, ดูรายงานโครงการ |
| **Contract Admin**   | Contract       | ผู้ดูแลสัญญา            | จัดการสมาชิกในสัญญา, สร้าง/จัดการข้อมูลหลักเฉพาะสัญญา (ถ้ามี), อนุมัติเอกสารในสัญญา    |

### **4.5 . Token Management (ปรับปรุง)**

- **Payload Optimization:** ใน JWT Access Token ให้เก็บเฉพาะ `userId` และ `scope` ปัจจุบันเท่านั้น
- **Permission Caching:** สิทธิ์ละเอียด (Permissions List) ให้เก็บใน **Redis** และดึงมาตรวจสอบเมื่อ Request เข้ามา เพื่อลดขนาด Token และเพิ่มความเร็ว

### **4.6. กระบวนการเริ่มต้นใช้งาน (Onboarding Workflow) ที่สมบูรณ์**

- 4.6.1. สร้างองค์กร (Organization)
  - **Superadmin** สร้างองค์กรใหม่ (เช่น บริษัท A)
  - **Superadmin** แต่งตั้งผู้ใช้อย่างน้อย 1 คนให้เป็น **Org Admin** หรือ **Document Control** ของบริษัท A
- 4.6.2. เพิ่มผู้ใช้ในองค์กร
  - **Org Admin** ของบริษัท A เพิ่มผู้ใช้อื่นๆ (Editor, Viewer) เข้ามาในองค์กรของตน
- 4.6.3. มอบหมายผู้ใช้ให้กับโครงการ (Project)
  - **Project Manager** ของโครงการ X (ซึ่งอาจมาจากบริษัท A หรือบริษัทอื่น) ทำการ "เชิญ" หรือ "มอบหมาย" ผู้ใช้จากองค์กรต่างๆ ที่เกี่ยวข้องเข้ามาในโครงการ X
  - ในขั้นตอนนี้ **Project Manager** จะกำหนด **บทบาทระดับโครงการ** (เช่น Project Member, หรืออาจไม่มีบทบาทพิเศษ ให้ใช้สิทธิ์จากระดับองค์กรไปก่อน)
- 4.6.4. เมอบหมายผู้ใช้ให้กับสัญญา (Contract)
  - **Contract Admin** ของสัญญา Y (ซึ่งเป็นส่วนหนึ่งของโครงการ X) ทำการเลือกผู้ใช้ที่อยู่ในโครงการ X แล้ว มอบหมายให้เข้ามาในสัญญา Y
  - ในขั้นตอนนี้ **Contract Admin** จะกำหนด **บทบาทระดับสัญญา** (เช่น Contract Member) และสิทธิ์เฉพาะที่จำเป็น
- 4.6.5 Security Onboarding:
  - ต้องบังคับเปลี่ยน password ครั้งแรกสำหรับผู้ใช้ใหม่
  - ต้องมี security awareness training สำหรับผู้ใช้ที่มีสิทธิ์สูง
  - ต้องมี process สำหรับการรีเซ็ต password ที่ปลอดภัย
  - ต้องบันทึก audit log ทุกครั้งที่มีการเปลี่ยนแปลง permissions

### **4.7. การจัดการข้อมูลหลัก (Master Data Management) ที่แบ่งตามระดับ**

| ข้อมูลหลัก                          | ผู้มีสิทธิ์จัดการ               | ระดับ                              |
| :---------------------------------- | :------------------------------ | :--------------------------------- |
| ประเภทเอกสาร (Correspondence, RFA)  | **Superadmin**                  | Global                             |
| สถานะเอกสาร (Draft, Approved, etc.) | **Superadmin**                  | Global                             |
| หมวดหมู่แบบ (Shop Drawing)          | **Project Manager**             | Project (สร้างใหม่ได้ภายในโครงการ) |
| Tags                                | **Org Admin / Project Manager** | Organization / Project             |
| บทบาทและสิทธิ์ (Custom Roles)       | **Superadmin / Org Admin**      | Global / Organization              |
| Document Numbering Formats          | **Superadmin / Admin**          | Global / Organization              |

## **👥 5. ข้อกำหนดด้านผู้ใช้งาน (User Interface & Experience)**

### 5.1. Layout หลัก

- หน้าเว็บใช้รูปแบบ App Shell ที่ประกอบด้วย
  - Navbar (ส่วนบน): แสดงชื่อระบบ, เมนูผู้ใช้ (Profile), เมนูสำหรับ Document Control/เมนูสำหรับ Admin/Superadmin (จัดการผู้ใช้, จัดการสิทธิ์, และอื่นๆ), และปุ่ม Login/Logout
  - Sidebar (ด้านข้าง): เป็นเมนูหลักสำหรับเข้าถึงส่วนที่เกี่ยวข้องกับเอกสารทั้งหมด เช่น Dashboard, Correspondences, RFA, Drawings
  - Main Content Area: พื้นที่สำหรับแสดงเนื้อหาหลักของหน้าที่เลือก

### 5.2. หน้า Landing Page

- เป็นหน้าแรกที่แสดงข้อมูลบางส่วนของโครงการสำหรับผู้ใช้ที่ยังไม่ได้ล็อกอิน

### 5.3. หน้า Dashboard

- เป็นหน้าแรกหลังจากล็อกอิน ประกอบด้วย
  - การ์ดสรุปภาพรวม (KPI Cards): แสดงข้อมูลสรุปที่สำคัญขององค์กร เช่น จำนวนเอกสาร, งานที่เกินกำหนด
  - ตาราง "งานของฉัน" (My Tasks Table): แสดงรายการงานทั้งหมดจาก Circulation ที่ผู้ใช้ต้องดำเนินการ
  - Security Metrics: แสดงจำนวน files scanned, security incidents, failed login attempts

### 5.4. การติดตามสถานะ

- องค์กรสามารถติดตามสถานะเอกสารทั้งของตนเอง (Originator) และสถานะเอกสารที่ส่งมาถึงตนเอง (Recipient)

### 5.5. การจัดการข้อมูลส่วนตัว (Profile Page)

- ผู้ใช้สามารถจัดการข้อมูลส่วนตัวและเปลี่ยนรหัสผ่านของตนเองได้

### 5.6. การจัดการเอกสารทางเทคนิค (RFA)

- ผู้ใช้สามารถดู RFA ในรูปแบบ Workflow Diagram ทั้งหมดได้ในหน้าเดียว
- Interactive History (เพิ่ม): ในแผนภาพ Workflow ผู้ใช้ต้องสามารถ คลิกที่ Node หรือ Step เก่าที่ผ่านมาแล้ว เพื่อดู Audit Log ย่อยของ Step นั้นได้ทันที (เช่น ใครเป็นคนกด Approve, เวลาไหน, มี Comment อะไร) โดยไม่ต้องสลับไปดูใน Tab History แยกต่างหาก
- ขั้นตอนที่ยังไม่ถึงหรือผ่านไปแล้วจะเป็นรูปแบบ disabled
- สามารถดำเนินการได้เฉพาะในขั้นตอนที่ได้รับมอบหมายงาน (active)
- สิทธิ์ Document Control ขึ้นไป สามารถกด "Force Proceed" ไปยังขั้นตอนต่อไปได้ทุกขั้นตอน หรือ "Revert" กลับขั้นตอนก่อนหน้าได้

### 5.7. การจัดการใบเวียนเอกสาร (Circulation)

- ผู้ใช้สามารถดู Circulation ในรูปแบบ Workflow ทั้งหมดได้ในหน้าเดียว,ขั้นตอนที่ยังไม่ถึงหรือผ่านไปแล้วจะเป็นรูปแบบ diable, สามารถดำเนินการได้เฉพาะในขั้นตอนที่ได้รับมอบหมายงาน (active) เช่น ตรวจสอบแล้ว เพื่อไปยังขั้นตอนต่อไป, สิทธิ์ Document Control ขึ้นไป สามรถกด ไปยังขั้นตอนต่อไป ได้ทุกขั้นตอน, การย้อนกลับ ไปขั้นตอนก่อนหน้า สามารถทำได้โดย สิทธิ์ Document Control ขึ้นไป

### 5.8. การจัดการเอกสารนำส่ง (Transmittals)

- ผู้ใช้สามารถดู Transmittals ในรูปแบบรายการทั้งหมดได้ในหน้าเดียว

### 5.9. ข้อกำหนด UI/UX การแนบไฟล์ (File Attachment UX)

- ระบบต้องรองรับการอัปโหลดไฟล์หลายไฟล์พร้อมกัน (Multi-file upload) เช่น การลากและวาง (Drag-and-Drop)
- ในหน้าอัปโหลด (เช่น สร้าง RFA หรือ Correspondence) ผู้ใช้ต้องสามารถกำหนดได้ว่าไฟล์ใดเป็น "เอกสารหลัก" (Main Document เช่น PDF) และไฟล์ใดเป็น "เอกสารแนบประกอบ" (Supporting Attachments เช่น .dwg, .docx, .zip)
- **Security Feedback:** แสดง security warnings สำหรับ file types ที่เสี่ยงหรือ files ที่ fail virus scan
- **File Type Indicators:** แสดง file type icons และ security status

### 5.10 Form & Interaction

- **Dynamic Form Generator:** ใช้ Component กลางที่รับ JSON Schema แล้ว Render Form ออกมาอัตโนมัติ เพื่อลดความซ้ำซ้อนของโค้ดหน้าบ้าน และรองรับเอกสารประเภทใหม่ๆ ได้ทันที
- **Optimistic Updates:** การเปลี่ยนสถานะ (เช่น กด Approve, กด Read) ให้ UI เปลี่ยนสถานะทันทีให้ผู้ใช้เห็นก่อนรอ API Response (Rollback ถ้า Failed)

### 5.11 Mobile Responsiveness

- **Table Visualization:** บนหน้าจอมือถือ ตารางข้อมูลที่มีหลาย Column (เช่น Correspondence List) ต้องเปลี่ยนการแสดงผลเป็นแบบ **Card View** อัตโนมัติ
- **Navigation:** Sidebar ต้องเป็นแบบ Collapsible Drawer

### 5.12 Resilience & Offline Support

- **Auto-Save Draft:** ระบบต้องบันทึกข้อมูลฟอร์มที่กำลังกรอกลง **LocalStorage** อัตโนมัติ เพื่อป้องกันข้อมูลหายกรณีเน็ตหลุดหรือปิด Browser โดยไม่ได้ตั้งใจ
- **State Management:** ใช้ State Management ที่เหมาะสมและไม่ซับซ้อนเกินไป โดยเน้นการใช้ React Query สำหรับ Server State และ React Hook Form สำหรับ Form State
- **Graceful Degradation:** หาก Service รอง (เช่น Search, Notification) ล่ม ระบบหลัก (CRUD) ต้องยังทำงานต่อได้

### 5.13. Secure In-App PDF Viewer (ใหม่)

- 5.13.1 Viewer Capabilities: ระบบต้องมี PDF Viewer ภายในแอปพลิเคชันที่สามารถเปิดดูไฟล์เอกสารหลัก (PDF) ได้ทันทีโดยไม่ต้องดาวน์โหลดลงเครื่อง เพื่อความสะดวกในการตรวจทาน (Review/Approve)
- 5.13.2 Security: การแสดงผลไฟล์ต้อง ห้าม (Disable) การทำ Browser Cache สำหรับไฟล์ Sensitive เพื่อป้องกันการกู้คืนไฟล์จากเครื่อง Client ภายหลัง
- 5.13.3 Performance: ต้องรองรับการส่งข้อมูลแบบ Streaming (Range Requests) เพื่อให้เปิดดูไฟล์ขนาดใหญ่ (เช่น แบบแปลน 50MB+) ได้รวดเร็วโดยไม่ต้องรอโหลดเสร็จทั้งไฟล์

## **🛡️ 6. ข้อกำหนดที่ไม่ใช่ฟังก์ชันการทำงาน (Non-Functional Requirements)**

### 6.1. การบันทึกการกระทำ (Audit Log)

- ทุกการกระทำที่สำคัญของผู้ใช้ (สร้าง, แก้ไข, ลบ, ส่ง) จะถูกบันทึกไว้ใน audit_logs เพื่อการตรวจสอบย้อนหลัง
  - 6.1.1 ขอบเขตการบันทึก Audit Log:
    - ทุกการสร้าง/แก้ไข/ลบ ข้อมูลสำคัญ (correspondences, RFAs, drawings, users, permissions)
    - ทุกการเข้าถึงข้อมูล sensitive (user data, financial information)
    - ทุกการเปลี่ยนสถานะ workflow (status transitions)
    - ทุกการดาวน์โหลดไฟล์สำคัญ (contract documents, financial reports)
    - ทุกการเปลี่ยนแปลง permission และ role assignment
    - ทุกการล็อกอินที่สำเร็จและล้มเหลว
    - ทุกการส่งคำขอ API ที่สำคัญ

  - 6.1.2 ข้อมูลที่ต้องบันทึกใน Audit Log:
    - ผู้ใช้งาน (user_id)
    - การกระทำ (action)
    - ชนิดของ entity (entity_type)
    - ID ของ entity (entity_id)
    - ข้อมูลก่อนการเปลี่ยนแปลง (old_values) - สำหรับ update operations
    - ข้อมูลหลังการเปลี่ยนแปลง (new_values) - สำหรับ update operations
    - IP address
    - User agent
    - Timestamp
    - Request ID สำหรับ tracing

### **6.2. Data Archiving & Partitioning (ใหม่)**

- สำหรับตารางที่มีขนาดใหญ่และโตเร็ว (เช่น `audit_logs`, `notifications`, `correspondence_revisions`) ต้องออกแบบโดยรองรับ **Table Partitioning** (แบ่งตาม Range วันที่ หรือ List) เพื่อประสิทธิภาพในระยะยาว

### **6.3. การค้นหา (Search):**

- ระบบต้องมีฟังก์ชันการค้นหาขั้นสูง ที่สามารถค้นหาเอกสาร **correspondence**, **rfa**, **shop_drawing**, **contract-drawing**, **transmittal** และ **ใบเวียน (Circulations)** จากหลายเงื่อนไขพร้อมกันได้ เช่น ค้นหาจากชื่อเรื่อง, ประเภท, วันที่, และ Tag

### **6.4. การทำรายงาน (Reporting):**

- สามารถจัดทำรายงานสรุปแยกประเภทของ Correspondence ประจำวัน, สัปดาห์, เดือน, และปีได้

### **6.5. ประสิทธิภาพ (Performance):**

- มีการใช้ Caching กับข้อมูลที่เรียกใช้บ่อย และใช้ Pagination ในตารางข้อมูลเพื่อจัดการข้อมูลจำนวนมาก
  - 6.5.1 ตัวชี้วัดประสิทธิภาพ:
    - **API Response Time:** < 200ms (90th percentile) สำหรับ operation ทั่วไป
    - **Search Query Performance:** < 500ms สำหรับการค้นหาขั้นสูง
    - **File Upload Performance:** < 30 seconds สำหรับไฟล์ขนาด 50MB
    - **Concurrent Users:** รองรับผู้ใช้พร้อมกันอย่างน้อย 100 คน
    - **Database Connection Pool:** ขนาดเหมาะสมกับ workload (default: min 5, max 20 connections)
    - **Cache Hit Ratio:** > 80% สำหรับ cached data
    - **Application Startup Time:** < 30 seconds
  - 6.5.2 Caching Strategy:
    - **Master Data Cache:** Roles, Permissions, Organizations, Project metadata (TTL: 1 hour)
    - **User Session Cache:** User permissions และ profile data (TTL: 30 minutes)
    - **Search Result Cache:** Frequently searched queries (TTL: 15 minutes)
    - **File Metadata Cache:** Attachment metadata (TTL: 1 hour)
    - **Document Cache:** Frequently accessed document metadata (TTL: 30 minutes)
    - **ต้องมี cache invalidation strategy ที่ชัดเจน:**
      - Invalidate on update/delete operations
      - Time-based expiration
      - Manual cache clearance สำหรับ admin operations
    - ใช้ Redis เป็น distributed cache backend
    - ต้องมี cache monitoring (hit/miss ratios)
  - 6.5.3 Frontend Performance:
    - **Bundle Size Optimization:** ต้องควบคุมขนาด Bundle โดยรวมไม่เกิน 2MB
    - **State Management Efficiency:** ใช้ State Management Libraries อย่างเหมาะสม ไม่เกิน 2 ตัวหลัก
    - **Memory Management:** ต้องป้องกัน Memory Leak จาก State ที่ไม่จำเป็น

### **6.6. ความปลอดภัย (Security):**

- มีระบบ Rate Limiting เพื่อป้องกันการโจมตีแบบ Brute-force
- การจัดการ Secret (เช่น รหัสผ่าน DB, JWT Secret) จะต้องทำผ่าน Environment Variable ของ Docker เพื่อความปลอดภัยสูงสุด
  - 6.6.1 Rate Limiting Strategy:
    - **Anonymous Endpoints:** 100 requests/hour ต่อ IP address
    - **Authenticated Endpoints:**
      - Viewer: 500 requests/hour
      - Editor: 1000 requests/hour
      - Document Control: 2000 requests/hour
      - Admin/Superadmin: 5000 requests/hour
    - **File Upload Endpoints:** 50 requests/hour ต่อ user
    - **Search Endpoints:** 500 requests/hour ต่อ user
    - **Authentication Endpoints:** 10 requests/minute ต่อ IP address
    - **ต้องมี mechanism สำหรับยกเว้น rate limiting สำหรับ trusted services**
    - ต้องบันทึก log เมื่อมีการ trigger rate limiting
  - 6.6.2 Error Handling และ Resilience:
    - ต้องมี circuit breaker pattern สำหรับ external service calls
    - ต้องมี retry mechanism ด้วย exponential backoff
    - ต้องมี graceful degradation เมื่อบริการภายนอกล้มเหลว
    - Error messages ต้องไม่เปิดเผยข้อมูล sensitive
  - 6.6.3 Input Validation:
    - ต้องมี input validation ทั้งฝั่ง client และ server (defense in depth)
    - ต้องป้องกัน OWASP Top 10 vulnerabilities:
      - SQL Injection (ใช้ parameterized queries ผ่าน ORM)
      - XSS (input sanitization และ output encoding)
      - CSRF (CSRF tokens สำหรับ state-changing operations)
    - ต้อง validate file uploads:
      - File type (white-list approach)
      - File size
      - File content (magic number verification)
    - ต้อง sanitize user inputs ก่อนแสดงผลใน UI
    - ต้องใช้ content security policy (CSP) headers
    - ต้องมี request size limits เพื่อป้องกัน DoS attacks
  - 6.6.4 Session และ Token Management:
    - **JWT token expiration:** 8 hours สำหรับ access token
    - **Refresh token expiration:** 7 days
    - **Refresh token mechanism:** ต้องรองรับ token rotation และ revocation
    - **Token revocation on logout:** ต้องบันทึก revoked tokens จนกว่าจะ expire
    - **Concurrent session management:**
      - จำกัดจำนวน session พร้อมกันได้ (default: 5 devices)
      - ต้องแจ้งเตือนเมื่อมี login จาก device/location ใหม่
    - **Device fingerprinting:** สำหรับ security และ audit purposes
    - **Password policy:**
      - ความยาวขั้นต่ำ: 8 characters
      - ต้องมี uppercase, lowercase, number, special character
      - ต้องเปลี่ยน password ทุก 90 วัน
      - ต้องป้องกันการใช้ password ที่เคยใช้มาแล้ว 5 ครั้งล่าสุด

### 6.7. การสำรองข้อมูลและการกู้คืน (Backup & Recovery)

- ระบบจะต้องมีกลไกการสำรองข้อมูลอัตโนมัติสำหรับฐานข้อมูล MariaDB [cite: 2.4] และไฟล์เอกสารทั้งหมดใน /share/dms-data [cite: 2.1] (เช่น ใช้ HBS 3 ของ QNAP หรือสคริปต์สำรองข้อมูล) อย่างน้อยวันละ 1 ครั้ง
- ต้องมีแผนการกู้คืนระบบ (Disaster Recovery Plan) ในกรณีที่ Server หลัก (QNAP) ใช้งานไม่ได้
- 6.7.1 ขั้นตอนการกู้คืน:
  - **Database Restoration Procedure:**
    - สร้างจาก full backup ล่าสุด
    - Apply transaction logs ถึง point-in-time ที่ต้องการ
    - Verify data integrity post-restoration
  - **File Storage Restoration Procedure:**
    - Restore จาก QNAP snapshot หรือ backup
    - Verify file integrity และ permissions
  - **Application Redeployment Procedure:**
    - Deploy จาก version ล่าสุดที่รู้ว่าทำงานได้
    - Verify application health
  - **Data Integrity Verification Post-Recovery:**
    - Run data consistency checks
    - Verify critical business data
  - **Recovery Time Objective (RTO):** < 4 ชั่วโมง
  - **Recovery Point Objective (RPO):** < 1 ชั่วโมง

### 6.8. กลยุทธ์การแจ้งเตือน (Notification Strategy - ปรับปรุง)

- 6.8.1 ระบบจะส่งการแจ้งเตือน (ผ่าน Email หรือ Line [cite: 2.7]) เมื่อมีการกระทำที่สำคัญ\*\* ดังนี้:
  1. เมื่อมีเอกสารใหม่ (Correspondence, RFA) ถูกส่งมาถึงองค์กรณ์ของเรา
  2. เมื่อมีใบเวียน (Circulation) ใหม่ มอบหมายงานมาที่เรา
  3. (ทางเลือก) เมื่อเอกสารที่เราส่งไป ถูกดำเนินการ (เช่น อนุมัติ/ปฏิเสธ)
  4. (ทางเลือก) เมื่อใกล้ถึงวันครบกำหนด (Deadline) [cite: 3.2.5, 3.6.6, 3.7.5]
- 6.8.2 Grouping/Digest (ใหม่)
  - กรณีมีการแจ้งเตือนประเภทเดียวกันจำนวนมากในช่วงเวลาสั้นๆ (เช่น Approve เอกสาร 10 ฉบับรวด) ระบบต้อง **รวม (Batch)** เป็น 1 Email/Line Notification เพื่อไม่ให้รบกวนผู้ใช้ (Spamming)
- 6.8.3 Notification Delivery Guarantees
  - **At-least-once delivery:** สำหรับ important notifications
  - **Retry mechanism:** ด้วย exponential backoff (max 3 reties)
  - **Dead letter queue:** สำหรับ notifications ที่ส่งไม่สำเร็จหลังจาก retries
  - **Delivery status tracking:** ต้องบันทึกสถานะการส่ง notifications
  - **Fallback channels:** ถ้า Email ล้มเหลว ให้ส่งผ่าน SYSTEM notification
  - **Notification preferences:** ผู้ใช้ต้องสามารถกำหนด channel preferences ได้

### **6.9. Maintenance Mode (ใหม่)**

- ระบบต้องมีกลไก **Maintenance Mode** ที่ Admin สามารถเปิดใช้งานได้
  - เมื่อเปิด: ผู้ใช้ทั่วไปจะเห็นหน้า "ปิดปรับปรุง" และไม่สามารถเรียก API ได้ (ยกเว้น Admin)
  - ใช้สำหรับช่วง Deploy Version ใหม่ หรือ Database Migration

### **6.10. Monitoring และ Observability**

- 6.10.1 Application Monitoring
  - **Health checks:** /health endpoint สำหรับ load balancer
  - **Metrics collection:** Response times, error rates, throughput
  - **Distributed tracing:** สำหรับ request tracing across services
  - **Log aggregation:** Structured logging ด้วย JSON format
  - **Alerting:** สำหรับ critical errors และ performance degradation
- 6.10.2 Business Metrics
  - จำนวน documents created ต่อวัน
  - Workflow completion rates
  - User activity metrics
  - System utilization rates
  - Search query performance
- 6.10.3 Security Monitoring
  - Failed login attempts
  - Rate limiting triggers
  - Virus scan results
  - File download activities
  - Permission changes

### **6.11 JSON Processing & Validation**

- 6.11.1 JSON Schema Management
  - ต้องมี centralized JSON schema registry
  - ต้องรองรับ schema versioning และ migration
  - ต้องมี schema validation during runtime
- 6.11.2 Performance Optimization
  - **Caching:** Cache parsed JSON structures
  - **Compression:** ใช้ compression สำหรับ JSON ขนาดใหญ่
  - **Indexing:** Support JSON path indexing สำหรับ query
- 6.11.3 Error Handling
  - ต้องมี graceful degradation เมื่อ JSON validation ล้มเหลว
  - ต้องมี default fallback values
  - ต้องบันทึก error logs สำหรับ validation failures

## **🧪 7. ข้อกำหนดด้านการทดสอบ (Testing Requirements)**

### 7.1 Unit Testing

- ต้องมี unit tests สำหรับ business logic ทั้งหมด
- Code coverage อย่างน้อย 70% สำหรับ backend services
  - Business Logic: 80%+
  - Controllers: 70%+
  - Utilities: 90%+
- ต้องทดสอบ RBAC permission logic ทุกระดับ

### 7.2 Integration Testing

- ทดสอบการทำงานร่วมกันของ modules
- ทดสอบ database migrations และ data integrity
- ทดสอบ API endpoints ด้วย realistic data

### 7.3 End-to-End Testing

- ทดสอบ complete user workflows
- ทดสอบ document lifecycle จาก creation ถึง archival
- ทดสอบ cross-module integrations

### 7.4 Security Testing

- Penetration Testing: ทดสอบ OWASP Top 10 vulnerabilities
- Security Audit: Review code สำหรับ security flaws
- Virus Scanning Test: ทดสอบ file upload security
- Rate Limiting Test: ทดสอบ rate limiting functionality

### 7.5. Performance Testing

- Penetration Testing: ทดสอบ OWASP Top 10 vulnerabilities
- Security Audit: Review code สำหรับ security flaws
- Virus Scanning Test: ทดสอบ file upload security
  - **Rate Limiting Test:** ทดสอบ rate limiting functionality
  - **Load Testing:** ทดสอบด้วย realistic workloads
  - **Stress Testing:** หา breaking points ของระบบ
  - **Endurance Testing:** ทดสอบการทำงานต่อเนื่องเป็นเวลานาน

### 7.6. Disaster Recovery Testing

- ทดสอบ backup และ restoration procedures
- ทดสอบ failover mechanisms
- ทดสอบ data integrity หลังการ recovery

### 7.7 Specific Scenario Testing (เพิ่ม)

- **Race Condition Test:** ทดสอบยิง Request ขอเลขที่เอกสารพร้อมกัน 100 Request
  - **Transaction Test:** ทดสอบปิดเน็ตระหว่าง Upload ไฟล์ (ตรวจสอบว่าไม่มี Orphan File หรือ Broken Link)
  - **Permission Test:** ทดสอบ CASL Integration ทั้งฝั่ง Backend และ Frontend ให้ตรงกัน

## **8. ข้อกำหนดด้านการบำรุงรักษา (Maintenance Requirements)**

### **8.1. Log Retention:**

- Audit logs: 7 ปี
- Application logs: 1 ปี
- Performance metrics: 2 ปี

### **8.2. Monitoring และ Alerting:**

- ต้องมี proactive monitoring สำหรับ critical systems
- ต้องมี alerting สำหรับ security incidents
- ต้องมี performance degradation alerts

### **8.3. Patch Management:**

- ต้องมี process สำหรับ security patches
- ต้องทดสอบ patches ใน staging environment
- ต้องมี rollback plan สำหรับ failed updates

### **8.4. Capacity Planning:**

- ต้อง monitor resource utilization
- ต้องมี scaling strategy สำหรับ growth
- ต้องมี performance baselines และ trending

## **9. ข้อกำหนดด้านการปฏิบัติตามกฎระเบียบ (Compliance Requirements)**

### **9.1. Data Privacy:**

- ต้องปฏิบัติตามกฎหมายคุ้มครองข้อมูลส่วนบุคคล
- ต้องมี data retention policies
- ต้องมี data deletion procedures

### **9.2. Audit Compliance:**

- ต้องรองรับ internal และ external audits
- ต้องมี comprehensive audit trails
- ต้องมี reporting capabilities สำหรับ compliance

### **9.3. Security Standards:**

- ต้องปฏิบัติตาม organizational security policies
- ต้องมี security incident response plan
- ต้องมี regular security assessments

## **Document Control:**

- **Document:** Application Requirements Specification v1.4.5
- **Version:** 1.4
- **Date:** 2025-11-29
- **Author:** NAP LCBP3-DMS & Gemini
- **Status:** FINAL-Rev.05
- **Classification:** Internal Technical Documentation
- **Approved By:** Nattanin

---

`End of Requirements Specification v1.4.5`
