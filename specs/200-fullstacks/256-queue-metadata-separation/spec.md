// File: specs/200-fullstacks/256-queue-metadata-separation/spec.md
// Change Log:
// - 2026-09-14: Initial specification for Migration Review Queue Metadata Separation (derived from ADR-054)
// - 2026-09-14: Sync with code-traced megaplan — FR-003 adds fieldAcknowledgments; FR-006 covers manual OCR edits;
//   FR-010 details wording corrected (residual ingestion keys + transient attachments remain); FR-014 adds legacy AI module path

# Feature Specification: Migration Review Queue Metadata Separation + OCR Text Protection

**Feature Branch**: `256-queue-metadata-separation`
**Created**: 2026-09-14
**Status**: Draft
**Category**: 200-fullstacks
**Input**: User description: "Implement ADR-054 (specs/06-Decision-Records/ADR-054-migration-review-queue-metadata-separation.md) — separate migration_review_queue metadata into three ownership-based storage classes (ingestion metadata → real columns, AI extraction output → ai_metadata_json, review state → review_state_json), protect ocr_text from loss during re-extraction (storage_temp_path usage, attachment fallback, ocr_text_bak snapshot), add imported_correspondence_public_id audit link after import, and enforce the bulk-operation safety protocol. Full migration restart — no backward compatibility with existing rows."

## Clarifications

### Session 2026-09-14

- Q: หลังแยก storage แล้ว queue-item API response ควร expose field ที่ย้ายอย่างไร? → A: Expose `storageTempPath` / `reviewState.fieldResolutions` เป็น top-level fields แล้วอัปเดต frontend types + review pages (ไม่ merge กลับเข้า `details`)
- Q: เมื่อ `ocr_text` ปัจจุบันเป็น failure placeholder ควร snapshot ทับ `ocr_text_bak` หรือไม่? → A: ข้าม snapshot เมื่อค่าปัจจุบันตรงกับ known failure placeholder — `ocr_text_bak` เก็บ "ข้อความจริงล่าสุด" เสมอ (amends ADR-054 D5 code sketch; placeholder detection via known marker constant)
- Q: ช่องทางกู้คืน `ocr_text` จาก `ocr_text_bak` ควรเป็นแบบไหน? → A: Admin UI button ใน review detail page + backend restore endpoint (per-item restore)

### Session 2026-09-14 (planning)

- Q: `updateQueueOcr` (manual OCR edit) ควร snapshot ก่อน overwrite ด้วยหรือไม่? → A: Snapshot ด้วย — กฎเดียวกับ extraction overwrite
- Q: `review_state_json` เก็บอะไรบ้าง? → A: `fieldResolutions` + `fieldAcknowledgments` (reviewer acknowledgments ทั้งคู่)
- Q: AI module path เก่า (`ai-ingest.service.ts`, `MigrationReviewRecord` entity ที่ map ตารางเดียวกัน) อยู่ใน scope ไหม? → A: รวมใน scope

## Background

A data-loss incident on 2026-09-14 permanently destroyed OCR text for 183 migration queue records: a bulk reset of `ai_metadata_json = NULL` also erased `source_file_path` (stored inside the same JSON bag), so the extractor could not locate the PDF, wrote a "no PDF" placeholder over real OCR text, and no backup existed. ADR-054 root-causes this to a wide JSON bag mixing three data types with different lifecycles and owners, plus unused real columns (`storage_temp_path`, `original_filename`) and triplicated confidence values. This feature implements ADR-054 decisions D1–D10.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Operator re-extracts queue items without losing OCR text or file location (Priority: P1)

A migration operator needs to re-run AI extraction on queue items (e.g., after a prompt or contract change) without any risk of permanently losing the OCR text, the source file path, or the reviewer's prior decisions.

**Why this priority**: This is the incident that motivated the ADR — re-extraction is a routine migration operation and must be safe by construction, not by operator caution. Without this, every re-extract is a potential unrecoverable data-loss event.

**Independent Test**: Can be fully tested by queueing an item with real OCR text, triggering re-extraction under each failure mode (missing path, missing PDF, extraction error), and confirming the original OCR text remains recoverable and the file path survives.

