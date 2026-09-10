# Feature Specification: RAG Admin Console

**Feature Branch**: `255-rag-admin-console`
**Created**: 2026-09-10
**Status**: Draft
**Input**: User description: "Full RAG Admin Console — ingestion status dashboard, classification override UI, generation lifecycle viewer, observability metrics dashboard, and failed ingestion retry management for Feature 254 RAG Attachment Chunks"

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Ingestion Status Dashboard (Priority: P1)

As an Admin or Operator, I want to see the RAG ingestion status of every attachment in a single dashboard, so I can know which files have been indexed, which are processing, and which have failed — without calling APIs manually.

**Why this priority**: Without this, operators have zero visibility into whether uploaded files are searchable via RAG. This is the most critical gap — users cannot trust RAG search results if they don't know which files are indexed.

**Independent Test**: Can be fully tested by opening the admin RAG status page and verifying that attachments are listed with their current ingestion status (NOT_STARTED, BUILDING, ACTIVE, RETIRED, FAILED), chunk count, and last-updated timestamp.

**Acceptance Scenarios**:

1. **Given** an attachment has been uploaded and committed but not yet ingested, **When** the admin opens the RAG Status Dashboard, **Then** they see the attachment listed with status NOT_STARTED and zero chunks.
2. **Given** an attachment is actively being ingested by the RAG pipeline, **When** the admin refreshes the dashboard, **Then** they see status BUILDING with a progress indicator.
3. **Given** an attachment has completed ingestion, **When** the admin views the dashboard, **Then** they see status ACTIVE with the chunk count and activated-at timestamp.
4. **Given** an attachment ingestion failed, **When** the admin views the dashboard, **Then** they see status FAILED with the error message and a retry button.
5. **Given** multiple projects exist, **When** the admin filters by project, **Then** only attachments from the selected project are shown.
6. **Given** a large number of attachments, **When** the admin paginates, **Then** the dashboard loads efficiently without fetching all records at once.

---

### User Story 2 - Classification Override UI (Priority: P1)

As a Security Admin or System Admin, I want to override the security classification of an attachment through a UI, so I can control which RAG content is accessible to different user clearance levels — with an audit trail.

**Why this priority**: The backend endpoint and audit trail already exist (Feature 254, T068-T070), but there is no UI for Security Admins to use it. This is a security operations gap — classification policy cannot be enforced in practice without a UI.

**Independent Test**: Can be fully tested by opening an attachment's classification panel, selecting a new classification level, entering a reason, and verifying the change is persisted and audited.

**Acceptance Scenarios**:

1. **Given** a Security Admin opens an attachment's classification panel, **When** they select a new classification and enter a reason, **Then** the classification is updated and a success message is shown.
2. **Given** a user without `document.classification_override` permission, **When** they try to access the classification override panel, **Then** they see a "permission denied" message.
3. **Given** a classification override has been applied, **When** the admin views the audit log, **Then** they see the before-value, after-value, reason, and actor.
4. **Given** an attachment has classification CONFIDENTIAL, **When** a user with INTERNAL clearance queries RAG, **Then** chunks from that attachment are excluded from results (visibility verified from the dashboard).
5. **Given** a classification override is changed, **When** the admin views the attachment, **Then** the effective classification badge reflects the override, not the inherited value.

---

### User Story 3 - Generation Lifecycle Viewer (Priority: P2)

As an Admin, I want to view the generation lifecycle of an attachment (BUILDING → ACTIVE → RETIRED → FAILED), so I can understand the RAG indexing history and trigger force re-ingestion when needed.

**Why this priority**: Important for troubleshooting and operations, but less urgent than status visibility and classification control. The data exists in the backend but needs a viewer.

**Independent Test**: Can be fully tested by opening an attachment's generation history tab and verifying that all generations are listed with their status, timestamps, and chunk counts.

**Acceptance Scenarios**:

1. **Given** an attachment has been ingested multiple times, **When** the admin opens the generation history, **Then** they see all generations listed with status (BUILDING/ACTIVE/RETIRED/FAILED), created-at, activated-at, and chunk count.
2. **Given** an attachment has one ACTIVE generation, **When** the admin views the lifecycle, **Then** exactly one generation is marked ACTIVE and the rest are RETIRED or FAILED.
3. **Given** an admin wants to re-ingest an attachment, **When** they click "Force Re-ingest", **Then** a new BUILDING generation is created and the old ACTIVE generation remains until the new one completes. If a BUILDING generation already exists, the system rejects the request with a 409 Conflict and a user-friendly error message.
4. **Given** a generation FAILED, **When** the admin views the details, **Then** they see the error code, error message, and failed-at timestamp.
5. **Given** a RETIRED generation exists, **When** the admin views it, **Then** they see the retired-at timestamp and can confirm its chunks have been cleaned up.

---

### User Story 4 - Observability Metrics Dashboard (Priority: P2)

As an Admin, I want to see RAG operational metrics (ingestion duration, chunk count, vector latency, stale-result rate, fallback rate, cleanup retry rate), so I can monitor system health and identify performance bottlenecks.

