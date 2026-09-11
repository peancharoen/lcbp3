// File: specs/200-fullstacks/244-native-backend-legacy-ingestion/test-plan.md
// Change Log:
// - 2026-09-11: Initial unified test plan — ครอบคลุมทุกสเปคที่เกี่ยวข้องกับ /admin/migration

# แผนการทดสอบรวม: การนำเข้าข้อมูลเก่า (/admin/migration)

**วันที่ร่าง**: 2026-09-11
**ขอบเขต**: หน้าจอ `/admin/migration` + `/admin/import-review` และ Backend Migration Module ทั้งหมด
**ADR อ้างอิง**: ADR-028, ADR-042, ADR-047, ADR-052, ADR-023A, ADR-019, ADR-016, ADR-008
**Test Data**: ให้ใช้โดยเลือก
 - ไฟล์ Excel (.xlsx)=เลือกจาก NAS ที่มีอยู่แล้ว
 - เลือกไฟล์จาก NAS=C2024-5.xlsx (13KB)
 - โฟลเดอร์ Staging PDF บน NAS=\incoming\08C.2\2567
 - ชื่อโครงการ *=LCBP-C2
---

## 1. สเปคใน 200-fullstacks ที่เกี่ยวข้อง

### 1.1 Core Specs — สเปคหลักที่ implement `/admin/migration` โดยตรง

| # | สเปค | ADR | หน้าที่ | สถานะ Implementation |
|---|------|-----|--------|---------------------|
| 1 | **228-migration-arch-refactor** | ADR-028 | Staging Queue pattern, n8n→BullMQ, Review Queue, Tags tables, Post-migration cleanup | ส่วนใหญ่ implement แล้ว (บางส่วน superseded โดย 244) |
| 2 | **242-migration-ai-pipeline** | ADR-028, ADR-042 | Multi-attachment, AI Compare (ทะเบียน vs เอกสาร), OCR text persistence, Post-migration Tag/UUID resolution, Batch RAG embedding | Draft — บางส่วน implement ใน 244 |
| 3 | **244-native-backend-legacy-ingestion** | ADR-047 | **Main impl**: LegacyIngestionService, ExcelJS Streaming, CLI + Web Upload, OCR 3 หน้า, OCR Editing UI, RAG Auto-Sync, Batch Approve | Specified — validation PASS 47/47 |
| 4 | **252-excel-data-review-pipeline** | ADR-052 | 4-Layer Excel Review (Schema→Business Rules→AI Reviewer→Stash & Confirm), Annotated Excel download, Two-phase Stash | Implemented — 223 tests pass, มี test-plan.md แล้ว |

### 1.2 Supporting Specs — สเปคสนับสนุนที่ migration ใช้

| # | สเปค | ความเกี่ยวข้อง | สถานะ |
|---|------|---------------|-------|
| 5 | **241-ocr-persist-sandbox** (ADR-042) | OCR text persistence ใน `attachments.ocr_text` — migration ใช้ผล OCR ที่บันทึกไว้ | Superseded by ADR-043 (audit trail) |
| 6 | **253-unified-doc-crud** | Correspondence creation API — migration commit เรียกใช้ | Implemented |
| 7 | **254-rag-attachment-chunks** | RAG chunking strategy — post-migration batch RAG ใช้ | Recent |
| 8 | **255-rag-admin-console** | Batch RAG management UI — admin จัดการ RAG หลัง migration | Recent |

### 1.3 แผนภาพความสัมพันธ์ (Dependency Flow)

```
228 (ADR-028: Staging Queue + Review Queue + Tags + Cleanup)
  │
  ├──► 244 (ADR-047: LegacyIngestionService — CLI + Web Upload + OCR + Batch Approve)
  │      │
  │      ├──► 241 (ADR-042: OCR Text Persistence)
  │      ├──► 253 (Correspondence CRUD — commit target)
  │      └──► 254/255 (Post-migration RAG batch)
  │
  ├──► 242 (Multi-attachment + AI Compare + Post-migration Tag/UUID + Batch RAG)
  │
  └──► 252 (ADR-052: 4-Layer Excel Review Pipeline — ด่านตรวจก่อนเข้า Staging)
```

---

## 2. โครงสร้างการทดสอบ

การทดสอบแบ่งเป็น **5 Phase** ตามลำดับความสำคัญและ dependency:

```
Phase 1: Browser E2E (P1)     ← ทดสอบผ่านเบราว์เซอร์จริง
  ↓
Phase 2: Backend Unit Test    ← ทดสอบ unit ที่ยังขาด
  ↓
Phase 3: Integration Test     ← ทดสอบการเชื่อมต่อระหว่าง service
  ↓
Phase 4: Performance Test     ← ทดสอบประสิทธิภาพ (SC criteria)
  ↓
Phase 5: Security & RBAC      ← ทดสอบความปลอดภัย
```

