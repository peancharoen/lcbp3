# ADR-021: Integrated Workflow Context & Step-specific Attachments

## 1. ข้อมูลทั่วไป (General Information)
- **Status:** Proposed
- **Version:** 1.8.6
- **Date:** 2026-04-12
- **Author:** Senior Full Stack Developer (Windsurf AI)
- **Reference:** ADR-001 (Workflow Engine), ADR-002 (Redlock), ADR-016 (Security)

---

## Clarifications

### Session 2026-04-12
- **Q:** What are the file size and attachment count limits per workflow step? → **A:** No explicit limit (controlled by infrastructure only)
- **Q:** What are the specific values and storage format for the "Priority" field in the Integrated Banner? → **A:** Enum "URGENT", "HIGH", "MEDIUM", "LOW" — 4-tier system with visual indicators
- **Q:** How should the system handle virus/malware detection during step-specific file upload? → **A:** Block upload immediately, delete temp file, show error "File rejected" to user
- **Q:** What is the cache TTL for Workflow History data to reduce join query overhead? → **A:** 1 hour — balanced cache duration for workflow history data
- **Q:** Who is authorized to upload step-specific attachments during a workflow transition? → **A:** Only assigned handler can upload; superadmin and organization admin can upload on behalf (impersonation)

### Session 2026-04-19
- **Q:** สถานะ Workflow ใดบ้างที่อนุญาตให้อัปโหลด Step-specific Attachment ได้? → **A:** เฉพาะสถานะ Active-decision เท่านั้น (`PENDING_REVIEW`, `PENDING_APPROVAL`) — ห้ามอัปโหลดในสถานะ Terminal (`APPROVED`, `REJECTED`, `CLOSED`)
- **Q:** หาก Redis Redlock ล้มเหลวระหว่าง Transition ระบบควรทำอย่างไร? → **A:** Fail-closed — Retry 3 ครั้ง (500ms exponential backoff) แล้ว throw HTTP 503 "Service temporarily unavailable" เพื่อรักษาความถูกต้องของข้อมูล
- **Q:** Module ใดบ้างที่ต้องรองรับ Step-specific Attachments ใน v1.8.6? → **A:** เฉพาะ Module ที่ผ่าน Workflow Engine: **RFA, Transmittal, Circulation** — ไม่รวม Correspondence (ใช้ Circulation เป็น vehicle อยู่แล้ว หลีกเลี่ยงซ้ำซ้อน)
- **Q:** Performance target ของ Upload + Transition API คืออะไร? → **A:** P95 ≤ 5 วินาที สำหรับ file ≤ 10MB (ClamAV scan + Redlock + DB transaction included)
- **Q:** Definition of Done สำหรับ REQ-01 ถึง REQ-06 คืออะไร? → **A:** กำหนด Observable Outcome 1 ประโยคต่อ REQ ที่ตรวจสอบได้โดย QA/Product Owner โดยไม่ต้องอ่าน code

---

## 2. บริบทและความสำคัญ (Context & Problem Statement)
ในเวอร์ชันปัจจุบัน (v1.8.5) ระบบ DMS ประสบปัญหาด้าน User Experience และ Data Traceability ใน 2 จุดหลัก:
1. **Context Fragmentation:** ข้อมูลเอกสารและหน้าจอควบคุม Workflow แยกออกจากกัน ทำให้ Reviewer/Approver ต้องสลับหน้าจอไปมาเพื่อตรวจสอบข้อมูลก่อนตัดสินใจ
2. **Generic Attachments:** ไฟล์แนบถูกเก็บรวมไว้ที่ระดับตัวเอกสารหลัก (Root Document) ทำให้ไม่สามารถระบุได้ว่าไฟล์ใดถูกเพิ่มเข้ามาเพื่อประกอบการตัดสินใจในขั้นตอน (Step) ใดเป็นพิเศษ

---

## 3. การตัดสินใจเชิงสถาปัตยกรรม (Architecture Decision)

เราจะเปลี่ยนไปใช้แนวทาง **Integrated Contextual Workflow** โดยมีรายละเอียดดังนี้:

### 3.1 Status Banner Integration
- ยุบรวม Metadata ที่สำคัญของเอกสาร (Doc No, Subject, Initiator, Priority) ไว้ใน Header เดียวกันกับส่วนแสดงสถานะ (Status) และปุ่มดำเนินการ (Actions)
- เพื่อให้ผู้ใช้งานเห็น "บริบททั้งหมด" ในแถวสายตาเดียว (Single Row Visibility)

