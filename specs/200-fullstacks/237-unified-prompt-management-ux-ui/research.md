# Research: Unified Prompt Management UX/UI

**Feature**: 237-unified-prompt-management-ux-ui  
**Date**: 2026-06-14  
**Purpose**: Resolve technical unknowns and document decisions for implementation

## Research Topics

### 1. Context Config Schema Structure

**Question**: What JSON structure should context_config use in ai_prompts table?

**Decision**: Use flat JSON object with these fields:
```json
{
  "filter": {
    "projectId": "uuid|null",
    "contractId": "uuid|null"
  },
  "pageSize": 3,
  "language": "th",
  "outputLanguage": "th"
}
```

**Rationale**: 
- Follows ADR-030 context-aware prompt template structure
- Matches existing OCR extraction prompt context_config from ADR-029
- Flat structure simplifies validation and UI binding
- Filter object allows null values for "all projects/contracts"

**Alternatives Considered**:
- Nested structure with separate sections (rejected: too complex for simple use case)
- Array-based filter (rejected: single project/contract filter is sufficient)

---

### 2. Runtime Parameters Storage

**Question**: Should runtime parameters be stored in a new ai_execution_profiles table or as part of ai_prompts?

**Decision**: Store in new ai_execution_profiles table (global per profile, not per prompt version)

**Rationale**:
- Runtime parameters control AI model behavior (temperature, topP) which applies globally across all prompt types
- Separates concerns: Runtime Parameters = AI behavior, Context Config = data context
- Allows admins to test different parameter sets in sandbox without affecting prompts
- Follows ADR-036 unified AI model architecture

**Alternatives Considered**:
- Store in ai_prompts per version (rejected: would duplicate same parameters across versions)
- Store in Redis only (rejected: no persistence, lost on restart)

---

### 3. Sandbox RAG Prep Implementation

**Question**: How should RAG Prep sandbox endpoint integrate with existing infrastructure?

**Decision**: 
- Create new BullMQ job type: "sandbox-rag-prep" in ai-realtime queue
- Reuse existing OllamaService for semantic chunking (typhoon2.5-np-dms)
- Reuse existing embedding service (BGE-M3 via sidecar)
- Return chunks + vectors in sandbox result for display

**Rationale**:
- Consistent with existing sandbox OCR and AI Extract patterns
- Leverages existing ADR-023A infrastructure (2-model stack, BullMQ queues)
- Allows testing of full production pipeline before deployment
- Follows ADR-035 AI pipeline flow architecture

**Alternatives Considered**:
- Inline processing without BullMQ (rejected: blocks request thread, no retry)
- Separate queue for RAG Prep (rejected: ai-realtime queue already handles sandbox jobs)

---

### 4. Context Config Validation

**Question**: How should invalid context config references (e.g., non-existent project ID) be handled?

**Decision**: 
- Validate project/contract IDs against database on save
- Allow null values (meaning "all projects/contracts")
- Return validation error with user-friendly message if ID doesn't exist
- Do not block activation if context config is valid at save time

**Rationale**:
- Prevents orphaned references that would cause production failures
- User-friendly error messages align with ADR-007 error handling
- Null values are valid for "unfiltered" context
- Validation at save time is sufficient (no need to re-validate on activation)

**Alternatives Considered**:
- Allow invalid references and handle at runtime (rejected: production failures)
- Re-validate on activation (rejected: unnecessary if validated at save)

---

### 5. Placeholder Validation Strategy

**Question**: How should required placeholders (e.g., {{ocr_text}}) be validated?

**Decision**:
- Define required placeholders per prompt type:
  - ocr_extraction: {{ocr_text}}, {{master_data_context}}
  - rag_query_prompt: {{query}}, {{context}}
  - rag_prep_prompt: {{text}}
  - classification_prompt: {{document_text}}
- Validate on save: template must contain all required placeholders
- Return validation error listing missing placeholders
- Allow additional optional placeholders

**Rationale**:
- Prevents production failures from missing placeholders
- Clear error messages help admins understand requirements
- Flexible enough for future placeholder additions
- Aligns with ADR-029 dynamic prompt management

**Alternatives Considered**:
- Validate at runtime (rejected: production failures)
- No validation (rejected: too error-prone)

---

### 6. Version Numbering Strategy

**Question**: How should version numbers be incremented across prompt types?

**Decision**: 
- Version numbers are per prompt_type (independent counters)
- Each prompt_type has its own sequence: ocr_extraction v1, v2, v3; rag_query_prompt v1, v2, etc.
- Auto-increment on save: MAX(version_number) + 1 for that prompt_type
- Display version number in format: "v{number} ({prompt_type})"

**Rationale**:
- Clear separation between prompt types
- No confusion about which version belongs to which type
- Auto-increment prevents manual errors
- Consistent with ADR-029 versioning approach

**Alternatives Considered**:
- Global version counter across all types (rejected: confusing which version is for which type)
- Manual version entry (rejected: error-prone)

---

### 7. Sandbox State Management

**Question**: How should sandbox state (OCR text, extracted metadata) be passed between steps?

**Decision**:
- Store sandbox job results in Redis with TTL 1 hour
- Use job ID as key: `sandbox:job:{jobId}`
- Each step (OCR, AI Extract, RAG Prep) writes its result to the same key
- Frontend polls job status using job ID
- Results cleared after TTL or manual "Clear Sandbox" action

**Rationale**:
- Stateless API design (no session state in backend)
- Redis is already available for BullMQ
- TTL prevents memory leaks
- Allows multi-step workflow without passing large payloads in requests
- Consistent with existing sandbox patterns

**Alternatives Considered**:
- Pass results in request/response (rejected: large payloads, complexity)
- Store in database (rejected: unnecessary persistence, cleanup overhead)

---

### 8. Frontend Component Architecture

**Question**: How should the unified prompt management page be structured?

**Decision**:
- Single page at `/admin/ai/prompt-management`
- 3-panel layout: Left (Version History), Center (Prompt Editor + Context Config), Right (Sandbox)
- PromptTypeDropdown at top of page (global state)
- Use React Hook Form for Context Config Editor (validation, type safety)
- Use TanStack Query for data fetching (version history, active version)
- Use shadcn/ui components (consistent with existing admin pages)

**Rationale**:
- Consistent with ADR-027 single page layout
- 3-panel layout maximizes screen real estate
- RHF + Zod for form validation (best practice)
- TanStack Query for caching and optimistic updates
- shadcn/ui for consistent styling

**Alternatives Considered**:
- Multi-page design (rejected: violates ADR-027 single page constraint)
- 2-panel layout (rejected: insufficient space for sandbox)

---

## Summary

All technical unknowns resolved. Key decisions:
1. Context config uses flat JSON with filter object
2. Runtime parameters in new ai_execution_profiles table
3. Sandbox RAG Prep uses existing BullMQ infrastructure
4. Context config validated on save against database
5. Placeholder validation per prompt type
6. Version numbers per prompt_type (independent counters)
7. Sandbox state in Redis with TTL 1 hour
8. Frontend: 3-panel single page with RHF + TanStack Query + shadcn/ui
