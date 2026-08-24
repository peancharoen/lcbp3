# Feature Specification: AI Engine Control Center

**Feature ID**: `248-ai-engine-control-center`  
**Created**: 2026-08-24  
**Status**: Ready for Planning  
**Input**: ADR-048: AI Engine Control Center (from Read-Only Monitoring to Active Control)  
**Related ADR**: [ADR-048: AI Engine Control Center](../../06-Decision-Records/ADR-048-ai-engine-control-center.md)

---

## Executive Summary

Transforms the existing read-only AI System Monitoring dashboard (`/admin/ai/system`) into an **Active AI Engine Control Center**. It empowers Superadmins with complete operational visibility (Host CPU, RAM, GPU, Temperature, Queue Health) and actionable runtime controls (Ollama VRAM Model Load/Unload with concurrency and auto-eviction guards, detailed BullMQ job inspection, individual job retry/delete, and bulk failed job purging).

---

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Real-time Server & Telemetry Observability (Priority: P1)

As a Superadmin, I want to see the comprehensive real-time health of the AI host machine (CPU % load, memory usage, CPU temperature, GPU telemetry, and VRAM status) consolidated in one screen, so that I can immediately detect bottlenecks, thermal throttling, or resource exhaustion caused by AI workloads or co-located processes.

**Why this priority**: Without host-level observability, administrators cannot diagnose whether system sluggishness is caused by CPU starvation (e.g. from MariaDB/Elasticsearch) or GPU VRAM exhaustion.

**Independent Test**: Can be tested by loading `/admin/ai/system` and verifying that CPU %, Memory, GPU, and Temperature cards render accurately with historical sparkline trends and auto-refresh every 10 seconds.

**Acceptance Scenarios**:
1. **Given** the AI telemetry service is running, **When** the Superadmin views `/admin/ai/system`, **Then** the system displays Host CPU % (overall and per-core), Memory (Used/Total), CPU Temperature, and GPU telemetry.
2. **Given** the dashboard is open, **When** 10 seconds elapse, **Then** all metric cards refresh automatically with smooth transition without page reload.
3. **Given** the dashboard is open, **When** the Superadmin clicks "Pause", **Then** auto-refresh pauses; clicking "Play" resumes; clicking "Refresh" updates immediately.
4. **Given** the backend was restarted within 10 seconds, **When** metrics are requested, **Then** the system returns estimated system load average with `isEstimated: true` indicator without throwing errors.

---

### User Story 2 - Consolidated Ollama & VRAM Management with Active Load/Unload (Priority: P1)

As a Superadmin, I want to view active and loaded models in a single consolidated table and have the ability to manually load or unload models into/out of GPU VRAM with safety guards, so that I can prepare GPU memory before heavy batch migrations and prevent cold-start delays.

**Why this priority**: Manual VRAM residency control prevents unwanted model thrashing during large document migrations and provides direct control over GPU resource allocation.

**Independent Test**: Can be tested by clicking "Load" or "Unload" on active models in the Ollama card and verifying GPU VRAM changes in real-time, guarded by confirmation and queue checks.

**Acceptance Scenarios**:
1. **Given** model `np-dms-ai` is not loaded in VRAM, **When** the Superadmin clicks "Load", **Then** the model is loaded into VRAM using execution profile defaults and the status switches to "Loaded".
2. **Given** model `np-dms-ai` is loaded in VRAM, **When** the Superadmin clicks "Unload", **Then** a Confirmation Dialog warns of cold-start latency; upon confirmation, the model is evicted (`keep_alive: 0`) and status becomes "Not Loaded".
3. **Given** there are `active` or `waiting` jobs in `ai-realtime` or `ai-batch`, **When** the Superadmin tries to Load/Unload a model, **Then** the system blocks the action with a `409 Conflict` message explaining that jobs are pending.
4. **Given** loading a model would exceed GPU VRAM capacity, **When** the Superadmin triggers "Load", **Then** the Auto-Eviction policy unloads the inactive model before loading the target model.

---

### User Story 3 - Queue Job Drill-Down & Individual Actions (Priority: P2)

As a Superadmin, I want to click any BullMQ queue card to open a slide-over drawer showing detailed individual jobs with filterable status tabs, pagination, and retry/delete actions per job, so that I can investigate and recover failed jobs without Redis CLI access.

**Why this priority**: Aggregated queue counts alone are insufficient for debugging; administrators need to see error stack traces, job parameters, and retry specific failed tasks.

**Independent Test**: Can be tested by clicking a queue card, verifying the slide-over drawer opens, filtering by "Failed", viewing the error reason, and executing "Retry" or "Delete" on individual jobs.

**Acceptance Scenarios**:
1. **Given** a queue has jobs, **When** the Superadmin clicks the queue card, **Then** a slide-over sheet opens showing jobs with columns (Job ID, Type, Status, Created, Processed, Finished, Error Reason).
2. **Given** the drawer is open, **When** the Superadmin switches between tabs (`All`, `Failed`, `Active`, `Waiting`), **Then** the job list filters accordingly with server-side pagination.
3. **Given** a failed job in the list, **When** the Superadmin clicks "Retry", **Then** the job is re-enqueued for processing and audit log is recorded.
4. **Given** a job in the list, **When** the Superadmin clicks "Delete", **Then** a confirmation prompt is shown; upon approval, the job record is removed from the queue.

---

### User Story 4 - Bulk Clear Failed Jobs (Priority: P2)

As a Superadmin, I want a dedicated "Clear Failed" action per queue that runs asynchronously and safely cleans up to 10,000 failed job records, so that the dashboard stays clean after incident resolutions.

