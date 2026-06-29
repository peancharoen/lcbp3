# 📝 **Documents Management System Version 1.4.1: Application Requirements Specification (ปรับปรุงโดย deepseek)**

\*_ปรับปรุงตามการ review และข้อเสนอแนะล่าสุด_

## 📌**1. วัตถุประสงค์**

สร้างเว็บแอปพลิเคชั่นสำหรับระบบบริหารจัดการเอกสารโครงการ (Document Management System)ที่สามารถจัดการและควบคุม การสื่อสารด้วยเอกสารที่ซับซ้อน อย่างมีประสิทธิภาพ

- มีฟังก์ชันหลักในการอัปโหลด จัดเก็บ ค้นหา แชร์ และควบคุมสิทธิ์การเข้าถึงเอกสาร
- ช่วยลดการใช้เอกสารกระดาษ เพิ่มความปลอดภัยในการจัดเก็บข้อมูล
- เพิ่มความสะดวกในการทำงานร่วมกันระหว่างองกรณ์
- **เสริม:** ปรับปรุงความปลอดภัยของระบบด้วยมาตรการป้องกันที่ทันสมัย
- **เสริม:** เพิ่มความทนทานของระบบด้วยกลไก resilience patterns
- **เสริม:** สร้างระบบ monitoring และ observability ที่ครอบคลุม

## 🛠️**2. สถาปัตยกรรมและเทคโนโลยี (System Architecture & Technology Stack)**

ใช้สถาปัตยกรรมแบบ Headless/API-First ที่ทันสมัย ทำงานทั้งหมดบน QNAP Server ผ่าน Container Station เพื่อความสะดวกในการจัดการและบำรุงรักษา, Domain: np-dms.work, มี fix ip, รัน docker command ใน application ของ Container Station ได้โดยตรง, ประกอบด้วย

- **2.1. Infrastructure & Environment:**
  - Server: QNAP (Model: TS-473A, RAM: 32GB, CPU: AMD Ryzen V1500B)
  - Containerization: Container Station (Docker & Docker Compose) ใช้ UI ของ Container Station เป็นหลัก ในการ configuration และการรัน docker command
  - Development Environment: VS Code on Windows 11
  - Domain: np-dms.work, <www.np-dms.work>
  - ip: 159.192.126.103
  - Docker Network: ทุก Service จะเชื่อมต่อผ่านเครือข่ายกลางชื่อ lcbp3 เพื่อให้สามารถสื่อสารกันได้
  - Data Storage: /share/dms-data บน QNAP
  - ข้อจำกัด: ไม่สามารถใช้ .env ในการกำหนดตัวแปรภายนอกได้ ต้องกำหนดใน docker-compose.yml เท่านั้น

- **2.2. การจัดการ Configuration:**
  - ใช้ docker-compose.yml สำหรับ environment variables ตามข้อจำกัดของ QNAP
  - **แต่ต้องมี mechanism สำหรับจัดการ sensitive secrets อย่างปลอดภัย** โดยใช้:
    - Docker secrets (ถ้ารองรับ)
    - External secret management (Hashicorp Vault) หรือ
    - Encrypted environment variables
  - Development environment ยังใช้ .env ได้ แต่ต้องไม่ commit เข้า version control
  - ต้องมี configuration validation during application startup
  - ต้องแยก configuration ตาม environment (development, staging, production)

- **2.3. Code Hosting:**
  - Application name: git
  - Service: Gitea (Self-hosted on QNAP)
  - Service name: gitea
  - Domain: git.np-dms.work
  - หน้าที่: เป็นศูนย์กลางในการเก็บและจัดการเวอร์ชันของโค้ด (Source Code) สำหรับทุกส่วน

- **2.4. Backend / Data Platform:**
  - Application name: lcbp3-backend
  - Service: NestJS
  - Service name: backend
  - Domain: backend.np-dms.work
  - Framework: NestJS (Node.js, TypeScript, ESM)
  - หน้าที่: จัดการโครงสร้างข้อมูล (Data Models), สร้าง API, จัดการสิทธิ์ผู้ใช้ (Roles & Permissions), และสร้าง Workflow ทั้งหมดของระบบ

- **2.5. Database:**
  - Application name: lcbp3-db
  - Service: mariadb:10.11
  - Service name: mariadb
  - Domain: db.np-dms.work
  - หน้าที่: ฐานข้อมูลหลักสำหรับเก็บข้อมูลทั้งหมด
  - Tooling: DBeaver (Community Edition), phpmyadmin สำหรับการออกแบบและจัดการฐานข้อมูล

- **2.6. Database management:**
  - Application name: lcbp3-db
  - Service: phpmyadmin:5-apache
  - Service name: pma
  - Domain: pma.np-dms.work
  - หน้าที่: จัดการฐานข้อมูล mariadb ผ่าน Web UI

- **2.7. Frontend:**
  - Application name: lcbp3-frontend
  - Service: next.js
  - Service name: frontend
  - Domain: lcbp3.np-dms.work
  - Framework: Next.js (App Router, React, TypeScript, ESM)
  - Styling: Tailwind CSS + PostCSS
  - Component Library: shadcn/ui
  - หน้าที่: สร้างหน้าตาเว็บแอปพลิเคชันสำหรับให้ผู้ใช้งานเข้ามาดู Dashboard, จัดการเอกสาร, และติดตามงาน โดยจะสื่อสารกับ Backend ผ่าน API

- **2.8. Workflow automation:**
  - Application name: lcbp3-n8n
  - Service: n8nio/n8n:latest
  - Service name: n8n
  - Domain: n8n.np-dms.work
  - หน้าที่: จัดการ workflow ระหว่าง Backend และ Line

- **2.9. Reverse Proxy:**
  - Application name: lcbp3-npm
  - Service: Nginx Proxy Manager (nginx-proxy-manage: latest)
  - Service name: npm
  - Domain: npm.np-dms.work
  - หน้าที่: เป็นด่านหน้าในการรับ-ส่งข้อมูล จัดการโดเมนทั้งหมด, ทำหน้าที่เป็น Proxy ชี้ไปยัง Service ที่ถูกต้อง, และจัดการ SSL Certificate (HTTPS) ให้อัตโนมัติ

