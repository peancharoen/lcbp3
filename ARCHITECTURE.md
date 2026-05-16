# Architecture

## Current Structure

- `backend/`: NestJS application with shared `CommonModule`, TypeORM entities, BullMQ queue integration, and feature modules such as `rfa`, `review-team`, `response-code`, `delegation`, `reminder`, and `distribution`.
- `frontend/`: Next.js dashboard application with route groups under `app`, shared components under `components`, and feature hooks under `hooks`.
- `specs/`: Core specifications plus categorized feature work. The active RFA approval refactor lives in `specs/200-fullstacks/204-rfa-approval-refactor`.

## Unified AI Architecture

- `backend/src/modules/ai`: ADR-023 gateway module for AI boundaries. It now owns AI queue registration, n8n service-account validation, the AI-scoped Qdrant gateway, and `MigrationReviewRecord` mapping for `migration_review_queue`.
- `backend/src/modules/ai/ai-ingest.service.ts`: publicId-based legacy migration staging service. It accepts n8n/API batches, stores files through `FileStorageService`, creates `migration_review_queue` records, and delegates final import to `MigrationService` after human review.
- `backend/src/modules/ai/workflows/folder-watcher.json`: n8n workflow template for watched-folder ingestion into `/api/ai/legacy-migration/ingest`.
- AI BullMQ queues are centralized in `backend/src/modules/common/constants/queue.constants.ts`: `ai-ingest`, `ai-rag-query`, and `ai-vector-deletion`.
- `frontend/app/(dashboard)/ai-staging`: dashboard route for reviewing AI staging records with constrained project/category/organization dropdowns before approval.
- `frontend/lib/api/ai.ts` and `frontend/components/ai/AiStatusBanner.tsx`: frontend ADR-023 hooks and graceful-degradation banner for AI staging.
- Schema changes for the AI staging queue and AI development feedback log are tracked as SQL delta `specs/03-Data-and-Storage/deltas/12-unified-ai-architecture.sql` per ADR-009.
- Existing RAG ingestion code still lives under `backend/src/modules/rag`; US2 will migrate query orchestration to the ADR-023 AI queue path without replacing the existing ingestion processors in this foundation slice.
- ADR-023A Phase 1 removed the cloud LLM client from `backend/src/modules/rag`; RAG generation now uses `LocalLlmService` with Ollama only, and SQL deltas `14-add-migration-review-queue.sql` plus `15-add-ai-processing-status.sql` track the AI model revision schema changes.
- ADR-023A Phase 2 adds `ai-realtime` and `ai-batch` queue constants, processors, and module registration. `AiRealtimeProcessor` pauses `ai-batch` while interactive work is active, `AiModule.onModuleInit()` auto-resumes stale paused batch queues, and `OllamaService`/`OcrService` provide the local 2-model/OCR foundation for later user stories.
- ADR-023A Phase 3 adds AI Suggest queueing through `/api/ai/suggest`, `/api/ai/jobs/:jobId/status`, `CreateAiJobDto`, and best-effort central commit hooks in `FileStorageService.commit()` when project-scoped metadata is available. `attachments.ai_processing_status` is the current schema-aligned progress field for queued AI work.

## RFA Approval Refactor

- `review-team`: review team CRUD, member assignment, review task creation, aggregate status, consensus, and veto override.
- `response-code`: response code lookup, matrix rules, implications, and notification triggering.
- `delegation`, `reminder`, `distribution`: supporting modules for proxy assignment, scheduled reminders, and post-approval distribution. Delegation resolution is applied during parallel review task creation while preserving `delegatedFromUserId` for audit/display.
- `distribution`: schema-aligned Distribution Matrix CRUD, BullMQ queueing, approval listener integration, draft Transmittal creation, and `/distribution-matrices` admin UI.
- Queue names are centralized in `backend/src/modules/common/constants/queue.constants.ts`.
