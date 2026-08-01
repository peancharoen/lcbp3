// File: specs/88-logs/session-2026-07-31-tier1-pending-work.md
// Change Log:
// - 2026-07-31: Initial creation — Tier 1 pending work from Next Session Focus

# Session 2026-07-31 — Tier 1 Pending Work

**Scope:** ดำเนินการ Tier 1 pending items จาก `memory/project-memory-override.md` Next Session Focus
**Status:** ✅ COMPLETE

## งานที่ดำเนินการ

### Tier 1 #1: Build + Deploy — ✅ Already Done (per user)

User ยืนยันว่า Build + Deploy ได้ดำเนินการแล้ว

### Tier 1 #2-5: Feature-237 Code Review Fixes — ✅ COMPLETE

ตรวจสอบ code จริงใน `backend/src/modules/ai/` พบว่า #2, #3, #5 ได้ดำเนินการไปแล้วใน session ก่อนหน้า:

#### #2 Security/data isolation (verified)
- `ai-prompts.service.ts` ใช้ `readPromptContextScope()` อ่าน `projectPublicId`/`contractPublicId` จาก `prompt-context-scope.util.ts`
- resolve เป็น internal IDs ผ่าน `createQueryBuilder().where('p.uuid = :uuid')` — ไม่มี `Number(uuid)`
- มี Gatekeeper ป้องกัน Cross-project boundary violation

#### #3 Idempotency (verified)
- `ai-prompts.controller.ts`: `assertIdempotencyKey()` บน create/activate/context-config
- `ai.controller.ts`: `@Headers('idempotency-key')` + `ValidationException` บน sandbox/rag-prep
- `frontend/lib/services/admin-ai.service.ts`: ส่ง `Idempotency-Key` header ทุก mutation

#### #5 Prompt contract (verified)
- `ai-prompts.service.ts` validator สอดคล้องกับ spec FR-023/FR-026
- `ai-batch.processor.ts` replacement logic ตรงกับ validator
- Placeholders: `ocr_extraction`={{ocr_text}}+{{master_data_context}}, `rag_query_prompt`={{query}}+{{context}}, `rag_prep_prompt`={{text}}, `classification_prompt`={{document_text}}

#### #4 DTO hardening (DONE this session)
Files modified:
- `backend/src/modules/ai/dto/context-config.dto.ts`:
  - `ContextFilterDto`: `@IsUUID('7')` สำหรับ `projectPublicId`/`contractPublicId` + legacy alias `projectId`/`contractId`
  - `ContextConfigDto`: `@ValidateNested()`+`@Type(() => ContextFilterDto)`, `@Max(1000)` pageSize, `@IsEnum(['th','en','mixed'])` language/outputLanguage
- `backend/src/modules/ai/dto/sandbox-rag-prep.dto.ts`:
  - `@MaxLength(200_000)` สำหรับ text
  - `@IsUUID('7')` สำหรับ profileId
- `backend/src/modules/ai/prompts/ai-prompts.service.ts`:
  - `updateContextConfig()` รองรับทั้ง `projectPublicId` และ legacy `projectId`
  - normalize filter เป็น `projectPublicId`/`contractPublicId` ก่อนบันทึก

### Tier 1 #6: Qdrant Hybrid Schema — ✅ Already Correct

ตรวจสอบ Qdrant collection `lcbp3_vectors` ผ่าน REST API (`http://192.168.10.11:6333`):
- `bge_dense` (1024 dims, Cosine) ✅
- `bge_sparse` (SPLADE) ✅
- Payload indexes: `project_public_id` (tenant), `doc_public_id`, `status_code`, `doc_type` ✅
- `points_count: 0` (empty — no data loss risk)
- `qdrant.service.ts` `ensureCollection()` auto-upgrade เมื่อ backend restart

**ไม่ต้อง drop/recreate** — schema ถูกต้องตาม D12 แล้ว

### Tier 1 #7: Decision ID Conflict Resolution — ✅ COMPLETE

Renumber D-IDs ชุดใหม่ (sessions 2026-07-30 ถึง 2026-07-31) จาก D33-D41 → D51-D59:
- D33→D51, D34→D52, D35→D53, D36→D54, D37→D55, D38→D56, D39→D57, D40→D58, D41→D59
- D33-D43 ชุดเก่า (sessions 2026-07-03 ถึง 2026-07-21) คงเดิม
- เพิ่ม D60 สำหรับ DTO hardening pattern ใหม่

Files updated:
- `memory/project-memory-override.md` — renumber + mark conflict resolved
- `specs/88-logs/session-2026-07-30-adr-040-phase2-x-api-key-removal.md` — D38-D41 → D56-D59
- `specs/88-logs/session-2026-07-30-ai-ingestion-flow-reconciliation.md` — D33-D37 → D51-D55

## Verification

- `pnpm --filter backend exec tsc --noEmit` — exit 0 ✅
- `npx jest ai-prompts.service.spec.ts` — 22/22 tests ผ่าน ✅
- Pre-existing failures: `correspondence.service.spec.ts` (5 tests) — unrelated to this session's changes (verified via git stash)

## กฎที่ Lock แล้ว

- **D60:** Context Config DTO Hardening (Feature-237) — `ContextFilterDto` ใช้ `@IsUUID('7')` สำหรับ `projectPublicId`/`contractPublicId` (รองรับ legacy alias `projectId`/`contractId`); `ContextConfigDto` ใช้ `@ValidateNested()`+`@Type(() => ContextFilterDto)`, `@Max(1000)` pageSize, `@IsEnum(['th','en','mixed'])` language/outputLanguage; `SandboxRagPrepDto` ใช้ `@MaxLength(200_000)` text + `@IsUUID('7')` profileId; service normalize filter เป็น `projectPublicId`/`contractPublicId` ก่อนบันทึก

## Files Modified

| File | Change |
|------|--------|
| `backend/src/modules/ai/dto/context-config.dto.ts` | DTO hardening — @IsUUID, @ValidateNested, @Max, @IsEnum |
| `backend/src/modules/ai/dto/sandbox-rag-prep.dto.ts` | DTO hardening — @MaxLength, @IsUUID |
| `backend/src/modules/ai/prompts/ai-prompts.service.ts` | updateContextConfig — support projectPublicId + normalize filter |
| `memory/project-memory-override.md` | D51-D59 renumber + D60 + Feature-237 status + Qdrant status + version bump |
| `specs/88-logs/session-2026-07-30-adr-040-phase2-x-api-key-removal.md` | D38-D41 → D56-D59 |
| `specs/88-logs/session-2026-07-30-ai-ingestion-flow-reconciliation.md` | D33-D37 → D51-D55 |
