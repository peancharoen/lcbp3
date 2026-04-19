# Tasks: ADR-022 — RAG (Retrieval-Augmented Generation)

**Input**: Design documents from `specs/06-Decision-Records/ADR-022-Retrieval-Augmented-Generation/`
**Prerequisites**: plan.md ✅ | spec (v1.1.2 clarified) ✅ | research.md ✅ | data-model.md ✅ | contracts/rag-api.yaml ✅

**Total Tasks**: 39 | **User Stories**: 5 | **Parallel opportunities**: 22 tasks

## Format: `[ID] [P?] [Story?] Description with file path`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: User story this task belongs to (US1–US5)
- No story label = Setup or Foundational phase

---

## User Stories (derived from spec v1.1.2 + plan.md)

| ID | Priority | Story | Goal |
|----|----------|-------|------|
| US1 | P1 🎯 MVP | RAG Query API | ผู้ใช้ถามคำถามจากเอกสารโครงการและได้คำตอบพร้อม citation |
| US2 | P2 | Auto Ingestion | เอกสารที่ commit เข้าระบบถูก index อัตโนมัติ (OCR→PyThaiNLP→Embed→Qdrant) |
| US3 | P3 | Status & Re-ingest | Admin ตรวจสอบสถานะ ingestion และ trigger re-index สำหรับไฟล์ที่ FAILED |
| US4 | P4 | Vector Cleanup | เมื่อลบเอกสาร vectors ใน Qdrant ถูกลบตามโดยอัตโนมัติ |
| US5 | P5 | Frontend UI | ผู้ใช้ใช้งาน RAG ผ่าน search page ในระบบ DMS |

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: เตรียม infrastructure, environment, และ schema delta ก่อนเริ่ม implement

- [ ] T001 Create RagModule skeleton in `backend/src/modules/rag/rag.module.ts` (empty module, imports BullMQ + TypeORM)
- [ ] T002 [P] Add schema delta `06-add-rag-status-to-attachments.sql` to `specs/03-Data-and-Storage/deltas/` (per data-model.md §1.1)
- [ ] T003 [P] Add schema delta `06b-create-document-chunks.sql` to `specs/03-Data-and-Storage/deltas/` (per data-model.md §1.2)
- [ ] T004 [P] Add Qdrant + Redis services to `backend/docker-compose.yml` (per quickstart.md Step 1)
- [ ] T005 [P] Add RAG environment variables to `backend/.env.example` (`QDRANT_URL`, `OLLAMA_EMBED_MODEL`, `OLLAMA_RAG_MODEL`, `THAI_PREPROCESS_URL`, `TYPHOON_API_KEY`, `RAG_TOPK`, `RAG_FINAL_K`, `RAG_TIMEOUT_MS`, `RAG_QUERY_CACHE_TTL`)

**Checkpoint**: Infrastructure ready — schema deltas applied, docker services running, env vars configured

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core services ที่ทุก User Story ต้องใช้ — **ต้องเสร็จก่อนเริ่ม Phase 3+**

**⚠️ CRITICAL**: ห้ามเริ่ม User Story ใดๆ จนกว่า Phase 2 จะสมบูรณ์

- [ ] T006 Create `DocumentChunk` TypeORM entity in `backend/src/modules/rag/entities/document-chunk.entity.ts` (per data-model.md §3.1 — id, documentId, chunkIndex, content, docType, docNumber, revision, projectCode, projectPublicId, classification, embeddingModel, createdAt)
- [ ] T007 [P] Create `RagQueryDto` + `RagResponseDto` + `Citation` interfaces in `backend/src/modules/rag/dto/rag-query.dto.ts` and `backend/src/modules/rag/dto/rag-response.dto.ts` (per data-model.md §4, contracts/rag-api.yaml) — **EC-RAG-004**: ห้ามมี `maxClassification` field ใน RagQueryDto — classification ต้อง derive server-side จาก user role เท่านั้น
- [ ] T008 [P] Create `EmbeddingService` (Ollama nomic-embed-text wrapper, returns 768-dim vector) in `backend/src/modules/rag/embedding.service.ts`
- [ ] T009 [P] Create `QdrantService` (collection init with is_tenant=true, upsert points, hybrid search merge 0.7/0.3, delete by documentId) in `backend/src/modules/rag/qdrant.service.ts` (per research.md R3, R4) — **EC-RAG-003**: implement `OnModuleInit` เพื่อ auto-create collection `lcbp3_vectors` (HNSW `payload_m:16, m:0`) ตอน startup; ถ้า Qdrant ไม่ตอบสนอง log ERROR + set `collectionReady = false` ห้าม throw
- [ ] T010 Create `TyphoonService` (Typhoon API call + auto-failover Promise.race to Ollama on timeout/5xx, `used_fallback_model` flag) in `backend/src/modules/rag/typhoon.service.ts` (depends T008, per research.md R6)
- [ ] T011 Wire BullMQ queues (`rag:ocr`, `rag:thai-preprocess`, `rag:embedding`) with DLQ config in `backend/src/modules/rag/rag.module.ts` (per research.md R5 — max 3 retries, delay backoff)

