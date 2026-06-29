# **Manual Integration Testing (Postman Checklist)** สำหรับ **Phase 3: Unified Workflow Engine** ที่คุณสามารถนำไปใช้ทดสอบผ่าน Postman ได้ทันทีครับ

แผนนี้ออกแบบมาเพื่อทดสอบการทำงานร่วมกันของ `Create` -\> `Submit` -\> `Process Action` ให้ครอบคลุมทั้งกรณีปกติ (Happy Path) และกรณีขัดแย้ง (Edge Cases) ครับ

---

## 📋 Phase 3 Integration Test Plan: Correspondence Workflow

**Pre-requisites (เตรียมข้อมูลก่อนเริ่ม):**

1.  **Users:**
    - `admin` (Superadmin) - เอาไว้สร้าง Master Data
    - `user_org1` (อยู่ Org ID: 1) - เป็นคนสร้างเอกสาร (Originator)
    - `user_org2` (อยู่ Org ID: 2) - เป็นคนอนุมัติ (Reviewer)
2.  **Master Data:**
    - มี `correspondence_types` (เช่น ID: 1 = RFA)
    - มี `correspondence_status` (เช่น ID: 1 = DRAFT)
    - มี `organizations` (ID: 1 และ 2)
3.  **Template:**
    - รัน SQL Seed สร้าง Template ID: 1 (Step 1 -\> Org 1, Step 2 -\> Org 2) ตามที่เคยทำไป

---

### 🧪 Scenario 1: Happy Path (Create -\> Submit -\> Approve -\> Complete)

**เป้าหมาย:** ทดสอบการไหลของงานปกติจนจบกระบวนการ

| Step    | Action (API Endpoint)                                                   | Method | Actor (Token)                    | Body (JSON)                                                                   | Expected Result                                                                                                                                                     |
| :------ | :---------------------------------------------------------------------- | :----- | :------------------------------- | :---------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **1.1** | **Create Document**<br>`/api/correspondences`                           | POST   | `user_org1`                      | `{ "projectId": 1, "typeId": 1, "title": "Test Workflow 01", "details": {} }` | - Status: `201 Created`<br>- Response มี `id` (จดไว้ สมมติ `10`)<br>- Response มี `correspondenceNumber`                                                            |
| **1.2** | **Submit Document**<br>`/api/correspondences/10/submit`                 | POST   | `user_org1`                      | `{ "templateId": 1 }`                                                         | - Status: `201 Created`<br>- Response คือ `CorrespondenceRouting`<br>- `sequence`: 1<br>- `status`: "SENT"<br>- `toOrganizationId`: 1 (ส่งหาตัวเองก่อนตาม Template) |
| **1.3** | **Approve Step 1**<br>`/api/correspondences/10/workflow/action`         | POST   | `user_org1`                      | `{ "action": "APPROVE", "comments": "Review passed" }`                        | - Status: `201 Created`<br>- **Result:** "Action processed successfully"<br>- มีการสร้าง Step ถัดไป (Sequence 2) ส่งไปหา Org 2                                      |
| **1.4** | **Approve Step 2 (Final)**<br>`/api/correspondences/10/workflow/action` | POST   | `user_org2`<br>_(เปลี่ยน Token)_ | `{ "action": "APPROVE", "comments": "Final Approval" }`                       | - Status: `201 Created`<br>- **Result:** "Action processed successfully"<br>- **ไม่สร้าง Step ถัดไป** (เพราะหมดแล้ว)<br>- Workflow จบสมบูรณ์                        |

---

### 🧪 Scenario 2: Rejection Flow (การปฏิเสธเอกสาร)

**เป้าหมาย:** ทดสอบว่าเมื่อกด Reject แล้ว Workflow ต้องหยุดทันที

| Step    | Action (API Endpoint)                                            | Method | Actor (Token) | Body (JSON)                                                  | Expected Result                                                                                                 |
| :------ | :--------------------------------------------------------------- | :----- | :------------ | :----------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------- |
| **2.1** | **Create Document**<br>`/api/correspondences`                    | POST   | `user_org1`   | `{ "projectId": 1, "typeId": 1, "title": "Test Reject 01" }` | - ได้ `id` ใหม่ (สมมติ `11`)                                                                                    |
| **2.2** | **Submit Document**<br>`/api/correspondences/11/submit`          | POST   | `user_org1`   | `{ "templateId": 1 }`                                        | - สร้าง Routing Sequence 1                                                                                      |
| **2.3** | **Reject Document**<br>`/api/correspondences/11/workflow/action` | POST   | `user_org1`   | `{ "action": "REJECT", "comments": "Invalid Data" }`         | - Status: `201 Created`<br>- Step 1 Status เปลี่ยนเป็น `REJECTED`<br>- **ไม่มีการสร้าง Step 2** (Workflow หยุด) |

---

### 🧪 Scenario 3: Security Check (ข้ามหน้าข้ามตา)

**เป้าหมาย:** ทดสอบว่าคนนอก (User ที่ไม่อยู่ใน Org ปลายทาง) จะไม่สามารถกดอนุมัติได้

| Step    | Action (API Endpoint)                              | Method | Actor (Token)                        | Body (JSON)               | Expected Result                                                                                                    |
| :------ | :------------------------------------------------- | :----- | :----------------------------------- | :------------------------ | :----------------------------------------------------------------------------------------------------------------- |
| **3.1** | **Create & Submit**                                | POST   | `user_org1`                          | _(ทำเหมือน 1.1 และ 1.2)_  | - ได้ `id` ใหม่ (สมมติ `12`)<br>- Routing Seq 1 (ส่งหา Org 1)                                                      |
| **3.2** | **Approve Step 1**                                 | POST   | `user_org1`                          | `{ "action": "APPROVE" }` | - ผ่าน (เพราะ User 1 อยู่ Org 1)<br>- สร้าง Seq 2 (ส่งหา Org 2)                                                    |
| **3.3** | **Try to Approve Step 2**<br>_(โดยใช้ User Org 1)_ | POST   | **`user_org1`**<br>_(เจตนาใช้ผิดคน)_ | `{ "action": "APPROVE" }` | - **Status: `400 Bad Request`**<br>- Message: "You are not authorized to process this step"<br>_(ป้องกันสำเร็จ\!)_ |

---

### ✅ Checklist การตรวจสอบผลลัพธ์ใน Database

หลังจากรัน Scenario 1 จบแล้ว ให้ลอง Query ดูใน Database เพื่อความมั่นใจครับ:

```sql
SELECT * FROM correspondence_routings WHERE correspondence_id = 10 ORDER BY sequence;
```

**สิ่งที่ควรเจอ:**

1.  Row 1: `sequence`=1, `status`='ACTIONED', `comments`='Review passed'
2.  Row 2: `sequence`=2, `status`='ACTIONED', `comments`='Final Approval'

ถ้าผลการทดสอบเป็นไปตามนี้ทั้งหมด แสดงว่า **Phase 3 สมบูรณ์แบบ** พร้อมไปต่อ Phase 4 (RFA) ได้เลยครับ\!
