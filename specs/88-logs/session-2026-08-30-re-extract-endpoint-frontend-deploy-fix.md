# Session 2026-08-30 — Re-extract Endpoint + Frontend Deploy Fix

## Summary

เพิ่มฟีเจอร์ `POST /api/migration/queue/:publicId/re-extract` สำหรับ re-extract queue item ก่อน Execute Import และแก้ CI/CD deploy failure จาก `ERR_PNPM_UNUSED_PATCH` ด้วย `allowUnusedPatches: true` + CI guard script

## ปัญหาที่พบ (Root Cause)

### ปัญหาที่ 1: ไม่มี flow re-extract หลัง `ai_status = DONE`

`POST /api/migration/queue/:publicId/extract` มี guard ที่ป้องกัน duplicate BullMQ job:
- ถ้า `aiStatus = DONE` หรือ `aiJobId != null` จะถูกมองว่า "เสร็จแล้ว/กำลังทำ" แล้ว skip
- ไม่มีทาง re-extract รายการที่เคย extract สำเร็จแล้ว แต่ผู้ใช้ต้องการรันใหม่

### ปัญหาที่ 2: Frontend deploy fail ด้วย `ERR_PNPM_UNUSED_PATCH`

`pnpm-workspace.yaml` ประกาศ `patchedDependencies: "@nestjs/swagger"` ไว้ที่ workspace root แต่ `@nestjs/swagger` มีแค่ใน `backend/package.json` (ไม่มีใน `frontend/package.json`)

เวลา `pnpm --filter lcbp3-frontend deploy --prod` รัน install ที่ deploy target มันเช็คทุก patch ใน workspace root แล้วไม่พบ `@nestjs/swagger` ใน frontend tree → throw `ERR_PNPM_UNUSED_PATCH`

Commit `093021b0` แก้แค่ "ไม่พบไฟล์ patch ก็อปปี้ไปให้" แต่ไม่ได้แก้ปัญหาที่แท้จริง (patch ถูกประกาศแต่ไม่ถูกใช้ใน frontend)

## การแก้ไข (Fix)

| ไฟล์ | การเปลี่ยนแปลง |
| --- | --- |
| `backend/src/modules/migration/migration.service.ts` | เพิ่ม `reExtractQueueItem()` — reset AI fields + remove old BullMQ job + re-enqueue `legacy-ai-enrichment` |
| `backend/src/modules/migration/migration.controller.ts` | เพิ่ม `POST /api/migration/queue/:publicId/re-extract` endpoint พร้อม `Idempotency-Key` + `migration.import` permission |
| `backend/src/modules/migration/entities/migration-review-queue.entity.ts` | ทำให้ nullable AI fields รับค่า `null` ตรงกับ DB + เพิ่ม `type: 'varchar'` ให้ `ai_suggested_category` |
| `backend/src/modules/migration/migration.service.spec.ts` | เพิ่ม 3 unit tests สำหรับ `reExtractQueueItem` (ConflictException, RUNNING, reset+re-enqueue) |
| `backend/src/modules/migration/migration.controller.spec.ts` | เพิ่ม 2 unit tests สำหรับ `reExtractQueueItem` endpoint |
| `pnpm-workspace.yaml` | เพิ่ม `allowUnusedPatches: true` (pnpm v10.7.0+) |
| `scripts/check-patches.sh` | สร้าง script ตรวจ orphan patch ก่อน CI build |
| `.gitea/workflows/ci-deploy.yml` | เพิ่ม step "🔍 Patch integrity check" |

## กฎที่ Lock แล้ว

- **D183** — `reExtractQueueItem` อนุญาตเฉพาะ `PENDING` หรือ `PENDING_REVIEW` (ปฏิเสธ `IMPORTED`/`REJECTED`) และต้อง reset `ai_status`/`ai_job_id`/`ai_failed`/`ocr_text`/`ai_summary`/`ai_suggested_category`/`extracted_tags`/`ai_confidence`/`ai_issues` ก่อน re-enqueue
- **D184** — `allowUnusedPatches: true` ใน `pnpm-workspace.yaml` เพื่อรองรับ patch ที่เฉพาะ backend (เช่น `@nestjs/swagger`) ตอน `pnpm --filter lcbp3-frontend deploy` — ต้องคู่กับ `scripts/check-patches.sh` ใน CI เพื่อ catch orphan patch ก่อน deploy fail
- **D185** — TypeORM entity nullable fields ต้องระบุ `type: 'varchar'`/`'datetime'` ชัดเจนเมื่อ TS type เป็น `string | null` (มิฉะนั้น TypeORM มองเป็น `Object` แล้ว throw `DataTypeNotSupportedError` ตอน runtime — ไม่ติด TSC)

## Verification

- [x] `pnpm -C backend exec tsc --noEmit` — 0 errors
- [x] `jest` migration service + controller — 173/173 pass
- [x] `docker build -f backend/Dockerfile` — สำเร็จ
- [x] `docker exec backend curl -sf http://localhost:3000/ping` — `{ status: "ok" }` + container `healthy`
- [x] `docker build -f frontend/Dockerfile` — สำเร็จ (49 Next.js routes, ทุก stage ผ่าน)
- [x] `./scripts/check-patches.sh` — pass (positive case)
- [x] `./scripts/check-patches.sh` กับ orphan patch — fail (negative case)
- [x] Commit `83362606` (re-extract) + `21987025` (allowUnusedPatches) + `f52013b8` (CI guard) pushed to `origin/main`

## Commits

1. `83362606` — feat(migration): add re-extract endpoint for legacy queue items
2. `21987025` — fix(ci): allow unused patches for frontend deploy
3. `f52013b8` — ci: add patch integrity check to prevent orphan patchedDependencies
