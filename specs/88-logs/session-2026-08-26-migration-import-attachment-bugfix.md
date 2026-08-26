# Session — 2026-08-26 (Migration Import Attachment Bugfix)

## Summary

แก้ 2 bugs ที่ทำให้ Migration Execute Import ล้มเหลวและไฟล์แนบไม่แสดง:
(1) MariaDB error 1020 "Record has changed since last read in table 'attachments'"
จาก cross-transaction update เมื่อ `importStagingFile` ใช้ default connection (auto-commit)
แล้ว queryRunner transaction พยายาม UPDATE แถวเดียวกัน
(2) "No attachments found" เพราะ `importCorrespondence` ไม่ได้ INSERT ลง
`correspondence_revision_attachments` junction table — เก็บแค่ `attachment_id` ใน
`revision.details` JSON ซึ่ง frontend ไม่ได้ query จาก path นั้น

พบ bug เพิ่มเติมระหว่าง refactor: `commitRecord` ใน `MigrationReviewService` ใช้
ชื่อคอลัมน์ junction table ผิด (`revision_id` แทน `correspondence_revision_id`)
ทำให้ INSERT ล้มเหลวเสมอเมื่อมี temp attachment IDs จริง

นอกจากนี้ได้ทำตาม Architectural Prevention Recommendation: สกัดเมธอดกลาง
`linkAttachmentsToRevision()` เป็น shared utility เพื่อป้องกัน code duplication
และ column name drift ระหว่าง `importCorrespondence` และ `commitRecord`

## ปัญหาที่พบ (Root Cause)

### Bug 1: MariaDB error 1020 — Cross-transaction update

`importCorrespondence()` รันภายใน TypeORM `queryRunner` transaction แต่เรียก
`fileStorageService.importStagingFile()` ซึ่ง save `Attachment` ผ่าน
`this.attachmentRepository.save()` — เป็น connection แยกที่ auto-commit

เมื่อ queryRunner transaction พยายาม `UPDATE attachments SET ocr_text = ? WHERE id = ?`
บนแถวที่ถูกสร้างโดย connection อื่น MariaDB snapshot isolation ตรวจพบว่าแถว
ถูกแก้หลังจาก transaction snapshot ถูกสร้าง จึง throw error 1020

สาเหตุที่ import ครั้งแรก (QC-0001) ดูเหมือนสำเร็จ: เป็นครั้งแรกที่ยังไม่มี snapshot
ก่อนหน้า แต่ครั้งถัดไปทั้งหมด fail ด้วย 500

### Bug 2: "No attachments found" — Missing junction table insert

`importCorrespondence()` เก็บ `attachment_id` เฉพาะใน `revision.details` JSON
ไม่ได้ INSERT ลง `correspondence_revision_attachments` junction table

Frontend query attachments ผ่าน junction table จึงแสดง "No attachments found"
แม้ว่า attachment row มีอยู่จริงใน `attachments` table

### Bug 3 (พบระหว่าง refactor): `commitRecord` ใช้ชื่อคอลัมน์ผิด

`MigrationReviewService.commitRecord()` ใช้ `revision_id` ใน INSERT ลง
`correspondence_revision_attachments` แต่คอลัมน์จริงคือ `correspondence_revision_id`
ทำให้ INSERT ล้มเหลวเสมอ — ยังไม่เคยพบเพราะ queue items ทุกตัวมี
`temp_attachment_ids = null` ทำให้ `commitRecord` throw ValidationException
ก่อนถึงจุดนี้

## การแก้ไข (Fix)

| ไฟล์ | การเปลี่ยนแปลง |
| --- | --- |
| `backend/src/common/file-storage/file-storage.service.ts` | `importStagingFile` รับ optional `manager?: EntityManager` — เมื่อส่งมาจะ save ผ่าน `options.manager.save()` แทน `this.attachmentRepository.save()` เพื่อให้อยู่ใน transaction เดียวกับ caller |
| `backend/src/modules/migration/migration.service.ts` | (1) ส่ง `queryRunner.manager` เข้า `importStagingFile` ทั้ง 2 path (sourceFilePaths + sourceFilePath) (2) เก็บ `allAttachmentIds` ครบทุกตัว (3) เรียก `linkAttachmentsToRevision()` หลัง save revision (4) เพิ่ม `attachment_ids` ใน revision.details |
| `backend/src/modules/migration/migration-review.service.ts` | เปลี่ยนจาก inline loop + raw SQL (ใช้คอลัมน์ผิด `revision_id`) เป็นเรียก `linkAttachmentsToRevision()` shared utility |
| `backend/src/modules/migration/utils/attachment-linking.util.ts` | **ไฟล์ใหม่** — shared utility `linkAttachmentsToRevision(manager, revisionId, attachmentIds)` เก็บชื่อคอลัมน์ junction table เป็น constant ป้องกันพิมพ์ผิด + JSDoc อธิบาย anti-pattern |

## กฎที่ Lock แล้ว

- **D162 — Transaction-Scoped Attachment Save:** เมธอด service ใดที่ persist entity
  และอาจถูกเรียกจากภายใน transaction ต้องรับ optional `EntityManager` parameter
  และใช้ `manager.save()` แทน `this.repository.save()` — ห้ามใช้ default connection
  (auto-commit) เพราะจะทำให้เกิด MariaDB error 1020 "Record has changed since
  last read" เมื่อ transaction พยายามอ่าน/เขียนแถวเดียวกัน

- **D163 — Shared Junction Table Utility:** การ INSERT ลง
  `correspondence_revision_attachments` junction table ต้องใช้
  `linkAttachmentsToRevision()` shared utility เท่านั้น — ห้ามเขียน inline SQL
  เพราะเคยเกิด bug จากการพิมพ์ชื่อคอลัมน์ผิด (`revision_id` แทน
  `correspondence_revision_id`) ใน `commitRecord`

## Verification

- [x] Backend build: `nest build` ผ่าน ไม่มี error
- [x] Backend tests: 167 migration tests + 13 file-storage tests ผ่านทั้งหมด (180 total)
- [x] E2E test individual approve (QC-0001): `201 Import successful, hasAttachment: true`
- [x] E2E test individual approve (QC-0002): `201 Import successful, hasAttachment: true`
- [x] E2E test batch commit (CHEC-LCP-C2-O-24-0002): `201 Batch processing completed, failed: 0, hasAttachment: true`
- [x] Junction table verify: แต่ละ revision มี attachment linked ด้วย `is_main_document=1`
- [x] Backend logs: ไม่มี error ระหว่าง import
- [x] Test data cleaned up; queue items reset เป็น `PENDING_REVIEW`
- [x] ไม่มี `[DEBUG-]` tagged logs เพิ่มเข้ามา (ไม่ได้ใช้ instrumentation)
- [ ] **Commit + push** — pending user authorization
- [ ] **Gitea Actions deploy** — pending after push
- [ ] **Browser verify** — ทดสอบ Execute Import จากหน้า `/admin/migration` และ `/admin/migration/review/[id]`
