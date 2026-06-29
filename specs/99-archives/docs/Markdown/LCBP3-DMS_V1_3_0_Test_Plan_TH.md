# **🧪 แผนการทดสอบระบบ (Test Plan) \- DMS v1.3.0 Backend**

เอกสารนี้สรุปแผนการทดสอบ, ขั้นตอน, และเครื่องมือที่ใช้ในการตรวจสอบความถูกต้องของ NestJS Backend API (DMS v1.3.0) ก่อนการ Deploy ใช้งานจริงร่วมกับ Frontend

## **1\. วัตถุประสงค์ (Objectives)**

- เพื่อให้มั่นใจว่า API ทั้งหมดทำงานตรงตาม requirements.md
- เพื่อตรวจสอบว่าระบบรักษาความปลอดภัย (RBAC และ Security) ทำงานได้ถูกต้อง 100%
- เพื่อค้นหาและแก้ไขข้อบกพร่อง (Bugs) ที่เกี่ยวข้องกับการเชื่อมต่อฐานข้อมูลและ Business Logic
- เพื่อยืนยันว่าระบบทนทานต่อการใช้งานพร้อมกัน (Concurrency) และมีประสิทธิภาพ (Performance)
- เพื่อส่งมอบ API ที่เสถียรและมีเอกสาร (Swagger) ครบถ้วนให้แก่ทีม Frontend

## **2\. ขอบเขตการทดสอบ (Scope)**

### **สิ่งที่อยู่ในขอบเขต (In-Scope)**

- **API Functionality:** การทดสอบ Endpoints ทั้งหมด (CRUD, Search, Upload)
- **Business Logic:** ตรรกะการสร้างเอกสาร (RFA, Correspondence), การสร้างเลขที่, และ Workflow
- **Security:** การยืนยันตัวตน (JWT), การจัดการสิทธิ์ (RBAC Guard), การป้องกัน (Helmet, Rate Limiter)
- **Data Integrity:** การตรวจสอบความถูกต้องของข้อมูลที่บันทึกลง MariaDB
- **Performance:** การทดสอบ Concurrency (การสร้างเลขที่) และการตอบสนองของ API
- **Error Handling:** การตรวจสอบว่า Global Exception Filter ทำงานได้ถูกต้อง

### **สิ่งที่อยู่นอกขอบเขต (Out-of-Scope)**

- การทดสอบ Next.js Frontend (UI/UX)
- การทดสอบตรรกะภายในของ N8N (เราทดสอบแค่ว่า Backend _ยิง_ Webhook ไปหรือไม่)
- การทดสอบ Penetration Test ขั้นสูง (เน้น Functional & Security พื้นฐาน)

## **3\. สภาพแวดล้อมและเครื่องมือ (Environment & Tools)**

| ประเภท               | เครื่องมือ/สภาพแวดล้อม           | วัตถุประสงค์                                                                                                             |
| :------------------- | :------------------------------- | :----------------------------------------------------------------------------------------------------------------------- |
| **สภาพแวดล้อม**      | **Staging (QNAP)**               | สภาพแวดล้อมจำลอง (บน Docker) ที่เหมือน Production ที่สุด ประกอบด้วย backend, mariadb, elasticsearch, n8n (Mock Receiver) |
| **ฐานข้อมูล**        | **DBeaver**                      | ใช้สำหรับเชื่อมต่อ MariaDB (Staging) เพื่อตรวจสอบผลลัพธ์ (Data Verification)                                             |
| **API (Manual)**     | **Postman / Insomnia**           | ใช้สำหรับการทดสอบ API ด้วยตนเอง, สำรวจ Endpoints, และสร้าง Test Case                                                     |
| **API (Automation)** | **Postman (Newman) / Supertest** | (E2E) ใช้รัน Test Case อัตโนมัติเพื่อตรวจสอบ API Contract                                                                |
| **Unit/Integration** | **Jest / @nestjs/testing**       | (Developer) ใช้สำหรับทดสอบ Logic ภายใน Service และ Guard (ตามตัวอย่าง spec.ts ที่สร้างไว้)                               |
| **Concurrency**      | **k6 (แนะนำ) / Node.js Script**  | ใช้สำหรับทดสอบ Stress Test และ Concurrency (โดยเฉพาะ TC-CON-01)                                                          |
| **Webhook**          | **N8N (Webhook Node)**           | ใช้ N8N จริง (Staging) ตั้งค่า Webhook Node เพื่อรับ Event จาก NotificationService                                       |

