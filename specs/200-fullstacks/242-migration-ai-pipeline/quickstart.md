// File: specs/200-fullstacks/242-migration-ai-pipeline/quickstart.md
// Change Log:
// - 2026-08-06: Phase 1 verification walkthrough for Migration AI Pipeline Refactor

# Quickstart: Migration AI Pipeline Refactor

**Branch**: `242-migration-ai-pipeline` | **Date**: 2026-08-06

End-to-end verification path for Feature 242. Follow it in order — each step's output feeds
the next. Every step maps to acceptance scenarios in [spec.md](./spec.md).

> **No Fake Evidence** — every claim below must be backed by real command output. If a step
> cannot be run, say so explicitly rather than assuming it passed.

---

## 0. Prerequisites

| Requirement | Check |
| --- | --- |
| Backend running | `curl -s localhost:3001/api/health` |
| MariaDB reachable | `mcp1_mysql_test_connection` |
| Redis reachable | `mcp7_list` with pattern `bull:ai-batch:*` |
| Ollama + OCR sidecar up on np-dms-lcbp3 | `curl -s $OCR_API_URL/health` |
| Qdrant reachable | `mcp6_qdrant_health` |
| Admin JWT with `system.manage_all` | Required by all new endpoints (FR-027) |

```bash
export API=http://localhost:3001/api
export TOKEN="<admin-jwt>"
export AUTH="Authorization: Bearer $TOKEN"
```

---

## 1. Apply the schema delta

```bash
mysql -u lcbp3 -p lcbp3 < specs/03-Data-and-Storage/deltas/2026-08-06-migration-multi-attachment-and-compare.sql
```

**Verify** — new columns and index exist:

```sql
SHOW COLUMNS FROM migration_review_queue
  WHERE Field IN ('temp_attachment_ids','compare_status','compare_unavailable_reason');

SHOW INDEX FROM migration_review_queue
  WHERE Key_name = 'idx_migration_review_compare_status';
```

Expected: 3 columns, 1 index. `temp_attachment_id` must still be present (R4 — rollback safety).

---

## 2. Seed the prompt and thresholds

```sql
SELECT prompt_type, version_number, is_active
FROM ai_prompts WHERE prompt_type = 'migration_compare';

SELECT setting_key, setting_value FROM system_settings
WHERE setting_key IN ('MIGRATION_MAX_MISMATCH_FIELDS','MIGRATION_MIN_CONFIDENCE');
```

Expected: one active `migration_compare` row; thresholds `3` and `0.6`.

**Verify the template has all three placeholders** — a missing one silently yields a
useless prompt:

```sql
SELECT
  template LIKE '%{{ocr_text}}%'       AS has_ocr,
  template LIKE '%{{excel_metadata}}%' AS has_excel,
  template LIKE '%{{ocr_truncated}}%'  AS has_trunc
FROM ai_prompts
WHERE prompt_type = 'migration_compare' AND is_active = 1;
```

All three must be `1`.

---

## 3. Upload attachments (multi-file)

Upload a scanned PDF plus a DWG for the same Correspondence:

```bash
curl -s -X POST "$API/files/temp-upload" -H "$AUTH" \
  -F "file=@./fixtures/RFA-00123.pdf" | tee /tmp/att1.json

curl -s -X POST "$API/files/temp-upload" -H "$AUTH" \
  -F "file=@./fixtures/SD-00123-A.dwg" | tee /tmp/att2.json
```

**Verify (FR-004)**: the DWG upload succeeds. Before this feature the whitelist rejected it.

---

## 4. Submit the compare job

```bash
curl -s -X POST "$API/ai/jobs" -H "$AUTH" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: qs-compare-$(date +%s)" \
  -d '{
    "jobType": "migrate-document",
    "batchId": "QUICKSTART-001",
    "documentPublicId": "<att1.publicId>",
    "projectPublicId": "<project.publicId>",
    "payload": {
      "documentNumber": "LCBP3-CSC-RFA-00123",
      "title": "ขออนุมัติแบบก่อสร้างงานโครงสร้าง",
      "tempAttachmentIds": ["<att1.id>", "<att2.id>"],
      "excelMetadata": {
        "documentNumber": "LCBP3-CSC-RFA-00123",
        "subject": "ขออนุมัติแบบก่อสร้างงานโครงสร้าง",
        "documentDate": "2019-03-14",
        "fromOrganization": "CSC",
        "toOrganization": "PAT",
        "correspondenceType": "RFA",
        "discipline": "STRUCT",
        "project": "LCBP3",
        "revision": "A"
      }
    }
  }'
```

