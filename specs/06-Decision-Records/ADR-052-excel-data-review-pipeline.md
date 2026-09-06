# ADR-052: 4-Layer Excel Data Review & AI Suggestion Pipeline for Correspondence Ingestion

**Status:** Accepted
**Date:** 2026-09-05
**Decision Makers:** System Architect, Senior Full Stack Developer, Document Control Lead
**Amends:** `ADR-028: Migration Architecture Refactor`, `ADR-047: Native Backend Legacy Ingestion & OCR Persistence`
**Related Documents:**
- [ADR-016: Security Architecture & Validation Rules](./ADR-016-security-architecture-and-validation-rules.md)
- [ADR-019: Hybrid Identifier Strategy (UUIDv7)](./ADR-019-hybrid-identifier-strategy.md)
- [ADR-023A: Unified AI Architecture (Model Revision)](./ADR-023A-unified-ai-architecture.md)
- [ADR-028: Migration Architecture Refactor](./ADR-028-migration-architecture-refactor.md)
- [ADR-043: AI Architecture Current State](./ADR-043-ai-architecture-current-state.md)
- [ADR-047: Native Backend Legacy Ingestion & OCR Persistence](./ADR-047-native-backend-legacy-ingestion.md)

---

## 🎯 Gap Analysis & Purpose

### ปิด Gap จากเอกสารเดิม:
1. **ADR-047 §D1 (Legacy Ingestion Engine):**
   - เดิม: `LegacyIngestionService` อ่านไฟล์ Excel แล้วยิงเข้า `migration_review_queue` ตรง ๆ โดยตรวจเพียง Header พื้นฐานและสถานะไฟล์ PDF
   - ช่องว่าง: หากข้อมูลในแถว Excel มีความผิดปกติทางความหมาย (Semantic errors เช่น ประเภทเอกสารขัดแย้งกับชื่อเรื่อง, รหัสหน่วยงานสะกดผิด, วันที่กระโดดข้ามตรรกะ) ข้อมูลขยะจะหลุดเข้าไปใน Staging Queue ทันที ทำให้ Document Controller ต้องมานั่งแก้ทีละรายการบนหน้าเว็บ 20,000 แถว
2. **Day-to-day Bulk Correspondence Import:**
   - เดิม: ระบบ DMS มุ่งเน้นการสร้าง Correspondence ทีละฉบับผ่าน Form หน้าบ้าน แต่ในทางปฏิบัติ Document Controller มักได้รับเอกสารนำเข้าเป็นชุด (Batch/Excel Register) จากผู้รับเหมาหรือที่ปรึกษา
   - ช่องว่าง: ไม่มี Gateway สำหรับตรวจสอบ Batch Excel ก่อนบันทึกเข้าตาราง `correspondences`
3. **AI Utilization for Pre-Import Review:**
   - เดิม: AI (Ollama/Claude) ถูกใช้เฉพาะหลังจากการแตกไฟล์ (OCR & Metadata extraction) จาก PDF
   - ช่องว่าง: ยังไม่มีกลไกให้ AI ตรวจสอบความถูกต้องของตาราง Excel ก่อนนำเข้า และไม่มีกลไกส่งออกไฟล์ Excel ฉบับ Annotated (ไฮไลต์สี + Cell Notes) คืนให้ผู้ใช้นำไปตรวจแก้ในโปรแกรม Excel ที่คุ้นเคย

---

## 🏛️ Context and Problem Statement

ในการนำเข้าข้อมูล Correspondence จำนวนมาก ทั้งในกรณี Legacy Migration (20,000+ ฉบับ) และการ Ingest เอกสารประจำวันผ่านไฟล์ Excel:
- **รูปแบบไฟล์:** หน้างานในไทยและวงการก่อสร้างใช้ Microsoft Excel (`.xlsx`) เป็นหลัก ไม่ใช่ CSV เพื่อรักษาการจัดรูปแบบ วันที่ภาษาไทย/สากล และการแสดงผลภาษาไทยที่ไม่เพี้ยน
- **ความซับซ้อนของข้อมูล:** ข้อมูลใน Excel มักมีข้อผิดพลาด 3 ระดับ:
  1. โครงสร้างและชนิดข้อมูลผิด (Syntax/Type) เช่น วันที่ไม่ถูกต้อง คอลัมน์ที่จำเป็นหายไป
  2. ความสัมพันธ์ทางธุรกิจขัดแย้ง (Relational Integrity) เช่น รหัสหน่วยงาน `From`/`To` ไม่มีในระบบ, เลขที่เอกสารซ้ำ, วันที่รับก่อนวันส่ง
  3. ความหมายและบริบทขัดแย้ง (Semantic Context) เช่น คอลัมน์ระบุประเภทเป็น `Letter` แต่หัวเรื่องระบุชัดเจนว่าเป็น `RFA ขออนุมัติวัสดุ`, ข้อความสะกดผิดจาก OCR เก่า
