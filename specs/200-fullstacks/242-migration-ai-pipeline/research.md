// File: specs/200-fullstacks/242-migration-ai-pipeline/research.md
// Change Log:
// - 2026-08-06: Phase 0 research for Migration AI Pipeline Refactor

# Phase 0 Research: Migration AI Pipeline Refactor

**Branch**: `242-migration-ai-pipeline` | **Date**: 2026-08-06
**Input**: [plan.md](./plan.md) Technical Context — 7 open decisions (R1–R7)

All `NEEDS CLARIFICATION` items from Technical Context are resolved below.

---

## R1 — `migration_compare` prompt shape

**Decision**

New `ai_prompts` row with `prompt_type = 'migration_compare'`, version 1, `is_active = 1`.

Placeholders (resolved by the processor before dispatch):

| Placeholder | Source |
| --- | --- |
| `{{ocr_text}}` | `ocrResult.text`, sanitised and truncated to `MAX_OCR_TEXT_CHARS` |
| `{{excel_metadata}}` | `JSON.stringify(excelMetadata, null, 2)` — the register row |
| `{{ocr_truncated}}` | `'true'` / `'false'` — tells the model the text is partial |

Output contract (`field_schema` on the prompt row):

```json
{
  "fieldResults": [
    { "field": "documentNumber", "excelValue": "…", "ocrValue": "…", "match": true, "foundInDocument": true }
  ],
  "mismatches": ["subject", "documentDate"],
  "confidence": 0.87
}
```

Compared fields (FR-006): `documentNumber`, `subject`, `documentDate`, `fromOrganization`, `toOrganization`, `correspondenceType`, `discipline`, `project`, `revision`.

**Rationale**

- Reuses `AiPromptsService.getActive()` and the existing Redis cache (`ai:prompt:active:{type}`) with zero new infrastructure — ADR-029 satisfied by construction.
- Explicit `foundInDocument` is required by FR-011c: the UI may only offer "use document value" for fields the model actually located. Without a dedicated flag, an absent value is indistinguishable from an empty-string mismatch.
- `{{ocr_truncated}}` directly addresses the false-mismatch risk (SC-003 caps false mismatches at 10%). Truncation is already applied at `MAX_OCR_TEXT_CHARS` in `ai-batch.processor.ts`; a document whose date sits on the final page would otherwise be reported as mismatched. The prompt instructs the model to emit `foundInDocument: false` rather than `match: false` when a field is simply outside the visible text.
- Keeping `field_schema` on the prompt row means a threshold/field-set change is a data change, not a deploy.

**Alternatives considered**

- *Reuse `ocr_extraction` and diff in TypeScript.* Rejected: string-level diffing of Thai organisation names and mixed Thai/Arabic date formats produces high false-positive rates, and it keeps the model doing extraction work the spec explicitly removes (FR-009).
- *Two prompts — one per field group.* Rejected: doubles GPU calls per document on a concurrency=1 queue, directly harming SC-004.
- *Return only `mismatches[]` without per-field detail.* Rejected: FR-007 requires side-by-side values, and FR-011 requires per-field source selection.

---

## R2 — Threshold storage and cache

**Decision**

Two rows in the existing `system_settings` table:

| `setting_key` | `data_type` | `category` | Default |
| --- | --- | --- | --- |
| `MIGRATION_MAX_MISMATCH_FIELDS` | `number` | `migration` | `3` |
| `MIGRATION_MIN_CONFIDENCE` | `number` | `migration` | `0.6` |

`is_public = 0` (admin-only per FR-010d). `validation_rules` carries min/max. Read through a new `ReviewThresholdService` with a Redis cache key `migration:thresholds` (TTL 60 s, `DEL` on update) — the same pattern `AiPromptsService` already uses for prompts.

**Rationale**

- `system_settings` already provides `data_type`, `validation_rules`, `is_public`, and `updated_by` — the last of which satisfies the FR-010d audit requirement with no new table.
- The 60 s TTL matches the established prompt-cache convention, so operators have one mental model for "how long until my setting takes effect".
- `0.6` preserves current production behaviour: `ai-batch.processor.ts` line 1343 already computes `confidence >= 0.6` for `isValid`. Adopting the same default means the refactor does not silently change how many records route to manual review.

