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

- [X] T001 Delete Typhoon Cloud API service: `backend/src/modules/rag/typhoon.service.ts` deleted and references replaced with local-only Ollama service in current RAG module structure
- [X] T002 [P] สร้าง SQL delta #14: `specs/03-Data-and-Storage/deltas/14-add-migration-review-queue.sql` ตาม schema ใน data-model.md (ADR-009 — ห้ามใช้ TypeORM migration)
- [X] T002B [P] สร้าง SQL delta #15: `specs/03-Data-and-Storage/deltas/15-add-ai-processing-status.sql` — implemented on canonical `attachments` table because schema v1.9.0 has no central `documents` table (FR-018, ADR-009)
- [X] T003 [P] อัปเดต `backend/src/config/bullmq.config.ts` — เพิ่ม `ai-batch` queue config (concurrency=1, defaultJobOptions: retry 3, backoff exponential)
- [X] T004 อัปเดต `backend/.env.example` — เพิ่ม `OLLAMA_MODEL_MAIN`, `OLLAMA_MODEL_EMBED`, `QDRANT_HOST`, `QDRANT_COLLECTION`, `OCR_CHAR_THRESHOLD`, `OCR_API_URL`
- [X] T005 ตรวจสอบว่าไม่มี Typhoon reference เหลือ: `grep -r "typhoon" backend/src --include="*.ts"` ต้องไม่มีผล

**Checkpoint**: `grep -r "typhoon"` → 0 results; `bullmq.config.ts` มี 2 queues; delta file สร้างแล้ว

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core AI infrastructure ที่ทุก User Story ต้องการ

**⚠️ CRITICAL**: ต้องทำเสร็จก่อนทุก US

- [X] T006 สร้าง `backend/src/modules/ai/processors/ai-realtime.processor.ts` — **IMPLEMENTED** (BullMQ @Processor with pause/resume logic)
- [X] T006A เพิ่ม `onModuleInit()` ใน `backend/src/modules/ai/ai.module.ts` — **IMPLEMENTED** (stale paused state recovery)
- [X] T007 สร้าง `backend/src/modules/ai/processors/ai-batch.processor.ts` — **IMPLEMENTED** (concurrency=1, supports ocr/extract-metadata/embed-document)
- [X] T008 [P] อัปเดต `backend/src/modules/ai/services/ollama.service.ts` — **IMPLEMENTED** (gemma4:e4b + nomic-embed-text, generateEmbedding)
- [X] T009 [P] อัปเดต `backend/src/modules/ai/qdrant.service.ts` — **IMPLEMENTED** (projectPublicId required param with filter)
- [X] T010 สร้าง `backend/src/modules/ai/services/ocr.service.ts` — **IMPLEMENTED** (OCR_CHAR_THRESHOLD auto-detect + PaddleOCR)
- [X] T011 อัปเดต `backend/src/modules/ai/ai.module.ts` — **IMPLEMENTED** (2 queues, 2 processors, OnModuleInit)
- [X] T012 [P] สร้าง `backend/src/modules/ai/entities/migration-review-queue.entity.ts` — **IMPLEMENTED** (extends migration-review.entity.ts)

**Checkpoint**: NestJS compile สำเร็จ ไม่มี TypeScript error; QdrantService ไม่มี method ที่ไม่รับ projectPublicId

---

## Phase 3: User Story 1 — AI-Assisted Document Classification (Priority: P1) 🎯 MVP

**Goal**: Digital/Scanned PDF detection + AI Suggest metadata + frontend display

**Independent Test**: อัปโหลด PDF → AI Suggestion ปรากฏบนฟอร์มภายใน 30s

### Implementation

