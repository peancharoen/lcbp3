# Session — 2026-09-17 (OCR, Migration Review, Correspondence Corrections, Document List Scaling)

## Summary

แก้ OCR context overflow และ rebuild comparison หลัง legacy re-extract, ปิดช่องว่าง OCR-failure acknowledgment ใน Legacy Review Queue, เปิดให้ Admin/Superadmin/DC แก้ Correspondence ระหว่าง Workflow โดยไม่เปลี่ยน workflow state และเพิ่ม server-side filter/sort สำหรับรายการเอกสาร Correspondence/RFA, Circulation, Transmittal และ Drawing.

## ปัญหาที่พบ (Root Cause)

1. PDF text layer เสียทำให้ `RAW_TEXT` ใน OCR prompt ยาวจน request 11,174 tokens เกิน `num_ctx=8192`; raw text ยังทำให้ prompt hash เปลี่ยนทุกหน้าและ reload model ซ้ำ.
2. Legacy enrichment path บันทึก AI extraction แต่ไม่ rebuild `migration_compare` ทำให้ `compare_status=UNAVAILABLE` ค้างหลัง re-extract สำเร็จ.
3. AI hard-failure ไม่มี `ocrQuality` แต่ backend บังคับ acknowledgment ขณะที่ frontend ซ่อน control ดังกล่าว.
4. Correspondence list metadata action เป็น callback ว่าง และ policy เดิม block content correction หลัง submit ทุกบทบาท.
5. Document lists ใช้ client-side sorting/filtering หรือไม่ได้ส่ง sorting state ไป backend จึงไม่รองรับข้อมูลจำนวนมากอย่างถูกต้อง.

## การแก้ไข (Fix)

| ไฟล์/ขอบเขต | การเปลี่ยนแปลง |
| --- | --- |
| OCR sidecar `app.py` | จำกัด `RAW_TEXT` ที่ 2,000 chars และตัด RAW_TEXT ออกจาก stable prompt hash |
| `ai-batch.processor.ts`, `migration.service.ts` | เรียก `migration_compare` หลัง legacy enrichment และ persist compare result/threshold/status |
| Migration review frontend | แสดง OCR failure acknowledgment แม้ไม่มี `ocrQuality` |
| Correspondence backend/frontend | เชื่อม list actions และอนุญาต Admin/Superadmin/DC correction ระหว่าง Workflow โดยคง state/history; `CANCELLED` ยังห้ามแก้ |
| Shared document list header + Correspondence/RFA/Circulation/Transmittal | URL-backed server filter/sort พร้อม reset pagination และ backend sort allow-list |
| Drawing DTO/service/list | Drawing No. และ Created filter/sort ทุกชนิด; Revision filter/sort เฉพาะ Shop/As-Built; Contract Revision และ Drawing Status แสดง `-` ตาม schema/domain ปัจจุบัน |

## กฎที่ Lock แล้ว

- Filter/sort ของ document lists ต้องทำฝั่ง server และชื่อ sort column ต้องผ่าน allow-list.
- RFA ใช้ unified Correspondence endpoint (`type=RFA`).
- Contract Drawing ไม่มี revision model.
- Drawing ไม่มี status field และใช้ soft-delete; ห้ามสร้าง status สมมติเพื่อรองรับ UI.
- Admin/Superadmin/DC correction ระหว่าง Workflow ไม่เปลี่ยน state, task หรือ history; เอกสาร `CANCELLED` ห้ามแก้.

## Verification

- OCR PDF ที่เคยล้มผ่านครบ 3 หน้า; re-extract สำเร็จและ stable prompt hash คงที่.
- Compare rebuild: backend processor/migration tests ผ่าน และ deploy run #775 สำเร็จ.
- Migration OCR acknowledgment: frontend tests 25/25, lint และ build ผ่าน.
- Correspondence correction: backend 54/54, frontend 5/5, builds/lint ผ่าน.
- Document list work: focused frontend 19/19; Drawing backend 60/60; backend/frontend production builds และ lint ผ่าน.

## Commits

- `3a33420c` OCR/migration hardening (pushed)
- `b3803380` compare rebuild after legacy re-extract (pushed/deployed)
- `bfabcfa5` OCR failure acknowledgment (local)
- `314bc14f` admin correspondence corrections (local)
- `3dbeeef7` shared server-side document list filters/sorting (local)
- `ea874c38` Drawing server-side filters/sorting (local)
