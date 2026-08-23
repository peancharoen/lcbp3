# ADR-047: Native Backend Legacy Ingestion & OCR Persistence

**Status:** Accepted
**Date:** 2026-08-20
**Decision Makers:** Senior Full Stack Developer, Lead Architect
**Supersedes:** `specs/03-Data-and-Storage/03-04-legacy-data-migration.md` §3 (n8n Workflow orchestration for migration)
**Amends:** `ADR-028: Migration Architecture Refactor`, `ADR-023A: Unified AI Architecture (Model Revision)`, `ADR-042: Sandbox Project & OCR Text Persistence`
**Related Documents:**
- [ADR-028: Migration Architecture Refactor](./ADR-028-migration-architecture-refactor.md)
- [ADR-042: Sandbox Project & OCR Text Persistence](./ADR-042-sandbox-project-and-ocr-text-persistence.md)
- [ADR-043: AI Architecture Current State](./ADR-043-ai-architecture-current-state.md)
- [03-04: Legacy Data Migration Plan](../03-Data-and-Storage/03-04-legacy-data-migration.md)

---

## 🎯 Gap Analysis & Purpose

### ปิด Gap จากเอกสาร:
- **03-04 legacy-data-migration.md §3 (การออกแบบ n8n Workflow):** เดิมกำหนดให้ใช้ n8n เป็นตัว Orchestrator ในการอ่านไฟล์ Excel, ตรวจสอบไฟล์ PDF บนดิสก์ และส่ง HTTP เข้าสู่ NestJS Backend
  - **ปัญหาที่พบจริง:** n8n มี friction สูงในการสร้างและดูแล Node 20-30 ตัว, เกิดปัญหา Form field mapping (`field-0`), HTTP Request bugs, Token expiry, Snapshot ใน `workflow_history` และการจัดการหน่วยความจำสำหรับเอกสาร 20,000 ฉบับทำได้ยาก
  - **การแก้ไข:** ปลดระวาง (Deprecate) การใช้ n8n ในกระบวนการ Migration แล้วย้าย Logic ทั้งหมดมาเป็น **Native NestJS Ingestion Engine (`LegacyIngestionService`)** โดยตรง
- **ADR-042 §1 (OCR Text Persistence):** เดิมกำหนดให้เก็บ `attachments.ocr_text` เฉพาะใน Production flow แต่ใน Staging Queue ของ Migration ยังไม่มีจุดแก้ไข OCR Text และ Re-embed ลง Qdrant
  - **การแก้ไข:** บันทึก `ocr_text` ลงใน `migration_review_queue` และเปิดให้ Superadmin, Org Admin, Document Controller แก้ไขข้อความ OCR ได้ผ่าน UI พร้อมระบบ Auto-Re-embed ลง Qdrant อัตโนมัติ

---

## 🏛️ Context and Problem Statement

ในการนำเข้าเอกสาร Legacy 20,000 ฉบับพร้อม Metadata จาก Excel เข้าสู่ระบบ LCBP3-DMS มีความท้าทายหลัก 4 ประการ:
1. **ความเปราะบางของ n8n ในฐานะ HTTP Relay:** n8n ถูกจำกัดตาม ADR-023A ไม่ให้เข้าถึง Database หรือ Ollama โดยตรง ทำให้ n8n ทำหน้าที่เพียงแค่อ่าน Excel แล้วยิง HTTP เข้า NestJS ซึ่งเพิ่มจุดบกพร่องโดยไม่จำเป็น
2. **การประมวลผลไฟล์ขนาดใหญ่ (Memory & Performance):** การอ่าน Excel ขนาด 20,000 แถวหากโหลดทั้งไฟล์ลง RAM จะเสี่ยงต่อ Out-Of-Memory (OOM) ต้องใช้เทคนิค Streaming (`ExcelJS.stream`)
3. **การป้องกัน GPU Overload:** การทำ OCR 3 หน้าแรกและ AI Metadata Extraction บนเครื่อง Admin Desktop (RTX 2060 SUPER 8GB) ต้องควบคุมผ่าน BullMQ คิว `ai-batch` แบบ Sequential (Concurrency=1)
4. **Human-in-the-Loop & OCR Correction:** ข้อมูล OCR จากเอกสารเก่าอาจมีข้อความผิดเพี้ยน ระบบต้องบันทึกข้อความ OCR 3 หน้าแรกไว้อย่างถาวร และเปิดให้ผู้ตรวจทานแก้ไขข้อความผ่าน UI ได้ โดยเมื่อแก้ไขแล้ว ระบบต้องส่ง Re-embed เข้า Qdrant อัตโนมัติ

