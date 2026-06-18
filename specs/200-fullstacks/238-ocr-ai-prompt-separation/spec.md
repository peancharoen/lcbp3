# Feature Specification: OCR & AI Extraction Prompt Management

**Feature Branch**: `[238-ocr-ai-prompt-separation]`
**Created**: 2026-06-17
**Status**: Draft
**Input**: User description: "แยกระหว่าง OCR prompt และ AI prompt ให้ชัดเจน แต่ทั้งคู่ต้องมีแสดงให้แก้ไขได้ ตาม ADR-037"

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Manage OCR System Prompt (Priority: P1)

As an AI Admin, I want to view and edit the OCR system prompt that is sent to the np-dms-ocr model, so that I can customize how the Vision Model extracts text from PDF documents.

**Why this priority**: OCR is the first step in the document processing pipeline. The system prompt controls how the Vision Model interprets and extracts text from images. Without the ability to edit this prompt, admins cannot fine-tune OCR quality for different document types.

**Independent Test**: Can be fully tested by accessing the AI Admin Console, navigating to the OCR Prompt tab, editing the system prompt, and verifying the updated prompt is sent to the Ollama API in the payload.

**Acceptance Scenarios**:

1. **Given** I am on the AI Admin Console, **When** I click on the "OCR Prompt" tab, **Then** I see the current active OCR system prompt displayed in an editable text area.

2. **Given** I have edited the OCR system prompt, **When** I click "Save New Version", **Then** a new version is created in the ai_prompts table with prompt_type='ocr_system'.

3. **Given** I have saved a new OCR system prompt version, **When** I run Step 1 (OCR) in the Sandbox, **Then** the system prompt is included in the payload sent to the np-dms-ocr model via the sidecar.

---

### User Story 2 - Manage AI Extraction Prompt (Priority: P1)

As an AI Admin, I want to view and edit the AI Extraction prompt that processes OCR text and extracts structured metadata, so that I can customize the metadata extraction logic.

**Why this priority**: This is the second step in the pipeline. The AI Extraction prompt contains instructions for extracting metadata (project, correspondence type, discipline, etc.) from OCR text. This is critical for document classification and routing.

**Independent Test**: Can be fully tested by accessing the AI Admin Console, navigating to the AI Extraction Prompt tab, editing the template with {{ocr_text}} and {{master_data_context}} placeholders, and verifying the extracted metadata structure.

**Acceptance Scenarios**:

1. **Given** I am on the AI Admin Console, **When** I click on the "AI Extraction" tab, **Then** I see the current active extraction prompt template displayed with {{ocr_text}} and {{master_data_context}} placeholders.

2. **Given** I have edited the AI Extraction prompt template, **When** I click "Save New Version", **Then** a new version is created in the ai_prompts table with prompt_type='ocr_extraction'.

3. **Given** I have saved a new AI Extraction prompt version, **When** I run Step 2 (AI Extract) in the Sandbox with OCR text available, **Then** the extraction prompt is used to process the text and return structured JSON metadata.

---

### User Story 3 - Separate Prompt Management UI (Priority: P2)

As an AI Admin, I want to see two separate tabs for OCR Prompt and AI Extraction Prompt in the Admin Console, so that I don't confuse the two different types of prompts.

**Why this priority**: Clear separation prevents accidental edits to the wrong prompt type. OCR prompt is a system prompt for Vision Model, while AI Extraction prompt is a template with placeholders for the LLM.

**Independent Test**: Can be fully tested by verifying the UI has two distinct tabs with clear labels, different content, and separate version histories.

**Acceptance Scenarios**:

1. **Given** I am on the AI Admin Console Prompt Management page, **When** the page loads, **Then** I see two tabs: "OCR System Prompt" and "AI Extraction Prompt" with clear visual distinction.

2. **Given** I have active versions of both prompt types, **When** I switch between tabs, **Then** each tab shows only its own version history and active prompt content.

---

### User Story 4 - Full 3-Step Sandbox with RAG Prep (Priority: P1)

As an AI Admin, I want to test the complete AI pipeline (OCR → AI Extract → RAG Prep) in the Sandbox with vector preview, so that I can validate the entire workflow before deploying to production.

**Why this priority**: This is the complete ADR-037 pipeline. Without Step 3 (RAG Prep), admins cannot verify that document chunking and embedding work correctly. The vector preview allows admins to confirm embeddings are generated successfully.

**Independent Test**: Can be fully tested by uploading a PDF, running all 3 steps sequentially, and verifying each step's output including RAG chunk vectors.

**Acceptance Scenarios**:

1. **Given** I have completed Step 2 (AI Extract) in the Sandbox, **When** I click "Run RAG Prep" (Step 3), **Then** the system processes the extracted text into semantic chunks and generates embeddings.

2. **Given** RAG Prep has completed, **When** I view the results, **Then** I see a list of chunks with their text preview and vector preview (first 5 dimensions shown, e.g., `[0.234, -0.891, 0.445, 0.123, -0.667]...`).

3. **Given** I am viewing the 3-Step Sandbox results, **When** I look at the flow display, **Then** I see all 3 steps: OCR → AI Extract → RAG Prep with status indicators for each step.

4. **Given** I have successfully completed all 3 steps, **When** I click "Activate This Version", **Then** the system activates the prompt version for production use.

---

### Edge Cases

