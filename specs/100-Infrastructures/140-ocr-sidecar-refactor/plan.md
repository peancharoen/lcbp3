# Implementation Plan: OCR Sidecar Refactor

**Branch**: `140-ocr-sidecar-refactor` | **Date**: 2026-06-20 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/100-Infrastructures/140-ocr-sidecar-refactor/spec.md`

## Summary

Refactor the OCR sidecar on Desk-5439 to address security vulnerabilities (hardcoded API keys, path traversal), implement async I/O for performance, preserve GPU resource management policies (Adaptive OCR Residency, CPU Fallback Retrieval), and align with ADR-036 Profile-Only Parameter Governance and ADR-029/037 Active Prompt System. The sidecar becomes a pure compute worker with all orchestration and parameter governance moved to backend services.

## Technical Context

**Language/Version**: Python 3.11+ (FastAPI)
**Primary Dependencies**: FastAPI 0.111.0, httpx 0.27.0, PyMuPDF 1.24.0, typhoon-ocr>=0.4.1, FlagEmbedding>=1.2.0, pythainlp 5.0.4
**Storage**: No database access (ADR-023/023A boundary - sidecar is pure compute worker)
**Testing**: pytest for path-traversal and residency wiring tests
**Target Platform**: Desk-5439 (192.168.10.100, Windows 10/11, RTX 5060 Ti 16GB GPU) via Docker
**Project Type**: Infrastructure (sidecar service)
**Performance Goals**: 20%+ throughput improvement with async I/O; VRAM exhaustion prevention under load
**Constraints**: Must preserve LLM-First GPU Ownership; must not bypass existing residency_policy.py; must align with ADR-036 Gap-2 (keep_alive as lazy resource param)
**Scale/Scope**: Single sidecar service; affects backend AI services (OcrService, SandboxOcrEngineService)

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Gate | Status | Justification |
|------|--------|---------------|
| ADR-019 UUID | ✅ PASS | Sidecar N/A (pure compute worker), Backend applies ADR-019 (parameter resolution in OcrService/SandboxOcrEngineService) |
| ADR-009 Schema | N/A | No database schema changes in sidecar |
| ADR-016 Security | ✅ PASS | Path traversal hardening; no hardcoded secrets; network isolation auth |
| ADR-002 Numbering | N/A | No document numbering in sidecar |
| ADR-008 BullMQ | N/A | Sidecar does not use BullMQ (backend does) |
| ADR-023/023A AI Boundary | ✅ PASS | Sidecar is pure compute worker; no DB/storage access; AI → DMS API → DB pattern preserved |
| ADR-007 Errors | ✅ PASS | FastAPI exception handling with user-friendly messages |
| TypeScript Strict | N/A | Python codebase |

## Project Structure

### Documentation (this feature)

```text
specs/100-Infrastructures/140-ocr-sidecar-refactor/
├── spec.md              # Feature specification
├── plan.md              # This file
├── research.md          # Phase 0 output (technical decisions from ADR-040)
├── data-model.md        # Phase 1 output (data contracts)
├── quickstart.md        # Phase 1 output (deployment guide)
├── contracts/           # Phase 1 output (API contracts)
│   └── sidecar-api.md   # Sidecar API specification
└── tasks.md             # Phase 2 output (implementation tasks)
```

### Source Code

```text
specs/04-Infrastructure-OPS/04-00-docker-compose/Desk-5439/ocr-sidecar/
├── app.py               # FastAPI application (main refactor target)
├── residency_policy.py  # Retain (Adaptive OCR Residency)
├── vram_monitor.py      # Retain (VRAM monitoring)
├── requirements.txt     # Python dependencies
├── Dockerfile           # Container definition
├── docker-compose.yml   # Orchestration
└── .env                 # Environment variables

backend/src/modules/ai/
├── services/
│   ├── ocr.service.ts                    # Parameter resolution + sidecar calls
│   └── sandbox-ocr-engine.service.ts     # Sandbox parameter resolution
└── processors/
    └── ai-batch.processor.ts             # BullMQ processor (unchanged)

tests/
├── unit/
│   └── ocr-sidecar/                      # Sidecar unit tests
│       ├── test_path_traversal.py        # Path traversal tests
│       └── test_residency_wiring.py      # Residency calculation tests
└── integration/
    └── ocr-sidecar/                      # Sidecar integration tests
```

**Structure Decision**: Infrastructure refactor targeting existing OCR sidecar on Desk-5439. Backend changes limited to parameter resolution in AI services. No new frontend changes.

## Complexity Tracking

> No constitution violations - all gates pass. This section not applicable.

## Phase 0: Research & Technical Decisions

All technical decisions are already documented in ADR-040. Key decisions:

### Security Decisions
- **Decision**: Remove hardcoded default API key; fail-fast if env missing
- **Rationale**: Security vulnerability - leaked key cannot be rotated without rebuild
- **Decision**: Implement path canonicalization + base-path whitelist
- **Rationale**: Prevent path traversal attacks (ADR-016)

### I/O Pattern Decisions
- **Decision**: Refactor to async I/O with shared AsyncClient via lifespan
- **Rationale**: Synchronous blocking I/O reduces throughput under load
- **Decision**: Replace `@app.on_event("startup")` with lifespan context manager
- **Rationale**: Deprecated pattern; lifespan provides better resource management

### GPU Resource Management Decisions
- **Decision**: Wire `calculate_ocr_residency()` into `process_ocr` for dynamic keep_alive
- **Rationale**: Preserve Adaptive OCR Residency policy (CONTEXT.md); avoid fixed values
- **Decision**: Retain vram_monitor.py and residency_policy.py
- **Rationale**: LLM-First GPU Ownership + CPU Fallback Retrieval must be preserved
- **Decision**: Reject forced GPU-resident BGE-M3/Reranker
- **Rationale**: CPU fallback is required for VRAM pressure scenarios

### Parameter Governance Decisions
- **Decision**: Remove hardcoded runtime params; accept from backend job snapshot
- **Rationale**: ADR-036 Profile-Only Parameter Governance; dynamic tuning without rebuild
- **Decision**: Backend resolves systemPrompt and DMS tags from Active Prompt
- **Rationale**: ADR-029/037 Active Prompt System; prompt authority in DB not code
- **Decision**: Reject creating PromptBuilderService
- **Rationale**: Use existing Active Prompt system; avoid invented orchestration

### Auth Decisions
- **Decision**: Phase 1 - Remove hardcoded default key; Phase 2 - Remove X-API-Key after ADR-041
- **Rationale**: Sequenced migration; network isolation only possible post-consolidation
- **Decision**: Interim period requires X-API-Key validation
- **Rationale**: Cross-host topology (before ADR-041) requires defense-in-depth

### Endpoint Decisions
- **Decision**: Remove /normalize endpoint
- **Rationale**: No consumers (verified by grep); ThaiPreprocessProcessor unused
- **Decision**: Fix mutable default argument `options_override={}`
- **Rationale**: Python anti-pattern; causes unexpected behavior

## Phase 1: Design & Contracts

### Data Model

See [data-model.md](./data-model.md) for detailed data contracts and entity relationships.

### API Contracts

See [contracts/sidecar-api.md](./contracts/sidecar-api.md) for sidecar API specification.

### Quickstart Guide

See [quickstart.md](./quickstart.md) for deployment and testing instructions.

## Phase 2: Implementation (Tasks)

See [tasks.md](./tasks.md) for detailed implementation tasks generated by `/speckit-tasks`.
