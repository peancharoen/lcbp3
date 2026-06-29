# Code Review Report

**Date**: 2026-06-14
**Scope**: Working tree for `specs/200-fullstacks/237-unified-prompt-management-ux-ui` plus related modified files. No staged changes found.
**Overall**: REQUEST CHANGES

## Summary

| Severity | Count |
| --- | ---: |
| Critical | 1 |
| High | 2 |
| Medium | 2 |
| Low | 0 |
| Suggestions | 0 |

## Findings

### HIGH: Backend build is currently broken

`pnpm --filter backend build` fails with 10 TypeScript errors in `backend/src/modules/rfa/rfa.service.ts`. This blocks merge even if Feature 237 code compiles.

Key examples:

- `backend/src/modules/rfa/rfa.service.ts:457`: `RfaService.WORKFLOW_CODE` is referenced but not defined.
- `backend/src/modules/rfa/rfa.service.ts:700`: `templateRepo` is still used after being removed from constructor injection.
- `backend/src/modules/rfa/rfa.service.ts:748`: `CorrespondenceRouting` is still used after its import was removed.
- `backend/src/modules/rfa/rfa.service.ts:753`: the code appears corrupted: `firstStep.toOrganizatioTransaction();`.

**Fix**: Either complete the ADR-001/021 RFA migration in this file, or isolate/revert this unrelated partial change before reviewing Feature 237 for merge.

### CRITICAL: Context filtering can leak cross-project master data

`backend/src/modules/ai/prompts/ai-prompts.service.ts:59` converts `contextConfig.filter.projectId` with `Number(...)`, while the frontend sends `publicId` UUID strings from `frontend/components/admin/ai/ContextConfigEditor.tsx:120`. A UUID becomes `NaN`; without an override, the later `if (targetProjectId)` checks do not apply project filtering, so AI context can include all projects/orgs/tags.

This violates ADR-019 and the AI multi-tenancy boundary.

**Fix**: Treat stored filters as `projectPublicId` / `contractPublicId` strings, validate with `@IsUUID()`, resolve them to internal IDs inside the service, and apply filters only after successful resolution. Add regression tests for "stored UUID filter without override restricts context".

### HIGH: New mutations do not enforce `Idempotency-Key`

Several new or affected mutating endpoints do not read or require `Idempotency-Key`, despite AGENTS/ADR-016 requiring it for critical `POST`/`PUT`/`PATCH`.

Examples:

- `backend/src/modules/ai/prompts/ai-prompts.controller.ts:68`: create prompt version.
- `backend/src/modules/ai/prompts/ai-prompts.controller.ts:104`: activate prompt.
- `backend/src/modules/ai/prompts/ai-prompts.controller.ts:159`: update context config.
- `backend/src/modules/ai/ai.controller.ts:677`: sandbox RAG prep queues work but generates a new request ID every retry.

**Fix**: Require `@Headers('idempotency-key')`, reject missing keys with `ValidationException`, and use the header as the job/cache key where the operation is queueing or changing state. Frontend calls in `frontend/lib/services/admin-ai.service.ts` also need to send the header.

### MEDIUM: Prompt placeholder contract is inconsistent

The validator requires `rag_query_prompt` to include `{{query}}` and `{{context}}`, and `rag_prep_prompt` to include `{{text}}` in `backend/src/modules/ai/prompts/ai-prompts.service.ts:353`. But the new seed file inserts:

- `rag_query_prompt` with `{{context}}` and `{{ocr_text}}` at `specs/03-Data-and-Storage/deltas/2026-06-14-seed-additional-prompt-types.sql:21`.
- `rag_prep_prompt` with `{{ocr_text}}` at `specs/03-Data-and-Storage/deltas/2026-06-14-seed-additional-prompt-types.sql:33`.
- `classification_prompt` with `{{ocr_text}}` at `specs/03-Data-and-Storage/deltas/2026-06-14-seed-additional-prompt-types.sql:45`.

**Fix**: Choose one placeholder contract per prompt type and align seed, validation, and replacement code. Right now an admin cannot save a modified version of the seeded RAG prep/classification prompt under the service's own rules.

### MEDIUM: DTO validation is too weak for public identifiers and sandbox input

`backend/src/modules/ai/dto/context-config.dto.ts` uses plain `@IsString()` for project/contract identifiers and `@IsObject()` for nested filter, so nested validation does not run and UUID format is not enforced. `backend/src/modules/ai/dto/sandbox-rag-prep.dto.ts` accepts unbounded text.

**Fix**: Use `@ValidateNested()`, `@Type(() => ContextFilterDto)`, `@IsUUID()` for public IDs, whitelist language values, add max page size, and cap sandbox text length.

## Verification

- `pnpm --filter backend build` failed with 10 TypeScript errors.
- `pnpm --filter lcbp3-frontend exec tsc --noEmit` passed.

Merge should stay blocked until the backend build and the context-filter/idempotency issues are fixed.