**Why this priority**: Mass failures during infrastructure outages (e.g. NAS disconnects) leave thousands of failed jobs in Redis that clutter the system and consume memory.

**Independent Test**: Can be tested by triggering "Clear Failed" on a queue with failed jobs and verifying that an asynchronous cleanup task executes, clears failed records in chunks, and reports total cleaned count.

**Acceptance Scenarios**:
1. **Given** a queue has failed jobs, **When** the Superadmin clicks "Clear Failed" in the drawer header, **Then** the system enqueues an async cleanup task and displays a progress toast.
2. **Given** the cleanup finishes, **When** polling returns completion, **Then** the toast notification reports exact cleared count and remaining failed jobs (e.g., "Cleared 3,500 failed jobs (0 remaining)").

---

### Edge Cases

- **Cold Start Transition:** When the backend process starts, it has no prior metric sample. The system smoothly falls back to 1-minute system load average with `isEstimated: true` for 10 seconds until the first delta is calculated.
- **Sensor Missing on Hardware:** If `hwmon` or temperature sensors are unavailable on the host kernel/container, temperature returns `null` and the UI displays `N/A` gracefully without throwing errors.
- **In-flight TOCTOU Collision:** If a new job is submitted during the 1-3 second window when Ollama is loading/unloading, the `AiQueueService.enqueue*()` lock-check intercepts and rejects the request with `503 Service Unavailable` before it reaches BullMQ.
- **Deleting Active Jobs:** Deleting an `active` job removes its Redis metadata but cannot kill in-flight GPU processes; the confirmation dialog explicitly warns the administrator of this behavior.
- **Massive Failed Jobs (>10k):** If failed jobs exceed the 10,000 safety cap, the system cleans the first 10,000 and transparently informs the administrator of the remaining count.

---

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: System MUST deploy `node-exporter` as a lightweight container in Layer 4 Telemetry publishing host metrics on port `:9100`.
- **FR-002**: Backend MUST provide `NodeMetricsService` with a 10-second background poller storing CPU, Memory, and Temperature delta snapshots into Redis (`ai:metrics:host_summary`).
- **FR-003**: System MUST maintain a 15-sample rolling history in Redis (`ai:metrics:host_history`) to render 2-3 minute sparkline trend charts across page reloads.
- **FR-004**: System MUST provide endpoint `GET /ai/admin/host/metrics` returning instantaneous metrics and historical sparkline series with `< 5ms` response time.
- **FR-005**: Frontend MUST combine the Ollama Engine and VRAM cards into a single unified table displaying canonical model names, VRAM usage, residency status, and Load/Unload controls.
- **FR-006**: Backend MUST provide endpoints `POST /ai/admin/models/:modelName/vram/load` and `POST /ai/admin/models/:modelName/vram/unload` executing Ollama generate calls with appropriate `keep_alive` values.
- **FR-007**: System MUST enforce a Global Empty-Queue Concurrency Guard on `ai-realtime` and `ai-batch` (rejecting Load/Unload with `409 Conflict` if any jobs are `active` or `waiting`).
- **FR-008**: System MUST implement an Auto-Eviction policy to unload inactive models before loading new ones if GPU VRAM capacity would be exceeded.
- **FR-009**: System MUST enforce a Redis Transition Lock (`ai:model:transitioning`) during VRAM changes, intercepting enqueue attempts in `AiQueueService` with `503 Service Unavailable`.
- **FR-010**: Frontend MUST present a Confirmation Dialog on Unload actions explicitly warning of cold-start latency (5-10s) for subsequent user requests.
- **FR-011**: Backend MUST provide endpoint `GET /ai/admin/queues/:queueName/jobs` supporting pagination and status filtering (`all`, `failed`, `active`, `waiting`).
- **FR-012**: Backend MUST provide single-job management endpoints: `POST /ai/admin/queues/:queueName/jobs/:jobId/retry` and `DELETE /ai/admin/queues/:queueName/jobs/:jobId`.
- **FR-013**: Backend MUST provide async cleanup endpoint `POST /ai/admin/queues/:queueName/clear-failed` and polling endpoint `GET /ai/admin/queues/:queueName/clear-failed/:jobId` processing up to 10,000 failed jobs in chunks of 1,000.
- **FR-014**: All control center endpoints MUST require `system.manage_all` permission (CASL Superadmin guard).
- **FR-015**: All mutation endpoints MUST be logged via `@Audit()` decorator adhering to ADR-016 §11.

---

### Key Entities

- **HostMetricsSnapshot**: Represents host hardware telemetry (timestamp, total CPU %, per-core CPU %, memory total/used/available, temperature °C, isEstimated flag).
- **ModelVramStatus**: Represents runtime model state (modelName, isLoaded, vramSizeBytes, expiresAt, keepAliveSeconds).
- **QueueJobDetail**: Represents a BullMQ job item (jobId, jobType, queueName, status, dataSummary, errorReason, createdAt, processedAt, finishedAt).
- **ClearFailedJobResult**: Represents async cleanup outcome (jobId, targetQueue, clearedCount, remainingFailed, status, completedAt).

---

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Host telemetry endpoint response time is under **10ms** (target: `< 5ms` from Redis cache).
- **SC-002**: Zero model transition race conditions or unexpected crashes during concurrent load/unload and job dispatch.
- **SC-003**: 100% of mutation actions (Load, Unload, Retry, Delete, Clear-Failed) generate structured audit trail logs.
- **SC-004**: Superadmin can view and clean up to 10,000 failed queue jobs in under **5 seconds** without blocking the HTTP server or Redis event loop.
- **SC-005**: All UI metric cards auto-refresh seamlessly every 10 seconds with pause/play controls and smooth sparkline animations.