---

## 3. Phase 1: Browser E2E (P1 — ทำก่อน)

> **เป้าหมาย**: ยืนยันว่าผู้ใช้ใช้งานผ่านหน้าเว็บ `/admin/migration` และ `/admin/import-review` ได้จริง

### 1A. หน้า `/admin/migration` — Legacy Review Queue (Spec 244)

**เตรียมการ**:
- [ ] Backend + Frontend deploy แล้ว (CI run ล่าสุด pass)
- [ ] มี project อย่างน้อย 1 โครงการในระบบ
- [ ] User ทดสอบมี permission `migration.import` + `migration.review`
- [ ] มีข้อมูลใน `migration_review_queue` อย่างน้อย 5 รายการ (PENDING + AI_COMPLETED)

| ขั้นตอน | การกระทำ | ผลที่คาดหวาง | FR/Spec |
|---------|---------|-------------|---------|
| 1A.1 | ล็อกอินเป็น Document Controller, เข้า `/admin/migration` | แสดง Review Queue พร้อมรายการ PENDING | 244 FR-004 |
| 1A.2 | ตรวจสอบ filter: Status (PENDING/PENDING_REVIEW/IMPORTED) | filter ทำงาน, กรองรายการถูกต้อง | 244 US2 |
| 1A.3 | ตรวจสอบ filter: AI Status (RUNNING/COMPLETED/FAILED) | filter ทำงาน | 244 US2 |
| 1A.4 | ตรวจสอบ filter: Batch ID | dropdown แสดง batch ที่มี, เลือกแล้วกรองได้ | 244 US2 |
| 1A.5 | คลิก "ดู" รายการที่ AI_COMPLETED | เปิดหน้า review detail `/admin/migration/review/[id]` | 244 US3 |
| 1A.6 | ตรวจสอบ OCR Text textarea แสดงข้อความ OCR 3 หน้าแรก | textarea แสดงข้อความ, แก้ไขได้ | 244 FR-009, FR-010 |
| 1A.7 | แก้ไขข้อความ OCR แล้วกด "บันทึกและอัปเดต RAG" | แสดง toast สำเร็จ, `ocr_text` อัปเดต, BullMQ re-embed ทำงาน | 244 FR-010, FR-011 |
| 1A.8 | กลับมาหน้า queue, เลือกรายการที่ `ai_confidence >= 0.85` | checkbox เลือกได้, "Select All" เลือกเฉพาะ high-confidence | 244 FR-014 |
| 1A.9 | กด "Batch Approve" | ส่งเข้า BullMQ background commit, แสดง progress | 244 FR-014 |
| 1A.10 | รอจน commit เสร็จ, ตรวจสอบสถานะเปลี่ยนเป็น IMPORTED | รายการหายไปจาก PENDING queue | 244 FR-014 |
| 1A.11 | ตรวจสอบว่า Correspondence ถูกสร้างจริงในระบบ | ค้นหาเลขที่เอกสารเจอใน Correspondences | 244 US2 |
| 1A.12 | กด "Reject" รายการหนึ่ง | สถานะเปลี่ยน, ไม่สร้าง Correspondence | 244 US2 |
| 1A.13 | กด "Delete All" (หรือ "Delete Selected") | ลบรายการ + queue BullMQ cleanup temp file | 244 FR-005 |
| 1A.14 | เข้าหน้า `/admin/migration/errors` | แสดงรายการ error จาก `migration_errors` | 244 FR-006 |

### 1B. หน้า `/admin/migration` — Web Upload (Spec 244 US4)

| ขั้นตอน | การกระทำ | ผลที่คาดหวาง | FR/Spec |
|---------|---------|-------------|---------|
| 1B.1 | คลิก "อัปโหลดไฟล์ Excel" (LegacyIngestionCard) | แสดงฟอร์มอัปโหลด | 244 FR-013 |
| 1B.2 | เลือกไฟล์ `.xlsx` ขนาด 10-50 แถว + เลือก Project + Contract | ฟอร์มพร้อม | 244 FR-013 |
| 1B.3 | กด "เริ่มการนำเข้า" | แสดง progress bar, รายการเข้า queue ทันที | 244 FR-013, FR-004 |
| 1B.4 | รอจนเสร็จ, ตรวจสอบรายการใหม่ปรากฏใน Review Queue | รายการ PENDING ปรากฏ | 244 FR-004 |

### 1C. หน้า `/admin/import-review` — 4-Layer Excel Review (Spec 252)