- **ประสบการณ์ผู้ใช้ (UX):** การแจ้งเตือนข้อผิดพลาดหลายร้อยแถวผ่านหน้าเว็บหรือ JSON Log ทำให้ผู้ใช้งานตรวจสอบและแก้ไขได้ยากมาก วิธีการที่ตอบโจทย์วิศวกรและ Document Controller คือ **"ให้ระบบส่งไฟล์ Excel ที่ AI ไฮไลต์จุดสงสัยพร้อมใส่ Note แนะนำกลับมาให้เปิดเช็คในเครื่อง"**

---

## ⚖️ Decision Drivers

1. **Strict AI Boundary & Security (ADR-023A):** AI ไม่มีสิทธิ์เข้าถึงฐานข้อมูลโดยตรง ไม่มีสิทธิ์เขียนหรือแก้ไขข้อมูลใน Production โดยพลการ
2. **Fail-Open Strategy:** หาก API ของ AI ภายนอกล่ม เครดิตหมด หรือ Timeout กระบวนการ Ingest ต้องไม่ตาย ด่านตรวจ Layer 1 และ Layer 2 ต้องยังคงทำงานได้อย่างสมบูรณ์
3. **Human-in-the-Loop & Familiar Tooling:** ให้ผู้ใช้เป็นผู้ตัดสินใจขั้นสุดท้าย โดยใช้เครื่องมือที่ถนัดที่สุดคือ Microsoft Excel
4. **Zero Duplicate Logic:** ตัวอ่านและแปลงค่า Excel สำหรับขั้นตอนตรวจทาน (Review) และขั้นตอนเขียนจริง (Commit) ต้องเป็น Pipeline เดียวกัน (`ExcelRowBuilder`)
5. **Format Standard:** ยึดมาตรฐาน `.xlsx` ล้วน (ไม่ใช้ CSV) จัดการด้วยไลบรารี `exceljs`

---

## 🔬 Considered Options

### Option 1: ตรวจสอบข้อมูลแบบเดิมบน Staging Queue (ADR-047 ดั้งเดิม)
- **Pros:** โค้ดมีอยู่แล้ว
- **Cons:** ❌ ผู้ใช้ต้องเปิดไล่แก้ทีละแถวบนเว็บ UI 20,000 รายการ เสียเวลาและตรวจความสัมพันธ์ข้ามแถวได้ยาก

### Option 2: 4-Layer Data Review Pipeline พร้อมส่งออก Annotated Excel (แนวทางที่เลือก)
- **Pros:**
  - ✅ กรองขยะ 3 ชั้น (Schema $\rightarrow$ Business Rules $\rightarrow$ AI Semantic) ก่อนแตะฐานข้อมูล
  - ✅ AI ทำงานแบบ Read-Only และ Fail-Open ปลอดภัย 100%
  - ✅ สร้างไฟล์ `.xlsx` ฉบับแก้ไขที่มีสีไฮไลต์และ Cell Comments ให้ดาวน์โหลดตรวจได้ทันที
  - ✅ ใช้ได้ทั้ง Legacy Migration และการ Import Correspondence ปกติ
- **Cons:** ต้องพัฒนา `ExcelDataReviewService` และ API endpoint เพิ่มเติมสำหรับ Download Annotated File

---

## 📌 Decision Outcome (Architecture Overview)

### D1: Unified Excel Ingestion Gateway (มติข้อที่ 1)
- รวมศูนย์ทางเข้าของการนำเข้าไฟล์ Excel ทั้งหมดไว้ที่จุดเดียว: `POST /api/v1/correspondence/import-review/check`
- ใช้ parameter `targetMode: 'MIGRATION_STAGING' | 'DIRECT_IMPORT'` ในการควบคุมปลายทาง:
  - `MIGRATION_STAGING`: สำหรับ Legacy Migration — เมื่อยืนยัน (Confirm) ข้อมูลจะเข้าสู่ `migration_review_queue` เพื่อรอ OCR 3 หน้าแรก และเข้าสู่ Lifecycle ตาม ADR-047
  - `DIRECT_IMPORT`: สำหรับ Routine Import ประจำวัน — เมื่อยืนยัน (Confirm) ข้อมูลจะถูกบันทึกเข้าสู่ตารางจริง `correspondences` และ `correspondence_revisions` พร้อมผูกไฟล์แนบ
- **Single Parser Principle:** ใช้ `ExcelRowBuilder` ชุดเดียวกันทั้งระบบสำหรับอ่าน แปลงค่า และตรวจสอบ เพื่อป้องกันตรรกะชุดที่สอง (Eliminate duplicate logic)

