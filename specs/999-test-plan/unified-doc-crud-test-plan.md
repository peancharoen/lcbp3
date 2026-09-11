// File: specs/999-test-plan/unified-doc-crud-test-plan.md
// Change Log:
// - 2026-09-11: Initial unified test plan — ครอบคลุม Feature 253 (Unified Document CRUD) + สเปคสนับสนุน

# แผนการทดสอบรวม: Unified Document CRUD Management (Feature 253)

**วันที่ร่าง**: 2026-09-11
**ขอบเขต**: Document Actions (Cancel / Hard-Delete / Metadata Patch / Bulk Ops) + Admin Maintenance Console ครอบคลุม 5 ประเภทเอกสาร (Correspondence, RFA, Transmittal, Drawings, Circulation)
**สเปคหลัก**: `specs/200-fullstacks/253-unified-doc-crud/`
**ADR อ้างอิง**: ADR-019 (UUID), ADR-016 (RBAC), ADR-002 (Numbering/Redlock), ADR-008 (BullMQ), ADR-007 (Errors), ADR-021 (Workflow), ADR-023/023A (AI Boundary), ADR-044 (Schema)
**ทดสอบบน production**: https://lcbp3.np-dms.work/admin/ai/rag-console
**Login Credentials:**
```
username:superadmin password:Center2025
username:admin password:Center2025
username:editor01 password:Center2025
username:viewer01 password:Center2025
```
**Test Data**:
 - โครงการทดสอบ: LCBP-C2 (หรือ project ที่มีอยู่ในระบบ)
 - ผู้ใช้ทดสอบ 4 role: Superadmin, Org Admin, Document Controller (DC), Viewer
 - เอกสารทดสอบ: Correspondence/RFA/Transmittal/Drawings/Circulation สถานะ DRAFT, IN_REVIEW, APPROVED, CANCELLED อย่างน้อย 1 ฉบับต่อสถานะ
 - ไฟล์แนบทดสอบ: PDF ขนาดเล็ก (< 1MB) สำหรับ Hard-Delete cascade test

---

## 1. สเปคที่เกี่ยวข้อง

### 1.1 Core Specs — สเปคหลักที่ implement Document CRUD โดยตรง

| # | สเปค | ADR | หน้าที่ | สถานะ Implementation |
|---|------|-----|--------|---------------------|
| 1 | **253-unified-doc-crud** | ADR-019/016/002/008/007/021/023A | **Main impl**: Cancel, Hard-Delete, Metadata Patch (3-Tier), Bulk Ops, Maintenance Console (4 tabs), Row Actions, Side Effects Orchestrator | Implemented — 120/120 tasks done; 2564 backend + 1002 frontend tests pass; validation PARTIAL (88% FR covered) |

### 1.2 Supporting Specs — สเปคที่ Document CRUD ใช้แต่ไม่ใช่ฟีเจอร์หลัก

| # | สเปค | ความเกี่ยวข้อง | สถานะ |
|---|------|---------------|-------|
| 2 | **201-transmittals-circulation** | Transmittal/Circulation base CRUD + Force Close | Implemented |
| 3 | **202-adr-021-integrated-workflow-conte** | Workflow Engine — Cancel ต้อง terminate workflow instances | Implemented |
| 4 | **203-unified-workflow-engine** | Workflow state machine — Cancel ยุติ active instance | Implemented |
| 5 | **204-rfa-approval-refactor** | RFA cancel + metadata patch | Implemented |
| 6 | **249-adr-049-workflow-state-machine** | Workflow state transitions ที่ Cancel ต้องกระทบ | Implemented |

### 1.3 แผนภาพความสัมพันธ์ (Dependency Flow)

```
253-unified-doc-crud (Main: Cancel + Hard-Delete + Metadata Patch + Bulk + Maintenance)
  │
  ├──► 201-transmittals-circulation (Transmittal/Circulation base + Force Close)
  │
  ├──► 202/203/249 (Workflow Engine — Cancel ยุติ active instance ใน transaction)
  │
  ├──► 204-rfa-approval-refactor (RFA cancel + metadata patch)
  │
  └──► ADR-023A (Qdrant vector deletion ใน Hard-Delete — projectPublicId filter บังคับ)
```

---

## 2. สถานะ Implementation จริง (Audit จาก Codebase)

> ตรวจเมื่อ 2026-09-11 — ตรวจไฟล์จริงใน `backend/src/` และ `frontend/`

### 2.1 Backend

| Module / File | สถานะ | Test Files | Coverage |
|--------------|-------|------------|----------|
| `common/services/document-side-effects.service.ts` | Implemented | `.spec.ts` (10 tests) | 100% stmts |
| `common/services/document-hard-delete.service.ts` | Implemented | `.spec.ts` (8 tests) | 94.44% stmts |
| `common/services/document-action-strategy.interface.ts` | Implemented (interface) | — | — |
| `modules/correspondence/correspondence.service.ts` (cancel + patchMetadata + hardDelete) | Implemented | `.spec.ts` (52 tests) | 81.57% stmts |
| `modules/correspondence/correspondence.controller.ts` | Implemented | `.spec.ts` (25 tests) | 100% stmts |
| `modules/rfa/rfa.service.ts` (cancel + patchMetadata) | Implemented | `.spec.ts` (41 tests) | 81.1% stmts |
| `modules/transmittal/transmittal.service.ts` (cancel + patchMetadata) | Implemented | `.spec.ts` (15 tests) | 60.43% stmts |
| `modules/drawing/contract-drawing.service.ts` (soft-delete + patchMetadata) | Implemented | `.spec.ts` (22 tests) | — |
| `modules/circulation/circulation.service.ts` (force-close) | Implemented | `.spec.ts` | 68.73% stmts |
| `modules/document/document.service.ts` (bulk cancel/tag/export) | Implemented | `.spec.ts` (9 tests) | 86.82% stmts |
| `modules/document/document.controller.ts` (bulk endpoints) | Implemented | **0% unit** ⚠️ | 0% (E2E เท่านั้น) |
| `modules/document/processors/bulk-operations.processor.ts` (BullMQ) | Implemented | — | — |
| `modules/maintenance/maintenance.controller.ts` | Implemented | **0% unit** ⚠️ | 0% (E2E เท่านั้น) |
| `modules/maintenance/maintenance.service.ts` (orchestrator) | Implemented | `.spec.ts` (10 tests) | 97.56% stmts |
| `modules/maintenance/services/numbering-tools.service.ts` | **Skeleton** ⚠️ | `.spec.ts` | 33.55% stmts |
| `modules/maintenance/services/orphan-cleanup.service.ts` | **Skeleton** ⚠️ | `.spec.ts` | 38.29% stmts |
| `modules/maintenance/services/vector-sync.service.ts` | Partial (DB+Qdrant query มี) | `.spec.ts` | 44.94% stmts |
| `modules/maintenance/services/emergency-unlock.service.ts` | **Skeleton** ⚠️ | `.spec.ts` | 40.95% stmts |
| `backend/test/document-cancel.e2e-spec.ts` | 2 tests | E2E | — |
| `backend/test/document-hard-delete.e2e-spec.ts` | 5 tests | E2E | — |
| `backend/test/document-metadata-patch.e2e-spec.ts` | 2 tests | E2E | — |
| `backend/test/maintenance-console.e2e-spec.ts` | 4 tests | E2E | — |
| `backend/test/two-tier-edit.e2e-spec.ts` | 2 tests | E2E | — |

