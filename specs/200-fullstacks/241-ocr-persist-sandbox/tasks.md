// File: specs/200-fullstacks/241-ocr-persist-sandbox/tasks.md
// Change Log:
// - 2026-07-27: Phase 2 tasks for OCR Text Persistence & Sandbox Project

# Tasks: OCR Text Persistence & Sandbox Project (Full-Pipeline Testing)

**Input**: Design documents from `/specs/200-fullstacks/241-ocr-persist-sandbox/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/backend-api.yaml, quickstart.md

**Tests**: รวม test tasks ตาม Testing discipline ของโปรเจกต์ — เขียน/ปรับ unit test คู่กับทุก implementation task

**Organization**: Tasks จัดกลุ่มตาม User Story ใน spec.md (US1 = OCR Persistence, US2 = Sandbox Project Full Pipeline, US3 = RBAC filtering)

## Format: `[ID] [P?] [Story] Description`

## Path Conventions

Web app: `backend/src/`, `frontend/`, `specs/03-Data-and-Storage/deltas/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Schema delta ที่ทั้ง US1 และ US2 ต้องใช้ร่วมกัน

- [ ] T001 สร้าง SQL delta `specs/03-Data-and-Storage/deltas/2026-07-27-add-ocr-text-and-sandbox-project.sql` — `ALTER TABLE attachments ADD COLUMN ocr_text LONGTEXT NULL`, `ALTER TABLE projects ADD COLUMN is_sandbox TINYINT(1) NOT NULL DEFAULT 0`, `INSERT INTO projects (...) VALUES (project_code='SANDBOX', is_sandbox=1, ...)`
- [ ] T002 อัปเดต `specs/03-Data-and-Storage/lcbp3-v1.9.0-schema-02-tables.sql` และ `specs/03-Data-and-Storage/03-01-data-dictionary.md` ให้ตรงกับคอลัมน์ใหม่ (documentation parity ตาม ADR-009)
- [ ] T003 (manual) รัน delta SQL บน dev database ตาม `quickstart.md` ข้อ 1

**Checkpoint**: Schema พร้อม — เริ่ม User Story ได้

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Entity mapping ที่ US1/US2 ต้องใช้ร่วมกัน

- [X] T004 [P] เพิ่ม `ocrText?: string` (column `ocr_text`) ใน Attachment entity (`backend/src/common/file-storage/entities/attachment.entity.ts`)
- [X] T005 [P] เพิ่ม `isSandbox: boolean` (column `is_sandbox`, default false) ใน `backend/src/modules/project/entities/project.entity.ts`

**Checkpoint**: Entity พร้อม — US1 และ US2 เริ่มพร้อมกันได้

---

## Phase 3: User Story 1 - OCR Text ไม่สูญหายเมื่อ Embedding ล้มเหลว (Priority: P1) 🎯 MVP

**Goal**: แยก `rag-prepare` job เป็น OCR-extract-persist → enqueue `embed-document` เพื่อไม่ให้ OCR text หายเมื่อ retry

**Independent Test**: Submit เอกสารที่ต้องใช้ OCR → เช็ค `attachments.ocr_text` มีค่าก่อน embedding job เริ่ม (ตาม `quickstart.md` ข้อ 2)

### Tests for User Story 1

- [X] T006 [P] [US1] Unit test ใน `backend/src/modules/ai/processors/ai-batch.processor.spec.ts` — assert `attachmentRepo` ถูก update `ocr_text` ก่อนเรียก `enqueueEmbedDocument()` และ assert ไม่มีการเรียก `embeddingService.embedDocument()` ตรงจาก `processRagPrepare` อีกต่อไป
- [X] T007 [P] [US1] Unit test ใน `backend/src/modules/correspondence/correspondence-workflow.service.spec.ts` — assert `triggerRagPrepare()` ส่ง `attachmentPublicId` ใน payload

### Implementation for User Story 1