**Why this priority**: The metrics exist in the backend (Feature 254, T074) but are only accessible via in-memory service calls. A dashboard makes them actionable for operations.

**Independent Test**: Can be fully tested by opening the RAG metrics dashboard and verifying that all six metric categories are displayed with current values.

**Acceptance Scenarios**:

1. **Given** RAG operations have been running, **When** the admin opens the metrics dashboard, **Then** they see ingestion duration histogram (bucketed by 100ms/500ms/2s), total chunk count, vector latency histogram, stale-result rate, fallback rate, and cleanup retry rate.
2. **Given** a high stale-result rate is observed, **When** the admin investigates, **Then** they can see the count of stale results filtered vs. total results.
3. **Given** the fallback rate is increasing, **When** the admin checks the dashboard, **Then** they see the number of full-text fallback invocations and can correlate with vector search issues.
4. **Given** cleanup retries are occurring, **When** the admin views the cleanup metrics, **Then** they see the retry count and can investigate Qdrant deletion failures.
5. **Given** the admin wants to reset metrics, **When** they click "Reset Metrics", **Then** all counters return to zero (with confirmation dialog).

---

### User Story 5 - Failed Ingestion Retry Management (Priority: P2)

As an Operator, I want to see a list of failed RAG ingestions and trigger retries, so I can recover from transient failures without re-uploading files.

**Why this priority**: Important for production operations but can be partially handled via the status dashboard's retry button (US1). A dedicated retry management view adds value for batch operations.

**Independent Test**: Can be fully tested by opening the failed ingestions list, selecting one or more failed items, and clicking "Retry" to re-enqueue them.

**Acceptance Scenarios**:

1. **Given** multiple attachments have FAILED ingestion status, **When** the operator opens the failed ingestions list, **Then** they see all failed items with error messages and retry buttons.
2. **Given** a failed ingestion, **When** the operator clicks "Retry", **Then** the attachment is re-enqueued for ingestion, the FAILED generation is marked RETIRED, and the status changes to BUILDING.
3. **Given** multiple failed ingestions, **When** the operator selects multiple and clicks "Retry All", **Then** all selected items are re-enqueued.
4. **Given** a failed ingestion has a permanent error (e.g., corrupted file), **When** the operator retries, **Then** the system shows a user-friendly error explaining why retry may not help.
5. **Given** a retry is in progress, **When** the operator views the list, **Then** the retried item shows BUILDING status and the retry button is disabled.

---

### Edge Cases

- What happens when the RAG backend services (Qdrant, Ollama) are unavailable? The dashboard should show a "service unavailable" banner without crashing.
- What happens when an attachment has been deleted but its RAG generation records remain? The dashboard should handle orphaned records gracefully (show as "orphaned" or exclude).
- What happens when an admin navigates to the dashboard with no RAG data at all? An empty state with a helpful message should be shown.
- What happens when the metrics service has no data (fresh system)? Zero values should be displayed, not errors.
- What happens when a user with only `rag.manage` (not `document.classification_override`) tries to access the classification panel? The panel should be hidden or disabled, not show an error after interaction.
- What happens when force re-ingest is triggered on an attachment with no checksum? The system should show a user-friendly error explaining that a checksum is required.
- What happens when force re-ingest is triggered on an attachment that already has a BUILDING generation? The system should prevent the action and show a user-friendly error explaining that ingestion is already in progress.

## Clarifications

### Session 2026-09-10

- Q: Dashboard refresh strategy (manual vs polling vs WebSocket)? → A: Auto-polling every 10s + manual refresh button (Option B, revised from 5-10s to 10s to reduce DB load from complex join queries). Polling MUST stop when browser tab is backgrounded.
- Q: User role mapping (role-based vs permission-based)? → A: Permission-based — check `rag.manage` for viewing, `document.classification_override` for classification changes (not role-locked)
- Q: Force re-ingest behavior when BUILDING generation already exists? → A: Prevent — show error "ingestion in progress, please wait" if BUILDING already exists (Option A)
- Q: Metrics reset scope (global vs per-project)? → A: Global only (Option B, revised from original Option C) — metrics are in-memory system-level aggregates without per-project partitioning; per-project reset is not feasible without a major refactor. Document limitation in spec.
- Q: Default page size for pagination? → A: 20 items per page (Option B) — balanced visibility and performance

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: System MUST display a RAG ingestion status dashboard listing all attachments with their current RAG status (NOT_STARTED, BUILDING, ACTIVE, RETIRED, FAILED), chunk count, and last-updated timestamp.
- **FR-002**: System MUST allow filtering the status dashboard by project and status.
- **FR-003**: System MUST paginate the status dashboard for large attachment counts, with a default page size of 20 items and user-selectable page size options (10, 20, 50 only — enum validation, other values rejected).
- **FR-003a**: System MUST auto-refresh the ingestion status dashboard via polling every 10 seconds (not 5s — to reduce DB load from complex join queries), and also provide a manual refresh button for immediate updates. Polling MUST stop when the browser tab is backgrounded.
- **FR-004**: System MUST provide a classification override UI accessible only to users with `document.classification_override` permission.
- **FR-005**: System MUST require a reason string when overriding classification.
- **FR-006**: System MUST display the effective classification (override or inherited) as a badge on each attachment.
- **FR-007**: System MUST display the generation lifecycle history for each attachment, showing all generations with status, timestamps, and chunk counts.
- **FR-008**: System MUST allow admins to trigger force re-ingestion from the generation lifecycle viewer.
- **FR-009**: System MUST display RAG observability metrics: ingestion duration, chunk count, vector latency, stale-result rate, fallback rate, and cleanup retry rate.
- **FR-010**: System MUST allow admins to reset observability metrics globally (all metrics at once), with a confirmation dialog. Per-project reset is NOT supported — metrics are in-memory system-level aggregates without per-project partitioning.
- **FR-011**: System MUST display a list of failed ingestions with error messages and retry buttons.
- **FR-012**: System MUST allow batch retry of multiple failed ingestions.
- **FR-013**: System MUST show user-friendly error messages (Thai/English via i18n) for all error states, following ADR-007 layered error handling.
- **FR-014**: System MUST NOT expose internal generation UUIDs in the admin UI (use attachment publicId only).
- **FR-015**: System MUST enforce CASL/RBAC on all admin console endpoints using permission-based checks (not role-locked) — `rag.manage` for viewing, `rag.admin.write` for force re-ingest and metrics reset, `document.classification_override` for classification changes, `rag.retry` for failed ingestion retry.
- **FR-016**: System MUST use i18n keys for all user-facing text (no hardcoded strings).
- **FR-017**: System MUST show an empty state with guidance when no RAG data exists.
- **FR-018**: System MUST show a service-unavailable banner when Qdrant or AI backend is unreachable.

