# Research: ADR-049 Workflow State Machine Consolidation

**Date**: 2026-08-28
**Status**: Complete (resolved via grilling session + ADR-049)

## R1: Status Projection — DSL vs Service

**Decision**: DSL owns `statusProjection` (Option A from grilling)

**Rationale**: ADR-001 ประกาศ DSL เป็น authority เดียว การย้าย projection เข้า DSL ทำให้ state→status mapping เป็น versioned, admin-editable, test ได้ในฐานะ data ฆ่า drift ระหว่าง seed DSL กับ constants

**Alternatives considered**:
- Option 2: Shared `WorkflowStatusProjector` service — เป็นที่ที่สองให้ drift (ขัด ADR-001)
- Option 3: Hybrid (DSL owns + generic states + context phase) — ใช้ `context.currentPhase` ผิดกฎ deterministic from state alone

## R2: RFA State Machine — Multi-Party States vs Generic

**Decision**: RFA-specific states (`CONSULTANT_REVIEW`, `DESIGNER_REVIEW`, `OWNER_APPROVAL`)

**Rationale**: RFA เป็น multi-party sequential approval จริง ๆ การบังคับใช้ generic state สูญเสียข้อมูลระยะที่สำคัญ — engine ไม่รู้ action ที่ใช้ได้จาก state อย่างเดียว

**Alternatives considered**:
- Generic states + `context.currentPhase` — ผิดกฎ deterministic from state alone (ADR-001 Production Rule #2)

## R3: Approve Code Scheme

**Decision**: Scheme ใหม่ (1=APPROVED, 2=APPROVED_WITH_COMMENTS, 3=REVISE_REQUIRED, 4=REJECTED) ลบ 5N

**Rationale**: code กำหนด state โดยตรง จึงต้องอยู่ใน DSL ในฐานะ transition metadata ส่วน 5N (No Further Action) ไม่จำเป็น — การยกเลิกเอกสารใช้ `cancel()` ของ RfaService

**Alternatives considered**:
- เก็บ 5N — เพิ่ม complexity โดยไม่จำเป็น
- ใช้ scheme เดิม (1A/1C/1N/1R/3C/3R/4X) — ผสม action vocabulary + consent reason ในตารางเดียว

## R4: Consent Reason Separation

**Decision**: แยก `rfa_consent_reasons` (metadata) จาก `rfa_approve_codes` (action → state)

**Rationale**: consent reason เป็นเหตุผลประกอบของ CONSULTANT ไม่มีผลต่อ state การแยกทำให้ validation ถูกต้องและ audit ชัดเจน

## R5: RBAC Layering

**Decision**: CASL (coarse) + DSL `require.role` (fine-grained state-aware)

**Rationale**: CASL เป็น coarse gate (authenticated + project access) ที่ controller ส่วน DSL `require.role` เป็น fine-grained state-aware check ที่ Engine ทั้งสองทำงานร่วมกัน (defense in depth)

**Alternatives considered**:
- CASL only — ไม่รู้ state/action context
- DSL only — ไม่มี coarse gate

## R6: Admin Impersonation

**Decision**: Superadmin + Org Admin ทำแทนได้ทุก action + audit `impersonated` + `on_behalf_of`

**Rationale**: ป้องกัน flow ติดเมื่อฝ่ายที่มีสิทธิ์ลาพัก แต่ต้องมี audit trail ครบ

**Scope**: ขยายจาก ADR-021 (upload impersonation) ให้ครอบ action แทนด้วย

## R7: Revision Lifecycle

**Decision**: REVISE_REQUIRED = terminal; new revision = new workflow instance

**Rationale**: แต่ละ revision มี state machine ของตัวเอง ไม่ปะปนกัน ดูประวัติรวมผ่าน `rfa_revisions.rfa_id`

**Alternatives considered**:
- `previous_instance_id` column — เพิ่ม complexity โดยไม่จำเป็น (ดูได้ผ่าน rfa_revisions)

## R8: Legacy Cleanup

**Decision**: ลบ `statusMap` dict 4 ชุด, `RfaWorkflowService`, `processAction()` legacy

**Rationale**: ลด technical debt หลัง migration เสร็จ — ไม่มี code กระจายอีก

**Sequence**: ลบหลัง caller ทั้งหมด migrate ไปใช้ DSL-based flow
