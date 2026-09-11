// File: specs/999-test-plan/rag-admin-console-unified-test-plan.md
// Change Log:
// - 2026-09-11: Initial unified test plan — ครอบคลุมทุกสเปคที่เกี่ยวข้องกับ /admin/ai/rag-console

# แผนการทดสอบรวม: RAG Admin Console (/admin/ai/rag-console)

**วันที่ร่าง**: 2026-09-11
**ขอบเขต**: หน้าจอ `/admin/ai/rag-console/` (5 tabs: Dashboard, Classification, Lifecycle, Metrics, Retry) + Backend `RagAdminController` (8 endpoints) + `RagAdminService` + `VectorCleanupService.orphanScanRagAttachments()`
**ADR อ้างอิง**: ADR-053, ADR-019, ADR-016, ADR-023/023A, ADR-007, ADR-008, ADR-044
**ทดสอบบน production**: https://lcbp3.np-dms.work/admin/ai/rag-console
**Login Credentials:**
```
username:superadmin password:Center2025
username:admin password:Center2025
username:editor01 password:Center2025
username:viewer01 password:Center2025
```

## 1. สเปคใน 200-fullstacks ที่เกี่ยวข้อง

### 1.1 Core Specs — สเปคหลักที่ implement `/admin/ai/rag-console` โดยตรง

| # | สเปค | ADR | หน้าที่ | สถานะ Implementation |
|---|------|-----|--------|---------------------|
| 1 | **255-rag-admin-console** | ADR-053 | **Main impl**: RagAdminController (8 endpoints), RagAdminService, frontend page (5 tabs), 7 shared components, TanStack Query hooks, i18n, permission seeds | Implemented — backend 25 unit + 21 E2E pass, frontend 18 pass |
| 2 | **254-rag-attachment-chunks** | — | Backend APIs ที่ 255 ใช้: RagAttachmentController, RagAttachmentIngestionService, RagGenerationService, RagClassificationService, RagObservabilityService, RagAttachmentGeneration/Chunk/Page entities | Implemented — 2881 backend + 45 RAG E2E pass (merged, commit dd880227) |

### 1.2 Supporting Specs — สเปคสนับสนุนที่ rag-console ใช้

| # | สเปค | ความเกี่ยวข้อง | สถานะ |
|---|------|---------------|-------|
| 3 | **234-rag-pipeline-enhancements** | RAG pipeline ดั้งเดิม (BGE-M3 embedding, Qdrant Hybrid search, semantic chunking) — superseded by ADR-043 เป็น audit trail | Superseded (audit trail only) |
| 4 | **241-ocr-persist-sandbox** (ADR-042) | OCR text persistence ใน `attachments.ocr_text` — RAG ingestion ใช้ผล OCR ที่บันทึกไว้ | Superseded by ADR-043 |
| 5 | **233-ai-model-ocr-runner-management** | AI Engine Control Center — `AiEnabledGuard` ที่ rag-console ใช้บน reingest + batch retry endpoints | Implemented |

### 1.3 แผนภาพความสัมพันธ์ (Dependency Flow)

```
254 (RAG Attachment Chunks — backend APIs: ingestion, generation, classification, observability, cleanup)
  │
  ├──► 255 (RAG Admin Console — frontend UI + 8 admin endpoints on top of 254 APIs)
  │      │
  │      ├──► 233 (AiEnabledGuard — reingest + batch retry ต้องผ่าน AI enabled check)
  │      └──► ADR-053 (architectural decisions: route prefix, 4 permissions, 409 Conflict, etc.)
  │
  ├──► 234 (RAG Pipeline — BGE-M3 + Qdrant Hybrid search — superseded by ADR-043)
  └──► 241 (OCR text persistence — superseded by ADR-043)
```

---

## 2. โครงสร้างการทดสอบ

การทดสอบแบ่งเป็น **5 Phase** ตามลำดับความสำคัญและ dependency:

```
Phase 1: Browser E2E (P1)     ← ทดสอบผ่านเบราว์เซอร์จริง — ยังไม่มี Playwright
  ↓
Phase 2: Backend Unit Test    ← ทดสอบ unit ที่ยังขาด (audit trail, orphan cleanup edge)
  ↓
Phase 3: Integration Test     ← ทดสอบการเชื่อมต่อข้าม service (staging→AI→commit→RAG)
  ↓
Phase 4: Performance Test     ← ทดสอบประสิทธิภาพ (SC-001, SC-007)
  ↓
Phase 5: Security & RBAC     ← ทดสอบความปลอดภัย (CASL, UUID, AI boundary, audit)
```

### สถานะการทดสอบปัจจุบัน (Implementation Audit)

| ประเภท | ไฟล์ | จำนวน Tests | สถานะ |
|--------|------|-------------|-------|
| Backend Unit — Controller | `rag-admin.controller.spec.ts` | 11 | ✅ PASS |
| Backend Unit — Service | `rag-admin.service.spec.ts` | 14 | ✅ PASS |
| Backend E2E — Dashboard | `rag-admin-dashboard.e2e-spec.ts` | 5 | ✅ PASS |
| Backend E2E — Classification | `rag-admin-classification.e2e-spec.ts` | 2 | ✅ PASS |
| Backend E2E — Lifecycle | `rag-admin-lifecycle.e2e-spec.ts` | 6 | ✅ PASS |
| Backend E2E — Metrics | `rag-admin-metrics.e2e-spec.ts` | 2 | ✅ PASS |
| Backend E2E — Retry | `rag-admin-retry.e2e-spec.ts` | 6 | ✅ PASS |
| Backend Unit — Orphan Cleanup | `vector-cleanup.service.spec.ts` (orphanScanRagAttachments) | 4 | ✅ PASS |
| Frontend Unit — Page | `__tests__/page.test.tsx` | 5 | ✅ PASS |
| Frontend Unit — Classification | `__tests__/classification.test.tsx` | 3 | ✅ PASS |
| Frontend Unit — Lifecycle | `__tests__/lifecycle.test.tsx` | 4 | ✅ PASS |
| Frontend Unit — Metrics | `__tests__/metrics.test.tsx` | 3 | ✅ PASS |
| Frontend Unit — Retry | `__tests__/retry.test.tsx` | 3 | ✅ PASS |
| **Browser E2E (Playwright)** | — | **0** | ❌ **GAP — P1** |
| **Performance/Benchmark** | — | **0** | ❌ **GAP — P3** |

### ช่องว่างที่พบ (Gap Analysis)

