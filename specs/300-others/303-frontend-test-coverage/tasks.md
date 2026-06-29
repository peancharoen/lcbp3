# Tasks: Frontend Test Coverage — Phased Improvement

**Input**: Design documents from `specs/300-others/303-frontend-test-coverage/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅
**Branch**: `303-frontend-test-coverage`

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on each other)
- **[Story]**: Which Phase/User Story this task belongs to (US1=Phase1, US2=Phase2, US3=Phase3)
- Include exact file paths in descriptions

## ⚠️ Important Conventions (จาก research.md)

- **Test extension**: `.test.ts` / `.test.tsx` (ไม่ใช่ `.spec.ts`) — ตาม vitest.config.ts include pattern
- **Test location**: วางใน `__tests__/` subfolder ข้างๆ source (เช่น `hooks/__tests__/use-foo.test.ts`)
- **Coverage command**: `pnpm run test:coverage` (ไม่ใช่ `test:cov`)
- **Mock helper**: ใช้ `createTestQueryClient()` จาก `@/lib/test-utils` สำหรับ hooks + components
- **apiClient**: mock ไว้ใน `vitest.setup.ts` แล้ว — ไม่ต้อง mock ซ้ำในแต่ละ service test
- **publicId**: UUIDv7 เสมอในทุก mock data — ห้ามใช้ `id: 1` (ADR-019)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: ตรวจสอบ test environment — helper มีอยู่แล้วใน codebase

- [x] T001 อ่าน `frontend/vitest.config.ts` ยืนยัน include pattern และ coverage config — ไม่ต้องแก้ไข แค่ทำความเข้าใจ
- [x] T002 รัน `pnpm run test:coverage` ครั้งแรก เพื่อยืนยันว่า environment พร้อม และดู baseline coverage 13.54%
- [x] T003 อ่าน `frontend/lib/test-utils.tsx` ทำความเข้าใจ `createTestQueryClient()` pattern
- [x] T004 อ่าน test file ตัวอย่าง `frontend/hooks/__tests__/use-correspondence.test.ts` เพื่อ internalize pattern

**Checkpoint**: environment พร้อม, helper และ factory พร้อมใช้

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: สร้าง test patterns พื้นฐานที่ทุก Phase ใช้ร่วมกัน

**⚠️ CRITICAL**: Phase 3, 4, 5 ต้องรอให้ Phase นี้เสร็จก่อน

- [x] T007 สร้าง test สำหรับ API client mock pattern ใน `frontend/__tests__/helpers/api-mock.ts` — ตรวจสอบว่า vi.mock ทำงานได้ถูกต้อง
- [x] T008 [P] เขียน smoke test สำหรับ 1 hook ง่ายๆ ใน `frontend/hooks/use-auth.spec.ts` เพื่อยืนยัน Vitest + RTL ทำงาน end-to-end
- [x] T009 กำหนด test naming convention และ file header format ใน `frontend/__tests__/README.md` (Thai comments, `// File:` header)

**Checkpoint**: Foundation ready — สามารถเริ่ม Phase 3, 4, 5 ได้

---

## Phase 3: User Story 1 — Phase 1 Coverage (13% → 30%) (Priority: P1) 🎯 MVP

**Goal**: ยก Statement Coverage รวมจาก 13.54% ขึ้นเป็น ≥ 30% โดยเน้น hooks/, lib/services/, components/correspondences/

**Independent Test**: รัน `pnpm run test:coverage` และดูว่า Statements ≥ 30%

### hooks/ — Custom Hooks (19 ที่ยังขาด)

- [x] T010 [P] [US1] เขียน `frontend/hooks/__tests__/use-master-data.test.ts` — ครอบ `useProjects`, `useOrganizations`, `useUsers` (hook นี้ถูก import ในทุก form)
- [x] T011 [P] [US1] เขียน `frontend/hooks/__tests__/use-workflows.test.ts` — ครอบ list + filter workflows, error state
- [x] T012 [P] [US1] เขียน `frontend/hooks/__tests__/use-transmittal.test.ts` — ครอบ CRUD operations
- [x] T013 [P] [US1] เขียน `frontend/hooks/__tests__/use-numbering.test.ts` — ครอบ document number generation
- [x] T014 [P] [US1] เขียน `frontend/hooks/__tests__/use-ai-prompts.test.ts` — ครอบ list, activate prompt
- [x] T015 [P] [US1] เขียน `frontend/hooks/__tests__/use-delegation.test.ts` — ครอบ delegation CRUD
- [x] T016 [P] [US1] เขียน `frontend/hooks/__tests__/use-dashboard.test.ts` — ครอบ metrics fetch, error
- [x] T017 [P] [US1] เขียน `frontend/hooks/__tests__/use-review-teams.test.ts` — ครอบ list + member management

### lib/services/ — Services (25 ที่ยังขาด — เน้น high priority ก่อน)

