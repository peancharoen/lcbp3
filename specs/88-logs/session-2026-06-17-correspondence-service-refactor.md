# Session 17 — 2026-06-17 (Correspondence Service Refactor)

## Summary

Refactor `correspondence.service.ts` ตาม code review — แก้ 10 จุดทั้ง Tier 1 (Critical) และ Tier 2 (Important) ครอบคลุม transaction safety, error handling, type safety, และ caching

## ปัญหาที่พบ (Root Cause)

| # | ปัญหา | ระดับ |
|---|-------|-------|
| 1 | `void` fire-and-forget calls (`searchService.indexDocument`, `notificationService.send`) ไม่มี `.catch()` — เสี่ยง unhandled rejection | 🔴 |
| 2 | `update()` mutations อยู่นอก transaction — หาก fail กลางทาง state จะ inconsistent | 🔴 |
| 3 | `cancel()` แจ้ง notification ผิดคน — ใช้ `status: 'REJECTED'` แต่ควรเป็น `'PENDING'` | 🔴 |
| 4 | Duplicate UUID resolution logic ซ้ำ 3 ที่ (`create`, `update`, `previewDocumentNumber`) | 🟡 |
| 5 | `Record<string, unknown>` แทน `Partial<Entity>` — สูญเสีย type safety | 🟡 |
| 6 | `findOne()` ไม่ expose workflow fields ต่างจาก `findOneByUuid()` | 🟡 |
| 7 | `hasSystemManageAllPermission()` query ทุกครั้ง — ไม่มี caching | 🟡 |
| 8 | `exportCsv` hardcode limit 10000 + unsafe type cast (`as unknown as`) | 🟡 |
| 9 | Type codes (`['RFA', 'RFI']`) hardcode ใน method | 🟢 |
| 10 | `logger.warn` สำหรับ workflow creation fail — ควรเป็น `error` | 🟢 |

## การแก้ไข (Fix)

| ไฟล์ | การเปลี่ยนแปลง |
|------|---------------|
| `backend/src/modules/correspondence/correspondence.service.ts` | ✅ Extract UUID resolution → private `resolveRecipients()` ใช้ซ้ำ 3 ที่ |
| | ✅ เปลี่ยน `void` calls → `Promise.resolve(...).catch()` ป้องกัน unhandled rejection |
| | ✅ `update()` mutations → ใช้ `queryRunner` transaction (correspondence + revision + attachments + recipients) |
| | ✅ `cancel()` notification: `REJECTED` → `PENDING` (แจ้งคนที่รออยู่) |
| | ✅ `Record<string, unknown>` → `Partial<Correspondence>` / `Partial<CorrespondenceRevision>` |
| | ✅ `findOne()` เพิ่ม `workflowInstanceId`, `workflowState`, `availableActions` (ADR-021) |
| | ✅ `hasSystemManageAllPermission()` → in-memory cache 30s (`getCachedPermissions()`) |
| | ✅ `exportCsv`: paginated (limit 1000 แทน 10000) + `corr?.correspondenceNumber` แทน unsafe cast |
| | ✅ Type codes → `static readonly ALPHABET_REVISION_TYPES` |
| | ✅ Workflow fail → `logger.error` แทน `warn` |
| `backend/src/modules/correspondence/correspondence.service.spec.ts` | ✅ เพิ่ม mock: `manager.getRepository`, `manager.update`, `manager.delete` |
| | ✅ เพิ่ม mock: `workflowEngine.getInstanceByEntity` |
| | ✅ `searchService.indexDocument` → `mockResolvedValue(undefined)` |

## กฎที่ Lock แล้ว

- 🔒 **Fire-and-forget ต้องมี `.catch()`** — ทุก `void` call เปลี่ยนเป็น `Promise.resolve(...).catch()` (หรือใช้ BullMQ ตาม ADR-008)
- 🔒 **`update()` ต้องอยู่ใน transaction** — การแก้ไข correspondence entity ต้องใช้ `queryRunner` เสมอ
- 🔒 **Permission check cache** — ใช้ in-memory cache 30s สำหรับ `getCachedPermissions()` แทนการ query ทุกครั้ง
- 🔒 **`exportCsv` ไม่มี hardcode limit** — ใช้ pagination loop (pageSize 1000) ป้องกัน data truncation

## Verification

- [x] TypeScript `tsc --noEmit` — **0 errors**
- [x] Backend tests — **26/26 passed** (4 test suites)
- [x] Controller tests — **ผ่านทั้งหมด**
