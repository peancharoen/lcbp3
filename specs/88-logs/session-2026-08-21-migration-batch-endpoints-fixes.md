# Session — 2026-08-21 (Migration Batch Endpoints Fixes + Pagination + Ingestion Summary)

## Summary

แก้ 2 runtime bugs ที่ทำให้ bulk delete ใน Legacy Review Queue + Error Audit Log ล้มเหลว (route ordering + TypeORM delete alias) และเพิ่ม pagination + ingestion summary ตาม feedback ผู้ใช้ 4 ข้อ

## ปัญหาที่พบ (Root Cause)

### ปัญหา 1: `GET /api/migration/queue/batches` ตีกับ `:publicId` (UUID validation)
- **อาการ:** `BadRequestException: Validation failed (uuid is expected)` เมื่อเรียก `/queue/batches`
- **Root cause:** NestJS route mapping สำคัญ — `GET /queue/:publicId` (มี `ParseUUIDPipe`) ถูกประกาศก่อน `GET /queue/batches` ทำให้ `"batches"` ถูก match เป็น `:publicId` และ fail UUID validation
- **ผลกระทบ:** batch dropdown ไม่แสดงรายการ และ bulk delete ใช้ไม่ได้

### ปัญหา 2: `DELETE /api/migration/queue?all=true` fail ด้วย `Unknown column 'queue.status'`
- **อาการ:** `QueryFailedError: Unknown column 'queue.status' in 'WHERE'`
- **Root cause:** TypeORM `DeleteQueryBuilder` ไม่รองรับ table alias ใน WHERE clause — ใช้ `createQueryBuilder('queue').delete().where('queue.status = :status')` สร้าง SQL `DELETE FROM ... WHERE queue.status = ?` ที่ MariaDB ปฏิเสธ
- **ผลกระทบ:** bulk delete ทั้ง `all=true` และ `batchId=...` ล้มเหลว

### ปัญหา 3: Review page "Extracted Information" ไม่แสดงข้อมูล Excel
- **อาการ:** form fields ว่างในหน้า review
- **Root cause:** form อ่าน `issues.issuedDate` (จาก `aiIssues` payload) แต่ข้อมูล Excel ถูกเก็บที่ root fields (`res.issuedDate`, `res.receivedDate`, `res.senderOrganizationId`, `res.subject`, `res.originalSubject`)

### ปัญหา 4: ESLint segfault ใน CI (exit 139)
- **อาการ:** `node_modules/eslint/bin/eslint.js "{src,apps,libs,test}/**/*.ts" --cache` ล้มด้วย Segmentation fault
- **Root cause:** eslint v9 ใช้ memory มากกว่า default heap ของ Node 24 ใน CI container ที่ memory จำกัด

## การแก้ไข (Fix)

