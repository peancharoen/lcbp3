# Session 2026-09-03 — RAG Vector Deletion Fix (hardDelete sync + pending fallback + orphan scan)

## Summary

แก้ปัญหา "ลบเอกสาร (Correspondence) แล้ว RAG vectors ยังค้างใน Qdrant" โดยเปลี่ยน `hardDelete()` จาก fire-and-forget BullMQ → sync await Qdrant + pending fallback + periodic orphan scan cleanup

## ปัญหาที่พบ (Root Cause)

`hardDelete()` เดิมใช้ `aiQueueService.enqueueVectorDeletion()` (fire-and-forget BullMQ) ในการลบ Qdrant vectors — ถ้า Qdrant ดับ ณ ตอนรัน job BullMQ retry 3 ครั้งแล้วตก failed jobs (เก็บแค่ 200 entries) **DB rows ถูกลบไปแล้ว ไม่มีทางรู้ว่าต้องลบ vectors อะไร** → vectors ค้างถาวร

### ความเข้าใจที่ถูกต้องของผู้ใช้

- **CANCELLED** = เอกสารยังอยู่ (soft state) อาจถูกอ้างถึงในการค้นหา/สอบถาม → RAG ต้องเก็บ vectors ไว้ ✅
- **DELETE (hardDelete)** = ลบจริง บันทึก log เอกสาร/ไฟล์หายไป (admin ขึ้นไป) → RAG ต้องลบ vectors ด้วย ✅

## การแก้ไข (Fix)

### สถาปัตยกรรมใหม่: Sync + Pending Fallback + Periodic Cleanup

```
hardDelete()
  ├─ 1. ลบ physical files ✅
  ├─ 2. sync await Qdrant deletion (wait: true)
  │      ├─ สำเร็จ → return COMPLETED
  │      └─ fail → เก็บลง pending_vector_deletions table → return PENDING_RETRY
  ├─ 3. ลบ DB rows (transaction) ✅
  └─ 4. คืนผลลัพธ์

VectorCleanupService (cron)
  ├─ retryPendingDeletions() — ทุก 15 นาที retry pending items (max 10 retries)
  └─ orphanScan() — ทุกชั่วโมง scroll Qdrant vs DB ลบ orphan vectors
```

### ไฟล์ที่สร้างใหม่

| ไฟล์ | การเปลี่ยนแปลง |
| --- | --- |
| `specs/03-Data-and-Storage/deltas/2026-09-03-pending-vector-deletions.sql` | สร้าง `pending_vector_deletions` table (id, public_id, document_public_id, project_public_id, status, retry_count, max_retries, last_error, requested_by_user_id, timestamps) |
| `backend/src/modules/ai/entities/pending-vector-deletion.entity.ts` | TypeORM entity สำหรับ pending_vector_deletions + `PendingVectorDeletionStatus` enum |
| `backend/src/modules/ai/services/vector-cleanup.service.ts` | Cron service: `retryPendingDeletions()` (ทุก 15 นาที) + `orphanScan()` (ทุกชั่วโมง) |
| `backend/src/modules/ai/services/vector-cleanup.service.spec.ts` | Unit tests สำหรับ VectorCleanupService (7 tests) |

### ไฟล์ที่แก้ไข

| ไฟล์ | การเปลี่ยนแปลง |
| --- | --- |
| `backend/src/modules/correspondence/correspondence.service.ts` | `hardDelete()` เปลี่ยนจาก `enqueueVectorDeletion()` → `aiQdrantService.deleteByDocumentPublicId()` (sync) + pending fallback; return type `vectorDeletionJobsEnqueued` → `vectorDeletionStatus` |
| `backend/src/modules/correspondence/correspondence.module.ts` | register `PendingVectorDeletion` entity |
| `backend/src/modules/correspondence/correspondence.controller.ts` | return type `vectorDeletionStatus: 'COMPLETED' \| 'PENDING_RETRY' \| 'SKIPPED'` |
| `backend/src/modules/ai/qdrant.service.ts` | เพิ่ม `scrollByProject()` (scroll API + project filter) + `deleteByPointIds()` (batch delete) |
| `backend/src/modules/ai/ai.module.ts` | register `VectorCleanupService` + `PendingVectorDeletion` entity |
| `backend/src/common/interceptors/audit-log.interceptor.ts` | เก็บ response data ลง `detailsJson` + fallback `entityId` จาก `request.params['uuid']` |
| `frontend/lib/services/correspondence.service.ts` | type `vectorDeletionJobsEnqueued` → `vectorDeletionStatus` |
| `backend/src/modules/correspondence/correspondence.service.spec.ts` | แก้ mocks + assertions สำหรับ sync deletion |
| `backend/src/modules/correspondence/correspondence.controller.spec.ts` | แก้ mock result type |
| `backend/src/modules/ai/ai-qdrant.service.spec.ts` | เพิ่ม tests สำหรับ `scrollByProject` + `deleteByPointIds` (5 tests) |

## กฎที่ Lock แล้ว

- **D255**: hardDelete() ต้อง sync await Qdrant deletion ก่อน commit DB — ถ้า fail เก็บลง pending_vector_deletions (compensation pattern)
- **D256**: VectorCleanupService รัน 2 cron jobs: retryPendingDeletions (ทุก 15 นาที) + orphanScan (ทุกชั่วโมง) เพื่อกวาด orphaned vectors
- **D257**: AuditLogInterceptor เก็บ response data ลง `detailsJson` สำหรับ audit trail ที่ละเอียด (limit 10 keys)
- **D258**: CANCELLED ≠ DELETE — CANCELLED เก็บ vectors ไว้ (เอกสารยังอยู่ อาจถูกอ้างถึง), DELETE ลบ vectors ด้วย

## Verification

- [x] Backend build (`nest build`) — ผ่าน
- [x] Backend lint:ci (ESLint strict) — ผ่าน
- [x] Frontend build (`next build`) — ผ่าน
- [x] Unit tests (89 tests) — ผ่านทั้งหมด (4 suites: ai-qdrant + vector-cleanup + correspondence.service + correspondence.controller + audit-log.interceptor)
- [ ] **รัน SQL delta** `2026-09-03-pending-vector-deletions.sql` บน database ก่อน deploy
- [ ] **E2E test**: สร้าง/index Correspondence → ยืนยัน Qdrant มี vectors → hardDelete → ยืนยัน Qdrant ล้าง
- [ ] **ตรวจสอบ cron jobs** รันจริงหลัง deploy (ดู logs ของ VectorCleanupService)