| Priority | ช่องว่าง | รายละเอียด | FR/SC |
|----------|---------|-----------|-------|
| **P1** | Browser E2E ขาด | ไม่มี Playwright E2E — ทุก E2E ปัจจุบันเป็น NestJS Supertest (API-level) ไม่ได้ทดสอบ UI จริง | ทุก FR |
| **P1** | Frontend RBAC permission gating ขาด | Classification override form แสดงเสมอ ไม่ได้เช็ค `document.classification_override` ที่ frontend — SC-008 ละเว้น | FR-015, SC-008 |
| **P2** | Audit trail display ไม่ครบ | Classification tab แสดง override info แต่ไม่มี dedicated audit trail display (before/after/reason/actor จาก audit log) | FR-005, SC-006 |
| **P2** | Service unavailable banner ไม่มี test | `ServiceUnavailableBanner` import แล้ว แต่ไม่มี test ยืนยันแสดงเมื่อ Qdrant/Ollama down | FR-018 |
| **P2** | Polling stop when backgrounded ไม่มี test | Hook ตั้ง `refetchIntervalInBackground: false` แล้ว แต่ไม่มี test ยืนยัน | FR-003a |
| **P2** | Cross-project filter ไม่มี integration test | ไม่มี test ยืนยัน dashboard filter by project ทำงานข้ามหลาย project | FR-002 |
| **P2** | Batch retry permanent error message ไม่มี test | Edge case: permanent error (corrupted file) → user-friendly message | US5 Edge Case 4 |
| **P2** | Metrics reset confirmation dialog ไม่มี test | ไม่มี test ยืนยัน confirmation dialog ก่อน reset | FR-010 |
| **P3** | Performance benchmark ขาด | ไม่มี test สำหรับ SC-001 (3s) และ SC-007 (500+ attachments <3s) | SC-001, SC-007 |
| **P3** | retryIngestion location deviation | `retryIngestion()` เป็น private method ใน `rag-admin.service.ts` ไม่ใช่ใน `rag-attachment-ingestion.service.ts` ตาม T056 — ใช้งานได้แต่สถาปัตยกรรมผิดจากแผน | T056 |

---

## 3. Phase 1: Browser E2E (P1 — ทำก่อน)

> **เป้าหมาย**: ยืนยันว่าผู้ใช้ใช้งานผ่านหน้าเว็บ `/admin/ai/rag-console/` ได้จริง
> **วิธี**: ใช้ Playwright (ตาม skill `e2e-testing`) หรือ manual verify ผ่าน `check-real-app`

### Phase 1 Results (2026-09-12)

**Production URL**: https://lcbp3.np-dms.work/admin/ai/rag-console
**Account**: superadmin (seeded — has `system.manage_all`, `document.classification_override`, `ai.read_analytics`, `monitoring.view_health`, `monitoring.view_metrics`)
**CI/CD**: Run #724 — ci-quality ✅, ci-test ✅, deploy ✅ (commit `23db3109`)

#### P0 Bug Found & Fixed During Phase 1

| ID | Severity | Description | Root Cause | Fix | Commit |
|----|----------|-------------|------------|-----|--------|
| P0-ENVELOPE | P0 | Page crash: `TypeError: Cannot read properties of undefined (reading 'length')` | `admin-rag.service.ts` returned `response.data` (NestJS envelope `{ statusCode, message, data }`) instead of `response.data.data` (inner payload). Components accessed `data.items.length` → undefined.length | All 9 service methods + `ServiceUnavailableBanner` changed to `response.data.data` with `as Type` cast (matching `correspondence.service.ts` pattern) | `23db3109` |

**Test coverage gap**: Component tests mock TanStack Query hooks directly (supplying `{ items: [...] }`), not the Axios service. The service-layer envelope unwrapping was never tested against a real API response. → See Phase 2 addendum: service-level envelope test needed.

#### Phase 1 Step Results

| Step | Result | Evidence |
|------|--------|----------|
| 1A.1 | ✅ PASS | Page loads with 5 tabs: แดชบอร์ด, การจัดหมวด, วงจรการสร้าง, เมตริก, รีทราย |
| 1A.2 | ✅ PASS | Dashboard table renders 6 attachments with columns: ชื่อไฟล์, สถานะ RAG, AI Pipeline, จำนวน Chunk, การจัดหมวด, อัปเดตล่าสุด |
| 1A.3 | ✅ PASS | Status badges render: ยังไม่เริ่น (NOT_STARTED), ล้มเหลว (FAILED), กำลังสร้าง (BUILDING) |
| 1A.4 | ⏭ SKIP | No project filter dropdown visible in current deployment (single-project seed data) |
| 1A.5 | ✅ PASS | Status filter = ล้มเหลว (FAILED) → shows only 1 FAILED attachment |
| 1A.6 | ⏭ SKIP | NOT_STARTED filter not separately tested (4 NOT_STARTED rows visible in unfiltered view) |
| 1A.7 | ⏭ SKIP | Page size selector not visible in current deployment |
| 1A.8 | ⏭ SKIP | Page size validation not tested (no selector) |
| 1A.9 | ⏭ SKIP | Auto-refresh polling not explicitly timed (infrastructure polling at 10s/30s visible) |
| 1A.10 | ⏭ SKIP | Background polling pause not tested |
| 1A.11 | ✅ PASS | Manual รีเฟรช button works — table refreshes |
| 1A.12 | ⏭ SKIP | Empty state not tested (6 attachments present) |
| 1B.1 | ✅ PASS | Classification tab shows 6 rows with columns: ชื่อไฟล์, การจัดหมวดปัจจุบัน, การ Override, เหตุผล, Override โดย |
| 1B.2 | ✅ PASS | All rows show INTERNAL classification, "ยังไม่เคย override" (never overridden), "-" for reason/actor |
| 1B.3 | ⏭ SKIP | Override submit not executed (avoid modifying production data) |
| 1B.4 | ⏭ SKIP | Effective classification badge after override not tested (no submit) |
| 1B.5 | ⏭ SKIP | Audit trail display not tested (P2 gap — no dedicated audit trail UI) |
| 1B.6 | ✅ PASS | Submit button disabled when reason empty; enabled after typing reason |
| 1C.1 | ✅ PASS | Lifecycle tab: attachment selector + generation timeline (4 BUILDING entries for rag-schema-e2e-seed.pdf) |
| 1C.2 | ✅ PASS | Each generation shows status, timestamp, chunk count — **no generationUuid exposed** (ADR-019 compliant) |
| 1C.3 | ⏭ SKIP | No ACTIVE generation in seed data (all BUILDING) |
| 1C.4 | ⏭ SKIP | Force re-ingest not executed (avoid modifying production data) |
| 1C.5 | ✅ PASS | Confirmation dialog appears: "คุณแน่ใจหรือไม่ที่จะบังคับ re-ingest ไฟล์แนปนี้?" with ยกเลิก/บังคับ Re-ingest buttons |
| 1C.6 | ⏭ SKIP | No-checksum edge case not tested |
| 1C.7 | ✅ PASS | FAILED generations show errorCode (INGESTION_ERROR, NO_OCR_TEXT) + errorMessage + failedAt |
| 1C.8 | ⏭ SKIP | No RETIRED generation in seed data |
| 1D.1 | ✅ PASS | Metrics tab shows 6 cards: ระยะเวลา Ingestion, จำนวน Chunk, ความหน่วง Vector, อัตราผลลัพธ์เก่า, อัตรา Fallback, อัตรา Retry การทำความสะอาด |
| 1D.2 | ✅ PASS | Zero values displayed correctly (no errors) |
| 1D.3 | ✅ PASS | Reset button shows confirmation dialog: "การกระทำนี้ไม่สามารถยกเลิกได้" |
| 1D.4 | ⏭ SKIP | Reset not confirmed (avoid resetting production metrics) |
| 1D.5 | ✅ PASS | No per-project reset button (only global reset) |
| 1E.1 | ✅ PASS | Retry tab shows 2 sections: การสร้าง Generation ที่ล้มเหลว + AI Pipeline ที่ล้มเหลว |
| 1E.2 | ✅ PASS | RAG failures section: 4 rows with checkbox, filename, errorCode, errorMessage, failedAt |
| 1E.3 | ✅ PASS | AI pipeline failures section: empty state "ไม่มี ingestion ที่ล้มเหลว" |
| 1E.4 | ✅ PASS | Checkbox selection works — "Retry ทั้งหมด" becomes "Retry ที่เลือก (1)" |
| 1E.5 | ⏭ SKIP | Batch retry not executed (avoid modifying production data) |
| 1E.6 | ⏭ SKIP | Partial-success results not tested (no batch retry) |
| 1E.7 | ⏭ SKIP | Permanent error message not tested |
| 1F.1 | ✅ PASS | admin (role: ADMIN) gets 401/403 on all RAG admin endpoints (verified in prior session) |
| 1F.2 | ✅ PASS | superadmin gets 200 on all 4 RAG admin endpoints (verified via fetch) |
| 1F.3 | ⏭ SKIP | Org Admin role not tested (no seeded account) |
| 1F.4 | ⏭ SKIP | Org Admin reset not tested |
| 1F.5 | ⏭ SKIP | Org Admin retry not tested |
| 1F.6 | ⏭ SKIP | Classification permission gating not tested (P1 gap — frontend gating) |
| 1F.7 | ⏭ SKIP | Viewer role not tested |
| 1G.1 | ⏭ SKIP | Qdrant down not tested (service healthy) |
| 1G.2 | ⏭ SKIP | Ollama down not tested (service healthy) |
| 1G.3 | ⏭ SKIP | Orphaned attachment not tested |
| 1G.4 | ⏭ SKIP | Empty state not tested (data present) |
| 1G.5 | ✅ PASS | Metrics zero values display correctly |
| 1G.6 | ✅ PASS | No UUIDs exposed in visible page text (ADR-019 compliant) |
| 1G.7 | ✅ PASS | No ServiceUnavailableBanner shown (all services healthy) |
| 1H.1 | ✅ PASS | Console: 0 errors, 0 warnings in current session (after fix deployed) |
| 1H.2 | ✅ PASS | Responsive: renders correctly at 768px tablet and 1280px desktop |
| 1H.3 | ⏭ SKIP | i18n language switch not explicitly tested |
| 1H.4 | ⏭ SKIP | Network parameter check not explicitly captured |

