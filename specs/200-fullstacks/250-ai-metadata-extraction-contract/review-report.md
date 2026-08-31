# Code Review Report

**Date**: 2026-08-31  
**Scope**: Uncommitted working-tree changes for feature `250-ai-metadata-extraction-contract`  
**Reviewed files (code only)**:
- `backend/src/modules/ai/processors/ai-batch.processor.ts` / `.spec.ts`
- `backend/src/modules/migration/migration-review.service.ts` / `.spec.ts`
- `backend/src/modules/migration/migration.service.ts` / `.spec.ts`
- `backend/src/modules/migration/dto/commit-migration-review.dto.ts`
- `backend/src/modules/migration/dto/migration-queue-query.dto.ts`
- `backend/src/modules/migration/entities/migration-review-queue.entity.ts`
- `backend/src/modules/migration/types/ai-extraction-details.type.ts`
- `frontend/app/(admin)/admin/migration/review/[id]/page.tsx`
- `frontend/components/migration/review-queue-table.tsx`
- `frontend/hooks/use-migration-review.ts`
- `frontend/lib/services/migration.service.ts`
- `frontend/types/migration.ts`
- `frontend/types/dto/migration/migration-review.dto.ts`

**Overall**: **REQUEST CHANGES**

## Summary

| Severity       | Count |
| -------------- | ----- |
| [CRITICAL]     | 0     |
| [HIGH]         | 1     |
| [MEDIUM]       | 1     |
| [LOW]          | 0     |
| [SUGGESTION]   | 2     |

## Findings

### [HIGH]: LLM Prompt Injection via Unescaped OCR Text

**File**: `backend/src/modules/ai/processors/ai-batch.processor.ts` lines 2183–2193 (`processLegacyAiEnrichment`)
**Violated contract**: ADR-050 §2/§9 prompt contract — `{{allowed_categories}}`, `{{existing_tags}}`, and `{{master_data_context}}` placeholders must be populated from system data, not from the user-supplied OCR text.
**Reachable path**: A scanned document whose OCR text contains the literal substrings `{{allowed_categories}}`, `{{existing_tags}}`, or `{{master_data_context}}` will have those markers injected into the prompt by the first `.replace('{{ocr_text}}', truncatedOcr)` call. The subsequent `.replace('{{allowed_categories}}', ...)`, `.replace('{{existing_tags}}', ...)`, and `.replace('{{master_data_context}}', ...)` calls then expand the injected markers with system-controlled values, placing `allowedCategories`/`existingTags`/`masterDataContext` inside the document text region.
**Impact**: The final prompt structure is partially controlled by document content, which can confuse or misdirect the LLM, leading to incorrect metadata extraction, wrong `category`, or malformed JSON that fails `validateExtractionOutput` and is marked as `SCHEMA_VALIDATION_FAILED`.
**Evidence gap**: No test in `ai-batch.processor.spec.ts` covers OCR text containing `{{...}}` placeholders; the existing tests only check confidence/score paths.
**Fix**: Sanitize `truncatedOcr` before substitution by replacing `{{` and `}}` with inert equivalents, or perform all four replacements in a single pass using a replacement function that does not re-scan user text for active markers.

### [MEDIUM]: Raw SQL Bypasses TypeORM for Tag Linking

**File**: `backend/src/modules/migration/migration-review.service.ts` lines 283–318 (`linkTagToCorrespondence`)
**Violated contract**: Maintainability / TypeORM patterns — `tags` and `correspondence_tags` are TypeORM entities; business logic should prefer repositories or query builders over hand-written SQL.
**Reachable path**: Every commit with accepted tag decisions or legacy tags executes `manager.query` with hardcoded table/column names.
**Impact**:
- Schema renames of `tags` or `correspondence_tags` will silently break this path at runtime.
- `INSERT IGNORE` is MySQL-specific and can mask real foreign-key or duplicate errors.
- Hardcoded `color_code = 'default'` is a magic value not tied to the `Tag` entity defaults.
**Evidence gap**: Correct today (queries are parameterized, so no SQL injection), but it is a maintainability and portability risk.
**Fix**: Use `manager.getRepository(Tag).findOne(...)` / `manager.getRepository(Tag).save(...)`, or `manager.createQueryBuilder`, and derive `color_code` from entity defaults or a constant.

### [SUGGESTION]: Use Project Exception for Missing Active Prompt

**File**: `backend/src/modules/ai/processors/ai-batch.processor.ts` line 2170
**Issue**: `throw new Error('No active ocr_extraction prompt version found')` is a generic error rather than a project `BaseException`/`SystemException`.
**Fix**: Use `new SystemException('NO_ACTIVE_PROMPT', ...)` or `new BusinessException(...)` so the error is handled consistently by the global exception filter and logged with structured context.

### [SUGGESTION]: Avoid Multiple `as Partial<...>` Casts on JSON Details

**Files**:
- `backend/src/modules/ai/processors/ai-batch.processor.ts` (`validateExtractionOutput`)
- `backend/src/modules/migration/migration-review.service.ts` (`computeUnresolvedFields`, `validateTagDecisionNames`)
- `backend/src/modules/migration/migration.service.ts` (`updateQueueEnrichment`, `isLegacyExtractionShape`)
**Issue**: `queueItem.details as Partial<MigrationAiExtractionDetails>` is repeated in several services. The cast provides compile-time typing but no runtime guarantee.
**Fix**: Move the JSON-to-`MigrationAiExtractionDetails` parsing/validation into a shared helper or a single `migrationService.parseExtractionDetails()` function, then use its typed result instead of casting in each consumer.

## What's Good

- **ADR-019 UUID**: No `parseInt()`, `Number()` on UUID, no `id ?? ''` fallbacks, and `publicId` is used consistently in the frontend.
- **TypeScript hygiene**: No `any` types and no `console.log` in the changed code.
- **ADR-007 exception hierarchy**: `UnresolvedFieldsException` extends `BaseException` and the commit gate rethrows `BaseException` instances instead of wrapping them in `SystemException`.
- **ADR-050 confidence contract**: `MigrationService.computeRequiresHumanReview` computes the flag deterministically from `ocrQuality.confidence` and `metadata.confidence.*` instead of trusting LLM output.
- **AI boundary (ADR-023)**: All AI calls go through `OllamaService`/`generateStructuredJson`; no direct database or storage access from the AI processor.
- **Input validation**: `CommitMigrationReviewDto` and `MigrationQueueQueryDto` use `class-validator`, `IsIn` for `fieldAcknowledgments`, and `ValidateNested` for `tagDecisions`.

## Recommended Actions

1. **Must fix before merge**: Sanitize user-supplied OCR text before prompt template substitution in `ai-batch.processor.ts`.
2. **Should address**: Refactor `linkTagToCorrespondence` to use TypeORM repositories instead of raw SQL.
3. **Consider for later**: Replace repeated `as Partial<MigrationAiExtractionDetails>` casts with a shared runtime validation helper.