Wait for the `ai-batch` worker (concurrency = 1, so serialised).

### 4.1 Verify OCR text was persisted (FR-013, SC-006)

```sql
SELECT public_id, LENGTH(ocr_text) AS ocr_len, ai_processing_status
FROM attachments WHERE public_id = '<att1.publicId>';
```

Expected: `ocr_len > 0`. **This is the core regression check for change #3** — before this
feature `processMigrateDocument()` left `ocr_text` NULL.

For the DWG (FR-015):

```sql
SELECT public_id, ocr_text IS NULL AS no_text
FROM attachments WHERE public_id = '<att2.publicId>';
```

Expected: `no_text = 1`, and the job did not fail.

### 4.2 Verify the compare prompt was used, not extraction

```sql
SELECT model_name, confidence_score,
       JSON_EXTRACT(ai_suggestion_json, '$.fieldResults[0].field')      AS first_field,
       JSON_EXTRACT(ai_suggestion_json, '$.fieldResults[0].foundInDocument') AS found_flag
FROM ai_audit_logs
WHERE document_public_id = '<att1.publicId>'
ORDER BY created_at DESC LIMIT 1;
```

Expected: `fieldResults` present with a `foundInDocument` flag. If you instead see keys
like `originatorOrganizationPublicId` or `tags`, the processor is still running
`ocr_extraction` — change #2 is not wired up.

### 4.3 Verify Tag/UUID resolution no longer runs (FR-016)

```sql
SELECT COUNT(*) AS tags_created_during_import
FROM tags WHERE created_at >= NOW() - INTERVAL 5 MINUTE;
```

Expected: `0`. Tags must only appear in step 8.

---

## 5. Inspect the review queue

```bash
curl -s "$API/migration/review-queue?batchId=QUICKSTART-001" -H "$AUTH" | jq
```

**Verify**:

| Check | Requirement |
| --- | --- |
| `attachments` has 2 entries | FR-001, FR-005 |
| Exactly one has `isMainDocument: true` | FR-002 |
| PDF has `hasOcrText: true`, DWG `false` | FR-015 |
| `compareResult.fieldResults` present per field | FR-007 |
| `compareResult.mismatches` lists disagreeing fields | FR-007 |
| `reviewGroup` is `READY_TO_CONFIRM` or `MANUAL_REVIEW` | FR-010 |
| Fields absent from the document have `foundInDocument: false` | FR-011c |

### 5.1 Threshold behaviour (FR-010a, FR-010c, SC-011)

Note the current `reviewGroup`, then tighten the threshold:

```bash
curl -s -X PATCH "$API/migration/review-thresholds" -H "$AUTH" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: qs-thresh-$(date +%s)" \
  -d '{"maxMismatchFields": 0}'
```

Re-read the **same** record:

```bash
curl -s "$API/migration/review-queue?batchId=QUICKSTART-001" -H "$AUTH" \
  | jq '.items[0].reviewGroup'
```

Expected: **unchanged** — FR-010c forbids retroactive reclassification. Submit a *new*
document to confirm the new threshold applies going forward.

Restore: `{"maxMismatchFields": 3}`.

### 5.2 Compare-unavailable path (FR-012a–d)

Submit a job whose file is a blank or corrupt scan:

```bash
curl -s -X POST "$API/ai/jobs" -H "$AUTH" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: qs-blank-$(date +%s)" \
  -d '{ "jobType":"migrate-document", "batchId":"QUICKSTART-001",
        "documentPublicId":"<blank.publicId>", "projectPublicId":"<project.publicId>",
        "payload": { "documentNumber":"LCBP3-CSC-LTR-00456", "tempAttachmentIds":["<blank.id>"],
                     "excelMetadata": { "documentNumber":"LCBP3-CSC-LTR-00456" } } }'
```

Then:

```bash
curl -s "$API/migration/review-queue?compareStatus=UNAVAILABLE" -H "$AUTH" | jq
```

**Verify**: the record **is in the queue** (not only in `migration_errors`),
`compareUnavailableReason` is a Thai sentence, `reviewGroup = MANUAL_REVIEW`, and the
filter isolates it (FR-012d).

---

## 6. Commit with mixed field sources

