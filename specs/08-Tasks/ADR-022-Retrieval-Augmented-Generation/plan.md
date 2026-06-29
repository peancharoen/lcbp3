# Implementation Plan: ADR-022 — RAG (Retrieval-Augmented Generation)

**Branch**: `main` (ADR-022 scope) | **Date**: 2026-04-19 | **Spec**: [v1.1.2 Guide](./LCBP3-RAG-Implementation-Guide-v1.1.2.md)
**Input**: `specs/06-Decision-Records/ADR-022-Retrieval-Augmented-Generation/LCBP3-RAG-Implementation-Guide-v1.1.2.md`

---

## Summary

ระบบ RAG (Retrieval-Augmented Generation) สำหรับ LCBP3 DMS ช่วยให้ผู้ใช้สามารถ Q&A ภาษาไทยบนเอกสารโครงการผ่าน Hybrid Search (vector + keyword) โดยมีการ isolate ข้อมูลระหว่างโครงการด้วย Qdrant Tiered Multitenancy และ RBAC enforcement ทุก query

**Ingestion Pipeline**: PDF → Tesseract OCR → PyThaiNLP normalize → Chunk → nomic-embed-text → Qdrant
**Query Pipeline**: Auth/RBAC → Embed question → Hybrid Search → Re-rank (top 5) → Build context → Typhoon API (primary) / Ollama local (fallback / CONFIDENTIAL) → Response + citations

---

## Technical Context

| Item | Value |
|------|-------|
| **Language/Version** | TypeScript 5.x (NestJS 10), Python 3.11 (PyThaiNLP microservice) |
| **Primary Dependencies** | `@qdrant/js-client-rest`, `bullmq`, `ioredis`, `@nestjs/bull`, `axios` (Typhoon + Ollama) |
| **Storage** | MariaDB (metadata + chunks index), Qdrant v1.16+ (vector store), Redis 7 (queue + cache) |
| **Testing** | Jest (NestJS), Vitest (frontend hooks) — coverage ≥ 80% business logic |
| **Target Platform** | QNAP NAS Docker Compose (NestJS, Qdrant, Redis), Admin Desktop Desk-5439 (Ollama, OCR, PyThaiNLP) |
| **Project Type** | Web application (NestJS backend + Next.js frontend) |
| **Performance Goals** | Typhoon primary p95 < 3s; Ollama fallback p95 < 10s; per-service timeout 5s |
| **Constraints** | CONFIDENTIAL → local Ollama only (ADR-018); rag_status in `attachments` (ADR-009); project_public_id filter mandatory |
| **Scale/Scope** | ~100K vectors initial; multi-project tiered multitenancy; parallel BullMQ workers |

---

## Constitution Check (AGENTS.md / ADR compliance)

_GATE: Must pass before Phase 0 research._

| Gate | Status | Notes |
|------|--------|-------|
| 🔴 Security — Auth, RBAC, Validation | ✅ PASS | CASL Guard (`manage:rag`) on all RAG endpoints; Zod input validation |
| 🔴 UUID Strategy (ADR-019) | ✅ PASS | `publicId` (UUIDv7) in all API responses; no `parseInt` on IDs |
| 🔴 Database correctness (ADR-009) | ✅ PASS | Schema delta SQL for `rag_status`; no TypeORM migrations |
| 🔴 AI boundary (ADR-018) | ✅ PASS | Ollama on Admin Desktop only; no direct DB/storage access by AI |
| 🔴 Error handling (ADR-007) | ✅ PASS | `BusinessException` + `GlobalExceptionFilter` used throughout |
| 🔴 No `any` types | ✅ PASS | `VectorMetadata`, `RagQueryDto`, `RagResponseDto` fully typed |
| 🔴 No `console.log` | ✅ PASS | `NestJS Logger` in all services |
| 🟡 Background jobs (ADR-008) | ✅ PASS | BullMQ queues: `ocr`, `thai-preprocess`, `embedding` |
| 🟡 Cache invalidation | ✅ PASS | Query result cache TTL 5min; vector cache on embed |
| ⚠️ Local LLM model name | 🔶 DEFERRED | Marked "Confidential" in spec → see research.md; use env var `OLLAMA_RAG_MODEL` |

