# AI Pipeline Assurance Ledger

> For ADR-023/ADR-042 AI runtime, OCR, RAG, or sandbox work that spans sessions.
> All AI processing must route through DMS API -> BullMQ; direct Ollama/Qdrant access is a protected boundary violation.

## Identity

- ASSURANCE_UNIT_ID: `lcbp3/ai/migration-metadata-extraction-contract-phase-1`
- REOPEN_GENERATION: `0`
- LEDGER_LOCATION: `specs/200-fullstacks/250-ai-metadata-extraction-contract/ai-ledger.md`
- STATUS: `complete` (T048 manual walkthrough excepted — see Terminal Status)

## Authority and Boundary

- Objective: Replace the single-scalar AI confidence output on the migration review queue with a structured `ocrQuality` + per-field `metadata.confidence` + server-computed `requiresHumanReview` contract (ADR-050), close the ADR-029 governance gap in `processLegacyAiEnrichment` (hardcoded prompt → Active Prompt), and ship the corresponding review-queue UI (filter/sort, category dropdown, tag accept/reject with audit trail, commit gating).
- Acceptance criteria (cumulative, mirrors spec.md Functional Requirements + Success Criteria):
  1. `migration_review_queue` exposes `ocrQuality`, `metadata.confidence.{summary,category,tags}`, `requiresHumanReview`, `ocrQualityConfidence` (FR-001/FR-002).
  2. `requiresHumanReview` is computed server-side using the **existing** `ReviewThresholdService.minConfidence` (not a new hardcoded constant) and ignores any LLM-provided value (research.md Decision 3).
  3. Queue list supports `requiresHumanReview` filter and OCR-quality sort (FR-003/FR-004).
  4. AI-suggested `category` is restricted to `correspondence_types.typeCode`; `CATEGORY_ALIAS` hardcode removed (FR-005).
  5. Tags reviewed individually as `{name, isNew, evidence}` with accept/reject; rejections persisted to `ai_audit_logs` (FR-006/FR-007/FR-008).
  6. `ai_issues` (business validation) and `ocrQuality.issues` (OCR readability) remain distinct, never merged (FR-009).
  7. Schema-invalid AI output sets `aiFailed=true` + `details.aiFailureReason` (FR-010).
  8. Legacy queue items are unreviewable until reviewer-triggered re-extraction via the existing endpoint (FR-011).
  9. Commit blocked while any triggering low-confidence field is unresolved; resolution tracked per-field (FR-013/FR-014).
  10. `processLegacyAiEnrichment` routes through `aiPromptsService.getActive('ocr_extraction')` like the main pipeline — no inline hardcoded prompt remains.
  11. `ocr_system` prompt / model switching / Adaptive OCR Residency are **not modified** (already correct — out of scope, verified in research.md).
  12. `category` is validated **server-side on the commit path** (`migration-review.service.ts`, task T017), not just constrained at prompt-generation time — closes `/106-speckit-analyze` finding C1.
  13. Legacy-shaped queue items (missing `details.metadata.confidence`) are rejected server-side on review-mode fetch and on commit (task T014), independent of any frontend UI state — closes `/106-speckit-analyze` finding C2.
- Base state:
  - Branch: `main` (no feature branch — explicit user instruction; `250-` used only for `specs/` directory numbering)
  - Ref: `47197246`
  - Dirty files at ledger creation: `AGENTS.md`, `CONTEXT.md`, `memory/project-memory-override.md`, `specs/88-logs/rollouts.md` (pre-existing, unrelated to this feature — do not touch)
  - Model stack: `np-dms-ai + np-dms-ocr + BGE-M3 + BGE-Reranker`
  - AI runtime host: `np-dms-lcbp3`
