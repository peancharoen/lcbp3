// File: specs/200-fullstacks/252-excel-data-review-pipeline/tasks.md
// Change Log:
// - 2026-09-05: Initial task list for 4-Layer Excel Data Review Pipeline (ADR-052)

# Tasks: 4-Layer Excel Data Review & AI Suggestion Pipeline

**Input**: Design documents from `specs/200-fullstacks/252-excel-data-review-pipeline/`
**Prerequisites**: plan.md, spec.md, data-model.md, contracts/
**ADR**: [ADR-052: 4-Layer Excel Data Review & AI Suggestion Pipeline](../../06-Decision-Records/ADR-052-excel-data-review-pipeline.md)

---

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (`US1`, `US2`, `US3`, `US4`)
- All file paths use absolute repo conventions.

---

## Phase 1: Setup (Types & Data Structures)

**Purpose**: สร้าง Types และ Data Contracts พื้นฐานที่ทุก Service ต้องใช้ร่วมกัน

- [x] T001 [P] Create DTOs and Interfaces in `backend/src/modules/migration/dto/excel-import-review.dto.ts`
- [x] T002 [P] Define `ReviewFinding`, `ReviewSessionData`, and `ExcelCorrespondenceRow` interfaces in `backend/src/modules/migration/types/excel-review.types.ts`
- [x] T003 Ensure Redis client service in `backend/src/modules/redis/` supports session TTL operations

---

## Phase 2: Foundational (Blocking Core Services)

**Purpose**: Core Utility & Parsing Services สำหรับอ่านและแปลงค่า Excel

- [x] T004 Implement `ExcelDateParserService` in `backend/src/modules/migration/services/excel-date-parser.service.ts` (DMY parsing, B.E. auto-convert $-543$, Chronology guard)
- [x] T005 Implement `ReviewSessionStashService` in `backend/src/modules/migration/services/review-session-stash.service.ts` (Redis 24h TTL, disk stash storage, and cleanup)
- [x] T006 Implement `ExcelRowBuilderService` in `backend/src/modules/migration/services/excel-row-builder.service.ts` (Single parser rule for both Check and Commit, ignores `[AI]` columns)

**Checkpoint**: Foundation ready — User Story implementation can begin.

---

## Phase 3: User Story 1 - Routine Correspondence Batch Import with Instant Review (Priority: P1) 🎯 MVP

**Goal**: ตรวจสอบ Layer 1 (Schema) และ Layer 2 (Business Rules: Org, Type, Date, Doc Number, Single Project)

**Independent Test**: อัปโหลดไฟล์ Excel 20 แถว ส่งผ่าน `POST /check` ได้รับรายงานผลสรุป Pass/Warn/Block ภายใน 2 วินาที

- [x] T007 [US1] Implement Layer 1 Schema Validator in `backend/src/modules/migration/services/excel-schema-validator.service.ts`
- [x] T008 [US1] Implement Layer 2 Business Rules Validator in `backend/src/modules/migration/services/excel-business-rules.service.ts` (Cross-table checks against `organizations`, `correspondence_types`, `disciplines`, duplicate doc numbers)
- [x] T009 [US1] Implement `ExcelDataReviewService.check()` orchestration in `backend/src/modules/migration/services/excel-data-review.service.ts`
- [x] T010 [US1] Add `POST /api/v1/correspondence/import-review/check` endpoint with CASL Guard in `backend/src/modules/migration/excel-import-review.controller.ts`
- [x] T011 [P] [US1] Unit test for Layer 1 & Layer 2 in `backend/src/modules/migration/services/excel-business-rules.service.spec.ts`

---

## Phase 4: User Story 2 - Download Annotated Excel with AI Suggestions (Priority: P1)

**Goal**: Layer 3 AI Reviewer + สร้างไฟล์ `.xlsx` ฉบับมีสีและ Cell Notes ให้ผู้ใช้ดาวน์โหลด

