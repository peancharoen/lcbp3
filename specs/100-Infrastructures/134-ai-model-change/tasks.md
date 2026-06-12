// File: specs/100-Infrastructures/134-ai-model-change/tasks.md
// Change Log:
// - 2026-06-03: Initial task list for Thai-Optimized AI Model Stack

# Tasks: Thai-Optimized AI Model Stack

**Input**: Design documents from `specs/100-Infrastructures/134-ai-model-change/`
**ADR Reference**: ADR-034 (Supersedes ADR-023A Section 2.1)
**Prerequisites**: plan.md ✅ spec.md ✅ research.md ✅ data-model.md ✅ contracts/ ✅

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no shared state)
- **[Story]**: User story label (US1/US2/US3)

---

## Phase 1: Setup (Infrastructure Verification)

**Purpose**: ยืนยัน Model files และ directory structure พร้อม; ไม่ต้องสร้างใหม่เพราะมีอยู่แล้ว

- [X] T001 [P] ตรวจสอบ `specs/04-Infrastructure-OPS/04-00-docker-compose/Desk-5439/typhoon2.5-np-dms.model.md` ว่า content ตรงกับ ADR-034 Section 1
- [X] T002 [P] ตรวจสอบ `specs/04-Infrastructure-OPS/04-00-docker-compose/Desk-5439/typhoon-np-dms-ocr.model.md` ว่า content ตรงกับ ADR-034 Section 1
- [X] T003 [P] สร้าง SQL delta `specs/03-Data-and-Storage/deltas/2026-06-03-update-ai-available-models-typhoon.sql` — UPDATE main model + INSERT ocr model ใน `ai_available_models` table (ตรวจสอบ schema ก่อน run)
- [X] T003b [P] สร้าง rollback `specs/03-Data-and-Storage/deltas/2026-06-03-update-ai-available-models-typhoon.rollback.sql` — revert model_name กลับเป็น gemma4:e2b + DELETE ocr model record (ADR-009: ทุก delta ต้องมี rollback)

---

## Phase 2: Foundational (OllamaService + AiSettingsService)

**Purpose**: Backend services support model ใหม่ — BLOCKS Phases 3, 4, 5

**⚠️ CRITICAL**: ต้องเสร็จก่อนเริ่ม US phases

- [X] T004 เพิ่ม method `unloadModel(modelName: string): Promise<void>` ใน `backend/src/modules/ai/services/ollama.service.ts` — POST /api/generate keep_alive:0 + error handling ตาม contract
- [X] T005 เพิ่ม method `loadModel(modelName: string, keepAlive?: number | string): Promise<void>` ใน `backend/src/modules/ai/services/ollama.service.ts` — POST /api/generate keep_alive:{keepAlive ?? -1} + timeout 60s + "model not found" error
- [X] T006 [P] อัปเดต `DEFAULT_MODEL = 'typhoon2.5-np-dms:latest'` และเพิ่ม `OCR_MODEL = 'typhoon-np-dms-ocr:latest'` ใน `backend/src/modules/ai/services/ai-settings.service.ts`
- [X] T007 [P] เขียน unit tests สำหรับ `unloadModel()` และ `loadModel()` ใน `backend/src/modules/ai/services/ollama.service.spec.ts` — mock axios; test timeout, 404, และ success cases

**Checkpoint**: Foundation พร้อม — processor switching สามารถ implement ได้

---

## Phase 3: User Story 1 — Thai OCR Processing (Priority: P1) 🎯 MVP

**Goal**: BullMQ processor switch models สำหรับ OCR jobs; ไม่มี VRAM OOM

**Independent Test**: ส่ง `ocr-extract` job → ตรวจสอบ log มี ModelSwitch entries + job สำเร็จ

- [X] T008 [US1] เพิ่ม constant `const OCR_JOB_TYPES = ['ocr-extract', 'sandbox-ocr-only'] as const` ใน `backend/src/modules/ai/processors/ai-batch.processor.ts`
- [X] T009 [US1] Implement model switching block ใน `processJob()`: unload main → load OCR (keep_alive:0) → process → reload main (keep_alive:-1) ใน `backend/src/modules/ai/processors/ai-batch.processor.ts`
- [X] T010 [US1] เพิ่ม NestJS `Logger` log สำหรับ model switch events (model name + timestamp) ใน `backend/src/modules/ai/processors/ai-batch.processor.ts`
- [X] T011 [P] [US1] เขียน unit tests สำหรับ OCR model switching logic ใน `backend/src/modules/ai/processors/ai-batch.processor.spec.ts` — mock OllamaService methods; test switching sequence + non-OCR bypass

**Checkpoint**: OCR job ทำงานกับ Typhoon OCR model; main model reload หลัง OCR สำเร็จ

---

## Phase 4: User Story 2 — Main AI Tasks With New Model (Priority: P2)

**Goal**: ทุก non-OCR AI job ใช้ `typhoon2.5-np-dms:latest`

**Independent Test**: ส่ง `ai-extract` job → ตรวจสอบ Ollama call ใช้ model ใหม่ (ไม่ใช่ gemma4)

- [X] T012 [US2] ตรวจสอบและอัปเดต `OllamaService.generate()` ให้อ้างอิง `AiSettingsService.DEFAULT_MODEL` แทน hardcoded model name ใน `backend/src/modules/ai/services/ollama.service.ts`
- [X] T013 [P] [US2] grep codebase ด้วย pattern `gemma4|OLLAMA_MODEL_MAIN|OLLAMA_RAG_MODEL` ใน `backend/src/` หา hardcoded model references เก่าทั้งหมด → อัปเดตให้ใช้ `AiSettingsService.DEFAULT_MODEL` หรือ `AiSettingsService.OCR_MODEL`
- [X] T014 [US2] อัปเดต comment/note ใน `backend/.env.example` — อธิบายว่า model names ถูก hardcode ใน `AiSettingsService` ตาม ADR-034

