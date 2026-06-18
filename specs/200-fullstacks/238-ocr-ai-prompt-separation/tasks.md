# Tasks: OCR & AI Extraction Prompt Management

**Feature**: 238-ocr-ai-prompt-separation
**Branch**: `238-ocr-ai-prompt-separation`
**Generated**: 2026-06-17
**Total Tasks**: 68 (รวม Phase 7: Full 3-Step Pipeline with RAG Prep)

---

## Phase 1: Setup (Database & Infrastructure)

**Goal**: Prepare database schema and verify infrastructure

> **หมายเหตุ**: คอลัมน์ `version` และ `@VersionColumn` **มีอยู่แล้ว** (delta 2026-06-15) — T001/T003 เหลือแค่ verify

- [x] T001 ~~Run migration - add `version` column~~ → **มีอยู่แล้ว** เพียง verify ว่า `2026-06-15-fix-ai-prompts-columns.sql` ถูก apply (ADR-009: SQL delta, ไม่ใช่ TypeORM migration)
- [x] T002 Seed default OCR system prompt - สร้าง delta `specs/03-Data-and-Storage/deltas/2026-06-17-seed-ocr-system-prompt.sql` (INSERT `prompt_type='ocr_system'`, `created_by` = user_id ของ superadmin)
- [x] T003 [P] Verify entity มี `@VersionColumn()` ที่ `backend/src/modules/ai/prompts/ai-prompts.entity.ts` (**ไม่ใช่** `entities/ai-prompt.entity.ts`) — มีอยู่แล้ว

**Independent Test**: Database has `version` column, default OCR prompt exists, entity compiles

---

## Phase 2: Foundational (Shared Services)

**Goal**: Create validation and core services used by all user stories

> **หมายเหตุ**: validation อยู่ใน `ai-prompts.service.ts` `create()` แล้ว (inline) และ `CreateAiPromptDto`/` contextConfig` มีอยู่แล้ว — **ขยายของเดิม ไม่สร้าง service/dto ชุดใหม่**

- [x] T004 เพิ่ม branch validation สำหรับ `ocr_system` (free-form, no required placeholder) ใน `create()` ที่ `backend/src/modules/ai/prompts/ai-prompts.service.ts`
- [x] T005 ยืนยัน placeholder validation ของเดิม - `{{ocr_text}}` required สำหรับ `ocr_extraction` (มีอยู่แล้ว)
- [x] T006 ใช้ `CreateAiPromptDto` ที่มีอยู่ (`backend/src/modules/ai/prompts/dto/create-ai-prompt.dto.ts`) — body = { template, contextConfig }, promptType เป็น path param
- [x] T007 ใช้ `UpdatePromptNoteDto`/`ContextConfigDto` ที่มีอยู่ (ไม่มี update-prompt.dto.ts แยก)
- [x] T008 ต้องการ optimistic 409 flow: แก้ `activate()` ให้รับ `expectedVersion` (ปัจจุบันใช้ pessimistic lock — ไม่รับ expectedVersion)

**Independent Test**: Validation service rejects invalid templates, DTOs have proper decorators

---

## Phase 3: User Story 1 - OCR System Prompt Management

**Goal**: Admins can view and edit OCR system prompt

**Independent Test Criteria**:
- Admin sees "OCR Prompt" tab in AI Admin Console
- Can edit and save new OCR system prompt version
- Sandbox Step 1 uses custom OCR prompt

