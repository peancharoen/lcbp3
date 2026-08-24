# Session 2026-08-24 — 248 AI Engine Control Center: FR-005 + ESLint Cleanup

## Summary

ปิด 2 blockers สุดท้ายของ feature `248-ai-engine-control-center` ทำให้ validation status ย้ายจาก `PARTIAL` → `PASS`:
1. **FR-005**: สร้าง canonical model catalog UI แสดงทั้ง loaded + unloaded models พร้อม residency status
2. **Backend ESLint**: แก้ 18 errors ทั้งหมด (unused imports, `parseInt` on pagination, unsafe `any` access, regex escape)

นอกจากนั้นย้าย `status-dashboard.md` จาก `specs/200-fullstacks/` ไป `specs/00-overview/00-07-speckit-status-dashboard.md` ตาม `.devin/rules/13-specs-folder-organization.md` (เป็น project-wide overview ไม่ใช่ artifact ของหมวด 200)

## ปัญหาที่พบ (Root Cause)

### FR-005 — Canonical Model Catalog ขาด
`CombinedOllamaEngineCard` แสดงเฉพาะ loaded models ใน VRAM table เท่านั้น ไม่มี canonical catalog ที่รวมทั้ง loaded + unloaded models พร้อม residency status ที่ชัดเจน — ผู้ดูแลระบบไม่เห็น model ที่ยังไม่โหลด ทำให้ไม่รู้ว่ามี model อะไรให้ load บ้าง

### Backend ESLint — 18 errors (Tier 1 CI blocker)
- `ai-queue.service.spec.ts:51` — `ttl` arg ใน `set` mock ไม่ได้ใช้
- `ai-queue.service.ts:26` — `ClearFailedJobsStatusDto` import ไม่ได้ใช้ (ใช้ผ่าน inline `import()` type)
- `ai.controller.ts:126` — `QueueJobItemDto` import ไม่ได้ใช้
- `ai.controller.ts:562-563` — `parseInt()` บน pagination params (query string numbers ไม่ใช่ UUID แต่ ESLint rule บล็อกทุกกรณี)
- `ai-batch.processor.spec.ts` — 12 unsafe member access บน `any` จาก `mock.calls` array + `JSON.parse()` ที่ return `any`
- `node-metrics.service.ts:203` — unnecessary escape `\-` ใน character class

## การแก้ไข (Fix)

| ไฟล์ | การเปลี่ยนแปลง |
|------|----------------|
| `frontend/components/admin/ai/CombinedOllamaEngineCard.tsx` | เปลี่ยน VRAM table เป็น canonical catalog: hardcoded `[MAIN_MODEL_NAME, OCR_MODEL_NAME]` + `loadedModelMap` (Map<canonical, loaded view>) + `catalogRows` แสดง residency + context-aware Load/Unload buttons; ใช้ `toCanonicalModel()` จาก `ai-constants.ts` |
| `frontend/public/locales/en/common.json` | +9 i18n keys: `ai.vram.catalog.title/capacityOk/capacityLow/column.{model,residency,vram}` + `ai.vram.residency.{loaded,notLoaded}` |
| `frontend/public/locales/th/common.json` | +9 i18n keys (Thai translations) |
| `backend/src/modules/ai/ai-queue.service.spec.ts` | `ttl` → `_ttl` ใน `set` mock signature |
| `backend/src/modules/ai/ai-queue.service.ts` | ลบ unused `ClearFailedJobsStatusDto` import |
| `backend/src/modules/ai/ai.controller.ts` | ลบ unused `QueueJobItemDto` import; `parseInt(page, 10)` → `Number(page)`; `parseInt(limit, 10)` → `Number(limit)` |
| `backend/src/modules/ai/processors/ai-batch.processor.spec.ts` | Cast `mock.calls` entries เป็น `[string, number, string]` + typed `JSON.parse()` results แทน `any` |
| `backend/src/modules/ai/services/node-metrics.service.ts` | `[\d.e+\-]` → `[\d.e+-]` (hyphen ไม่ต้อง escape ท้าย character class) |
| `specs/00-overview/00-07-speckit-status-dashboard.md` | ย้ายจาก `specs/200-fullstacks/status-dashboard.md` — 248 status PARTIAL→PASS, validation partial 3→2, features PASS 11→12, priority action อัปเดต |
| `specs/200-fullstacks/248-ai-engine-control-center/validation-report.md` | Status FAIL→PASS, FR-005 + ESLint fix sections, final validation status |

## กฎที่ Lock แล้ว

- **D147 — Canonical Model Catalog Pattern**: `CombinedOllamaEngineCard` แสดง canonical catalog `[MAIN_MODEL_NAME, OCR_MODEL_NAME]` เสมอ (ไม่ใช่ dynamic list ของ loaded models) — residency status badge แยก `Loaded`/`Not Loaded` + context-aware Load/Unload buttons ต่อ row; ใช้ `toCanonicalModel()` helper จาก `ai-constants.ts` (D80) เพื่อ normalize runtime names
- **D148 — `parseInt` ESLint Rule Scope**: ESLint rule บล็อก `parseInt` ทุกกรณีใน backend ไม่เฉพาะ UUID — สำหรับ pagination params ให้ใช้ `Number()` แทน (ทำงานเหมือน `parseInt(x, 10)` สำหรับ string ที่เป็นตัวเลขล้วน); `Number('123')` = 123, `Number('abc')` = NaN ซึ่ง `|| default` fallback จัดการ
- **D149 — Status Dashboard Location**: `status-dashboard.md` ย้ายไป `specs/00-overview/00-07-speckit-status-dashboard.md` ตาม `13-specs-folder-organization.md` — เป็น project-wide overview ครอบคลุม features ทั้ง 38 ตัวข้าม 3 หมวด (100/200/300) ไม่ใช่ artifact ของหมวด 200

## Verification

- [x] Frontend `pnpm lint` — 0 errors, 0 warnings
- [x] Frontend `pnpm build` — `next build` สำเร็จ
- [x] Backend `pnpm lint` — 0 errors, 0 warnings (was 18 errors)
- [x] Backend `pnpm build` — `nest build` สำเร็จ
- [x] Backend `pnpm test` — 109 suites, 1083 tests passed, 10 skipped, 0 failed
- [x] `validation-report.md` status: FAIL → PASS
- [x] `status-dashboard.md` 248 row: PARTIAL → PASS, blockers 2 → 0
- [x] ไม่มี reference ถึง path เดิม `200-fullstacks/status-dashboard.md` ในไฟล์อื่น
