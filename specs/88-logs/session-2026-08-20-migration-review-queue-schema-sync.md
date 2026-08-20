# Session — 2026-08-20 (Migration Review Queue Schema Sync + BullMQ Fix)

## Summary

แก้ schema drift ของ `migration_review_queue` ที่ทำให้ BullMQ `ai-batch` jobs ล้มเหลว ทำให้ n8n workflow `Route Poll Status` วน loop ไม่ออกจาก retry เพราะ backend คืน `status: "waiting"` พร้อม `failedReason` (TypeORM SELECT ล้มเหลวเพราะ column ไม่มีใน DB)

## ปัญหาที่พบ (Root Cause)

1. **Schema Drift (17 columns missing):** Entity `MigrationReviewQueue` (`src/modules/migration/entities/`) คาดหวัง `document_number`, `subject`, `body`, `ai_suggested_category` ฯลฯ แต่ DB มี schema เก่ากว่า (21 columns) ทำให้ TypeORM `SELECT` ล้มเหลวด้วย `Unknown column 'MigrationReviewQueue.document_number'`

2. **NOT NULL fields ไม่ได้ set ค่า:** DB กำหนด `batch_id`, `idempotency_key`, `original_filename`, `storage_temp_path`, `confidence_score` เป็น NOT NULL แต่ entity เก่าไม่ได้ define และ service ไม่ได้ set ค่า → INSERT ล้มเหลว

3. **`batchId` ไม่ส่งถึง processor:** `ai.service.ts submitUnifiedJob` ไม่ได้ extract `batchId` จาก `dto.payload` ขึ้น top-level ของ `finalPayload` ทำให้ `job.data.batchId` เป็น `undefined`

4. **Dist ไม่ deploy:** Backend container ใช้ code จาก image (ไม่ใช่ volume mount) ต้อง `docker cp dist/. backend:/app/dist/` หลัง build

## การแก้ไข (Fix)

| ไฟล์ | การเปลี่ยนแปลง |
| --- | --- |
| `specs/03-Data-and-Storage/deltas/2026-08-20-migration-review-queue-schema-sync.sql` | สร้าง delta: relax 4 NOT NULL → nullable + เพิ่ม 17 columns + unique index |
| `specs/03-Data-and-Storage/lcbp3-v1.9.0-schema-02-tables.sql` | อัปเดต canonical schema ให้ตรงกับ DB จริง (38 columns) |
| `specs/03-Data-and-Storage/03-01-data-dictionary.md` | อัปเดต section 19.1 ให้ครบทุก column |
| `backend/src/modules/migration/dto/enqueue-migration.dto.ts` | เพิ่ม `batchId?: string` field |
| `backend/src/modules/migration/entities/migration-review-queue.entity.ts` | เพิ่ม `@Column batchId` mapping ไป `batch_id` |
| `backend/src/modules/migration/migration.service.ts` | set `batchId: dto.batchId \|\| 'unknown'` ตอน create |
| `backend/src/modules/ai/processors/ai-batch.processor.ts` | ส่ง `batchId: batchId \|\| 'unknown'` ใน `enqueueRecord()` |
| `backend/src/modules/ai/ai.service.ts` | extract `batchId` จาก `dto.payload.batchId` ขึ้น top-level ของ `finalPayload` |
| MariaDB `lcbp3.migration_review_queue` | รัน delta แล้ว — มี columns ครบ 38 ตัว |

## กฎที่ Lock แล้ว

- **ADR-044:** ใช้ delta SQL (ไม่ใช่ TypeORM migration) สำหรับ schema changes
- **Backend deploy:** ต้อง `npm run build` แล้ว `docker cp dist/. backend:/app/dist/` เพราะ container ใช้ image ไม่ใช่ volume mount
- **Entity drift:** มี 2 entities สำหรับ `migration_review_queue` (`MigrationReviewRecord` ใน ai/ และ `MigrationReviewQueue` ใน migration/) — ยังคงใช้ entity เก่าตาม user decision

## Verification

- [x] `npx tsc --noEmit` ผ่าน (ไม่มี type errors)
- [x] `npm run build` ผ่าน
- [x] Backend healthy หลัง restart
- [x] DB มี 38 columns ครบ
- [x] BullMQ job 1 รายการ completed (`CHEC-LCP-C2-O-24-0005`)
- [x] `migration_review_queue` มี record ใหม่พร้อม `batch_id`, `document_number`, `subject`, `status`, `ai_job_id`
- [x] Failed jobs เก่าถูก clear แล้ว