> **หมายเหตุ**: test-plan เฉพาะของ 252 มีอยู่แล้วที่ `252-excel-data-review-pipeline/test-plan.md` — ส่วนนี้สรุป key scenarios

| ขั้นตอน | การกระทำ | ผลที่คาดหวาง | FR/Spec |
|---------|---------|-------------|---------|
| 1C.1 | ล็อกอินเป็น Document Controller, เข้า `/admin/import-review` | แสดงหน้า "ตรวจสอบข้อมูลนำเข้า Excel" | 252 FR-001 |
| 1C.2 | เลือกโครงการ, อัปโหลด .xlsx, โหมด DIRECT_IMPORT, AI=Local, Batch=Full | ฟอร์มพร้อม | 252 FR-001 |
| 1C.3 | กด "อัปโหลดและตรวจสอบ" | แสดงสรุป: ทั้งหมด/ผ่าน/คำเตือน/BLOCK/AI แนะนำ | 252 FR-003, FR-004 |
| 1C.4 | กด "ดาวน์โหลด Annotated Excel" | ดาวน์โหลด .xlsx สำเร็จ, เปิดดูมีสีไฮไลต์ + Cell Notes | 252 FR-010 |
| 1C.5 | กด "ยืนยันนำเข้า" (ถ้า canConfirm=true) | แสดงผล: Batch ID, นำเข้าสำเร็จ | 252 FR-014, FR-017 |
| 1C.6 | ล็อกอินเป็น Admin, เลือก MIGRATION_STAGING + อัปโหลดไฟล์มีแถวเสีย | แสดง BLOCK count > 0, มีปุ่ม download failed_rows.xlsx | 252 FR-015 |
| 1C.7 | กด "ยืนยันนำเข้า" (MIGRATION_STAGING) | นำเข้าสำเร็จ + Quarantine > 0 | 252 FR-015 |

### 1D. RBAC / Permission Tests ผ่าน Browser

| ขั้นตอน | การกระทำ | ผลที่คาดหวาง | FR/Spec |
|---------|---------|-------------|---------|
| 1D.1 | Document Controller พยายามเลือก MIGRATION_STAGING | ตัวเลือก disabled/hidden | 252 FR-018 |
| 1D.2 | Document Controller พยายามเลือก GEMINI/CLAUDE | ตัวเลือก External AI ไม่แสดง | 252 FR-018 |
| 1D.3 | User ไม่มี permission `migration.import` เข้า `/admin/migration` | แสดง "ไม่มีสิทธิ์" | 244 FR-015 |
| 1D.4 | User ไม่มี permission `correspondence.import_review` เข้า `/admin/import-review` | แสดง "ไม่มีสิทธิ์" | 252 FR-018 |
| 1D.5 | VIEWER พยายามกด Execute Import / Batch Approve | ได้รับ 403 Forbidden | 228 FR-007 |

### 1E. Edge Cases ผ่าน Browser

| ขั้นตอน | การกระทำ | ผลที่คาดหวาง | Edge Case |
|---------|---------|-------------|-----------|
| 1E.1 | อัปโหลดไฟล์ที่มีวันที่ พ.ศ. (15/01/2568) | แปลงเป็น ค.ศ. อัตโนมัติ | 252 Edge #2 |
| 1E.2 | อัปโหลดไฟล์ที่ received_date < issued_date | ติด BLOCK "ลำดับวันที่ขัดแย้ง" | 252 US1 AC#3 |
| 1E.3 | อัปโหลดไฟล์ที่ Project Code ไม่ตรง | ติด BLOCK (Project Mismatch) | 252 Edge #1 |
| 1E.4 | อัปโหลดไฟล์ที่ระบุ fileName แต่ไม่ได้แนบไฟล์ | ติด WARN | 252 Edge #4 |
| 1E.5 | อัปโหลดไฟล์ที่มีคอลัมน์ `[AI]` (re-upload) | ระบบเพิกเฉยคอลัมน์ `[AI]` | 252 FR-011 |
| 1E.6 | ปิด Ollama, อัปโหลดไฟล์ | แสดง "AI Review unavailable" แต่ Layer 1/2 ยังทำงาน | 252 FR-009, Edge #3 |
| 1E.7 | อัปโหลดไฟล์ที่ชื่อ PDF มี space/case ไม่ตรง | ระบบ normalize ชื่อ + ค้นหา case-insensitive | 244 Edge #1 |
| 1E.8 | อัปโหลดไฟล์ที่มีแถวว่าง/วันที่ผิด format | บันทึก error แต่ไม่หยุดทั้ง batch | 244 Edge #2 |

### 1F. Console / Network Check

