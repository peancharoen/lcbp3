# Tasks: AI Model Revision (ADR-023A)

**Input**: `specs/300-others/302-ai-model-revision/` (spec.md, plan.md, data-model.md, contracts/)
**Feature**: `302-ai-model-revision` | **Date**: 2026-05-15
**Prerequisites**: plan.md ✅ | spec.md ✅ | research.md ✅ | data-model.md ✅ | contracts/ ✅

---

## Format: `[ID] [P?] [Story] Description`

- **[P]**: สามารถรันพร้อมกัน (คนละไฟล์, ไม่มี dependency กัน)
- **[US1/US2/US3/US4]**: User Story ที่ task นี้ satisfy
- ทุก task ต้องระบุ file path ที่แน่ชัด

---

## Phase 1: Setup & Cleanup (Tier 1 Critical First)

**Purpose**: ลบ Typhoon ออก, ตั้ง BullMQ 2-queue, สร้าง Schema Delta

**⚠️ CRITICAL**: Phase นี้ต้องทำเสร็จก่อน Phase ถัดไปทั้งหมด — Typhoon removal เป็น Tier 1 blocking

- [ ] T001 Delete Typhoon Cloud API service: `rm backend/src/modules/ai/rag/typhoon.service.ts` และลบ reference ทั้งหมดออกจาก `backend/src/modules/ai/ai.module.ts`, `backend/src/modules/ai/rag/rag.service.ts`
- [ ] T002 [P] สร้าง SQL delta #14: `specs/03-Data-and-Storage/deltas/14-add-migration-review-queue.sql` ตาม schema ใน data-model.md (ADR-009 — ห้ามใช้ TypeORM migration)
- [ ] T002B [P] สร้าง SQL delta #15: `specs/03-Data-and-Storage/deltas/15-add-ai-processing-status.sql` — `ALTER TABLE documents ADD COLUMN ai_processing_status ENUM('PENDING','PROCESSING','DONE','FAILED') NOT NULL DEFAULT 'PENDING'`; `ADD INDEX idx_ai_status (ai_processing_status)` (FR-018, ADR-009)
- [ ] T003 [P] อัปเดต `backend/src/config/bullmq.config.ts` — เพิ่ม `ai-batch` queue config (concurrency=1, defaultJobOptions: retry 3, backoff exponential)
- [ ] T004 อัปเดต `backend/.env.example` — เพิ่ม `OLLAMA_MODEL_MAIN`, `OLLAMA_MODEL_EMBED`, `QDRANT_HOST`, `QDRANT_COLLECTION`, `OCR_CHAR_THRESHOLD`, `OCR_API_URL`
- [ ] T005 ตรวจสอบว่าไม่มี Typhoon reference เหลือ: `grep -r "typhoon" backend/src --include="*.ts"` ต้องไม่มีผล

**Checkpoint**: `grep -r "typhoon"` → 0 results; `bullmq.config.ts` มี 2 queues; delta file สร้างแล้ว

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core AI infrastructure ที่ทุก User Story ต้องการ

**⚠️ CRITICAL**: ต้องทำเสร็จก่อนทุก US

- [ ] T006 สร้าง `backend/src/modules/ai/processors/ai-realtime.processor.ts` — BullMQ `@Processor('ai-realtime')` รองรับ jobType: `'ai-suggest'` และ `'rag-query'`; ใส่ logic pause `ai-batch` เมื่อ job active (event: `active`); resume `ai-batch` เมื่อ job completed/failed (events: `completed`, `failed`)
- [ ] T006A เพิ่ม `onModuleInit()` ใน `backend/src/modules/ai/ai.module.ts` (implements `OnModuleInit`) — startup check: `const isPaused = await aiBatchQueue.isPaused()` AND `const activeCount = await aiRealtimeQueue.getActiveCount()` → ถ้า `isPaused && activeCount === 0` → `await aiBatchQueue.resume()`; `this.logger.warn('ai-batch auto-resumed on startup (stale paused state)')` (FR-016)
- [ ] T007 สร้าง `backend/src/modules/ai/processors/ai-batch.processor.ts` — BullMQ `@Processor('ai-batch')` รองรับ jobType: `'ocr'`, `'extract-metadata'`, `'embed-document'`
- [ ] T008 [P] อัปเดต `backend/src/modules/ai/services/ollama.service.ts` — เปลี่ยน model จาก `gemma4:9b` เป็น `process.env.OLLAMA_MODEL_MAIN` (default: `gemma4:e4b`); เพิ่ม generateEmbedding() ที่ใช้ `process.env.OLLAMA_MODEL_EMBED`
- [ ] T009 [P] อัปเดต `backend/src/modules/ai/services/qdrant.service.ts` — เปลี่ยน `search()` signature ให้ `projectPublicId: string` เป็น required param แรก; เพิ่ม `must: [{ key: 'project_public_id', match: { value: projectPublicId } }]` filter ใน payload; ลบ `rawSearch()` ออก
- [ ] T010 สร้าง `backend/src/modules/ai/services/ocr.service.ts` — auto-detect: ถ้า `extractedChars > OCR_CHAR_THRESHOLD` → Fast Path (return text); else → call PaddleOCR sidecar ที่ `OCR_API_URL`; return `{ text: string; ocrUsed: boolean }`
- [ ] T011 อัปเดต `backend/src/modules/ai/ai.module.ts` — register BullModule ทั้ง 2 queues; provide processors ทั้งคู่; ลบ Typhoon import; register entity `MigrationReviewQueueEntity`
- [ ] T012 [P] สร้าง `backend/src/modules/ai/entities/migration-review-queue.entity.ts` — TypeORM entity ตาม schema ใน data-model.md (column: `publicId`, `batchId`, `idempotencyKey`, `aiMetadataJson`, `confidenceScore`, `ocrUsed`, `status`, `reviewedBy`, `reviewedAt`, `rejectionReason`)

