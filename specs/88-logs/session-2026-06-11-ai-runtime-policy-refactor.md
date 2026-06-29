# Session 17 — 2026-06-11 (AI Runtime Policy Refactor — Feature-235)

## Summary

Implement Feature-235 AI Runtime Policy Refactor ตาม spec.md และ plan.md บน branch `235-ai-runtime-policy-refactor` — เปลี่ยน API contract ให้ caller ส่ง job type เท่านั้น (ไม่มี `model.key` / parameter overrides), เพิ่ม backend policy mapping layer (`AiPolicyService`), adaptive OCR residency, CPU fallback retrieval, และ BullMQ queue policy — จบด้วย test suite 23/23 ผ่านครบ, ESLint + tsc clean.

## ปัญหาที่พบ (Root Cause)

| ปัญหา | สาเหตุ | การแก้ไข |
|---|---|---|
| `VramStatus` / `getVramStatus()` / `invalidateCache()` หาย | refactor ก่อนหน้าลบออก แต่ controller ยังใช้ | Restore เมธอดใน `vram-monitor.service.ts` |
| TS2367 ใน `ai-policy.service.ts` | compare `ExecutionProfile` กับ `'ocr-extract'` ผิด type | แก้ compare เป็น `'np-dms-ai'` |
| TS1272 `import type` ใน DTO | import ประกอบ class ด้วย `import type` ไม่ได้ | เปลี่ยนเป็น regular import |
| `any` types ใน `ai-batch.processor.ts` | `snapshotParams` / `effectiveProfile` ไม่มี typed | กำหนด interface `AiBatchJobData` runtime metadata |
| NestJS DI error ใน `ai.controller.spec.ts` | ขาด mock `'default_IORedisModuleConnectionToken'` | เพิ่ม mock provider ใน test module providers |

## การแก้ไข (Fix)

| ไฟล์ | การเปลี่ยนแปลง |
|---|---|
| `backend/src/modules/ai/services/vram-monitor.service.ts` | Restore `VramStatus`, `getVramStatus()`, `invalidateCache()` |
| `backend/src/modules/ai/services/ai-policy.service.ts` | แก้ TS2367 type comparison; เพิ่ม `getProfileForJobType()`, `createJobPayload()` |
| `backend/src/modules/ai/interfaces/execution-policy.interface.ts` | สร้างใหม่ — `ExecutionProfile`, `RuntimePolicy`, `AiJobPayload`, `VramHeadroom` |
| `backend/src/modules/ai/interfaces/ocr-residency.interface.ts` | สร้างใหม่ — `OcrResidencyDecision` |
| `backend/src/modules/ai/dto/create-ai-job.dto.ts` | ลบ `model.key`, `executionProfile`, `temperature`, `top_p`, `maxTokens`; เพิ่ม forbidden field validators |
| `backend/src/modules/ai/dto/ai-job-response.dto.ts` | เพิ่ม `modelUsed`, `effectiveProfile` fields |
| `backend/src/modules/ai/ai.service.ts` | inject `AiPolicyService`; กำหนด `effectiveProfile` จาก job type อัตโนมัติ |
| `backend/src/modules/ai/processors/ai-realtime.processor.ts` | เพิ่ม lightweight job classification; redirect heavy jobs ไป ai-batch |
| `backend/src/modules/ai/processors/ai-batch.processor.ts` | type-safe runtime policy metadata; log `retrievalDevice`; canonical `ocrUsed` |
| `backend/src/modules/ai/services/ocr.service.ts` | inject `VramMonitorService`; `calculateOcrResidency()` dynamic keep_alive |
| `backend/src/config/bullmq.config.ts` | เพิ่ม `REALTIME_CONCURRENCY` env (default 2) |
| `backend/src/modules/ai/ai.module.ts` | register `AiPolicyService`, `VramMonitorService` |
| `backend/src/modules/ai/guards/execution-profile.guard.ts` | สร้างใหม่ (สำรองไว้; ไม่ใช้ใน option B) |
| `backend/src/modules/ai/tests/ai-policy.service.spec.ts` | สร้างใหม่ — 7 tests ผ่าน |
| `backend/src/modules/ai/tests/ocr-residency.spec.ts` | สร้างใหม่ — 5 tests ผ่าน |
| `backend/src/modules/ai/tests/queue-policy.spec.ts` | สร้างใหม่ — 2 tests ผ่าน |
| `backend/src/modules/ai/tests/vram-monitor.service.spec.ts` | สร้างใหม่ — 5 tests ผ่าน |
| `backend/src/modules/ai/tests/ai.controller.spec.ts` | สร้างใหม่ — 4 integration tests ผ่าน; เพิ่ม Redis mock |
| `frontend/types/ai.ts` | ลบ `model` field; เพิ่ม `executionProfile?`, `modelUsed?` |
| `frontend/lib/services/admin-ai.service.ts` | อัปเดต types ตาม DTO ใหม่ |
| `frontend/components/admin/ai/OcrSandboxPromptManager.tsx` | แสดง `np-dms-ai` / `np-dms-ocr` แทน runtime names |
| `frontend/app/(admin)/admin/ai/page.tsx` | แสดง canonical names ใน System Health panel |
| `frontend/public/locales/en/ai.json` | เพิ่ม `ai_runtime_policy` namespace |
| `frontend/public/locales/th/ai.json` | เพิ่ม `ai_runtime_policy` namespace |
| `backend/.env.example` | เพิ่ม `AI_OCR_RESIDENCY_WINDOW_SECONDS` |
| `specs/04-Infrastructure-OPS/04-00-docker-compose/Desk-5439/.env.template` | สร้างใหม่ — VRAM + residency + concurrency vars |
| `specs/04-Infrastructure-OPS/04-00-docker-compose/Desk-5439/ocr-sidecar/app.py` | adaptive `keep_alive` param; CPU fallback บน `/embed` + `/rerank` |
| `specs/04-Infrastructure-OPS/04-00-docker-compose/Desk-5439/ocr-sidecar/services/vram_monitor.py` | สร้างใหม่ — query Ollama `/api/ps` |
| `specs/04-Infrastructure-OPS/04-00-docker-compose/Desk-5439/ocr-sidecar/services/residency_policy.py` | สร้างใหม่ — keep_alive calculation |
| `CONTEXT.md` | เพิ่ม Feature-235 ใน System Readiness + ADR-034 ใน ADRs table |

## กฎที่ Lock แล้ว

- **Option B (Policy-Only)**: Caller ไม่มี `executionProfile` field ใน `CreateAiJobDto` — backend กำหนด profile จาก `job.type` เท่านั้น (ไม่รับ caller input)
- **Canonical Model Identity**: `np-dms-ai` (LLM) / `np-dms-ocr` (OCR) ทุก layer ที่ผู้ใช้เห็น — ชื่อ runtime (`typhoon*`) ใช้เฉพาะ ops internals
- **Redis mock token**: ทุก test ที่ bootstrap `AiController` ต้องเพิ่ม `'default_IORedisModuleConnectionToken'` ใน providers
- **Lightweight Realtime Jobs**: เฉพาะ `intent-classify`, `tool-suggest` — ห้าม `rag-query` อยู่ใน ai-realtime

## Verification

- [x] `npx jest src/modules/ai/tests/` — 23/23 tests ผ่าน (5 suites)
- [x] `npx tsc --noEmit` — ไม่มี error
- [x] `npx eslint src/modules/ai/ --max-warnings=0` — ไม่มี warning
- [ ] T032: Manual validation Gate 1–4 ตาม `quickstart.md` (ต้องรันบน environment จริง)