### 2.2 Frontend

| File | สถานะ | Test Files | Coverage |
|------|-------|------------|----------|
| `components/documents/document-row-actions.tsx` | Implemented | **MISSING** ⚠️ | 0% direct |
| `components/documents/document-cancel-dialog.tsx` | Implemented | **MISSING** ⚠️ | 0% direct |
| `components/documents/document-hard-delete-dialog.tsx` | Implemented | **MISSING** ⚠️ | 0% direct |
| `components/documents/document-metadata-edit-dialog.tsx` | Implemented | **MISSING** ⚠️ | 0% direct |
| `components/documents/bulk-action-bar.tsx` | Implemented | **MISSING** ⚠️ | 0% direct |
| `components/documents/bulk-result-dialog.tsx` | Implemented | **MISSING** ⚠️ | 0% direct |
| `components/documents/bulk-tag-dialog.tsx` | Implemented | **MISSING** ⚠️ | 0% direct |
| `components/documents/document-action-strategy.ts` | Implemented | — | — |
| `components/documents/common/server-data-table.tsx` | Implemented | `__tests__/server-data-table.test.tsx` (5 tests) | — |
| `hooks/use-document-actions.ts` | Implemented | **MISSING** ⚠️ | 0% direct |
| `hooks/use-bulk-actions.ts` | Implemented | **MISSING** ⚠️ | 0% direct |
| `lib/services/document-action.service.ts` | Implemented | — | — |
| `lib/query-keys.ts` | Implemented | — | — |
| `app/(dashboard)/correspondences/page.tsx` (Row Actions) | Integrated | — | — |
| `app/(dashboard)/rfas/page.tsx` (Row Actions) | Integrated | — | — |
| `app/(dashboard)/transmittals/page.tsx` (Row Actions) | Integrated | — | — |
| `app/(dashboard)/drawings/page.tsx` (Row Actions) | Integrated | — | — |
| `app/(dashboard)/circulation/page.tsx` (Force Close) | Integrated | `circulation-list.test.tsx` (9 tests) | — |
| `app/(admin)/admin/doc-control/maintenance/page.tsx` | Implemented | **MISSING** ⚠️ | — |
| `components/admin/maintenance/*-tab.tsx` (4 tabs) | Implemented | **MISSING** ⚠️ | — |
| `frontend/e2e/` (Playwright) | **NOT EXISTS** ⚠️ | — | — |

### 2.3 สถานะสรุปต่อสเปค

| สเปค | สถานะ | เหตุผล |
|------|-------|--------|
| 253-unified-doc-crud | **Implemented (Partial)** | โค้ดครบ + backend tests pass; แต่ frontend unit tests ขาด, Playwright E2E ไม่มี, Maintenance services เป็น skeleton, 5 E2E tasks `[~]` |

---

## 3. ช่องว่างที่พบ (Gap Analysis)

| Priority | ประเภทช่องว่าง | รายละเอียด | จำนวน |
|----------|---------------|-----------|-------|
| **P1** | Browser E2E gap | ไม่มี Playwright infra (`frontend/e2e/` ไม่มี) — ไม่สามารถทดสอบ UI flow จริงได้ | 1 กลุ่ม |
| **P1** | Frontend unit test gap | 7 component + 2 hook ไม่มี direct test (Row Actions, Cancel/HardDelete/Metadata Dialog, BulkActionBar, BulkResultDialog, BulkTagDialog, useDocumentActions, useBulkActions) | 9 ไฟล์ |
| **P2** | Backend controller coverage gap | `document.controller.ts`, `maintenance.controller.ts` 0% unit (E2E เท่านั้น ต้องการ test DB) | 2 ไฟล์ |
| **P2** | Maintenance service skeleton | `numbering-tools`, `orphan-cleanup`, `vector-sync`, `emergency-unlock` เป็น skeleton — ไม่มี real storage/AI queue backend | 4 services |
| **P2** | FR-034 PARTIAL | RFA/Transmittal/Drawing hard-delete ไม่มี `system.manage_all` fallback (เฉพาะ Correspondence มี) | 1 FR |
| **P2** | FR-049 PARTIAL | ไม่ได้ verify role-permission mapping สำหรับ RFA/Transmittal/Drawing delete ว่า DC ไม่ได้รับสิทธิ์โดยไม่ตั้งใจ | 1 FR |
| **P3** | EC-8 PARTIAL | Hard-Delete Drawing ไม่มี vector — `deleteVectors` เป็น no-op (SKIPPED) แต่ไม่ได้พยายามลบ | 1 EC |
| **P3** | EC-11 PARTIAL | Void & Replace numbering เป็น skeleton implementation | 1 EC |
| **P3** | Performance benchmark | ไม่มี benchmark test สำหรับ SC-001 (<30s cancel), SC-003 (<10s hard-delete), SC-004 (bulk 100 <60s) | 3 SC |
| **P3** | Notification fan-out | `patchMetadata` notification ยังไม่ครบ (recipient fan-out ไม่สมบูรณ์) | 1 item |

---

## 4. โครงสร้างการทดสอบ

การทดสอบแบ่งเป็น **5 Phase** ตามลำดับความสำคัญและ dependency:

```
Phase 1: Browser E2E (P1)     ← ทดสอบผ่านเบราว์เซอร์จริง — UI flow, RBAC, edge cases
  ↓
Phase 2: Backend Unit Tests    ← ปิด coverage gap (controller, service, worker)
  ↓
Phase 3: Integration Tests     ← End-to-end flow ข้ามหลาย service
  ↓
Phase 4: Performance Tests     ← Benchmark ตาม Success Criteria
  ↓
Phase 5: Security & RBAC       ← CASL guard, UUID, AI boundary, idempotency, audit
```

