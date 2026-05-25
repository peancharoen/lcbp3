# Tasks: Dynamic Prompt Management for OCR Extraction

**Input**: Design documents from `specs/200-fullstacks/229-dynamic-prompt-management/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/prompts.yaml ✅, quickstart.md ✅
**Branch**: `229-dynamic-prompt-management`

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[US#]**: User Story mapping (US1 = Version Management, US2 = Sandbox Testing, US3 = Runtime Resolution)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Schema, entity, and module scaffolding that all user stories depend on

- [x] T001 Read hardcoded prompt from `backend/src/modules/ai/processors/ai-batch.processor.ts` (both `processSandboxExtract` and `processMigrateDocument`) and capture exact template text for seed data
- [x] T002 Create SQL delta `specs/03-Data-and-Storage/deltas/2026-05-25-create-ai-prompts.sql` with `CREATE TABLE ai_prompts` + seed data INSERT (use exact template from T001)
- [x] T002b [P] Create rollback delta `specs/03-Data-and-Storage/deltas/2026-05-25-create-ai-prompts.rollback.sql` with `DROP TABLE IF EXISTS ai_prompts` — follows existing delta rollback convention
- [x] T003 [P] Create TypeORM entity `backend/src/modules/ai/prompts/ai-prompts.entity.ts` per data-model.md (INT PK with `@Exclude()`, all columns, no publicId needed)
- [x] T004 [P] Create `backend/src/modules/ai/prompts/dto/create-ai-prompt.dto.ts` with `template: string` (class-validator `@IsNotEmpty()`)
- [x] T005 [P] Create `backend/src/modules/ai/prompts/dto/update-prompt-note.dto.ts` with `manualNote: string | null`
- [x] T006 [P] Create `backend/src/modules/ai/prompts/dto/ai-prompt-response.dto.ts` with `@Expose()` fields per data-model.md API Response Shape

**Checkpoint**: Schema applied, entity and DTOs compile — T007 can begin

---

## Phase 2: Foundational (Blocking Backend Prerequisites)

**Purpose**: Core service and module wiring — MUST complete before US1 frontend or US3 processor work

**⚠️ CRITICAL**: All user story implementation depends on this phase

- [x] T007 Create `backend/src/modules/ai/prompts/ai-prompts.service.ts` with:
  - `findAll(promptType: string): Promise<AiPrompt[]>` — ORDER BY version_number DESC
  - `getActive(promptType: string): Promise<AiPrompt | null>` — Redis cache first, DB fallback
  - `create(promptType, dto, userId): Promise<AiPrompt>` — validate `{{ocr_text}}` present (FR-002); validate `template.length <= 4000` (FR-015, reject with `ValidationException`); assign `MAX(version_number)+1 FOR UPDATE`
  - `activate(promptType, versionNumber, userId): Promise<AiPrompt>` — transaction: **`SELECT id FROM ai_prompts WHERE prompt_type=? AND is_active=1 FOR UPDATE`** first (serializes concurrent activations) → deactivate old → activate new → COMMIT → Redis DEL + audit_logs
  - `delete(promptType, versionNumber, userId): Promise<void>` — guard active version + audit_logs
  - `updateNote(promptType, versionNumber, note): Promise<AiPrompt>` — PATCH manual_note only
  - `saveTestResult(promptType, versionNumber, resultJson): Promise<void>` — auto-save from sandbox
- [x] T008 Create `backend/src/modules/ai/prompts/ai-prompts.controller.ts` — 5 endpoints per contracts/prompts.yaml with `@UseGuards(JwtAuthGuard, CaslAbilityGuard)` + `@Audit()` on mutating endpoints
- [x] T009 Create `backend/src/modules/ai/prompts/ai-prompts.module.ts` — import `TypeOrmModule.forFeature([AiPrompt])`, `RedisModule`, export `AiPromptsService`
- [x] T010 Register `AiPromptsModule` in `backend/src/modules/ai/ai.module.ts` imports array
- [x] T011 Add `AiPrompt` entity to `backend/src/database/` or TypeORM config entities array so it is picked up by the DB connection

**Checkpoint**: `pnpm --filter backend build` passes; GET /api/ai/prompts/ocr_extraction returns seed data — US1 frontend and US3 processor can proceed in parallel

---

## Phase 3: User Story 1 — Prompt Version Management UI (Priority: P1) 🎯 MVP

**Goal**: Superadmin จัดการ Prompt Versions ได้ผ่าน AI Admin Console (ไม่ต้อง upload PDF)

**Independent Test**: เปิด AI Admin Console → OCR Sandbox tab → เห็น Version History, สร้าง version ใหม่, activate, ลบ inactive version ได้

### Implementation for User Story 1

- [x] T012 [P] [US1] Create `frontend/types/ai-prompts.ts` — `AiPrompt` interface พร้อม `promptType`, `versionNumber`, `template`, `isActive`, `testResultJson`, `manualNote`, `lastTestedAt`, `activatedAt`, `createdAt`; and `SandboxResult` interface พร้อม `promptVersionUsed: number`, `answer: string`, `completedAt: string`
- [x] T013 [P] [US1] Create `frontend/lib/services/ai-prompts.service.ts` — `listVersions(promptType)`, `createVersion(promptType, template)`, `activateVersion(promptType, versionNumber)`, `deleteVersion(promptType, versionNumber)`, `updateNote(promptType, versionNumber, note)` — calls `/api/ai/prompts/...` via `apiClient`
- [x] T014 [US1] Create `frontend/hooks/use-ai-prompts.ts` — TanStack Query `useQuery` (listVersions) + `useMutation` (create, activate, delete, updateNote) with `invalidateQueries` on success
- [x] T015 [US1] Create `frontend/components/admin/ai/PromptVersionHistory.tsx` — Version list panel ทางขวา แสดง version_number, is_active badge (✅), last_tested_at, buttons: Load / Activate / Delete (Delete ปิดถ้า isActive)
- [x] T016 [US1] Create `frontend/components/admin/ai/OcrSandboxPromptManager.tsx` — 2-column layout: left (Prompt Editor textarea + "บันทึก Version ใหม่" button) + right (`PromptVersionHistory`) — โหลด active version template เข้า textarea เมื่อ mount
- [x] T017 [US1] Wire `OcrSandboxPromptManager` into existing AI Admin Console OCR Sandbox tab (replace or extend existing component in `frontend/app/(admin)/admin/...`)
- [x] T018 [P] [US1] Add i18n keys to `frontend/public/locales/th/ai-admin.json` and `frontend/public/locales/en/ai-admin.json` — keys: `prompt.saveVersion`, `prompt.activate`, `prompt.delete`, `prompt.load`, `prompt.activeLabel`, `prompt.placeholderError`, `prompt.deleteActiveError`

**Checkpoint**: US1 fully functional — version list, create, activate, delete work in UI without PDF upload

---

## Phase 4: User Story 2 — OCR Sandbox Testing with Prompt Evaluation (Priority: P2)

**Goal**: Superadmin upload PDF → ทดสอบ active prompt → ผลลัพธ์ auto-save ลง active version

**Independent Test**: upload PDF → รัน sandbox → เห็นผล 8 fields; test_result_json updated; manual note saved

### Implementation for User Story 2

- [x] T019 [US2] Extend `OcrSandboxPromptManager.tsx` — เพิ่ม File Upload section (PDF only) + "เริ่มทำ OCR Sandbox" button + ผลลัพธ์ JSON display panel + "บันทึก Manual Note" field (textarea + button)
- [x] T020 [US2] Add `runSandbox(promptType, file)` to `frontend/lib/services/ai-prompts.service.ts` — calls existing sandbox endpoint (POST /api/ai/ocr-sandbox or existing BullMQ trigger endpoint) passing PDF file
- [x] T021 [US2] Add `useSandboxRun` mutation to `frontend/hooks/use-ai-prompts.ts` — triggers sandbox run, polls for result, updates version list on completion (to reflect new `testResultJson`); read `promptVersionUsed` from job result and display as "ผลจาก Prompt Version X" badge in the result panel
- [x] T022 [US2] Add i18n keys: `prompt.runSandbox`, `prompt.sandboxResult`, `prompt.saveNote`, `prompt.noActivePrompt`, `prompt.timeoutInfo`, `prompt.versionUsed` to both locale files

**Checkpoint**: US2 fully functional — upload PDF, run sandbox, see results, save note

---

## Phase 5: User Story 3 — Runtime Prompt Resolution in Processor (Priority: P3)

**Goal**: `processSandboxExtract` + `processMigrateDocument` ใช้ `resolvePrompt()` จาก DB — ไม่มี hardcoded prompt

**Independent Test**: activate version 2 → trigger sandbox job → log shows "Using prompt version 2" — no hardcoded string in processor

### Implementation for User Story 3

- [x] T023 [US3] Inject `AiPromptsService` into `backend/src/modules/ai/processors/ai-batch.processor.ts` constructor
- [x] T024 [US3] Add `resolveActive(promptType: string, ocrText: string): Promise<{ resolvedPrompt: string; versionNumber: number }>` method to `AiPromptsService` — calls `getActive(promptType)`, replaces `{{ocr_text}}` with `ocrText`; if no active prompt: throw `BusinessException('No active prompt for type: ocr_extraction')` → caller (processor) lets it propagate → BullMQ marks job failed (fail-fast; do NOT catch-and-skip as that creates silent data gaps); returns both resolved string and versionNumber on success (FR-005)
- [x] T025 [US3] Replace hardcoded prompt string in `processSandboxExtract` with `const { resolvedPrompt, versionNumber } = await this.aiPromptsService.resolveActive('ocr_extraction', ocrResult.text)` — pass `resolvedPrompt` to `OllamaService.generate()` with `timeoutMs: 120000` (fix AI_TIMEOUT_MS bug); carry `versionNumber` forward to T027; **add `promptVersionUsed: versionNumber` to the completed Redis result shape** so frontend can display which version produced the result
- [x] T026 [US3] Replace hardcoded prompt string in `processMigrateDocument` with `const { resolvedPrompt } = await this.aiPromptsService.resolveActive('ocr_extraction', ocrResult.text)` — pass `resolvedPrompt` to `OllamaService.generate()`; keep existing timeout (no change); **also fix pre-existing bug: add `discipline?: string` to `MigrateDocumentMetadata` interface and add `discipline: readString(source.discipline)` to `parseMigrateDocumentMetadata()`** (see data-model.md "Pre-existing Bug"); NOTE: BullMQ job-level timeout is adequate for batch workloads — no change needed per ADR-029 D3
- [x] T027 [US3] In `processSandboxExtract` — `versionNumber` is captured at job start via `resolveActive()` (T025); after run completes call `this.aiPromptsService.saveTestResult('ocr_extraction', versionNumber, resultJson)` — no re-query needed (FR-005 race condition already guarded)

**Checkpoint**: US3 complete — `pnpm --filter backend build` passes; no hardcoded prompt strings in processor; resolvePrompt() uses DB/Redis

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Seed data verification, error boundary, tests

- [x] T028 [P] Write unit tests for `AiPromptsService` in `backend/src/modules/ai/prompts/ai-prompts.service.spec.ts`:
  - `create()`: rejects template without `{{ocr_text}}`; assigns correct version_number
  - `activate()`: deactivates old version; invalidates Redis cache; **calls `AuditLogService` (or `@Audit()` decorator) — verifies audit record created** (FR-013)
  - `delete()`: throws BusinessException when deleting active version; **calls AuditLogService on successful delete** (FR-013)
  - `delete()`: succeeds for inactive version
  - `getActive()`: returns from Redis cache when cache hit
  - `getActive()`: falls back to DB query when Redis unavailable (mock Redis to throw connection error)
- [x] T029 [P] Verify SQL delta syntax — run against a local MariaDB copy and confirm seed data is present with correct `is_active = 1`
- [x] T030 [P] Run `pnpm --filter backend lint` and `pnpm --filter frontend lint` — fix any issues in new files
- [x] T031 Run quickstart.md acceptance checklist end-to-end and confirm all checkboxes pass
- [x] T032 Update `CONTEXT.md` "System readiness summary" table — change ADR-029 row status from "🟡 ADR Accepted" to "✅ พร้อม" (if applicable)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately; T002b/T003/T004/T005/T006 parallel after T002
- **Phase 2 (Foundational)**: Depends on T002 (SQL delta) + T003/T004/T005/T006; BLOCKS all user stories
- **Phase 3 (US1)**: Depends on Phase 2 complete; T012/T013 parallel with T014
- **Phase 4 (US2)**: Depends on Phase 2 + most of Phase 3 (needs `OcrSandboxPromptManager` base)
- **Phase 5 (US3)**: Depends on Phase 2 (AiPromptsService); **can run in parallel with Phases 3 & 4**
- **Phase 6 (Polish)**: Depends on Phases 3, 4, 5 complete

### User Story Dependencies

- **US1 (P1)**: Needs Phase 2 complete — independently testable
- **US2 (P2)**: Needs Phase 2 + US1 UI base — builds on US1 component
- **US3 (P3)**: Needs Phase 2 only — **fully independent from US1/US2 frontend**; can be done in parallel

### Within Each Phase

- Phase 1: T001 → T002 (sequential, T001 informs seed data); T002b/T003/T004/T005/T006 parallel after T002
- Phase 2: T007 first → T008 (needs service) → T009 → T010/T011 parallel
- Phase 3: T012/T013 parallel → T014 → T015 → T016 → T017; T018 anytime
- Phase 4: T019 → T020 → T021; T022 anytime
- Phase 5: T023 → T024 → T025 → T026 → T027 (sequential — each builds on previous)

---

## Parallel Example: Phase 2 Backend + Phase 5 Processor

```bash
# Once Phase 1 complete, these can run in parallel:

