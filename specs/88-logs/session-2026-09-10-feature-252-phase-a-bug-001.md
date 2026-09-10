# Session 2026-09-10 (Feature 252 Phase A Browser Verification + BUG-001 Fix)

## Summary

ทำ Phase A Browser E2E Verification ของ Feature 252 (Excel Data Review Pipeline) บน production `https://lcbp3.np-dms.work/` ผ่าน Playwright MCP — 32 PASS / 1 FAIL (BUG-001) / 0 SKIP. จากนั้นแก้ BUG-001 (RBAC permission mismatch `organization.manage_users` → `organization.manage_members`) ใน 4 code files + seed SQL + delta SQL + DB fix + tests; 76 tests PASS, lint+build PASS, commit local `0ab28020`.

## ปัญหาที่พบ (Root Cause)

### BUG-001: MIGRATION_STAGING ใช้ไม่ได้กับ Org Admin

- **Root cause**: Code ตรวจ `organization.manage_users` ซึ่ง **ไม่มีใน DB** (seed SQL มี `organization.manage_members`)
- **ผลกระทบ**:
  - MIGRATION_STAGING (Feature 252) ใช้ไม่ได้กับ Org Admin ทั้งที่ spec (ADR-052 User Story 3) อนุญาต
  - WorkflowTransitionGuard Level 2 ใช้ไม่ได้กับ Org Admin
  - WorkflowEngineService impersonation ใช้ไม่ได้กับ Org Admin
- **พบใน 4 files**:
  - `excel-import-review.controller.ts:177` — MIGRATION_STAGING authz
  - `workflow-engine.service.ts:416` — impersonation authz
  - `workflow-transition.guard.ts:24,71,123` — DSL mapping + Level 2 check + comment
  - `workflow-transition.guard.spec.ts` — 4 mock permissions

## การแก้ไข (Fix)

| ไฟล์ | การเปลี่ยนแปลง |
| -------------- | ---------------------- |
| `backend/src/modules/migration/excel-import-review.controller.ts` | เปลี่ยน permission check + JSDoc comment `organization.manage_users` → `organization.manage_members` |
| `backend/src/modules/workflow-engine/workflow-engine.service.ts` | เปลี่ยน impersonation check `organization.manage_users` → `organization.manage_members` |
| `backend/src/modules/workflow-engine/guards/workflow-transition.guard.ts` | เปลี่ยน DSL_ROLE_TO_CASL mapping + Level 2 check + 3 comments |
| `backend/src/modules/workflow-engine/guards/workflow-transition.guard.spec.ts` | อัปเดต mock permissions ใน 4 test cases + 1 test description |
| `specs/03-Data-and-Storage/lcbp3-v1.9.0-seed-permissions.sql` | Grant `organization.manage_members` (permission_id=15) ให้ Org Admin (role_id=2) |
| `specs/03-Data-and-Storage/deltas/2026-09-10-org-admin-manage-members.sql` | Delta SQL สำหรับ production DB fix |
| `specs/200-fullstacks/252-excel-data-review-pipeline/phase-a-verification-report.md` | Phase A verification report (ใหม่) |
| `specs/200-fullstacks/252-excel-data-review-pipeline/test-plan.md` | Test plan (ใหม่) |

### DB Fix (applied via MCP MariaDB)

```sql
INSERT IGNORE INTO role_permissions (role_id, permission_id) VALUES (2, 15);
-- organization.manage_members → Org Admin
```

Verified: `admin` (user_id=2) มี `organization.manage_members` แล้วใน `v_user_all_permissions`

## กฎที่ Lock แล้ว

### D308 — Permission name ต้องตรง seed SQL canonical (`organization.manage_members` ไม่ใช่ `organization.manage_users`)

- Code ที่ตรวจ Org Admin permission ต้องใช้ `organization.manage_members` (permission_id=15) ตาม seed SQL canonical `lcbp3-v1.9.0-seed-permissions.sql`
- ห้ามใช้ `organization.manage_users` ซึ่งไม่มีใน DB
- กระทบ 3 ระบบ: MIGRATION_STAGING authz, WorkflowTransitionGuard Level 2, WorkflowEngineService impersonation
- กฎทั่วไป: permission name ใน code ต้องตรงกับ seed SQL canonical เสมอ — ตรวจสอบด้วย `SELECT permission_name FROM permissions WHERE permission_name = '...'`

### D309 — Browser E2E Verification ต้อง execute จริง ห้าม claim ผ่านโดยไม่ได้ทำ

- Phase A ต้อง execute ผ่าน Playwright MCP บน production URL จริง
- ห้ามรายงาน PASS จากแค่ HTTP curl หรือ code inspection
- ต้อง login, select project, upload file, verify UI, ตรวจ network/console/responsive
- สำหรับ destructive flows (confirm) ให้ใช้ cancel เพื่อไม่ mutate production data
- รายงานต้องระบุ PASS/FAIL/BLOCKED ชัดเจน + evidence (network requests, screenshots, snapshots)

## Verification

- [x] 19 workflow-transition.guard tests PASS
- [x] 5 excel-import-review integration tests PASS
- [x] 52 workflow-engine.service tests PASS
- [x] ESLint `lint:ci` PASS
- [x] `nest build` PASS
- [x] DB fix applied: Org Admin (user_id=2) มี `organization.manage_members`
- [x] Phase A browser verification: 32 PASS / 1 FAIL (BUG-001 fixed) / 0 SKIP
- [x] Commit local `0ab28020` (D264)
- [ ] Push `origin/main` (pending user authorization)
- [ ] Post-deploy browser verify MIGRATION_STAGING กับ admin account (หลัง push + deploy)
