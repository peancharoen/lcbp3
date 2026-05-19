# Tasks: Intent Classification System

**Input**: Design documents from `/specs/200-fullstacks/224-intent-classification/`
**Prerequisites**: plan.md, spec.md, data-model.md, contracts/, research.md, quickstart.md

**Organization**: Tasks grouped by user story to enable independent implementation

---

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: User story label (US1, US2, US3, US4)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Database schema และ seed ข้อมูลเริ่มต้น

- [x] T001 สร้าง SQL Delta file สำหรับตาราง `ai_intent_definitions` และ `ai_intent_patterns` ที่ `specs/03-Data-and-Storage/deltas/16-add-intent-classification.sql`
- [x] T002 [P] สร้าง Seed file สำหรับ 12 Intent Definitions ที่ `backend/src/database/seeds/ai-intent.seed.ts`
- [x] T003 [P] เพิ่ม Configuration สำหรับ Ollama และ Intent Classification ใน `backend/.env.example`
- [x] T004 [P] เพิ่ม TypeScript interfaces สำหรับ Classification Result ที่ `backend/src/modules/ai/intent-classifier/interfaces/classification-result.interface.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure ที่ต้องเสร็จก่อน User Stories

**⚠️ CRITICAL**: ต้องเสร็จก่อนถึงจะเริ่ม User Stories ได้

- [x] T005 สร้าง IntentDefinition Entity ที่ `backend/src/modules/ai/intent-classifier/entities/intent-definition.entity.ts`
- [x] T006 [P] สร้าง IntentPattern Entity ที่ `backend/src/modules/ai/intent-classifier/entities/intent-pattern.entity.ts`
- [x] T007 สร้าง IntentPatternCache Service (Redis) ที่ `backend/src/modules/ai/intent-classifier/services/intent-pattern-cache.service.ts`
- [x] T008 สร้าง Ollama Client Service ที่ `backend/src/modules/ai/intent-classifier/services/ollama-client.service.ts` พร้อม timeout และ error handling
- [x] T009 สร้าง LLM Semaphore (Promise-based) ที่ `backend/src/modules/ai/intent-classifier/services/llm-semaphore.service.ts`
- [x] T010 [P] Regex Validation — embedded ใน `IntentPatternService.validateRegex()` (ไม่แยก helper file)
- [x] T011 สร้าง IntentClassifierService (Core Logic) ที่ `backend/src/modules/ai/intent-classifier/services/intent-classifier.service.ts` รวม Pattern Match + LLM Fallback
- [x] T012 สร้าง IntentClassifierModule ที่ `backend/src/modules/ai/intent-classifier/intent-classifier.module.ts`
- [x] T013 Update AiModule เพื่อ import IntentClassifierModule ที่ `backend/src/modules/ai/ai.module.ts`

**Checkpoint**: Foundation ready — พร้อมเริ่ม User Story implementation

---

## Phase 3: User Story 1 - Admin จัดการ Intent Definitions และ Patterns (Priority: P1) 🎯 MVP

**Goal**: Admin สามารถสร้าง Intent และ Patterns ผ่าน API และใช้งานได้ภายใน 5 นาที

**Independent Test**: สร้าง Intent → เพิ่ม Pattern → ทดสอบ Classification → Pattern Match ต้องทำงาน

### Tests for User Story 1

- [x] T014 [P] [US1] Unit test สำหรับ IntentDefinitionService — `intent-definition.service.spec.ts` (9 tests)
- [x] T015 [P] [US1] Unit test สำหรับ IntentPatternService — `intent-pattern.service.spec.ts` (12 tests)
- [x] T016 [P] [US1] Integration test สำหรับ Admin API — `intent-admin.controller.spec.ts` (10 tests)

### Implementation for User Story 1

- [x] T017 [P] [US1] สร้าง DTOs สำหรับ Admin API ที่ `backend/src/modules/ai/intent-classifier/dto/`
- [x] T018 [P] [US1] สร้าง IntentDefinitionService (CRUD) ที่ `backend/src/modules/ai/intent-classifier/services/intent-definition.service.ts`
- [x] T019 [P] [US1] สร้าง IntentPatternService (CRUD + Regex validation + intentCode existence check) ที่ `backend/src/modules/ai/intent-classifier/services/intent-pattern.service.ts`
- [x] T020 [US1] สร้าง IntentAdminController (Admin endpoints) ที่ `backend/src/modules/ai/intent-classifier/controllers/intent-admin.controller.ts`
- [x] T021 [US1] เพิ่ม JwtAuthGuard + RbacGuard บน Admin endpoints
- [x] T022 [US1] เพิ่ม Audit logging สำหรับการแก้ไข Intent และ Patterns — @Audit decorator on admin endpoints

**Checkpoint**: User Story 1 complete — Admin จัดการ Intent/Patterns ได้

---

## Phase 4: User Story 2 - User สอบถามข้อมูลผ่าน AI Chat (Priority: P1)

**Goal**: User ถามคำถามธรรมชาติ → ระบบ Classify เป็น Intent ที่ถูกต้อง

**Independent Test**: ส่งคำถาม "สรุปเอกสารนี้" → ต้องได้ Intent `SUMMARIZE_DOCUMENT` ด้วย Pattern Match (< 10ms)

### Tests for User Story 2

- [x] T023 [P] [US2] Unit test สำหรับ Pattern Matching logic ที่ `backend/src/modules/ai/intent-classifier/services/pattern-matcher.service.spec.ts`
- [x] T024 [P] [US2] Unit test สำหรับ LLM Semaphore ที่ `backend/src/modules/ai/intent-classifier/services/llm-semaphore.service.spec.ts`
- [x] T025 [P] [US2] Unit test สำหรับ IntentClassifierService ที่ `backend/src/modules/ai/intent-classifier/services/intent-classifier.service.spec.ts`
- [x] T026 [P] [US2] Integration test สำหรับ Classification API — `intent-classify.controller.spec.ts` (3 tests)

### Implementation for User Story 2

- [x] T027 [P] [US2] สร้าง PatternMatcher Service ที่ `backend/src/modules/ai/intent-classifier/services/pattern-matcher.service.ts`
- [x] T028 [P] [US2] LLM Fallback — implemented ใน `ollama-client.service.ts` + `intent-classifier.service.ts` (ไม่แยก service)
- [x] T029 [US2] สร้าง Classification API `POST /ai/intent/classify` ที่ `backend/src/modules/ai/intent-classifier/controllers/intent-classify.controller.ts` + @Throttle(30/min)
- [x] T030 [US2] เพิ่ม Input validation (max 200 chars, trim) ใน `classify-query.dto.ts`
- [x] T031 [US2] สร้าง Audit logging สำหรับทุก Classification request — ClassificationAuditService (FR-010)
- [x] T032 [US2] Seed initial patterns สำหรับ 12 intents (v1) — `deltas/17-seed-intent-patterns.sql`

**Checkpoint**: User Story 2 complete — Classification ทำงานได้ (Pattern + LLM Fallback)

---

## Phase 5: User Story 3 - ตรวจสอบและวิเคราะห์ประสิทธิภาพ (Priority: P2)

**Goal**: Admin สามารถดู Analytics และวิเคราะห์ประสิทธิภาพของ Intent Classification

**Independent Test**: ดูหน้า Analytics → แสดง Hit Rate, Confidence Distribution, Latency ได้

### Tests for User Story 3

- [x] T033 [P] [US3] Unit test สำหรับ Analytics Service — `intent-analytics.service.spec.ts` (8 tests)

### Implementation for User Story 3

- [x] T034 [P] [US3] สร้าง IntentAnalyticsService ที่ `backend/src/modules/ai/intent-classifier/services/intent-analytics.service.ts`
- [x] T035 [US3] สร้าง Analytics API endpoint `GET /admin/ai/intent-analytics` ที่ `controllers/intent-analytics.controller.ts`
- [x] T036 [US3] สร้าง Analytics UI Components ที่ `frontend/components/ai/intent-classification/analytics/` (4 components)
- [x] T037 [US3] สร้างหน้า Analytics Dashboard ที่ `frontend/app/(admin)/admin/ai/intent-classification/analytics/page.tsx`

**Checkpoint**: User Story 3 complete — Analytics แสดงผลได้

---

## Phase 6: User Story 4 - Test Console สำหรับทดสอบ Intent (Priority: P2)

**Goal**: Admin/Developer สามารถทดสอบคำถามแบบ Real-time ผ่าน UI

**Independent Test**: พิมพ์คำถามใน Test Console → แสดงผล Classification Result พร้อม Method และ Confidence

### Tests for User Story 4

- [x] T038 [P] [US4] Unit test สำหรับ Test Console Hook ที่ `frontend/hooks/ai/__tests__/use-intent-classification.test.ts` (9 tests)

### Implementation for User Story 4

- [x] T039 [P] [US4] สร้าง `useIntentClassification` hook ที่ `frontend/hooks/ai/use-intent-classification.ts`
- [x] T040 [P] [US4] สร้าง TestConsolePanel component ที่ `frontend/components/ai/intent-classification/test-console-panel.tsx`
- [x] T041 [P] [US4] สร้าง ClassificationResultCard component ที่ `frontend/components/ai/intent-classification/classification-result-card.tsx`
- [x] T042 [US4] สร้างหน้า Test Console ที่ `frontend/app/(admin)/admin/ai/intent-classification/test-console/page.tsx`

**Checkpoint**: User Story 4 complete — Test Console ใช้งานได้

---

## Phase 7: User Story 5 - Admin UI สำหรับจัดการ Intent และ Patterns (Priority: P2)

**Goal**: Admin สามารถจัดการ Intent Definitions และ Patterns ผ่าน UI

**Independent Test**: สร้าง Intent ใหม่ผ่าน UI → เพิ่ม Pattern → ทดสอบ Classification → ต้องทำงาน

### Implementation for User Story 5

- [x] T043 [P] [US5] สร้าง AI Intent Service (API client) ที่ `frontend/lib/services/ai-intent.service.ts`
- [x] T044 [P] [US5] สร้าง IntentForm component ที่ `frontend/components/ai/intent-classification/intent-form.tsx`
- [x] T045 [P] [US5] สร้าง PatternForm component ที่ `frontend/components/ai/intent-classification/pattern-form.tsx`
- [x] T046 [US5] สร้างหน้า Intent Definitions List ที่ `frontend/app/(admin)/admin/ai/intent-classification/page.tsx`
- [x] T047 [US5] สร้างหน้า Intent Detail + Patterns ที่ `frontend/app/(admin)/admin/ai/intent-classification/[intentCode]/page.tsx`

**Checkpoint**: User Story 5 complete — Admin UI ครบถ้วน

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Improvements ที่กระทบทุก User Stories

- [x] T048 [P] เพิ่ม i18n keys สำหรับ Intent Classification UI ที่ `frontend/public/locales/th/ai.json` และ `frontend/public/locales/en/ai.json`
- [x] T049 [P] เพิ่ม Documentation สำหรับ Intent Classification API ที่ `docs/ai-knowledge-base/playbooks/intent-classification.md`
- [x] T050 รัน quickstart.md validation — ตรวจสอบ: 44 backend tests + 9 frontend tests pass
- [x] T051 [P] Performance testing สำหรับ Pattern Match latency (< 10ms target) ที่ `backend/tests/performance/pattern-matcher.perf-spec.ts`
- [x] T052 Security review: ตรวจสอบ Regex injection, CASL guards, Rate limiting (@Throttle added)
- [x] T053 [P] Code review และ refactoring (@Exclude on id, intentCode validation, error handling)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — เริ่มได้ทันที
- **Foundational (Phase 2)**: ขึ้นกับ Phase 1 — BLOCKS ทุก User Stories
- **User Stories (Phase 3-7)**: ขึ้นกับ Phase 2
  - US1, US2 (P1): ทำก่อน (MVP)
  - US3, US4, US5 (P2): ทำทีหลัง
- **Polish (Phase 8)**: ขึ้นกับทุก User Stories ที่ต้องการ

### User Story Dependencies

- **US1 (Admin Management)**: ไม่มี dependency — เริ่มได้หลัง Foundational
- **US2 (Classification)**: ไม่มี dependency — เริ่มได้หลัง Foundational
- **US3 (Analytics)**: ขึ้นกับ US2 (ต้องมี Classification data ก่อน)
- **US4 (Test Console)**: ขึ้นกับ US2 (ต้องมี Classification API ก่อน)
- **US5 (Admin UI)**: ขึ้นกับ US1 (ใช้ API เดียวกัน)

### Parallel Opportunities

- ภายใน Phase 1: T002-T004 ทำ parallel ได้
- ภายใน Phase 2: T006, T010, T013 ทำ parallel ได้
- หลัง Phase 2 เสร็จ: US1 และ US2 ทำ parallel ได้
- หลัง US1 + US2 เสร็จ: US3, US4, US5 ทำ parallel ได้

---

## Implementation Strategy

### MVP First (US1 + US2 Only)

1. ✅ Phase 1: Setup — DONE (T001-T004)
2. ✅ Phase 2: Foundational — DONE (T005-T013)
3. ✅ Phase 3: US1 (Admin Management) — DONE (T017-T021, tests deferred)
4. ✅ Phase 4: US2 (Classification) — DONE (T023-T030, audit deferred)
5. ✅ Phase 6: US4 (Test Console) — DONE (T039-T042)
6. ✅ Phase 7: US5 (Admin UI) — DONE (T043-T047)
7. ✅ Phase 8: i18n + Security + Code Review — DONE (T048, T052, T053)
8. ✅ Remaining tasks (T014-T015, T022, T031-T032, T038, T049-T051) — DONE
9. ✅ All remaining tasks (T016, T026, T033-T037) — DONE
10. 🎉 **ALL 52 TASKS COMPLETE** — Ready for deploy/demo

### Incremental Delivery

1. Phase 1 + 2 → Foundation ready
2. US1 + US2 → Test → Deploy (MVP!)
3. US3 (Analytics) → Test → Deploy
4. US4 (Test Console) → Test → Deploy
5. US5 (Admin UI) → Test → Deploy

### Parallel Team Strategy

ด้วยทีมหลายคน:

- Developer A: US1 + US5 (Admin ทั้ง Backend + Frontend)
- Developer B: US2 (Classification Core)
- Developer C: US3 + US4 (Analytics + Test Console)

---

## Summary

| Phase | Tasks | Description |
|-------|-------|-------------|
| 1 Setup | 4 | SQL Delta, Seed, Config, Interfaces |
| 2 Foundational | 9 | Entities, Services, Module |
| 3 US1 (P1) | 9 | Admin Management API |
| 4 US2 (P1) | 10 | Classification Core |
| 5 US3 (P2) | 4 | Analytics |
| 6 US4 (P2) | 5 | Test Console |
| 7 US5 (P2) | 5 | Admin UI |
| 8 Polish | 6 | i18n, Docs, Performance, Security |
| **Total** | **52** | |

**MVP Scope**: T001-T032 (Phase 1-4) = 35 tasks
