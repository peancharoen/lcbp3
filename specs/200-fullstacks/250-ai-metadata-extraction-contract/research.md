// File: specs/200-fullstacks/250-ai-metadata-extraction-contract/research.md
// Change Log:
// - 2026-08-31: Phase 0 research consolidated from prior grill session (see ADR-050)

# Phase 0 Research: AI Metadata Extraction Output Contract

All unknowns for this feature were resolved during a grill-with-docs session prior to spec creation (see `specs/06-Decision-Records/ADR-050-ai-metadata-extraction-output-contract.md` for full context and the "Considered but Rejected" alternatives). This document consolidates those findings in the Decision/Rationale/Alternatives format for planning traceability. No `NEEDS CLARIFICATION` markers remain in the Technical Context.

## Decision 1: Storage layout for the new AI output payload

- **Decision**: Store the full new JSON (`ocrQuality`, `metadata.summary/category/tags/confidence.*`) inside the existing `migration_review_queue.details` JSON column. Promote only `requires_human_review` (boolean) and `ocr_quality_confidence` (decimal) to real columns.
- **Rationale**: Only these two fields need DB-level filter/sort (queue triage). Everything else is display-only. Matches ADR-044's "no schema bloat" convention.
- **Alternatives considered**: Full typed columns per field (rejected — unnecessary schema churn for display-only data).

## Decision 2: Source of `allowed_categories`

- **Decision**: `correspondence_types` (existing master data, `GET /master/correspondence-types`) is the source of truth for AI-suggested categories. No new `document_categories` table.
- **Rationale**: Codebase inspection found no dedicated category table — `ai_suggested_category` was a free `VARCHAR(50)` resolved through a hardcoded `CATEGORY_ALIAS` map (`migration.service.ts:154-160`) against `correspondence_types`. The "category" concept the refactor doc describes is the same concept already modeled by `correspondence_types`; introducing a parallel table would duplicate an existing master-data concept.
- **Alternatives considered**: New `document_categories` table (rejected — duplicate concept, extra migration cost for no behavioral gain).

## Decision 3: `requiresHumanReview` computation authority

- **Decision**: Backend computes `requiresHumanReview` deterministically as `min(ocrQuality.confidence, metadata.confidence.summary, .category, .tags) < minConfidence`, ignoring any value the LLM may include in its JSON output. `minConfidence` is read from the **existing** `ReviewThresholdService.getThresholds()` (`MIGRATION_MIN_CONFIDENCE`, `system_settings`, Redis-cached TTL 60s, default `0.6`, admin-editable via `PATCH /migration/review-thresholds`, Feature 242/R2/FR-010) — not a new hardcoded constant.
- **Rationale**: Consistent with the existing Human-in-the-loop principle (CONTEXT.md `## AI`) — the system must not let the AI self-certify that its own low-confidence output is fine to skip review. Corrected during Phase 0 research: the source doc's `0.75` was illustrative only; the codebase already has an admin-configurable `minConfidence` setting with **zero existing consumers** — this feature is its natural first use, avoiding a parallel/duplicate threshold constant.
- **Alternatives considered**: Trust the LLM's own `requiresHumanReview` field (rejected — allows a mis-calibrated LLM to bypass review); hybrid trust-with-override (rejected — added complexity without a concrete benefit over pure server-side calculation); hardcoded `0.75` constant (rejected once `ReviewThresholdService` was found — would create a second, inconsistent threshold mechanism alongside the existing one).

## Decision 4: Tag suggestion review model

- **Decision**: Tags are `{name, isNew, evidence}[]`, reviewed individually (accept/reject per tag), with rejections persisted to `ai_audit_logs` via a `tagDecisions[]` commit payload (replacing the current `tags: string[]`).
- **Rationale**: Matches the existing Human-in-the-loop audit pattern already used elsewhere in the AI subsystem; gives reviewers the supporting evidence needed to decide quickly without re-reading the whole document.
- **Alternatives considered**: Keep `tags: string[]` and treat accept/reject as client-only filtering before submit (rejected — loses the audit trail of *why* a suggestion was rejected, undermining the value of adding `evidence` in the first place).

## Decision 5: `aiIssues` vs. `ocrQuality.issues`

