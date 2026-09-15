# Assurance Ledger: ADR-054 Queue Metadata Separation

## Identity

- ASSURANCE_UNIT_ID: lcbp3/migration/adr-054-metadata-separation
- REOPEN_GENERATION: 0
- LEDGER_LOCATION: specs/200-fullstacks/256-queue-metadata-separation/ledger.md
- STATUS: closed

## Authority and Boundary

- Objective: Implement ADR-054 — ownership-separated queue metadata storage + OCR text protection + import audit trail, per spec.md FR-001–FR-013.
- Acceptance criteria: spec.md SC-001–SC-005 all demonstrably green; D8 protocol documented in quickstart.md.
- Base state (implementation start): branch `main`, HEAD `384f6deb` (post spec-pipeline squash `779dc619` + delta-path fix); working tree clean — no pre-existing dirty files. Spec artifacts pushed to origin/main 2026-09-14; implementation runs on `main` per explicit user instruction ("ทำบน main").
- Declared final boundary: all tasks.md items complete + focused tests green + spec validation passes.
- Protected boundaries: executing the SQL delta (TRUNCATE), deploy, merge/push, production DB writes — none crossed by this unit; delta file is authored but NOT executed here.

## Repository Verification Profile

- FOCUSED_CHECKS: `npx jest src/modules/migration/ src/modules/ai/processors/`; `npx vitest run components/migration/__tests__/`
- CANDIDATE_CHECKS: `npm run build` (backend + frontend), `npm run lint`, `npx tsc --noEmit`
- COMPOSE_CHECK: not-applicable for this unit (no deploy)

## Checkpoints

| Checkpoint | Changed scope | Parent verification | TDD evidence | Known gaps | Status |
|-----------|---------------|---------------------|--------------|------------|--------|
| cp0-prepare | spec/plan/research/data-model/contracts/quickstart/ledger | n/a (docs only) | not-applicable | implementation not started | checkpoint-ready |
| cp1-wave1-dispatch | none (orchestration only) — workers c88f3b58 (T001 SQL delta) + f49799f3 (T002-T007 entity/types/constants/write-paths) dispatched background on main @384f6deb | n/a | n/a | wave 1 in flight; review pending | open |
| cp2-wave1-reviewed | T001-T007 diffs validated by orchestrator (build exit 0; jest 201/209 — 8 stale assertions expected); reviewer 5ed26d52 REQUEST_CHANGES — 1 blocker: T010 must land with wave-1 (stale `details.source_file_path` readers reproduce incident signature); resolved by holding commit until wave-2 backend lands | `pnpm --filter backend build` exit 0; `npx jest` 201/209 | n/a (wave 2 carries TDD) | commit deferred to wave-2 boundary per reviewer; 8 non-blocking findings queued (whitelist hardening folded into wave 2; MigrationReviewRecord drift → T029; stale comments → T030 sweep) | open |
| cp3-wave2-dispatch | none (orchestration) — workers 9d87b796 (T008-T015 US1 backend) + af45a8a9 (T016 US1 frontend) dispatched background; wave-1+wave-2 to be committed together after review | n/a | n/a | wave 2 in flight | open |
| cp4-us1-verified (T017) | T001-T016 verified: reviewer bd0f9dee APPROVE (0 blocking) — resolveQueuePdfPath landed (incident path blocked), snapshot funnel at 3 sites, restore endpoint + frontend action; 7 non-blocking findings queued (details.attachments strip → wave-3; list ocrTextBak → wave-3; docblock fix → wave-3; rest → T029/T030 scope) | orchestrator re-ran: backend jest 739/739, frontend vitest 42/42, both lint exit 0 | wave-2 RED: 10 backend + 3 frontend failing tests → GREEN | committing wave-1+2 as single unit per wave-1 review blocker | open |
| cp5-us2-verified (T024) | T018-T023 verified: reviewer 7218ca03 APPROVE (0 blocking) — commitRecord writes reviewState in tx, AI paths isolated (grep: only writer is commitRecord), FR-009 confidence stores locked by tests, list hasOcrTextBak flag, zero stale frontend reads; contract §1 type corrected by orchestrator; 4 non-blocking findings (compareResult drop on re-extract = spec-sanctioned → follow-up note) | orchestrator re-ran: backend jest 748/748, frontend vitest 44/44 | wave-3 RED: 4 backend + 1 frontend → GREEN | wave-3 commit next; 2 out-of-ownership frontend touches classified acceptable (same contract migration) | open |
| cp6-us3-us4-verified (T027) | T025-T028 verified: reviewer fe7860d2 APPROVE (0 blocking) — all 4 IMPORTED paths set importedCorrespondencePublicId (approve×2, commitRecord, ai-ingest approve) + replay branch resolves correspondence; orchestrator folded FR-008 gap (ai-ingest reviewedBy/reviewedAt now set); T028 D8 pointer added to deltas/README.md; dead ai/services/migration.service.ts confirmed unregistered (T029 audit still pending in wave 5) | orchestrator re-ran: backend jest 1545/1545 (91 suites); ai-ingest spec 20/20 post-fold; build exit 0 | wave-4 RED: 5 assertions → GREEN | 3 non-blocking findings noted (replay project-mismatch warn, INT-PK exposure, reviewedBy varchar/INT drift → all pre-existing/follow-up) | open |
| cp7-final-gate (T029-T034) | Orchestrator-only final phase: T029 audit clean (ai/services/migration.service.ts dead/unregistered — zero queue writes; ai-migration-checkpoint.service.ts registered but writes extractedMetadata/errorReason only — no details/ocr_text/reviewState bypass; real-DB describe confirms pre-existing drift: extracted_metadata/original_file_name/source_attachment_public_id/error_reason columns absent from DB — legacy path pre-broken, follow-up). T030 sweep: zero stale runtime reads (only doc comments). T031-T033: all green. Final reviewer ed6745ea REQUEST_CHANGES → resolved: B1 false positive (dict entries verified at 03-01:2254,2448,2494-2496 via grep -a — file flagged binary); B2 fixed (reviewState hydration in fetchItem + hydration test); quickstart public_id→uuid; entity header prefix; whitelist docblock | backend jest 780/780 (32 suites); frontend vitest 45/45; backend build+lint:ci exit 0; frontend tsc+lint+build exit 0 | final-fix RED→GREEN: hydration test added (45 tests) | all resolved | closed |