**Checkpoint**: ทุก non-OCR AI job ใช้ model ใหม่

---

## Phase 5: User Story 3 — System Health Visibility (Priority: P3)

**Goal**: Admin Console แสดงชื่อ model ที่ถูกต้อง

**Independent Test**: GET /api/ai/health → JSON มี `mainModel` = typhoon2.5-np-dms, `ocrModel` = typhoon-np-dms-ocr

- [X] T015 [P] [US3] อัปเดต health response structure ใน `backend/src/modules/ai/ai.service.ts` — เพิ่ม `mainModel` และ `ocrModel` fields ที่อ่านจาก `AiSettingsService`
- [X] T016 [P] [US3] ตรวจสอบ `frontend/app/(admin)/admin/ai/page.tsx` ว่า health card แสดง model names ใหม่ (ถ้า dynamic จาก API ไม่ต้องแก้; ถ้า hardcoded ให้แก้)
- [ ] T017 [US3] รัน SQL delta `2026-06-03-update-ai-available-models-typhoon.sql` บน production DB (manual step — ผ่าน DB admin tool)

**Checkpoint**: Admin Console แสดง model stack ใหม่ถูกต้อง

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Documentation update + compliance verification

- [X] T018 [P] อัปเดต `AGENTS.md` — Current Decisions D10: เปลี่ยน `gemma4:e4b Q8_0` เป็น `typhoon2.5-np-dms:latest (main) + typhoon-np-dms-ocr:latest (OCR)`; อัปเดต version เป็น v1.9.9 และ sync date
- [X] T019 [P] อัปเดต `memory/project-memory-override.md` — Section 2.5 model names + Section 5 D10 + Section 7 Ollama row + Section 8 Recent Rollouts entry
- [X] T020 [P] อัปเดต `.agents/rules/11-ai-integration.md` — 2-model stack: `gemma4:e2b → typhoon2.5-np-dms:latest`
- [ ] T021 [P] รัน type check: `pnpm --filter backend build` — ต้องผ่าน 0 errors
- [ ] T022 [P] รัน lint: `pnpm --filter backend lint` — ตรวจสอบ no console.log, no any
- [ ] T023 [P] รัน unit tests ที่เพิ่มใหม่: `pnpm --filter backend test -- --testPathPattern="ollama.service|ai-batch.processor"`
- [ ] T024 รัน quickstart.md verification บน Desk-5439 + QNAP ตามขั้นตอนใน `quickstart.md` — รวมถึงตรวจสอบ BullMQ concurrency=1 ใน `ai-batch.processor.ts` (FR-010)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: ไม่มี dependency — เริ่มทันที
- **Phase 2 (Foundational)**: ไม่มี dependency — เริ่มทันที; **BLOCKS Phase 3, 4, 5**
- **Phase 3 (US1)**: ต้องรอ Phase 2 สมบูรณ์
- **Phase 4 (US2)**: ต้องรอ Phase 2; สามารถ parallel กับ Phase 3
- **Phase 5 (US3)**: ต้องรอ Phase 3 + Phase 4
- **Phase 6 (Polish)**: ต้องรอทุก phase

### Within Phase 2

- T004 → T005 (sequential — เป็น paired methods)
- T006, T007 → parallel ได้

### Parallel Opportunities Per Phase

```
Phase 1: T001 ∥ T002 ∥ T003
Phase 2: (T004→T005) ∥ T006 ∥ T007
Phase 3: (T008→T009→T010) + T011 parallel กับ T010
Phase 4: T012 → T013 → T014
Phase 5: T015 ∥ T016; T017 manual last
Phase 6: T018 ∥ T019 ∥ T020 ∥ T021 ∥ T022 ∥ T023 → T024 last
```

---

## Implementation Strategy

### MVP First (US1 — OCR Model Switching)

1. Phase 1: Verify Modelfiles (T001-T002)
2. Phase 2: OllamaService + AiSettings (T004-T007)
3. Phase 3: OCR switching (T008-T011)
4. **Validate**: Test OCR job + confirm main reload

### Incremental Delivery

1. MVP (Phase 1-3) → OCR ทำงานกับ Typhoon
2. US2 (Phase 4) → Main model jobs ใช้ model ใหม่
3. US3 (Phase 5) → Admin health visibility
4. Polish (Phase 6) → Docs + type check + deploy

---

## Notes

- T001-T002: Model files มีอยู่แล้วใน `specs/04-Infrastructure-OPS/04-00-docker-compose/Desk-5439/` — เป็น verification task ไม่ใช่ creation
- FR-008 (nomic-embed-text) + FR-009 (n8n boundary): Preserved by existing architecture — ไม่มี task เพราะ "do nothing" คือ correct action
- T018: ตรวจสอบ AGENTS.md version จริงก่อน bump เป็น v1.9.9
- T003: ตรวจสอบ `lcbp3-v1.9.0-schema-02-tables.sql` ก่อน write delta — ai_available_models schema อาจต่างจากที่คาด
- T013: ใช้ grep/code_search เพื่อหา references ทั้งหมด — อย่า hardcode path ไปเอง
- T017: Manual step; ต้องทำผ่าน DBA หรือ migration pipeline
- T024: Real-app verification ตาม `/check-real-app` workflow