---

## 5. Phase 1: Browser E2E (P1 — ทำก่อน)

> **เป้าหมาย**: ยืนยันว่าผู้ใช้ใช้งาน Document Actions ผ่านหน้าเว็บได้จริง
> **ข้อกำหนด**: ต้องตั้งค่า Playwright infra ก่อน (`frontend/e2e/` + `playwright.config.ts`) — ปัจจุบันยังไม่มี

### 1A. Correspondences Dashboard — Cancel (Spec 253 US1, FR-001 to FR-006)

**เตรียมการ**:
- [ ] Backend + Frontend deploy แล้ว (CI run ล่าสุด pass)
- [ ] มี project อย่างน้อย 1 โครงการ + Correspondence สถานะ IN_REVIEW อย่างน้อย 2 ฉบับ (1 ฉบับมี Circulation ผูกอยู่)
- [ ] User ทดสอบ: DC (มี `correspondence.cancel`), Viewer (ไม่มี), Superadmin

| ขั้นตอน | การกระทำ | ผลที่คาดหวาง | FR/Spec |
|---------|---------|-------------|---------|
| 1A.1 | ล็อกอินเป็น DC, เข้า `/correspondences` | แสดงตารางรายการ Correspondences พร้อมคอลัมน์ ⋯ (Row Action) | 253 FR-021 |
| 1A.2 | กด ⋯ ที่แถวเอกสารสถานะ IN_REVIEW | เมนู dropdown แสดง "ยกเลิกเอกสาร" + "แก้ไขข้อมูลกำกับ" + "ดูรายละเอียด" | 253 FR-021, FR-024 |
| 1A.3 | เลือก "ยกเลิกเอกสาร" | แสดง Dialog มีช่องกรอกเหตุผล + คำเตือน "การยกเลิกจะปิดใบเวียนที่เกี่ยวข้องทั้งหมด" | 253 US1-AC1 |
| 1A.4 | กรอกเหตุผล "ทดสอบยกเลิก" แล้วกดยืนยัน | สถานะเปลี่ยนเป็น CANCELLED, แสดง Toast "ยกเลิกสำเร็จ — ปิดใบเวียน N รายการ ส่งการแจ้งเตือน M รายการ" | 253 FR-001, FR-003, FR-027 |
| 1A.5 | ตรวจสอบ Network tab — response shape | `POST /correspondences/:uuid/cancel` ส่ง `Idempotency-Key` header, response มี `sideEffects` + `auditId` | 253 FR-027, ADR-016 |
| 1A.6 | ตรวจสอบ API response ใช้ `publicId` (UUIDv7) ไม่ใช่ INT `id` | response.publicId เป็น UUID string | ADR-019 |
| 1A.7 | ล็อกอินเป็น Viewer, เข้า `/correspondences`, กด ⋯ | เห็นเฉพาะ "ดูรายละเอียด" ไม่เห็น "ยกเลิกเอกสาร" | 253 US1-AC2, FR-005 |
| 1A.8 | ล็อกอินเป็น DC, กด ⋯ ที่เอกสารสถานะ CANCELLED | เมนู "ยกเลิกเอกสาร" ถูกซ่อนหรือ disabled | 253 US1-AC3, FR-002 |
| 1A.9 | ยกเลิกเอกสารที่มี Circulation 2 ใบผูกอยู่ | Circulation ทั้ง 2 ใบถูก force-close, Toast แสดง "ปิดใบเวียน 2 รายการ" | 253 US1-AC4, FR-003 |
| 1A.10 | ตรวจสอบ Audit Trail ใน DB (`audit_logs`) | มี record action=CANCEL, entityId=publicId, มี before/after | 253 FR-035 |

### 1B. Correspondence Detail — Metadata Patch (Spec 253 US2, FR-012 to FR-015)

| ขั้นตอน | การกระทำ | ผลที่คาดหวาง | FR/Spec |
|---------|---------|-------------|---------|
| 1B.1 | ล็อกอินเป็น DC, เข้า `/correspondences/[uuid]` สถานะ IN_REVIEW | แสดง Action Bar มีปุ่ม "แก้ไขข้อมูลกำกับ" | 253 FR-022 |
| 1B.2 | กด "แก้ไขข้อมูลกำกับ" | เปิด Dialog แสดงฟิลด์ Tier 1 (Subject, Remarks, Due Date, Tags, CC Recipients) | 253 US2-AC4, FR-012 |
| 1B.3 | ตรวจสอบว่าฟิลด์ Tier 3 (เลขที่เอกสาร, ผู้ออก, โครงการ) ไม่ปรากฏ | ไม่มีฟิลด์ Tier 3 ใน Dialog | 253 US2-AC4, FR-012 |
| 1B.4 | เปลี่ยน Subject + เพิ่ม Tag แล้วบันทึก | Subject + Tag อัปเดต, แสดง Toast สำเร็จ | 253 US2-AC1 |
| 1B.5 | ตรวจสอบ Audit Trail — มี Before/After Diff | `audit_logs.detailsJson` มี `before`/`after` ของ subject + tagIds | 253 FR-013, FR-036 |
| 1B.6 | ตรวจสอบ version increment | `correspondences.version` เพิ่มขึ้น 1 | 253 FR-014 |
| 1B.7 | เปิด Dialog อีกครั้ง ไม่เปลี่ยนอะไรแล้วบันทึก | ระบบแจ้ง "ไม่มีการเปลี่ยนแปลง" (no-op), version ไม่เพิ่ม | 253 EC-5 |
| 1B.8 | เปิดเอกสารสถานะ CANCELLED | ปุ่ม "แก้ไขข้อมูลกำกับ" disabled | 253 US2-AC2 |
| 1B.9 | จำลอง 2 DC แก้ไขพร้อมกัน — คนที่ 2 บันทึกหลังคนที่ 1 | คนที่ 2 ได้รับ error "เอกสารถูกแก้โดยผู้ใช้อื่น กรุณารีเฟรชหน้านี้" | 253 US2-AC3, FR-014 |

### 1C. Hard-Delete (Spec 253 US3, FR-007 to FR-011)