- [ ] DevTools Console — ไม่มี error/warning ที่เกี่ยวข้อง
- [ ] Network tab — request ไป `/api/migration/*` และ `/api/v1/correspondence/import-review/*` ส่งครบ parameter
- [ ] ไม่มี double-prefix bug (`/api/api/v1/...`)
- [ ] Responsive: 375px mobile + 1280px desktop ไม่มี horizontal overflow

---

## 4. Phase 2: Backend Unit Tests (P2 — ช่องว่างเร่งด่วน)

### 2A. Migration Controller (Spec 244) — เพิ่ม coverage

**ไฟล์**: `backend/src/modules/migration/migration.controller.spec.ts` (เติมเข้าเดิม)

| Test | Endpoint | สถานการณ์ | ผลที่คาดหวาง |
|------|----------|-----------|-------------|
| 2A.1 | `POST /ingest/upload` | ไม่แนบไฟล์ | 400 "ต้องแนบไฟล์" |
| 2A.2 | `POST /ingest/upload` | ไฟล์ไม่ใช่ .xlsx | 400 "ประเภทไฟล์ไม่รองรับ" |
| 2A.3 | `POST /ingest/start` | ไม่มี Idempotency-Key | 400 |
| 2A.4 | `POST /ingest/start` | Idempotency-Key ซ้ำ | 409 + existingBatchId |
| 2A.5 | `PATCH /queue/:publicId/ocr` | publicId ไม่ใช่ UUID | 400 (ParseUUIDPipe) |
| 2A.6 | `PATCH /queue/:publicId/ocr` | ไม่มี Idempotency-Key | 400 |
| 2A.7 | `POST /queue/:publicId/approve` | publicId ไม่ใช่ UUID | 400 |
| 2A.8 | `POST /queue/:publicId/reject` | ไม่มี Idempotency-Key | 400 |
| 2A.9 | `POST /commit_batch` | ไม่มี Idempotency-Key | 400 |
| 2A.10 | `GET /queue` | pagination + filter ถูกต้อง | 200 + ข้อมูล paginated |
| 2A.11 | `GET /errors` | มี error records | 200 + ข้อมูล |
| 2A.12 | `DELETE /queue/all` | มี selectedPublicIds | ลบ + queue cleanup |
| 2A.13 | `DELETE /queue/selected` | ส่ง publicIds ที่ไม่ใช่ UUID | 400 |

### 2B. Excel Import Review Controller (Spec 252) — จาก 252 test-plan

**ไฟล์**: `backend/src/modules/migration/excel-import-review.controller.spec.ts` (เติมเข้าเดิม)

| Test | Endpoint | สถานการณ์ | ผลที่คาดหวาง |
|------|----------|-----------|-------------|
| 2B.1 | `POST /check` | ไม่แนบไฟล์ | 400 |
| 2B.2 | `POST /check` | Document Controller เลือก MIGRATION_STAGING | 403 |
| 2B.3 | `POST /check` | Document Controller เลือก GEMINI | 403 |
| 2B.4 | `GET /:sessionId/download-annotated` | sessionId ไม่ใช่ UUID | 400 |
| 2B.5 | `GET /:sessionId/download-annotated` | ไฟล์มีจริง | stream สำเร็จ |
| 2B.6 | `GET /:sessionId/download-annotated` | ไฟล์ไม่มี | 404 |
| 2B.7 | `GET /:sessionId/download-failed-rows` | ไฟล์มีจริง | stream สำเร็จ |
| 2B.8 | `GET /:sessionId/download-failed-rows` | ไฟล์ไม่มี | 404 |
| 2B.9 | `POST /:sessionId/confirm` | sessionId ไม่ใช่ UUID | 400 |
| 2B.10 | `POST /:sessionId/cancel` | sessionId ไม่ใช่ UUID | 400 |

### 2C. Legacy Ingestion Service (Spec 244) — edge case tests

**ไฟล์**: `backend/src/modules/migration/services/legacy-ingestion.service.spec.ts` (เติมเข้าเดิม)

