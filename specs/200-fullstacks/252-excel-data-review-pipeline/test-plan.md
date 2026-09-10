// File: specs/200-fullstacks/252-excel-data-review-pipeline/test-plan.md
// Change Log:
// - 2026-09-10: Initial draft — comprehensive test plan covering all gaps
//   identified in test-report.md + validation-report.md + Next Session Focus

# แผนการทดสอบ Feature 252: 4-Layer Excel Data Review & AI Suggestion Pipeline

**วันที่ร่าง**: 2026-09-10
**ADR**: ADR-052
**สถานะปัจจุบัน**: โค้ดครบทุก Phase (T001-T031), unit/integration test 223 tests ผ่าน
**ช่องว่างที่ต้องทดสอบเพิ่ม**: 4 ด้าน (ดู Section 1)

---

## 1. ช่องว่างที่ต้องทดสอบเพิ่ม (จาก test-report + validation-report + Next Session Focus)

| # | ช่องว่าง | แหล่งอ้างอิง | ระดับความสำคัญ |
|---|---------|-------------|---------------|
| G1 | `download-failed-rows` endpoint test (file found + not found) | validation-report recommendation #4 | P2 |
| G2 | Gemini/Claude adapter implementations (FR-008) | validation-report recommendation #3 | P3 |
| G3 | Performance benchmark tests (SC-001, SC-002) | validation-report recommendation #1 | P3 |
| G4 | Browser-verify จริง (อัปโหลดไฟล์ผ่านหน้าเว็บ) | Next Session Focus A#6 | P1 |
| G5 | Controller unit tests (0% coverage) | test-report coverage gap | P2 |
| G6 | `review-session-stash.service.ts` coverage < 80% | test-report coverage gap | P3 |
| G7 | `local-ollama-review.adapter.ts` unit test (0% → เพิ่มเติม) | test-report coverage gap | P3 |
| G8 | `clean-expired-stashes.worker.ts` unit test (0%) | test-report coverage gap | P3 |

---

## 2. แผนการทดสอบตามลำดับความสำคัญ

### Phase A: Browser E2E Verify (P1 — ทำก่อนเพราะเป็นงานค้างหลัก)

**เป้าหมาย**: ยืนยันว่าผู้ใช้ใช้งานผ่านหน้าเว็บได้จริง ไม่ใช่แค่ build/test ผ่าน

#### A.1 เตรียมการ

- [ ] ตรวจสอบว่า backend + frontend deploy บน production แล้ว (CI run ล่าสุด pass)
- [ ] ตรวจสอบว่ามีโครงการ (project) อย่างน้อย 1 โครงการในระบบ
- [ ] ตรวจสอบว่า user ที่ใช้ทดสอบมี permission `correspondence.import_review`
- [ ] เตรียมไฟล์ Excel ตัวอย่าง (.xlsx) ที่มีข้อมูล 5-10 แถว
  - คอลัมน์: เลขที่เอกสาร, หัวเรื่อง, ประเภท, วันที่ออก, วันที่รับ, จาก, ถึง, ชื่อไฟล์
  - รวมแถวที่ผ่าน (Pass) + แถวที่มีวันที่ พ.ศ. + แถวที่มีประเภทกำกวม

#### A.2 ทดสอบ UI Flow — Document Controller (DIRECT_IMPORT)

| ขั้นตอน | การกระทำ | ผลที่คาดหวาง | FR |
|---------|---------|-------------|-----|
| A.2.1 | ล็อกอินเป็น Document Controller, เข้าหน้า `/admin/import-review` | หน้าจอแสดง "ตรวจสอบข้อมูลนำเข้า Excel" | — |
| A.2.2 | เลือกโครงการจาก dropdown มุมบน | โครงการถูกเลือก, ไม่แสดง error | — |
| A.2.3 | เลือกไฟล์ .xlsx, โหมด DIRECT_IMPORT, AI = Local Ollama, Batch = Full | ฟอร์มพร้อม | FR-001 |
| A.2.4 | กด "อัปโหลดและตรวจสอบ" | แสดง spinner "กำลังตรวจสอบ..." | FR-001 |
| A.2.5 | รอผลกลับมา | แสดงสรุป: ทั้งหมด/ผ่าน/คำเตือน/ติด BLOCK/AI แนะนำ | FR-003, FR-004 |
| A.2.6 | ตรวจสอบ findings table | แสดงรายการ findings ที่ถูกต้อง (row, column, level, message) | FR-003 |
| A.2.7 | กด "ดาวน์โหลดไฟล์ Annotated Excel" | ดาวน์โหลดไฟล์ .xlsx สำเร็จ | FR-010, FR-013 |
| A.2.8 | เปิดไฟล์ใน Excel/LibreOffice | มี Sheet `Review_Summary` + Sheet `Data` พร้อมสีไฮไลต์ + Cell Notes | FR-010 |
| A.2.9 | กด "ยืนยันนำเข้า" (ถ้า canConfirm=true) | แสดงผลยืนยัน: Batch ID, นำเข้าสำเร็จ | FR-014, FR-017 |
| A.2.10 | กด "ยกเลิก" (กรณีมี BLOCK) | แสดงสถานะ CANCELLED, หายจากหน้าจอ | FR-016 |

