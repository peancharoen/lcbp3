# Implementation Plan: AI Model Revision (ADR-023A)

**Branch**: `main` | **Date**: 2026-05-15 | **Spec**: [spec.md](./spec.md)
**Feature Dir**: `specs/300-others/302-ai-model-revision/`

---

## Summary

Implement ADR-023A AI Architecture Revision: เปลี่ยน model stack จาก 3-model (gemma4:9b + Typhoon + nomic-embed-text) เป็น 2-model (gemma4:e4b Q8_0 + nomic-embed-text), แยก BullMQ เป็น 2 queues (`ai-realtime`/`ai-batch`), เพิ่ม OCR auto-detection, enforce multi-tenant QdrantService, implement Legacy Migration pipeline และ migration_review_queue, และลบ Typhoon Cloud API ออกจาก codebase ทั้งหมด

---

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode)
**Primary Dependencies**:
- Backend: NestJS 10, BullMQ 5, TypeORM 0.3, ioredis (Redis 7), @qdrant/js-client-rest
- AI Infrastructure: Ollama (Desk-5439), PaddleOCR, PyMuPDF (Python sidecar)
- Queue: Redis 7 (same instance as existing BullMQ)
**Storage**: MariaDB (existing) + Qdrant (external vector DB) + Local Storage (existing)
**Testing**: Jest (NestJS unit/integration)
**Target Platform**: QNAP NAS (NestJS container) + Admin Desktop Desk-5439 (Ollama)
**Performance Goals**: ai-suggest < 30s; rag-query < 10s (p95 dequeue-to-response)
**Constraints**: VRAM ≤ 5GB peak, concurrency=1 per queue (prevent GPU overflow)
**Scale/Scope**: ~20,000 legacy docs (migration), ~50 new docs/day (production)

---

## Constitution Check

_GATE: Must pass before Phase 0 research._

| Rule | Status | Notes |
|------|--------|-------|
| ADR-019 UUID: no parseInt on UUID | ✅ PASS | BullMQ payloads ใช้ `publicId: string` เสมอ |
| ADR-009: no TypeORM migrations | ✅ PASS | `migration_review_queue` ผ่าน SQL delta (#14) |
| ADR-016: RBAC on all endpoints | ✅ PASS | AI endpoints จะมี CASL guard: `ai.manage` |
| ADR-007: error handling layered | ✅ PASS | BullMQ failed jobs → dead-letter + log |
| ADR-008: BullMQ for async | ✅ PASS | Inference ทั้งหมดผ่าน BullMQ (ไม่มี inline) |
| ADR-023/023A: no direct Ollama | ✅ PASS | n8n → DMS API → BullMQ → Ollama เท่านั้น |
| ADR-023A: QdrantService required projectPublicId | ✅ PASS | Enforce ที่ TypeScript compile-time |
| TypeScript strict: no `any`, no `console.log` | ✅ PASS | Enforced ผ่าน eslint |
| **Typhoon Cloud API removal** | ⚠️ PENDING | `rag/typhoon.service.ts` ต้อง delete (T002) |

---

## Project Structure

### Documentation (this feature)

```text
specs/300-others/302-ai-model-revision/
├── spec.md              ✅ done
├── plan.md              ✅ this file
├── research.md          ✅ done
├── data-model.md        ✅ done
├── quickstart.md        (Phase 1)
├── contracts/           (Phase 1)
│   ├── ai-jobs.yaml
│   └── migration-queue.yaml
├── checklists/
│   └── requirements.md  ✅ done
└── tasks.md             (Phase 2 — speckit-tasks)
```

### Schema Delta (ADR-009)

```text
specs/03-Data-and-Storage/deltas/
└── 14-add-migration-review-queue.sql    # new
```

### Source Code

```text
backend/src/modules/ai/
├── ai.module.ts                         # update: register 2 queues, remove Typhoon
├── ai.controller.ts                     # update: add /migration/queue endpoint
├── ai.service.ts                        # update: routing logic, queue selection
├── processors/
│   ├── ai-realtime.processor.ts         # new: ai-realtime consumer
│   └── ai-batch.processor.ts            # new: ai-batch consumer (replaces existing)
├── services/
│   ├── ollama.service.ts                # update: model → gemma4:e4b
│   ├── qdrant.service.ts                # update: enforce projectPublicId param
│   ├── ocr.service.ts                   # new: OCR auto-detect + PaddleOCR routing
│   ├── migration.service.ts             # new: Legacy Migration pipeline
│   └── embedding.service.ts            # new: full-doc chunking + embed
├── dto/
│   ├── create-ai-job.dto.ts             # update: queue discriminator field
│   ├── migration-queue-item.dto.ts      # new
│   └── rag-query.dto.ts                 # new
├── entities/
│   └── migration-review-queue.entity.ts # new
└── rag/
    ├── rag.service.ts                   # update: remove typhoon ref, use QdrantService
    └── typhoon.service.ts               # DELETE ← Tier 1 critical

backend/src/config/
└── bullmq.config.ts                     # update: add ai-batch queue config

frontend/app/(dashboard)/ai-staging/
├── page.tsx                             # update: add migration queue tab
└── migration-review/
    └── page.tsx                         # new: Admin Migration Review UI

frontend/components/ai/
├── ai-suggestion-field.tsx              # update: confidence threshold display
├── migration-queue-table.tsx            # new: queue list + approve/reject
└── AiStatusBanner.tsx                   # update: show queue status (ai-batch paused)
```

---

## Phases

### Phase 0: Cleanup & Foundation (Tier 1 Critical First)

**Goal**: ลบ Typhoon ออก, ตั้ง BullMQ 2-queue, สร้าง Schema Delta

Tasks: T001–T008

### Phase 1: Core AI Pipeline

**Goal**: OCR auto-detect, gemma4:e4b integration, ai-suggest + embed-document flows

Tasks: T009–T022

### Phase 2: RAG Pipeline

**Goal**: QdrantService multi-tenancy, chunking, rag-query endpoint

Tasks: T023–T030

### Phase 3: Legacy Migration Pipeline

**Goal**: migration_review_queue, n8n API endpoint, Admin Review UI

Tasks: T031–T042

### Phase 4: Monitoring & Threshold Management

**Goal**: Admin Dashboard AI metrics, threshold config, audit log delete permission

Tasks: T043–T050

---

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|-----------|-------------------------------------|
| 2-queue BullMQ (vs single) | RAG SLA requires isolation from batch jobs | Single queue + priority ไม่ป้องกัน long-running job block |
| External Qdrant (vs SQL FTS) | Semantic search capability ไม่มีใน MariaDB FULLTEXT | MariaDB FTS ไม่รองรับ multilingual semantic similarity |
| Python sidecar OCR | PaddleOCR เป็น Python library ไม่มี Node.js binding | ไม่มีทางเลือก OCR ภาษาไทยที่เทียบเท่าใน Node.js ecosystem |