**Checkpoint**: NestJS compile สำเร็จ ไม่มี TypeScript error; QdrantService ไม่มี method ที่ไม่รับ projectPublicId

---

## Phase 3: User Story 1 — AI-Assisted Document Classification (Priority: P1) 🎯 MVP

**Goal**: Digital/Scanned PDF detection + AI Suggest metadata + frontend display

**Independent Test**: อัปโหลด PDF → AI Suggestion ปรากฏบนฟอร์มภายใน 30s

### Implementation

- [ ] T013 [US1] สร้าง `backend/src/modules/ai/dto/create-ai-job.dto.ts` — field: `documentPublicId: string` (IsUUID), `projectPublicId: string` (IsUUID), `jobType: 'ai-suggest' | 'rag-query' | 'ocr' | 'extract-metadata' | 'embed-document'`, `idempotencyKey: string`
- [ ] T014 [US1] อัปเดต `backend/src/modules/ai/ai.service.ts` — method `queueSuggestJob()`: ตรวจสอบ Idempotency-Key, ส่ง job ไป `ai-realtime` queue พร้อม payload; method `queueEmbedJob()`: ส่ง job ไป `ai-batch` queue (ทั้งสองเรียกพร้อมกันหลัง commit)
- [ ] T015 [US1] อัปเดต AI-Suggest logic ใน `ai-realtime.processor.ts` — ดึงไฟล์จาก storage, เรียก `OcrService.detectAndExtract()` (3 หน้าแรก), ส่ง text ไป OllamaService; **validate categorical fields กับ `MasterDataService.getCategories()`** (FR-014): ถ้า value ไม่รู้จัก → set `is_unknown: true` ใน suggestion JSON; บันทึก raw AI output ใน `ai_audit_logs.ai_suggestion_json` (รวมค่าที่ไม่รู้จัก — FR-015); return suggestion JSON พร้อม `is_unknown` flag ให้ frontend แสดง badge (FR-015)
- [ ] T016 [US1] อัปเดต `backend/src/modules/ai/ai.controller.ts` — endpoint `POST /api/ai/suggest` รับ `CreateAiJobDto`, ตรวจสอบ Idempotency-Key header, เรียก `AiService.queueSuggestJob()`; endpoint `GET /api/ai/jobs/:jobId/status` สำหรับ polling; CASL guard: `ai.manage`
- [ ] T017 [P] [US1] อัปเดต `frontend/components/ai/ai-suggestion-field.tsx` — แสดง confidence badge: ≥0.85 → สีเขียว "AI แนะนำ", 0.60-0.84 → สีเหลือง "⚠️ ตรวจสอบก่อนยืนยัน", <0.60 → ว่าง; polling `GET /api/ai/jobs/:jobId/status` ทุก 3s จนกว่า completed/failed
- [ ] T018 [P] [US1] อัปเดต `frontend/components/ai/AiStatusBanner.tsx` — แสดง AI service status (online/offline/queue-paused); ถ้า offline → banner "AI ไม่พร้อม กรอก Metadata เอง" แทน spinner
- [ ] T019 [US1] Trigger dual-queue จาก Document commit flow — หาจุดใน `backend/src/modules/documents/document.service.ts` (หรือ `rfa.service.ts`) ที่ commit document แล้ว: wrap `Promise.all([queueSuggestJob(), queueEmbedJob()])` **ใน try/catch** (FR-017) — on success: ไม่ await result (fire-and-forget); on catch: `Logger.error('AI job queue failed', { documentPublicId, error })` **ไม่ throw** เพื่อไม่ทำลาย commit flow; set `ai_processing_status = 'FAILED'` ของ document record
- [ ] T019B [US1] อัปเดต `ai-realtime.processor.ts` + `ai-batch.processor.ts` — เมื่อ dequeue: set `document.ai_processing_status = 'PROCESSING'`; เมื่อ ทั้ง ai-suggest + embed-document สำเร็จ: set `ai_processing_status = 'DONE'`; เมื่อ dead-letter: set `ai_processing_status = 'FAILED'` (FR-018)
- [ ] T020 [US1] ทดสอบ fallback: ปิด OLLAMA_HOST → อัปโหลดเอกสาร → ตรวจสอบว่า document บันทึกได้ปกติและ UI แสดง warning ไม่ใช่ error 500