- **2.10. การจัดการตรรกะทางธุรกิจ (Business Logic Implementation):**
  - 2.10.1. ตรรกะทางธุรกิจที่ซับซ้อนทั้งหมด (เช่น การเปลี่ยนสถานะ Workflow [cite: 3.5.4, 3.6.5], การบังคับใช้สิทธิ์ [cite: 4.4], การตรวจสอบ Deadline [cite: 3.2.5]) **จะถูกจัดการในฝั่ง Backend (NestJS)** [cite: 2.3] เพื่อให้สามารถบำรุงรักษาและทดสอบได้ง่าย (Testability)
  - 2.10.2. **จะไม่มีการใช้ SQL Triggers** เพื่อป้องกันตรรกะซ่อนเร้น (Hidden Logic) และความซับซ้อนในการดีบัก
  - 2.10.3. **การจัดการเลขที่เอกสาร:** ใช้ **application-level locking** (Redis distributed lock) แทน stored procedure เพื่อป้องกัน race condition และให้ง่ายต่อการทดสอบและบำรุงรักษา

- **2.11 Data Migration และ Schema Versioning:**
  - ต้องมี database migration scripts สำหรับทุก schema change โดยใช้ TypeORM migrations
  - ต้องรองรับ rollback ของ migration ได้
  - ต้องมี data seeding strategy สำหรับ environment ต่างๆ (development, staging, production)
  - ต้องมี version compatibility between schema versions
  - Migration scripts ต้องผ่านการทดสอบใน staging environment ก่อน production
  - ต้องมี database backup ก่อนทำ migration ใน production

- **2.12 กลยุทธ์ความทนทานและการจัดการข้อผิดพลาด (Resilience & Error Handling Strategy)**
  - 2.12.1 Circuit Breaker Pattern: ใช้สำหรับ external service calls (Email, LINE, Elasticsearch)
  - 2.12.2 Retry Mechanism: ด้วย exponential backoff สำหรับ transient failures
  - 2.12.3 Fallback Strategies: Graceful degradation เมื่อบริการภายนอกล้มเหลว
  - 2.12.4 Error Handling: Error messages ต้องไม่เปิดเผยข้อมูล sensitive
  - 2.12.5 Monitoring: Centralized error monitoring และ alerting system

## **📦 3. ข้อกำหนดด้านฟังก์ชันการทำงาน (Functional Requirements)**

- **3.1. การจัดการโครงสร้างโครงการและองค์กร**
  - 3.1.1. โครงการ (Projects): ระบบต้องสามารถจัดการเอกสารภายในหลายโครงการได้ (ปัจจุบันมี 4 โครงการ และจะเพิ่มขึ้นในอนาคต)
  - 3.1.2. สัญญา (Contracts): ระบบต้องสามารถจัดการเอกสารภายในแต่ละสัญญาได้ ในแต่ละโครงการ มีได้หลายสัญญา หรืออย่างน้อย 1 สัญญา
  - 3.1.3. องค์กร (Organizations):
    - มีหลายองค์กรในโครงการ องค์กรณ์ที่เป็น Owner, Designer และ Consultant สามารถอยู่ในหลายโครงการและหลายสัญญาได้
    - Contractor จะถือ 1 สัญญา และอยู่ใน 1 โครงการเท่านั้น

- **3.2. การจัดการเอกสารโต้ตอบ (Correspondence Management)**
  - 3.2.1. วัตถุประสงค์: เอกสารโต้ตอบ (correspondences) ระหว่างองกรณื-องกรณ์ ภายใน โครงการ (Projects) และระหว่าง องค์กร-องค์กร ภายนอก โครงการ (Projects), รองรับ To (ผู้รับหลัก) และ CC (ผู้รับสำเนา) หลายองค์กร
  - 3.2.2. ประเภทเอกสาร: ระบบต้องรองรับเอกสารรูปแบบ ไฟล์ PDF หลายประเภท (Types) เช่น จดหมาย (Letter), อีเมล์ (Email), Request for Information (RFI), และสามารถเพิ่มประเภทใหม่ได้ในภายหลัง
  - 3.2.3. การสร้างเอกสาร (Correspondence):
    - ผู้ใช้ที่มีสิทธิ์ (เช่น Document Control) สามารถสร้างเอกสารรอไว้ในสถานะ ฉบับร่าง" (Draft) ได้ ซึ่งผู้ใช้งานต่างองค์กรจะมองไม่เห็น
    - เมื่อกด "Submitted" แล้ว การแก้ไข, ถอนเอกสารกลับไปสถานะ Draft, หรือยกเลิก (Cancel) จะต้องทำโดยผู้ใช้ระดับ Admin ขึ้นไป พร้อมระบุเหตุผล
  - 3.2.4. การอ้างอิงและจัดกลุ่ม:
    - เอกสารสามารถอ้างถึง (Reference) เอกสารฉบับก่อนหน้าได้หลายฉบับ
    - สามารถกำหนด Tag ได้หลาย Tag เพื่อจัดกลุ่มและใช้ในการค้นหาขั้นสูง
  - 3.2.5. Correspondence Routing & Workflow
    - 3.2.5.1 Routing Templates (แม่แบบการส่งต่อ)
      - ผู้ดูแลระบบต้องสามารถสร้างแม่แบบการส่งต่อได้
      - แม่แบบสามารถเป็นแบบทั่วไป (ใช้ได้ทุกโครงการ) หรือเฉพาะโครงการ
      - แต่ละแม่แบบประกอบด้วยลำดับขั้นตอนการส่งต่อ
      - การส่งจาก Originator -> Organization 1 -> Organization 2 -> Organization 3 แล้วส่งผลกลับตามลำดับเดิม (โดยถ้า องกรณ์ใดใน Wouting ให้ส่งกลับ ก็สามารถส่งผลกลับตามลำดับเดิมโดยไม่ต้องรอให้ถึง องกรณืในลำดับถัดไป)
    - 3.2.5.2 Routing Steps (ขั้นตอนการส่งต่อ) แต่ละขั้นตอนในแม่แบบต้องกำหนด:
      - **ลำดับขั้นตอน** (Sequence)
      - **องค์กรผู้รับ** (To Organization)
      - **วัตถุประสงค์** (Purpose): เพื่ออนุมัติ (FOR_APPROVAL), เพื่อตรวจสอบ (FOR_REVIEW), เพื่อทราบ (FOR_INFORMATION), เพื่อดำเนินการ (FOR_ACTION)
      - **ระยะเวลาที่คาดหวัง** (Expected Duration)
    - 3.2.5.3 Actual Routing Execution (การส่งต่อจริง) เมื่อสร้างเอกสารและเลือกใช้แม่แบบ ระบบต้อง:
      - สร้างลำดับการส่งต่อตามแม่แบบ
      - ติดตามสถานะของแต่ละขั้นตอน: ส่งแล้ว (SENT), กำลังดำเนินการ (IN_PROGRESS), ดำเนินการแล้ว (ACTIONED), ส่งต่อแล้ว (FORWARDED), ตอบกลับแล้ว (REPLIED)
      - ระบุวันครบกำหนด (Due Date) สำหรับแต่ละขั้นตอน
      - บันทึกผู้ดำเนินการและเวลาที่ดำเนินการ
    - 3.2.5.4 Routing Flexibility (ความยืดหยุ่น)
      - สามารถข้ามขั้นตอนได้ในกรณีพิเศษ (โดยผู้มีสิทธิ์)
      - สามารถส่งกลับขั้นตอนก่อนหน้าได้
      - สามารถเพิ่มความคิดเห็นในแต่ละขั้นตอน
      - แจ้งเตือนอัตโนมัติเมื่อถึงขั้นตอนใหม่หรือใกล้ครบกำหนด
  - 3.2.6. การจัดการ: มีการจัดการอย่างน้อยดังนี้
    - สามารถกำหนดวันแล้วเสร็จ (Deadline) สำหรับผู้รับผิดชอบของ องกรณ์ ที่เป็นผู้รับได้
    - มีระบบแจ้งเตือน ให้ผู้รับผิดชอบขององกรณ์ที่เป็น ผู้รับ/ผู้ส่ง ทราบ เมื่อมีเอกสารใหม่ หรือมีการเปลี่ยนสถานะ