**Alternatives considered**

- *Dedicated `migration_review_thresholds` table.* Rejected: a two-row single-tenant configuration does not justify a table, an entity, and a repository.
- *Environment variables.* Rejected: violates FR-010a — changing a value would require a container restart, and `.env` in production is a forbidden pattern.
- *Store on the `ai_prompts` row via `context_config`.* Rejected: couples an operational threshold to prompt versioning; activating a new prompt version would silently reset thresholds.

---

## R3 — `compare_status` representation

**Decision**

New ENUM column on `migration_review_queue`:

```sql
compare_status ENUM('COMPARED', 'UNAVAILABLE') NOT NULL DEFAULT 'COMPARED'
```

Paired with a nullable `compare_unavailable_reason VARCHAR(500)` (FR-012b). A composite index `idx_migration_review_compare_status (compare_status, STATUS, created_at)` supports the FR-012d filter.

**Rationale**

- FR-012d requires filtering the queue by compare status. `ai_metadata_json` is `LONGTEXT` with a `json_valid` check — filtering on it needs `JSON_EXTRACT` in the `WHERE` clause, which cannot use the existing `idx_migration_review_status_created` index. At 20 k rows that turns the primary operator screen into a full scan.
- A two-value ENUM keeps the state space closed. The spec defines exactly one failure bucket ("เปรียบเทียบไม่ได้"); adding `PENDING`/`PARTIAL` values now would invent states no requirement describes.
- The reason string is separate so the enum stays index-friendly while still carrying the operator-facing explanation.

**Alternatives considered**

- *Boolean `compare_available TINYINT(1)`.* Rejected: cannot express a third state later without a type change, and reads worse in queries than a named enum.
- *Flag inside `ai_metadata_json`.* Rejected — index/performance reasons above.
- *Reuse the existing `STATUS` enum by adding a value.* Rejected: conflates lifecycle state (`PENDING_REVIEW` → `IMPORTED`) with compare outcome. A record can be both `PENDING_REVIEW` and `UNAVAILABLE`; a single column cannot hold both.

---

## R4 — Multi-attachment backward compatibility

**Decision**

Additive migration with a normalising accessor:

1. Add `temp_attachment_ids JSON NULL` to `migration_review_queue`; keep `temp_attachment_id INT NULL` in place.
2. DTOs accept both `tempAttachmentId?: number` and `tempAttachmentIds?: number[]`.
3. A single private helper in `MigrationReviewService` resolves the effective list: `tempAttachmentIds ?? (tempAttachmentId ? [tempAttachmentId] : [])`.
4. Writers populate `temp_attachment_ids` always, and mirror element `[0]` into `temp_attachment_id` during the transition.
5. The first element is the main document (`is_main_document = 1`) per the spec Assumption; all others get `0`.

`temp_attachment_id` is marked deprecated in comments and removed in a later cleanup delta, not in this feature.

**Rationale**

- FR-003 requires the single-attachment path to keep working. Mirroring `[0]` means any code path or n8n node not yet updated continues to read a valid value.
- One resolution helper means the `??` fallback exists in exactly one place. Scattering the fallback across service methods is how "id ?? ''"-class bugs appear.
- Dropping the old column in the same delta would make rollback destructive; ADR-028 requires a tested rollback path.

**Alternatives considered**

- *Replace `temp_attachment_id` outright.* Rejected: breaks in-flight queue rows and any n8n workflow version still sending the singular field.
- *Junction table `migration_review_queue_attachments`.* Rejected: the queue is transient staging data that is truncated after migration (ADR-028 post-migration cleanup). A JSON array of internal IDs is proportionate; a second table would need its own cleanup step.
- *Store attachment `publicId`s in the JSON array.* Rejected: the commit path writes `correspondence_revision_attachments.attachment_id` (INT FK), so `publicId`s would force a lookup per element. These IDs never cross the API boundary — the review-queue **response** exposes `publicId`, satisfying ADR-019.

