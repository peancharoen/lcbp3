# Feature Specification: ADR-049 Workflow State Machine Consolidation & RFA Multi-Party Approval

**Feature Branch**: `249-adr-049-workflow-state-machine`
**Created**: 2026-08-28
**Status**: Draft
**Input**: User description: "Workflow Engine — refactor logic state/approval (การเปลี่ยนสถานะเอกสาร + flow อนุมัติ Draft → Submitted → Under Review → Approved / Approved with Comments / Rejected) ที่กระจายอยู่หลาย service ให้เป็น state machine เดียวที่ทดสอบได้"
**Related ADR**: [ADR-049: Workflow Engine State Machine Consolidation](../../06-Decision-Records/ADR-049-workflow-state-machine-consolidation.md)

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Unified RFA Multi-Party Approval Flow (Priority: P1)

ผู้จัดการโครงการส่ง RFA เข้าระบบ ระบบนำเข้าสถานะ CONSULTANT_REVIEW โดยอัตโนมัติ จากนั้น CONSULTANT เลือกได้ว่าจะ CONSENT_FOR_APPROVE (ส่งต่อ OWNER), ASK_DESIGNER (สอบถาม DESIGNER), RESUBMIT (สั่งแก้ไข), หรือ REJECT ถ้า CONSULTANT เลือก ASK_DESIGNER ระบบนำเข้า DESIGNER_REVIEW และ DESIGNER ตอบกลับ CONSULTANT ด้วย AGREED/AGREED_WITH_COMMENTS/NO_OBJECTION/OBJECTED เมื่อ CONSULTANT CONSENT_FOR_APPROVE ระบบนำเข้า OWNER_APPROVAL และ OWNER เลือก APPROVE/APPROVE_WITH_COMMENTS/RESUBMIT/REJECT ทุก transition ถูกควบคุมโดย state machine เดียวใน DSL

**Why this priority**: เป็นแก่นของ ADR-049 — รวม logic ที่กระจาย 7 จุดให้เป็น state machine เดียวที่ test ได้ โดยไม่ต้องแก้ทีละ service

**Independent Test**: ส่ง RFA ใหม่เข้าระบบ แล้วเดินตาม flow ครบทุกระยะ (CONSULTANT → OWNER → APPROVED) โดยตรวจว่า state/history/approve code/status projection ถูกต้องทุกจุด

**Acceptance Scenarios**:

1. **Given** RFA ใหม่ในสถานะ DRAFT, **When** Editor กด SUBMIT, **Then** ระบบนำเข้า CONSULTANT_REVIEW พร้อม status projection `rfa = FRE` และบันทึก history
2. **Given** RFA ใน CONSULTANT_REVIEW, **When** CONSULTANT เลือก CONSENT_FOR_APPROVE, **Then** ระบบนำเข้า OWNER_APPROVAL พร้อม status projection `rfa = FAP`
3. **Given** RFA ใน CONSULTANT_REVIEW, **When** CONSULTANT เลือก ASK_DESIGNER, **Then** ระบบนำเข้า DESIGNER_REVIEW (ไม่ใช่ condition อัตโนมัติ — เป็น human decision)
4. **Given** RFA ใน DESIGNER_REVIEW, **When** DESIGNER เลือก AGREED, **Then** ระบบนำกลับ CONSULTANT_REVIEW
5. **Given** RFA ใน OWNER_APPROVAL, **When** OWNER เลือก APPROVE, **Then** ระบบนำเข้า APPROVED (terminal) พร้อม approve code `1` และ status projection `rfa = FCO`
6. **Given** RFA ใน OWNER_APPROVAL, **When** OWNER เลือก APPROVE_WITH_COMMENTS, **Then** ระบบนำเข้า APPROVED_WITH_COMMENTS (terminal) พร้อม approve code `2`
7. **Given** RFA ใน OWNER_APPROVAL, **When** OWNER เลือก REJECT, **Then** ระบบนำเข้า REJECTED (terminal) พร้อม approve code `4` และ status projection `rfa = CC`

---

### User Story 2 - DSL-Owned Status Projection (Priority: P1)

ทุกครั้งที่ state เปลี่ยน Engine เขียน status code ของ module ลง entity column โดยตรงจาก `statusProjection` ใน DSL โดยไม่ต้องมี `statusMap` dict แยกในแต่ละ module service (RFA/Circulation/Correspondence/Transmittal)

**Why this priority**: ฆ่า drift ระหว่าง state กับ status — ปัจจุบันมี statusMap 4 ชุดที่กระจายและไม่ test ได้ในฐานะ data

**Independent Test**: ส่ง RFA ผ่านทุก transition แล้วตรวจว่า `rfa_revisions.status_code` ถูกต้องทุกจุดโดยไม่มี code ใน `RfaService.syncRevisionStatus` อีก

