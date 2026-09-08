# Session 2026-09-08 (Schema Drift Bugfix — 8 Admin Console Issues)

## Summary

แก้ 8 bugs ใน Admin Console ที่มาจาก 3 root causes: (A) schema drift — Feature 253 `version` + cancel/delete columns ถูกเพิ่มใน schema SQL แต่ไม่เคย apply ลง DB จริง, (B) VectorCleanupService/VectorSyncService raw SQL ใช้ชื่อ column `public_id` แทน `uuid` (ADR-019), (C) `commitRecord` status gate ปฏิเสธ `PENDING_REVIEW` ทั้งที่เป็นสถานะที่ถูกต้องหลัง AI extraction.

## ปัญหาที่พบ (Root Cause)

### A. Schema Drift — Feature 253 columns missing from DB

`lcbp3-v1.9.0-schema-02-tables.sql` มี `ALTER TABLE` statements (lines 2019-2061) เพิ่ม `version` column (ADR-002 optimistic locking) และ Feature 253 columns อื่น ๆ ลงใน 7 tables ตั้งแต่ 2026-09-06 แต่ **ไม่มี delta file** สำหรับ apply ลง DB ที่รันอยู่ ทำให้ TypeORM `@VersionColumn` ส่ง `SELECT ... corr.version` แล้วเจอ `Unknown column 'corr.version' in 'SELECT'`

**7 tables ที่ขาด `version` column:** correspondences, rfas, transmittals, contract_drawings, shop_drawings, asbuilt_drawings, circulations

**Columns อื่นที่ขาด:** transmittals (status_id, cancel_reason, cancelled_at, cancelled_by), contract_drawings/shop_drawings/asbuilt_drawings (delete_reason), circulations (force_close_reason)

**FK bug ใน schema file:** `REFERENCES users (id)` ผิด — users PK คือ `user_id` ไม่ใช่ `id`

### B. VectorCleanupService + VectorSyncService raw SQL ใช้ column name ผิด

`vector-cleanup.service.ts` และ `vector-sync.service.ts` ใช้ raw SQL `SELECT c.public_id` / `SELECT p.public_id` แต่ตาม ADR-019 (`UuidBaseEntity`) correspondences และ projects tables ใช้ column ชื่อ `uuid` ไม่ใช่ `public_id` — TypeScript property `publicId` map ไป DB column `uuid`

### C. commitRecord status gate ปฏิเสธ PENDING_REVIEW

`migration-review.service.ts:415` ตรวจ `queueItem.status !== PENDING` แล้ว throw "รายการนี้ได้รับการประมวลผลไปแล้ว" แต่ `ai-batch.processor.ts` ตั้ง status เป็น `PENDING_REVIEW` หลัง AI extraction เสร็จ — ทำให้ user กด Execute Import ไม่ได้ พี่เมธอด `approveQueueItemByPublicId` (line 1699) ตรวจ `PENDING_REVIEW` ถูกแล้ว แต่ `commitRecord` ไม่ mirror

## การแก้ไข (Fix)

| ไฟล์ | การเปลี่ยนแปลง |
| -------------- | ---------------------- |
| `specs/03-Data-and-Storage/deltas/2026-09-08-feature-253-optimistic-lock-and-cancel-delete-columns.sql` | **สร้าง delta ใหม่** — ALTER TABLE ADD COLUMN IF NOT EXISTS สำหรับ 7 tables + FK constraints (ใช้ `user_id` ไม่ใช่ `id`) |
| `specs/03-Data-and-Storage/deltas/2026-09-08-feature-253-optimistic-lock-and-cancel-delete-columns.rollback.sql` | **สร้าง rollback** สำหรับ delta |
| `specs/03-Data-and-Storage/lcbp3-v1.9.0-schema-02-tables.sql` | แก้ FK bug: `REFERENCES users (id)` → `REFERENCES users (user_id)` |
| `backend/src/modules/ai/services/vector-cleanup.service.ts` | แก้ raw SQL: `c.public_id` → `c.uuid AS public_id` (orphanScan query) + `SELECT public_id FROM projects` → `SELECT uuid AS public_id FROM projects` |
| `backend/src/modules/maintenance/services/vector-sync.service.ts` | แก้ raw SQL: `p.public_id` → `p.uuid` ใน 4 queries (findMissingVectors, findOrphanVectors, getDocumentDetails, project list) |
| `backend/src/modules/migration/migration-review.service.ts` | แก้ status gate: ยอมรับทั้ง `PENDING` และ `PENDING_REVIEW` (mirror `approveQueueItemByPublicId`) |
| `backend/src/modules/migration/migration-review.service.spec.ts` | อัปเดต test name ให้ชัดเจน |

