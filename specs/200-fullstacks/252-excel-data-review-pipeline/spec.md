// File: specs/200-fullstacks/252-excel-data-review-pipeline/spec.md
// Change Log:
// - 2026-09-05: Initial specification for 4-Layer Excel Data Review Pipeline (ADR-052)

# Feature Specification: 4-Layer Excel Data Review & AI Suggestion Pipeline for Correspondence Ingestion

**Feature Branch**: `feature/252-excel-data-review-pipeline`
**Created**: 2026-09-05
**Status**: Ready for Planning
**Category**: 200-fullstacks
**Input**: User description: "นำระบบด่านตรวจข้อมูล 4 ชั้นก่อนบันทึก (Data Review & Suggestion Pipeline) จาก CDMS มาปรับใช้กับ Legacy migration และการ Import ข้อมูลเข้าของ Correspondence จริงด้วย โดยใช้ Excel (.xlsx) และมี Layer 3 เป็น AI Reviewer ที่เสนอไฟล์ Excel ที่แก้แล้วให้ดาวน์โหลดไปตรวจเอง พร้อมระบบความปลอดภัยและการยืนยันตาม ADR-052"

---

## Overview

ระบบตรวจสอบและคัดกรองข้อมูลนำเข้าแบบ 4 ชั้น (Schema $\rightarrow$ Business Rules $\rightarrow$ Multi-tier AI Reviewer $\rightarrow$ Stash & Confirmation) สำหรับการนำเข้าเอกสาร Correspondence ทั้งในโหมด Legacy Migration (ย้ายระบบเอกสารเดิม 20,000 ฉบับ) และโหมด Direct Routine Import (การนำเข้าเอกสารประจำวันผ่านไฟล์ Excel/ZIP) โดยผู้ใช้จะได้รับไฟล์ Excel ฉบับ Annotated ที่มีสีไฮไลต์และ Cell Comments แนะนำจาก AI ให้ดาวน์โหลดไปตรวจสอบในโปรแกรม Excel ก่อนยืนยันการบันทึกจริงลงฐานข้อมูล

## Clarifications

