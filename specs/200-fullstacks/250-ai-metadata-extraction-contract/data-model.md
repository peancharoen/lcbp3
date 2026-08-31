// File: specs/200-fullstacks/250-ai-metadata-extraction-contract/data-model.md
// Change Log:
// - 2026-08-31: Phase 1 data model for AI Metadata Extraction Output Contract

# Phase 1 Data Model: AI Metadata Extraction Output Contract

Source: `spec.md` Key Entities + Clarifications, refined with concrete field types per ADR-050. Verified against `specs/03-Data-and-Storage/lcbp3-v1.9.0-schema-02-tables.sql` (ADR-044 gate) before any DDL is written.

## 1. `migration_review_queue` (existing table — extended)

New columns (SQL delta, not a TypeORM migration — ADR-044):

| Column | Type | Nullable | Notes |
| --- | --- | --- | --- |
| `requires_human_review` | `TINYINT(1)` | `NOT NULL DEFAULT 0` | Server-computed (Decision 3). Never written from raw LLM output. |
| `ocr_quality_confidence` | `DECIMAL(4,3)` | `NULL` | `0.000`–`1.000`. Promoted from `details.ocrQuality.confidence` for sort/filter. |

Existing columns reused, unchanged in meaning:

| Column | Reused as |
| --- | --- |
| `ai_confidence` | Backward-compat alias — backend writes `min(metadata.confidence.summary, .category, .tags)`. Not written directly by the LLM. |
| `ai_issues` | Business-validation issues only (EC-001/EC-002/enrichment failures) — **untouched**, unrelated to `ocrQuality.issues`. |
| `ai_failed` | Reused for both LLM-call failure and schema-validation failure (Decision 7); reason recorded in `details.aiFailureReason`. |
| `details` (JSON) | Extended to hold the full new payload — see §2. |

### `details` JSON shape (extraction output, as persisted)

```ts
interface MigrationAiExtractionDetails {
  ocrQuality: {
    confidence: number; // 0-1
    issues: Array<{
      type: string; // e.g. "GARBLED_TEXT"
      message: string;
      evidence: string; // excerpt from OCR text
    }>;
  };
  metadata: {
    summary: string;
    category: string; // MUST be a correspondence_types.typeCode value (FR-005)
    tags: TagSuggestion[]; // see §3
    confidence: {
      summary: number; // 0-1
      category: number; // 0-1
      tags: number; // 0-1
    };
  };
  aiFailureReason?: 'SCHEMA_VALIDATION_FAILED' | 'LLM_CALL_FAILED';
  fieldResolutions: FieldResolutionState; // see §4 — added by review actions, not by extraction
}
```

## 2. OCR Quality Assessment (value object, within `details.ocrQuality`)

| Field | Type | Validation |
| --- | --- | --- |
| `confidence` | `number` | `0 <= x <= 1`, rejected (schema-invalid) otherwise |
| `issues[].type` | `string` | free-form category label from LLM (e.g. `GARBLED_TEXT`) |
| `issues[].message` | `string` | human-readable description |
| `issues[].evidence` | `string` | must be a substring excerpt of the OCR text (not enforced at parse time, but expected by prompt contract — ADR-050 §9) |

## 3. Tag Suggestion (`TagSuggestion`, within `details.metadata.tags[]`)

| Field | Type | Notes |
| --- | --- | --- |
| `name` | `string` | tag display name as suggested by AI |
| `isNew` | `boolean` | `true` if no case-insensitive match found in master `tags` at extraction time |
| `evidence` | `string` | excerpt from OCR text justifying the tag |

**Review-time addition** (not part of extraction output, added when the commit DTO is processed):

| Field | Type | Notes |
| --- | --- | --- |
| `accepted` | `boolean` | reviewer decision, from `CommitMigrationReviewDto.tagDecisions[]` |

## 4. Field Resolution State (`FieldResolutionState`, within `details.fieldResolutions`)

Tracks per-field reviewer resolution for the commit gate (FR-013/FR-014, clarify Decision 8).

```ts
interface FieldResolutionState {
  ocrQuality?: 'edited' | 'acknowledged';
  summary?: 'edited' | 'acknowledged';
  category?: 'edited' | 'acknowledged';
  tags?: 'edited' | 'acknowledged';
}
```

**Commit gate rule**: Let `minConfidence = ReviewThresholdService.getThresholds().minConfidence` (existing `MIGRATION_MIN_CONFIDENCE` setting, Feature 242 — reused, not reinvented). For every field `f` where `confidenceOf(f) < minConfidence`, `fieldResolutions[f]` MUST be present (`'edited'` or `'acknowledged'`) or the commit request is rejected with a `BusinessException` (ADR-007) listing the unresolved fields. `requires_human_review` (the promoted column) is simply `true` when at least one field has `confidenceOf(f) < minConfidence` **and** is not yet resolved; it flips to `false` once all triggering fields are resolved — recomputed on every review-state-changing request, not just at extraction time.

## 5. Review Decision Record (`ai_audit_logs` row — existing table, new `action` value)

| Field | Type | Notes |
| --- | --- | --- |
| `action` | `string` | new value: `'TAG_REJECTED'` |
| `queue_item_public_id` | `string (UUID)` | FK reference via `publicId`, not internal `id` (ADR-019) |
| `payload_json` | `JSON` | `{ tagName: string, evidence: string, isNew: boolean }` — snapshot of the rejected suggestion |
| `actor_user_id` | `int` | reviewer who rejected (human-in-the-loop, CONTEXT.md) |
| `created_at` | `datetime` | existing column pattern |

## 6. Commit DTO shape (`CommitMigrationReviewDto` — breaking change)

```ts
// Before
interface CommitMigrationReviewDto {
  category: string;
  summary?: string;
  tags: string[];
}

// After
interface CommitMigrationReviewDto {
  category: string;
  summary?: string;
  tagDecisions: Array<{
    name: string;
    accepted: boolean;
    evidence?: string; // carried through for audit even on reject
  }>;
  fieldAcknowledgments?: Array<'ocrQuality' | 'summary' | 'category' | 'tags'>;
  // ^ fields the reviewer explicitly acknowledges as "proceed despite low confidence"
  //   without editing the underlying value. Fields the reviewer DID edit (category/summary
  //   differ from the AI suggestion, or tagDecisions differs from the AI suggestion) are
  //   inferred as 'edited' server-side — no separate flag needed for those.
}
```

Validation (ADR-007 layered error handling):
- `category` MUST be in the current `correspondence_types.typeCode` list (Business exception if not — FR-005).
- Every `tagDecisions[].name` MUST correspond to a tag that was actually suggested for this queue item (reject unknown names — prevents forging audit records).
- Commit MUST be rejected (Business exception, listing unresolved field names) if any triggering low-confidence field lacks a corresponding edit or `fieldAcknowledgments` entry (FR-013/FR-014).

## State Transitions (existing enums, unchanged — no new states introduced)

- `MigrationAiStatus`: `PENDING → RUNNING → DONE | FAILED` (unchanged; `FAILED` now covers both LLM-call failure and schema-validation failure per Decision 7).
- `MigrationReviewStatus`: `PENDING → PENDING_REVIEW → (commit blocked while requires_human_review unresolved) → COMMITTED` — the "commit blocked" condition is a **request-time gate check**, not a persisted status value, so no enum change is required.
- Legacy items (pre-refactor `details` shape): remain in whatever `MigrationReviewStatus` they already have, but are excluded from the reviewable set until re-extraction — enforced by presence/absence of `details.metadata.confidence` (new-shape marker), not a new status.
