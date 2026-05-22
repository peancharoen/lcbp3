// File: specs/200-fullstacks/228-migration-arch-refactor/tasks.md
// Change Log:
// - 2026-05-22: Generated from plan.md + spec.md for ADR-028 Migration Architecture Refactor

# Tasks: ADR-028 Migration Architecture Refactor

**Branch**: `228-migration-arch-refactor` | **Generated**: 2026-05-22
**Total Tasks**: 32 | **Parallel Opportunities**: 12

> **Updated**: 2026-05-22 — เพิ่ม 2 tasks จาก quizme session (FR-001a/b, FR-005a/b, FR-007a, FR-010a/b)

---

## Phase 1: Setup

- [x] T001 สร้าง SQL delta file `specs/03-Data-and-Storage/deltas/2026-05-22-create-tags-tables.sql` ตาม data-model.md (tables: `tags`, `correspondence_tags`)
- [x] T001b สร้าง SQL delta file `specs/03-Data-and-Storage/deltas/2026-05-22-alter-migration-review-queue.sql` เพิ่ม column `ai_job_id VARCHAR(36) NULL` ใน `migration_review_queue` (ADR-009 — ตาราง migration_review_queue สร้างโดย 03-04 SQL แต่ไม่มี column นี้)
- [x] T002 Apply SQL delta ทั้งสอง (T001, T001b) ใน staging database และ verify schema ถูกต้อง
- [x] T003 สร้าง NestJS module skeleton `backend/src/modules/tags/tags.module.ts`
- [x] T004 สร้าง BullMQ job type constant `migrate-document` ใน `backend/src/common/constants/bullmq.constants.ts`
- [x] T004b อัปเดต n8n Node 0 "Set Configuration" ใน `specs/03-Data-and-Storage/03-05-n8n-migration-setup-guide.md` — (1) Idempotency-Key format deterministic: `{batchId}:{documentNumber}` ไม่ใช่ random UUID (FR-001a); (2) token pre-flight `GET /api/auth/me` ก่อน process records (FR-010a); (3) 401 mid-batch handler → write TOKEN_EXPIRED ลง migration_progress + resumable (FR-010b)

---

## Phase 2: Foundational (Blocking Prerequisites)

- [x] T005 สร้าง TypeORM Entity `Tag` ใน `backend/src/modules/tags/entities/tag.entity.ts` (fields: id, publicId UUIDv7, projectId, tagName, colorCode, description, createdBy, timestamps, deletedAt)
- [x] T006 [P] สร้าง TypeORM Entity `CorrespondenceTag` ใน `backend/src/modules/tags/entities/correspondence-tag.entity.ts` (fields: correspondenceId, tagId, isAiSuggested, confidence, createdBy, createdAt)
- [x] T007 สร้าง DTO `SubmitAiJobDto` ใน `backend/src/modules/ai/dto/submit-ai-job.dto.ts` (type: 'migrate-document', payload: MigrateDocumentPayload) พร้อม class-validator decorators
- [x] T008 [P] สร้าง DTO `AiJobResultDto` ใน `backend/src/modules/ai/dto/ai-job-result.dto.ts` (isValid, confidence, category, summary, suggestedTags, ocrMethod, processingTimeMs)

---

## Phase 3: US1 — n8n Submits AI Job via BullMQ (P1 — Blocking)

**Story Goal**: n8n สามารถส่ง PDF ผ่าน `POST /api/ai/jobs` และ poll ผลลัพธ์ได้

**Independent Test**: `curl -X POST /api/ai/jobs` พร้อม test PDF → poll จนได้ `status: completed` + AI JSON output

