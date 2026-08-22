# Session 2026-08-22 — OCR-before-Import Workflow (ADR-047)

## Summary

Implement ADR-047 3-stage legacy migration workflow: `PENDING` (Excel metadata review) → `ai_status=RUNNING` (BullMQ OCR/AI) → `PENDING_REVIEW` (human OCR review) → `IMPORTED` (Execute Import). Add `ai_status`/`ai_job_id` to `migration_review_queue`, `Start Extract` endpoints, worker status transitions, and frontend `Start Extract`/`Execute Import` actions.

## ปัญหาที่พบ (Root Cause)

- `MigrationReviewQueue` entity มี `APPROVED` ที่ไม่มีใน DB enum; DB enum มี `PENDING_REVIEW` แต่ entity ไม่มี
- `migration.controller.ts` ขาด `POST /queue/:publicId/extract` และ `POST /extract` endpoints
- `processLegacyAiEnrichment` อัปเดต queue item ไม่สมบูรณ์ (ไม่ set `ai_status`, ไม่รองรับ `PENDING_REVIEW`)
- Frontend ไม่แสดง `aiStatus` และไม่แยก `Start Extract` / `Execute Import`
- `LegacyIngestionService` enqueue OCR ไม่บันทึก `aiJobId`/`aiStatus`
- `approveQueueItem` อนุญาต `PENDING` ทำให้ import ก่อน OCR ผิด workflow

## การแก้ไข (Fix)

| ไฟล์ | การเปลี่ยนแปลง |
| --- | --- |
| `backend/src/modules/migration/entities/migration-review-queue.entity.ts` | ลบ `APPROVED`, เพิ่ม `PENDING_REVIEW` ใน `MigrationReviewStatus`; เพิ่ม `MigrationAiStatus` + `aiStatus` column |
| `backend/src/modules/migration/services/legacy-ingestion.service.ts` | บันทึก `aiJobId`/`aiStatus` เมื่อ enqueue `legacy-ai-enrichment` |
| `backend/src/modules/migration/migration.service.ts` | เพิ่ม `startExtractQueueItem` / `startExtractBatch`; ปรับ `approveQueueItem` อนุญาตเฉพาะ `PENDING_REVIEW` |
| `backend/src/modules/migration/dto/start-extract.dto.ts` | DTO ใหม่: `StartExtractBatchDto` |
| `backend/src/modules/migration/migration.controller.ts` | เพิ่ม `POST /queue/:publicId/extract` + `POST /extract` (batch) |
| `backend/src/modules/ai/processors/ai-batch.processor.ts` | `processLegacyAiEnrichment` อัปเดต `aiStatus=RUNNING` → `DONE`/`FAILED` และ `status=PENDING_REVIEW` |
| `backend/src/modules/ai/dto/submit-ai-job.dto.ts` | เพิ่ม `queuePublicId` ใน `MigrateDocumentPayloadDto` |
| `frontend/types/migration.ts` | เพิ่ม `MigrationAiStatus`, `aiStatus`, `aiJobId` |
| `frontend/lib/services/migration.service.ts` | เพิ่ม `startExtractQueueItem`, `startExtractBatch` |
| `frontend/app/(admin)/admin/migration/page.tsx` | `Start Extract` / `Execute Import` batch buttons + `aiStatus` column + status filters |
| `frontend/app/(admin)/admin/migration/review/[id]/page.tsx` | `Start Extract` button + `Execute Import` guard |
| `frontend/components/migration/review-queue-table.tsx` | แก้ status badge `APPROVED` → `PENDING_REVIEW` |
| `specs/03-Data-and-Storage/lcbp3-v1.9.0-schema-02-tables.sql` | เพิ่ม column `ai_status` ใน `migration_review_queue` |
| `specs/06-Decision-Records/ADR-047-native-backend-legacy-ingestion.md` | อัปเดต lifecycle เป็น `PENDING` → `ai_status=RUNNING` → `PENDING_REVIEW` → `IMPORTED` |

## กฎที่ Lock แล้ว

- **D137:** `migration_review_queue.status` enum = `PENDING`, `PENDING_REVIEW`, `IMPORTED`, `REJECTED` (ไม่ใช้ `PROCESSING`)
- **D138:** `ai_status` enum = `PENDING`, `RUNNING`, `DONE`, `FAILED` ใช้แสดงสถานะ BullMQ AI job
- **D139:** Execute Import อนุญาตเฉพาะเมื่อ `status = PENDING_REVIEW`
- **D140:** `source_file_path` ใน queue details คือ absolute path; ห้าม `path.join(stagingDir, sourceFilePath)` ซ้ำ

## Verification

- [x] `backend npx tsc --noEmit` pass
- [x] `backend npx jest --testPathPatterns=migration` 158/158 pass
- [x] `backend npx jest --testPathPatterns=ai-batch` 28/28 pass
- [x] `frontend npx tsc --noEmit` pass
- [x] `frontend npm run build` pass
- [x] `npx eslint backend/src/modules/migration/migration.controller.ts` pass
- [ ] Gitea Actions deploy complete
- [ ] Manual workflow verification (ingest → extract → review → import)

## Notes

- `ai_status` column ถูก apply ไปยัง live MariaDB แล้ว (ALTER TABLE)
- Commit `1afbf683` ไม่รวม `migration.controller.ts` endpoints; ต้อง commit ใหม่ `a52e8068`
