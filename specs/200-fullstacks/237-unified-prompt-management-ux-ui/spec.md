# Feature Specification: Unified Prompt Management UX/UI

**Feature Branch**: `237-unified-prompt-management-ux-ui`
**Created**: 2026-06-14
**Status**: Draft
**Input**: ADR-037: Unified Prompt Management UX/UI

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Multi-Type Prompt Management (Priority: P1)

Admin users need to manage prompt templates for multiple AI workflow types (OCR extraction, RAG query, RAG preparation, and document classification) through a single unified interface that separates version history, template editing, and context configuration.

**Why this priority**: This is the foundation of the feature - without multi-type support, the system cannot manage the full AI pipeline defined in ADR-035. Admins currently struggle with confusing version history that mixes different prompt types, making it difficult to track which version is active for which workflow.

**Independent Test**: Can be fully tested by creating and activating versions for different prompt types, verifying that version history is correctly separated by type, and confirming that the active version badge displays correctly for each type.

**Acceptance Scenarios**:

1. **Given** admin is on the Prompt Management page, **When** they select "OCR Extraction" from the Prompt Type dropdown, **Then** only OCR extraction prompt versions are displayed in the Version History panel
2. **Given** admin has selected a prompt type, **When** they click on a version in the Version History, **Then** the Prompt Editor displays that version's template and context config
3. **Given** admin is viewing version history, **When** a version is marked as active, **Then** an active badge (✅) is displayed next to that version
4. **Given** admin has edited a prompt template, **When** they click "Save New Version", **Then** a new version is created with incremented version number and the version appears in the history list
5. **Given** admin wants to see all prompt versions across all types, **When** they select "All Types" from the Prompt Type dropdown, **Then** the Version History panel displays all versions grouped by prompt type with type labels

---

### User Story 2 - Context Configuration Management (Priority: P1)

Admin users need to view, edit, save, and apply context configuration (project filter, contract filter, page size, language) for each prompt version to control what data context the AI sees during processing.

**Why this priority**: Context configuration is critical for AI accuracy - without it, admins cannot control which master data (projects, contracts) the AI uses for extraction. This directly impacts the quality of AI-generated metadata.

**Independent Test**: Can be fully tested by editing context config fields, saving a new version, and verifying that the context config is correctly persisted and applied when the version is activated.

**Acceptance Scenarios**:

1. **Given** admin is editing a prompt version, **When** they modify the Project Filter field, **Then** the change is reflected in the Context Config Editor preview
2. **Given** admin has modified context config, **When** they click "Save New Version", **Then** the context config is saved as part of the new version
3. **Given** admin activates a version with specific context config, **Then** production AI jobs use that context config for processing
4. **Given** admin views an existing version, **When** the version has context config, **Then** the Context Config Editor displays the current values

---

### User Story 3 - Three-Step Sandbox Testing (Priority: P1)

Admin users need to test the full AI pipeline (OCR → AI Extract → RAG Prep) in the sandbox to validate prompt versions before activating them to production, ensuring sandbox results match production behavior.

**Why this priority**: Currently sandbox uses a 2-step flow (OCR → Extract) while production uses 3-step (OCR → Extract → RAG Prep), causing testing gaps. Admins cannot fully validate prompts before deployment, leading to production issues.

**Independent Test**: Can be fully tested by uploading a PDF, running all three sandbox steps sequentially, and verifying that each step produces expected outputs (OCR text, extracted metadata, RAG chunks).

**Acceptance Scenarios**:

1. **Given** admin has uploaded a PDF in the sandbox, **When** they click "Run OCR", **Then** the system returns raw OCR text from the OCR sidecar
2. **Given** admin has OCR results, **When** they select a prompt version and click "Run AI Extract", **Then** the system returns structured metadata (JSON) using the selected prompt
3. **Given** admin has extracted metadata, **When** they click "Test RAG Prep" (required), **Then** the system returns semantic chunks and embedding vectors
4. **Given** admin is satisfied with sandbox results, **When** they click "Activate This Version", **Then** the version is activated for production use

---

### User Story 4 - Runtime Parameters vs Context Config Separation (Priority: P2)

Admin users need clear separation between Runtime Parameters (AI model behavior controls like temperature, topP) and Context Config (data context controls like project filter) to avoid confusion about which settings affect what aspect of AI processing.