### D4: Annotated Excel Format & Re-upload Compatibility (มติข้อที่ 4)
- ไฟล์ Excel ฉบับแนะนำที่สร้างขึ้นด้วย `exceljs` จะใช้โครงสร้าง 2 Sheets:
  1. **Sheet 1 (`Review_Summary`):**
     - Dashboard สรุปตัวเลข: แถวทั้งหมด, ผ่าน (Pass), เตือน (Warn), ผิดพลาด (Block), และจำนวนแถวที่ AI มีคำแนะนำ
     - แสดงตารางรายการปัญหาสำคัญ (Key Findings) เรียงตามระดับความรุนแรง
  2. **Sheet 2 (`Data` หรือชื่อ Sheet เดิมของผู้ใช้):**
     - คงโครงสร้างคอลัมน์เดิมของผู้ใช้ไว้ 100%
     - **Cell Color Coding:**
       - แดงอ่อน (`#FCE4D6`): จุดผิดร้ายแรงระดับ `BLOCK` (เช่น เลขที่เอกสารซ้ำ, วันที่รับก่อนวันส่ง, ฟิลด์บังคับว่าง)
       - เหลืองอ่อน (`#FFF2CC`): จุดที่พบข้อสงสัยหรือคำแนะนำปรับปรุงระดับ `WARN` หรือ `AI_SUGGEST`
     - **Cell Comments / Notes:** ฝังข้อความอธิบายตรงเซลล์เป้าหมายโดยตรง พร้อมแสดง Confidence Score ของ AI
     - **Audit Columns (เพิ่ม 3 คอลัมน์ทางขวาสุด):**
       - `[AI] Suggested Subject`: เสนอคำแก้ไขหัวเรื่อง (Typo correction)
       - `[AI] Suggested Type`: เสนอประเภทเอกสารที่สอดคล้องกับเนื้อหา
       - `[AI] Review Notes`: สรุปคำแนะนำของแถวนั้น
- **Zero-Friction Re-upload Rule:** เมื่อผู้ใช้แก้ไขไฟล์แล้วส่งกลับเข้ามาตรวจซ้ำ ตัวแปลงค่า `ExcelRowBuilder` จะเพิกเฉย (Ignore) ต่อคอลัมน์ที่ขึ้นต้นด้วย `[AI]` อัตโนมัติ ทำให้ผู้ใช้ไม่ต้องเสียเวลามานั่งลบคอลัมน์ Audit ทิ้งก่อนส่งตรวจรอบใหม่

### D5: Two-Phase Stash with Re-validation & Storage Hygiene (มติข้อที่ 5)
- **Phase 1: Check & Stash (`POST .../check`):**
  - จัดเก็บไฟล์ต้นฉบับและไฟล์ Annotated ไว้ใน Private Stash Directory: `uploads/staging/import-review/<reviewSessionPublicId>/`
  - สร้าง Session Record ในฐานข้อมูล กำหนดอายุ 24 ชั่วโมง (TTL)
- **Phase 2: Confirm with Mandatory Re-validation (`POST .../confirm`):**
  - **ห้ามเชื่อผลใน Session อย่างเดียว:** เมื่อผู้ใช้สั่ง Confirm ระบบจะนำไฟล์จาก Stash มารัน Layer 1 (Schema) และ Layer 2 (Business Rules) ซ้ำอีกครั้งทันที เพื่อป้องกัน Race Condition (เช่น มีเอกสารเลขเดียวกันถูกสร้างตัดหน้าไปก่อนในระหว่างที่ผู้ใช้เปิดไฟล์ดู)
  - ต้องไม่มีข้อผิดพลาดระดับ `BLOCK` จึงจะอนุญาตให้ส่งต่อเข้าสู่กระบวนการเขียนฐานข้อมูลจริง (`LegacyIngestionService` หรือ `CorrespondenceService`)
- **Storage Hygiene:**
  - เมื่อการ Confirm สำเร็จ หรือผู้ใช้กดยกเลิก (`POST .../cancel`) ระบบต้องลบ Directory ใน Stash ทิ้งทันที
  - มี Background Scheduled Task (Cron/BullMQ) คอยกวาดล้าง Stash โฟลเดอร์ที่หมดอายุ (เกิน 24 ชั่วโมง) ทุกเที่ยงคืน เพื่อป้องกันขยะค้างสะสมบนดิสก์

