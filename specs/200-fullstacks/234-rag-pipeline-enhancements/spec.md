# Feature Specification: RAG Pipeline Enhancements

**Feature Branch**: `234-rag-pipeline-enhancements`
**Created**: 2026-06-05
**Status**: Draft
**ADR Reference**: ADR-035 (AI Pipeline Flow Architecture)

---

## User Scenarios & Testing _(mandatory)_

### User Story 1 — Document Q&A with Accurate Context (Priority: P1)

ผู้ใช้งานใน Project ต้องการถามคำถามเกี่ยวกับเนื้อหาของเอกสาร Correspondence/RFA ที่อยู่ในระหว่างดำเนินการ (IN_REVIEW ขึ้นไป) โดยระบบจะค้นหาข้อความที่เกี่ยวข้องจากเอกสารทั้งหมดใน Project เดียวกัน แล้วตอบคำถามพร้อมระบุเลขเอกสารและวันที่อ้างอิง

**Why this priority**: RAG Q&A คือ core value ของ AI integration — ถ้าไม่มี embedding และ retrieval ที่ถูกต้อง Chat Q&A ทำงานไม่ได้

**Independent Test**: สร้างเอกสาร 2 ฉบับในโปรเจกต์เดียวกัน → submit workflow (IN_REVIEW) → ถามคำถามที่เนื้อหาอยู่ในเอกสาร → ระบบตอบได้พร้อมอ้างอิงเลขเอกสาร

**Acceptance Scenarios**:

1. **Given** เอกสาร Correspondence ที่ status = IN_REVIEW ใน Project A, **When** User ถามคำถามที่เนื้อหาอยู่ในเอกสารนั้น, **Then** ระบบตอบได้พร้อมระบุเลขเอกสารและวันที่อ้างอิงภายใน 30 วินาที
2. **Given** User ใน Project A ถามคำถาม, **When** เนื้อหาที่เกี่ยวข้องอยู่ใน Project B, **Then** ระบบต้องไม่ดึงข้อมูลจาก Project B มาตอบ (project isolation)
3. **Given** เอกสารที่ยัง DRAFT (ยังไม่ submit), **When** User ถามคำถาม, **Then** ระบบต้องไม่นำเนื้อหา DRAFT มาตอบ

---

### User Story 2 — Automatic RAG Preparation on Workflow Submit (Priority: P2)

เมื่อผู้ใช้ submit เอกสาร Correspondence/RFA ผ่าน Workflow Engine (status เปลี่ยนจาก DRAFT เป็น IN_REVIEW/SUBOWN) ระบบจะเตรียม RAG embedding อัตโนมัติในพื้นหลัง โดยไม่กระทบ response time ของการ submit

**Why this priority**: ถ้าไม่มี auto-trigger embedding User Story 1 จะไม่มีข้อมูลให้ค้นหา

**Independent Test**: Submit เอกสาร → ตรวจสอบว่า job `rag-prepare` ถูก enqueue ใน BullMQ → รอ job เสร็จ → verify Qdrant มี points ของเอกสารนั้น

**Acceptance Scenarios**:

1. **Given** เอกสาร status = DRAFT, **When** User กด Submit workflow, **Then** ระบบ enqueue `rag-prepare` job ใน BullMQ `ai-batch` ภายใน 1 วินาที โดยไม่ block response
2. **Given** `rag-prepare` job ทำงาน, **When** เสร็จสมบูรณ์, **Then** Qdrant มี chunks ของเอกสารนั้นพร้อม `project_public_id`, `doc_number`, `status_code`, `chunk_topic` ใน payload
3. **Given** เอกสารมี Revision ใหม่ถูก submit, **When** `rag-prepare` ทำงาน, **Then** Qdrant ลบ points เก่าของ revision ก่อนหน้าก่อน upsert points ใหม่

---

### User Story 3 — Semantic Chunking for Better Retrieval (Priority: P2)

เนื้อหาเอกสารแต่ละฉบับถูกแบ่ง chunk ตามความหมาย (Semantic Chunking) โดย LLM ใส่ `<chunk topic="...">` tag ก่อน embed แทนการแบ่งแบบ fixed-size ทำให้ค้นหาได้ตรงหัวข้อมากขึ้น

**Why this priority**: Semantic chunking ช่วยให้ retrieval accuracy สูงกว่า fixed-size chunking อย่างมีนัยสำคัญ โดยเฉพาะกับเอกสารภาษาไทยที่มีโครงสร้างหัวข้อชัดเจน

**Independent Test**: embed เอกสารที่มีหลายหัวข้อ → ตรวจสอบ Qdrant payload ว่า `chunk_topic` แต่ละ chunk ตรงกับเนื้อหา → ถามคำถามเฉพาะหัวข้อ → ตรวจสอบว่า reranked chunk ตรงหัวข้อ

**Acceptance Scenarios**:

