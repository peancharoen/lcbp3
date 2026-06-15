# Implementation Plan: Unified Prompt Management UX/UI

**Branch**: `237-unified-prompt-management-ux-ui` | **Date**: 2026-06-14 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/200-fullstacks/237-unified-prompt-management-ux-ui/spec.md`

## Summary

This feature extends ADR-029 Dynamic Prompt Management to support multiple prompt types (OCR extraction, RAG query, RAG preparation, document classification) with a unified single-page UI. The implementation adds context configuration management, a required 3-step sandbox workflow (OCR → AI Extract → RAG Prep), and clear separation between Runtime Parameters (AI model behavior) and Context Config (data context). The backend will extend existing AiPromptsService with new endpoints for context config CRUD and RAG Prep sandbox testing, while the frontend will create a unified Prompt Management page with PromptTypeDropdown (including "All Types" view), VersionHistory, PromptEditor, ContextConfigEditor, SandboxTabs, SandboxTestArea, and RuntimeParametersPanel components. The implementation includes optimistic locking for concurrent edits, Redis caching for performance, and responsive design for mobile devices.

## Technical Context

**Language/Version**: TypeScript 5.6 (Backend: NestJS 11, Frontend: Next.js 16)
**Primary Dependencies**:
- Backend: @nestjs/common, @nestjs/typeorm, @nestjs/bull, class-validator, class-transformer, redis, ioredis
- Frontend: next, react, @tanstack/react-query, react-hook-form, zod, shadcn/ui, lucide-react
**Storage**: MariaDB 11.8 (ai_prompts, ai_execution_profiles tables), Redis (prompt cache, BullMQ queues)
**Testing**: Jest (backend unit/integration/e2e), Vitest (frontend unit), Playwright (frontend e2e)
**Target Platform**: Linux server (QNAP NAS) for backend, Web browser for frontend
**Project Type**: fullstack (backend + frontend)
**Performance Goals**:
- Sandbox OCR results within 30s
- Sandbox AI Extract within 60s
- Version history load within 1s
- Context config activation within 5s
**Constraints**:
- ADR-019: No parseInt on UUID, use publicId only
- ADR-009: No TypeORM migrations, edit SQL directly
- ADR-016: CASL guards on all mutations, ThrottlerGuard on auth
- ADR-023/023A: AI boundary enforcement, BullMQ queues (ai-realtime, ai-batch)
- ADR-029: Prompt templates in DB, Redis cache TTL 60s
- ADR-007: Layered error handling, user-friendly messages
- ADR-037: RAG Prep is required step (not optional), "All Types" view for version history
**Scale/Scope**:
- 4 prompt types with versioning (ocr_extraction, rag_query_prompt, rag_prep_prompt, classification_prompt)
- Single page UI with 2-column layout (Left Panel 50%, Right Panel 50%)
- Required 3-step sandbox workflow (OCR → AI Extract → RAG Prep)
- Responsive design (Desktop/Tablet/Mobile breakpoints)
- Optimistic locking for concurrent edits (@VersionColumn)
- Redis caching for performance (60s TTL)
- ~12 backend endpoints, ~18 frontend components

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Principle | Status | Notes |
|-----------|--------|-------|
| ADR-019 UUID | ✅ PASS | Will use publicId only, no parseInt on UUID |
| ADR-009 Schema | ✅ PASS | Will add SQL delta for new columns, no migrations |
| ADR-016 Security | ✅ PASS | Will add CASL guards on all mutation endpoints |
| ADR-002 Numbering | N/A | Not applicable (no document numbering) |
| ADR-008 Notifications | ✅ PASS | Sandbox jobs use BullMQ, no inline processing |
| ADR-023/023A AI Boundary | ✅ PASS | Sandbox uses existing BullMQ queues, no direct AI access |
| ADR-029 Dynamic Prompts | ✅ PASS | Extends existing ai_prompts table, follows Redis cache pattern |
| ADR-007 Error Handling | ✅ PASS | Will use BusinessException hierarchy |
| TypeScript Strict | ✅ PASS | Zero any, zero console.log |
| i18n | ✅ PASS | Will use i18n keys, no hardcoded text |
| File Upload | ✅ PASS | Sandbox uses existing two-phase upload |

**Result**: All applicable principles pass. No violations.

## Project Structure

### Documentation (this feature)

```text
specs/200-fullstacks/237-unified-prompt-management-ux-ui/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   ├── backend-api.yaml
│   └── frontend-types.ts
└── tasks.md             # Phase 2 output (from /speckit-tasks)
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── modules/
│   │   └── ai/
│   │       ├── controllers/
│   │       │   └── ai-prompts.controller.ts (extend with context config endpoints)
│   │       ├── services/
│   │       │   ├── ai-prompts.service.ts (extend with context config CRUD, optimistic locking)
│   │       │   └── ocr.service.ts (extend with RAG Prep endpoint)
│   │       ├── processors/
│   │       │   └── ai-batch.processor.ts (extend with sandbox-rag-prep job)
│   │       └── dto/
│   │           ├── context-config.dto.ts (new)
│   │           └── sandbox-rag-prep.dto.ts (new)
│   └── common/
│       └── decorators/
│           └── casl-abilities.decorator.ts (existing)
└── test/
    └── integration/
        └── ai/
            └── ai-prompts.service.spec.ts (extend tests)

frontend/
├── app/
│   └── (admin)/
│       └── admin/
│           └── ai/
│               └── prompt-management/
│                   └── page.tsx (new - unified prompt management page with 2-column layout)
├── components/
│   └── admin/
│       └── ai/
│           ├── PromptTypeDropdown.tsx (new - includes "All Types" option)
│           ├── VersionHistory.tsx (extend with type filtering, "All Types" view)
│           ├── PromptEditor.tsx (new - with placeholder validation)
│           ├── ContextConfigEditor.tsx (new - with field validation)
│           ├── RuntimeParametersPanel.tsx (new - with "Global" label)
│           ├── SandboxTabs.tsx (new - 3-step workflow tabs)
│           └── SandboxTestArea.tsx (new - test workflow UI)
├── lib/
│   ├── services/
│   │   └── admin-ai.service.ts (extend with context config methods)
│   └── types/
│       └── ai-prompts.ts (extend with context config types)
└── __tests__/
    └── components/
        └── admin/
            └── ai/
                ├── prompt-management.test.tsx (new)
                └── responsive-design.test.tsx (new)
```

**Structure Decision**: Fullstack web application (backend + frontend) following existing LCBP3-DMS patterns. Backend extends existing ai module, frontend adds new page under (admin)/admin/ai/ consistent with ADR-027 single page layout.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No violations - this section is not applicable.
