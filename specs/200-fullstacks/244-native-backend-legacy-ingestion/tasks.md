# Tasks: 244-native-backend-legacy-ingestion

**Branch**: `244-native-backend-legacy-ingestion` | **Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)
**Status**: Ready for Implementation

---

## 📋 Task Breakdown & Dependency Graph

```text
Phase 1: Setup & Schema
  ├── T001: Install exceljs & @types/exceljs
  └── T002: Verify & update DB Schema for ocr_text in staging queue (ADR-042/044)

Phase 2: Core Ingestion Engine
  ├── T003: Create DTOs for Ingestion and OCR updates
  ├── T004: Implement LegacyIngestionService (Streaming reader + Header auto-detect + Checkpoint)
  └── T005: Create Unit Tests for LegacyIngestionService

Phase 3: AI Worker & OCR RAG Sync
  ├── T006: Add legacy-ai-enrichment handler in AiBatchProcessor (OCR 3 pages + Tagging)
  ├── T007: Implement OCR update and RAG re-embedding in MigrationReviewService
  └── T008: Unit Tests for AI Enrichment & OCR sync

Phase 4: CLI Command & Controller Endpoints
  ├── T009: Implement CLI Ingestion Script (pnpm run migration:ingest)
  ├── T010: Add Ingestion API endpoints in MigrationController
  └── T011: Register services in MigrationModule & verify RBAC permissions

Phase 5: Frontend Admin UI & OCR Editor
  ├── T012: Add API client functions in frontend (lib/api/migration.ts)
  ├── T013: Build Ingestion Upload & Progress Card Component
  ├── T014: Build OCR 3-Page Text Editor & RAG Sync Panel in Review Queue
  └── T015: Frontend Unit Tests & i18n localization keys

Phase 6: Verification & End-to-End Testing
  ├── T016: Run Backend test suite, lint, and build
  ├── T017: Run Frontend test suite, lint, and build
  └── T018: End-to-end simulation test in Sandbox environment
```

---

## 🛠️ Detailed Tasks

### Phase 1: Setup & Schema
- [x] **T001**: Add `exceljs` and `@types/exceljs` dependencies to `backend/package.json`
- [x] **T002**: Verify schema delta for `ocr_text LONGTEXT NULL` on `migration_review_queue` and `attachments` in `specs/03-Data-and-Storage/deltas/` if not already present

### Phase 2: Core Ingestion Engine
- [x] **T003**: Create DTOs in `backend/src/modules/migration/dto/`:
  - `start-ingest.dto.ts` (validation for file path, project publicId, contract code)
  - `update-queue-ocr.dto.ts` (validation for ocr_text update)
- [x] **T004**: Implement `LegacyIngestionService` (`backend/src/modules/migration/services/legacy-ingestion.service.ts`):
  - Streaming reader using `ExcelJS.stream.xlsx.WorkbookReader` (reads first sheet by default or `--sheet` option)
  - Auto-detect Header mapping (TH/EN)
  - Sender/Receiver Org auto-match with fallback to `details.unresolved_orgs`
  - Lazy PDF file check via `fs.existsSync`
  - Staging queue insertion (`migration_review_queue`)
  - Checkpoint recording (`migration_progress`) every 50 rows
  - Error logging (`migration_errors`)
  - BullMQ job dispatching (`ai-batch`)
- [x] **T005**: Write comprehensive unit tests in `backend/src/modules/migration/services/legacy-ingestion.service.spec.ts`

### Phase 3: AI Worker & OCR RAG Sync
- [x] **T006**: Update `AiBatchProcessor` (`backend/src/modules/ai/processors/ai-batch.processor.ts`):
  - Handle job `legacy-ai-enrichment`
  - Extract 3 pages OCR via `np-dms-ocr`
  - Extract Tags and Category via `np-dms-ai`
  - Save `ocr_text` and metadata back to `migration_review_queue`
- [x] **T007**: Update `MigrationReviewService` (`backend/src/modules/migration/migration-review.service.ts`):
  - Implement `updateOcrText(publicId, ocrText, userId)`
  - Trigger `RagBatchService` to re-embed updated text into Qdrant
  - Implement background batch commit processor for safe batch approval without timeout
- [x] **T008**: Write unit tests for AI Enrichment and OCR sync in `backend/src/modules/migration/migration-review.service.spec.ts`

### Phase 4: CLI Command & Controller Endpoints
- [x] **T009**: Implement CLI script `backend/src/scripts/legacy-ingest.ts` with terminal progress bar and `--sheet`/`--resume` support
- [x] **T010**: Add Ingest, OCR & Batch endpoints in `backend/src/modules/migration/migration.controller.ts`:
  - `POST /api/migration/ingest/upload`
  - `POST /api/migration/ingest/start`
  - `PATCH /api/migration/queue/:publicId/ocr`
  - `POST /api/migration/queue/batch-approve`
- [x] **T011**: Register `LegacyIngestionService` in `backend/src/modules/migration/migration.module.ts` and ensure CASL Guards are applied

### Phase 5: Frontend Admin UI & OCR Editor
- [x] **T012**: Add client API functions in `frontend/lib/services/migration.service.ts`
- [x] **T013**: Build Ingest Upload & Progress Card in `frontend/components/migration/legacy-ingestion-card.tsx`
- [x] **T014**: Build OCR 3-Page Textarea Editor & Re-embed button in `frontend/components/migration/ocr-text-editor.tsx` (integrated into review detail page)
- [x] **T015**: Frontend unit tests updated for publicId-based API + ADR-019 compliance (i18n keys: existing Thai strings in components — TODO for full i18n extraction)

### Phase 6: Verification & End-to-End Testing
- [x] **T016**: Run backend test suite and verification (`pnpm test`, `pnpm run lint`, `pnpm run build`) — 153 migration tests pass, lint clean, build OK
- [x] **T017**: Run frontend test suite and verification (`pnpm test`, `pnpm run lint`, `pnpm run build`) — 9 migration service tests pass, lint clean, build OK (2 pre-existing api-error.test.ts failures unrelated)
- [ ] **T018**: Execute end-to-end simulation in Sandbox environment with mock 100-row Excel file
