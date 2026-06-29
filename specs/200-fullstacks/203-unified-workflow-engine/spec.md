# Feature Specification: Unified Workflow Engine — Production Hardening & Integrated Context

**Feature Branch**: `003-unified-workflow-engine`
**Created**: 2026-05-02
**Status**: Draft
**References**: ADR-001 (Unified Workflow Engine v1.1), ADR-021 (Integrated Workflow Context & Step-specific Attachments)

---

## Clarifications

### Session 2026-05-02

- Q: How should the `WorkflowTransitionGuard` resolve DSL `require.role` values against the CASL permission system? → A: DSL `require.role` values map to **CASL ability checks** — each role string corresponds to a defined CASL `action:subject` permission pair (e.g., `"Admin"` → `workflow.manage`). The guard resolves permissions dynamically at transition time; it does NOT match DB role names directly.
- Q: What level of observability is required for workflow transition operations? → A: **Structured log + metrics** — one structured log entry per transition (instance ID, action, user UUID, duration ms, outcome: success/conflict/forbidden/error) plus a counter metric for transition throughput and a latency histogram. No distributed tracing required at this stage.
- Q: When a file has been moved to permanent storage but the DB transition subsequently fails, what is the recovery action? → A: **Move back to temp** — `StorageService` moves the file from permanent back to temp on DB failure; temp files expire after a 24-hour TTL, allowing the user to retry the transition without re-uploading or re-scanning.
- Q: Does this feature include a frontend Admin UI for DSL authoring, or is API-only sufficient? → A: **Full Admin UI in scope** — a frontend page for Super Admins to create, edit (JSON editor), activate, and deactivate workflow definitions with inline DSL validation feedback. Visual workflow builder (drag-and-drop) remains Phase 2 / out of scope.
- Q: Which modules still need new Integrated Banner + Workflow Lifecycle integration work? → A: **All four modules need gap-filling** — RFA, Transmittal, Circulation, and Correspondence all have the banner component mounted but have incomplete data wiring (e.g., missing `availableActions`, no step-attachment upload support). None are fully complete; all require targeted completion work.

---

## User Scenarios & Testing _(mandatory)_

### User Story 1 — Workflow Transition with State Integrity (Priority: P1)

A Reviewer or Approver assigned to an active workflow step transitions a document from one state to the next (e.g., `PENDING_REVIEW` → `APPROVED`). The system must guarantee that only one transition occurs even if two users click "Approve" simultaneously, that the workflow history records who acted and when, and that downstream notifications are dispatched asynchronously without slowing down the response.

**Why this priority**: Core correctness of the Workflow Engine — without reliable, race-condition-free transitions the entire approval chain is unreliable.

**Independent Test**: Can be fully tested by submitting two concurrent approval requests and verifying only one succeeds (the other returns 409), and that the history table contains exactly one new record.

**Acceptance Scenarios**:

1. **Given** a document in `PENDING_REVIEW` state with `version_no = 5`, **When** an assigned handler submits the `APPROVE` action, **Then** the state transitions to `APPROVED`, `version_no` increments to `6`, and a new `workflow_histories` record is written within the same DB transaction.
2. **Given** two concurrent `APPROVE` requests for the same instance at the same `version_no`, **When** both reach the server simultaneously, **Then** exactly one succeeds (200) and the other receives 409 "Concurrent transition detected — please retry" without any data corruption.
3. **Given** a successful transition, **When** the transition commits, **Then** a BullMQ job is enqueued on the `workflow-events` queue within the same request (no inline notification call).
4. **Given** a `PENDING_REVIEW` instance and a user who is NOT the assigned handler and does NOT have the required CASL ability (e.g., `workflow.manage`) mapped from the DSL `require.role` value, **When** they attempt to transition, **Then** they receive 403 Forbidden.

---

### User Story 2 — Condition-Gated Transitions via DSL (Priority: P1)

A workflow step requires a condition to be met (e.g., `requiresLegal > 0`) before a transition is allowed. The DSL defines this as a JSON Logic rule, and the engine evaluates it against the current `context` at transition time.

**Why this priority**: Without reliable condition evaluation, automated gating (legal review, approval thresholds) fails and documents could bypass required steps.