### D6: Configurable Error Policy by Target Mode (มติข้อที่ 6)
- กำหนดนโยบายการจัดการข้อผิดพลาดระดับแถว (Row-level Error Policy) ตามบริบทของงาน:
  1. **กรณี `MIGRATION_STAGING` (Legacy Migration):**
     - ใช้นโยบาย **Partial Quarantine & Ingest**:
       - แถวที่ผ่านการตรวจสอบสมบูรณ์ จะถูกส่งเข้าสู่ `migration_review_queue` ทันที เพื่อไม่ให้การประมวลผล OCR และ AI สะดุด
       - แถวที่ติดสถานะ `BLOCK` จะถูกบันทึกลงในตาราง `migration_errors` พร้อม Export ออกเป็นไฟล์ `failed_rows.xlsx` ให้ผู้ดูแลระบบดาวน์โหลดไปแก้ไขเฉพาะแถวที่มีปัญหาแล้วนำกลับมา Re-import ได้ในภายหลัง
  2. **กรณี `DIRECT_IMPORT` (Routine Batch Import ประจำวัน):**
     - ใช้นโยบาย **Atomic All-or-Nothing**:
       - หากพบแถวที่ติดสถานะ `BLOCK` แม้แต่แถวเดียว ระบบจะปฏิเสธการ Commit ทั้งชุด (Database Transaction Rollback 100%)
       - ผู้ใช้ต้องนำไฟล์ Annotated Excel ไปแก้ไขจนกว่าจะไม่มีข้อผิดพลาดระดับ `BLOCK` จึงจะสามารถกดยืนยันเพื่อออกเลขและสร้าง Entity ในระบบจริงได้

### D7: RBAC & CASL Authorization Matrix (มติข้อที่ 7)
- กำหนดการควบคุมสิทธิ์ตามหลัก Least Privilege (ADR-016):
  | การกระทำ (Action) | `SUPER_ADMIN` | `ORG_ADMIN` | `DOCUMENT_CONTROLLER` | `ENGINEER` / `VIEWER` |
  |---|:---:|:---:|:---:|:---:|
  | **Upload, Check & Download Annotated Excel** | ✅ | ✅ | ✅ | ❌ |
  | **เลือกใช้ External AI (Gemini / Claude)** | ✅ | ✅ | ❌ (บังคับใช้ Local AI) | ❌ |
  | **Confirm: `DIRECT_IMPORT` (งานประจำวัน)** | ✅ | ✅ | ✅ | ❌ |
  | **Confirm: `MIGRATION_STAGING` (ย้ายระบบ)** | ✅ | ✅ | ❌ | ❌ |
  | **ยกเลิก Session และลบไฟล์ Stash** | ✅ | ✅ | ✅ (เฉพาะของตนเอง) | ❌ |

```
[ผู้ใช้อัปโหลดไฟล์ Excel (.xlsx)]
             ↓
[POST /api/v1/correspondence/import-review/check] (targetMode: MIGRATION_STAGING | DIRECT_IMPORT)
             ↓
├── Layer 1: SchemaValidator (ExcelJS)
│     - ตรวจ Header คอลัมน์หลัก, Data Types, Required Fields, Format
│     - ผลลัพธ์: Pass หรือ BLOCK ทันทีถ้าไฟล์เสียหาย
│            ↓ ผ่าน
├── Layer 2: BusinessRules (NestJS Service + DB Map)
│     - ตรวจ Duplicate Doc Number ใน correspondences & Staging
│     - ตรวจ Foreign Keys: Organization Code (From/To), Discipline, Type
│     - ตรวจ Chronology: issued_date <= received_date
│     - ตรวจการมีอยู่ของไฟล์แนบ PDF ใน Staging Directory
│     - ผลลัพธ์: Pass, WARN หรือ BLOCK
│            ↓ ผ่าน (หรือมี Warning)
├── Layer 3: AI Reviewer (Claude / LLM Gateway) — Fail-Open
│     - Semantic Analysis: Type vs Subject, Typo, Anomaly detection
│     - Generate Annotated Excel (.xlsx) ด้วย exceljs:
│         * ไฮไลต์สีเซลล์ (เหลือง = ข้อเสนอแนะ, แดง = ขัดแย้ง)
│         * แปะ Cell Note แสดงคำแนะนำของ AI และ Confidence Score
│         * เพิ่มคอลัมน์ [AI Suggestions] ท้ายตาราง
│         * เพิ่ม Sheet "AI_Summary" สรุปภาพรวม
│            ↓
└── Layer 4: Review Log & Temporary Stash
      - Stash ไฟล์ต้นฉบับ + ไฟล์ Annotated ไว้ใน Private Storage
      - บันทึก Session ลง `import_review_sessions`
             ↓
[ผู้ใช้ตรวจผลผ่าน Web Dashboard / ดาวน์โหลด Annotated Excel]
             ↓
[POST /api/v1/correspondence/import-review/confirm] (ยืนยันนำเข้า)
             ↓
[LegacyIngestionService (Staging) หรือ CorrespondenceService (Direct)] บันทึกจริง
```