#### A.3 ทดสอบ UI Flow — Admin (MIGRATION_STAGING)

| ขั้นตอน | การกระทำ | ผลที่คาดหวาย | FR |
|---------|---------|-------------|-----|
| A.3.1 | ล็อกอินเป็น Admin, เข้าหน้า `/admin/import-review` | เห็นตัวเลือก MIGRATION_STAGING + External AI | FR-018 |
| A.3.2 | เลือก MIGRATION_STAGING + อัปโหลดไฟล์ที่มีแถวเสีย 1-2 แถว | ผลตรวจแสดง BLOCK count > 0 | FR-015 |
| A.3.3 | กด "ยืนยันนำเข้า" | แสดงผล: นำเข้าสำเร็จ + กักกัน (Quarantine) > 0 | FR-015 |
| A.3.4 | ตรวจสอบว่ามีปุ่ม "ดาวน์โหลด failed_rows.xlsx" | ปุ่มแสดงเมื่อ quarantinedCount > 0 | FR-015 |
| A.3.5 | กดดาวน์โหลด failed_rows.xlsx | ดาวน์โหลดไฟล์สำเร็จ | FR-015 |
| A.3.6 | กด "เริ่มรายการใหม่" | ฟอร์มรีเซ็ต, ผลยืนยันหายไป | — |

#### A.4 ทดสอบ RBAC / Permission

| ขั้นตอน | การกระทำ | ผลที่คาดหวาย | FR |
|---------|---------|-------------|-----|
| A.4.1 | ล็อกอินเป็น Document Controller, พยายามเลือก MIGRATION_STAGING | ตัวเลือก MIGRATION_STAGING ไม่แสดง (disabled/hidden) | FR-018 |
| A.4.2 | ล็อกอินเป็น Document Controller, พยายามเลือก GEMINI/CLAUDE | ตัวเลือก External AI ไม่แสดง | FR-018 |
| A.4.3 | ล็อกอินเป็น user ที่ไม่มี permission `correspondence.import_review` | แสดง "ไม่มีสิทธิ์เข้าถึงหน้านี้" | FR-018 |

#### A.5 ทดสอบ Edge Cases ผ่าน UI

| ขั้นตอน | การกระทำ | ผลที่คาดหวาย | Edge Case |
|---------|---------|-------------|-----------|
| A.5.1 | อัปโหลดไฟล์ที่มีวันที่ พ.ศ. (เช่น 15/01/2568) | ระบบแปลงเป็น ค.ศ. อัตโนมัติ, ไม่ติด BLOCK | Edge #2 |
| A.5.2 | อัปโหลดไฟล์ที่มี received_date < issued_date | ติด BLOCK "ลำดับวันที่ขัดแย้ง" | US1 AC#3 |
| A.5.3 | อัปโหลดไฟล์ที่มี Project Code ไม่ตรงกับที่เลือก | ติด BLOCK (Project Mismatch) | Edge #1 |
| A.5.4 | อัปโหลดไฟล์ที่ระบุ fileName แต่ไม่ได้แนบไฟล์ | ติด WARN | Edge #4 |
| A.5.5 | อัปโหลดไฟล์ที่มีคอลัมน์ `[AI]` (จากการ re-upload) | ระบบเพิกเฉยคอลัมน์ `[AI]` อัตโนมัติ | FR-011 |
| A.5.6 | อัปโหลดไฟล์ที่ไม่ใช่ .xlsx/.zip | แสดง error ปฏิเสทนามสกุลไฟล์ | — |