| ขั้นตอน | การกระทำ | ผลที่คาดหวาง | FR/Spec |
|---------|---------|-------------|---------|
| 1C.1 | ล็อกอินเป็น Superadmin, เข้า `/correspondences/[uuid]` | แสดงปุ่ม "ลบถาวร" (สีแดง) | 253 US3-AC1, FR-007 |
| 1C.2 | กด "ลบถาวร" | แสดง Dialog สีแดง + คำเตือน + ช่องพิมพ์ "DELETE" | 253 US3-AC1 |
| 1C.3 | พิมพ์ "DELETE" แล้วยืนยัน | ไฟล์ + Qdrant vectors + DB rows ถูกลบ, Toast สำเร็จ + snapshot | 253 FR-008, FR-009 |
| 1C.4 | ตรวจสอบ Audit Trail — มี Snapshot ก่อนลบ | `audit_logs` action=HARD_DELETE, มี documentNumber, status, attachmentCount, vectorCount | 253 FR-009, FR-037 |
| 1C.5 | ล็อกอินเป็น DC, เข้า detail page | ไม่เห็นปุ่ม "ลบถาวร" | 253 US3-AC2, FR-007 |
| 1C.6 | Superadmin ลบถาวร Transmittal | ลบเฉพาะ transmittals + transmittal_items, Correspondence ต้นทางไม่ถูกลบ | 253 US3-AC3, FR-008 |
| 1C.7 | Superadmin ลบถาวรเอกสารที่ Qdrant deletion ล้มเหลว | response `vectorsDeleted: PENDING_RETRY`, มี record ใน `pending_vector_deletions` | 253 US3-AC4, FR-011 |

### 1D. Bulk Cancel (Spec 253 US4, FR-016 to FR-020)

| ขั้นตอน | การกระทำ | ผลที่คาดหวาง | FR/Spec |
|---------|---------|-------------|---------|
| 1D.1 | ล็อกอินเป็น DC, เข้า `/correspondences`, เลือก Checkbox 5 รายการ | แถบ Bulk Action Bar ปรากฏด้านล่าง "เลือกแล้ว 5 รายการ" | 253 FR-023, US4-AC1 |
| 1D.2 | กด "ยกเลิกเป็นชุด" | แสดง Dialog กรอกเหตุผลร่วม | 253 US4-AC1 |
| 1D.3 | กรอกเหตุผลแล้วยืนยัน | แสดง Progress Bar, ประมวลผลทีละรายการ | 253 FR-019 |
| 1D.4 | รอจนเสร็จ | แสดง Dialog สรุปผล: สำเร็จ N รายการ, ล้มเหลว M รายการ (พร้อมเหตุผล) | 253 FR-019, FR-046 |
| 1D.5 | เลือก Checkbox เอกสารสถานะ CANCELLED | ระบบแสดง warning "เลือกได้เฉพาะเอกสารที่ยังไม่ถูกยกเลิก" | 253 US4-AC2, FR-018 |
| 1D.6 | พยายามเลือก Checkbox มากกว่า 100 รายการ | ระบบปฏิเสธ "เลือกได้สูงสุด 100 รายการ" | 253 US4-AC3, FR-017 |
| 1D.7 | ตรวจสอบ Audit Trail — แต่ละรายการมี `bulkId` ร่วม | `audit_logs.detailsJson.bulkId` เหมือนกันทุกรายการ | 253 US4-AC4, FR-038 |
| 1D.8 | ตรวจสอบ Network — request มี `Idempotency-Key` | header ปรากฏใน `POST /documents/bulk/cancel` | ADR-016 |

### 1E. Maintenance Console (Spec 253 US5, FR-030 to FR-031)

| ขั้นตอน | การกระทำ | ผลที่คาดหวาง | FR/Spec |
|---------|---------|-------------|---------|
| 1E.1 | ล็อกอินเป็น System Admin, เข้า `/admin/doc-control/maintenance` | แสดง 4 แท็บ: Numbering Tools, Orphan Cleanup, Vector Sync, Emergency Unlock | 253 FR-030, US5-AC1 |
| 1E.2 | เปิดแท็บ Orphan Cleanup, กด "สแกนหาไฟล์ขยะ" | แสดงรายการไฟล์ที่ไม่มีเอกสารผูก + ขนาด | 253 US5-AC1 |
| 1E.3 | กด "ล้างไฟล์ขยะ" | ลบไฟล์, บันทึก Audit Log | 253 US5-AC1 |
| 1E.4 | เปิดแท็บ Numbering Tools, กด "ตรวจสอบช่องว่างเลขที่" | แสดง Sequence Gap | 253 US5-AC2 |
| 1E.5 | เปิดแท็บ Vector Sync, กด "ตรวจสอบเอกสารที่ยังไม่ได้ Embed" | แสดงรายการเอกสารที่ตกหล่นจาก Qdrant | 253 US5-AC3 |
| 1E.6 | เปิดแท็บ Emergency Unlock, ตรวจหาเอกสารที่ติดค้าง Lock | แสดงรายการ + ปุ่ม Force Release | 253 US5-AC4 |
| 1E.7 | ล็อกอินเป็น Viewer, เข้า `/admin/doc-control/maintenance` | ไม่มีสิทธิ์เข้า (403 หรือ redirect) | 253 FR-031 |
| 1E.8 | ล็อกอินเป็น System Admin ที่มีเฉพาะ `system.orphan_cleanup` | เห็นเฉพาะแท็บ Orphan Cleanup, แท็บอื่น disabled/hidden | 253 FR-031 |

### 1F. DRAFT Edit + 2-Tier Enforcement (Spec 253 US6)

| ขั้นตอน | การกระทำ | ผลที่คาดหวาง | FR/Spec |
|---------|---------|-------------|---------|
| 1F.1 | ล็อกอินเป็นผู้ใช้ทั่วไป, สร้าง Correspondence บันทึกเป็น DRAFT | สร้างสำเร็จ, แก้ไขได้ทุกฟิลด์ | 253 US6-AC1 |
| 1F.2 | กด Submit | สถานะเปลี่ยนเป็น IN_REVIEW | 253 US6-AC2 |
| 1F.3 | พยายามแก้ไขเนื้อหา (Body, Attachments, Recipients) | ระบบปฏิเสธ "เอกสารนี้ไม่สามารถแก้ไขเนื้อหาได้" | 253 US6-AC2 |
| 1F.4 | พยายามแก้ไขเอกสารสถานะ APPROVED | ระบบปฏิเสธ "เอกสารนี้อนุมัติแล้ว ไม่สามารถแก้ไขได้" | 253 US6-AC3 |

### 1G. Cross-Type Consistency (Spec 253 FR-021 to FR-024, SC-008)