**Why this priority**: Admins currently confuse these two config types, leading to incorrect settings and unpredictable AI behavior. Clear separation reduces operational errors and improves system reliability.

**Independent Test**: Can be fully tested by verifying that Runtime Parameters are in the Sandbox tab and apply globally to AI execution profiles, while Context Config is in the Prompt Editor panel and applies per prompt version.

**Acceptance Scenarios**:

1. **Given** admin is in the Sandbox tab, **When** they view the Runtime Parameters panel, **Then** they see sliders for Temperature, Top-P, Repeat Penalty, Max Tokens, Ctx Size, Keep-Alive
2. **Given** admin adjusts Runtime Parameters in sandbox, **When** they apply changes to production, **Then** the parameters are saved to ai_execution_profiles (global per profile)
3. **Given** admin is in the Prompt Editor panel, **When** they view the Context Config Editor, **Then** they see fields for Project Filter, Contract Filter, Page Size, Language
4. **Given** admin saves a new prompt version with context config, **When** they activate that version, **Then** the context config is saved to ai_prompts (per version)

---

### Edge Cases

- What happens when admin tries to activate a version without required placeholders (e.g., {{ocr_text}} missing from OCR extraction template)? → **System blocks activation with error message**
- How does system handle concurrent edits when multiple admins are editing the same prompt version? → **Optimistic locking with TypeORM @VersionColumn - second editor gets error**
- What happens when sandbox OCR sidecar is unavailable or returns an error? → **System shows error in toast + disables sandbox actions**
- How does system handle activation of a version when another version is already active? → **System deactivates current version and activates new version in transaction**
- What happens when context config contains invalid references (e.g., project ID that doesn't exist)? → **System validates references and blocks save with error**
- How does system handle very large prompt templates (e.g., >10,000 characters)? → **System accepts but warns admin, validates max length**
- What happens when admin tries to delete the currently active version? → **System blocks deletion with error "Cannot delete active version"**
- How does system handle rollback to a previous version if the new version causes issues in production? → **Admin activates previous version directly (no special rollback action needed)**
- Where are sandbox test results stored? → **Redis with 60-minute TTL (session-based, not persisted to database)**
- How does system handle concurrent activation attempts? → **Database-level locking with SELECT FOR UPDATE**
- How does system handle version history load performance with many versions? → **Redis cache (60s TTL) + pagination (20 versions/page)**
- How does UI handle mobile devices? → **Responsive design: Desktop (2-column 50/50), Tablet (2-column 40/60), Mobile (stack vertical with collapsible Left Panel)**

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: System MUST support 4 prompt types: ocr_extraction, rag_query_prompt, rag_prep_prompt, classification_prompt
- **FR-002**: System MUST separate version history by prompt_type so admins can view versions for each type independently
- **FR-003**: System MUST display an active badge (✅) next to the currently active version for each prompt type
- **FR-004**: System MUST provide a Prompt Type dropdown to switch between different prompt types
- **FR-005**: System MUST provide "All Types" option in Prompt Type dropdown to view all versions grouped by type
- **FR-006**: System MUST provide a Prompt Editor textarea for editing prompt templates with placeholder validation
- **FR-007**: System MUST provide a Context Config Editor form with fields: Project Filter, Contract Filter, Page Size, Language
- **FR-008**: System MUST allow admins to save new versions of prompts with both template and context config
- **FR-009**: System MUST allow admins to activate a specific version for a prompt type
- **FR-010**: System MUST invalidate Redis cache when a version is activated
- **FR-011**: System MUST provide a 3-step sandbox workflow: OCR → AI Extract → RAG Prep (required)
- **FR-012**: System MUST allow admins to upload PDFs for sandbox testing
- **FR-013**: System MUST display sandbox results for each step (OCR text, extracted metadata, RAG chunks)
- **FR-014**: System MUST allow admins to activate a version directly from sandbox results
- **FR-015**: System MUST separate Runtime Parameters (in Sandbox tab) from Context Config (in Prompt Editor panel)
- **FR-016**: System MUST provide Runtime Parameters sliders: Temperature, Top-P, Repeat Penalty, Max Tokens, Ctx Size, Keep-Alive
- **FR-017**: System MUST display Runtime Parameters with label "Runtime Parameters (Global - Applies to All AI Jobs)" to clarify scope
- **FR-018**: System MUST save Runtime Parameters to ai_execution_profiles (global per profile)
- **FR-019**: System MUST save Context Config to ai_prompts (per prompt version)
- **FR-020**: System MUST validate Context Config fields: Project Filter (UUID, validate existence), Contract Filter (UUID, validate existence), Page Size (int, min=1, max=1000, optional), Language (enum: TH/EN/MIXED, default=MIXED, optional)
- **FR-021**: System MUST support responsive design: Desktop (2-column 50/50), Tablet (2-column 40/60), Mobile (stack vertical with collapsible Left Panel)
- **FR-022**: System MUST display errors using layered approach: Toast (primary, Thai), Inline (field-level, Thai), Modal (critical, Thai + English technical details)
- **FR-023**: System MUST validate that OCR extraction templates contain {{ocr_text}} placeholder (required) and {{master_data_context}} (optional)
- **FR-024**: System MUST validate that RAG query prompt templates contain {{user_query}} (required) and {{retrieved_chunks}} (required)
- **FR-025**: System MUST validate that RAG prep prompt templates contain {{document_text}} (required)
- **FR-026**: System MUST validate that classification prompt templates contain {{document_metadata}} (required) and {{document_text}} (optional)
- **FR-027**: System MUST provide manual_note field for version annotations
- **FR-028**: System MUST allow admins to delete non-active versions
- **FR-029**: System MUST use single page layout consistent with ADR-027 AI Admin Console

### Key Entities

- **AiPrompt**: Represents a prompt version with fields: prompt_type, version_number, template, context_config (JSON), is_active, manual_note, created_by, created_at
- **AiExecutionProfile**: Represents runtime parameters with fields: profile_name, temperature, top_p, repeat_penalty, max_tokens, ctx_size, keep_alive
- **SandboxJob**: Represents a sandbox test execution with fields: job_type (ocr, ai-extract, rag-prep), status, result_data, created_at

## Clarifications

### Session 2026-06-14 (Grilling Session)

- Q: Are there critical ambiguities requiring clarification? → A: No - spec is clear and complete. Edge case scenarios have been addressed during grilling session.

### Edge Case Resolutions (from Grilling Session 2026-06-15)

- **Placeholder Validation**: System validates placeholders in both frontend (real-time) and backend (data integrity). Placeholders per type: OCR ({{ocr_text}} required, {{master_data_context}} optional), RAG Query ({{user_query}}, {{retrieved_chunks}} required), RAG Prep ({{document_text}} required), Classification ({{document_metadata}} required, {{document_text}} optional)
- **Concurrent Edits**: Optimistic locking with TypeORM @VersionColumn - second editor gets error "Version was modified by another user, please reload"
- **Context Config Invalid References**: Frontend validates dropdown options (valid only), backend validates UUID existence before save (block if invalid)
- **Delete Active Version**: Block deletion with error "Cannot delete active version. Please activate another version first."
- **Rollback**: No special action needed - admin activates previous version directly (activation = rollback)
- **Sandbox Results Persistence**: Redis with 60-minute TTL (session-based, not persisted to database)
- **Concurrent Activation**: Database-level locking with SELECT FOR UPDATE (transactional deactivation/activation)
- **Version History Performance**: Redis cache (60s TTL) + pagination (20 versions/page, infinite scroll)
- **Responsive Design**: Desktop (2-column 50/50), Tablet (2-column 40/60), Mobile (stack vertical with collapsible Left Panel)
- **Error Handling**: Layered approach - Toast (primary, Thai), Inline (field-level, Thai), Modal (critical, Thai + English technical details)
- **Context Config Field Validation**: Project/Contract (UUID, validate existence), Page Size (int, min=1, max=1000, optional), Language (enum: TH/EN/MIXED, default=MIXED, optional)

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Admins can create and activate a new prompt version in under 2 minutes
- **SC-002**: Sandbox test results are returned within 30 seconds for OCR step and 60 seconds for AI Extract step
- **SC-003**: 95% of admins successfully complete the full 3-step sandbox workflow on first attempt
- **SC-004**: Context config changes are applied to production jobs within 5 seconds of activation
- **SC-005**: Version history loads in under 1 second regardless of number of versions
- **SC-006**: Runtime parameter changes are applied to sandbox tests immediately without page refresh
- **SC-007**: Support tickets related to prompt management confusion are reduced by 70%