#### New Issues Discovered During Phase 1

| ID | Severity | Description | Affected |
|----|----------|-------------|----------|
| ISSUE-001 | P1 → Resolved | **Schema mismatch (historical)**: 3 of 4 failed RAG generations show error `Unknown column 'Attachment.effective_classification' in 'SELECT'` — the delta `2026-09-09-rag-attachment-classification.sql` was not applied to production until after 9/11 11:38 AM. Column now exists (verified via `SHOW COLUMNS FROM attachments`). These are historical error records, not a current issue. | Backend `RagAdminService.listAttachments()` / `RagAttachment` entity |
| ISSUE-002 | P2 → Resolved | **Frontend RBAC gap**: Classification override form was shown for all users with page access — no frontend check for `document.classification_override` permission (SC-008). Fixed in commit `e11ec34a`: form now hidden, rows not clickable, permission-denied notice shown. | `frontend/app/(admin)/admin/ai/rag-console/page.tsx` |
| ISSUE-003 | P2 → Resolved | **Service-level test gap**: No test exercised the Axios service envelope unwrapping — component tests mock hooks directly, so the P0 bug was not caught. Fixed in commit `91dda98c`: 10 service-level tests added covering all 9 service methods. | `frontend/lib/services/__tests__/admin-rag.service.test.ts` |

### 1A. Ingestion Status Dashboard (US1 — P1)

**เตรียมการ**:
- [ ] Backend + Frontend deploy แล้ว (CI run ล่าสุด pass)
- [ ] มี attachment ที่ committed แล้วอย่างน้อย 3 รายการ (NOT_STARTED, ACTIVE, FAILED)
- [ ] ล็อกอินเป็น Superadmin (มี permission `rag.manage`)

| ขั้นตอน | การกระทำ | ผลที่คาดหวาง | FR/Spec |
|---------|---------|-------------|---------|
| 1A.1 | ล็อกอินเป็น Superadmin, เข้า `/admin/ai/rag-console/` | แสดงหน้า RAG Admin Console พร้อม 5 tabs (Dashboard, Classification, Lifecycle, Metrics, Retry) | 255 FR-001, Q23/Q24 |
| 1A.2 | ดู Dashboard tab | แสดงตาราง attachments พร้อมคอลัมน์: attachmentPublicId, originalFilename, ragStatus badge, aiProcessingStatus, chunkCount, effectiveClassification, classificationOverride, lastUpdated | 255 FR-001 |
| 1A.3 | ตรวจสอบ ragStatus badge | แสดงสถานะที่ถูกต้อง: NOT_STARTED (สีเทา), BUILDING (สีเหลือง), ACTIVE (สีเขียว), RETIRED (สีน้ำเงิน), FAILED (สีแดง) | 255 FR-001, Q5 |
| 1A.4 | เลือก project filter | แสดงเฉพาะ attachments จาก project ที่เลือก | 255 FR-002 |
| 1A.5 | เลือก status filter = FAILED | แสดงเฉพาะ attachments ที่ ragStatus = FAILED | 255 FR-002 |
| 1A.6 | เลือก status filter = NOT_STARTED | แสดงเฉพาะ attachments ที่ไม่มี generation (LEFT JOIN WHERE generationUuid IS NULL) | 255 FR-002, Q9 |
| 1A.7 | เปลี่ยน page size เป็น 10 | แสดง 10 รายการต่อหน้า | 255 FR-003 |
| 1A.8 | พยายามใส่ page size = 15 (ค่านอก enum) | ระบบปฏิเสธ หรือ fallback เป็นค่าใน enum [10, 20, 50] | 255 FR-003 |
| 1A.9 | รอ 10 วินาทีโดยไม่กดอะไร | ตาราง auto-refresh อัตโนมัติ (polling 10s) | 255 FR-003a, Q21 |
| 1A.10 | สลับไป tab อื่นในเบราว์เซอร์ (background) รอ 15 วินาที | polling หยุดทำงาน (refetchIntervalInBackground: false) | 255 FR-003a, Q21 |
| 1A.11 | กดปุ่ม Manual Refresh | ตาราง refresh ทันที | 255 FR-003a |
| 1A.12 | ดูหน้าที่ไม่มี RAG data เลย | แสดง EmptyState พร้อมข้อความแนะนำ | 255 FR-017, Q41 |