```bash
curl -s -X POST "$API/migration/review-queue/<queue.publicId>/commit" -H "$AUTH" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: qs-commit-$(date +%s)" \
  -d '{
    "fieldResolutions": [
      { "field": "subject",      "source": "EXCEL",    "finalValue": "ขออนุมัติแบบก่อสร้างงานโครงสร้าง" },
      { "field": "documentDate", "source": "DOCUMENT", "finalValue": "2019-04-14" },
      { "field": "revision",     "source": "MANUAL",   "finalValue": "B" }
    ]
  }'
```

### 6.1 Verify all attachments linked (FR-001, FR-002, SC-005)

```sql
SELECT a.original_filename, cra.is_main_document
FROM correspondence_revision_attachments cra
JOIN attachments a ON a.id = cra.attachment_id
JOIN correspondence_revisions cr ON cr.id = cra.correspondence_revision_id
WHERE cr.uuid = '<revision.publicId>';
```

Expected: 2 rows, exactly one with `is_main_document = 1`.

### 6.2 Verify field sources were audited (FR-011b)

```sql
SELECT JSON_EXTRACT(human_override_json, '$.fieldResolutions') AS resolutions
FROM ai_audit_logs
WHERE document_public_id = '<att1.publicId>'
ORDER BY created_at DESC LIMIT 1;
```

Expected: three entries with `source` values `EXCEL`, `DOCUMENT`, `MANUAL`.

### 6.3 Verify the invalid-source guard (FR-011c)

Try committing another record with `source: "DOCUMENT"` for a field whose
`foundInDocument` was `false`:

Expected: **400** with `errorCode: MIGRATION_FIELD_SOURCE_UNAVAILABLE` and a Thai
`userMessage` + `recoveryAction` (ADR-007).

### 6.4 Verify commit does not trigger embedding (FR-026)

```bash
mcp6_qdrant_count --collection documents
```

Expected: unchanged from before the commit.

---

## 7. Reference-data resolution batch

```bash
curl -s -X POST "$API/migration/resolve-batch" -H "$AUTH" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: qs-resolve-$(date +%s)" \
  -d '{"batchId": "QUICKSTART-001"}' | jq
```

**Verify (FR-017, FR-019, SC-009)**:

```sql
SELECT c.correspondence_number, c.originator_id, c.correspondence_type_id, c.discipline_id
FROM correspondences c
WHERE c.correspondence_number = 'LCBP3-CSC-RFA-00123';
```

Expected: no NULLs. Unresolvable values appear in the response `failures[]` with the
offending register value — and the run still reports `200`, not a 500.

### 7.1 Verify tags come from the register only (FR-018, FR-018a)

```sql
SELECT t.tag_name, ct.is_ai_suggested
FROM correspondence_tags ct
JOIN tags t ON t.id = ct.tag_id
JOIN correspondences c ON c.id = ct.correspondence_id
WHERE c.correspondence_number = 'LCBP3-CSC-RFA-00123';
```

Expected: tag names derived from register fields (`discipline:STRUCT`, `type:RFA`) with
`is_ai_suggested = 0`. Any tag resembling a keyword extracted from the document body means
FR-018a is violated.

### 7.2 Verify idempotency (FR-020, SC-010)

Re-run with a **new** `Idempotency-Key`:

Expected: `skipped` equals the previously succeeded count, `succeeded = 0`, and:

```sql
SELECT correspondence_id, tag_id, COUNT(*) c
FROM correspondence_tags GROUP BY 1,2 HAVING c > 1;
```

Expected: empty.

### 7.3 Verify unscoped run (FR-020a)

Omit `batchId` (`-d '{}'`) — expected: processes every pending record across batches.

---

## 8. Semantic-search preparation batch

```bash
curl -s -X POST "$API/migration/trigger-rag-batch" -H "$AUTH" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: qs-rag-$(date +%s)" \
  -d '{"batchId": "QUICKSTART-001"}' | jq
```

**Verify (FR-021–FR-026b)**:

| Check | Requirement |
| --- | --- |
| Response is `202` and returns immediately | ADR-008 |
| `skipBreakdown.noTextLayer` counts the DWG | FR-022 |
| `enqueued` counts only PDFs with persisted text | FR-023 |
| Response names the batch that was run | FR-026b |

### 8.1 Verify no re-OCR (FR-014, SC-006)

```bash
mcp7_get --key "..." # or inspect worker logs
```

Watch the worker log for the enqueued `rag-prepare` job. Expected: a cache/persisted-text
path, **no** call to the OCR sidecar. Any `/ocr-upload` request for `<att1>` means the
persisted text is not being reused.