| ขั้นตอน | การกระทำ | ผลที่คาดหวาง | FR/Spec |
|---------|---------|-------------|---------|
| 1G.1 | เข้าหน้า `/rfas`, `/transmittals`, `/drawings`, `/circulation` | ทุกหน้ามี Row Action Dropdown (⋯) ครบ | 253 FR-021, SC-008 |
| 1G.2 | เข้า detail page ของ RFA, Transmittal, Drawing, Circulation | ทุกหน้ามี Action Bar ครบ | 253 FR-022, SC-008 |
| 1G.3 | ตรวจสอบ label ใช้ i18n — ไม่มี hardcoded string | ใช้ `document.type.*` + `document.action.*` keys | 253 FR-042, FR-043 |
| 1G.4 | ตรวจสอบ Console ไม่มี error/warning | ไม่มี React warning, ไม่มี network error นอกจาก 403 ที่คาดหวาง | — |

---

## 6. Phase 2: Backend Unit Tests (P2 — ปิด coverage gap)

> **เป้าหมาย**: ปิด coverage gap ของ controller และ service ที่ยัง 0% หรือต่ำ

### 2A. Document Controller Unit Tests (Spec 253 FR-016 to FR-020)

| ขั้นตอน | การกระทำ | ผลที่คาดหวาง | FR/Spec |
|---------|---------|-------------|---------|
| 2A.1 | เขียน unit test `document.controller.spec.ts` สำหรับ `POST /documents/bulk/cancel` | ตรวจ permission `document.bulk_cancel`, Idempotency-Key, response 202 + bulkId | 253 FR-016, ADR-016 |
| 2A.2 | เขียน unit test สำหรับ `POST /documents/bulk/tag` | ตรวจ permission `document.bulk_tag`, cross-type support, response 202 | 253 FR-016 |
| 2A.3 | เขียน unit test สำหรับ `POST /documents/bulk/export` | ตรวจ permission `document.bulk_export`, response 202 + downloadUrl | 253 FR-016 |
| 2A.4 | เขียน unit test กรณี max 100 items exceeded | ตรวจ validation error 422 | 253 FR-017 |
| 2A.5 | เขียน unit test กรณี ineligible items (CANCELLED ใน bulk cancel) | ตรวจ filter + warning response | 253 FR-018 |
| 2A.6 | ตรวจ response ใช้ `publicId` (UUIDv7) ไม่ใช่ INT `id` | ทุก response มี publicId string | ADR-019 |

### 2B. Maintenance Controller Unit Tests (Spec 253 FR-030 to FR-031)

| ขั้นตอน | การกระทำ | ผลที่คาดหวาง | FR/Spec |
|---------|---------|-------------|---------|
| 2B.1 | เขียน unit test `maintenance.controller.spec.ts` สำหรับ Numbering Tools endpoints | ตรวจ permission `system.numbering_override`, Idempotency-Key | 253 FR-031 |
| 2B.2 | เขียน unit test สำหรับ Orphan Cleanup endpoints | ตรวจ permission `system.orphan_cleanup` | 253 FR-031 |
| 2B.3 | เขียน unit test สำหรับ Vector Sync endpoints | ตรวจ permission `system.vector_sync` | 253 FR-031 |
| 2B.4 | เขียน unit test สำหรับ Emergency Unlock endpoints | ตรวจ permission `system.emergency_unlock` + `system.manage_all` สำหรับ bulk-hard-purge | 253 FR-031 |
| 2B.5 | เขียน unit test กรณี Viewer เข้า maintenance endpoints | ตรวจ 403 Permission denied | 253 FR-031 |

### 2C. Maintenance Service Real Implementation Tests (Spec 253 FR-030)

> **หมายเหตุ**: ปัจจุบัน maintenance services เป็น skeleton — ต้อง implement real backend ก่อนเขียน test

| ขั้นตอน | การกระทำ | ผลที่คาดหวาง | FR/Spec |
|---------|---------|-------------|---------|
| 2C.1 | Implement real `numbering-tools.service.ts` (gap audit + manual override + void & replace) | สามารถ query ช่องว่างเลขที่ได้จริง | 253 EC-11 |
| 2C.2 | เขียน unit test สำหรับ numbering gap audit | ตรวจ missingNumbers ถูกต้อง | 253 FR-030 |
| 2C.3 | Implement real `orphan-cleanup.service.ts` (scan storage + purge) | สแกนไฟล์ขยะได้จริง + Redlock | 253 EC-12 |
| 2C.4 | เขียน unit test สำหรับ orphan scan + purge | ตรวจ Redlock ป้องกัน concurrent purge | 253 EC-12 |
| 2C.5 | Implement real `emergency-unlock.service.ts` (stuck lock detection + force release) | ตรวจ Redis SCAN หา stuck locks | 253 FR-030 |
| 2C.6 | เขียน unit test สำหรับ emergency unlock | ตรวจ force release + audit log | 253 FR-030 |

### 2D. Transmittal Service Coverage (Spec 253 FR-001, FR-012)

| ขั้นตอน | การกระทำ | ผลที่คาดหวาง | FR/Spec |
|---------|---------|-------------|---------|
| 2D.1 | เพิ่ม test case สำหรับ Transmittal cancel ที่มี items ผูกอยู่ | ยกเลิกเฉพาะ transmittal, ไม่กระทบ items | 253 EC-6, FR-008 |
| 2D.2 | เพิ่ม test case สำหรับ Transmittal metadata patch tier2 (status-dependent) | ปฏิเสธ tier2 ถ้าไม่ใช่ DRAFT/IN_REVIEW | 253 FR-012 |
| 2D.3 | เพิ่ม test case สำหรับ Transmittal hard-delete cascade | ลบเฉพาะ transmittals + transmittal_items | 253 FR-008 |

---

## 7. Phase 3: Integration Tests (P2 — End-to-end flow)

> **เป้าหมาย**: ทดสอบการไหลข้ามหลาย service — Cancel → Workflow Termination → Circulation Force-Close → Notification → Search Re-index

### 3A. Cancel Side Effects Pipeline (Spec 253 FR-025 to FR-029)

| ขั้นตอน | การกระทำ | ผลที่คาดหวาง | FR/Spec |
|---------|---------|-------------|---------|
| 3A.1 | Cancel Correspondence ที่มี Workflow instance + Circulation ผูกอยู่ | Workflow terminated + Circulation force-closed ใน transaction เดียวกัน | 253 FR-025 |
| 3A.2 | จำลอง Workflow termination ล้มเหลว | Cancel rollback ทั้งหมด (status ไม่เปลี่ยน) | 253 FR-025 |
| 3A.3 | Cancel สำเร็จ แล้วตรวจ Search re-index | BullMQ `SEARCH_REINDEX` job ถูก enqueue | 253 FR-028 |
| 3A.4 | Cancel สำเร็จ แล้วตรวจ Notification | BullMQ `notification` queue มี job (ไม่ inline) | 253 FR-029, ADR-008 |
| 3A.5 | ตรวจ response shape — มี `failedSideEffects` list | field ปรากฏ (empty ถ้าสำเร็จทั้งหมด) | 253 FR-027 |

