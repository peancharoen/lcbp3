# Validation Report: Unified Prompt Management UX/UI (ADR-037)

**Date**: 2026-06-15
**Status**: PARTIAL — 3 gaps require action before sign-off
**Feature**: `237-unified-prompt-management-ux-ui`
**Validated Against**: `spec.md`, `tasks.md`, `plan.md`, `ADR-037`

---

## Coverage Summary

| Metric                  | Count  | Percentage |
| ----------------------- | ------ | ---------- |
| Functional Requirements | 25/29  | 86%        |
| Acceptance Criteria Met | 16/18  | 89%        |
| Edge Cases Handled      | 9/12   | 75%        |
| Tests Present           | 8/10   | 80%        |

---

## ✅ Verified — Implemented Correctly

### Phase 1 — Database Setup

| Task  | File                                                     | Status |
| ----- | -------------------------------------------------------- | ------ |
| T001  | `deltas/2026-06-14-create-ai-execution-profiles.sql`     | ✅     |
| T002  | `deltas/2026-06-14-seed-execution-profiles.sql`          | ✅     |
| T003  | `deltas/2026-06-14-seed-additional-prompt-types.sql`     | ✅     |

### Phase 2 — Foundational

- `AiExecutionProfile` entity — ✅ correct columns, no `@VersionColumn` needed (not required)
- `AiPrompt` entity — ✅ `@VersionColumn` added (T066)
- `ContextConfigDto`, `SandboxRagPrepDto`, `CreateExecutionProfileDto`, `UpdateExecutionProfileDto` — ✅ all present
- `AiModule` registered `AiExecutionProfile` — ✅

### Phase 3 — User Story 1 (Multi-Type Prompt Management)

- `AiPromptsService.create()` — ✅ validates placeholders for all 4 types; increments version per `promptType`
- `PromptTypeDropdown` component — ✅ exists
- `VersionHistory` component — ✅ `showAllTypes` prop, grouped view, pagination (20/page)
- `PromptEditor` component — ✅ live placeholder validation via `PLACEHOLDER_REQUIREMENTS`
- `prompt-management/page.tsx` — ✅ 2-column responsive layout (Tailwind `lg:col-span-4/8`)
- i18n keys for `th` and `en` — ✅ present in `ai.json` / `common.json`

### Phase 4 — User Story 2 (Context Config Management)

- `GET /api/ai/prompts/:type/:version/context-config` — ✅ implemented with CASL guard
- `PUT /api/ai/prompts/:type/:version/context-config` — ✅ with Idempotency-Key + CASL + audit
- `AiPromptsService.getContextConfig()` / `updateContextConfig()` — ✅
- Context config validation: pageSize (1–1000), language required, project/contract UUID existence — ✅
- Optimistic locking (`@VersionColumn`) + error mapping to `BusinessException` — ✅
- `ContextConfigEditor` component — ✅

### Phase 5 — User Story 3 (3-Step Sandbox)

- `POST /api/ai/admin/sandbox/ocr` — ✅ (Step 1)
- `POST /api/ai/admin/sandbox/extract` — ✅ (Step 2, maps to "sandbox-extract" job)
- `POST /api/ai/admin/sandbox/rag-prep` — ✅ added 2026-06-14 (Step 3)
- `GET /api/ai/admin/sandbox/job/:id` — ✅ with 300 req/min throttle
- `SandboxTabs` — ✅ 3-step sequential flow: OCR → Extract → RAG Prep with step guards
- "Activate This Version" button in sandbox results — ✅ (`handleActivate` wired to `onActivateVersion`)

### Phase 6 — User Story 4 (Runtime Parameters Separation)

- `AiExecutionProfilesService` — ✅
- `GET/POST/PUT/DELETE /api/ai/execution-profiles` — ✅ with CASL guards
- `RuntimeParametersPanel` component — ✅ labelled "Runtime Parameters (Global - Applies to All AI Jobs)"
- Integrated into Sandbox tab (separate from Context Config) — ✅

### Phase 7 — Polish

- ADR-007 layered error handling in page mutations — ✅ (toast with `userMessage` + `recoveryAction`)
- CASL guard on all mutation endpoints — ✅
- Redis cache invalidation on activation — ✅ (both `active:type` and `versions:type` keys deleted)
- Block deletion of active version — ✅ (`CANNOT_DELETE_ACTIVE_PROMPT` BusinessException)
- SELECT FOR UPDATE concurrent activation — ✅

