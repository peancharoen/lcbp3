# Session — 2026-07-30 (OCR Text Persistence & Sandbox Project — Feature 241)

## Summary

Implement Feature 241: OCR Text Persistence & Sandbox Project (ADR-042) — แยก `rag-prepare` job เป็น OCR-extract-persist + `embed-document` enqueue เพื่อไม่ให้ OCR text หายเมื่อ retry และเพิ่ม Sandbox Project สำหรับ Admin ทดสอบ Full Pipeline แบบ end-to-end พร้อม cleanup endpoint

## การเปลี่ยนแปลง (Changes)

| ไฟล์ | การเปลี่ยนแปลง |
| --- | --- |
| `specs/03-Data-and-Storage/deltas/2026-07-27-add-ocr-text-and-sandbox-project.sql` | NEW: SQL delta — ALTER attachments +ocr_text, ALTER projects +is_sandbox, INSERT sandbox project seed |
| `specs/03-Data-and-Storage/lcbp3-v1.9.0-schema-02-tables.sql` | เพิ่ม ocr_text ใน attachments, is_sandbox ใน projects |
| `backend/src/common/file-storage/entities/attachment.entity.ts` | +ocrText column (T004) |
| `backend/src/modules/project/entities/project.entity.ts` | +isSandbox column (T005) |
| `backend/src/modules/ai/ai-queue.service.ts` | +attachmentPublicId ใน RagPrepareJobPayload (T008), +enqueueEmbedDocument() method (T009) |
| `backend/src/modules/correspondence/correspondence-workflow.service.ts` | triggerRagPrepare() ส่ง attachmentPublicId (T010) |
| `backend/src/modules/ai/processors/ai-batch.processor.ts` | processRagPrepare() persist ocr_text ก่อน enqueue embed-document (T011), +AiQueueService injection |
| `backend/src/modules/ai/processors/ai-batch.processor.spec.ts` | อัปเดต rag-prepare tests สำหรับ persist-before-enqueue pattern (T006) |
| `backend/src/modules/correspondence/correspondence-workflow.service.spec.ts` | assert attachmentPublicId ใน payload (T007) |
| `backend/src/modules/ai/ai.service.ts` | +clearSandboxData() method, +FileStorageService/AiQueueService injection (T014) |
| `backend/src/modules/ai/ai.controller.ts` | +POST admin/sandbox/clear-data endpoint (T015) |
| `backend/src/modules/project/project.service.ts` | +isSandbox=false filter ใน findAll() (T020), +sandbox guard ใน update() (T020b) |
| `backend/src/modules/correspondence/correspondence.service.ts` | +sandbox project guard ใน create() (T020c) |
| `frontend/lib/services/admin-ai.service.ts` | +clearSandboxData() API call (T016) |
| `frontend/components/admin/ai/SandboxTabs.tsx` | +Full Pipeline tab, +Clear Sandbox Data button (T017-T018) |
| `docs/AI-step.md` | อัปเดต flow docs สำหรับ ADR-042 (T021) |

## กฎที่ Lock แล้ว

- **D47**: ADR-042 OCR Text Persistence — `rag-prepare` job แยกเป็น 2 jobs: (1) OCR-extract-persist เขียน `attachments.ocr_text` ก่อนเสมอ (2) `embed-document` รับ `extractedText` เพื่อข้าม OCR ซ้ำเมื่อ retry — ลด redundant GPU calls
- **D48**: Sandbox Project (`projects.is_sandbox`) — Admin-only Full Pipeline testing ผ่าน code path เดียวกับ production, scoped ด้วย `project_id`, กรองออกจาก `GET /projects` เสมอ, ไม่อนุญาตให้ผู้ใช้ทั่วไปสร้างเอกสารใน Sandbox Project
- **D49**: `clearSandboxData()` endpoint — hard-delete cascading scoped `WHERE project_id = sandboxProjectId` + enqueue vector deletion ต่อเอกสาร, ไม่ตรวจสอบ BullMQ job active ก่อนลบ (ตาม Clarifications)

## Database Changes Applied

- `attachments.ocr_text` LONGTEXT NULL — ✅ Applied to dev DB
- `projects.is_sandbox` TINYINT(1) NOT NULL DEFAULT 0 — ✅ Applied to dev DB
- Sandbox Project seed: id=7, uuid=`aaade9b1-8bcc-11f1-9b2b-1644a306cf95`, project_code=SANDBOX — ✅ Inserted

## Bug ที่พบ

- SQL delta ใช้ `public_id` แทน `uuid` (column จริงใน DB) — แก้โดยลบ `public_id` ออกจาก INSERT (uuid มี DEFAULT UUID())

## Verification

- [ ] รัน `tsc --noEmit` (backend) เพื่อยืนยันไม่มี type error
- [ ] รัน `pnpm test` (backend) เพื่อยืนยัน rag-prepare tests ผ่าน
- [ ] รัน `pnpm build` (frontend) เพื่อยืนยัน SandboxTabs.tsx compile ได้
- [ ] รัน quickstart.md ข้อ 2 — ยืนยัน OCR text ไม่หายเมื่อ retry
- [ ] รัน quickstart.md ข้อ 3 — ยืนยัน Full Pipeline ทำงาน end-to-end
- [ ] รัน quickstart.md ข้อ 4 — ยืนยัน regular user ไม่เห็น SANDBOX project
- [ ] รัน quickstart.md ข้อ 5 — ยืนยัน Production Pipeline Sandbox เดิมไม่ commit DB
