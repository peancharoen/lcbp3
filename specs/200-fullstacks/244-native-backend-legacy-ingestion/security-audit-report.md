# 🔒 Security Audit Report

**Date**: 2026-08-20
**Scope**: Backend + Frontend (focus on Feature 244 — Native Backend Legacy Ingestion)
**Auditor**: Antigravity Security Sentinel

---

## Summary

| Severity    | Count |
| ----------- | ----- |
| 🔴 Critical | 2     |
| 🟠 High     | 4     |
| 🟡 Medium   | 5     |
| 🟢 Low      | 3     |
| **Total**   | **14** |

---

## Findings

### [SEV-001] Missing File Type Validation on Migration Excel Upload — 🔴 Critical

**Category**: OWASP A08 (Software & Data Integrity Failures) / ADR-016 File Upload Security
**File**: `backend/src/modules/migration/migration.controller.ts:364-376`
**Description**: The `POST /api/migration/ingest/upload` endpoint uses `@UseInterceptors(FileInterceptor('file'))` with **no `ParseFilePipe`, no `MaxFileSizeValidator`, and no `FileTypeValidator`**. Any file type can be uploaded (including `.exe`, `.sh`, `.php`), and there is no size limit. The endpoint description says "Excel (.xlsx)" but nothing enforces it.

**Impact**: An attacker with `migration.import` permission could upload a malicious executable or script disguised as an Excel file. The uploaded file path is then passed to `startIngestion`, which reads it — potentially causing arbitrary file read or denial of service via huge files.

**Recommendation**: Add `ParseFilePipe` with validators matching the `file-storage.controller.ts:37-46` pattern:

```typescript
// Before (vulnerable)
@UseInterceptors(FileInterceptor('file'))
uploadExcelFile(@UploadedFile() file: MulterFile) {
  if (!file) { throw new ValidationException('...'); }
  return { ... };
}

// After (fixed)
@UseInterceptors(
  FileInterceptor('file', {
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
    fileFilter: (req, file, cb) => {
      const allowed = [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel',
      ];
      if (!allowed.includes(file.mimetype)) {
        return cb(new BadRequestException('Only .xlsx files are allowed'), false);
      }
      cb(null, true);
    },
  })
)
uploadExcelFile(
  @UploadedFile(
    new ParseFilePipe({
      validators: [
        new MaxFileSizeValidator({ maxSize: 50 * 1024 * 1024 }),
        new FileTypeValidator({
          fileType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        }),
      ],
    })
  )
  file: MulterFile,
) {
  return { ... };
}
```

---

### [SEV-002] ClamAV Not Integrated — File Upload Security Gap — 🔴 Critical

**Category**: ADR-016 (Two-Phase Storage + ClamAV) / OWASP A08
**File**: Entire backend — no ClamAV service found
**Description**: ADR-016 mandates **Two-Phase Storage** (upload to temp → ClamAV scan → move to permanent). However:
- No ClamAV service exists in `backend/src/`
- No `docker-compose*.yml` defines a ClamAV container
- No virus scanning code in `file-storage.service.ts` or `migration.controller.ts`
- The `file-storage.controller.ts:33-52` upload endpoint writes directly to storage without scanning

**Impact**: Malicious files (malware, viruses) can be uploaded and stored in the DMS, potentially infecting other users who download them. This is a direct violation of ADR-016 Tier 1 non-negotiable rules.

**Recommendation**:
1. Add ClamAV container to `docker-compose.yml`:
```yaml
clamav:
  image: clamav/clamav:latest
  restart: unless-stopped
  volumes:
    - clamav-data:/var/lib/clamav
```
2. Create `ClamAVService` in `backend/src/common/clamav/`:
```typescript
@Injectable()
export class ClamAVService {
  async scanFile(filePath: string): Promise<{ isInfected: boolean; viruses?: string[] }> {
    // Use clamscan or @nestjs-clamscan package
  }
}
```
3. Call `clamAVService.scanFile()` in `FileStorageService.upload()` before moving from temp to permanent storage
4. Reject infected files with `BadRequestException`

---

### [SEV-003] Missing Idempotency on `POST /migration/queue` (enqueueRecord) — 🟠 High

**Category**: OWASP A04 (Insecure Design) / ADR-016 (Idempotency)
**File**: `backend/src/modules/migration/migration.controller.ts:156-164`
**Description**: The `POST /api/migration/queue` endpoint (enqueueRecord) is a **state-mutating POST** that inserts/updates records in `migration_review_queue`, but it does **not** require an `Idempotency-Key` header. Duplicate POSTs will upsert the same record, potentially overwriting review state.

