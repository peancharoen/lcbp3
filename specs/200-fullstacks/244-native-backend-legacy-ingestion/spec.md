# Feature Specification: 244-native-backend-legacy-ingestion

**Feature Branch**: `244-native-backend-legacy-ingestion`
**Created**: 2026-08-20
**Status**: Specified
**Related ADRs**: [ADR-047](../../06-Decision-Records/ADR-047-native-backend-legacy-ingestion.md), [ADR-042](../../06-Decision-Records/ADR-042-sandbox-project-and-ocr-text-persistence.md), [ADR-028](../../06-Decision-Records/ADR-028-migration-architecture-refactor.md), [ADR-023A](../../06-Decision-Records/ADR-023A-unified-ai-architecture.md), [ADR-019](../../06-Decision-Records/ADR-019-hybrid-identifier-strategy.md)
**Input**: ADR-047 Native Backend Legacy Ingestion & OCR Persistence

---

## 📖 Overview

ระบบการนำเข้าเอกสารประวัติเดิม (Legacy Documents) จำนวน 20,000 ฉบับ พร้อม Metadata จากไฟล์ Excel เข้าสู่ระบบ LCBP3-DMS โดยย้ายการประมวลผลจาก n8n Workflow มาเป็น **Native NestJS Backend Module (`LegacyIngestionService`)** โดยตรง เพื่อเพิ่มความเสถียร, ป้องกันปัญหา Node friction ใน n8n, จัดการ Memory อย่างมีประสิทธิภาพด้วย Streaming Reader, บันทึกข้อความ OCR 3 หน้าแรกถาวร และเปิดให้ผู้ใช้งานแก้ไข OCR Text พร้อม Sync กับ Qdrant RAG อัตโนมัติ

---

## 💡 Clarifications

### Session 2026-08-20
- **Q: ในไฟล์ Excel ที่มีหลาย Worksheet ต้องการให้ระบบเลือกอ่านข้อมูลจาก Worksheet ใด?** → **A: อ่าน Sheet แรก (First Sheet / Index 0) เป็นค่าเริ่มต้น และรองรับ parameter/option `--sheet=<name>` สำหรับระบุชื่อ Sheet เจาะจง**
- **Q: ในกรณีที่แถวของ Excel ระบุชื่อหรือรหัสหน่วยงาน (From / To) ที่ไม่มีอยู่ในตาราง `organizations` ต้องการให้ระบบจัดการอย่างไร?** → **A: Auto-match กับ `organization_code` / `organization_name` หากไม่พบ ให้ใส่ NULL และบันทึกข้อความเดิมไว้ใน `details.unresolved_orgs` เพื่อให้ Admin เลือกหน่วยงานใน Review Queue ได้โดยไม่ทำให้แถวล้มเหลว**
- **Q: เมื่อผู้ใช้กดอนุมัติเป็นชุด (Batch Approve รายการมั่นใจสูง > 0.85) ใน Review Queue ต้องการให้ระบบจัดการกระบวนการ Commit อย่างไร?** → **A: ส่งรายการที่เลือกเข้าประมวลผลใน Background Queue (BullMQ `ai-batch` / `migration-commit`) เพื่อย้ายไฟล์ PDF และบันทึกลงตารางหลัก (`correspondences`) แบบ Asynchronous ป้องกันปัญหา Web Request Timeout เมื่ออนุมัติพร้อมกันจำนวนมาก**

---

## 🎯 User Scenarios & Testing

### User Story 1 — CLI Streaming Ingestion for 20k Legacy Batch (Priority: P1)

ในฐานะ **System Administrator / DevOps Engineer**
ฉันต้องการรันคำสั่ง CLI บน Server เพื่ออ่านไฟล์ Excel ขนาดใหญ่ (20,000 แถว) และนำเข้าข้อมูลสู่ `migration_review_queue` พร้อมสร้าง Checkpoint
เพื่อให้สามารถประมวลผลเอกสารประวัติเดิมทั้งหมดได้อย่างรวดเร็ว ไม่เกิด Memory Leak (< 100MB RAM) และสามารถสั่ง Resume ต่อได้หากระบบหยุดชะงัก

**Why this priority**: เป็นหัวใจหลักในการนำเข้าเอกสารประวัติชุดใหญ่ 20,000 ฉบับให้สำเร็จอย่างปลอดภัยโดยไม่พึ่งพา External Orchestrator (n8n)

**Independent Test**:
- รันคำสั่ง `pnpm run migration:ingest -- --file=/path/to/sample-20k.xlsx --project=LCBP3-C2`
- ตรวจสอบว่า RAM ของ Node process ไม่เกิน 100MB
- ตรวจสอบว่าแถวทั้งหมดถูกบันทึกลงตาราง `migration_review_queue` พร้อมสถานะ `PENDING`
- สั่งยกเลิกกลางคัน (Ctrl+C) แล้วรันซ้ำด้วย `--resume` พบว่าทำงานต่อจากแถวเดิมโดยไม่ทำซ้ำ

