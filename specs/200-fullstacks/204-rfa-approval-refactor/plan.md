# Implementation Plan: RFA Approval System Refactor

**Feature Branch**: `204-rfa-approval-refactor`
**Parent Feature**: RFA Approval Refactor
**Version**: 1.0.0
**Status**: Planning

---

## 🏗️ Architectural Overview

เราจะปรับปรุงระบบ RFA Approval โดยใช้ **Domain-Driven Design (DDD)** และ **Unified Workflow Engine (ADR-001)** โดยเน้นไปที่ความยืดหยุ่นของ Review Teams, มาตรฐาน Response Codes, และระบบ Delegation/Escalation ที่อัตโนมัติ

### Core Components

1.  **Review Team Module**: จัดการสมาชิกตาม Discipline และ Default Rules
2.  **Approval Matrix Service**: ประมวลผลกฎ Response Codes และ Implications (Cost/Schedule)
3.  **Task Orchestrator**: ควบคุม Parallel Review และ Lead Consolidation logic
4.  **Delegation Manager**: ตรวจสอบสิทธิ์และสลับผู้รับผิดชอบงานตามระยะเวลา
5.  **Reminder & Escalation Engine**: ใช้ BullMQ ในการส่งการแจ้งเตือนแบบ Progressive (3-strike)
6.  **Distribution Engine**: ทำงานแบบ Async เพื่อกระจายเอกสารตาม Matrix หลังการอนุมัติ

---

## 🛡️ Security & Integrity (Tier 1)

| Gate | Status | Notes |
| :--- | :--- | :--- |
| **ADR-019 UUID** | ✅ PASS | All new entities use publicId (string UUID), internal id (number) with @Exclude() |
| **ADR-009 No Migrations** | ✅ PASS | Schema changes via SQL files in `specs/03-Data-and-Storage/` |
| **ADR-002 Document Numbering** | ✅ PASS | Existing RFA numbering reused, no new numbering needed |
| **ADR-008 BullMQ** | ✅ PASS | Reminders, Distribution, Escalation all use BullMQ |
| **ADR-016 CASL** | ✅ PASS | Reviewer permissions via CASL ability checks |
| **ADR-018 AI Boundary** | ✅ PASS | No AI involvement in approval workflow |
| **ADR-007 Error Handling** | ✅ PASS | BusinessException/WorkflowException for approval errors |
| **No `any` types** | ✅ PASS | Strict TypeScript enforced |
| **No `console.log`** | ✅ PASS | NestJS Logger for backend, removed for frontend commits |

---

## 🗺️ Implementation Roadmap

### Phase 0: Research & Foundation (Validated)
- [x] วิเคราะห์ความแตกต่างระหว่างระบบปัจจุบันกับ TeamBinder/InEight
- [x] ตรวจสอบความพร้อมของ Workflow Engine สำหรับ Parallel Tasks
- [x] กำหนด Schema พื้นฐานสำหรับ Entities ใหม่

### Phase 1: Data Model & Contracts (Next Step)
- [ ] สร้าง SQL schema สำหรับ `ReviewTeam`, `ReviewTask`, `Delegation`, `ApprovalMatrix`
- [ ] อัปเดต Data Dictionary ใน `specs/03-Data-and-Storage/`
- [ ] นิยาม API DTOs และ Response Interfaces ใน NestJS

### Phase 2: Core Logic & Services
- [ ] พัฒนา `ReviewTeamService` และ `DelegationService`
- [ ] พัฒนา `ApprovalMatrixService` (Logic: Lead Consolidation, Category Filtering)
- [ ] พัฒนา `RemindersProcessor` (Logic: 3-Strike Escalation via BullMQ)

### Phase 3: Workflow Integration
- [ ] อัปเดต RFA Workflow DSL ให้รองรับ Parallel Review Step
- [ ] เชื่อมต่อ Event Hooks สำหรับ Auto-Distribution (Transmittal generation)
- [ ] พัฒนา Proxy Logic ใน Task Manager สำหรับ Delegation

### Phase 4: Frontend UI/UX
- [ ] พัฒนา Horizontal Stepper สำหรับ Parallel Review visualization
- [ ] พัฒนา Delegation Settings UI และ Matrix Management Dashboard
- [ ] ปรับปรุง RFA Detail page ให้รองรับ Side Panel layout (Discipline details)

### Phase 5: Testing & Validation
- [ ] Unit Tests สำหรับ Lead Consolidation rules
- [ ] E2E Tests สำหรับ Delegation expiry และ Escalation flow
- [ ] โหลดเทสต์สำหรับ Distribution Matrix (Concurrent approvals)

---

## 📐 Technical Decisions

### Decision 1: Lead Consolidation Logic (Parallel Review)
เราจะใช้ **Lead Consolidation** แทน Majority Vote เพื่อให้สอดคล้องกับมาตรฐานอุตสาหกรรม โดย Lead Discipline จะได้รับสิทธิ์ในการ "สรุปผล" หลังจากทุก Discipline ทำงานเสร็จ หรือสามารถ override ได้ตามสิทธิ์ PM

### Decision 2: Single-Level Delegation
เพื่อป้องกันความซับซ้อนของ Circular Dependency และ Audit Trail เราจะจำกัดการมอบหมายงานให้เพียง **1 ระดับ** เท่านั้น (A -> B) โดย B ไม่สามารถส่งต่อให้ C ได้ในฐานะผู้ใช้ปกติ

### Decision 3: 3-Strike Progressive Escalation
การยกระดับจะใช้ระบบ 3 ครั้ง (Reminders) ต่อระดับความสำคัญ ก่อนจะย้ายงานไปให้ผู้บังคับบัญชา (L1 -> L2) และเมื่อถึงระดับสูงสุดจะส่ง Daily Reminder จนกว่าจะจบงาน

---

## ⚠️ Potential Blockers

- **Workflow DSL Flexibility**: ความสามารถของ Engine ปัจจุบันในการจัดการ Parallel Tasks ที่รอการ Consolidation
- **Migration of Existing RFAs**: แผนการจัดการ RFA ที่กำลังอยู่ในกระบวนการ (In-flight) ระหว่างการเปลี่ยนผ่านระบบ
- **CASL Matrix Overlap**: ความซับซ้อนของสิทธิ์เมื่อมีทั้ง Delegation และ Review Team roles ซ้อนทับกัน

---

## 🔗 References

- **Spec File**: `specs/200-fullstacks/204-rfa-approval-refactor/spec.md`
- **Research File**: `specs/200-fullstacks/204-rfa-approval-refactor/research.md`
- **ADR-001**: Unified Workflow Engine
- **ADR-019**: Hybrid Identifier Strategy
- **ADR-008**: BullMQ Notification Strategy