**Acceptance Scenarios**:

1. **Given** RFA ใน DRAFT, **When** SUBMIT, **Then** `rfa_revisions.status_code = DFT` ก่อน transition และ `FRE` หลัง transition (Engine เขียนจาก DSL)
2. **Given** Circulation ใน DRAFT, **When** START, **Then** `circulations.status = OPEN` ก่อน transition และ `IN_REVIEW` หลัง transition
3. **Given** Correspondence ใน DRAFT, **When** SUBMIT, **Then** `correspondences.status_code = DRAFT` ก่อน transition และ `SUBOWN` หลัง transition
4. **Given** ลบ `statusMap` dict ในทุก module service, **When** รัน test, **Then** status ยังถูกต้องเพราะ Engine เขียนจาก DSL

---

### User Story 3 - Approve Code Scheme & Consent Reasons (Priority: P1)

OWNER เลือก approve code จาก scheme ใหม่ (1=APPROVED, 2=APPROVED_WITH_COMMENTS, 3=REVISE_REQUIRED, 4=REJECTED) โดย code ผูกกับ transition ใน DSL ส่วน CONSULTANT consent reason เก็บแยกในตาราง `rfa_consent_reasons` เป็น metadata ไม่มีผลต่อ state

**Why this priority**: แยก concept ที่ผสมกัน (action vocabulary vs consent reason) ออกจากกัน ทำให้ validation ถูกต้องและ audit ชัดเจน

**Independent Test**: ส่ง RFA ผ่าน flow แล้วตรวจว่า `rfa_revisions.rfa_approve_code_id` ถูกต้องตาม transition และ consent reason ถูกต้องตามที่ CONSULTANT เลือก

**Acceptance Scenarios**:

1. **Given** RFA ใน OWNER_APPROVAL, **When** OWNER เลือก APPROVE, **Then** `rfa_approve_code_id` ชี้ไป code `1` (APPROVED)
2. **Given** RFA ใน OWNER_APPROVAL, **When** OWNER เลือก APPROVE_WITH_COMMENTS, **Then** `rfa_approve_code_id` ชี้ไป code `2`
3. **Given** RFA ใน CONSULTANT_REVIEW, **When** CONSULTANT เลือก CONSENT_FOR_APPROVE พร้อม consent reason "No objection to design", **Then** `rfa_consent_reasons` บันทึก reason แต่ `rfa_approve_code_id` ยังเป็น NULL (consent ไม่กำหนด approve code)
4. **Given** approve code `5N` (No Further Action) ใน schema เดิม, **When** ตรวจ schema ใหม่, **Then** `5N` ถูกลบออก — การยกเลิกเอกสารใช้ `cancel()` ของ RfaService

---

### User Story 4 - Admin Impersonation with Audit (Priority: P2)

Superadmin และ Organization Admin สามารถทำ action แทน CONSULTANT/DESIGNER/OWNER ได้ทุก action รวมถึง final approval/rejection โดยระบบบันทึก `impersonated: true` และ `on_behalf_of: <original handler>` ใน `workflow_histories`

**Why this priority**: ป้องกัน flow ติดเมื่อฝ่ายที่มีสิทธิ์ลาพัก — แต่ต้องมี audit trail ครบ

**Independent Test**: Superadmin ทำ APPROVE แทน OWNER แล้วตรวจว่า history บันทึก impersonated + on_behalf_of ถูกต้อง

**Acceptance Scenarios**:

1. **Given** RFA ใน OWNER_APPROVAL และ OWNER ลาพัก, **When** Superadmin กด APPROVE แทน, **Then** ระบบนำเข้า APPROVED พร้อมบันทึก `impersonated = true` และ `on_behalf_of_user_id = <OWNER>` ใน history
2. **Given** Organization Admin ทำ action แทน CONSULTANT, **When** ตรวจ history, **Then** บันทึก `impersonated = true` และ `on_behalf_of_user_uuid` สำหรับ API response
3. **Given** ผู้ใช้ทั่วไปพยายามทำ action แทน, **When** ระบบตรวจสิทธิ์, **Then** ปฏิเสธ (เฉพาะ Superadmin/Org Admin เท่านั้น)

---

### User Story 5 - Revision Lifecycle (Priority: P2)

เมื่อ RFA ได้รับ REVISE_REQUIRED (จาก CONSULTANT หรือ OWNER) workflow instance ปัจจุบันจบที่ REVISE_REQUIRED (terminal) เมื่อ Originator สร้าง revision ใหม่ ระบบสร้าง workflow instance ใหม่ โดยดูประวัติรวมผ่าน `rfa_revisions.rfa_id`