**Acceptance Scenarios**:
1. **Given** ไฟล์ Excel ที่มี 20,000 แถว และโฟลเดอร์ PDF Staging
   **When** รันคำสั่ง `pnpm run migration:ingest`
   **Then** ระบบอ่านข้อมูลแบบ Stream, ตรวจสอบการมีอยู่ของไฟล์ PDF (`fs.existsSync`), บันทึกลง `migration_review_queue` และบันทึก Checkpoint ลง `migration_progress` ทุก 50 แถว
2. **Given** แถวใน Excel ที่หาไฟล์ PDF ไม่พบ หรือข้อมูลไม่สมบูรณ์
   **When** Ingestion Engine ประมวลผลแถวดังกล่าว
   **Then** ระบบบันทึกข้อผิดพลาดลงตาราง `migration_errors` และประมวลผลแถวถัดไปต่อโดยไม่หยุดชะงัก

---

### User Story 2 — Asynchronous AI Enrichment via BullMQ (Priority: P2)

ในฐานะ **Document Controller / Reviewer**
ฉันต้องการให้ระบบนำข้อมูลที่ Ingest เข้า Staging Queue ส่งเข้าประมวลผล AI เบื้องหลังผ่าน BullMQ (`ai-batch`)
เพื่อทำ OCR 3 หน้าแรก, สกัด Tags, และแนะนำประเภทเอกสาร (Category) โดยไม่ทำให้ GPU VRAM Overload

**Why this priority**: การวิเคราะห์ AI ช่วยให้การตรวจทานเอกสารใน Review Queue ทำได้รวดเร็วและแม่นยำ

**Independent Test**:
- ส่งเอกสารเข้า Staging Queue
- ตรวจสอบ BullMQ `ai-batch` Job ถูกสร้างด้วย Job Type `legacy-ai-enrichment`
- ตรวจสอบว่าผลลัพธ์ OCR Text, Tags และ AI Category ถูกอัปเดตกลับสู่ตาราง `migration_review_queue` พร้อม `ai_confidence`

**Acceptance Scenarios**:
1. **Given** เอกสารใหม่ใน `migration_review_queue`
   **When** BullMQ Worker ประมวลผล Job `legacy-ai-enrichment`
   **Then** Worker ดึง 3 หน้าแรกของ PDF ส่ง OCR Sidecar (`np-dms-ocr`) และส่งข้อความเข้า `np-dms-ai` เพื่อสกัด Metadata/Tags จากนั้นบันทึกผลลัพธ์กลับสู่ตาราง
2. **Given** งาน AI ที่ใช้เวลาเกิน Timeout (120s) หรือเกิดข้อผิดพลาด
   **When** Worker ประมวลผลไม่สำเร็จ
   **Then** สถานะของแถวถูกปรับเป็น `PENDING` (พร้อม flag `ai_failed=true`) เพื่อให้มนุษย์สามารถตรวจทานและแก้ไขเองได้

---

### User Story 3 — OCR Text Persistence, UI Editor & RAG Auto-Sync (Priority: P3)

ในฐานะ **Superadmin / Org Admin / Document Controller**
ฉันต้องการดูและแก้ไขข้อความ OCR (3 หน้าแรก) ในหน้าจอ Review Queue และเมื่อแก้ไขแล้วให้ระบบอัปเดต Vector ใน Qdrant ทันที
เพื่อให้แน่ใจว่าข้อความที่สกัดจาก OCR ถูกต้องสมบูรณ์ และพร้อมสำหรับการค้นหา RAG ที่มีประสิทธิภาพสูงสุด (ADR-042 Parity)

**Why this priority**: แก้ปัญหา OCR อ่านผิดเพี้ยนจากเอกสารเก่า และทำให้ RAG ค้นหาเอกสารได้อย่างแม่นยำ 100%

**Independent Test**:
- เปิดหน้า `/admin/migration` และเลือกดูรายละเอียดเอกสาร
- แก้ไขข้อความในช่อง "OCR Text (3 หน้าแรก)" แล้วกด "บันทึกและอัปเดต RAG"
- ตรวจสอบว่า `ocr_text` ในตารางถูกอัปเดต และ BullMQ `embed-document` ทำงานเพื่อ Upsert Vector ใหม่ลง Qdrant

**Acceptance Scenarios**:
1. **Given** รายการเอกสารใน Review Queue ที่ผ่าน AI OCR มาแล้ว
   **When** Admin เปิดดู Detail Panel
   **Then** หน้าจอแสดง Textarea ข้อความ OCR 3 หน้าแรกให้ตรวจสอบ
