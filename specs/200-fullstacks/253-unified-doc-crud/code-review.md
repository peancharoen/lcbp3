# Code Review Report — Feature 253: Unified Document CRUD Management

**Date**: 2026-09-07T07:30:00Z
**Reviewer**: Antigravity Code Reviewer (automated)
**Scope**: `git diff 581c52b2..HEAD` — 148 files, +14,821 / −2,973 lines (Feature 253 T001–T120 + security fix commit)
**Overall**: ✅ **APPROVE** — no CRITICAL/HIGH merge blockers; 4 MEDIUM + 5 LOW + 3 SUGGESTION items for follow-up

---

## Summary

| Severity       | Count |
| -------------- | ----- |
| 🔴 CRITICAL    | 0     |
| 🟠 HIGH        | 0     |
| 🟡 MEDIUM      | 4     |
| 🟢 LOW         | 5     |
| 💡 SUGGESTION  | 3     |

---

## Findings

### 🟡 MEDIUM: Path traversal risk in Orphan Cleanup purge

**File**: `backend/src/modules/maintenance/services/orphan-cleanup.service.ts:79-82`
**Code**:
```typescript
for (const p of paths) {
  if (await fs.pathExists(p)) {
    await fs.remove(p);
```

**Issue**: `purgeOrphans(paths)` accepts arbitrary filesystem paths and deletes them with no validation that the path is inside the storage root (`permanentDir` / `tempDir`). An admin with `system.orphan_cleanup` permission could pass `paths: ["/etc/passwd", "/opt/np-dms-lcbp3/.env"]` and delete files outside storage.

**Mitigating factors**: The endpoint requires `system.orphan_cleanup` CASL permission (admin-only), and `scanOrphans()` only returns paths within storage dirs. However, the `purgeOrphans` endpoint accepts any `paths` array — it does not verify that paths came from a prior scan.

**Fix**: Validate each path resolves within `permanentDir` or `tempDir` before deleting:
```typescript
const allowedRoots = [this.fileStorageService.permanentDir, this.fileStorageService.tempDir];
for (const p of paths) {
  const resolved = path.resolve(p);
  const isAllowed = allowedRoots.some(root => resolved.startsWith(path.resolve(root) + path.sep));
  if (!isAllowed) {
    failed.push(`${p}: path outside storage root`);
    continue;
  }
  // ... delete
}
```

---

### 🟡 MEDIUM: Maintenance controller `@Body()` params lack DTO validation

**File**: `backend/src/modules/maintenance/maintenance.controller.ts:58,69,93,113,142,153`
**Code**:
```typescript
@Body('projectId') projectId: string | undefined,        // line 58
@Body() dto: { counterKey: string; newLastNumber: number }, // line 69 — inline type, no class
@Body('paths') paths: string[],                           // line 93
@Body() dto: { projectPublicId: string; documentPublicId: string }, // line 113
@Body('lockKeys') lockKeys: string[],                     // line 142
@Body() dto: { publicIds: string[]; documentType: ... },  // line 153
```

**Issue**: These endpoints use inline object types or `@Body('field')` extraction instead of class-validator DTOs. The global `ValidationPipe` with `whitelist: true` + `forbidNonWhitelisted: true` only works on DTO class instances — plain `@Body('field')` extraction bypasses validation entirely. This means:
- `paths` and `lockKeys` arrays have no `@ArrayMaxSize` limit
- `publicIds` has no `@IsUUID('7', { each: true })` validation
- `counterKey` has no `@IsString()` / length validation
- `newLastNumber` has no `@IsInt()` / `@Min(0)` validation

**Fix**: Create proper DTO classes in `maintenance/dto/` with class-validator decorators (matching the pattern used by `BulkCancelRequestDto`, `BulkTagRequestDto`, etc.):
```typescript
// maintenance/dto/purge-orphans.dto.ts
export class PurgeOrphansDto {
  @IsArray() @ArrayMaxSize(500) @IsString({ each: true })
  paths!: string[];
}
```

---

### 🟡 MEDIUM: In-memory `bulkStore` Map has no TTL or eviction

**File**: `backend/src/modules/document/document.service.ts:45`
**Code**:
```typescript
private readonly bulkStore = new Map<string, BulkOperationStatus>();
```

**Issue**: Completed bulk operations are never removed from the Map. In a long-running production process, this is a slow memory leak — each bulk operation adds an entry with `result.buffer` (potentially large CSV data) that is never freed.

**Fix**: Add a TTL-based cleanup. Either:
- Use a `setTimeout` to delete the entry after e.g. 5 minutes post-completion, or
- Use a bounded LRU cache, or
- Store progress in Redis with TTL instead of in-process memory (preferred for multi-instance deployments)

---

### 🟡 MEDIUM: Frontend bulk polling has no cleanup on unmount

**File**: `frontend/hooks/use-bulk-actions.ts:58`
**Code**:
```typescript
setTimeout(check, 2000);
```

**Issue**: The `pollProgress` function uses recursive `setTimeout` with no cancellation. If the component unmounts while polling is active, `setActiveBulkId(null)` and `onComplete?.()` will be called on an unmounted component (React warning + potential state corruption). The `activeBulkId` state setter will fire after unmount.

