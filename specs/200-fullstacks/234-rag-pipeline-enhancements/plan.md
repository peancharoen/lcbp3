// File: specs/200-fullstacks/234-rag-pipeline-enhancements/plan.md
// Change Log:
// - 2026-06-05: Initial implementation plan for RAG Pipeline Enhancements

# Implementation Plan: RAG Pipeline Enhancements

**Branch**: `234-rag-pipeline-enhancements` | **Date**: 2026-06-05 | **Spec**: [spec.md](./spec.md)
**ADR Reference**: [ADR-035](../../06-Decision-Records/ADR-035-ai-pipeline-flow-architecture.md)

---

## Summary

เพิ่ม BGE-M3 embedding + BGE-Reranker-Large + Semantic Chunking เข้า OCR Sidecar, แปลง Qdrant collection `lcbp3_vectors` เป็น Hybrid (1024 dims), และ wire RAG Prep trigger ที่ `syncStatus()` เมื่อเอกสาร Correspondence ผ่าน DRAFT → SUBOWN

แนวทาง: เพิ่ม `/embed` + `/rerank` ใน `app.py` → refactor `EmbeddingService` + `AiQdrantService` → เพิ่ม `rag-prepare` case ใน `AiBatchProcessor` → hook trigger ใน `CorrespondenceWorkflowService`

---

## Technical Context

**Language/Version**: Python 3.11 (Sidecar), TypeScript 5.x / NestJS 11 (Backend)
**Primary Dependencies**: `FlagEmbedding>=1.2.0` (BGE-M3 + Reranker), `@qdrant/js-client-rest`, BullMQ 5, Ollama
**Storage**: Qdrant (vector DB), MariaDB 11.8 (metadata), Redis (job state)
**Testing**: Jest (backend unit + integration)
**Target Platform**: Docker on Desk-5439 (Windows 10, CPU RAM for BGE-M3)
**Project Type**: Web application (backend + sidecar)
**Performance Goals**: embed 50-page doc < 5 min; RAG query < 30s end-to-end
**Constraints**: BGE-M3 ~2.3GB + Reranker ~1.5GB on CPU RAM; BullMQ concurrency=1 (ai-batch)
**Scale/Scope**: Correspondence module only — embed เมื่อ status OUT_OF_DRAFT

---

## Constitution Check

| Rule | Status | Note |
|------|--------|------|
| ADR-019: ไม่มี parseInt บน UUID | ✅ Pass | ใช้ `publicId` string ตลอด |
| ADR-009: No TypeORM migrations | ✅ Pass | เพิ่ม `rag_chunking` prompt ผ่าน SQL delta |
| ADR-008: BullMQ สำหรับ background jobs | ✅ Pass | `rag-prepare` ผ่าน `ai-batch` queue |
| ADR-023A: AI boundary — ไม่ bypass queue | ✅ Pass | Controller → Queue → Processor → Sidecar |
| ADR-023A: `projectPublicId` mandatory filter | ✅ Pass | enforce ใน `AiQdrantService` |
| ADR-029: Prompt จาก `ai_prompts` DB | ✅ Pass | `rag_chunking` prompt type ใหม่ |
| ADR-007: Error handling layered | ✅ Pass | retry 3x ใน BullMQ + fallback chunking |
| ADR-016: CASL guard | ✅ Pass | ใช้ guard เดิมของ ai module |

---

## Project Structure

### Documentation (this feature)

```text
specs/200-fullstacks/234-rag-pipeline-enhancements/
├── plan.md          ← this file
├── spec.md
├── data-model.md    ← Phase 1
├── contracts/       ← Phase 1
│   ├── POST-embed.md
│   └── POST-rerank.md
└── tasks.md         ← Phase 2 (speckit-tasks)
```

### Source Code

```text
specs/04-Infrastructure-OPS/04-00-docker-compose/Desk-5439/ocr-sidecar/
├── app.py                    ← เพิ่ม /embed + /rerank + BGE-M3 init
└── requirements.txt          ← เพิ่ม FlagEmbedding>=1.2.0

backend/src/modules/ai/
├── qdrant.service.ts         ← Hybrid schema, vector size 1024, payload ครบ 10 fields
├── services/
│   └── embedding.service.ts  ← semantic chunking + BGE-M3 via Sidecar
├── ai-rag.service.ts         ← BGE-M3 embed + Reranker step
├── ai-queue.service.ts       ← เพิ่ม enqueueRagPrepare()
└── processors/
    └── ai-batch.processor.ts ← เพิ่ม case 'rag-prepare'

backend/src/modules/correspondence/
└── correspondence-workflow.service.ts  ← trigger rag-prepare ใน syncStatus()

specs/03-Data-and-Storage/deltas/
└── 2026-06-05-add-rag-chunking-prompt.sql
```

**Structure Decision**: Web application — backend NestJS + Python sidecar; ไม่มี frontend changes ใน scope นี้

---

## Phase 0: Research Findings

### R1 — BGE-M3 Python API (FlagEmbedding)

```python
from FlagEmbedding import BGEM3FlagModel
model = BGEM3FlagModel('BAAI/bge-m3', use_fp16=False)  # CPU mode
output = model.encode(['text'], return_dense=True, return_sparse=True)
# output['dense_vecs']      → list[float] ขนาด 1024
# output['lexical_weights'] → dict {token_id: float}
# แปลง sparse: indices = list(keys), values = list(values)
```

### R2 — BGE-Reranker Python API

```python
from FlagEmbedding import FlagReranker
reranker = FlagReranker('BAAI/bge-reranker-large', use_fp16=False)
scores = reranker.compute_score([['query', chunk] for chunk in chunks])
# คืน list[float] — sort descending เพื่อได้ top-N
```