**Impact**: Network retries or double-clicks can cause duplicate enqueues, overwriting `reviewedBy`, `reviewedAt`, and `status` fields on already-reviewed items.

**Recommendation**: Add `Idempotency-Key` validation:
```typescript
@Post('queue')
@UseGuards(JwtAuthGuard, RbacGuard)
@RequirePermission('migration.enqueue')
@ApiHeader({ name: 'Idempotency-Key', required: true })
async enqueueRecord(
  @Body() dto: EnqueueMigrationDto,
  @Headers('idempotency-key') idempotencyKey: string | undefined,
) {
  requireIdempotencyKey(idempotencyKey);
  return this.migrationService.enqueueRecord(dto, idempotencyKey);
}
```

---

### [SEV-004] Missing Idempotency on `POST /migration/errors` (createError) — 🟠 High

**Category**: OWASP A04 (Insecure Design) / ADR-016 (Idempotency)
**File**: `backend/src/modules/migration/migration.controller.ts:185-191`
**Description**: The `POST /api/migration/errors` endpoint logs errors to `migration_errors` table but does **not** require `Idempotency-Key`. Duplicate error logs from n8n retries will create duplicate rows, polluting the error log.

**Impact**: Error log pollution, making it difficult to distinguish unique errors from retry duplicates.

**Recommendation**: Add `Idempotency-Key` validation (same pattern as SEV-003).

---

### [SEV-005] Missing File Validation on `POST /ai/legacy-migration/ingest` — 🟠 High

**Category**: OWASP A08 / ADR-016 File Upload Security
**File**: `backend/src/modules/ai/ai.controller.ts:1044-1060`
**Description**: The `POST /api/ai/legacy-migration/ingest` endpoint uses `FilesInterceptor('files', 25)` with **no `ParseFilePipe`, no file type validation, and no size limit**. Up to 25 files of any type and any size can be uploaded.

**Impact**: An attacker with a service account token could upload malicious files or cause disk exhaustion via unlimited file sizes.

**Recommendation**: Add `ParseFilePipe` with `MaxFileSizeValidator` and `FileTypeValidator` for PDF files:
```typescript
@UploadedFiles(
  new ParseFilePipe({
    validators: [
      new MaxFileSizeValidator({ maxSize: 50 * 1024 * 1024 }),
      new FileTypeValidator({ fileType: 'pdf' }),
    ],
  })
)
files: Express.Multer.File[],
```

---

### [SEV-006] Unprotected `NumberingMetricsController` — 🟠 High

**Category**: OWASP A01 (Broken Access Control)
**File**: `backend/src/modules/document-numbering/controllers/numbering-metrics.controller.ts:6-24`
**Description**: The `NumberingMetricsController` at `/admin/document-numbering/metrics` has its guards **commented out**:
```typescript
@Controller('admin/document-numbering/metrics')
// @UseGuards(PermissionGuard)  ← COMMENTED OUT
export class NumberingMetricsController {
  @Get()
  // @Permissions('system.view_logs')  ← COMMENTED OUT
  getMetrics() { ... }
}
```

**Impact**: Any authenticated user (or potentially unauthenticated user if no global guard) can access admin metrics endpoint. While the current implementation returns a placeholder, this is a broken access control violation.

**Recommendation**: Uncomment and update to project guard pattern:
```typescript
@Controller('admin/document-numbering/metrics')
@UseGuards(JwtAuthGuard, RbacGuard)
export class NumberingMetricsController {
  @Get()
  @RequirePermission('system.view_logs')
  getMetrics() { ... }
}
```

---

### [SEV-007] XSS via `dangerouslySetInnerHTML` in Search Results — 🟡 Medium

**Category**: OWASP A03 (Injection — XSS)
**File**: `frontend/components/search/results.tsx:97`
**Description**: Search results render `result.highlight` (which contains HTML `<em>` tags from Elasticsearch highlighting) via `dangerouslySetInnerHTML` **without sanitization**. If the search backend or an attacker can inject `<script>` tags into the indexed content, it will execute in the user's browser.

**Impact**: Stored XSS — if a document title or content contains `<script>` tags, they will execute when displayed in search results.

**Recommendation**: Sanitize the HTML before rendering:
```typescript
import DOMPurify from 'dompurify';

// In component
dangerouslySetInnerHTML={{
  __html: DOMPurify.sanitize(result.highlight || result.title, {
    ALLOWED_TAGS: ['em', 'strong'],
    ALLOWED_ATTR: [],
  })
}}
```