**Checkpoint**: Core services built and unit-testable — EmbeddingService, QdrantService, TyphoonService isolated

---

## Phase 3: User Story 1 — RAG Query API (P1 🎯 MVP)

**Goal**: `POST /api/rag/query` ค้นหา context + สร้างคำตอบ AI พร้อม citation ตาม RBAC + tenant isolation

**Independent Test**:
```bash
curl -X POST http://localhost:3001/api/rag/query \
  -H "Authorization: Bearer <token>" \
  -d '{"question":"เอกสารนี้เกี่ยวกับอะไร?","projectPublicId":"<uuid>"}'
# ต้องได้ {"data":{"answer":"...","citations":[...],"fallbackUsed":false}}
```

### Implementation for User Story 1

- [ ] T012 [P] [US1] Create `RagService.query()` pipeline in `backend/src/modules/rag/rag.service.ts`:
  1. Derive `classificationCeiling` จาก user role (Admin/Manager→CONF, Member→INT, Guest→PUB) — **EC-RAG-004**
  2. Check `collectionReady` flag → return 503 ถ้า false — **EC-RAG-003**
  3. Check Redis cache key `SHA256(question+projectPublicId+classificationCeiling)` — skip cache ถ้า CONFIDENTIAL — **EC-RAG-005**
  4. Embed question → hybrid search QdrantService → filter ACL → score-based re-rank top 5 → build context ≤3000 tokens
  5. Route LLM: CONFIDENTIAL → Ollama local เท่านั้น; PUBLIC/INTERNAL → TyphoonService (with fallover) — **ADR-018**
  6. Write cache ถ้า PUBLIC/INTERNAL, TTL 5min — **EC-RAG-005**
  7. Return RagResponseDto
- [ ] T013 [P] [US1] Create `RagService.buildContext()` helper (format `[DOC_TYPE - DOC_NUMBER - REV]\nsnippet`, limit 3–5 docs) in `backend/src/modules/rag/rag.service.ts`
- [ ] T014 [P] [US1] Add CASL permission `manage:rag` to `backend/src/database/seeds/seed-permissions.sql`
- [ ] T015 [US1] Create `RagController` with `POST /rag/query` endpoint (CASL guard `manage:rag`, Zod/class-validator, Idempotency-Key header, NestJS Logger, ADR-007 error handling) in `backend/src/modules/rag/rag.controller.ts` (depends T012, T014)
- [ ] T016 [US1] Register `RagModule` in `backend/src/app.module.ts` (depends T015)
- [ ] T017 [US1] Write unit tests for `RagService.query()` in `backend/src/modules/rag/__tests__/rag.service.spec.ts` covering:
  - success path (PUBLIC, cache miss → cache write)
  - cache hit returns cached result without Qdrant call
  - CONFIDENTIAL → Ollama only, **no cache read/write** (EC-RAG-005)
  - `collectionReady=false` → 503 RAG_NOT_READY (EC-RAG-003)
  - cross-project cache isolation: same question different project → different cache key (EC-RAG-005)
  - classification ceiling derived from role, not from request (EC-RAG-004)

**Checkpoint**: `POST /api/rag/query` returns answer + citations; CONFIDENTIAL routing verified; tenant isolation tested

---

## Phase 4: User Story 2 — Auto Ingestion Pipeline (P2)

**Goal**: เมื่อไฟล์ถูก commit เข้า permanent storage → rag_status: PENDING→PROCESSING→INDEXED อัตโนมัติ

