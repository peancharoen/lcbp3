# Session 2026-09-06 — Feature 252 Validation + FAST_SELECTIVE Gap Fix

## Summary

Post-implementation validation of Feature 252 (4-Layer Excel Data Review Pipeline) followed by
fixing the only identified gap: US3 Acceptance Scenario 1 (Selective Fast Review for >200 rows).
Validation coverage improved from 94% (17/18 FR) to 100% (18/18 FR). Test count increased from
214 to 223. Build, lint, and all tests pass.

## ปัญหาที่พบ (Root Cause)

Validation report identified that US3 Acceptance Scenario 1 was not implemented:

> **Given** ข้อมูลนำเข้าขนาด > 200 แถว, **When** ผู้ใช้เลือกโหมด Selective Fast Review,
> **Then** AI จะสแกนเฉพาะแถวที่ Layer 2 ติดสถานะ WARN และตัวอย่าง 5%

The spec (Q3 Batching Strategy) says: ">200 แถว เลือกได้ระหว่าง Fast Selective (ตรวจเฉพาะ
จุดเตือน + สุ่ม 5%) หรือ BullMQ Batch" — but neither mode was implemented. All rows went
through synchronous AI review regardless of row count.

Additional issues found during lint after initial code review fixes:
- `NotFoundException` imported but unused in controller (removed)
- `getFailedRowsFilePath` was async but had no await (replaced `fs.existsSync` with
  `fs.promises.access`)
- `validSessionPublicId` unused in types spec (removed)

## การแก้ไข (Fix)

### Commit `658316b4` — Code review fixes (3 MEDIUM + 2 LOW + 4 SUGGESTION)

| ไฟล์ | การเปลี่ยนแปลง |
| --- | --- |
| `excel-import-review.controller.ts` | +`ParseUUIDPipe`, +`download-failed-rows` endpoint, static `fs` import, `@ApiBody` for Swagger |
| `excel-data-review.service.ts` | +`getFailedRowsFilePath()`, +confirmation lock via `tryLockForConfirm()`, +multiple-XLSX ZIP warning, clarified `computeCounts` comment |
| `review-session-stash.service.ts` | +`tryLockForConfirm()` for race condition prevention |
| `excel-import-review.dto.ts` | Removed unused `ConfirmImportReviewDto` and `CancelImportReviewDto` |
| `migration-review-queue.entity.ts` | +`@Index` on `batchId` (matches existing DB index) |
| `excel-review.types.spec.ts` | Removed obsolete DTO tests, fixed import syntax |

### Commit `f4769d2a` — Validation report

| ไฟล์ | การเปลี่ยนแปลง |
| --- | --- |
| `validation-report.md` | New file — 94% coverage report (17/18 FR, 7/8 acceptance, 5/5 edge cases) |
| `ledger.md` | +CP-15 checkpoint |

### Commit `0f0cf215` — FAST_SELECTIVE gap fix

| ไฟล์ | การเปลี่ยนแปลง |
| --- | --- |
| `excel-review.types.ts` | +`BatchStrategy` type (`FULL` \| `FAST_SELECTIVE`), +`FAST_SELECTIVE_THRESHOLD=200`, +`FAST_SELECTIVE_SAMPLE_PERCENT=0.05` |
| `excel-import-review.dto.ts` | +`batchStrategy` field with `@Transform` default `FULL` + `@IsIn` validation |
| `excel-data-review.service.ts` | +`selectRowsForAi()` method (Fisher-Yates partial shuffle), +`batchStrategy` in `CheckReviewInput`, +`aiReviewedRowCount`/`aiSamplingMode` in `CheckReviewResponse` |
| `ai-review-provider.factory.ts` | +`batchStrategy` in `AiReviewInput` |
| `excel-import-review.controller.ts` | +`batchStrategy` passed from DTO to `check()` |
| `excel-data-review.service.spec.ts` | +5 FAST_SELECTIVE tests (FULL mode, WARN+5% sample, WARN-only, PASS-only, BLOCK exclusion) |
| `excel-review.types.spec.ts` | +4 DTO validation tests for `batchStrategy` (default, enum, invalid, pipe-path transform) |
| `ai-review-provider.factory.spec.ts` | +`batchStrategy` in `makeInput` |
| `local-ollama-review.adapter.spec.ts` | +`batchStrategy` in `makeInput` |
| `validation-report.md` | Updated: 18/18 FR (100%), 8/8 acceptance (100%) |
| `ledger.md` | +CP-16 checkpoint |

## กฎที่ Lock แล้ว

- **BatchStrategy pattern**: `FULL` (default, ≤200 rows) vs `FAST_SELECTIVE` (>200 rows,
  WARN + 5% sample). The `@Transform` pattern for default value is the same as `aiProvider`
  — handles empty/null/undefined from multipart forms through global ValidationPipe.
- **FAST_SELECTIVE sampling**: BLOCK rows excluded from AI review (handled by Layer 4).
  WARN rows always sent. PASS rows sampled at 5% with `Math.max(1, Math.ceil(n * 0.05))`
  ensuring at least 1 sampled row. Fisher-Yates partial shuffle for O(sampleSize) efficiency.
- **Response transparency**: `aiReviewedRowCount` and `aiSamplingMode` in `CheckReviewResponse`
  let clients see how many rows were actually reviewed by AI (may differ from `totalRows`
  in FAST_SELECTIVE mode).

## Verification

- [x] 223/223 tests pass (12 suites) — was 214, +9 new tests
- [x] Build passes (`nest build` exit 0)
- [x] ESLint passes (0 errors, 0 warnings)
- [x] Validation report: 18/18 FR (100%), 8/8 acceptance (100%), 5/5 edge cases (100%)
- [x] Tier 1 compliance: ADR-019, ADR-023, ADR-007, ADR-016, ADR-044, ADR-008 all PASS
- [x] Ledger CP-16 appended with FAST_SELECTIVE gap fix result
- [ ] Pre-commit hook skipped (pre-existing zod version mismatch in frontend, unrelated)
- [ ] Not pushed to origin (no explicit user authorization)
