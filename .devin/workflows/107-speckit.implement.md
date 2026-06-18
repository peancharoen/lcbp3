---
auto_execution_mode: 0
description: Execute the implementation plan by processing and executing all tasks defined in tasks.md
---

# Workflow: speckit.implement

1. **Context Analysis**:
   - The user has provided an input prompt. Treat this as the primary input for the skill.

2. **Load Skill**:
   - Use the `view_file` tool to read the skill file at: `.agents/skills/speckit-implement/SKILL.md`

3. **Execute**:
   - Follow the instructions in the `SKILL.md` exactly.
   - Apply the user's prompt as the input arguments/context for the skill's logic.

4. **On Error**:
   - If `tasks.md` is missing: Run `/speckit.tasks` first
   - If `plan.md` is missing: Run `/speckit.plan` first
   - If `spec.md` is missing: Run `/speckit.specify` first

## OCR-Specific Implementation Considerations

When implementing OCR & AI Extraction prompt management features (ADR-037), handle:

### Sidecar Integration

- **System Prompt Threading**: Append system prompt to `messages[0]["content"]` in sidecar (typhoon OCR single-message format)
- **API Key Authentication**: Send `X-API-Key: $OCR_SIDECAR_API_KEY` header to sidecar endpoints
- **Path Remapping**: Handle backend → sidecar path mapping (e.g., `/app/uploads/temp` → `/mnt/uploads/temp`)
- **Error Handling**: Implement retry logic for sidecar connection failures

### Database Implementation

- **SQL Deltas**: Apply schema changes via SQL deltas per ADR-009 (no TypeORM migrations)
- **Version Column**: Verify `ai_prompts.version` column exists and entity has `@VersionColumn()`
- **Seed Data**: Apply delta for default OCR system prompt (INSERT with `prompt_type='ocr_system'`)

### Service Implementation

- **Optimistic Locking**: Modify `activate()` to accept `expectedVersion` parameter
- **409 Conflict Handling**: Return proper HTTP 409 when version mismatch occurs
- **Prompt Validation**: Extend `create()` to support `ocr_system` (free-form) and `ocr_extraction` ({{ocr_text}} required)
- **Prompt Resolution**: Use `resolveActive()` for template placeholder substitution

### BullMQ Integration

- **Queue Jobs**: Implement handlers for `sandbox-ocr`, `sandbox-extract`, `sandbox-rag-prep`
- **Sequential Execution**: Wire Step 2 output as Step 3 input
- **State Tracking**: Store pipeline status in Redis
- **Error Recovery**: Implement rollback mechanisms for failed pipeline steps

### Frontend Implementation

- **Service Layer**: Create `adminAiPromptService` with optimistic locking support
- **Tab Components**: Implement `PromptManagementTabs`, `OcrPromptTab`, `AiExtractionPromptTab`
- **Version History**: Display version list with activation status
- **Validation UI**: Show inline errors for missing placeholders
- **Vector Preview**: Display chunk list with first 5 dimensions
- **Step Indicators**: Implement 3-step status display (pending/processing/completed/failed)

### Testing Implementation

- **Unit Tests**: Test prompt validation, optimistic locking, version conflict scenarios
- **Integration Tests**: Test full 3-step pipeline end-to-end
- **E2E Tests**: Test admin UI workflows (create prompt → activate → run sandbox)

For specialized OCR workflows, use `/speckit.ocr-prompt-management` instead.
