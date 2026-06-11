// File: specs/200-fullstacks/235-ai-runtime-policy-refactor/plan.md
// Change Log:
// - 2026-06-11: Initial implementation plan for AI Runtime Policy Refactor

# Implementation Plan: AI Runtime Policy Refactor

**Branch**: `235-ai-runtime-policy-refactor` | **Date**: 2026-06-11 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `specs/200-fullstacks/235-ai-runtime-policy-refactor/spec.md`

## Summary

Refactor AI runtime ของ LCBP3-DMS ให้รองรับ GPU ใหม่ (RTX 5060 Ti 16GB) โดย: (A) เปลี่ยน API contract ให้ใช้ `executionProfile` แทน caller-driven model selection, (B) สร้าง backend policy mapping layer, (C) เพิ่ม adaptive OCR residency, (D) เพิ่ม CPU fallback สำหรับ retrieval acceleration, และ (E) ปรับ BullMQ queue concurrency พร้อม verification suite ครอบคลุม big bang cutover gate ทั้ง 4 แกน

---

## Technical Context

**Language/Version**: TypeScript 5.x (NestJS 10, Next.js 14), Python 3.11 (OCR sidecar FastAPI)
**Primary Dependencies**:
- Backend: NestJS, BullMQ, TypeORM, CASL, class-validator, class-transformer
- Frontend: Next.js, TanStack Query, Zod, shadcn/ui
- Sidecar: FastAPI, PyMuPDF (fitz), typhoon-ocr, httpx, FlagEmbedding
- Infrastructure: Ollama (Desk-5439), Redis, MariaDB
**Storage**: MariaDB (ai_audit_logs, ai_prompts, ai_intent_patterns), Redis (BullMQ, cache)
**Testing**: Jest (backend unit/integration), Vitest (frontend), Pytest (sidecar)
**Target Platform**: QNAP NAS (backend/frontend containers), Desk-5439 (Ollama + OCR sidecar)
**Performance Goals**: OCR cold start < 5s (with residency), retrieval CPU fallback < 30s timeout
**Constraints**: Big bang rollout — no legacy parallel path; LLM-First GPU ownership must be enforced
**Scale/Scope**: Single-server AI stack on Desk-5439; BullMQ concurrency max `ai-realtime: 2`, `ai-batch: 1`

---

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Rule | Status | Notes |
|------|--------|-------|
| ADR-019 UUID: no parseInt on UUID | ✅ Pass | No new UUID handling in this feature |
| ADR-009: No TypeORM migrations | ✅ Pass | No schema changes required |
| ADR-016 Security: CASL Guard on all API | ✅ Required | `large-context` profile must have CASL admin check |
| ADR-007 Error Handling: layered classification | ✅ Required | 400 (validation), 403 (profile auth), 504 (CPU timeout) |
| ADR-008 BullMQ: no inline jobs | ✅ Pass | Queue policy adjustment, not new inline processing |
| ADR-023/023A AI Boundary: no direct DB/storage | ✅ Pass | Policy layer stays in NestJS service |
| ADR-023A BullMQ 2-queue: ai-realtime + ai-batch | ✅ Required | concurrency adjustment within existing queues |
| ADR-002 Doc Numbering: Redis Redlock | ✅ N/A | Not applicable to this feature |
| TypeScript: no `any`, no `console.log` | ✅ Required | All new TypeScript code must comply |
| File headers: `// File: path/filename` | ✅ Required | All new files must have header |

**No constitution violations.** Proceeding to Phase 0.

---

## Project Structure

### Documentation (this feature)

```text
specs/200-fullstacks/235-ai-runtime-policy-refactor/
├── spec.md               # Feature specification
├── plan.md               # This file
├── research.md           # Phase 0 output
├── data-model.md         # Phase 1 output
├── quickstart.md         # Phase 1 output
├── tasks.md              # Phase 2 output
├── checklists/
│   └── requirements.md
└── contracts/
    ├── create-ai-job.dto.ts.md
    ├── execution-policy.interface.ts.md
    └── ocr-residency-policy.interface.ts.md
```

### Source Code (repository root)

