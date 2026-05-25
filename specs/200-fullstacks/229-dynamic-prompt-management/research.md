# Research: Dynamic Prompt Management for OCR Extraction

**Feature**: `229-dynamic-prompt-management`
**Date**: 2026-05-25

---

## R1: Hardcoded Prompt Location

**Decision**: Extract hardcoded prompt from `ai-batch.processor.ts` (both `processSandboxExtract` and `processMigrateDocument`) before removing it
**Rationale**: This exact text becomes the seed data for `ai_prompts` version 1 — must preserve exact wording
**Action Required**: Before creating the delta, read the current hardcoded prompt from the processor to capture the exact template

---

## R2: Redis Cache Strategy for Active Prompt

**Decision**: Cache key `ai:prompt:active:{prompt_type}`, TTL 60s, invalidate on `activate()` with `RedisClient.del()`
**Rationale**: Active prompt changes infrequently (only on admin action). 60s TTL means max 60s delay for processors to pick up new prompt — acceptable per ADR-029. If Redis unavailable, fall back to DB query.
**Alternatives considered**:
- TTL 5min (same as intent patterns, ADR-024): Rejected — prompt activation should propagate faster than intent patterns
- No cache (always DB): Rejected — every BullMQ job would hit DB; ai-batch can process many jobs concurrently

---

## R3: Version Number Race Condition Prevention

**Decision**: Use `SELECT MAX(version_number) + 1 FROM ai_prompts WHERE prompt_type = ? FOR UPDATE` within a DB transaction; UNIQUE KEY `uk_type_version` on `(prompt_type, version_number)` provides final guard
**Rationale**: Concurrent create requests could generate the same version number. `FOR UPDATE` row lock + unique constraint prevents this cleanly without Redis Redlock (not needed for admin-only low-frequency operations)
**Alternatives considered**:
- Redis Redlock (ADR-002): Recommended for document numbering — overkill for admin-only prompt versioning; admin operations are inherently low-concurrency

---

## R4: AiPromptsService.resolveActive() vs Private Method in Processor

**Decision**: Implement `resolveActive(promptType: string): Promise<AiPrompt>` in `AiPromptsService` and inject service into processor
**Rationale**: Both `processSandboxExtract` and `processMigrateDocument` call the same method — centralizing in service enables unit testing independently of processor; processor depends on service (correct direction)
**Alternatives considered**:
- Private method in processor: Cannot be unit tested independently; duplicated if multiple processors need it in the future

---

## R5: Activation Transaction Isolation

**Decision**: Use TypeORM `EntityManager.transaction()` for activate() — deactivate old + activate new + log to audit_logs in single transaction
**Rationale**: Prevents state where two versions are active simultaneously (even briefly). audit_logs insert inside transaction ensures no audit record without state change.
**Pattern**: Follows existing `WorkflowEngineService` transaction patterns in codebase

---

## R6: OcrSandboxPromptManager Component Architecture

**Decision**: Single component `OcrSandboxPromptManager` with two panels — left: `PromptEditor` (textarea + save button), right: `PromptVersionHistory` (list + Load/Activate/Delete actions). File upload + sandbox run at bottom.
**Rationale**: Matches ADR-029 UI mockup. Two-column layout on desktop (md:grid-cols-2), stacked on mobile. `useAiPrompts` TanStack Query hook provides version list with optimistic updates on activate.

---

## R7: Existing Patterns to Reuse

| Pattern | Source | Reuse |
|---------|--------|-------|
| CASL guard decorator | `@UseGuards(JwtAuthGuard, CaslAbilityGuard)` | All 5 endpoints |
| Audit decorator | `@Audit(...)` from audit-log module | activate, create, delete |
| Redis inject | `@InjectRedis()` from `@liaoliaots/nestjs-redis` | AiPromptsService |
| TanStack Query | `useMutation` + `useQuery` | `useAiPrompts` hook |
| BusinessException | `backend/src/common/exceptions/` | Validation errors |

---

## R8: SQL Delta Filename Convention

**Decision**: `2026-05-25-create-ai-prompts.sql` in `specs/03-Data-and-Storage/deltas/`
**Rationale**: Follows existing delta naming pattern (e.g., `2026-05-22-alter-migration-review-queue.sql`)
**Action**: Include both `CREATE TABLE` and `INSERT` seed data in same file
