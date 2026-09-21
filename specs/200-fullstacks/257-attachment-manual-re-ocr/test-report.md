# Test Report — Feature 257 / ADR-055 Attachment Manual Re-OCR

**Date**: 2026-09-19T16:30+07:00 (update: post remediation)
**Branch**: `257-attachment-manual-re-ocr`
**Frameworks**: Jest 30.2 + ts-jest 29.4.5 (backend) / Vitest 5 + v8 coverage (frontend)
**Status**: **PASS** — 3,201 backend + 1,184 frontend tests ผ่านทั้งหมด (0 failed);
backend exit 1 เพราะ coverage gate บนไฟล์เก่า (pre-existing debt, ไม่เกี่ยวกับ feature)

## Summary (หลัง remediation)

| Metric | Backend | Frontend |
|---|---|---|
| Test files/suites | 214 passed / 217 (3 skipped) | 169 passed / 169 |
| Tests | **3,201 passed** / 3,219 (18 skipped, **0 failed**) | **1,184 passed** / 1,184 (**0 failed**) |
| Duration | ~48 s | ~90 s |

## Feature-file coverage (ADR-055)

| File | Lines | Branches | Note |
|---|---|---|---|
| `attachment-re-ocr.service.ts` | 97.72% | 82.43% | ผ่าน 80% |
| `attachment-re-ocr.controller.ts` | 100% | 50% | uncovered = preview streaming |
| `re-ocr.constants.ts` / `re-ocr.dto.ts` | 100% | 100% | — |
| `np-dms-ocr-processor.ts` | 97.07% | 71.42% | file-level |
| `use-re-ocr.ts` (frontend) | **~100%** | **~100%** | เพิ่ม unit tests แล้ว (6 tests) |
| `re-ocr.service.ts` (frontend) | **~100%** | — | เพิ่ม unit tests แล้ว (5 tests) |

## Remediation ที่ทำในรอบนี้

### 1. jest.config.js — แก้ config bug 2 จุด
- **ลบ `'./src/modules/*/services/*.spec.ts'` threshold** — spec files ไม่ถูก instrument
  โดย v8 provider → pattern match ไม่ได้ → warning "coverage data not found" หายแล้ว
- **ลบ per-file transform entries ทั้งหมด** (`bullmq-metrics`, `manual-override`,
  `consensus` → `tsconfig.no-metadata.json`) + **ลบ tsconfig.no-metadata.json**
  - **Root cause (verified)**: ts-jest 29.x cache `ConfigSet` ต่อ *jest project config object*
    ไม่ใช่ต่อ transform pattern — transformer ตัวแรกที่ถูกใช้ใน worker "ชนะ" และ tsconfig
    ของมันใช้กับไฟล์ทั้งหมดใน worker นั้น → entries เหล่านี้เป็น dead config หรือ
    contamination แบบ nondeterministic (พิสูจน์ด้วย probe transformer: config ถึง
    createTransformer ถูกต้อง แต่ emitted code ยังมี `__metadata`/`design:paramtypes`)
  - ตั้งแต่แรก entries เหล่านี้ไม่เคยทำงาน — spec ของ bullmq-metrics เขียน test เพื่อ
    cover `__metadata` helper branches แทน (ยังทำงานได้ต่อ)

### 2. เพิ่ม tests ยก coverage ข้าม threshold (4 ไฟล์)
| File | Branches ก่อน | หลัง | Threshold |
|---|---|---|---|
| `audit-log.interceptor.ts` | 81.25% | **94.11%** | 90% ✅ |
| `escalation.service.ts` | 78.37% | **84.61%** | 80% ✅ |
| `task-creation.service.ts` | 78.57% | **85.71%** | 80% ✅ |
| `excel-data-review.service.ts` | 73.43% | **80.80%** | 80% ✅ |

Tests ที่เพิ่มครอบ branch จริง: `attachAuditId` guards (auditId/null/non-object/
no-prop/has-prop), `params['uuid']` fallback, escalation catch-block +
discipline nullish, `members ?? []`, `saved.dueDate ?? dueDate`, processCheck
missing/non-PENDING session, ZIP dir-entry/whitespace-name/multi-xlsx, confirm
lock-race/project-missing/canConfirm-false

### 3. Frontend tests (feature gap)
- `lib/services/__tests__/re-ocr.service.test.ts` — 5 tests (envelope unwrap,
  Idempotency-Key, 404→null, non-404 rethrow)