| Test | สถานการณ์ | ผลที่คาดหวาง |
|------|-----------|-------------|
| 2C.1 | Excel มีหลาย Worksheet, ไม่ระบุ `--sheet` | อ่าน Sheet แรก (Index 0) |
| 2C.2 | Excel มีหลาย Worksheet, ระบุ `--sheet=Sheet2` | อ่าน Sheet ที่ระบุ |
| 2C.3 | หัวคอลัมน์ภาษาไทย (`เลขที่เอกสาร`, `เรื่อง`) | detect header mapping ถูกต้อง |
| 2C.4 | หัวคอลัมน์ภาษาอังกฤษ (`Doc No`, `Subject`) | detect header mapping ถูกต้อง |
| 2C.5 | แถวที่หาไฟล์ PDF ไม่พบ | บันทึก `migration_errors`, ไม่หยุด batch |
| 2C.6 | เลขที่เอกสารซ้ำใน batch เดียวกัน | เพิ่ม revisionNumber (0, 1, 2...) |
| 2C.7 | วันที่เป็น Excel Serial Number | parse ถูกต้อง |
| 2C.8 | วันที่เป็น DD/MM/YYYY | parse ถูกต้อง |
| 2C.9 | วันที่ parse ไม่ได้ | บันทึกเป็น NULL + log error |
| 2C.10 | หน่วยงาน (From/To) ไม่ตรง Master Data | ใส่ NULL + บันทึก `details.unresolved_orgs` |
| 2C.11 | รันซ้ำด้วย `--resume` | ทำต่อจาก checkpoint, ไม่ทำซ้ำ |
| 2C.12 | Idempotency-Key ซ้ำ (ไฟล์เดิม) | ข้ามอัตโนมัติ |

### 2D. Migration Review Service (Spec 244) — commit + RAG sync

**ไฟล์**: `backend/src/modules/migration/migration-review.service.spec.ts` (เติมเข้าเดิม)

| Test | สถานการณ์ | ผลที่คาดหวาง |
|------|-----------|-------------|
| 2D.1 | Approve รายการที่ status != PENDING | 409 ALREADY_PROCESSING (SELECT FOR UPDATE) |
| 2D.2 | Approve สำเร็จ → สร้าง Correspondence | Correspondence ถูกสร้าง, ไฟล์ย้าย temp→permanent |
| 2D.3 | Commit แล้ว trigger RAG re-embed | BullMQ embed job ถูกสร้าง |
| 2D.4 | OCR edit → trigger RAG re-embed | BullMQ embed job ถูกสร้าง |
| 2D.5 | Batch Approve (confidence >= 0.85) | ส่งเข้า BullMQ background commit |
| 2D.6 | Batch Approve รายการที่ confidence < 0.85 | ปฏิเสธ (เฉพาะ high-confidence) |
| 2D.7 | Reject รายการ | สถานะเปลี่ยน, ไม่สร้าง Correspondence |
| 2D.8 | Double-click Execute Import (race condition) | idempotency ป้องกัน duplicate |

### 2E. Review Session Stash Service (Spec 252) — coverage bump

**ไฟล์**: `backend/src/modules/migration/services/review-session-stash.service.spec.ts` (เติมเข้าเดิม)

| Test | สถานการณ์ | ผลที่คาดหวาง |
|------|-----------|-------------|
| 2E.1 | `listExpiredStashDirs()` — มี dir หมดอายุ | คืน array ของ dir names |
| 2E.2 | `listExpiredStashDirs()` — ไม่มี dir หมดอายุ | คืน `[]` |
| 2E.3 | `listExpiredStashDirs()` — root dir ไม่มี | คืน `[]` (ไม่โยน error) |
| 2E.4 | `deleteSession()` — ลบ dir ที่มีไฟล์ | ลบสำเร็จ |
| 2E.5 | `deleteSession()` — ลบ dir ที่ไม่มี | ไม่โยน error (idempotent) |

### 2F. Workers

| Test | ไฟล์ | สถานการณ์ | ผลที่คาดหวาง |
|------|------|-----------|-------------|
| 2F.1 | `clean-expired-stashes.worker.spec.ts` | cron trigger → มี expired dirs 2 อัน | ลบ 2 dirs |
| 2F.2 | `clean-expired-stashes.worker.spec.ts` | cron trigger → ไม่มี expired dirs | log "cleaned 0" |
| 2F.3 | `clean-expired-stashes.worker.spec.ts` | stash root ไม่มี | log warning, ไม่โยน |
| 2F.4 | `expire-pending-reviews.worker.ts` | PENDING > 30 วัน | auto-expire เป็น EXPIRED + cleanup + แจ้ง Admin |

---

## 5. Phase 3: Integration Tests (P2)

### 3A. End-to-End Migration Flow (Spec 228 + 244 + 252)

**ไฟล์**: `backend/test/migration-integration.spec.ts` (สร้างใหม่ หรือเติมถ้ามี)