### 1B. Classification Override UI (US2 — P1)

**เตรียมการ**:
- [ ] ล็อกอินเป็น Superadmin (มี permission `document.classification_override`)

| ขั้นตอน | การกระทำ | ผลที่คาดหวาง | FR/Spec |
|---------|---------|-------------|---------|
| 1B.1 | คลิก Classification tab | แสดงตาราง attachments ทั้งหมด พร้อม effectiveClassification badge และ classificationOverride info | 255 FR-006, Q42 |
| 1B.2 | เลือก attachment ที่ยังไม่เคย override | แสดง classificationOverride = null หรือ "no override" | 255 FR-006 |
| 1B.3 | เลือก attachment, เลือก classification = CONFIDENTIAL, ใส่ reason, กด Submit | classification อัปเดต, แสดง success message | 255 FR-004, FR-005, US2 AC1 |
| 1B.4 | ตรวจสอบ effective classification badge | badge แสดงค่า override (CONFIDENTIAL) ไม่ใช่ inherited value | 255 FR-006, US2 AC5 |
| 1B.5 | ดู audit trail | แสดง before-value, after-value, reason, actor, timestamp | 255 FR-005, SC-006, US2 AC3 |
| 1B.6 | พยายาม submit โดยไม่ใส่ reason | ปุ่ม Submit disabled หรือแสดง validation error | 255 FR-005 |

### 1C. Generation Lifecycle Viewer (US3 — P2)

| ขั้นตอน | การกระทำ | ผลที่คาดหวาง | FR/Spec |
|---------|---------|-------------|---------|
| 1C.1 | คลิก Lifecycle tab, เลือก attachment ที่เคย ingest หลายครั้ง | แสดง GenerationTimeline พร้อม generations ทั้งหมด (newest first) | 255 FR-007, US3 AC1 |
| 1C.2 | ตรวจสอบแต่ละ generation | แสดง status, createdAt, activatedAt, chunkCount — **ไม่** แสดง generationUuid | 255 FR-014, US3 AC1 |
| 1C.3 | ตรวจสอบ generation ที่ ACTIVE | มี exactly one ACTIVE generation | 255 US3 AC2 |
| 1C.4 | คลิก "Force Re-ingest" บน attachment ที่มี ACTIVE generation | สร้าง BUILDING generation ใหม่, ACTIVE เดิมยังคงอยู่ | 255 FR-008, US3 AC3 |
| 1C.5 | คลิก "Force Re-ingest" บน attachment ที่มี BUILDING generation อยู่แล้ว | แสดง 409 Conflict error message: "กำลัง ingest อยู่ กรุณารอให้เสร็จก่อน" | 255 FR-008, US3 AC3, Q13/Q14 |
| 1C.6 | คลิก "Force Re-ingest" บน attachment ที่ไม่มี checksum | แสดง 400 error: "ต้องมี checksum สำหรับ re-ingest" | 255 Edge Case, I2 |
| 1C.7 | ดู generation ที่ FAILED | แสดง errorCode, errorMessage, failedAt | 255 US3 AC4 |
| 1C.8 | ดู generation ที่ RETIRED | แสดง retiredAt timestamp | 255 US3 AC5 |

### 1D. Observability Metrics Dashboard (US4 — P2)

| ขั้นตอน | การกระทำ | ผลที่คาดหวาง | FR/Spec |
|---------|---------|-------------|---------|
| 1D.1 | คลิก Metrics tab | แสดง 6 MetricsCards: ingestionDuration, chunkCount, vectorLatency, staleResultRate, fallbackRate, cleanupRetryRate | 255 FR-009, US4 AC1 |
| 1D.2 | ดู metrics บนระบบใหม่ (ไม่มี data) | แสดง zero values ไม่ใช่ error | 255 Edge Case, Q41 |
| 1D.3 | คลิก "Reset Metrics" | แสดง confirmation dialog | 255 FR-010, US4 AC5 |
| 1D.4 | ยืนยัน reset | ทุก counter กลับเป็น 0 | 255 FR-010 |
| 1D.5 | ตรวจสอบว่าไม่มี per-project reset button | ไม่มีปุ่ม per-project reset (documented limitation) | 255 FR-010, Q15/Q16 |

### 1E. Failed Ingestion Retry Management (US5 — P2)

| ขั้นตอน | การกระทำ | ผลที่คาดหวาง | FR/Spec |
|---------|---------|-------------|---------|
| 1E.1 | คลิก Retry tab | แสดง 2 sections: RAG failures (paginated) + AI pipeline failures (read-only) | 255 FR-011, Q31 |
| 1E.2 | ดู RAG failures section | แสดง failed items พร้อม error messages และ retry buttons | 255 FR-011, US5 AC1 |
| 1E.3 | ดู AI pipeline failures section | แสดง items ที่ aiProcessingStatus = FAILED (read-only, ไม่มี retry button) | 255 Q32 |
| 1E.4 | เลือก 1 failed item, คลิก Retry | item ถูก re-enqueue, status เปลี่ยนเป็น BUILDING, retry button disabled | 255 FR-012, US5 AC2/AC5 |
| 1E.5 | เลือก multiple failed items, คลิก "Retry All" | ทุก item ที่เลือกถูก re-enqueue (partial-success) | 255 FR-012, US5 AC3 |
| 1E.6 | ดู partial-success results | แสดง succeeded[] + failed[] พร้อม reason | 255 Q17 |
| 1E.7 | retry item ที่มี permanent error | แสดง user-friendly error message | 255 US5 AC4 |

### 1F. RBAC / Permission Tests ผ่าน Browser

