# Session 2026-08-25 — iframe 401 Fix + Excel Remarks Import + Correspondence Detail Scrollbar

## Summary

3 งานใน session เดียว: (1) แก้ iframe 401 บนหน้า migration review โดยใช้ auth-via-blob pattern ผ่าน `StagingFileViewer` component ใหม่ + ลบ `getStagingFileUrl` footgun (2) เพิ่มฟีเจอร์นำเข้า Excel column `remarks` → `correspondence_revisions.remarks` (3) ปรับหน้า correspondence detail ให้ content + remarks อยู่ใน container เดียวกันพร้อม vertical scrollbar

## ปัญหาที่พบ (Root Cause)

### Bug 1: iframe 401 บน `/admin/migration/review/[id]`
- `<iframe src="/api/migration/staging-file?path=...">` ใช้ raw API URL เป็น src
- Browser iframe navigation ไม่สามารถแนบ `Authorization: Bearer <token>` header ได้
- Backend `JwtAuthGuard` ใช้ `ExtractJwt.fromAuthHeaderAsBearerToken()` เท่านั้น (ไม่รองรับ cookie)
- ผล: iframe request ไปถึง backend โดยไม่มี JWT → 401 "กรุณาเข้าสู่ระบบก่อนใช้งาน"
- รูปแบบที่ถูกต้องมีอยู่แล้วใน `FilePreviewModal`: ดึงไฟล์ผ่าน `apiClient` (interceptor แนบ JWT) → `URL.createObjectURL()` → set เป็น iframe src

### Bug 2: Excel remarks ไม่ได้ส่งไป `correspondence_revisions`
- `LegacyIngestionService` อ่าน column `remarks` จาก Excel และเก็บใน `migration_review_queue.remarks` อยู่แล้ว
- แต่ `ImportCorrespondenceDto` ไม่มี field `remarks`
- `importCorrespondence()` ไม่ได้ set `remarks` บน `CorrespondenceRevision`
- `approveQueueItemByPublicId()` ไม่ได้ส่ง `queueItem.remarks` เป็น fallback

### Bug 3: Correspondence detail content ไม่มี scrollbar
- `currentRevision.body` แสดงใน `<div>` ไม่มี max-height → เนื้อหายาวดัน layout
- `remarks` แสดงแยก section ด้านล่าง

## การแก้ไข (Fix)

### Bug 1: iframe 401

| ไฟล์ | การเปลี่ยนแปลง |
|------|----------------|
| `frontend/components/migration/staging-file-viewer.tsx` | **ใหม่** — Reusable component: ดึงไฟล์ผ่าน `apiClient.get('/migration/staging-file', { responseType: 'blob', params: { path } })` → `URL.createObjectURL()` → `<iframe src={blobUrl}>`; loading/error/empty states; revoke Blob URL on cleanup |
| `frontend/components/migration/__tests__/staging-file-viewer.test.tsx` | **ใหม่** — 5 regression tests: apiClient called with `responseType: 'blob'` + path param, iframe src is `blob:` (not raw `/api/...`), empty state on null path, 404 error handling, Blob URL revocation on unmount |
| `frontend/app/(admin)/admin/migration/review/[id]/page.tsx` | แทน raw `<iframe src={pdfUrl}>` ด้วย `<StagingFileViewer sourceFilePath={sourceFilePath} />`; ลบ `pdfUrl`/`getStagingFileUrl` call |
| `frontend/components/ai/document-comparison-view.tsx` | แทน raw iframe ด้วย `StagingFileViewer`; เปลี่ยน prop `fileUrl` → `sourceFilePath` (latent bug — component ไม่ได้ใช้อยู่) |
| `frontend/lib/services/migration.service.ts` | ลบ `getStagingFileUrl()` — footgun ที่ return raw URL ไม่สามารถใช้เป็น DOM src ได้ |
| `frontend/lib/services/__tests__/migration.service.test.ts` | ลบ test ของ `getStagingFileUrl` (8 tests ยังผ่าน) |

### Bug 2: Excel remarks → correspondence_revisions.remarks

