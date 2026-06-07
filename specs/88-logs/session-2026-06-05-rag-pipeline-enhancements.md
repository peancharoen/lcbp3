# Session 14 — 2026-06-05 (RAG Pipeline Enhancements / Spec 234 / ADR-035)

## Summary

ปรับโค้ดให้สอดคล้องกับ feature `234-rag-pipeline-enhancements` และ `ADR-035-ai-pipeline-flow-architecture` โดยปิด compile blockers ของ RAG pipeline ใหม่, บังคับ tenant scope ผ่าน `projectPublicId` ใน vector deletion path, ย้าย dashboard ไปใช้ `/ai/rag/*`, และ retire runtime surface ของ legacy `/rag/*`

## Backend Changes (B1-B6)

- **Compile blockers fixed (4 จุด):**
  - ปรับ `ai-batch.processor.ts` ให้ legacy `embed-document` path ส่งข้อมูลตาม signature ใหม่ของ `EmbeddingService.embedDocument(...)`
  - เพิ่ม `projectPublicId` ใน `AiVectorDeletionJobPayload` และ propagate ผ่าน `AiQueueService` + `vector-deletion.processor.ts`
  - ปรับ typing ใน `src/modules/ai/qdrant.service.ts` ให้รองรับ hybrid upsert contract ของ Qdrant client
  - แก้ nullability ใน `correspondence-workflow.service.ts` สำหรับ trigger `enqueueRagPrepare()`
- **Legacy delete path hardening:** `backend/src/modules/rag/rag.service.ts` เปลี่ยน `deleteVectors()` ให้ resolve `projectPublicId` จาก `DocumentChunk`/server-side context ก่อน ไม่เชื่อ query param จาก client เป็นหลัก
- **Legacy runtime deprecation:** mark `backend/src/modules/rag/rag.controller.ts` และ endpoint summaries เป็น deprecated ชั่วคราวระหว่าง audit
- **Legacy runtime removal:** หลัง consumer audit ใน repo ไม่พบ caller ของ `/rag/status`, `/rag/ingest`, `/rag/vectors`, `/rag/admin/init-collection`, จึงถอด `RagModule` ออกจาก `backend/src/app.module.ts` และลบ `backend/src/modules/rag/rag.controller.ts` + `rag.module.ts`

## Frontend Changes (F1-F2)

- **Dashboard RAG migration:** `frontend/app/(dashboard)/rag/page.tsx` เปลี่ยนมาใช้ `RagChatWidget` ซึ่งวิ่งผ่าน `POST /ai/rag/query` และ `GET /ai/rag/jobs/:requestPublicId`
- **Legacy frontend cleanup:** ลบ `frontend/hooks/use-rag.ts` และ `frontend/components/rag/*` ที่ไม่ถูกใช้งานแล้ว

## Architecture / Documentation Updates

- **ADR-035:** เพิ่มและอัปเดต Legacy Compatibility Note ให้สะท้อนสถานะจริงของ migration ไป `/ai/rag/*`
- **Current runtime state:** `/rag/*` ไม่ถูก mount ใน `AppModule` แล้ว; flow หลักของระบบใช้ `AiModule` + `/ai/rag/*`

## Verification

- `pnpm --filter backend build` — ✅ ผ่าน
- `pnpm --filter backend lint:ci` — ✅ ผ่าน
- `pnpm --filter backend test -- --runTestsByPath src/modules/ai/processors/ai-batch.processor.spec.ts src/modules/ai/services/embedding.service.spec.ts` — ✅ ผ่าน
- `pnpm --filter backend test -- --runTestsByPath src/modules/rag/__tests__/rag.service.spec.ts` — ✅ ผ่าน
- `pnpm --filter lcbp3-frontend lint` — ✅ ผ่าน
- `pnpm exec tsc --noEmit -p frontend/tsconfig.json` — ✅ ผ่าน

## Follow-up Completed (Session 14+)

- ✅ แก้ `backend/src/modules/ai/qdrant.service.ts` — `ensureCollection()` ตรวจ schema ก่อน delete: ถ้าเป็น Hybrid 1024 dims แล้ว skip recreation
- ✅ ย้าย `rag-prepare` enqueue ใน `CorrespondenceWorkflowService.syncStatus()` ไปหลัง commit — after-commit pattern ด้วย `triggerRagPrepare()`
- ✅ ลบ `backend/src/modules/rag/` ทั้งหมด (audit ไม่พบ import จาก backend/src)
- ✅ สร้าง `backend/src/modules/ai/ai-qdrant.service.spec.ts` — regression test สำหรับ `deleteByDocumentPublicId()` (4/4 ผ่าน)
- ✅ Code Review Fixes (Session 14+): try-catch after-commit, `createPayloadIndexes()` private, defensive vector size check, `skipRagPrepare` flag
- ✅ F5 (Session 15): เพิ่ม `ai-rag-pipeline.integration.spec.ts` — 9 integration tests ครอบคลุม SC-002, SC-003, SC-006, FR-005, jobId dedup
