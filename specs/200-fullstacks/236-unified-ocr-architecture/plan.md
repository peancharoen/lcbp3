// File: specs/200-fullstacks/236-unified-ocr-architecture/plan.md
// Change Log:
// - 2026-06-13: Initial implementation plan for Unified AI Model Architecture

# Implementation Plan: Unified AI Model Architecture — Sandbox-Production Parity

**Branch**: `236-unified-ocr-architecture` | **Date**: 2026-06-13 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/200-fullstacks/236-unified-ocr-architecture/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Enhance the existing Profile-Only Parameter Governance (AiPolicyService + ai_execution_profiles) to add write/apply path for sandbox testing and production parameter management. The feature introduces a sandbox draft store (ai_sandbox_profiles) that mirrors the production store, allowing admins to test parameters for both np-dms-ai and np-dms-ocr models before applying to production. Key technical approach: extend existing AiPolicyService with sandbox methods, add canonical_model column to distinguish models, implement dual-model snapshot for OCR+LLM jobs, and enforce security guardrails (Idempotency-Key, CASL, validation). Model names are updated from typhoon2.5-np-dms/typhoon-np-dms-ocr to np-dms-ai/np-dms-ocr across codebase.

## Technical Context

**Language/Version**: TypeScript 5.7 (Backend: NestJS 11, Frontend: Next.js 16)
**Primary Dependencies**: NestJS, TypeORM, Redis, BullMQ, TanStack Query, React Hook Form, Zod
**Storage**: MariaDB 11.8 (ai_execution_profiles, ai_sandbox_profiles, ai_audit_logs), Redis (cache)
**Testing**: Jest (backend), Vitest + Playwright (frontend)
**Target Platform**: Linux server (QNAP), Windows 10/11 (Desk-5439 OCR sidecar)
**Project Type**: web (fullstack: backend + frontend)
**Performance Goals**: Apply operation <2s, Sandbox test <5s cycle, Cache invalidation <100ms
**Constraints**: ADR-009 (no migrations), ADR-019 (UUID handling), ADR-016 (security), ADR-023/023A (AI boundary)
**Scale/Scope**: 2 models (np-dms-ai, np-dms-ocr), 5 profiles (interactive, standard, quality, deep-analysis, ocr-extract), admin-only feature

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Gate | Status | Justification |
|------|--------|--------------|
| ADR-009: No TypeORM migrations | ✅ PASS | Schema changes via SQL delta (deltas/2026-06-13-extend-ai-execution-profiles-ocr.sql) |
| ADR-019: UUID handling | ✅ PASS | No new UUID fields; existing UUID patterns followed |
| ADR-016: Security | ✅ PASS | CASL guard (system.manage_ai), Idempotency-Key validation, parameter range validation |
| ADR-023/023A: AI boundary | ✅ PASS | No direct DB/storage access from AI; existing pipeline maintained |
| ADR-007: Error handling | ✅ PASS | Layered error classification, user-friendly messages |
| ADR-029: Dynamic Prompts | ✅ PASS | Integration only; no duplication in parameter store |
| ADR-033: Adaptive OCR Residency | ✅ PASS | keep_alive lazy-loading retained; not frozen in snapshot |

## Project Structure

### Documentation (this feature)

```text
specs/200-fullstacks/236-unified-ocr-architecture/
├── spec.md              # Feature specification
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
│   ├── backend-api.yaml # OpenAPI spec for new endpoints
│   └── frontend-api.yaml # Frontend API service contracts
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── modules/
│   │   └── ai/
│   │       ├── entities/
│   │       │   ├── ai-execution-profile.entity.ts      # MODIFY: +canonicalModel, nullable numCtx/maxTokens
│   │       │   └── ai-sandbox-profile.entity.ts        # NEW: draft store
│   │       ├── services/
│   │       │   ├── ai-policy.service.ts                # MODIFY: +sandbox methods, applyProfile
│   │       │   ├── ocr.service.ts                      # MODIFY: +typhoonOptions in OcrDetectionInput
│   │       │   ├── ollama.service.ts                    # MODIFY: update model names
│   │       │   └── sandbox-ocr-engine.service.ts        # KEEP: ephemeral override
│   │       ├── processors/
│   │       │   └── ai-batch.processor.ts               # MODIFY: dual-model snapshot, sandbox draft read
│   │       ├── controllers/
│   │       │   ├── ai.controller.ts                    # MODIFY: apply/test/get endpoints
│   │       │   └── ai-sandbox.controller.ts             # MODIFY: apply endpoint
│   │       ├── dto/
│   │       │   ├── apply-profile.dto.ts                 # NEW: validation DTO
│   │       │   └── apply-result.dto.ts                  # NEW: result DTO
│   │       ├── interfaces/
│   │       │   └── execution-policy.interface.ts        # MODIFY: +ocrSnapshotParams in AiJobPayload
│   │       └── ai.module.ts                             # MODIFY: register new entities/services
│   └── common/
│       └── decorators/
│           └── audit.decorator.ts                      # MODIFY: support APPLY_PROFILE action
└── tests/
    ├── unit/
    │   └── modules/
    │       └── ai/
    │           ├── ai-policy.service.spec.ts            # MODIFY: +sandbox/apply tests
    │           └── ai-batch.processor.spec.ts            # MODIFY: +dual-model snapshot tests
    └── integration/
        └── modules/
            └── ai/
                └── ai-policy.service.integration.spec.ts # NEW: end-to-end apply flow

frontend/
├── lib/
│   ├── services/
│   │   └── admin-ai.service.ts                          # MODIFY: +apply/test/get profile functions
├── components/
│   └── admin/
│       └── ai/
│           ├── OcrSandboxPromptManager.tsx             # MODIFY: +apply runtime params, project/contract selector
│           └── ModelTestingPanel.tsx                    # NEW: unified parameter testing UI
├── app/
│   └── (admin)/
│       └── admin/
│           └── ai/
│               └── page.tsx                             # MODIFY: integrate new testing panel
└── tests/
    ├── unit/
    │   └── services/
    │       └── admin-ai.service.spec.ts                # MODIFY: +apply/test/get tests
    └── e2e/
        └── ai/
            └── parameter-management.spec.ts             # NEW: apply flow E2E tests

specs/03-Data-and-Storage/
└── deltas/
    ├── 2026-06-13-extend-ai-execution-profiles-ocr.sql   # NEW: schema changes
    └── 2026-06-13-extend-ai-execution-profiles-ocr.rollback.sql # NEW: rollback

specs/04-Infrastructure-OPS/04-00-docker-compose/Desk-5439/
└── ocr-sidecar/
    ├── app.py                                            # MODIFY: update model name (if needed)
    └── docker-compose.yml                               # MODIFY: update model name (if needed)
```

**Structure Decision**: Web application (Option 2) - This is a fullstack feature extending the existing NestJS backend and Next.js frontend. Backend changes focus on AI module (entities, services, processors, controllers, DTOs). Frontend changes focus on admin AI console components and services. Infrastructure changes limited to OCR sidecar model name updates.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No violations detected. All gates passed.