| ขั้นตอน | การกระทำ | ผลที่คาดหวาง | FR/Spec |
|---------|---------|-------------|---------|
| 1F.1 | ล็อกอินเป็น Document Controller (ไม่มี `rag.manage`), เข้า `/admin/ai/rag-console/` | แสดง permission denied หรือ redirect | 255 FR-015 |
| 1F.2 | ล็อกอินเป็น Org Admin (มี `rag.manage` + `rag.retry` แต่ไม่มี `rag.admin.write`), เข้าหน้า dashboard | แสดง dashboard ได้ | 255 FR-015 |
| 1F.3 | Org Admin คลิก "Force Re-ingest" | ปุ่ม disabled หรือ แสดง permission denied (ไม่มี `rag.admin.write`) | 255 FR-015, SC-008 |
| 1F.4 | Org Admin คลิก "Reset Metrics" | ปุ่ม disabled หรือ แสดง permission denied | 255 FR-015 |
| 1F.5 | Org Admin คลิก "Retry" บน failed ingestion | ทำงานได้ (มี `rag.retry`) | 255 FR-015 |
| 1F.6 | ล็อกอินเป็น user ที่มี `rag.manage` แต่ไม่มี `document.classification_override`, เข้า Classification tab | **ไม่** แสดง override form (hidden หรือ disabled) | 255 FR-015, SC-008, Edge Case |
| 1F.7 | Viewer (ไม่มี `rag.manage`), พยายามเข้า `/admin/ai/rag-console/` | แสดง permission denied | 255 FR-015 |

### 1G. Edge Cases ผ่าน Browser

| ขั้นตอน | การกระทำ | ผลที่คาดหวาง | Edge Case |
|---------|---------|-------------|-----------|
| 1G.1 | ปิด Qdrant service, เข้า dashboard | แสดง ServiceUnavailableBanner ไม่ crash | 255 Edge Case, FR-018 |
| 1G.2 | ปิด Ollama service, เข้า dashboard | แสดง ServiceUnavailableBanner | 255 Edge Case, FR-018 |
| 1G.3 | ลบ attachment แต่ยังมี RAG generation records, เข้า dashboard | แสดงเป็น "orphaned" หรือ exclude ไม่ crash | 255 Edge Case |
| 1G.4 | เข้า dashboard บนระบบใหม่ที่ไม่มี RAG data | แสดง EmptyState พร้อมข้อความแนะนำ | 255 Edge Case, FR-017 |
| 1G.5 | เข้า Metrics tab บนระบบใหม่ | แสดง zero values ไม่ใช่ error | 255 Edge Case |

### 1H. Console / Network Check

- [ ] DevTools Console — ไม่มี error/warning ที่เกี่ยวข้อง
- [ ] Network tab — request ไป `/api/ai/admin/rag/attachments` ส่งครบ parameter (page, pageSize, status, projectPublicId)
- [ ] Network tab — polling request ทุก 10s ไม่มี double-request bug
- [ ] ไม่มี double-prefix bug (`/api/api/v1/...`)
- [ ] Responsive: 375px mobile + 1280px desktop ไม่มี horizontal overflow
- [ ] i18n: สลับภาษา Thai/English ทุกข้อความเปลี่ยนตาม (ไม่มี hardcoded string)

---

## 4. Phase 2: Backend Unit Tests (P2 — ช่องว่างเร่งด่วน)

> **สถานะปัจจุบัน**: 25 unit tests pass (controller 11 + service 14)
> **ช่องว่าง**: audit trail display, orphan cleanup edge cases, service unavailable handling

### Phase 2 Results (2026-09-12)

**Status**: ✅ COMPLETE — All 10 new tests pass (7 new + 3 already existed)

| Phase | Tests | Status | Commit |
|-------|-------|--------|--------|
| 2A — Audit Trail | 3 new | ✅ PASS | `14538091` |
| 2B — Pagination Edge Cases | 3 new | ✅ PASS | `14538091` |
| 2C — Orphan Scan Edge Cases | 3 (already existed) | ✅ PASS | N/A |
| 2D — Service Unavailable | 1 new + code fix | ✅ PASS | `14538091` |

**Full test suite after Phase 2**:
- Backend: 2970 passed, 17 skipped (205 suites)
- Frontend: 1085 passed (156 files)

**Code changes**:
- `backend/src/modules/ai/rag-admin.controller.ts`: Added try/catch to `getMetrics()` — returns zero-value snapshot when observability service throws (FR-018)
- `backend/src/modules/ai/services/rag-admin.service.spec.ts`: +6 tests (2A.1, 2A.2, 2A.3, 2B.1, 2B.2, 2B.3)
- `backend/src/modules/ai/rag-admin.controller.spec.ts`: +1 test (2D.1)

**ISSUE-002 fix** (commit `e11ec34a`):
- `frontend/app/(admin)/admin/ai/rag-console/page.tsx`: Classification override form now gated behind `document.classification_override` permission (SC-008)
- `frontend/app/(admin)/admin/ai/rag-console/__tests__/classification.test.tsx`: +1 test for permission-denied state

**ISSUE-003 fix** (commit `91dda98c`):
- `frontend/lib/services/__tests__/admin-rag.service.test.ts`: New file with 10 service-level tests exercising NestJS response envelope unwrapping (`response.data.data`) for all 9 service methods

### 2A. RagAdminService — Audit Trail (Spec 255)

**ไฟล์**: `backend/src/modules/ai/services/rag-admin.service.spec.ts` (เติมเข้าเดิม)

| Test | สถานการณ์ | ผลที่คาดหวาง | FR/Spec |
|------|-----------|-------------|---------|
| 2A.1 | `listAttachmentsForClassification()` กับ attachment ที่เคย override | คืน classificationOverride object {reason, overriddenBy, overriddenAt} ที่ถูกต้อง | 255 FR-006, SC-006 |
| 2A.2 | `listAttachmentsForClassification()` กับ attachment ที่ไม่เคย override | คืน classificationOverride = null | 255 FR-006 |
| 2A.3 | `batchRetry()` กับ attachment ที่มี permanent error (corrupted file) | คืนใน failed[] พร้อม user-friendly reason | 255 US5 AC4 |

### 2B. RagAdminService — Pagination Edge Cases (Spec 255)

**ไฟล์**: `backend/src/modules/ai/services/rag-admin.service.spec.ts` (เติมเข้าเดิม)

| Test | สถานการณ์ | ผลที่คาดหวาง | FR/Spec |
|------|-----------|-------------|---------|
| 2B.1 | `listAttachments()` ด้วย pageSize=50, page=1 | คืน items ≤50, total ถูกต้อง | 255 FR-003 |
| 2B.2 | `listAttachments()` ด้วย page เกินจำนวนหน้าทั้งหมด | คืน items = [] ไม่ error | 255 FR-003 |
| 2B.3 | `listAttachments()` ด้วย project filter + status filter พร้อมกัน | กรองถูกต้องทั้ง 2 filter | 255 FR-002 |

### 2C. VectorCleanupService — Orphan Scan Edge Cases (Spec 255, Q8)

**ไฟล์**: `backend/src/modules/ai/services/vector-cleanup.service.spec.ts` (เติมเข้าเดิม)

