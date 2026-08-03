# Feature Specification: OCR Text Persistence & Sandbox Project (Full-Pipeline Testing)

> ⚠️ **Implementation History (superseded by ADR-043):** เอกสารนี้เป็นประวัติการ implement ของ feature ที่เกี่ยวกับ AI — สถาปัตยกรรม AI ปัจจุบันรวมอยู่ใน [ADR-043: AI Architecture Current State](../../06-Decision-Records/ADR-043-ai-architecture-current-state.md) (Single Source of Truth, 2026-08-03) ใช้เอกสารนี้เป็น audit trail เท่านั้น ห้ามใช้เป็นที่อ้างอิงสถาปัตยกรรมปัจจุบัน

**Feature Branch**: `241-ocr-persist-sandbox` (ไม่สร้าง git branch ตามคำขอของผู้ใช้)
**Created**: 2026-07-27
**Status**: Draft
**Input**: User description: "ทำ Option A (เพิ่ม attachments.ocr_text) + ปรับ AI Pipeline Step A ให้บันทึกก่อนทำ Step B, และ refactor Sandbox Flow ให้ทดสอบ Production Flow + AI Pipeline ได้ทุก step" — ยึดตาม `specs/06-Decision-Records/ADR-042-sandbox-project-and-ocr-text-persistence.md`

## Clarifications

### Session 2026-07-27

- Q: เมื่อ Superadmin กด "Clear Sandbox Data" ขณะที่มี AI batch job กำลังประมวลผลเอกสารในโครงการทดสอบอยู่ ระบบควรทำอย่างไร? → A: ดำเนินการลบต่อไปทันทีโดยไม่ตรวจสอบ job ที่กำลังรัน — enqueue vector-deletion job ก่อนลบ DB row เสมอ (idempotent); job ที่กำลังทำงานอยู่จะ fail แบบมี error log ปกติ ไม่ throw unhandled exception

## User Scenarios & Testing _(mandatory)_

### User Story 1 - OCR Text ไม่สูญหายเมื่อ Embedding ล้มเหลว (Priority: P1)

ระบบ AI Batch Worker สกัด OCR text จากไฟล์ PDF ที่แนบมากับ Correspondence แล้วต้องบันทึกผลลัพธ์ไว้ถาวรก่อนเริ่มขั้นตอน semantic chunking + embedding เพื่อไม่ให้ต้องรัน OCR ซ้ำเมื่อขั้นตอนถัดไปล้มเหลวและต้อง retry

**Why this priority**: OCR เป็นงานที่ใช้ทรัพยากร GPU/เวลาสูง การสูญเสียผลลัพธ์เมื่อ retry ทำให้สิ้นเปลืองทรัพยากรซ้ำซ้อนและหน่วงเวลาการประมวลผลเอกสารทั้งระบบ

**Independent Test**: อัปโหลดเอกสาร PDF ที่ text layer ต่ำ (ต้องใช้ OCR) → submit workflow → ตรวจสอบว่าเอกสารมี OCR text ที่บันทึกถาวรแล้ว ก่อนที่ embedding job จะเริ่มทำงาน (สามารถ verify ได้แม้ embedding job ยังไม่เสร็จ หรือถูก simulate ให้ fail)

**Acceptance Scenarios**:

1. **Given** เอกสาร PDF ที่ต้องใช้ OCR ถูก submit เข้า Workflow, **When** AI Batch Worker สกัด OCR text สำเร็จ, **Then** ระบบบันทึก OCR text ไว้ในที่จัดเก็บถาวรที่ผูกกับไฟล์แนบนั้นก่อนเริ่มขั้นตอน embedding
2. **Given** OCR text ถูกบันทึกถาวรแล้ว, **When** ขั้นตอน embedding ล้มเหลวและถูก retry, **Then** ระบบใช้ OCR text ที่บันทึกไว้แทนการรัน OCR ซ้ำ

---

### User Story 2 - Admin ทดสอบ Production Flow แบบ End-to-End โดยไม่กระทบข้อมูลจริง (Priority: P1)

Superadmin ต้องการทดสอบขั้นตอนทั้งหมดของการนำเข้าเอกสาร (อัปโหลดไฟล์ → สร้าง Correspondence → Submit Workflow → AI Pipeline ทั้ง OCR และ Embedding) โดยใช้ code path เดียวกับที่ผู้ใช้งานจริงใช้ แต่ข้อมูลทดสอบต้องไม่ปนกับข้อมูลโครงการจริง และสามารถลบทิ้งได้ในภายหลัง

**Why this priority**: เครื่องมือทดสอบเดิม (Production Pipeline Sandbox) ครอบคลุมแค่ AI Pipeline บางส่วน ไม่ครอบคลุม Production Flow ทั้งหมด ทำให้ไม่สามารถยืนยันได้ว่าทั้ง pipeline ทำงานถูกต้อง end-to-end ก่อนขึ้น production