### 8.2 Verify embeddings landed (SC-007)

```bash
mcp6_qdrant_count --collection documents
```

Expected: greater than the step 6.4 baseline.

Multi-tenancy check (FR-030, ADR-023A) — every point must carry
`project_public_id`:

```bash
mcp6_qdrant_scroll --collection documents --limit 5
```

### 8.3 Verify idempotency (FR-025)

Re-run with a new key. Expected: `skipBreakdown.alreadyEmbedded` accounts for the previous
run, `enqueued = 0`, and the Qdrant count is unchanged.

---

## 9. Semantic search from the UI (SC-008)

1. Open `/search`.
2. Query with wording that does **not** appear verbatim in the document (e.g. a paraphrase
   of the subject).
3. **Verify**: the migrated Correspondence appears, and the result renders in under 2 s.

---

## 10. Frontend review UI

At `/migration/review`:

| Check | Requirement |
| --- | --- |
| All attachments listed with type icons | FR-005 |
| Per-field table shows register value vs. document value side by side | FR-007 |
| Each mismatched field offers three source options | FR-011 |
| Register value is preselected | FR-011a |
| "Use document value" is hidden when `foundInDocument = false` | FR-011c |
| "เปรียบเทียบไม่ได้" badge with reason on `UNAVAILABLE` records | FR-012b |
| `UNAVAILABLE` records are still confirmable | FR-012c |
| Compare-status filter present | FR-012d |
| Batch run summary shows success / skip / fail | FR-026b |
| No hardcoded Thai strings — all via i18n keys | Tier 2 |

At `/admin/migration-settings`:

| Check | Requirement |
| --- | --- |
| Both thresholds editable | FR-010a |
| Validation enforces ranges | FR-010b |
| Non-admin receives 403 | FR-010d |

---

## 11. Automated verification

```bash
# Backend
cd backend
npx tsc --noEmit
npm run lint
npm test -- ai-batch.processor.spec
npm test -- migration
npm test -- --coverage --collectCoverageFrom='src/modules/migration/**'

# Frontend
cd ../frontend
npx tsc --noEmit
npm run lint

# E2E
npx playwright test tests/e2e/migration-review.spec.ts
```

Coverage targets: backend overall ≥ 70%, business logic ≥ 80%.

### 11.1 Forbidden-pattern scan (Tier 1)

```bash
grep -rn "parseInt\|Number(" backend/src/modules/migration backend/src/modules/ai | grep -i "uuid\|publicId"
grep -rn ": any\|console\.log" backend/src/modules/migration backend/src/modules/ai
grep -rn "?? ''" frontend/app/\(dashboard\)/migration
```

All three must return **no** results.

---

## 12. Rollback

```sql
-- Deactivate the compare prompt (records fall back to compare_status = UNAVAILABLE)
UPDATE ai_prompts SET is_active = 0 WHERE prompt_type = 'migration_compare';

-- Drop the added columns; temp_attachment_id was retained, so single-attachment
-- behaviour survives (R4)
ALTER TABLE migration_review_queue
  DROP INDEX idx_migration_review_compare_status,
  DROP COLUMN compare_unavailable_reason,
  DROP COLUMN compare_status,
  DROP COLUMN temp_attachment_ids;

DELETE FROM system_settings
WHERE setting_key IN ('MIGRATION_MAX_MISMATCH_FIELDS','MIGRATION_MIN_CONFIDENCE');
```

Committed Correspondences and persisted OCR text are **not** rolled back — both are valid
data independent of this feature.

---

## Requirement coverage map

| Step | Requirements |
| --- | --- |
| 1–2 | ADR-009 delta, ADR-029 prompt storage |
| 3 | FR-004 |
| 4 | FR-006, FR-009, FR-013, FR-015, FR-016, SC-006 |
| 5 | FR-005, FR-007, FR-008, FR-010–FR-010d, FR-011c, FR-012a–d, SC-001, SC-011 |
| 6 | FR-001, FR-002, FR-003, FR-011–FR-011b, FR-026, SC-005 |
| 7 | FR-017–FR-020a, FR-027, FR-029, SC-009, SC-010 |
| 8 | FR-014, FR-021–FR-026b, FR-030, SC-006, SC-007 |
| 9 | SC-008 |
| 10 | FR-005, FR-011–FR-012d, i18n |
| 11 | Tier 1/2 gates, test coverage |
