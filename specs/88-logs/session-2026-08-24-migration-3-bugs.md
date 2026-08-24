# Session 2026-08-24 — Migration Admin 3 Bugs Fix (Bug #1-3)

## Summary

แก้ 3 bugs บนหน้า `/admin/migration` Legacy Review Queue ที่รายงานโดย user:
1. **Bug #1:** กด Start Extract 2 rows แต่ส่งไป BullMQ 4 jobs (duplicate)
2. **Bug #2:** Execute Import สำเร็จ แต่ Correspondence ไม่มี Attachments และไม่มี RAG
3. **Bug #3:** หน้า Review `/admin/migration/review/:id` แสดง 401 PERMISSION_DENIED error

## ปัญหาที่พบ (Root Cause)

### Bug #1: Duplicate BullMQ Jobs

`LegacyIngestionService` enqueue `legacy-ai-enrichment` jobs ระหว่าง ingestion ด้วย `jobId: legacy-enrich-${publicId}`. เมื่อ user กด Start Extract, `startExtractQueueItem` เพิ่ม jobs ใหม่ด้วย `jobId: legacy-enrich-${publicId}-${idempotencyKey}` (jobId ต่างกัน — BullMQ ไม่ dedup). Backend guard เดิมตรวจ `aiStatus === PENDING && aiJobId != null` แต่ `aiStatus` เป็น NULL ใน DB (entity `nullable: true`) ทำให้ check พลาดและ enqueue ซ้ำ

### Bug #2: Missing Attachments + No RAG

`tempAttachmentId` และ `tempAttachmentIds` ถูก `@Exclude()` จาก API response (ADR-019). Frontend ส่ง `tempAttachmentId: item.tempAttachmentId` ซึ่งเป็น `undefined` เสมอ. Backend `approveQueueItemByPublicId` ส่งแค่ `ocrText` จาก queue item — ไม่ส่ง attachment IDs. `sourceFilePath` fallback ล้มเหลวเพราะ `importStagingFile` path traversal guard ไม่อนุญาต `LEGACY_NAS_PATH` ที่เก็บ legacy PDFs. ไม่มี attachment → ไม่มี OCR text persistence → ไม่มี RAG trigger

### Bug #3: 401 on Review Page

`getAuthToken()` cache `tokenPromise` ถาวร — ถ้า call แรก return null (session ยังไม่ init) cache จะเป็น null ตลอด การเรียกครั้งถัดไปได้ null ซ้ำ → ไม่ส่ง auth token → 401. นอกจากนี้ catch block ใน review page ไม่ handle structured error format จาก interceptor (`{ error: {...} }`)

## การแก้ไข (Fix)

| ไฟล์ | การเปลี่ยนแปลง |
| --- | --- |
| `backend/src/modules/migration/migration.service.ts` | **Bug #1:** เปลี่ยน guard เป็น `aiJobId != null && aiStatus !== FAILED` (ครอบ NULL aiStatus); ลบ redundant DONE check |
| `backend/src/modules/migration/migration.service.ts` | **Bug #2:** `approveQueueItem` + `approveQueueItemByPublicId` ส่ง `tempAttachmentId`/`tempAttachmentIds` จาก queueItem โดยตรง; `importCorrespondence` รองรับ `tempAttachmentIds` (array) + `sourceFilePaths` (array) |
| `backend/src/common/file-storage/file-storage.service.ts` | **Bug #2:** `importStagingFile` path traversal guard เพิ่ม `LEGACY_NAS_PATH` (default `/mnt/legacy-staging`) เป็น allowed root |
| `frontend/app/(admin)/admin/migration/page.tsx` | **Bug #1:** `isExtractable` filter เพิ่มเงื่อนไข `!item.aiJobId \|\| item.aiStatus === FAILED`; **Bug #2:** ลบ `tempAttachmentId` จาก DTO (backend ดึงจาก queueItem); แก้ `item.title` → `item.subject` |
| `frontend/app/(admin)/admin/migration/review/[id]/page.tsx` | **Bug #3:** catch block handle ทั้ง structured error (`{ error: {...} }`) และ raw Axios error; แก้ `res.title` → `res.subject` |
| `frontend/lib/api/client.ts` | **Bug #3:** `getAuthToken()` ไม่ cache null values — clear `tokenPromise` เมื่อได้ null เพื่อให้ re-fetch ครั้งถัดไป |

## กฎที่ Lock แล้ว

- **D150:** BullMQ duplicate job prevention — guard ต้องตรวจ `aiJobId != null` (ไม่ใช่แค่ `aiStatus === PENDING`) เพราะ `aiStatus` เป็น nullable
- **D151:** `@Exclude()` fields (tempAttachmentId/tempAttachmentIds) — backend ต้องดึงจาก queueItem โดยตรง ไม่ผ่าน frontend DTO
- **D152:** `getAuthToken()` ห้าม cache null — clear `tokenPromise` เพื่อให้ re-fetch ได้ (ป้องกัน stale null cache ทำ 401)

## Verification

- [x] Backend TypeScript: 0 errors
- [x] Frontend TypeScript: 0 errors
- [x] Migration tests: 161/161 pass
- [x] File-storage tests: 13/13 pass
- [x] Frontend ESLint: 0 errors
- [ ] **Gitea Actions deploy** — pending after push
- [ ] **Browser verify Bug #1:** กด Start Extract 2 rows → BullMQ 2 jobs (ไม่ใช่ 4)
- [ ] **Browser verify Bug #2:** Execute Import → Correspondence มี Attachments + RAG triggered
- [ ] **Browser verify Bug #3:** หน้า Review โหลดสำเร็จ ไม่มี 401