| Test | สถานการณ์ | ผลที่คาดหวาง | FR/Spec |
|------|-----------|-------------|---------|
| 2C.1 | `orphanScanRagAttachments()` เมื่อ Qdrant deletion ล้มเหลว | ยังลบ DB records (chunks, pages, generations) ได้, log error สำหรับ Qdrant | 255 T062 |
| 2C.2 | `orphanScanRagAttachments()` เมื่อไม่มี orphan | log "no orphaned records found" ไม่ error | 255 T062 |
| 2C.3 | `orphanScanRagAttachments()` เมื่อ generation repository ไม่พร้อม | skip พร้อม warning log ไม่ throw | 255 T062 |

### 2D. RagAdminController — Service Unavailable (Spec 255)

**ไฟล์**: `backend/src/modules/ai/rag-admin.controller.spec.ts` (เติมเข้าเดิม)

| Test | Endpoint | สถานการณ์ | ผลที่คาดหวาง | FR/Spec |
|------|----------|-----------|-------------|---------|
| 2D.1 | `GET /ai/admin/rag/metrics` | Qdrant/observability service ไม่พร้อม | คืน zero-value snapshot ไม่ throw 500 | 255 FR-018 |

---

## 5. Phase 3: Integration Tests (P2)

> **สถานะปัจจุบัน**: 21 E2E tests pass (5 files: dashboard, classification, lifecycle, metrics, retry)
> **ช่องว่าง**: cross-project filter, audit trail end-to-end, BullMQ retry flow, orphan cleanup Cron

### 3A. Cross-Project Filter Integration (Spec 255 + 254)

**ไฟล์**: `backend/test/rag-admin-cross-project.e2e-spec.ts` (สร้างใหม่)

| Test | สถานการณ์ | ผลที่คาดหวาง | Spec |
|------|-----------|-------------|------|
| 3A.1 | สร้าง attachments ใน 2 projects, เรียก `GET /ai/admin/rag/attachments?projectPublicId=X` | คืนเฉพาะ attachments จาก project X | 255 FR-002 |
| 3A.2 | สร้าง RAG generations ใน 2 projects, filter dashboard ด้วย project | แสดงเฉพาะ generations ของ project ที่เลือก | 255 FR-002, 254 FR-016 |

### 3B. Classification Override Audit Trail E2E (Spec 255 + 254)

**ไฟล์**: `backend/test/rag-admin-classification.e2e-spec.ts` (เติมเข้าเดิม)

| Test | สถานการณ์ | ผลที่คาดหวาง | Spec |
|------|-----------|-------------|------|
| 3B.1 | Override classification ผ่าน `PATCH /ai/rag/attachments/:id/classification`, แล้วเรียก `GET /ai/admin/rag/attachments/classification` | แสดง classificationOverride {reason, overriddenBy, overriddenAt} ที่ถูกต้อง | 255 FR-005, SC-006, 254 FR-043 |
| 3B.2 | ตรวจสอบ audit log หลัง override | audit log มี before, after, reason, actor, timestamp | 254 FR-043, SC-010 |

### 3C. BullMQ Retry Flow Integration (Spec 255 + ADR-008)

**ไฟล์**: `backend/test/rag-admin-retry.e2e-spec.ts` (เติมเข้าเดิม)

| Test | สถานการณ์ | ผลที่คาดหวาง | Spec |
|------|-----------|-------------|------|
| 3C.1 | `POST /ai/admin/rag/failed-ingestions/retry` กับ FAILED generation | FAILED generation เปลี่ยนเป็น RETIRED, สร้าง BUILDING ใหม่, BullMQ job enqueue | 255 Q35/Q36, ADR-008 |
| 3C.2 | `POST /ai/admin/rag/failed-ingestions/retry` กับ BUILDING generation | คืนใน failed[] พร้อม reason "Latest generation status is BUILDING" | 255 Q17 |
| 3C.3 | `POST /ai/admin/rag/failed-ingestions/retry` กับ 51 items | ปฏิเสธด้วย @ArrayMaxSize(50) validation | 255 Q34 |

### 3D. Force Re-ingest → BullMQ → Generation Lifecycle (Spec 255 + 254)

**ไฟล์**: `backend/test/rag-admin-lifecycle.e2e-spec.ts` (เติมเข้าเดิม)

| Test | สถานการณ์ | ผลที่คาดหวาง | Spec |
|------|-----------|-------------|------|
| 3D.1 | `POST /ai/admin/rag/attachments/:id/reingest` กับ ACTIVE generation | สร้าง BUILDING ใหม่, ACTIVE เดิมยังคงอยู่จนกว่า BUILDING จะ ACTIVE | 255 US3 AC3, 254 FR-009 |
| 3D.2 | `POST /ai/admin/rag/attachments/:id/reingest` เมื่อ BullMQ enqueue ล้มเหลว | generation ถูก mark FAILED (errorCode=ENQUEUE_FAILED) ไม่มี dangling BUILDING | 255 rag-admin.service.ts L379-393 |

### 3E. Orphan Cleanup Cron Integration (Spec 255, Q8)

**ไฟล์**: `backend/test/rag-admin-orphan-cleanup.e2e-spec.ts` (สร้างใหม่)

| Test | สถานการณ์ | ผลที่คาดหวาง | Spec |
|------|-----------|-------------|------|
| 3E.1 | สร้าง attachment + generation, ลบ attachment, รัน `orphanScanRagAttachments()` | ลบ chunks + pages + Qdrant vectors + generation records | 255 T062, Edge Case |
| 3E.2 | ตรวจสอบว่า orphaned records ไม่ปรากฏใน dashboard | `GET /ai/admin/rag/attachments` ไม่แสดง orphaned records | 255 Edge Case |

---

## 6. Phase 4: Performance Tests (P3)

### 4A. SC Criteria จาก Spec 255

| Test | เกณฑ์ | วิธีวัด | SC |
|------|-------|--------|----|
| 4A.1 | Dashboard load < 3 วินาที | เปิด `/admin/ai/rag-console/` วัดเวลาจนตารางแสดงครบ | SC-001 |
| 4A.2 | Dashboard รองรับ 500+ attachments โดย load < 3 วินาที | seed 500 attachments, เปิด dashboard วัดเวลา | SC-007 |
| 4A.3 | Classification override < 30 วินาที | วัดเวลาตั้งแต่เลือก attachment จน submit สำเร็จ | SC-002 |
| 4A.4 | Failed ingestion retry < 10 วินาที | วัดเวลาตั้งแต่เลือก failed item จนคลิก retry สำเร็จ | SC-005 |
| 4A.6 | Audit log visible < 5 วินาที หลัง override | ทำ override, วัดเวลาจน audit log แสดง | SC-006 |

### 4B. Query Performance (Spec 255)

| Test | เกณฑ์ | วิธีวัด |
|------|-------|--------|
| 4B.1 | `listAttachments()` SQL query ใช้ ROW_NUMBER() window function อย่างมีประสิทธิภาพ | EXPLAIN query, ตรวจสอบว่าไม่มี full table scan |
| 4B.2 | Polling 10s ไม่ทำให้ DB load เกินไป | วัด DB connections ระหว่าง polling active |