## **4\. รายละเอียดสถานการณ์ทดสอบ (Detailed Test Scenarios)**

นี่คือ Test Case ที่สำคัญที่สุด โดยแบ่งตามความเสี่ยงและ Function

### **T1: การรักษาความปลอดภัย (Security & RBAC) \- (ความเสี่ยงสูงมาก)**

| ID            | สถานการณ์                          | ขั้นตอนการทดสอบ (Steps)                                                                                                                                                                                 | ผลลัพธ์ที่คาดหวัง (Expected)                                                                                | เครื่องมือ       |
| :------------ | :--------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :---------------------------------------------------------------------------------------------------------- | :--------------- |
| **TC-SEC-01** | **(RBAC) ห้าม Viewer สร้างเอกสาร** | 1\. (Postman) เรียก POST /api/v1/auth/login ด้วย User "Viewer" 2\. คัดลอก access_token 3\. เรียก POST /api/v1/correspondence (ใน Auth Header) พร้อม Body ที่ถูกต้อง                                     | 403 Forbidden (RBACGuard ทำงาน)                                                                             | Postman          |
| **TC-SEC-02** | **(RBAC) Editor ข้าม Project**     | 1\. (Postman) Login User "Editor" ที่มีสิทธิ์เฉพาะ Project A 2\. (DBeaver) หา ID เอกสาร (เช่น corr_id: 99\) ที่อยู่ใน Project B 3\. (Postman) เรียก GET /api/v1/correspondence/99 ด้วย Token ของ Editor | 403 Forbidden หรือ 404 Not Found                                                                            | Postman, DBeaver |
| **TC-SEC-03** | **(RBAC) Super Admin**             | 1\. (Postman) Login User "Super Admin" 2\. เรียก Endpoint ที่จำกัดสิทธิ์สูง (เช่น POST /api/v1/admin/users)                                                                                             | 201 Created (Super Admin ต้องผ่านทุกการตรวจสอบ)                                                             | Postman          |
| **TC-SEC-04** | **(Rate Limit) Brute-force**       | 1\. (Postman Runner หรือ k6) ตั้งค่าให้เรียก POST /api/v1/auth/login (ด้วยรหัสผ่านผิด) 110 ครั้ง (Limit คือ 100\) 2\. สังเกตผลลัพธ์                                                                     | Request ที่ 1-100: 401 Unauthorized Request ที่ 101+: 429 Too Many Requests                                 | k6, Postman      |
| **TC-SEC-05** | **(Security) Helmet**              | 1\. (Postman) เรียก Endpoint ใดก็ได้ (เช่น GET /api/v1/health) 2\. ตรวจสอบ Response Headers                                                                                                             | ต้องมี Headers เช่น X-Content-Type-Options: nosniff, Strict-Transport-Security, X-Frame-Options: SAMEORIGIN | Postman          |

### **T2: ตรรกะหลัก (Core Logic & Concurrency) \- (ความเสี่ยงสูง)**

| ID             | สถานการณ์                           | ขั้นตอนการทดสอบ (Steps)                                                                                                                                                                                                    | ผลลัพธ์ที่คาดหวัง (Expected)                                                                                                                                                            | เครื่องมือ       |
| :------------- | :---------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------------- |
| **TC-CON-01**  | **(Concurrency) สร้างเลขที่เอกสาร** | 1\. (k6/Script) สร้าง Script ที่เรียก POST /api/v1/correspondence (สร้างเอกสารใหม่) 50 ครั้ง _พร้อมกัน_ (Simultaneously) 2\. (Postman) Login Admin 3\. (DBeaver) ตรวจสอบตาราง correspondences และ document_number_counters | 1\. Script ทั้ง 50 ครั้งสำเร็จ (201 Created) 2\. (DBeaver) document_number_counters มี last_number: 50 3\. correspondences มีเอกสาร 50 ฉบับ โดย _ไม่มี_ correspondence_number ซ้ำกันเลย | k6, DBeaver      |
| **TC-FUNC-01** | **(Data) สร้าง RFA (Complex)**      | 1\. (Postman) Login User (เช่น "Editor") 2\. เรียก POST /api/v1/rfa พร้อม DTO ที่ซับซ้อน (มี rfa_type_id, title, attachments, shop_drawings)                                                                               | 1\. 201 Created 2\. (DBeaver) ตรวจสอบว่ามีข้อมูลถูกสร้างขึ้นใน 3 ตารางหลัก: \- correspondences (ตารางแม่) \- rfas (ตารางแม่ RFA) \- rfa_revisions (ตารางลูก Revision 0\)                | Postman, DBeaver |

