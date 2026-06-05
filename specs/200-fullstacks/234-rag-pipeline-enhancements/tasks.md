# Tasks: RAG Pipeline Enhancements

**Input**: Design documents from `specs/200-fullstacks/234-rag-pipeline-enhancements/`
**Prerequisites**: plan.md ✅, spec.md ✅
**Branch**: `234-rag-pipeline-enhancements`

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: US1=Chat Q&A, US2=Auto RAG Trigger, US3=Semantic Chunking, US4=Hybrid Search

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: เพิ่ม dependency และ SQL delta ที่จำเป็นสำหรับทุก story

- [X] T001 [P] เพิ่ม `FlagEmbedding>=1.2.0` ใน `specs/04-Infrastructure-OPS/04-00-docker-compose/Desk-5439/ocr-sidecar/requirements.txt`
- [X] T002 [P] สร้าง SQL delta `specs/03-Data-and-Storage/deltas/2026-06-05-add-rag-chunking-prompt.sql` — INSERT `ai_prompts` (`prompt_type='rag_chunking'`, placeholder `{{ocr_text}}`)

**Checkpoint**: dependencies + SQL delta พร้อม — สามารถเริ่ม Phase 2 ได้

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: OCR Sidecar + AiQdrantService ใหม่ — ทุก story ต้องพึ่งพิงสองส่วนนี้

⚠️ **CRITICAL**: Phase 3+ ทั้งหมดต้องรอ Phase 2 เสร็จก่อน

### 2A — OCR Sidecar: BGE-M3 + Reranker endpoints

- [X] T003 โหลด `BGEM3FlagModel` และ `FlagReranker` เป็น global singleton ตอน startup ใน `specs/04-Infrastructure-OPS/04-00-docker-compose/Desk-5439/ocr-sidecar/app.py` (CPU mode, `use_fp16=False`)
- [X] T004 [P] เพิ่ม `POST /embed` endpoint ใน `app.py` — รับ `{"text": string}` คืน `{"dense": list[float], "sparse": {"indices": list[int], "values": list[float]}}`
- [X] T005 [P] เพิ่ม `POST /rerank` endpoint ใน `app.py` — รับ `{"query": string, "chunks": list[str]}` คืน `{"scores": list[float], "ranked_indices": list[int]}`

### 2B — AiQdrantService: Hybrid Schema

- [X] T006 แก้ `AI_VECTOR_SIZE = 1024` (เดิม 768) ใน `backend/src/modules/ai/qdrant.service.ts`
- [X] T007 แก้ `ensureCollection()` → drop collection เก่าก่อน แล้ว recreate เป็น Hybrid (`bge_dense` size=1024 + `bge_sparse`) ใน `backend/src/modules/ai/qdrant.service.ts`
- [X] T008 แก้ `upsert()` → รับ interface ใหม่ที่มี `denseVector: number[]`, `sparseVector: {indices: number[], values: number[]}`, และ payload ครบ 11 fields (`doc_public_id`, `project_public_id`, `doc_number`, `doc_type`, `status_code`, `revision_number`, `subject`, `document_date`, `chunk_topic`, `chunk_index`, `chunk_text`) ใน `backend/src/modules/ai/qdrant.service.ts`
- [X] T009 แก้ `deleteByDocumentPublicId()` → filter บน payload field `doc_public_id` (ไม่ใช่ point id) ใน `backend/src/modules/ai/qdrant.service.ts`
- [X] T010 เพิ่ม payload indexes สำหรับ `doc_public_id`, `status_code`, `doc_type` ใน `ensureCollection()` ใน `backend/src/modules/ai/qdrant.service.ts`

**Checkpoint**: Sidecar `/embed` + `/rerank` พร้อม; Qdrant collection ใหม่พร้อม — เริ่ม Phase 3+ ได้

---

## Phase 3: User Story 1 — Document Q&A with Accurate Context (P1) 🎯 MVP

**Goal**: Chat Q&A ใช้ BGE-M3 embed query + Hybrid search + Reranker ก่อนส่ง LLM

**Independent Test**: ส่ง RAG query → ตรวจสอบ Sidecar `/embed` ถูกเรียก → Qdrant Hybrid search → `/rerank` ถูกเรียก → LLM ตอบพร้อม citation

### Tests for User Story 1

