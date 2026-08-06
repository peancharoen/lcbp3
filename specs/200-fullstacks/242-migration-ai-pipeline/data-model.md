// File: specs/200-fullstacks/242-migration-ai-pipeline/data-model.md
// Change Log:
// - 2026-08-06: Phase 1 data model for Migration AI Pipeline Refactor

# Data Model: Migration AI Pipeline Refactor

**Branch**: `242-migration-ai-pipeline` | **Date**: 2026-08-06
**Input**: [spec.md](./spec.md) Key Entities + [research.md](./research.md) R1–R7

Per **ADR-009**, all schema changes are delivered as a delta file. **No TypeORM migrations.**

---

## 1. Schema Changes (ADR-009 Delta)

**File**: `specs/03-Data-and-Storage/deltas/2026-08-06-migration-multi-attachment-and-compare.sql`

### 1.1 `migration_review_queue` — 3 new columns

| Column | Type | Null | Default | Purpose | FR |
| --- | --- | --- | --- | --- | --- |
| `temp_attachment_ids` | `JSON` | YES | `NULL` | Ordered array of internal attachment IDs; element `[0]` is the main document | FR-001, FR-002 |
| `compare_status` | `ENUM('COMPARED','UNAVAILABLE')` | NO | `'COMPARED'` | Whether register↔document comparison produced a result | FR-012a |
| `compare_unavailable_reason` | `VARCHAR(500)` | YES | `NULL` | Operator-facing reason when `compare_status = 'UNAVAILABLE'` | FR-012b |

`temp_attachment_id INT NULL` is **retained** and deprecated in comments (R4). Element `[0]` of `temp_attachment_ids` is mirrored into it during the transition.

### 1.2 New index

```sql
CREATE INDEX idx_migration_review_compare_status
  ON migration_review_queue (compare_status, STATUS, created_at);
```

Supports the FR-012d filter without a full scan on a 20 k-row table (R3).

### 1.3 `ai_prompts` — new row

One row, not a schema change:

| Column | Value |
| --- | --- |
| `prompt_type` | `'migration_compare'` |
| `version_number` | `1` |
| `is_active` | `1` |
| `template` | Register↔document comparison template with `{{ocr_text}}`, `{{excel_metadata}}`, `{{ocr_truncated}}` |
| `field_schema` | See [contracts/migration-compare-prompt.md](./contracts/migration-compare-prompt.md) |

### 1.4 `system_settings` — 2 new rows

| `setting_key` | `setting_value` | `data_type` | `category` | `is_public` | `validation_rules` |
| --- | --- | --- | --- | --- | --- |
| `MIGRATION_MAX_MISMATCH_FIELDS` | `'3'` | `number` | `migration` | `0` | `{"min":0,"max":9}` |
| `MIGRATION_MIN_CONFIDENCE` | `'0.6'` | `number` | `migration` | `0` | `{"min":0,"max":1}` |

Defaults preserve current production behaviour (R2).

### 1.5 Tables used unchanged

| Table | Role |
| --- | --- |
| `correspondence_revision_attachments` | Already M:N with `is_main_document` — no change needed for FR-001/FR-002 |
| `attachments` | `ocr_text` LONGTEXT already present; `ai_processing_status` drives RAG skip (R6) |
| `ai_audit_logs` | `ai_suggestion_json` holds compare result; `human_override_json` holds field resolutions (R7) |
| `correspondence_tags` | PK `(correspondence_id, tag_id)` makes tag linking idempotent; `is_ai_suggested` set to `0` for register-derived tags |
| `import_transactions` | `idempotency_key` uniqueness backs the header check |
| `migration_errors` | Retained for genuine failures; **no longer** used for compare failures (those go to the queue per FR-012a) |

---

## 2. Entity Changes

### 2.1 `MigrationReviewQueue` (modified)

`backend/src/modules/migration/entities/migration-review-queue.entity.ts`

```typescript
/** สถานะการเปรียบเทียบทะเบียนกับเอกสารจริง */
export enum CompareStatus {
  COMPARED = 'COMPARED',
  UNAVAILABLE = 'UNAVAILABLE',
}
```

New properties:

| Property | Column | Type | Notes |
| --- | --- | --- | --- |
| `tempAttachmentIds` | `temp_attachment_ids` | `number[] \| null` | `type: 'json'` |
| `compareStatus` | `compare_status` | `CompareStatus` | `type: 'enum'`, default `COMPARED` |
| `compareUnavailableReason` | `compare_unavailable_reason` | `string \| null` | |

`tempAttachmentId` retained with a deprecation comment. Both internal-ID columns carry `@Exclude()` — they never reach an API response (ADR-019).

Effective-list resolution lives in **one** private helper (R4):

```typescript
/** คืนรายการ attachment id ที่ใช้จริง โดยรองรับรูปแบบเดิมที่มีไฟล์เดียว */
private resolveAttachmentIds(record: MigrationReviewQueue): number[] {
  if (record.tempAttachmentIds?.length) return record.tempAttachmentIds;
  return record.tempAttachmentId ? [record.tempAttachmentId] : [];
}
```

---

## 3. New Types (no table)

### 3.1 `CompareResult`

`backend/src/modules/ai/types/migration-compare-result.type.ts` — parsed from LLM output via a typed guard mirroring `parseMigrateDocumentMetadata`.

| Field | Type | Notes |
| --- | --- | --- |
| `fieldResults` | `CompareFieldResult[]` | One entry per compared field |
| `mismatches` | `string[]` | Field names where `match === false` |
| `confidence` | `number` | `0.0`–`1.0` |

`CompareFieldResult`:

| Field | Type | Notes |
| --- | --- | --- |
| `field` | `string` | One of the 9 compared fields (FR-006) |
| `excelValue` | `string \| null` | Register value |
| `ocrValue` | `string \| null` | Value located in the document |
| `match` | `boolean` | Agreement verdict |
| `foundInDocument` | `boolean` | Gates the "use document value" option (FR-011c) |

Persisted to `migration_review_queue.ai_metadata_json` and `ai_audit_logs.ai_suggestion_json`.

### 3.2 `FieldResolution`

Reviewer decision per field (FR-011, FR-011b). Submitted in the commit payload, persisted to `ai_audit_logs.human_override_json` (R7).

| Field | Type | Notes |
| --- | --- | --- |
| `field` | `string` | Field name |
| `source` | `'EXCEL' \| 'DOCUMENT' \| 'MANUAL'` | Chosen source; default `EXCEL` (FR-011a) |
| `finalValue` | `string` | Value actually written |

**Validation**: `source = 'DOCUMENT'` is rejected when the matching `CompareFieldResult.foundInDocument` is `false` (FR-011c).

### 3.3 `ExcelMetadata`

`backend/src/modules/ai/dto/excel-metadata.dto.ts` — register row sent by n8n, carried in the `migrate-document` job payload (FR-006).

Fields: `documentNumber`, `subject`, `documentDate`, `fromOrganization`, `toOrganization`, `correspondenceType`, `discipline`, `project`, `revision` — all `string`, optional except `documentNumber`.

### 3.4 `ReviewThresholdSetting`

Read model over the two `system_settings` rows (R2).

| Field | Type | Default | Source key |
| --- | --- | --- | --- |
| `maxMismatchFields` | `number` | `3` | `MIGRATION_MAX_MISMATCH_FIELDS` |
| `minConfidence` | `number` | `0.6` | `MIGRATION_MIN_CONFIDENCE` |

Cached at `migration:thresholds`, TTL 60 s, `DEL` on update.

### 3.5 `TagMappingRule`

Deterministic register-field → tag mapping (FR-018, FR-018b). Declared as a static, versioned constant — **not** LLM-derived (FR-018a).

| Register field | Tag prefix |
| --- | --- |
| `discipline` | `discipline:` |
| `correspondenceType` | `type:` |

Same input always yields the same tag name, making re-runs duplicate-free (SC-010).

---

## 4. Derived Classification

`reviewGroup` is **computed, not stored** — FR-010c requires that a threshold change affect only records processed afterwards, so persisting the group would either go stale or require a forbidden auto-reclassification.