---

### [SEV-008] bcrypt Default Salt Rounds (10) — ADR-016 Requires 12+ — 🟡 Medium

**Category**: OWASP A02 (Cryptographic Failures) / ADR-016
**File**: `backend/src/common/auth/auth.service.ts:163`, `backend/src/modules/user/user.service.ts:34,190`, `backend/src/database/seeds/user.seed.ts:99`
**Description**: All `bcrypt.genSalt()` calls use the **default 10 rounds**. ADR-016 (and `.windsurfrules` §Security) explicitly requires **12 salt rounds**.

**Impact**: Weaker password hashing — GPUs can crack 10-round bcrypt faster than 12-round.

**Recommendation**: Replace all `bcrypt.genSalt()` with `bcrypt.genSalt(12)`:
```typescript
// Before
const salt = await bcrypt.genSalt();
// After
const salt = await bcrypt.genSalt(12); // ADR-016: 12 salt rounds
```

---

### [SEV-009] `resolveBatch` Endpoint Missing User Context for Audit — 🟡 Medium

**Category**: OWASP A09 (Logging Failures) / NFR-005 (Audit Trail)
**File**: `backend/src/modules/migration/migration.controller.ts:284-290`
**Description**: The `POST /api/migration/resolve-batch` endpoint validates `Idempotency-Key` but does **not** extract `@CurrentUser()` or pass `userId` to the service. This means the batch resolution action is **not attributed to any user** in the audit trail.

**Impact**: Cannot determine which admin performed a batch resolution — violates NFR-005 audit trail requirement.

**Recommendation**: Add `@CurrentUser()` and pass to service:
```typescript
async resolveBatch(
  @Body() dto: ResolveBatchDto,
  @Headers('idempotency-key') idempotencyKey: string | undefined,
  @CurrentUser() user: User,
) {
  requireIdempotencyKey(idempotencyKey);
  const userId = requireUserId(user);
  return this.metadataResolutionService.resolveBatch(dto.batchId, userId);
}
```

---

### [SEV-010] `triggerRagBatch` Endpoint Missing User Context for Audit — 🟡 Medium

**Category**: OWASP A09 (Logging Failures) / NFR-005 (Audit Trail)
**File**: `backend/src/modules/migration/migration.controller.ts:348-354`
**Description**: Same as SEV-009 — `triggerRagBatch` validates `Idempotency-Key` but does not extract `@CurrentUser()` or pass `userId`. RAG batch trigger is not attributed to any user.

**Impact**: Cannot audit who triggered a RAG batch embedding job.

**Recommendation**: Add `@CurrentUser()` and pass `userId` to `ragBatchService.triggerRagBatch()`.

---

### [SEV-011] Swagger UI Exposed in Production — 🟡 Medium

**Category**: OWASP A05 (Security Misconfiguration)
**File**: `backend/src/main.ts:86-90`
**Description**: Swagger UI is unconditionally set up at `/docs` with `persistAuthorization: true`. There is no environment check to disable it in production.

**Impact**: API documentation exposed to unauthenticated users in production, aiding reconnaissance.

**Recommendation**: Gate Swagger behind environment check:
```typescript
if (configService.get<string>('NODE_ENV') !== 'production') {
  SwaggerModule.setup('docs', app, document, { ... });
}
```

---

### [SEV-012] `getStagingFile` Endpoint Lacks File Existence Check — 🟢 Low

**Category**: OWASP A05 (Security Misconfiguration)
**File**: `backend/src/modules/migration/migration.controller.ts:261-268`
**Description**: `getStagingFile` streams a file from the staging directory but does not check `fs.existsSync` before creating the stream. If the file doesn't exist, the error handling depends on the stream implementation.

**Impact**: Unhandled stream errors could leak server path information.

**Recommendation**: Add existence check in `getStagingFileStream()`:
```typescript
if (!existsSync(resolvedPath)) {
  throw new NotFoundException('Staging file', filePath);
}
```

---

### [SEV-013] Health Endpoint Exposes Internal State — 🟢 Low

**Category**: OWASP A09 (Logging Failures) / Information Disclosure
**File**: `backend/src/modules/monitoring/controllers/health.controller.ts:27-42`
**Description**: The `/health` endpoint is excluded from the global API prefix and has **no authentication guard**. It exposes database connectivity, memory usage, and disk usage to anyone who can reach the server.

