# Feature Specification: Integrated Workflow Context & Step-specific Attachments

**Feature Branch**: `200-fullstacks/202-adr-021-integrated-workflow-context`
**Created**: 2026-05-03
**Status**: Draft
**Input**: ADR-021 Integrated Workflow Context & Step-specific Attachments
**Location**: `specs/200-fullstacks/202-adr-021-integrated-workflow-context/`

---

## Clarifications

### Session 2026-04-12 (from ADR-021)

- **Q:** What are the file size and attachment count limits per workflow step? → **A:** No explicit limit (controlled by infrastructure only)
- **Q:** What are the specific values and storage format for the "Priority" field in the Integrated Banner? → **A:** Enum "URGENT", "HIGH", "MEDIUM", "LOW" — 4-tier system with visual indicators
- **Q:** How should the system handle virus/malware detection during step-specific file upload? → **A:** Block upload immediately, delete temp file, show error "File rejected" to user
- **Q:** What is the cache TTL for Workflow History data to reduce join query overhead? → **A:** 1 hour — balanced cache duration for workflow history data
- **Q:** Who is authorized to upload step-specific attachments during a workflow transition? → **A:** Only assigned handler can upload; superadmin and organization admin can upload on behalf (impersonation)

### Session 2026-04-19 (from ADR-021)

- **Q:** Which workflow states allow step-specific attachment upload? → **A:** Only Active-decision states (`PENDING_REVIEW`, `PENDING_APPROVAL`) — Terminal states (`APPROVED`, `REJECTED`, `CLOSED`) are not allowed
- **Q:** What happens if Redis Redlock fails during transition? → **A:** Fail-closed — Retry 3 times (500ms exponential backoff) then throw HTTP 503 "Service temporarily unavailable" to preserve data integrity
- **Q:** Which modules must support step-specific attachments in v1.8.6? → **A:** **All 4 modules** — RFA, Transmittal, Circulation, and Correspondence
- **Q:** Performance target for Upload + Transition API? → **A:** P95 ≤ 5 seconds for files ≤10MB (ClamAV scan + Redlock + DB transaction included)

---

## User Scenarios & Testing

### User Story 1 - Integrated Banner (Priority: P1) 🎯 MVP

As a Reviewer/Approver, I want to see all critical document information (Doc No, Subject, Status, Priority) and available actions in a single header bar without scrolling or switching screens, so I can make approval decisions quickly with full context.

**Why this priority**: This is the core UX improvement of ADR-021. Without the Integrated Banner, users waste time scrolling and switching between document content and workflow controls.

**Independent Test**: The IntegratedBanner component can be rendered with mock RFA/Transmittal/Circulation/Correspondence data, verifying Priority badge colors, Status display, and Action button visibility. Buttons must be disabled when workflow is in terminal states.

**Acceptance Scenarios**:

1. **Given** an RFA in `PENDING_APPROVAL` state with `URGENT` priority, **When** I open the detail page, **Then** I see the Doc No, Subject, red URGENT badge, status badge, and Approve/Reject/Return buttons in a sticky header
2. **Given** a Transmittal in `APPROVED` state, **When** I view the detail page, **Then** action buttons are disabled and the status shows as completed
3. **Given** a Correspondence in `PENDING_REVIEW` state with `MEDIUM` priority, **When** I open the detail page, **Then** the priority badge shows yellow and all workflow actions are available

---

### User Story 2 - Workflow Lifecycle Visualization (Priority: P1) 🎯 MVP

As a document participant, I want to see a vertical timeline showing all workflow steps with the current step highlighted, so I understand where the document is in the approval process and what steps remain.

**Why this priority**: Users currently lack visibility into workflow progress. The vertical timeline provides immediate orientation and reduces confusion about approval status.

