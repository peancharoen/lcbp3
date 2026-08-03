---
auto_execution_mode: 0
description: Execute OCR & AI Extraction prompt management workflow following ADR-037 3-Step Pipeline (OCR → AI Extract → RAG Prep)
---

# Workflow: speckit.ocr-prompt-management

This workflow orchestrates the **OCR & AI Extraction prompt management** feature implementation, following the 3-step pipeline pattern defined in ADR-037.

## Phase 1: Database & Infrastructure Setup

1. **Database Schema**:
   - Verify `version` column exists in `ai_prompts` table (delta: `2026-06-15-fix-ai-prompts-columns.sql`)
   - Seed default OCR system prompt (delta: `2026-06-17-seed-ocr-system-prompt.sql`)
   - Verify entity has `@VersionColumn()` at `backend/src/modules/ai/prompts/ai-prompts.entity.ts`

2. **Infrastructure Verification**:
   - Verify OCR sidecar is running on Desk-5439 (port 8765)
   - Verify `/embed` endpoint exists in sidecar
   - Verify environment variables: `OCR_SIDECAR_API_KEY`, `OCR_API_URL`

## Phase 2: Foundational Services

1. **Validation Service**:
   - Extend `ai-prompts.service.ts` `create()` to support `ocr_system` (free-form, no required placeholder)
   - Verify `{{ocr_text}}` placeholder validation for `ocr_extraction`
   - Use existing DTOs: `CreateAiPromptDto`, `UpdatePromptNoteDto`, `ContextConfigDto`

2. **Optimistic Locking**:
   - Modify `activate()` in `ai-prompts.service.ts` to accept `expectedVersion`
   - Handle HTTP 409 Conflict when version mismatch occurs
   - Add retry logic with exponential backoff in frontend

## Phase 3: User Story 1 - OCR System Prompt Management

### Backend
- Verify `AiPromptsService.create()` supports `ocr_system` (version auto-increment)
- Verify `getActive(promptType)` returns active ocr_system with Redis cache (60s)
- Verify existing routes: GET `/api/ai/prompts/{promptType}`, POST `/api/ai/prompts/{promptType}`, POST `/api/ai/prompts/{promptType}/{versionNumber}/activate`

### Frontend
- Create `adminAiPromptService` in `frontend/lib/services/admin-ai-prompt.service.ts`
- Implement `getPrompts()`, `createPrompt()`, `activatePrompt()` with optimistic locking
- Create `PromptManagementTabs` component
- Create `OcrPromptTab` component with text editor and version history
- Implement "Save New Version" button with validation
- Handle 409 Conflict error - show refresh dialog

### Sidecar Integration
- Update `/ocr-upload` endpoint in `specs/04-Infrastructure-OPS/04-00-docker-compose/Desk-5439/ocr-sidecar/app.py`:
  - Add parameter: `systemPrompt: Optional[str] = Form(default=None)`
  - Thread `systemPrompt` through `_process_pdf_doc()` → `process_ocr()`
  - Append system prompt to `messages[0]["content"]` (typhoon OCR single-message format)
- Update `sandbox-ocr-engine.service.ts` to fetch active `ocr_system` prompt and send to sidecar

## Phase 4: User Story 2 - AI Extraction Prompt Management

### Backend
- Verify `ocr_extraction` validation in `create()` ({{ocr_text}} required)
- Verify `resolveActive('ocr_extraction', ocrText)` exists
- Verify `ai-batch.processor.ts` uses active `ocr_extraction` prompt

### Frontend
- Create `AiExtractionPromptTab` component
- Add placeholder helper buttons ({{ocr_text}}, {{master_data_context}})
- Show validation error inline if missing required placeholder
- Add template preview with syntax highlighting

## Phase 5: User Story 3 - Separate UI Tabs

### Frontend UI Polish
- Style `PromptManagementTabs` with clear tab indicators
- Add tab icons (OCR: eye/scan icon, AI: brain/robot icon)
- Show active status badge on each tab
- Implement tab state persistence (URL hash or localStorage)
- Add warning badge if no active prompt for a type

## Phase 6: User Story 4 - Full 3-Step Sandbox with RAG Prep

### Backend (RAG Prep Integration)
- Verify `rag_prep_prompt` validates `{{text}}` placeholder
- Verify `SandboxRagPrepDto` exists at `backend/src/modules/ai/dto/sandbox-rag-prep.dto.ts`
- Extend `ai-batch.processor.ts` `sandbox-rag-prep` job handler
- Implement semantic chunking using active `rag_prep_prompt`
- Verify sidecar `/embed` endpoint exists
- Verify POST `/api/ai/admin/sandbox/rag-prep` exists in AiController
- Verify Redis storage for RAG Prep results
- Verify GET sandbox job result endpoint (`/api/ai/admin/sandbox/job/:id`)

### Frontend (3-Step Sandbox UI)
- Create `SandboxStepIndicator` component showing 3 steps with status icons
- Extend `PromptManagementTabs` with "Sandbox" tab containing 3-step workflow
- Create `RagPrepResultPanel` component with chunk list + vector preview
- Implement vector preview display (first 5 dimensions: `[0.234, -0.891, ...]`)
- Add "Run Step 3 (RAG Prep)" button enabled after Step 2 completes
- Display chunk count and embedding status for each chunk
- Add "Activate This Version" button visible after all 3 steps complete successfully

### Integration (Full Pipeline)
- Wire Step 2 output (extracted metadata + text) as Step 3 input
- Implement sequential step execution (Step 1 → Step 2 → Step 3)
- Add pipeline status tracking in Redis

## Phase 7: Testing & Validation

### Error Handling (ADR-007)
- Add user-friendly error messages for validation errors in frontend
- Implement retry logic for 409 Conflict with exponential backoff
- Add Toast notifications for success/error states

### Testing
- Write unit tests for `AiPromptValidationService`
- Write integration test for optimistic locking conflict scenario
- E2E test: Admin creates OCR prompt → activates → runs Sandbox Step 1
- E2E test: Full 3-step pipeline - upload PDF → OCR → Extract → RAG Prep
- E2E test: Vector preview displays correctly with 5 dimensions
- E2E test: Step indicators show correct status for each step

## Usage

```
/speckit.ocr-prompt-management
```

## Dependencies

- **Phase 1**: None (infrastructure setup)
- **Phase 2**: Phase 1
- **Phase 3**: Phase 2
- **Phase 4**: Phase 2 (can run in parallel with Phase 3)
- **Phase 5**: Phase 3 + Phase 4
- **Phase 6**: Phase 3 + Phase 4
- **Phase 7**: Phase 6

## On Error

If any phase fails, stop and report:
- Which phase failed
- The specific task that failed
- Suggested remediation (e.g., "Verify OCR sidecar is running before Phase 3")

## Related ADRs

- **ADR-009**: Database schema changes (SQL deltas, no TypeORM migrations)
- **ADR-016**: Security authentication (RBAC for admin-only endpoints)
- **ADR-023/023A**: AI architecture (BullMQ queues, Ollama isolation)
- **ADR-037**: 3-Step Pipeline (OCR → AI Extract → RAG Prep)
