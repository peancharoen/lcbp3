# Session — 2026-09-09 (Feature 252 Frontend Menu Gap + Branch-Reset Hazard)

## Summary

ผู้ใช้รายงานว่าเปิด `/opt/np-dms-lcbp3/specs/200-fullstacks/252-excel-data-review-pipeline`
(ADR-052, 4-Layer Excel Data Review Pipeline) แล้วไม่เห็นเมนูใดๆ ในหน้าเว็บเลย ตรวจพบว่า
spec/plan/tasks ถูก generate เป็น backend-only ตั้งแต่ต้น (T001-T027) ไม่มี task สำหรับ
frontend เลยสักตัว — เพิ่ม Phase 8 (T028-T031) ปิด gap พร้อมแก้บั๊กจริงที่พบระหว่างทาง
(double API-prefix ทำให้ endpoint ใช้งานไม่ได้ตั้งแต่สร้าง) แล้ว merge เข้า `main` สำเร็จ

## ปัญหาที่พบ (Root Cause)

### 1. Feature 252 ไม่มี frontend task เลย (D292)

`tasks.md` เดิมมี T001-T027 ทั้งหมดเป็นงาน backend (`backend/src/modules/migration/...`)
ไม่มี task ใดพูดถึง page, route, หรือเมนู — grep `excel`/`import-review` ทั่ว
`frontend/{app,components,lib,hooks,types}` ไม่เจออะไรเลย ยืนยันว่าไม่ใช่บั๊ก/permission-guard
ที่ซ่อนเมนูไว้ แต่เป็น scope gap ตั้งแต่ตอน speckit-tasks generation

### 2. Double API-prefix bug ใน `ExcelImportReviewController` (D293)

`@Controller('api/v1/correspondence/import-review')` ประกาศ full path ทับซ้อนกับ
`app.setGlobalPrefix('api')` ใน `main.ts:59` ทำให้ route จริงกลายเป็น
`/api/api/v1/correspondence/import-review/...` — **endpoint ทั้งหมดใช้งานไม่ได้เลยตั้งแต่สร้าง
(Wave 3, 2026-09-06)** ไม่มีใครสังเกตเพราะ unit/integration test เรียก service method
ตรงๆ ข้าม controller/global-prefix ไปเลย ไม่มี e2e ที่ยิง HTTP request จริง

### 3. Branch/main reset hazard เกิดขึ้นจริงระหว่าง session (D294, ยืนยัน D264/D271 ด้วยหลักฐานใหม่)

ระหว่างแก้ 4 ไฟล์ tracked (`excel-import-review.controller.ts`, `sidebar.tsx`, `tasks.md`,
`plan.md`) บน `main` ตรงๆ ไฟล์ถูก revert กลับเป็นเนื้อหาเดิมเงียบๆ กลางการทำงาน (ไฟล์ใหม่ที่ยัง
untracked ไม่โดน) ตรวจ `git reflog` เจอ pattern `reset: moving to origin/main` สลับกับ
`commit`/`pull --rebase` ต่อเนื่อง — ยืนยันว่ามีกระบวนการอื่น (agent/session อื่นบนเครื่องเดียวกัน
ไม่มี worktree แยก) sync `main` อยู่ตลอดเวลาจริง ไม่ใช่แค่ทฤษฎี

## การแก้ไข (Fix)

| ไฟล์ | การเปลี่ยนแปลง |
| --- | --- |
| `backend/src/modules/migration/excel-import-review.controller.ts` | `@Controller('api/v1/...')` → `@Controller('v1/correspondence/import-review')` (แก้ double-prefix) |
| `frontend/components/admin/sidebar.tsx` | เพิ่มเมนู "ตรวจสอบข้อมูลนำเข้า Excel" → `/admin/import-review` ใน Operations group |
| `frontend/types/import-review.ts` | ใหม่ — mirror backend response types |
| `frontend/lib/services/import-review.service.ts` | ใหม่ — check/confirm/cancel/downloadAnnotated/downloadFailedRows |
| `frontend/hooks/use-import-review.ts` | ใหม่ — TanStack Query mutation hooks |
| `frontend/app/(admin)/admin/import-review/page.tsx` | ใหม่ — upload form, review dashboard, confirm/cancel, post-confirm quarantine panel (US3, D6) |
| `frontend/{app,hooks,lib/services}/**/__tests__/*` | ใหม่ — 17 tests (service/hooks/page), ครอบคลุม CASL gating (D7/D2), canConfirm=false BLOCK, quarantine download |
| `specs/200-fullstacks/252-excel-data-review-pipeline/{tasks,plan}.md` | เพิ่ม Phase 8 (T028-T031) + frontend source tree |

## กฎที่ Lock แล้ว

- D292: Speckit tasks.md ของ fullstack feature ต้องเช็คว่ามี frontend task จริง อย่าเชื่อ "ผ่านทุก task = feature ใช้งานได้จริง"
- D293: ห้ามใส่ `'api'`/`'v1'` ตรงๆ ใน `@Controller()` — global prefix เติมให้อัตโนมัติแล้ว ต้อง diff กับ controller อื่นก่อนสร้างใหม่เสมอ
- D294: เจอ revert ระหว่าง session ให้ `git checkout -b` ทันที + commit ทุกจุดบน branch แยก + rebase กับ `origin/main` ก่อน merge/push เสมอ (ห้าม merge branch ที่ไม่ได้ rebase ล่าสุด)

## Verification

- [x] `pnpm --filter backend build` / `lint:ci` — ผ่าน
- [x] `pnpm --filter backend test` — 2593 passed, 17 skipped, 0 failed
- [x] `pnpm --filter lcbp3-frontend build` / `lint` (`--max-warnings 0`) — ผ่าน
- [x] `pnpm --filter lcbp3-frontend test run` — 1026 passed (รวม 17 tests ใหม่)
- [x] Security review (`security-review` skill) — ไม่มี blocking finding
- [x] Squash + push ผ่าน `2git.sh` → `origin/main` commit `e6e50553`
- [ ] Browser verify จริง (upload → review → confirm) — **ยังไม่ได้ทำ**
