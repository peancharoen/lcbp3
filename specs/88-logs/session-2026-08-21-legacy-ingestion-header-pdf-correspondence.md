# Session — 2026-08-21 (Legacy Ingestion Header / PDF / Correspondence Type Display Fixes)

## Summary

แก้ไข 5 ปัญหาใน `/admin/migration` Legacy Management ที่เกิดจากการนำเข้า Excel ทะเบียนเอกสาร Legacy: header ตรวจไม่เจอ, PDF ไม่เจอ, org ID แสดงเป็นตัวเลข, correspondence type ไม่ resolve, และหน้าจอรายงานผลทันทีก่อนงานเสร็จ

## ปัญหาที่พบ (Root Cause)

### ปัญหา 1: Doc Date ไม่ถูกนำเข้า / Issued Date นำเข้าไม่ครบ
- **อาการ:** ส่วนหนึ่งของ Excel มีหัวเรื่องหลายแถวก่อน header จริง เครื่องมือ detect แถวแรกอย่างเดียวแล้วหยุด/throw
- **Root cause:** `detectHeaderMapping` อ่านแถวแรกเท่านั้น ทำให้หัวเรื่อง/คำอธิบายถูกเข้าใจผิดเป็น header

### ปัญหา 2: Sender Org ID แสดงเป็นตัวเลข และไม่มี Receiver Org ID
- **อาการ:** ตาราง Legacy Review Queue แสดง `aiSuggestedCategory` เป็นเลขประเภท ไม่มี sender/receiver organization code
- **Root cause:** API `getReviewQueue` ส่ง INT FK ออกมาโดยไม่ join ข้อมูล master organization

### ปัญหา 3: correspondence_type ใน Excel คือ `id` ของ `correspondence_types`
- **อาการ:** ค่า `ai_suggested_category` ในฐานข้อมูลเก็บเป็น "1", "6" (id) แทนที่จะแสดง RFA / Letter
- **Root cause:** บริการ ingestion เก็บค่า raw จาก Excel โดยไม่ resolve ไป `type_code`

### ปัญหา 4: PDF ไม่พบทั้ง 265 รายการ
- **อาการ:** Error Audit Log: `ไม่พบไฟล์ PDF 'I672-0228-...' ในโฟลเดอร์ Staging` ทั้งที่ไฟล์ `.pdf` มีจริง
- **Root cause:** Excel ระบุชื่อไฟล์โดยไม่มี `.pdf` extension แต่โค้ด resolve แบบ exact/case-insensitive แล้วไม่ลองเติม `.pdf`

### ปัญหา 5: หลังกด Start Ingest แสดงผลทันทีว่านำเข้าได้แค่ 1
- **อาการ:** กด Start Ingest แล้ว toast แสดงตัวเลข ทั้งที่งานยังประมวลผลอยู่
- **Root cause:** `POST /migration/ingest/start` ส่ง 202 Accepted ทันทีโดยไม่รอผล ingestion จริง

## การแก้ไข (Fix)

| ไฟล์ | การเปลี่ยนแปลง |
| --- | --- |
| `backend/src/modules/migration/services/legacy-ingestion.service.ts` | ตรวจจับ Header หลายแถวแรก (สูงสุด 5 แถว); ค้นหา doc number โดย prefer `เอกสารเลขที่`/`Corr. No.` แทน `เลขที่รับ`; เพิ่ม `date of issue`; resolve `correspondence_type` ID → `type_code`; ลองต่อท้าย `.pdf` เมื่อหาไฟล์ไม่เจอ |
| `backend/src/modules/migration/migration.controller.ts` | เปลี่ยน `POST /migration/ingest/start` ให้ `await` ingestion จริงก่อนตอบกลับผลลัพธ์ |
| `backend/src/modules/migration/migration.service.ts` | เพิ่ม `enrichWithReferenceData()` เพื่อ join `organization_code` (sender/receiver) และ `correspondence_type` name เมื่อ `getReviewQueue` / `getQueueItemByPublicId` |
| `frontend/app/(admin)/admin/migration/page.tsx` | เพิ่มคอลัมน์ Correspondence Type, Doc Date, Issued Date, Sender, Receiver ในตาราง Legacy Review Queue |
| `frontend/components/migration/legacy-ingestion-card.tsx` | อัปเดตข้อความ status + ใช้ตัวเลขจริงจาก response หลัง backend รอผล |
| `frontend/types/migration.ts` | เพิ่มฟิลด์ `aiSuggestedCategoryName`, `senderOrganizationCode`, `receiverOrganizationCode`; เพิ่ม `message` และ `filePath` ใน `StartIngestResponse` |
| `backend/src/modules/migration/services/legacy-ingestion.service.spec.ts` | เพิ่ม `CorrespondenceTypeRepository` mock และปรับ test ให้รองรับ repository ใหม่ |

## กฎที่ Lock แล้ว

- **D132 — Legacy Excel Header Detection:** Excel ทะเบียนเอกสารอาจมีหลายแถวหัวเรื่องก่อน header จริง — `detectHeaderMapping` ต้องสแกนและรวมหลายแถวแรก (max 5) ก่อนตัดสินใจ ไม่ใช่แถวเดียว
- **D133 — Legacy Doc Number Priority:** คอลัมน์ `เลขที่รับ` / `DC. No.` บ่อยครั้งเป็นเลขทะเบียนรับ ไม่ใช่เลขเอกสาร — ต้องให้ความสำคัญกับ `เอกสารเลขที่` / `Corr. No.` / `correspondence_number` ก่อน
- **D134 — Legacy PDF Extension Fallback:** ชื่อไฟล์ใน Excel อาจไม่มี `.pdf` — ระบบ resolve ต้องลอง exact match → case-insensitive match → append `.pdf` ก่อน log error
- **D135 — Legacy Ingestion Synchronous Result:** `POST /migration/ingest/start` ต้องรอผล ingestion จริงก่อนตอบกลับ (ไม่ใช่ 202 Accepted) เพื่อ UI แสดงตัวเลขถูกต้อง

## Verification

- [x] Backend build ผ่าน (`nest build`)
- [x] Backend unit tests ผ่าน (`legacy-ingestion`)
- [x] Frontend build ผ่าน (`next build`)
- [x] TypeScript typecheck ผ่านทั้ง backend/frontend
- [ ] Browser verify โดยผู้ใช้: นำเข้า `ทะเบียนเอกสาร C2-2567.xlsx` อีกครั้ง ตรวจสอบ 265 รายการ + ไม่มี Error PDF
- [ ] ตรวจสอบตาราง Legacy Review Queue แสดง org code / dates / correspondence type name

## Commits

- `399a2589` — fix(migration): legacy ingestion header mapping, PDF resolution, and review queue display
