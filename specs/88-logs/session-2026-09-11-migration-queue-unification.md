# Session — 2026-09-11 (Migration Queue Unification + Edge Case Fix)

## Summary

ทำครบ 4 ข้อตามลำดับความสำคัญ: (1) ลบ dead queue `QUEUE_AI_INGEST` (2) เพิ่ม `ai-rag-ingest` + `ai-vector-deletion` ใน monitoring (3) refactor `getQueueByName()` เป็น Map-based registry (4) รวม 18 job name constants ใน `queue.constants.ts`; deploy ไป production แล้ว, ทดสอบ Phase 2+ (RBAC, idempotency, edge cases, performance) ผ่าน; แก้ CI failure (401 test) + แก้ edge case (non-Excel file → 400 แทน 500)

## ปัญหาที่พบ (Root Cause)

1. **Dead queue `QUEUE_AI_INGEST`**: มี `enqueueIngest()` call site ใน `AiIngestService` แต่ไม่มี `@Processor(QUEUE_AI_INGEST)` ลงทะเบียนเลย → job ค้างใน queue ตลอดไป; ADR-047 supersede ด้วย `LegacyIngestionService` ที่ใช้ `ai-batch` queue
2. **Monitoring gap**: `bullmq-metrics.service.ts` ไม่ monitor `ai-rag-ingest` + `ai-vector-deletion` (queues ใหม่จาก B13 fix)
3. **`getQueueByName()` fragile**: ใช้ if-else chain + string literals, รองรับแค่ 3 queues, error message ไม่ dynamic
4. **Job names scattered**: ใช้ string literals ใน services/processors แทน constants
5. **CI failure**: B4 fix เปลี่ยน 401 handler จาก redirect `/login` เป็น `logout()` แต่ test ยัง assert แบบเก่า
6. **Non-Excel file returns 500**: `LegacyIngestionService` ไม่ validate file extension ก่อน `ExcelJS.readFile()` → PDF ทำให้ throw unhandled error

## การแก้ไข (Fix)

| ไฟล์ | การเปลี่ยนแปลง |
| --- | --- |
| `backend/src/modules/common/constants/queue.constants.ts` | ลบ `QUEUE_AI_INGEST`; เพิ่ม 18 job name constants (`JOB_OCR`, `JOB_OCR_EXTRACT`, `JOB_EXTRACT_METADATA`, `JOB_AI_SUGGEST`, `JOB_RAG_QUERY`, `JOB_EMBED_DOCUMENT`, `JOB_SANDBOX_*`, `JOB_MIGRATE_DOCUMENT`, `JOB_RAG_PREPARE`, `JOB_LEGACY_*`, `JOB_CLEAR_FAILED_JOBS`, `JOB_DELETE_DOCUMENT_VECTORS`) |
| `backend/src/modules/ai/ai-queue.service.ts` | ลบ `enqueueIngest()` + `AiIngestJobPayload`; เพิ่ม `queueRegistry: ReadonlyMap`; refactor `getQueueByName()` ใช้ Map; แทน string literals ด้วย constants |
| `backend/src/modules/ai/ai-ingest.service.ts` | ลบ `AiQueueService` dependency (ไม่ enqueue แล้ว — staging records ยังสร้างได้) |
| `backend/src/modules/ai/ai.module.ts` | ลบ `QUEUE_AI_INGEST` จาก BullMQ registration |
| `backend/src/modules/ai/ai.service.ts` | แทน string literals ด้วย `JOB_AI_SUGGEST`, `JOB_EMBED_DOCUMENT`, `JOB_MIGRATE_DOCUMENT` |
| `backend/src/modules/ai/services/migration.service.ts` | แทน `@InjectQueue('ai-batch')` ด้วย `QUEUE_AI_BATCH` + `JOB_EXTRACT_METADATA` |
| `backend/src/modules/monitoring/monitoring.module.ts` | ลบ `QUEUE_AI_INGEST`; เพิ่ม `QUEUE_AI_RAG_INGEST` + `QUEUE_AI_VECTOR_DELETION` |
| `backend/src/modules/monitoring/services/bullmq-metrics.service.ts` | ลบ `QUEUE_AI_INGEST` injection; เพิ่ม 2 queues ใหม่ (7 queues total) |
| `backend/src/modules/monitoring/services/bullmq-metrics.service.spec.ts` | อัปเดต mock queues (6→7), assertions (12→13 params, 36→42 gauge sets) |
| `backend/src/modules/ai/ai-queue.service.spec.ts` | ลบ `QUEUE_AI_INGEST` mock + `enqueueIngest()` tests |
| `backend/src/modules/ai/ai-ingest.service.spec.ts` | ลบ `AiQueueService` mock + `enqueueIngest()` assertions |
| `backend/src/modules/ai/ai-rag-pipeline.integration.spec.ts` | ลบ `QUEUE_AI_INGEST` mock provider |
| `frontend/lib/api/__tests__/client.test.ts` | อัปเดต 401 test: assert `logout()` แทน `mockLocation.href === '/login'` (B4 fix) |
| `backend/src/modules/migration/services/legacy-ingestion.service.ts` | เพิ่ม `.xlsx` extension validation ก่อน processing → `BadRequestException` (400) |
| `specs/999-test-plan/migration-admin-unified-test-plan.md` | เพิ่ม Section 14: Phase 2+ Execution Results |

## กฎที่ Lock แล้ว

- **D310**: `QUEUE_AI_INGEST` เป็น dead queue — ลบแล้ว, ADR-047 `LegacyIngestionService` ใช้ `ai-batch` queue ผ่าน `legacy-ai-enrichment` job
- **D311**: `getQueueByName()` ใช้ Map-based registry (`ReadonlyMap<string, Queue<unknown>>`) — รองรับทุก queue, error message dynamic จาก `queueRegistry.keys()`
- **D312**: Job names รวมเป็น constants ใน `queue.constants.ts` — 18 constants ใหม่, แทน string literals ใน services/processors
- **D313**: Monitoring ครอบคลุม 7 queues: `ai-realtime`, `ai-batch`, `ai-rag-query`, `ai-rag-ingest`, `ai-vector-deletion`, `np-dms-ocr`, `np-dms-ai`
- **D314**: `LegacyIngestionService` validate `.xlsx` extension ก่อน processing — non-Excel → 400 `BadRequestException`

## Verification

- [x] TypeScript typecheck: 0 errors
- [x] Backend tests: 2892 passed (196 suites)
- [x] Frontend test fix: 13/13 passed (client.test.ts)
- [x] Production deploy: image `9274a0578930` healthy
- [x] Metrics endpoint: 7 queues แสดงครบ, `ai-ingest` หายไป
- [x] RBAC: viewer01 + editor01 → 403 ทุก migration endpoint; admin → 201/200
- [x] Idempotency: re-ingest ไม่สร้าง duplicate; double approve blocked by IMPORTED status
- [x] Edge cases: non-existent file → 404; invalid UUID → 400; empty body → 400; non-Excel → 400 (หลัง fix)
- [x] Performance: queue list ~7-10ms, metrics ~2ms
- [x] Commits: `9274a057` (queue unification) + `abce822f` (test plan docs) + `004f9aa4` (401 test fix) + `44081518` (file extension validation)