**Independent Test**: Can be fully tested by configuring a DSL with a JSON Logic condition, providing a context that both satisfies and fails the condition, and observing that transitions are allowed/blocked accordingly.

**Acceptance Scenarios**:

1. **Given** a DSL transition with `{ "type": "json-logic", "rule": { ">": [{ "var": "requiresLegal" }, 0] } }` and context `{ "requiresLegal": 1 }`, **When** the `SUBMIT` action is triggered, **Then** the transition proceeds.
2. **Given** the same DSL and context `{ "requiresLegal": 0 }`, **When** `SUBMIT` is triggered, **Then** the transition is blocked and the caller receives a `ValidationException` (HTTP 422) with a field-level error.
3. **Given** a DSL that uses a raw JS string expression (`"context.x === true"`) instead of JSON Logic format, **When** an Admin attempts to save the DSL, **Then** the save is rejected with a validation error explaining only JSON Logic format is permitted.

---

### User Story 3 — Integrated Contextual Banner & Workflow Lifecycle View (Priority: P1)

A Reviewer opens a document detail page (RFA, Transmittal, Circulation, or Correspondence). Instead of navigating to a separate Workflow panel, the document header immediately shows the document number, current status, priority badge, and Approve/Reject action buttons. A "Workflow Engine" tab below displays a vertical timeline of all workflow steps — active step highlighted in indigo with a pulse animation.

**Why this priority**: Without the Integrated Banner and Lifecycle View (ADR-021 REQ-01 to REQ-03), Reviewers must switch between screens to understand context, increasing approval time and error rate.

**Independent Test**: Can be fully tested by opening any document in `PENDING_REVIEW` or `PENDING_APPROVAL` state and visually confirming the banner shows correct status + action buttons, and the timeline tab shows the active step in indigo.

**Acceptance Scenarios**:

1. **Given** an RFA in `PENDING_APPROVAL` state with priority `URGENT`, **When** the detail page loads, **Then** the banner at the top displays the document number, `PENDING_APPROVAL` status badge, `URGENT` priority badge, and `Approve`/`Reject` action buttons — all before the document body content.
2. **Given** a workflow with 4 steps (DRAFT → PENDING_REVIEW → PENDING_APPROVAL → APPROVED), **When** the document is in `PENDING_REVIEW`, **Then** step 2 shows indigo color with CSS pulse animation; steps 1, 3, 4 show no animation.
3. **Given** a completed document (`APPROVED` or `CLOSED`), **When** the detail page loads, **Then** the action buttons are disabled/hidden and no upload controls are visible.

---

### User Story 4 — Step-specific Attachment Upload & Preview (Priority: P2)

While reviewing a document in an active workflow step, a handler uploads evidence files (PDF, DWG, DOCX, XLSX, ZIP) to be linked specifically to that step's history record. Later, any authorized user can click the file to preview it inline via a modal without navigating away.

**Why this priority**: Step-specific attachments provide the audit trail required for compliance — files are traceable to the exact decision step. Preview reduces time spent downloading/opening files.

**Independent Test**: Can be fully tested by uploading a PDF during `PENDING_REVIEW`, transitioning to `APPROVED`, and verifying the file is visible under the `PENDING_REVIEW` history entry with inline preview working.

**Acceptance Scenarios**:

1. **Given** a document in `PENDING_REVIEW` state, **When** the assigned handler drags and drops a valid PDF onto the upload zone, **Then** the file is scanned by ClamAV, stored in permanent storage after a successful transition, and linked to the `workflow_histories` record for that step.
2. **Given** a document in `APPROVED` (terminal) state, **When** any user attempts to upload a file, **Then** the upload zone is disabled and the system returns HTTP 409 "Cannot upload to terminal state".
3. **Given** a file linked to a step, **When** any authorized user clicks the file name, **Then** a preview modal opens in-browser without navigating away from the detail page.
4. **Given** a file infected with malware detected by ClamAV, **When** upload is attempted, **Then** the temp file is deleted immediately, the upload is rejected, and the user sees "File rejected: security scan failed".
5. **Given** a duplicate upload request with the same `Idempotency-Key`, **When** the duplicate request arrives, **Then** the system returns the cached 201 response without creating a second record.

---