### Session 2026-09-05 (ADR-052 Grilling Session)
- **Q1: Gateway Scope** $\rightarrow$ **A:** ใช้ Unified Gateway (`POST /api/v1/correspondence/import-review/check`) แยกด้วย `targetMode: 'MIGRATION_STAGING' | 'DIRECT_IMPORT'` และใช้ `ExcelRowBuilder` เดียวกัน
- **Q2: AI Engine Provider** $\rightarrow$ **A:** Pluggable Multi-tier: Local Ollama (`np-dms-ai`) เป็น Default $\rightarrow$ Google Gemini (Free tier) $\rightarrow$ Anthropic Claude (Paid tier) โดยคลาวด์ต้องใช้สิทธิ์ Admin + `ALLOW_EXTERNAL_AI_REVIEW=true` และ Fail-Open เสมอ
- **Q3: Batching Strategy** $\rightarrow$ **A:** Hybrid: $\le 200$ แถว Synchronous (5–15s), $> 200$ แถวเลือกได้ระหว่าง Fast Selective (ตรวจเฉพาะจุดเตือน + สุ่ม 5%) หรือ BullMQ Batch
- **Q4: Annotated Excel Specs** $\rightarrow$ **A:** Dual-Sheet (`Review_Summary` + `Data` ไฮไลต์สี แดง/เหลือง + Cell Notes + คอลัมน์ Audit 3 ช่องท้าย) โดยระบบเพิกเฉยต่อคอลัมน์ `[AI]` อัตโนมัติเมื่อ Re-upload
- **Q5: Stash & Confirmation** $\rightarrow$ **A:** Two-Phase Stash (24h TTL) และต้อง Re-validate ชั้น 1 & 2 ซ้ำก่อนเขียนจริงเสมอเพื่อกัน Race Condition
- **Q6: Error Handling Policy** $\rightarrow$ **A:** Migration = Partial Ingest (แยกแถวเสียลง `migration_errors` + `failed_rows.xlsx`), Routine = All-or-Nothing Atomic Rollback
- **Q7: RBAC & CASL** $\rightarrow$ **A:** Document Controller ใช้งาน Direct Import + Local AI ได้, ส่วน Migration และ External Cloud AI สงวนไว้ให้ Admin
- **Q8: Session Persistence** $\rightarrow$ **A:** Active Session เก็บใน Redis (24h TTL) โดยไม่เพิ่มตารางชั่วคราวใน MariaDB (ADR-044) และบันทึกถาวรลง `import_transactions` เมื่อ Commit สำเร็จ
- **Q9: Attachment Delivery** $\rightarrow$ **A:** รองรับทั้ง `.zip` (Excel + PDFs) สำหรับชุดเอกสารสมบูรณ์ และ `.xlsx` สำหรับกรณีลงทะเบียนล่วงหน้า
- **Q10: Revision Semantics** $\rightarrow$ **A:** มีคอลัมน์ `Revision` (เลขเดิม+Rev ใหม่ = เพิ่ม Revision ประวัติศาสตร์, เลขเดิม+Rev เดิม = BLOCK, ซ้ำในไฟล์เดียวกัน = BLOCK)
- **Q11: Organization Resolution** $\rightarrow$ **A:** AI Fuzzy Match ช่วยเดา Org Code ใน Cell Note; Direct Import บังคับต้องแก้ให้ตรงก่อน, Migration อนุญาตให้เข้า Staging Queue
- **Q12: Date Parsing & Era** $\rightarrow$ **A:** แปลง พ.ศ. $\rightarrow$ ค.ศ. อัตโนมัติ ($-543$) พร้อม Chronology Guard (`issued <= received <= NOW()+1`)
- **Q13: Type & Discipline** $\rightarrow$ **A:** กรองด้วย Rule Keyword และ AI ให้คำแนะนำใน Cell Note โดยไม่ Auto-override (Human-in-the-Loop)
- **Q14: Project Scoping** $\rightarrow$ **A:** บังคับ 1 ไฟล์ต่อ 1 โครงการ และ Cross-check รหัสโครงการในไฟล์กับ `projectPublicId` ใน Request เสมอ

---

## User Scenarios & Testing

### User Story 1 - Routine Correspondence Batch Import with Instant Review (Priority: P1)

ในฐานะ Document Controller
ฉันต้องการอัปโหลดไฟล์ Excel (.xlsx หรือ .zip ที่มี PDF) เพื่อนำเข้าเอกสารโต้ตอบหลายรายการพร้อมกัน
เพื่อให้ระบบตรวจสอบความถูกต้อง โครงสร้าง และข้อมูลขัดแย้ง พร้อมแสดงผลสรุปบนหน้าจอทันที

**Why this priority**: เป็นการทำงานหลักของเจ้าหน้าที่ประจำวัน ช่วยลดเวลาลงทะเบียนเอกสารทีละฉบับ และป้องกันข้อผิดพลาดเชิงโครงสร้างก่อนบันทึกจริง

**Independent Test**:
- อัปโหลดไฟล์ Excel ขนาด 20 แถวที่มีวันที่ทั้ง พ.ศ. และ ค.ศ.
- ระบบส่งผลตรวจสอบกลับมาภายใน 10 วินาที แสดงรายการผ่าน (Pass) และคำเตือน (Warn) อย่างถูกต้อง

**Acceptance Scenarios**:
1. **Given** ผู้ใช้เป็น Document Controller ที่เข้าสู่โครงการ LCBP3, **When** อัปโหลดไฟล์ `.xlsx` ที่มี 50 แถวในโหมด `DIRECT_IMPORT`, **Then** ระบบตรวจสอบ Layer 1 (Schema) และ Layer 2 (Business Rules) และแสดงผลสรุปบน Dashboard
2. **Given** ไฟล์ Excel มีเลขที่เอกสารตรงกับในระบบแต่เป็น Revision ใหม่ (`Rev 1`), **When** ตรวจสอบผ่าน Layer 2, **Then** ระบบอนุญาตให้ผ่านโดยระบุสถานะเป็นการสร้าง Revision ใหม่
3. **Given** มีแถวหนึ่งที่ระบุวันที่รับก่อนวันออกหนังสือ (`received_date < issued_date`), **When** ตรวจสอบผ่าน Layer 2, **Then** แถวนั้นติดสถานะ `BLOCK: ลำดับวันที่ขัดแย้งเชิงตรรกะ`