### Backend (OCR Prompt) — ขยายโมดูลเดิม `backend/src/modules/ai/prompts/`
> **หมายเหตุ**: `create()`, `getActive()`, `activate()`, controller CRUD **มีอยู่แล้ว** — งานส่วนใหญ่คือ verify + รองรับ `ocr_system`
- [x] T009 [US1] Verify `AiPromptsService.create()` รองรับ `ocr_system` (version auto-increment มีแล้ว)
- [x] T010 [US1] [P] Verify `getActive(promptType)` คืน active ocr_system (มีแล้ว + Redis cache 60s)
- [x] T011 [US1] เพิ่ม optimistic locking check ใน `activate()` (ปัจจุบัน pessimistic)
- [x] T012 [US1] Handle HTTP 409 Conflict เมื่อ version mismatch (ต้องแก้ activate signature)
- [x] T013 [US1] ใช้ `AiPromptsController` ที่มีอยู่ (`ai-prompts.controller.ts`) — ไม่สร้าง controller ใหม่
- [x] T014 [US1] [P] route GET `/api/ai/prompts/{promptType}` มีอยู่แล้ว (listPromptVersions)
- [x] T015 [US1] route POST `/api/ai/prompts/{promptType}` มีอยู่แล้ว (header Idempotency-Key)
- [x] T016 [US1] route POST `/api/ai/prompts/{promptType}/{versionNumber}/activate` มีอยู่แล้ว (header Idempotency-Key)

### Frontend (OCR Prompt) — build ด้วย `pnpm --filter lcbp3-frontend build`
- [x] T017 [US1] Create `adminAiPromptService` in `frontend/lib/services/admin-ai-prompt.service.ts` (เรียก route `/api/ai/prompts/:promptType` + ส่ง Idempotency-Key)
- [x] T018 [US1] [P] Implement `getPrompts()` method in `adminAiPromptService`
- [x] T019 [US1] Implement `createPrompt()` method in `adminAiPromptService`
- [x] T020 [US1] Implement `activatePrompt()` with optimistic locking in `adminAiPromptService`
- [x] T021 [US1] Create `PromptManagementTabs` component in `frontend/components/admin/ai/PromptManagementTabs.tsx`
- [x] T022 [US1] [P] Create `OcrPromptTab` component in `frontend/components/admin/ai/OcrPromptTab.tsx` with text editor
- [x] T023 [US1] Add version history list in `OcrPromptTab`
- [x] T024 [US1] Implement "Save New Version" button with validation
- [x] T025 [US1] Handle 409 Conflict error - show refresh dialog

### Sidecar Integration (ยืนยัน pattern แล้ว — append เข้า messages[0]["content"])

- [x] T026 [US1] แก้ `/ocr-upload` endpoint ใน `specs/04-Infrastructure-OPS/04-00-docker-compose/Desk-5439/ocr-sidecar/app.py`:
  - เพิ่ม parameter: `systemPrompt: Optional[str] = Form(default=None)` ใน signature ของ `ocr_upload()`
  - เพิ่มพารามิเตอร์ `system_prompt: Optional[str] = None` ใน signature ของ `_process_pdf_doc()`
  - เพิ่มพารามิเตอร์ `system_prompt: Optional[str] = None` ใน signature ของ `process_ocr()`
  - Thread `systemPrompt` จาก `ocr_upload()` → `_process_pdf_doc(..., system_prompt=systemPrompt)` → `process_ocr(..., system_prompt=system_prompt)`

- [x] T027 [US1] ใน `process_ocr()` ที่ `app.py` (หลัง `prepare_ocr_messages` และ **ก่อน** DMS-tags injection):
  ```python
  messages = prepare_ocr_messages(pdf_path, task_type="structure", page_num=page_num)
  if system_prompt:
      messages[0]["content"].append({"type": "text", "text": system_prompt})
  # DMS tags injection เดิม (ยังคงไว้)
  messages[0]["content"].append({"type": "text", "text": "Additionally: ..."})
  ```
  - **ห้าม** insert `{"role": "system"}` แยก (typhoon OCR single-message format)

- [x] T028 [US1] Update `sandbox-ocr-engine.service.ts` ใน backend:
  - เพิ่ม logic ดึง active `ocr_system` prompt จาก `AiPromptsService.getActive('ocr_system')`
  - ส่ง form field `systemPrompt` (ค่า = active prompt template) ไป sidecar ใน FormData
  - ส่ง header `X-API-Key: $OCR_SIDECAR_API_KEY` (ดู env variable ใน docker-compose)

---

## Phase 4: User Story 2 - AI Extraction Prompt Management

