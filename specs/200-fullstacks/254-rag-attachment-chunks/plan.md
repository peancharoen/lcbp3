// File: specs/200-fullstacks/254-rag-attachment-chunks/plan.md
// Change Log:
// - 2026-09-09: Initial implementation plan for RAG Attachment Chunks

# Implementation Plan: RAG Attachment Chunks

**Branch**: `254-rag-attachment-chunks` | **Date**: 2026-09-09 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/200-fullstacks/254-rag-attachment-chunks/spec.md`

## Summary

Replace the ambiguous RAG `document_chunks` model with an Attachment-scoped ingestion model. A checksum-bound `rag_attachment_generations` aggregate owns normalized `rag_attachment_pages` and `rag_attachment_chunks`; BGE-M3 creates dense+sparse vectors in Qdrant. Build-then-swap, Redlock, database transactions, ACTIVE-generation validation, owning-Project tenant filtering, secure ZIP extraction, classification policy, and user-safe citations protect data integrity and retrieval security.

The existing database contains zero rows in `document_chunks`, but the physical schema replacement remains an ADR-044 SQL delta and must not be applied automatically to a live database.

## Technical Context

**Language/Version**: TypeScript 5.x, NestJS 11, Next.js 16
**Primary Dependencies**: TypeORM, MariaDB 11.8, Redis/Redlock, BullMQ, Qdrant, existing AI Gateway/queue services, ClamAV/StorageService
**Storage**: MariaDB for generations/pages/chunks and metadata; permanent Attachment storage; Qdrant for BGE-M3 dense+sparse vectors; Redis/BullMQ for jobs and locks
**Testing**: Jest unit/integration/E2E, Vitest/React Testing Library where UI contracts change, SQL/static contract checks, Qdrant isolation tests
**Target Platform**: Linux `np-dms-lcbp3` server; on-premises Ollama/AI stack only
**Project Type**: Web application with NestJS backend and Next.js frontend; RAG backend is the primary scope
**Performance Goals**: Ingestion is asynchronous; metadata-only updates do not re-embed; retrieval must validate ACTIVE chunks in one batched MariaDB query; cleanup jobs retry without blocking user requests
**Constraints**: ADR-019 publicId/UUID rules; ADR-016 CASL, checksum, ClamAV, and two-phase storage; ADR-007 layered errors; ADR-008 BullMQ; ADR-023/023A/043 owning-Project Qdrant isolation and human-in-the-loop; ADR-044 SQL deltas only; BGE-M3 dense+sparse; no RAG retrieval for receiving Projects
**Scale/Scope**: Attachments across Correspondence, RFA, Transmittal, Circulation, Contract Drawing, Shop Drawing, and As-Built Drawing; one ACTIVE generation per Attachment; ZIP inner files are independently segmented and cited

## Constitution Check

_Gate: Must pass before implementation and re-check after design._

| Gate | Status | Evidence/Plan |
|---|---|---|
| ADR-019 UUID | PASS | `attachment_uuid`, `generation_uuid`, and `chunk_public_id` use UUID/publicId boundaries; no INT IDs exposed |
| ADR-044 Schema | PASS | New/renamed tables use SQL schema + delta; no TypeORM migration |
| ADR-016 Security | PASS | Attachment checksum, ClamAV, secure ZIP extraction, CASL classification override, and owning-Project scope |
| ADR-002 Concurrency | PASS | Redlock per Attachment plus transaction/one ACTIVE invariant |
| ADR-007 Errors | PASS | Validation/Business/System classification with user recovery messages and technical logs |
| ADR-008 Queues | PASS | Ingestion, metadata sync, and vector cleanup are BullMQ jobs with retry/backoff |
| ADR-023/023A/043 AI boundary | PASS | BGE-M3/Qdrant through DMS AI Gateway; no direct cloud AI; mandatory owning Project filter |
| TypeScript strict | PASS | No `any`, no `console.log`, Thai comments/English identifiers |
| Domain terminology | PASS | RAG Attachment Chunk, Correspondence, RFA, Transmittal, Drawing, Circulation; no generic `document_public_id` payload |
| Human-in-the-loop | PASS | AI retrieval/indexing does not mutate workflow state; classification override is explicit and audited |

## Project Structure

### Documentation

```text
specs/200-fullstacks/254-rag-attachment-chunks/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── rag-ingestion.md
│   └── rag-retrieval.md
├── checklists/requirements.md
├── ledger.md
└── tasks.md
```

### Source Code

```text
backend/src/
├── common/
│   ├── file-storage/                         # secure ZIP/temp/Attachment handling reuse
│   └── processors/                            # document side-effects/cleanup consumers
├── modules/ai/
│   ├── entities/
│   │   ├── rag-attachment-generation.entity.ts
│   │   ├── rag-attachment-page.entity.ts
│   │   └── rag-attachment-chunk.entity.ts
│   ├── dto/
│   │   ├── rag-ingest-request.dto.ts
│   │   └── rag-query-response.dto.ts
│   ├── processors/
│   │   ├── rag-attachment-ingestion.processor.ts
│   │   └── rag-generation-cleanup.processor.ts
│   ├── services/
│   │   ├── rag-attachment-ingestion.service.ts
│   │   ├── rag-generation-swap.service.ts
│   │   ├── rag-text-segment.service.ts
│   │   ├── rag-classification.service.ts
│   │   └── rag-retrieval-guard.service.ts
│   └── controllers/
│       └── rag-attachment.controller.ts
├── modules/ai/qdrant.service.ts              # add generation/payload/delete contract
├── modules/ai/ai-queue.service.ts            # enqueue ingestion/metadata/cleanup jobs
└── modules/audit-log/                         # classification and generation audit events

