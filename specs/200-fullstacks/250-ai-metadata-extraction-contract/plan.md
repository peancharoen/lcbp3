// File: specs/200-fullstacks/250-ai-metadata-extraction-contract/plan.md
// Change Log:
// - 2026-08-31: Initial implementation plan for AI Metadata Extraction Output Contract

# Implementation Plan: AI Metadata Extraction Output Contract

**Branch**: `250-ai-metadata-extraction-contract` (spec-directory numbering only — no git branch created; work stays on `main` per explicit user instruction)
**Date**: 2026-08-31
**Spec**: [spec.md](./spec.md) · **ADR**: [ADR-050](../../06-Decision-Records/ADR-050-ai-metadata-extraction-output-contract.md) · **Source doc**: [docs/ai-prompt-refactor-20260831.md](../../../docs/ai-prompt-refactor-20260831.md)
**Input**: Feature specification from `specs/200-fullstacks/250-ai-metadata-extraction-contract/spec.md`

## Summary

Replace the single-scalar `aiConfidence` output of the migration-review AI metadata extraction step with a structured contract that separates OCR text-quality confidence from per-field (summary/category/tags) metadata confidence, and adds a server-computed `requiresHumanReview` gate that blocks commit until every triggering low-confidence field is explicitly resolved. Category suggestions are constrained to the existing `correspondence_types` master data (no new table). Tags are presented as individually accept/reject-able suggestions (`{name, isNew, evidence}`) with a persisted audit trail of rejections. The legacy hardcoded-prompt code path (`processLegacyAiEnrichment`) is refactored to reuse the same Active Prompt mechanism (`ocr_extraction`) already used by the main pipeline, closing a governance gap (ADR-029). All architectural decisions were pre-resolved in a grill session and recorded in ADR-050; this plan operationalizes them.

## Technical Context

**Language/Version**: TypeScript (NestJS 11 backend, Next.js 16 frontend) — existing stack, no new language
**Primary Dependencies**: TypeORM (MariaDB), BullMQ (`ai-batch` queue), Ollama (`np-dms-ai`/`np-dms-ocr`), TanStack Query, RHF + Zod, shadcn/ui — all existing, no new dependencies introduced
**Storage**: MariaDB 11.8 — `migration_review_queue` table gets 2 new columns (`requires_human_review`, `ocr_quality_confidence`); full new JSON payload lives in existing `details` JSON column (SQL delta per ADR-044, no TypeORM migration)
**Testing**: Jest (backend unit/integration), existing frontend test setup (component/hook tests) — per `_LCBP3-CONTRACTS.md` TDD evidence format
**Target Platform**: Existing LCBP3-DMS deployment (`np-dms-lcbp3`, Docker Compose Layer 3 application + Layer 4 AI)
**Project Type**: Web application (NestJS backend + Next.js frontend, existing monorepo layout)
**Performance Goals**: N/A beyond existing AI-batch queue SLAs (ADR-033 Adaptive OCR Residency, `ai-batch` queue concurrency) — no new performance target introduced by this feature
**Constraints**: Must not change OCR step (`ocr_system` prompt / model switching) — already correct (ADR-050 §10); must not break existing `ai_confidence`/`ai_issues` consumers (kept as backward-compat alias / untouched respectively)
**Scale/Scope**: Migration review queue only (`migration_review_queue` table + its review UI) — does not touch other AI Gateway consumers (RAG, chat, intent classification)

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Gate | Applicable ADR(s) | Status | Notes |
| --- | --- | --- | --- |
| UUID Strategy | ADR-019 | ✅ Pass | No new entity identifiers introduced; queue item continues to use existing `publicId`. New `tagDecisions[]` payload references tags by `name` (business key), not internal id. |
| Schema Correctness | ADR-044 (amends ADR-009) | ✅ Pass (planned) | New columns added via SQL delta in `specs/03-Data-and-Storage/deltas/`, not a TypeORM migration. Schema verified against `lcbp3-v1.9.0-schema-02-tables.sql` before any DDL (Phase 1 data-model.md). |
| Security / RBAC | ADR-016 | ✅ Pass | Reuses existing `system.manage_migration` (or equivalent) CASL guard already on migration review endpoints; no new permission tier introduced (per clarify session — deferred as low-impact, inherits existing model). Commit endpoint already requires `Idempotency-Key`. |
| AI Boundary | ADR-023/023A | ✅ Pass | No new direct Ollama/Qdrant access; `processLegacyAiEnrichment` continues to go through `AiPromptsService`/`OllamaService`/`OcrService` — this refactor *removes* a boundary smell (hardcoded prompt) rather than adding one. |
| Dynamic Prompt Management | ADR-029 | ✅ Pass (this IS the fix) | `processLegacyAiEnrichment` currently violates ADR-029 (hardcoded prompt string); this feature's core backend change is making it call `aiPromptsService.getActive('ocr_extraction')` like the rest of the pipeline. |
| Error Handling | ADR-007 | ✅ Pass (planned) | Schema-invalid AI JSON → `aiFailed=true` + `BusinessException`-style `aiFailureReason`, not a silent swallow (FR-010). |
| Migration Pipeline | ADR-028 / ADR-047 | ⚠️ Tier 3 — Ledger required | Touches `migration_review_queue` lifecycle directly. See Ledger Decision below. |
| AI Runtime Layer | ADR-033/034 | ✅ Pass | Model switching / OCR residency untouched (confirmed already correct in ADR-050 §10) — out of scope for code changes. |