**Independent Test**: Superadmin เข้า Admin Console → เลือก "Full Pipeline" ในหน้า Sandbox → อัปโหลดไฟล์ทดสอบ → ระบบสร้าง Correspondence จริงในโครงการทดสอบที่กำหนดไว้ → submit → เอกสารผ่าน OCR + Embedding จริง → ตรวจสอบผลลัพธ์ได้ → กด "Clear Sandbox Data" แล้วข้อมูลทดสอบทั้งหมดถูกลบ

**Acceptance Scenarios**:

1. **Given** Superadmin อยู่ในหน้า Admin Sandbox, **When** เลือกทดสอบ Full Pipeline และอัปโหลดไฟล์, **Then** ระบบสร้าง Correspondence จริงในโครงการทดสอบที่ถูกแยกไว้เฉพาะ (ไม่ปรากฏในรายการโครงการปกติ)
2. **Given** Correspondence ทดสอบถูก submit แล้ว, **When** AI Pipeline ประมวลผลเสร็จ, **Then** Superadmin เห็นผลลัพธ์ OCR text และสถานะ embedding ของเอกสารทดสอบนั้น
3. **Given** มีข้อมูลทดสอบสะสมอยู่ในโครงการทดสอบ, **When** Superadmin กด "Clear Sandbox Data", **Then** ข้อมูลทดสอบทั้งหมด (Correspondence, Attachment, Workflow, Vector) ถูกลบออกจากระบบโดยไม่กระทบโครงการจริงอื่น ๆ

---

### User Story 3 - ผู้ใช้ทั่วไปไม่เห็นโครงการทดสอบ (Priority: P2)

ผู้ใช้งานทั่วไปที่สร้าง Correspondence ในระบบต้องไม่เห็นหรือเลือกโครงการทดสอบ (Sandbox Project) เป็นตัวเลือกได้โดยไม่ตั้งใจ

**Why this priority**: ป้องกันความสับสนและการปนเปื้อนข้อมูล — ถ้าผู้ใช้ทั่วไปสร้างเอกสารจริงในโครงการทดสอบโดยไม่ตั้งใจ เอกสารนั้นจะถูกลบทิ้งเมื่อ admin กด Clear Sandbox Data

**Independent Test**: ผู้ใช้ทั่วไป (ไม่มีสิทธิ์ admin) เปิดหน้าสร้าง Correspondence → ตรวจสอบว่ารายการโครงการที่เลือกได้ไม่มีโครงการทดสอบปรากฏอยู่

**Acceptance Scenarios**:

1. **Given** ผู้ใช้ทั่วไปเปิดรายการโครงการ (ทุกจุดในระบบที่แสดงรายการโครงการ), **When** ระบบดึงรายการโครงการ, **Then** โครงการทดสอบ (Sandbox Project) ไม่ปรากฏในรายการ

---

### Edge Cases

