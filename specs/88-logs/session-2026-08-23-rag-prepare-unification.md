# Session 2026-08-23 — RAG pipeline unification หลัง Execute Import

## Summary

ปรับ `Execute Import` (Migration) ให้ใช้ `rag-prepare` เส้นเดียวกับเอกสารปกติ แทนการเรียก `embed-document` โดยตรง และแก้ `processRagPrepare` ให้อ่าน persisted `ocr_text` จาก `attachmentPublicId` ก่อน แล้วอัปเดต ADR-047 ให้สอดคล้องกับ pipeline ใหม่

## ปัญหาที่พบ (Root Cause)

- `MigrationService.importCorrespondence` (ผ่าน `approveQueueItemByPublicId`) ไม่บันทึก OCR text ลง Attachment/Revision จริง และไม่ได้ trigger RAG หลัง import
- `MigrationReviewService` ใช้ `RagBatchService.triggerEmbeddingForQueueItem` ส่ง `embed-document` โดยตรง โดยใช้ `queuePublicId` เป็น `documentPublicId` ทำให้ Qdrant point ID ไม่ตรงกับเอกสารจริง
- `processRagPrepare` อ่าน `ocr_text` ด้วย `documentPublicId` ซึ่งคือ `correspondence.publicId` ไม่ใช่ `attachment.publicId` ทำให้ไม่สามารถ reuse persisted OCR ได้

## การแก้ไข (Fix)

| ไฟล์ | การเปลี่ยนแปลง |
| --- | --- |
| `backend/src/modules/migration/migration.service.ts` | บันทึก `ocrText` ลง `Attachment.ocr_text` + fallback `Revision.body`; trigger `rag-prepare` หลัง commit; `approveQueueItem`/`approveQueueItemByPublicId` ส่ง `ocrText` จาก queue |
| `backend/src/modules/migration/services/rag-batch.service.ts` | เพิ่ม `enqueueRagPrepare(payload)` แทน `triggerEmbeddingForQueueItem` |
| `backend/src/modules/ai/processors/ai-batch.processor.ts` | `processRagPrepare` อ่าน `ocr_text` จาก `attachmentPublicId` ก่อน (fallback `documentPublicId`) |
| `backend/src/modules/migration/migration-review.service.ts` | `updateQueueOcr` บันทึก OCR ลง queue โดยไม่ trigger RAG; `commitRecord` ใช้ `enqueueRagPrepare` ถ้าถูกเรียก |
| `backend/src/modules/migration/dto/import-correspondence.dto.ts` | เพิ่ม `ocrText?: string` |
| `specs/06-Decision-Records/ADR-047-native-backend-legacy-ingestion.md` | อัปเดต D4 และ D3 ให้สอดคล้องกับ `rag-prepare` pipeline |

## กฎที่ Lock แล้ว

- RAG ของเอกสารทั่วไป + Migration ต้องผ่าน `rag-prepare` job เส้นเดียวกัน
- `rag-prepare` payload ต้องส่ง `attachmentPublicId` + `cachedOcrText` เพื่อ reuse persisted OCR
- `processRagPrepare` อ่าน `Attachment.ocr_text` โดยใช้ `attachmentPublicId` ก่อนเสมอ
- แก้ OCR ในหน้า Review จะไม่ trigger RAG ทันที — RAG ทำงานหลัง `Execute Import` เท่านั้น

## Verification

- `npx tsc --noEmit` ✅
- `pnpm lint` ✅
- `npx jest src/modules/migration` ✅ (110 tests)
- `npx jest src/modules/ai` ✅ (329 tests)

## Commits

- `559ee759` fix(migration/rag): ใช้ rag-prepare เส้นเดียวกับเอกสารปกติหลัง Execute Import
- `3dc0da72` docs(adr-047): อัปเดต RAG lifecycle ให้สอดคล้องกับ rag-prepare pipeline
