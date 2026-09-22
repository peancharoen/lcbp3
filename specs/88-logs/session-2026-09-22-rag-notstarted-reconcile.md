# Session — 2026-09-22 (RAG NOT_STARTED Reconcile + rag-prepare Retirement)

## Summary

สืบสาว "RAG Admin Console สถานะ = ยังไม่เริ่ม" → พบว่า 59 attachments ค้าง NOT_STARTED เพราะ `commitRecord` (review-queue commit path) ยังใช้ deprecated `rag-prepare` pipeline ที่ processor skip ทิ้ง — ไม่ใช่ design ที่ตั้งใจ แต่เป็น migration drift (D344) — แก้ 3 call sites + reconcile 59 รายการเป็น ACTIVE ครบ

## ปัญหาที่พบ (Root Cause)

- `NOT_STARTED` = computed status เมื่อ attachment ไม่มี row ใน `rag_attachment_generations` — ไม่ใช่ DB enum
- 59 รายการทั้งหมดมาจาก migration queue commit → IMPORTED ผ่าน `commitRecord` ซึ่งเป็น commit path เดียวที่ไม่มี generation-aware trigger (ไม่ผ่าน `FileStorageService.commit()`)
- `commitRecord` เรียก `ragBatchService.enqueueRagPrepare` (deprecated) → processor log `Skip batch job — attachment is DONE` → ไม่มี generation ถูกสร้าง, `rag_status=PENDING` ค้างเงียบ
- 57/59 ไม่มี checksum — Re-ingest เองก็ไม่ได้เพราะ ingest() ต้องการ checksum
- Fallback เดิมใน `importCorrespondence`: checksum compute ไม่ได้ → enqueue rag-prepare → dead work + ซ่อนปัญหา
- `correspondence-workflow.service.ts` ยิง `enqueueRagPrepare` ทุก status transition (non-DRAFT) — dead code เพราะ status ไม่ได้อยู่ใน vector payload เลย

## การแก้ไข (Fix)

| ไฟล์ | การเปลี่ยนแปลง |
| ---- | ------------- |
| `backend/src/modules/migration/migration-review.service.ts` | `commitRecord` → compute checksum + `ragIngestionService.ingest()` + `enqueueRagAttachmentIngestion` (commit `cd1594ad`) |
| `backend/src/modules/migration/migration.service.ts` | ตัด rag-prepare fallback — checksum ไม่ได้ → mark `ragStatus=FAILED` + `ragLastError`; ลบ RagBatchService injection (commit `08b19ae3`) |
| `backend/src/modules/correspondence/correspondence-workflow.service.ts` | ลบ `triggerRagPrepare`/`skipRagPrepare` + after-commit enqueue block + unused deps (commit `73005343`) |
| `backend/src/modules/correspondence/correspondence.service.ts` | ลบ `AiQueueService` injection ที่ไม่เคยเรียก |
| `backend/src/scripts/reconcile-rag-ingestion.ts` | CLI reconcile: หา NOT_STARTED → compute checksum (รองรับ `--path-map`) → ingest → enqueue ai-rag-ingest; รองรับ `--dry-run`, `--limit` |
| `correspondence-workflow.service.spec.ts` | tests เปลี่ยนจาก assert enqueueRagPrepare → assert status sync |

## ผล Reconcile (production, รันแล้ว)

- Dry-run: 59/59 resolve ไฟล์ผ่าน `--path-map=/mnt/legacy-staging=/mnt/asustor-legacy` + `/app/uploads/permanent=/mnt/asustor-uploads/permanent`
- LIVE: 59/59 → ACTIVE (generations 442→501), FAILED เพิ่ม 0 (6 FAILED ที่มีคือของเก่า 15–18 ก.ย.)
- NOT_STARTED เหลือ **0** ทุก linked attachment

## กฎที่ Lock แล้ว (D352)

- **rag-prepare pipeline ไม่มี production caller เหลือ** — definition เหลือใน `ai-queue.service.ts`/`rag-batch.service.ts` + handler ใน `ai-batch.processor.ts` เพื่อ drain jobs เก่าเท่านั้น; ลบถาวรได้หลัง queue ว่าง
- **Status transition ไม่ต้อง re-index** — vector payload มีแค่ generationUuid/attachmentPublicId/owner/project/classification; status ไม่อยู่ใน vector → ค้นตาม status ผ่าน SQL tools (live) ไม่ใช่ vector
- **Checksum ไม่ได้ → mark FAILED** อย่าซ่อนปัญหาด้วย fallback ลง dead pipeline — recovery ผ่าน Re-ingest/reconcile script

## Verification

- [x] backend 706/706 migration + 90/90 correspondence tests, tsc+eslint clean
- [x] Reconcile live: 59/59 ACTIVE, NOT_STARTED=0
- [x] Push squash `608a1226` → CI triggered (code change, ไม่ใช้ --skip-ci)
- [ ] Post-deploy: commit ผ่าน review queue ใหม่ได้ generation ทันที
