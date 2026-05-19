# Implementation Plan: AI Tool Layer Architecture

**Branch**: `225-ai-tool-layer-architecture` | **Date**: 2026-05-19 | **Spec**: spec.md
**Input**: Feature specification from `specs/200-fullstacks/225-ai-tool-layer-architecture/spec.md`

## Summary

Implement the AI Tool Layer Architecture as specified in ADR-025. This layer acts as a bridge between the AI Gateway (ADR-023A) and the business modules. It maps `ServerIntent` to business service calls (`AiToolRegistryService`), enforces CASL authorization, formats responses into LLM-friendly DTOs (adhering to ADR-019), handles structured errors (ADR-007), and writes audit logs.

## Technical Context

**Language/Version**: TypeScript, Node.js, NestJS 11
**Primary Dependencies**: NestJS, CASL, class-validator
**Storage**: MariaDB (for audit logs `ai_audit_logs`)
**Testing**: Jest (Unit & Integration tests)
**Target Platform**: Backend API (Node.js)
**Project Type**: Backend Module (NestJS)
**Performance Goals**: Low latency dispatch (< 10ms for tool routing)
**Constraints**: Must strictly follow ADR-019, ADR-007, ADR-025
**Scale/Scope**: Impacts all AI features; easily extensible for new tools.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

- ✅ Zero `any` usage in new tool layer logic.
- ✅ ADR-019 strictly adhered to (no `id: number` exposed).
- ✅ CASL enforcement integrated directly in tool handlers.
- ✅ No raw entities leaked to LLM context.

## Project Structure

### Documentation (this feature)

```text
specs/200-fullstacks/225-ai-tool-layer-architecture/
├── plan.md              
├── research.md          
├── data-model.md        
├── quickstart.md        
├── contracts/           
└── tasks.md             
```

### Source Code (repository root)

```text
backend/
└── src/
    └── modules/
        └── ai/
            └── tool/
                ├── ai-tool.module.ts
                ├── ai-tool-registry.service.ts
                ├── rfa-tool.service.ts
                ├── drawing-tool.service.ts
                ├── transmittal-tool.service.ts
                ├── correspondence-tool.service.ts
                ├── circulation-tool.service.ts
                ├── document-tool.service.ts
                └── types/
                    ├── tool-call-result.type.ts
                    ├── rfa-tool-result.type.ts
                    ├── drawing-tool-result.type.ts
                    └── ...
```

**Structure Decision**: The implementation will be housed in a new NestJS module `AiToolModule` inside `backend/src/modules/ai/tool/`. This module will manage tool registry and service handlers, and it will be imported by `AiModule`.

## Complexity Tracking

| Violation                  | Why Needed         | Simpler Alternative Rejected Because |
| -------------------------- | ------------------ | ------------------------------------ |
| N/A                        |                    |                                      |