- [x] T009 [US1] สร้าง BullMQ Worker `MigrateDocumentWorker` ใน `backend/src/modules/ai/workers/migrate-document.worker.ts` — Step 1: fetch temp file from StorageService
- [x] T010 [P] [US1] เพิ่ม OCR routing logic ใน Worker — PyMuPDF Fast Path (chars > 100) หรือ PaddleOCR Slow Path — เรียกผ่าน OCR Service HTTP API (ไม่ใช่ direct Ollama)
- [x] T011 [P] [US1] เพิ่ม gemma4:e4b inference ใน Worker — System Prompt + User Prompt สำหรับ metadata extraction + classification + tagging
- [x] T012 [US1] เพิ่ม JSON validation + error handling ใน Worker (ADR-007) — ถ้า AI output ไม่ถูก format → mark job failed + log ใน `ai_audit_logs`
- [x] T013 [US1] เพิ่ม `submitMigrationJob()` method ใน `backend/src/modules/ai/ai.service.ts` — (1) Idempotency-Key check; (2) double-check `import_transactions` (document_number + batch_id + status != FAILED) ก่อน enqueue → 409 พร้อม existingJobId ถ้าซ้ำ (FR-001b); (3) enqueue ไปยัง ai-batch queue
- [x] T014 [US1] เพิ่ม `POST /api/ai/jobs` endpoint ใน `backend/src/modules/ai/ai.controller.ts` (JwtAuthGuard + CaslAbilityGuard + Idempotency-Key header validation)
- [x] T015 [P] [US1] เพิ่ม `GET /api/ai/jobs/:jobId` endpoint ใน `backend/src/modules/ai/ai.controller.ts` (JwtAuthGuard + status + result retrieval)
- [x] T016 [US1] เพิ่ม Scheduled BullMQ job `cleanup-temp-files` ใน `backend/src/modules/ai/workers/cleanup-temp-files.worker.ts` — ลบ temp attachments ที่ครบ 24h + ไม่มี commit **ยกเว้น** files ที่ถูก reference โดย migration_review_queue.status = PENDING (FR-005a)
- [x] T016b [P] [US1] สร้าง Scheduled BullMQ job `expire-pending-reviews` ใน `backend/src/modules/migration/workers/expire-pending-reviews.worker.ts` — รันรายวัน: auto-expire PENDING records ที่ไม่มี action ภายใน 30 วัน → status = EXPIRED + cleanup temp file + BullMQ notification job แจ้ง Admin (FR-005b)

---

## Phase 4: US3 — Schema Setup: Tags Tables (P1 — Parallel กับ US1)

**Story Goal**: `tags` และ `correspondence_tags` พร้อมใช้งานสำหรับ AI Tag Extraction

**Independent Test**: เรียก `POST /api/tags` สร้าง tag → link ไป correspondence → ตรวจ `correspondence_tags` table

- [x] T017 [P] [US3] สร้าง `TagsService` ใน `backend/src/modules/tags/tags.service.ts` (methods: create, findByProject, normalize, linkToCorrespondence)
- [x] T018 [P] [US3] สร้าง `TagsController` ใน `backend/src/modules/tags/tags.controller.ts` (GET /api/tags?projectId=, POST /api/tags) พร้อม CASL guard
- [x] T019 [US3] Register `TagsModule` ใน `backend/src/app.module.ts` และ add entities ใน TypeORM config

---

## Phase 5: US2 — Migration Review Queue Frontend (P2)

**Story Goal**: Document Controller/Admin เห็น review queue และ Execute Import ได้

**Independent Test**: Login ด้วย DOCUMENT_CONTROLLER → เข้า `/migration/review` → เห็น PENDING records → Execute Import → ตรวจ Correspondence สร้างสำเร็จ