- **3.3. การจัดกาแบบคู่สัญญา (Contract Drawing)**
  - 3.3.1. วัตถุประสงค์: แบบคู่สัญญา (Contract Drawing) ใช้เพื่ออ้างอิงและใช้ในการตรวจสอบ
  - 3.3.2. ประเภทเอกสาร: ไฟล์ PDF
  - 3.3.3. การสร้างเอกสาร: ผู้ใช้ที่มีสิทธิ์ สามารถสร้างและแก้ไขได้
  - 3.3.4. การอ้างอิงและจัดกลุ่ม: ใช้สำหรับอ้างอิง ใน Shop Drawings, มีการจัดหมวดหมู่ของ Contract Drawing

- **3.4. การจัดกาแบบก่อสร้าง (Shop Drawing)**
  - 3.4.1. วัตถุประสงค์: แบบก่อสร้าง (Shop Drawing) ใช้เในการตรวจสอบ โดยจัดส่งด้วย Request for Approval (RFA)
  - 3.4.2. ประเภทเอกสาร: ไฟล์ PDF
  - 3.4.3. การสร้างเอกสาร: ผู้ใช้ที่มีสิทธิ์ สามารถสร้างและแก้ไขได้
  - 3.4.4. การอ้างอิงและจัดกลุ่ม: ช้สำหรับอ้างอิง ใน Shop Drawings, มีการจัดหมวดหมู่ของ Shop Drawings

- **3.5. การจัดการเอกสารขออนุมัติ (Request for Approval & Workflow)**
  - 3.5.1. วัตถุประสงค์: เอกสารขออนุมัติ (Request for Approval) ใช้ในการส่งเอกสารเพิอขออนุมัติ
  - 3.5.2. ประเภทเอกสาร: Request for Approval (RFA) เป็นชนิดหนึ่งของ Correspondence ที่มีลักษณะเฉพาะที่ต้องได้รับการอนุมัติ มีประเภทดังนี้:
    - Request for Drawing Approval (RFA_DWG)
    - Request for Document Approval (RFA_DOC)
    - Request for Method statement Approval (RFA_MES)
    - Request for Material Approval (RFA_MAT)
  - 3.5.2. การสร้างเอกสาร: ผู้ใช้ที่มีสิทธิ์ สามารถสร้างและแก้ไขได้
  - 3.5.4. การอ้างอิงและจัดกลุ่ม: การจัดการ Drawing (RFA_DWG):
    - เอกสาร RFA_DWG จะประกอบไปด้วย Shop Drawing (shop_drawings) หลายแผ่น ซึ่งแต่ละแผ่นมี Revision ของตัวเอง
    - Shop Drawing แต่ละ Revision สามารถอ้างอิงถึง Contract Drawing (Ccontract_drawings) หลายแผ่น หรือไม่อ้างถึงก็ได้
    - ระบบต้องมีส่วนสำหรับจัดการข้อมูล Master Data ของทั้ง Shop Drawing และ Contract Drawing แยกจากกัน
  - 3.5.5. Workflow การอนุมัติ: ต้องรองรับกระบวนการอนุมัติที่ซับซ้อนและเป็นลำดับ เช่น
    - ส่งจาก Originator -> Organization 1 -> Organization 2 -> Organization 3 แล้วส่งผลกลับตามลำดับเดิม (โดยถ้า องกรณ์ใดใน Workflow ให้ส่งกลับ ก็สามารถส่งผลกลับตามลำดับเดิมโดยไม่ต้องรอให้ถึง องกรณืในลำดับถัดไป)
  - 3.5.6. การจัดการ: มีการจัดการอย่างน้อยดังนี้
    - สามารถกำหนดวันแล้วเสร็จ (Deadline) สำหรับผู้รับผิดชอบของ องกรณ์ ที่อยู่ใน Workflow ได้
    - มีระบบแจ้งเตือน ให้ผู้รับผิดชอบของ องกรณ์ ที่อยู่ใน Workflow ทราบ เมื่อมี RFA ใหม่ หรือมีการเปลี่ยนสถานะ

- **3.6.การจัดการเอกสารนำส่ง (Transmittals)**
  - 3.6.1. วัตถุประสงค์: เอกสารนำส่ง ใช้สำหรับ นำส่ง Request for Approval (RFAS) หลายฉบับ ไปยังองค์กรอื่น
  - 3.6.2. ประเภทเอกสาร: ไฟล์ PDF
  - 3.6.3. การสร้างเอกสาร: ผู้ใช้ที่มีสิทธิ์ สามารถสร้างและแก้ไขได้
  - 3.6.4. การอ้างอิงและจัดกลุ่ม: เอกสารนำส่ง เป็นส่วนหนึ่งใน Correspondence