### 3.2 Workflow Lifecycle Visualization
- แสดงขั้นตอนทั้งหมด (Full Path) ในรูปแบบ Vertical Timeline ภายใน Tab
- **Active Highlighting:** ขั้นตอนปัจจุบันต้องใช้สีเด่น (Indigo) และ Animation (Pulse) เพื่อระบุตำแหน่งงาน
- **Completed/Pending States:** ขั้นตอนที่ผ่านมาแล้วและในอนาคตต้องมี Visual State ที่แตกต่างกันอย่างชัดเจน

### 3.3 Step-specific Attachments & Preview
- **Linked Data:** ปรับปรุง Schema ให้ไฟล์แนบสามารถเชื่อมโยงกับ `workflow_history` ได้
- **Contextual Upload:** อนุญาตให้อัปโหลดไฟล์ได้ "เฉพาะ" ในขั้นตอนที่กำลังดำเนินการอยู่ (Active Step) เท่านั้น
- **Unified Preview:** สร้างระบบ Preview Modal กลางที่เรียกดูไฟล์ได้จากทุกจุดโดยไม่ต้องเปลี่ยนหน้า

---

## 4. รายละเอียดความต้องการ (Functional Requirements)

| ID | Feature | Description |
| :--- | :--- | :--- |
| REQ-01 | **Integrated Banner** | แสดง ID, Status, Priority (`URGENT`/`HIGH`/`MEDIUM`/`LOW` พร้อม visual indicators) และปุ่ม Approve/Reject ไว้ในแถบด้านบนสุด |
| REQ-02 | **Step Detail View** | ใน Tab Workflow Engine ต้องแสดงรายละเอียด Role, Handler และ Description ของทุกขั้นตอน |
| REQ-03 | **Active Step Color** | ขั้นตอนปัจจุบันใช้สี Indigo (#6366f1) พร้อม Pulse effect |
| REQ-04 | **Step-safe Upload** | รองรับการลากวางไฟล์ (Drag & Drop) เพื่อแนบหลักฐานประจำขั้นตอนนั้นๆ — **อนุญาตเฉพาะสถานะ `PENDING_REVIEW` และ `PENDING_APPROVAL` เท่านั้น** สถานะ Terminal (`APPROVED`, `REJECTED`, `CLOSED`) ไม่อนุญาต |
| REQ-05 | **Internal Preview** | คลิกดูไฟล์ PDF/Images ได้ทันทีผ่าน Modal ภายในระบบ |
| REQ-06 | **i18n Support** | ทุก UI text ต้องใช้ i18n keys ตาม `05-08-i18n-guidelines.md` |

---

## 5. ข้อกำหนดทางเทคนิค (Technical Requirements - Tier 1 Critical)

1. **Database Consistency:** ต้องเพิ่ม `workflow_history_id` ในตาราง `attachments` โดยรักษาค่าเป็น Nullable สำหรับไฟล์หลัก (Main Docs)
2. **Concurrency Control:**
   - **Transition Lock:** ใช้ Redis Redlock เมื่อมีการเปลี่ยนสถานะพร้อมอัปโหลดไฟล์ (Two-Phase: Lock → Upload + Transition → Unlock) — หาก Lock ไม่สำเร็จ: Retry 3 ครั้ง (500ms exponential backoff) แล้ว Fail-closed (HTTP 503)
   - **File Upload:** ใช้ Temp Storage ก่อน (ADR-016 Two-Phase Upload) แล้วย้ายไป Permanent หลัง Transition สำเร็จ
3. **Security Audit:** ทุกไฟล์แนบราย Step ต้องผ่านการสแกน **ClamAV** และบันทึกข้อมูล Who/When ลงใน Audit Log (ADR-016)
4. **Identifier Strategy:** อ้างอิงไฟล์ผ่าน **UUIDv7** (publicId) เท่านั้น ห้ามใช้ ID ที่เป็น Integer ใน API (ADR-019)
5. **Database Indexing:** ต้องสร้าง Index บน `(workflow_history_id, created_at)` สำหรับตาราง `attachments` เพื่อ optimize การดึงไฟล์แนบตาม Step
6. **i18n Support:** ทุก UI text ต้องใช้ i18n keys ตาม `05-08-i18n-guidelines.md`
7. **File Size Limits:** ไม่กำหนด Limit ที่ Application Layer — ควบคุมโดย Infrastructure (Reverse Proxy / Storage Config) เท่านั้น
8. **Idempotency Control:** ทุกการอัปโหลดไฟล์พร้อม Transition ต้องมีการตรวจสอบ `Idempotency-Key` header (per .windsurfrules Security Rule #1)
9. **Async Event Processing:** Notifications และ Events จาก workflow transitions ต้องใช้ **BullMQ** queue (ADR-008) — ห้าม inline ใน Service
10. **Performance SLA:** `POST /workflow/:uuid/transition` (พร้อม file) ต้องตอบสนองภายใน **P95 ≤ 5 วินาที** สำหรับไฟล์ขนาด ≤ 10MB (รวม ClamAV scan + Redlock + DB transaction)

---

## 5.1 Idempotency & Duplicate Prevention

| Mechanism | Implementation |
|-----------|----------------|
| **Idempotency-Key** | ทุก `POST/PUT` สำหรับ upload + transition ต้องส่ง header `Idempotency-Key` (UUID) |
| **Redis Store** | เก็บ key mapping `(idempotency_key, user_id)` → response (TTL: 24 ชั่วโมง) |
| **Duplicate Detection** | หาก key ซ้ำ → return cached response (201/200) ไม่ทำซ้ำ |

---

## 5.2 กรณีขอบเขตและการจัดการข้อผิดพลาด (Edge Cases & Error Handling)

| Scenario | Behavior |
|----------|----------|
| **ClamAV ตรวจพบไวรัส/มัลแวร์** | Block upload ทันที, ลบ temp file, แสดง error "File rejected" แก่ user |
| **Upload ไฟล์ระหว่าง Transition ล้มเหลว** | Rollback transaction ทั้งหมด, ลบ temp files, คงสถานะ workflow เดิม |
| **ไฟล์ถูกลบจาก Storage หลัง Attach** | แสดง "File unavailable" ใน UI, บันทึก metadata ไว้ตามเดิม |
| **Concurrent Transition พร้อม Upload** | Redis Redlock จัดการ queue, อนุญาตเพียง 1 transition พร้อมกัน |
| **Redis Redlock ล้มเหลว / Redis ล่ม** | Retry 3 ครั้ง (500ms exponential backoff) — หากยังล้มเหลว throw HTTP 503 "Service temporarily unavailable" (Fail-closed, ห้าม Fail-open) |
| **Invalid File Type** | Reject ตั้งแต่ client-side (whitelist: PDF, DOCX, XLSX, DWG, ZIP) |
| **Unauthorized Upload Attempt** | ตรวจสอบสิทธิ์: เฉพาะ assigned handler, superadmin, หรือ org admin เท่านั้น |
| **Upload ในสถานะ Terminal** | Reject ทันทีด้วย HTTP 409 — ไม่อนุญาตอัปโหลดเมื่อสถานะเป็น `APPROVED`, `REJECTED`, หรือ `CLOSED` |
| **Duplicate Upload (Network Retry)** | ตรวจสอบ `Idempotency-Key` — reject duplicate พร้อม return existing result |
| **Cache Stale Data** | Invalidate Redis Cache ทันทีเมื่อ workflow state เปลี่ยน (TTL override)

---

## 6. รายการไฟล์ที่ต้องอัพเดท (Impacted Files)

### 🔴 Backend Layer (Data & Logic)
- `specs/03-Data-and-Storage/lcbp3-v1.8.0-schema-02-tables.sql`
  - *Action:* เพิ่ม FK `workflow_history_id` ในตาราง `attachments`
- `backend/src/common/file-storage/entities/attachment.entity.ts`
  - *Action:* เพิ่ม Relation `@ManyToOne(() => WorkflowHistory)`
- `backend/src/modules/workflow-engine/entities/workflow-history.entity.ts`
  - *Action:* เพิ่ม Relation `@OneToMany(() => Attachment)`
- `backend/src/modules/workflow-engine/workflow-engine.service.ts`
  - *Action:* ปรับปรุง Method `transition()` ให้รองรับการรับไฟล์แนบ (Array of Files)
- `backend/src/modules/workflow-engine/dto/workflow-transition.dto.ts`
  - *Action:* เพิ่ม Field สำหรับรับ Metadata ของไฟล์ที่อัปโหลด และ `Idempotency-Key` header
- `backend/src/modules/workflow-engine/guards/workflow-transition.guard.ts` (สร้างใหม่)
  - *Action:* Implement **CASL Guard** สำหรับ 4-Level RBAC: Superadmin > Org Admin > Assigned Handler > Read-only

### 🟡 Frontend Layer (UI & Interaction)
- `frontend/app/(dashboard)/rfas/[uuid]/page.tsx`
  - *Action:* Refactor Header เป็น Integrated Banner และเพิ่ม Tab Workflow Lifecycle
- `frontend/app/(dashboard)/transmittals/[uuid]/page.tsx`
  - *Action:* Refactor Header เป็น Integrated Banner และเพิ่ม Tab Workflow Lifecycle
- `frontend/app/(dashboard)/circulation/[uuid]/page.tsx`
  - *Action:* Refactor Header เป็น Integrated Banner และเพิ่ม Tab Workflow Lifecycle
- **หมายเหตุ (Out of Scope v1.8.6):** `correspondences/[uuid]/page.tsx` — ไม่รวมใน Scope นี้ Correspondence ใช้ Circulation เป็น Routing Vehicle อยู่แล้ว
- `frontend/components/workflow/workflow-visualizer.tsx` (สร้างใหม่)
  - *Action:* พัฒนาการแสดงผล Vertical Timeline พร้อมระบบสี Active/Inactive
- `frontend/components/common/file-preview-modal.tsx` (สร้างใหม่)
  - *Action:* พัฒนาคอมโพเนนต์ Modal สำหรับจำลอง PDF Viewer
- `frontend/hooks/use-workflow-action.ts` (สร้างใหม่)
  - *Action:* จัดการ State การอัปโหลดไฟล์และการยิง API Transition พร้อมกัน
- `frontend/types/workflow.ts`
  - *Action:* อัปเดต Interface ให้รองรับ `attachments` ภายในแต่ละ `WorkflowStep`

---

## 7. 🔍 Impact Analysis

| Component | Level | Impact Description | Required Action |
|-----------|-------|-------------------|-----------------|
| **Backend** | 🔴 High | เพิ่ม FK `workflow_history_id` และ Entity Relations ใหม่ | Update `attachment.entity.ts`, `workflow-history.entity.ts`, Schema SQL |
| **Database** | 🔴 High | Schema migration เพิ่ม column และ index | Run SQL delta, สร้าง Index |
| **Frontend** | 🟡 Medium | Refactor Detail Pages, สร้าง Workflow Visualizer | Update Page Components, สร้างใหม่ 3 ไฟล์ |
| **API** | 🟡 Medium | DTO changes รองรับ file metadata | Update `workflow-transition.dto.ts` |
| **Workflow Engine** | 🟡 Medium | ปรับปรุง `processTransition()` รองรับ attachments | Update `workflow-engine.service.ts` |

---

## 8. Migration Strategy

- **Existing Attachments:** ไฟล์แนบที่มีอยู่แล้วจะมี `workflow_history_id = NULL` (ถือเป็น Main Document attachments)
- **New Attachments:** ไฟล์แนบใหม่ที่อัปโหลดพร้อม Transition จะถูกเชื่อมโยงกับ `workflow_history` ของ Step นั้น
- **Rollback Plan:** หากการ migrate มีปัญหา สามารถตั้ง `workflow_history_id = NULL` กลับได้ทั้งหมด (Nullable FK)

---

## 9. ผลกระทบ (Consequences)
- **Positive:** เพิ่มความน่าเชื่อถือของข้อมูล (Data Integrity) และลดระยะเวลาในการอนุมัติเอกสาร
- **Negative:** เพิ่มความซับซ้อนในการ Join ตารางระหว่างการดึงข้อมูลประวัติและไฟล์แนบ — **Mitigation:** ใช้ Redis Cache สำหรับ Workflow History (TTL: 1 ชั่วโมง) พร้อม **Cache Invalidation** เมื่อ state เปลี่ยน

---

## 9.1 Testing Requirements (Tier 2 - Important)

ตาม .windsurfrules Tier 2 ต้องมี:
- **Business Logic Coverage:** 80%+ (Workflow transition logic, RBAC checks, file upload validation)
- **Backend Overall Coverage:** 70%+
- **Frontend Component Tests:** สำหรับ Integrated Banner, Workflow Visualizer, File Preview Modal
- **E2E Tests:** สำหรับ complete workflow พร้อม file upload

### Definition of Done (Observable Outcomes)

| REQ | Done When |
|-----|-----------|
| **REQ-01** | Banner แสดง Doc No, Status, Priority badge และปุ่ม Approve/Reject ก่อนเนื้อหาเอกสารในทุก Module (RFA, Transmittal, Circulation) |
| **REQ-02** | Tab "Workflow Engine" แสดง Role + Handler + Description ครบทุก Step โดยไม่ต้อง reload หน้า |
| **REQ-03** | Step ปัจจุบันใช้สี Indigo (#6366f1) พร้อม CSS Pulse animation ที่มองเห็นได้ชัดเจน; Step อื่นๆ ไม่มี animation |
| **REQ-04** | Drag & Drop ทำงานเฉพาะเมื่อ Status = `PENDING_REVIEW`/`PENDING_APPROVAL`; ปุ่มถูก disable เมื่อ Status = `APPROVED`/`REJECTED`/`CLOSED` |
| **REQ-05** | คลิกไฟล์ PDF/Image ใดก็ตามเปิด Preview Modal แบบ In-browser โดยไม่ navigate ออกจากหน้าปัจจุบัน |
| **REQ-06** | ไม่มี Hardcoded text ใน Component ใหม่; ทุก label ต้องเปลี่ยนภาษาได้เมื่อ switch EN/TH |

---

## 10. Compliance

เป็นไปตาม:
- [Backend Guidelines](../05-Engineering-Guidelines/05-02-backend-guidelines.md) - NestJS patterns, TypeORM relations
- [Frontend Guidelines](../05-Engineering-Guidelines/05-03-frontend-guidelines.md) - React/Next.js patterns
- [i18n Guidelines](../05-Engineering-Guidelines/05-08-i18n-guidelines.md) - การรองรับหลายภาษา
- [Testing Strategy](../05-Engineering-Guidelines/05-04-testing-strategy.md) - Coverage goals

---

## 11. Related ADRs

- [ADR-001: Unified Workflow Engine](./ADR-001-unified-workflow-engine.md) - พื้นฐาน Workflow Engine ที่ ADR-021 ขยายต่อ
- [ADR-002: Document Numbering Strategy](./ADR-002-document-numbering-strategy.md) - Redis Redlock สำหรับ Concurrency Control
- [ADR-016: Security and Authentication](./ADR-016-security-authentication.md) - ClamAV, Audit Log, Two-Phase Upload
- [ADR-019: Hybrid Identifier Strategy](./ADR-019-hybrid-identifier-strategy.md) - UUIDv7 / publicId ใช้ใน API

---

## 12. 📋 Version Dependency Matrix

| ADR | Version | Dependency Type | Affected Version(s) | Implementation Status |
|-----|---------|-----------------|---------------------|----------------------|
| **ADR-021** | 1.8.6 | Core | v1.8.6+ | 🔄 Proposed |
| **ADR-001** | 1.0 | Required By | v1.8.6+ | ✅ Active |
| **ADR-002** | 1.0 | Uses | v1.8.6+ | ✅ Active |
| **ADR-016** | 1.0 | Security | v1.8.6+ | ✅ Active |
| **ADR-019** | 1.0 | Identifier | v1.8.6+ | ✅ Active |

### Version Compatibility Rules

- **Minimum Version:** v1.8.6 (ADR-021 มีผลบังคับใช้)
- **Breaking Changes:** มี (Schema changes, API DTO changes)
- **Deprecation Timeline:** ไม่มี (Feature addition)

---

## 13. 🔄 Review Cycle & Maintenance

### Review Schedule
- **Next Review:** 2026-10-12 (6 months from creation)
- **Review Type:** Scheduled (Architecture Decision Review)
- **Reviewers:** System Architect, Development Team Lead, Product Owner

### Review Checklist
- [ ] การ implement ครบถ้วนตาม requirements (REQ-01 ถึง REQ-06)
- [ ] Database migration สำเร็จและ performance อยู่ในเกณฑ์ที่ยอมรับได้
- [ ] Frontend components ผ่าน UI/UX review
- [ ] มีปัญหา Integration กับ Module อื่นหรือไม่
- [ ] ต้องการ Update DSL structure หรือไม่

### Version History
| Version | Date | Changes | Status |
|---------|------|---------|--------|
| 1.8.6 | 2026-04-12 | Initial version - Integrated Workflow Context & Step-specific Attachments | 🔄 Proposed |