```text
backend/src/modules/ai/
├── dto/
│   ├── create-ai-job.dto.ts          # [MODIFY] เอา model.key ออก, เพิ่ม executionProfile
│   └── ai-job-response.dto.ts        # [MODIFY] เพิ่ม modelUsed canonical name
├── services/
│   ├── ai.service.ts                  # [MODIFY] เพิ่ม profile validation + canonical name
│   ├── ai-policy.service.ts           # [NEW] ExecutionProfile → RuntimePolicy mapping
│   ├── ocr.service.ts                 # [MODIFY] เพิ่ม adaptive residency calculation
│   └── vram-monitor.service.ts        # [NEW] VRAM headroom query service
├── processors/
│   ├── ai-batch.processor.ts          # [MODIFY] ใช้ policy จาก AiPolicyService
│   └── ai-realtime.processor.ts       # [MODIFY] lightweight job classification + concurrency
├── interfaces/
│   ├── execution-policy.interface.ts  # [NEW] RuntimePolicy type definition
│   └── ocr-residency.interface.ts     # [NEW] OcrResidencyDecision type
├── guards/
│   └── execution-profile.guard.ts     # [NEW] large-context profile admin check
└── ai.module.ts                       # [MODIFY] register new services + guard

backend/src/config/
└── bullmq.config.ts                   # [MODIFY] ai-realtime concurrency uplift config

specs/04-Infrastructure-OPS/04-00-docker-compose/Desk-5439/ocr-sidecar/
├── app.py                             # [MODIFY] adaptive keep_alive, CPU fallback embed/rerank
├── services/
│   ├── vram_monitor.py                # [NEW] VRAM headroom query via Ollama API
│   └── residency_policy.py           # [NEW] keep_alive calculation policy
└── requirements.txt                   # [MODIFY] add nvidia-ml-py or pynvml if needed

frontend/
├── types/
│   └── ai.ts                          # [MODIFY] เอา model fields ออก, เพิ่ม executionProfile
├── lib/services/
│   └── admin-ai.service.ts            # [MODIFY] update types + canonical name display
└── components/admin/ai/
    └── OcrSandboxPromptManager.tsx    # [MODIFY] แสดง canonical names ใน UI

backend/src/modules/ai/
└── tests/
    ├── ai-policy.service.spec.ts       # [NEW] unit tests profile mapping
    ├── ocr-residency.spec.ts           # [NEW] unit tests adaptive residency
    └── execution-profile.guard.spec.ts # [NEW] unit tests CASL guard
```

---

## Phases

### Phase 1: Foundational — Policy Infrastructure

ต้องเสร็จก่อน workstream อื่นทั้งหมด:

1. สร้าง `VramMonitorService` — query VRAM headroom จาก Ollama `/api/ps` endpoint
2. สร้าง `AiPolicyService` — mapping `ExecutionProfile` → `RuntimePolicy`
3. สร้าง `ExecutionProfileGuard` — CASL check สำหรับ `large-context`
4. แก้ `CreateAiJobDto` — เอา `model.key` + parameter overrides ออก
5. แก้ `vram_monitor.py` บน sidecar — query GPU headroom

### Phase 2: Contract & Canonical Naming (Workstream A)

1. แก้ `AiService` — validate profile, override data-affecting jobs, log canonical names
2. แก้ `ai-job-response.dto.ts` — `modelUsed` เป็น canonical name
3. แก้ Frontend types และ Admin Console UI — แสดง canonical names
4. เพิ่ม rejection tests สำหรับ `model.key` และ parameter overrides

### Phase 3: Adaptive OCR Residency (Workstream B)

1. แก้ `OcrService` — inject `VramMonitorService`, คำนวณ `keep_alive` แบบ dynamic
2. แก้ `residency_policy.py` บน sidecar — รับ `keep_alive` จาก backend policy
3. เพิ่ม unit tests residency scenarios

### Phase 4: Retrieval Acceleration (Workstream C)

1. แก้ `app.py` — เพิ่ม GPU headroom check ใน `/embed` และ `/rerank`
2. เพิ่ม CPU fallback path พร้อม log
3. แก้ `ai-batch.processor.ts` สำหรับ RAG query fallback handling

### Phase 5: Queue Policy (Workstream D)

1. แก้ `bullmq.config.ts` — `ai-realtime` concurrency = 2 (configurable)
2. แก้ `ai-realtime.processor.ts` — classify lightweight vs generation-heavy jobs
3. ตรวจว่า `rag-query` ถูก route ไป `ai-batch` เท่านั้น

### Phase 6: Verification & Cutover (Workstream E)

1. รวม test suite ทั้ง 4 แกน
2. Manual validation checklist (Admin Console, OCR Sandbox)
3. Cutover gate verification

---

## Complexity Tracking

ไม่มี constitution violations ที่ต้องอธิบาย
