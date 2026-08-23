# Session 2026-08-23 — Migration Review Findings Fix

## Summary

แก้ไขจุดบกพร่องจาก review findings ใน migration workflow (frontend/backend) ให้สอดคล้องกับ schema และ ADR-019/ADR-047 แล้ว commit/push ผ่าน `2git.sh`

## ปัญหาที่พบ (Root Cause)

1. **Discipline contract ผิด:** Frontend ส่ง `disciplinePublicId` (string) แต่ backend DTO รับแล้วแปลงเป็น `Number()` ในขณะที่ `disciplines` table เป็น INT PK ไม่มี UUID publicId — สับสนและเสี่ยง coerce UUID ผิด
2. **Batch commit ไม่ส่ง Discipline และ canonical path:** Legacy Management batch payload ไม่ได้ส่ง `disciplineId` และ `sourceFilePath` ทำให้ import ขาดข้อมูล
3. **Recipient lookup ไม่แยก recipientType:** `CorrespondenceRecipient` lookup ไม่ระบุ `recipientType` ทำให้ CC recipient ถูกมองเป็น TO
4. **Individual review ใช้ `projectId: 1` ตายตัว:** ทำให้ import รายการจาก project อื่นเข้า project 1
5. **Source path อ่านผิดที่:** Review page อ่าน `aiIssues.sourceFilePath` แทน `details.source_file_path` ที่ ingestion เก็บจริง
6. **Select All เลือกเฉพาะ executable items:** ทำให้เลือก `PENDING` เพื่อ batch Start Extract ไม่ได้
7. **Batch filter ฝั่ง client หลัง pagination:** ทำให้ดู batch ไม่ครบ ต้อง filter ที่ backend
8. **ADR-047 / rollouts เอกสารตกรุ่น:** Status ยัง Proposed, route ผิด, affected components ผิด, rollouts status ไม่ตรง session note

## การแก้ไข (Fix)

| ไฟล์ | การเปลี่ยนแปลง |
| --- | --- |
| `backend/src/modules/migration/dto/import-correspondence.dto.ts` | ลบ `disciplinePublicId`, ใช้ `disciplineId?: number` โดยตรง ตรงกับ `disciplines.id` |
| `backend/src/modules/migration/migration.service.ts` | ตรวจสอบ `disciplineId` ผ่าน `dataSource.manager.findOne`; เพิ่ม `recipientType: 'TO'` ใน recipient lookup; เพิ่ม `batchId` filter ใน `getReviewQueue` |
| `backend/src/modules/migration/dto/migration-queue-query.dto.ts` | เพิ่ม `batchId?: string` filter |
| `backend/src/modules/migration/migration.service.spec.ts` | เพิ่ม regression tests สำหรับ discipline lookup และ recipientType filter |
| `frontend/app/(admin)/admin/migration/page.tsx` | Select All เลือกทุกรายการ; ปุ่ม batch แสดงจำนวน actionable; ส่ง `disciplineId` + `sourceFilePath` ใน batch import; ส่ง `batchId` ไป backend filter |
| `frontend/app/(admin)/admin/migration/review/[id]/page.tsx` | อ่าน `details.source_file_path`/`details.disciplineId`; ส่ง `disciplineId` (INT); ใช้ `item.projectId` แทน hard-coded 1 |
| `frontend/lib/services/migration.service.ts` | เพิ่ม `batchId` ใน `getReviewQueue` params |
| `frontend/types/migration.ts` | เพิ่ม `details?: Record<string, unknown> \| null` |
| `specs/06-Decision-Records/ADR-019-hybrid-identifier-strategy.md` | ชี้แจงว่า Master/Lookup tables (รวม `disciplines`) ใช้ INT id โดยตรง |
| `specs/06-Decision-Records/ADR-047-native-backend-legacy-ingestion.md` | Status `Proposed` → `Accepted`; แก้ route `/admin/migration/review/:publicId`; แก้ affected components ให้ตรง `legacy-ai-enrichment` |
| `specs/88-logs/rollouts.md` | แก้สถานะแถว 2026-08-22 ให้ระบุ code ready + pending deploy + manual verify |

## กฎที่ Lock แล้ว

- **Dxx (Migration Review):** `disciplines` ใช้ internal INT id ใน migration API ตาม ADR-019 Excluded Tables; ห้ามสร้าง `disciplinePublicId` ใหม่โดยไม่มี schema decision
- **Dxx (Migration Review):** Recipient lookup ใน import flow ต้องระบุ `recipientType: 'TO'` เสมอ
- **Dxx (Migration Review):** Batch filter ต้องทำที่ backend (pagination ครบถ้วน) ไม่ filter ฝั่ง client หลัง pagination

## Verification

- [x] `backend npx tsc --noEmit` pass
- [x] `frontend npx tsc --noEmit` pass
- [x] `frontend npm run lint` pass
- [x] `backend npx jest src/modules/migration` 109/109 pass
- [x] `frontend npx vitest run components/migration/__tests__/review-queue-table.test.tsx lib/services/__tests__/migration.service.test.ts` 18/18 pass
- [x] `bash 2git.sh "fix(migration): review findings ..."` commit `ad53c1cd` + push Gitea สำเร็จ
- [ ] Gitea Actions deploy complete
- [ ] Manual workflow verification (ingest → extract → review → import)