- [x] T020a [US2] สร้าง `MigrationReviewService.commitRecord()` ใน `backend/src/modules/migration/migration-review.service.ts` — (1) `SELECT FOR UPDATE` บน migration_review_queue record → ถ้า status ไม่ใช่ PENDING → 409 ALREADY_PROCESSING (FR-007a); (2) update status เป็น PROCESSING; (3) สร้าง Correspondence, ย้าย temp attachment เป็น permanent, link tags, update import_transactions
- [x] T020b [US2] เพิ่ม `POST /api/ai/migration/review` endpoint ใน `backend/src/modules/migration/migration-review.controller.ts` (JwtAuthGuard + CaslAbilityGuard `migration.commit` + Idempotency-Key) เรียก `MigrationReviewService.commitRecord()`
- [x] T021 [P] [US2] เพิ่ม CASL permission `migration.commit` สำหรับ role DOCUMENT_CONTROLLER, ADMIN, SUPERADMIN ใน `backend/src/common/casl/ability.factory.ts`
- [x] T022 [P] [US2] สร้าง TypeScript types สำหรับ Migration Review ใน `frontend/types/dto/migration/migration-review.dto.ts`
- [x] T023 [P] [US2] สร้าง frontend hook `useMigrationReview()` ใน `frontend/hooks/use-migration-review.ts` (TanStack Query — fetch migration_review_queue + mutation execute import)
- [x] T024 [US2] สร้าง Migration Review Queue page `frontend/app/(dashboard)/migration/review/page.tsx` (table: document_number, confidence, category, status, suggested_tags, actions)
- [x] T025 [US2] สร้าง `ReviewQueueTable` component ใน `frontend/components/migration/review-queue-table.tsx` — รวม Tag Review (is_new highlight, approve/map/reject)

---

## Phase 6: US4 — Post-Migration Cleanup Script (P3)

**Story Goal**: ลบ migration tables ชั่วคราวหลัง Gate #3 ผ่าน (ยกเว้น import_transactions)

**Independent Test**: รัน cleanup script → ตรวจ 5 ตาราง drop แล้ว แต่ import_transactions ยังอยู่

- [x] T026 [US4] สร้าง SQL cleanup script `specs/03-Data-and-Storage/deltas/2026-05-22-drop-migration-tables.rollback.sql` สำหรับ restore (ถ้าจำเป็น)
- [x] T027 [US4] สร้าง SQL cleanup script `specs/03-Data-and-Storage/deltas/2026-05-22-drop-migration-tables.sql` — DROP TABLE IF EXISTS สำหรับ 5 ตาราง (explicit comment: `import_transactions` ไม่ drop)

---

## Phase 7: Polish & Cross-Cutting

- [x] T028 สร้าง ADR-028 document ใน `specs/06-Decision-Records/ADR-028-migration-architecture-refactor.md` — document ทุก decision จาก session นี้ (n8n→BullMQ, gemma4:e4b, PyMuPDF/PaddleOCR, token 7d, RBAC, table retention)

---

## Dependencies Graph

```
T001 → T002 (schema must apply before entities work)
T005, T006 → T017, T018, T019 (entities before service/controller)
T007, T008 → T013, T014, T015 (DTOs before service/endpoints)
T009 → T010 → T011 → T012 (Worker steps sequential)
T013, T014, T015 → T009 (Service before Worker registration)
T016 (independent)
T016b (independent, parallel กับ T016)
T019 → (tags available for Worker)
T020a → T020b → T024, T025 (service → controller → frontend)
T021 → T020b (CASL permission before controller endpoint)
T028 (independent — can do last)
```

## Parallel Execution Opportunities

**Group A (Phase 2 — can run in parallel):**
- T005 + T006 + T007 + T008

**Group B (US1 — can run in parallel after T009):**
- T010 + T011 (OCR routing + AI inference, different concerns)
- T014 + T015 (POST + GET endpoints, same controller different methods)

**Group C (US2 — can run in parallel after T020):**
- T022 + T023 (types + hook)
- T021 (CASL permission, different file)

**Group D (US3 — parallel กับ US1 entirely):**
- T017 + T018 (service + controller)

## Implementation Strategy

**MVP Scope (Phase 1-3 + Phase 4):**
- SQL delta apply + Tags entities
- `POST /api/ai/jobs` + `GET /api/ai/jobs/:jobId` + BullMQ Worker
- n8n สามารถรัน Migration ได้โดยผ่าน BullMQ (ตรง ADR-023A)

**Full Scope (+ Phase 5-7):**
- Migration Review Queue Frontend
- Post-migration cleanup
- ADR-028 documentation
