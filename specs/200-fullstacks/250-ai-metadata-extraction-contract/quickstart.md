// File: specs/200-fullstacks/250-ai-metadata-extraction-contract/quickstart.md
// Change Log:
// - 2026-08-31: Phase 1 quickstart for AI Metadata Extraction Output Contract

# Quickstart: AI Metadata Extraction Output Contract

Manual verification path once implementation lands (backend + frontend deployed together — see ADR-050 Consequences on breaking-change coordination).

## 1. Prompt setup (prerequisite)

1. As an admin with `system.manage_all`, open AI Admin Console → Prompt Management.
2. Update the **active** `ocr_extraction` prompt version to the new Markdown template (ADR-050 §9) — must include `{{ocr_text}}`, `{{allowed_categories}}`, `{{existing_tags}}`, `{{master_data_context}}`.
3. Confirm `ocr_system` prompt is untouched (no change expected — ADR-050 §10).

## 2. Trigger a fresh extraction

1. Import/upload a new document into the migration queue (or use an existing legacy item — see step 4).
2. Trigger extraction (`POST /migration/queue/:publicId/extract`).
3. Confirm in DB (`migration_review_queue.details`) that the row now contains `ocrQuality`, `metadata.confidence.{summary,category,tags}`, and that `requires_human_review` / `ocr_quality_confidence` columns are populated.
4. Confirm `ai_confidence` (legacy scalar column) still gets written as `min(metadata.confidence.*)` — backward-compat alias, Decision 1.

## 3. Queue list — triage (User Story 1)

1. Open `/admin/migration/review` (review-queue-table.tsx).
2. Confirm each row shows a `requiresHumanReview` badge (visually distinct) and an OCR-quality indicator.
3. Apply the "needs review" filter — confirm only flagged items remain (`GET /migration/queue?requiresHumanReview=true`).
4. Sort by OCR quality — confirm ordering (`GET /migration/queue?sortBy=ocrQualityConfidence`).

## 4. Legacy item handling (Decision 6/9, FR-011)

1. Pick a queue item processed before this feature (missing `details.metadata.confidence`).
2. Confirm it appears in the queue but cannot be opened for review directly — reviewer sees a "re-extract required" state.
3. Trigger re-extraction via the existing endpoint (`POST /migration/queue/:publicId/re-extract`).
4. Confirm the item becomes reviewable once re-extraction completes.

## 5. Detail page — diagnosis (User Story 2)

1. Open a flagged item's detail page (`/admin/migration/review/[id]`).
2. Confirm OCR quality confidence + `issues[]` render as a distinct section from `metadata.confidence.{summary,category,tags}`.
3. Confirm the category field is a dropdown sourced from `correspondence_types` (`GET /master/correspondence-types`) — attempting to save a category outside this list must be rejected (FR-005).

## 6. Tag review (User Story 3)

1. On the same detail page, confirm each suggested tag renders as a chip with an "new" badge (if `isNew`) and an evidence tooltip.
2. Reject at least one tag; accept the rest.
3. Submit — confirm the commit payload sends `tagDecisions[]` (not `tags: string[]`).
4. Query `ai_audit_logs` for `action = 'TAG_REJECTED'` — confirm a row exists with the rejected tag name, evidence, and the reviewer's `actor_user_id`.

## 7. Commit gate (Clarify Decisions 8/9, FR-013/FR-014)

1. Open an item flagged `requiresHumanReview = true` due to low `metadata.confidence.tags` only.
2. Attempt to commit without touching tags — confirm `422` with `unresolvedFields: ["tags"]` (per contract fragment).
3. Edit/accept-reject the tags (or add `fieldAcknowledgments: ["tags"]`) — confirm commit now succeeds and `requires_human_review` flips to `false`.
4. Repeat with a different item flagged on `summary` only — confirm editing `category` alone does **not** clear the flag (per-field tracking, Decision 8).

## 8. Threshold configuration (research.md Decision 3 correction)

1. As admin, `GET /migration/review-thresholds` — confirm `minConfidence` is returned (existing Feature 242 setting, default `0.6`).
2. `PATCH /migration/review-thresholds` with a different `minConfidence` (with `Idempotency-Key` header).
3. Trigger a new extraction with a metadata field confidence between the old and new threshold — confirm `requiresHumanReview` computation reflects the updated threshold (Redis cache invalidated on update, per existing `ReviewThresholdService` pattern).

## 9. Schema-invalid AI output (FR-010, Decision 7)

1. Temporarily point the active `ocr_extraction` prompt at a template that will produce an out-of-range confidence (e.g. instruct the LLM to output `confidence: 1.5`) — or use a test double.
2. Trigger extraction — confirm the item is flagged `aiFailed = true` with `details.aiFailureReason = 'SCHEMA_VALIDATION_FAILED'`, and the reviewer sees this reason distinctly from a plain LLM-call failure.