- [X] T011 [P] [US1] เขียน unit test `backend/src/modules/ai/ai-rag.service.spec.ts` — mock Sidecar `/embed` และ `/rerank`; ตรวจสอบว่า `processQuery()` เรียก embed ก่อน search ก่อน rerank

### Implementation for User Story 1

- [X] T012 [US1] เพิ่ม method `embedViaSidecar(text: string)` ใน `backend/src/modules/ai/services/ocr.service.ts` — POST Sidecar `/embed`, คืน `{dense, sparse}`
- [X] T013 [US1] แก้ `search()` / `searchByProject()` ใน `backend/src/modules/ai/qdrant.service.ts` → ใช้ Hybrid query (RRF fusion) แทน dense-only, รับ `denseVector` + `sparseVector`
- [X] T014 [US1] เพิ่ม method `rerankViaSidecar(query: string, chunks: string[])` ใน `backend/src/modules/ai/services/ocr.service.ts` — POST Sidecar `/rerank`
- [X] T015 [US1] แก้ `processQuery()` ใน `backend/src/modules/ai/ai-rag.service.ts`:
  - เรียก `embedViaSidecar()` แทน `ollamaService.generateEmbedding()`
  - เรียก `searchByProject()` ด้วย Hybrid vectors, topK=15
  - เรียก `rerankViaSidecar()` → เลือก top 3-5 chunks
  - ประกอบ context จาก payload ใหม่ (`chunk_text`, `doc_number`, `document_date`, `status_code`)

**Checkpoint**: US1 — RAG query ทำงานครบ pipeline ใหม่

---

## Phase 4: User Story 2 — Automatic RAG Preparation on Workflow Submit (P2)

**Goal**: submit Correspondence → trigger `rag-prepare` job อัตโนมัติ ไม่ block response

**Independent Test**: Submit workflow → ตรวจ BullMQ `ai-batch` queue มี `rag-prepare` job → job เสร็จ → Qdrant มี points ของเอกสาร

### Tests for User Story 2

- [X] T016 [P] [US2] เขียน unit test `backend/src/modules/ai/processors/ai-batch.processor.spec.ts` — ตรวจสอบ `case 'rag-prepare'` ถูก dispatch และเรียก OCR/embed/upsert ตามลำดับ
- [X] T017 [P] [US2] เขียน unit test `backend/src/modules/correspondence/correspondence-workflow.service.spec.ts` — ตรวจสอบว่า `syncStatus()` เรียก `enqueueRagPrepare()` เมื่อ targetCode ≠ 'DRAFT'

### Implementation for User Story 2

- [X] T018 [US2] เพิ่ม interface `RagPrepareJobPayload` และ method `enqueueRagPrepare(payload)` ใน `backend/src/modules/ai/ai-queue.service.ts`
- [X] T019 [US2] เพิ่ม `case 'rag-prepare':` ใน `process()` ของ `backend/src/modules/ai/processors/ai-batch.processor.ts` — dispatch ไป `processRagPrepare(data)`
- [X] T019a [US2] ตรวจสอบและตั้งค่าให้ `ai-batch` Queue Processor มี `concurrency: 1` ใน `@Processor` decorator เพื่อป้องกัน VRAM overflow ตาม ADR-035
- [X] T020a [US2] implement OCR text resolution ใน `processRagPrepare()` ใน `ai-batch.processor.ts`: ถ้า `cachedOcrText` มีให้ใช้เลย; ถ้าไม่มีและมี `attachmentPath` เรียก `OcrService.extractText(attachmentPath)`; ถ้าไม่มีทั้งคู่ → `this.logger.warn('rag-prepare: ไม่มี OCR text และไม่มี attachment path')` แล้ว return early
- [X] T020b [US2] implement skip-guard ใน `processRagPrepare()`: ถ้า `ocrText.trim().length < 50` → `this.logger.warn('rag-prepare: OCR text สั้นเกินไป — skip embedding')` แล้ว return early (ไม่ error, ไม่ fail job)
- [X] T020c [US2] implement embed + upsert pipeline ใน `processRagPrepare()`: เรียก `EmbeddingService.embedDocument()` (refactor ใน US3) → เรียก `AiQdrantService.deleteByDocumentPublicId(projectPublicId, documentPublicId)` → เรียก `AiQdrantService.upsert()` ด้วย chunks + payload ครบ 11 fields รวม `status_code` จาก `data.statusCode`
- [X] T021 [US2] inject `AiQueueService` เข้า `CorrespondenceWorkflowService` constructor ใน `backend/src/modules/correspondence/correspondence-workflow.service.ts`
- [X] T022 [US2] แก้ `syncStatus()` ใน `correspondence-workflow.service.ts` — หลัง save ถ้า `targetCode !== 'DRAFT'` → เรียก `aiQueueService.enqueueRagPrepare()` แบบ fire-and-forget พร้อมข้อมูลจาก `revision` + `correspondence`
- [X] T023 [US2] อัปเดต `CorrespondenceModule` imports ให้ `CorrespondenceWorkflowService` เข้าถึง `AiQueueService` ได้ ใน `backend/src/modules/correspondence/correspondence.module.ts`