2. **Given** Admin แก้ไขคำผิดในข้อความ OCR แล้วกด Save
   **When** ส่ง API `PATCH /api/migration/queue/:publicId/ocr`
   **Then** ระบบอัปเดต `ocr_text` ใน DB และส่ง Re-embed เข้าสู่ Qdrant ด้วย `projectPublicId` filter ทันที

---

### User Story 4 — Web UI Upload & Ingestion Management (Priority: P4)

ในฐานะ **Org Admin / Document Controller**
ฉันต้องการอัปโหลดไฟล์ Excel ย่อยผ่านหน้าจอ Admin Console (`/admin/migration`) พร้อมเลือก Project/Contract และดู Progress Bar
เพื่อให้สามารถนำเข้าเอกสารชุดย่อยเพิ่มเติมได้ด้วยตนเองโดยไม่ต้องเข้าถึง Terminal/SSH

**Why this priority**: เพิ่มความสะดวกให้ผู้ใช้งานระดับจัดการเอกสาร (Document Controller) ใช้งานระบบได้ต่อเนื่อง

**Independent Test**:
- อัปโหลดไฟล์ `.xlsx` ขนาด 500 แถวผ่านหน้าเว็บ `/admin/migration`
- สังเกตแถบ Progress แสดงจำนวนแถวที่นำเข้าแบบ Real-time
- ตรวจสอบรายการเอกสารปรากฏในตาราง Review Queue ทันที

**Acceptance Scenarios**:
1. **Given** ผู้ใช้ที่มีสิทธิ์ `migration.import` เปิดหน้า `/admin/migration`
   **When** อัปโหลดไฟล์ Excel และกด "เริ่มการนำเข้า (Start Ingestion)"
   **Then** ระบบตอบรับ Batch ID และเริ่มอ่านข้อมูลเข้า Staging Queue เบื้องหลัง พร้อมรายงานความคืบหน้า

---

## 📋 Requirements

### Functional Requirements (FR)

- **FR-001 (Streaming Parser):** ระบบต้องใช้ `ExcelJS` Streaming Reader ในการอ่านไฟล์ Excel ทีละแถว โดยใช้หน่วยความจำไม่เกิน 100MB ตลอดกระบวนการ โดยอ่าน Sheet แรก (First Sheet / Index 0) เป็นค่าเริ่มต้น และรองรับการเลือกชื่อ Sheet ผ่าน parameter `--sheet=<name>`
- **FR-002 (Header Auto-Detection):** ระบบต้องรองรับหัวคอลัมน์ทั้งภาษาไทยและอังกฤษ (เช่น `เลขที่เอกสาร` / `Doc No`, `เรื่อง` / `Subject`, `วันที่` / `Date`, `ชื่อไฟล์` / `File Name`)
- **FR-003 (Lazy File Check):** ระบบต้องตรวจสอบการมีอยู่ของไฟล์ PDF บน Staging Disk (`fs.existsSync`) ตอน Ingest และบันทึก `source_file_path` โดยยังไม่คัดลอกไฟล์จริง
- **FR-004 (Staging Queue Insertion):** ข้อมูลทุกแถวที่ผ่านการ Validate ต้องถูกบันทึกลงตาราง `migration_review_queue` พร้อมสถานะ `PENDING`
- **FR-005 (Checkpoint & Resumability):** ระบบต้องบันทึก Checkpoint ลงตาราง `migration_progress` ทุก 50 แถว และรองรับคำสั่ง `--resume` เพื่อทำต่อจากจุดเดิม
- **FR-006 (Fault-Tolerance & Error Logging):** แถวที่พบ Error ต้องถูกบันทึกลงตาราง `migration_errors` โดยไม่ทำให้ทั้ง Batch ล้มเหลว
- **FR-007 (Auto-Revision Handling):** หากพบเลขที่เอกสารซ้ำใน Batch เดียวกัน ให้เพิ่มเลข `revisionNumber` ถัดไป (`0`, `1`, `2`...) ตามลำดับ
- **FR-008 (AI Enrichment Worker):** ระบบต้องจัดคิว BullMQ `ai-batch` (Concurrency=1) ทำ OCR 3 หน้าแรก และ LLM Tag/Category Extraction
- **FR-009 (OCR Persistence):** ข้อความ OCR 3 หน้าแรกต้องถูกบันทึกลงในคอลัมน์ `ocr_text` ของ `migration_review_queue`
- **FR-010 (OCR Editing API):** ระบบต้องมี API `PATCH /api/migration/queue/:publicId/ocr` สำหรับให้ผู้ใช้แก้ไขข้อความ OCR
- **FR-011 (RAG Auto-Sync):** เมื่อมีการแก้ไขข้อความ OCR หรือ Commit เอกสาร ระบบต้องสั่ง Re-embed ข้อความใหม่ลง Qdrant โดยมี `projectPublicId` filter เสมอ (ADR-023A)
- **FR-012 (CLI Ingestion Command):** ระบบต้องมีคำสั่ง CLI `pnpm run migration:ingest` พร้อมรองรับ parameters: `--file`, `--project`, `--contract`, `--sheet`, `--resume`
- **FR-013 (Web Upload API):** ระบบต้องมี API `POST /api/migration/ingest/upload` และ `POST /api/migration/ingest/start`
- **FR-014 (Batch Approve & Background Commit):** ระบบต้องมีปุ่ม Batch Approve รายการใน Review Queue ที่มีคะแนนความเชื่อมั่นสูง (`ai_confidence >= 0.85`) โดยส่งเข้าประมวลผลผ่าน Background Queue ใน BullMQ เพื่อย้ายไฟล์ PDF และ Commit ข้อมูลลงตารางหลักอย่างปลอดภัยโดยไม่เกิด Timeout
- **FR-015 (RBAC Enforcement):** จำกัดสิทธิ์การ Ingest, ตรวจทาน และแก้ไข OCR ให้เฉพาะ Role 1 (Superadmin), Role 2 (Org Admin), และ Role 3 (Document Controller) ผ่าน CASL Guard