| Test | สถานการณ์ | ผลที่คาดหวาง | Spec |
|------|-----------|-------------|------|
| 3A.1 | อัปโหลด Excel ผ่าน 4-Layer Review → Confirm → เข้า Staging Queue | รายการปรากฏใน `migration_review_queue` สถานะ PENDING | 252→244 |
| 3A.2 | Staging Queue → BullMQ ai-batch → OCR + AI enrichment | `ocr_text` บันทึก, `ai_confidence` อัปเดต, tags แนะนำ | 244 FR-008, FR-009 |
| 3A.3 | Review Queue → Approve → Correspondence สร้าง | Correspondence ใน `correspondences`, ไฟล์ย้าย permanent | 244 US2 |
| 3A.4 | Commit → RAG re-embed → Qdrant upsert | Vector ใน Qdrant มี `projectPublicId` filter | 244 FR-011, ADR-023A |
| 3A.5 | Multi-attachment: 1 Correspondence + 3 ไฟล์แนบ | ไฟล์ทั้ง 3 ผูกกับ Correspondence เดียวกัน | 242 FR-001, FR-002 |
| 3A.6 | AI Compare: ทะเบียน vs เอกสาร ไม่ตรง 5 ช่อง | แสดงรายช่องที่ไม่ตรง + confidence score | 242 FR-006, FR-007 |
| 3A.7 | Post-migration Tag resolution (batch) | Tags ถูกสร้าง/เชื่อมจากค่าในทะเบียน | 242 FR-018 |
| 3A.8 | Post-migration RAG batch (ระบุชุด) | เฉพาะชุดที่ระบุถูก embed | 242 FR-021, FR-026a |
| 3A.9 | Temp file auto-cleanup 24h หลัง job failed | ไฟล์ถูกลบ, ไม่ลบไฟล์ที่ PENDING ใน review queue | 228 FR-005, FR-005a |
| 3A.10 | PENDING > 30 วัน auto-expire | สถานะเปลี่ยนเป็น EXPIRED + cleanup + แจ้ง Admin | 228 FR-005b |

### 3B. CLI Ingestion Flow (Spec 244)

| Test | สถานการณ์ | ผลที่คาดหวาง |
|------|-----------|-------------|
| 3B.1 | `pnpm run migration:ingest -- --file=sample.xlsx --project=LCBP3-C2` | อ่าน Excel, บันทึก queue, checkpoint ทุก 50 แถว |
| 3B.2 | `--resume` หลัง Ctrl+C | ทำต่อจาก checkpoint ล่าสุด |
| 3B.3 | `--sheet=Sheet2` | อ่าน Sheet ที่ระบุ |
| 3B.4 | Memory < 100MB สำหรับ 20,000 แถว | ตรวจ RAM ไม่เกิน 100MB |

---

## 6. Phase 4: Performance Tests (P3)

### 4A. SC Criteria จาก Spec 244

| Test | เกณฑ์ | วิธีวัด |
|------|-------|--------|
| 4A.1 | ExcelJS Streaming < 100MB RAM สำหรับ 20,000 แถว | `process.memoryUsage().heapUsed` ระหว่าง ingestion |
| 4A.2 | OCR 3 หน้าแรก < 60 วินาที/ไฟล์ (scanned PDF) | วัดเวลา BullMQ worker |
| 4A.3 | Batch Approve background commit ไม่ timeout | ไม่เกิน BullMQ lockDuration (150s) |

### 4B. SC Criteria จาก Spec 252

**ไฟล์**: `backend/src/modules/migration/services/excel-data-review.benchmark.spec.ts` (สร้างใหม่)

| Test | เกณฑ์ | วิธีวัด |
|------|-------|--------|
| 4B.1 | Layer 1+2 ตรวจ 200 แถว < 1.5 วินาที | `performance.now()` ก่อน/หลัง `check()` |
| 4B.2 | Annotated Excel ≤200 แถว < 10 วินาที | `performance.now()` ก่อน/หลัง generate |
| 4B.3 | Layer 1+2 ตรวจ 50 แถว < 500ms (sanity) | เช็คเบื้องต้น |

### 4C. SC Criteria จาก Spec 242

| Test | เกณฑ์ | วิธีวัด |
|------|-------|--------|
| 4C.1 | AI Compare ตรวจ 100 ฉบับ → แจ้งไม่ตรง ≥ 90% (SC-002) | เทียบกับชุดทดสอบที่ทราบคำตอบ |
| 4C.2 | แจ้งไม่ตรงผิดพลาด ≤ 10% (SC-003) | วัด false positive rate |
| 4C.3 | Semantic search ผลลัพธ์ < 2 วินาที (SC-008) | วัดเวลา query Qdrant |

---

## 7. Phase 5: Security & RBAC Tests (P2)

### 5A. CASL Guard / RBAC (Spec 228, 244, 252)