---

## R5 — DWG exclusion predicate

**Decision**

Skip predicate is **MIME-based with an extension fallback**, centralised in one exported constant used by both the RAG batch query and the OCR routing branch:

- MIME: `image/vnd.dwg`, `application/acad`, `application/x-acad`, `application/dwg`, `drawing/dwg`
- Extension fallback: `.dwg`, `.dxf`

SQL predicate for the RAG batch:

```sql
WHERE a.ocr_text IS NOT NULL
  AND a.ocr_text <> ''
  AND a.is_temporary = 0
  AND a.mime_type NOT IN (:dwgMimeTypes)
  AND LOWER(a.original_filename) NOT REGEXP '\\.(dwg|dxf)$'
```

**Rationale**

- Browsers and upload tools report DWG inconsistently — `image/vnd.dwg` and `application/acad` both occur in practice, and some clients send `application/octet-stream`. The extension fallback catches the octet-stream case without whitelisting octet-stream itself.
- `.dxf` is included because it is the interchange twin of `.dwg` and equally lacks a usable text layer for OCR.
- The `ocr_text IS NOT NULL AND <> ''` clause already excludes DWG implicitly (FR-015 skips persistence for text-layer-less files). The explicit MIME filter is defence in depth so a future OCR change that writes an empty-ish string cannot leak DWG rows into embedding.
- A single shared constant prevents the two call sites from drifting.

**Alternatives considered**

- *Extension only.* Rejected: `original_filename` is legacy-sourced and unreliable; some files arrive without an extension.
- *MIME only.* Rejected: misses `application/octet-stream` uploads.
- *A new `attachments.is_text_extractable` column.* Rejected as premature — it duplicates information already derivable from MIME plus `ocr_text` nullability, and requires a backfill.

---

## R6 — Idempotency for batch operations

**Decision**

Per-operation, derived from existing state — no new tracking table.

| Operation | "Already processed" marker | Skip condition |
| --- | --- | --- |
| `resolve-batch` | `correspondences.originator_id IS NOT NULL AND correspondence_type_id IS NOT NULL` | Reference data already linked |
| `trigger-rag-batch` | `attachments.ai_processing_status = 'DONE'` | Embedding already produced |

Both endpoints additionally require an `Idempotency-Key` header (ADR-016), checked against `import_transactions.idempotency_key` to reject an accidental double-submit of the same request. The state-based skip handles re-runs with a *new* key.

**Rationale**

- FR-020 and FR-025 require repeat-safe execution; FR-029 separately requires duplicate-request protection. These are different problems and need different mechanisms — a header check alone cannot make a deliberate re-run safe.
- `attachments.ai_processing_status` already exists with exactly the needed `PENDING/PROCESSING/DONE/FAILED` values, so the RAG skip condition needs no schema change.
- Deriving skip state from the target data means the operation is self-healing: a partially failed batch can simply be re-run, and only unfinished rows are touched (SC-010: zero duplicates).
- Tag linking is naturally idempotent via `correspondence_tags` PK `(correspondence_id, tag_id)` — use `INSERT ... ON DUPLICATE KEY UPDATE` / `INSERT IGNORE`.

**Alternatives considered**

- *A `migration_batch_runs` table recording completion per batch.* Rejected: batch-level granularity cannot express "17 of 200 rows failed, re-run just those", which is precisely the operational need behind FR-019.
- *Redis lock per batch.* Rejected: prevents concurrent runs but says nothing about which rows are done; a lost lock would permit duplicate work.
- *Rely on `Idempotency-Key` alone.* Rejected: a legitimate re-run after fixing reference data uses a new key and would re-process everything.

---

## R7 — Field-resolution persistence

**Decision**

Store the resolution array in the **existing** `ai_audit_logs.human_override_json` at commit time, and additionally set `correspondence_tags.is_ai_suggested = 0` for register-derived tags.

Shape written to `human_override_json`:

```json
{
  "fieldResolutions": [
    { "field": "subject", "source": "EXCEL", "finalValue": "…" },
    { "field": "documentDate", "source": "DOCUMENT", "finalValue": "…" },
    { "field": "revision", "source": "MANUAL", "finalValue": "…" }
  ],
  "compareStatus": "COMPARED",
  "reviewedBy": 12
}
```

`source` is one of `EXCEL` / `DOCUMENT` / `MANUAL`.

**Rationale**

- FR-011b requires an audit trail of per-field source. `ai_audit_logs` already exists precisely to pair `ai_suggestion_json` with `human_override_json` and `confirmed_by_user_id` — this is the table's designed purpose (ADR-023 audit trail), so no schema change is needed.
- The compare result is already written to `ai_suggestion_json` by `saveAiAuditLog()`. Putting the human decision in the sibling column keeps suggestion and override in one row, making "what did AI propose vs. what did the human accept" a single-row read.
- `is_ai_suggested = 0` for register-derived tags is a correctness fix that falls out of Q5/FR-018a: these tags come from the Excel register, not from AI inference. The current code sets AI-suggested semantics because tags came from LLM output; after this refactor that would be factually wrong and would mislead anyone auditing AI influence on the corpus.

**Alternatives considered**

- *New `migration_field_resolutions` table.* Rejected: duplicates `ai_audit_logs`' purpose. It would also need its own retention policy, whereas `ai_audit_logs` is already permanent (unlike the transient migration tables).
- *Store in `migration_review_queue.ai_metadata_json`.* Rejected: the queue is truncated during post-migration cleanup (ADR-028), so the audit trail would be destroyed. `ai_audit_logs` survives.
- *Do not persist source, only the final value.* Rejected: violates FR-011b, and makes SC-002/SC-003 unmeasurable after the fact — you cannot compute compare accuracy without knowing which values the human took from the document.

---

## Cross-cutting findings

### F1 — Removing Tag/UUID resolution is the main SC-004 lever

`processMigrateDocument()` currently issues, per document: 1 organisation lookup for the sender, 1 for the primary recipient, 1 correspondence-type lookup, 1 discipline lookup, plus `findOrSuggestTags()` (which itself reads and may write tags). That is 4–6 round trips serialised behind a concurrency=1 queue. Converting these to set-based SQL over a whole batch is where the ≥30% reduction comes from — the GPU call itself is unchanged.

### F2 — Compare is not cheaper than extraction; the saving is elsewhere

Swapping `ocr_extraction` for `migration_compare` does not reduce GPU time — the prompt is comparable in size (register JSON replaces master-data context). SC-004 must therefore be attributed to F1, not to the prompt change. This matters for task ordering: the batch-resolution work is on the critical path for the performance criterion.

### F3 — `MigrationReviewService.commitRecord()` does not trigger RAG today

Confirmed by inspection. This means FR-026 ("no automatic per-record embedding") describes existing behaviour and requires no change — only the new batch endpoint is additive. No regression risk in the commit path.

### F4 — `attachments.ocr_text` already exists

Delta `2026-07-27-add-ocr-text-and-sandbox-project.sql` added the column and `processRagPrepare()` already writes it (line ~1018 of `ai-batch.processor.ts`). Change #3 is a three-line addition mirroring an established pattern, not new plumbing.

---

## Resolved Technical Context

| Item | Resolution |
| --- | --- |
| Prompt type + placeholders | `migration_compare`; `{{ocr_text}}`, `{{excel_metadata}}`, `{{ocr_truncated}}` (R1) |
| Threshold storage | `system_settings` rows + Redis `migration:thresholds` TTL 60 s (R2) |
| Compare failure state | `compare_status ENUM('COMPARED','UNAVAILABLE')` + reason column (R3) |
| Multi-attachment strategy | Additive `temp_attachment_ids JSON`, `[0]` mirrored to legacy column (R4) |
| DWG skip predicate | Shared MIME constant + `.dwg`/`.dxf` extension fallback (R5) |
| Batch idempotency | State-derived skip + `Idempotency-Key` header (R6) |
| Field-resolution audit | `ai_audit_logs.human_override_json` (R7) |

**No `NEEDS CLARIFICATION` markers remain.** Ready for Phase 1.