- `hooks/ai/__tests__/use-re-ocr.test.ts` — 6 tests (status enabled-gate,
  trigger/confirm mutations + cache invalidation keys)

## Threshold failures ที่เหลือ — unfixable ด้วย test

**Constructor-decorator artifacts** — `emitDecoratorMetadata` emit
`typeof X === "function" ? X : Object` ต่อ param ใน `design:paramtypes`; else-branch
ไม่มีทางถูก cover (type เป็น class เสมอ) และ `/* istanbul ignore */` ไม่ทำงานกับ
v8 provider:

| File | Max reachable | Threshold |
|---|---|---|
| `bullmq-metrics.service.ts` | ~59% (16/27 branches เป็น ctor artifacts) | 80% ❌ |
| `notification-trigger.service.ts` | 75% (3/4 เป็น ctor artifacts) | 80% ❌ |
| `consensus.service.ts` | 77.78% (2/9 เป็น ctor artifacts) | 80% ❌ |
| `manual-override.service.ts` | 66.66% | 80% ❌ |

**Pre-existing debt อื่น (ไม่เกี่ยวกับ feature):** ~24 files เช่น
`vector-sync.service.ts` (0% funcs — ไม่มี spec), `emergency-unlock.service.ts`,
`ocr.service.ts` (40% branches), `vector-cleanup.service.ts`, ai/rag services หลายตัว
+ global thresholds (branches 63.58% < 70%, functions 62.1% < 70%)

## Next Actions (เหลือ — ต้อง team decision)

1. **Threshold policy สำหรับ ctor-artifact files** — ทางเลือก:
   (a) ลด `branches` threshold ของ services glob จาก 80 → ~70 (lines/stmts/funcs คง 80)
   (b) ยอมรับ failures เหล่านี้เป็น known-limitation ของ v8+emitDecoratorMetadata
   (c) แยก glob ออก (เช่น monitoring/metrics ไม่ใช่ business logic)
2. **Coverage debt program** สำหรับ ~24 ไฟล์ที่เหลือ (ต้องเขียน tests จริงจัง —
   บางไฟล์ไม่มี spec เลย เช่น `vector-sync`, `emergency-unlock`)
3. Global thresholds (branches/functions 70%) จะผ่านเองเมื่อ debt ลดลง

## Failed Tests

ไม่มี — ทั้ง backend (3,201) และ frontend (1,184) ผ่านหมด

---

## Part 2 — Production File Replace (ADR-055 D17–D22, T041–T056)

**Date:** 2026-09-19 | **Status:** PASS (unit/integration level)

### Results

| | Backend (Jest) | Frontend (Vitest) |
|---|---|---|
| Full sweep | **3,202 pass / 0 fail** (210 suites) | **1,196 pass / 0 fail** (169 files) |
| Feature suites | attachment-re-ocr 61, np-dms-ocr-processor, file-storage 20 | ReOcr* 20, hooks 9, service 7 |
| Build | `nest build` ✅ | `next build` ✅ (53 pages) |
| Lint | `lint:ci` ✅ | eslint `--max-warnings 0` ✅ |
| Typecheck | `tsc --noEmit` ✅ | `tsc --noEmit` ✅ |

### New coverage (replace flow)

- `triggerReplace`: XOR source, staging→`stageFileToTemp` (path-traversal/PDF/magic-bytes guards, copy-only NAS), upload temp validation, identical-checksum 409 (+temp copy discard), link must be current revision, shared mutex/in-flight guard with plain trigger
- `listLinks`: all junction links with `isCurrent`/`isMainDocument` flags
- `confirmReplace`: candidate ocr_text set before `commit()` (ingest sees new text — no duplicate enqueue), junction-swap tx scoped to `correspondenceRevisionId`, **idempotent retry** (affected=0 + already-swapped → success), orphan de-index via RETIRED generations + `enqueueRagGenerationCleanup` (skipped when projectPublicId unresolvable — left to Vector Health Check), `ai_audit_logs` (`attachment-re-ocr:replace`), migration queue `fileReplacements` append, Redis cleanup
- Frontend: link picker (non-current disabled), preselected-link mode (detail page), retry-with-same-candidate, filename-mismatch warning, PDF old/new toggle (default new), dual-permission buttons (RAG console + correspondence detail)

### Known gaps

- Junction-swap tx verified via repository mocks only — no real-DB integration test
- Real-app drill on attachment 977 (shared by revisions 359 + 369) pending deploy authorization