- **3.7. ใบเวียนเอกสาร (Circulation Sheet)**
  - 3.7.1. วัตถุประสงค์: การสื่อสาร เอกสาร (Correspondence) ทุกฉบับ จะมีใบเวียนเอกสารเพื่อควบคุมและมอบหมายงานภายในองค์กร (สามารถดูและแก้ไขได้เฉพาะคนในองค์กร)
  - 3.7.2. ประเภทเอกสาร: ไฟล์ PDF
  - 3.7.3. การสร้างเอกสาร: ผู้ใช้ที่มีสิทธิ์ในองค์กรนั้น สามารถสร้างและแก้ไขได้
  - 3.7.4. การอ้างอิงและจัดกลุ่ม: การระบุผู้รับผิดชอบ:
    - ผู้รับผิดชอบหลัก (Main): มีได้หลายคน
    - ผู้ร่วมปฏิบัติงาน (Action): มีได้หลายคน
    - ผู้ที่ต้องรับทราบ (Information): มีได้หลายคน
  - 3.7.5. การติดตามงาน:
    - สามารถกำหนดวันแล้วเสร็จ (Deadline) สำหรับผู้รับผิดชอบประเภท Main และ Action ได้
    - มีระบบแจ้งเตือนเมื่อมี Circulation ใหม่ และแจ้งเตือนล่วงหน้าก่อนถึงวันแล้วเสร็จ
    - สามารถปิด Circulation ได้เมื่อดำเนินการตอบกลับไปยังองค์กรผู้ส่ง (Originator) แล้ว หรือ รับทราบแล้ว (For Information)

- **3.8. ประวัติการแก้ไข (Revisions):** ระบบจะเก็บประวัติการสร้างและแก้ไข เอกสารทั้งหมด

- **3.9. การจัดเก็บ: (ปรับปรุงตามสถาปัตยกรรมใหม่)**
  - เอกสารและไฟล์แนบทั้งหมดจะถูกจัดเก็บในโฟลเดอร์บน Server (/share/dms-data/) [cite: 2.1]
  - ข้อมูล Metadata ของไฟล์ (เช่น ชื่อไฟล์, ขนาด, path) จะถูกเก็บในตาราง attachments (ตารางกลาง)
  - ไฟล์จะถูกเชื่อมโยงกับเอกสารประเภทต่างๆ ผ่านตารางเชื่อม (Junction tables) เช่น correspondence_attachments, circulation_attachments, shop_drawing_revision_attachments ,และ contracy_drawing_attachments
  - สถาปัตยกรรมแบบรวมศูนย์นี้ แทนที่ แนวคิดเดิมที่จะแยกโฟลเดอร์ตามประเภทเอกสาร เพื่อรองรับการขยายระบบที่ดีกว่า

- **3.9.6 ความปลอดภัยของการจัดเก็บไฟล์:**
  - ต้องมีการ scan virus สำหรับไฟล์ที่อัปโหลดทั้งหมด โดยใช้ ClamAV หรือบริการ third-party
  - จำกัดประเภทไฟล์ที่อนุญาต: PDF, DWG, DOCX, XLSX, ZIP (ต้องระบุรายการที่ชัดเจน)
  - ขนาดไฟล์สูงสุด: 50MB ต่อไฟล์
  - ไฟล์ต้องถูกเก็บนอก web root และเข้าถึงได้ผ่าน authenticated endpoint เท่านั้น
  - ต้องมี file integrity check (checksum) เพื่อป้องกันการแก้ไขไฟล์
  - Download links ต้องมี expiration time (default: 24 ชั่วโมง)
  - ต้องบันทึก audit log ทุกครั้งที่มีการดาวน์โหลดไฟล์สำคัญ

- **3.10. การจัดการเลขที่เอกสาร (Document Numbering):**
  - 3.10.1. ระบบต้องสามารถสร้างเลขที่เอกสาร (เช่น correspondence_number) ได้โดยอัตโนมัติ
  - 3.10.2. การนับเลข Running Number (SEQ) จะต้องนับแยกตาม Key ดังนี้: **โครงการ (Project)**, **องค์กรผู้ส่ง (Originator Organization)**, **ประเภทเอกสาร (Document Type)** และ **ปีปัจจุบัน (Year)**
  - 3.10.3. ผู้ดูแลระบบ (Admin) ต้องสามารถกำหนด "รูปแบบ" (Format Template) ของเลขที่เอกสารได้ (เช่น {ORG_CODE}-{TYPE_CODE}-{YEAR_SHORT}-{SEQ:4}) โดยกำหนดแยกตามโครงการและประเภทเอกสาร
  - 3.10.4. **ใช้ application-level locking** (Redis distributed lock) แทน stored procedure เพื่อป้องกัน race condition
  - 3.10.5. ต้องมี retry mechanism และ fallback strategy เมื่อการ generate เลขที่เอกสารล้มเหลว