**Acceptance Scenarios**:

1. **Given** a queue item with ingested `storage_temp_path` and extracted `ocr_text`, **When** re-extraction is triggered, **Then** the file path and any prior review decisions are untouched, and only AI output fields are regenerated.
2. **Given** a queue item whose stored file path is missing or stale, **When** re-extraction runs, **Then** the system falls back to the linked attachment's file path before concluding the PDF is unavailable.
3. **Given** a queue item with existing `ocr_text`, **When** a new extraction result is about to overwrite it, **Then** the previous OCR text is snapshotted to `ocr_text_bak` first, so a bad result can be rolled back.
4. **Given** a re-extraction produces a placeholder/failure result, **When** the operator inspects the item, **Then** the pre-extraction OCR text is still present in `ocr_text_bak` and can be restored.

---

### User Story 2 - Reviewer's decisions are never overwritten by AI re-processing (Priority: P1)

A reviewer has resolved flagged fields on queue items (accept/reject per-field decisions). When the operator later re-extracts those items, the human decisions must survive untouched.

**Why this priority**: Human-in-the-loop review is a core ADR-023 requirement; losing review state silently discards human labor and breaks the audit story. Equally critical to Story 1 but addresses a different data class (review state vs. ingestion metadata).

**Independent Test**: Can be fully tested by recording field resolutions on an item, running re-extraction, and verifying the review state column is byte-identical afterward while AI output fields were regenerated.

**Acceptance Scenarios**:

1. **Given** a queue item with `fieldResolutions` recorded by a reviewer, **When** re-extraction completes, **Then** `review_state_json` still contains those resolutions and `ai_metadata_json` contains only freshly-written AI output.
2. **Given** the AI batch processor writes extraction results, **When** it persists a queue item, **Then** it writes only to `ai_metadata_json` and never touches `review_state_json`.

---

### User Story 3 - Operator and reviewer can trace an imported record back to its queue item (Priority: P2)

After a queue item is approved and imported as a production Correspondence, the team needs an audit trail: which queue item produced which correspondence, who reviewed it, and what the AI suggested at that time.

**Why this priority**: Required for post-import incident investigation and audit. Lower urgency than data-loss prevention but part of the same storage contract.

**Independent Test**: Can be fully tested by approving a queue item, confirming the item remains in the queue with status IMPORTED plus a link to the created correspondence, and confirming reverse lookup works.

**Acceptance Scenarios**:

1. **Given** a queue item approved by a reviewer, **When** the import completes successfully, **Then** the queue item is retained with status IMPORTED, reviewer identity, review timestamp, and `imported_correspondence_public_id` pointing at the new Correspondence.
2. **Given** an imported queue item, **When** anyone inspects it later, **Then** the snapshot of OCR text and AI metadata at migration time is still available.
3. **Given** the need to remove queue data, **When** cleanup is required, **Then** it happens only through the explicit manual delete operation (by batch, all, or explicit item list) — never automatically.

---

### User Story 4 - Operator performs bulk queue operations under a safety protocol (Priority: P2)

Any bulk UPDATE/DELETE affecting more than 10 queue rows must follow a documented protocol: backup table first, preflight inspection of JSON contents, canary on a single record, verification, then bulk execution with logging and a rollback path.

**Why this priority**: This is the procedural guardrail that would have prevented the original incident even if the schema were unchanged. It is a convention/checklist rather than enforced code, so it can ship in parallel.

**Independent Test**: Can be fully tested by executing a bulk operation per the protocol and confirming each artifact exists (backup table, canary verification record, log entry with scope and affected row count) and that rollback restores prior state.

**Acceptance Scenarios**:

1. **Given** a planned bulk operation on the queue, **When** the operator follows the protocol, **Then** a timestamped backup table containing the affected columns exists before any mutation runs.
2. **Given** a failed or incorrect bulk operation, **When** rollback is needed, **Then** the affected rows can be restored from the backup table.

---

### Edge Cases