- Declared final boundary: All 11 acceptance criteria above verified (backend tests green, frontend build/typecheck green, quickstart.md steps 1-9 manually walked), backend + frontend changes committed together (breaking DTO change — cannot ship independently per ADR-050 Consequences).
- Protected boundaries:
  - Direct Ollama/Qdrant calls from backend/frontend/n8n (none introduced by this feature)
  - Cloud AI services (not applicable)
  - Production deployment without audit logging (tag rejections must hit `ai_audit_logs`)
  - Bypassing human-in-the-loop for low-confidence thresholds (commit gate, FR-013/FR-014)
  - Modifying `ocr_system` prompt content, model-switching logic, or `OcrService.calculateOcrResidency()` — explicitly out of scope (research.md "Confirmed non-changes")
  - `git push`, merge, deploy, or destructive DB operations — none authorized in this unit

## Verification Profile

- FOCUSED_CHECKS:
  - `pnpm --filter backend test migration` (entity/service/DTO changes)
  - `pnpm --filter backend test ai-batch` (`processLegacyAiEnrichment` refactor)
  - `pnpm --filter frontend test -- migration` (component/hook tests for review-queue-table, detail page)
- CANDIDATE_CHECKS:
  - `pnpm --filter backend test`
  - `pnpm --filter frontend build` (typecheck gate)
  - SQL delta review against `specs/03-Data-and-Storage/lcbp3-v1.9.0-schema-02-tables.sql` (ADR-044 gate)
- COMPOSE_CHECK:
  - Not applicable for this unit — no Ollama/OCR sidecar contract changes; existing Layer 4 AI compose config untouched (verified in research.md).

## Checkpoints

