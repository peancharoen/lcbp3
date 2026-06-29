// File: specs/200-fullstacks/227-ai-admin-console/spec.md
// Change Log:
// - 2026-05-20: Feature Specification สำหรับระบบ AI Admin Console
// - 2026-05-21: Restructure following spec-template.md with User Stories, FRs, Success Criteria

# Feature Specification: AI Admin Console

**Feature Branch**: `227-ai-admin-console`
**Created**: 2026-05-20
**Status**: Draft
**Category**: 200-fullstacks
**Input**: ADR-027 AI Admin Panel and Dynamic Control Architecture

---

## User Scenarios & Testing

### User Story 1 - Superadmin Toggles AI System On/Off (Priority: P1)

As a Superadmin, I need to dynamically enable or disable AI features for all regular users without redeploying the system, so that I can perform maintenance, manage system load, or handle AI infrastructure issues gracefully.

**Why this priority**: This is the core control mechanism of the feature. Without it, the admin cannot perform emergency maintenance or manage system resources during high load periods.

**Independent Test**: Can be fully tested by a Superadmin toggling the AI switch and observing that regular users immediately see the disabled state (within polling interval) while the Superadmin retains full access.

**Acceptance Scenarios**:

1. **Given** the AI system is currently enabled, **When** a Superadmin toggles the switch to disabled, **Then** the setting is persisted to database and cache, and regular users see disabled AI buttons within 30 seconds
2. **Given** the AI system is currently disabled, **When** a Superadmin toggles the switch to enabled, **Then** regular users can access AI features again after the polling interval
3. **Given** a regular user has AI permissions, **When** they attempt to use AI features while the system is disabled, **Then** they receive HTTP 503 with a user-friendly message explaining temporary unavailability

---

### User Story 2 - Normal Users Experience Soft Fallback (Priority: P1)

As a regular user with AI permissions, I need clear visual feedback when AI features are temporarily disabled, so that I understand why AI buttons are unavailable and can complete my work manually without confusion.

**Why this priority**: Critical for user experience. Abrupt feature disappearance creates confusion and support tickets. Soft fallback maintains user trust.

**Independent Test**: Can be tested by disabling AI system and verifying that regular users see disabled buttons with tooltips and global banner, rather than errors or missing UI elements.

**Acceptance Scenarios**:

1. **Given** the AI system is disabled by admin, **When** a regular user views a document form with AI suggestion buttons, **Then** those buttons appear disabled with a tooltip explaining "ระบบ AI ไม่พร้อมใช้งานชั่วคราว"
2. **Given** the AI system is disabled, **When** a regular user loads any page, **Then** a global banner appears at the top stating AI is temporarily unavailable
3. **Given** a regular user attempts direct API access to AI endpoints while disabled, **When** the request is made, **Then** the system returns HTTP 503 with recovery guidance

---

### User Story 3 - Superadmin Monitors AI Health Status (Priority: P2)

As a Superadmin, I need real-time visibility into AI infrastructure health (Ollama, Qdrant, BullMQ queues), so that I can diagnose issues, monitor latency, and make informed decisions about enabling/disabling AI services.

**Why this priority**: Essential for operational awareness but secondary to the control mechanism itself.

**Independent Test**: Can be tested by accessing the AI Admin Console health dashboard and verifying all metrics display correctly with appropriate status indicators.

**Acceptance Scenarios**:

1. **Given** the AI Admin Console is accessed, **When** a Superadmin views the health panel, **Then** they see Ollama latency, active model version, Qdrant collection stats, and BullMQ queue metrics (waiting/active/failed jobs)
2. **Given** a service is experiencing issues, **When** health check runs, **Then** the status displays as degraded/down with relevant metrics highlighted
3. **Given** the Superadmin is monitoring the system, **When** they refresh or view the dashboard, **Then** metrics are cached for 30 seconds to prevent excessive load

---

### User Story 4 - Superadmin Uses RAG Playground Sandbox (Priority: P2)

As a Superadmin, I need an isolated RAG testing environment where I can query documents and receive AI-generated responses with citations, so that I can test and refine AI behavior without affecting production queues or user experiences.

**Why this priority**: Enables safe testing and troubleshooting of AI capabilities during maintenance windows.

**Independent Test**: Can be tested by submitting a RAG query in the sandbox and receiving a complete response with document citations, while verifying the job runs through the isolated sandbox queue.

**Acceptance Scenarios**:

1. **Given** the AI system is disabled for regular users, **When** a Superadmin submits a RAG query in the sandbox, **Then** the query processes through the isolated queue and returns results with citations
2. **Given** a RAG job is submitted, **When** it is processing, **Then** the Superadmin can poll for status updates every 5 seconds and see progress
3. **Given** the sandbox queue has multiple jobs, **When** jobs are processed, **Then** Superadmin jobs have SUPERADMIN priority (higher than regular batch jobs)

