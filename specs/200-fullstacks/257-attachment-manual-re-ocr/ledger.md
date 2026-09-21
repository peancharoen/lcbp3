# Cross-Session Assurance Ledger

## Identity

- ASSURANCE_UNIT_ID: `lcbp3/ai/attachment-manual-re-ocr`
- REOPEN_GENERATION: `0`
- LEDGER_LOCATION: `/opt/np-dms-lcbp3/specs/200-fullstacks/257-attachment-manual-re-ocr/ledger.md`
- STATUS: `checkpoint-ready`

## Authority and Boundary

- Objective: Admin manual re-OCR of a single PDF attachment with compare-before-replace, plus D10 processor failure fix and D9.3 DONE-guard (ADR-055). Part 2 (D17–D22): production file replacement — junction-scoped swap of the PDF itself through the same compare-before-replace flow.
- Acceptance criteria: spec.md FR-001..FR-045, SC-001..SC-010; ADR-055 test list.
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
| CP11 | Part 2 US5 (T041–T056): TriggerReplaceFileDto + constants replace fields; `stageFileToTemp` (copy-only NAS→temp); `triggerReplace`/`listLinks`/`confirmReplace` (junction-swap tx + orphan de-index + audit + queue annotation); controller `/re-ocr/replace` (dual perm) + `/re-ocr/links`; processor payload passthrough; frontend service/hooks/dialog link+file picker/PDF toggle/detail button/i18n. Self-review fixes: idempotent confirm retry (swap affected=0 + already-swapped → success, else 404); orphan de-index skips enqueue when projectPublicId unresolvable | backend full sweep 3,202 pass/0 fail (61 attachment-re-ocr incl. 3 new retry/orphan-guard tests, 20 file-storage incl. 6 stageFileToTemp); frontend 1,196 pass (20 ReOcr component tests incl. link picker, preselect, retry-candidate, filename-mismatch, PDF toggle); `nest build` + `next build` + `lint:ci` + frontend eslint + tsc both sides — clean | Backend RED-first (spec mocks extended before impl); frontend GREEN-only — flagged (same as CP6) | Real-app drill on attachment 977/revisions 359+369 pending (needs deploy); junction-swap exercised only via mocks — no integration test with real DB | done |
| CP13 | `/112-speckit-security-audit` on ADR-055 Part 2 attack surface — 3 findings found+fixed: **SEV-001 (High)** `POST /files/:id/re-ocr/confirm` accepted replace-mode payloads under `rag.admin.write` alone → junction swap without `correspondence.edit`; fixed by splitting `POST /files/:id/re-ocr/replace/confirm` (dual permission) + `confirm` rejects replace payloads (`RE_OCR_REPLACE_CONFIRM_REQUIRED`) + `confirmReplace` rejects non-replace payloads (`RE_OCR_NOT_REPLACE`); frontend `reOcrService.confirmReplace` + `useReOcrReplaceConfirm` + dialog dispatches by `status.mode`. **SEV-002 (Medium)** `stageFileToTemp` used `path.resolve` containment — symlink inside allowed root could escape; fixed with `fs.realpath` on source AND all roots (NAS mount may itself be a symlink). **SEV-003 (Medium)** `tempAttachmentPublicId` candidate had no ownership check — any dual-perm user could commit another user's temp upload; fixed with `uploadedByUserId === actor.userId` → 403 `PermissionException`. Verified-clean areas: XOR source (service-level), current-revision-only link (`resolveTargetLink`), idempotency (trigger mutex, deterministic jobId, superseded-token 409, retry-safe swap incl. already-swapped → success), `@Audit` + `ai_audit_logs` (real-app id=1395), `@Throttle` on all endpoints, `ParseUuidPipe` (ADR-019), no `dangerouslySetInnerHTML` (React text nodes only), JWT Bearer in localStorage → CSRF N/A, AI boundary intact (BullMQ np-dms-ocr only, no fallback engine) | backend 3,211 pass/0 fail (attachment-re-ocr 87 incl. 4 new: replace-payload-via-plain-confirm reject, non-replace-via-confirmReplace reject, candidate ownership 403, symlink escape); frontend 1,197 pass (dialog confirm routes to confirmReplace in replace mode); `lint:ci` + tsc + frontend eslint — clean | RED evidence: pre-fix code review showed `confirm` routed replace payloads with single permission (live exploit path proven by code trace, not just theory) | No integration test of junction swap vs real DB (mocks only — covered by CP12 production evidence); audit-log write for replace confirm is best-effort (failure doesn't block swap — ADR-016 acceptability decision open) | done |
| CP12 | T062 real-app drill on production `https://lcbp3.np-dms.work/` (deploy run #795, commit `c908b299`), account role: superadmin (admin role lacks `rag.admin.write` — verified 403 on replace/links/status before switching) | Record 1 `คคง.-สคฉ.3-03-21-0004-2567` (corr `01a0b918-f8ef-713a-8027-c9e6e99cb9c9`, rev 369): Replace file dialog → staging tree `Outgoing/2567/` → candidate `O672-0211-คคง.-สคฉ.3-03-21-0004-2567-คัดลอก(1).pdf` (49.8 MB) → np-dms-ocr ~95s → diff view (old 7,048 chars wrong-file text vs new 14,730 chars containing `คคง./สคฉ.3-03/21/0004/2567` + correct subject) → filename-mismatch alert shown → PDF toggle เดิม/ใหม่ → irreversible warning dialog → confirm. DB verified: `correspondence_revision_attachments` rev 369 → attachment 1035 (`is_temporary=0`, ocr 33,932 chars); rev 359 → attachment 977 unchanged (shared-attachment safety); att 977 stays `INDEXED` (not orphaned → no de-index); att 1035 `PENDING` (auto-ingest queued). `ai_audit_logs` id=1395 `attachment-re-ocr:replace` SUCCESS confirmed_by_user_id=1; queue 715 `review_state.fileReplacements` appended. UI post-refresh shows new filename. Record 2 `คคง.-สคฉ.3-03-22-0005-2567` (queue 734, PENDING_REVIEW — not production, used migration replace flow): `PATCH queue/…/file` → `O672-0231-คคง.-สคฉ.3-03-22-0005-2567.pdf` (20.7 MB) → re-extract DONE, back to PENDING_REVIEW, `ocr_text_bak` saved (22,225 chars), fileReplacements audit appended. ⚠ OCR-extracted doc no reads `ผรม.2-2-0010-2567` vs register `03-22-0005` — flagged mismatch for human review (subject matches exactly; register value selected by default) | n/a (production verification) | New-file OCR doc-number mismatch on queue 734 — left PENDING_REVIEW for human decision (by design); SC-002/003/004 timing captured partially (OCR ~95s for 50MB scan) | done |

## Review Attempts

| Attempt | State | Verdict | Reviewer | Notes |
| ------- | ----- | ------- | -------- | ----- |

## Terminal Status

- FINAL_STATUS: `open`
- INDEPENDENT_ATTESTATION: `not-obtained`
- KNOWN_BLOCKERS: none
- Residual risks: shared ai-batch DONE-guard regression risk (needs tests for normal PENDING→PROCESSING→DONE and FAILED retry)

## Next Session Entry

- Last action taken: `/112-speckit-security-audit` completed (CP13) — 3 findings (1 High: missing dual-permission on replace confirm; 2 Medium: symlink escape in stageFileToTemp, missing ownership check on upload candidate) — all fixed + tested (backend 3,211 / frontend 1,197 pass, lint+tsc clean). Fixes are local, not yet committed.
- Next required action: commit security fixes, then T040 finalize ledger (FINAL_STATUS). Deploy needed before re-verifying the fixed confirm route on production (current deployment still has SEV-001 open).
- CAUTION: many backend files are CRLF (ai-batch.*, ai-queue.service.*, queue.constants.ts). Edit with `newline=''` / preserve CRLF or git diffs become whole-file rewrites.
- Files/agent must not touch: `migration_review_queue` flow (ADR-054), schema SQL.