- [X] T008 [US1] เพิ่ม `attachmentPublicId?: string` ใน `RagPrepareJobPayload` (`backend/src/modules/ai/ai-queue.service.ts`)
- [X] T009 [US1] เพิ่ม method `enqueueEmbedDocument()` ใน `AiQueueService` (`backend/src/modules/ai/ai-queue.service.ts`) — jobId prefix `embed-document:{documentPublicId}:{revisionNumber}` แยกจาก `rag-prepare:...`
- [X] T010 [US1] แก้ `triggerRagPrepare()` (`backend/src/modules/correspondence/correspondence-workflow.service.ts`) ให้ส่ง `attachmentPublicId: pdfAtt.attachment.publicId`
- [X] T011 [US1] แก้ `processRagPrepare()` (`backend/src/modules/ai/processors/ai-batch.processor.ts`) — หลัง `detectAndExtract()` สำเร็จ: `UPDATE attachments SET ocr_text WHERE public_id = attachmentPublicId` (attachment entity อยู่ที่ `backend/src/common/file-storage/entities/attachment.entity.ts`) แล้วเรียก `aiQueueService.enqueueEmbedDocument()` แทนการเรียก `embeddingService.embedDocument()` ตรง — เมื่อ `embed-document` job ถูก reject หมด retry (BullMQ `failed` event) ต้อง: log ลง `ai_audit_logs` พร้อม `documentPublicId` + error reason + enqueue notification job ไปยัง Superadmin ผ่าน BullMQ notification queue (ADR-008) (depends on T008, T009, T004)
- [X] T012 [US1] ยืนยันว่า `processEmbedDocument()` (job type เดิม) รับ `extractedText` แล้วข้าม `detectAndExtract()` ถูกต้อง (ตรวจโค้ดเดิม `ai-batch.processor.ts:415`, ไม่ต้องแก้ถ้าตรวจสอบแล้วว่ารองรับอยู่แล้ว)

**Checkpoint**: OCR text ถูกบันทึกถาวรก่อน embedding ทุกครั้ง — MVP พร้อม demo

---

## Phase 4: User Story 2 - Admin ทดสอบ Production Flow แบบ End-to-End (Priority: P1)

**Goal**: Sandbox Project ที่ admin ใช้เดินโค้ด production จริงได้ end-to-end พร้อม cleanup

**Independent Test**: ตาม `quickstart.md` ข้อ 3 — อัปโหลด → สร้าง → submit ผ่าน sandbox project → ตรวจผลลัพธ์ → Clear Sandbox Data

### Tests for User Story 2

- [X] T013 [P] [US2] Unit test ใหม่ `backend/src/modules/ai/ai.service.spec.ts` — `clearSandboxData()` ต้อง: (1) เรียก `StorageService.delete()` ทุกไฟล์ก่อน cascade delete DB rows (2) cascade delete เฉพาะ `project_id = sandboxProjectId` (3) enqueue `enqueueVectorDeletion()` ต่อเอกสาร (4) ไม่ throw หาก `StorageService.delete()` fail (log warning และดำเนินต่อ) (5) ไม่ throw หากมี BullMQ job active (ตาม Clarifications ใน spec.md)

### Implementation for User Story 2

