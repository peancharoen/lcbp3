# Feature Specification: Transmittals + Circulation Complete Integration (v1.8.7 Post-ADR-021)

**Feature Branch**: `001-transmittals-circulation`
**Version**: 1.8.7
**Created**: 2026-04-12
**Status**: Draft
**Depends On**: ADR-021 (Integrated Workflow Context & Step-specific Attachments — in `feat/adr-021-integrated-workflow-context`)
**Input**: "Transmittals + Circulation (v1.8.7) Post-ADR-021"

---

## Context

ADR-021 introduced the shared `IntegratedBanner`, `WorkflowLifecycle`, and `use-workflow-action` components, and wired them fully for RFA and Correspondence. Both the **Transmittal** and **Circulation** detail pages already import these components but pass no workflow data — they are currently stub wired.

This feature delivers the **complete, production-ready integration** of both modules with the ADR-021 Workflow Engine, fixes known type violations (ADR-019), implements all pending edge cases (EC-RFA-004, EC-CIRC-001–003), and adds missing hooks and list-page functionality.

---

## User Scenarios & Testing _(mandatory)_

### User Story 1 — Transmittal Workflow-Wired Detail Page (Priority: P1) 🎯 MVP

A Document Control officer opens an existing Transmittal and immediately sees the document number, subject, workflow state, and available action buttons in the `IntegratedBanner`. The Workflow tab shows the full vertical timeline with each step's actor, date, comment, and evidence files.

**Why this priority**: The detail page is the primary touchpoint for reviewing/approving a Transmittal. Without live workflow data, reviewers cannot take action — this is a blocking gap.

**Independent Test**: Navigate to `/transmittals/{uuid}`. Verify: (1) `IntegratedBanner` shows real doc number, status badge, and action buttons (when user is the handler); (2) Workflow tab renders `WorkflowLifecycle` with at least the creation step; (3) all `pnpm tsc --noEmit` checks pass.

**Acceptance Scenarios**:

1. **Given** a submitted Transmittal with an active workflow instance, **When** a Document Control user opens its detail page, **Then** the `IntegratedBanner` displays the correct doc number, status, `workflowState`, and the available action buttons (e.g., APPROVE, REJECT).
2. **Given** a Transmittal where the current user is not the assigned handler, **When** they open the detail page, **Then** no action buttons are shown in the banner.
3. **Given** a Transmittal detail page, **When** the user clicks the Workflow tab, **Then** a vertical timeline displays all history steps with actor, date, and comment. The most recent step is highlighted.

---

### User Story 2 — Circulation Workflow-Wired Detail Page (Priority: P1) 🎯 MVP

A Document Control officer opens a Circulation Sheet and sees the circulation number, linked Correspondence, all assignees with their status, a deadline (with Overdue badge if past), and the full workflow timeline — all in one screen. Assignees can mark their task complete via the `IntegratedBanner` actions.

**Why this priority**: Circulation drives internal task tracking. Without live data wiring the page is read-only and useless for task management.

**Independent Test**: Navigate to `/circulation/{uuid}`. Verify: (1) `IntegratedBanner` displays `circulationNo`, `statusCode`; (2) Assignees card shows all routings with status; (3) Overdue badge appears when `deadline_date` is past; (4) Workflow tab shows history.

**Acceptance Scenarios**:

1. **Given** an OPEN Circulation with a past deadline, **When** a user opens the detail page, **Then** an Overdue badge is displayed and the deadline date is highlighted in red.
2. **Given** a Circulation with multiple assignees, **When** an assignee marks their task complete, **Then** their routing status updates to COMPLETED and the page refreshes.
3. **Given** a Circulation where all Main/Action assignees are COMPLETED, **When** the Document Control user views the page, **Then** a "Close Circulation" action is available.

---

### User Story 3 — Transmittal List Page with Search & Filter (Priority: P1)

A Document Control officer browses all Transmittals for a project, filters by purpose (FOR_APPROVAL, FOR_REVIEW, etc.), and searches by document number or subject.

**Why this priority**: The list page is the entry point for the module. Without working filters it cannot be used in production.

**Independent Test**: Navigate to `/transmittals`. Verify: paginated list loads; purpose filter updates results; search input filters by doc number/subject; clicking a row navigates to the detail page.

**Acceptance Scenarios**:

1. **Given** the Transmittals list page, **When** a user selects purpose "FOR_APPROVAL", **Then** only Transmittals with that purpose are shown.
2. **Given** the Transmittals list page, **When** a user types in the search box, **Then** results are filtered to matching document numbers or subjects within 500ms.
3. **Given** no Transmittals in the project, **When** the list page loads, **Then** an "empty state" message is shown.

---

### User Story 4 — Transmittal EC-RFA-004 Submit Validation (Priority: P2)

A Document Control officer tries to submit a Transmittal whose items include a DRAFT correspondence. The system blocks the submission with a clear, actionable error message.

**Why this priority**: EC-RFA-004 is a business integrity rule. Submitting a Transmittal with unsubmitted items violates the document lifecycle and must be blocked.

**Independent Test**: Create a Transmittal with one DRAFT item. Attempt to submit. Verify: 422 response with message "RFA [doc number] ยังอยู่ใน Draft กรุณา Submit ก่อน"; item is highlighted in the UI.

**Acceptance Scenarios**:

1. **Given** a Transmittal containing a DRAFT correspondence, **When** a user submits the Transmittal, **Then** the system returns an error identifying which item is in DRAFT status.
2. **Given** all Transmittal items are in SUBMITTED/APPROVED status, **When** a user submits the Transmittal, **Then** the submission succeeds and the status updates.

---

### User Story 5 — Circulation Edge Cases: Re-assign & Force Close (Priority: P2)

Document Control can re-assign a Circulation when an assignee is deactivated (EC-CIRC-001), and can force-close a Circulation with a mandatory reason when some assignees have not responded (EC-CIRC-002).

**Why this priority**: Without these controls, Circulations can get permanently stuck, blocking downstream work.

**Independent Test**: Deactivate an assignee in an OPEN Circulation. Verify: Document Control sees a "Re-assign" button for that routing. Force-close a Circulation with partial responses; verify reason is recorded in audit log.

**Acceptance Scenarios**:

1. **Given** an OPEN Circulation where one assignee has been deactivated, **When** Document Control opens the page, **Then** a "Re-assign" action is available for that assignee's routing.
2. **Given** an OPEN Circulation where some assignees have not responded, **When** Document Control performs Force Close with a reason, **Then** the Circulation status changes to CANCELLED, all pending routings are force-closed, and the reason is logged.

---

### Edge Cases

- **EC-RFA-004**: Transmittal with DRAFT items cannot be submitted → `422 Unprocessable Entity` with item identification.
- **EC-CIRC-001**: Assignee deactivated before responding → Document Control can re-assign.
- **EC-CIRC-002**: Multi-assignee, some not responded → Document Control can Force Close with mandatory reason.
- **EC-CIRC-003**: Deadline = today `23:59:59`; Overdue Badge the following day at `00:00`.
- **EC-CORR-001**: Cancelling a Correspondence with open Circulations → all Circulations force-closed + audit log.
- Transmittal `workflowInstanceId` is `null` when no workflow has been started (Draft state) → banner shows status only, no action buttons.
- Circulation data is scoped to the user's organization — users from other organizations must receive a 403 response.
- Duplicate `Idempotency-Key` on workflow transition → return cached response, no re-processing.

---

## Requirements _(mandatory)_

### Functional Requirements

**Transmittal Module:**

- **FR-T01**: The Transmittal detail page MUST display `workflowState`, `availableActions`, and action buttons via `IntegratedBanner` using the live workflow instance.
- **FR-T02**: The Transmittal detail page Workflow tab MUST render `WorkflowLifecycle` wired to the workflow history of the Transmittal's workflow instance.
- **FR-T03**: The Transmittal list page MUST support pagination, search by document number/subject, and filter by `purpose`.
- **FR-T04**: The Transmittal `Transmittal` frontend type MUST include `workflowInstanceId?: string` and `workflowState?: string` fields (ADR-019: string UUID only).
- **FR-T05**: The `transmittalService.getByUuid()` response MUST include `workflowInstanceId` from the backend.
- **FR-T06**: A dedicated `useTransmittal(uuid)` TanStack Query hook MUST be created for the detail page.
- **FR-T07**: Submitting a Transmittal with DRAFT items MUST return a `422` error identifying the offending item (EC-RFA-004).

**Circulation Module:**

