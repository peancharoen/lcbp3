// File: specs/200-fullstacks/235-ai-runtime-policy-refactor/tasks.md
// Change Log:
// - 2026-06-11: Initial task list for AI Runtime Policy Refactor

# Tasks: AI Runtime Policy Refactor

**Input**: Design documents from `specs/200-fullstacks/235-ai-runtime-policy-refactor/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: US1=Contract&Naming, US2=OCR Residency, US3=Retrieval Fallback, US4=Queue Policy, US5=Verification

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: สร้าง foundational types และ interfaces ก่อน workstream ทุกอัน

- [ ] T001 สร้าง interface file `backend/src/modules/ai/interfaces/execution-policy.interface.ts` (ExecutionProfile type, RuntimePolicy interface, VramHeadroom interface)
- [ ] T002 สร้าง interface file `backend/src/modules/ai/interfaces/ocr-residency.interface.ts` (OcrResidencyDecision interface)
- [ ] T003 [P] สร้าง `backend/src/modules/ai/services/vram-monitor.service.ts` — query Ollama `/api/ps` เพื่อคำนวณ VRAM headroom
- [ ] T004 [P] สร้าง `specs/04-Infrastructure-OPS/04-00-docker-compose/Desk-5439/ocr-sidecar/services/vram_monitor.py` — Python VRAM headroom query via Ollama `/api/ps`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Policy infrastructure ที่ทุก workstream ต้องพึ่งพา — MUST complete ก่อนทุก user story

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T005 สร้าง `backend/src/modules/ai/services/ai-policy.service.ts` — ExecutionProfile → RuntimePolicy mapping, canonical model name mapping, data-affecting job override logic
- [ ] T006 สร้าง `backend/src/modules/ai/guards/execution-profile.guard.ts` — CASL check: `large-context` เฉพาะ admin role
- [ ] T007 [P] แก้ `backend/src/modules/ai/dto/create-ai-job.dto.ts` — เอา `model.key` และ parameter override fields ออก, เพิ่ม `executionProfile?: ExecutionProfile` พร้อม class-validator
- [ ] T008 สร้าง `specs/04-Infrastructure-OPS/04-00-docker-compose/Desk-5439/ocr-sidecar/services/residency_policy.py` — OCR keep_alive calculation function
- [ ] T009 แก้ `backend/src/modules/ai/ai.module.ts` — register `AiPolicyService`, `VramMonitorService`, `ExecutionProfileGuard`

**Checkpoint**: Foundation ready — policy services, guard, and updated DTO available

---

## Phase 3: User Story 1 — Policy Contract & Canonical Naming (P1) 🎯 MVP

**Goal**: API reject `model.key`/parameter overrides; ทุก layer แสดง canonical names; data-affecting jobs ถูก override

**Independent Test**: ยิง POST ด้วย `model.key` → ต้องได้ 400; ยิงด้วย `executionProfile: "balanced"` → ต้องได้ 201 + `modelUsed: "np-dms-ai"`

### Implementation for User Story 1

- [ ] T010 [US1] แก้ `backend/src/modules/ai/ai.service.ts` — inject `AiPolicyService`, validate `executionProfile`, apply backend override สำหรับ `migrate-document` และ `auto-fill-document`, set `modelUsed` canonical name ใน audit log
- [ ] T011 [P] [US1] แก้ `backend/src/modules/ai/dto/ai-job-response.dto.ts` — เพิ่ม `modelUsed: 'np-dms-ai' | 'np-dms-ocr'` field, เพิ่ม `executionProfile` field (effective profile หลัง override)
- [ ] T012 [P] [US1] แก้ `backend/src/modules/ai/ai.controller.ts` — ใช้ `ExecutionProfileGuard` บน create-job endpoint, validate forbidden fields ใน pipe
- [ ] T013 [P] [US1] แก้ `frontend/types/ai.ts` — เอา `model` field ออก, เพิ่ม `executionProfile?: ExecutionProfile`, เพิ่ม `modelUsed?: string`
- [ ] T014 [US1] แก้ `frontend/lib/services/admin-ai.service.ts` — update request/response types ให้สอดคล้องกับ DTO ใหม่
- [ ] T015 [P] [US1] แก้ `frontend/components/admin/ai/OcrSandboxPromptManager.tsx` — แสดง `np-dms-ai` / `np-dms-ocr` แทนชื่อ runtime ใน result cards และ model info
- [ ] T016 [US1] แก้ `frontend/app/(admin)/admin/ai/page.tsx` — แสดง canonical names ใน System Health panel และ model status cards

**Checkpoint**: US1 fully functional — policy contract enforced, canonical naming in all layers

---

## Phase 4: User Story 2 — Adaptive OCR Residency (P2)

**Goal**: `OcrService` คำนวณ `keep_alive` dynamic ตาม VRAM headroom + active profile; sidecar รับค่าและใช้

**Independent Test**: ดู log จาก OCR job ใน high-pressure scenario → `keep_alive=0`; ใน headroom-sufficient scenario → `keep_alive>0`

### Implementation for User Story 2

- [ ] T017 [US2] แก้ `backend/src/modules/ai/services/ocr.service.ts` — inject `VramMonitorService` และ `AiPolicyService`, เพิ่ม `calculateOcrResidency()` method, ส่ง `keep_alive` ที่คำนวณได้ไปใน OCR sidecar request, log `OcrResidencyDecision`
- [ ] T018 [P] [US2] แก้ `specs/04-Infrastructure-OPS/04-00-docker-compose/Desk-5439/ocr-sidecar/app.py` — รับ `keep_alive` parameter จาก request body แทน hardcode `keep_alive=0`, ส่ง `keep_alive` ค่านั้นไปใน Ollama `/v1/chat/completions` call
- [ ] T019 [P] [US2] เพิ่ม env variables ใน docker-compose ของ Desk-5439 OCR sidecar — `VRAM_HEADROOM_THRESHOLD_MB`, `OCR_RESIDENCY_WINDOW_SECONDS`, `GPU_TOTAL_VRAM_MB`
- [ ] T020 [US2] เพิ่ม unit tests `backend/src/modules/ai/tests/ocr-residency.spec.ts` — scenarios: large-context-active, high-pressure, headroom-sufficient, query-failed fallback

**Checkpoint**: US2 functional — OCR keep_alive computed dynamically per policy

---

## Phase 5: User Story 3 — Retrieval Acceleration with CPU Fallback (P3)

**Goal**: `/embed` และ `/rerank` บน sidecar ตรวจ VRAM headroom; fallback CPU ถ้าไม่พอ; log fallback decision

**Independent Test**: จำลอง GPU pressure → ยิง `/embed` → ต้องได้ผลลัพธ์ (ไม่ fail) + log `device: "cpu"`

### Implementation for User Story 3

- [ ] T021 [P] [US3] แก้ `specs/04-Infrastructure-OPS/04-00-docker-compose/Desk-5439/ocr-sidecar/app.py` — เพิ่ม VRAM headroom check ใน `POST /embed` endpoint; ถ้าผ่าน threshold ใช้ GPU, ถ้าไม่ผ่านหรือ query ล้มเหลว ใช้ CPU; log `device` และ `reason`
- [ ] T022 [P] [US3] แก้ `specs/04-Infrastructure-OPS/04-00-docker-compose/Desk-5439/ocr-sidecar/app.py` — เพิ่ม VRAM headroom check ใน `POST /rerank` endpoint; CPU fallback logic เหมือน `/embed`; เพิ่ม timeout guard (504 response ถ้า CPU timeout)
- [ ] T023 [US3] แก้ `backend/src/modules/ai/processors/ai-batch.processor.ts` — รอง handle กรณีที่ `/embed` หรือ `/rerank` ตอบ `device: "cpu"` ใน response; log `retrievalDevice` ลง ai_audit_logs metadata
- [ ] T024 [P] [US3] สร้าง `specs/04-Infrastructure-OPS/04-00-docker-compose/Desk-5439/ocr-sidecar/tests/test_retrieval_fallback.py` — pytest tests สำหรับ CPU fallback behavior ของ `/embed` และ `/rerank`

**Checkpoint**: US3 functional — retrieval never hard-fails due to GPU pressure

---

## Phase 6: User Story 4 — Queue Policy & Selective Realtime Concurrency (P4)

**Goal**: `ai-realtime` concurrency = 2 สำหรับ lightweight jobs; `rag-query` route ไป `ai-batch`; pause/resume ยังทำงาน

**Independent Test**: ส่ง 2 intent-classify jobs พร้อมกัน → ทั้งสองรันพร้อมกัน; ส่ง rag-query → ไปอยู่ใน `ai-batch`

### Implementation for User Story 4

- [ ] T025 [US4] แก้ `backend/src/config/bullmq.config.ts` — เพิ่ม `REALTIME_CONCURRENCY` env variable (default: 2); ปรับ `ai-realtime` worker concurrency ให้ configurable
- [ ] T026 [US4] แก้ `backend/src/modules/ai/processors/ai-realtime.processor.ts` — เพิ่ม job type classification: `LIGHTWEIGHT_REALTIME_JOBS = ['intent-classify', 'tool-suggest']`; generation-heavy jobs ถูก redirect ไป `ai-batch` ถ้าเข้ามาผิด queue; เพิ่ม log สำหรับ classification decision
- [ ] T027 [P] [US4] ตรวจสอบ `backend/src/modules/ai/ai.service.ts` — ยืนยันว่า `rag-query` ถูก dispatch ไป `ai-batch` เสมอ (ไม่ใช่ `ai-realtime`); เพิ่ม explicit assertion ใน dispatch logic
- [ ] T028 [P] [US4] เพิ่ม unit tests `backend/src/modules/ai/tests/queue-policy.spec.ts` — ทดสอบ job classification, rag-query routing, lightweight job concurrency

**Checkpoint**: US4 functional — selective concurrency active, rag-query always in ai-batch

---

## Phase 7: User Story 5 — Verification & Cutover Gate (P5)

**Goal**: Test suite ครอบ 4 แกน cutover gate ทั้งหมด; manual validation checklist พร้อม; Admin Console / OCR Sandbox แสดงถูกต้อง

**Independent Test**: `pnpm test -- --testPathPattern="ai-policy|ocr-residency|execution-profile|queue-policy"` ทุก test ผ่าน 100%

### Implementation for User Story 5

- [ ] T029 [US5] สร้าง `backend/src/modules/ai/tests/ai-policy.service.spec.ts` — unit tests ครอบ: profile mapping ทุก 4 values, canonical name mapping, data-affecting override, `large-context` guard validation
- [ ] T030 [P] [US5] สร้าง `backend/src/modules/ai/tests/execution-profile.guard.spec.ts` — unit tests: admin passes, non-admin blocked, missing token blocked
- [ ] T031 [P] [US5] สร้าง `backend/src/modules/ai/tests/vram-monitor.service.spec.ts` — unit tests: successful query, Ollama timeout fallback, empty models response
- [ ] T032 [US5] ทดสอบ manual validation ตาม `quickstart.md` — รัน curl commands ทั้ง Gate 1–4, ตรวจ Admin Console labels, ตรวจ OCR Sandbox behavior; บันทึกผลใน checklist
- [ ] T033 [P] [US5] อัปเดต env template ไฟล์ `specs/04-Infrastructure-OPS/04-00-docker-compose/Desk-5439/.env.template` — เพิ่ม `VRAM_HEADROOM_THRESHOLD_MB`, `OCR_RESIDENCY_WINDOW_SECONDS`, `GPU_TOTAL_VRAM_MB`, `REALTIME_CONCURRENCY`
- [ ] T034 [P] [US5] อัปเดต `backend/.env.example` — เพิ่ม `AI_VRAM_HEADROOM_THRESHOLD_MB`, `AI_REALTIME_CONCURRENCY`

**Checkpoint**: All 5 user stories complete — big bang cutover gate ready for validation

---

## Phase 8: Polish & Cross-Cutting Concerns

- [ ] T039 [US1] แก้ `backend/src/modules/ai/processors/ai-batch.processor.ts` — เปลี่ยน `ocrUsed` label value จาก `"Typhoon OCR"` / `"PaddleOCR"` เป็น `"np-dms-ocr"` ใน Redis completed result (ครอบคลุม FR-A07: canonical names ทุก layer รวมถึง OCR Sandbox badge)
- [ ] T035 [P] ตรวจสอบ i18n keys ที่ต้องเพิ่มใน `frontend/public/locales/` สำหรับ error messages ใหม่ (400 model.key, 403 large-context, 504 CPU timeout)
- [ ] T036 อัปเดต CONTEXT.md และ AGENTS.md — เพิ่ม `np-dms-ai` / `np-dms-ocr` เป็น canonical identity ใน System readiness summary; แก้ references เดิมที่ยังใช้ชื่อ runtime
- [ ] T037 [P] ตรวจสอบ ADR-034 references ทั้งหมดใน codebase ด้วย search — ไฟล์ไหนยังใช้ `typhoon2.5-np-dms:latest` หรือ `typhoon-np-dms-ocr:latest` ใน user-facing surfaces (ไม่ใช่ Modelfile/ops internals)
- [ ] T038 รัน `pnpm lint` และ `pnpm type-check` สำหรับ backend และ frontend — แก้ทุก error ก่อน cutover

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: ไม่มี dependency — เริ่มได้ทันที
- **Foundational (Phase 2)**: ต้องรอ Phase 1 (T001, T002) — BLOCKS ทุก user story
- **US1 (Phase 3)**: ต้องรอ Phase 2 complete — สำคัญสุด, ทำก่อน
- **US2 (Phase 4)**: ต้องรอ Phase 2 complete — ขึ้นกับ `VramMonitorService` จาก T003
- **US3 (Phase 5)**: ต้องรอ Phase 2 complete — ขึ้นกับ `vram_monitor.py` จาก T004
- **US4 (Phase 6)**: ต้องรอ Phase 2 complete — independent จาก US1/US2/US3
- **US5 (Phase 7)**: ต้องรอ US1+US2+US3+US4 complete (ทดสอบทุกแกน)
- **Polish (Phase 8)**: ต้องรอ US5 ผ่าน cutover gate

### User Story Dependencies

- **US1 (P1)**: ต้อง complete ก่อน — contract เป็น foundation ของ canonical naming ทุกชั้น
- **US2 (P2)**: ขึ้นกับ `VramMonitorService` (T003, Phase 1) เท่านั้น — parallel กับ US1 ได้
- **US3 (P3)**: ขึ้นกับ `vram_monitor.py` (T004, Phase 1) เท่านั้น — parallel กับ US1/US2 ได้
- **US4 (P4)**: Independent จาก US1/US2/US3 — parallel ได้หลัง Phase 2
- **US5 (P5)**: ต้องรอทุก US ก่อนหน้า

### Parallel Opportunities

- T001 + T002: parallel (different files)
- T003 + T004: parallel (different stacks)
- T005, T006, T007: T005 ทำก่อน (T006, T007 ขึ้นกับ types จาก T005)
- US1 + US2 + US3 + US4: parallel หลัง Phase 2 complete (ถ้ามีทีม)
- T029, T030, T031, T033, T034: parallel (different test files / env files)

---

## Implementation Strategy

### MVP First (US1 Only)

1. Phase 1: Setup (T001–T004)
2. Phase 2: Foundational (T005–T009)
3. Phase 3: US1 (T010–T016)
4. **STOP & VALIDATE**: ยิง curl ตาม Gate 1 และ Gate 2 ใน quickstart.md
5. Deploy/validate canonical naming ใน Admin Console

### Incremental Delivery

1. Phase 1+2 → Foundation
2. US1 → Policy contract + canonical naming (MVP)
3. US2 → Adaptive OCR residency
4. US3 → Retrieval CPU fallback
5. US4 → Queue policy
6. US5 → Full cutover gate verification

### Total Task Count

- **Total**: 39 tasks
- **US1**: 7 tasks (T010–T016)
- **US2**: 4 tasks (T017–T020)
- **US3**: 4 tasks (T021–T024)
- **US4**: 4 tasks (T025–T028)
- **US5**: 6 tasks (T029–T034)
- **Setup**: 4 tasks (T001–T004)
- **Foundational**: 5 tasks (T005–T009)
- **Polish**: 4 tasks (T035–T038)