**Independent Test**:
```bash
# Upload + commit file → check rag_status
curl http://localhost:3001/api/rag/status/<attachment-uuid> -H "Authorization: Bearer <token>"
# ต้องได้ {"data":{"ragStatus":"INDEXED","chunkCount":12}}
```

### Implementation for User Story 2

- [ ] T018 [P] [US2] Create `OcrProcessor` BullMQ consumer (read attachment, call Tesseract OCR, enqueue `rag:thai-preprocess`) in `backend/src/modules/rag/processors/ocr.processor.ts`
- [ ] T019 [P] [US2] Create `ThaiPreprocessProcessor` BullMQ consumer (HTTP POST to `THAI_PREPROCESS_URL`, normalize text, enqueue `rag:embedding`) in `backend/src/modules/rag/processors/thai-preprocess.processor.ts` (per research.md R2)
- [ ] T020 [P] [US2] Create `EmbeddingProcessor` BullMQ consumer (chunk text per Section 6 strategy, call EmbeddingService, upsert QdrantService batch, save DocumentChunk rows, update rag_status=INDEXED) in `backend/src/modules/rag/processors/embedding.processor.ts`
- [ ] T021 [US2] Create `IngestionService` in `backend/src/modules/rag/ingestion.service.ts` (depends T018, T019, T020):
  - enqueue `rag:ocr` job โดยใช้ `attachmentId` เป็น BullMQ `jobId` (native dedup) — **EC-RAG-001**
  - ถ้า job นั้น active/waiting อยู่แล้ว → log `'rag:ocr job already queued'` และ return silently
  - manage rag_status lifecycle: PENDING→PROCESSING→INDEXED/FAILED
  - DLQ → set rag_status=FAILED + rag_last_error
- [ ] T022 [US2] Hook `IngestionService.enqueue()` into `StorageService.commitFile()` in `backend/src/common/storage/storage.service.ts` (trigger ingestion when file moves to permanent, depends T021)
- [ ] T023 [US2] Write unit tests for `IngestionService` in `backend/src/modules/rag/__tests__/ingestion.service.spec.ts` covering:
  - successful enqueue with attachmentId as jobId
  - duplicate enqueue → second call is no-op, log only (EC-RAG-001)
  - OcrProcessor double-check: rag_status=PROCESSING → return MoveToCompleted (EC-RAG-001)
  - FAILED after 3 retries → rag_last_error set
  - rag_status transitions: PENDING→PROCESSING→INDEXED/FAILED

**Checkpoint**: Upload a PDF → BullMQ processes → rag_status=INDEXED → chunks in Qdrant; verify with GET /rag/status

---

## Phase 5: User Story 3 — Status & Re-ingestion Management (P3)

**Goal**: Admin ดู `ragStatus` ของ attachment และ trigger re-index สำหรับไฟล์ที่ FAILED

**Independent Test**:
```bash
# GET status
curl http://localhost:3001/api/rag/status/<uuid> -H "Authorization: Bearer <token>"
# POST re-ingest (ต้อง FAILED state)
curl -X POST http://localhost:3001/api/rag/ingest/<uuid> -H "Authorization: Bearer <token>"
```

### Implementation for User Story 3

- [ ] T024 [P] [US3] Add `RagService.getStatus()` (query attachments.rag_status + COUNT document_chunks) in `backend/src/modules/rag/rag.service.ts`
- [ ] T025 [P] [US3] Add `RagService.reIngest()` in `backend/src/modules/rag/rag.service.ts` — **EC-RAG-002** cleanup order (mandatory):
  1. Validate rag_status = FAILED → throw BusinessException ถ้าไม่ใช่
  2. DELETE document_chunks WHERE document_id = attachmentId (DB transaction)
  3. DELETE Qdrant points by documentId filter (log ERROR ถ้า fail แต่ดำเนินต่อ)
  4. SET rag_status = PENDING + clear rag_last_error
  5. Enqueue `rag:ocr` job with attachmentId as jobId (EC-RAG-001)
- [ ] T026 [US3] Add `GET /rag/status/:attachmentId` + `POST /rag/ingest/:attachmentId` endpoints to `RagController` in `backend/src/modules/rag/rag.controller.ts` (CASL guard, validate FAILED state before re-ingest, depends T024, T025)

