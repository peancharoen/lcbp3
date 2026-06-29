// File: specs/200-fullstacks/236-unified-ocr-architecture/spec.md
// Change Log:
// - 2026-06-13: Initial specification for Unified AI Model Architecture

# Feature Specification: Unified AI Model Architecture — Sandbox-Production Parity

**Feature Branch**: `236-unified-ocr-architecture`  
**Created**: 2026-06-13  
**Status**: Draft  
**Category**: 200-fullstacks  
**Input**: ADR-036: Unified AI Model Architecture — Sandbox-Production Parity for np-dms-ai and np-dms-ocr

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Admin Sandbox Parameter Testing (Priority: P1)

Admin users can test AI model parameters (temperature, topP, repeatPenalty, system prompt, etc.) in a sandbox environment for both np-dms-ai and np-dms-ocr models before applying them to production. The sandbox uses draft parameter values that are persisted but do not affect production jobs.

**Why this priority**: This is the core capability that enables safe parameter tuning without risking production stability. Without this, admins cannot safely iterate on AI model behavior.

**Independent Test**: Can be fully tested by creating draft parameters, running sandbox tests with different parameter values, and verifying that production jobs continue using existing parameters until apply is executed.

**Acceptance Scenarios**:

1. **Given** admin is on AI Console, **When** they select a model (np-dms-ai or np-dms-ocr) and view sandbox parameters, **Then** they see draft values seeded from current production defaults if no draft exists
2. **Given** admin has modified sandbox parameters, **When** they run a sandbox test, **Then** the test uses the draft parameters and results reflect those values
3. **Given** admin has modified sandbox parameters, **When** they check production jobs, **Then** production jobs continue using existing production parameters (not affected by draft)
4. **Given** admin has modified sandbox parameters, **When** they click "Reset to Production", **Then** sandbox draft is overwritten with current production values

---

### User Story 2 - Apply Parameters to Production (Priority: P1)

Admin users can apply tested sandbox parameters to production, which updates the production parameter store and invalidates cache. This action is guarded by security checks and audited.

**Why this priority**: This is the critical action that makes parameter changes effective in production. Without proper guardrails, this could cause system-wide issues.

**Independent Test**: Can be fully tested by applying parameters and verifying that: (1) production store is updated, (2) cache is invalidated, (3) audit log is created, (4) new jobs use the new parameters.

**Acceptance Scenarios**:

1. **Given** admin has tested sandbox parameters and is satisfied, **When** they click "Apply to Production", **Then** the system validates the request (Idempotency-Key, CASL permission, parameter ranges)
2. **Given** validation passes, **When** apply is executed, **Then** draft values are copied to ai_execution_profiles and Redis cache is invalidated
3. **Given** apply is executed, **When** the operation completes, **Then** an audit log entry is created with user, profile name, old values, new values, and timestamp
4. **Given** apply is executed, **When** a new production job starts, **Then** it uses the newly applied parameters (snapshot at dispatch time)
5. **Given** admin attempts to apply without required permission, **When** the request is made, **Then** the system returns 403 Forbidden
6. **Given** admin attempts to apply with invalid parameter values (e.g., temperature > 1), **When** the request is made, **Then** the system returns 400 Bad Request with validation error

---

### User Story 3 - Dual-Model Parameter Management (Priority: P2)

Admin users can manage parameters for both np-dms-ai (main AI model) and np-dms-ocr (OCR model) through a unified interface. OCR parameters are stored in a dedicated row 'ocr-extract' with a subset of parameters (no numCtx/maxTokens).

**Why this priority**: This ensures both models can be tuned independently while maintaining a consistent workflow. OCR has different parameter requirements than the main LLM.

**Independent Test**: Can be fully tested by selecting each model, modifying their respective parameters, and verifying that parameter sets are stored and applied correctly without interference.

**Acceptance Scenarios**:

1. **Given** admin selects np-dms-ai model, **When** they view parameters, **Then** they see temperature, topP, repeatPenalty, numCtx, maxTokens, keepAliveSeconds
2. **Given** admin selects np-dms-ocr model, **When** they view parameters, **Then** they see temperature, topP, repeatPenalty, keepAliveSeconds (numCtx and maxTokens are null/not shown)
3. **Given** admin applies np-dms-ai parameters, **When** the operation completes, **Then** only the np-dms-ai profile row is updated (ocr-extract row unchanged)
4. **Given** admin applies np-dms-ocr parameters, **When** the operation completes, **Then** only the ocr-extract row is updated (other profiles unchanged)

---

### User Story 4 - Master Data Context Parity in Sandbox (Priority: P2)

Admin users can select project and contract context when running sandbox tests, ensuring that the sandbox uses the same master data context as production jobs. This eliminates the parity gap where sandbox used 'default' project while production used real project context.

**Why this priority**: Without this, sandbox tests would not accurately reflect production behavior because prompts would have different {{master_data_context}} values.

**Independent Test**: Can be fully tested by running sandbox tests with different project/contract selections and verifying that the prompt context matches what would be used in production for those entities.

**Acceptance Scenarios**:

1. **Given** admin is on sandbox test page, **When** they select a project (and optionally contract), **Then** the test uses that project/contract context for master data lookup
2. **Given** admin selects a project with master data, **When** they run sandbox test, **Then** the prompt includes {{master_data_context}} with actual project data
3. **Given** admin selects a project without master data, **When** they run sandbox test, **Then** the prompt includes empty {{master_data_context}} (production-ready behavior)
4. **Given** admin attempts to run sandbox test without selecting project, **When** they submit, **Then** the system shows validation error requiring project selection

---

### User Story 5 - System Prompt Management (Priority: P3)

Admin users can manage system prompts through the existing ADR-029 Dynamic Prompt Management system. System prompts are stored in ai_prompts table and applied separately from runtime parameters.

**Why this priority**: System prompts are already managed by ADR-029. This story ensures the new parameter system integrates with the existing prompt system without duplication.

**Independent Test**: Can be fully tested by verifying that system prompt changes go through ADR-029 endpoints and are not duplicated in the new parameter store.

**Acceptance Scenarios**:

1. **Given** admin modifies system prompt in sandbox, **When** they apply to production, **Then** the system prompt is updated via ADR-029 ai_prompts table (not ai_execution_profiles)
2. **Given** admin applies runtime parameters, **When** the operation completes, **Then** system prompt is not affected (managed separately)
3. **Given** admin views parameter interface, **When** they look for system prompt field, **Then** they are directed to the Prompt Version UI (ADR-029)

---

### Edge Cases

- What happens when sandbox draft does not exist for a profile? → System seeds draft from current production row automatically
- What happens when production row does not exist for a profile? → System falls back to hardcoded default profiles in AiPolicyService
- What happens when apply is called with same Idempotency-Key twice? → System returns cached result from first attempt (idempotency)
- What happens when temperature or topP is outside 0-1 range? → System rejects with validation error before database write
- What happens when OCR job is dispatched but ocr-extract row is missing? → System falls back to default OCR parameters
- What happens when keep_alive is modified in sandbox? → It is stored but not frozen in snapshot (resource params are lazy-loaded per ADR-033)
- What happens when admin applies parameters while jobs are running? → Running jobs continue with old snapshot; new jobs use new parameters
- What happens when database transaction fails during apply? → System rolls back entirely and returns error (no partial update)

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: System MUST provide a sandbox parameter store (ai_sandbox_profiles) that mirrors the structure of production store (ai_execution_profiles)
- **FR-002**: System MUST automatically seed sandbox draft from current production values when draft does not exist
- **FR-003**: System MUST allow admin to modify sandbox parameters without affecting production jobs
- **FR-004**: System MUST provide "Apply to Production" action that copies sandbox draft to production store
- **FR-005**: System MUST invalidate Redis cache after applying parameters to production
- **FR-006**: System MUST validate Idempotency-Key header on apply endpoint to prevent duplicate applies
- **FR-007**: System MUST enforce CASL permission (system.manage_ai) on apply endpoint
- **FR-008**: System MUST validate parameter ranges (temperature: 0-1, topP: 0-1) before applying
- **FR-009**: System MUST log all apply operations to ai_audit_logs with user, profile, old values, new values
- **FR-010**: System MUST support both np-dms-ai and np-dms-ocr models with separate parameter sets
- **FR-011**: System MUST store OCR parameters in dedicated 'ocr-extract' row with canonical_model='np-dms-ocr'
- **FR-012**: System MUST make numCtx and maxTokens nullable (OCR does not use these)
- **FR-013**: System MUST snapshot parameters at job dispatch time (not lazy-load during processing)
- **FR-014**: System MUST support dual-model snapshot for jobs that use both OCR and LLM (ocrSnapshotParams + snapshotParams)
- **FR-015**: System MUST require project selection in sandbox tests (no 'default' project allowed)
- **FR-016**: System MUST use selected project/contract context for master data lookup in sandbox tests
- **FR-017**: System MUST integrate with ADR-029 for system prompt management (not duplicate in parameter store)
- **FR-018**: System MUST keep keep_alive parameter out of frozen snapshot (lazy-loaded per ADR-033)
- **FR-019**: System MUST provide "Reset to Production" action to overwrite sandbox draft with current production values
- **FR-020**: System MUST update model names from typhoon2.5-np-dms/typhoon-np-dms-ocr to np-dms-ai/np-dms-ocr across codebase