---

## 7. Phase 5: Security & RBAC Tests (P2)

### 5A. CASL Guard / RBAC (Spec 255 FR-015)

| Test | สถานการณ์ | ผลที่คาดหวาง | Spec |
|------|-----------|-------------|------|
| 5A.1 | Viewer (ไม่มี `rag.manage`) เรียก `GET /ai/admin/rag/attachments` | 403 Forbidden | 255 FR-015 |
| 5A.2 | Document Controller (ไม่มี `rag.admin.write`) เรียก `POST /ai/admin/rag/attachments/:id/reingest` | 403 Forbidden | 255 FR-015 |
| 5A.3 | Org Admin (มี `rag.retry` แต่ไม่มี `rag.admin.write`) เรียก `POST /ai/admin/rag/metrics/reset` | 403 Forbidden | 255 FR-015 |
| 5A.4 | Org Admin (มี `rag.retry`) เรียก `POST /ai/admin/rag/failed-ingestions/retry` | 200 OK (partial-success) | 255 FR-015 |
| 5A.5 | User (ไม่มี `document.classification_override`) เรียก `PATCH /ai/rag/attachments/:id/classification` | 403 Forbidden | 254 FR-042, SC-008 |
| 5A.6 | Superadmin เรียกทุก endpoint | ทุก endpoint ทำงานได้ | 255 FR-015 |

### 5B. UUID / ADR-019 Compliance

| Test | สถานการณ์ | ผลที่คาดหวาง |
|------|-----------|-------------|
| 5B.1 | ตรวจสอบ API response ทุก endpoint — ไม่มี INT `id` ส่งออก | ใช้ `publicId` (UUIDv7) เท่านั้น |
| 5B.2 | ตรวจสอบ `GET /ai/admin/rag/attachments/:id/generations` — ไม่มี `generationUuid` ใน response | generationUuid ไม่ปรากฏ (FR-014) |
| 5B.3 | ตรวจสอบ frontend code — ไม่มี `parseInt()` บน UUID | ใช้ string comparison เท่านั้น |
| 5B.4 | ตรวจสอบ frontend — ไม่มี `id ?? ''` fallback | ใช้ `publicId` เท่านั้น |

### 5C. AI Boundary (ADR-023/023A)

| Test | สถานการณ์ | ผลที่คาดหวาง |
|------|-----------|-------------|
| 5C.1 | `POST /ai/admin/rag/attachments/:id/reingest` เมื่อ AI disabled (AiEnabledGuard) | คืน 503 หรือ appropriate error (AI not enabled) |
| 5C.2 | `POST /ai/admin/rag/failed-ingestions/retry` เมื่อ AI disabled | คืน 503 |
| 5C.3 | `GET /ai/admin/rag/attachments` (read-only) เมื่อ AI disabled | ทำงานได้ (ไม่มี AiEnabledGuard บน read-only) |
| 5C.4 | `POST /ai/admin/rag/metrics/reset` เมื่อ AI disabled | ทำงานได้ (pure in-memory, ไม่มี AiEnabledGuard) |
| 5C.5 | ตรวจสอบ Qdrant queries ทั้งหมดมี `project_public_id` filter | ไม่มี Qdrant search โดยไม่มี project filter |

### 5D. Idempotency & Audit Trail

| Test | สถานการณ์ | ผลที่คาดหวาง |
|------|-----------|-------------|
| 5D.1 | `POST /ai/admin/rag/attachments/:id/reingest` โดยไม่มี `Idempotency-Key` header | คืน 400 ValidationException |
| 5D.2 | `POST /ai/admin/rag/failed-ingestions/retry` โดยไม่มี `Idempotency-Key` header | คืน 400 ValidationException |
| 5D.3 | `POST /ai/admin/rag/attachments/:id/reingest` ส่ง `Idempotency-Key` ซ้ำ | BullMQ jobId dedup ป้องกัน duplicate job |
| 5D.4 | หลัง reingest, ตรวจสอบ audit log | มี `rag.admin.reingest` audit record |
| 5D.5 | หลัง batch retry, ตรวจสอบ audit log | มี `rag.admin.batch_retry` audit record |
| 5D.6 | หลัง metrics reset, ตรวจสอบ audit log | มี `rag.admin.metrics_reset` audit record |
| 5D.7 | หลัง classification override, ตรวจสอบ audit log | มี before/after/reason/actor/timestamp (254 FR-043) |

### 5E. Error Handling (ADR-007)

| Test | สถานการณ์ | ผลที่คาดหวาง |
|------|-----------|-------------|
| 5E.1 | 409 Conflict (BUILDING exists) | userMessage: "กำลัง ingest อยู่ กรุณารอให้เสร็จก่อน" + recoveryAction |
| 5E.2 | 400 Validation (no checksum) | userMessage: "ต้องมี checksum สำหรับ re-ingest" |
| 5E.3 | 404 Not Found (attachment ไม่มี) | userMessage ที่เป็นมิตร ไม่ expose technical details |
| 5E.4 | 403 Forbidden (RBAC) | userMessage ที่เป็นมิตร + i18n |
| 5E.5 | ทุก error message ใช้ i18n key (ไม่มี hardcoded string) | ตรวจสอบในทั้ง en + th locale files |

---

## 8. ไฟล์ทดสอบสรุป

| ไฟล์ | สถานะ | Tests เพิ่ม | Phase | Spec |
|------|-------|-----------|-------|------|
| `backend/src/modules/ai/rag-admin.controller.spec.ts` | ✅ มีอยู่ (11 pass) | +1 (2D.1) | Phase 2 | 255 |
| `backend/src/modules/ai/services/rag-admin.service.spec.ts` | ✅ มีอยู่ (14 pass) | +3 (2A.1-2A.3, 2B.1-2B.3) | Phase 2 | 255 |
| `backend/src/modules/ai/services/vector-cleanup.service.spec.ts` | ✅ มีอยู่ (4 pass) | +3 (2C.1-2C.3) | Phase 2 | 255 |
| `backend/test/rag-admin-cross-project.e2e-spec.ts` | ❌ สร้างใหม่ | +2 (3A.1-3A.2) | Phase 3 | 255+254 |
| `backend/test/rag-admin-classification.e2e-spec.ts` | ✅ มีอยู่ (2 pass) | +2 (3B.1-3B.2) | Phase 3 | 255+254 |
| `backend/test/rag-admin-retry.e2e-spec.ts` | ✅ มีอยู่ (6 pass) | +3 (3C.1-3C.3) | Phase 3 | 255+ADR-008 |
| `backend/test/rag-admin-lifecycle.e2e-spec.ts` | ✅ มีอยู่ (6 pass) | +2 (3D.1-3D.2) | Phase 3 | 255+254 |
| `backend/test/rag-admin-orphan-cleanup.e2e-spec.ts` | ❌ สร้างใหม่ | +2 (3E.1-3E.2) | Phase 3 | 255 |
| `frontend/app/(admin)/admin/ai/rag-console/__tests__/*.test.tsx` | ✅ มีอยู่ (18 pass) | +RBAC gating tests | Phase 1 | 255 |
| Playwright E2E (สร้างใหม่) | ❌ สร้างใหม่ | ~30 ขั้นตอน | Phase 1 | 255 |

