# Cross-Session Assurance Ledger

## Identity

- ASSURANCE_UNIT_ID: `lcbp3/ai/attachment-manual-re-ocr`
- REOPEN_GENERATION: `0`
- LEDGER_LOCATION: `/opt/np-dms-lcbp3/specs/200-fullstacks/257-attachment-manual-re-ocr/ledger.md`
- STATUS: `checkpoint-ready`

## Authority and Boundary

- Objective: Admin manual re-OCR of a single PDF attachment with compare-before-replace, plus D10 processor failure fix and D9.3 DONE-guard (ADR-055).
- Acceptance criteria: spec.md FR-001..FR-031, SC-001..SC-008; ADR-055 test list.
- Base state:
  - Branch: `257-attachment-manual-re-ocr`
  - Ref: `1b8452c0` (spec commit)
  - Dirty files: none
- Declared final boundary: all tasks in tasks.md complete, candidate checks green, security review passed, real-app check done. No push/deploy without explicit user authorization.
- Protected boundaries: AI boundary (ADR-023), `attachments.ocr_text` source of truth, shared `ai-batch.processor.ts` ingestion path, deploy/merge/push.

## Repository Verification Profile

- FOCUSED_CHECKS: `pnpm --filter backend test -- <pattern>`; `pnpm --filter lcbp3-frontend test run <pattern>`
- CANDIDATE_CHECKS: `pnpm --filter backend lint:ci && pnpm --filter backend build && pnpm --filter backend test && pnpm --filter lcbp3-frontend lint && pnpm --filter lcbp3-frontend test run`
- COMPOSE_CHECK: not-applicable (no compose change)

## Checkpoints

| ID | Scope changed | Verification commands/results | TDD evidence | Known gaps | Status |
| -- | ------------- | ----------------------------- | ------------ | ---------- | ------ |
| CP0 | spec + plan artifacts | n/a (docs) | n/a | — | done |
| CP1 | T003/T006 DONE-guard in ai-batch.processor.ts | `pnpm --filter backend exec jest ai-batch.processor.spec` → 59 pass | RED: 2 fail (claim args + skip); GREEN: 59 pass | — | done |
| CP2 | T004/T007 D10 failure reporting in np-dms-ocr-processor.ts (new spec) | `jest np-dms-ocr-processor.spec ai-batch.processor.spec` → 63 pass; eslint + tsc clean | RED: 2 fail (VRAM gate, catch final attempt); GREEN: 4 pass | — | done |
| CP3 | T005 job-data fields, T016/T017 `enqueueAttachmentReOcr` in ai-queue.service.ts; `QUEUE_NP_DMS_OCR` moved to queue.constants.ts (fixes circular import processor↔vram-monitor↔ai-queue) | `jest src/modules/ai src/modules/monitoring` → 72 suites / 935 pass; eslint + tsc clean | RED: 4 fail; GREEN: pass | Judgment: jobId uses `-` (`re-ocr-{id}-{token}`) not ADR's `:` — BullMQ 5.65 rejects `:` unless exactly 3 parts (TODO to ban) | done |
| CP4 | T002 constants (`re-ocr.constants.ts`), T014/T018 re-OCR branch in np-dms-ocr-processor.ts | `jest src/modules/ai src/modules/monitoring` all pass; eslint + tsc clean | RED: 6 fail; GREEN: 12 pass | Judgment: shrink `warning` computed by service at status-read (processor has no DB access) — data-model.md pointer no longer carries `warning` | done |
| CP5 | T011–T013/T015/T019–T022: AttachmentReOcrService, DTOs, controller, GoneException, AiModule registration | `jest src/common/file-storage` 6 suites / 81 pass; eslint + tsc clean | RED: module-not-found; GREEN: 21 service + controller tests | Judgment: controller+service registered in AiModule (not FileStorageModule) — AiEnabledGuard/AiSettingsService live there; ModuleRef not needed. Confirm returns `reindexQueued` flag; DI boot not yet exercised (needs real-app check T038) | done |
| CP6 | Frontend US1/US2: re-ocr.service.ts, use-re-ocr.ts, ReOcrDiffView/Dialog/Button, i18n th+en, row action in rag-console page; backend status now returns `currentText` | `pnpm --filter lcbp3-frontend lint` clean; `test run` 167 files / 1173 pass; tsc clean; backend file-storage 33 pass | Frontend tests written after implementation (GREEN-only; not RED-first) — flagged | ReOcrDiffView PDF pane duplicates FilePreviewModal blob-fetch (modal is Dialog-wrapped, cannot embed inline); `next build` + real-browser check pending (T036/T038) | done |
| CP7 | T033 US3 test, T035/T036 candidate gates, T037 inline security check, T039 ADR-055 deviation notes | backend: tsc clean, full jest 214 suites/3180 pass (earlier) + src/common+ai 94 suites/1283 pass; `lint:ci` + `nest build` clean; frontend: lint clean, 167 files/1173 pass, `next build` OK | n/a | T038 real-app check pending (needs user deploy authorization); independent security audit not run | done |
| CP8 | Review hardening: trigger mutex (SET NX), confirm supersede/identical guards, scoped preview endpoint (rag.manage), idempotency comment, dropped wrong documentPublicId | 50/50 focused backend tests + 13/13 frontend ReOcr tests; tsc+lint clean; commit `7b276ecb` | tests added with fix (GREEN) | — | done |
| CP9 | Coverage remediation: jest.config fix (dead `*.spec.ts` threshold + per-file tsconfig entries — ts-jest ConfigSet cache made them dead config); +15 tests → audit-log 94.11%, escalation 84.61%, task-creation 85.71%, excel-review 80.80% branches; frontend re-ocr service/hook tests | full jest 214 suites/3201 pass, 0 fail (exit 1 = pre-existing coverage debt on ~24 files + ctor-decorator artifacts); frontend 1184 pass; commit `3a80af7c` | n/a | 3 files structurally <80% branches (emitDecoratorMetadata ctor artifacts — v8 uncoverable); needs team threshold-policy decision | done |
| CP10 | `/111-speckit-validate`: FR-001..031 + 11 edge cases + 14 acceptance scenarios verified against code/tests → validation-report.md | 31/31 FRs covered, 100%; tasks 38/40 | n/a | T038 real-app + T040 ledger finalize pending; SC-002/003/004 need live measurement; independent security audit recommended | done |

## Review Attempts

| Attempt | State | Verdict | Reviewer | Notes |
| ------- | ----- | ------- | -------- | ----- |

## Terminal Status

- FINAL_STATUS: `open`
- INDEPENDENT_ATTESTATION: `not-obtained`
- KNOWN_BLOCKERS: none
- Residual risks: shared ai-batch DONE-guard regression risk (needs tests for normal PENDING→PROCESSING→DONE and FAILED retry)

## Next Session Entry

- Last action taken: `/111-speckit-validate` → validation-report.md (31/31 FRs PASS); review hardening + coverage remediation committed (`7b276ecb`, `3a80af7c`).
- Next required action: T038 (deploy via user-authorized path, then `check-real-app` quickstart drill incl. SC-002/SC-003), run `/112-speckit-security-audit`, then T040 finalize ledger. DI boot of AiModule with the new controller has only been exercised by `nest build`/unit tests, not a running app.
- CAUTION: many backend files are CRLF (ai-batch.*, ai-queue.service.*, queue.constants.ts). Edit with `newline=''` / preserve CRLF or git diffs become whole-file rewrites.
- Files/agent must not touch: `migration_review_queue` flow (ADR-054), schema SQL.