- [x] T018 [P] [US1] เขียน `frontend/lib/services/__tests__/rfa.service.test.ts` — ครอบ getAll, getByUuid, create, submit (apiClient mock ใน setup.ts แล้ว)
- [x] T019 [P] [US1] เขียน `frontend/lib/services/__tests__/user.service.test.ts` — ครอบ getAll, getById, update
- [x] T020 [P] [US1] เขียน `frontend/lib/services/__tests__/transmittal.service.test.ts` — ครอบ CRUD
- [x] T021 [P] [US1] เขียน `frontend/lib/services/__tests__/circulation.service.test.ts` — ครอบ CRUD
- [x] T022 [P] [US1] เขียน `frontend/lib/services/__tests__/dashboard.service.test.ts` — ครอบ metrics endpoints

### components/correspondences/ — ยังขาด 8 files

- [x] T023 [P] [US1] เขียน `frontend/components/correspondences/__tests__/list.test.tsx` — ครอบ render, empty state, loading
- [x] T024 [P] [US1] เขียน `frontend/components/correspondences/__tests__/circulation-status-card.test.tsx` — ครอบทุก status
- [x] T025 [P] [US1] เขียน `frontend/components/correspondences/__tests__/tag-manager.test.tsx` — ครอบ add/remove tags

### components/common/ และ components/ui/

- [x] T026 [P] [US1] เขียน test สำหรับ components ใน `frontend/components/common/__tests__/` — ยก coverage จาก 26% ขึ้น ≥ 60%
- [x] T027 [P] [US1] เขียน test สำหรับ components ใน `frontend/components/ui/__tests__/` — ยก coverage จาก 31% ขึ้น ≥ 60%

**Checkpoint**: รัน `pnpm run test:coverage` → ยืนยัน Statements ≥ 30% → merge Phase 1 PR

---

## Phase 4: User Story 2 — Phase 2 Coverage (30% → 50%) (Priority: P2)

**Goal**: ยก Statement Coverage รวมจาก 30% ขึ้นเป็น ≥ 50% โดยเน้น rfas/, numbering/, lib/api/, drawings/

**Independent Test**: รัน `pnpm run test:coverage` และดูว่า Statements ≥ 50%

### components/rfas/ — RFA (Critical Business Feature, 0% → ≥60%)

- [x] T028 [P] [US2] เขียน `frontend/components/rfas/__tests__/list.test.tsx` — ครอบ render, filter by status, empty state
- [x] T029 [P] [US2] เขียน `frontend/components/rfas/__tests__/detail.test.tsx` — ครอบ header display, attachment list, action buttons
- [x] T030 [US2] เขียน `frontend/components/rfas/__tests__/form.test.tsx` — ครอบ validation, submit (ไฟล์ใหญ่ 32KB — ต้องแบ่ง test เป็น describe blocks)

### lib/services/ — Services ที่ยังขาด (ต่อจาก Phase 1)

- [x] T031 [P] [US2] เขียน `frontend/lib/services/__tests__/workflow-engine.service.test.ts` — ครอบ getAll, transition, getHistory
- [x] T032 [P] [US2] เขียน `frontend/lib/services/__tests__/document-numbering.service.test.ts` — ครอบ generate, preview, format
- [x] T033 [P] [US2] เขียน `frontend/lib/services/__tests__/session.service.test.ts` — ครอบ login, logout, refresh

### components/numbering/ — Document Numbering

- [x] T034 [P] [US2] เขียน `frontend/components/numbering/__tests__/` tests — ครอบ format display, configuration form, preview

### lib/api/ — API Client Layer (0.38% → ≥70%)

- [x] T035 [P] [US2] เขียน `frontend/lib/api/__tests__/` tests — ครอบ request interceptors, response handlers, error cases

### components/auth/ และ components/drawings/

- [x] T036 [P] [US2] เขียน `frontend/components/auth/__tests__/` tests — ครอบ login form, validation
- [x] T037 [P] [US2] เขียน `frontend/components/drawings/__tests__/` tests — ครอบ Shop Drawing list, upload, status
- [x] T038 [P] [US2] เขียน test เพิ่มสำหรับ `frontend/components/workflows/__tests__/` — ยก coverage จาก 15% ขึ้น ≥ 60%
- [x] T039 [P] [US2] เขียน `frontend/hooks/__tests__/use-workflow-history.test.ts` — ครอบ history fetch

**Checkpoint**: รัน `pnpm run test:coverage` → ยืนยัน Statements ≥ 50% → merge Phase 2 PR

---

## Phase 5: User Story 3 — Phase 3 Coverage (50% → 70%) (Priority: P3)

**Goal**: ยก Statement Coverage รวมจาก 50% ขึ้นเป็น ≥ 70% โดยเน้น admin/, workflow/, layout/

**Independent Test**: รัน `npm run test:cov` และดูว่า Statements ≥ 70%

### components/admin/ — Admin Panel

