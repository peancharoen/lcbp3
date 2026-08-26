# Session 2026-08-26 — Migration Queue + Correspondence Detail + Hard-Delete Fixes

## Summary

แก้ 8 ปัญหาใน 2 sessions ต่อเนื่อง: (1) 6 ปัญหาใน migration queue + correspondence detail + RAG pipeline + AI status; (2) 2 ปัญหาใน cascading delete + QueueJobDrawer UI

## ปัญหาที่พบ (Root Cause)

### Session 1 — 6 Issues

| # | Issue | Root Cause |
|---|-------|-----------|
| 1 | ปุ่ม "ลบทั้งหมด" ใน Legacy Review Queue ไม่ทำงาน | `deleteReviewQueueByBatch` ใช้ `delete({})` เมื่อ `all=true` — TypeORM ปฏิเสธ empty conditions (safety feature) |
| 2 | "Execute Import" Batch import failed | `ImportCorrespondenceDto.batchId` เป็น `@IsNotEmpty()` (required) แต่ `commitBatch` เซ็ต `batchId` หลัง DTO validation → validation ล้มเหลว |
| 3 | ขาด WAITING status ใน AI Status | `MigrationAiStatus` enum มีแค่ PENDING/RUNNING/DONE/FAILED — PENDING ใช้ครอบทั้ง "ยังไม่ enqueue" และ "enqueue แล้วรอ worker" |
| 4 | IMPORTED แล้ว RAG ไม่ทำงาน | `processRagPrepare` อ่าน `cachedOcrText`/`attachmentPath`/`attachmentPublicId` จาก `data.payload` เท่านั้น แต่ `enqueueRagPrepare` ส่ง fields ที่ top level ของ job data → fields กลายเป็น `undefined` → skip embedding |
| 5 | Correspondence Detail ไม่แสดง PDF attachments | มีแค่ download link ไม่มี preview modal |
| 6 | Correspondence Detail ไม่แสดง remarks | `remarks` มีอยู่ใน Content section แต่ไม่โดดเด่น ไม่มีใน sidebar |

### Session 2 — 2 Issues

| # | Issue | Root Cause |
|---|-------|-----------|
| A | `correspondence_revision_attachments` ลบแล้ว `attachments` ไม่ถูกลบตาม + ไม่มี admin tool ลบ correspondence | (1) ไม่มี hard-delete endpoint — `DELETE /correspondences/:uuid` เป็นแค่ cancel; (2) DB cascade ทิศทางเดียว `attachments → junction (CASCADE)` ไม่ใช่ `junction → attachments`; (3) `FileStorageService.delete()` ตรวจ ownership บล็อก admin |
| B | QueueJobDrawer Job ID column แคบเกินไป | Column width `w-[120px]` + `truncate` แคบเกินไปสำหรับ BullMQ job IDs ที่ยาว 50+ chars |

## การแก้ไข (Fix)

| ไฟล์ | การเปลี่ยนแปลง |
|------|---------------|
| `backend/src/modules/migration/migration.service.ts` | Bug #1: เพิ่ม `id: MoreThanOrEqual(0)` เป็น wildcard condition; Bug #3: `aiStatus` เริ่มต้นเป็น `WAITING` แทน `PENDING` เมื่อ enqueue |
| `backend/src/modules/migration/dto/import-correspondence.dto.ts` | Bug #2: `batchId` เปลี่ยนเป็น `@IsOptional()` |
| `backend/src/modules/migration/entities/migration-review-queue.entity.ts` | Bug #3: เพิ่ม `WAITING = 'WAITING'` ใน `MigrationAiStatus` enum |
| `frontend/types/migration.ts` | Bug #3: เพิ่ม `WAITING = 'WAITING'` ใน frontend enum |
| `frontend/app/(admin)/admin/migration/page.tsx` | Bug #3: เพิ่ม WAITING variant ใน Badge |
| `frontend/app/(admin)/admin/migration/review/[id]/page.tsx` | Bug #3: ซ่อนปุ่ม Start Extract เมื่อ `aiStatus === WAITING` |
| `specs/03-Data-and-Storage/deltas/2026-08-26-add-waiting-to-ai-status-enum.sql` | Bug #3: Schema delta — ALTER enum + UPDATE existing PENDING→WAITING |
| `specs/03-Data-and-Storage/lcbp3-v1.9.0-schema-02-tables.sql` | Bug #3: อัปเดต canonical schema enum |
| `backend/src/modules/ai/processors/ai-batch.processor.ts` | Bug #4: `processRagPrepare` อ่าน fields จากทั้ง `payload` และ top level ของ `data` ผ่าน `readStr()` helper |
| `frontend/components/correspondences/detail.tsx` | Bug #5: เพิ่ม `FilePreviewModal` + Eye icon สำหรับ preview PDF; Bug #6: เพิ่ม Remarks section ใน sidebar; Issue A: เพิ่ม Hard Delete button + confirmation dialog |
| `frontend/components/correspondences/detail.test.tsx` | แก้ test ให้ใช้ `getAllByText` สำหรับ remarks (แสดง 2 ที่) |
| `backend/src/modules/correspondence/correspondence.service.ts` | Issue A: เพิ่ม `hardDelete()` method — full cascade: physical files → Qdrant vectors → DB rows |
| `backend/src/modules/correspondence/correspondence.controller.ts` | Issue A: `DELETE /correspondences/:uuid/hard` — `system.manage_all` + Idempotency + Audit |
| `frontend/lib/services/correspondence.service.ts` | Issue A: เพิ่ม `hardDelete()` service method |
| `frontend/components/admin/ai/QueueJobDrawer.tsx` | Issue B: เพิ่ม column width `w-[120px]` → `w-[260px]` + `truncate` → `break-all` + `title` tooltip |