### User Story 5 — Workflow Definition Authoring (Super Admin Only) (Priority: P2)

A Super Admin creates or updates a workflow DSL definition via an **Admin UI page** (JSON editor with inline validation feedback). The system validates the DSL structure and activates the new version. In-progress workflow instances continue using their bound version until completion.

**Why this priority**: Without safe DSL authoring, new document types cannot be onboarded and workflow changes cannot be deployed without code releases.

**Independent Test**: Can be fully tested by creating a new DSL definition, activating it, and verifying existing in-progress instances still use the old version while new instances use the new version.

**Acceptance Scenarios**:

1. **Given** a Super Admin submits a valid DSL JSON, **When** the definition is saved and activated, **Then** the Redis cache key `wf:def:{workflow_code}:{version}` is invalidated immediately and new instances start using the new version.
2. **Given** an in-progress `workflow_instances` record bound to version 1, **When** version 2 is activated, **Then** the in-progress instance continues using version 1's `definition_id` until it reaches a terminal state.
3. **Given** a non-Super-Admin user, **When** they attempt to create or activate a DSL definition, **Then** they receive 403 Forbidden (`system.manage_all` required).
4. **Given** a context_schema with a `required` field, **When** a transition is triggered with a context missing that field, **Then** HTTP 422 is returned with `{ "field": "<context_field>", "message": "required field missing" }`.

---

### User Story 6 — Dead-letter Queue & Ops Recovery (Priority: P3)

A BullMQ `workflow-events` job fails all 3 retry attempts and moves to `workflow-events-failed`. Ops team is notified via n8n webhook and can manually requeue the job via Bull Board UI.

**Why this priority**: Without dead-letter recovery, failed event dispatches (notifications, downstream triggers) are silently lost, breaking audit trail integrity.

**Independent Test**: Can be fully tested by causing a simulated worker failure and verifying the n8n webhook fires and the job appears in the Bull Board dead-letter queue.

**Acceptance Scenarios**:

1. **Given** a `workflow-events` job that fails 3 times with exponential backoff, **When** attempts are exhausted, **Then** the job moves to `workflow-events-failed` queue and a webhook call is sent to `N8N_WEBHOOK_URL`.
2. **Given** a job in `workflow-events-failed`, **When** an Ops admin clicks "Retry" in Bull Board UI, **Then** the job re-enters `workflow-events` queue for processing.
3. **Given** a failed job, **When** the system auto-retries, **Then** it uses exponential backoff: attempt 1 immediately, attempt 2 after 500ms, attempt 3 after 1000ms — and does NOT auto-requeue after the dead-letter queue.

---

### Edge Cases

- What happens when Redis is down during a workflow transition (no Redlock available for state transition)? The optimistic lock (`version_no`) alone handles concurrency for transitions — Redis is NOT required for transitions (only for Document Numbering per ADR-002). Transition proceeds normally; only file-upload-plus-transition uses Redlock.
- What happens when a Redis Redlock fails during file-upload-plus-transition? Retry 3 times (500ms exponential backoff); if still failing, return HTTP 503 "Service temporarily unavailable" (Fail-closed — no partial state).
- What happens when a terminal-state workflow receives a transition request? The engine returns 409 `BusinessException` — "Workflow is already in a terminal state".
- What happens when `context_schema.required` field is missing at transition time? HTTP 422 `ValidationException` with field-level error — transition is blocked; caller must supply the missing context field and retry.
- What happens when a file is deleted from storage after being linked to a workflow step? The UI shows "File unavailable" for that attachment; the `workflow_histories` metadata record is preserved.
- What happens when two Admins concurrently activate different DSL versions for the same `workflow_code`? Last-write-wins on `is_active`; Redis cache is invalidated by both writes; existing instances are unaffected (already bound to a `definition_id`).

---

## Requirements _(mandatory)_

### Functional Requirements

**Workflow Engine Core (ADR-001)**