No unjustified violations. No entries needed in Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/200-fullstacks/250-ai-metadata-extraction-contract/
├── spec.md              # Feature specification
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md         # Phase 1 output
├── contracts/            # Phase 1 output (OpenAPI fragments)
├── quickstart.md         # Phase 1 output
├── ai-ledger.md           # Cross-session assurance ledger (Tier 3 — ADR-028/047 + ADR-023/029)
└── checklists/
    └── requirements.md
```

### Source Code (repository root)

**Structure Decision**: Existing web application layout (`backend/` NestJS + `frontend/` Next.js), no new top-level projects. Changes are additive/modifying within existing modules — no new module boundaries.

```text
backend/
├── src/modules/migration/
│   ├── entities/migration-review-queue.entity.ts     # + requiresHumanReview, ocrQualityConfidence columns
│   ├── dto/                                          # CommitMigrationReviewDto: tags[] → tagDecisions[]
│   ├── migration.service.ts                          # remove CATEGORY_ALIAS; deterministic requiresHumanReview calc; per-field resolution tracking; tagDecisions → ai_audit_logs
│   └── migration-review.service.ts                   # commit-gating logic (FR-013/FR-014)
├── src/modules/ai/
│   ├── processors/ai-batch.processor.ts              # processLegacyAiEnrichment: hardcoded prompt → aiPromptsService.getActive('ocr_extraction')
│   └── prompts/                                       # ocr_extraction template: + {{allowed_categories}}, {{existing_tags}} placeholders (ADR-050 §9)
└── src/modules/master/
    └── master.controller.ts                          # existing GET /master/correspondence-types reused as allowed_categories source (no change expected)

frontend/
├── types/migration.ts                                 # ocrQuality, metadata.confidence.*, requiresHumanReview, tag shape
├── lib/services/migration.service.ts                  # query params (requiresHumanReview filter, sort), tagDecisions in commit payload
├── hooks/use-migration-review.ts                       # pass-through of new params
├── components/migration/review-queue-table.tsx         # requiresHumanReview badge, filter, sort by OCR quality
└── app/(admin)/admin/migration/review/[id]/page.tsx     # ocrQuality section, per-field confidence, category dropdown, tag accept/reject chips

specs/03-Data-and-Storage/
└── deltas/2026-08-31-migration-review-queue-human-review-flags.sql   # new SQL delta (ADR-044)
```

## Complexity Tracking

_No Constitution Check violations requiring justification — table intentionally empty._

## Ledger Decision

**Ledger required: YES.**

Rationale (per `_LCBP3-CONTRACTS.md` §4 "When to create a ledger"):
- Tier 3 specialized work: touches both ADR-028/ADR-047 (Migration Pipeline, `migration_review_queue` lifecycle) and ADR-023/ADR-029 (AI runtime — Active Prompt routing).
- Affects a protected boundary: the migration review **commit** path (data integrity — what gets persisted as a document's category/tags) and the AI extraction contract consumed by the public review-queue API.
- Backend + frontend must land together (breaking DTO change per ADR-050 Consequences) — likely to span more than one working session.

Template used: `ai-pipeline-ledger-template.md` (primary axis is the AI output contract; migration-queue lifecycle concerns are captured within the same ledger's acceptance criteria rather than a second ledger, to avoid competing ledgers for overlapping scope).

Ledger path: `specs/200-fullstacks/250-ai-metadata-extraction-contract/ai-ledger.md`
