// File: specs/200-fullstacks/242-migration-ai-pipeline/plan.md
// Change Log:
// - 2026-08-06: Initial implementation plan for Migration AI Pipeline Refactor

# Implementation Plan: Migration AI Pipeline Refactor

**Branch**: `242-migration-ai-pipeline` | **Date**: 2026-08-06 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/200-fullstacks/242-migration-ai-pipeline/spec.md`

## Summary

Refactor the legacy migration pipeline (ADR-028) along four axes:

1. **Multi-attachment** — extend DTOs, review-queue entity, and commit path to link N attachments to one Correspondence Revision via the existing `correspondence_revision_attachments` junction table (schema already supports it; code does not).
2. **AI Compare replaces AI extraction** — `processMigrateDocument()` currently runs prompt `ocr_extraction` to *re-derive* metadata from OCR text. Replace with a new prompt type `migration_compare` that receives Excel register metadata + OCR text and returns per-field agreement plus mismatch list and confidence. Register remains source of truth; compare output is advisory.
3. **OCR text persistence** — persist `ocrResult.text` to `attachments.ocr_text` inside `processMigrateDocument()`, mirroring `processRagPrepare()` (ADR-042). Eliminates re-OCR downstream.
4. **Post-migration batch operations** — strip Tag/UUID resolution out of the BullMQ worker (currently ~110 lines of per-document DB lookups at lines 1222–1334 of `ai-batch.processor.ts`) into a SQL batch endpoint; add a second batch endpoint that enqueues `rag-prepare` for committed attachments using the already-persisted OCR text, skipping DWG.

Both batch operations are admin-only, scoped by `batch_id`, idempotent, and report success/skip/fail counts.

## Technical Context

**Language/Version**: TypeScript 5.x (strict), Node.js 22
**Primary Dependencies**: NestJS 11, TypeORM, BullMQ, Next.js 16 (App Router), TanStack Query, React Hook Form + Zod, shadcn/ui
**Storage**: MariaDB 11.8 (`attachments.ocr_text` LONGTEXT already exists per delta `2026-07-27-add-ocr-text-and-sandbox-project.sql`), Redis (BullMQ + prompt cache), Qdrant (vector store)
**Testing**: Jest + `@nestjs/testing` (backend unit/integration), Playwright (E2E)
**Target Platform**: Linux server (Docker Compose on QNAP Container Station); AI inference on np-dms-lcbp3 via Ollama + OCR sidecar (ADR-041)
**Project Type**: web — `backend/` (NestJS) + `frontend/` (Next.js)
**Performance Goals**: Per-document migration processing reduced ≥30% (SC-004) by removing per-doc reference-data lookups; `ai-batch` queue stays at concurrency=1 (GPU VRAM limit); Tag/UUID resolution batch completes in pure SQL without GPU
**Constraints**: `ai-batch` concurrency=1; job lock 150 s (Ollama timeout headroom); OCR text truncated to `MAX_OCR_TEXT_CHARS` before prompt injection (context overflow guard); Qdrant queries require `projectPublicId` filter (ADR-023A)
**Scale/Scope**: ~20,000 legacy documents across 3 tiers, 200–300 GB files; 10 correspondence types, 19 organizations, 7 projects, 71 disciplines as reference data

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Gate | Requirement | Status | Notes |
| --- | --- | --- | --- |
| **ADR-019 UUID** | `publicId` only in API; no `parseInt`/`Number`/`+` on UUID; INT `id` never exposed | ✅ PASS | Batch endpoints accept `batchId` (VARCHAR) and return counts. Review-queue DTOs expose `publicId`. Internal `attachments.id` used only inside the junction-table write. |
| **ADR-009 Schema** | No TypeORM migrations — edit schema SQL or add `deltas/*.sql` | ✅ PASS | Two schema changes: `migration_review_queue.temp_attachment_ids` JSON + `compare_status` ENUM. Delivered as `specs/03-Data-and-Storage/deltas/2026-08-06-migration-multi-attachment-and-compare.sql`. |
| **ADR-016 Security** | JWT + CASL on every mutation; `Idempotency-Key` on POST/PUT/PATCH | ✅ PASS | Both new endpoints get `@UseGuards(JwtAuthGuard, CaslAbilityGuard)` + `system.manage_all`, and require `Idempotency-Key` (FR-027, FR-029). |
| **ADR-029 Prompt Mgmt** | Prompt templates in `ai_prompts`, never hardcoded; Redis cache; `activate()` in transaction | ✅ PASS | `migration_compare` is a new `prompt_type` row in `ai_prompts`, resolved via existing `AiPromptsService.getActive()`. No template literals in the processor. |
| **ADR-023/023A AI Boundary** | AI → DMS API → DB; never direct DB/storage; BullMQ `ai-realtime`/`ai-batch`; human-in-the-loop | ✅ PASS | Compare runs inside the existing `ai-batch` worker via `OllamaService`. Review queue remains mandatory (FR-012c keeps even un-comparable records reviewable). |
| **ADR-008 Queue** | Long-running work via BullMQ, never inline | ✅ PASS | Batch RAG endpoint enqueues `rag-prepare` jobs and returns immediately. Tag/UUID resolution is bounded SQL — see Complexity Tracking. |
| **ADR-007 Errors** | Layered classification; `userMessage` + `recoveryAction`; stack only in logs | ✅ PASS | Compare failures raise a domain outcome (not an exception) so the record still reaches the queue with `compare_status = UNAVAILABLE` (FR-012a). Batch endpoints return per-item failure reasons. |
| **ADR-042 OCR Persist** | OCR text persisted once, reused | ✅ PASS | Core objective of change #3. |
| **TS Strict** | Zero `any`, zero `console.log`, Thai comments, file headers, single export | ✅ PASS | All new files follow the standard. Compare result parsed through a typed guard, mirroring `parseMigrateDocumentMetadata`. |
| **i18n** | No hardcoded user-facing strings in components | ✅ PASS | New review-UI strings (field source selector, compare-unavailable badge, batch result summary) go through i18n keys. |
| **Domain Glossary** | Correspondence / Transmittal / Circulation; Workflow Engine; Document Numbering | ✅ PASS | Spec and plan use *Correspondence* throughout; no "Letter"/"Document" generic usage. |

**Result**: No unjustified violations. One justified deviation recorded in Complexity Tracking.

### Post-Design Re-Evaluation (after Phase 1)

Re-checked against `research.md`, `data-model.md`, and the three contracts:

| Gate | Verdict | Design evidence |
| --- | --- | --- |
| ADR-019 UUID | ✅ HOLDS | Both contracts expose `publicId` only. `temp_attachment_ids` holds internal INT ids but is `@Exclude()`d and never serialised — the review-queue response returns `attachments[].publicId` instead (R4). No `parseInt`/`Number` on any identifier. |
| ADR-009 Schema | ✅ HOLDS | All four schema changes consolidated in one delta (data-model §1). `temp_attachment_id` retained so rollback is non-destructive (quickstart §12). |
| ADR-016 Security | ✅ HOLDS | `Idempotency-Key` is a required header on all three mutating operations; `bearerAuth` + `system.manage_all` documented in both contracts. |
| ADR-029 Prompt Mgmt | ✅ HOLDS | `migration_compare` is an `ai_prompts` row with `field_schema`; resolved via existing `getActive()` + Redis cache. Template lives in the contract doc for review, not in code. |
| ADR-023/023A AI Boundary | ✅ HOLDS | No new AI egress path. Qdrant multi-tenancy verified in quickstart §8.2. Human review stays mandatory — FR-012c explicitly keeps `UNAVAILABLE` records confirmable rather than auto-rejecting them. |
| ADR-008 Queue | ✅ HOLDS | `trigger-rag-batch` returns `202` after enqueueing. `resolve-batch` deviation unchanged and bounded by the 30 s guard. |
| ADR-007 Errors | ✅ HOLDS | Both contracts define `ErrorResponse` with `userMessage` + `recoveryAction` and no technical detail. R7 keeps stack traces in `ai_audit_logs` only. |
| ADR-042 OCR Persist | ✅ HOLDS | F4 confirms the column and write pattern already exist; change is additive. |
| TS Strict | ✅ HOLDS | `CompareResult` parsed through a typed guard with 5-step normalisation (contract §7) — no `any` on the LLM boundary. |
| i18n | ✅ HOLDS | Quickstart §10 includes an explicit no-hardcoded-strings check; error `userMessage` examples are Thai and come from the backend, not the component. |
| Domain Glossary | ✅ HOLDS | All artifacts use *Correspondence*. |

**New finding during design**: `correspondence_tags.is_ai_suggested` must be set to `0` for register-derived tags (R7). The current code marks them AI-suggested because tags came from LLM output; after FR-018a they are register-derived, so leaving the flag at `1` would misrepresent AI influence in any audit. Captured as a task, not a Constitution violation.

**Gate status**: PASS — proceed to `/105-speckit.tasks`.

## Artifact Status

| Artifact | Status |
| --- | --- |
| `spec.md` | ✅ Complete (5 clarifications resolved) |
| `checklists/requirements.md` | ✅ Complete (PASS) |
| `plan.md` | ✅ Complete (this file) |
| `research.md` | ✅ Complete — R1–R7 resolved, 0 `NEEDS CLARIFICATION` remaining |
| `data-model.md` | ✅ Complete |
| `contracts/migration-batch-api.yaml` | ✅ Complete |
| `contracts/migration-review-api.yaml` | ✅ Complete |
| `contracts/migration-compare-prompt.md` | ✅ Complete |
| `quickstart.md` | ✅ Complete |
| Agent context (`.windsurf/rules/specify-rules.md`) | ✅ Updated |
| `tasks.md` | ✅ Complete — 65 tasks across 7 phases |

## Project Structure

### Documentation (this feature)

```text
specs/200-fullstacks/242-migration-ai-pipeline/
├── spec.md                  # Feature specification (done)
├── plan.md                  # This file
├── research.md              # Phase 0 output
├── data-model.md            # Phase 1 output
├── quickstart.md            # Phase 1 output
├── contracts/
│   ├── migration-batch-api.yaml       # OpenAPI: resolve-batch + trigger-rag-batch
│   ├── migration-review-api.yaml      # OpenAPI: review queue read/commit deltas
│   └── migration-compare-prompt.md    # migration_compare I/O contract + field_schema
├── checklists/
│   └── requirements.md      # Spec quality checklist (done)
└── tasks.md                 # Phase 2 output (/105-speckit.tasks)
```

### Source Code (repository root)

```text
backend/src/modules/ai/
├── processors/
│   ├── ai-batch.processor.ts              # MODIFY: persist ocr_text; ocr_extraction → migration_compare;
│   │                                      #         delete Tag/UUID resolution block (lines ~1222–1334)
│   └── ai-batch.processor.spec.ts         # MODIFY: compare + persist + no-tag-resolution cases
├── ai.service.ts                          # MODIFY: submitMigrationJob() carries excelMetadata
├── dto/
│   └── excel-metadata.dto.ts              # NEW: register fields sent by n8n
├── types/
│   └── migration-compare-result.type.ts   # NEW: typed compare payload + parser guard
└── services/
    └── ai-prompts.service.ts              # UNCHANGED: getActive('migration_compare') reused

backend/src/modules/migration/
├── migration.controller.ts                # MODIFY: POST /resolve-batch, POST /trigger-rag-batch
├── migration.service.ts                   # MODIFY: enqueueRecord() multi-attachment + raw register values
├── migration-review.service.ts            # MODIFY: commitRecord() links N attachments + applies field resolutions
├── migration.module.ts                    # MODIFY: import AiQueueModule
├── services/
│   ├── metadata-resolution.service.ts     # NEW: SQL batch org/type/discipline/tag resolution
│   ├── rag-batch.service.ts               # NEW: enqueue rag-prepare for committed attachments (skip DWG)
│   └── review-threshold.service.ts        # NEW: read/write thresholds via system_settings
├── dto/
│   ├── import-correspondence.dto.ts       # MODIFY: tempAttachmentIds[], sourceFilePaths[]
│   ├── enqueue-migration.dto.ts           # MODIFY: tempAttachmentIds[], compareResult, compareStatus
│   ├── commit-migration-review.dto.ts     # MODIFY: fieldResolutions[]
│   ├── resolve-batch.dto.ts               # NEW: optional batchId + response counts
│   └── trigger-rag-batch.dto.ts           # NEW: optional batchId + response counts
└── entities/
    └── migration-review-queue.entity.ts   # MODIFY: tempAttachmentIds JSON, compareStatus enum

backend/src/common/file-storage/
└── file-storage.service.ts                # MODIFY: whitelist DOCX + DWG

frontend/app/(dashboard)/migration/review/
├── page.tsx                               # MODIFY: filter by compare status / manual-review group
└── _components/
    ├── compare-field-table.tsx            # NEW: per-field 3-way source selector
    ├── compare-unavailable-badge.tsx      # NEW: "เปรียบเทียบไม่ได้" indicator
    ├── attachment-list.tsx                # NEW: multi-attachment display with type icons
    └── batch-run-summary.tsx              # NEW: success/skip/fail counts per batch run

frontend/app/(dashboard)/admin/migration-settings/
└── page.tsx                               # NEW: threshold configuration (admin-only)

specs/03-Data-and-Storage/deltas/
└── 2026-08-06-migration-multi-attachment-and-compare.sql   # NEW: ADR-009 schema delta
```

**Structure Decision**: Web application layout — existing `backend/` (NestJS modular) + `frontend/` (Next.js App Router). No new top-level modules; work extends `modules/ai` and `modules/migration`. New backend logic lands in `modules/migration/services/` rather than swelling `migration.service.ts`, keeping each service single-responsibility per Tier 2 architecture rules.

## Phase Breakdown

### Phase 0 — Research (`research.md`)

Resolve open technical decisions before design:

- **R1** — `migration_compare` prompt shape: placeholder set, `field_schema`, and how to keep OCR truncation from producing false mismatches.
- **R2** — Threshold storage: `system_settings` rows vs. a dedicated table, and cache/invalidation strategy.
- **R3** — `compare_status` representation: new ENUM column vs. a flag inside `ai_metadata_json`.
- **R4** — Multi-attachment backward compatibility: how `tempAttachmentId` and `tempAttachmentIds` coexist without a breaking change.
- **R5** — DWG exclusion predicate: exact MIME/extension set to skip, given the upload whitelist expansion.
- **R6** — Idempotency for batch operations: what marks an item "already processed" for each batch type.
- **R7** — Field-resolution persistence: where per-field source decisions live for audit (FR-011b).

### Phase 1 — Design & Contracts

- **`data-model.md`** — entity deltas for `MigrationReviewQueue` (`tempAttachmentIds`, `compareStatus`), new value objects (`CompareResult`, `FieldResolution`, `TagMappingRule`, `ReviewThresholdSetting`), and the ADR-009 SQL delta.
- **`contracts/migration-batch-api.yaml`** — `POST /api/migration/resolve-batch`, `POST /api/migration/trigger-rag-batch`.
- **`contracts/migration-review-api.yaml`** — review-queue read model additions (compare result, attachments array, compare status filter) and commit payload additions (`fieldResolutions`).
- **`contracts/migration-compare-prompt.md`** — `migration_compare` input/output contract and `field_schema` for the `ai_prompts` row.
- **`quickstart.md`** — local verification path: seed a register row + a scanned file, run the compare job, inspect the queue, commit, run both batch endpoints, confirm semantic search.
- Run `.agents/scripts/bash/update-agent-context.sh windsurf`.

### Phase 2 — Tasks (`/105-speckit.tasks`)

Dependency-ordered breakdown. Expected sequencing: schema delta → entity/DTO → compare types + prompt row → processor refactor → batch services → controller/endpoints → frontend → tests.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
| --- | --- | --- |
| Tag/UUID resolution batch runs as a synchronous SQL operation rather than a BullMQ job (nominal tension with ADR-008) | It is bounded set-based SQL over one batch's rows with no external I/O and no GPU. Wrapping it in BullMQ would add queue state, retry semantics, and progress polling for an operation that returns in seconds. | Enqueuing it would obscure failure reporting — the operator needs the per-item unresolved-value list (FR-019) in the response to fix reference data and re-run. A fire-and-forget job would force building a separate result-retrieval endpoint for no operational gain. **Guard**: if measured runtime on a full tier exceeds 30 s, promote it to `ai-batch` (it has no GPU dependency, so it may also use a general queue). |
| Two new columns on `migration_review_queue` instead of nesting inside `ai_metadata_json` | `compare_status` must be filterable (FR-012d) and `temp_attachment_ids` must be readable without JSON extraction during commit. | JSON-only storage would force `JSON_EXTRACT` in the queue-listing WHERE clause, defeating the existing `idx_migration_review_status_created` index on a table that will hold 20 k rows. |
