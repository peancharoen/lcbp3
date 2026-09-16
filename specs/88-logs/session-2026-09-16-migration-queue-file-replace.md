# Session — 2026-09-16 (Migration Review Queue: pagination/filter fix, OCR 413 slice, Replace File feature, BullMQ jobId bug)

## Summary

งานต่อเนื่องรอบ BATCH-C2-2567-005 (246 PENDING_REVIEW): ปรับ UX หน้า Legacy Review Queue, แก้ OCR 413 บนไฟล์ใหญ่, เพิ่มฟีเจอร์เปลี่ยนไฟล์ต้นฉบับบนหน้า review (staging picker + local upload + auto re-extract), แก้ correspondence type ตาม prefix rules (135 rows), reconcile queue/IMPORTED state ของ test batch, และพบ+แก้ BullMQ `:` jobId bug ที่ทำ replace-file ตอบ 500 ทั้งที่งานเสร็จแล้ว

## ปัญหาที่พบ (Root Cause)

1. **Pagination/filter UX** — ตารางมีแค่ prev/next, ไม่มี filter ที่ Confidence/Correspondence Type, และ header หายเมื่อ filter ไม่เจอ (ตาราง render เฉพาะ `items.length > 0`)
2. **OCR 413 Payload Too Large** — PDF 69MB/113 หน้าโดน sidecar `MAX_FILE_SIZE_BYTES=50MB` ทั้งที่ขอแค่ `maxPages=3`; caller ส่งไฟล์เต็มแทนที่จะ slice
3. **หน้า review เปลี่ยนไฟล์ไม่ได้** — ไฟล์ MISSING/ว่างไม่มีทางแนบใหม่
4. **PATCH /queue/:id/file → 500 "Custom Id cannot contain :"** — `replaceQueueItemFile` ผูกไฟล์+reset AI สำเร็จแล้ว แต่ส่ง `${key}:reextract` เป็น idempotency key ไปต่อใน BullMQ jobId (`legacy-enrich-...-<key>:reextract`) → BullMQ throw หลังงานเสร็จ → frontend แจ้งเตือนว่าล้มทั้งที่ replace+re-extract ทำงานจริง (false-negative)
5. **Queue vs Correspondence mismatch (test batch เท่านั้น)** — BATCH-ADR054-E2E-001 มี 5 rows ที่ Correspondence ถูกสร้างแล้วแต่ status ยัง PENDING/PENDING_REVIEW (import path เก่าไม่ persist IMPORTED + re-extract reset status โดยค้าง imported link)

## การแก้ไข (Fix)

| ไฟล์ | การเปลี่ยนแปลง |
| --- | --- |
| `backend/.../dto/migration-queue-query.dto.ts` + `migration.service.ts` | เพิ่ม filter `correspondenceType` + `confidenceBucket` (low≤50/mid≤80/high>80/missing) |
| `frontend/.../admin/migration/page.tsx` | numbered pagination (jump หน้าได้), filter dropdown ใน header, render TableHeader เสมอ + empty-state ใน TableBody, reset page=1 เมื่อเปลี่ยน filter |
| `backend/.../ai/services/ocr.service.ts` + `pdf-lib` | `loadPdfBufferForUpload()` slice เหลือ maxPages เมื่อไฟล์ >45MB (`OCR_UPLOAD_SLICE_THRESHOLD_BYTES`) — 69MB→1MB |
| `backend/.../dto/replace-queue-file.dto.ts`, `migration.controller.ts`, `migration.service.ts` | `GET legacy-folder-files` + `PATCH queue/:publicId/file` (staging path XOR tempAttachmentPublicId), path-traversal guard, state guard (PENDING/PENDING_REVIEW, not RUNNING), audit `reviewState.fileReplacements[]`, idempotent replay, auto re-extract |
| `frontend/.../replace-file-dialog.tsx`, `staging-file-viewer.tsx`, `review/[id]/page.tsx`, `migration.service.ts`, locales | Dialog 2 tabs (staging tree → file list / local upload ≤50MB), viewer fallback `/files/preview/:publicId` สำหรับไฟล์นอก staging, i18n th/en |
| `backend/.../migration.service.ts` | `:reextract` → `-reextract` + `idempotencyKey.replace(/:/g,'-')` ใน jobId (`legacy-enrich-*`, `legacy-ocr-batch-*`) — BullMQ ห้าม `:` ใน custom jobId |
| DB (data fix) | `ai_suggested_correspondence_type` 135 rows ตาม prefix rules (LCBP3-C2-*→RFA, สคฉ.3-*/ผรม.2-*→LETTER); BATCH-ADR054-E2E-001 5 rows → IMPORTED + เติม `imported_correspondence_public_id` (ไม่สร้าง Correspondence ซ้ำ) |
| `specs/06-Decision-Records/ADR-040-*.md`, `memory/project-memory-override.md` | บันทึก Known Limitation: sidecar 50MB upload limit + full-doc OCR ยังติด limit |

## กฎที่ Lock แล้ว

- **BullMQ custom `jobId` ห้ามมี `:`** — sanitize caller-supplied idempotencyKey ก่อนต่อใน jobId เสมอ; ระวัง caller อื่นที่ concat `:` ลง jobId (เช่น `rag-batch.service.ts` `rag-prepare:${...}` ยังมี pattern เดียวกัน — ยังไม่แก้ ถ้า path นั้นถูกใช้จะชนปัญหาเดียวกัน)
- **Re-extract reset `ai_confidence`→NULL ก่อน** — หน้าคิวที่เห็น 0% หลัง re-extract คือ stale data; API ส่งค่าใหม่ถูกต้อง ต้อง refresh query
- **Re-extract ไม่ล้าง `importedCorrespondencePublicId`** — item ที่ import แล้วถ้า re-extract จะกลับ PENDING_REVIEW ทั้งที่ยัง link อยู่ (ต้องตัดสินใจภายหลัง: block re-extract บน IMPORTED หรือ preserve status)
- **Bulk commit ไม่ผ่าน fieldAcknowledgments gate** — flagged items (`requiresHumanReview`/`aiFailed`) fail รายตัวด้วย `MIGRATION_REQUIRES_MANUAL_REVIEW`; frontend ยังไม่แสดง `result.failed` (UX gap — toast.success เสมอ)
- **Commit ใช้ `ai_suggested_correspondence_type` column** (ที่แก้ตาม prefix ได้) ไม่ใช่ `details.metadata.correspondenceType` (ค่า AI เดิม)

## Verification

- [x] Backend tsc 0 errors, eslint clean; migration suite 686 tests + replace-file 11/11 (รวม regression test "jobId must not contain ':'")
- [x] Frontend tsc + lint clean
- [x] Prod verify หลัง deploy: filters ทำงานจริง (LETTER+high=135, TRANSMITTAL=5, buckets รวม 247), slice log `69MB/113p → 1.04MB/3p` → OCR DONE conf 0.95
- [x] Data fix verify: 0 rows เหลือที่มี Correspondence แต่ไม่ IMPORTED
- [ ] Browser-verify replace-file flow จริงหลัง deploy fix `a1bb37d6` (ยังไม่ได้กดบน UI หลัง deploy)

## Commits (origin/main)

- `0578bbc1` queue filters + pagination + empty-state
- `495d8417` OCR slice before sidecar upload (413 fix)
- `d1a9738f` docs ADR-040 50MB limit + replace-file feature (squash ของ `40bf7e46`+`6e7cb202`)
- `a1bb37d6` BullMQ jobId `:` fix + regression test