#### A.6 ทดสอบ AI Fail-Open

| ขั้นตอน | การกระทำ | ผลที่คาดหวาย | FR |
|---------|---------|-------------|-----|
| A.6.1 | ปิด Ollama (หรือใช้ AI provider ที่ไม่มี), อัปโหลดไฟล์ | แสดง "AI Review unavailable" แต่ยังตรวจ Layer 1/2 ได้ | FR-009, Edge #3 |
| A.6.2 | ตรวจสอบว่า canConfirm ยังเป็น true ถ้าไม่มี BLOCK | ยืนยันได้แม้ AI ไม่พร้อม | FR-009 |

#### A.7 Console / Network Check

- [ ] เปิด DevTools Console — ไม่มี error/warning ที่เกี่ยวข้อง
- [ ] ตรวจ Network tab — request ไป `/api/v1/correspondence/import-review/check` ส่งครบ parameter
- [ ] ตรวจว่าไม่มี double-prefix bug (`/api/api/v1/...`) — ยืนยัน T028 fix ทำงานจริง
- [ ] ตรวจ responsive: 375px mobile + 1280px desktop ไม่มี horizontal overflow

---

### Phase B: Backend Unit Test — ช่องว่างเร่งด่วน (P2)

#### B.1 `download-failed-rows` endpoint test (G1)

**ไฟล์**: `backend/src/modules/migration/excel-import-review.controller.spec.ts` (สร้างใหม่)

| Test | สถานการณ์ | ผลที่คาดหวาย |
|------|-----------|-------------|
| B.1.1 | `getFailedRowsFilePath()` คืน path ที่มีไฟล์จริง | stream ไฟล์สำเร็จ, header `Content-Disposition` ถูกต้อง |
| B.1.2 | `getFailedRowsFilePath()` คืน path ที่ไม่มีไฟล์ | โยน `NotFoundException` |
| B.1.3 | sessionId ไม่ใช่ UUID | โยน 400 (ParseUUIDPipe) |
| B.1.4 | stream error ระหว่าง pipe | ส่ง 500 + log error (ถ้า headers ยังไม่ sent) |

#### B.2 Controller unit tests (G5 — 0% → ≥80%)

**ไฟล์**: `backend/src/modules/migration/excel-import-review.controller.spec.ts`

| Test | Endpoint | สถานการณ์ | ผลที่คาดหวาย |
|------|----------|-----------|-------------|
| B.2.1 | `POST /check` | ไม่แนบไฟล์ | 400 "ต้องแนบไฟล์" |
| B.2.2 | `POST /check` | Document Controller เลือก MIGRATION_STAGING | 403 ForbiddenException |
| B.2.3 | `POST /check` | Document Controller เลือก GEMINI | 403 ForbiddenException |
| B.2.4 | `POST /check` | Admin เลือก MIGRATION_STAGING + LOCAL_OLLAMA | 200 + เรียก service.check() |
| B.2.5 | `GET /:sessionId/download-annotated` | sessionId ไม่ใช่ UUID | 400 (ParseUUIDPipe) |
| B.2.6 | `GET /:sessionId/download-annotated` | ไฟล์มีจริง | stream สำเร็จ + header ถูกต้อง |
| B.2.7 | `GET /:sessionId/download-annotated` | ไฟล์ไม่มี | NotFoundException |
| B.2.8 | `POST /:sessionId/confirm` | sessionId ไม่ใช่ UUID | 400 |
| B.2.9 | `POST /:sessionId/confirm` | session มีจริง | 200 + เรียก service.confirm() |
| B.2.10 | `POST /:sessionId/cancel` | sessionId ไม่ใช่ UUID | 400 |
| B.2.11 | `POST /:sessionId/cancel` | session มีจริง | 200 + เรียก service.cancel() |
| B.2.12 | `GET /:sessionId/download-failed-rows` | ไฟล์มีจริง | stream สำเร็จ |
| B.2.13 | `GET /:sessionId/download-failed-rows` | ไฟล์ไม่มี | NotFoundException |

#### B.3 `review-session-stash.service.ts` coverage bump (G6 — 69.8% → ≥80%)

**ไฟล์**: `backend/src/modules/migration/services/review-session-stash.service.spec.ts` (เติมเข้าไฟล์เดิม)

