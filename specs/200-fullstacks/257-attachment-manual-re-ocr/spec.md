# Feature Specification: Attachment Manual Re-OCR

**Feature Branch**: `257-attachment-manual-re-ocr`
**Created**: 2026-09-19
**Status**: Draft
**Governing ADR**: [ADR-055](../../06-Decision-Records/ADR-055-attachment-manual-re-ocr.md) (D1–D16, incl. 2026-09-19 grill revisions)
**Input**: User description: "Attachment Manual Re-OCR — human-in-the-loop compare-before-replace. An admin re-runs OCR on a single PDF attachment from the RAG console, picks the engine, reviews a side-by-side comparison against the original PDF, and confirms to replace the stored OCR text and refresh search indexing. Includes fixing two existing silent-failure defects in the OCR pipeline."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Re-OCR an attachment and replace its text after review (Priority: P1)

An administrator finds an attachment whose stored OCR text is poor (misread or incomplete). From the RAG console attachment list they start a re-OCR, choose an OCR engine (vision-model OCR is the default), wait for the job, compare the new text with the current text next to the original PDF, and confirm the replacement. After confirmation the attachment's text is replaced and search indexing is refreshed so RAG answers reflect the new text.

**Why this priority**: This is the entire purpose of the feature — fixing bad OCR text on existing documents without data loss. Without it there is no value.

**Independent Test**: With one PDF attachment that has poor stored text, run the full trigger → wait → compare → confirm flow and verify the stored text changed only after confirmation and that the attachment's search index is rebuilt from the new text.

**Acceptance Scenarios**:

1. **Given** an admin holding the RAG admin-write permission and a PDF attachment, **When** they start re-OCR from the RAG console row action, **Then** a full-screen dialog opens with engine selection (vision-model OCR preselected), and submitting it queues a job and shows the queue position plus a worst-case wait estimate — the stored OCR text is not touched.
2. **Given** a queued job that completes, **When** the admin views the result, **Then** they see the current text and new text side by side, character counts for both, and the original PDF as a reference, with a search box on each text pane.
3. **Given** a completed result that differs from the current text, **When** the admin clicks confirm and acknowledges the final "permanent, cannot be undone" warning, **Then** the stored text is replaced, the attachment is marked as processed, its search indexing is rebuilt from the new text (previous index data retired automatically), and the dialog closes with a success notice.
4. **Given** a completed result, **When** the admin never confirms, **Then** the stored text remains unchanged and the pending result expires on its own after 72 hours (implicit rejection — no reject action exists).

---

### User Story 2 - Failure handling and engine retry without silent fallback (Priority: P1)

When OCR fails, the admin is told clearly and decides what to do. The system never silently switches to a different engine (which would just return the original poor result).

**Why this priority**: Silent failures today leave admins looking at a spinner forever; trust in an admin tool that replaces source-of-truth data depends on honest status.

**Independent Test**: Force an engine failure (e.g., insufficient GPU memory) and verify the admin sees a failed state with a reason only after all retries are exhausted, plus one-click retry options.

**Acceptance Scenarios**:

1. **Given** a job that fails on an early retry attempt, **When** the admin polls status, **Then** status shows "processing" (with attempt number), not "failed".
2. **Given** a job that fails on its final attempt, **When** status is read, **Then** it shows "failed" with a readable reason and two buttons: "retry with vision-model OCR" and "retry with auto"; each starts a brand-new job.
3. **Given** the engine returns empty text, **When** the job finishes, **Then** it is recorded as failed ("engine returned empty result"), never as a completable result.
4. **Given** the new text is under 50% the length of the current text, **When** the admin views the result, **Then** a warning badge is shown but confirmation remains allowed.
5. **Given** the new text is exactly identical to the current text, **When** the admin views the result, **Then** a "result identical" notice is shown and confirm is disabled.

---

### User Story 3 - Resume and coordinate across admins (Priority: P2)

Any admin can re-open the re-OCR action for an attachment and land in the right step: the start form if nothing is pending, the waiting screen if a job is running, the comparison if a result awaits confirmation, or the error view if it failed. The dialog shows who started the job and when.

**Why this priority**: Jobs can take minutes and results live up to 3 days; work must survive closing the browser and being picked up by a colleague, and duplicate GPU work must be avoided.

**Independent Test**: Start a job, close the dialog, re-open it as another admin, and verify the same job is shown with the starter's name and time; verify a second start attempt during an active job is rejected.

**Acceptance Scenarios**:

1. **Given** a pending result from another admin, **When** an admin opens the action, **Then** the comparison view opens directly with "started by {name} at {time}".
2. **Given** a job already queued or processing for the attachment, **When** another start request is submitted, **Then** it is rejected with a conflict message.
3. **Given** a stale pointer whose job no longer exists in the queue, **When** a start request is submitted, **Then** it is accepted.
4. **Given** the attachment's current stored text is empty (earlier extraction failed), **When** the comparison opens, **Then** the left pane shows an informational placeholder rather than an error.

