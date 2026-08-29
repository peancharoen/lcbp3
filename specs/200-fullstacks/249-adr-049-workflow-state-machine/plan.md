# Implementation Plan: ADR-049 Workflow State Machine Consolidation

**Branch**: `249-adr-049-workflow-state-machine` | **Date**: 2026-08-28 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `specs/200-fullstacks/249-adr-049-workflow-state-machine/spec.md`
**Related ADR**: [ADR-049](../../06-Decision-Records/ADR-049-workflow-state-machine-consolidation.md)

## Summary

รวม state/approval logic ที่กระจาย 7 จุดให้เป็น state machine เดียวใน DSL ที่ test ได้ โดย:

- DSL owns `statusProjection` (map state → module status code)
- RFA multi-party sequential approval (CONSULTANT → optional DESIGNER → OWNER)
- Approve code scheme ใหม่ (1/2/3/4) ผูกกับ transition
- Consent reason แยกเป็น metadata
- CASL + DSL `require.role` defense in depth
- Admin impersonation พร้อม audit trail
- Revision lifecycle: terminal old instance + new instance for new revision
- ลบ dead code (`RfaWorkflowService`, `processAction()` legacy, `statusMap` dict 4 ชุด)

## Technical Context

**Language/Version**: TypeScript 5.9, NestJS 11, Next.js 16
**Primary Dependencies**: TypeORM, Redis (Redlock), BullMQ, Zod, CASL, MariaDB 11.8
**Storage**: MariaDB 11.8 (schema delta per ADR-044), Redis (Redlock + cache)
**Testing**: Jest (unit + integration), Playwright (E2E), k6 (performance)
**Target Platform**: Linux server (QNAP Container Station)
**Project Type**: Web (NestJS backend + Next.js frontend)
**Performance Goals**: transition < 200ms p95, 100 concurrent transitions ปลอดภัย
**Constraints**: ADR-001 (DSL only, no string eval), ADR-019 (UUID publicId), ADR-044 (SQL delta), ADR-016 (CASL)
**Scale/Scope**: 4 workflow definitions (RFA/Circulation/Correspondence/Transmittal), 8 RFA states, 10 RFA actions

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Gate                            | Status  | Notes                                                                          |
| ------------------------------- | ------- | ------------------------------------------------------------------------------ |
| ADR-001 Unified Workflow Engine | ✅ PASS | DSL เป็น authority เดียว, statusProjection ใน DSL                              |
| ADR-019 UUID                    | ✅ PASS | `on_behalf_of_user_uuid` สำหรับ API, `on_behalf_of_user_id` (INT) `@Exclude()` |
| ADR-044 Schema (amends ADR-009) | ✅ PASS | SQL delta ใน `specs/03-Data-and-Storage/deltas/`                               |
| ADR-016 Security                | ✅ PASS | CASL + DSL `require.role` defense in depth                                     |
| ADR-007 Error Handling          | ✅ PASS | WorkflowException + BusinessException                                          |
| ADR-008 BullMQ                  | ✅ PASS | workflow-events queue                                                          |
| ADR-021 Workflow Context        | ✅ PASS | Impersonation ขยายจาก upload เป็น action                                       |
| No `any` types                  | ✅ PASS | Strict TypeScript                                                              |
| No `console.log`                | ✅ PASS | NestJS Logger                                                                  |
| No string eval                  | ✅ PASS | T1 ลบ string condition ออกแล้ว, ใช้ JSON Logic                                 |

## Project Structure

### Documentation (this feature)

```text
specs/200-fullstacks/249-adr-049-workflow-state-machine/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   ├── workflow-transition-api.md
│   └── rfa-action-api.md
├── checklists/
│   └── requirements.md  # From 102-speckit-specify
└── tasks.md             # Phase 2 output (105-speckit-tasks)
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── modules/
│   │   ├── workflow-engine/
│   │   │   ├── workflow-engine.service.ts       # T2: refactor — statusProjection + impersonation
│   │   │   ├── workflow-dsl.service.ts          # T1: DONE — statusProjection + approveCode
│   │   │   ├── entities/
│   │   │   │   ├── workflow-instance.entity.ts
│   │   │   │   └── workflow-history.entity.ts   # T3: add impersonated + on_behalf_of
│   │   │   └── guards/
│   │   │       └── workflow-transition.guard.ts # CASL coarse gate
│   │   ├── rfa/
│   │   │   ├── rfa.service.ts                   # T4: new actions + revision lifecycle
│   │   │   ├── constants/rfa.constants.ts       # T6: update state/status/approveCode
│   │   │   └── entities/
│   │   │       ├── rfa-revision.entity.ts
│   │   │       └── rfa-approve-code.entity.ts   # T3: update scheme
│   │   ├── circulation/
│   │   │   └── circulation-workflow.service.ts  # T5: remove statusMap
│   │   └── correspondence/
│   │       └── correspondence-workflow.service.ts # T5: remove statusMap
│   └── database/
│       └── seeds/
│           └── workflow-definitions.seed.ts     # T1: DONE — new DSL
└── test/
    └── phase3-workflow.e2e-spec.ts              # E2E

specs/03-Data-and-Storage/
└── deltas/
    └── delta-adr-049-workflow-impersonation.sql # T3: schema delta
```

