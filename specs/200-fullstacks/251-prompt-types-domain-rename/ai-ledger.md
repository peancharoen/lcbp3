// File: specs/200-fullstacks/251-prompt-types-domain-rename/ai-ledger.md
// Change Log:
// - 2026-09-01: Initial assurance ledger for Feature 251

# AI Pipeline Assurance Ledger

> For ADR-029 dynamic prompt management + ADR-050 AI metadata contract changes spanning sessions.
> All AI processing must route through DMS API -> BullMQ; direct Ollama/Qdrant access is a protected boundary violation.

## Identity

- ASSURANCE_UNIT_ID: `lcbp3/ai/prompt-types-domain-rename`
- REOPEN_GENERATION: `0`
- LEDGER_LOCATION: `specs/200-fullstacks/251-prompt-types-domain-rename/ai-ledger.md`
- STATUS: `open`

## Authority and Boundary

- Objective: สร้าง `ai_prompt_types` master table + รวมหน้า prompt management + เปลี่ยนชื่อ `category` → `correspondenceType` ทั้งระบบ
- Acceptance criteria:
  1. ตาราง `ai_prompt_types` สร้าง + seed 7 types + FK จาก `ai_prompts`
  2. Unified prompt management page ใช้ dropdown จาก master table (รวม `migration_compare`, `rag_chunking`)
  3. URL เก่า redirect 308 ไปหน้าใหม่
  4. `category` → `correspondenceType` ทั้งระบบ (DB column, entity, DTO, types, frontend, i18n, ADR-050)
  5. Backend validation ใช้ master table แทน hardcoded switch
  6. Runtime fallback: `BusinessException` เมื่อ prompt type ไม่มีใน master table
  7. Delete protection: FK RESTRICT + application check
  8. Atomic deploy (backend+frontend+DB พร้อมกัน)
- Base state:
  - Branch: `251-prompt-types-domain-rename`
  - Ref: `<commit after plan phase>`
  - Model stack: `np-dms-ai + np-dms-ocr + BGE-M3 + BGE-Reranker`
  - AI runtime host: `np-dms-lcbp3`
- Declared final boundary: ทุก acceptance criteria ผ่าน + backend build ผ่าน + frontend tsc ผ่าน + focused tests ผ่าน + grep ไม่เหลือ `category` ใน migration review files
- Protected boundaries:
  - Direct Ollama/Qdrant calls from backend/frontend/n8n (ไม่กระทบ)
  - Cloud AI services (ไม่กระทบ)
  - Production deployment without audit logging (ไม่กระทบ)
  - ADR-029 prompt activation mechanism (ต้องไม่ละเมิด — เพิ่ม master table ไม่ได้ลบ mechanism เดิม)
  - ADR-050 AI metadata contract (breaking change — ต้อง deploy atomic)
  - Public API contract (breaking change — `category` → `correspondenceType`)

## Verification Profile

- FOCUSED_CHECKS:
  - `pnpm --filter backend test -- --testPathPatterns=ai-prompts --coverage=false`
  - `pnpm --filter backend test -- --testPathPatterns=migration-review.service --coverage=false`
  - `pnpm --filter backend build`
- CANDIDATE_CHECKS:
  - `pnpm --filter backend test -- --testPathIgnorePatterns=tests/performance`
  - `npx vitest run` (frontend)
  - `npx tsc --noEmit` (frontend)
- COMPOSE_CHECK:
  - not-applicable (schema delta รันบน production DB โดย DBA)

## Checkpoints

| ID | Scope changed | Verification commands/results | TDD evidence | Known gaps | Status |
| -- | ------------- | ----------------------------- | ------------ | ---------- | ------ |
| CP-PLAN | Plan phase complete | spec.md, plan.md, research.md, data-model.md, contracts/, quickstart.md | N/A (planning) | ไม่มี | complete |
| CP-IMPL-01 | Phase 1-6 + DB deploy + `resolveActive` enhancement | `pnpm --filter backend build` OK; `npx next build` OK; `npx tsc --noEmit` OK; backend lint OK; frontend lint OK; `pnpm --filter backend test` 2253/2264 passed; `npx vitest run` 993/993; `ai-prompts` 22/22; `ai-batch` 40/40; SQL delta active; `ocr_extraction` v3 active; `field_schema` อัปเดต; `resolveActive()` resolve ทั้ง `{{ocr_text}}` และ context placeholders (`master_data_context`, `allowed_correspondence_types`, `existing_tags`) ตาม template; Ollama reachable จาก backend ที่ `192.168.10.11:11434` | ai-prompt-types.service.spec.ts RED→GREEN; ai-batch.processor.spec.ts FR-010 old-key rejection test passes | running backend ยังใช้ image เก่า (`lcbp3-backend:ea5780b6`) + `OLLAMA_URL` ชี้ `192.168.10.8`/`10.10` ทีไม่ reachable ต้อง rebuild/restart backend เพื่อ run end-to-end จริง | complete |

## AI-Specific Risks

- Model version drift: `no — ไม่กระทบ model stack`
- Prompt injection surface: `ไม่เพิ่ม surface ใหม่ — เปลี่ยน placeholder name เท่านั้น`
- PII/sensitive data exposure: `no — ไม่กระทบ data flow`
- GPU queue saturation risk: `no — ไม่กระทบ BullMQ queue`
- Multi-tenant isolation gap: `no — prompt types เป็น global ไม่ใช่ per-project`

## Breaking Change Register

| Change | Impact | Mitigation |
|---|---|---|
| `ai_prompts.prompt_type` FK constraint | ไม่กระทบ existing data (seed ก่อน FK) | SQL delta ลำดับ: CREATE → INSERT → ALTER |
| `migration_review_queue.ai_suggested_category` rename | Column name เปลี่ยน — query เดิมพัง | Atomic deploy (FR-015) |
| `category` → `correspondenceType` ใน API contract | Frontend ส่ง field เดิมไม่ได้ | Atomic deploy (FR-015) |
| `{{allowed_categories}}` → `{{allowed_correspondence_types}}` ใน prompt | LLM output เดิมไม่ผ่าน validation | ต้อง activate prompt version ใหม่ (follow-up task) |
| `PromptType` union → `string` ใน frontend | Type safety ลดลด | Runtime validation จาก API response |