---

## ⚖️ Decision Drivers

- **Zero-Friction Ingestion:** ลดความซับซ้อนของ External Orchestrator (n8n) ย้ายมาเป็น TypeScript Codebase หลัก
- **Memory Safety:** ควบคุมการใช้ RAM ให้คงที่ (< 100MB) ระหว่างอ่านไฟล์ Excel 20,000 แถว
- **Data Durability & Idempotency:** รองรับ Checkpoint (`migration_progress`), Fault-Tolerance ข้ามแถวที่ Error และรองรับการสั่ง `--resume`
- **GPU Protection:** จัดคิว AI แบบ Asynchronous ผ่าน BullMQ `ai-batch` (Concurrency=1)
- **ADR-042 Compliance:** บันทึก OCR Text ถาวร แก้ไขได้ผ่าน UI และ Re-embed ลง Qdrant ทันที

---

## 🔬 Considered Options

### Option 1: ใช้วิธีเดิม — พัฒนาและแก้ไข n8n Workflow ต่อไป
- **Pros:** มีไฟล์ JSON เดิมอยู่แล้ว
- **Cons:** ❌ ต้องคอยแก้ Bug ของ Node, Form Mapping หลุดง่าย, ขาด Type Safety, ไม่สามารถทำ Streaming ได้ดีสำหรับ 20,000 แถว, ควบคุม Transaction และ Checkpoint ได้ยาก

### Option 2: พัฒนา Native NestJS Ingestion Module + Hybrid Triggers (เลือกแนวทางนี้)
- **Pros:**
  - ✅ Type-safe 100% เชื่อมต่อกับ TypeORM Entities และ DTO Validation ได้โดยตรง
  - ✅ ใช้ `ExcelJS` Streaming Reader กินหน่วยความจำต่ำมาก (< 100MB)
  - ✅ ทำงานร่วมกับ Staging Queue (`migration_review_queue`), `import_transactions` และ `migration_errors` ที่มีอยู่แล้วได้ทันที
  - ✅ มีทั้ง CLI Command (สำหรับรัน 20k rows บน Server ปลอดภัยจาก Network timeout) และ Web UI สำหรับ Document Controller
  - ✅ รองรับ OCR Editing และ RAG ผ่าน `rag-prepare` pipeline ร่วมกับเอกสารปกติตาม ADR-042
- **Cons:** ต้องเขียนโค้ด Service ใหม่และเพิ่มหน้าต่าง Ingestion ใน Admin Console

---

## 📌 Decision Outcome

**Chosen Option:** **Option 2 — Native NestJS Ingestion Module (`LegacyIngestionService`)**

### รายละเอียดข้อกำหนดทางสถาปัตยกรรม (Core Architectural Rules)

#### D1: การอ่านไฟล์ Excel ด้วย Streaming Reader
- ใช้ `ExcelJS.stream.xlsx.WorkbookReader` อ่านไฟล์ `.xlsx` ทีละแถวแบบ Stream
- ทำ **Auto-detect Header** รองรับทั้งภาษาไทยและอังกฤษ (เช่น `เลขที่เอกสาร` / `Doc No`, `เรื่อง` / `Subject`, `วันที่` / `Date`, `ชื่อไฟล์` / `File Name`)
- ค้นหาไฟล์ PDF ใน Staging Directory แบบ Case-insensitive

#### D2: กลยุทธ์การจัดการไฟล์ PDF (Lazy Move on Commit)
- **ตอน Ingest เข้า Staging Queue:** ตรวจสอบเฉพาะการมีอยู่จริงของไฟล์บนดิสก์ (`fs.existsSync`) และบันทึก `source_file_path` ลงตาราง `migration_review_queue`
- **ตอน Approve / Commit:** จึงค่อยย้าย/คัดลอกไฟล์เข้า Permanent Storage ผ่าน `FileStorageService.importStagingFile`

#### D3: สถาปัตยกรรม 3-Stage AI Processing (BullMQ `ai-batch`)