- OCR text ที่สกัดได้สั้นเกินไป (ต่ำกว่าเกณฑ์ขั้นต่ำ) — ระบบข้ามการบันทึกและข้าม embedding เหมือนพฤติกรรมเดิม
- Correspondence มีไฟล์แนบมากกว่า 1 ไฟล์ — ระบบบันทึก OCR text ให้เฉพาะไฟล์ที่ระบบเลือกประมวลผลอยู่แล้ว (ไฟล์ PDF แรกที่พบ) ไม่ขยายไปประมวลผลไฟล์อื่นทั้งหมด (นอกขอบเขตของ feature นี้)
- Superadmin กด "Clear Sandbox Data" ขณะที่ยังมี AI Pipeline job กำลังประมวลผลเอกสารทดสอบอยู่ — ระบบดำเนินการลบทันทีโดยไม่ตรวจสอบ job ที่กำลังรัน (ไม่บล็อก); enqueue vector-deletion job ก่อนลบ DB row เสมอ; job ที่กำลังทำงานอยู่จะ fail แบบมี error log ปกติ ไม่ throw unhandled exception (resolved: ดู Clarifications)
- เมื่อ `embed-document` job หมด retry attempts (dead-letter) — ระบบต้อง: (1) คง `ocr_text` ไว้ไม่ลบ เพื่อให้ admin สามารถ retry ด้วยมือได้ภายหลัง (2) log ลง `ai_audit_logs` พร้อมระบุ `documentPublicId` และ error reason (3) ส่ง notification ไปยัง Superadmin ผ่าน BullMQ notification queue (ADR-008) และสำหรับเอกสารใน Sandbox Project ต้องแสดงสถานะ "Embedding Failed" ในหน้าทดสอบด้วย
- `triggerRagPrepare()` ประมวลผลเฉพาะ attachment ของ **revision ปัจจุบัน** เท่านั้น — ไม่สแกนหรือประมวลผล attachment ของ revision ก่อนหน้า และ `ocr_text` ของ revision เก่ายังคง valid ไม่ถูกเคลียร์
- มีผู้ใช้พยายามเรียก API สร้าง Correspondence โดยระบุ `projectPublicId` ของโครงการทดสอบตรง ๆ (ไม่ผ่าน UI) — ระบบต้องปฏิเสธด้วย `BusinessException` พร้อมแจ้ง "ไม่สามารถสร้างเอกสารในโครงการทดสอบได้" เว้นแต่ผู้ใช้มีสิทธิ์ `system.manage_all` (Superadmin)
- มีผู้ใช้พยายามเปลี่ยน `is_active` ของ Sandbox Project ผ่าน `PATCH /projects/:uuid` — ระบบต้องปฏิเสธด้วย `BusinessException` พร้อมแจ้ง "ไม่สามารถเปลี่ยนสถานะของโครงการทดสอบได้" (ป้องกันการ deactivate โดยไม่ตั้งใจที่จะทำให้การทดสอบ Full Pipeline ล้มเหลว)

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: ระบบต้องบันทึก OCR text ที่สกัดได้จากไฟล์แนบไว้ในที่จัดเก็บถาวรที่ผูกกับไฟล์แนบนั้น ก่อนเริ่มขั้นตอน semantic chunking และ embedding เสมอ
- **FR-002**: ระบบต้องใช้ OCR text ที่บันทึกไว้แล้วในการ retry ขั้นตอน embedding โดยไม่ต้องรัน OCR ซ้ำ หากขั้นตอน embedding ล้มเหลว — เมื่อขั้นตอน embedding หมด retry และกลายเป็น failed job ระบบต้องส่ง notification ไปยัง Superadmin ผ่าน BullMQ queue (ไม่ inline) และคง `ocr_text` ไว้สำหรับ manual retry
- **FR-003**: ระบบต้องมีโครงการทดสอบเฉพาะ (Sandbox Project) ที่ Superadmin สามารถสร้าง Correspondence ผ่าน code path เดียวกับ production ได้จริง (ไม่ใช่ simulation/mock)
- **FR-004**: รายการโครงการที่แสดงต่อผู้ใช้ทั่วไปทุกจุดในระบบต้องไม่รวมโครงการทดสอบ (Sandbox Project)
- **FR-005**: ระบบต้องมีความสามารถให้ Superadmin ลบข้อมูลทดสอบทั้งหมดที่ผูกกับโครงการทดสอบได้ (Correspondence, Revision, Attachment, Workflow Instance/History, และ Vector ที่เกี่ยวข้อง) โดยไม่กระทบข้อมูลโครงการอื่น — การลบข้อมูลทดสอบต้องลบไฟล์กายภาพบนดิสก์ที่ผูกกับ attachments ของ sandbox project ด้วย โดยใช้ `StorageService` เท่านั้น ลำดับการลบ: ไฟล์กายภาพก่อน → DB rows ทีหลัง ถ้าไฟล์ใดลบไม่ได้ ให้ log warning และดำเนินการต่อ (ไม่ throw)
- **FR-006**: เครื่องมือทดสอบ AI Pipeline แบบแยกส่วนที่มีอยู่เดิม (OCR-only / AI-extract / RAG-prep แบบไม่บันทึกลง DB) ต้องยังคงทำงานเหมือนเดิมทุกประการ ไม่ถูกกระทบจาก feature นี้
- **FR-007**: ระบบต้องแสดงสถานะความสำเร็จของแต่ละขั้นตอน (OCR extraction, Embedding) ของเอกสารทดสอบให้ Superadmin ตรวจสอบได้หลัง submit ผ่าน Full Pipeline test

### Key Entities _(include if feature involves data)_

- **Attachment**: ไฟล์แนบของ Correspondence — เพิ่ม attribute ใหม่สำหรับเก็บ OCR text ที่สกัดได้ ผูกกับไฟล์แนบนั้นโดยตรง
- **Project**: โครงการ — เพิ่ม attribute ระบุว่าเป็นโครงการทดสอบ (Sandbox) หรือไม่ ใช้กรองการแสดงผลในรายการโครงการปกติ
- **Correspondence / Correspondence Revision**: เอกสารที่สร้างขึ้นในโครงการทดสอบ — ต้องสามารถระบุและลบเป็นกลุ่มได้ตามโครงการ

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: เมื่อขั้นตอน embedding ล้มเหลวและถูก retry สำหรับเอกสารเดียวกัน ระบบไม่ต้องรัน OCR ซ้ำ (ยืนยันได้จาก log/audit ว่าไม่มีการเรียก OCR ครั้งที่สอง)
- **SC-002**: Superadmin สามารถทดสอบขั้นตอนทั้งหมดของการนำเข้าเอกสาร (อัปโหลด → สร้าง → submit → OCR → embedding) แบบ end-to-end ได้ภายในหน้าเดียวโดยไม่ต้องออกจาก Admin Console
- **SC-003**: ผู้ใช้ทั่วไป 100% ไม่เห็นโครงการทดสอบในรายการโครงการที่เลือกได้
- **SC-004**: การกด "Clear Sandbox Data" ลบข้อมูลทดสอบทั้งหมดที่ผูกกับโครงการทดสอบได้สำเร็จภายในการเรียก API ครั้งเดียว โดยไม่กระทบข้อมูลโครงการอื่น
- **SC-005**: เครื่องมือทดสอบ AI Pipeline แบบเดิม (3 ขั้นตอนแยกส่วน) ยังคงทำงานได้ถูกต้อง 100% หลังการเปลี่ยนแปลง (regression = 0)