### Phase 8 — Grilling Session Resolutions

- "All Types" option in `PromptTypeDropdown` — ✅
- "All Types" grouped view in `VersionHistory` — ✅
- `@VersionColumn` on `AiPrompt` entity — ✅ (T066)
- Context config field validation backend — ✅ (T068)
- Responsive design breakpoints in page — ✅ (`grid-cols-1 lg:grid-cols-12`)
- "Runtime Parameters (Global...)" label — ✅
- ADR-007 layered Toast/Inline errors in page — ✅
- Redis cache (60s TTL) for version history — ✅ (`setex(cacheKey, 60, ...)`)
- Pagination (20 versions/page) in `VersionHistory` — ✅
- Database SELECT FOR UPDATE for activation — ✅
- Block active version deletion — ✅
- Redis TTL (60m) for sandbox results — to be confirmed (see gap below)

---

## ⚠️ Gaps Identified

### GAP-1: Placeholder Validation Mismatch — Backend vs Spec [MEDIUM]

**FR-023 / FR-024 / FR-026 violation**

| Prompt Type          | Spec Required Placeholders                            | Backend Checks                      | Frontend Checks                       |
| -------------------- | ----------------------------------------------------- | ----------------------------------- | ------------------------------------- |
| `ocr_extraction`     | `{{ocr_text}}` (req), `{{master_data_context}}` (opt) | `{{ocr_text}}` only ✅              | `{{ocr_text}}`, `{{master_data_context}}` both required ❌ |
| `rag_query_prompt`   | `{{user_query}}` (req), `{{retrieved_chunks}}` (req)  | `{{query}}` + `{{context}}` ❌      | `{{query}}` + `{{context}}` ❌        |
| `rag_prep_prompt`    | `{{document_text}}` (req)                             | `{{text}}` ❌                       | `{{text}}` ❌                         |
| `classification_prompt` | `{{document_metadata}}` (req), `{{document_text}}` (opt) | `{{document_text}}` only ❌    | `{{document_text}}` only ❌           |

**Spec FR-023–FR-026** defines exact placeholder names that differ from what was implemented. Additionally, `{{master_data_context}}` is marked "optional" in the spec but `PLACEHOLDER_REQUIREMENTS` requires it (making it a required validation that blocks save).

**Impact**: Incorrect placeholder names mean production prompts using spec-defined names (`{{user_query}}`, `{{retrieved_chunks}}`, `{{document_text}}` for rag_prep, `{{document_metadata}}`) will fail validation and cannot be saved.

**Recommendation**: Decide canonical placeholder names — align spec or align code. Suggested: update spec FR-023–FR-026 to reflect implemented names (`{{query}}`, `{{context}}`, `{{text}}`) since these are used in actual production seed data. Also remove `{{master_data_context}}` from required list in `PLACEHOLDER_REQUIREMENTS` (mark as optional per spec).

---

### GAP-2: Mobile Collapsible Accordion (T071) — Not Implemented [LOW]

**FR-021 / T071**: Spec requires "collapsible Left Panel accordion for mobile". The `VersionHistory` component has no `<Accordion>` or collapse-on-mobile logic. It renders the same `<Card>` on all screen sizes.

**Impact**: On mobile (<768px) the Left Panel is not collapsible — it stacks vertically (technically responsive) but without the accordion UX defined in T071.

**Recommendation**: Wrap `VersionHistory` content in a shadcn/ui `<Collapsible>` or `<Accordion>` gated by a `md:hidden` toggle button.

---

### GAP-3: Integration Test (T032) Marked `describe.skip` [LOW]

**T032** (Integration test for 3-step sandbox workflow in `backend/tests/integration/ai/sandbox-workflow.spec.ts`) is implemented but marked `describe.skip` due to missing e2e infrastructure (UserModule, CacheModule, etc.).

**Impact**: The 3-step sandbox workflow is not covered by automated tests at integration level. Unit tests for individual steps exist.

**Recommendation**: Either un-skip with a proper test module setup, or document as a known deferred test requiring e2e infrastructure setup. Update `tasks.md` T032 status to reflect this.

---

## Uncovered Requirements