- **FR-C01**: The Circulation detail page MUST display `workflowState`, `availableActions`, and action buttons via `IntegratedBanner` using the live workflow instance.
- **FR-C02**: The Circulation detail page Workflow tab MUST render `WorkflowLifecycle` wired to the workflow history.
- **FR-C03**: The Circulation detail page assignee section MUST display deadline per assignee type and an Overdue badge when `NOW() > deadline_date + 1 day` (EC-CIRC-003).
- **FR-C04**: The Circulation `Circulation` frontend type MUST include `workflowInstanceId?: string` and `workflowState?: string`.
- **FR-C05**: The `circulationService.getByUuid()` response MUST include `workflowInstanceId` from the backend.
- **FR-C06**: A dedicated `useCirculation(uuid)` TanStack Query hook MUST be created for the detail page.
- **FR-C07**: Document Control MUST be able to re-assign a routing when the assignee is deactivated (EC-CIRC-001).
- **FR-C08**: Document Control MUST be able to Force Close a Circulation with a mandatory reason; all pending routings are force-closed and the reason is logged in the audit trail (EC-CIRC-002).

**Cross-Cutting:**

- **FR-X01**: All new API calls MUST use `publicId` (UUIDv7 string) — no `parseInt` on UUID values (ADR-019).
- **FR-X02**: All new frontend types MUST NOT use `any` — strict TypeScript required.
- **FR-X03**: All backend responses for these modules MUST include `workflowInstanceId?: string` in the data shape.
- **FR-X04**: All new user-facing strings MUST use i18n keys — no hardcoded Thai/English text in JSX.

### Key Entities

- **Transmittal**: Extends Correspondence (`type_code = 'TRANSMITTAL'`). Has `purpose`, `remarks`, and a list of `transmittal_items`. Has one `WorkflowInstance` via the Unified Workflow Engine.
- **TransmittalItem**: Links a Transmittal to the document it carries (`correspondences` M:N). Has `quantity`, `itemType`, `remarks`.
- **Circulation**: Internal task-tracking document linked 1:1 to a Correspondence per organization. Has `statusCode`, `deadline`, and a list of `routings` (assignees with type: Main/Action/Information).
- **CirculationRouting**: A single assignee entry in a Circulation. Has `assigneeType`, `status`, `deadline`, `comments`.

---

## Assumptions

- ADR-021 backend is fully deployed — `workflow_history_id` column exists on `attachments`, `workflowInstanceId` is exposed from the Workflow Engine module.
- The backend `transmittal` module already has a `workflowInstance` relation or can join it via the Correspondence FK chain.
- The backend `circulation` module already has a `workflowInstance` relation available.
- The Unified Workflow Engine (`WorkflowEngineService`) is the single source of truth for state and transitions — Transmittal and Circulation statuses are NOT independently maintained once a workflow is started.

---

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Both Transmittal and Circulation detail pages display live workflow state and action buttons in under 1 second after page load (TanStack Query with staleTime 60s).
- **SC-002**: Submitting a Transmittal with a DRAFT item is rejected 100% of the time with a user-readable error message identifying the offending document.
- **SC-003**: Force-closing a Circulation with partial responses succeeds in a single action with the mandatory reason captured in the audit log every time.
- **SC-004**: All new TypeScript code passes `pnpm tsc --noEmit` with zero errors and `pnpm lint` with zero warnings.
- **SC-005**: No hardcoded Thai or English text in any new JSX component — verified by grep.
- **SC-006**: Unit test coverage ≥ 80% on new business logic (EC-RFA-004 validation, EC-CIRC-001/002/003 handlers).
- **SC-007**: Overdue Badge appears correctly when `NOW() > deadline_date + 1 day` — verified by unit test with mocked date.

---

## Clarifications

### Session 2026-04-12

- Q: Should the Transmittal "Submit" action go through the Workflow Engine transition (ADR-021 pattern), or does it remain a direct status update on the `correspondences` table? → A: Submit uses the Workflow Engine transition (`action: 'SUBMIT'`), consistent with ADR-001 Unified Workflow Engine for all document types. EC-RFA-004 validation fires as a pre-transition check in the service.
- Q: Should Circulation `routings` "Complete" action be a Workflow Engine transition or a direct routing status update? → A: Direct routing status update (not a full Workflow Engine transition) because Circulation workflow state is controlled at the Circulation level, not per-routing. The overall Circulation transitions (OPEN → IN_REVIEW → COMPLETED) go through the Workflow Engine.
- Q: For `workflowInstanceId` in the Transmittal/Circulation API response — should it be added to the existing response shape or is a dedicated `/workflow` sub-resource needed? → A: Add `workflowInstanceId` directly to the existing `findOneByUuid` response shape (additive, backward-compatible). Consistent with how RFA/Correspondence expose it.
