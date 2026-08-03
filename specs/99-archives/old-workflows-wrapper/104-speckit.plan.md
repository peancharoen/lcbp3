---
auto_execution_mode: 0
description: Execute the implementation planning workflow using the plan template to generate design artifacts.
---

# Workflow: speckit.plan

1. **Context Analysis**:
   - The user has provided an input prompt. Treat this as the primary input for the skill.

2. **Load Skill**:
   - Use the `view_file` tool to read the skill file at: `.agents/skills/speckit-plan/SKILL.md`

3. **Execute**:
   - Follow the instructions in the `SKILL.md` exactly.
   - Apply the user's prompt as the input arguments/context for the skill's logic.

4. **On Error**:
   - If `spec.md` is missing: Run `/speckit.specify` first to create the feature specification

## OCR-Specific Planning Considerations

When planning OCR & AI Extraction prompt management features (ADR-037), include:

### Infrastructure Planning

- **OCR Sidecar**: Verify Desk-5439 sidecar availability (port 8765)
- **Endpoints**: Plan for `/ocr-upload`, `/embed`, and `/normalize` endpoints
- **Environment Variables**: Document required env vars (OCR_SIDECAR_API_KEY, OCR_API_URL)
- **Network**: Verify VLAN 10 connectivity between backend and Desk-5439

### Database Planning

- **Schema Changes**: Use SQL deltas per ADR-009 (no TypeORM migrations)
- **Version Column**: Verify `ai_prompts` table has `version` column
- **Entity Mapping**: Ensure `@VersionColumn()` in `ai-prompts.entity.ts`
- **Seed Data**: Plan for default OCR system prompt seed

### Service Architecture

- **Validation Service**: Extend existing `ai-prompts.service.ts` for prompt validation
- **Optimistic Locking**: Plan version conflict handling (409 Conflict responses)
- **Prompt Resolution**: Design `resolveActive()` for template placeholder substitution
- **BullMQ Integration**: Plan queue jobs for OCR, extraction, and RAG prep

### 3-Step Pipeline Design

- **Sequential Execution**: Design OCR → AI Extract → RAG Prep flow
- **State Tracking**: Plan Redis-based pipeline status tracking
- **Input/Output Contract**: Define data flow between pipeline steps
- **Error Recovery**: Design rollback and retry mechanisms

### Frontend Planning

- **Tab Structure**: Plan separate tabs for OCR, AI Extraction, and Sandbox
- **Version History**: Design version list display and activation UI
- **Validation UI**: Plan inline validation error display
- **Vector Preview**: Design chunk list and vector dimension display (5 dims)

For specialized OCR workflows, use `/speckit.ocr-prompt-management` instead.
