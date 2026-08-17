# Session Log — Migration Critical Pre-Merge Fixes (Issue #3)

**Date:** 2026-08-17
**Issue:** [Gitea #3 — Security & Compliance Fix Critical Pre-Merge Blockers](http://192.168.10.11:3003/np-dms/lcbp3/issues/3)
**Scope:** Phase 1 (Critical & High Priority) — Work Packages 1-4

## Context

จากการ audit โค้ดใน `backend/src/modules/migration/` และ `backend/src/common/file-storage/` พบประเด็น Tier 1 (CRITICAL) ที่ต้องแก้ก่อน merge ตาม ADR-016 (Security), ADR-019 (UUID), ADR-002 (Concurrency), ADR-007 (Error Handling)

## สิ่งที่ทำ

### 1. สร้าง Gitea Issue #3 + Labels
- สร้าง labels: `security`, `critical`, `adr-compliance`, `migration`
- สร้าง issue พร้อม checklist ครบทุกข้อ

### 2. Phase 1 — Work Package 1: Security & Identity (ADR-016)

**2.1 ลบ Hardcoded userId fallback (`|| 5`)** — `migration.controller.ts`, `migration-review.controller.ts`
- เพิ่ม helper `requireUserId(user)` ที่ throw `UnauthorizedException` เมื่อไม่มี user context
- เพิ่ม helper `requireIdempotencyKey(key)` ที่ throw `ValidationException` เมื่อไม่มี key
- แทนที่ `user?.user_id || 5` ทั้ง 5 จุด

**2.2 ลบ Hardcoded Master Data Fallback (`|| 1`, `|| 3`)** — `migration.service.ts`, `migration-review.service.ts`
- เปลี่ยน `rfaTypeRes[0]?.id || 1` → throw `BusinessException('RFA_TYPE_NOT_FOUND', ...)` พร้อม Thai userMessage + recoveryActions
- เปลี่ยน `rfaStatusRes[0]?.id || 3` → throw `BusinessException('RFA_STATUS_NOT_FOUND', ...)`

**2.3 Path Traversal Guard** — `migration.service.ts:getStagingFileStream`, `file-storage.service.ts:importStagingFile`
- เพิ่มการตรวจ `resolvedPath.startsWith(stagingDir + path.sep)` ก่อน stream/move
- ใช้ env var `MIGRATION_STAGING_DIR` (default: `./uploads/staging`)
- throw `ValidationException` พร้อม log warning เมื่อ path หลุดนอก staging dir

**2.4 Idempotency Enforcement จริง** — `migration-review.service.ts:commitRecord`
- เปลี่ยน signature รับ `idempotencyKey: string` จาก caller (ไม่ generate ภายใน)
- เพิ่มการตรวจ `import_transactions` ด้วย `pessimistic_write` lock ก่อนประมวลผล
- คืน idempotency replay (success) เมื่อพบ tx เดิมที่ statusCode=201
- throw `ConflictException` เมื่อพบ tx เดิมที่ failed

**2.5 RBAC Guard ครบทุก endpoint** — `migration.controller.ts`
- เพิ่ม `RbacGuard` + `@RequirePermission(...)` ในทุก endpoint:
  - `migration.import`, `migration.commit`, `migration.enqueue`, `migration.view`, `migration.error_log`

### 3. Phase 1 — Work Package 2: ADR-019 UUID Compliance

**3.1 Entity Layer** — `migration-review-queue.entity.ts`
- เพิ่ม `@Exclude()` บน `@PrimaryGeneratedColumn() id!: number;` ป้องกัน leak INT PK ออก API

**3.2 Controller & DTO Layer** — `migration.controller.ts`
- เปลี่ยน `:id` (INT) → `:publicId` (UUID) ใน 3 endpoints:
  - `GET /migration/queue/:publicId` (ใช้ `ParseUUIDPipe`)
  - `POST /migration/queue/:publicId/approve`
  - `POST /migration/queue/:publicId/reject`

**3.3 Service Layer** — `migration.service.ts`
- เพิ่ม `getQueueItemByPublicId(publicId)`, `approveQueueItemByPublicId(...)`, `rejectQueueItemByPublicId(...)`
- ค้นหาด้วย `where: { publicId }` แทน `where: { id }`
- Return `publicId` แทน `id` ใน reject response

### 4. Phase 1 — Work Package 3: ADR-002 Concurrency & Revision Locking

**4.1 Race Condition Fix** — `migration.service.ts`, `migration-review.service.ts`
- เปลี่ยนจาก `manager.count(CorrespondenceRevision, ...)` → `manager.find(..., { lock: { mode: 'pessimistic_write' }, order: { revisionNumber: 'DESC' } })`
- ป้องกัน concurrent transaction สร้าง revision number ชนกัน

### 5. Phase 1 — Work Package 4: ADR-007 Layered Error Handling

**5.1 ใช้ BusinessException Hierarchy**
- นำเข้า `BusinessException` จาก `src/common/exceptions/base.exception.ts`
- ใช้ในจุดที่เคย throw generic exception พร้อมระบุ:
  - `errorCode` (เช่น `RFA_TYPE_NOT_FOUND`, `RFA_STATUS_NOT_FOUND`)
  - `userMessage` (ภาษาไทย)
  - `recoveryActions` (ขั้นตอนการแก้ไข)

### 6. Test Updates

- อัปเดต `migration.controller.spec.ts`:
  - เปลี่ยน test "returns 400 error" → "throws ValidationException" (3 จุด)
  - เปลี่ยน test "uses user_id 0 when user is undefined" → "throws UnauthorizedException"
- อัปเดต `migration.service.spec.ts`:
  - เพิ่ม `ConfigService` mock
  - เพิ่ม `find`, `query` methods ใน mockQueryRunner.manager

## Verification

| ขั้นตอน | ผล |
|---|---|
| TypeScript compile (`tsc --noEmit`) | ✅ ผ่าน |
| ESLint (`--max-warnings=0`) | ✅ ผ่าน |
| Nest build (`nest build`) | ✅ ผ่าน |
| Migration tests (144 tests) | ✅ ผ่านทั้งหมด |
| File-storage tests (13 tests) | ✅ ผ่านทั้งหมด |
| AI + migration + file-storage regression (475 tests) | ✅ ผ่านทั้งหมด |

## ไฟล์ที่แก้ไข

| ไฟล์ | การเปลี่ยนแปลง |
|---|---|
| `backend/src/modules/migration/migration.controller.ts` | ลบ `|| 5`, เพิ่ม RBAC, เปลี่ยน `:id` → `:publicId`, ใช้ helper functions |
| `backend/src/modules/migration/migration-review.controller.ts` | ลบ `|| 5`, ส่ง `idempotencyKey` เข้า service จริง |
| `backend/src/modules/migration/migration.service.ts` | ลบ `|| 1`, `|| 3`, path traversal guard, pessimistic lock revision, เพิ่ม `*ByPublicId` methods |
| `backend/src/modules/migration/migration-review.service.ts` | รับ `idempotencyKey` จริง, ลบ `|| 1`, `|| 3`, pessimistic lock revision, ใช้ BusinessException |
| `backend/src/modules/migration/entities/migration-review-queue.entity.ts` | เพิ่ม `@Exclude()` บน `id` |
| `backend/src/common/file-storage/file-storage.service.ts` | Path traversal guard ใน `importStagingFile` |
| `backend/src/modules/migration/migration.controller.spec.ts` | อัปเดต tests ให้สอดคล้องกับ behavior ใหม่ |
| `backend/src/modules/migration/migration.service.spec.ts` | เพิ่ม `ConfigService` mock |

## ข้อกำหนดสภาพแวดล้อมใหม่

- `MIGRATION_STAGING_DIR` env var (optional, default: `./uploads/staging`) — โฟลเดอร์ staging ที่อนุญาตให้ stream/import ได้

## งานที่เหลือ (Phase 2 — Medium Priority)

- [ ] **2.1** Batch Operations สำหรับ N+1 Updates ใน `metadata-resolution.service.ts`
- [ ] **2.2** ADR-023 AI Boundary Refactor
- [ ] **2.3** File Type Magic Bytes Validation ใน `FileStorageService`
- [ ] **2.4** Centralize Constants & Enums