**Checkpoint**: GET status returns correct ragStatus + chunkCount; POST re-ingest only works on FAILED files; non-FAILED returns 400

---

## Phase 6: User Story 4 — Vector Cleanup on Document Delete (P4)

**Goal**: เมื่อ attachment ถูก soft-delete → Qdrant vectors + document_chunks rows ถูกลบตาม (data consistency)

**Independent Test**:
```bash
# Delete attachment → verify vectors gone
curl -X DELETE http://localhost:3001/api/rag/vectors/<uuid> -H "Authorization: Bearer <token>"
# Qdrant should return 0 points for deleted documentId
```

### Implementation for User Story 4

- [ ] T027 [P] [US4] Add `RagService.deleteVectors()` (delete Qdrant points by documentId filter, delete document_chunks rows, reset rag_status=PENDING) in `backend/src/modules/rag/rag.service.ts`
- [ ] T028 [P] [US4] Add `DELETE /rag/vectors/:attachmentId` endpoint to `RagController` in `backend/src/modules/rag/rag.controller.ts` (CASL guard `manage:rag`, depends T027)
- [ ] T029 [US4] Hook `RagService.deleteVectors()` into `AttachmentService` soft-delete flow in `backend/src/modules/` (find the existing attachment delete service, call deleteVectors, depends T028)

**Checkpoint**: Delete attachment → GET /rag/status returns PENDING (no chunks); Qdrant confirms 0 points for that documentId

---

## Phase 7: User Story 5 — Frontend UI (P5)

**Goal**: ผู้ใช้ค้นหาและรับคำตอบ AI จาก RAG บน search page พร้อม citation cards และ fallback badge

**Independent Test**: เปิด `/rag` → พิมพ์คำถาม → เห็นคำตอบ + citation cards + "ใช้ local model" badge (เมื่อ fallbackUsed=true)

### Implementation for User Story 5

- [ ] T030 [P] [US5] Create `useRagQuery` TanStack Query hook (POST /api/rag/query, loading/error/success states) in `frontend/hooks/use-rag.ts`
- [ ] T031 [P] [US5] Create `RagSearchBar` component (input + submit, loading spinner, Zod validation question ≤500 chars) in `frontend/components/rag/rag-search-bar.tsx`
- [ ] T032 [P] [US5] Create `RagResultCard` component (answer, citation list with docNumber/docType/snippet/score, confidence indicator) in `frontend/components/rag/rag-result-card.tsx`
- [ ] T033 [P] [US5] Create `RagFallbackBadge` component (แสดงเมื่อ `fallbackUsed=true` — "ใช้ local model คุณภาพอาจลดลง") in `frontend/components/rag/rag-fallback-badge.tsx`
- [ ] T034 [US5] Create RAG search page with `RagSearchBar` + `RagResultCard` + `RagFallbackBadge` in `frontend/app/(dashboard)/rag/page.tsx` (depends T030, T031, T032, T033)

**Checkpoint**: Navigate to `/rag` → search → see answer with citations; fallback badge appears when Typhoon is down

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Security hardening, observability, admin tools

- [ ] T035 [P] Add `@Throttle()` rate limiting to `RagController` (prevent Q&A abuse) in `backend/src/modules/rag/rag.controller.ts`
- [ ] T036 [P] Add structured audit logging for every RAG query (user_id, projectPublicId, question_hash, retrieved doc_ids, llm_provider, latency_ms, confidence) to `RagService.query()` in `backend/src/modules/rag/rag.service.ts` (per v1.1.1 audit_log schema)
- [ ] T037 [P] Add prompt injection defense to `TyphoonService` (boundary markers `<CONTEXT_START>/<CONTEXT_END>`, JSON-only output mode, post-gen citation validation) in `backend/src/modules/rag/typhoon.service.ts` (per research.md R7)
- [ ] T038 Add admin endpoint `POST /rag/admin/init-collection` (create Qdrant collection `lcbp3_vectors` if not exists, create payload indexes) in `backend/src/modules/rag/rag.controller.ts`
- [ ] T039 [P] Write unit tests for `QdrantService` (collection init, upsert batch, hybrid search merge 0.7/0.3, delete by documentId, tenant filter enforcement) in `backend/src/modules/rag/__tests__/qdrant.service.spec.ts`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: ไม่มี dependency — เริ่มได้ทันที
- **Phase 2 (Foundational)**: ต้องเสร็จ Phase 1 — **blocks ทุก User Story**
- **Phase 3–7 (User Stories)**: ทุก story ต้องรอ Phase 2 เสร็จ; สามารถทำคู่ขนานได้หากมีทีม
- **Phase 8 (Polish)**: ต้องรอ Phase 3 เสร็จ (ต้องมี RagController + RagService ก่อน)