**Why this priority**: ทำให้ revision lifecycle ชัดเจน — แต่ละ revision มี state machine ของตัวเอง ไม่ปะปนกัน

**Independent Test**: ส่ง RFA → CONSULTANT RESUBMIT → ตรวจว่า instance เดิม terminal แล้วสร้าง revision ใหม่ → ตรวจว่า revision ใหม่มี instance ใหม่

**Acceptance Scenarios**:

1. **Given** RFA ใน CONSULTANT_REVIEW, **When** CONSULTANT เลือก RESUBMIT, **Then** ระบบนำเข้า REVISE_REQUIRED (terminal) พร้อม approve code `3`
2. **Given** RFA ใน REVISE_REQUIRED (terminal), **When** Originator สร้าง revision ใหม่, **Then** ระบบสร้าง workflow instance ใหม่ในสถานะ DRAFT
3. **Given** มี RFA 3 revisions, **When** ดูประวัติ, **Then** แต่ละ revision มี workflow instance ของตัวเอง และดูได้ผ่าน `rfa_revisions.rfa_id`

---

### User Story 6 - RBAC Layering (Priority: P2)

CASL เป็น coarse gate (authenticated + project access) ที่ controller ส่วน DSL `require.role` เป็น fine-grained state-aware check ที่ Engine ทั้งสองทำงานร่วมกัน (defense in depth)

**Why this priority**: ป้องกันการข้ามสิทธิ์ — CASL ป้องระดับ access, DSL ป้องระดับ state/action

**Independent Test**: CONSULTANT พยายาม APPROVE (action ของ OWNER) แล้วระบบปฏิเสธที่ DSL layer แม้ CASL จะผ่าน

**Acceptance Scenarios**:

1. **Given** CONSULTANT ใน OWNER_APPROVAL state, **When** พยายาม APPROVE, **Then** DSL `require.role` ปฏิเสธ (ต้องมี OWNER)
2. **Given** ผู้ใช้ไม่มี project access, **When** พยายาม SUBMIT, **Then** CASL ปฏิเสธที่ controller (ไม่ถึง Engine)
3. **Given** Editor ใน DRAFT state, **When** กด SUBMIT, **Then** ผ่านทั้ง CASL และ DSL (Editor มีสิทธิ์ SUBMIT)

---

### User Story 7 - Legacy Cleanup (Priority: P3)

ลบ `statusMap` dict 4 ชุด, ลบ `RfaWorkflowService` (dead code), ลบ `processAction()` legacy ใน `WorkflowEngineService` หลัง caller ทั้งหมด migrate ไปใช้ DSL-based flow

**Why this priority**: ลด technical debt — แต่ต้องทำหลัง migration เสร็จ

**Independent Test**: รัน test ทั้งหมดหลังลบ แล้วตรวจว่าไม่มี reference ถึง code ที่ลบ

**Acceptance Scenarios**:

1. **Given** ทุก caller ใช้ DSL-based flow, **When** ลบ `processAction()` legacy, **Then** test ทั้งหมดผ่าน
2. **Given** ไม่มี controller เรียก `RfaWorkflowService`, **When** ลบทั้งไฟล์, **Then** build ผ่าน
3. **Given** status projection อยู่ใน DSL, **When** ลบ `statusMap` dict ในทุก module service, **Then** status ยังถูกต้อง

---

### Edge Cases