| Test | สถานการณ์ | ผลที่คาดหวาย |
|------|-----------|-------------|
| B.3.1 | `listExpiredStashDirs()` — มี dir ที่หมดอายุ | คืน array ของ dir names ที่หมดอายุ |
| B.3.2 | `listExpiredStashDirs()` — ไม่มี dir ที่หมดอายุ | คืน `[]` |
| B.3.3 | `listExpiredStashDirs()` — root dir ไม่มี | คืน `[]` (ไม่โยน error) |
| B.3.4 | `deleteSession()` — ลบ dir ที่มีไฟล์ | ลบสำเร็จ, dir หายไป |
| B.3.5 | `deleteSession()` — ลบ dir ที่ไม่มี | ไม่โยน error (idempotent) |

---

### Phase C: Performance Benchmark Tests (P3 — SC-001, SC-002)

#### C.1 SC-001: Layer 1+2 200 แถว < 1.5 วินาที

**ไฟล์**: `backend/src/modules/migration/services/excel-data-review.benchmark.spec.ts` (สร้างใหม่)

| Test | สถานการณ์ | ผลที่คาดหวาย |
|------|-----------|-------------|
| C.1.1 | สร้าง workbook 200 แถว (mock data) → เรียก `check()` | เสร็จภายใน 1500ms |
| C.1.2 | สร้าง workbook 50 แถว → เรียก `check()` | เสร็จภายใน 500ms (sanity check) |

#### C.2 SC-002: Annotated Excel ≤200 แถว < 10 วินาที

| Test | สถานการณ์ | ผลที่คาดหวาย |
|------|-----------|-------------|
| C.2.1 | สร้าง annotated Excel 200 แถว (มี findings) | เสร็จภายใน 10000ms |
| C.2.2 | สร้าง annotated Excel 100 แถว (ไม่มี findings) | เสร็จภายใน 5000ms (sanity) |

> **หมายเหตุ**: benchmark test ควรใช้ `jest.setTimeout(30000)` และทำงานกับ real ExcelJS workbook (ไม่ mock) เพื่อวัดเวลาจริง

---

### Phase D: AI Adapter Tests (P3 — FR-008 completeness)

#### D.1 Gemini/Claude adapter (G2)

> **ขอบเขต**: สร้าง adapter skeleton + unit test (mock HTTP) — ไม่ได้เรียก API จริง

| Test | ไฟล์ | สถานการณ์ | ผลที่คาดหวาย |
|------|------|-----------|-------------|
| D.1.1 | `gemini-review.adapter.spec.ts` | ส่ง review request → Gemini API ตอบ 200 | คืน `ReviewFinding[]` ถูกต้อง |
| D.1.2 | `gemini-review.adapter.spec.ts` | Gemini API ตอบ 500 | fail-open: คืน `{ findings: [], aiAvailable: false }` |
| D.1.3 | `gemini-review.adapter.spec.ts` | ไม่มี API key | fail-open: คืน `{ findings: [], aiAvailable: false }` |
| D.1.4 | `claude-review.adapter.spec.ts` | ส่ง review request → Claude API ตอบ 200 | คืน `ReviewFinding[]` ถูกต้อง |
| D.1.5 | `claude-review.adapter.spec.ts` | Claude API ตอบ 429 (rate limit) | fail-open |
| D.1.6 | `claude-review.adapter.spec.ts` | ไม่มี API key | fail-open |

---

### Phase E: Worker + Remaining Coverage (P3)

#### E.1 `clean-expired-stashes.worker.ts` (G8 — 0% → ≥80%)

**ไฟล์**: `backend/src/modules/migration/workers/clean-expired-stashes.worker.spec.ts` (เติมเข้าไฟล์เดิม)

| Test | สถานการณ์ | ผลที่คาดหวาย |
|------|-----------|-------------|
| E.1.1 | cron trigger → มี expired dirs 2 อัน | ลบ 2 dirs, log "cleaned 2" |
| E.1.2 | cron trigger → ไม่มี expired dirs | log "cleaned 0", ไม่โยน error |
| E.1.3 | cron trigger → stash root ไม่มี | log warning, ไม่โยน error |

#### E.2 `local-ollama-review.adapter.ts` (G7 — เพิ่ม edge case)

| Test | สถานการณ์ | ผลที่คาดหวาย |
|------|-----------|-------------|
| E.2.1 | Ollama ตอบ JSON ที่ไม่ใช่ format ที่คาดหวาย | คืน raw text เป็น AI_SUGGEST |
| E.2.2 | Ollama ตอบ empty response | fail-open |
| E.2.3 | Ollama timeout (>30s) | fail-open + log timeout |