- **Decision**: Kept as two separate, never-merged concepts. `ai_issues` (existing column) continues to hold business-validation issues (EC-001 new-tag detection, EC-002 unresolved sender/receiver UUID, enrichment failures). `ocrQuality.issues[]` is a new field, scoped only to OCR text readability (e.g. `GARBLED_TEXT`), living inside `details`.
- **Rationale**: Codebase inspection (`ai-batch.processor.ts:1347-1449`) confirmed `aiIssues` is semantically a business-rule issue tracker, unrelated to text readability. Merging them would make "issue" an overloaded, ambiguous term across both API consumers and reviewers.
- **Alternatives considered**: Single merged issue list (rejected — conflates two different corrective actions: re-OCR vs. manual business review).

## Decision 6: Backward compatibility for legacy queue items

- **Decision**: No dual-format fallback UI. Legacy items (processed before this feature) remain visible in the queue in an unreviewable state; the reviewer must trigger re-extraction on that specific item (existing endpoint, commit `83362606`) before it becomes reviewable under the new contract.
- **Rationale**: The migration tool is not yet at production scale; maintaining a permanent fallback UI for a one-time transitional state is not worth the added complexity, and the re-extract endpoint already exists.
- **Alternatives considered**: Fallback UI supporting both formats simultaneously (rejected — permanent complexity for a transitional problem); bulk/admin-triggered re-processing pass (rejected during clarify session — per-item manual trigger via the existing UI/endpoint is simpler and sufficient).

## Decision 7: Schema-validation failure handling

- **Decision**: Reuse the existing `aiFailed` boolean for both "LLM call failed" and "LLM responded but output failed schema validation" cases, distinguished by a new `details.aiFailureReason` (`SCHEMA_VALIDATION_FAILED` | `LLM_CALL_FAILED`).
- **Rationale**: Both cases have the same practical consequence for the reviewer (item is unusable as-is, needs manual attention or re-extraction) — a separate boolean state would add branching without changing reviewer-facing behavior.
- **Alternatives considered**: New `aiValidationFailed` boolean (rejected — unnecessary state proliferation).

## Decision 8: Commit-gating behavior for `requiresHumanReview` (from `/103-speckit-clarify` session)

- **Decision**: Commit is blocked while any triggering low-confidence field remains unresolved. Resolution is tracked **per triggering field** (OCR quality, summary, category, tags individually) — editing or acknowledging one field does not clear the requirement for a different, still-low-confidence field.
- **Rationale**: A single item-level flag could be trivially "cleared" by fixing an unrelated field, defeating the purpose of the per-field confidence breakdown (Decision 1/ADR-050 §4). Per-field tracking keeps the gate meaningful.
- **Alternatives considered**: Single item-level acknowledgment (rejected in clarify — too coarse, allows accidental bypass of unrelated low-confidence fields).

## Decision 9: Legacy re-extraction trigger ownership (from `/103-speckit-clarify` session)

- **Decision**: Reviewer-triggered, per item, from the existing queue UI — no separate bulk/admin-only re-processing flow.
- **Rationale**: Reuses the existing re-extract endpoint (commit `83362606`) without adding new admin tooling; keeps legacy-item handling inside the same review workflow reviewers already use.
- **Alternatives considered**: One-time bulk admin pass before rollout (rejected — adds an operational step and a new admin-only view for a problem the existing per-item endpoint already solves); admin-curated batch selection (rejected — same reasoning, unnecessary tooling).

## Confirmed non-changes (verified against current code, not redesigned)

- **Model switching** (`unload np-dms-ai → load np-dms-ocr (keep_alive:0) → OCR → auto-unload → reload np-dms-ai (keep_alive:-1)`) — already implemented via `OcrService.calculateOcrResidency()` (Adaptive OCR Residency, ADR-033). No code change in scope.
- **`ocr_system` Active Prompt wiring** — already implemented in `OcrService.processWithNpDmsOcr` (`ocr.service.ts:471-492`, dated 2026-08-30, one day before the source refactor doc). No code change in scope.
- **Main pipeline prompt routing** (`processOcrExtract`, `processMigrateDocument`) — already calls `aiPromptsService.getActive('ocr_extraction')` correctly (`ai-batch.processor.ts:634/878/1674`). Only `processLegacyAiEnrichment` (`~line 2050-2110`) has the hardcoded-prompt gap this feature closes.
