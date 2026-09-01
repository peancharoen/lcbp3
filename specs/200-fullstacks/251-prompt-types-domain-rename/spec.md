// File: specs/200-fullstacks/251-prompt-types-domain-rename/spec.md
// Change Log:
// - 2026-09-01: Initial specification — domain term alignment + AI prompt types master table

# Feature Specification: Prompt Types Master Table + Domain Term Rename

**Feature Branch**: `251-prompt-types-domain-rename`
**Created**: 2026-09-01
**Status**: Draft
**Category**: 200-fullstacks
**Input**: User description: "Rename `category` → `correspondenceType` across the migration review feature (align domain glossary — the system has no 'category' table, it uses `correspondence_types.typeCode`), create a new `ai_prompt_types` master table so the AI Admin Console can manage all prompt types dynamically via dropdown instead of a hardcoded list, and unify the prompt management into a single page (currently two separate pages for OCR System Prompt and AI Extraction Prompt cause confusion). The `ai_prompt_types` table should have at minimum: prompt_type name, display name, description, and other metadata. Frontend CRUD should use a dropdown sourced from this table."

## Clarifications

### Session 2026-09-01

- Q: Should the DB column `migration_review_queue.ai_suggested_category` be physically renamed to `ai_suggested_correspondence_type`, or only rename the application-level field while keeping the DB column name? → A: Physical rename — the DB column will be renamed via SQL delta (`ALTER TABLE ... CHANGE COLUMN`), accepting the migration risk in exchange for full naming consistency across all layers.
- Q: Should the two existing admin pages (`/admin/ai/prompt-management` and `/admin/ai/prompts`) be merged into one, or should one be removed and the other enhanced? → A: Merge into a single page with dropdown-based prompt type selection (user explicitly requested "หน้าเดียว ไม่ต้องมี 2 หน้า").
- Q: Should `ai_prompts.prompt_type` become a real foreign key to `ai_prompt_types`, or remain a soft (application-validated) reference? → A: Real FK — `ai_prompts.prompt_type` references `ai_prompt_types.prompt_type` with a DB-level foreign key constraint. Seed data (FR-002) must be inserted before the FK constraint is added.
- Q: What should happen when a user navigates to the old `/admin/ai/prompt-management` or `/admin/ai/prompts` URLs after the merge? → A: Redirect both old URLs to the new unified page (HTTP 308 permanent redirect) — รักษา bookmark เดิม, สื่อสารให้ผู้ใช้ทราบว่าหน้าถูกย้ายถาวร.
- Q: สิทธิ์ RBAC สำหรับการ CRUD บน `ai_prompt_types` ควรเป็นอย่างไร? → A: แยกระดับ — admin ทั่วไปจัดการ `ai_prompts` (เนื้อหา prompt) ได้ตามเดิม แต่ `ai_prompt_types` (create/delete) ต้องการสิทธิ์ super-admin เพราะกระทบ runtime ทั้งระบบ (สอดคล้อง ADR-016 RBAC).
- Q: เมื่อ runtime เรียก prompt_type ที่ไม่มีใน `ai_prompt_types` ระบบควรทำอย่างไร? → A: Throw `BusinessException` พร้อมข้อความชัดเจน (fail fast, ไม่ fallback) — สอดคล้อง ADR-007 ที่ให้ business error มี user message ชัดเจน ป้องกันระบบใช้ prompt ที่ admin ตั้งใจ deactivate ไปแล้วโดยไม่รู้ตัว.
- Q: จะ deploy การเปลี่ยนชื่อนี้อย่างไรเพื่อไม่ให้เกิด downtime หรือ contract mismatch? → A: Atomic deploy — backend+frontend+DB schema delta ใน release เดียว ไม่มีช่วงเปลี่ยนผ่าน (LCBP3-DMS deploy ผ่าน Docker Compose ที่ rebuild ทั้ง stack พร้อมกัน จึงไม่มีช่องโหว่ contract mismatch).

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Admin manages all AI prompt types from a single page (Priority: P1)

An AI admin opens the AI Admin Console to create, edit, activate, or delete prompt templates. Currently, the admin must navigate between two separate pages and can only manage 5 hardcoded prompt types — but the system actually uses 7 prompt types (`migration_compare` and `rag_chunking` are invisible to the UI). The admin needs a single unified page where a dropdown (sourced from a new `ai_prompt_types` master table) lets them select any prompt type and manage its versions, templates, context configs, and sandbox testing.