| ไฟล์ | การเปลี่ยนแปลง |
| --- | --- |
| `backend/src/modules/migration/migration.controller.ts` | ย้าย `GET /queue/batches` และ `GET /errors/batches` ให้อยู่ก่อน dynamic routes (`:publicId`) |
| `backend/src/modules/migration/migration.service.ts` | เปลี่ยน `deleteReviewQueueByBatch` + `deleteErrorsByBatch` จาก `createQueryBuilder().delete().where('queue.status=...')` เป็น `repository.delete(FindOptionsWhere)` ที่ใช้ entity property names (`status`, `batchId`) — TypeORM สร้าง SQL ที่ถูกต้อง |
| `backend/src/modules/migration/migration.service.ts` | เพิ่ม import `FindOptionsWhere` จาก typeorm |
| `frontend/app/(admin)/admin/migration/review/[id]/page.tsx` | อ่าน form fields จาก root fields ก่อน แล้วค่อย fallback ไป `aiIssues` payload |
| `frontend/app/(admin)/admin/migration/page.tsx` | เพิ่ม pagination (20 รายการ/หน้า) + แสดง "ทั้งหมด X รายการ (หน้า Y/Z)" + ปุ่ม ก่อนหน้า/ถัดไป |
| `frontend/app/(admin)/admin/migration/errors/page.tsx` | เพิ่ม pagination + row count เช่นเดียวกับ Review Queue |
| `frontend/components/migration/legacy-ingestion-card.tsx` | หลัง ingestion แสดง toast: "นำเข้าสำเร็จ X รายการ \| ข้าม Y \| ผิดพลาด Z \| ทั้งหมด N แถว" |
| `frontend/lib/services/migration.service.ts` | เพิ่ม `StartIngestResponse` return type สำหรับ `startIngestion` |
| `frontend/types/migration.ts` | เพิ่ม `StartIngestResponse` interface (batchId, totalRowsProcessed, enqueuedCount, skippedCount, errorCount, lastProcessedIndex, status) |
| `.gitea/workflows/ci-deploy.yml` | เพิ่ม `NODE_OPTIONS: '--max-old-space-size=4096'` env ใน Lint step |
| `backend/package.json` | `lint:ci` script เพิ่ม `--max-old-space-size=4096` ใน node command |

## กฎที่ Lock แล้ว

- **D129 — NestJS Route Order:** static routes (`/queue/batches`) ต้องประกาศก่อน dynamic routes (`/queue/:publicId`) เสมอ ไม่งั้น `ParseUUIDPipe` จะจับ string เป็น UUID param
- **D130 — TypeORM Delete Query:** ห้ามใช้ `createQueryBuilder(alias).delete().where('alias.column = :val')` — MariaDB ปฏิเสธ alias ใน DELETE WHERE; ใช้ `repository.delete(FindOptionsWhere)` ที่ใช้ entity property names แทน
- **D131 — CI ESLint Memory:** eslint v9 + flat config กิน memory มาก ต้อง set `NODE_OPTIONS=--max-old-space-size=4096` ใน CI env และ/หรือใน lint script โดยตรง

## Verification

- [x] Backend typecheck ผ่าน
- [x] Backend build + docker cp + restart สำเร็จ
- [x] Route mapping ใน logs ถูกต้อง: `queue/batches` ก่อน `queue/:publicId`
- [x] Frontend typecheck ผ่าน
- [x] Frontend build + docker cp + restart สำเร็จ
- [x] ESLint ผ่าน locally หลังเพิ่ม `--max-old-space-size=4096`
- [x] Commit + push สำเร็จ (4 commits)
- [ ] Browser verify โดยผู้ใช้: bulk delete, batch dropdown, pagination, ingestion summary toast
- [ ] CI run ใหม่ผ่าน (หลังจาก push commit ล่าสุด)

## Commits

- `6b53d191` — fix(migration): route order + use snake_case column names in delete queries (กลายเป็น obsolete จาก bug ที่ยังเหลือ `queue.status` ใน source)
- `bd765e99` — fix(migration): use Repository.delete() with FindOptionsWhere instead of queryBuilder (แก้จริง)
- `165fa858` — fix(ci): increase Node memory for eslint to prevent segfault
- `f19733d1` — feat(migration): fix review form + pagination + ingestion summary

## หมายเหตุ

- คำเตือนจาก session ก่อน: commit `daa2b608` ไม่ได้รวม backend controller/service changes เพราะ assistant commit workflow พลาด (ไม่ใช่ผู้ใช้ลบ) — ได้แก้ไขแล้วใน commit `400606c8` ก่อนหน้านี้
- การแก้ครั้งแรก (`6b53d191`) พยายามใช้ snake_case column names ใน queryBuilder แต่ยังเป็น `delete().where('queue.status=...')` อยู่ จึงยัง fail; แก้ถูกที่จริงใน commit `bd765e99` โดยเปลี่ยนเป็น `repository.delete(FindOptionsWhere)` ที่ใช้ entity property names