**Impact**: Information disclosure — attackers can probe infrastructure health without authentication.

**Recommendation**: Either:
- Add `JwtAuthGuard` with a service account token for monitoring, or
- Restrict access via Nginx/IP allowlist, or
- Return only `{ status: 'ok' }` without infrastructure details to unauthenticated requests

---

### [SEV-014] Default Password in Seed Data — 🟢 Low

**Category**: OWASP A07 (Identification and Authentication Failures)
**File**: `backend/src/database/seeds/user.seed.ts:100`
**Description**: The seed script creates users with a hardcoded default password `'Center2025'`. While this is a seed script (not production code), if run in production without changing passwords, it creates a known-credential vulnerability.

**Impact**: If seed users are not forced to change passwords on first login, attackers can log in with known credentials.

**Recommendation**: Either:
- Generate random passwords for seed users and log them once, or
- Add `mustChangePassword: true` flag and enforce password change on first login

---

## CASL Coverage Matrix

| Module | Controller | JwtAuthGuard? | RbacGuard? | @RequirePermission? | Idempotency? | Status |
|--------|-----------|---------------|------------|---------------------|--------------|--------|
| migration | MigrationController | ✅ (all) | ✅ (all) | ✅ (all) | ⚠️ 4 missing | See SEV-003,004 |
| migration | MigrationReviewController | ✅ | ✅ (PermissionsGuard) | ✅ | ✅ | ✅ Pass |
| ai | AiController | ✅ (all) | ✅ (most) | ✅ (most) | ⚠️ Some missing | ⚠️ Review |
| ai | AiPromptsController | ✅ | ✅ | ✅ | ✅ | ✅ Pass |
| ai | IntentAdmin | ✅ | ✅ | ✅ | ⚠️ Missing | ⚠️ Review |
| ai | IntentClassify | ✅ | ❌ | ❌ | ❌ | ⚠️ Review |
| document-numbering | NumberingMetrics | ❌ | ❌ | ❌ | ❌ | 🔴 SEV-006 |
| document-numbering | DocumentNumbering | ✅ | ✅ | ✅ | ✅ | ✅ Pass |
| document-numbering | NumberingAdmin | ✅ | ✅ | ✅ | ✅ | ✅ Pass |
| correspondence | Correspondence | ✅ | ✅ | ✅ | ✅ | ✅ Pass |
| workflow-engine | WorkflowEngine | ✅ | ✅ | ✅ | ✅ | ✅ Pass |
| user | User | ✅ | ✅ | ✅ | ✅ | ✅ Pass |
| file-storage | FileStorage | ✅ | ✅ | ✅ | N/A (upload) | ⚠️ SEV-002 |
| monitoring | Health | ❌ | ❌ | ❌ | N/A | 🟢 SEV-013 |
| monitoring | Monitoring | ✅ | ✅ | ✅ | N/A | ✅ Pass |

### Migration Module Idempotency Detail

| Endpoint | Method | Idempotency-Key? | Status |
|----------|--------|-------------------|--------|
| `/migration/import` | POST | ✅ | Pass |
| `/migration/commit_batch` | POST | ✅ | Pass |
| `/migration/queue` | POST | ❌ | 🔴 SEV-003 |
| `/migration/errors` | POST | ❌ | 🔴 SEV-004 |
| `/migration/queue/:publicId/approve` | POST | ✅ | Pass |
| `/migration/queue/:publicId/reject` | POST | ✅ | Pass |
| `/migration/resolve-batch` | POST | ✅ | Pass (but SEV-009) |
| `/migration/review-thresholds` | PATCH | ✅ | Pass |
| `/migration/trigger-rag-batch` | POST | ✅ | Pass (but SEV-010) |
| `/migration/ingest/upload` | POST | N/A (upload) | 🔴 SEV-001 |
| `/migration/ingest/start` | POST | ✅ | Pass |
| `/migration/queue/:publicId/ocr` | PATCH | ✅ | Pass |
| `/ai/migration/review` | POST | ✅ | Pass |

---

## LCBP3-DMS-Specific Checks

