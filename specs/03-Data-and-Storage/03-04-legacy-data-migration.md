---
description: legacy PDF document migration to system v1.8.0 uses n8n and Ollama
version: 1.8.0
---

# 03-04: Legacy Data Migration Plan (PDF 20k Docs)

## 1. วัตถุประสงค์ (Objectives)

* นำเข้าเอกสาร PDF 20,000 ฉบับ พร้อม Metadata จาก Excel (Legacy system export) เข้าสู่ระบบ LCBP3-DMS
* ใช้ AI (Ollama Local Model) เพื่อตรวจสอบความถูกต้องของลักษณะข้อมูล (Data format, Title consistency) ก่อนการนำเข้า
* รักษาโครงสร้างความสัมพันธ์ (Project / Contract / Ref No.) และระบบการทำ Revision ตาม Business Rules

> **Note:** เอกสารนี้ขยายความถึงวิธีปฏิบัติ (Implementation) จากการตัดสินใจทางสถาปัตยกรรมใน [ADR-017: Ollama Data Migration Architecture](../06-Decision-Records/ADR-017-ollama-data-migration.md)

---

## 2. โครงสร้างพื้นฐาน (Migration Infrastructure)

การนำเข้าข้อมูลชุดใหญ่นี้จะไม่กระทำผ่าน User Interface แต่จะใช้โครงสร้างสถาปัตยกรรมชั่วคราวและ APIs:

* **Migration Orchestrator:** n8n (รันจาก Docker Container บน QNAP NAS)
* **AI Validator:** Ollama Native (รันบน Windows Desktop - i9 + RTX 2060 SUPER)
* **Target Database:** MariaDB (`correspondences` table)
* **Target Storage:** QNAP File System (Mount volumes เข้า Application)
* **Connection:** ข้อมูลก้อนใหญ่ถูกโยกย้ายผ่าน 2.5G LAN + LACP เพื่อประสิทธิผลสูงสุด

---

## 3. ขั้นตอนการดำเนินงาน (Implementation Steps)

### Phase 1: การเตรียม Infrastructure และ Storage (สัปดาห์ที่ 1)

1. **File Migration:**
   ย้ายไฟล์ PDF ทั้งหมดจากแหล่งเก็บ (Desktop/External Drive) ไปยัง Folder ชั่วคราวบน NAS เพื่อรอการประมวลผล แนะนำใช้ `Robocopy` หรือ `Rsync`
   * *Target Path:* `/share/DMS_Storage/migration_temp/`

2. **Mount Folder:**
   ทำการ Bind Mount โฟลเดอร์ `migration_temp/` เข้ากับ Container ของ n8n เพื่อให้ n8n เช็คความมีอยู่ของไฟล์ด้วย Disk I/O speed.

3. **Ollama Config:**
   * ติดตั้ง Ollama แบบ Native บน Desktop
   * ตั้งค่า Environment Variable `OLLAMA_HOST=0.0.0.0`
   * Fix IP ให้ Desktop เครื่องโฮสต์ และเปิด Port `11434` ที่ระดับ OS Firewall
   * รันคำสั่ง `ollama pull llama3.2` (หรือ Model ที่เหมาะสม)

### Phase 2: การเตรียม Target Database และ API (สัปดาห์ที่ 1)

1. **SQL Indexing:**
   เพื่อให้ API ตรวจจับ Duplicate record ได้อย่างรวดเร็ว (สำหรับ 20,000 แถว) ให้กระทำคำสั่ง SQL เพื่อเพิ่ม Index ลงฐานข้อมูล Production ชั่วคราว (หรือถาวร):
   ```sql
   ALTER TABLE correspondences ADD INDEX idx_doc_number (document_number);
   ALTER TABLE correspondences ADD INDEX idx_deleted_at (deleted_at);
   ```

2. **API Authentication:**
   ระบบ LCBP3-DMS ต้องสร้าง Access Token แบบผูกพันกับ Role ระดับสูง (เช่น `SYSTEM_ADMIN` หรือ `MIGRATION_USER`) ซึ่งมีสิทธิ์ Bypass การ Validation บางประการ (ถ้าได้รับการอนุญาต) ส่งมอบให้ n8n

### Phase 3: การออกแบบ n8n Workflow (The Migration Logic)

