# Implementation Plan: Dynamic Prompt Management for OCR Extraction

**Branch**: `229-dynamic-prompt-management` | **Date**: 2026-05-25 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `specs/200-fullstacks/229-dynamic-prompt-management/spec.md`
**ADR Reference**: ADR-029, ADR-009, ADR-016, ADR-019, ADR-023/023A, ADR-027

---

## Summary

เพิ่มระบบ Versioned Prompt Management สำหรับ OCR extraction — แทนที่ hardcoded prompt ใน `processSandboxExtract` และ `processMigrateDocument` ด้วย DB-driven prompt ที่ Superadmin แก้ไขได้ runtime ผ่าน AI Admin Console พร้อมแก้ bug AI_TIMEOUT_MS และ Redis cache สำหรับ active prompt

---

## Technical Context

**Language/Version**: TypeScript 5.x — NestJS 11 (backend), Next.js 16 (frontend)
**Primary Dependencies**: TypeORM (MariaDB), Redis (ioredis), BullMQ, TanStack Query v5, shadcn/ui, Zod
**Storage**: MariaDB 11.8 (`ai_prompts` table via SQL delta), Redis (TTL 60s cache)
**Testing**: Jest (backend unit/integration), Vitest (frontend unit)
**Target Platform**: QNAP NAS (backend + frontend containers), Desk-5439 (Ollama + OCR sidecar)
**Project Type**: Web application (backend + frontend)
**Performance Goals**: Cache hit < 5ms; activation cycle < 1s
**Constraints**: ADR-009 no TypeORM migrations; ADR-019 no parseInt on UUID; ADR-016 CASL guard on all mutations; AI_TIMEOUT_MS bug fix scope = sandbox only
**Scale/Scope**: Single `prompt_type = 'ocr_extraction'`; expected < 20 versions total

---

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Principle | Status | Notes |
|-----------|--------|-------|
| ADR-009: No TypeORM migrations | ✅ PASS | Schema change via SQL delta in `specs/03-Data-and-Storage/deltas/` |
| ADR-019: UUID — no parseInt | ✅ PASS | `ai_prompts` uses INT PK (internal only); `prompt_type` + `version_number` are public identifiers (strings + ints, not UUID) |
| ADR-016: CASL guard on mutations | ✅ PASS | All 5 endpoints guarded with `system.manage_all` |
| ADR-007: Error handling | ✅ PASS | `BusinessException` for validation errors; NestJS Logger for technical logs |
| ADR-023/023A: AI boundary | ✅ PASS | Prompt is config data — stored in DB, not in AI model; Ollama call remains via existing `OllamaService` |
| ADR-008: BullMQ for background | ✅ PASS | Sandbox run already in `ai-batch` queue; no change to queue routing |
| TypeScript Strict | ✅ PASS | Zero `any`, zero `console.log` |
| i18n | ✅ PASS | All UI text via i18n keys |

---

## Project Structure

### Documentation (this feature)

```text
specs/200-fullstacks/229-dynamic-prompt-management/
├── plan.md              (this file)
├── research.md          (Phase 0 output)
├── data-model.md        (Phase 1 output)
├── quickstart.md        (Phase 1 output)
├── contracts/           (Phase 1 output)
│   └── prompts.yaml
├── checklists/
│   └── requirements.md
└── tasks.md             (Phase 2 output — /speckit-tasks)
```

### Source Code (repository root)

```text
backend/src/modules/ai/
├── prompts/                              [NEW MODULE]
│   ├── ai-prompts.entity.ts
│   ├── ai-prompts.service.ts
│   ├── ai-prompts.controller.ts
│   ├── ai-prompts.module.ts
│   └── dto/
│       ├── create-ai-prompt.dto.ts
│       ├── update-prompt-note.dto.ts
│       └── ai-prompt-response.dto.ts
├── processors/
│   └── ai-batch.processor.ts             [MODIFY — add resolvePrompt(), fix timeout]
└── ai.module.ts                          [MODIFY — import AiPromptsModule]

specs/03-Data-and-Storage/deltas/
└── 2026-05-25-create-ai-prompts.sql     [NEW — SQL delta per ADR-009]

frontend/
├── components/admin/ai/
│   ├── OcrSandboxPromptManager.tsx       [NEW — Prompt Editor + Version History]
│   └── PromptVersionHistory.tsx          [NEW — Version History panel]
├── lib/services/
│   └── ai-prompts.service.ts             [NEW — API client for prompts]
├── hooks/
│   └── use-ai-prompts.ts                 [NEW — TanStack Query hooks]
├── types/
│   └── ai-prompts.ts                     [NEW — TypeScript interfaces]
└── public/locales/{en,th}/
    └── ai-admin.json                     [MODIFY — add prompt management i18n keys]
```

**Structure Decision**: Web application (Option 2) — NestJS backend + Next.js frontend, standard LCBP3 monorepo pattern

---

## Phases

### Phase 0: Research (complete — findings below)

All unknowns resolved from ADR-029 + existing codebase patterns.

### Phase 1: Design & Contracts (this document + artifacts)

1. SQL delta for `ai_prompts` table — see `data-model.md`
2. API contract — see `contracts/prompts.yaml`
3. Seed data strategy — insert hardcoded prompt as version 1 in delta
4. Redis cache key strategy — `ai:prompt:active:{prompt_type}` TTL 60s

### Phase 2: Implementation

Follow tasks.md phases. Implementation entry point: see `quickstart.md`

---

## Key Design Decisions

### D1: AiPromptsService as Standalone Module
`AiPromptsService` lives in `ai/prompts/` sub-module and is imported into `AiModule`. This keeps version management logic separate from the batch processor while sharing the Redis connection.

### D2: resolvePrompt() Placement
`resolvePrompt(promptType, ocrText)` is a private method inside `AiBatchProcessor` (or extracted to `AiPromptsService.resolveActive()`). It must be accessible from both `processSandboxExtract` and `processMigrateDocument` — placing it in `AiPromptsService` is cleaner (injectable service vs private method).

### D3: Timeout Fix Scope
`timeoutMs: 120000` passed only to `processSandboxExtract` Ollama call. `processMigrateDocument` retains its existing job-level timeout (controlled by BullMQ job options), which is already longer.

### D4: Activation Transaction
`activate()` runs in a TypeORM transaction:
1. `UPDATE ai_prompts SET is_active = 0 WHERE prompt_type = ? AND is_active = 1`
2. `UPDATE ai_prompts SET is_active = 1, activated_at = NOW() WHERE id = ?`
3. **After** COMMIT (outside TX): Redis `DEL ai:prompt:active:ocr_extraction`

**Redis DEL failure behavior**: If Redis DEL fails after DB commit, do nothing — log `WARN` and let TTL 60s expire naturally. Stale-on-Redis-fail is in the same category as normal TTL expiry: max 60s window, acceptable per ADR-029 design intent. No retry, no error surfaced to admin (DB state is already correct).

### D5: Seed Data Strategy
Seed data inserted in the SQL delta file itself (not separate seed script) so it runs automatically with the schema change. Initial hardcoded prompt content extracted from `ai-batch.processor.ts` before migration.

### D6: Version Number Assignment
On create: `SELECT MAX(version_number) + 1 FROM ai_prompts WHERE prompt_type = ?` within a transaction. Uses `@VersionColumn` or DB-level unique constraint to prevent race conditions.