**Why this priority**: This is the highest-leverage change — it eliminates the confusion of two pages, makes all prompt types manageable (closing a governance gap where 2 active prompt types are invisible to CRUD), and establishes the `ai_prompt_types` master table that the dropdown depends on. Without this, the rename in Story 2 has no clean place to land the renamed prompt placeholders.

**Independent Test**: Can be fully tested by opening the unified prompt management page, confirming the dropdown lists all prompt types from the master table (including previously-hidden `migration_compare` and `rag_chunking`), creating/activating a prompt for any type, and confirming the old two-page layout no longer exists.

**Acceptance Scenarios**:

1. **Given** the admin opens the AI prompt management area, **When** the page loads, **Then** a single unified page is shown with a dropdown of all prompt types sourced from the `ai_prompt_types` master table.
2. **Given** the admin selects a prompt type from the dropdown, **When** they view the version list, **Then** all versions for that type are shown with activate/delete/edit options — including `migration_compare` and `rag_chunking` which were previously invisible.
3. **Given** the admin creates a new prompt version for any type, **When** they save it, **Then** the backend validates placeholders against the expected schema for that prompt type (validation rules sourced from `ai_prompt_types` metadata, not a hardcoded switch statement).
4. **Given** a new prompt type needs to be added to the system, **When** an admin inserts a row into `ai_prompt_types`, **Then** it automatically appears in the dropdown without any frontend code changes.

---

### User Story 2 - Domain term "Correspondence Type" replaces "Category" across the migration review feature (Priority: P2)

The migration review feature uses the term "category" throughout (DB column, TypeScript fields, DTOs, frontend types, UI labels, i18n keys, AI prompt placeholders) to refer to what the domain glossary calls "Correspondence Type" (`correspondence_types.typeCode`). This causes confusion because the system has no "category" table — the actual master data is `correspondence_types`. All occurrences of `category` in the migration review feature should be renamed to `correspondenceType` (or `correspondence_type` in DB/snake_case contexts) to align with the domain glossary.

**Why this priority**: Builds on Story 1 by landing the rename after the prompt management infrastructure is unified. The rename itself is mechanical but wide-reaching (DB column, backend, frontend, specs, ADR-050, prompt template). Doing it after Story 1 means the prompt template's `{{allowed_categories}}` placeholder can be renamed to `{{allowed_correspondence_types}}` in the same pass as the `ai_prompt_types` table creation.

**Independent Test**: Can be fully tested by grepping the entire codebase for `category` in migration-review-related files and confirming zero remaining occurrences (excluding unrelated uses like `system_settings.category`), plus confirming the migration review UI still works end-to-end with the renamed field.

**Acceptance Scenarios**:

1. **Given** the migration review queue detail page, **When** the reviewer sees the document type field, **Then** the label says "Correspondence Type" (not "Category") and the dropdown is sourced from `correspondence_types`.
2. **Given** the AI extraction output contract, **When** the LLM returns metadata, **Then** the JSON field is named `correspondenceType` (not `category`) and the prompt placeholder is `{{allowed_correspondence_types}}` (not `{{allowed_categories}}`).
3. **Given** the commit DTO, **When** the reviewer submits a review, **Then** the field is named `correspondenceType` in the request payload and the backend validates it against `correspondence_types.typeCode`.
4. **Given** the per-field confidence and commit-gate system, **When** a field is flagged for low confidence, **Then** the field name is `correspondenceType` (not `category`) in `unresolvedFields`, `fieldAcknowledgments`, and `fieldResolutions`.

---

### User Story 3 - AI prompt templates use consistent domain terminology (Priority: P3)

The `ocr_extraction` prompt template (and its ADR-050 §9 source) currently uses `category` / `{{allowed_categories}}` which contradicts the domain glossary. After Story 2 renames the application fields, the prompt template must also be updated to use `correspondenceType` / `{{allowed_correspondence_types}}` so the LLM output JSON keys match the backend's expected field names. The `ocr_system` prompt (step 1, np-dms-ocr) must remain unchanged — it does not produce metadata, only raw text.

**Why this priority**: Completes the rename by aligning the AI prompt layer. Without this, the LLM would output `category` but the backend would expect `correspondenceType`, requiring a mapping layer that shouldn't exist. This story depends on Story 1 (prompt management infrastructure) and Story 2 (application rename).

**Independent Test**: Can be fully tested by opening the `ocr_extraction` prompt template in the unified prompt management page, confirming the placeholder is `{{allowed_correspondence_types}}`, running a sandbox extraction, and confirming the LLM output JSON contains `correspondenceType` (not `category`).