### D8: Hybrid Session Storage & Audit Trail Persistence (มติข้อที่ 8)
- **Active Session ในระหว่างการตรวจทาน (Temporary State):**
  - จัดเก็บข้อมูล Metadata ของ Session ใน Redis ภายใต้คีย์ `import_review:session:<reviewSessionPublicId>` พร้อมตั้งค่า `EXPIRE 86400` (24 ชั่วโมง TTL) อัตโนมัติ
  - เก็บโครงสร้างข้อมูล: `{ reviewSessionPublicId, targetMode, uploadedBy, totalRows, passCount, warnCount, blockCount, originalFilePath, annotatedFilePath, summary }`
  - ไม่สร้างตารางชั่วคราวใน MariaDB ทำให้เป็นไปตาม **ADR-044 (Zero unnecessary schema modification)** และไม่ต้องเขียนระบบกวาดล้างข้อมูลขยะใน DB
- **Permanent Audit Trail เมื่อ Commit สำเร็จ:**
  - เมื่อผู้ใช้กดยืนยันบันทึกจริง (`confirm`) สำเร็จ ระบบจะบันทึกประวัติภาพรวมลงในตาราง **`import_transactions`** ที่มีอยู่เดิมในระบบ
  - บันทึกข้อมูล: `batch_id`, `source_type = 'EXCEL'`, `total_count`, `success_count`, `error_count`, `created_by` เพื่อรองรับการตรวจสอบย้อนหลังทางบัญชีเอกสาร (Audit Compliance)

### D9: Attachment Delivery & File Matching Strategy (มติข้อที่ 9)
- รองรับรูปแบบการส่งมอบไฟล์แนบ (Attachments) สำหรับ `DIRECT_IMPORT` ผ่าน Web UI ใน 2 รูปแบบ:
  1. **ZIP Bundle Upload (`.zip` บรรจุ `.xlsx` + โฟลเดอร์ PDFs):**
     - เหมาะสำหรับกรณีมีไฟล์ PDF ครบถ้วน ระบบจะ Unzip ใน Stash Directory ชั่วคราว และแมปชื่อไฟล์ในคอลัมน์ `File Name` กับไฟล์ใน ZIP อัตโนมัติ (รองรับ Case-insensitive filename matching)
  2. **Metadata-Only Upload (อัปโหลดเฉพาะ `.xlsx`):**
     - เหมาะสำหรับกรณีลงทะเบียนหนังสือรับ-ส่งล่วงหน้าก่อนการสแกนเอกสาร
     - หากคอลัมน์ `File Name` เป็นค่าว่าง $\rightarrow$ สร้าง Correspondence แบบไม่มี Attachment (สมบูรณ์)
     - หากคอลัมน์ `File Name` ระบุชื่อไฟล์แต่ไม่ได้แนบไฟล์มา $\rightarrow$ Layer 2 จะแจ้งเตือนระดับ `WARN` ("ระบุชื่อไฟล์แต่ไม่พบไฟล์ในระบบ") และเปิดให้ผู้ใช้เลือกได้ว่าจะยืนยันสร้างเฉพาะข้อมูลทะเบียน หรือยกเลิกเพื่อนำไฟล์มาซิปใหม่

### D10: Document Numbering & Explicit Revision Column Semantics (มติข้อที่ 10)
- กำหนดให้หัวตาราง Excel รองรับคอลัมน์ **`Revision`** (หากไม่ระบุ ให้ถือเป็นค่าเริ่มต้น `0`):
  1. **กรณีเลขเอกสาร + Revision ซ้ำกับใน DB:**
     - ติดสถานะ **`BLOCK: Revision นี้มีอยู่แล้วในระบบ`** (ห้ามเขียนทับข้อมูลเดิมเด็ดขาด เพื่อป้องกันการทำลาย Audit Trail ของเอกสารที่ผ่านการอนุมัติไปแล้ว)
  2. **กรณีเลขเอกสารตรงกับใน DB แต่ระบุ Revision ใหม่ (เช่น DB มี Rev 0 แต่ใน Excel ระบุ Rev 1):**
     - ถือเป็นการ **สร้าง Revision ใหม่ให้กับเอกสารเดิม** (สถานะ `PASS / INFO`) ระบบจะทำการผูกบันทึกใหม่นี้เข้ากับ `correspondence_id` เดิมที่มีอยู่
  3. **กรณีเลขเอกสารซ้ำกันหลายแถวภายในไฟล์ Excel เดียวกัน:**
     - หากระบุ Revision ต่างกัน (เช่น แถวที่ 5 เป็น Rev 0 และแถวที่ 6 เป็น Rev 1) $\rightarrow$ อนุญาตให้นำเข้าตามลำดับ
     - หากระบุ Revision เดียวกัน $\rightarrow$ ติดสถานะ **`BLOCK: มีเลขเอกสารและ Revision ซ้ำกันภายในไฟล์เดียวกัน`**

