# **Manual Integration Testing (Postman Checklist)** สำหรับ **Phase 2: High-Integrity Data & Security** โดยเฉพาะครับ

Phase นี้เน้นเรื่อง **การจัดการไฟล์ (File Storage)**, **ความปลอดภัย (Security)** และ **ระบบตรวจสอบข้อมูล (JSON Schema)** ครับ

---

## 📋 Phase 2 Integration Test Plan

**Pre-requisites (เตรียมข้อมูลก่อนเริ่ม):**

1.  **Server:** รัน `pnpm start:dev`
2.  **Auth:** Login ด้วย `admin` เพื่อขอ Access Token (ใช้แนบใน Header: `Authorization: Bearer <token>`)

---

### 🧪 Scenario 1: File Storage (T2.2)

**เป้าหมาย:** ทดสอบว่าระบบอัปโหลดไฟล์ทำงานถูกต้อง (Two-Phase Storage)

| Step    | Action (API Endpoint)                               | Method | Body (Form-Data)                                                    | Expected Result                                                                                                              |
| :------ | :-------------------------------------------------- | :----- | :------------------------------------------------------------------ | :--------------------------------------------------------------------------------------------------------------------------- |
| **1.1** | **Upload Valid File**<br>`/api/files/upload`        | POST   | Key: `file` (Type: File)<br>Value: (เลือกไฟล์ PDF/IMG ขนาด \< 50MB) | - **Status: 201 Created**<br>- Response มี `id`, `originalFilename`<br>- `isTemporary`: **true**<br>- `tempId`: (มีค่า UUID) |
| **1.2** | **Upload Invalid File Type**<br>`/api/files/upload` | POST   | Key: `file` (Type: File)<br>Value: (เลือกไฟล์ .exe หรือ .bat)       | - **Status: 400 Bad Request**<br>- Message: "Validation failed... expected type is..."                                       |
| **1.3** | **Upload Too Large File**<br>`/api/files/upload`    | POST   | Key: `file` (Type: File)<br>Value: (ไฟล์ขนาด \> 50MB)               | - **Status: 413 Payload Too Large** หรือ **400 Bad Request**                                                                 |

_หมายเหตุ: การ Commit ไฟล์ (ย้ายจาก Temp -\> Permanent) จะเกิดขึ้นอัตโนมัติเมื่อเรานำไฟล์ไปผูกกับเอกสารใน Phase 3_

---

### 🧪 Scenario 2: JSON Schema Validation (T2.5)

**เป้าหมาย:** ทดสอบระบบตรวจสอบโครงสร้างข้อมูล JSON

| Step    | Action (API Endpoint)                                                 | Method | Body (JSON)                                                                                 | Expected Result                                                              |
| :------ | :-------------------------------------------------------------------- | :----- | :------------------------------------------------------------------------------------------ | :--------------------------------------------------------------------------- |
| **2.1** | **Register Schema**<br>`/api/json-schemas/TEST_SCHEMA`                | POST   | `{ "type": "object", "properties": { "age": { "type": "integer" } }, "required": ["age"] }` | - **Status: 201 Created**<br>- Response มี `id`, `schemaCode`: "TEST_SCHEMA" |
| **2.2** | **Validate Valid Data**<br>`/api/json-schemas/TEST_SCHEMA/validate`   | POST   | `{ "age": 25 }`                                                                             | - **Status: 201 Created**<br>- Response: `{ "valid": true }`                 |
| **2.3** | **Validate Invalid Data**<br>`/api/json-schemas/TEST_SCHEMA/validate` | POST   | `{ "age": "twenty-five" }`                                                                  | - **Status: 400 Bad Request**<br>- Message: "JSON Validation Failed..."      |

---

### 🧪 Scenario 3: Security & Rate Limiting (T2.4)

**เป้าหมาย:** ทดสอบระบบป้องกันการโจมตี

| Step    | Action (API Endpoint)                              | Method | Details                                | Expected Result                                                                                                                                        |
| :------ | :------------------------------------------------- | :----- | :------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------- |
| **3.1** | **Brute Force Login**<br>`/api/auth/login`         | POST   | กด Send รัวๆ เกิน 5 ครั้ง ภายใน 1 นาที | - **ครั้งที่ 1-5:** Status 201/401 (ปกติ)<br>- **ครั้งที่ 6+:** **Status 429 Too Many Requests**<br>- Message: "ThrottlerException: Too Many Requests" |
| **3.2** | **Security Headers**<br>(ตรวจสอบ Response Headers) | ANY    | ยิง Request อะไรก็ได้                  | - Header `X-Powered-By` **ต้องไม่มี** (ถูก Helmet ซ่อน)<br>- Header `Content-Security-Policy` **ต้องมี**                                               |

---

### 🧪 Scenario 4: Document Numbering (T2.3)

**เป้าหมาย:** ทดสอบการรันเลขที่เอกสาร (ทดสอบผ่านการสร้างเอกสารใน Phase 3)

_เนื่องจาก Service นี้เป็น Internal เราจะทดสอบผ่านการสร้าง Correspondence_

| Step    | Action (API Endpoint)                              | Method | Body (JSON)                                                 | Expected Result                                                             |
| :------ | :------------------------------------------------- | :----- | :---------------------------------------------------------- | :-------------------------------------------------------------------------- |
| **4.1** | **Generate Number**<br>`/api/correspondences`      | POST   | `{ "projectId": 1, "typeId": 1, "title": "Test Number 1" }` | - `correspondenceNumber` ลงท้ายด้วย **0001** (หรือเลขล่าสุด +1)             |
| **4.2** | **Generate Next Number**<br>`/api/correspondences` | POST   | `{ "projectId": 1, "typeId": 1, "title": "Test Number 2" }` | - `correspondenceNumber` ต้องเป็นเลขถัดไป (เช่น **0002**) ห้ามซ้ำกับข้อ 4.1 |

---

### ✅ Checklist การตรวจสอบใน Server (Files)

1.  ไปที่โฟลเดอร์โปรเจกต์
2.  ตรวจสอบโฟลเดอร์ `uploads/temp`
3.  **สิ่งที่ต้องเจอ:** ไฟล์ที่อัปโหลดในข้อ **1.1** ต้องปรากฏอยู่ในนี้ โดยชื่อไฟล์จะเป็น UUID (ไม่ใช่ชื่อเดิม)

ถ้าผ่านครบทุกข้อนี้ แสดงว่า **Phase 2 (Infrastructure & Integrity)** แข็งแกร่งพร้อมใช้งานครับ\!