1. **Given** OCR text ของเอกสาร, **When** `rag-prepare` job ทำงาน, **Then** typhoon2.5-np-dms แบ่ง text ออกเป็น chunks พร้อม `<chunk topic="...">` tag อย่างน้อย 1 chunk
2. **Given** Semantic chunks ถูกสร้าง, **When** upsert ไป Qdrant, **Then** แต่ละ point มี `chunk_topic` ที่อธิบายหัวข้อของ chunk นั้น
3. **Given** ไม่พบ `<chunk>` tag ใน LLM output, **When** fallback triggered, **Then** ระบบ fallback ไปใช้ fixed-size chunking (512 chars) แทนโดยไม่ error

---

### User Story 4 — Hybrid Search with Reranking (Priority: P3)

ระบบใช้ BGE-M3 embedding (Dense 1024 dims + Sparse vectors) และ BGE-Reranker-Large เพื่อให้ retrieval accuracy สูงกว่า dense-only search โดยเฉพาะกับ keyword-heavy queries ภาษาไทย

**Why this priority**: ปรับปรุง search quality — มี impact แต่ระบบทำงานได้ก่อนจะ implement หากยังใช้ dense-only ก่อน

**Independent Test**: ส่ง query ที่มีทั้ง semantic และ keyword → ตรวจสอบว่า reranked top-5 มีความเกี่ยวข้องสูงกว่า top-5 จาก dense-only

**Acceptance Scenarios**:

1. **Given** User query, **When** ระบบ embed ด้วย BGE-M3, **Then** ได้ทั้ง dense vector (1024 dims) และ sparse vector
2. **Given** BGE-M3 vectors, **When** ค้นหาใน Qdrant, **Then** ใช้ Hybrid search (dense + sparse) ได้ top-15 candidates
3. **Given** top-15 candidates, **When** ส่งไป BGE-Reranker-Large, **Then** ได้ top 3-5 chunks ที่ reranked score สูงสุดส่งให้ LLM

---

### Edge Cases

- เอกสารที่ไม่มี attachment (ไม่มีไฟล์ PDF) → `rag-prepare` ข้ามการ embed โดยไม่ error แต่ log warning
- OCR text ว่างเปล่า / สั้นเกินไป (< 50 chars) → ข้าม semantic chunking + embedding
- BGE-M3 Sidecar ไม่พร้อม → `rag-prepare` job fail + retry 3 ครั้ง (ADR-008)
- Qdrant ไม่พร้อม → `rag-prepare` job fail + retry
- เอกสาร REJECTED กลับเป็น DRAFT → ไม่ trigger `rag-prepare` ซ้ำ (status ลดลง ไม่ใช่ขึ้น)
- หลาย users submit พร้อมกัน → idempotency key ป้องกัน duplicate `rag-prepare` jobs

---

## Requirements _(mandatory)_

### Functional Requirements

**OCR Sidecar (app.py)**

- **FR-001**: Sidecar MUST expose `POST /embed` endpoint รับ `{"text": string}` และคืน `{"dense": number[], "sparse": {indices: number[], values: number[]}}`
- **FR-002**: Sidecar MUST expose `POST /rerank` endpoint รับ `{"query": string, "chunks": string[]}` และคืน scores เรียงลำดับ
- **FR-003**: BGE-M3 และ BGE-Reranker-Large MUST โหลดบน CPU RAM เมื่อ Sidecar start (ไม่ใช้ VRAM)

**Semantic Chunking**

- **FR-004**: ระบบ MUST ใช้ typhoon2.5-np-dms วิเคราะห์ OCR text และใส่ `<chunk topic="...">` tag ก่อน embed โดยดึง prompt จาก `ai_prompts` ที่ `prompt_type = 'rag_chunking'` (ADR-029)
- **FR-004a**: ระบบ MUST seed `ai_prompts` record สำหรับ `prompt_type = 'rag_chunking'` ผ่าน SQL delta (ADR-009) พร้อม placeholder `{{ocr_text}}`
- **FR-005**: ระบบ MUST fallback ไปใช้ fixed-size chunking (512 chars / 64 overlap) หากไม่พบ `<chunk>` tag ใน LLM output
- **FR-006**: chunk topic MUST บันทึกไว้ใน Qdrant payload field `chunk_topic`

**Qdrant Collection**

- **FR-007**: Qdrant collection `lcbp3_vectors` MUST ถูก drop + recreate ใหม่รองรับ Hybrid search (Dense 1024 dims + Sparse SPLADE) — collection เดิม (768 dims dense-only) จะถูกแทนที่ทันทีที่ feature นี้ deploy
- **FR-008**: Qdrant payload MUST มีครบ 11 fields: `doc_public_id`, `project_public_id`, `doc_number`, `doc_type`, `status_code`, `revision_number`, `subject`, `document_date`, `chunk_topic`, `chunk_index`, `chunk_text`
- **FR-009**: Qdrant MUST มี payload index บน `project_public_id` (tenant), `doc_public_id`, `status_code`, `doc_type`
- **FR-009a**: `AI_VECTOR_SIZE` constant MUST เปลี่ยนจาก `768` เป็น `1024` และ collection name constant คงเป็น `lcbp3_vectors`