| Test | สถานการณ์ | ผลที่คาดหวาง | Spec |
|------|-----------|-------------|------|
| 5A.1 | VIEWER พยายาม `POST /ingest/upload` | 403 | 244 FR-015 |
| 5A.2 | VIEWER พยายาม `PATCH /queue/:id/ocr` | 403 | 244 FR-015 |
| 5A.3 | VIEWER พยายาม `POST /queue/:id/approve` | 403 | 244 FR-015 |
| 5A.4 | VIEWER พยายาม `POST /commit_batch` | 403 | 228 FR-007 |
| 5A.5 | Document Controller พยายาม MIGRATION_STAGING | 403 | 252 FR-018 |
| 5A.6 | Document Controller พยายาม External AI (Gemini/Claude) | 403 | 252 FR-018 |
| 5A.7 | Document Controller ใช้ DIRECT_IMPORT + Local AI | 200 | 252 FR-018 |
| 5A.8 | Admin ใช้ MIGRATION_STAGING + Local AI | 200 | 252 FR-018 |

### 5B. UUID / ADR-019 Compliance

| Test | สถานการณ์ | ผลที่คาดหวาง |
|------|-----------|-------------|
| 5B.1 | API response ไม่เปิดเผย INT PK | มีแค่ `publicId` (UUIDv7) |
| 5B.2 | `PATCH /queue/:publicId/ocr` รับ UUID เท่านั้น | non-UUID → 400 |
| 5B.3 | Frontend ใช้ `publicId` string ทุกที่ | ไม่มี `parseInt(id)` |

### 5C. AI Boundary (ADR-023A)

| Test | สถานการณ์ | ผลที่คาดหวาง |
|------|-----------|-------------|
| 5C.1 | Migration commit → RAG embed มี `projectPublicId` filter | Qdrant upsert มี filter |
| 5C.2 | AI audit log บันทึกทุก job | `ai_audit_logs` มี record ครบ |
| 5C.3 | BullMQ ai-batch concurrency=1 | ไม่มี concurrent GPU jobs |
| 5C.4 | n8n ไม่เรียก Ollama โดยตรง (ผ่าน DMS API เท่านั้น) | ตรวจ network policy |

### 5D. Idempotency & Audit Trail

| Test | สถานการณ์ | ผลที่คาดหวาง |
|------|-----------|-------------|
| 5D.1 | Execute Import ซ้ำ (double-click) | `import_transactions` idempotency ป้องกัน duplicate |
| 5D.2 | Ingestion ซ้ำด้วยไฟล์เดิม | Idempotency-Key ข้าม |
| 5D.3 | ทุก approve/reject บันทึก `reviewed_by` + `reviewed_at` | audit log ครบ |
| 5D.4 | OCR edit บันทึก audit trail | `reviewed_by` + `reviewed_at` บันทึก |

---

## 8. ไฟล์ทดสอบสรุป

| ไฟล์ | สถานะ | Tests เพิ่ม | Phase | Spec |
|------|-------|-----------|-------|------|
| `migration.controller.spec.ts` | เติมเข้าเดิม | ~13 | P2 | 244 |
| `excel-import-review.controller.spec.ts` | เติมเข้าเดิม | ~10 | P2 | 252 |
| `legacy-ingestion.service.spec.ts` | เติมเข้าเดิม | ~12 | P2 | 244 |
| `migration-review.service.spec.ts` | เติมเข้าเดิม | ~8 | P2 | 244 |
| `review-session-stash.service.spec.ts` | เติมเข้าเดิม | ~5 | P2 | 252 |
| `clean-expired-stashes.worker.spec.ts` | เติมเข้าเดิม | ~3 | P2 | 244 |
| `expire-pending-reviews.worker.spec.ts` | สร้างใหม่ | ~2 | P2 | 228 |
| `migration-integration.spec.ts` | สร้างใหม่ | ~10 | P3 | 228+244+252 |
| `excel-data-review.benchmark.spec.ts` | สร้างใหม่ | ~3 | P4 | 252 |
| `gemini-review.adapter.spec.ts` | สร้างใหม่ | ~3 | P4 | 252 |
| `claude-review.adapter.spec.ts` | สร้างใหม่ | ~3 | P4 | 252 |
| Browser E2E (manual/Playwright) | ไม่ใช่ไฟล์ test | ~30 ขั้นตอน | P1 | 244+252 |

**รวม**: ~72 unit/integration tests ใหม่ + ~30 ขั้นตอน browser verify

---

## 9. ลำดับการทำ (Execution Order)