### D11: Organization Resolution & AI-Assisted Aliasing (มติข้อที่ 11)
- จัดการชื่อหน่วยงานต้นทาง (`From`) และปลายทาง (`To`) ที่ไม่ตรงกับฐานข้อมูล Master `organizations`:
  1. **Layer 2 (Rule Check):** ทำการเทียบกับ `organization_code` และ `organization_name` (Case-insensitive) หากไม่พบ ให้ติดสถานะ **`WARN: ไม่พบรหัสหน่วยงานในฐานข้อมูล`**
  2. **Layer 3 (AI Fuzzy Matching):**
     - AI จะนำชื่อดิบ (เช่น *"กทท."*, *"ผู้รับจ้าง Lot 1"*, *"บ.ทีม"*) เทียบกับรายชื่อ Master ในโครงการ และเสนอคู่เทียบที่ถูกต้อง เช่น `Suggested Org: "PAT" [Confidence 98%]`
     - บันทึกคำแนะนำลงใน Cell Note และคอลัมน์ `[AI] Review Notes` ของไฟล์ Annotated Excel
  3. **การบังคับใช้เมื่อ Commit:**
     - **กรณี `DIRECT_IMPORT`:** ถือเป็นฟิลด์บังคับที่ต้องเชื่อมโยงกับ Master ได้จริง หากผู้ใช้ยังไม่แก้ชื่อให้ตรงกับระบบ จะติดสถานะ `BLOCK` ไม่อนุญาตให้สร้าง Entity ใน Production เพื่อป้องกันปัญหา Data Pollution
     - **กรณี `MIGRATION_STAGING`:** อนุญาตให้ผ่านเข้า Staging Queue ได้ โดยระบบจะบันทึกข้อความดิบลงใน `raw_sender` / `raw_receiver` และเก็บรายชื่อหน่วยงานที่ยังไม่ผ่านการ Resolve ไว้ใน `unresolved_organizations` เพื่อให้ Admin สามารถทำ Bulk Mapping ย้อนหลังได้ตามกลไกของ ADR-047

### D12: Date Parsing, Chronology Guard & Buddhist Era Normalization (มติข้อที่ 12)
- ออกแบบตัวแปลงวันที่ `ExcelDateParser` เพื่อรองรับความหลากหลายของรูปแบบวันที่ในโครงการก่อสร้างไทย:
  1. **DMY Priority (วัน/เดือน/ปี):** ยึดรูปแบบมาตรฐานวิศวกรรมไทย (DD/MM/YYYY) เป็นหลักในการแปลงข้อความวันที่
  2. **พ.ศ. $\rightarrow$ ค.ศ. Auto-conversion:**
     - หากตรวจพบปี $> 2400$ ให้แปลงเป็น ค.ศ. อัตโนมัติ ($\text{ปี ค.ศ.} = \text{ปี พ.ศ.} - 543$)
     - รองรับปีย่อ 2 หลักภาษาไทย (เช่น `68` $\rightarrow$ 2568 $\rightarrow$ 2025)
     - รองรับทั้ง Native Excel Serial Number และ String formats (`DD/MM/YYYY`, `DD-MMM-YYYY`, ชื่อเดือนภาษาไทย)
  3. **Chronology & Sanity Validation (Layer 2):**
     - บังคับความสัมพันธ์ทางเวลา: `issued_date <= received_date`
     - วันที่ต้องไม่เกินเวลาปัจจุบันบวกเผื่อข้ามวัน (`date <= NOW() + 1 day`)
     - วันที่ต้องไม่เก่าเกินกว่าวันเริ่มโครงการ (`project.start_date`)
     - หากผิดตรรกะ $\rightarrow$ ติดสถานะ **`BLOCK: ลำดับวันที่ขัดแย้งเชิงตรรกะ`**
  4. **Semantic Context Cross-Check (Layer 3):**
     - AI ตรวจสอบความสอดคล้องระหว่างเนื้อความใน `Subject` กับวันที่ระบุ (เช่น ชื่อเรื่องระบุ *"งวดงานสิงหาคม 2568"* แต่วันที่ระบุเป็น *"มิถุนายน 2025"*) และติดคำเตือนใน Cell Note ให้ผู้ใช้ตรวจสอบ