_Re-check post Phase 1 design: all gates remain PASS._

---

## Project Structure

### Documentation (this feature)

```text
specs/06-Decision-Records/ADR-022-Retrieval-Augmented-Generation/
├── LCBP3-RAG-Implementation-Guide-v1.1.2.md  # Primary spec (clarified)
├── plan.md           # This file
├── research.md       # Phase 0 output
├── data-model.md     # Phase 1 output
├── quickstart.md     # Phase 1 output
└── contracts/
    └── rag-api.yaml  # OpenAPI contract
```

### Source Code (repository root)

```text
backend/src/modules/rag/
├── rag.module.ts
├── rag.controller.ts          # POST /rag/query, GET /rag/status/:id, DELETE /rag/vectors/:id
├── rag.service.ts             # Query pipeline orchestration
├── ingestion.service.ts       # Ingestion pipeline (BullMQ producer)
├── embedding.service.ts       # Ollama nomic-embed-text wrapper
├── qdrant.service.ts          # Qdrant CRUD + hybrid search
├── typhoon.service.ts         # Typhoon API + auto-failover logic
├── dto/
│   ├── rag-query.dto.ts
│   └── rag-response.dto.ts
├── entities/
│   └── document-chunk.entity.ts
├── processors/
│   ├── ocr.processor.ts           # BullMQ consumer: ocr queue
│   ├── thai-preprocess.processor.ts # BullMQ consumer: thai-preprocess queue
│   └── embedding.processor.ts     # BullMQ consumer: embedding queue
└── __tests__/
    ├── rag.service.spec.ts
    ├── ingestion.service.spec.ts
    └── qdrant.service.spec.ts

specs/03-Data-and-Storage/deltas/    # ADR-009: schema deltas อยู่ใน specs/ ไม่ใช่ backend/
├── 06-add-rag-status-to-attachments.sql
└── 06b-create-document-chunks.sql

frontend/components/rag/
├── rag-search-bar.tsx
├── rag-result-card.tsx
└── rag-fallback-badge.tsx

frontend/app/(dashboard)/rag/
└── page.tsx
```

---

## Rollout Phases

> ⚠️ **Note**: tasks.md จัดเรียง US1 (Query API) ก่อน US2 (Ingestion) เพื่อ MVP priority — ต้องการ validate query pipeline ประสิทธิภาพก่อนที่จะแวดเวลา ingest ครบ

### Phase 1 — Infrastructure (2 วัน)
- Qdrant + Redis services in docker-compose (QNAP)
- Ollama model pull on Admin Desktop
- Schema delta: rag_status in attachments (ADR-009)

### Phase 2 — Core NestJS Services (3 วัน)
- `EmbeddingService`, `QdrantService`, `TyphoonService`
- BullMQ queue setup (3 queues: rag:ocr, rag:thai-preprocess, rag:embedding)
- Unit tests

### Phase 3 — RAG Query API — **MVP** (2 วัน)
- `RagController` + `RagService`
- Hybrid search + score-based re-ranking (top 5) + context build
- Typhoon failover logic + prompt injection defense
- Integration tests

### Phase 4 — Ingestion Pipeline (3 วัน)
- `IngestionService` wired to attachment upload hook
- OCR → PyThaiNLP → Chunk → Embed → Qdrant
- rag_status lifecycle management

### Phase 5 — Frontend UI + Polish (3 วัน)
- RAG search page + result cards with citations
- `used_fallback_model` badge
- TanStack Query hooks
- Rate limiting + audit logging

---

## Complexity Tracking

_No constitution violations requiring justification._