# Developer A — Phase 2 (backend service/controller/module)
T007: AiPromptsService
T008: AiPromptsController
T009: AiPromptsModule
T010: Register in AiModule

# Developer B — Phase 5 (processor changes)
# NOTE: Developer B needs AiPromptsService injectable (T007 done)
# so Phase 5 starts after T007 completes
T023: Inject AiPromptsService
T024: resolvePrompt() method
T025: fix sandbox timeout + replace hardcoded prompt
T026: replace migrate-document hardcoded prompt
T027: auto-save test_result_json
```

---

## Implementation Strategy

### MVP First (User Story 1 — Version Management)

1. Complete Phase 1: Setup (T001–T006)
2. Complete Phase 2: Foundational (T007–T011)
3. Complete Phase 3: US1 (T012–T018)
4. **STOP and VALIDATE**: Admin can manage prompt versions without PDF upload
5. Deploy/demo US1 independently

### Incremental Delivery

1. Phase 1 + 2 → Foundation ready
2. Phase 3 (US1) → Admin can manage versions (**MVP delivered**)
3. Phase 5 (US3) in parallel with Phase 4 (US2) → Runtime resolution + Sandbox testing
4. Phase 6 → Polish and release

---

## Notes

- **T001 is critical**: Must read exact hardcoded prompt before deleting it — seed data depends on it
- **T025 + T026**: The hardcoded prompt removal is the "100% DB-driven" success criterion (SC-005)
- **T028**: Service unit tests should mock Redis to test cache hit + fallback scenarios
- **[P] tasks**: T003/T004/T005/T006 can all run in parallel (separate files)
- **Avoid**: modifying `ai-batch.processor.ts` (T025/T026) before `AiPromptsService` (T007) is injectable