### R3 — Qdrant Hybrid Collection (JS Client)

```typescript
// drop + recreate
await client.deleteCollection('lcbp3_vectors');
await client.createCollection('lcbp3_vectors', {
  vectors: { bge_dense: { size: 1024, distance: 'Cosine' } },
  sparse_vectors: { bge_sparse: {} }
});

// upsert hybrid point
await client.upsert('lcbp3_vectors', { points: [{
  id: uuid,
  vector: { bge_dense: denseArray, bge_sparse: { indices, values } },
  payload: { doc_public_id, project_public_id, doc_number, doc_type,
             status_code, revision_number, subject, document_date,
             chunk_topic, chunk_index, chunk_text }
}]});

// hybrid search (RRF fusion)
await client.query('lcbp3_vectors', {
  prefetch: [
    { query: { indices, values }, using: 'bge_sparse', limit: 20 },
    { query: denseArray,          using: 'bge_dense',  limit: 20 },
  ],
  query: { fusion: 'rrf' },
  limit: 15,
  filter: { must: [{ key: 'project_public_id', match: { value: projectId } }] }
});
```

### R4 — OCR Text Cache

`correspondence_revisions` ไม่มี field เก็บ OCR text โดยตรง — `rag-prepare` job รับ `cachedOcrText?: string` ใน payload; ถ้าไม่มีให้เรียก Sidecar `/ocr` ผ่าน attachment path

---

## Phase 1: Implementation Design

### API Contracts

**Sidecar — POST /embed**
```
Request:  { "text": string }
Response: { "dense": number[1024], "sparse": { "indices": number[], "values": number[] } }
Auth:     X-API-Key header (ค่าเดิมจาก app.py)
```

**Sidecar — POST /rerank**
```
Request:  { "query": string, "chunks": string[] }
Response: { "scores": number[], "ranked_indices": number[] }
Auth:     X-API-Key header
```

**Backend internal type — RagPrepareJobPayload**
```typescript
interface RagPrepareJobPayload {
  documentPublicId: string;
  projectPublicId: string;
  correspondenceNumber: string;
  docType: string;
  statusCode: string;
  revisionNumber: number;
  subject: string;
  documentDate?: string;
  cachedOcrText?: string;
  attachmentPath?: string;
}
```

### Implementation Phases

#### Phase A — OCR Sidecar (ไม่กระทบ endpoints เดิม)

1. `requirements.txt` — เพิ่ม `FlagEmbedding>=1.2.0`
2. `app.py` — โหลด BGE-M3 + Reranker ตอน startup (global singleton, CPU)
3. `app.py` — เพิ่ม `POST /embed` endpoint
4. `app.py` — เพิ่ม `POST /rerank` endpoint

#### Phase B — AiQdrantService: Hybrid Schema

5. `AI_VECTOR_SIZE` = 1024 (เดิม 768)
6. `ensureCollection()` → drop + recreate Hybrid collection
7. `upsert()` → รับ `denseVector` + `sparseVector` + payload ครบ 11 fields (รวม `chunk_text`)
8. `search()` / `searchByProject()` → Hybrid query (RRF fusion)
9. `deleteByDocumentPublicId()` → filter บน `doc_public_id` payload field

#### Phase C — EmbeddingService: Semantic Chunking + BGE-M3

10. `semanticChunkText(ocrText)` method — call typhoon2.5 ด้วย prompt `rag_chunking` จาก `ai_prompts`
11. `parseChunkTags(llmOutput)` — parse `<chunk topic="...">` tags, fallback fixed-size
12. `embedChunk(text)` — เรียก Sidecar `POST /embed` แทน Ollama nomic

#### Phase D — AiQueueService + AiBatchProcessor

13. `ai-queue.service.ts` → `enqueueRagPrepare(payload: RagPrepareJobPayload)`
14. `ai-batch.processor.ts` → กำหนด concurrency = 1 ใน `@Processor` และเพิ่ม `case 'rag-prepare': processRagPrepare(data)`
15. `processRagPrepare()` — OCR (cached/fallback) → chunk → normalize → embed → delete old → upsert

#### Phase E — AiRagService: Reranker Integration

16. `embed(text)` → เรียก Sidecar `/embed` แทน Ollama
17. เพิ่ม rerank step หลัง `searchByProject()` → Sidecar `/rerank` → top 3-5 chunks

#### Phase F — Trigger Hook

18. `CorrespondenceWorkflowService` → inject `AiQueueService`
19. `syncStatus()` → หลัง save ถ้า `targetCode !== 'DRAFT'` → `enqueueRagPrepare()`

#### Phase G — SQL Delta + Tests

20. `deltas/2026-06-05-add-rag-chunking-prompt.sql` — INSERT `ai_prompts` (`rag_chunking`)
21. Unit tests: `embedding.service.spec.ts` (semantic chunking, fallback)
22. Unit tests: `ai-batch.processor.spec.ts` (rag-prepare case)

---

## Risks & Mitigations

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| BGE-M3 ใช้ RAM > 4GB บน Desk-5439 | Medium | ทดสอบ RAM ก่อน deploy; ใช้ `use_fp16=False` CPU mode |
| Qdrant drop collection → Chat Q&A unavailable ชั่วคราว | Low | deploy off-hours; Flow 4 return empty ไม่ error |
| Semantic chunking ไม่มี `<chunk>` tag | Medium | fallback fixed-size chunking ป้องกัน job fail |
| `syncStatus()` trigger ซ้ำซ้อน | Low | delete + re-embed เป็น idempotent |