---

## 🔒 Non-Functional Requirements & Security (NFR)

- **NFR-001 (Memory Efficiency):** หน่วยความจำสำหรับ Ingestion Process ต้องไม่เกิน 100MB RAM สำหรับไฟล์ Excel ขนาด 20,000 แถว
- **NFR-002 (GPU Protection):** BullMQ Worker คิว `ai-batch` ต้องจำกัด Concurrency=1 เพื่อป้องกัน GPU VRAM crash บนเครื่อง Local AI (ADR-023A)
- **NFR-003 (UUID Standard):** การอ้างอิงและเปิดเผย ID ใน API ต้องใช้ UUIDv7 (`publicId`) เท่านั้น ห้ามเปิดเผย Internal INT PK (ADR-019)
- **NFR-004 (Idempotency):** การนำเข้าข้อมูลต้องใช้ `Idempotency-Key` ป้องกันการ Insert ข้อมูลซ้ำซ้อน
- **NFR-005 (Audit Trail):** ทุกการกระทำในการแก้ไข OCR หรือ Approve/Reject ต้องบันทึก `reviewed_by` และ `reviewed_at` ลง Audit log
- **NFR-006 (Type Safety & Code Standards):** Zero `any`, Zero `console.log` (ใช้ NestJS `Logger`), คอมเมนต์ภาษาไทย และโค้ดภาษาอังกฤษ

---

## ⚠️ Edge Cases

1. **ชื่อไฟล์ PDF ไม่ตรงตาม Case หรือมี Space เกิน:**
   *การจัดการ:* ทำ Normalization ชื่อไฟล์ และค้นหาแบบ Case-insensitive ในโฟลเดอร์ Staging
2. **ไฟล์ Excel มีแถวว่างหรือรูปแบบวันที่ผิดเพี้ยน:**
   *การจัดการ:* ตรวจสอบค่าว่างและใช้ Date parser ที่รองรับทั้ง Excel Serial Number, ISO 8601 และ DD/MM/YYYY หาก Parse ไม่ได้ให้บันทึกเป็น NULL และแจ้งเตือนใน `migration_errors`
3. **การสั่ง Ingestion ซ้ำด้วยไฟล์เดิม:**
   *การจัดการ:* ตรวจสอบ `Idempotency-Key` (hash ของ batch_id + row_index + doc_number) หากมีอยู่แล้วให้ข้ามอัตโนมัติ
4. **AI Service (Ollama / Sidecar) ดับระหว่างประมวลผล:**
   *การจัดการ:* BullMQ มีระบบ Auto-Retry 3 ครั้ง หากยังไม่สำเร็จให้ Mark แถวนั้นเป็น `AI_FAILED` เพื่อให้คนตรวจเองได้โดยไม่ทำให้ Worker ค้าง
5. **หน่วยงานต้นทาง/ปลายทาง (From/To) ใน Excel ไม่ตรงกับ Master Data:**
   *การจัดการ:* ทำ Auto-match รหัส/ชื่อ หากไม่พบให้ใส่ NULL และบันทึกข้อความเดิมไว้ใน `details.unresolved_orgs` เพื่อให้ผู้ตรวจทานระบุหน่วยงานที่ถูกต้องใน Review Queue ได้สะดวก