- **3.11 การจัดการ JSON Details**
  - **3.11.1 วัตถุประสงค์**
    - จัดเก็บข้อมูลแบบไดนามิกที่เฉพาะเจาะจงกับแต่ละประเภทของเอกสาร
    - รองรับการขยายตัวของระบบโดยไม่ต้องเปลี่ยนแปลง database schema
    - จัดการ metadata และข้อมูลประกอบสำหรับ correspondence, routing, และ workflows
  - **3.11.2 โครงสร้าง JSON Schema**
    ระบบต้องมี predefined JSON schemas สำหรับประเภทเอกสารต่างๆ: - **3.11.2.1 Correspondence Types** - **GENERIC**: ข้อมูลพื้นฐานสำหรับเอกสารทั่วไป - **RFI**: รายละเอียดคำถามและข้อมูลทางเทคนิค - **RFA**: ข้อมูลการขออนุมัติแบบและวัสดุ - **TRANSMITTAL**: รายการเอกสารที่ส่งต่อ - **LETTER**: ข้อมูลจดหมายทางการ - **EMAIL**: ข้อมูลอีเมล - **3.11.2.2 Routing Types** - **ROUTING_TEMPLATE**: กฎและเงื่อนไขการส่งต่อ - **ROUTING_INSTANCE**: สถานะและประวัติการส่งต่อ - **ROUTING_ACTION**: การดำเนินการในแต่ละขั้นตอน - **3.11.2.3 Audit Types** - **AUDIT_LOG**: ข้อมูลการตรวจสอบ - **SECURITY_SCAN**: ผลการตรวจสอบความปลอดภัย
  - **3.11.3 Validation Rules**
    - ต้องมี JSON schema validation สำหรับแต่ละประเภท
    - ต้องรองรับ versioning ของ schema
    - ต้องมี default values สำหรับ field ที่ไม่บังคับ
    - ต้องตรวจสอบ data types และ format ให้ถูกต้อง
  - **3.11.4 Performance Requirements**
    - JSON field ต้องมีขนาดไม่เกิน 50KB
    - ต้องรองรับ indexing สำหรับ field ที่ใช้ค้นหาบ่อย
    - ต้องมี compression สำหรับ JSON ขนาดใหญ่
  - **3.11.5 Security Requirements**
    - ต้อง sanitize JSON input เพื่อป้องกัน injection attacks
    - ต้อง validate JSON structure ก่อนบันทึก
    - ต้อง encrypt sensitive data ใน JSON fields

## **🔐 4. ข้อกำหนดด้านสิทธิ์และการเข้าถึง (Access Control Requirements)**

- **4.1. ภาพรวม:** ผู้ใช้และองค์กรสามารถดูและแก้ไขเอกสารได้ตามสิทธิ์ที่ได้รับ โดยระบบสิทธิ์จะเป็นแบบ Role-Based Access Control (RBAC)

- **4.2. ลำดับชั้นของสิทธิ์ (Permission Hierarchy)**
  - Global: สิทธิ์สูงสุดของระบบ
  - Organization: สิทธิ์ภายในองค์กร เป็นสิทธิ์พื้นฐานของผู้ใช้
  - Project: สิทธิ์เฉพาะในโครงการ จะถูกพิจารณาเมื่อผู้ใช้อยู่ในโครงการนั้น
  - Contract: สิทธิ์เฉพาะในสัญญา จะถูกพิจารณาเมื่อผู้ใช้อยู่ในสัญญานั้น (สัญญาเป็นส่วนหนึ่งของโครงการ)

  กฎการบังคับใช้: เมื่อตรวจสอบสิทธิ์ ระบบจะพิจารณาสิทธิ์จากทุกระดับที่ผู้ใช้มี และใช้ สิทธิ์ที่มากที่สุด (Most Permissive) เป็นตัวตัดสิน

  ตัวอย่าง: ผู้ใช้ A เป็น Viewer ในองค์กร แต่ถูกมอบหมายเป็น Editor ในโครงการ X เมื่ออยู่ในโครงการ X ผู้ใช้ A จะมีสิทธิ์แก้ไขได้

- **4.3. การกำหนดบทบาท (Roles) และขอบเขต (Scope)**

| บทบาท (Role)         | ขอบเขต (Scope) | คำอธิบาย                | สิทธิ์หลัก (Key Permissions)                                                           |
| :------------------- | :------------- | :---------------------- | :------------------------------------------------------------------------------------- |
| **Superadmin**       | Global         | ผู้ดูแลระบบสูงสุด       | ทำทุกอย่างในระบบ, จัดการองค์กร, จัดการข้อมูลหลักระดับ Global                           |
| **Org Admin**        | Organization   | ผู้ดูแลองค์กร           | จัดการผู้ใช้ในองค์กร, จัดการบทบาท/สิทธิ์ภายในองค์กร, ดูรายงานขององค์กร                 |
| **Document Control** | Organization   | ควบคุมเอกสารขององค์กร   | เพิ่ม/แก้ไข/ลบเอกสาร, กำหนดสิทธิ์เอกสารภายในองค์กร                                     |
| **Editor**           | Organization   | ผู้แก้ไขเอกสารขององค์กร | เพิ่ม/แก้ไขเอกสารที่ได้รับมอบหมาย                                                      |
| **Viewer**           | Organization   | ผู้ดูเอกสารขององค์กร    | ดูเอกสารที่มีสิทธิ์เข้าถึง                                                             |
| **Project Manager**  | Project        | ผู้จัดการโครงการ        | จัดการสมาชิกในโครงการ (เพิ่ม/ลบ/มอบบทบาท), สร้าง/จัดการสัญญาในโครงการ, ดูรายงานโครงการ |
| **Contract Admin**   | Contract       | ผู้ดูแลสัญญา            | จัดการสมาชิกในสัญญา, สร้าง/จัดการข้อมูลหลักเฉพาะสัญญา (ถ้ามี), อนุมัติเอกสารในสัญญา    |

- **4.4. กระบวนการเริ่มต้นใช้งาน (Onboarding Workflow) ที่สมบูรณ์**
  - **4.4.1. สร้างองค์กร (Organization)**
    - **Superadmin** สร้างองค์กรใหม่ (เช่น บริษัท A)
    - **Superadmin** แต่งตั้งผู้ใช้อย่างน้อย 1 คนให้เป็น **Org Admin** หรือ **Document Control** ของบริษัท A
  - **4.4.2. เพิ่มผู้ใช้ในองค์กร**
    - **Org Admin** ของบริษัท A เพิ่มผู้ใช้อื่นๆ (Editor, Viewer) เข้ามาในองค์กรของตน
  - **4.4.3. มอบหมายผู้ใช้ให้กับโครงการ (Project)**
    - **Project Manager** ของโครงการ X (ซึ่งอาจมาจากบริษัท A หรือบริษัทอื่น) ทำการ "เชิญ" หรือ "มอบหมาย" ผู้ใช้จากองค์กรต่างๆ ที่เกี่ยวข้องเข้ามาในโครงการ X
    - ในขั้นตอนนี้ **Project Manager** จะกำหนด **บทบาทระดับโครงการ** (เช่น Project Member, หรืออาจไม่มีบทบาทพิเศษ ให้ใช้สิทธิ์จากระดับองค์กรไปก่อน)
  - **4.4.4. เมอบหมายผู้ใช้ให้กับสัญญา (Contract)**
    - **Contract Admin** ของสัญญา Y (ซึ่งเป็นส่วนหนึ่งของโครงการ X) ทำการเลือกผู้ใช้ที่อยู่ในโครงการ X แล้ว มอบหมายให้เข้ามาในสัญญา Y
    - ในขั้นตอนนี้ **Contract Admin** จะกำหนด **บทบาทระดับสัญญา** (เช่น Contract Member) และสิทธิ์เฉพาะที่จำเป็น
  - **4.4.5 Security Onboarding:**
    - ต้องบังคับเปลี่ยน password ครั้งแรกสำหรับผู้ใช้ใหม่
    - ต้องมี security awareness training สำหรับผู้ใช้ที่มีสิทธิ์สูง
    - ต้องมี process สำหรับการรีเซ็ต password ที่ปลอดภัย
    - ต้องบันทึก audit log ทุกครั้งที่มีการเปลี่ยนแปลง permissions

