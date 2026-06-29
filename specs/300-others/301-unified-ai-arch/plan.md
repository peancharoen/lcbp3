# Implementation Plan: Unified AI Architecture

**Branch**: `301-unified-ai-arch` | **Date**: 2026-05-14 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `specs/300-others/301-unified-ai-arch/spec.md`

## Summary

Implement a Master AI Architecture enforcing strict physical isolation of AI workloads on a dedicated Admin Desktop (Desk-5439). The system supports secure legacy document migration via a staging queue, context-aware conversational RAG queries, and detailed AI audit logging, all orchestrated through robust backend queues (BullMQ) and multi-tenant security filters.

## Technical Context

**Language/Version**: TypeScript (Node.js v24.15.0) for Backend/Frontend
**Primary Dependencies**: NestJS 11, Next.js 16, BullMQ, Qdrant Node Client, n8n
**Storage**: MariaDB 11.8 (Relational), Qdrant (Vector), Redis (Queue/Cache)
**Testing**: Jest (Backend), Vitest (Frontend), E2E with Playwright
**Target Platform**: QNAP Container Station (Production), Desk-5439 (AI Host)
**Project Type**: Monorepo Web Application (Backend + Frontend)
**Performance Goals**: RAG Response < 10s (p95), Migration throughput 1000 pages/hour
**Constraints**: AI host has limited VRAM (8GB), necessitating concurrency limit of 1 for LLM generation. 
**Scale/Scope**: 20,000+ legacy documents, project-wide deployment.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

- **ADR-019 UUID**: `publicId` used exclusively. No INT primary keys exposed.
- **ADR-009 Database**: Schema changes via raw SQL deltas.
- **ADR-016 Security**: CASL RBAC strictly enforced (`@UseGuards(CaslAbilityGuard)`). Idempotency-Key headers required.
- **ADR-008 BullMQ**: Heavy AI orchestration and RAG queuing managed via BullMQ.
- **ADR-018/023 AI Boundary**: AI host connects via DMS API. No direct database access.
- **TypeScript Strict**: Explicit types, no `any`, proper error handling via `BusinessException`.

## Project Structure

### Documentation (this feature)

```text
specs/300-others/301-unified-ai-arch/
├── spec.md
├── plan.md              # This file
├── research.md          
├── data-model.md        
├── quickstart.md        
├── contracts/           
└── tasks.md             # (To be created)
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── ai/
│   │   ├── ai.module.ts
│   │   ├── ai.controller.ts
│   │   ├── ai.service.ts
│   │   ├── qdrant.service.ts
│   │   ├── rag.processor.ts
│   │   └── dto/
│   └── database/
│       └── sql/

frontend/
├── src/
│   ├── app/(dashboard)/ai-staging/
│   ├── components/ai/
│   │   ├── AiStatusBanner.tsx
│   │   └── RagChatWidget.tsx
│   └── lib/api/ai.ts
```

**Structure Decision**: Integrated into the existing Next.js / NestJS monorepo architecture, utilizing a dedicated `AiModule` in the backend to centralize all external AI API calls and queue management.