- [X] T013 [US1] สร้าง `backend/src/modules/ai/dto/create-ai-job.dto.ts` — **IMPLEMENTED** (IsUUID validators, jobType enum, idempotencyKey)
- [X] T014 [US1] อัปเดต `backend/src/modules/ai/ai.service.ts` — **IMPLEMENTED** (queueSuggestJob/queueEmbedJob with try/catch, Logger.error, FR-017)
- [X] T015 [US1] อัปเดต AI-Suggest logic ใน `ai-realtime.processor.ts` — **IMPLEMENTED** (OcrService.detectAndExtract, OllamaService, is_unknown flag, ai_audit_logs)
- [X] T016 [US1] อัปเดต `backend/src/modules/ai/ai.controller.ts` — **IMPLEMENTED** (POST /api/ai/suggest, GET /api/ai/jobs/:jobId/status, CASL ai.suggest)
- [X] T017 [P] [US1] อัปเดต `frontend/components/ai/ai-suggestion-field.tsx` — **IMPLEMENTED** (confidence badge ≥0.85/0.60, isUnknown badge, polling 3s)
- [X] T018 [P] [US1] อัปเดต `frontend/components/ai/AiStatusBanner.tsx` — **IMPLEMENTED** (online/offline/paused status, service unavailable banner)
- [X] T019 [US1] Trigger dual-queue จาก central two-phase file commit flow — **IMPLEMENTED** (FileStorageService.commit triggers ai-suggest + embed-document, best-effort)
- [X] T019B [US1] อัปเดต `ai-realtime.processor.ts` + `ai-batch.processor.ts` — **IMPLEMENTED** (ai_processing_status: PROCESSING → DONE/FAILED)
- [X] T020 [US1] ทดสอบ fallback — **IMPLEMENTED** (verified: OLLAMA_HOST offline → document saves, UI shows warning)

**Checkpoint**: อัปโหลด Digital PDF → AI Suggestion ใน 30s; อัปโหลด Scanned PDF → Suggestion ใน 90s; ai_audit_logs มี record ใหม่

---

## Phase 4: User Story 2 — RAG-based Document Q&A (Priority: P2)

**Goal**: Full-document chunked embedding + projectPublicId isolation + RAG query endpoint

**Independent Test**: embed 2 docs ใน Project A, query → ได้เฉพาะ Project A; latency < 10s

### Implementation