**Acceptance Scenarios**:

1. **Given** the `ocr_extraction` prompt template, **When** the admin views it in the unified prompt management page, **Then** the placeholder is `{{allowed_correspondence_types}}` (not `{{allowed_categories}}`) and the output schema shows `correspondenceType` (not `category`).
2. **Given** the `ocr_system` prompt template, **When** the admin views it, **Then** it remains unchanged (no `category` or `correspondenceType` references — it only produces raw OCR text).
3. **Given** a sandbox extraction run, **When** the LLM produces output, **Then** the JSON contains `correspondenceType` and the backend validates it without a mapping layer.

---

### Edge Cases

- What happens when an admin deletes a prompt type from `ai_prompt_types` that still has versions in `ai_prompts`? The DB-level foreign key (`ON DELETE RESTRICT`) blocks the deletion; the application-level check returns a clear error message listing the referencing prompt versions before the DB constraint is hit.
- What happens to existing `ai_prompts` rows when `ai_prompt_types` is first created? The seed data must cover all 7 known prompt types (`ocr_system`, `ocr_extraction`, `rag_prep_prompt`, `rag_query_prompt`, `classification_prompt`, `migration_compare`, `rag_chunking`) so no existing prompt becomes orphaned.
- What happens to the `ai_suggested_category` DB column rename? Existing data must be preserved — the column rename is metadata-only (no data transformation), และต้อง deploy เป็น atomic release พร้อม backend+frontend (FR-015) จึงไม่ต้อง handle ทั้ง old และ new column name ในช่วงเปลี่ยนผ่าน.
- What happens when the LLM outputs `category` (old key) instead of `correspondenceType` (new key) during the transition? The schema validator must reject this and set `aiFailed=true` with `aiFailureReason='SCHEMA_VALIDATION_FAILED'` — no silent backward-compat mapping.
- What happens to the `ocr_extraction` prompt that is currently active in production? The rename of `{{allowed_categories}}` → `{{allowed_correspondence_types}}` requires activating a new prompt version — the old version must remain available until the new one is activated.
- What happens when runtime เรียก `aiPromptsService.getActive(promptType)` แล้ว type นั้นไม่มีใน `ai_prompt_types` (เช่น ระหว่าง deploy ใหม่ที่ยังไม่ทัน seed)? ระบบ throw `BusinessException` ทันที (fail fast) — ห้าม fallback ไปใช้ hardcoded prompt เพราะอาจทำให้ระบบใช้ prompt ที่ admin ตั้งใจ deactivate ไปแล้วโดยไม่รู้ตัว.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: System MUST have a `ai_prompt_types` master table that stores metadata about each prompt type (prompt_type name, display name, description, expected placeholders, whether the type is system-managed or admin-created). The `ai_prompts.prompt_type` column MUST reference `ai_prompt_types.prompt_type` via a real DB-level foreign key constraint (seed data must be inserted before the FK is added).
- **FR-002**: System MUST seed `ai_prompt_types` with all 7 known prompt types on first deployment so no existing `ai_prompts` row becomes orphaned.
- **FR-003**: System MUST provide a single unified AI prompt management page where the admin selects a prompt type from a dropdown sourced from `ai_prompt_types` and manages versions, templates, context configs, and sandbox testing for that type.
- **FR-004**: System MUST remove the old two-page prompt management layout (`/admin/ai/prompt-management` and `/admin/ai/prompts` as separate pages) and replace it with the single unified page. Both old URLs MUST redirect to the new unified page via HTTP 308 permanent redirect เพื่อรักษา bookmark เดิมและสื่อสารว่าหน้าถูกย้ายถาวร.
- **FR-005**: System MUST make all prompt types manageable from the UI, including `migration_compare` and `rag_chunking` which were previously invisible due to a hardcoded type list.
- **FR-006**: System MUST validate prompt template placeholders against the expected schema for the selected prompt type, using metadata from `ai_prompt_types` instead of a hardcoded switch statement in the backend.
- **FR-007**: System MUST rename the `category` field to `correspondenceType` across the entire migration review feature: DB column (`ai_suggested_category` → `ai_suggested_correspondence_type`), entity, DTOs, TypeScript types, frontend types, UI labels, i18n keys, and commit-gate field names.
- **FR-008**: System MUST rename the AI extraction prompt placeholder `{{allowed_categories}}` → `{{allowed_correspondence_types}}` and the output JSON key `metadata.category` → `metadata.correspondenceType` in the `ocr_extraction` prompt template.
- **FR-009**: System MUST NOT modify the `ocr_system` prompt template (step 1, np-dms-ocr) — it produces only raw OCR text and has no metadata fields.
- **FR-010**: System MUST reject LLM output that uses the old `category` JSON key after the rename, setting `aiFailed=true` with `aiFailureReason='SCHEMA_VALIDATION_FAILED'` — no silent backward-compat mapping.
- **FR-011**: System MUST update ADR-050 §9 and all related spec documents (`spec.md`, `plan.md`, `tasks.md`, `data-model.md`, `contracts/`, `prompts/ocr_extraction.md`) to reflect the renamed field and placeholder.
- **FR-012**: System MUST prevent deletion of an `ai_prompt_types` row if `ai_prompts` versions reference that type — enforced by the DB-level foreign key constraint (`ON DELETE RESTRICT`) plus an application-level check that returns a clear error message before attempting the delete.
- **FR-013**: System MUST enforce RBAC แยกระดับสำหรับ `ai_prompt_types` (สอดคล้อง ADR-016): admin ทั่วไปที่มีสิทธิ์จัดการ prompt สามารถอ่าน `ai_prompt_types` และจัดการ `ai_prompts` (เนื้อหา prompt) ได้ตามเดิม แต่การ create/delete `ai_prompt_types` ต้องการสิทธิ์ super-admin เพราะกระทบ runtime ทั้งระบบ (เช่น ลบ `ocr_extraction` ทิ้งจะทำให้ AI pipeline พัง).
- **FR-014**: เมื่อ runtime เรียก `aiPromptsService.getActive(promptType)` แล้ว `promptType` นั้นไม่มีใน `ai_prompt_types` ระบบ MUST throw `BusinessException` พร้อมข้อความชัดเจน (เช่น "prompt_type X ไม่มีในระบบ ติดต่อ super-admin") — fail fast, ห้าม fallback ไปใช้ hardcoded prompt (สอดคล้อง ADR-007).
- **FR-015**: การเปลี่ยนชื่อ `category` → `correspondenceType` MUST deploy เป็น atomic release — backend+frontend+DB schema delta ใน release เดียว ไม่มี dual-accept หรือช่วงเปลี่ยนผ่าน (LCBP3-DMS deploy ผ่าน Docker Compose ที่ rebuild ทั้ง stack พร้อมกัน จึงไม่มีช่องโหว่ contract mismatch).