### 3B. Hard-Delete Cascade (Spec 253 FR-008 to FR-011)

| ขั้นตอน | การกระทำ | ผลที่คาดหวาง | FR/Spec |
|---------|---------|-------------|---------|
| 3B.1 | Hard-Delete Correspondence ที่มีไฟล์แนบ + Qdrant vector | ไฟล์ + vectors + DB rows ถูกลบทั้งหมด | 253 FR-008 |
| 3B.2 | ตรวจ Redlock ถูก acquire ระหว่าง Hard-Delete | `lock:hard-delete:{publicId}` ปรากฏใน Redis | 253 FR-010 |
| 3B.3 | จำลอง Qdrant deletion ล้มเหลว | `pending_vector_deletions` มี record, response `PENDING_RETRY` | 253 FR-011 |
| 3B.4 | ตรวจ Qdrant deletion ใช้ `projectPublicId` filter | query มี filter `projectPublicId` (ไม่ cross-project) | ADR-023A |
| 3B.5 | Hard-Delete ที่ไฟล์ถูกลบไปแล้ว | ระบบข้ามไฟล์ที่ไม่มี, ลบ DB rows ต่อ | 253 EC-3 |

### 3C. Bulk Cancel with BullMQ (Spec 253 FR-019, FR-041)

| ขั้นตอน | การกระทำ | ผลที่คาดหวาง | FR/Spec |
|---------|---------|-------------|---------|
| 3C.1 | Bulk Cancel 5 รายการ (3 IN_REVIEW, 1 DRAFT, 1 CANCELLED) | กรอง CANCELLED ออก, ประมวลผล 4 รายการ | 253 FR-018 |
| 3C.2 | ตรวจ Redlock per item | `lock:bulk-cancel:{publicId}` ปรากฏต่อรายการ | 253 FR-041 |
| 3C.3 | ตรวจ BullMQ `bulk-operations` queue มี job | job ถูก enqueue + processed | 253 FR-019, ADR-008 |
| 3C.4 | ตรวจ progress polling | `GET /documents/bulk/cancel/:jobId/status` ส่ง progress ถูกต้อง | 253 FR-019 |
| 3C.5 | ตรวจ audit per item มี `bulkId` ร่วม | ทุกรายการมี `detailsJson.bulkId` เหมือนกัน | 253 FR-038 |
| 3C.6 | Bulk Cancel ที่ทุกรายการล้มเหลว | รายงาน failed ทั้งหมด, ไม่มี succeeded | 253 EC-4 |

### 3D. Metadata Patch Side Effects (Spec 253 FR-013, FR-015, FR-028)

| ขั้นตอน | การกระทำ | ผลที่คาดหวาง | FR/Spec |
|---------|---------|-------------|---------|
| 3D.1 | patchMetadata เปลี่ยน Subject + Tag | Audit Trail มี Before/After Diff | 253 FR-013, FR-036 |
| 3D.2 | ตรวจ Search re-index ถูก enqueue | BullMQ `SEARCH_REINDEX` job ปรากฏ | 253 FR-028 |
| 3D.3 | ตรวจ Notification ถูก enqueue (ไม่ inline) | BullMQ `notification` queue มี job | 253 FR-015, ADR-008 |
| 3D.4 | patchMetadata ไม่มีการเปลี่ยนแปลง | ไม่บันทึก Audit Trail, version ไม่เพิ่ม, response "No changes" | 253 EC-5 |

---

## 8. Phase 4: Performance Tests (P3 — Benchmark)

> **เป้าหมาย**: วัดประสิทธิภาพตาม Success Criteria

| ขั้นตอน | การกระทำ | ผลที่คาดหวาง | SC |
|---------|---------|-------------|-----|
| 4.1 | วัดเวลา DC cancel เอกสาร 1 ฉบับ (จากกด ⋯ ถึง Toast) | < 30 วินาที | SC-001 |
| 4.2 | วัดเวลา Superadmin hard-delete 1 ฉบบ (จากกด ลบถาวร ถึง Toast) | < 10 วินาที | SC-003 |
| 4.3 | วัดเวลา Bulk Cancel 100 รายการ | < 60 วินาที | SC-004 |
| 4.4 | วัด orphan file cleanup — สแกน + purge 100 ไฟล์ | สแกน < 10s, purge < 30s | SC-005 |
| 4.5 | วัด side-effect failure rate จาก 100 cancel operations | ≥ 95% สำเร็จ, retry ภายใน 5 นาที | SC-007 |
| 4.6 | วัด memory ระหว่าง Bulk Cancel 100 รายการ | ไม่เกิน 512MB เพิ่มขึ้น | — |

---

## 9. Phase 5: Security & RBAC Tests (P2)

> **เป้าหมาย**: ตรวจสอบความปลอดภัยตาม ADR-016, ADR-019, ADR-023A, ADR-008, ADR-007

### 5A. CASL RBAC — 4 Role Matrix (Spec 253 FR-005, FR-007, FR-031, FR-032)

| ขั้นตอน | การกระทำ | ผลที่คาดหวาง | FR/Spec |
|---------|---------|-------------|---------|
| 5A.1 | Viewer พยายาม `POST /correspondences/:uuid/cancel` | 403 Permission denied | 253 FR-005, ADR-016 |
| 5A.2 | DC พยายาม `DELETE /correspondences/:uuid` (hard-delete) | 403 (ต้องการ `system.manage_all`) | 253 FR-007 |
| 5A.3 | DC พยายาม `DELETE /rfas/:uuid/hard` | 403 | 253 FR-007 |
| 5A.4 | DC พยายาม `DELETE /transmittals/:uuid/hard` | 403 | 253 FR-007 |
| 5A.5 | DC พยายาม `DELETE /drawings/contract/:uuid/hard` | 403 | 253 FR-007 |
| 5A.6 | Org Admin พยายาม hard-delete | 403 (ต้องการ Superadmin) | 253 FR-007 |
| 5A.7 | Superadmin hard-delete สำเร็จ | 200 OK | 253 FR-007 |
| 5A.8 | Viewer พยายาม `PATCH /correspondences/:uuid/metadata` | 403 (ต้องการ `correspondence.edit_metadata`) | 253 FR-012 |
| 5A.9 | Viewer พยายาม `POST /documents/bulk/cancel` | 403 (ต้องการ `document.bulk_cancel`) | 253 FR-016 |
| 5A.10 | Viewer พยายามเข้า `/maintenance/numbering/gaps` | 403 (ต้องการ `system.numbering_override`) | 253 FR-031 |
| 5A.11 | Viewer พยายาม `POST /maintenance/emergency/bulk-hard-purge` | 403 (ต้องการ `system.emergency_unlock` + `system.manage_all`) | 253 FR-031 |
| 5A.12 | ตรวจ `system.manage_all` hierarchy fallback | Superadmin ทำได้ทุก action | 253 FR-033 |