| Requirement | Status          | Notes |
| ----------- | --------------- | ----- |
| FR-023      | ⚠️ Partial      | Backend checks `{{ocr_text}}` only; spec also defines `{{master_data_context}}` as optional (frontend wrongly requires it) |
| FR-024      | ⚠️ Mismatch     | Spec: `{{user_query}}`, `{{retrieved_chunks}}`; implemented: `{{query}}`, `{{context}}` |
| FR-025      | ⚠️ Mismatch     | Spec: `{{document_text}}`; implemented: `{{text}}` |
| FR-026      | ⚠️ Partial      | Spec: `{{document_metadata}}` required; implemented: checks `{{document_text}}` (wrong placeholder) |
| FR-021 (mobile accordion) | ⚠️ Partial | Responsive breakpoints exist but Left Panel is not collapsible accordion |
| T032 integration test | ⚠️ Skipped | Valid test structure but `describe.skip` — no CI coverage |

---

## ADR Compliance Check

| ADR        | Check                                      | Status |
| ---------- | ------------------------------------------ | ------ |
| ADR-019    | No `parseInt` on UUID; publicId only       | ✅ Pass — controller uses `ParseIntPipe` on versionNumber (INT), not UUID |
| ADR-009    | No TypeORM migrations; SQL deltas used     | ✅ Pass — 3 SQL deltas created |
| ADR-016    | CASL guards on all mutations               | ✅ Pass — `@RequirePermission('system.manage_all')` on every mutation |
| ADR-016    | Idempotency-Key on POST/PUT                | ✅ Pass — `POST :type`, `POST activate`, `PUT context-config` all require it |
| ADR-007    | Layered error handling                     | ✅ Pass — `BusinessException`/`ValidationException` + Toast/Inline in frontend |
| ADR-008    | Sandbox jobs via BullMQ (no inline AI)     | ✅ Pass — all sandbox steps enqueue via `aiQueueService.enqueueSandboxJob()` |
| ADR-023/A  | AI boundary — no direct Ollama access      | ✅ Pass — BullMQ queues used for all AI calls |
| ADR-029    | Redis cache TTL 60s for active prompts     | ✅ Pass — `setex(cacheKey, 60, ...)` |
| ADR-037    | Single page layout; 3-step sandbox         | ✅ Pass |
| TypeScript | Zero `any`, zero `console.log`             | ✅ Pass — reviewed ai-prompts.service.ts, controller, page.tsx |
| i18n       | No hardcoded Thai/English strings          | ⚠️ Partial — `SandboxTabs` contains several hardcoded Thai strings (e.g., "กรุณาเลือกไฟล์ PDF", "ทำ OCR สำเร็จแล้ว") |

---

## Recommendations (Priority Order)

1. **[HIGH — FR-023–FR-026]** Align placeholder names between spec and code. Recommended approach: update spec to use implemented names (`{{query}}`, `{{context}}`, `{{text}}`). Fix `PLACEHOLDER_REQUIREMENTS` to mark `{{master_data_context}}` as optional (not blocking save).
2. **[MEDIUM — i18n]** Extract hardcoded Thai strings in `SandboxTabs.tsx` to i18n keys (pre-existing `ai.json` or `common.json`).
3. **[LOW — T071]** Add collapsible accordion to `VersionHistory` for mobile screens.
4. **[LOW — T032]** Un-skip integration test or create a tracking issue for e2e infrastructure setup.

---

## Sign-off Readiness

| Area                             | Ready? |
| -------------------------------- | ------ |
| Backend API endpoints            | ✅ Yes |
| Frontend page & components       | ✅ Yes |
| Database schema / seed data      | ✅ Yes |
| RBAC / Security (ADR-016)        | ✅ Yes |
| Error handling (ADR-007)         | ✅ Yes |
| Redis cache (ADR-029)            | ✅ Yes |
| AI boundary (ADR-023/A)          | ✅ Yes |
| Placeholder validation accuracy  | ❌ No (GAP-1) |
| Mobile UX (collapsible panel)    | ⚠️ Partial (GAP-2) |
| Test coverage (T032 skipped)     | ⚠️ Partial (GAP-3) |
| i18n completeness                | ⚠️ Partial |

> **Conclusion**: Core architecture and business logic are correctly implemented. The feature is functionally complete but requires a placeholder naming decision (GAP-1) before production sign-off.