- **4.5. การจัดการข้อมูลหลัก (Master Data Management) ที่แบ่งตามระดับ**

| ข้อมูลหลัก                          | ผู้มีสิทธิ์จัดการ               | ระดับ                              |
| :---------------------------------- | :------------------------------ | :--------------------------------- |
| ประเภทเอกสาร (Correspondence, RFA)  | **Superadmin**                  | Global                             |
| สถานะเอกสาร (Draft, Approved, etc.) | **Superadmin**                  | Global                             |
| หมวดหมู่แบบ (Shop Drawing)          | **Project Manager**             | Project (สร้างใหม่ได้ภายในโครงการ) |
| Tags                                | **Org Admin / Project Manager** | Organization / Project             |
| บทบาทและสิทธิ์ (Custom Roles)       | **Superadmin / Org Admin**      | Global / Organization              |
| Document Numbering Formats          | **Superadmin / Admin**          | Global / Organization              |

## **👥 5. ข้อกำหนดด้านผู้ใช้งาน (User Interface & Experience)**

- **5.1. Layout หลัก:** หน้าเว็บใช้รูปแบบ App Shell ที่ประกอบด้วย:
  - Navbar (ส่วนบน): แสดงชื่อระบบ, เมนูผู้ใช้ (Profile), เมนูสำหรับ Document Control/เมนูสำหรับ Admin/Superadmin (จัดการผู้ใช้, จัดการสิทธิ์), และปุ่ม Login/Logout
  - Sidebar (ด้านข้าง): เป็นเมนูหลักสำหรับเข้าถึงส่วนที่เกี่ยวข้องกับเอกสารทั้งหมด เช่น Dashboard, Correspondences, RFA, Drawings
  - Main Content Area: พื้นที่สำหรับแสดงเนื้อหาหลักของหน้าที่เลือก
- **5.2. หน้า Landing Page:** เป็นหน้าแรกที่แสดงข้อมูลบางส่วนของโครงการสำหรับผู้ใช้ที่ยังไม่ได้ล็อกอิน
- **5.3. หน้า Dashboard:** เป็นหน้าแรกหลังจากล็อกอิน ประกอบด้วย:
  - การ์ดสรุปภาพรวม (KPI Cards): แสดงข้อมูลสรุปที่สำคัญขององค์กร เช่น จำนวนเอกสาร, งานที่เกินกำหนด
  - ตาราง "งานของฉัน" (My Tasks Table): แสดงรายการงานทั้งหมดจาก Circulation ที่ผู้ใช้ต้องดำเนินการ
  - Security Metrics: แสดงจำนวน files scanned, security incidents, failed login attempts
- **5.4. การติดตามสถานะ:** องค์กรสามารถติดตามสถานะเอกสารทั้งของตนเอง (Originator) และสถานะเอกสารที่ส่งมาถึงตนเอง (Recipient)
- **5.5. การจัดการข้อมูลส่วนตัว (Profile Page):** ผู้ใช้สามารถจัดการข้อมูลส่วนตัวและเปลี่ยนรหัสผ่านของตนเองได้
- **5.6. การจัดการเอกสารทางเทคนิค (RFA & Workflow):** ผู้ใช้สามารถดู RFA ในรูปแบบ Workflow ทั้งหมดได้ในหน้าเดียว, ขั้นตอนที่ยังไม่ถึงหรือผ่านไปแล้วจะเป็นรูปแบบ diable, สามารถดำเนินการได้เฉพาะในขั้นตอนที่ได้รับมอบหมายงาน (active) เช่น ตรวจสอบแล้ว เพื่อไปยังขั้นตอนต่อไป, สิทธิ์ Document Control ขึ้นไป สามรถกด ไปยังขั้นตอนต่อไป ได้ทุกขั้นตอน, การย้อนกลับ ไปขั้นตอนก่อนหน้า สามารถทำได้โดย สิทธิ์ Document Control ขึ้นไป
- **5.7. การจัดการใบเวียนเอกสาร (Circulation):** ผู้ใช้สามารถดู Circulation ในรูปแบบ Workflow ทั้งหมดได้ในหน้าเดียว,ขั้นตอนที่ยังไม่ถึงหรือผ่านไปแล้วจะเป็นรูปแบบ diable, สามารถดำเนินการได้เฉพาะในขั้นตอนที่ได้รับมอบหมายงาน (active) เช่น ตรวจสอบแล้ว เพื่อไปยังขั้นตอนต่อไป, สิทธิ์ Document Control ขึ้นไป สามรถกด ไปยังขั้นตอนต่อไป ได้ทุกขั้นตอน, การย้อนกลับ ไปขั้นตอนก่อนหน้า สามารถทำได้โดย สิทธิ์ Document Control ขึ้นไป
- **5.8. การจัดการเอกสารนำส่ง (Transmittals):** ผู้ใช้สามารถดู Transmittals ในรูปแบบรายการทั้งหมดได้ในหน้าเดียว
- **5.9. ข้อกำหนด UI/UX การแนบไฟล์ (File Attachment UX):**
  - ระบบต้องรองรับการอัปโหลดไฟล์หลายไฟล์พร้อมกัน (Multi-file upload) เช่น การลากและวาง (Drag-and-Drop)
  - ในหน้าอัปโหลด (เช่น สร้าง RFA หรือ Correspondence) ผู้ใช้ต้องสามารถกำหนดได้ว่าไฟล์ใดเป็น "เอกสารหลัก" (Main Document เช่น PDF) และไฟล์ใดเป็น "เอกสารแนบประกอบ" (Supporting Attachments เช่น .dwg, .docx, .zip)
  - **Security Feedback:** แสดง security warnings สำหรับ file types ที่เสี่ยงหรือ files ที่ fail virus scan
  - **File Type Indicators:** แสดง file type icons และ security status