**Goal**: Admins can view and edit AI Extraction prompt with placeholders

**Independent Test Criteria**:
- Admin sees "AI Extraction" tab
- Template validation rejects missing `{{ocr_text}}`
- Sandbox Step 2 uses custom extraction prompt

### Backend (AI Extraction) — ส่วนใหญ่มีอยู่แล้ว
- [x] T029 [US2] `ocr_extraction` รองรับใน `create()` validation อยู่แล้ว (verify)
- [x] T030 [US2] Validate `{{ocr_text}}` placeholder (มีอยู่แล้ว ใน `create()`)
- [x] T031 [US2] ใช้ `resolveActive('ocr_extraction', ocrText)` ที่มีอยู่ (หมายเหตุ: ปัจจุบัน replace แค่ `{{ocr_text}}` — `{{master_data_context}}` inject ต่างหากผ่าน resolveContext)
- [x] T032 [US2] Verify `ai-batch.processor.ts` ใช้ active `ocr_extraction` prompt

### Frontend (AI Extraction)
- [x] T033 [US2] [P] Create `AiExtractionPromptTab` in `frontend/components/admin/ai/AiExtractionPromptTab.tsx`
- [x] T034 [US2] Add placeholder helper buttons (`{{ocr_text}}`, `{{master_data_context}}`)
- [x] T035 [US2] Show validation error inline if missing required placeholder
- [x] T036 [US2] Add template preview with syntax highlighting

---

## Phase 5: User Story 3 - Separate UI Tabs

**Goal**: Clear visual separation between OCR and AI Extraction tabs

**Independent Test Criteria**:
- Two distinct tabs with clear labels
- Each tab shows only its own history
- No confusion in UI

### Frontend (UI Polish)
- [x] T037 [US3] Style `PromptManagementTabs` with clear tab indicators
- [x] T038 [US3] [P] Add tab icons (OCR: eye/scan icon, AI: brain/robot icon)
- [x] T039 [US3] Show active status badge on each tab
- [x] T040 [US3] Implement tab state persistence (URL hash or localStorage)
- [x] T041 [US3] Add warning badge if no active prompt for a type

---

## Phase 6: Polish & Cross-Cutting

**Goal**: Error handling, tests, and final integration

### Error Handling (ADR-007)
- [x] T042 Add user-friendly error messages for validation errors in frontend
- [x] T043 Implement retry logic for 409 Conflict with exponential backoff
- [x] T044 Add Toast notifications for success/error states

### Testing
- [x] T045 [P] Write unit tests for `AiPromptValidationService`
- [x] T046 Write integration test for optimistic locking conflict scenario
- [x] T047 E2E test: Admin creates OCR prompt → activates → runs Sandbox Step 1

---

## Phase 7: User Story 4 - Full 3-Step Sandbox with RAG Prep (Priority: P1)

**Goal**: Complete ADR-037 3-Step Pipeline (OCR → AI Extract → RAG Prep) with vector preview for production parity testing.

**Independent Test Criteria**:
- Admin can run all 3 steps sequentially in Sandbox
- Each step displays status (pending/processing/completed/failed)
- Step 3 shows chunk text + vector preview (5 dimensions)
- Full pipeline completes end-to-end

### Backend (RAG Prep Integration) — หลายส่วนมีอยู่แล้ว
- [x] T048 [US4] `rag_prep_prompt` validate `{{text}}` placeholder **มีอยู่แล้ว** ใน `create()` (verify)
- [x] T049 [US4] [P] `SandboxRagPrepDto` ที่ `backend/src/modules/ai/dto/sandbox-rag-prep.dto.ts` **มีอยู่แล้ว** (verify)
- [x] T050 [US4] Verify/Extend `ai-batch.processor.ts` `sandbox-rag-prep` job handler
- [x] T051 [US4] Implement semantic chunking ใช้ active `rag_prep_prompt`
- [x] T052 [US4] ใช้ sidecar `/embed` endpoint ที่ **มีอยู่แล้ว** (ส่ง X-API-Key) — ไม่ต้องสร้างใหม่
- [x] T053 [US4] POST `/api/ai/admin/sandbox/rag-prep` **มีอยู่แล้ว** ใน AiController (verify)
- [x] T054 [US4] Verify Redis storage สำหรับ RAG Prep results
- [x] T055 [US4] GET sandbox job result endpoint (ใช้ `/api/ai/admin/sandbox/job/:id` ที่มีอยู่)

