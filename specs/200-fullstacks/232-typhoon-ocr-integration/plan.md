// File: specs/200-fullstacks/232-typhoon-ocr-integration/plan.md
// Change Log:
// - 2026-05-30: Initial implementation plan for Typhoon OCR integration

# Implementation Plan: Typhoon OCR Integration

**Branch**: `232-typhoon-ocr-integration` | **Date**: 2026-05-30 | **Spec**: [spec.md](../spec.md)
**Input**: Feature specification from `/specs/200-fullstacks/232-typhoon-ocr-integration/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.agents/skills/plan.md` for the execution workflow.

## Summary

Integrate Typhoon OCR-3B as an alternative OCR engine in OCR Sandbox Runner, add typhoon2.1-gemma3-4b to AI Model Management, and update ADR-023/023A to document Typhoon models as supported on-premises AI options. The implementation uses Ollama on Admin Desktop (Desk-5439) with sequential processing (1 concurrent request), 24-hour result caching, and fallback to Tesseract OCR when Typhoon is unavailable. All changes require system.manage_all permission and must comply with ADR-023/023A AI boundary policies.

## Technical Context

<!--
  ACTION REQUIRED: Replace the content in this section with the technical details
  for the project. The structure here is presented in advisory capacity to guide
  the iteration process.
-->

**Language/Version**: TypeScript 5.x (NestJS 11 backend, Next.js 16 frontend), Python 3.11 (OCR sidecar)
**Primary Dependencies**: Ollama (AI runtime), BullMQ (job queues), TypeORM (ORM), Redis (caching/locks), MariaDB 11.8 (database)
**Storage**: MariaDB (ai_prompts, ai_audit_logs), Redis (24-hour OCR result cache, VRAM monitoring)
**Testing**: Jest (backend unit tests), Playwright (E2E tests)
**Target Platform**: Linux server (Admin Desktop Desk-5439 for AI processing)
**Project Type**: web (backend + frontend + infrastructure)
**Performance Goals**: 60 seconds/page OCR processing, 5-second fallback to Tesseract, 90% VRAM usage limit
**Constraints**: On-premises AI only (ADR-023/023A), system.manage_all permission required, sequential OCR processing (1 concurrent request)
**Scale/Scope**: Single Admin Desktop GPU, 24-hour cache TTL, ai_audit_logs for all AI interactions

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

Based on AGENTS.md Tier 1 non-negotiables:

- **ADR-019 UUID**: ✅ PASS - Using publicId for all API responses, no parseInt on UUID
- **ADR-009 Schema**: ✅ PASS - No TypeORM migrations, will edit SQL directly if schema changes needed
- **ADR-016 Security**: ✅ PASS - CASL Guard with system.manage_all permission for all AI-related mutations
- **ADR-002 Numbering**: N/A - No document numbering in this feature
- **ADR-008 BullMQ**: ✅ PASS - AI interactions via BullMQ queues (ai-realtime/ai-batch)
- **ADR-023/023A AI Boundary**: ✅ PASS - Typhoon models run on Admin Desktop Ollama only, no direct DB/storage access
- **ADR-007 Errors**: ✅ PASS - Will use layered error classification with user-friendly messages
- **TypeScript Strict**: ✅ PASS - No `any` types, no `console.log`, explicit typing
- **i18n**: ✅ PASS - No hardcoded Thai/English strings, use i18n keys
- **File Upload**: N/A - No file upload changes in this feature

**Gate Status**: ✅ PASS - No violations

## Project Structure

### Documentation (this feature)

```text
specs/200-fullstacks/232-typhoon-ocr-integration/
├── spec.md              # Feature specification
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── modules/
│   │   ├── ai/
│   │   │   ├── ai.service.ts              # Add Typhoon model support
│   │   │   ├── ai.controller.ts           # Add Typhoon OCR endpoint
│   │   │   └── dto/                       # Add Typhoon-specific DTOs
│   │   └── ocr/
│   │       ├── ocr.service.ts             # Add Typhoon OCR integration
│   │       └── dto/                       # Add OCR engine selection DTOs
│   └── common/
│       └── guards/
│           └── casl-ability.guard.ts      # Verify system.manage_all permission
└── tests/
    └── unit/
        └── modules/
            └── ai/                        # Add Typhoon model tests

frontend/
├── src/
│   ├── features/
│   │   ├── ai-admin/
│   │   │   └── components/
│   │   │       └── ModelManagement.tsx    # Add typhoon2.1-gemma3-12b option
│   │   └── ocr-sandbox/
│   │       └── components/
│   │           └── OcrEngineSelector.tsx # Add Typhoon OCR option
│   └── lib/
│       └── i18n/
│           └── locales/
│               └── th.ts                 # Add Typhoon-related i18n keys
└── tests/
    └── e2e/
        └── ai-admin.spec.ts              # Add Typhoon model E2E tests

specs/
├── 06-Decision-Records/
│   ├── ADR-023-unified-ai-architecture.md
│   ├── ADR-023A-unified-ai-architecture.md
│   └── ADR-032-typhoon-ocr-integration.md  # New ADR for Typhoon integration
└── 04-Infrastructure-OPS/
    └── 04-00-docker-compose/
        └── Desk-5439/
            └── ocr-sidecar/
                └── app.py                 # Add Typhoon OCR Ollama integration
```

**Structure Decision**: Web application structure (backend + frontend + infrastructure). Backend uses NestJS modular structure with ai and ocr modules. Frontend uses Next.js feature-based structure. Infrastructure includes OCR sidecar on Admin Desktop.

## Phase 0: Research - COMPLETE

**Output**: `research.md`

**Decisions Made**:
- Use Ollama HTTP API for Typhoon OCR integration via Admin Desktop
- Add typhoon2.1-gemma3-12b Q3_K_M to AI Model Management
- Use Redis with 24-hour TTL for OCR result caching
- Implement VRAM monitoring via Ollama API and Redis state tracking
- Create ADR-032 for Typhoon OCR integration and update ADR-023/023A

**Unknowns Resolved**: All NEEDS CLARIFICATION markers resolved

## Phase 1: Design & Contracts - COMPLETE

**Outputs**:
- `data-model.md` - Entity definitions, relationships, validation rules
- `contracts/api-contracts.md` - API endpoints, request/response schemas
- `quickstart.md` - Installation, usage, verification, troubleshooting
- Agent context updated with Typhoon-specific technologies

**Constitution Check Re-evaluation**: ✅ PASS - No violations introduced in design phase

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation                  | Why Needed         | Simpler Alternative Rejected Because |
| -------------------------- | ------------------ | ------------------------------------ |
| [e.g., 4th project]        | [current need]     | [why 3 projects insufficient]        |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient]  |