---

### User Story 2 - Download Annotated Excel with AI Suggestions (Priority: P1)

ในฐานะ Document Controller หรือ Engineer
ฉันต้องการดาวน์โหลดไฟล์ Excel ฉบับที่ AI ตกแต่งแล้ว (Annotated Excel)
เพื่อนำไปเปิดดูในโปรแกรม Microsoft Excel ในเครื่องของตนเอง และเห็นสีไฮไลต์พร้อม Cell Note แนะนำข้อแก้ไขจาก AI ได้อย่างชัดเจน

**Why this priority**: เป็นหัวใจสำคัญของ Human-in-the-Loop ที่ช่วยให้ผู้ใช้ทำงานในเครื่องมือที่คุ้นเคย ไม่ต้องเพ่งดู JSON Log หรือ Error Message บนหน้าเว็บ

**Independent Test**:
- ส่งไฟล์ Excel ที่มีคำผิดหรือระบุ Type กำกวม
- ดาวน์โหลดไฟล์ `.xlsx` ที่ระบบสร้างขึ้นมาเปิดในโปรแกรม Excel
- ตรวจพบว่า Sheet 1 คือ `Review_Summary` และ Sheet 2 มีสีไฮไลต์และ Cell Comments ตรงเซลล์เป้าหมาย

**Acceptance Scenarios**:
1. **Given** ไฟล์ Excel มีแถวที่ระบุประเภทเป็น `LTR` แต่ Subject เป็นเรื่องขออนุมัติวัสดุ (RFA), **When** ผ่าน Layer 3 AI Reviewer, **Then** เซลล์นั้นถูกเติมสีเหลืองอ่อน พร้อม Cell Note อธิบายว่าควรเปลี่ยนเป็น `RFA` (Confidence 92%)
2. **Given** มีคอลัมน์ Audit 3 ช่องเพิ่มขึ้นทางขวาสุด (`[AI] Suggested Subject`, `[AI] Suggested Type`, `[AI] Review Notes`), **When** ผู้ใช้ตรวจเสร็จและแก้ค่าในคอลัมน์จริงแล้วอัปโหลดซ้ำ, **Then** ระบบเพิกเฉยต่อคอลัมน์ `[AI]` เหล่านั้นโดยไม่ต้องสั่งให้ผู้ใช้ลบทิ้ง

---

### User Story 3 - Legacy Migration Batch Ingestion with Quarantine Error Handling (Priority: P2)

ในฐานะ System Administrator หรือ Org Admin
ฉันต้องการสั่งนำเข้าข้อมูล Legacy Migration ขนาดใหญ่ (เช่น 5,000 แถว) ในโหมด `MIGRATION_STAGING`
เพื่อให้เอกสารส่วนใหญ่ที่ถูกต้อง 99% ถูกส่งเข้า Staging Queue รอประมวลผล OCR ทันที ในขณะที่แถวที่ติดปัญหาถูกกักกัน (Quarantine) ไว้แก้ไขย้อนหลัง

**Why this priority**: ป้องกันไม่ให้โครงการย้ายระบบสะดุดจากการที่มีเอกสารเพียงไม่กี่ฉบับติด Error

**Independent Test**:
- อัปโหลดไฟล์ 1,000 แถวที่มี 5 แถวขาดไฟล์ PDF แนบ
- สั่ง Confirm ในโหมด `MIGRATION_STAGING`
- ยืนยันว่า 995 แถวถูกบันทึกลง `migration_review_queue` และ 5 แถวถูกแยกเก็บลง `migration_errors` พร้อมมีปุ่มดาวน์โหลด `failed_rows.xlsx`