specs/03-Data-and-Storage/
├── lcbp3-v1.9.0-schema-02-tables.sql         # canonical schema
├── 03-01-data-dictionary.md
└── deltas/2026-09-09-rag-attachment-chunks.sql

frontend/
├── lib/services/rag.service.ts               # query/citation API client if UI scope requires
├── hooks/use-rag-query.ts                     # TanStack Query integration if UI scope requires
└── components/ai/rag-citation-list.tsx       # user-safe citation display if UI scope requires
```

**Structure Decision**: Backend-first feature module under the existing AI Gateway/BullMQ/Qdrant architecture. Schema changes are direct SQL/delta only. Frontend changes are limited to user-safe RAG citation/query contracts; no generation UUID is exposed.

## Implementation Phases

### Phase 0: Schema and contract foundation

1. Add ADR-044 SQL delta for `rag_attachment_generations`, `rag_attachment_pages`, and `rag_attachment_chunks`.
2. Replace/retire the empty `document_chunks` definition under explicit database change approval.
3. Add data dictionary entries and indexes/FK constraints.
4. Add TypeORM entities and strict DTO/response types.
5. Add `document.classification_override` permission seed and RBAC mapping.

### Phase 1: Ingestion and generation lifecycle

1. Add checksum readiness guard and Attachment/source owner resolver.
2. Implement generic `TextSegment[]` contract and page/section/sheet/whole-document persistence.
3. Implement 512-token/64-token-overlap chunking with normalized offsets.
4. Implement ZIP secure extraction with ClamAV and size/depth/file-count limits.
5. Implement generation creation, Redlock, build-then-swap, ACTIVE invariant, and FAILED handling.
6. Integrate BGE-M3 dense+sparse embedding and Qdrant point payload.
7. Add BullMQ retry/backoff, RETIRED cleanup, and pending vector deletion recovery.

### Phase 2: Retrieval guard and citations

1. Enforce owning `project_public_id` at Qdrant search.
2. Batch-validate Qdrant results against ACTIVE generation rows.
3. Implement stale-result skip and full-text fallback.
4. Return user-safe citation fields with `chunkPublicId`, source locator, segment, offsets, snippet, and score.
5. Add metadata-only Qdrant payload synchronization without re-embedding.

### Phase 3: Classification and operational controls

1. Implement effective Attachment classification from Document Security Policy.
2. Add Security/System Admin classification override with reason and audit.
3. Add metrics for BUILDING/ACTIVE/FAILED/RETIRED generations, stale vector results, fallback rate, cleanup failures, and checksum mismatches.
4. Add retention worker for FAILED metadata/errors after 30 days.
5. Add operational runbook and SQL application/rollback instructions.

### Phase 4: Verification and rollout

1. Unit tests for entities, state transitions, chunking, offsets, ZIP security, classification, and payload builders.
2. Integration tests for MariaDB transaction/Redlock/generation swap and Qdrant cleanup.
3. Qdrant isolation tests for owning Project and receiving Project denial.
4. E2E tests for ingestion, citation, metadata-only sync, replacement, failure recovery, and ZIP fixtures.
5. Run build, lint, typecheck, backend/frontend tests, security scan, and review ledger evidence.

## Ledger Decision

**Ledger Required**: Yes.

Reason: This is Tier 3 AI/RAG work, changes protected schema and AI boundaries, introduces asynchronous generation state, touches Qdrant tenant isolation, and is expected to span multiple implementation checkpoints.

**Ledger Path**: `specs/200-fullstacks/254-rag-attachment-chunks/ledger.md`
**Assurance Unit ID**: `lcbp3/ai/rag-attachment-chunks`

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| Separate generation/page/chunk aggregates | Build-then-swap, citation integrity, failure recovery, and one ACTIVE invariant | Single chunk table cannot represent lifecycle and page canonical source safely |
| Generic TextSegment contract | PDF, Office, Drawing, and ZIP inner files have different source-location semantics | Forcing all sources into page numbers creates false citations |
| Metadata + Qdrant asynchronous sync | Qdrant is external to the MariaDB transaction | Blocking the document mutation on Qdrant reduces reliability and violates queue policy |