- **No active OCR prompt**: System uses hardcoded default minimal prompt and displays warning in UI. OCR job still runs successfully.
- **Validation errors in templates**: System validates required placeholder `{{ocr_text}}` before save and rejects with clear error message if missing. `{{master_data_context}}` is optional - system does NOT block save if absent (backend injects empty string if missing at runtime).
- **Empty/invalid system prompt from sidecar**: Sidecar rejects request with 400 error if system prompt is empty or exceeds max length; backend displays user-friendly error.
- **Concurrent edits by multiple admins**: System uses optimistic locking (version/timestamp). User attempting to save stale version receives conflict notification and must refresh before saving.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: System MUST support a new prompt_type 'ocr_system' in the ai_prompts table for storing OCR system prompts.

- **FR-002**: System MUST support the existing prompt_type 'ocr_extraction' for AI Extraction prompts with required `{{ocr_text}}` placeholder and optional `{{master_data_context}}` placeholder.

- **FR-003**: The OCR sidecar (app.py) MUST accept a 'systemPrompt' parameter in the /ocr-upload endpoint and include it in the messages payload sent to Ollama.

- **FR-004**: Backend MUST fetch the active 'ocr_system' prompt from ai_prompts and send it to the sidecar when processing OCR jobs.

- **FR-005**: Backend MUST fetch the active 'ocr_extraction' prompt from ai_prompts and use it for AI metadata extraction jobs.

- **FR-006**: Frontend MUST display two separate tabs in the AI Admin Console: "OCR System Prompt" and "AI Extraction Prompt".

- **FR-007**: Each tab MUST show its own version history, active prompt content, and editing interface.

- **FR-008**: Admin MUST be able to save new versions and activate specific versions for each prompt type independently.

- **FR-009**: Sandbox Step 1 (OCR) MUST use the active OCR system prompt when sending requests to the sidecar.

- **FR-010**: Sandbox Step 2 (AI Extract) MUST use the active AI Extraction prompt when processing OCR results.

- **FR-011**: Sandbox MUST support Step 3 (RAG Prep) that processes extracted text into semantic chunks and generates embeddings.

- **FR-012**: RAG Prep step MUST display vector preview showing first 5 dimensions of each chunk's embedding vector.

- **FR-013**: Sandbox UI MUST display all 3 steps (OCR → AI Extract → RAG Prep) with status indicators showing pass/fail/pending for each step.

- **FR-014**: System MUST support `rag_prep_prompt` type in `ai_prompts` table for storing RAG preparation prompts (used in Step 3).

### Key Entities

- **AiPrompt**: Stores prompt templates with versioning and activation. Key attributes: prompt_type, version_number, template, context_config, is_active, created_by.

- **OcrPrompt**: A specific type of AiPrompt with prompt_type='ocr_system'. Contains system instructions for the Vision Model (np-dms-ocr).

- **ExtractionPrompt**: A specific type of AiPrompt with prompt_type='ocr_extraction'. Contains template with {{ocr_text}} and {{master_data_context}} placeholders for metadata extraction.

- **RagPrepPrompt**: A specific type of AiPrompt with prompt_type='rag_prep_prompt'. Contains template with `{{text}}` placeholder for semantic chunking and RAG preparation.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Admins can view and edit OCR system prompt independently from AI Extraction prompt within 2 clicks from the AI Admin Console.

- **SC-002**: OCR system prompt changes take effect immediately for new OCR jobs (testable via Sandbox Step 1).

- **SC-003**: AI Extraction prompt changes take effect immediately for new extraction jobs (testable via Sandbox Step 2).

- **SC-004**: Zero confusion between OCR prompt and AI Extraction prompt - measured by no support tickets about "wrong prompt edited" within 30 days of deployment.

- **SC-005**: Both prompt types support versioning with ability to rollback to previous versions within 30 seconds.

- **SC-006**: RAG Prep step completes within 60 seconds and displays chunk text + vector preview (5 dimensions) for each chunk.

- **SC-007**: Full 3-step pipeline (OCR → AI Extract → RAG Prep) can be tested end-to-end in Sandbox with each step showing success/fail status.

## Clarifications

### Session 2026-06-17

- Q: Fallback behavior กรณีไม่มี active OCR prompt ใน database → A: ใช้ hardcoded default prompt ที่มากับระบบ (minimal fallback) แล้วแสดง warning ใน UI ว่าใช้ default
- Q: การจัดการ concurrent edits โดย multiple admins → A: ใช้ optimistic locking (version/timestamp) — คนที่ save ทีหลังได้รับแจ้งว่ามีการแก้ไขใหม่กว่าและต้อง refresh ก่อน save
- Q: `{{master_data_context}}` จำเป็นหรือไม่ → A: Optional - ไม่ต้องมีก็ save ได้ ถ้าไม่มี backend จะ inject empty string ให้เอง

## Assumptions

- The typhoon_ocr library from SCB10X (PyPI) will continue to be used for message preparation. **ยืนยันแล้ว**: system prompt จะถูก inject โดย append เป็น text item เข้า `messages[0]["content"]` (user message เดียวที่ typhoon_ocr สร้าง) — pattern เดียวกับ DMS-tags injection ที่ app.py ทำงานได้จริงอยู่แล้ว — **ไม่** ใช้ separate `{"role":"system"}` message (typhoon OCR เป็น single-message format).

- The existing ai_prompts table schema already supports the required fields (prompt_type, version_number, template, etc.) from ADR-029 and ADR-037.

- Sidecar will gracefully handle cases where system prompt is not provided (fallback to minimal default).

- **Full Pipeline**: This feature (238) implements the complete ADR-037 3-Step Pipeline: Step 1 (OCR) → Step 2 (AI Extract) → Step 3 (RAG Prep with vector preview).