ระบบ Migration Review Queue ใช้สถานะ lifecycle 4 ขั้นตอน:

1. **`PENDING`** — ข้อมูล Excel ถูกบันทึกลง `migration_review_queue` แล้ว คนตรวจสอบข้อมูลเบื่องต้น (Document Number, Subject, Category, Dates, Sender/Receiver, Discipline) ได้ก่อน
2. **`PENDING` + `ai_status = RUNNING`** — ผู้ใช้กด "Start Extract" หรือ "Start Extract Batch" ระบบส่ง Job `legacy-ai-enrichment` เข้าคิว BullMQ `ai-batch` (Concurrency=1) เพื่อประมวลผล OCR/AI; `status` ยังคง `PENDING` ในฐานข้อมูล แต่ `ai_status` เปลี่ยนเป็น `RUNNING` เพื่อบ่งบอกว่ากำลังประมวลผล
3. **`PENDING_REVIEW`** — BullMQ Worker เสร็จแล้ว บันทึก `ocr_text`, `ai_confidence`, `ai_suggested_category`, `ai_summary`, `extracted_tags`, `ai_issues` กลับมา คนตรวจทานข้อมูล + OCR ในหน้า `/admin/migration/review/:publicId`
4. **`IMPORTED`** — คนกด "Execute Import" ระบบสร้าง `Correspondence`, `CorrespondenceRevision`, `Attachment` (permanent), `Tags` และ `CorrespondenceRecipients` จริง

**ข้อกำหนดเพิ่มเติม:**
- ต้องมี Backend API สำหรับ Start Extract ทั้ง single (`POST /api/migration/queue/:publicId/extract`) และ batch (`POST /api/migration/extract`)
- `approveQueueItem` / `commitBatch` เปลี่ยนชื่อการทำงานภายในเป็น "Execute Import" โดยไม่ trigger OCR อีก แต่ใช้ข้อมูลที AI ประมวลผลไว้แล้ว และส่ง `rag-prepare` หลังบันทึก `Attachment` + `Revision` เสร็จ
- Execute Import อนุญาตเฉพาะเมื่อ `status = PENDING_REVIEW` (ไม่อนุญาตตอน `PENDING` หรือกำลังประมวลผล)
- ถ้าเอกสารไม่มี PDF Worker ต้องไม่ fail ให้ `ocr_text = 'ไม่มี ไฟล์ PDF (ยกเลิก/ถอน)'` และคนยังสามารถ Execute Import ได้
- `legacy-ai-enrichment` Worker ต้องอ้างอิง `queue_id` (INT ภายใน) และอัปเดต `ai_status`, `status`, `ocr_text` กลับ `migration_review_queue` โดยตรง

#### D4: การบันทึกข้อความ OCR และการ Sync กับ RAG (ADR-042 Parity)
- ข้อความ OCR 3 หน้าแรกจะถูกบันทึกลงในคอลัมน์ `ocr_text` ของ `migration_review_queue` เพื่อแก้ไขก่อน Import
- เมื่อกด "Execute Import" ระบบจะบันทึก OCR text ลง `attachments.ocr_text` และใช้เป็น fallback ของ `correspondence_revisions.body` หากไม่มี `body` จากผู้ใช้
- หลัง commit สำเร็จ ระบบจะส่ง `rag-prepare` เข้าคิว `ai-batch` ผ่าน `RagBatchService.enqueueRagPrepare` โดย:
  - `documentPublicId` = `correspondence.public_id`
  - `attachmentPublicId` = `attachments.public_id` ของไฟล์หลัก
  - `cachedOcrText` = OCR text ทีบันทึกไว้ ทำให้ `processRagPrepare` ใช้ persisted `ocr_text` โดยไม่ต้อง re-OCR
- `processRagPrepare` จะอ่าน persisted `ocr_text` จาก `attachments` ด้วย `attachmentPublicId` ก่อนเสมอ แล้ว enqueue `embed-document` ตาม pipeline ปกติ
- ในหน้าจอ Review Queue แก้ไข OCR text ได้ แต่จะไม่ trigger RAG ทันที — RAG จะทำงานหลัง Execute Import เท่านั้น