**รวม**: ~15 unit/integration tests ใหม่ + ~30 ขั้นตอน browser verify + ~10 security tests

---

## 9. ลำดับการทำ (Execution Order)

```
Phase 1 (Browser E2E)          ← P1 ทำก่อน — ยืนยันใช้งานได้จริงผ่านเบราว์เซอร์
  ├── 1A-1E: 5 tabs flow
  ├── 1F: RBAC permission gating (P1 gap — frontend ยังไม่เช็ค permission)
  ├── 1G: Edge cases (service unavailable, orphaned, empty state)
  └── 1H: Console/Network check
  ↓
Phase 5 (Security & RBAC)      ← P2 ทำควบคู่ — ปิดช่องว่าง SC-008
  ├── 5A: CASL guard ทุก role × ทุก endpoint
  ├── 5B: UUID compliance
  ├── 5C: AI boundary (AiEnabledGuard)
  ├── 5D: Idempotency & audit trail
  └── 5E: Error handling (ADR-007)
  ↓
Phase 2 (Backend Unit)         ← P2 ปิด coverage gap
  ├── 2A: Audit trail tests
  ├── 2B: Pagination edge cases
  ├── 2C: Orphan cleanup edge cases
  └── 2D: Service unavailable
  ↓
Phase 3 (Integration)          ← P2 ทดสอบการเชื่อมต่อข้าม service
  ├── 3A: Cross-project filter
  ├── 3B: Audit trail E2E
  ├── 3C: BullMQ retry flow
  ├── 3D: Force re-ingest lifecycle
  └── 3E: Orphan cleanup Cron
  ↓
Phase 4 (Performance)         ← P3 benchmark
  ├── 4A: SC criteria
  └── 4B: Query performance
```

---

## 10. เกณฑ์ผ่าน (Acceptance Criteria)

| เกณฑ์ | เป้าหมาย | วิธีวัด |
|-------|---------|--------|
| Browser E2E | ทุกขั้นตอน Phase 1 (1A-1H) ผ่าน | manual verify หรือ Playwright |
| Frontend RBAC gating | Classification override form hidden สำหรับ user ที่ไม่มี `document.classification_override` | Browser verify 1F.6 |
| Backend coverage | ≥80% สำหรับ rag-admin.controller + rag-admin.service | `cd backend && npx jest --coverage --testPathPatterns="rag-admin"` |
| SC-001 | Dashboard load < 3s | manual timing |
| SC-007 | 500+ attachments < 3s | seed + timing |
| SC-008 | 0 unauthorized classification override attempts | 5A.5 + 1F.6 ผ่าน |
| RBAC | 0 unauthorized สำหรับทุก endpoint × ทุก role | 5A.1-5A.6 ผ่าน |
| UUID compliance | 0 INT PK exposure, 0 generationUuid exposure | 5B.1-5B.4 ผ่าน |
| Audit trail | 100% ของ reingest/retry/reset/classification มี audit record | 5D.4-5D.7 ผ่าน |
| Idempotency | 100% ของ POST endpoint ต้องมี Idempotency-Key validation | 5D.1-5D.2 ผ่าน |
| ไม่มี `any` / `console.log` | 0 | eslint + tsc ผ่าน |
| i18n | ทุก user-facing text ใช้ i18n key (en + th) | grep hardcoded string = 0 |

---

## 11. ความเสี่ยงและการจัดการ

| ความเสี่ยง | ผลกระทบ | การจัดการ |
|-----------|--------|-----------|
| Frontend ไม่เช็ค `document.classification_override` ก่อนแสดง override form | SC-008 ละเว้น — user ที่ไม่มีสิทธิ์เห็น form และพยายาม submit (backend จะปฏิเสธ แต่ UX ไม่ดี) | **P1**: เพิ่ม `useAbility()` CASL check ใน Classification tab เพื่อ hide/disable override form |
| ไม่มี Playwright E2E | ไม่สามารถยืนยัน UI flow จริงได้ — มีแค่ API-level E2E | ใช้ `check-real-app` skill สำหรับ manual browser verify ก่อน แล้ววางแผน Playwright ทีหลัง |
| Metrics เป็น in-memory (ไม่ persisted) | reset แล้วข้อมูลหายทั้งหมด ไม่มี historical trend | Document limitation ใน UI tooltip (ได้ทำแล้วใน Q15/Q16) |
| Polling 10s อาจทำให้ DB load สูง | Dashboard ช้าลงเมื่อมี admin หลายคนเปิดพร้อมกัน | ตรวจสอบ query performance (4B.2) + พิจารณา WebSocket ในอนาคต |
| `retryIngestion()` เป็น private method ใน `rag-admin.service.ts` ไม่ใช่ใน `rag-attachment-ingestion.service.ts` ตาม T056 | สถาปัตยกรรมผิดจากแผน — ย้ายยากถ้าต้อง reuse | พิจารณาย้ายไป `rag-attachment-ingestion.service.ts` ใน refactor ถัดไป (P3) |
| Orphan cleanup Cron รันทุก 6 ชั่วโมง | Orphaned records ปรากฏใน dashboard ชั่วคราวก่อน cleanup | Document ใน dashboard ว่า orphaned records จะถูก cleanup อัตโนมัติ |

---

## 12. งานที่เกี่ยวข้อง (Cross-Reference)

| งาน | ความสัมพันธ์ | สถานะ |
|-----|-------------|-------|
| `109-speckit-tester` | รัน test ตามแผนนี้ — handoff ไป | พร้อมใช้ |
| `e2e-testing` | ใช้ Playwright patterns สำหรับ Phase 1 | พร้อมใช้ |
| `check-real-app` | ใช้สำหรับ browser verify จริงใน Phase 1 (ก่อนมี Playwright) | พร้อมใช้ |
| `111-speckit-validate` | validate implementation ตาม spec 255 (หลัง test pass) | รอหลัง test |
| `verification-loop` | ลูปตรวจสอบ 6 ขั้น (build → typecheck → lint → test → security → diff) | รอหลัง test |
| `112-speckit-security-audit` | Security audit สำหรับ Phase 5 | รอหลัง test |
| **254-rag-attachment-chunks** test-plan | test plan เดิมของ 254 — อ้างอิงสำหรับ backend API tests | มีอยู่ (test-report.md) |
| **migration-admin-unified-test-plan** | migration ใช้ batch RAG หลัง commit — rag-console ใช้ดูสถานะ | มีอยู่ |