- [ ] T034 [P] [US3] เขียน test สำหรับ Admin dashboard components ใน `frontend/components/admin/` — ครอบ render, data display
- [x] T035 [P] [US3] เขียน test สำหรับ AI Admin panel ใน `frontend/components/admin/ai/` — ครอบ model selection, prompt management (ADR-027)
- [x] T036 [P] [US3] เขียน test สำหรับ Admin reference management ใน `frontend/components/admin/reference/`
- [x] T037 [P] [US3] เขียน test สำหรับ Admin security settings ใน `frontend/components/admin/security/`

### components/workflow/ — Workflow Engine UI

- [x] T038 [P] [US3] เขียน test สำหรับ Workflow display components ใน `frontend/components/workflow/` — ครอบ step display, status
- [x] T039 [P] [US3] เขียน test สำหรับ Workflow transition buttons — ครอบ disable state, confirmation, submit

### components/layout/ และ Remaining

- [x] T040 [P] [US3] เขียน test สำหรับ Layout components ใน `frontend/components/layout/` — ครอบ nav, sidebar, header
- [x] T041 [P] [US3] เขียน test สำหรับ Transmittal components ใน `frontend/components/transmittal/`
- [x] T042 [P] [US3] เขียน test สำหรับ Circulation components ใน `frontend/components/circulation/`
- [x] T043 [P] [US3] เขียน test สำหรับ lib/stores/ — ครอบ state initialization, updates, selectors
- [x] T044 [P] [US3] เขียน test สำหรับ lib/utils/ — ครอบ utility functions ทั้งหมด (เป็น pure function ควร coverage 100%)
- [x] T045 [P] [US3] เขียน test สำหรับ lib/i18n/ — ครอบ translation loading, fallback

**Checkpoint**: รัน `pnpm run test:coverage` → ยืนยัน Statements ≥ 70% → merge Phase 3 PR

---

## Phase 6: Polish & Cross-Cutting

**Purpose**: ทบทวนคุณภาพ test ทั้งหมด

- [ ] T050 ตรวจสอบ test files ทั้งหมดว่าไม่มี `any` type หรือ `console.log`
- [ ] T051 [P] ตรวจสอบว่า mock data ทุกที่ใช้ `publicId` (UUIDv7) ไม่ใช่ `id` ตัวเลข (ADR-019)
- [ ] T052 [P] ตรวจสอบว่าทุก test file มี `// File:` header และ `// Change Log` comment
- [ ] T053 รัน `pnpm run test:coverage` ครั้งสุดท้าย บันทึกตัวเลขสุดท้ายใน `specs/300-others/303-frontend-test-coverage/plan.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: ไม่มี dependencies — เริ่มได้ทันที
- **Phase 2 (Foundational)**: ต้องรอ Phase 1 — BLOCKS Phase 3, 4, 5
- **Phase 3 (US1)**: ต้องรอ Phase 2 — ทำงานคู่กับ Phase 4, 5 ได้ถ้ามีทีม
- **Phase 4 (US2)**: ต้องรอ Phase 2 + Phase 3 merge แล้ว
- **Phase 5 (US3)**: ต้องรอ Phase 2 + Phase 4 merge แล้ว
- **Phase 6 (Polish)**: รอทุก Phase เสร็จ

### User Story Dependencies

- **US1 (Phase 1 13%→30%)**: เริ่มได้หลัง Foundational — ไม่ขึ้นกับ US อื่น
- **US2 (Phase 2 30%→50%)**: เริ่มหลัง US1 merge เพื่อ coverage ต่อเนื่อง
- **US3 (Phase 3 50%→70%)**: เริ่มหลัง US2 merge

### Parallel Opportunities (ภายใน Phase)

Tasks ที่มีป้าย `[P]` ภายใน Phase เดียวกัน สามารถทำพร้อมกันได้เนื่องจากเป็นคนละไฟล์:
- T003, T004, T005 ทำพร้อมกันได้
- T010–T022 ทำพร้อมกันได้ (คนละ folder/file)
- T023–T033 ทำพร้อมกันได้

---

## Implementation Strategy

### MVP First (Phase 3 / US1 เท่านั้น)

1. Phase 1: Setup ✓
2. Phase 2: Foundational ✓
3. Phase 3: US1 (hooks + services + correspondences)
4. **STOP & VALIDATE**: รัน `npm run test:cov` → ดู ≥ 30%
5. Merge PR แล้วเริ่ม Phase 4

### Incremental Delivery

1. Setup + Foundational → environment พร้อม
2. US1 → Coverage ≥ 30% → Merge
3. US2 → Coverage ≥ 50% → Merge
4. US3 → Coverage ≥ 70% → Merge

---

## Notes

- `[P]` = tasks ต่างไฟล์, ไม่ depends กัน → ทำพร้อมกันได้
- ทุก test file ต้องมี `// File: path/filename` บรรทัดแรก
- Mock data ต้องใช้ `publicId` เสมอ — ตัวเลือก `id` ใดๆ ถือเป็น Tier 1 violation (ADR-019)
- หากพบ bug ระหว่างเขียน test → **fix ทันที** อย่า skip
- Manual verify coverage ก่อน merge ทุก Phase
