# Session — 2026-09-08 (Feature 253 BullMQ bulk store + Maintenance Vector Sync)

## Summary

Feature 253 continuation: เปลี่ยน `DocumentService` bulk operations (`bulkCancel`/`bulkTag`/`bulkExport`) จาก in-memory async ไปใช้ BullMQ queue + `BulkOperationsProcessor` และ harden Maintenance Console Vector Sync (`VectorSyncService`) ให้ทำงานจริงบน Qdrant/DB.

## ปัญหาที่พบ (Root Cause)

- ก่อนปรับปรุง `DocumentService` รัน bulk operations แบบ in-memory (`void this.processBulk(...)`) ไม่ durable ข้าม process/restart
- `VectorSyncService` ยังเป็น skeleton — `findMissingVectors`/`findOrphanVectors`/`enqueueReEmbed` ยังไม่เชื่อม Qdrant จริง
- `DocumentService.preFilterCancelled` ใช้ชื่อ table/column ผิด (`correspondence_statuses`/`cr.status_id`) ซึ่งไม่ตรง schema

## การแก้ไข (Fix)

| ไฟล์ | การเปลี่ยนแปลง |
| --- | --- |
| `backend/src/modules/common/constants/queue.constants.ts` | เพิ่ม `QUEUE_BULK_OPERATIONS` |
| `backend/src/modules/document/processors/bulk-operations.processor.ts` | สร้างใหม่ — `WorkerHost` dispatch `cancel`/`tag`/`export` jobs ไป `DocumentService` |
| `backend/src/modules/document/document.module.ts` | ลงทะเบียน `BullModule.registerQueue({ name: QUEUE_BULK_OPERATIONS })` + provide processor |
| `backend/src/modules/document/document.service.ts` | เปลี่ยน `bulkCancel`/`bulkTag`/`bulkExport` เป็น async, enqueue BullMQ job; เพิ่ม `processCancelJob`/`processTagJob`/`processExportJob`; แก้ `preFilterCancelled` SQL |
| `backend/src/modules/document/document.controller.ts` | ปรับ return type ของ bulk endpoints ให้เป็น `Promise<{bulkId}>` |
| `backend/src/modules/document/document.service.spec.ts` | Mock BullMQ `Queue`, update test ให้ process job ก่อน assert |
| `backend/src/modules/maintenance/services/vector-sync.service.ts` | Implement `findMissingVectors` (Qdrant count), `findOrphanVectors` (Qdrant scroll + DB check), `enqueueReEmbed` (AiQueueService `rag-prepare`) |
| `specs/200-fullstacks/253-unified-doc-crud/validation-report.md` | Update overall verdict, FR-019 notes |
| `specs/200-fullstacks/253-unified-doc-crud/test-report.md` | Update timestamp |
| `specs/200-fullstacks/253-unified-doc-crud/ledger.md` | เพิ่ม CP-019, CP-020 |

## กฎที่ Lock แล้ว

- Bulk operations ที่ต้อง durable/pollable ต้องผ่าน BullMQ queue + worker (ไม่ใช้ in-memory `void this.processBulk(...)`)
- `correspondences` public ID ใน DB คือ `uuid` (TypeORM `publicId`); raw SQL ต้องใช้ `c.uuid`
- Table `correspondence_status` (singular) ไม่ใช่ `correspondence_statuses`; FK column `cr.correspondence_status_id`
- `VectorSyncService` ใช้ `AiQdrantService.countByDocumentPublicId`/`scrollByProject` + DB existence check

## Verification

- `pnpm tsc --noEmit` backend ✅
- `pnpm lint:ci` backend ✅
- `pnpm lint` frontend ✅
- `pnpm test` backend: 166/166 suites, 2566 tests passed ✅
- frontend `tsc` ✅

## Commits

- `178680ce` feat(bulk-ops): back bulk operations with BullMQ queue and worker
- `fe74b6e3` feat(maintenance): harden Vector Sync for Maintenance Console