**Acceptance Scenarios**:
1. **Given** ข้อมูลนำเข้าขนาด $> 200$ แถว, **When** ผู้ใช้เลือกโหมด Selective Fast Review, **Then** AI จะสแกนเฉพาะแถวที่ Layer 2 ติดสถานะ `WARN` และตัวอย่าง 5% โดยไม่ติด Rate Limit
2. **Given** การสั่ง Confirm ในโหมด `MIGRATION_STAGING`, **When** ระบบตรวจพบแถวที่ติด `BLOCK`, **Then** ระบบอนุญาตให้นำเข้าเฉพาะแถวที่ผ่าน และส่งออกไฟล์ `failed_rows.xlsx` สำหรับแถวที่ไม่ผ่าน

---

### User Story 4 - Two-Phase Confirmation with Stash Hygiene (Priority: P2)

ในฐานะ System Administrator
ฉันต้องการให้การบันทึกจริงต้องผ่านการ Re-validate ซ้ำ และมีการล้างไฟล์ชั่วคราวเมื่อเสร็จสิ้น
เพื่อป้องกัน Race Condition และป้องกันไม่ให้ฮาร์ดดิสก์เซิร์ฟเวอร์เต็มจากไฟล์ที่อัปโหลดค้าง

**Why this priority**: คุ้มครองความถูกต้องของฐานข้อมูล (Data Integrity) และเสถียรภาพของเซิร์ฟเวอร์ (Storage Hygiene)

**Independent Test**:
- อัปโหลดไฟล์และทิ้งไว้โดยไม่กด Confirm เป็นเวลา 24 ชั่วโมง
- ระบบ Redis TTL ลบ Session และ BullMQ Cron ลบไฟล์ Stash อัตโนมัติ

**Acceptance Scenarios**:
1. **Given** ผู้ใช้ได้รับ Token `reviewSessionPublicId`, **When** กด `POST .../confirm`, **Then** ระบบนำไฟล์ Stash มารัน Layer 1 & 2 ซ้ำก่อนเขียนจริง หากมีเอกสารเลขซ้ำถูกสร้างตัดหน้าไปก่อน ระบบจะปฏิเสธการ Commit
2. **Given** การ Confirm เสร็จสิ้นสมบูรณ์, **When** กระบวนการเขียน DB จบลง, **Then** โฟลเดอร์ Stash ใน `uploads/staging/import-review/<sessionId>/` จะถูกลบทิ้งทันที และบันทึกประวัติลง `import_transactions`

---

### Edge Cases

1. **กรณีอัปโหลดไฟล์สลับโครงการ (Project Mismatch):** หากในไฟล์ระบุ Project Code เป็น `LCBP3-LOT1` แต่ผู้ใช้เลือกทำรายการใน `LCBP3-LOT2` $\rightarrow$ Layer 2 จะสั่ง `BLOCK` ทันที ป้องกันข้อมูลปนเปื้อนข้ามโครงการ (D14)
2. **กรณีวันที่เป็นปี พ.ศ. 2 หลัก (เช่น 68):** ระบบต้องตีความเป็น พ.ศ. 2568 $\rightarrow$ ค.ศ. 2025 โดยอัตโนมัติ (D12)
3. **กรณี AI Gateway ภายนอกล่มหรือไม่มี API Key:** ระบบต้อง Fail-Open ทันที โดยข้าม Layer 3 ไปยัง Layer 4 พร้อมข้อความแจ้งเตือนว่า *"AI Review unavailable"* และยังคงให้ผู้ใช้ตรวจสอบผลจาก Layer 1 และ Layer 2 เพื่อยืนยันนำเข้าได้ตามปกติ (D2)
4. **กรณีส่งเฉพาะไฟล์ `.xlsx` โดยไม่มี `.zip`:** หากในคอลัมน์ `File Name` เว้นว่างไว้ $\rightarrow$ ถือเป็นการลงทะเบียนหนังสือรับ-ส่งล่วงหน้าแบบไม่มีไฟล์แนบ (ผ่านฉลุย); แต่หากระบุชื่อไฟล์แต่ไม่ได้ส่งไฟล์มา $\rightarrow$ Layer 2 จะแจ้ง `WARN` ให้ผู้ใช้ทราบ (D9)
5. **กรณีการยกเลิก Session (`POST .../cancel`):** ลบไฟล์ Stash และล้างคีย์ใน Redis ทันที ไม่ทิ้งขยะค้างไว้

