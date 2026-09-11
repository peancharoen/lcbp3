# Session — 2026-09-11 (Migration Test Plan Phase 5 — Security & RBAC)

## Summary

สร้าง Security & RBAC tests สำหรับ Migration Admin workflow ตาม unified test plan (`specs/999-test-plan/migration-admin-unified-test-plan.md`):

- **Phase 5A** — CASL Guard / RBAC (11 tests): VIEWER/Document Controller/Admin permission matrix + edge cases
- **Phase 5B** — UUID / ADR-019 Compliance (3 tests): publicId only, no INT PK exposure, ParseUUIDPipe
- **Phase 5C** — AI Boundary ADR-023A (4 tests): projectPublicId filter, audit log, BullMQ jobId, no direct Ollama
- **Phase 5D** — Idempotency & Audit Trail (4 tests): double-click prevention, audit fields, OCR edit audit

รวม 22 tests ผ่านทั้งหมด — Migration Admin Test Plan ครบทุก Phase (1-5) แล้ว

## ปัญหาที่พบ (Root Cause)

### Controller method signatures ไม่ตรง test assumptions

1. **`approveQueueItem` signature** — คาดว่ารับ `(publicId, dto, user)` แต่จริงๆ รับ `(publicId, dto, idempotencyKey, user)` → แก้ test ให้ส่ง idempotencyKey
2. **`MigrationService.approveQueueItemByPublicId`** — ไม่ได้อยู่ใน `MigrationReviewService` → ย้าย mock ไป `MigrationService`
3. **`updateQueueOcr` signature** — รับ `(publicId, dto, userId)` ไม่มี idempotencyKey (ตรวจใน controller) → แก้ assertion
4. **`importCorrespondence` signature** — รับ `(dto, key, userId)` ไม่ใช่ `(dto, user, key)` → แก้ assertion order
5. **`getQueueItem` method name** — จริงๆ ชื่อ `getQueueItemByPublicId` → แก้ method reference

### ESLint strict rules

1. **Unused imports** — ลบ 18 imports ที่ไม่ได้ใช้ (ExcelImportReviewController, ExcelDataReviewService, etc.)
2. **`no-unsafe-member-access`** — `mock.calls[0][1]` มี type `any` → cast เป็น typed array tuple
3. **`require-await`** — async function ไม่มี `await` → ลบ `async`
4. **File corruption ระหว่าง edit** — automated replacement ทำให้ import บรรทัดเดียวกัน merge กัน → rewrite manual

## การแก้ไข (Fix)

| ไฟล์ | การเปลี่ยนแปลง |
| --- | --- |
| `backend/test/migration-security.e2e-spec.ts` | สร้างใหม่ — 22 security tests สำหรับ Phase 5 (5A RBAC + 5B UUID + 5C AI Boundary + 5D Idempotency) |

## กฎที่ Lock แล้ว

- **D321** — `MigrationController.approveQueueItem` signature = `(publicId, dto, idempotencyKey, user)` — มี idempotencyKey เป็น param ที่ 3
- **D322** — `MigrationService.approveQueueItemByPublicId` อยู่ใน `MigrationService` ไม่ใช่ `MigrationReviewService`
- **D323** — `MigrationController.updateQueueOcr` signature = `(publicId, dto, idempotencyKey, user)` แต่เรียก `reviewService.updateQueueOcr(publicId, dto, userId)` — idempotencyKey ตรวจใน controller ไม่ส่งต่อ
- **D324** — `MigrationController.importCorrespondence` signature = `(dto, idempotencyKey, user)` → เรียก `service.importCorrespondence(dto, key, userId)`
- **D325** — Security test mock ต้อง cast `mock.calls` เป็น typed tuple array เพื่อหลีก ESLint `no-unsafe-member-access`

## Verification

- [x] Phase 5A: 11/11 tests passed (CASL Guard / RBAC)
- [x] Phase 5B: 3/3 tests passed (UUID / ADR-019)
- [x] Phase 5C: 4/4 tests passed (AI Boundary ADR-023A)
- [x] Phase 5D: 4/4 tests passed (Idempotency & Audit Trail)
- [x] TypeScript typecheck: 0 errors
- [x] ESLint: 0 errors
- [x] CI run #722: `success` (25 นาที)
- [x] Deploy: `987731f6b823` @ 22:46
- [x] Backend `/ping`: HTTP 200
- [x] Frontend: HTTP 307 (redirect)

## Migration Test Plan Final Status

| Phase | สถานะ | Tests |
| ----- | ------ | ----- |
| Phase 1 (Browser E2E) | ✅ Complete | — |
| Phase 2 (Backend Unit) | ✅ Complete | — |
| Phase 3 (Integration) | ✅ Complete | 19 tests |
| Phase 4 (Performance) | ✅ Complete | 13 tests |
| Phase 5 (Security & RBAC) | ✅ Complete | 22 tests |

**รวม: 54 tests ผ่านทั้งหมด** — Migration Admin Test Plan ครบทุก Phase