### 5B. UUID Compliance (ADR-019)

| ขั้นตอน | การกระทำ | ผลที่คาดหวาง | FR/Spec |
|---------|---------|-------------|---------|
| 5B.1 | ตรวจทุก API response ใช้ `publicId` (UUIDv7) | ไม่มี INT `id` ใน response | ADR-019 |
| 5B.2 | grep หา `parseInt` ใน backend code ใหม่ | ไม่พบ `parseInt(.*uuid` | ADR-019 |
| 5B.3 | grep หา `id ?? ''` fallback ใน frontend code ใหม่ | ไม่พบ | ADR-019 |
| 5B.4 | ตรวจ frontend `DocumentActionConfig` ใช้ `publicId` เท่านั้น | ไม่มี `uuid` หรือ `id` field สำรอง | ADR-019 |

### 5C. AI Boundary (ADR-023A)

| ขั้นตอน | การกระทำ | ผลที่คาดหวาง | FR/Spec |
|---------|---------|-------------|---------|
| 5C.1 | ตรวจ Qdrant deletion ใน Hard-Delete ใช้ `projectPublicId` filter | query มี filter, ไม่ cross-project | ADR-023A |
| 5C.2 | ตรวจ Vector Sync re-embed ใช้ BullMQ `ai-batch` queue | ไม่เรียก Ollama โดยตรง | ADR-023A, ADR-008 |
| 5C.3 | ตรวจ `pending_vector_deletions` retry มี `projectPublicId` | record มี field สำหรับ filter | ADR-023A |

### 5D. Idempotency & Concurrency (Spec 253 FR-002, FR-014, FR-040, FR-041)

| ขั้นตอน | การกระทำ | ผลที่คาดหวาง | FR/Spec |
|---------|---------|-------------|---------|
| 5D.1 | ส่ง `POST /correspondences/:uuid/cancel` ซ้้าด้วย Idempotency-Key เดียวกัน | ระบบไม่ cancel ซ้ำ (idempotent) | ADR-016, 253 FR-002 |
| 5D.2 | ส่ง cancel โดยไม่มี `Idempotency-Key` header | ระบบปฏิเสธ (400 หรือ 422) | ADR-016 |
| 5D.3 | 2 DC กด Cancel เอกสารเดียวกันพร้อมกัน | คนแรกสำเร็จ, คนที่ 2 ได้รับ "เอกสารถูกยกเลิกแล้ว" | 253 EC-9, FR-002 |
| 5D.4 | patchMetadata ด้วย `expectedVersion` ผิด | 422 "Version mismatch" | 253 FR-014 |
| 5D.5 | Bulk Cancel พร้อมกัน 2 batch บนเอกสารเดียวกัน | Redlock ป้องกัน, คนที่ 2 รอหรือ fail | 253 FR-041 |

### 5E. Audit Trail Completeness (Spec 253 FR-035 to FR-038)

| ขั้นตอน | การกระทำ | ผลที่คาดหวาง | FR/Spec |
|---------|---------|-------------|---------|
| 5E.1 | ตรวจ Audit Trail หลัง Cancel | มี userId, timestamp, ipAddress, userAgent, action, entityId (publicId) | 253 FR-035 |
| 5E.2 | ตรวจ Audit Trail หลัง Metadata Patch | มี Before/After Diff | 253 FR-036 |
| 5E.3 | ตรวจ Audit Trail หลัง Hard-Delete | มี Snapshot (documentNumber, status, attachmentCount, vectorCount) | 253 FR-037 |
| 5E.4 | ตรวจ Audit Trail หลัง Bulk Cancel | แต่ละรายการมี `bulkId` ร่วม | 253 FR-038 |
| 5E.5 | ตรวจ Audit Trail หลัง Maintenance operations | มี audit log (orphan purge, force unlock) | 253 FR-035 |

### 5F. Error Handling (ADR-007, Spec 253 FR-044 to FR-046)

| ขั้นตอน | การกระทำ | ผลที่คาดหวาง | FR/Spec |
|---------|---------|-------------|---------|
| 5F.1 | พยายาม cancel โดยไม่มี reason | 422 Validation error + userMessage ภาษาไทย | 253 FR-044, ADR-007 |
| 5F.2 | พยายาม cancel เอกสาร CANCELLED แล้ว | 422 + actionable message + recoveryAction | 253 FR-044, FR-045 |
| 5F.3 | จำลอง System Error (DB down) | 500 + generic "try again" + full stack ใน log | 253 FR-044, ADR-007 |
| 5F.4 | Bulk Cancel ที่มี partial failure | 200 + `failedSideEffects` list + summary dialog | 253 FR-044, FR-046 |
| 5F.5 | ตรวจ error response ไม่ expose technical details | ไม่มี stack trace ใน userMessage | ADR-007 |

### 5G. Permission Mapping Verification (Spec 253 FR-034, FR-049)

| ขั้นตอน | การกระทำ | ผลที่คาดหวาง | FR/Spec |
|---------|---------|-------------|---------|
| 5G.1 | ตรวจ `seed-permissions.sql` — DC ไม่มี `correspondence.delete` | DC role ไม่มี hard-delete permission | 253 FR-049 |
| 5G.2 | ตรวจ DC ไม่มี `rfa.delete`, `transmittal.delete`, `drawing.delete` | ไม่มีใน DC role mapping | 253 FR-049 |
| 5G.3 | ตรวจ RFA/Transmittal/Drawing hard-delete มี `system.manage_all` fallback | fallback ทำงานเมื่อ Superadmin เรียก | 253 FR-034 (gap) |

---

## 10. ไฟล์ทดสอบสรุป