**Checkpoint**: อัปโหลด Digital PDF → AI Suggestion ใน 30s; อัปโหลด Scanned PDF → Suggestion ใน 90s; ai_audit_logs มี record ใหม่

---

## Phase 4: User Story 2 — RAG-based Document Q&A (Priority: P2)

**Goal**: Full-document chunked embedding + projectPublicId isolation + RAG query endpoint

**Independent Test**: embed 2 docs ใน Project A, query → ได้เฉพาะ Project A; latency < 10s

### Implementation

- [ ] T021 [US2] สร้าง `backend/src/modules/ai/services/embedding.service.ts` — `embedDocument(pdfPath, documentPublicId, projectPublicId)`: ดึงข้อความ full-doc ด้วย PyMuPDF, chunk 512 tokens / 64 overlap, เรียก `OllamaService.generateEmbedding()` ต่อ chunk, upsert ไป Qdrant ผ่าน `QdrantService.upsert(projectPublicId, points)` (ต้องส่ง projectPublicId เสมอ)
- [ ] T022 [US2] อัปเดต embed-document logic ใน `ai-batch.processor.ts` — เรียก `EmbeddingService.embedDocument()` พร้อมรับ retries; ถ้า fail 3 ครั้ง → dead-letter; อัปเดต `ai_audit_logs` status
- [ ] T023 [US2] สร้าง `backend/src/modules/ai/dto/rag-query.dto.ts` — field: `projectPublicId: string` (IsUUID, Required), `question: string` (MaxLength 500), `topK: number` (Min 1, Max 20, Default 5)
- [ ] T024 [US2] อัปเดต `backend/src/modules/ai/rag/rag.service.ts` — method `query(dto: RagQueryDto)`: embed คำถามด้วย nomic-embed-text, call `QdrantService.search(dto.projectPublicId, embedding, dto.topK)`, ส่ง context ไป OllamaService, return `{ answer, sources: [{documentPublicId, chunkText, pageNumber}] }`
- [ ] T025 [US2] เพิ่ม endpoint `POST /api/ai/rag/query` ใน `ai.controller.ts` — รับ `RagQueryDto`, queue ไป `ai-realtime` (rag-query), return jobId; CASL guard: `ai.query`
- [ ] T026 [P] [US2] อัปเดต `frontend/components/ai/RagChatWidget.tsx` — ส่ง `projectPublicId` ใน request body; แสดง sources citation (document name + page); แสดง "เอกสารใหม่อาจยังไม่อยู่ใน index" ถ้า document < 5 นาที
- [ ] T027 [US2] ทดสอบ multi-tenancy: embed doc ใน Project A และ Project B → query ด้วย projectPublicId ของ A → ต้องไม่เห็น doc ของ B ในผล (ตรวจสอบใน Qdrant query log)
- [ ] T028 [US2] เพิ่ม `QdrantService.deleteByDocument(projectPublicId, documentPublicId)` — ใช้เมื่อ document ถูกลบออกจาก DMS; hook เข้า `document.service.ts` soft-delete flow

**Checkpoint**: RAG query ตอบกลับ < 10s; ผล isolate ตาม projectPublicId; Qdrant ไม่มีข้อมูลข้ามโครงการ

---

## Phase 5: User Story 3 — Legacy Migration Pipeline (Priority: P3)

**Goal**: n8n → DMS API → migration_review_queue → Admin Review UI