```
compare_status = UNAVAILABLE                        → MANUAL_REVIEW (FR-012b)
mismatches.length > maxMismatchFields               → MANUAL_REVIEW
confidence < minConfidence                          → MANUAL_REVIEW
otherwise                                           → READY_TO_CONFIRM
```

Thresholds are captured into `ai_metadata_json` at processing time so the group can be recomputed identically later.

---

## 5. Relationships

```
Correspondence 1 ──── N CorrespondenceRevision
                              │
                              └── N:M ── Attachment
                                   (correspondence_revision_attachments,
                                    is_main_document flag)

MigrationReviewQueue ──► temp_attachment_ids: number[] (soft ref → attachments.id)
                    ──► ai_metadata_json: CompareResult + captured thresholds
                    ──► compare_status / compare_unavailable_reason

AiAuditLog ──► ai_suggestion_json:  CompareResult      (machine proposal)
          ──► human_override_json: FieldResolution[]   (human decision)
```

---

## 6. State Transitions

### 6.1 Review-queue lifecycle (unchanged)

```
PENDING ──► PENDING_REVIEW ──► IMPORTED
                          └──► REJECTED
```

### 6.2 Compare status (set once)

```
processMigrateDocument()
  ├── compare succeeds ──────────────► COMPARED
  └── OCR fails / text too short /
      LLM unparseable or no response ► UNAVAILABLE + reason
```

`UNAVAILABLE` does **not** block commit (FR-012c).

### 6.3 Attachment AI status (drives RAG idempotency)

```
PENDING ──► PROCESSING ──► DONE
                      └──► FAILED
```

`trigger-rag-batch` skips `DONE` (R6).

---

## 7. Validation Rules

| Rule | Requirement |
| --- | --- |
| `tempAttachmentIds` non-empty on commit; every ID must exist | FR-001, Edge Case "missing attachment" |
| Exactly one attachment marked `is_main_document = 1` | FR-002 |
| MIME must be in the extended whitelist (PDF/DOCX/DWG/XLSX/ZIP) | FR-004 |
| `confidence` ∈ `[0,1]` | FR-008 |
| `source = 'DOCUMENT'` requires `foundInDocument = true` | FR-011c |
| `compare_status = 'UNAVAILABLE'` requires a non-null reason | FR-012b |
| Batch endpoints require `Idempotency-Key` | FR-029 |
| `maxMismatchFields` ∈ `[0,9]`; `minConfidence` ∈ `[0,1]` | FR-010b |
| Tag name must derive from a `TagMappingRule` | FR-018b |

---

## 8. Query Patterns

### 8.1 RAG batch candidates (R5)

```sql
SELECT DISTINCT a.id, a.public_id, a.ocr_text
FROM attachments a
JOIN correspondence_revision_attachments cra ON cra.attachment_id = a.id
WHERE a.ocr_text IS NOT NULL
  AND a.ocr_text <> ''
  AND a.is_temporary = 0
  AND a.ai_processing_status <> 'DONE'
  AND a.mime_type NOT IN (:dwgMimeTypes)
  AND LOWER(a.original_filename) NOT REGEXP '\\.(dwg|dxf)$';
```

`DISTINCT` handles an attachment shared across revisions — embed once per file (Edge Case).

### 8.2 Reference-data resolution scope

```sql
SELECT c.id, cr.details
FROM correspondences c
JOIN correspondence_revisions cr ON cr.correspondence_id = c.id AND cr.is_current = 1
JOIN import_transactions it ON it.document_number = c.correspondence_number
WHERE (:batchId IS NULL OR it.batch_id = :batchId)
  AND (c.originator_id IS NULL OR c.correspondence_type_id IS NULL);
```

`:batchId IS NULL` implements "run everything pending" (FR-020a).

---

## 9. Deferred / Out of Scope

| Item | Reason |
| --- | --- |
| Drop `temp_attachment_id` | Later cleanup delta — keeps rollback non-destructive (R4) |
| Truncate transient migration tables | ADR-028 post-migration cleanup, not this feature |
| `attachments.is_text_extractable` column | Derivable from MIME + `ocr_text`; premature (R5) |
| Per-field confidence | Spec requires overall confidence only (FR-008) |