## Review Attempts

| Attempt | State | Verdict | Notes |
|---------|-------|---------|-------|
| wave-1 review (5ed26d52) | complete | REQUEST_CHANGES | 1 blocker: T010 atomicity — resolved by committing wave-1+2 together (ca2527f0) |
| wave-2 review (bd0f9dee) | complete | APPROVE | 0 blocking; 7 non-blocking folded to waves 3-5 |
| wave-3 review (7218ca03) | complete | APPROVE | 0 blocking; compareResult-drop-on-reextract noted (spec-sanctioned) |
| wave-4 review (fe7860d2) | complete | APPROVE | 0 blocking; FR-008 ai-ingest gap folded inline by orchestrator |
| final-strict aggregate (ed6745ea) | complete | REQUEST_CHANGES→resolved | B1 false positive (dict entries exist); B2 fixed (reviewState hydration); non-blockers folded |

## Terminal Status

- FINAL_STATUS: closed — all 34 tasks [X], all waves independently reviewed, final aggregate review resolved
- INDEPENDENT_ATTESTATION: 5 reviewer agents (1 explore per wave + final-strict); verdicts: APPROVE ×3, REQUEST_CHANGES ×2 (both resolved)
- KNOWN_BLOCKERS: none
- Remaining risks: TRUNCATE destructive by design (ADR-054, DBA-applied — NOT executed by this unit); placeholder-skip depends on constants staying single-sourced; pre-existing MigrationReviewRecord↔schema drift (dead columns: extracted_metadata etc.) is a follow-up, out of ADR-054 scope.
- Follow-ups: (a) reconcile MigrationReviewRecord entity vs real schema; (b) MigrationReviewQueue.reviewedBy varchar(100) vs schema INT; (c) optional logger.warn on replay project-mismatch; (d) INT-PK exposure in import response (ADR-019 hardening pass); (e) compareResult not recomputed on re-extract (spec-sanctioned degradation).

## Next Session Entry

- Last action taken: implementation complete — T001-T034 all [X]; commits ca2527f0 + d326ca60 + 8227a3d8 on main (unpushed); final fixes (reviewState hydration, runbook uuid, headers) pending final commit.
- Next required action: user-directed — apply SQL delta via DBA/D8 protocol when ready; `2git.sh` push only on explicit user command.
- Files/agent must not touch: user WIP — `specs/06-Decision-Records/ADR-054-*.md` (modified), `ADR-055-*.md` (untracked); do not execute the SQL delta; do not push.