**Checkpoint**: US2 — submit → BullMQ job → Qdrant embed ทำงานครบ

---

## Phase 5: User Story 3 — Semantic Chunking (P2)

**Goal**: `EmbeddingService` ใช้ Semantic Chunking ด้วย typhoon2.5 + prompt `rag_chunking` แทน fixed-size

**Independent Test**: embed เอกสาร → ตรวจ Qdrant points มี `chunk_topic` ที่ไม่ว่างเปล่า → fallback: ลบ `<chunk>` tag ออกจาก LLM output → ตรวจว่าใช้ fixed-size แทน

### Tests for User Story 3

- [X] T024 [P] [US3] เขียน unit test `backend/src/modules/ai/services/embedding.service.spec.ts`:
  - `semanticChunkText()` — mock LLM output พร้อม `<chunk>` tag → ตรวจ parse ถูกต้อง
  - fallback case — LLM output ไม่มี `<chunk>` tag → ตรวจใช้ fixed-size chunking

### Implementation for User Story 3

- [X] T025 [US3] เพิ่ม method `semanticChunkText(ocrText: string)` ใน `backend/src/modules/ai/services/embedding.service.ts`:
  - โหลด prompt จาก `ai_prompts` (`prompt_type='rag_chunking'`) ผ่าน `PromptService` หรือ query โดยตรง
  - เรียก `OllamaService` ด้วย typhoon2.5-np-dms + prompt + `ocrText`
  - คืน LLM output string
- [X] T026 [US3] เพิ่ม method `parseChunkTags(llmOutput: string)` ใน `embedding.service.ts`:
  - parse `<chunk topic="...">...</chunk>` tags ด้วย regex
  - ถ้าไม่มี tag → fallback `fixedSizeChunk(ocrText, 512, 64)`
  - คืน `Array<{topic: string, text: string}>`
- [X] T027 [US3] แก้ `embedDocument()` ใน `embedding.service.ts`:
  - เรียก `semanticChunkText()` → `parseChunkTags()`
  - สำหรับแต่ละ chunk: เรียก `OcrService.embedViaSidecar(chunk.text)` → ได้ `{dense, sparse}`
  - upsert ผ่าน `AiQdrantService.upsert()` ด้วย payload ครบ 11 fields (รวม `chunk_topic` และ `chunk_text`)

**Checkpoint**: US3 — Semantic Chunking พร้อม; US2 `processRagPrepare()` ใช้ path ใหม่นี้โดยอัตโนมัติ

---

## Phase 6: User Story 4 — Hybrid Search with Reranking (P3)

**Goal**: ตรวจสอบว่า Hybrid search (RRF) ทำงานถูกต้องใน production-like scenario

**Independent Test**: ส่ง query ที่มี keyword เฉพาะ → ตรวจสอบ sparse vector ถูกส่งไป Qdrant → reranked top-5 scores มีค่า > dense-only baseline

### Implementation for User Story 4

- [X] T028 [US4] เพิ่ม payload index สำหรับ `doc_type` และ `status_code` ใน Qdrant `ensureCollection()` ถ้ายังไม่มี (ต่อจาก T010) ใน `backend/src/modules/ai/qdrant.service.ts`
- [X] T029 [US4] ตรวจสอบ `searchByProject()` ใน `qdrant.service.ts` รองรับ optional `statusFilter` parameter สำหรับกรณีที่ต้องการ approved-only ในอนาคต
- [X] T030 [US4] เพิ่ม logging ใน `processQuery()` ใน `ai-rag.service.ts` — log จำนวน candidates ก่อน/หลัง rerank และ top scores (ใช้ NestJS `Logger`, ไม่ใช้ `console.log`)