### Frontend (3-Step Sandbox UI)
- [x] T056 [US4] Create `SandboxStepIndicator` component showing 3 steps with status icons
- [ ] T057 [US4] [P] Extend `PromptManagementTabs` with "Sandbox" tab containing 3-step workflow (currently PromptManagementTabs has only 2 tabs: OCR System Prompt and AI Extraction Prompt)
- [ ] T058 [US4] Create `RagPrepResultPanel` component with chunk list + vector preview
- [ ] T059 [US4] Implement vector preview display (first 5 dimensions: `[0.234, -0.891, ...]`)
- [ ] T060 [US4] Add "Run Step 3 (RAG Prep)" button enabled after Step 2 completes
- [ ] T061 [US4] Display chunk count and embedding status for each chunk
- [ ] T062 [US4] Add "Activate This Version" button visible after all 3 steps complete successfully

### Integration (Full Pipeline)
- [ ] T063 [US4] Wire Step 2 output (extracted metadata + text) as Step 3 input
- [ ] T064 [US4] Implement sequential step execution (Step 1 → Step 2 → Step 3)
- [ ] T065 [US4] Add pipeline status tracking in Redis

### E2E Testing
- [ ] T066 [US4] [P] E2E test: Full 3-step pipeline - upload PDF → OCR → Extract → RAG Prep (current E2E test only validates data/format, not real page rendering)
- [ ] T067 [US4] E2E test: Vector preview displays correctly with 5 dimensions
- [ ] T068 [US4] E2E test: Step indicators show correct status for each step

---

## Dependencies Graph

```
Phase 1 (Setup)
    ↓
Phase 2 (Foundational)
    ↓
Phase 3 (US1 - OCR Prompt) ←──┐
    ↓                          │
Phase 4 (US2 - AI Extraction)  │
    ↓                          │
Phase 5 (US3 - UI Polish)      │
    ↓                          │
Phase 6 (Polish & Tests)       │
    ↓                          │
Phase 7 (US4 - RAG Prep) ←─────┤
    ↓                          │
Sidecar Update ────────────────┘
```

**Note**: US1, US2, US3 can be developed in parallel after Phase 2. US4 (RAG Prep) depends on US1 and US2 (needs OCR and Extract results). Testing requires all phases for full pipeline validation.

---

## Implementation Strategy

### MVP Scope (User Story 1 only)
สำหรับการทดสอบ concept อย่างรวดเร็ว:
1. T001-T003 (Database setup)
2. T004-T008 (Foundational services)
3. T009-T028 (OCR Prompt only - minimal sidecar change)

### Full Implementation
ทำทุก task ตามลำดับ phase

### Suggested Parallel Execution
- **Backend developer**: T001-T016, T048-T055 (Setup + Foundational + Backend for all US)
- **Frontend developer**: T017-T025, T056-T062 (Frontend for all US including 3-step UI)
- **DevOps/Sidecar**: T026-T027, T052 (Sidecar modification with embed endpoint)
- **QA**: T045-T047, T066-T068 (Testing including full pipeline E2E)

---

## Success Criteria Mapping

| Success Criteria | Tasks |
|-----------------|-------|
| SC-001: Edit OCR prompt < 2 clicks | T021-T025 |
| SC-002: OCR changes immediate | T026-T028 |
| SC-003: AI extraction changes immediate | T029-T036 |
| SC-004: No confusion | T037-T041 |
| SC-005: Versioning < 30 sec | T009-T012 |
| SC-006: RAG Prep with vector preview | T048-T062 |
| SC-007: Full 3-step pipeline testable | T063-T068 |
