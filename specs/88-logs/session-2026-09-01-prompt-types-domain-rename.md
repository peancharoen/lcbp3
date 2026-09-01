# Session 2026-09-01 — Feature 251 Prompt Types Domain Rename + OCR Extraction Prompt Activation

## Summary

Feature 251 เกี่ยวกับการ rename `category` → `correspondenceType` ทั้งระบบ และแยก `ai_prompt_types` ออกมาเป็น master table แทนการ hardcode `prompt_type` ใน `ai_prompts` พร้อมรวมหน้า Prompt Management เป็นหน้าเดียว ในวันนี้ทำให้สมบูรณ์ทั้ง schema, backend, frontend, tests, DB activation, และ commit/push ไป `main`

## ปัญหาที่พบ (Root Cause)

- `ocr_extraction` prompt version 2 ใช้ contract เก่า (`category`/`tags[]`/scalar confidence) และ template เก่าไม่ตรง ADR-050
- `resolveActive()` resolve เฉพาะ `{{ocr_text}}` ทำให้ placeholder `{{allowed_correspondence_types}}` / `{{existing_tags}}` / `{{master_data_context}}` ไม่ถูกแทนที่ถ้า caller ไม่ทำเอง
- `OLLAMA_URL` ดูเหมือนจะชี้ไป IP ทีไม่ reachable แต่จริง ๆ แล้ว container env ถูกตั้งไว้ที `192.168.10.11:11434` อยู่แล้ว

## การแก้ไข (Fix)

| ไฟล์ | การเปลี่ยนแปลง |
| ----- | --------------- |
| `specs/03-Data-and-Storage/deltas/2026-09-01-ai-prompt-types-and-category-rename.sql` | สร้าง `ai_prompt_types` + seed 7 types + FK + rename `ai_suggested_category` → `ai_suggested_correspondence_type` |
| `backend/src/modules/ai/prompts/ai-prompt-types.*` | Entity, DTOs, Service, Controller สำหรับ master table |
| `backend/src/modules/ai/prompts/ai-prompts.service.ts` | `resolveActive()` resolve `{{ocr_text}}` + context placeholders ตาม template |
| `backend/src/modules/ai/processors/ai-batch.processor.ts` | แทน `{{allowed_categories}}` ด้วย `{{allowed_correspondence_types}}` + resolve context placeholders ในทุก path |
| `backend/src/modules/migration/*` | Rename `category` → `correspondenceType` ทั้ง DTOs/entities/services/tests |
| `frontend/app/(admin)/admin/ai/prompt-management/*` | รวม prompt management เป็นหน้าเดียว + รองรับ `ai_prompt_types` dropdown |
| `frontend/components/migration/*` | ปรับ review queue/detail page ใช้ `correspondenceType` และ tag decisions |
| `frontend/lib/types/ai-prompts.ts` | Frontend types ใช้ `correspondenceType` แทน `category` |
| `specs/06-Decision-Records/ADR-050-ai-metadata-extraction-output-contract.md` | Update contract เป้น `correspondenceType` + per-field confidence |
| `specs/200-fullstacks/250-ai-metadata-extraction-contract/prompts/ocr_extraction.md` | Update template placeholders เป็น `allowed_correspondence_types` |
| `specs/200-fullstacks/251-prompt-types-domain-rename/*` | Feature spec, plan, tasks, data model, contracts, quickstart, ai-ledger |

## กฎที่ Lock แล้ว

- D251: `ai_prompt_types` เป็น master table สำหรับ `prompt_type` — `ai_prompts.prompt_type` มี FK ไป `ai_prompt_types.prompt_type` with `ON DELETE RESTRICT`
- D252: `correspondenceType` แทน `category` ทั้ง domain model, frontend, backend, i18n, และ ADR-050 prompt output contract
- D253: `ocr_extraction` v3 active ใช้ canonical ADR-050 template (`{{ocr_text}}`, `{{allowed_correspondence_types}}`, `{{existing_tags}}`, `{{master_data_context}}`)
- D254: `resolveActive()` ต้อง resolve ทุก placeholder ที่ปรากฏใน template ไม่ใช่แค่ `{{ocr_text}}`

## Verification

- [x] MariaDB `ai_prompt_types` 7 rows + FK + column rename
- [x] `ocr_extraction` v3 active (`is_active=1`, `version_number=3`, `field_schema` valid)
- [x] Backend build + lint pass
- [x] Backend tests 2253/2264 passed (11 skipped)
- [x] Frontend build + tsc + lint pass
- [x] Frontend vitest 993/993 passed
- [x] `ai-prompts` 22/22, `ai-batch` 40/40 passed
- [x] Squash commit + push `main` สำเร็จ (`8584d52a`)

## Follow-up

- [ ] Rebuild + restart backend container เพื่อ run end-to-end กับ Ollama จริง (container ปัจจุบันยังเป็น image เก่า `lcbp3-backend:ea5780b6`)
