# Session 2026-09-10 — Feature 254 Code Review Remediation + Deploy Blocker Fix

## Summary

แก้ไข code review findings ของ Feature 254 (RAG Attachment Chunks) ทั้ง 6 recommended actions + 2 suggestions และแก้ deploy blocker ที่พบหลัง push — backend container crash-loop เพราะ `AiModule` ไม่ได้ import `CaslModule` ทำให้ `RagClassificationService` resolve `AbilityFactory` ไม่ได้

## ปัญหาที่พบ (Root Cause)

### 1. Code Review Findings (6 actions + 2 suggestions)

- **HIGH — TOCTOU race ใน `activate()`**: `RagAttachmentIngestionService.activate()` อ่าน generation นอก transaction แล้ว validate/retire/activate ใน transaction — ช่องว่างให้ race condition เปลี่ยนสถานะระหว่าง read กับ write
- **MEDIUM — ลำดับ upsert/activate**: Processor เรียก `activate()` ก่อน `qdrantService.upsert()` ทำให้ generation เป็น ACTIVE ก่อนที่ vectors จะอยู่ใน Qdrant — retrieval อาจได้ผลลัพธ์ว่าง
- **MEDIUM — Duplicate lifecycle methods**: `markVerified`/`activate`/`markFailed`/`getStatus` ถูก copy ระหว่าง `RagAttachmentIngestionService` และ `RagGenerationService` — divergent behavior risk
- **MEDIUM — createSegment docstring ผิด**: JSDoc อ้างว่าใช้ `SecureArchiveService` ใน `createSegment()` แต่จริง ๆ แค่ parse OCR text ด้วย regex
- **LOW — `force` variable unused**: destructured `force` จาก `job.data` แต่ใช้แค่ใน log ไม่ได้มีผลต่อ processor behavior
- **LOW — `markFailed` ใน catch block ไม่ robust**: ถ้า `markFailed()` ล้มเหลวเอง (DB down) error จะ propagate เป็น unhandled rejection

### 2. Deploy Blocker — `AbilityFactory` DI failure

หลัง push commit `efef87e7` (code review remediation) backend container crash-loop ด้วย:

```
Nest can't resolve dependencies of the RagClassificationService
(AttachmentRepository, AuditLogRepository, ?, RagAttachmentGenerationRepository, AiQueueService).
Please make sure that the argument AbilityFactory at index [2] is available in the AiModule.
```

**Root cause**: `RagClassificationService` และ `RagRetrievalGuardService` inject `AbilityFactory` (จาก `CaslModule`) แต่ `AiModule` ไม่ได้ import `CaslModule` โดยตรง — `AiToolModule` import `CaslModule` แต่ export เฉพาะ `AiToolRegistryService` ไม่ได้ export `AbilityFactory` ออกมา

**ทำไมไม่พบตอน test**: unit test mock `AbilityFactory` ตรงใน testing module; E2E test ไม่ bootstrap `AiModule` เต็มรูปแบบ — DI wiring จะพบได้จริง ๆ ตอน runtime startup ของ production container เท่านั้น

## การแก้ไข (Fix)

| ไฟล์ | การเปลี่ยนแปลง |
| --- | --- |
| `backend/src/modules/ai/services/rag-attachment-ingestion.service.ts` | ย้าย `findOne` เข้าใน `dataSource.transaction()` (TOCTOU fix); delegate `markVerified`/`activate`/`markFailed`/`getStatus` ไป `RagGenerationStateService` |
| `backend/src/modules/ai/services/rag-generation.service.ts` | Delegate lifecycle methods ไป `RagGenerationStateService`; ลบ unused imports (`DataSource`, `RagAttachmentChunk`) |
| `backend/src/modules/ai/services/rag-generation-state.service.ts` | **ไฟล์ใหม่** — shared service รวม `markVerified`/`activate`/`markFailed`/`getStatus` พร้อม transaction-safe `activate()` |
| `backend/src/modules/ai/services/rag-generation-state.service.spec.ts` | **ไฟล์ใหม่** — 12 tests ครอบคลุมทุก method |
| `backend/src/modules/ai/services/rag-attachment-ingestion.service.spec.ts` | แก้ tests จาก direct repository assertions → delegation assertions |
| `backend/src/modules/ai/services/rag-generation.service.spec.ts` | แก้ tests จาก direct repository assertions → delegation assertions |
| `backend/src/modules/ai/processors/rag-attachment-ingest.processor.ts` | เปลี่ยน order เป็น `markVerified → upsert → activate`; แก้ `createSegment` JSDoc; prefix `force` → `_force`; wrap `markFailed` ใน nested try-catch |
| `backend/src/modules/ai/processors/rag-attachment-ingest.processor.spec.ts` | เพิ่ม 2 tests: Qdrant upsert failure + markFailed failure |
| `backend/src/modules/ai/ai.module.ts` | Register `RagGenerationStateService` ใน providers; **import `CaslModule`** (deploy blocker fix) |

## กฎที่ Lock แล้ว

- **D297**: `AiModule` ต้อง import `CaslModule` โดยตรง — `AiToolModule` import `CaslModule` แต่ export เฉพาะ `AiToolRegistryService` ไม่ได้ re-export `AbilityFactory`; ถ้า service ใน `AiModule` (นอก `AiToolModule`) inject `AbilityFactory` ต้อง import `CaslModule` ที่ `AiModule` ระดับบนสุด
- **D298**: Transaction-safe activation pattern — `findOne` + status validation + retire + activate ต้องอยู่ใน `dataSource.transaction()` เดียวกันเสมอ (TOCTOU); ใช้ `manager.getRepository()` ภายใน callback
- **D299**: Qdrant upsert ต้องเสร็จก่อน `activate()` — ลำดับคือ `markVerified → upsert → activate`; ถ้า upsert ล้มเหลวต้อง `markFailed` และห้าม activate
- **D300**: Shared `RagGenerationStateService` เป็น single source of truth สำหรับ generation lifecycle (`markVerified`/`activate`/`markFailed`/`getStatus`) — ห้าม duplicate logic ใน consuming services
- **D301**: `markFailed` ใน catch block ต้อง wrap ด้วย nested try-catch — ถ้า `markFailed` ล้มเหลวเอง ให้ log error และ preserve original error context ห้าม propagate เป็น unhandled rejection

## Verification

- [x] TypeScript: `tsc --noEmit` ผ่าน
- [x] ESLint: 0 errors บน 9 changed files
- [x] Tests: 2865 passed, 0 failed, 17 skipped (เพิ่ม 1 จาก 2864 ด้วย state service spec ใหม่)
- [x] RAG-specific: 12 processor tests + 14 ingestion service + 12 state service + 12 generation service = 50 tests ผ่าน
- [x] Backend container: healthy (`/ping` 200 OK)
- [x] Frontend container: healthy (depends_on backend healthy)
- [x] Pushed: `efef87e7` (code review) + `5b8b9b7e` (deploy blocker fix) ไป `origin/main`