### D13: Type & Discipline Semantic Classification & Human Override (มติข้อที่ 13)
- การจำแนกประเภทเอกสาร (`CorrespondenceType`) และสาขาวิศวกรรม (`Discipline`):
  1. **Layer 2 (Pattern Rules Matcher):**
     - ทำการจับคู่ Keyword เบื้องต้น (เช่น *"ขออนุมัติ"* / *"RFA"* $\rightarrow$ `RFA`, *"นำส่งแบบ"* / *"Drawing Transmittal"* $\rightarrow$ `TRANS`)
     - หากไม่ตรงกับ Master Type Code หรือ Rule เบื้องต้น จะติดสถานะ **`WARN: ประเภทเอกสารไม่สอดคล้องกับรหัสระบบ`**
  2. **Layer 3 (AI Semantic Classifier):**
     - AI วิเคราะห์ข้อมูลร่วมกันระหว่าง `Subject`, `Category`, และชื่อไฟล์ `FileName`
     - นำเสนอค่าที่ถูกต้องลงในคอลัมน์ Audit: `[AI] Suggested Type` และ `[AI] Suggested Discipline` พร้อม Confidence Score และเหตุผลใน Cell Note
  3. **Human-in-the-Loop Override Principle:**
     - **ห้าม AI แก้ไขค่าทับโดยพลการ (No Auto-Override):** เพื่อเคารพเจตนาของเจ้าหน้าที่ควบคุมเอกสาร (เช่น กรณีหนังสือมีแบบแนบ แต่ผู้ส่งตั้งใจออกเป็นจดหมายโต้แย้งข้อสัญญา ไม่ใช่ Transmittal)
     - ผู้ใช้สามารถเลือกยอมรับคำแนะนำของ AI ได้อย่างง่ายดายเพียงคัดลอกค่าจากคอลัมน์ `[AI]` มาใส่ในคอลัมน์จริงของ Excel แล้วส่งกลับเข้ามาตรวจซ้ำ หรือกดยอมรับผ่านหน้าสรุปผลก่อน Commit

### D14: Multi-Project Isolation & Project Scoping Guard (มติข้อที่ 14)
- บังคับใช้การแบ่งแยกขอบเขตโครงการ (Project Boundary) อย่างเข้มงวดตาม ADR-019 และ ADR-023:
  1. **Explicit Project Scope (UUIDv7):** การเรียก API ทุก Endpoint ของ Gateway ต้องระบุ `projectPublicId` เสมอ และผู้ใช้ต้องผ่านการตรวจสอบสิทธิ์ CASL ต่อโครงการนั้น
  2. **Single Project per File Rule:** ไฟล์ Excel หนึ่งชุด **ต้องเป็นของโครงการเดียวเท่านั้น** ห้ามมีข้อมูลหลายโครงการปะปนในไฟล์เดียวกัน หากตรวจพบจะติดสถานะ **`BLOCK: พบหลายโครงการปะปนในไฟล์เดียว`**
  3. **Cross-Check Project Column (Layer 2):**
     - หากไฟล์ Excel มีคอลัมน์ `Project Code` หรือ `Project Name` ระบบจะนำค่าไปเทียบกับ Master Project ที่ระบุใน Request ทันที
     - หากค่าไม่ตรงกัน (Mismatch) $\rightarrow$ ติดสถานะ **`BLOCK: รหัสโครงการในไฟล์ไม่ตรงกับโครงการที่เลือกทำรายการ`** เพื่อป้องกันความผิดพลาดจากการอัปโหลดไฟล์สลับสัญญา (เช่น เอาเอกสาร Lot 1 ไปใส่ใน Lot 2)

---

## 🔍 Impact Analysis

| Component | Affected Area | Required Action |
|---|---|---|
| **Backend Migration Module** | `backend/src/modules/migration/` | สร้าง `ExcelDataReviewService`, `ExcelRowBuilder`, และ Controller endpoint สำหรับ Check / Download / Confirm |
| **AI Integration** | `backend/src/modules/ai/` | เพิ่ม Adapter `GeminiReviewerAdapter` และ `ClaudeReviewerAdapter` เสริมจาก Local Ollama (`np-dms-ai`) |
| **Redis Cache** | `backend/src/modules/redis/` | จัดเก็บ Active Review Session ด้วย TTL 24 ชม. |
| **Storage / Disk** | `uploads/staging/import-review/` | จัดการ Directory เก็บไฟล์ Excel ฉบับดิบและฉบับ Annotated พร้อม Background Job ลบไฟล์ขยะ |
| **Frontend Admin UI** | `frontend/src/app/(admin)/migration/` & `correspondence/import` | เพิ่มแท็บ/หน้าจออัปโหลด Excel, แสดง Dashboard ผลตรวจ 3 ระดับ, ปุ่ม Download Annotated Excel และปุ่มยืนยัน |

---

## 📋 Summary of Architectural Consensus