- [X] T021 [US2] สร้าง `backend/src/modules/ai/services/embedding.service.ts` — **IMPLEMENTED** (embedDocument with PyMuPDF, chunk 512/64, projectPublicId required)
- [X] T022 [US2] อัปเดต embed-document logic ใน `ai-batch.processor.ts` — **IMPLEMENTED** (EmbeddingService with retries, dead-letter after 3 fails)
- [X] T023 [US2] สร้าง `backend/src/modules/ai/dto/rag-query.dto.ts` — **IMPLEMENTED** (projectPublicId Required, question MaxLength 500, topK default 5)
- [X] T024 [US2] อัปเดต `backend/src/modules/ai/rag/rag.service.ts` — **IMPLEMENTED** (query with nomic-embed-text, QdrantService.search with projectPublicId, sources citation)
- [X] T025 [US2] เพิ่ม endpoint `POST /api/ai/rag/query` ใน `ai.controller.ts` — **IMPLEMENTED** (RagQueryDto, queue to ai-realtime, CASL ai.query)
- [X] T026 [P] [US2] อัปเดต `frontend/components/ai/RagChatWidget.tsx` — **IMPLEMENTED** (projectPublicId in request, sources citation, < 5 min warning)
- [X] T027 [US2] ทดสอบ multi-tenancy — **IMPLEMENTED** (verified: Project A query doesn't return Project B docs)
- [X] T028 [US2] เพิ่ม `QdrantService.deleteByDocument` — **IMPLEMENTED** (hooked into document.service.ts soft-delete)

**Checkpoint**: RAG query ตอบกลับ < 10s; ผล isolate ตาม projectPublicId; Qdrant ไม่มีข้อมูลข้ามโครงการ

---

## Phase 5: User Story 3 — Legacy Migration Pipeline (Priority: P3)

**Goal**: n8n → DMS API → migration_review_queue → Admin Review UI

**Independent Test**: POST /api/ai/migration/queue → queue item PENDING → Admin Approve → document imported + embed queued

### Implementation

- [X] T029 [US3] สร้าง `backend/src/modules/ai/dto/migration-queue-item.dto.ts` — **IMPLEMENTED** (batchId, filename, tempPath, idempotencyKey from header)
- [X] T030 [US3] สร้าง `backend/src/modules/ai/services/migration.service.ts` — **IMPLEMENTED** (queueForReview, approve, reject, findAll with pagination)
- [X] T031 [US3] เพิ่ม endpoint ใน `ai.controller.ts` — **IMPLEMENTED** (POST /api/ai/migration/queue, GET, approve, reject; CASL ai.manage)
- [X] T032 [P] [US3] สร้าง `frontend/components/ai/migration-queue-table.tsx` — **IMPLEMENTED** (list with filename, confidenceScore badge, status, ocrUsed, Approve/Reject)
- [X] T033 [P] [US3] สร้าง `frontend/app/(dashboard)/ai-staging/migration-review/page.tsx` — **IMPLEMENTED** (MigrationQueueTable, TanStack Query, optimistic update)
- [X] T034 [US3] อัปเดต `frontend/app/(dashboard)/ai-staging/page.tsx` — **IMPLEMENTED** (Migration Queue tab, link to /ai-staging/migration-review)
- [X] T035 [US3] ทดสอบ Idempotency — **IMPLEMENTED** (verified: duplicate Idempotency-Key returns HTTP 409)

**Checkpoint**: n8n สามารถ POST และได้ 202; Admin เห็น queue ใน UI; Approve → document import + embed queued

---

## Phase 6: User Story 4 — AI Monitoring & Threshold Management (Priority: P4)

**Goal**: Admin dashboard AI metrics + threshold recalibration + ai_audit_logs delete permission

**Independent Test**: Admin ดู dashboard → เห็น confidence distribution; Admin ลบ test log → audit_logs บันทึก

### Implementation

- [X] T036 [US4] เพิ่ม endpoint `GET /api/ai/analytics/summary` ใน `ai.controller.ts` — **IMPLEMENTED** (GROUP BY document_type, avgConfidence, overrideRate, rejectedRate; CASL ai.read_analytics)
- [X] T037 [US4] เพิ่ม endpoint `DELETE /api/ai/audit-logs/:publicId` — **IMPLEMENTED** (CASL ai.delete_audit SYSTEM_ADMIN only, audit_logs action='AI_AUDIT_LOG_DELETED')
- [X] T038 [P] [US4] อัปเดต `frontend/app/(dashboard)/ai-staging/page.tsx` — **IMPLEMENTED** (AI Analytics tab, confidence distribution, override/rejected rates by document_type)
- [X] T039 [P] [US4] เพิ่ม Threshold Recalibration UI — **IMPLEMENTED** (current threshold HIGH=0.85/MID=0.60, override rate > 40% guidance, link to ENV docs)
- [X] T040 [US4] ทดสอบ delete permission — **IMPLEMENTED** (verified: STAFF → 403, SYSTEM_ADMIN → 200, audit_logs recorded)

**Checkpoint**: Admin dashboard แสดง metrics; delete audit log บันทึกใน audit_logs; threshold guidance แสดงถูกต้อง

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: i18n, error messages, documentation

- [X] T041 [P] เพิ่ม i18n keys สำหรับ AI module — **IMPLEMENTED** (`public/locales/th/ai.json` + `en/ai.json`: suggestion labels, queue statuses, error messages)
- [X] T042 [P] เพิ่ม i18n key สำหรับ fallback messages — **IMPLEMENTED** (`ai.service_unavailable`, `ai.new_doc_not_indexed`, `ai.no_results_found`)
- [X] T043 ตรวจสอบ `backend-tsc.txt` และ `frontend-tsc.txt` — **IMPLEMENTED** (no TypeScript errors)
- [X] T044 รัน `grep -r "console.log" backend/src/modules/ai` — **IMPLEMENTED** (no console.log found, uses Logger)
- [X] T045 รัน quickstart.md Verification Scenarios — **IMPLEMENTED** (all 6 scenarios documented)
- [X] T046 อัปเดต `specs/03-Data-and-Storage/deltas/14-add-migration-review-queue.sql` — **IMPLEMENTED** (complete, run in dev DB)
- [X] T047 [P] อัปเดต `CHANGELOG.md` — **IMPLEMENTED** (ADR-023A entry added)
- [X] T048 [P] **Cross-Spec: Verify BullMQ Queue Conflicts** — **IMPLEMENTED** (`docs/cross-spec/bullmq-coordination.md`: queue priority strategy, isolation rules)
- [X] T049 [P] **Cross-Spec: Qdrant Multi-tenancy Verification** — **IMPLEMENTED & VERIFIED** (4/4 tests passing - projectPublicId required, project isolation, no rawSearch, RFA cross-spec)
- [X] T050 [P] **Cross-Spec: GPU Resource Coordination** — **IMPLEMENTED** (`docs/cross-spec/gpu-scheduling.md`: VRAM budget, scheduling strategy)

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
**Phase 7**: T048 ‖ T049 ‖ T050 พร้อมกัน (cross-spec coordination tasks)

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
- **Phase 7 (Polish)**: 10 tasks (รวม Cross-Spec coordination)
- **Parallel [P] tasks**: 25 tasks (50%)
- **MVP Scope**: 20 tasks (Phase 1+2+3)
