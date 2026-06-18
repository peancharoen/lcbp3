// File: specs/200-fullstacks/239-ai-console-ux-refactor/spec.md
// Change Log:
// - 2026-06-18: Initial specification for AI Console UX Refactor

# Feature Specification: AI Console UX Refactor

**Feature Branch**: `[239-ai-console-ux-refactor]`
**Created**: 2026-06-18
**Status**: Draft
**Category**: 200-fullstacks
**Input**: User feedback on AI Console UX issues

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Correct AI Console Description (Priority: P1)

As a Superadmin, I want to see an accurate description of the AI Console page, so that I understand this is a Superadmin-only page for controlling and monitoring the AI system.

**Why this priority**: The current description "ควบคุมสถานะ AI features สำหรับผู้ใช้ทั่วไป" is misleading and suggests this page is for general users, which could cause confusion about who should access it.

**Independent Test**: Can be fully tested by opening the AI Console page and verifying the page description accurately reflects its purpose as a Superadmin-only control panel.

**Acceptance Scenarios**:

1. **Given** I am a Superadmin logged into the system, **When** I navigate to the AI Console page, **Then** I see the description "ควบคุมและตรวจสอบระบบ AI สำหรับ Superadmin" instead of the previous misleading description.

2. **Given** I am viewing the AI Console page header, **When** I read the page description, **Then** the description clearly indicates this is for Superadmin control and monitoring of the AI system.

---

### User Story 2 - Health Monitoring Visible Across All Tabs (Priority: P1)

As a Superadmin, I want to see health monitoring indicators (Ollama, Qdrant, OCR Sidecar, BullMQ, VRAM) on every tab of the AI Console, so that I can monitor system health while testing RAG Playground or 3-Step Pipeline Sandbox without switching tabs.

**Why this priority**: Currently health cards are only visible in the Overview tab, which means Superadmins cannot monitor system health while actively testing sandbox features. This is critical for diagnosing issues during testing.

**Independent Test**: Can be fully tested by navigating to each tab (System Toggle, RAG Playground, 3-Step Pipeline Sandbox) and verifying that all health monitoring cards are visible and updating correctly.

**Acceptance Scenarios**:

1. **Given** I am on the AI Console page, **When** I navigate to the RAG Playground tab, **Then** I see all health monitoring cards (Ollama, Qdrant, OCR Sidecar, BullMQ, VRAM) displayed above the tab content.

2. **Given** I am on the AI Console page, **When** I navigate to the 3-Step Pipeline Sandbox tab, **Then** I see all health monitoring cards displayed above the tab content.

3. **Given** I am viewing health monitoring cards on any tab, **When** the health status changes, **Then** the cards update their status indicators within the polling interval (30 seconds).

4. **Given** I am testing the RAG Playground, **When** I observe degraded health status, **Then** I can see the issue immediately without switching to the Overview tab.

---

### User Story 3 - Accurate Tab Naming (Priority: P2)

As a Superadmin, I want the tab names to accurately reflect their functionality, so that I understand what each tab does without confusion.

**Why this priority**: The current tab name "OCR Sandbox" is misleading because it suggests only OCR testing, when it actually provides a full 3-Step Pipeline (OCR → AI Extract → RAG Prep). This could cause admins to miss the full testing capabilities.

**Independent Test**: Can be fully tested by opening the AI Console page and verifying that tab names accurately describe their functionality.

**Acceptance Scenarios**:

1. **Given** I am on the AI Console page, **When** I view the tab list, **Then** I see the tab named "3-Step Pipeline Sandbox" instead of "OCR Sandbox".

2. **Given** I am viewing the tab list, **When** I read the tab names, **Then** each tab name clearly describes its purpose:
   - "System Toggle" for controlling AI features
   - "RAG Playground" for RAG query testing
   - "3-Step Pipeline Sandbox" for full pipeline testing

3. **Given** I am a new Superadmin, **When** I see the tab name "3-Step Pipeline Sandbox", **Then** I understand this tab provides testing for the complete AI pipeline (OCR → AI Extract → RAG Prep).

---

### Edge Cases

- **Health polling continues after tab switch**: System must continue polling health status when switching between tabs to ensure data freshness.
- **Health cards responsive layout**: Health cards must display correctly on different screen sizes (mobile, tablet, desktop) when moved above tabs.
- **Tab navigation preserved**: Moving health cards above tabs must not break tab navigation or state management.
- **Polling performance**: Displaying health cards on all tabs must not cause performance degradation or duplicate polling requests.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: System MUST display an accurate page description "ควบคุมและตรวจสอบระบบ AI สำหรับ Superadmin" on the AI Console page.

- **FR-002**: System MUST display health monitoring cards (Ollama AI Engine, Qdrant Vector DB, OCR Sidecar, BullMQ Queue Health, VRAM GPU Monitor) above the tab navigation so they are visible on all tabs.

- **FR-003**: System MUST rename the "Overview & Health" tab to "System Toggle" to accurately reflect its primary purpose.

- **FR-004**: System MUST rename the "OCR Sandbox" tab to "3-Step Pipeline Sandbox" to accurately reflect its full testing capabilities.

- **FR-005**: System MUST maintain health status polling (30-second interval) when displaying health cards on all tabs.

- **FR-006**: System MUST preserve tab navigation and state management after moving health cards above the tab structure.

- **FR-007**: System MUST ensure health cards use responsive layout that works on mobile, tablet, and desktop screens.

### Key Entities

This feature involves only UI/UX changes with no new data entities or database changes.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Superadmins can identify the AI Console as a Superadmin-only page within 5 seconds of viewing the page description.

- **SC-002**: Superadmins can view health monitoring status on any tab without switching to Overview tab (100% of tabs).

- **SC-003**: Tab names accurately describe their functionality as measured by zero confusion reports from Superadmins within 30 days of deployment.

- **SC-004**: Health status polling continues to function correctly on all tabs with no performance degradation (polling interval remains 30 seconds).

- **SC-005**: Health cards display correctly on all screen sizes (mobile, tablet, desktop) with no layout issues.

## Clarifications

### Session 2026-06-18

- Q: Should health cards be collapsible to save screen space? → A: No, health cards should remain visible at all times for continuous monitoring. The grid layout already optimizes space usage.

- Q: Should the System Toggle card remain in the Overview tab or move above tabs with health cards? → A: The System Toggle card should move above tabs with health cards so it's accessible from all tabs, as it's a critical control function.

- Q: Should tab names use English or Thai? → A: Tab names should use English for consistency with the rest of the admin interface, while page descriptions use Thai for user-friendliness.

## Assumptions

- The current health monitoring polling mechanism (30-second interval via TanStack Query) will continue to work correctly after the UI refactor.
- Moving health cards above tabs will not require changes to the backend API or data fetching logic.
- The existing responsive grid layout for health cards will work correctly when moved above the tab structure.
- Superadmin users have the `system.manage_all` permission required to access the AI Console page.

## Related Documents

- ADR-027: AI Admin Console and Dynamic Control Architecture
- Spec 238: OCR & AI Extraction Prompt Management
- `frontend/app/(admin)/admin/ai/page.tsx`