**Independent Test**: ดาวน์โหลดไฟล์ที่ระบบสร้างขึ้น เปิดใน Excel ตรวจพบ Sheet `Review_Summary` และ Sheet `Data` มีสีและคอมเมนต์

- [x] T012 [US2] Implement `AiReviewProviderFactory` in `backend/src/modules/migration/services/ai-review-provider.factory.ts` (Tier 1 Local Ollama, Tier 2 Gemini, Tier 3 Claude with Admin Guard)
- [x] T013 [US2] Implement `ExcelAnnotatorService` using `exceljs` in `backend/src/modules/migration/services/excel-annotator.service.ts` (Dual-sheet, color fills `#FFF2CC` / `#FCE4D6`, cell notes, audit columns)
- [x] T014 [US2] Integrate Layer 3 into `ExcelDataReviewService.check()` with Fail-Open policy
- [x] T015 [US2] Add `GET /api/v1/correspondence/import-review/:sessionId/download-annotated` endpoint in `backend/src/modules/migration/excel-import-review.controller.ts`
- [x] T016 [P] [US2] Unit test for Annotated Excel generation in `backend/src/modules/migration/services/excel-annotator.service.spec.ts`

---

## Phase 5: User Story 3 - Legacy Migration Batch Ingestion with Quarantine Error Handling (Priority: P2)

**Goal**: รองรับโหมด `MIGRATION_STAGING` ที่กักกันแถวเสียลง `migration_errors` และส่งแถวดีเข้า `migration_review_queue`

**Independent Test**: รัน Batch 100 แถวที่มี 5 แถวเสีย ยืนยันว่า 95 แถวเข้าคิว OCR และ 5 แถวถูกกักกันพร้อมมีปุ่มดาวน์โหลด `failed_rows.xlsx`

- [x] T017 [US3] Implement Quarantine & Partial Ingest logic for `MIGRATION_STAGING` in `backend/src/modules/migration/services/excel-data-review.service.ts`
- [x] T018 [US3] Implement `generateFailedRowsExcel()` in `backend/src/modules/migration/services/excel-annotator.service.ts`
- [x] T019 [P] [US3] Unit test for Quarantine handling in `backend/src/modules/migration/services/excel-data-review-quarantine.spec.ts`

---

## Phase 6: User Story 4 - Two-Phase Confirmation with Stash Hygiene (Priority: P2)

**Goal**: Re-validation ซ้ำตอน Confirm, บันทึกลง DB จริง, ลบไฟล์ Stash และบันทึก `import_transactions`

**Independent Test**: สั่ง Confirm สำเร็จ ยืนยันว่าไฟล์ Stash ถูกลบ และมีบันทึกใหม่ใน `import_transactions`

- [x] T020 [US4] Implement `ExcelDataReviewService.confirm()` with mandatory Layer 1 & 2 Re-validation
- [x] T021 [US4] Implement `ExcelDataReviewService.cancel()` for immediate stash cleanup
- [x] T022 [US4] Add `POST /confirm` and `POST /cancel` endpoints in `backend/src/modules/migration/excel-import-review.controller.ts`
- [x] T023 [US4] Schedule midnight BullMQ Cron worker for expired stash directories cleanup in `backend/src/modules/migration/workers/clean-expired-stashes.worker.ts`
- [x] T024 [P] [US4] Unit test for Confirmation & Stash cleanup in `backend/src/modules/migration/services/excel-data-review-confirm.spec.ts`

---

## Phase 7: Polish & Verification

**Purpose**: Module Registration, End-to-End Test, และ Verification Loop

- [x] T025 Register all new services and controller in `backend/src/modules/migration/migration.module.ts`
- [x] T026 [P] Integration test in `backend/tests/integration/excel-import-review.spec.ts`
- [x] T027 Run build, lint, and typecheck to verify zero `any`, zero `console.log`, and strict compliance
