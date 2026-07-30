// File: specs/200-fullstacks/241-ocr-persist-sandbox/research.md
// Change Log:
// - 2026-07-27: Phase 0 research — decisions consolidated from grill-with-docs session (ADR-042)

# Phase 0 Research: OCR Text Persistence & Sandbox Project

ทุก `NEEDS CLARIFICATION` ถูก resolve ไปแล้วก่อนเข้า speckit pipeline ผ่านรอบ `grill-with-docs` (ดู `specs/06-Decision-Records/ADR-042-sandbox-project-and-ocr-text-persistence.md`) เอกสารนี้สรุปการตัดสินใจแต่ละข้อในรูปแบบ Decision/Rationale/Alternatives ตาม speckit-plan template

## 1. ขอบเขต OCR Text Persistence

- **Decision**: เพิ่ม `attachments.ocr_text` (LONGTEXT NULL) — บันทึกเฉพาะ attachment ที่ `triggerRagPrepare()` เลือกประมวลผลอยู่แล้ว (ไฟล์ PDF แรกที่พบ หรือไฟล์แรกถ้าไม่มี PDF)
- **Rationale**: Scope แคบ ตรงกับพฤติกรรมปัจจุบันของระบบ ไม่ขยาย scope ไปแก้ปัญหา "1 attachment ต่อ revision" ที่เป็นคนละเรื่อง
- **Alternatives considered**: (a) เพิ่ม `ocr_text` ให้ทุก PDF attachment ในtransaction เดียว — ถูกปฏิเสธเพราะต้อง redesign `triggerRagPrepare()` ให้ loop + enqueue ต่อไฟล์ ซึ่งเป็น scope เพิ่มเติมที่ไม่ได้ถูกขอ

## 2. จุดที่ Persist และกลไก Retry

- **Decision**: แยก `rag-prepare` job ออกเป็น 2 jobs — (1) OCR-extract-persist เขียน `ocr_text` แล้ว enqueue ต่อ (2) `embed-document` (job type ที่มีอยู่แล้ว) รับ `extractedText` เพื่อข้าม OCR ซ้ำ
- **Rationale**: `embed-document` job type มีอยู่แล้วและรองรับ `extractedText` override (`ai-batch.processor.ts:415`) — ใช้โครงสร้างเดิมได้โดยไม่ต้องสร้าง job type ใหม่ ได้ทั้ง durability (ไม่เสีย OCR เมื่อ retry) และลด redundant GPU calls
- **Alternatives considered**: (a) Persist inline แล้วยังเรียก `embedDocument()` ตรงในฟังก์ชันเดิม (1 job) — ได้ durability แต่ retry ทั้ง job ยังต้องรัน OCR ซ้ำเสมอ เพราะ BullMQ retry คือรันทั้งฟังก์ชันใหม่

## 3. การระบุตัว Attachment สำหรับ UPDATE

- **Decision**: เพิ่ม `attachmentPublicId` ใน `RagPrepareJobPayload` ส่งมาจาก `triggerRagPrepare()` ใช้เป็น WHERE key
- **Rationale**: ตาม ADR-019 — `file_path` ไม่ unique/เสถียรพอเป็น identity key; `publicId` เป็นมาตรฐานเดียวที่ระบบใช้
- **Alternatives considered**: Lookup attachment ด้วย `file_path` ที่ persist ไว้ — ถูกปฏิเสธเพราะเสี่ยง fragile lookup

## 4. Sandbox Testing สำหรับ Production Flow

- **Decision**: เพิ่ม "Sandbox Project" (`projects.is_sandbox`) — Admin เดินโค้ด production จริง (`/files/upload`, `/correspondences`, `/correspondences/:uuid/submit`) แบบ commit DB จริง scoped ด้วย `project_id`
- **Rationale**: Mock/simulate 3-phase Production Flow เสี่ยง drift จากโค้ดจริงสูงกว่าการรันโค้ด production เป๊ะในพื้นที่แยกที่ลบทิ้งได้
- **Alternatives considered**: Mock แต่ละ phase โดยไม่ commit DB (คง invariant ADR-036 ทั้งหมด) — ถูกปฏิเสธเพราะต้อง maintain mock คู่ขนานกับโค้ดจริง เสี่ยง parity gap เมื่อโค้ด production เปลี่ยนแต่ mock ไม่ตาม — นี่คือเหตุผลที่ต้องมี ADR-042 (deviation จาก ADR-036 ที่ resolve ไว้ว่า sandbox "ไม่ commit DB")

## 5. Cleanup ข้อมูลทดสอบ

- **Decision**: `POST /ai/admin/sandbox/clear-data` — hard-delete cascading scoped `WHERE project_id = sandboxProjectId` + enqueue `enqueueVectorDeletion()` ต่อเอกสาร ไม่ตรวจสอบ job ที่ active อยู่ก่อนลบ (ตาม Clarifications session ใน `spec.md`)
- **Rationale**: Scoped by `project_id` เดียวที่ seed ไว้ตายตัว ไม่ใช่ raw DELETE บน production data — ไม่ขัด Out-of-Scope rule; การไม่บล็อกจาก active job ลดความซับซ้อนของ admin-only tool ที่ใช้ไม่บ่อย
- **Alternatives considered**: บล็อกการลบถ้ามี BullMQ job active/waiting (ต้อง query queue) — ถูกปฏิเสธเพราะเพิ่มความซับซ้อนเกินความจำเป็น

## 6. RBAC ป้องกันผู้ใช้ทั่วไปเห็น Sandbox Project

- **Decision**: `ProjectService.findAll()` filter `isSandbox = false` เป็น default เสมอ ไม่เปิดเป็น query param จากภายนอก
- **Rationale**: จุดเดียวที่ list โครงการ (`GET /projects`) — ยืนยันแล้วจาก code search ว่าไม่มี list endpoint อื่น
- **Alternatives considered**: เพิ่ม query param `includeSandbox` ให้ frontend เลือกได้ — ถูกปฏิเสธเพราะเปิดช่องให้ client ควบคุมการมองเห็นข้อมูลที่ควรถูกจำกัดฝั่ง backend เท่านั้น

## 7. Scope การประมวลผลของ triggerRagPrepare() เฉพาะ Revision ปัจจุบัน

- **Decision**: `triggerRagPrepare()` ประมวลผลเฉพาะ attachment ของ revision ปัจจุบันเท่านั้น — ไม่สแกนหรือประมวลผล attachment ของ revision ก่อนหน้า และ `ocr_text` ของ revision เก่ายังคง valid ไม่ถูกเคลียร์
- **Rationale**: การประมวลผล revision เก่าซ้ำเป็น redundant OCR call ที่สิ้นเปลือง GPU และอาจทับ `ocr_text` ของ revision เก่าโดยไม่จำเป็น — revision ใหม่มี attachment row ใหม่เป็นอิสระอยู่แล้วตาม data model
- **Alternatives considered**: สแกนทุก revision หา "PDF แรกที่พบ" โดยไม่กรอง revision — ถูกปฏิเสธเพราะเสี่ยงประมวลผลซ้ำและทับข้อมูลเก่า

## Output

ไม่มี `NEEDS CLARIFICATION` เหลืออยู่ — พร้อมเข้า Phase 1 (Design & Contracts)