| Check | Status | Notes |
|-------|--------|-------|
| ADR-019 (UUID in API) | ✅ Pass | All `:publicId` routes use `ParseUUIDPipe`; DTOs use `@IsUUID('7')`; no `parseInt` on UUIDs |
| ADR-016 (Idempotency) | ⚠️ Partial | 2 mutation endpoints missing (SEV-003, SEV-004) |
| ADR-016 (ClamAV) | ❌ Fail | No ClamAV integration anywhere (SEV-002) |
| ADR-016 (bcrypt 12) | ❌ Fail | All bcrypt uses default 10 rounds (SEV-008) |
| ADR-016 (Two-Phase Upload) | ⚠️ Partial | file-storage has temp→commit pattern but no scan step |
| ADR-002 (Redlock) | ✅ Pass | WorkflowEngineService uses Redlock with fail-closed |
| ADR-002 (VersionColumn) | ✅ Pass | 4 entities use `@VersionColumn` |
| ADR-023 (AI Boundary) | ✅ Pass | AI via BullMQ only; no direct DB access from Ollama |
| ADR-023A (Qdrant filter) | ✅ Pass | `triggerEmbeddingForQueueItem` includes `projectPublicId` |
| ADR-007 (Error Handling) | ✅ Pass | Custom exceptions with Thai userMessage; Logger for technical details |
| ADR-008 (BullMQ) | ✅ Pass | AI enrichment via `ai-batch` queue; concurrency=1 |
| Helmet.js | ✅ Pass | Configured in `main.ts:22-34` |
| CORS | ✅ Pass | Env-driven origin, credentials enabled |
| ValidationPipe | ✅ Pass | `whitelist: true`, `forbidNonWhitelisted: true` |
| ThrottlerGuard | ✅ Pass | Global guard; login throttled at 5/min |
| JWT Config | ✅ Pass | Env-validated, min 32 chars secret, 15m expiry |
| Zero `any` | ✅ Pass | No `any` types in migration module |
| Zero `console.log` | ✅ Pass | No `console.log` in migration module |
| `.env` in git | ✅ Pass | `frontend/.env` is gitignored |
| Path Traversal | ✅ Pass | `getStagingFileStream` has proper guard |

---

## Recommendations Priority

### 🔴 Critical — Fix Immediately

1. **SEV-001**: Add `ParseFilePipe` with `MaxFileSizeValidator` + `FileTypeValidator` to `POST /migration/ingest/upload`
2. **SEV-002**: Integrate ClamAV service for all file upload endpoints (ADR-016 mandatory)

### 🟠 High — Fix Before Next Release

3. **SEV-003**: Add `Idempotency-Key` to `POST /migration/queue` (enqueueRecord)
4. **SEV-004**: Add `Idempotency-Key` to `POST /migration/errors` (createError)
5. **SEV-005**: Add file validation to `POST /ai/legacy-migration/ingest`
6. **SEV-006**: Enable guards on `NumberingMetricsController`

### 🟡 Medium — Plan in Sprint

7. **SEV-007**: Sanitize `dangerouslySetInnerHTML` with DOMPurify in search results
8. **SEV-008**: Upgrade bcrypt to 12 salt rounds (ADR-016 compliance)
9. **SEV-009**: Add `@CurrentUser()` to `resolveBatch` for audit trail
10. **SEV-010**: Add `@CurrentUser()` to `triggerRagBatch` for audit trail
11. **SEV-011**: Gate Swagger UI behind non-production environment check

### 🟢 Low — Track in Backlog

12. **SEV-012**: Add `fs.existsSync` check in `getStagingFileStream`
13. **SEV-013**: Protect or restrict `/health` endpoint
14. **SEV-014**: Enforce password change for seed users

---

## Positive Findings

- ✅ **Path traversal protection** on `getStagingFileStream` is properly implemented with `path.resolve` + prefix check
- ✅ **JWT configuration** is solid — env-validated, min 32 chars, 15m access token expiry, refresh token strategy
- ✅ **ThrottlerGuard** is globally applied with per-endpoint overrides for auth (5/min) and AI endpoints
- ✅ **Redlock** with fail-closed pattern (3 retries → 503) in WorkflowEngineService
- ✅ **Optimistic locking** via `@VersionColumn` on 4 entities
- ✅ **ADR-019 compliance** — all API boundaries use UUIDv7, `ParseUUIDPipe` on routes, no `parseInt` on UUIDs
- ✅ **ADR-023A compliance** — Qdrant embedding includes `projectPublicId` filter
- ✅ **Zero `any` types and zero `console.log`** in the migration module
- ✅ **SQL injection prevention** — all raw queries use parameterized placeholders (`?`)
- ✅ **Helmet.js + CORS** properly configured
- ✅ **ValidationPipe** with `whitelist` + `forbidNonWhitelisted` prevents mass assignment
- ✅ **`.env` files** are gitignored, not committed
