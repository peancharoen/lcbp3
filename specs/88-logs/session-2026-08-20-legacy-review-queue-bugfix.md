# Session 2026-08-20 — Legacy Review Queue "Failed to load queue" Bugfix

## Summary

แก้ bug ที่หน้า admin/migration → Legacy Review Queue แสดง "Failed to load queue" สำหรับผู้ใช้ที่ไม่ใช่ Superadmin พบ 2 root causes: (1) commit `56284be6` (Issue #3) เพิ่ม `@RequirePermission('migration.view')` ฯลฯ ใน controller แต่ไม่เคย seed permission ลง DB ทำให้เกิด 403 (2) `getApiErrorMessage` ใน frontend ไม่เข้าใจ ADR-007 structured error shape ที่ response interceptor reject ด้วย จึงซ่อน error จริงและตกไป fallback "Failed to load queue" เสมอ

## ปัญหาที่พบ (Root Cause)

### Root Cause #1 — Missing RBAC permissions in DB

Commit `56284be6` (Issue #3, 2026-08-17) เพิ่ม `RbacGuard` + `@RequirePermission(...)` ทุก migration endpoint ใน `migration.controller.ts`:

- `migration.import`, `migration.commit`, `migration.enqueue`, `migration.view`, `migration.error_log`

แต่ **ไม่เคยเพิ่ม seed permission ใน DB** — verified ผ่าน MCP MariaDB ว่า `permissions` table มีแค่ `ai.migration_manage` (id 183) ที่เป็น permission เดิมของ AI module ไม่ใช่ migration module

ผลกระทบ:
- Superadmin (role 1, global scope + `system.manage_all`) ผ่านได้เพราะมี wildcard permission
- **Org Admin (role 2) / Document Control (role 3) / Editor (role 4) / Viewer (role 5) ถูก 403 ทันที** เพราะไม่มี permission ชื่อ `migration.view` ฯลฯ อยู่ใน matrix เลย และ scope context ของ `/migration/queue` ไม่มี org/project ทำให้ org-scoped assignment ไม่ match ด้วย

### Root Cause #2 — `getApiErrorMessage` ซ่อน error จริง

Response interceptor ใน `frontend/lib/api/client.ts` reject ด้วย ADR-007 structured error shape:

```typescript
{ error: { type, code, message, severity, timestamp, statusCode, recoveryActions } }
```

แต่ `getApiErrorMessage` ใน `frontend/types/api-error.ts` ค้นหาแค่:
1. `error.response.data.message` (legacy Axios shape)
2. `error.message` (Error.message)

จึงตกไป fallback (`'Failed to load queue'`) เสมอ ทำให้ผู้ใช้เห็นข้อความ generic แทน error จริง (เช่น "User does not have required permissions: migration.view") ซ่อน root cause จากผู้ใช้และ developer

## การแก้ไข (Fix)

| ไฟล์ | การเปลี่ยนแปลง |
| --- | --- |
| `frontend/types/api-error.ts` | แก้ `getApiErrorMessage` ให้อ่าน ADR-007 structured shape `{ error: { message } }` ก่อน legacy shapes; เพิ่ม type guard `isStructuredErrorResponse` + `StructuredApiErrorPayload`/`StructuredApiErrorResponse` types |
| `frontend/lib/__tests__/api-error.test.ts` | สร้างใหม่ — regression test 8 cases (structured, Axios raw, legacy, Error.message, null/undefined, no-message, empty, default fallback) |
| `specs/03-Data-and-Storage/deltas/2026-08-20-migration-rbac-permissions.sql` | สร้างใหม่ — SQL delta idempotent เพิ่ม 5 permissions (ID 216-220) + grant ให้ role 1/2/3 + rollback section + verification query |
| `specs/03-Data-and-Storage/lcbp3-v1.9.0-seed-permissions.sql` | เพิ่ม section 20 "Migration Module Permissions (ID 216-220)" สำหรับ fresh install |

### DB Changes (executed via MCP MariaDB)

- INSERT 5 permissions: `migration.view` (216), `migration.commit` (217), `migration.enqueue` (218), `migration.import` (219), `migration.error_log` (220)
- INSERT IGNORE 15 role_permissions: role 1 (Superadmin), 2 (Org Admin), 3 (Document Control) × 5 permissions
- Verified ผ่าน `v_user_all_permissions` ว่า user_id 1 และ 2 เห็น 5 permissions ครบ

## กฎที่ Lock แล้ว

- **D118**: Migration RBAC permissions ต้อง seed ใน DB — ไม่เพียงพอที่จะเพิ่ม `@RequirePermission` ใน controller เท่านั้น ต้องเพิ่ม permission row + role_permissions grant ด้วย (Bug จาก Issue #3 commit 56284be6 ที่เพิ่ม guard แต่ลืม seed)
- **D119**: `getApiErrorMessage` ต้องอ่าน ADR-007 structured shape `{ error: { message } }` ก่อน legacy Axios shape — ทุก error handler ใน frontend ใช้ helper นี้ผ่าน `getApiErrorMessage(error, fallback)` pattern

## Verification

- [x] Frontend: 969 tests pass (รวม api-error test ใหม่ 8 cases) + tsc clean + eslint clean
- [x] Backend: 144 migration tests pass (ไม่แตะ backend code)
- [x] DB: `v_user_all_permissions` ยืนยัน user_id 1 และ 2 เห็น `migration.view/commit/enqueue/import/error_log` ครบ
- [x] Redis: ไม่มี `permissions:user:*` cache ค้าง → fix มีผลทันที (TTL 30 นาทีปกติ)
- [x] Backend endpoint `/api/migration/queue` ตอบ 401 (auth required) ไม่ใช่ 404 — ยืนยัน route ทำงานปกติ
- [ ] **ทดสอบจาก browser จริง** ที่ `https://lcbp3.np-dms.work/admin/migration` หลัง login ด้วย Org Admin account
- [ ] **Commit + push via 2git.sh** — pending
