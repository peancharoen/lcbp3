// File: specs/200-fullstacks/256-queue-metadata-separation/contracts/queue-item-api.md
// Change Log:
// - 2026-09-14: API contract deltas for ADR-054
// - 2026-09-14: Sync with code trace — fix restore route (`/migration/queue/...` not `/review-queue/`), guards
//   (`JwtAuthGuard` + `RbacGuard` + `@RequirePermission('migration.commit')`), reviewState adds fieldAcknowledgments,
//   details keeps residual ingestion keys + transient attachments

# API Contracts: Queue Item Response + OCR Restore

## 1. Queue item response shape (GET detail / list items)

Fields promoted to first-class response fields (ADR-054 + clarify Q1):

```typescript
interface MigrationReviewQueueItem {
  // ... unchanged fields ...

  /** NEW — ingestion metadata (was details.source_file_path) */
  storageTempPath?: string | null;
  originalFilename?: string | null;

  /** NEW — OCR backup (D5) */
  ocrTextBak?: string | null;   // list endpoint MAY omit for payload size; detail endpoint MUST include presence flag

  /** NEW — review state (D9) — human decisions only */
  reviewState?: {
    fieldResolutions?: MigrationFieldResolutionState;
    fieldAcknowledgments?: string[];  // AcknowledgeableField values
  } | null;

  /** NEW — audit link (D10) */
  importedCorrespondencePublicId?: string | null;

  /** CHANGED — AI output (ocrQuality, metadata.*, aiFailureReason, compareResult, capturedThresholds)
   *  + whitelisted residual ingestion keys with no dedicated column
   *    (original_row_index, unresolved_orgs, original_document_number, revision_number)
   *  + transient `attachments[]` injected by enrichWithAttachments at serialization */
  details?: MigrationAiExtractionDetails | null;
}
```

Removed from `details` response payload (now sourced elsewhere):

- `details.source_file_path` → use `storageTempPath`
- `details.original_filename` → use `originalFilename`
- `details.fieldResolutions` → use `reviewState.fieldResolutions`

## 2. Restore OCR text (new endpoint)

```http
POST /api/v1/migration/queue/:publicId/restore-ocr-text
Idempotency-Key: <uuid>
```

**Guards**: `JwtAuthGuard` + `RbacGuard` + `@RequirePermission('migration.commit')` — same pattern as the existing `PATCH /migration/queue/:publicId/ocr` endpoint.

**Preconditions**: queue item exists; `ocr_text_bak` non-empty.

**Behavior**: `ocr_text := ocr_text_bak`; `ocr_text_bak` retained (restore is non-destructive); logs actor + queue publicId.

**Responses**:

| Status | Body | When |
|--------|------|------|
| 200 | `{ publicId, ocrTextLength, restored: true }` | restored |
| 400 | BusinessException `MIGRATION_NO_BACKUP` | `ocr_text_bak` empty/null |
| 404 | `MIGRATION_QUEUE_NOT_FOUND` | unknown publicId |
| 401/403 | standard | auth/RBAC |

**Idempotency**: restoring twice yields identical state (same `ocr_text`) — safe to retry.

## 3. Frontend consumption changes

| Old read | New read |
|----------|----------|
| `item.details?.source_file_path` | `item.storageTempPath` |
| `item.details?.fieldResolutions` | `item.reviewState?.fieldResolutions` |
| — | `item.ocrTextBak` presence → show "Restore OCR" action |

## 4. Unchanged contracts

- Commit review DTO keeps accepting `fieldResolutions` and `fieldAcknowledgments` in the request body (`commit-migration-review.dto.ts`) — the service now persists them to `review_state_json` (they were previously only written to the revision audit trail, never to the queue item); request shape unchanged so the commit flow needs no frontend change for writes.
- Re-extract endpoint (`POST .../re-extract`) request/response unchanged.
- `deleteReviewQueueByBatch` unchanged.
