---
description: 'Task list for AI Console UX Refactor implementation'
---

# Tasks: AI Console UX Refactor

**Input**: Design documents from `/specs/200-fullstacks/239-ai-console-ux-refactor/`
**Prerequisites**: plan.md (required), spec.md (required for user stories)

**Tests**: Tests are NOT included in this feature - this is a UI-only refactor with manual testing verification.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Web app**: `frontend/app/`, `frontend/components/`

---

## Phase 1: User Story 1 - Correct AI Console Description (Priority: P1) 🎯 MVP

**Goal**: Update the AI Console page description to accurately reflect that this is a Superadmin-only control panel for monitoring and controlling the AI system.

**Independent Test**: Open the AI Console page as a Superadmin and verify the page description reads "ควบคุมและตรวจสอบระบบ AI สำหรับ Superadmin" instead of the previous misleading description.

### Implementation for User Story 1

- [X] T001 [US1] Update page description in frontend/app/(admin)/admin/ai/page.tsx line 255 from "ควบคุมสถานะ AI features สำหรับผู้ใช้ทั่วไป" to "ควบคุมและตรวจสอบระบบ AI สำหรับ Superadmin"

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently. The page description accurately reflects the Superadmin-only nature of the AI Console.

---

## Phase 2: User Story 2 - Health Monitoring Visible Across All Tabs (Priority: P1)

**Goal**: Move health monitoring cards (Ollama, Qdrant, OCR Sidecar, BullMQ, VRAM) above the tab navigation so they are visible on all tabs without switching.

**Independent Test**: Navigate to each tab (System Toggle, RAG Playground, 3-Step Pipeline Sandbox) and verify that all health monitoring cards are displayed above the tab content and updating correctly.

### Implementation for User Story 2

- [X] T002 [US2] Move health monitoring cards section from TabsContent value="overview" to before the Tabs component in frontend/app/(admin)/admin/ai/page.tsx
- [X] T003 [US2] Move System Toggle card from TabsContent value="overview" to before the Tabs component in frontend/app/(admin)/admin/ai/page.tsx
- [X] T004 [US2] Move Protection/Polling cards from TabsContent value="overview" to before the Tabs component in frontend/app/(admin)/admin/ai/page.tsx
- [X] T005 [US2] Remove empty TabsContent value="overview" section in frontend/app/(admin)/admin/ai/page.tsx
- [X] T006 [US2] Verify health status polling continues to work correctly on all tabs (TanStack Query refetchInterval remains 30 seconds)
- [X] T006a [US2] Verify responsive layout of health cards when moved above tabs (grid layout works on mobile, tablet, desktop - FR-007 implementation verification)

**Checkpoint**: At this point, User Story 2 should be fully functional and testable independently. Health monitoring cards are visible on all tabs, polling continues to work correctly, and responsive layout is verified.

---

## Phase 3: User Story 3 - Accurate Tab Naming (Priority: P2)

**Goal**: Rename tabs to accurately reflect their functionality (Overview & Health → System Toggle, OCR Sandbox → 3-Step Pipeline Sandbox).

**Independent Test**: Open the AI Console page and verify tab names are "System Toggle", "RAG Playground", and "3-Step Pipeline Sandbox" with accurate descriptions.

### Implementation for User Story 3

- [X] T007 [US3] Rename TabsTrigger value="overview" from "Overview & Health" to "System Toggle" in frontend/app/(admin)/admin/ai/page.tsx
- [X] T008 [US3] Rename TabsTrigger value="ocr" from "OCR Sandbox" to "3-Step Pipeline Sandbox" and change value to "sandbox" in frontend/app/(admin)/admin/ai/page.tsx
- [X] T009 [US3] Update TabsContent value from "ocr" to "sandbox" in frontend/app/(admin)/admin/ai/page.tsx
- [X] T010 [US3] Verify tab navigation works correctly after renaming in frontend/app/(admin)/admin/ai/page.tsx

**Checkpoint**: At this point, User Story 3 should be fully functional and testable independently. Tab names accurately describe their functionality and navigation works correctly.

---

## Phase 4: Polish & Cross-Cutting Concerns

**Purpose**: Final verification and manual testing of all changes.

- [ ] T011 [P] Manual testing: Open AI Console and verify page description is correct
- [ ] T012 [P] Manual testing: Navigate to each tab and verify health cards are visible
- [ ] T013 [P] Manual testing: Verify health status polling updates correctly (30-second interval)
- [ ] T014 [P] Manual testing: Verify tab names are accurate and navigation works
- [ ] T015 [P] Manual testing: Test RAG Playground functionality to ensure no regression
- [ ] T016 [P] Manual testing: Test 3-Step Pipeline Sandbox functionality to ensure no regression - final verification of FR-007 (implementation already verified in T006a)
- [ ] T017 [P] Manual testing: Verify responsive layout on different screen sizes (mobile, tablet, desktop)

---

## Dependencies & Execution Order

### Phase Dependencies

- **User Story 1 (Phase 1)**: No dependencies - can start immediately
- **User Story 2 (Phase 2)**: Depends on User Story 1 completion (should update description before major structural changes)
- **User Story 3 (Phase 3)**: Can start after User Story 2 completion (tab renaming should happen after structural changes)
- **Polish (Phase 4)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start immediately - No dependencies on other stories
- **User Story 2 (P1)**: Should start after User Story 1 - Major structural changes should happen after description update
- **User Story 3 (P2)**: Should start after User Story 2 - Tab renaming should happen after structural changes

### Within Each User Story

- All tasks within a story are sequential and must be completed in order
- Each story should be tested independently before moving to the next story

### Parallel Opportunities

- All Polish phase tasks marked [P] can run in parallel (manual testing on different aspects)
- User Story 3 tasks T007 and T008 can potentially run in parallel (renaming different tabs)

---

## Parallel Example: Polish Phase

```bash
# Launch all manual testing tasks together:
Task: "Manual testing: Open AI Console and verify page description is correct"
Task: "Manual testing: Navigate to each tab and verify health cards are visible"
Task: "Manual testing: Verify health status polling updates correctly (30-second interval)"
Task: "Manual testing: Verify tab names are accurate and navigation works"
Task: "Manual testing: Test RAG Playground functionality to ensure no regression"
Task: "Manual testing: Test 3-Step Pipeline Sandbox functionality to ensure no regression"
Task: "Manual testing: Verify responsive layout on different screen sizes (mobile, tablet, desktop)"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: User Story 1 (Correct AI Console Description)
2. **STOP and VALIDATE**: Test User Story 1 independently
3. Deploy/demo if ready

### Incremental Delivery

1. Complete User Story 1 → Test independently → Deploy/Demo (MVP!)
2. Add User Story 2 → Test independently → Deploy/Demo
3. Add User Story 3 → Test independently → Deploy/Demo
4. Complete Polish phase → Final validation
5. Each story adds value without breaking previous stories

### Sequential Strategy (Recommended for this feature)

Since this is a UI-only refactor with sequential dependencies:
1. Complete User Story 1 (description update)
2. Complete User Story 2 (health cards relocation)
3. Complete User Story 3 (tab renaming)
4. Complete Polish phase (comprehensive testing)
5. Deploy all changes together as a single cohesive UX improvement

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Manual testing is required for this UI-only refactor
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Avoid: vague tasks, same file conflicts, cross-story dependencies that break independence