## **6. ข้อกำหนดที่ไม่ใช่ฟังก์ชันการทำงาน (Non-Functional Requirements)**

- **6.1. การบันทึกการกระทำ (Audit Log):** ทุกการกระทำที่สำคัญของผู้ใช้ (สร้าง, แก้ไข, ลบ, ส่ง) จะถูกบันทึกไว้ใน audit_logs เพื่อการตรวจสอบย้อนหลัง
  - **6.1.1 ขอบเขตการบันทึก Audit Log:**
    - ทุกการสร้าง/แก้ไข/ลบ ข้อมูลสำคัญ (correspondences, RFAs, drawings, users, permissions)
    - ทุกการเข้าถึงข้อมูล sensitive (user data, financial information)
    - ทุกการเปลี่ยนสถานะ workflow (status transitions)
    - ทุกการดาวน์โหลดไฟล์สำคัญ (contract documents, financial reports)
    - ทุกการเปลี่ยนแปลง permission และ role assignment
    - ทุกการล็อกอินที่สำเร็จและล้มเหลว
    - ทุกการส่งคำขอ API ที่สำคัญ
  - **6.1.2 ข้อมูลที่ต้องบันทึกใน Audit Log:**
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

- **6.2. การค้นหา (Search):** ระบบต้องมีฟังก์ชันการค้นหาขั้นสูง ที่สามารถค้นหาเอกสาร **correspondence**, **rfa**, **shop_drawing**, **contract-drawing**, **transmittal** และ **ใบเวียน (Circulations)** จากหลายเงื่อนไขพร้อมกันได้ เช่น ค้นหาจากชื่อเรื่อง, ประเภท, วันที่, และ Tag

- **6.3. การทำรายงาน (Reporting):** สามารถจัดทำรายงานสรุปแยกประเภทของ Correspondence ประจำวัน, สัปดาห์, เดือน, และปีได้

- **6.4. ประสิทธิภาพ (Performance):** มีการใช้ Caching กับข้อมูลที่เรียกใช้บ่อย และใช้ Pagination ในตารางข้อมูลเพื่อจัดการข้อมูลจำนวนมาก
  - **6.4.1 ตัวชี้วัดประสิทธิภาพ:**
    - **API Response Time:** < 200ms (90th percentile) สำหรับ operation ทั่วไป
    - **Search Query Performance:** < 500ms สำหรับการค้นหาขั้นสูง
    - **File Upload Performance:** < 30 seconds สำหรับไฟล์ขนาด 50MB
    - **Concurrent Users:** รองรับผู้ใช้พร้อมกันอย่างน้อย 100 คน
    - **Database Connection Pool:** ขนาดเหมาะสมกับ workload (default: min 5, max 20 connections)
    - **Cache Hit Ratio:** > 80% สำหรับ cached data
    - **Application Startup Time:** < 30 seconds

  - **6.4.2 Caching Strategy:**
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

- **6.5. ความปลอดภัย (Security):**
  - มีระบบ Rate Limiting เพื่อป้องกันการโจมตีแบบ Brute-force
  - การจัดการ Secret (เช่น รหัสผ่าน DB, JWT Secret) จะต้องทำผ่าน Environment Variable ของ Docker เพื่อความปลอดภัยสูงสุด
  - **6.5.1 Rate Limiting Strategy:**
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
  - **6.5.2 Error Handling และ Resilience:**
    - ต้องมี circuit breaker pattern สำหรับ external service calls
    - ต้องมี retry mechanism ด้วย exponential backoff
    - ต้องมี graceful degradation เมื่อบริการภายนอกล้มเหลว
    - Error messages ต้องไม่เปิดเผยข้อมูล sensitive
  - **6.5.3 Input Validation:**
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
  - **6.5.4 Session และ Token Management:**
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

- **6.6. การสำรองข้อมูลและการกู้คืน (Backup & Recovery):**
  - ระบบจะต้องมีกลไกการสำรองข้อมูลอัตโนมัติสำหรับฐานข้อมูล MariaDB [cite: 2.4] และไฟล์เอกสารทั้งหมดใน /share/dms-data [cite: 2.1] (เช่น ใช้ HBS 3 ของ QNAP หรือสคริปต์สำรองข้อมูล) อย่างน้อยวันละ 1 ครั้ง
  - ต้องมีแผนการกู้คืนระบบ (Disaster Recovery Plan) ในกรณีที่ Server หลัก (QNAP) ใช้งานไม่ได้

- **6.6.1 ขั้นตอนการกู้คืน:**
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

- **6.7. กลยุทธ์การแจ้งเตือน (Notification Strategy):**
  - **6.7.1 ระบบจะส่งการแจ้งเตือน (ผ่าน Email หรือ Line [cite: 2.7]) เมื่อมีการกระทำที่สำคัญ** ดังนี้:
    1. เมื่อมีเอกสารใหม่ (Correspondence, RFA) ถูกส่งมาถึงองค์กรณ์ของเรา
    2. เมื่อมีใบเวียน (Circulation) ใหม่ มอบหมายงานมาที่เรา
    3. (ทางเลือก) เมื่อเอกสารที่เราส่งไป ถูกดำเนินการ (เช่น อนุมัติ/ปฏิเสธ)
    4. (ทางเลือก) เมื่อใกล้ถึงวันครบกำหนด (Deadline) [cite: 3.2.5, 3.6.6, 3.7.5]
  - **6.7.2 Notification Delivery Guarantees:**
    - **At-least-once delivery:** สำหรับ important notifications
    - **Retry mechanism:** ด้วย exponential backoff (max 3 retries)
    - **Dead letter queue:** สำหรับ notifications ที่ส่งไม่สำเร็จหลังจาก retries
    - **Delivery status tracking:** ต้องบันทึกสถานะการส่ง notifications
    - **Fallback channels:** ถ้า Email ล้มเหลว ให้ส่งผ่าน SYSTEM notification
    - **Notification preferences:** ผู้ใช้ต้องสามารถกำหนด channel preferences ได้