---

## Requirements

### Functional Requirements

- **FR-001**: ระบบต้องมี Unified Excel Ingestion Gateway รองรับ Endpoint `POST /api/v1/correspondence/import-review/check` โดยรับพารามิเตอร์ `projectPublicId` และ `targetMode` (`MIGRATION_STAGING` หรือ `DIRECT_IMPORT`) (D1, D14)
- **FR-002**: ระบบต้องใช้ตัวแปลงค่า `ExcelRowBuilder` เดียวกันทั้งในขั้นตอนการตรวจทาน (Check) และการบันทึกจริง (Commit) เพื่อป้องกันความคลาดเคลื่อนของตรรกะ (D1)
- **FR-003**: ระบบต้องมี Layer 1 (Schema Validator) ตรวจสอบ Header ภาษาไทย/อังกฤษ, ชนิดข้อมูลเซลล์, และความยาวข้อความไม่เกินข้อกำหนดของฐานข้อมูล
- **FR-004**: ระบบต้องรองรับการแปลงวันที่แบบ Thai DMY Standard พร้อมแปลงปี พ.ศ. เป็น ค.ศ. อัตโนมัติ (หัก 543 เมื่อปี $> 2400$) (D12)
- **FR-005**: ระบบต้องมี Chronology Guard ใน Layer 2 บังคับกฎ `issued_date <= received_date <= NOW() + 1 day` หากขัดแย้งต้องติดสถานะ `BLOCK` (D12)
- **FR-006**: ระบบต้องตรวจสอบความสัมพันธ์ของหน่วยงาน (`From` / `To`) กับฐานข้อมูล Master `organizations` หากไม่ตรงต้องแจ้ง `WARN` และส่งให้ AI ช่วย Fuzzy Match (D11)
- **FR-007**: ระบบต้องรองรับคอลัมน์ `Revision` ใน Excel หากพบเลขที่เอกสารเดิมแต่ Revision ใหม่ ให้ถือเป็นการเพิ่ม Revision ใหม่ลงใน Correspondence เดิม (D10)
- **FR-008**: ระบบต้องมี Multi-tier AI Reviewer ใน Layer 3 โดยใช้ Local LLM (`np-dms-ai`) เป็นค่าเริ่มต้น พร้อม Adapter รองรับ Google Gemini API และ Anthropic Claude API ภายใต้การควบคุมสิทธิ์ Admin และ `ALLOW_EXTERNAL_AI_REVIEW=true` (D2)
- **FR-009**: ระบบต้องปฏิบัติตามหลัก Fail-Open ใน Layer 3 เสมอ หาก AI ขัดข้อง ต้องไม่ขัดขวางกระบวนการนำเข้า (D2)
- **FR-010**: ระบบต้องสร้างไฟล์ Annotated Excel (`.xlsx`) ประกอบด้วย 2 Sheets (`Review_Summary` และ `Data`) พร้อมไฮไลต์สีเซลล์ แปะ Cell Comments และเพิ่ม 3 คอลัมน์ Audit ทางขวาสุด (D4)
- **FR-011**: ระบบต้องเพิกเฉยต่อคอลัมน์ที่ขึ้นต้นด้วย `[AI]` อัตโนมัติเมื่อผู้ใช้ส่งไฟล์ที่แก้ไขแล้วกลับเข้ามาตรวจซ้ำ (D4)
- **FR-012**: ระบบต้องจัดเก็บ Active Session ชั่วคราวใน Redis ด้วย TTL 24 ชั่วโมง โดยไม่สร้างตารางขยะใน MariaDB ตาม ADR-044 (D8)
- **FR-013**: ระบบต้องมี Endpoint `GET /api/v1/correspondence/import-review/:sessionId/download-annotated` เพื่อให้ดาวน์โหลดไฟล์ Excel ฉบับแนะนำ (D4)
- **FR-014**: ระบบต้องบังคับ Re-validation ชั้น 1 และ 2 ซ้ำอีกครั้งเมื่อผู้ใช้เรียก `POST /api/v1/correspondence/import-review/confirm` เพื่อป้องกัน Race Condition ก่อนเขียนจริง (D5)
- **FR-015**: ระบบต้องจัดการข้อผิดพลาดตาม Target Mode โดย `DIRECT_IMPORT` ใช้ Atomic All-or-Nothing (Rollback 100% หากพบ BLOCK) ส่วน `MIGRATION_STAGING` ใช้ Partial Quarantine (กักกันแถวเสียลง `migration_errors` และสร้าง `failed_rows.xlsx`) (D6)
- **FR-016**: ระบบต้องลบไฟล์ใน Stash Directory และล้างคีย์ใน Redis ทันทีเมื่อการ Confirm หรือ Cancel เสร็จสิ้น (D5)
- **FR-017**: ระบบต้องบันทึกประวัติการนำเข้าที่สำเร็จลงในตาราง `import_transactions` เพื่อเป็น Audit Trail ถาวร (D8)
- **FR-018**: ระบบต้องบังคับการตรวจสอบสิทธิ์ CASL ตามตาราง Role Matrix โดยจำกัดการสั่ง Migration และการเปิดใช้ External AI ไว้เฉพาะกลุ่ม Admin เท่านั้น (D7)