**Structure Decision**: Web application (NestJS backend + Next.js frontend) — ใช้โครงสร้างมีอยู่

## Complexity Tracking

ไม่มี Constitution Check violations — ไม่ต้องเติมตารางนี้

## Implementation Phases

### Phase 0: Research (DONE — จาก grilling session)

- [x] วิเคราะห์ state/status drift ระหว่าง seed DSL กับ constants
- [x] ตัดสินใจ status projection (Option A: DSL owns)
- [x] ตัดสินใจ approve code scheme (1/2/3/4, ลบ 5N)
- [x] ตัดสินใจ consent reason separation
- [x] ตัดสินใจ RBAC layering (CASL + DSL)
- [x] ตัดสินใจ admin impersonation
- [x] ตัดสินใจ revision lifecycle (terminal + new instance)
- [x] สร้าง ADR-049

### Phase 1: Design & Contracts

- [x] T1: Seed DSL refactor (DONE)
- [ ] T2: WorkflowEngineService refactor
- [ ] T3: Schema delta (approve codes + consent reasons + impersonation)
- [ ] T4: RfaService refactor
- [ ] T5: Remove statusMap dict + dead code
- [ ] T6: Update constants
- [ ] T7: Frontend impersonation UI
- [ ] T8: Admin console (optional)

### Phase 2: Tasks (next — 105-speckit-tasks)

ดู `tasks.md` (จะสร้างโดย 105-speckit-tasks)

## Ledger Decision

**Required**: Yes — Tier 3 specialized work (workflow engine, multi-step, cross-session)

- **Template**: `templates/ledger-template.md` (generic cross-session)
- **ASSURANCE_UNIT_ID**: `lcbp3/workflow/adr-049-state-machine`
- **Path**: `specs/200-fullstacks/249-adr-049-workflow-state-machine/ledger.md`
- **Reason**: Workflow engine refactor, multi-session, multiple agents (Devin Local + Codex + Claude Agent), protected boundary (workflow state + audit)

## Task Assignment (from ADR-049)

| Task                        | Assignee     | Profile        | ขนาด | Status  | Reviewer    | Fallback      |
| --------------------------- | ------------ | -------------- | ---- | ------- | ----------- | ------------- |
| T1 (seed DSL)               | Devin Local  | GLM-5.2 High   | ใหญ่ | ✅ DONE | Codex       | —             |
| T2 (engine refactor)        | Devin Local  | GLM-5.2 High   | ใหญ่ | Pending | Codex       | User escalate |
| T3 (schema)                 | Claude Agent | —              | เล็ก | Pending | Devin Local | Devin Local   |
| T4 (RfaService)             | Codex        | —              | กลาง | Pending | Devin Local | Devin Local   |
| T5 (ลบ dict + dead code)    | Codex        | —              | กลาง | Pending | Devin Local | Devin Local   |
| T6 (constants)              | Codex        | —              | กลาง | Pending | Devin Local | Devin Local   |
| T7 (frontend impersonation) | Devin Local  | SWE 1.7 Medium | กลาง | Pending | Codex       | User escalate |
| T8 (admin console)          | Devin Local  | SWE 1.7 Medium | กลาง | Pending | Codex       | User escalate |
| Test                        | Devin Local  | GLM-5.2 High   | ใหญ่ | Pending | Codex       | User escalate |

## Review & Fallback Protocol

### Cross-Review Chain

- **Devin Local ตรวจงาน Codex/Claude Agent** — Main owner review งาน supporting agents
- **Codex ตรวจงาน Devin Local (large work)** — Cross-review ป้องกัน bias ตัวเอง
- **Reviewer ห้ามเป็นคนเดียวกับ Assignee** — defense in depth

### Phase Gate Checkpoint (no time-based detection)

- หลังแต่ละ phase ต้องผ่าน checkpoint ก่อนเริ่ม phase ถัดไป
- Reviewer ตรวจ: task ครบ + typecheck ผ่าน + test ผ่าน + ไม่มี file ที่ไม่เกี่ยวข้อง
- ถ้าไม่ผ่าน → Assignee แก้จนกว่าจะผ่าน

### Fallback Chain (กรณี Agent หยุด)

- **Codex หยุด** → Devin Local รับต่อ
- **Claude Agent หยุด** → Devin Local รับต่อ
- **Devin Local หยุด** → User escalate (ไม่มี fallback อัตโนมัติ)
- ตรวจที่ phase gate — ถ้าไม่ผ่าน + Assignee ไม่ตอบ → trigger fallback

### Dependency Order

```
T3 (schema) ─┐
             ├─→ T1 (DSL) ✅ ─→ T2 (engine) ─→ T4 (RfaService) + T5 (ลบ dict) + T6 (constants) ─→ Test
             ┘                                                              ↓
                                                                          T7 + T8 (frontend)
```
