# Session 2026-08-01 #2 — Deploy ADR-015 Compliance (Image Tagging + Auto-Rollback + Retention)

## Summary

แก้ไข `deploy.sh` และ `rollback.sh` ให้สอดคล้องกับ ADR-015 Release Management Policy:
(1) tag Docker image ด้วย git SHA + `:latest` (2) auto-rollback เมื่อ health check fail
(3) image retention เก็บ 3 versions ล่าสุด พร้อมอัปเดต rollback.sh ให้ใช้ pre-built image
แทน rebuild นอกจากนี้ยังแก้ bug `BullmqMetricsService` DI ที่ทำให้ backend container
unhealthy หลัง deploy และแก้ test mock ของ `TransformInterceptor`

## ปัญหาที่พบ (Root Cause)

### Bug 1: TransformInterceptor spec test ล้มเหลว (19 tests)

- **สาเหตุ:** `TransformInterceptor` ถูกแก้ไขเพื่อเรียก `getRequest()` สำหรับ bypass `/metrics`
  แต่ test mock `createMockExecutionContext` มีแค่ `getResponse` ไม่มี `getRequest`
- **อาการ:** `TypeError: context.switchToHttp(...).getRequest is not a function`

### Bug 2: Backend container unhealthy หลัง deploy

- **สาเหตุ:** `BullmqMetricsService` (commit `0fa78708`) inject 6 BullMQ queues ผ่าน
  `@InjectQueue()` แต่ `MonitoringModule` ไม่ได้ `BullModule.registerQueue()` สำหรับ
  queue เหล่านั้น — queue providers ถูก register เฉพาะใน `AiModule`
- **อาการ:** `UnknownDependenciesException: Nest can't resolve dependencies of the
  BullmqMetricsService (?, ...). Please make sure that the argument "BullQueue_ai-ingest"
  at index [0] is available in the MonitoringModule module.`
- **หมายเหตุ:** `AiModule` exports `BullModule` (line 228) แต่การ export class reference
  ไม่ได้ export dynamic queue providers ด้วย (NestJS BullMQ DI scoping behavior)

### Bug 3: deploy.sh ไม่ compliant กับ ADR-015

- ไม่มี image tagging (ใช้ `:latest` เท่านั้น → rollback ไม่ได้)
- ไม่มี auto-rollback เมื่อ health check fail (แค่ `exit 1`)
- ไม่มี image retention (image ทับกันไปเรื่อยๆ)
- `rollback.sh` ใช้ `git checkout HEAD~1` + rebuild (ช้า 5-10 นาที, เสี่ยง build fail)

## การแก้ไข (Fix)

| ไฟล์ | การเปลี่ยนแปลง |
|------|----------------|
| `backend/src/common/interceptors/transform.interceptor.spec.ts` | เพิ่ม `getRequest` mock ใน `createMockExecutionContext` + 3 regression tests สำหรับ `/metrics` bypass |
| `backend/src/modules/monitoring/monitoring.module.ts` | เพิ่ม `BullModule.registerQueue()` สำหรับ 6 queues (ai-ingest, ai-realtime, ai-batch, ai-rag-query, np-dms-ocr, np-dms-ai) |
| `scripts/deploy.sh` | v3.0 → v4.0: image tagging ด้วย git SHA, auto-rollback, image retention 3 versions, deploy history |
| `scripts/rollback.sh` | v3.0 → v4.0: ใช้ pre-built image แทน rebuild (fallback rebuild ถ้า image ถูก prune) |
| `backend/docker-compose.yml` | ลบไฟล์ (ซ้ำซ้อนกับ Layer 2 — ไม่มี container รันจากไฟล์นี้) |

## กฎที่ Lock แล้ว

- **D63: ADR-015 Image Tagging** — ทุก deploy ต้อง tag image ด้วย git SHA (12 หลัก)
  + `:latest` เสมอ เพื่อให้ rollback ได้
- **D64: ADR-015 Auto-Rollback** — ถ้า health check fail หลัง deploy ต้อง rollback
  อัตโนมัติไปยัง previous version (อ่านจาก `/opt/np-dms/.deploy-history`)
- **D65: ADR-015 Image Retention** — เก็บ Docker image ไว้ 3 versions ล่าสุดเสมอ
  (prune เก่ากว่านั้นอัตโนมัติหลัง deploy สำเร็จ)
- **D66: Rollback Pattern** — rollback.sh ใช้ pre-built image (tag + restart, < 30s)
  แทน rebuild (5-10 min); fallback rebuild เฉพาะกรณี image ถูก prune ไปแล้ว
- **D67: BullMQ Multi-Module Registration** — ถ้า service ใน module A inject
  `@InjectQueue(X)` แต่ queue X ถูก register เฉพาะใน module B ต้องเรียก
  `BullModule.registerQueue({ name: X })` ใน module A ด้วย (export BullModule class
  จาก module B ไม่พอ — NestJS BullMQ DI scoping)

## Verification

- [x] `pnpm test` (backend): 883 passed, 10 skipped, 0 failed (ก่อนหน้า 19 failed)
- [x] `tsc --noEmit` (backend): 0 errors
- [x] `deploy.sh` syntax check: ผ่าน
- [x] `rollback.sh` syntax check: ผ่าน
- [x] Deploy จริง: image `6e87245574f8` + `:latest` สร้างสำเร็จ
- [x] Backend healthy หลัง deploy: `Up 17 seconds (healthy)`
- [x] `/health` endpoint: 200 OK (database, memory_heap, storage = up)
- [x] `/metrics` endpoint: BullMQ queue metrics สำหรับ 6 queues ครบ
- [x] Deploy history: `/opt/np-dms/.deploy-history` บันทึกแล้ว
- [x] Rollback ทดสอบ: ใช้ pre-built image สำเร็จ (ไม่ต้อง rebuild)
- [x] Pruning logic ทดสอบ: เก็บ 3 versions ล่าสุดถูกต้อง