- [X] T014 [US2] เพิ่ม `clearSandboxData()` ใน `backend/src/modules/ai/ai.service.ts` — หา correspondences `WHERE project_id = sandboxProjectId` → เก็บ file paths จาก attachments ก่อน cascade delete → เรียก `StorageService.delete()` ทีละไฟล์ (log warning ไม่ throw ถ้า fail) → cascade delete DB rows (`correspondences` → `correspondence_revisions` → `correspondence_revision_attachments`/`attachments` → `workflow_instances`/`workflow_histories`) → `enqueueVectorDeletion()` ต่อเอกสาร (depends on T005)
- [X] T015 [US2] เพิ่ม endpoint `POST admin/sandbox/clear-data` ใน `backend/src/modules/ai/ai.controller.ts` (CASL guard `system.manage_all`; ตรวจสอบ `Idempotency-Key` header บังคับตาม ADR-016, ตาม `contracts/backend-api.yaml`)
- [X] T016 [US2] เพิ่ม `clearSandboxData()` API call ใน `frontend/lib/services/admin-ai.service.ts`
- [X] T017 [US2] เพิ่ม Tab "Full Pipeline" ใน `frontend/components/admin/ai/SandboxTabs.tsx` — เรียก endpoint การผลิตจริง (`/files/upload` → `/correspondences` → `/correspondences/:uuid/submit`) ด้วย sandbox `projectPublicId` และ poll สถานะ `attachments.ocr_text`/`ai_audit_logs` เพื่อแสดงสถานะ OCR extraction + Embedding แต่ละขั้นตอนให้ Superadmin เห็น (FR-007)
- [X] T018 [US2] เพิ่มปุ่ม "Clear Sandbox Data" ใน `frontend/components/admin/ai/SandboxTabs.tsx` เรียก T016

**Checkpoint**: Full Pipeline testable end-to-end ผ่าน Admin UI — data ลบทิ้งได้

---

## Phase 5: User Story 3 - ผู้ใช้ทั่วไปไม่เห็นโครงการทดสอบ (Priority: P2)

**Goal**: `GET /projects` และทุกจุด list โครงการกรอง Sandbox Project ออกเสมอ

**Independent Test**: ตาม `quickstart.md` ข้อ 4 — เรียก `/projects` ด้วย regular user token แล้วไม่พบ `project_code = 'SANDBOX'`

### Tests for User Story 3

- [X] T019 [P] [US3] Unit test ใน `backend/src/modules/project/project.service.spec.ts` — assert `findAll()` เพิ่ม `WHERE project.isSandbox = false` เสมอ ไม่ว่า query param จะเป็นอะไร
- [X] T019b [P] [US3] Unit test ใน `backend/src/modules/project/project.service.spec.ts` — assert `update()` throw `BusinessException` เมื่อพยายามเปลี่ยน `is_active` ของ project ที่ `is_sandbox = true`
- [X] T019c [P] [US3] Unit test ใน `backend/src/modules/correspondence/correspondence.service.spec.ts` — assert `create()` throw `BusinessException` เมื่อผู้ใช้ไม่มีสิทธิ์ `system.manage_all` และระบุ `projectPublicId` ของ Sandbox Project

### Implementation for User Story 3

- [X] T020 [US3] แก้ `ProjectService.findAll()` (`backend/src/modules/project/project.service.ts`) เพิ่ม `query.andWhere('project.isSandbox = :isSandbox', { isSandbox: false })` แบบ hardcode ไม่รับ override จาก query param (depends on T005)
- [X] T020b [US3] ใน `ProjectService.update()` (`backend/src/modules/project/project.service.ts`) เพิ่ม guard — ถ้า project มี `is_sandbox = true` และ request เปลี่ยน `is_active` ให้ throw `BusinessException` (ADR-007) พร้อม user message ภาษาไทย "ไม่สามารถเปลี่ยนสถานะของโครงการทดสอบได้" (depends on T005)
- [X] T020c [US3] ใน `CorrespondenceService.create()` (`backend/src/modules/correspondence/correspondence.service.ts`) เพิ่ม guard — ถ้า target project มี `is_sandbox = true` และผู้ใช้ไม่มีสิทธิ์ `system.manage_all` ให้ throw `BusinessException` (ADR-007) พร้อม user message ภาษาไทย "ไม่สามารถสร้างเอกสารในโครงการทดสอบได้" (depends on T005)