| ไฟล์ | การเปลี่ยนแปลง |
|------|----------------|
| `backend/src/modules/migration/dto/import-correspondence.dto.ts` | เพิ่ม `remarks?: string` field + `@IsString()` `@IsOptional()` validation |
| `backend/src/modules/migration/migration.service.ts` (`importCorrespondence`) | set `revision.remarks = dto.remarks \|\| undefined` ทั้ง 2 path (update existing + create new) |
| `backend/src/modules/migration/migration.service.ts` (`approveQueueItem` + `approveQueueItemByPublicId`) | เพิ่ม `remarks: dto.remarks ?? queueItem.remarks ?? undefined` เป็น fallback (เหมือน `ocrText`) |
| `frontend/app/(admin)/admin/migration/review/[id]/page.tsx` | เพิ่ม `remarks` ใน Zod schema + defaultValues + pre-fill จาก `item.remarks` + Textarea field "Remarks" + ส่งใน approve payload |

### Bug 3: Correspondence detail scrollbar

| ไฟล์ | การเปลี่ยนแปลง |
|------|----------------|
| `frontend/components/correspondences/detail.tsx` | รวม body + remarks ใน container เดียว `max-h-[60vh] overflow-y-auto custom-scrollbar`; มีเส้นแบ่ง `border-t` ระหว่างสองส่วนถ้ามี body; แสดง section "Content" เมื่อมี body หรือ remarks อย่างน้อยหนึ่งอย่าง |

## กฎที่ Lock แล้ว

- **D153 — Iframe Auth-Via-Blob Pattern**: ห้ามใช้ raw API URL เป็น `<iframe src>` หรือ `<img src>` สำหรับ endpoint ที่มี `JwtAuthGuard` — browser navigation ไม่สามารถแนบ `Authorization` header ได้; ต้องดึงไฟล์ผ่าน `apiClient` (interceptor แนบ JWT) → `URL.createObjectURL()` → set Blob URL เป็น src; ใช้ `StagingFileViewer` component สำหรับ staging files เท่านั้น
- **D154 — No Raw URL Builders for Authenticated Endpoints**: ห้ามสร้าง helper function ที่ return raw API URL สำหรับใช้เป็น DOM `src` (เช่น `getStagingFileUrl` เดิม) — เป็น footgun เพราะ caller ไม่รู้ว่า URL นั้นไม่สามารถใช้ใน iframe/img ได้โดยตรง; ให้ใช้ component ที่จัดการ auth + Blob URL ภายใน
- **D155 — Queue Item Fallback Pattern**: `approveQueueItem`/`approveQueueItemByPublicId` ต้องดึงค่าจาก `queueItem` เป็น fallback เมื่อ frontend ไม่ส่งค่ามา (เช่น `remarks`, `ocrText`, `tempAttachmentIds`) — เพราะข้อมูลถูกเก็บใน queue ตั้งแต่ ingestion phase แล้ว

## Verification

- [x] `tsc --noEmit` (frontend + backend) — ผ่าน
- [x] `eslint` ทุกไฟล์ที่แก้ — ผ่าน (0 warnings)
- [x] `vitest staging-file-viewer.test.tsx` — 5/5 ผ่าน
- [x] `vitest migration.service.test.ts` — 8/8 ผ่าน (หลังลบ getStagingFileUrl test)
- [x] `vitest detail.test.tsx` — 7/7 ผ่าน
- [x] `jest migration` (backend, 161 tests) — ผ่าน
- [x] lint-staged ผ่าน (pre-commit hook)
- [x] Commit `2e56f8e0` + push to Gitea สำเร็จ (`bca1259c..2e56f8e0 main -> main`)
- [ ] **Browser verify Bug 1:** หน้า `/admin/migration/review/[id]` แสดง PDF ได้ ไม่มี 401
- [ ] **Browser verify Bug 2:** Execute Import → `correspondence_revisions.remarks` มีค่าจาก Excel
- [ ] **Browser verify Bug 3:** หน้า `/correspondences/[uuid]` content + remarks มี scrollbar เมื่อเนื้อหายาว
- [ ] **Gitea Actions deploy** — pending after push