**Fix**: Track the timeout ID and clear it on unmount:
```typescript
const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
// In check: timeoutRef.current = setTimeout(check, 2000);
// In useEffect cleanup: if (timeoutRef.current) clearTimeout(timeoutRef.current);
```

---

### 🟢 LOW: `Number(tagId)` conversion in bulkTag — tag IDs are numeric, not UUIDs

**File**: `backend/src/modules/document/document.service.ts:97,100`
**Code**:
```typescript
await this.correspondenceService.addTag(id, Number(tagId));
await this.correspondenceService.removeTag(id, Number(tagId));
```

**Issue**: `BulkTagRequestDto.addTags` is typed as `string[]` with `@IsString({ each: true })`, but the service converts each to `Number()`. This is not a UUID violation (tag IDs are integer FKs, not UUIDs), but the DTO/service contract is inconsistent — the DTO should either use `number[]` with `@IsInt({ each: true })` or the service should resolve tag publicIds.

**Fix**: Either change the DTO to `@IsInt({ each: true }) number[]` with `@Type(() => Number)`, or resolve tag UUIDs via `uuidResolver` if tags have public IDs.

---

### 🟢 LOW: `idempotencyKey` parameter typed as `string` but can be `undefined`

**File**: `backend/src/modules/document/document.controller.ts:63,85,107`
**File**: `backend/src/modules/maintenance/maintenance.controller.ts:59,71,95,114,143,158`
**Code**:
```typescript
@Headers('Idempotency-Key') idempotencyKey: string
```

**Issue**: When the header is absent, NestJS passes `undefined`, but the parameter is typed as `string`. The `assertIdempotencyKey(key?: string)` helper correctly accepts `undefined`, but the controller signature is misleading. TypeScript won't catch a missing-null-check if someone removes the assert call.

**Fix**: Type as `idempotencyKey?: string` in all controller methods.

---

### 🟢 LOW: `auditId: ''` placeholder in unified cancel/metadata responses

**File**: `backend/src/modules/correspondence/correspondence.controller.ts:339,384`
**File**: `backend/src/common/services/document-hard-delete.service.ts:120`
**Code**:
```typescript
auditId: '', // TODO: T044 — create audit log entry
```

**Issue**: The `DocumentActionResponseDto` returns an empty string for `auditId`. The `@Audit()` decorator logs the action, but the response doesn't include the audit trail ID. Frontend consumers can't reference the audit entry.

**Fix**: Wire the `@Audit()` interceptor to inject the audit ID into the response, or document that `auditId` is optional/empty in the current phase.

---

### 🟢 LOW: Frontend maintenance service uses `Date.now()` for Idempotency-Key

**File**: `frontend/lib/services/maintenance.service.ts:44,56,70,86,99,111`
**Code**:
```typescript
{ headers: { 'Idempotency-Key': `sync-${Date.now()}` } }
```

**Issue**: `Date.now()` is not a true idempotency key — two rapid clicks within the same millisecond produce the same key, and separate sessions produce different keys for the same logical operation. The `document-action.service.ts` correctly uses `crypto.randomUUID()`. Maintenance service should follow the same pattern.

**Fix**: Reuse `generateIdempotencyKey()` from `document-action.service.ts` or extract to a shared utility.

---

### 🟢 LOW: `bulkExport` CSV generation ignores `columns` and `user` parameters

**File**: `backend/src/modules/document/document.service.ts:306-327`
**Code**:
```typescript
private generateExportBuffer(
  bulkId: string,
  publicIds: string[],
  documentType: string,
  _format: ExportFormat,
  _columns: string[] | undefined,  // unused
  _user: User,                     // unused
): void {
  const header = ['publicId', 'documentType'];
  // ...
```

**Issue**: The method accepts `columns` and `user` but prefixes them with `_` and ignores them. The export only emits `publicId,documentType` — not the actual document metadata. This is a stub that doesn't fulfill the export contract.

**Fix**: Implement actual metadata fetching per document type, or document this as a known limitation in the ledger and update the API description to "export publicId list only (phase 1)".

---

### 💡 SUGGESTION: `emergencyUnlock.bulkHardPurge` uses `userId: 'system'` — no real user tracking

**File**: `backend/src/modules/maintenance/services/emergency-unlock.service.ts:89`
**Code**:
```typescript
userId: 'system',
```

**Issue**: The bulk hard-purge passes `'system'` as the userId instead of the actual requesting user. The maintenance controller doesn't inject `@CurrentUser()` for this endpoint, so the real user is lost. For an irreversible operation, the audit trail should record who initiated it.

**Fix**: Add `@CurrentUser() user: User` to the `bulkHardPurge` controller method and pass `user.user_id.toString()` to the service.

---

### 💡 SUGGESTION: `document-hard-delete.service.ts` snapshot is TODO

**File**: `backend/src/common/services/document-hard-delete.service.ts:78`
**Code**:
```typescript
// 3. Snapshot document state (audit) — TODO: T038-T045 audit implementation
// const snapshot = await this.captureSnapshot(input.publicId, queryRunner);
```