---

### User Story 4 - Existing OCR pipeline no longer fails silently or overwrites confirmed text (Priority: P2)

Two pre-existing defects are fixed because this feature depends on them: (a) OCR job failures previously never reported a failed status to the waiting user; (b) a late-running ingestion job could overwrite text that an admin had already confirmed.

**Why this priority**: Correctness prerequisites for the human-in-the-loop guarantee, but they also benefit existing flows.

**Independent Test**: Simulate an OCR failure in the two failure paths and confirm a failed status is recorded; simulate an ingestion job running on an already-completed attachment and confirm it skips without changing the text.

**Acceptance Scenarios**:

1. **Given** an OCR job that fails at the GPU-capacity check or during processing, **When** its final attempt fails, **Then** a failed status with reason is recorded for polling clients.
2. **Given** an attachment whose processing status is already "done", **When** a queued ingestion job for it runs, **Then** the job is skipped with a warning log and stored text is unchanged.
3. **Given** an attachment in "pending" or "failed" status, **When** an ingestion job runs, **Then** it proceeds exactly as before.

---

### Edge Cases

- Attachment is not a PDF → start is rejected (unprocessable) before queuing.
- Original file no longer exists in storage → start is rejected (gone) before queuing.
- Attachment is currently in "processing" ingestion state → start rejected (conflict); "pending", "done", "failed" allowed.
- Confirm called twice, or after the 72h expiry, or with a token that doesn't match → not-found/gone; nothing changes.
- Attachment deleted between result and confirm → not-found; no partial update.
- Multiple admins trigger at once → only one active job per attachment; each result is tied to its own token so results never get mixed.
- Cached OCR result from the last 24h exists → re-OCR must bypass the cache, otherwise it would return the old text unchanged.
- OCR batch phase or AI model switch in progress → start is rejected with the standard "AI features temporarily unavailable" message and recovery guidance.
- AI features globally disabled → feature unavailable.
- Confirm succeeds but re-indexing fails → attachment shows indexing failed in existing status views, and the existing periodic vector health check repairs it; stored text is already the confirmed text.
- Checksum missing on migrated attachments → computed at re-index time.
- Vision-model GPU capacity check applies only to the vision engine; "auto" is not blocked by GPU pressure.

## Requirements _(mandatory)_

### Functional Requirements

**Trigger & authorization**

- **FR-001**: The system MUST allow re-OCR only by manual action of a user holding the RAG admin-write permission; there is no automatic or scheduled re-OCR.
- **FR-002**: Starting and confirming MUST require an idempotency key (rejected as bad request if missing), be rate-limited, respect the AI-enabled switch, and be audit-logged with the acting user.
- **FR-003**: Reading job status MUST require the RAG-manage (read) permission.
- **FR-004**: Only one attachment can be re-OCR'd per request; no batch operation.
- **FR-005**: The system MUST reject start requests for non-PDF attachments (unprocessable), missing source files (gone), attachments in "processing" ingestion state (conflict), and attachments that already have a live queued/processing re-OCR job (conflict). A stale pointer whose job no longer exists MUST NOT block a new start.
- **FR-006**: The system MUST reject start requests with the standard AI-unavailable response during OCR batch phases or model transitions.

**Engine selection & queueing**

- **FR-007**: The admin MUST be able to choose the OCR engine: vision-model OCR (default) or auto. UI text explains the trade-off. Values outside the supported set MUST fail validation.
- **FR-008**: The system MUST NOT silently fall back to a different engine on failure; the admin decides on retry.
- **FR-009**: Re-OCR jobs MUST run through a dedicated sequential OCR queue (one job at a time, GPU-serialized), separate from the general AI batch queue, with no priority manipulation.
- **FR-010**: The start response MUST include a result token, job id, queue position, and a worst-case wait estimate (labelled as such).
- **FR-011**: The GPU-capacity pre-check MUST apply only to the vision-model engine.
- **FR-012**: Re-OCR MUST bypass the OCR result cache when reading, and MUST refresh the cache with the new result.
- **FR-013**: Jobs MUST retry transient failures up to 3 attempts with backoff; "failed" is only reported on the final attempt, with "processing" (plus attempt number) shown between attempts.

**State & result**

- **FR-014**: The stored attachment text MUST NOT change between start and confirm.
- **FR-015**: Job status and results MUST be held as temporary data with a single 72-hour lifetime; expiry without confirmation equals rejection. Status (lightweight, latest job) and result text (per token) MUST be stored separately so status polling never transfers full text.
- **FR-016**: Status responses MUST distinguish: not found; queued/processing (with job id, engine, attempt); failed (with reason); completed (with new text, engine used, character count, processing time, and an "identical to current" flag). New text MUST be returned only in the completed state.
- **FR-017**: A result with empty text MUST be recorded as failed. A result under 50% of the current text length MUST carry a "much shorter" warning that does not block confirmation. An identical result MUST disable confirmation.
- **FR-018**: The status record MUST include the starter's display name and start time.