**Independent Test**: The WorkflowLifecycle component can be rendered with mock workflow history data containing completed, current, and pending steps. Verify current step has Indigo (#6366f1) color with pulse animation.

**Acceptance Scenarios**:

1. **Given** a 4-step RFA workflow where step 2 is current, **When** I view the Workflow tab, **Then** step 1 shows as completed (with actor/date), step 2 shows Indigo with pulse, steps 3-4 are muted/pending
2. **Given** a Circulation workflow with comments on completed steps, **When** I view the timeline, **Then** each completed step shows the handler name, action date, and any comments
3. **Given** a Transmittal in terminal state, **When** I view the timeline, **Then** the final step is marked complete and no pulse animation is shown

---

### User Story 3 - Step-specific Attachments (Priority: P2)

As a Reviewer, I want to upload supporting documents (images, PDFs) that are specifically linked to the current workflow step, so reviewers can see exactly which evidence was provided for each approval decision.

**Why this priority**: Currently all attachments are mixed at the document level. Step-specific attachments provide audit trail clarity and improve compliance tracking.

**Independent Test**: Upload files during a workflow transition in `PENDING_REVIEW` state, then verify via API that `attachments.workflow_history_id` is set correctly. Files uploaded in terminal states must be rejected with HTTP 409.

**Acceptance Scenarios**:

1. **Given** an RFA in `PENDING_REVIEW` state, **When** I drag-drop 2 PDF files and click Approve, **Then** the files are linked to that workflow history step and visible in the timeline
2. **Given** a Transmittal in `APPROVED` state, **When** I attempt to upload a file, **Then** the system rejects with "Upload not allowed in terminal state" error
3. **Given** a Circulation in `PENDING_APPROVAL` state, **When** I upload a file and the approver rejects, **Then** the attachment remains linked to that rejection step for audit purposes

---

### User Story 4 - Internal File Preview (Priority: P2)

As a Reviewer, I want to click on any attachment and preview it in a modal without leaving the document page, so I can review evidence while maintaining workflow context.

**Why this priority**: Current workflow requires downloading or opening files in new tabs, breaking user flow and reducing productivity.

**Independent Test**: Click on PDF and Image attachments in the workflow timeline, verify FilePreviewModal opens with correct content type rendering (iframe for PDF, img for images).

**Acceptance Scenarios**:

1. **Given** a step with 3 attachments (2 PDFs, 1 PNG), **When** I click the first PDF, **Then** a modal opens showing the PDF in an inline viewer
2. **Given** the preview modal is open, **When** I press Escape or click the X button, **Then** the modal closes and I remain on the document page
3. **Given** a large PDF attachment, **When** I open the preview, **Then** the modal loads within 2 seconds with proper scroll controls

---

### User Story 5 - i18n Support (Priority: P3)

As a Thai or English speaking user, I want all workflow UI text to display in my selected language, so I can use the system effectively regardless of my preferred language.

**Why this priority**: LCBP3-DMS must support bilingual operations. All new UI components must follow i18n standards from project inception.

**Independent Test**: Switch language between TH and EN, verify all IntegratedBanner labels, WorkflowLifecycle step labels, and FilePreviewModal controls display correctly in each language.

**Acceptance Scenarios**:

1. **Given** my language is set to Thai, **When** I view an RFA detail page, **Then** all workflow action buttons show Thai text (อนุมัติ, ปฏิเสธ, ส่งกลับ)
2. **Given** my language is set to English, **When** I view the Workflow tab, **Then** step labels show English text (Review, Approval, etc.)
3. **Given** I switch language while viewing a document, **When** the page refreshes, **Then** all ADR-021 components show the newly selected language immediately

---

### Edge Cases

- What happens when a user attempts transition with concurrent upload from another user? (Redis Redlock handles serialization)
- How does system handle ClamAV detecting malware during step upload? (Block immediately, delete temp file, show "File rejected")
- What happens when Redis is unavailable during transition? (Retry 3x with exponential backoff, then HTTP 503 fail-closed)
- How does system handle duplicate Idempotency-Key? (Return cached response, no re-processing)
- What happens when attachment file is deleted from storage after linking? (Show "File unavailable" in UI, preserve metadata)
- How does system handle unauthorized upload attempt? (CASL Guard blocks with 403 Forbidden)

---

## Requirements

### Functional Requirements

- **FR-001**: System MUST display Integrated Banner on RFA, Transmittal, Circulation, and Correspondence detail pages showing Doc No, Subject, Status, Priority, and available actions
- **FR-002**: Priority badge MUST support 4 levels: URGENT (red), HIGH (orange), MEDIUM (yellow), LOW (green) with visual indicators
- **FR-003**: Action buttons (Approve/Reject/Return) MUST be disabled when workflow is in terminal states (APPROVED, REJECTED, CLOSED)
- **FR-004**: System MUST display Workflow Lifecycle as vertical timeline with current step highlighted in Indigo (#6366f1) with pulse animation
- **FR-005**: System MUST support drag-drop file upload linked to workflow history steps, only allowed in PENDING_REVIEW or PENDING_APPROVAL states
- **FR-006**: Upload attempts in terminal states MUST be rejected with HTTP 409 Conflict
- **FR-007**: System MUST enforce 4-Level RBAC for workflow transitions: Superadmin > Org Admin > Assigned Handler > Read-only
- **FR-008**: System MUST validate Idempotency-Key header on all transition requests to prevent duplicate processing
- **FR-009**: File uploads MUST use Two-Phase pattern (Temp → ClamAV scan → Permanent)
- **FR-010**: System MUST provide internal File Preview Modal for PDF and Image attachments without page navigation
- **FR-011**: All UI text MUST use i18n keys supporting Thai and English languages
- **FR-012**: Workflow transitions MUST use optimistic locking (version_no) to prevent race conditions
- **FR-013**: Redis Redlock MUST serialize concurrent transitions on the same workflow instance
- **FR-014**: Attachment linking to workflow history MUST occur in same database transaction as state transition

### Key Entities

- **WorkflowInstance**: Represents a running workflow tied to a document (RFA/Transmittal/Circulation/Correspondence). Tracks current state, definition reference, and context data.
- **WorkflowHistory**: Audit record of each workflow transition. Contains from_state, to_state, action, actor, timestamp, and (ADR-021) linked attachments.
- **Attachment** (Extended): File entity with new `workflow_history_id` FK linking to specific workflow step. NULL value indicates main document attachment (pre-ADR-021 behavior).
- **IntegratedBanner**: UI component combining document metadata, workflow status, priority indicator, and action controls.
- **WorkflowLifecycle**: UI component displaying vertical timeline of all workflow steps with visual highlighting.

---

## Success Criteria

### Measurable Outcomes

- **SC-001**: Users can approve/reject documents 40% faster due to Integrated Banner reducing screen navigation
- **SC-002**: 100% of workflow attachments are traceable to specific approval steps via `workflow_history_id` linkage
- **SC-003**: File preview modal loads and displays PDF/Image files within 2 seconds (P95)
- **SC-004**: Zero duplicate workflow transitions occur due to Idempotency-Key enforcement (verified via audit logs)
- **SC-005**: System handles 50 concurrent workflow transitions per minute without data inconsistency (optimistic lock + Redlock)
- **SC-006**: 100% of UI text in ADR-021 components is translatable (verified by language switch testing)
- **SC-007**: Users can complete workflow transition with file upload within 5 seconds for files ≤10MB (P95, including ClamAV scan)