#### D5: ระบบ Checkpoint, Resumability และ Error Logging
- บันทึกตำแหน่งล่าสุดลงตาราง `migration_progress` ทุก 50 แถว
- รองรับคำสั่ง `--resume` เพื่อเริ่มทำงานต่อจากแถวที่ค้างอยู่
- แถวที่พบ Error (เช่น หา PDF ไม่พบ หรือข้อมูลไม่สมบูรณ์) จะถูกบันทึกลงตาราง `migration_errors` โดยไม่ทำให้ทั้ง Batch ล้มเหลว (Fault-Tolerant)

#### D6: Hybrid Execution Interface
- **CLI Command:** `pnpm run migration:ingest -- --file=/path/to/excel.xlsx --project=<code|uuid> [--contract=<code>] [--resume]` พร้อม Progress Bar ใน Terminal
- **Web UI:** เพิ่มปุ่ม "Upload & Ingest Legacy Documents" ในหน้า `/admin/migration` พร้อม Progress Bar และ Status Indicator

#### D7: สิทธิ์การเข้าถึง (RBAC Matrix)
- ผู้มีสิทธิ์รัน Ingest, ตรวจสอบ, แก้ไข OCR และกด Batch Approve ได้แก่:
  - `Superadmin` (Role 1, `system.manage_all`)
  - `Org Admin` (Role 2, `migration.import`, `migration.commit`, `migration.view`)
  - `Document Controller` (Role 3, `migration.import`, `migration.commit`, `migration.view`)

---

## 🔍 Impact Analysis

### Affected Components

| Component | Level | Impact Description | Required Action |
| :--- | :--- | :--- | :--- |
| **Backend Service** | 🔴 High | สร้าง Ingestion Engine และรองรับ Streaming Excel | สร้าง `LegacyIngestionService` และลงทะเบียนใน `MigrationModule` |
| **Backend AI Worker** | 🔴 High | แก้ Job Handler ใน `AiBatchProcessor` ให้รองรับ `legacy-ai-enrichment` โดยอ้างอิง `queueId` (INT) พร้อมส่ง `queuePublicId` ใน payload และอัปเดต `migration_review_queue` | อัปเดต `processLegacyAiEnrichment` ให้บันทึก OCR/AI ผลลัพธ์กลับ Queue Item |
| **Backend Controller** | 🔴 High | เพิ่ม endpoint `POST queue/:publicId/extract` และ `POST /extract` (batch) สำหรับเริ่มประมวลผล OCR/AI | อัปเดต `MigrationController` และ `MigrationService` |
| **Backend CLI** | 🟡 Medium | สร้าง CLI Script สำหรับรัน Batch ขนาดใหญ่ | สร้าง `backend/src/scripts/legacy-ingest.ts` |
| **Frontend UI** | 🔴 High | เพิ่มปุ่ม "Start Extract", "Execute Import" และ OCR Result Panel | อัปเดต `frontend/app/(admin)/admin/migration/page.tsx` และ `review/[id]/page.tsx` |
| **Database** | 🟢 Low | ยืนยันคอลัมน์ `ocr_text` ใน `migration_review_queue` และ `attachments` | ตรวจสอบ Schema ตาม ADR-042/044 |

---

## 📋 Version Dependency Matrix

| ADR | Version | Dependency Type | Status |
| :--- | :--- | :--- | :--- |
| **ADR-019** | 1.0 | Required (UUIDv7 & PublicId) | ✅ Implemented |
| **ADR-023A** | 2.0 | Required (AI Model Stack & BullMQ Concurrency=1) | ✅ Implemented |
| **ADR-028** | 1.0 | Core (Staging Queue & Review Lifecycle) | ✅ Implemented |
| **ADR-042** | 1.0 | Required (OCR Text Persistence & RAG Sync) | ✅ Implemented |
| **ADR-047** | 1.0 | Target (Native Backend Legacy Ingestion) | ✅ Implemented |

---

## 🔄 Rollback & Recovery Plan

หากจำเป็นต้องย้อนกลับ:
1. การย้อนกลับไม่มีผลกระทบต่อ Production Database เนื่องจากข้อมูลเดิมอยู่ใน `migration_review_queue`
2. สามารถรัน Ingestion ซ้ำเฉพาะไฟล์ที่ต้องการได้โดยใช้ Idempotency Key ป้องกันแถวซ้ำ
3. สามารถลบ Batch ที่ผิดพลาดได้ผ่านตาราง `migration_review_queue` ตาม `batch_id`