- **FR-001**: The system MUST evaluate workflow transition conditions using JSON Logic format (`{ "type": "json-logic", "rule": {...} }`) exclusively — no JavaScript string evaluation (`eval` / `new Function`).
- **FR-002**: The system MUST use optimistic locking (`version_no INT NOT NULL DEFAULT 1`) on `workflow_instances` to prevent concurrent double-transitions — only one transition per `(id, current_state, version_no)` tuple succeeds; the other receives HTTP 409.
- **FR-002a**: The `WorkflowTransitionGuard` MUST resolve DSL `require.role` values as **CASL ability checks** — each string value maps to a defined CASL `action:subject` pair (e.g., `"Admin"` → `workflow.manage`). Direct DB role-name matching is forbidden; permissions are evaluated dynamically at transition time via the CASL `AbilityFactory`.
- **FR-003**: The system MUST record every state transition in `workflow_histories`, including `action_by_user_id` (INT FK, internal, excluded from API) and `action_by_user_uuid` (VARCHAR 36, exposed in API per ADR-019).
- **FR-004**: All workflow events (notifications, side effects) MUST be dispatched via the dedicated BullMQ queue `workflow-events` — never inline within the request thread.
- **FR-005**: The `workflow-events` worker MUST be configured with concurrency 5, 3 retry attempts with exponential backoff, and a `workflow-events-failed` dead-letter queue.
- **FR-006**: When a job enters `workflow-events-failed`, the system MUST send a webhook to `N8N_WEBHOOK_URL` (env var, never hardcoded) to alert the ops team.
- **FR-007**: `workflow_definitions` MUST be cached in Redis with key `wf:def:{workflow_code}:{version}` (TTL: 1 hour), invalidated immediately when a Super Admin saves or activates a definition.
- **FR-008**: Context schema validation MUST occur in two phases: Phase 1 at definition save-time (structure), Phase 2 at transition-time (values against required fields) — missing required fields return HTTP 422 with field-level errors.
- **FR-009**: Only users with `system.manage_all` permission MAY create, update, activate, or deactivate workflow definitions.
- **FR-010**: In-progress `workflow_instances` MUST remain bound to the `definition_id` at time of creation — activating a new DSL version MUST NOT rebind in-progress instances.

**Integrated Banner & Lifecycle View (ADR-021 REQ-01 to REQ-03)**

- **FR-011**: Every document detail page (RFA, Transmittal, Circulation, Correspondence) MUST complete the Integrated Banner wiring — all four modules already have the component mounted but require gap-filling: live `workflowState`, `availableActions`, priority badge, and step-attachment upload support must be fully connected. No module is exempt.
- **FR-012**: The "Workflow Engine" tab on detail pages MUST display a vertical timeline of all workflow steps with: step role, handler name, description, and visual state (completed/active/pending).
- **FR-013**: The active step MUST be rendered with indigo color (`#6366f1`) and a CSS pulse animation; all other steps MUST NOT have the pulse animation.

**Step-specific Attachments (ADR-021 REQ-04 to REQ-05)**

- **FR-014**: The `attachments` table MUST have a nullable FK `workflow_history_id` — existing attachments without this FK are treated as main-document attachments.
- **FR-015**: Users MAY upload attachments only when the document is in an active-decision state (`PENDING_REVIEW` or `PENDING_APPROVAL`); uploads MUST be rejected with HTTP 409 when the document is in a terminal state (`APPROVED`, `REJECTED`, `CLOSED`).
- **FR-016**: Only the assigned step handler, organization admin, or Super Admin may upload step-specific attachments; unauthorized attempts return HTTP 403.
- **FR-017**: All uploaded files MUST be scanned by ClamAV before moving from temp to permanent storage; infected files MUST be deleted immediately and the user notified with "File rejected: security scan failed".
- **FR-018**: File uploads with a transition MUST require an `Idempotency-Key` header; duplicate requests with the same key return the cached result without re-processing.
- **FR-019**: Every step-specific attachment upload MUST be atomic with the workflow transition. Recovery on failure is: (1) if DB transition fails after file reaches permanent storage, `StorageService` MUST move the file back to temp storage; (2) temp files expire after a **24-hour TTL** and are automatically purged; (3) the user MAY retry the transition within the TTL window without re-uploading or re-scanning the file.
- **FR-020**: Any authorized user MAY preview PDF and image files inline via a modal without navigating away from the detail page.

**Admin UI — DSL Authoring (Super Admin)**