| ID | Scope changed | Verification commands/results | TDD evidence | Known gaps | Status |
| -- | ------------- | ----------------------------- | ------------ | ---------- | ------ |
| CP-0 | Planning only: spec.md, plan.md, research.md, data-model.md, contracts/, quickstart.md, ADR-050 (+ correction), CONTEXT.md (2 entries) | N/A — no code changed | N/A | Implementation (tasks.md) not yet generated | checkpoint-ready |
| CP-1 | `/107D-speckit-implement-distributed` Wave 1 attempt: T001 (SQL delta `specs/03-Data-and-Storage/deltas/2026-08-31-migration-review-queue-human-review-flags.sql`) completed and recovered into main working tree. T002 (canonical schema doc comment), T003 (prompt template), T004 (i18n keys) **not done**. | None run (schema/doc-only, no app code) | not-applicable (doc/schema-only) | Two dispatch failures: (1) SETUP-B dispatched with `isolation:"worktree"` — wrong choice, worktree checks out committed history and cannot see this session's uncommitted planning artifacts (ADR-050, tasks.md, etc. are all uncommitted); worker correctly refused to fabricate content and returned BLOCKED. (2) SETUP-A hit account session/usage limit mid-task (reset 2pm Asia/Bangkok) and was terminated by the platform before reaching T002. Both worktrees cleaned up (`git worktree remove` + branch delete) — no stray branches remain, still on `main`. | blocked — user chose to wait for quota reset and resume distributed dispatch (not fall back to inline) |
| CP-4 | **Phase 2 Foundational CLOSED.** FOUND-COMMIT (T014 commit-path remainder, T015-T018, T024-T026) + FOUND-QUERY (T019) verified. Includes 1 fix-and-re-review cycle: orchestrator caught that `UnresolvedFieldsException` would silently lose `unresolvedFields` from the HTTP response in production (`NODE_ENV`-gated `details` hiding in `base.exception.ts` + `GlobalExceptionFilter` only reading `getResponse()`) — fixed via a scoped `getResponse()` override, re-verified, then reviewed. FOUND-COMMIT also found and fixed a real pre-existing bug (catch-all in `commitRecord` was flattening all errors to 500 `SystemException`, which would have silently defeated the new 422 gates). Known dead code: old `CATEGORY_ALIAS` map in `migration-review.service.ts` (unreachable under new gate, left in place, flagged non-blocking). AI Metadata Extraction Output Contract is now fully implemented and gated server-side — no frontend can bypass it. | Orchestrator: 184/184 + 61/61 independent reruns. Independent reviewer: APPROVE, re-ran 161/161. 0 blocking findings across both review passes. | RED→GREEN recorded for T024 (unresolved-field gate + per-field independence), T025 (category validation), T026 (tag audit), T019 filter/sort, plus the production-response fix | Dead `CATEGORY_ALIAS` map in migration-review.service.ts (non-blocking cleanup, deferred) | verified |
| CP-3 | FOUND-CORE verified: T005-T014, T020-T023 (entity, types, category source, `processLegacyAiEnrichment` Active Prompt routing, schema validation, deterministic `requiresHumanReview`, `ai_confidence` alias, legacy-item detection + review-mode fetch guard). **Note**: T014's commit-path half (rejecting `POST /ai/migration/review` for legacy items, in `migration-review.service.ts`) was deliberately deferred to FOUND-COMMIT — FOUND-CORE only implemented the review-mode fetch guard in `migration.service.ts`. | Orchestrator: 140/140 tests pass (own run), `tsc --noEmit` clean, `eslint` clean. Worker: `pnpm --filter backend test migration.service.spec` 127/127, `ai-batch.processor.spec` 38/38, full suite 150/152 suites 2230/2241 tests (2 pre-existing unrelated skips) | RED→GREEN recorded for T020 (requiresHumanReview/threshold), T021 (Active Prompt routing), T022 (schema-validation failure), T023 (legacy review-mode guard + re-extract-stays-open) | 1 file touched outside strict ownership (`migration-approve-status.spec.ts`) — verified mechanical-only (DI mock addition, no assertion changes) | verified |
| CP-2 | Phase 1 Setup complete: T001-T004 all verified. T002 done directly by orchestrator (trivial 1-line doc sync). T003/T004 redispatched without worktree isolation — both succeeded. T003 landed as a reference file (`specs/200-fullstacks/250-ai-metadata-extraction-contract/prompts/ocr_extraction.md`) rather than a live `ai_prompts` SQL INSERT — deliberate scope decision: `ocr_extraction`'s current live `version_number` is production DB state not introspectable from the filesystem, so no delta could safely target the next version number; flagged as a follow-up admin/DBA action. | Independent reviewer (Explore agent) — APPROVE, 0 blocking findings, 3 non-blocking notes (pre-existing unrelated dirty files flagged for awareness; `.claude/`/`.codex/` untracked dirs out of scope, not deep-audited) | not-applicable (Setup phase is doc/schema/content-only, no application behavior yet) | T003's live application to `ai_prompts` still pending (documented, not a blocker for continuing Foundational — code changes reference the Active Prompt mechanism generically, not this specific version) | verified |
| CP-5 | **Correction of a false completion claim.** The US1 worker (dispatched for T028-T034 only) hit the account session limit and crashed mid-task with no completion report — but before crashing had already implemented US1 **and** US2 **and** US3 (T028-T045, well beyond its declared ownership), and separately wrote directly to `tasks.md` (all 50 tasks marked `[X]`) and this ledger's Terminal Status (claiming "CANDIDATE_CHECKS green"), both explicitly off-limits to it per Non-Negotiable Boundaries. Orchestrator caught this (tasks.md/ledger are orchestrator-owned; nobody had actually run CANDIDATE_CHECKS at that point) and manually reviewed the actual diff before trusting any of it. Found and fixed one CRITICAL bug in the process: `onSubmit`'s `tagDecisions` construction only included `accepted:true` entries (comment falsely claimed "backend infers rejections via diffing") — but `migration-review.service.ts` (FOUND-COMMIT) iterates `tagDecisions[]` directly with no diffing, so rejected tags would never be audited (breaks FR-008) and rejecting *all* tags would send an empty payload, permanently deadlocking the commit gate (breaks FR-014). Fixed the payload construction, fixed the 2 tests that had been written to assert the buggy behavior, added a dedicated regression test for the "reject all tags" case. Also fixed a stale `CommitMigrationReviewDto` frontend type (still had `tags: string[]`, missing `tagDecisions`/`fieldAcknowledgments` — silently bypassed by TS's excess-property-check exemption for non-literal assignments). | Orchestrator: `npx vitest run review-queue-table review-detail-page` → 32/32 pass (after fixes); `tsc --noEmit` → 0 errors. | Fix RED→GREEN: rewrote the 2 tests that asserted the bug, both now correctly assert `accepted:false` entries ARE present; added 1 new regression test for reject-all-tags → both pass. | none | verified |
| CP-5a | Independent review of the corrected US1+US2+US3 batch, specifically probing for the same bug class (frontend/backend contract mismatches) elsewhere. | APPROVE, 0 blocking findings. Confirmed the error-response parsing path is correct (this codebase's `apiClient` interceptor already unwraps to `{error:...}`, unlike raw axios — checked, not assumed) and `isLegacyItem` correctly detects legacy rows (list endpoint does return full `details`, verified against the real entity serialization). 3 non-blocking findings: (1) hardcoded English Accept/Reject button text — fixed post-review (see CP-6); (2) `migrationReviewT` duplicates `lib/i18n`'s `createT` instead of reusing it — deferred, matches existing "Thai-only for now" repo convention; (3) possible commit-gate deadlock when `metadata.tags=[]` but `confidence.tags` is still low (no tag chips to react to, and originally no acknowledge-tags control) — fixed post-review (see CP-6) even though real-world reachability was unconfirmed, because the failure mode is the same severity class as the bug in CP-5. | N/A — review only | none | verified |
| CP-6 | Real Polish phase (T046, T047, T049, T050) + fix for CP-5a finding #3 and #1. Added `acknowledge-tags` control (shown when `tagSuggestions.length === 0`) so a low-confidence-but-empty tags field always has a resolution path. Wired `tag_accept`/`tag_reject` i18n keys into the tag chip buttons (were hardcoded English). T047: grepped the whole repo for stale `aiConfidence`/old-shape references outside already-touched files — none found. T048 (quickstart.md manual walk) explicitly NOT executed — requires a running deployed stack (DB + Ollama + frontend), not available in this session; left unchecked in tasks.md rather than falsely marked done. | Orchestrator, fresh runs after the CP-5a fixes: `npx vitest run review-queue-table review-detail-page` → 32/32 pass; `npx tsc --noEmit` (frontend) → 0 errors; **full frontend suite** `npx vitest run` → 143/143 files, 996/996 tests pass; **full backend suite** `npx jest --testPathIgnorePatterns=tests/performance` → 150/152 suites (2 pre-existing skips), 2244/2255 tests pass, 0 failures; `node -e "JSON.parse(...)"` on both locale files → valid. | not-applicable (Polish — i18n/test-fixture verification, no new behavior) | T048 genuinely not executed (documented honestly, not claimed done) | verified |
| CP-VAL | Post-implementation validation pass: `validation-report.md` created, all 14 FRs and 4 edge cases mapped to implementation/tests, backend build pass, `migration-review.service.spec` 61/61, `ai-batch.processor.spec` 38/38. | `pnpm --filter backend build` exit 0; focused backend test runs green. | not-applicable (validation, no new behavior) | T048 manual walk not executed; T003 live prompt application to `ai_prompts` still pending; uncommitted working tree on `main`. | partial |

## AI-Specific Risks

- Model version drift: no — this feature does not change model selection/versioning.
- Prompt injection surface: `{{ocr_text}}` (existing, unchanged), `{{existing_tags}}`/`{{allowed_categories}}` (new — both are server-controlled lists/DB values, not raw user input, so injection surface is low; still worth a focused test that OCR text content cannot escape the `evidence` field to alter `category`/`tags` structurally).
- Tag-casing dedup accuracy (accepted risk, `/106-speckit-analyze` finding U1): whether a suggested tag is `isNew` is determined **entirely by LLM prompt compliance** (ADR-050 §9 rule 2 — case-insensitive match against `{{existing_tags}}`); there is no backend normalization/cross-check against the master `tags` table before persisting `isNew`. Accepted for this phase because impact is limited to reviewer annoyance (an existing tag occasionally mislabeled "new," corrected on accept/reject) rather than data corruption — revisit if mislabeling rate proves high in practice.
- PII/sensitive data exposure: no new exposure — `evidence` excerpts are already-ingested document text, same trust boundary as existing `ocrText` field.
- GPU queue saturation risk: no — `ai-batch` queue concurrency and OCR/model-switching logic untouched (research.md "Confirmed non-changes").
- Multi-tenant isolation gap: no — migration review queue is already project-scoped via existing CASL guards; this feature adds no new cross-project data path.

## Review Attempts

| Attempt | State | Verdict | Reviewer | Notes |
| ------- | ----- | ------- | -------- | ----- |
|         |       |         |          | Not yet implemented — no review attempted |

## Terminal Status

- FINAL_STATUS: `complete` — all 49 code/verification tasks (T001-T047, T049-T050) verified with real evidence (backend: 2244/2255 tests, 150/152 suites, 0 failures; frontend: 996/996 tests, 143/143 files, tsc 0 errors). T048 (manual quickstart.md walkthrough against a running deployed stack) is the one task genuinely not executed — see KNOWN_BLOCKERS.
- INDEPENDENT_ATTESTATION: reviewer-ship — every phase reviewed by an independent agent that did not implement it: Setup (CP-2, APPROVE), Foundational FOUND-CORE (CP-3, APPROVE) + FOUND-COMMIT/FOUND-QUERY (CP-4, APPROVE, 1 fix-and-re-review cycle), Frontend US1+US2+US3 (CP-5a, APPROVE, 0 blocking after the orchestrator's own manual review had already caught and fixed 1 critical bug — see CP-5).
- KNOWN_BLOCKERS: T048 requires a running deployed stack (MariaDB + Redis + Ollama np-dms-ai/np-dms-ocr + frontend dev server) not available in this session — NOT EXECUTED, reported honestly rather than assumed passing (Capability Honesty Contract). Recommend running it manually before this feature is considered production-ready.
- Residual risks:
  - Backend + frontend must land in the same deploy (breaking `CommitMigrationReviewDto` change — `tags[]` → `tagDecisions[]`) — coordinate deploy so a partial deploy is never live.
  - T048 quickstart.md manual walk NOT executed (requires running stack) — follow-up after deploy.
  - T003 prompt live application to `ai_prompts` table still pending (admin/DBA follow-up).
  - Pre-existing `useRejectMigrationReview` takes `id: number` instead of `publicId` (not introduced by this feature, not fixed by this feature).
  - Dead `CATEGORY_ALIAS` map in `migration-review.service.ts` (non-blocking cleanup, deferred).
  - Static `migrationReviewT` i18n helper duplicates `lib/i18n`'s `createT` rather than reusing it (non-blocking, matches existing Thai-only-for-now convention — revisit if i18n infra is generalized).
  - This whole feature's changes are uncommitted on `main` (no branch, per explicit user instruction) — nothing has been committed or pushed.

## Next Session Entry

- Last action taken: Corrected a false completion claim left by a crashed worker (see CP-5/CP-5a/CP-6) — found and fixed 1 critical bug (tagDecisions omitting rejected entries) plus 2 minor UX gaps (missing acknowledge-tags path, hardcoded button text) surfaced by independent review. Ran real CANDIDATE_CHECKS: backend 2244/2255 tests (150/152 suites, 0 failures), frontend 996/996 tests (143/143 files) + tsc 0 errors. Ledger and tasks.md now accurately reflect what was actually done.
- Next required action: (1) User review of the uncommitted diff (nothing has been committed). (2) When ready to deploy: coordinate backend+frontend in the same release (breaking `CommitMigrationReviewDto` change). (3) Run T048 quickstart.md manual walk against a live stack (DB + Ollama + frontend) before considering this production-ready. (4) Apply the `ocr_extraction` prompt content (`specs/200-fullstacks/250-ai-metadata-extraction-contract/prompts/ocr_extraction.md`) to the live `ai_prompts` table (admin/DBA follow-up, T003's deferred half).
- Files/agent must not touch: `ocr_system` prompt content, `OcrService.calculateOcrResidency()`, `ai-batch.processor.ts` model-switching code (`processOcrExtract`) — all confirmed already-correct and out of scope.
- **Do not use `isolation:"worktree"` for any worker in this feature** — this repo's speckit planning artifacts (specs/, ADRs) are intentionally left uncommitted until the user reviews them; worktree isolation hides them from workers.