## กฎที่ Lock แล้ว

- **D165**: TypeORM Empty Conditions Safety — `delete({})` ถูกปฏิเสธโดย TypeORM (safety feature); ใช้ `id: MoreThanOrEqual(0)` เป็น wildcard condition เมื่อต้องการ delete all
- **D166**: DTO Validation Timing — DTO ที่ backend เซ็ตค่าหลัง validation (เช่น `batchId` ใน `commitBatch`) ต้องเป็น `@IsOptional()` ไม่ใช่ `@IsNotEmpty()`
- **D167**: BullMQ Job Data Field Location — `enqueueRagPrepare` ส่ง fields ที่ top level ของ job data (ไม่ได้ห่อใน `payload`); processor ต้องอ่านจากทั้งสองที่ผ่าน `readStr()` helper
- **D168**: MigrationAiStatus WAITING — `PENDING` = ยังไม่ enqueue (aiJobId=null); `WAITING` = enqueue แล้วรอ worker (aiJobId!=null); `RUNNING` = worker กำลังประมวลผล; ต้องอัปเดตทั้ง backend enum + frontend type + DB schema + UI badge
- **D169**: Correspondence Hard-Delete Cascade — `DELETE /correspondences/:uuid/hard` (Superadmin only) ลบลำดับ: physical files → Qdrant vector deletion (BullMQ) → DB rows ใน transaction; DB cascade ทิศ `attachments → junction` ไม่ใช่ `junction → attachments` จึงต้อง manual cleanup attachments ก่อนลบ correspondence

## Verification

- [x] Backend build: ผ่าน (nest build)
- [x] Backend lint:ci: ผ่าน (ESLint --cache)
- [x] Backend tests: 64 tests ผ่าน (migration + ai-batch + rag-batch)
- [x] Frontend build: ผ่าน (next build --webpack, 49 pages)
- [x] Frontend lint: ผ่าน (ESLint --max-warnings 0)
- [x] Frontend tests: 973 tests ผ่าน (vitest run)
- [ ] **DB schema apply** — ต้องรัน delta `2026-08-26-add-waiting-to-ai-status-enum.sql` บน DB
- [ ] **Browser verify** — ทดสอบ hard-delete จาก correspondence detail
- [ ] **Browser verify** — ทดสอบ QueueJobDrawer Job ID column width
- [ ] **Browser verify** — ทดสอบ "ลบทั้งหมด" และ "Execute Import" ใน migration queue

## Fix #9 — Attachment Folder Date (Session 2026-08-26, continued)

### ปัญหาเพิ่มเติม

ไฟล์ attachment ใน permanent storage ใช้วันที่นำเข้า (import date) แทนวันที่เอกสาร (document date) สำหรับ folder structure `permanent/{docType}/{YYYY}/{MM}/`

### Root Cause (2 ปัญหา)

1. **Batch Import** (`migration.service.ts`): `importStagingFile()` ถูกเรียกแค่ `{ documentType, manager }` ไม่ได้ส่ง `issueDate` ทั้งที่ DTO มี `documentDate` อยู่แล้ว
2. **Review Queue Commit** (`migration-review.service.ts`): `commitRecord` ไม่ได้ย้ายไฟล์จาก `tempDir` ไป `permanent` เลย — ไฟล์ติดอยู่ใน temp dir ตลอด แค่ `UPDATE isTemporary = false` ใน DB

### การแก้ไข

| ไฟล์ | การเปลี่ยนแปลง |
|------|---------------|
| `backend/src/modules/migration/migration.service.ts` | ส่ง `issueDate: dto.documentDate ? new Date(dto.documentDate) : undefined` ไปยัง `importStagingFile` (2 call sites) |
| `backend/src/modules/migration/migration-review.service.ts` | เพิ่ม `FileStorageService` injection + `fs.move` จาก `tempDir` ไป `permanent/{docType}/{YYYY}/{MM}/` โดยใช้ `issuedDate` ก่อน mark `isTemporary = false` |
| `backend/src/common/file-storage/file-storage.service.ts` | `tempDir`/`permanentDir` เปลี่ยนจาก `private` เป็น `readonly` เพื่อให้ service อื่นเข้าถึง path ได้ |
| `backend/src/modules/migration/migration-review.service.spec.ts` | เพิ่ม mock `FileStorageService` |
| `backend/src/modules/correspondence/correspondence.service.spec.ts` | เพิ่ม mock `AiQueueService` |

### กฎที่ Lock

- **D170**: Attachment folder date = document date (`issueDate`/`documentDate`) ไม่ใช่ import date

### Verification

- [x] Backend build: ผ่าน
- [x] Backend lint:ci: ผ่าน
- [x] Backend tests: 1080 passed (109 suites)
- [x] Frontend lint: ผ่าน
- [ ] **Browser verify** — ตรวจสอบ folder structure หลัง import ใช้วันที่เอกสาร