- **FR-024**: The system MUST provide an Admin UI page (accessible only to Super Admins) where DSL definitions can be created, edited (JSON editor), activated, and deactivated.
- **FR-025**: The DSL editor MUST display inline validation feedback — structure errors (Phase 1 save-time) are highlighted before the user saves; the page MUST NOT allow saving a DSL that fails Phase 1 validation.

**i18n (ADR-021 REQ-06)**

- **FR-021**: All UI text on new and updated components MUST use i18n keys — no hardcoded Thai or English strings.

**Observability**

- **FR-022**: The Workflow Engine MUST emit one structured log entry per transition containing: `instanceId`, `action`, `fromState`, `toState`, `userUuid`, `durationMs`, and `outcome` (`success` | `conflict` | `forbidden` | `validation_error` | `system_error`).
- **FR-023**: The Workflow Engine MUST record two metrics: (1) a **transition counter** labelled by `workflow_code`, `action`, and `outcome`; (2) a **transition latency histogram** (ms) labelled by `workflow_code`.

### Key Entities

- **WorkflowDefinition**: Versioned DSL template defining states, transitions, conditions, events, and context schema. Identified by `workflow_code` + `version`. One active version per code.
- **WorkflowInstance**: Running instance bound to a specific entity (RFA, Transmittal, Correspondence, Circulation). Tracks `current_state`, `context` (JSON), and `version_no` (optimistic lock).
- **WorkflowHistory**: Immutable record of every state transition. Linked to the acting user (both INT FK and UUID), comment, and metadata. Step-specific attachments link here.
- **Attachment**: File stored in permanent storage. May be a main-document attachment (`workflow_history_id = NULL`) or a step-specific attachment (`workflow_history_id` set).

---

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Zero concurrent double-approvals — a load test with 50 simultaneous `APPROVE` requests on the same workflow instance results in exactly 1 success and 49 responses with status 409.
- **SC-002**: Transition throughput — workflow state change (without file upload) completes in under 1 second (P95) for documents with up to 20 workflow history records under normal load.
- **SC-003**: Upload + transition SLA — `POST /workflow/:uuid/transition` with a file ≤ 10MB (including ClamAV scan, Redlock, and DB transaction) responds within 5 seconds (P95).
- **SC-004**: Event delivery reliability — less than 0.1% of `workflow-events` jobs reach the dead-letter queue under normal operating conditions.
- **SC-005**: DSL cache effectiveness — activating a new DSL version results in the stale cache entry being invalidated within 1 second on all app instances.
- **SC-006**: Integrated Banner adoption — 100% of document detail pages (RFA, Transmittal, Circulation, Correspondence) display the Integrated Banner and Workflow Engine tab after release.
- **SC-007**: No navigation required — reviewers complete document approval (view context + act) without leaving the detail page in 95%+ of sessions.
- **SC-008**: Audit completeness — every workflow transition has a corresponding `workflow_histories` record with user UUID, timestamp, action, and comment (if provided); zero orphaned transitions.
- **SC-009**: Observability coverage — 100% of workflow transitions (success, conflict, forbidden, error) produce a structured log entry and increment the transition counter metric; no silent failures.

---

## Assumptions

- ADR-001 Unified Workflow Engine backend infrastructure (`workflow_definitions`, `workflow_instances`, `workflow_histories` tables) is already partially implemented; this spec covers the production-hardening gaps (JSON Logic, `version_no`, dedicated BullMQ queue, context schema two-phase validation, ADR-019 UUID compliance for history records).
- ADR-021 Integrated Banner and Workflow Lifecycle components are **mounted but incompletely wired** across all four modules (RFA, Transmittal, Circulation, Correspondence). Common gaps include: missing live `availableActions`, no step-specific attachment upload zone, incomplete i18n. This spec closes all four modules to full completion.
- `json-logic-js` npm package is used for condition evaluation in `WorkflowDslService` (in-process, no external service).
- Redis and BullMQ infrastructure are available in all environments.
- ClamAV is available as a service and integrated via the existing `StorageService` two-phase upload pattern.
- `N8N_WEBHOOK_URL` environment variable will be set in `docker-compose.yml` for all environments before deploy.
- Bull Board UI (`@bull-board/nestjs`) will be installed for `workflow-events` and `workflow-events-failed` queue visibility.
