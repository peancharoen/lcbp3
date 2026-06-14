# Session 17 - 2026-06-14 (Frontend Test Coverage)

## Summary

Implemented additional frontend unit/component tests for Feature-303 and lifted frontend statement coverage above the Phase 2 gate. The verified coverage run now reports 92 passed test files, 692 passed tests, and 51.62% statements.

## ปัญหาที่พบ (Root Cause)

Frontend coverage was still below the Feature-303 Phase 2 target after the first coverage expansion. The biggest remaining gaps were uncovered state/i18n utilities, Circulation rendering branches, the large OCR sandbox prompt manager, and Layout widgets.

## การแก้ไข (Fix)

| ไฟล์ | การเปลี่ยนแปลง |
| ---- | -------------- |
| `frontend/lib/stores/__tests__/auth-store.test.ts` | เพิ่ม test สำหรับ auth state transitions, logout, role และ permission helpers |
| `frontend/lib/i18n/__tests__/index.test.ts` | เพิ่ม test สำหรับ Thai/English translator, fallback key และ template params |
| `frontend/components/circulation/__tests__/circulation-list.test.tsx` | ปรับ DataTable mock ให้ render column cells จริง เพื่อครอบ status, progress, fallback และ action link |
| `frontend/components/admin/ai/__tests__/ocr-sandbox-prompt-manager.test.tsx` | เพิ่ม smoke/interaction tests สำหรับ OCR sandbox prompt manager ด้วย mocked hooks/services |
| `frontend/components/layout/__tests__/layout-widgets.test.tsx` | เพิ่ม tests สำหรับ Sidebar, MobileSidebar, GlobalSearch, ProjectSwitcher, NotificationsDropdown และ UserMenu |
| `specs/300-others/303-frontend-test-coverage/tasks.md` | อัปเดต task checklist สำหรับงานที่ verify แล้ว |
| `specs/300-others/303-frontend-test-coverage/plan.md` | บันทึก coverage run record ล่าสุด |

## กฎที่ Lock แล้ว

ไม่มี decision ใหม่ที่ต้อง lock เพิ่มใน memory ระดับ project. งานนี้ยืนยัน pattern เดิม: mark task complete เฉพาะหลัง `tsc` และ coverage run ผ่านจริงเท่านั้น.

## Verification

- [x] `pnpm --filter lcbp3-frontend exec tsc --noEmit`
- [x] `pnpm --filter lcbp3-frontend exec vitest run --coverage`
- [x] Coverage: Statements 51.62%, Branches 41.03%, Functions 50.27%, Lines 52.47%
- [x] Feature-303 Phase 2 gate passed (Statements >= 50%)

## Next

- [ ] T034: เพิ่ม coverage สำหรับ Admin dashboard components
- [ ] T050-T053: ทำ cross-cutting audit สำหรับ `any`/`console.log`, `publicId` mock data, file headers, และ final coverage record
- [ ] Phase 3 target remains 70% statements