- Re-extraction on an item whose `ocr_text` is empty/NULL: no snapshot is written to `ocr_text_bak` (nothing worth preserving), and the new result writes normally.
- Re-extraction run twice in a row: `ocr_text_bak` holds the last *real* OCR text — a current value matching a known failure placeholder is never snapshotted, so a failed first re-extract cannot destroy the good backup on a second run.
- Restore from `ocr_text_bak`: available per-item via the review UI (admin only); restoring writes `ocr_text_bak` back into `ocr_text` without clearing the backup.
- Manual OCR edit (`PATCH /migration/queue/:publicId/ocr`): snapshots current `ocr_text` to `ocr_text_bak` before overwrite, subject to the same placeholder-skip rule.
- Queue items set to IMPORTED via any of the three commit paths (`approveQueueItem`, `approveQueueItemByPublicId`, `commitRecord`) all store `imported_correspondence_public_id`.
- Item has `temp_attachment_ids` but the attachment row was deleted: fallback yields no path; extractor may legitimately produce a NO_PDF outcome, but `ocr_text_bak` still preserves prior text.
- Queue item ingested before this feature does not exist — the table is truncated and migration restarts from Excel; there are no legacy rows to migrate.
- `compareResult`/`capturedThresholds` are classified as AI output (recomputed every extraction) — they live in `ai_metadata_json` and are reset on re-extract, not preserved as review state.
- `ai_issues` column is out of scope — it already has its own write path for `NEW_TAG_SUGGESTED` review flags and is not touched.
- Confidence values remain intentionally duplicated (column aliases for query/sort vs. per-field JSON for review UI) per D7 — neither side may be dropped.

## Requirements _(mandatory)_

### Functional Requirements

**Storage separation (ownership-based)**

- **FR-001**: Ingestion MUST write the source file path to the `storage_temp_path` column (not into `ai_metadata_json`), and MUST write the original filename to `original_filename`.
- **FR-002**: The AI extraction pipeline MUST resolve the PDF path from `storage_temp_path` first, then fall back to `attachments.file_path` via `temp_attachment_ids[0]` when the column is empty; it MUST NOT read `ai_metadata_json.source_file_path`.
- **FR-003**: Review decisions (`fieldResolutions` and `fieldAcknowledgments`) MUST be persisted to a dedicated `review_state_json` column; the AI pipeline MUST NOT write to it under any circumstance.
- **FR-004**: After separation, `ai_metadata_json` MUST contain only AI extraction output (`ocrQuality`, `metadata.*`, `aiFailureReason`, `compareResult`, `capturedThresholds`).

**Re-extraction safety**

- **FR-005**: Re-extraction MUST reset only `ai_metadata_json` (AI output) and MUST preserve ingestion columns, `ocr_text`, and `review_state_json`; a whitelist of preserved JSON keys MUST be applied as defense-in-depth for any ingestion fields still inside the bag.
- **FR-006**: Before any new extraction result OR manual OCR edit (`updateQueueOcr`) overwrites a non-empty `ocr_text`, the current value MUST be copied to `ocr_text_bak` in the same write — except when the current value matches a known failure placeholder (per Q2 clarification, amending ADR-054 D5), in which case the existing `ocr_text_bak` is preserved so it always holds the last real OCR text.
- **FR-007**: A per-item restore capability MUST exist: a CASL-guarded admin endpoint that writes `ocr_text_bak` back into `ocr_text`, plus a restore action in the review detail UI shown only when `ocr_text_bak` is non-empty; restore MUST NOT clear `ocr_text_bak`.

**Audit trail**

- **FR-008**: On successful import, the queue item MUST be retained with status IMPORTED, `reviewed_by`, `reviewed_at`, and `imported_correspondence_public_id`; deletion MUST remain manual-only via the existing scoped delete operation.

**Confidence values (D7)**

- **FR-009**: `ai_confidence` column MUST remain a backward-compat alias (min of `metadata.confidence.*`); `ocr_quality_confidence` MUST remain the sortable/filterable column; per-field confidence in JSON MUST remain the review-UI source of truth. No confidence storage may be removed.

**API contract & frontend (Q1 clarification)**

