# Tasks: AI Console Collapsible Cards

**Input**: Design documents from `/specs/200-fullstacks/240-ai-console-collapsible-cards/`
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

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [ ] T001 Import `ChevronUp` icon from `lucide-react` in `frontend/app/(admin)/admin/ai/page.tsx`
- [ ] T002 Implement state variables `isSectionCollapsed` and `collapsedCards` in `frontend/app/(admin)/admin/ai/page.tsx`
- [ ] T003 Implement `useEffect` for loading collapse states from `localStorage` in `frontend/app/(admin)/admin/ai/page.tsx`
- [ ] T004 Implement toggle handlers `toggleSection` and `toggleCard` that update states and write to `localStorage` in `frontend/app/(admin)/admin/ai/page.tsx`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: None required for this simple UI-only task.

---

## Phase 3: User Story 1 - Master Collapse for Monitoring Section (Priority: P1) 🎯 MVP

**Goal**: Implement the master monitoring section toggle header and container collapse animations.

**Independent Test**: Click the master collapse chevron in the monitoring section header and verify that the cards grid collapses/expands smoothly.

### Implementation for User Story 1

- [ ] T005 [US1] Add the Master Section Toggle Header ("AI Engine Infrastructure Monitoring") with ChevronUp toggle button in `frontend/app/(admin)/admin/ai/page.tsx`
- [ ] T006 [US1] Wrap the health cards grid in a collapsible wrapper with Tailwind transition classes (`transition-all duration-300 ease-in-out`, `max-h-0`, `max-h-[2000px]`, `opacity-0`, `opacity-100`) in `frontend/app/(admin)/admin/ai/page.tsx`

**Checkpoint**: At this point, User Story 1 is fully functional and testable independently. The entire section collapses/expands.

---

## Phase 4: User Story 2 - Individual Card Collapse (Priority: P2)

**Goal**: Implement collapse buttons and container animations for each of the 5 monitoring cards.

**Independent Test**: Click the chevron inside Ollama card and verify that only the Ollama card content collapses, leaving the header visible.

### Implementation for User Story 2

- [ ] T007 [US2] Add individual collapse chevron buttons to each of the 5 monitoring cards (Ollama, Qdrant, OCR Sidecar, BullMQ, VRAM) in `frontend/app/(admin)/admin/ai/page.tsx`
- [ ] T008 [US2] Wrap each card's body in a collapsible wrapper with Tailwind transition and height restriction classes in `frontend/app/(admin)/admin/ai/page.tsx`

**Checkpoint**: At this point, User Story 2 is fully functional and testable. Cards can be collapsed/expanded individually.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Final verification, linting, and formatting.

- [ ] T009 Run typecheck using `pnpm --filter lcbp3-frontend exec tsc --noEmit` and fix any type errors
- [ ] T010 Run lint using `pnpm --filter lcbp3-frontend exec eslint .` and fix any lint issues
- [ ] T011 Verify collapsed states are correctly preserved in `localStorage` across page reloads and tab switches
- [ ] T012 Verify responsive layout (mobile, tablet, desktop) behaves correctly when collapsed/expanded