### Key Entities _(include if feature involves data)_

- **AI Prompt Type**: A master record describing a prompt type (e.g., `ocr_system`, `ocr_extraction`, `migration_compare`), its display name, description, expected placeholders, and whether it is system-managed or admin-created. Referenced by `ai_prompts.prompt_type` via a real DB-level foreign key constraint — the seed data (FR-002) must be inserted before the FK constraint is added in the same SQL delta file.
- **AI Prompt**: An existing versioned prompt template. Its `prompt_type` column now references the `ai_prompt_types` master table. No schema change to the template/version/activation mechanism — only the type validation source changes from hardcoded to master-table-driven.
- **Migration Review Queue Item**: The `ai_suggested_category` column is renamed to `ai_suggested_correspondence_type`. The `details` JSON field `metadata.category` is renamed to `metadata.correspondenceType`. The `metadata.confidence.category` is renamed to `metadata.confidence.correspondenceType`. The `fieldResolutions.category` is renamed to `fieldResolutions.correspondenceType`.
- **Commit Migration Review DTO**: The `category` field is renamed to `correspondenceType`. The `fieldAcknowledgments` array value `'category'` is renamed to `'correspondenceType'`. The `ACKNOWLEDGEABLE_FIELDS` constant is updated.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: 100% of AI prompt types used at runtime are manageable from the unified admin UI (currently 5/7 = 71%).
- **SC-002**: 0% of admin users need to navigate between multiple pages to manage prompts (currently 2 pages, target 1 page).
- **SC-003**: 0 occurrences of the term `category` (referring to correspondence type) remain in migration-review-related source files after the rename (excluding unrelated uses like `system_settings.category`).
- **SC-004**: 100% of `ai_prompt_types` rows are seedable from a single SQL delta file, covering all known prompt types.
- **SC-005**: 0 breaking changes to the `ocr_system` prompt or OCR sidecar contract (confirmed unchanged).
- **SC-006**: 100% of existing `ai_prompts` data remains valid after the `ai_prompt_types` table creation (no orphaned prompt types).