### Key Entities _(include if feature involves data)_

- **Attachment**: The file being indexed. Key attributes: publicId, originalFilename, mimeType, checksum, ragStatus (computed on-the-fly — NOT a stored field), effectiveClassification, classificationOverride, aiProcessingStatus (PENDING/PROCESSING/DONE/FAILED).
- **RagAttachmentGeneration**: The indexing lifecycle record. Key attributes: generationUuid (internal, not exposed), attachmentUuid, status (BUILDING/ACTIVE/RETIRED/FAILED — DB enum), chunkCount, createdAt, activatedAt, retiredAt, failedAt, errorCode, errorMessage. Note: `NOT_STARTED` is a computed dashboard status (no generation exists), not a DB enum value.
- **RagAttachmentChunk**: The indexed text chunk. Key attributes: chunkPublicId, generationUuid (internal), chunkIndex, content, segmentType, sourceLocator, classification.
- **RagObservabilityMetrics**: In-memory metrics snapshot. Key attributes: ingestionDuration (histogram), chunkCount (counter), vectorLatency (histogram), staleResultRate (counter), fallbackRate (counter), cleanupRetryRate (counter).

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Admins can determine the RAG ingestion status of any attachment within 3 seconds of opening the dashboard.
- **SC-002**: Security Admins can override an attachment's classification in under 30 seconds (select + reason + submit).
- **SC-003**: Admins can view the complete generation lifecycle history of an attachment in a single page without scrolling through raw API responses.
- **SC-004**: Admins can identify performance bottlenecks (high stale rate, high fallback rate, slow ingestion) from the metrics dashboard without running manual queries.
- **SC-005**: Operators can retry a failed ingestion in under 10 seconds (locate + click retry).
- **SC-006**: 100% of classification overrides are visible in the audit log with before/after/reason/actor within 5 seconds of the action.
- **SC-007**: The dashboard handles 500+ attachments without page load exceeding 3 seconds (with pagination).
- **SC-008**: Users without `document.classification_override` permission never see the classification override panel — zero unauthorized access attempts reach the backend.

## Assumptions

- Feature 254 (RAG Attachment Chunks) backend APIs are complete and available (ingestion status, classification override, generation lifecycle, observability metrics endpoints).
- The existing admin AI section (`/admin/ai/`) is the correct location for the RAG admin console pages (route: `/admin/ai/rag-console/` with 5 tabs).
- The existing `AiInfrastructureMonitoring` component pattern can be referenced for metrics display.
- The existing `rag-playground` page pattern can be referenced for admin AI page structure.
- Observability metrics are in-memory (not persisted) — the dashboard will show current snapshot only, not historical trends.
- Pagination uses the existing project-wide pagination pattern (cursor or offset-based, matching other admin tables) with a default page size of 20 items.
- i18n keys for RAG admin messages will be added to the existing `ai.json` locale files under a `rag.admin.*` namespace with sub-namespaces per user story (`rag.admin.dashboard.*`, `rag.admin.classification.*`, `rag.admin.lifecycle.*`, `rag.admin.metrics.*`, `rag.admin.retry.*`).

## Dependencies

- Feature 254 (`254-rag-attachment-chunks`) — backend APIs for ingestion status, classification override, generation lifecycle, observability metrics, and retry.
- ADR-016 — CASL/RBAC permission enforcement for admin console access.
- ADR-019 — UUIDv7 publicId usage (no internal IDs exposed).
- ADR-007 — Layered error handling for user-friendly messages.
- ADR-008 — BullMQ for async retry operations.