```
Phase 1 (Browser E2E)          ← P1 ทำก่อน — ยืนยันใช้งานได้จริง
  1A: /admin/migration (Review Queue)
  1B: /admin/migration (Web Upload)
  1C: /admin/import-review (4-Layer)
  1D: RBAC
  1E: Edge Cases
  1F: Console/Network
  ↓
Phase 2 (Backend Unit)         ← P2 ปิด coverage gap
  2A: Migration Controller
  2B: Excel Import Review Controller
  2C: Legacy Ingestion Service
  2D: Migration Review Service
  2E: Review Session Stash
  2F: Workers
  ↓
Phase 3 (Integration)          ← P2 ทดสอบการเชื่อมต่อ
  3A: End-to-End Migration Flow
  3B: CLI Ingestion
  ↓
Phase 4 (Performance)         ← P3 benchmark
  4A: 244 SC criteria
  4B: 252 SC criteria
  4C: 242 SC criteria
  ↓
Phase 5 (Security & RBAC)      ← P2 ความปลอดภัย
  5A: CASL Guard
  5B: UUID Compliance
  5C: AI Boundary
  5D: Idempotency & Audit
```

---

## 10. เกณฑ์ผ่าน (Acceptance Criteria)

| เกณฑ์ | เป้าหมาย | วิธีวัด |
|-------|---------|--------|
| Browser E2E | ทุกขั้นตอน Phase 1 ผ่าน | manual verify หรือ Playwright |
| Migration module coverage | ≥80% | `pnpm test:cov` |
| Controller coverage | ≥80% (จาก 0% ในบางไฟล์) | `pnpm test:cov` |
| 4-Layer Review 200 แถว | < 1.5 วินาที (SC-001) | benchmark test |
| Annotated Excel ≤200 แถว | < 10 วินาที (SC-002) | benchmark test |
| OCR 3 หน้า scanned PDF | < 60 วินาที/ไฟล์ | BullMQ worker timing |
| ExcelJS Streaming 20K rows | < 100MB RAM | `process.memoryUsage()` |
| AI Compare accuracy | ≥ 90% (SC-002 from 242) | ชุดทดสอบ 100 ฉบับ |
| Semantic search | < 2 วินาที (SC-008 from 242) | Qdrant query timing |
| RBAC | 0 unauthorized commits | ทุก 403 ทดสอบผ่าน |
| UUID compliance | 0 INT PK exposure | API response audit |
| AI audit log | 0 missing records | `ai_audit_logs` ครบ |
| ไม่มี `any` / `console.log` | 0 | eslint + tsc ผ่าน |
| ไม่มี `parseInt` บน UUID | 0 | eslint no-restricted-syntax |

---

## 11. ความเสี่ยงและการจัดการ

| ความเสี่ยง | ผลกระทบ | การจัดการ |
|-----------|--------|-----------|
| Browser E2E ติดเพราะไม่มี test data | ไม่สามารถ verify commit ได้จริง | สร้าง test data ก่อน หรือทดสอบเฉพาะ check + download |
| Ollama ไม่ online ตอนทดสอบ | AI layer ไม่ทำงาน | ทดสอบ fail-open scenario แทน (1E.6) |
| Gemini/Claude ไม่มี API key | ไม่สามารถทดสอบจริง | ใช้ mock HTTP ใน unit test (Phase 4) |
| Performance benchmark flaky ใน CI | test ล้มเหลวสุ่ม | ตั้ง threshold กว้างขึ้น 20% ใน CI env |
| ExcelJS ช้ากว่าเป้าในไฟล์ใหญ่จริง | SC-002 ไม่ผ่าน | บันทึกเป็น known limitation + พิจารณา BullMQ batch |
| 20,000 แถว test ต้องการไฟล์ใหญ่จริง | ยากต่อการ repro | ใช้ generated Excel + จำกัดที่ 1,000 แถวใน CI |
| Qdrant ไม่ online | RAG test ล้มเหลว | ใช้ mock QdrantService ใน unit test |
| BullMQ Redis ไม่ online | integration test ล้มเหลว | ใช้ in-memory queue หรือ test container |

---

## 12. งานที่เกี่ยวข้อง (Cross-Reference)

| งาน | ความเกี่ยวข้อง | สถานะ |
|-----|-------------|-------|
| 252 test-plan.md | test plan เฉพาะของ 4-Layer Excel Review | มีแล้ว — แผนนี้อ้างอิงและขยาย |
| 244 validation-report.md | validation PASS 47/47 | มีแล้ว |
| 253 unified-doc-crud | Correspondence creation (commit target) | มี test ของตัวเอง |
| 254 rag-attachment-chunks | RAG chunking (post-migration) | มี test ของตัวเอง |
| 255 rag-admin-console | RAG batch management UI | มี test ของตัวเอง |
| Push `origin/main` | ต้อง push ก่อนจึงจะ deploy และ browser-verify ได้ | pending |
| สร้าง test data (correspondences) | จำเป็นสำหรับ confirm E2E | blocked |