---

### User Story 5 - Superadmin Uses OCR Sandbox for Metadata Extraction (Priority: P2)

As a Superadmin, I need to upload PDF files to an isolated OCR sandbox to test metadata extraction capabilities, so that I can validate AI accuracy and tune extraction parameters without impacting production document processing.

**Why this priority**: Supports AI tuning and validation workflows, enabling data-driven improvements to extraction accuracy.

**Independent Test**: Can be tested by uploading a PDF to the OCR sandbox and receiving extracted metadata in JSON format with confidence scores.

**Acceptance Scenarios**:

1. **Given** a PDF file is uploaded to the OCR sandbox, **When** processing completes, **Then** the system returns extracted metadata as formatted JSON with syntax highlighting
2. **Given** an OCR job is submitted, **When** processing fails, **Then** the error is displayed inline in a red box with actionable guidance
3. **Given** the queue length is >= 3, **When** additional sandbox requests are made, **Then** dynamic rate limiting applies (10 requests/hour per user)

---

### Edge Cases

- **EC-001**: What happens when Redis cache is unavailable? System must fall back to database query with <100ms latency penalty
- **EC-002**: How does system handle concurrent toggle requests? Last-write-wins with optimistic locking; invalid cache after successful write
- **EC-003**: What if Ollama/Qdrant times out during health check? Health service returns DEGRADED status, not DOWN; timeout is 5 seconds per service
- **EC-004**: How are long-running sandbox jobs handled? Job status polling available; jobs can be cancelled by admin; results cached for 1 hour
- **EC-005**: What happens if a Superadmin loses permissions mid-session? Next API request returns 403; UI redirects to unauthorized page

---

## Requirements

### Functional Requirements

- **FR-001**: System MUST provide a toggle switch accessible only to Superadmin (`system.manage_all`) to enable/disable AI features system-wide
- **FR-002**: System MUST persist AI enabled/disabled state to `system_settings` table with Redis caching for <1ms latency on status checks
- **FR-003**: System MUST display disabled AI buttons with explanatory tooltips to regular users when AI is turned off
- **FR-004**: System MUST show a global banner at the top of all pages when AI is disabled, visible only to users with AI permissions
- **FR-005**: System MUST return HTTP 503 Service Unavailable to regular users attempting AI API calls when AI is disabled
- **FR-006**: System MUST allow Superadmins full AI access (including sandbox) even when AI is disabled for regular users
- **FR-007**: System MUST provide health monitoring dashboard showing Ollama latency, model version, Qdrant stats, and BullMQ queue metrics
- **FR-008**: System MUST cache health check results for 30 seconds to prevent excessive infrastructure load
- **FR-009**: System MUST provide isolated RAG sandbox queue (`ai-admin-sandbox`) with SUPERADMIN job priority
- **FR-010**: System MUST provide isolated OCR sandbox for PDF metadata extraction with JSON output and syntax highlighting
- **FR-011**: System MUST implement dynamic rate limiting for sandbox based on queue length (queue < 3: no limit, queue >= 3: 10 req/hr)
- **FR-012**: System MUST poll AI status every 30 seconds from frontend for users with AI permissions
- **FR-013**: System MUST support job status polling every 5 seconds for sandbox operations
- **FR-014**: System MUST implement AiEnabledGuard with layered permission check (system.manage_all + ai.suggest/ai.rag_query bypass)

### Key Entities

- **SystemSetting**: Stores dynamic configuration values (AI_FEATURES_ENABLED, etc.) with metadata (data_type, category, validation_rules)
- **SandboxJob**: Represents a sandbox operation (RAG query or OCR extraction) with priority, status, and results
- **HealthStatus**: Aggregated health metrics from Ollama, Qdrant, and BullMQ with status indicators (HEALTHY/DEGRADED/DOWN)

---

## Success Criteria

### Measurable Outcomes

- **SC-001**: Superadmin can toggle AI system state with changes reflected to regular users within 30 seconds
- **SC-002**: AI status check API responds in under 1ms when cached, under 50ms on cache miss
- **SC-003**: 100% of regular users see disabled AI buttons with tooltips when AI is turned off (no hidden or broken UI)
- **SC-004**: Health dashboard displays all 3 services (Ollama, Qdrant, BullMQ) with <5 second data staleness
- **SC-005**: Sandbox RAG queries return complete responses with citations within 2x normal queue processing time
- **SC-006**: Sandbox OCR extraction returns valid JSON for 95% of test PDFs with clear error messages for failures
- **SC-007**: Zero unauthorized access to admin endpoints (verified by security tests)
- **SC-008**: System gracefully degrades when AI disabled with zero error reports from confused users