### Key Entities

- **ai_execution_profiles**: Production parameter store with columns: profile_name, canonical_model, temperature, top_p, max_tokens, num_ctx, repeat_penalty, keep_alive_seconds, is_active. Extended with canonical_model column to distinguish np-dms-ai vs np-dms-ocr.
- **ai_sandbox_profiles**: Sandbox draft store with same structure as ai_execution_profiles. Used for admin iteration before apply. Auto-seeded from production when draft does not exist.
- **ai_audit_logs**: Audit trail for apply operations. Extended with action='APPLY_PROFILE' to track who applied what parameters when.
- **AiJobPayload**: Job payload with snapshotParams (LLM) and ocrSnapshotParams (OCR) for dual-model jobs. Parameters frozen at dispatch time.
- **ai_prompts**: System prompt store per ADR-029. Not modified by this feature (integration only).

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Sandbox test results reflect production behavior with 100% parameter parity (same parameters produce same results in both environments)
- **SC-002**: Admin can complete parameter tuning cycle (test → apply → verify) in under 5 minutes
- **SC-003**: Apply to Production operation completes in under 2 seconds with cache invalidation
- **SC-004**: 100% of apply operations are audited with complete old/new value tracking
- **SC-005**: Zero production jobs are affected by sandbox parameter modifications until apply is executed
- **SC-006**: Both np-dms-ai and np-dms-ocr models can be tuned independently through unified interface
- **SC-007**: Master data context in sandbox tests matches production context for same project/contract
- **SC-008**: Parameter validation rejects 100% of invalid values (e.g., temperature > 1) before database write
- **SC-009**: Idempotency-Key prevents 100% of duplicate apply operations within 5-minute window
- **SC-010**: All model name references updated from typhoon2.5-np-dms/typhoon-np-dms-ocr to np-dms-ai/np-dms-ocr

## Assumptions

- ADR-029 Dynamic Prompt Management is already implemented and operational
- ADR-033 Adaptive OCR Residency is already implemented and manages keep_alive
- Desk-5439 has np-dms-ai and np-dms-ocr models created with canonical names
- Redis cache is operational for ai_execution_profiles caching
- CASL permission system is operational with system.manage_ai action
- Admin users have appropriate permissions to apply parameters to production

## Dependencies

- ADR-029: Dynamic Prompt Management (system prompt integration)
- ADR-033: Adaptive OCR Residency (keep_alive lazy-loading)
- ADR-034: AI Model Change (canonical model names)
- Existing AiPolicyService with getProfileParameters() and Redis cache
- Existing ai_audit_logs table for audit trail

## Out of Scope

- Creating new AI models (models already exist on Desk-5439)
- Changing ADR-029 prompt management system (integration only)
- Modifying ADR-033 residency logic (keep_alive lazy-loading)
- Creating new parameter store in system_settings (using existing ai_execution_profiles)
- Changing snapshot semantics (parameters frozen at dispatch time is retained)
- Modifying sidecar endpoints beyond existing contract (already accepts overrides)