Workflow ควบคุมการไหลของข้อมูลประกอบด้วย 4 ส่วนการทำงาน:

1. **Data Reader Node:**
   อ่านไฟล์ Metadata จาก Excel แล้วแยกส่วน (Batching) เพื่อทยอยดำเนินการทีละ 100 แถว
2. **File Validator Node:**
   ตรวจจับว่าเส้นทางนามสกุลไฟล์ เช่น `Iyyccnnnn-[doc_number].pdf` มีอยู่จริงในระบบเก็บข้อมูล NAS (บริเวณโฟลเดอร์ temp)
3. **AI Analysis Node (HTTP Request to Ollama):**
   * ส่ง Metadata เช่น (Document Number, Title) ให้ AI ตรวจสอบ
   * *System Prompt Example:* "You are a Document Controller. Verify if the document title [Title] matches the numbering pattern [Pattern]. Categorize this into [Category List]. Output in JSON format only."
4. **Data Ingestion Node:**
   * ใช้ HTTP Request ยิง POST เวิร์กโหลดเข้าไปที่ Backend API
   * Backend API ต้องมีความสามารถในการรองรับ *Idempotency* และจัดการตรวจสอบว่าหาก `document_number` เกิดซ้ำกัน ต้องยกระดับไปสร้างบันทึกใหม่เป็น Version / Revision (+1) ไม่ใช่การทับลง Record เดิม

### Phase 4: แผนการทดสอบ (Testing & QA)

1. **Dry Run:** รันเพียง 1 Batch ข้อมูล (ขนาด ~100 แถว) ทะลวงระบบจากต้นน้ำถึงปลายน้ำ
2. **Integrity Check:** QA เช็คในหน้า UI และในฐานข้อมูล MariaDB ว่า Metadata โอนถ่ายได้ครบถ้วน และไฟล์ Physical file ย้ายไปสู่โฟลเดอร์ Webroot (Permanent Storage) ของเอกสาร
3. **Hardware Tuning:** จับตาดู RAM ของ NAS และ GPU VRAM/Temperatures ของ Desktop ฝั่ง Ollama. ปรับหน่วง Delay ระหว่าง Request ได้ในตัว n8n หากฮาร์ดแวร์ทำงานหนักเกิน

### Phase 5: การรันงานจริง (Execution & Monitoring)

1. **Scheduling:** เปิดตัวรันอัตโนมัติเฉพาะเวลากลางคืน (Offline hours)
2. **Log Monitoring:** เปิด Execution Logs ของ n8n ควบคู่ไปกับ Docker Logs
3. **Post-Migration Audit:** ผู้ดูแลระบบสั่งรัน Query สอบยอดหลังบ้าน:
   ```sql
   SELECT count(*) FROM correspondences WHERE created_by = 'SYSTEM_IMPORT';
   ```

---

## 4. แผนรับมือความเสี่ยง (Risk Management)

| ลำดับที่ | ความเสี่ยง                          | การจัดการ (Mitigation)                                                                        |
| ---- | --------------------------------- | -------------------------------------------------------------------------------------------- |
| 1    | AI Node หรือ GPU ค้าง (OOT/Timeout) | กำหนดให้ Node มี Node Retry Mechanism (เช่น รอ 1 นาที ทำซ้ำ 3 รอบ) ประกอบกับการจับ Wait node ไว้ดักทิศทาง |
| 2    | หมายเลขเอกสารซ้ำซ้อนกันใน Excel       | Backend ต้องมี Controller Logic รับมือ และส่งออกเลข Revision เพื่อลงฐานข้อมูล                         |
| 3    | ดิสก์ NAS ทรุด หรือ Database บวมชั่วขณะ | ปิดฟีเจอร์ "Save Successful Executions" ใน Options ของ n8n                                      |

---

> **ข้อแนะนำด้าน Physical Storage:** หลังจากนำเข้าข้อมูลเสร็จ ตรวจสอบให้แน่ใจว่าไฟล์ PDF ทั้ง 20,000 ไฟล์ ถูกย้าย (Move) หรือคัดลอก (Copy) ไปเก็บยัง Local Storage Strategy ตามที่ได้ตกลงระบุไว้ใน Specs ฉบับที่เกี่ยวข้องกับ Storage อย่างถูกต้อง ไม่ปล่อยค้างไว้ที่ Temp Folder