- เกิดอะไรถ้า OWNER_APPROVAL แล้ว OWNER กด RESUBMIT (วนกลับ CONSULTANT_REVIEW) — approve code `3` บันทึก แต่ workflow instance ยังไม่ terminal (วนต่อ)
- เกิดอะไรถ้า CONSULTANT กด ASK_DESIGNER แล้ว DESIGNER กด OBJECTED — กลับ CONSULTANT_REVIEW พร้อม comment ของ DESIGNER
- เกิดอะไรถ้า Superadmin ทำ action แทน แต่ original handler ถูก deactivate — บันทึก `on_behalf_of` อยู่ดี แต่ต้องมี flag ว่า user นั้น inactive
- เกิดอะไรถ้ามี concurrent transition สองคนกดพร้อมกัน — Redis Redlock + pessimistic lock + CAS version ป้องกัน (ADR-001)
- เกิดอะไรถ้า DSL version ใหม่ deploy ระหว่าง instance เดิมยัง active — instance ใช้ compiled DSL ของ version ที่สร้าง ไม่ใช่ version ล่าสุด

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: System MUST รวม state/approval logic ที่กระจาย 7 จุดให้เป็น state machine เดียวใน DSL ที่ test ได้ในฐานะ data
- **FR-002**: System MUST รองรับ RFA multi-party sequential approval (CONSULTANT → optional DESIGNER → OWNER) ด้วย state เฉพาะระยะ
- **FR-003**: System MUST เขียน status code ของ module ลง entity column จาก `statusProjection` ใน DSL โดยตรง (ไม่ผ่าน `statusMap` dict ใน module service)
- **FR-004**: System MUST ใช้ approve code scheme ใหม่ (1=APPROVED, 2=APPROVED_WITH_COMMENTS, 3=REVISE_REQUIRED, 4=REJECTED) โดย code ผูกกับ transition ใน DSL
- **FR-005**: System MUST ลบ approve code `5N` (No Further Action) — การยกเลิกเอกสารใช้ `cancel()` ของ RfaService
- **FR-006**: System MUST เก็บ CONSULTANT consent reason แยกใน `rfa_consent_reasons` (metadata ไม่มีผลต่อ state)
- **FR-007**: System MUST ใช้ CASL เป็น coarse gate และ DSL `require.role` เป็น fine-grained state-aware check (defense in depth)
- **FR-008**: System MUST อนุญาตให้ Superadmin และ Organization Admin ทำ action แทน CONSULTANT/DESIGNER/OWNER ได้ทุก action
- **FR-009**: System MUST บันทึก `impersonated: true` และ `on_behalf_of: <original handler>` ใน `workflow_histories` ทุกครั้งที่ admin ทำแทน
- **FR-010**: System MUST ทำให้ REVISE_REQUIRED เป็น terminal state ของ workflow instance ปัจจุบัน
- **FR-011**: System MUST สร้าง workflow instance ใหม่เมื่อ Originator สร้าง RFA revision ใหม่
- **FR-012**: System MUST ลบ `statusMap` dict 4 ชุดใน module services หลัง status projection ย้ายไป DSL
- **FR-013**: System MUST ลบ `RfaWorkflowService` (dead code) หลังตรวจว่าไม่มี caller
- **FR-014**: System MUST ลบ `processAction()` legacy ใน `WorkflowEngineService` หลัง caller ทั้งหมด migrate
- **FR-015**: System MUST ใช้ JSON Logic สำหรับ transition condition (ห้าม string eval) — ตาม ADR-001
- **FR-016**: System MUST บันทึก workflow history ทุก transition พร้อม actor, action, from-state, to-state, approve code, impersonation metadata
- **FR-017**: System MUST รักษา Redis Redlock + pessimistic lock + CAS version สำหรับ concurrent transition protection
- **FR-018**: System MUST ส่ง workflow events ผ่าน BullMQ `workflow-events` queue (ไม่ inline)

### Key Entities _(include if feature involves data)_

- **Workflow Definition**: versioned row ใน `workflow_definitions` มี DSL ที่ include `statusProjection` และ `approveCode` metadata
- **Workflow Instance**: row ใน `workflow_instances` เป็น source of truth ของ state ปัจจุบัน — หนึ่ง RFA revision = หนึ่ง instance
- **Workflow History**: row ใน `workflow_histories` บันทึกทุก transition + `impersonated` + `on_behalf_of_user_id` + `on_behalf_of_user_uuid`
- **RFA Approve Code**: row ใน `rfa_approve_codes` — code 1/2/3/4 (action vocabulary ที่กำหนด state)
- **RFA Consent Reason**: row ใน `rfa_consent_reasons` — reason ของ CONSULTANT consent (metadata ไม่กำหนด state)
- **RFA Revision**: row ใน `rfa_revisions` — แต่ละ revision ผูกกับ workflow instance ของตัวเอง

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: ทุก RFA transition ถูกควบคุมโดย state machine เดียวใน DSL — ไม่มี transition ที่กำหนดใน code กระจาย
- **SC-002**: status code ของ module ถูกต้องทุกจุดโดยไม่มี `statusMap` dict ใน module service (ลบ dict 4 ชุด)
- **SC-003**: approve code ถูกต้องตาม transition ทุกครั้ง (1=APPROVED, 2=APPROVED_WITH_COMMENTS, 3=REVISE_REQUIRED, 4=REJECTED)
- **SC-004**: admin impersonation บันทึก audit trail ครบ 100% ของการกระทำแทน
- **SC-005**: RFA revision ใหม่ได้ workflow instance ใหม่ 100% ของกรณี
- **SC-006**: test coverage ของ business logic (workflow transition + status projection + approve code + impersonation + revision lifecycle) ≥ 80%
- **SC-007**: test coverage ของ backend โดยรวม ≥ 70%
- **SC-008**: ไม่มี `processAction()` legacy และ `RfaWorkflowService` ใน codebase หลัง migration เสร็จ
- **SC-009**: ทุก transition condition ใช้ JSON Logic (ไม่มี string eval) — ตาม ADR-001
- **SC-010**: concurrent transition ปลอดภัย (Redis Redlock + pessimistic lock + CAS version) — ไม่มี race condition