### User Story Dependencies

| Story | Depends On | หมายเหตุ |
|-------|-----------|----------|
| US1 (P1) | Phase 2 complete | Core RAG query — สามารถทำได้โดยไม่ต้องรอ ingestion |
| US2 (P2) | Phase 2 + US1 rag_status | IngestionService ใช้ QdrantService เดียวกับ US1 |
| US3 (P3) | Phase 2 + T021 (IngestionService) | ต้องมี IngestionService.enqueue() ก่อน |
| US4 (P4) | Phase 2 + T027 (deleteVectors) | สามารถทำคู่ขนานกับ US2 ได้ |
| US5 (P5) | US1 API endpoint ready (T015) | Frontend ต้องการ POST /rag/query ทำงานก่อน |

### Parallel Opportunities

- T002, T003, T004, T005 — ทำพร้อมกันใน Phase 1
- T007, T008, T009 — ทำพร้อมกันใน Phase 2
- T012, T013, T014 — ทำพร้อมกันใน Phase 3
- T018, T019, T020 — ทำพร้อมกันใน Phase 4
- T024, T025 — ทำพร้อมกันใน Phase 5
- T027, T028 — ทำพร้อมกันใน Phase 6
- T030, T031, T032, T033 — ทำพร้อมกันใน Phase 7

---

## Parallel Example: Phase 2 (Foundational)

```bash
# ทำพร้อมกัน (different files):
Task T007: "Create RagQueryDto + RagResponseDto in backend/src/modules/rag/dto/"
Task T008: "Create EmbeddingService in backend/src/modules/rag/embedding.service.ts"
Task T009: "Create QdrantService in backend/src/modules/rag/qdrant.service.ts"

# รอ T008 เสร็จก่อน:
Task T010: "Create TyphoonService in backend/src/modules/rag/typhoon.service.ts"
```

---

## Implementation Strategy

### MVP First (US1 Only — ~5 วัน)

1. Phase 1: Setup (1 วัน) — T001–T005
2. Phase 2: Foundational (2 วัน) — T006–T011
3. Phase 3: US1 RAG Query API (2 วัน) — T012–T017
4. **STOP และ VALIDATE**: ทดสอบ POST /api/rag/query ด้วย indexed documents
5. Deploy / demo MVP ได้ทันที

### Incremental Delivery

1. MVP (Phase 1–3) → RAG query พร้อมใช้งาน
2. + US2 (Phase 4) → Auto-ingestion on upload
3. + US3 (Phase 5) → Admin status monitoring
4. + US4 (Phase 6) → Data consistency on delete
5. + US5 (Phase 7) → Frontend search UI
6. + Phase 8 → Security hardening + audit logs

### Parallel Team Strategy (2+ developers)

```
Developer A (Backend):  Phase 1 → Phase 2 → Phase 3 (US1) → Phase 4 (US2)
Developer B (Backend):  Phase 2 (parallel T007/T008/T009) → Phase 5+6 (US3+US4)
Developer C (Frontend): รอ T015 เสร็จ → Phase 7 (US5)
```

---

## Notes

- **[P]** = different files, no incomplete task dependencies — สามารถทำพร้อมกัน
- **[USn]** = maps to user story for traceability
- ADR-019: ใช้ `publicId` (UUIDv7) ทุก API — ห้าม `parseInt`
- ADR-009: SQL delta โดยตรง — ห้าม TypeORM migration
- ADR-018: Ollama บน Admin Desktop เท่านั้น; CONFIDENTIAL ห้ามผ่าน Typhoon
- ADR-008: BullMQ สำหรับทุก ingestion job — ห้าม inline processing
- Commit หลังแต่ละ task หรือ logical group
- Stop ที่ทุก Checkpoint เพื่อ validate ก่อนไปต่อ
