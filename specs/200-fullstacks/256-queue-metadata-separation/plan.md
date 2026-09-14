// File: specs/200-fullstacks/256-queue-metadata-separation/plan.md
// Change Log:
// - 2026-09-14: Initial implementation plan for ADR-054 queue metadata separation

# Implementation Plan: Migration Review Queue Metadata Separation + OCR Text Protection

**Branch**: `256-queue-metadata-separation` | **Date**: 2026-09-14 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `specs/200-fullstacks/256-queue-metadata-separation/spec.md` (derived from ADR-054)

## Summary

Implement ADR-054: split `migration_review_queue` storage into three ownership classes — ingestion metadata in real columns (`storage_temp_path`, `original_filename`), AI output alone in `ai_metadata_json`, human review state in a new `review_state_json` column — plus OCR text protection (`ocr_text_bak` snapshot-on-overwrite with placeholder skip, attachment fallback for PDF resolution, per-item admin restore endpoint + UI button), `imported_correspondence_public_id` audit link, and the D8 bulk-operation safety protocol. Migration restarts from scratch: SQL delta adds columns + TRUNCATE, no backward compat, no backfill.

## Technical Context

**Language/Version**: TypeScript strict (NestJS 11 backend, Next.js 16 frontend)
**Primary Dependencies**: TypeORM (entity changes only — no migrations per ADR-044), BullMQ (ai-batch processor), CASL (restore endpoint guard), TanStack Query + existing migration UI components
**Storage**: MariaDB 11.8 — `migration_review_queue` (+3 columns via SQL delta), `attachments` (read-only fallback), `correspondences` (import target)
**Testing**: Jest (backend: `migration.service.spec.ts`, `ai-batch.processor.spec.ts`), Vitest/RTL (frontend migration tests)
**Target Platform**: np-dms-lcbp3 on-prem server (Linux, Docker Compose)
**Project Type**: web (backend/ + frontend/)
**Performance Goals**: N/A — migration-scale batch workload, not latency-sensitive
**Constraints**: ADR-044 (SQL delta, no TypeORM migrations); ADR-019 (publicId only at API boundary); ADR-016 (CASL guard on restore endpoint); ADR-023 (AI never writes review state); no `any`, no `console.log`
**Scale/Scope**: ~8 backend touch points + 3 frontend files + 1 SQL delta; one-time migration workload (~thousands of rows max)

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Gate | Status | Note |
|------|--------|------|
| ADR-019 UUID (publicId at boundary) | ✅ PASS | Restore endpoint + list/detail responses use `publicId`; `imported_correspondence_public_id` stores UUID string; internal `queueId` INT stays internal only |
| ADR-044 schema via SQL delta | ✅ PASS | 3 new columns via `deltas/2026-09-14-adr-054-*.sql`; `original_filename`/`storage_temp_path` already exist in schema — entity mapping only |
| ADR-016 security | ✅ PASS | New restore endpoint gets `JwtAuthGuard` + `CaslAbilityGuard` (admin/manage migration ability, same as existing review endpoints) |
| ADR-023/023A AI boundary | ✅ PASS | `AiBatchProcessor` writes `ai_metadata_json` only; never touches `review_state_json`; no direct storage/DB access pattern changes |
| ADR-007 error handling | ✅ PASS | Restore + re-extract errors via `BusinessException`/HttpException with Thai `userMessage` |
| ADR-008 BullMQ | ✅ PASS | Extraction stays in `ai-batch` queue; restore endpoint is synchronous per-item DB write (no queue needed) |
| TRUNCATE = destructive op | ⚠️ JUSTIFIED | Explicit ADR-054 decision confirmed with user 2026-09-14 — 37 pre-go-live sandbox rows intentionally discarded; executed via reviewed SQL delta, not ad-hoc |

Post-Phase-1 re-check: no new violations introduced (see research.md + data-model.md).

## Project Structure

### Documentation (this feature)

```text
specs/200-fullstacks/256-queue-metadata-separation/
├── spec.md              # Feature specification
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output (incl. D8 protocol runbook)
├── contracts/
│   └── queue-item-api.md # Response shape + restore endpoint contract
├── checklists/
│   └── requirements.md  # Spec quality checklist
├── ledger.md            # Cross-session assurance ledger (Tier 3 migration work)
└── tasks.md             # Phase 2 output (/105-speckit-tasks)
```

### Source Code (repository root)

```text
specs/99-archives/deltas/
└── 2026-09-14-adr-054-migration-metadata-separation.sql   # ALTER + TRUNCATE

backend/src/modules/
├── migration/
│   ├── entities/migration-review-queue.entity.ts         # +storageTempPath, +originalFilename, +ocrTextBak, +reviewState, +importedCorrespondencePublicId
│   ├── types/ai-extraction-details.type.ts               # remove fieldResolutions (moves to reviewState); add ReviewState type
│   ├── services/legacy-ingestion.service.ts              # write storage_temp_path + original_filename (not details.source_file_path)
│   ├── migration.service.ts                              # reExtractQueueItem whitelist; resolvePdfPath from storageTempPath; approve* sets importedCorrespondencePublicId; updateQueueEnrichment bak snapshot; restoreOcrText()
│   ├── migration-review.service.ts                       # write fieldResolutions → review_state_json
│   ├── migration.controller.ts (or review controller)    # +POST .../restore-ocr-text
│   └── migration.service.spec.ts                         # data-loss prevention + audit trail tests
└── ai/processors/
    ├── ai-batch.processor.ts                             # PDF path resolution order + persistLegacyEnrichmentResult details-shape (AI output only)
    └── ai-batch.processor.spec.ts                        # fallback + bak + review-state isolation tests

frontend/
├── types/migration.ts                                    # +storageTempPath, +originalFilename, +reviewState; details minus moved fields
├── app/(admin)/admin/migration/review/[id]/page.tsx      # read new fields; +restore OCR button
├── components/migration/compare-result-table.tsx         # fieldResolutions from reviewState
└── components/migration/__tests__/                       # update review-detail/table tests
```

**Structure Decision**: Existing `backend/` + `frontend/` web layout; all changes inside the existing `migration` module and `ai` processor — no new modules.

## Phase 0 → 1 Artifacts

- `research.md` — resolved decisions (placeholder-detection rule, fallback order, response shape)
- `data-model.md` — entity deltas, ownership matrix, state transitions
- `contracts/queue-item-api.md` — response shape change + restore endpoint
- `quickstart.md` — apply order (SQL delta → backend → frontend → re-ingest) + D8 protocol runbook + manual rollback

## Ledger Decision

**Ledger required** — `specs/200-fullstacks/256-queue-metadata-separation/ledger.md`
Justification: Tier 3 migration work (ADR-028/047/054 track) touching data integrity + a protected boundary (TRUNCATE of a queue table); implementation likely spans multiple sessions/agents. `ASSURANCE_UNIT_ID: lcbp3/migration/adr-054-metadata-separation`.

## Complexity Tracking

> No constitution violations requiring justification beyond the TRUNCATE note above.