**Confirm & re-index**

- **FR-019**: Confirm MUST accept only a valid, unexpired token, and MUST atomically replace the stored text, mark indexing as pending, clear the last indexing error, and mark the attachment's processing status as done; a deleted attachment yields not-found.
- **FR-020**: Only after the replacement is committed MUST the system trigger re-indexing through the existing forced re-ingest path so a new index generation is built even though the file itself is unchanged; the previous generation is retired by the existing lifecycle. The system MUST NOT delete vectors manually.
- **FR-021**: After successful confirm, both temporary records MUST be deleted so a repeat confirm fails as not-found/gone.
- **FR-022**: There MUST be no rollback after confirm; restoring earlier text requires running re-OCR again.
- **FR-023**: If re-index enqueueing fails, no dangling in-progress index generation may remain; the failure surfaces in existing failed-ingestion views and the health check repairs it.

**Pipeline fixes**

- **FR-024**: Every OCR job failure path (GPU-capacity check and general error) MUST record a failed status with reason for polling clients (on the final attempt), and, for re-OCR jobs, on the re-OCR status record too.
- **FR-025**: Ingestion jobs MUST NOT modify text or status of an attachment already in "done" state; they MUST skip with a warning. Retries from "pending"/"failed" MUST behave as before.

**User interface**

- **FR-026**: The single entry point MUST be a "Re-OCR" row action in the RAG console attachment list, visible only to users with the admin-write permission, opening a full-screen dialog with three phases: engine selection, waiting (status refreshed about every 3 seconds), and comparison.
- **FR-027**: Opening the action MUST first read current status and land in the matching phase (none → start form; queued/processing → waiting; completed → comparison; failed → error view).
- **FR-028**: The comparison MUST show current and new text side by side (plain, monospace, synchronized scrolling), character counts, the original PDF as a reference pane, and a search box per text pane. When the current text is empty, a placeholder explains why.
- **FR-029**: Confirm MUST require a final explicit acknowledgement stating the replacement is permanent, showing old → new character counts.
- **FR-030**: After confirm the dialog closes with a success notice and the list refreshes; re-index progress is shown by the existing status badge/timeline. No new progress UI and no cancel-job action.
- **FR-031**: All user-facing strings MUST use the project's i18n mechanism.

### Key Entities

- **Attachment**: An uploaded file record with stored OCR text, an ingestion processing status (pending/processing/done/failed), and an indexing status. Re-OCR changes its text and statuses only at confirm.
- **Re-OCR Job Status Record**: Temporary, one per attachment (latest job): state, result token, job id, engine, starter name and time, attempt/warning/error info. Lifetime 72h.
- **Re-OCR Result Record**: Temporary, one per token: new text, engine used, character count, processing time, completion time. Lifetime 72h; removed on confirm.
- **Index Generation**: Existing searchable-index version for an attachment; a new one is built on confirm and the old one retired.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: In 100% of re-OCR runs, the attachment's stored text is byte-identical before and after until an explicit confirm.
- **SC-002**: An admin can go from the RAG console row to a confirmed replacement in under 5 minutes of active effort (typical PDF up to ~50 pages; excluding queue wait).
- **SC-003**: Every failed job surfaces as "failed" with a readable reason within 1 minute of its final attempt ending; zero jobs left showing "waiting/processing" indefinitely.
- **SC-004**: After confirm, 100% of attachments have search results reflecting the new text once indexing completes, with no stale results from the previous text and no lost indexing state.
- **SC-005**: Zero occurrences of a confirmed text being overwritten by a late-running ingestion job (verified by regression test).
- **SC-006**: A second admin can resume any in-progress or completed re-OCR from the console in one click, with no duplicate jobs created (0 duplicate active jobs per attachment).
- **SC-007**: 100% of start/confirm actions are attributable to a named user in the audit trail.
- **SC-008**: Existing ingestion behavior for pending/failed attachments is unchanged (existing regression suites pass with zero new failures).

## Assumptions

- Only PDFs are supported; other file types are out of scope.
- The reused OCR engines, reingest path, index-generation lifecycle, vector health check, AI-unavailable handling, and RAG console components already exist and are reused as-is.
- No database schema changes are needed; temporary state lives in the cache store (ADR-055 D4, ADR-044 unaffected).
- Existing permissions (RAG admin-write / RAG-manage) are reused; no new permissions.
- Worst-case wait estimate is an approximation, not a guarantee; OCR options such as temperature are not exposed in this version.
- Batch re-OCR, cancel-job, rollback, and a "pending confirm" list badge are explicitly out of scope for v1.
- Governing decisions D1–D16 in ADR-055 take priority over this spec where they conflict.