---

## 3. ไฟล์ทดสอบสรุป

| ไฟล์ | สถานะ | Tests เพิ่ม | ระดับ |
|------|-------|-----------|-------|
| `excel-import-review.controller.spec.ts` | **สร้างใหม่** | ~13 | P2 |
| `review-session-stash.service.spec.ts` | เติมเข้าเดิม | ~5 | P3 |
| `excel-data-review.benchmark.spec.ts` | **สร้างใหม่** | ~4 | P3 |
| `gemini-review.adapter.spec.ts` | **สร้างใหม่** | ~3 | P3 |
| `claude-review.adapter.spec.ts` | **สร้างใหม่** | ~3 | P3 |
| `clean-expired-stashes.worker.spec.ts` | เติมเข้าเดิม | ~3 | P3 |
| `local-ollama-review.adapter.spec.ts` | เติมเข้าเดิม | ~3 | P3 |
| Browser E2E (manual/Playwright) | **ไม่ใช่ไฟล์ test** | ~25 ขั้นตอน | P1 |

**รวม**: ~28 unit tests ใหม่ + ~25 ขั้นตอน browser verify

---

## 4. ลำดับการทำ (Execution Order)

```
Phase A (Browser E2E)     ← P1 ทำก่อน เพราะเป็นงานค้างหลัก
  ↓
Phase B (Controller + Stash)  ← P2 ทำตาม เพราะเป็น coverage gap สำคัญ
  ↓
Phase C (Benchmark)       ← P3 ทำได้เลย ไม่ขัดกับอะไร
  ↓
Phase D (AI Adapters)     ← P3 ต้อง implement adapter ก่อน
  ↓
Phase E (Worker + Edge)   ← P3 ปิดท้าย
```

---

## 5. เกณฑ์ผ่าน (Acceptance Criteria)

| เกณฑ์ | เป้าหมาย | วิธีวัด |
|-------|---------|--------|
| Browser E2E | ทุกขั้นตอนใน Phase A ผ่าน | manual verify หรือ Playwright |
| Controller coverage | ≥80% (จาก 0%) | `pnpm test:cov` |
| Stash service coverage | ≥80% (จาก 69.8%) | `pnpm test:cov` |
| SC-001 benchmark | 200 แถว < 1.5s | benchmark test ผ่าน |
| SC-002 benchmark | Annotated ≤200 แถว < 10s | benchmark test ผ่าน |
| Gemini/Claude adapter | fail-open ทุกกรณี | unit test ผ่าน |
| ไม่มี `any` / `console.log` | 0 | eslint + tsc ผ่าน |
| ไม่มี `parseInt` บน UUID | 0 | eslint no-restricted-syntax |

---

## 6. ความเสี่ยงและการจัดการ

| ความเสี่ยง | ผลกระทบ | การจัดการ |
|-----------|--------|-----------|
| Browser E2E ติดเพราะไม่มี test data (correspondences = 0) | ไม่สามารถ verify confirm ได้จริง | สร้าง test data ก่อน หรือทดสอบเฉพาะ check + download |
| Ollama ไม่ online ตอนทดสอบ | AI layer ไม่ทำงาน | ทดสอบ fail-open scenario แทน (A.6) |
| Gemini/Claude ไม่มี API key | ไม่สามารถทดสอบจริง | ใช้ mock HTTP ใน unit test (Phase D) |
| Performance benchmark flaky ใน CI | test ล้มเหลวสุ่ม | ตั้ง threshold กว้างขึ้น 20% (1.8s / 12s) ใน CI env |
| ExcelJS ช้ากว่าเป้าในไฟล์ใหญ่จริง | SC-002 ไม่ผ่าน | บันทึกเป็น known limitation + พิจารณา BullMQ batch mode |

---

## 7. งานที่เกี่ยวข้อง (จาก Next Session Focus)

| งาน | ความเกี่ยวข้อง | สถานะ |
|-----|-------------|-------|
| Push `origin/main` (commit `3190aa41`) | ต้อง push ก่อนจึงจะ deploy และ browser-verify ได้ | pending |
| สร้าง test data (correspondences) | จำเป็นสำหรับ confirm E2E | blocked |
| Coverage global 60%→70% | Phase B ช่วยเพิ่ม coverage | ใน scope |