**Issue**: The pre-delete snapshot is commented out. Hard-delete is irreversible — without a snapshot, there's no audit trail of what was deleted. The `@Audit()` decorator on the controller logs the action but doesn't capture the full document state.

**Fix**: Implement `captureSnapshot()` to serialize the document + children to a JSON audit record before deletion.

---

### 💡 SUGGESTION: `use-bulk-actions.ts` polling has no max-retry / timeout

**File**: `frontend/hooks/use-bulk-actions.ts:31-66`

**Issue**: The polling loop runs indefinitely until `completed + failed === total`. If the backend crashes or the bulk operation stalls, the frontend will poll forever (every 2s). There's no maximum poll count or timeout.

**Fix**: Add a max poll count (e.g., 150 attempts = 5 minutes) and surface a timeout error to the user.

---

## Tier 1 Compliance Check

| Rule | Status | Evidence |
|------|--------|----------|
| ADR-019 (UUID) | ✅ PASS | All public API params use `ParseUUIDPipe` / `ParseUuidPipe`. Internal INT `id` resolution in `document-hard-delete.service.ts:186` is service-internal only, never exposed in API responses. `Number(tagId)` is on tag FKs, not UUIDs. |
| ADR-007 (Errors) | ✅ PASS | New code uses `ValidationException`, `BusinessException`, `NotFoundException` from the custom exception hierarchy. No `throw new Error()` in Feature 253 scope. User-facing messages in Thai with recovery guidance. |
| ADR-016 (Security) | ⚠️ PARTIAL | `Idempotency-Key` enforced on all critical POST endpoints ✅. CASL `@RequirePermission` on all endpoints ✅. **Gap**: orphan-cleanup path traversal (MEDIUM #1) and missing DTO validation (MEDIUM #2). |
| ADR-044 (Schema) | ✅ PASS | No TypeORM migrations. Cascade policies use parameterized SQL queries with `?` placeholders. |
| ADR-008 (BullMQ) | ✅ PASS | `DocumentSideEffectsService` dispatches non-critical effects via BullMQ queue with retry. |
| ADR-023 (AI boundary) | ✅ PASS | No direct AI/Qdrant access in Feature 253 code. Vector deletion delegated to BullMQ side-effects. |
| TS strict (no `any`) | ✅ PASS | Zero `any` in Feature 253 code. The one `as any` in `app.module.ts:92` is pre-existing (dynamic import). |
| TS strict (no `console.log`) | ✅ PASS | All new backend code uses `Logger`. No `console.log` in Feature 253 scope. |
| i18n | ✅ PASS | All user-facing strings use `t()` / `useTranslations()`. Error messages in Thai. |

---

## What's Good

- **Excellent error handling**: Consistent use of the `ValidationException` / `BusinessException` / `NotFoundException` hierarchy with Thai user messages and recovery guidance arrays.
- **Proper optimistic locking**: `MetadataPatchRequestDto` includes `@IsInt() @Min(0) version` and `correspondence.service.patchMetadata` checks the version before applying.
- **Redlock protection**: `DocumentHardDeleteService` acquires a Redis Redlock before hard-delete with proper TTL, retry, and release in `finally`.
- **Transaction discipline**: Hard-delete and force-close both use `QueryRunner` with proper `startTransaction` / `commit` / `rollback` / `release` pattern.
- **Parameterized SQL**: All cascade delete queries use `?` placeholders — no string concatenation in SQL.
- **CASL on every endpoint**: All new controller methods have `@RequirePermission()` decorators.
- **Idempotency enforcement**: All critical POST/DELETE endpoints validate `Idempotency-Key` header.
- **Clean DTOs**: `BulkCancelRequestDto`, `BulkTagRequestDto`, `BulkExportRequestDto`, `MetadataPatchRequestDto` follow class-validator patterns with `@IsUUID('7')`, `@ArrayMaxSize(100)`.
- **Side-effects architecture**: Clean separation of critical (in-transaction) vs non-critical (BullMQ post-commit) side effects with proper error handling.
- **Frontend i18n**: All UI text uses translation keys, no hardcoded strings.
- **Test coverage**: 3572 tests passing (2570 backend + 1002 frontend), 0 failures.

---

## Recommended Actions

1. **Should address before next release** (MEDIUM):
   - Add path traversal validation to `OrphanCleanupService.purgeOrphans()`
   - Create DTOs for maintenance controller `@Body()` params
   - Add TTL/eviction to `DocumentService.bulkStore`
   - Add cleanup/timeout to `use-bulk-actions.ts` polling

2. **Consider for later** (LOW):
   - Fix `Number(tagId)` DTO/service contract mismatch
   - Type `idempotencyKey` as `string | undefined` in controller signatures
   - Wire `auditId` into response or document as known limitation
   - Use `crypto.randomUUID()` for maintenance service idempotency keys
   - Implement real CSV export with metadata columns

3. **Tech debt** (SUGGESTION):
   - Pass real user ID to `bulkHardPurge` instead of `'system'`
   - Implement pre-delete snapshot in hard-delete service
   - Add max-retry/timeout to frontend bulk polling