### **T3: การทำงานของโมดูล (Module Functionality)**

| ID             | สถานการณ์                        | ขั้นตอนการทดสอบ (Steps)                                                                                                                                               | ผลลัพธ์ที่คาดหวัง (Expected)                                                                                                                                                | เครื่องมือ       |
| :------------- | :------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------------- |
| **TC-FUNC-02** | **(File) อัปโหลดไฟล์**           | 1\. (Postman) Login User 2\. เรียก POST /api/v1/files/upload (ประเภท form-data, key file) 3\. (DBeaver) ตรวจสอบตาราง attachments                                      | 1\. 201 Created คืนค่าข้อมูล Attachment (เช่น ID, stored_filename) 2\. (DBeaver) มีแถวใหม่ในตาราง attachments 3\. (ถ้าทำได้) ตรวจสอบ QNAP /share/dms-data/... ว่ามีไฟล์จริง | Postman, DBeaver |
| **TC-FUNC-03** | **(File) ดาวน์โหลด (ผ่าน Auth)** | 1\. (Postman) ทำ TC-FUNC-02 เพื่ออัปโหลดไฟล์ (สมมติได้ attachment_id: 123\) 2\. เรียก GET /api/v1/files/download/123 (ต้องใส่ Auth Header)                            | 200 OK และได้ข้อมูลไฟล์กลับมา                                                                                                                                               | Postman          |
| **TC-FUNC-04** | **(Search) Elasticsearch**       | 1\. (Postman) สร้างเอกสารใหม่ POST /api/v1/correspondence (จดจำ Title ไว้) 2\. (รอ 10 วินาที ให้ Elastic Index) 3\. เรียก GET /api/v1/search?query=\[Title ที่จดไว้\] | 200 OK และผลลัพธ์การค้นหาต้องมีเอกสารที่เพิ่งสร้าง                                                                                                                          | Postman          |
| **TC-FUNC-05** | **(Notification) N8N Webhook**   | 1\. (N8N) สร้าง Workflow ใหม่, ใช้ "Webhook" Node (เปิด Test Mode) 2\. (Postman) Login User 3\. เรียก POST /api/v1/circulation (สร้างใบเวียนใหม่)                     | 1\. (Postman) 201 Created 2\. (N8N) Webhook Node ได้รับข้อมูล Payload ({ event: 'NEW_CIRCULATION_TASK', ... })                                                              | Postman, N8N     |
| **TC-FUNC-06** | **(Audit) Audit Log**            | 1\. (Postman) Login Admin 2\. เรียก DELETE /api/v1/admin/roles/10 (ลบ Role สมมติ) 3\. (DBeaver) ตรวจสอบ audit_logs                                                    | 1\. (DBeaver) มีแถวใหม่ใน audit_logs 2\. ข้อมูลถูกต้อง: action: 'role.delete', entity_type: 'role', entity_id: '10', user_id: \[Admin ID\]                                  | Postman, DBeaver |

### **T4: การ Deploy (NFR)**

| ID            | สถานการณ์                 | ขั้นตอนการทดสอบ (Steps)                                                       | ผลลัพธ์ที่คาดหวัง (Expected)                                                                                                                 | เครื่องมือ       |
| :------------ | :------------------------ | :---------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------- | :--------------- |
| **TC-NFR-01** | **(Health) Health Check** | 1\. (Browser/Postman) เรียก GET /api/v1/health (จาก Staging URL)              | 200 OK และ JSON Response แสดง status: "ok" และสถานะ DB                                                                                       | Postman, Browser |
| **TC-NFR-02** | **(Error) Global Filter** | 1\. (Postman) เรียก Endpoint ที่ไม่มีอยู่จริง (เช่น GET /api/v1/invalid_path) | 404 Not Found Response Body ต้องมีโครงสร้าง JSON ที่กำหนดไว้ (เช่น { "statusCode": 404, "message": "Cannot GET /api/v1/invalid_path", ... }) | Postman          |