- **FR-010**: The queue-item API response MUST expose moved fields as first-class fields (`storageTempPath`, `originalFilename`, `reviewState` including `fieldResolutions`/`fieldAcknowledgments`) and MUST NOT merge them back into `details`; `details` in the response contains AI extraction output plus whitelisted residual ingestion keys that have no dedicated column (`original_row_index`, `unresolved_orgs`, `original_document_number`, `revision_number`) and the transient `attachments[]` enrichment injected at serialization time.
- **FR-011**: Frontend types (`types/migration.ts`) and review pages/components (`review/[id]/page.tsx`, `compare-result-table.tsx`, review queue table) MUST be updated to read the new fields; the deprecated reads `details.source_file_path` and `details.fieldResolutions` MUST be removed.

**Operational safety (D8)**

- **FR-012**: Bulk operations affecting more than 10 rows MUST follow the documented protocol: timestamped backup table → preflight JSON inspection → single-record canary → verification → bulk run → logged scope and row count → defined rollback path.

**Migration restart**

- **FR-013**: The schema delta MUST add `ocr_text_bak`, `review_state_json`, and `imported_correspondence_public_id` columns, MUST truncate `migration_review_queue`, and MUST NOT attempt backfill — re-ingestion from Excel is a separate manual step.

**Legacy AI module path (planning clarify P3)**

- **FR-014**: Both queue write paths MUST honor the separation contract — the native `LegacyIngestionService` path AND the legacy ai-module path (`ai-ingest.service.ts`, `MigrationReviewRecord` entity mapped to `migration_review_queue`, `enqueueRecord`/`processMigrateDocument` flow). The duplicate ai-module entity MUST map the new columns so both paths read/write the same table consistently, and `enqueueRecord` MUST persist `dto.details` (AI output keys such as `compareResult`/`capturedThresholds`) into `ai_metadata_json` rather than dropping it.

### Key Entities

- **MigrationReviewQueue item**: one legacy document pending/undergoing review; owns ingestion columns (`storage_temp_path`, `original_filename`, `temp_attachment_ids`), `ocr_text` + `ocr_text_bak`, `ai_metadata_json` (AI output only), `review_state_json` (human decisions only), status lifecycle, and `imported_correspondence_public_id`.
- **Attachment (staging)**: the temp-uploaded PDF referenced by `temp_attachment_ids`; fallback source of the real file path.
- **Correspondence**: the production document created on import; target of the `imported_correspondence_public_id` audit link.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Re-extraction of any queue item results in zero loss of ingestion metadata, review state, or prior OCR text — verified by automated tests covering each failure mode that caused the incident (missing path, missing PDF, overwrite).
- **SC-002**: 100% of re-extraction runs on items with existing OCR text produce a restorable `ocr_text_bak` snapshot before overwrite.
- **SC-003**: Every imported queue item remains queryable with a direct link to its production Correspondence — 0 auto-deletions.
- **SC-004**: Review state survives re-extraction byte-identical in 100% of cases (automated test asserts `review_state_json` unchanged while `ai_metadata_json` changes).
- **SC-005**: The incident sequence of 2026-09-14 (bulk reset → lost path → placeholder overwrite → unrecoverable text) is reproducible in tests and demonstrably blocked at ≥3 independent points (column-separated path, attachment fallback, `ocr_text_bak` snapshot).

## Assumptions

- Migration restarts from scratch: `migration_review_queue` is truncated (37 sandbox/test rows intentionally discarded per ADR-054 note — pre-go-live data, no backup needed); no backward compatibility is required.
- `attachments.ocr_text` needs no backup column — code inspection confirmed no overwrite path exists today (`importCorrespondence` always creates new attachments; `processRagPrepare` is write-once/reuse). A future "re-OCR production documents" capability is a separate ADR.
- D8 protocol is a documented operational convention, not code-enforced.
- `original_filename` and `storage_temp_path` columns already exist in the schema (verified in `lcbp3-v1.9.0-schema-02-tables.sql`) — the delta adds only the 3 new columns; existing columns need entity mapping + writes only.

## Out of Scope

- Re-OCR of already-imported production documents (net-new capability — separate ADR, see ADR-055 draft).
- Changes to `ai_issues` column semantics.
- Automated enforcement of the D8 bulk-operation protocol.
