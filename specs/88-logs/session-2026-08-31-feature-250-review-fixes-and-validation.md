# Session 2026-08-31 (continuation) — Feature 250 Review Fixes + Validation

## Summary

Continuation session ของ Feature 250 (AI Metadata Extraction Output Contract) — แก้ findings จาก code review (HIGH prompt injection, MEDIUM raw SQL → TypeORM, 2 suggestions) แล้วอัปเดต migration-review.service.spec.ts ให้สอดคล้องกับ TypeORM tag-linking refactor พร้อมรัน Antigravity Validator เพื่อสร้าง `validation-report.md`

## ปัญหาที่พบ (Root Cause)

1. **HIGH — OCR prompt injection**: `ai-batch.processor.ts` เคยทำ placeholder replacement เป็น 2 รอบ — รอบแรกแทน `{{ocr_text}}` รอบสองแทน placeholders อื่น ทำให้ OCR content ที่มี `{{allowed_categories}}` ถูก rescan และ expand ด้วยข้อมูลระบบ
2. **MEDIUM — Raw SQL tag linking**: `linkTagToCorrespondence` ใน `migration-review.service.ts` ใช้ `manager.query()` กับ raw SQL `SELECT id FROM tags` / `INSERT INTO tags` / `INSERT IGNORE INTO correspondence_tags` — เสี่ยง SQL injection และผูกกับ MySQL-specific syntax
3. **SUGGESTION — Generic Error**: `processLegacyAiEnrichment` throw `new Error('No active ocr_extraction prompt version found')` แทนที่จะใช้ `SystemException` ตาม ADR-007
4. **SUGGESTION — Repeated casts**: มี `as Partial<MigrationAiExtractionDetails>` ซ้ำหลายจุดใน migration + migration-review service
5. **Test mock drift**: หลังจากแก้ TypeORM tag linking แล้ว spec เดิมยัง assert SQL strings ใน `manager.query.mock.calls` ทำให้ 45 tests fail
6. **Missing mock dependency**: `MigrationReviewService.computeUnresolvedFields` เรียก `this.migrationService.parseExtractionDetails()` แต่ spec mock ไม่มี method นี้ ทำให้ทุก commit test ถูก wrap เป็น SystemException

## การแก้ไข (Fix)

| ไฟล์ | การเปลี่ยนแปลง |
| --- | --- |
| `backend/src/modules/ai/processors/ai-batch.processor.ts` | HIGH: แก้ placeholder replacement เป็น single-pass regex (inserted OCR ไม่ถูก rescan); SUGGESTION: `throw new Error(...)` → `throw new SystemException(...)` พร้อม import |
| `backend/src/modules/migration/migration-review.service.ts` | MEDIUM: `linkTagToCorrespondence` จาก raw SQL → `manager.findOne(Tag, ...)` + `manager.create(Tag, ...)` + `manager.save(Tag, ...)` + `manager.findOne(CorrespondenceTag, ...)` + `manager.save(CorrespondenceTag, ...)`; SUGGESTION: ใช้ `migrationService.parseExtractionDetails()` แทน direct cast |
| `backend/src/modules/migration/migration.service.ts` | SUGGESTION: เพิ่ม `parseExtractionDetails(raw: unknown)` helper ใช้ใน `isLegacyExtractionShape`, `updateQueueEnrichment`, และใน `MigrationReviewService` |
| `backend/src/modules/migration/migration-review.service.spec.ts` | Import `Tag`/`CorrespondenceTag` entities; เพิ่ม `parseExtractionDetails` mock; ปรับ `manager.findOne`/`manager.save` routing ให้รู้จัก Tag/CorrespondenceTag; เปลี่ยน 5 assertions จาก `manager.query.mock.calls` → `manager.findOne`/`manager.save` กับ entity class |
| `specs/200-fullstacks/250-ai-metadata-extraction-contract/review-report.md` | อัปเดตสถานะ findings |
| `specs/200-fullstacks/250-ai-metadata-extraction-contract/test-report.md` | อัปเดต test counts |
| `specs/200-fullstacks/250-ai-metadata-extraction-contract/validation-report.md` | สร้างใหม่ — Antigravity Validator report (PARTIAL: 14/14 FR, 4/4 edge cases, T048/T003 pending) |
| `specs/200-fullstacks/250-ai-metadata-extraction-contract/ai-ledger.md` | เพิ่ม checkpoint CP-VAL (post-implementation validation) |

## กฎที่ Lock แล้ว

- **D192**: AI prompt template substitution ต้องเป็น single-pass — ห้าม insert OCR text ก่อนแล้ว rescan เป็น template syntax (prompt injection prevention)
- **D193**: Tag linking ใน `migration-review.service.ts` ต้องใช้ TypeORM entity operations (`findOne`/`create`/`save`) เท่านั้น ห้าม raw SQL (`INSERT IGNORE` หรือ `SELECT id FROM tags`)
- **D194**: ใช้ `MigrationService.parseExtractionDetails()` helper แทน direct `as Partial<MigrationAiExtractionDetails>` cast ในทุกจุดของ migration + migration-review service

## Verification

- [x] `pnpm --filter backend build` — exit 0
- [x] `migration-review.service.spec` — 61/61 pass (จาก 16/61 → 61/61 หลังแก้ mock + assertions)
- [x] `ai-batch.processor.spec` — 38/38 pass (unchanged, regression-safe)
- [x] `validation-report.md` สร้าง — 14/14 FR + 4/4 edge cases mapped to implementation/tests
- [x] `ai-ledger.md` CP-VAL checkpoint appended
- [ ] T048 manual quickstart walk — ยังไม่ได้รัน (ต้องมี stack จริง)
- [ ] T003 prompt live application — ยัง pending (admin/DBA)
- [ ] Commit + push — pending user action