| ข้อที่ | มติการตัดสินใจ | ทางเลือกที่เลือก |
|:---:|---|---|
| **D1** | Gateway Architecture | **Unified Gateway** (`targetMode: 'MIGRATION_STAGING' \| 'DIRECT_IMPORT'`) ป้องกันตรรกะซ้ำซ้อน |
| **D2** | AI Engine & Boundary | **Pluggable Multi-tier:** Local Ollama (`np-dms-ai`) Default $\rightarrow$ Gemini Free $\rightarrow$ Claude Paid (ต้องมีสิทธิ์ Admin) |
| **D3** | Batching & Performance | **Hybrid Mode:** $\le 200$ แถว Synchronous, $> 200$ แถวเลือกได้ระหว่าง Fast Selective หรือ BullMQ Batch |
| **D4** | Annotated Excel Design | **Dual-Sheet + In-place Highlights:** Sheet สรุป + Sheet ข้อมูลเดิมใส่ Cell Notes & Color + ข้ามคอลัมน์ `[AI]` ตอน Re-upload |
| **D5** | Confirmation & Stash | **Two-Phase with Re-validation:** Stash ไฟล์ 24 ชม. และตรวจซ้ำตอน Confirm เสมอเพื่อป้องกัน Race Condition |
| **D6** | Error Handling Policy | **Context-Aware:** Migration = Partial Ingest (แยกแถวเสียลง `migration_errors`), Routine = All-or-Nothing Rollback |
| **D7** | Authorization (CASL) | **Role-Separated:** Document Controller ใช้ Direct Import + Local AI, เฉพาะ Admin สั่ง Migration + External AI ได้ |
| **D8** | Session Persistence | **Hybrid:** Redis TTL 24 ชม. สำหรับ Active Session + MariaDB `import_transactions` เมื่อ Commit สำเร็จ |
| **D9** | Attachment Delivery | **Hybrid Transfer:** รองรับทั้ง `.zip` (Excel + PDFs) สำหรับชุดเอกสารสมบูรณ์ และ `.xlsx` สำหรับลงทะเบียนล่วงหน้า |
| **D10** | Revision Semantics | **Explicit Revision Column:** เลขเดิม+Rev ใหม่ = เพิ่ม Revision; เลขเดิม+Rev เดิม = BLOCK; ซ้ำในไฟล์เดียวกัน = BLOCK |
| **D11** | Organization Resolution | **AI Fuzzy Matching + Suggestion:** แนะนำ Org Code ที่ตรงใน Cell Note; Direct Import ต้องแก้ให้ตรงก่อน, Migration เข้า Staging Queue |
| **D12** | Date Parsing & B.E. | **Thai DMY Standard + B.E. Auto-convert:** แปลง พ.ศ. $\rightarrow$ ค.ศ. อัตโนมัติ ($-543$) พร้อม Chronology Guard (`issued <= received`) |
| **D13** | Type & Discipline | **Pattern Matching + AI Context:** แนะนำ Type และ Discipline ใน Cell Note โดยไม่ Auto-override (Human-in-the-Loop) |
| **D14** | Project Scoping Guard | **Single Project per File:** บังคับ 1 ไฟล์ต่อ 1 โครงการ และ Cross-check กับ `projectPublicId` ใน Request เสมอ |

---

## 📝 Implementation Status

**Status:** Implemented (Waves 1-7 complete)
**Last Updated:** 2026-09-06

### Implementation Waves

| Wave | Phase | Tasks | Status | Tests |
|:---:|---|---|:---:|:---:|
| 1-2 | Foundation (Types + Date Parser) | T001-T006 | ✅ Complete | 64/64 |
| 3 | Layer 1+2+Orchestrator+Controller | T007-T011 | ✅ Complete | +42 |
| 4 | Layer 3 AI + Annotator + Download | T012-T016 | ✅ Complete | +22 |
| 5 | Quarantine & Partial Ingest | T017-T019 | ✅ Complete | +20 |
| 6 | Two-Phase Confirmation + Stash Hygiene | T020-T024 | ✅ Complete | +9 |
| 7 | Polish & Verification | T025-T027 | ✅ Complete | +5 integration |

**Total:** 162/162 tests GREEN (157 unit + 5 integration), build + lint clean.

### Key Implementation Decisions (post-ADR)

1. **confirm() re-validation** (Wave 6 fix):
   - Re-extracts `.zip` uploads to get Excel buffer before re-validation
   - Checks global BLOCK via `computeCounts()` (layer1.findings + layer2.findings)
   - Uses `DataSource.transaction()` for atomic DB writes (FR-015)
   - Moves `failed_rows.xlsx` to permanent quarantine area before stash cleanup

2. **cancel() state transitions** (Wave 6 fix):
   - Rejects all non-READY sessions (CONFIRMED/CANCELLED/EXPIRED)

3. **listExpiredStashDirs() Redis safety** (Wave 6 fix):
   - Skips directories on Redis outage (prevents deleting active sessions)

4. **ScheduleModule** (Wave 7):
   - `CleanExpiredStashesWorker` uses `@Cron(EVERY_DAY_AT_MIDNIGHT)` from global `ScheduleModule.forRoot()`