**DB changes applied to running MariaDB:**
- `version` column added to 7 tables
- `status_id`, `cancel_reason`, `cancelled_at`, `cancelled_by` added to transmittals
- `delete_reason` added to contract_drawings, shop_drawings, asbuilt_drawings
- `force_close_reason` added to circulations
- FK constraints on transmittals (status_id → correspondence_status, cancelled_by → users)
- `correspondence.import_review` permission (id 221) — missing 2026-09-06 delta applied

## กฎที่ Lock แล้ว

- **D286**: Schema drift prevention — ทุกครั้งที่เพิ่ม `ALTER TABLE` ใน `schema-02-tables.sql` ต้องสร้าง delta file ใน `specs/03-Data-and-Storage/deltas/` พร้อมกันเสมอ (ADR-044) — กรณีนี้ Feature 253 เพิ่ม ALTER ลง schema แต่ไม่สร้าง delta ทำให้ DB จริงไม่ได้ column
- **D287**: Raw SQL ใน backend ต้องใช้ DB column name `uuid` ไม่ใช่ TypeScript property name `publicId`/`public_id` — ADR-019 `UuidBaseEntity` maps `publicId` (TS) → `uuid` (DB column); ใช้ alias `uuid AS public_id` ถ้าต้องการ key ชื่อ `public_id` ใน result
- **D288**: `commitRecord` status gate ต้องยอมรับทั้ง `PENDING` และ `PENDING_REVIEW` — mirror `approveQueueItemByPublicId` (migration.service.ts:1699); `PENDING_REVIEW` คือสถานะที่ถูกต้องหลัง AI extraction (ai-batch.processor.ts ตั้งค่านี้)

## Verification

- [x] 69 unit tests pass (8 vector-cleanup + 61 migration-review)
- [x] TypeScript compiles cleanly (`tsc --noEmit`)
- [x] Backend restarted, all API endpoints return 200:
  - `/api/correspondences` → 200 (was 500)
  - `/api/rfas` → 200
  - `/api/transmittals` → 200
  - `/api/circulations` → 200
  - `/api/search` → 200
  - `/api/drawings/contract` → 200 with data (2055 contract drawings, 641 shop drawings)
- [x] No `QueryFailedError` or `Unknown column` errors in backend logs
- [x] VectorCleanupService running clean (no orphan scan errors)
- [x] `information_schema.COLUMNS` confirms 7 `version` columns + 8 Feature 253 columns present
- [x] `correspondence.import_review` permission (id 221) present in DB
- [x] Committed: `3c9ce8fb` (7 files, +127/-11)

## Affected Issues (User Report)

| # | Issue | Root Cause | Status |
|---|-------|-----------|--------|
| 1 | /admin/migration/review/ Execute Import → "รายการนี้ได้รับการประมวลผลไปแล้ว" | C | ✅ Fixed |
| 2 | /admin/doc-control/maintenance ทุก tab กดสแกน → error | B | ✅ Fixed |
| 3 | /correspondences → Failed to load correspondences | A | ✅ Fixed |
| 4 | /correspondences?type=RFA → Failed to load correspondences | A | ✅ Fixed |
| 5 | /drawings → Failed to load contract drawings | A | ✅ Fixed |
| 6 | /circulation/new Document search + Assignees | A | ✅ Fixed |
| 7 | /transmittals/new Reference Document + Document ID | A | ✅ Fixed |
| 8 | /search ค้นหาไม่ได้ | A (search service uses ES, but document list endpoints were broken) | ✅ Fixed |