---

### Key Entities

- **ReviewSession (Redis Entity):**
  - `reviewSessionPublicId`: UUIDv7 String
  - `projectPublicId`: UUIDv7 String ของโครงการ
  - `targetMode`: `'MIGRATION_STAGING' | 'DIRECT_IMPORT'`
  - `uploadedBy`: User Public ID
  - `totalRows`, `passCount`, `warnCount`, `blockCount`: Integer สถิติการตรวจ
  - `originalFilePath`: Path ไฟล์ดิบใน Stash
  - `annotatedFilePath`: Path ไฟล์ที่ AI ตกแต่งแล้วใน Stash
  - `createdAt`, `expiresAt`: วันที่สร้างและวันหมดอายุ (24 ชม.)
- **ReviewFinding:**
  - `row`: หมายเลขบรรทัดใน Excel (1-based)
  - `column`: ชื่อหัวคอลัมน์หรือตัวอักษรคอลัมน์
  - `level`: `'BLOCK' | 'WARN' | 'AI_SUGGEST'`
  - `message`: ข้อความอธิบายปัญหาภาษาไทย
  - `suggestedValue`: ค่าที่ระบบหรือ AI แนะนำ (ถ้ามี)
- **ImportTransaction (MariaDB Entity — มีอยู่เดิม):**
  - บันทึก Audit Log ถาวรเมื่อกด Confirm สำเร็จ

---

## Success Criteria

### Measurable Outcomes

- **SC-001**: ระบบสามารถตรวจสอบไฟล์ Excel ขนาด 200 แถว (Layer 1 + Layer 2) ได้เสร็จสิ้นภายในเวลาไม่เกิน 1.5 วินาที
- **SC-002**: ระบบสามารถสร้างไฟล์ Annotated Excel พร้อมสีและ Cell Notes ส่งกลับให้ผู้ใช้ดาวน์โหลดได้ภายใน 10 วินาทีสำหรับ Batch ขนาด $\le 200$ แถว
- **SC-003**: ความแม่นยำในการแปลงวันที่ พ.ศ. เป็น ค.ศ. ถูกต้อง 100% ในชุดทดสอบ
- **SC-004**: ลดข้อผิดพลาดการนำเข้าข้อมูลที่ไม่สอดคล้องกับ Master Data (เช่น Organization, Doc Type) ใน Production ลงได้มากกว่า 95%
- **SC-005**: ไม่พบไฟล์ Stash หรือ Redis Session ตกค้างเกิน 24 ชั่วโมงในระบบจัดเก็บข้อมูล (100% Cleanup Guarantee)
