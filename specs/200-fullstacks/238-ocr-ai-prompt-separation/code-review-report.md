# Code Review Report

**Date**: 2026-06-18 13:48 Asia/Bangkok
**Scope**: `specs/200-fullstacks/238-ocr-ai-prompt-separation`, related backend/frontend/sidecar changes for Feature 238
**Overall**: REQUEST CHANGES

## Summary

| Severity | Count |
| --- | ---: |
| Critical | 0 |
| High | 3 |
| Medium | 2 |
| Low | 0 |
| Suggestions | 1 |

## Findings

### HIGH: OCR prompt UI is not reachable from the actual admin page

**File**: `frontend/app/(admin)/admin/ai/prompt-management/page.tsx:21`

The real prompt-management page still uses the old dropdown/editor flow and never imports or renders `PromptManagementTabs`. The dropdown type list also excludes `ocr_system` (`frontend/lib/types/ai-prompts.ts:5`, `frontend/components/admin/ai/PromptTypeDropdown.tsx:50`), so admins cannot select or edit the OCR system prompt from the shipped page.

This blocks FR-006/FR-007 and the core acceptance scenario for "OCR System Prompt". The task list marks T021/T022/T057 complete, but the implementation is currently dead UI.

**Fix**: Wire the Feature 238 UI into `prompt-management/page.tsx`, or extend the existing page's `PromptType`/dropdown/editor flow to include `ocr_system` with the required separation. Add a component test that renders the actual page and asserts both OCR System Prompt and AI Extraction Prompt are available.

### HIGH: New prompt service builds `/api/api/...` URLs

**File**: `frontend/lib/services/admin-ai-prompt.service.ts:28`

`frontend/lib/api/client.ts` already sets `baseURL` to `http://localhost:3001/api`. The new service calls paths like `/api/ai/prompts/${promptType}`, which resolve to `/api/api/ai/prompts/...`. If `PromptManagementTabs` is wired into the page, all prompt list/create/activate/delete calls from these new tabs will fail.

**Fix**: Match the existing `adminAiService` pattern and call `/ai/prompts/...`, or remove this duplicate service and reuse `adminAiService`.

### HIGH: Sidecar fallback path crashes with `NameError`

**File**: `specs/04-Infrastructure-OPS/04-00-docker-compose/Desk-5439/ocr-sidecar/app.py:179`

After renaming `typhoon_options` to `ocr_options`, the unknown-engine fallback still calls:

```python
process_ocr(..., options_override=typhoon_options, ...)
```

`typhoon_options` is undefined in `_process_pdf_doc()`, so any direct sidecar request with a legacy/unknown engine value crashes instead of falling back to `np-dms-ocr`. This is especially risky because prior clients and docs still mention legacy engine aliases.

**Fix**: Use `ocr_options` in the fallback branch and add a sidecar test for `engine=typhoon-np-dms-ocr` and an unknown engine.

### MEDIUM: Activate request body bypasses DTO validation

**File**: `backend/src/modules/ai/prompts/ai-prompts.controller.ts:135`

The new `expectedVersion` body is typed inline as `{ expectedVersion?: number }` rather than a DTO. Runtime validation will not enforce integer typing, so `"1"` from a client compares unequal to numeric `1` and returns a false 409 conflict.

**Fix**: Add an `ActivatePromptDto` with `@IsOptional()`, `@Type(() => Number)`, `@IsInt()`, `@Min(1)`, and use it in the controller. Add a controller/service test for string numeric input and invalid input.

### MEDIUM: Feature tasks are marked complete beyond implemented UI behavior

**File**: `specs/200-fullstacks/238-ocr-ai-prompt-separation/tasks.md:175`

T057-T068 are checked as complete, but the new `PromptManagementTabs` has only two tabs and no Sandbox tab, while the real page still uses the older `SandboxTabs` path. The E2E file that passed is mostly data/format assertions and does not exercise the rendered admin page or backend endpoints end-to-end.

**Fix**: Uncheck incomplete tasks or finish the actual wiring/tests. Add a UI test for the real page's 3-step sandbox and a backend/sidecar integration test proving Step 1 sends `systemPrompt`.

## What's Good

- Backend prompt validation now recognizes `ocr_system` as a free-form prompt type while preserving required placeholders for `ocr_extraction`, `rag_prep_prompt`, and related types.
- `SandboxOcrEngineService` fetches the active `ocr_system` prompt and appends it as `systemPrompt` for sidecar calls.
- Existing backend and frontend type checks currently pass.

## Verification

- `pnpm --filter backend test -- sandbox-ocr-engine.service.spec.ts` passed, but Jest ran the broader backend suite: 98 passed, 2 skipped, 855 tests passed.
- `pnpm --filter lcbp3-frontend exec tsc --noEmit` passed with no output.

## Recommended Actions

1. Must fix before merge: wire OCR prompt management into the real page, correct frontend service URLs, and fix the sidecar `typhoon_options` runtime crash.
2. Should address: replace inline activate body typing with a validated DTO and align `tasks.md` with verified behavior.
3. Consider later: consolidate duplicate prompt services/components to avoid two admin prompt-management implementations drifting apart.
