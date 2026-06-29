# Session 2026-06-14 — Feature 237 Code Review

## Summary

Reviewed `specs/200-fullstacks/237-unified-prompt-management-ux-ui` and the related working-tree changes for Unified Prompt Management UX/UI. The review report was saved to `specs/200-fullstacks/237-unified-prompt-management-ux-ui/code-review-report.md` with overall status `REQUEST CHANGES`.

## ปัญหาที่พบ (Root Cause)

- Backend build is blocked by a partial `backend/src/modules/rfa/rfa.service.ts` ADR-001/021 migration: removed routing dependencies are still referenced, `RfaService.WORKFLOW_CODE` is missing, and one line appears corrupted.
- Prompt context filters mix public UUID strings from the frontend with internal numeric IDs in `AiPromptsService.resolveContext()`, causing `Number(uuid)` to become `NaN` and potentially disabling project scoping.
- New prompt/admin sandbox mutations do not consistently enforce `Idempotency-Key`, despite AGENTS/ADR-016 requirements for critical `POST`/`PUT`/`PATCH`.
- New prompt seeds and service validation disagree on placeholders for `rag_query_prompt`, `rag_prep_prompt`, and `classification_prompt`.
- DTOs accept weak string/object shapes for public IDs and sandbox text.

## การแก้ไข (Fix)

| ไฟล์ | การเปลี่ยนแปลง |
| ---- | -------------- |
| `specs/200-fullstacks/237-unified-prompt-management-ux-ui/code-review-report.md` | บันทึก Code Review Report พร้อม findings และ verification |
| `specs/88-logs/session-2026-06-14-feature-237-code-review.md` | บันทึก session log สำหรับ review นี้ |
| `specs/88-logs/rollouts.md` | เพิ่ม rollout row ของ Feature-237 review |
| `memory/project-memory-override.md` | เพิ่ม Next Session Focus สำหรับ Feature-237 follow-up |

## กฎที่ Lock แล้ว

ไม่มี decision ใหม่ใน session นี้ ใช้กฎเดิมจาก AGENTS.md/ADR-016/ADR-019/ADR-023A/ADR-029 ต่อไป:

- Public API และ frontend ต้องใช้ `publicId` UUID เท่านั้น ห้ามแปลง UUID เป็น number.
- Mutating endpoints ที่ critical ต้องมี `Idempotency-Key`.
- AI prompt/context work ต้องรักษา project boundary และ validation ก่อนส่ง context เข้า AI.

## Verification

- [x] `pnpm --filter lcbp3-frontend exec tsc --noEmit` ผ่าน
- [x] `pnpm --filter backend build` รันแล้วและพบ failure ที่ต้องแก้ก่อน merge
- [x] Review artifact created: `specs/200-fullstacks/237-unified-prompt-management-ux-ui/code-review-report.md`