| Phase | ไฟล์ test ที่ต้องสร้าง/เพิ่ม | จำนวน test cases |
|-------|---------------------------|-----------------|
| Phase 1 (Browser E2E) | `frontend/e2e/document-actions.spec.ts` (ใหม่ — ต้องตั้ง Playwright infra) | ~40 cases (1A-1G) |
| Phase 2 (Backend Unit) | `backend/src/modules/document/document.controller.spec.ts` (ใหม่) | ~6 cases (2A) |
| Phase 2 (Backend Unit) | `backend/src/modules/maintenance/maintenance.controller.spec.ts` (ใหม่) | ~5 cases (2B) |
| Phase 2 (Backend Unit) | `backend/src/modules/maintenance/services/*.spec.ts` (เพิ่ม — หลัง implement real backend) | ~6 cases (2C) |
| Phase 2 (Backend Unit) | `backend/src/modules/transmittal/transmittal.service.spec.ts` (เพิ่ม) | ~3 cases (2D) |
| Phase 2 (Frontend Unit) | `frontend/components/documents/__tests__/*.test.tsx` (ใหม่ — 7 files) | ~21 cases |
| Phase 2 (Frontend Unit) | `frontend/hooks/__tests__/use-document-actions.test.ts` (ใหม่) | ~3 cases |
| Phase 2 (Frontend Unit) | `frontend/hooks/__tests__/use-bulk-actions.test.ts` (ใหม่) | ~3 cases |
| Phase 3 (Integration) | `backend/test/document-side-effects.integration.spec.ts` (ใหม่) | ~15 cases (3A-3D) |
| Phase 4 (Performance) | `backend/test/document-actions.benchmark.spec.ts` (ใหม่) | ~6 cases |
| Phase 5 (Security) | `backend/test/document-actions.security.spec.ts` (ใหม่) | ~30 cases (5A-5G) |
| **รวม** | | **~138 test cases** |

---

## 11. ลำดับการทำ (Execution Order)

```
1. ตั้งค่า Playwright E2E infra (frontend/e2e/ + playwright.config.ts)
   ↓
2. Phase 1: Browser E2E (1A → 1B → 1C → 1D → 1E → 1F → 1G)
   ↓
3. Phase 2: Backend Unit (2A → 2B → 2D) — ปิด controller gap
   ↓
4. Phase 2: Frontend Unit (component + hook tests)
   ↓
5. Phase 3: Integration (3A → 3B → 3C → 3D)
   ↓
6. Phase 5: Security & RBAC (5A → 5B → 5C → 5D → 5E → 5F → 5G)
   ↓
7. Phase 2C: Maintenance real backend + tests (ต้อง implement ก่อน)
   ↓
8. Phase 4: Performance benchmark
```

**แนะนำ**: ทำ Phase 1 ก่อนเพราะเป็น P1 และตรวจได้ครอบคลุมที่สุด จากนั้น Phase 2 + 5 คู่กันเพื่อปิด coverage + security gap

---

## 12. เกณฑ์ผ่าน (Acceptance Criteria)

| เกณฑ์ | เป้าหมาย | วิธีวัด |
|------|---------|--------|
| Backend coverage (Feature 253 scope) | ≥ 80% stmts | `pnpm --filter backend test:cov` |
| Frontend coverage (Feature 253 components) | ≥ 80% stmts | `pnpm --filter lcbp3-frontend test:coverage` |
| Browser E2E pass rate | 100% (0 fail) | Playwright run |
| RBAC test pass | 100% (ทุก role ตรง matrix) | Security spec |
| UUID compliance | 0 `parseInt(uuid)`, 0 `id ?? ''` | grep + ESLint |
| Audit Trail completeness | 100% (ทุก action มี audit) | DB query |
| Performance SC-001 | Cancel < 30s | Benchmark |
| Performance SC-003 | Hard-Delete < 10s | Benchmark |
| Performance SC-004 | Bulk 100 < 60s | Benchmark |
| Side-effect success rate | ≥ 95% (SC-007) | Log analysis |

---

## 13. ความเสี่ยงและการจัดการ

| ความเสี่ยง | ผลกระทบ | การจัดการ |
|-----------|--------|----------|
| Playwright infra ไม่มี — ทำ Phase 1 ไม่ได้ | สูง — ไม่สามารถทดสอบ UI จริงได้ | ตั้งค่า Playwright ก่อนเริ่ม Phase 1 (ใช้ skill `e2e-testing`) |
| Maintenance services เป็น skeleton — ทดสอบได้จำกัด | กลาง — Phase 1E + 2C ไม่สมบูรณ์ | Implement real backend ก่อน (ใช้ skill `107-speckit-implement`) หรือ mark as known gap |
| E2E specs ต้องการ test DB + Redis | กลาง — Phase 3 ต้อง setup | ใช้ `backend/test/jest-e2e.json` + test DB seed |
| FR-034 gap (RFA/Transmittal/Drawing ไม่มี `system.manage_all` fallback) | กลาง — Superadmin อาจทำ hard-delete ไม่ได้ | แก้ใน `*.controller.ts` ก่อน test Phase 5A |
| Bulk operations in-memory store (ไม่ BullMQ จริง) | ต่ำ — ทดสอบได้แต่ไม่ reflect production | ตรวจว่า BullMQ processor ทำงานจริง (CP-019 แล้ว) |
| Frontend overall coverage 52% (ต่ำกว่า 80%) | ต่ำ — pre-existing ไม่ใช่ Feature 253 | ทำ Feature 253 component tests ให้ครบก่อน, ปิด tech-debt แยก PR |

---

## 14. งานที่เกี่ยวข้อง (Cross-Reference)

| สเปค / Skill | ความสัมพันธ์ |
|---------------|-------------|
| `109-speckit-tester` | รัน test ตามแผนนี้ — handoff ไป |
| `e2e-testing` | ใช้ Playwright patterns สำหรับ Phase 1 |
| `check-real-app` | ใช้สำหรับ browser verify จริงใน Phase 1 |
| `112-speckit-security-audit` | ใช้สำหรับ Phase 5 (Security & RBAC) |
| `verification-loop` | ลูปตรวจสอบ 6 ขั้น (build → typecheck → lint → test → security → diff) |
| `111-speckit-validate` | validate implementation ตาม spec (หลัง test pass) |
| `201-transmittals-circulation` | Transmittal/Circulation base — ทดสอบร่วม |
| `202/203/249` (Workflow Engine) | Cancel ยุติ workflow — ทดสอบ integration |
| `204-rfa-approval-refactor` | RFA cancel + metadata patch — ทดสอบร่วม |
| `migration-admin-unified-test-plan.md` | Migration commit เรียก Correspondence creation API — ทดสอบร่วม |