**Independent Test**: POST /api/ai/migration/queue → queue item PENDING → Admin Approve → document imported + embed queued

### Implementation

- [ ] T029 [US3] สร้าง `backend/src/modules/ai/dto/migration-queue-item.dto.ts` — field: `batchId: string`, `filename: string`, `tempPath: string`; idempotencyKey ดึงจาก header
- [ ] T030 [US3] สร้าง `backend/src/modules/ai/services/migration.service.ts` — method `queueForReview(dto, idempotencyKey)`: สร้าง `MigrationReviewQueue` record (status=PENDING), queue `ai-batch: ocr + extract-metadata`; method `approve(publicId, reviewedBy)`: import document, queue `embed-document`; method `reject(publicId, reason)`; method `findAll(filters)` pagination
- [ ] T031 [US3] เพิ่ม endpoint ใน `ai.controller.ts`: `POST /api/ai/migration/queue` (Idempotency-Key header required), `GET /api/ai/migration/queue`, `POST /api/ai/migration/queue/:publicId/approve`, `POST /api/ai/migration/queue/:publicId/reject`; CASL guard: `ai.manage` (SYSTEM_ADMIN only)
- [ ] T032 [P] [US3] สร้าง `frontend/components/ai/migration-queue-table.tsx` — แสดง list ของ migration_review_queue; column: filename, confidenceScore (badge), status, ocrUsed; ปุ่ม Approve/Reject ต่อ row; filter by status/batchId
- [ ] T033 [P] [US3] สร้าง `frontend/app/(dashboard)/ai-staging/migration-review/page.tsx` — ใช้ `MigrationQueueTable` component; TanStack Query สำหรับ data fetching + optimistic update เมื่อ approve/reject
- [ ] T034 [US3] อัปเดต `frontend/app/(dashboard)/ai-staging/page.tsx` — เพิ่ม tab "Migration Queue" link ไปยัง `/ai-staging/migration-review`
- [ ] T035 [US3] ทดสอบ Idempotency: POST migration/queue 2 ครั้งด้วย Idempotency-Key เดิม → ตรวจสอบว่า record ไม่ถูกสร้างซ้ำ (HTTP 409 ครั้งที่สอง)

**Checkpoint**: n8n สามารถ POST และได้ 202; Admin เห็น queue ใน UI; Approve → document import + embed queued

---

## Phase 6: User Story 4 — AI Monitoring & Threshold Management (Priority: P4)

**Goal**: Admin dashboard AI metrics + threshold recalibration + ai_audit_logs delete permission

**Independent Test**: Admin ดู dashboard → เห็น confidence distribution; Admin ลบ test log → audit_logs บันทึก

### Implementation

- [ ] T036 [US4] เพิ่ม endpoint `GET /api/ai/analytics/summary` ใน `ai.controller.ts` — query `ai_audit_logs` GROUP BY document_type, status; return: avgConfidence, overrideRate, rejectedRate per type; CASL: `ai.read_analytics`
- [ ] T037 [US4] เพิ่ม endpoint `DELETE /api/ai/audit-logs/:publicId` — CASL: `ai.delete_audit` (SYSTEM_ADMIN only); บันทึกใน `audit_logs` (action: 'AI_AUDIT_LOG_DELETED', targetId: publicId)
- [ ] T038 [P] [US4] อัปเดต `frontend/app/(dashboard)/ai-staging/page.tsx` — เพิ่ม tab "AI Analytics"; แสดง: confidence distribution bar chart (TBD: ใช้ recharts หรือ shadcn chart), override rate, rejected rate แยกตาม document_type
- [ ] T039 [P] [US4] เพิ่ม Threshold Recalibration UI ใน ai-staging page — แสดง current threshold (HIGH=0.85, MID=0.60 จาก ENV), แสดงคำแนะนำ "ถ้า override rate > 40% → ลด threshold เป็น X", link ไปที่ ENV documentation; ไม่ใช่ปุ่มอัตโนมัติ — Admin ปรับ ENV เอง
- [ ] T040 [US4] ทดสอบ delete permission: STAFF role พยายาม DELETE → 403; SYSTEM_ADMIN DELETE → 200; `audit_logs` มี record ใหม่ action='AI_AUDIT_LOG_DELETED'

**Checkpoint**: Admin dashboard แสดง metrics; delete audit log บันทึกใน audit_logs; threshold guidance แสดงถูกต้อง

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: i18n, error messages, documentation

