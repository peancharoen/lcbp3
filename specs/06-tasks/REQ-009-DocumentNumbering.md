# Refactoring Document Numbering เพิ่ม features ให้กับ Document Numbering เพื่อรองรับหลักการ Immutability, Audit Trail และ Advanced Operations
Template Management ต้องคงหน้านี้ไว้ (ไม่มีการปรับปรุง)
## รายละเอียด
### 1. ปรับปรุง Logic การออกเลขให้เป็นแบบ Assign Once
  * 1.1 ตรวจสอบให้แน่ใจว่า `generateNextNumber` จะถูกเรียกเฉพาะตอน Create (POST) เท่านั้น
  * 1.2 ห้ามเรียกตอน Update (PATCH/PUT) ยกเว้นกรณีมีการเปลี่ยนค่าสำคัญ (Project, Type, Discipline, Recipient) ในสถานะ Draft เท่านั้น หากค่าเหล่านี้ไม่เปลี่ยน **ต้อง** ใช้เลขเดิมเสมอ
  * 1.3 ในกรณีที่มีการเปลี่ยนค่าสำคัญ (Project, Type, Discipline, Recipient) ถ้ายังไม่ได้ออกเลขถัดไป ต้องคืนเลขเดิม (-1 counter) ถ้าออกเลขถัดไปแล้ว ให้บันทึกเลขนี้ เป็น void_replace
  * 1.4 ใช้ **Redlock** (Redis Distributed Lock) คลุม Logic การดึงและอัปเดต Counter ร่วมกับ **Optimistic Locking** (Version column) ใน Database
  * 1.5 **Audit Logging:** แก้ไขฟังก์ชัน `logAudit` ให้บันทึก `operation` type (reserve, confirm, manual_override, void_replace) ให้ครบถ้วน
  * 1.6 **Implement New Methods:**
    * `manualOverride()`: บันทึกเลขและขยับ Counter ถ้าเลขมากกว่าปัจจุบัน
    * `NumberingMetrics`: Interface สำหรับ Monitoring Dashboard
    * `cancelNumber()`: บันทึก Audit ว่ายกเลิก (Skip) โดยไม่นำกลับมาใช้ใหม่
    * `voidAndReplace()`: ออกเลขใหม่ให้เอกสารเดิม และบันทึกความเชื่อมโยง
    * `bulkImport()`: สำหรับนำเข้าข้อมูลและตั้งค่า Counter เริ่มต้น
    * `confirmNumber()`: บันทึกเลขและขยับ Counter ถ้าเลขมากกว่าปัจจุบัน
    * `audit()`: บันทึก Audit ว่ายกเลิก (Skip) โดยไม่นำกลับมาใช้ใหม่

### 2. เพิ่มฟีเจอร์สำหรับ Admin
  * 2.1 เพิ่ม Endpoints สำหรับ Admin (ควรติด Guard `RequirePermission`)
  * 2.2 `GET /admin/document-numbering/metrics`
  * 2.3 `POST /admin/document-numbering/manual-override`
  * 2.4 `POST /admin/document-numbering/bulk-import`
  * 2.5 `POST /admin/document-numbering/void-and-replace`
  * 2.6 `POST /admin/document-numbering/cancel-number`
  * 2.7 `POST /admin/document-numbering/confirm-number`
  * 2.8 `POST /admin/document-numbering/audit`
  * 2.9 `POST /admin/document-numbering/audit`

### 3. ปรับปรุง UI เพื่อป้องกัน User แก้ไขเลขที่เอกสาร
  * 3.1 แสดง "Auto Generated" หรือ Preview เลขที่เอกสาร (ถ้ามี)
  * 3.2 ช่อง `Document No` ต้องเป็น **Read-Only** หรือ **Disabled** เสมอ User เห็นแต่แก้ไม่ได้
  * 3.3 **API Integration:** ตัดการส่ง field `documentNumber` กลับไปหา Backend ในหน้า Edit เพื่อป้องกันการเขียนทับโดยบังเอิญ

### 4. ปรับปรุง Database เพื่อรองรับฟีเจอร์ใหม่
  * 4.1 Schema Update* ตรวจสอบตาราง `document_number_audit` ว่ามีคอลัมน์รองรับ `operation` (Enum) และ `metadata` (JSON) หรือไม่ หากไม่มีให้สร้าง Migration file
  * 4.2 Data Seeding / Migration* ใช้ `BulkImportDto` ในการเขียน Script ดึงข้อมูลเลขที่เอกสารล่าสุดจากระบบเก่า
    * 4.2.1 รัน Script ผ่าน Endpoint `bulk-import` เพื่อให้ระบบคำนวณและตั้งค่า `Last Number` ของแต่ละ Series ให้ถูกต้องทันทีที่ขึ้นระบบใหม่

### 5. Frontend Implementation (UI/UX)เป้าหมาย: ป้องกัน User แก้ไขเลขที่เอกสาร และสร้างเครื่องมือให้ Admin

### 5.1 User Mode (Create/Edit Forms)* **Create Mode:** แสดง "Auto Generated" หรือ Preview เลขที่เอกสาร (ถ้ามี)
* **Edit Mode (Strict Rule):** ช่อง `Document No` ต้องเป็น **Read-Only** หรือ **Disabled** เสมอ User เห็นแต่แก้ไม่ได้
* **API Integration:** ตัดการส่ง field `documentNumber` กลับไปหา Backend ในหน้า Edit เพื่อป้องกันการเขียนทับโดยบังเอิญ

### 5.2 Admin Dashboard (Monitoring & Tools)* **Numbering Dashboard:**
  * Template Management: ต้องคงหน้านี้ไว้ ทำให้เป็นหน้าแรก ของ Numbering Dashboard
  * สร้างหน้ากราฟแสดง `sequence_utilization` และ `failed_lock_attempts` จาก API Metrics ทำให้เป็น เมนูย่อย ของ Numbering Dashboard
  * Management Tools: สร้าง Modal หรือ Form สำหรับ:
    * Manual Override: กรณีต้องออกเลขย้อนหลังหรือเลขพิเศษ: ทำให้เป็น เมนูย่อย ของ Numbering Dashboard
    * Void/Replace: ปุ่มกดเพื่อ Void เอกสารและออกเลขใหม่: ทำให้เป็น เมนูย่อย ของ Numbering Dashboard