**RAG Prepare Pipeline**

- **FR-010**: ระบบ MUST enqueue `rag-prepare` job ใน `ai-batch` queue เมื่อ `CorrespondenceRevision` status เปลี่ยนจาก DRAFT เป็น IN_REVIEW (SUBOWN) โดย job payload ต้องรวม `cachedOcrText` ถ้ามีใน DB; หากไม่มี job MUST เรียก OCR sidecar ใหม่โดยดึง PDF attachment จาก storage
- **FR-011**: `rag-prepare` job MUST ลบ Qdrant points เก่าของ `doc_public_id` ก่อน upsert ใหม่เสมอ (delete + re-embed)
- **FR-012**: `rag-prepare` job MUST ไม่ block workflow submission response

**RAG Query Pipeline**

- **FR-013**: RAG query MUST embed คำถามด้วย BGE-M3 ผ่าน Sidecar `/embed`
- **FR-014**: RAG query MUST ค้นหา Qdrant ด้วย Hybrid search topK=15 กรอง `project_public_id` เป็น mandatory
- **FR-015**: RAG query MUST rerank ด้วย BGE-Reranker ผ่าน Sidecar `/rerank` เพื่อได้ top 3-5 chunks ก่อนส่ง LLM

### Key Entities

- **EmbeddedChunk**: ข้อมูลที่เก็บใน Qdrant — `doc_public_id`, `project_public_id`, `doc_number`, `doc_type`, `status_code`, `revision_number`, `subject`, `document_date`, `chunk_topic`, `chunk_index`, `chunk_text`
- **RagPrepareJob**: BullMQ job payload — `documentPublicId`, `projectPublicId`, `correspondenceNumber`, `docType`, `statusCode`, `revisionNumber`, `subject`, `documentDate`, `ocrText`
- **RagQueryJob**: BullMQ job payload — `requestPublicId`, `userPublicId`, `projectPublicId`, `query`

---

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: เอกสารที่ submit workflow ถูก embed และพร้อมค้นหาใน Qdrant ภายใน 5 นาทีหลัง submit สำเร็จ
- **SC-002**: Chat Q&A ตอบคำถามที่เนื้อหาอยู่ในเอกสาร IN_REVIEW ขึ้นไปได้ถูกต้องอย่างน้อย 80% ของกรณีทดสอบ
- **SC-003**: ไม่มีข้อมูลจาก Project อื่นรั่วไหลมาในคำตอบ (0% cross-project leak)
- **SC-004**: `rag-prepare` job ไม่ delay workflow submission response เกิน 500ms
- **SC-005**: ระบบรองรับการ embed เอกสารขนาดสูงสุด 50 หน้าโดยไม่ timeout
- **SC-006**: เมื่อมี revision ใหม่ ข้อมูลเก่าในระบบค้นหาถูกแทนที่ด้วยข้อมูลใหม่ทั้งหมด (0 stale chunks)

---

## Clarifications

### Session 2026-06-05

- Q: OCR text source สำหรับ `rag-prepare` job → A: ใช้ cached OCR text ถ้ามี, fallback เรียก OCR sidecar ใหม่ถ้าไม่มี (Option C)
- Q: Qdrant collection migration strategy → A: ใช้ชื่อ collection เดิม `lcbp3_vectors` แต่ drop + recreate schema ใหม่ (1024 dims Hybrid) ทันที (Option C)
- Q: Semantic Chunking prompt type ใน `ai_prompts` → A: เพิ่ม prompt type ใหม่ `rag_chunking` แยกต่างหาก (Option A)

---

## Assumptions

- BGE-M3 (BAAI/bge-m3 ~2.3GB) และ BGE-Reranker-Large (~1.5GB) รันบน CPU RAM บน Desk-5439 ได้โดยไม่กระทบ VRAM ของ Ollama
- OCR text อาจมีหรือไม่มีใน DB — `rag-prepare` job จัดการทั้งสองกรณี (cached + fallback OCR)
- Qdrant collection `lcbp3_vectors` เดิม (768 dims) จะถูก drop + recreate เป็น Hybrid (1024 dims) เมื่อ deploy — ข้อมูล vector เดิมทั้งหมดจะหายไป ซึ่งยอมรับได้เพราะยังไม่มีข้อมูล production ที่ embed ด้วยระบบใหม่
- Sidecar service (port 8765) ยังคงใช้ container เดิม เพียงเพิ่ม endpoints ใหม่

---

## Out of Scope

- Flow 3 (Auto-fill) RAG trigger — จะทำใน feature แยก
- การ embed เอกสารชนิดอื่น (RFA, Transmittal) — scope เฉพาะ Correspondence ก่อน
- Frontend Chat UI (ADR-026) — มีแผน implement แยกใน feature 226
- Migration/re-embedding เอกสาร DRAFT ที่มีอยู่เดิม