**Checkpoint**: US4 — Hybrid search + reranking verified

---

## Phase 7: Polish & Cross-Cutting Concerns

- [X] T031 [P] deprecate หรือ remove `backend/src/modules/rag/qdrant.service.ts` (เก่า — replaced โดย `ai/qdrant.service.ts`) หลังตรวจสอบว่าไม่มี import อื่นใช้อยู่
- [X] T032 [P] อัปเดต `backend/src/modules/ai/ai.module.ts` imports/providers ถ้ามีการเปลี่ยนแปลง dependencies ใหม่
- [X] T033 อัปเดต ADR-035 `Implementation Status` table — Flow 2B และ Flow 4 เป็น ✅ ใน `specs/06-Decision-Records/ADR-035-ai-pipeline-flow-architecture.md`
- [X] T034 [P] ตรวจสอบ TypeScript strict — ไม่มี `any`, ไม่มี `console.log` ใน files ที่แก้ไขทั้งหมด

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1** (Setup): เริ่มได้ทันที — ขนานกันได้
- **Phase 2** (Foundational): ต้องรอ Phase 1 — blocks Phase 3+
- **Phase 3** (US1 — Chat Q&A): ต้องรอ Phase 2 — T012-T015 ต้องการ Sidecar + Qdrant ใหม่
- **Phase 4** (US2 — RAG Trigger): ต้องรอ Phase 2 — T018-T023 ต้องการ Qdrant ใหม่
- **Phase 5** (US3 — Semantic Chunking): ต้องรอ Phase 2 + T018 (ใช้ `enqueueRagPrepare` type)
- **Phase 6** (US4 — Hybrid): ต้องรอ Phase 3 (ใช้ `searchByProject` ใหม่)
- **Phase 7** (Polish): ต้องรอ Phase 3-6 ครบ

### User Story Dependencies

- **US1** ⬅️ Phase 2 (Sidecar /embed, /rerank; Qdrant Hybrid)
- **US2** ⬅️ Phase 2 (Qdrant Hybrid) + T018 type definition
- **US3** ⬅️ Phase 2 + T018 + SQL delta T002
- **US4** ⬅️ US1 (T013 searchByProject Hybrid)

### Parallel Opportunities

- T001 + T002 ขนานกัน (Phase 1)
- T003 (Sidecar init) → T004 + T005 ขนานกัน
- T006-T010 ขนานกันได้ (ไฟล์เดียวกันแต่ methods ต่างกัน — ทำตามลำดับเพื่อความปลอดภัย)
- T011 + T016 + T017 + T024 ขนานกัน (เขียน tests คนละไฟล์)
- T012 + T014 ขนานกัน (methods ต่างกันใน ocr.service.ts)
- T018 + T025 ขนานกัน (คนละไฟล์)

---

## Implementation Strategy

### MVP First (User Story 1 + 2)

1. Phase 1: Setup (T001-T002)
2. Phase 2: Foundational — Sidecar + Qdrant (T003-T010)
3. Phase 3: US1 Chat Q&A (T011-T015) → **ทดสอบ RAG query ทำงาน**
4. Phase 4: US2 RAG Trigger (T016-T023) → **ทดสอบ submit → embed**
5. **STOP & VALIDATE**: ระบบ embed + query ใหม่ทำงานครบ end-to-end
6. Deploy รอบแรก

### Incremental Addition

7. Phase 5: US3 Semantic Chunking → re-embed เอกสารที่มี
8. Phase 6: US4 Hybrid verification
9. Phase 7: Polish + deprecate code เก่า

---

## Notes

- `[P]` = ขนานกันได้ (different files หรือ independent methods)
- ทุก task ต้องไม่มี `any` type และไม่มี `console.log` (ใช้ NestJS `Logger`)
- Qdrant drop collection เกิดขึ้นตอน `ensureCollection()` ถูกเรียกครั้งแรกหลัง deploy — Chat Q&A จะ return empty ชั่วคราวจนกว่า documents จะถูก re-embed
- commit message format: `feat(ai): <description>` หรือ `refactor(ai): <description>`