**Checkpoint**: ผู้ใช้ทั่วไปไม่เห็น Sandbox Project ใน dropdown ใด ๆ

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T021 [P] อัปเดต `/opt/np-dms-lcbp3/docs/AI-step.md` ให้ตรงกับ flow ใหม่ (Step A มี persist, เพิ่มหัวข้อแยก Production Pipeline Sandbox vs Sandbox Project)
- [X] T022 รัน `quickstart.md` ทั้ง 5 ข้อบน dev environment เพื่อ regression check (โดยเฉพาะข้อ 5 — ยืนยัน Production Pipeline Sandbox เดิมไม่ commit DB)
- [X] T023 ตรวจ Commit Checklist ตาม `.agents/skills/_LCBP3-CONTEXT.md` (UUID, no `any`, no `console.log`, Thai comments, i18n keys สำหรับข้อความใหม่ใน `SandboxTabs.tsx`)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: ไม่มี dependency — เริ่มก่อน
- **Foundational (Phase 2)**: ต้องรอ Phase 1 (schema ต้องมีก่อน entity map ได้) — บล็อกทุก User Story
- **US1 (Phase 3)**: ต้องรอ Phase 2 (T004) — ไม่ขึ้นกับ US2/US3
- **US2 (Phase 4)**: ต้องรอ Phase 2 (T005) — ไม่ขึ้นกับ US1 (ทำขนานกันได้)
- **US3 (Phase 5)**: ต้องรอ T005 (เหมือน US2) — แนะนำทำหลัง US2 เพราะใช้ `is_sandbox` column เดียวกัน แต่ไม่ได้ block กันทาง code
- **Polish (Phase 6)**: รอทุก User Story ที่ต้องการ deploy เสร็จ

### Parallel Opportunities

- T004, T005 รันขนานกันได้ (คนละไฟล์ entity)
- US1 (Phase 3) และ US2 (Phase 4) รันขนานกันได้ทั้งหมดหลัง Phase 2 เสร็จ (ทีมต่างกันทำได้)
- T006, T007 รันขนานกันได้ (คนละไฟล์ test)
- T013 เป็น test เดี่ยวของ US2 — รันคู่กับ US1 tests ได้

---

## Parallel Example: Foundational + User Story 1/2

```bash
# หลัง Setup (Phase 1) เสร็จ — รัน Foundational พร้อมกัน:
Task: "เพิ่ม ocrText ใน attachment.entity.ts"
Task: "เพิ่ม isSandbox ใน project.entity.ts"

# หลัง Foundational เสร็จ — แยกทีมทำ US1/US2 พร้อมกัน:
Task: "US1: แก้ processRagPrepare() ให้ persist ocr_text"
Task: "US2: เพิ่ม clearSandboxData() + Full Pipeline tab"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1 (Setup) → Phase 2 (Foundational, เฉพาะ T004)
2. Phase 3 (US1) ทั้งหมด
3. **STOP and VALIDATE**: รัน `quickstart.md` ข้อ 2 — ยืนยัน OCR text ไม่หายเมื่อ retry
4. Deploy MVP นี้ก่อนได้ — ลด GPU cost ทันทีโดยไม่ต้องรอ Sandbox Project เสร็จ

### Incremental Delivery

1. Setup + Foundational → พร้อม
2. US1 → validate → deploy (ลด redundant OCR calls)
3. US2 → validate → deploy (admin ทดสอบ full pipeline ได้)
4. US3 → validate → deploy (RBAC filtering สมบูรณ์)
5. Polish → docs + regression check

---

## Notes

- US1 และ US2 ทั้งคู่เป็น P1 แต่ independent กัน — เลือกทำ US1 ก่อนได้เพราะ impact สูงกว่า (data durability) และ scope เล็กกว่า
- T011 เป็น task ที่มีความเสี่ยงสูงสุด (แก้ core processor logic) — ควร pair-review ก่อน merge
- T014-T015 (clear-data) เป็น destructive operation ระดับ endpoint — ต้อง scope ด้วย `project_id` ตรวจสอบซ้ำก่อน merge (ตาม Out-of-Scope rule เรื่องการลบข้อมูล)