- [ ] T041 [P] เพิ่ม i18n keys สำหรับ AI module ใน `public/locales/th/ai.json` และ `public/locales/en/ai.json` — รวม: ai suggestion labels, migration queue statuses, error messages (ไม่ hardcode text ใน component)
- [ ] T042 [P] เพิ่ม i18n key สำหรับ fallback messages: `ai.service_unavailable`, `ai.new_doc_not_indexed`, `ai.no_results_found`
- [ ] T043 ตรวจสอบ `backend-tsc.txt` และ `frontend-tsc.txt` — ต้องไม่มี TypeScript error จาก files ที่แก้
- [ ] T044 รัน `grep -r "console.log" backend/src/modules/ai --include="*.ts"` → ต้องไม่มีผล (ใช้ Logger แทน)
- [ ] T045 รัน quickstart.md Verification Scenarios ทั้ง 6 scenarios และ document ผล
- [ ] T046 อัปเดต `specs/03-Data-and-Storage/deltas/14-add-migration-review-queue.sql` ให้สมบูรณ์และ run ใน dev DB
- [ ] T047 [P] อัปเดต `CHANGELOG.md` — เพิ่ม entry สำหรับ ADR-023A implementation

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: ไม่มี dependency — เริ่มได้ทันที; **MUST** เสร็จก่อนทุก Phase
- **Phase 2 (Foundation)**: ขึ้นอยู่กับ Phase 1 — BLOCKS ทุก User Story
- **Phase 3 (US1 - P1)**: ขึ้นอยู่กับ Phase 2 — MVP สำคัญที่สุด
- **Phase 4 (US2 - P2)**: ขึ้นอยู่กับ Phase 2; ใช้ `EmbeddingService` และ `QdrantService` จาก Phase 2
- **Phase 5 (US3 - P3)**: ขึ้นอยู่กับ Phase 2; อาจรันพร้อม Phase 4 ได้ (คนละ service)
- **Phase 6 (US4 - P4)**: ขึ้นอยู่กับ Phase 3 (ต้องมี ai_audit_logs data)
- **Phase 7 (Polish)**: ขึ้นอยู่กับทุก Phase ก่อนหน้า

### User Story Dependencies (Internal)

- **US1**: T013 → T014 → T015, T016 (parallel); T019 ต้องหลัง T014
- **US2**: T021 → T022; T023 → T024 → T025; T026, T027 parallel กับ T025
- **US3**: T029 → T030 → T031; T032, T033 parallel กับ T031
- **US4**: T036, T037 parallel; T038, T039 parallel กับ T036

### Parallel Opportunities per Phase

**Phase 1**: T002 ‖ T003 ‖ T004 (ทำพร้อมกันได้)
**Phase 2**: T008 ‖ T009 ‖ T010 ‖ T012 (ทำพร้อมกันได้หลัง T006, T007, T011)
**Phase 3**: T017 ‖ T018 พร้อมกัน; T019 ต้องหลัง T014
**Phase 4**: T021 ‖ T023 พร้อมกัน (คนละ service); T026 ‖ T027 พร้อมกัน
**Phase 5**: T032 ‖ T033 ‖ T034 พร้อมกัน (frontend tasks)

---

## Implementation Strategy

### MVP Scope (Phase 1 + 2 + 3 เท่านั้น)

1. Phase 1: ลบ Typhoon, ตั้ง 2-queue, สร้าง delta → **Tier 1 Critical ✅**
2. Phase 2: Foundation AI infrastructure → **Core engine ready**
3. Phase 3: US1 - Document Classification → **User value delivered**
4. **STOP และ VALIDATE**: ทดสอบ AI Suggestion flow end-to-end
5. Deploy MVP ถ้าพร้อม

### Incremental Delivery

- Phase 3 done → MVP: Classification on Upload ✅
- Phase 4 done → RAG Q&A ✅
- Phase 5 done → Migration Pipeline ✅ (Pre-launch)
- Phase 6 done → Admin Monitoring ✅
- Phase 7 done → Complete ✅

---

## Metrics

- **Total Tasks**: 47 tasks (T001–T047)
- **Phase 1 (Setup)**: 5 tasks
- **Phase 2 (Foundation)**: 7 tasks
- **Phase 3 (US1 P1)**: 8 tasks
- **Phase 4 (US2 P2)**: 8 tasks
- **Phase 5 (US3 P3)**: 7 tasks
- **Phase 6 (US4 P4)**: 5 tasks
- **Phase 7 (Polish)**: 7 tasks
- **Parallel [P] tasks**: 22 tasks (47%)
- **MVP Scope**: 20 tasks (Phase 1+2+3)