- **6.8. Monitoring และ Observability**
  - **6.8.1 Application Monitoring:**
    - **Health checks:** /health endpoint สำหรับ load balancer
    - **Metrics collection:** Response times, error rates, throughput
    - **Distributed tracing:** สำหรับ request tracing across services
    - **Log aggregation:** Structured logging ด้วย JSON format
    - **Alerting:** สำหรับ critical errors และ performance degradation
  - **6.8.2 Business Metrics:**
    - จำนวน documents created ต่อวัน
    - Workflow completion rates
    - User activity metrics
    - System utilization rates
    - Search query performance
  - **6.8.3 Security Monitoring:**
    - Failed login attempts
    - Rate limiting triggers
    - Virus scan results
    - File download activities
    - Permission changes

- **6.9 JSON Processing & Validation**
  - **6.9.1 JSON Schema Management**
    - ต้องมี centralized JSON schema registry
    - ต้องรองรับ schema versioning และ migration
    - ต้องมี schema validation during runtime
  - **6.9.2 Performance Optimization**
    - **Caching:** Cache parsed JSON structures
    - **Compression:** ใช้ compression สำหรับ JSON ขนาดใหญ่
    - **Indexing:** Support JSON path indexing สำหรับ query
  - **6.9.3 Error Handling**
    - ต้องมี graceful degradation เมื่อ JSON validation ล้มเหลว
    - ต้องมี default fallback values
    - ต้องบันทึก error logs สำหรับ validation failures

---

## **7. ข้อกำหนดด้านการทดสอบ (Testing Requirements)**

- **7.1. Unit Testing:**
  - ต้องมี unit tests สำหรับ business logic ทั้งหมด
  - Code coverage อย่างน้อย 70% สำหรับ backend services
  - ต้องทดสอบ RBAC permission logic ทุกระดับ

- **7.2. Integration Testing:**
  - ทดสอบการทำงานร่วมกันของ modules
  - ทดสอบ database migrations และ data integrity
  - ทดสอบ API endpoints ด้วย realistic data

- **7.3. End-to-End Testing:**
  - ทดสอบ complete user workflows
  - ทดสอบ document lifecycle จาก creation ถึง archival
  - ทดสอบ cross-module integrations

- **7.4. Security Testing:**
  - **Penetration Testing:** ทดสอบ OWASP Top 10 vulnerabilities
  - **Security Audit:** Review code สำหรับ security flaws
  - **Virus Scanning Test:** ทดสอบ file upload security
  - **Rate Limiting Test:** ทดสอบ rate limiting functionality

- **7.5. Performance Testing:**
  - **Load Testing:** ทดสอบด้วย realistic workloads
  - **Stress Testing:** หา breaking points ของระบบ
  - **Endurance Testing:** ทดสอบการทำงานต่อเนื่องเป็นเวลานาน

- **7.6. Disaster Recovery Testing:**
  - ทดสอบ backup และ restoration procedures
  - ทดสอบ failover mechanisms
  - ทดสอบ data integrity หลังการ recovery

---

## **8. ข้อกำหนดด้านการบำรุงรักษา (Maintenance Requirements)**

- **8.1. Log Retention:**
  - Audit logs: 7 ปี
  - Application logs: 1 ปี
  - Performance metrics: 2 ปี

- **8.2. Monitoring และ Alerting:**
  - ต้องมี proactive monitoring สำหรับ critical systems
  - ต้องมี alerting สำหรับ security incidents
  - ต้องมี performance degradation alerts

- **8.3. Patch Management:**
  - ต้องมี process สำหรับ security patches
  - ต้องทดสอบ patches ใน staging environment
  - ต้องมี rollback plan สำหรับ failed updates

- **8.4. Capacity Planning:**
  - ต้อง monitor resource utilization
  - ต้องมี scaling strategy สำหรับ growth
  - ต้องมี performance baselines และ trending

---

## **9. ข้อกำหนดด้านการปฏิบัติตามกฎระเบียบ (Compliance Requirements)**

- **9.1. Data Privacy:**
  - ต้องปฏิบัติตามกฎหมายคุ้มครองข้อมูลส่วนบุคคล
  - ต้องมี data retention policies
  - ต้องมี data deletion procedures

- **9.2. Audit Compliance:**
  - ต้องรองรับ internal และ external audits
  - ต้องมี comprehensive audit trails
  - ต้องมี reporting capabilities สำหรับ compliance

- **9.3. Security Standards:**
  - ต้องปฏิบัติตาม organizational security policies
  - ต้องมี security incident response plan
  - ต้องมี regular security assessments

---

## **10. ข้อกำหนดด้าน Testing Strategy**

### **10.1 Testing Gates แต่ละ Phase**

ทุก Phase ต้องผ่านการทดสอบต่อไปนี้ก่อนดำเนินการ Phase ถัดไป:

#### **10.1.1 Unit Testing Requirements**

- Code coverage อย่างน้อย 80% สำหรับ components ที่พัฒนาใน Phase
- ทดสอบ business logic ทั้งหมด
- ทดสอบ error scenarios และ edge cases

#### **10.1.2 Integration Testing Requirements**

- ทดสอบการทำงานร่วมกันของ modules ใน Phase
- ทดสอบ database operations
- ทดสอบ external service integrations

#### **10.1.3 Security Testing Requirements**

- ทดสอบ security vulnerabilities
- ทดสอบ permission และ access control
- ทดสอบ input validation

#### **10.1.4 Performance Testing Requirements**

- ทดสอบ response time ตามเป้าหมาย
- ทดสอบภายใต้ load ที่คาดหมาย
- ทดสอบ memory usage และ resource utilization

### **10.2 Testing Automation**

- ต้องมี automated test pipelines
- ต้องมี test reports และ metrics
- ต้องมี regression testing

---

## **📋 สรุปการปรับปรุงจากเวอร์ชันก่อนหน้า**

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

**หมายเหตุ:** Requirements นี้จะถูกทบทวนและปรับปรุงเป็นระยะตาม feedback จากทีมพัฒนาและความต้องการทางธุรกิจที่เปลี่ยนแปลงไป

## **Document Control:**

- Document for Application Requirements Specification DMS v1.4.1
- Version: 1.4.1
- Date: 2025-11-16
- Author: System Architecture Team
- Status: FINAL
- Classification: Internal Technical Documentation

---

\_End of Requirements Specification
