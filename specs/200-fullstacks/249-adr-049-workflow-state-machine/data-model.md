# Data Model: ADR-049 Workflow State Machine Consolidation

**Date**: 2026-08-28
**Related ADR**: [ADR-049](../../06-Decision-Records/ADR-049-workflow-state-machine-consolidation.md)

## Entity Changes

### 1. `workflow_histories` (modify — add impersonation audit)

| Column                   | Type                 | Notes                                                                                                |
| ------------------------ | -------------------- | ---------------------------------------------------------------------------------------------------- |
| `id`                     | INT AUTO_INCREMENT   | PK                                                                                                   |
| `workflow_instance_id`   | INT                  | FK → workflow_instances.id                                                                           |
| `action`                 | VARCHAR(50)          | transition action (e.g., SUBMIT, APPROVE)                                                            |
| `from_state`             | VARCHAR(50)          | state ก่อน transition                                                                                |
| `to_state`               | VARCHAR(50)          | state หลัง transition                                                                                |
| `actor_user_id`          | INT                  | FK → users.id (ผู้กดปุ่ม)                                                                            |
| `approve_code`           | VARCHAR(10) NULL     | approve code ถ้ามี (1/2/3/4)                                                                         |
| `impersonated`           | TINYINT(1) DEFAULT 0 | **NEW** — 1 ถ้า admin ทำแทน                                                                          |
| `on_behalf_of_user_id`   | INT NULL             | **NEW** — FK → users.id (เจ้าของเดิม) `@Exclude()`                                                   |
| `on_behalf_of_user_uuid` | VARCHAR(36) NULL     | **NEW** — UUID สำหรับ API response                                                                   |
| `metadata`               | JSON NULL            | context + payload + `on_behalf_of_user_active: boolean` (T031a — flag ว่า user ต้นทาง inactive แล้ว) |
| `created_at`             | TIMESTAMP            |                                                                                                      |

### 2. `rfa_approve_codes` (modify — new scheme)

| Column        | Type               | Notes                                                       |
| ------------- | ------------------ | ----------------------------------------------------------- |
| `id`          | INT AUTO_INCREMENT | PK                                                          |
| `code`        | VARCHAR(10)        | `1`, `2`, `3`, `4` (scheme ใหม่)                            |
| `description` | VARCHAR(100)       | APPROVED, APPROVED_WITH_COMMENTS, REVISE_REQUIRED, REJECTED |
| `sort_order`  | INT                | 10, 20, 30, 40                                              |
| `is_active`   | TINYINT(1)         | 1                                                           |

**Changes**: ลบ `5N` (No Further Action), เปลี่ยน code จาก `1A/1C/1N/1R/3C/3R/4X` เป็น `1/2/3/4`

### 3. `rfa_consent_reasons` (new table)

| Column        | Type               | Notes                                                   |
| ------------- | ------------------ | ------------------------------------------------------- |
| `id`          | INT AUTO_INCREMENT | PK                                                      |
| `public_id`   | UUIDv7             | ADR-019                                                 |
| `code`        | VARCHAR(10)        | reason code (e.g., `NO_OBJECTION`, `COMMENTS_PROVIDED`) |
| `description` | VARCHAR(200)       | คำอธิบาย                                                |
| `sort_order`  | INT                |                                                         |
| `is_active`   | TINYINT(1)         | 1                                                       |

**Purpose**: เก็บ consent reason ของ CONSULTANT (metadata ไม่มีผลต่อ state)

### 4. `rfa_revisions` (modify — link to workflow instance)

ไม่มีการเพิ่ม column — ใช้ `workflow_instance_id` ที่มีอยู่แล้ว

**Lifecycle**:

- REVISE_REQUIRED → workflow instance terminal (status = COMPLETED)
- สร้าง revision ใหม่ → สร้าง workflow instance ใหม่ใน DRAFT
- ดูประวัติรวมผ่าน `rfa_revisions.rfa_id`

## State Machine

### RFA_APPROVAL (version 2)

```
DRAFT
  └─ SUBMIT ─→ CONSULTANT_REVIEW

CONSULTANT_REVIEW
  ├─ CONSENT_FOR_APPROVE ─→ OWNER_APPROVAL
  ├─ ASK_DESIGNER         ─→ DESIGNER_REVIEW
  ├─ RESUBMIT             ─→ REVISE_REQUIRED (terminal, code 3)
  └─ REJECT               ─→ REJECTED (terminal, code 4)

DESIGNER_REVIEW
  ├─ AGREED              ─→ CONSULTANT_REVIEW
  ├─ AGREED_WITH_COMMENTS ─→ CONSULTANT_REVIEW
  ├─ NO_OBJECTION        ─→ CONSULTANT_REVIEW
  └─ OBJECTED            ─→ CONSULTANT_REVIEW

OWNER_APPROVAL
  ├─ APPROVE              ─→ APPROVED (terminal, code 1)
  ├─ APPROVE_WITH_COMMENTS ─→ APPROVED_WITH_COMMENTS (terminal, code 2)
  ├─ RESUBMIT             ─→ CONSULTANT_REVIEW (code 3, ไม่ terminal)
  └─ REJECT               ─→ REJECTED (terminal, code 4)
```

### Status Projection

| State                  | rfa status |
| ---------------------- | ---------- |
| DRAFT                  | DFT        |
| CONSULTANT_REVIEW      | FRE        |
| DESIGNER_REVIEW        | FRE        |
| OWNER_APPROVAL         | FAP        |
| APPROVED               | FCO        |
| APPROVED_WITH_COMMENTS | FCO        |
| REJECTED               | CC         |
| REVISE_REQUIRED        | DFT        |

### RBAC per State/Action

| State             | Action                | Required Role |
| ----------------- | --------------------- | ------------- |
| DRAFT             | SUBMIT                | Editor        |
| CONSULTANT_REVIEW | CONSENT_FOR_APPROVE   | CONSULTANT    |
| CONSULTANT_REVIEW | ASK_DESIGNER          | CONSULTANT    |
| CONSULTANT_REVIEW | RESUBMIT              | CONSULTANT    |
| CONSULTANT_REVIEW | REJECT                | CONSULTANT    |
| DESIGNER_REVIEW   | AGREED                | DESIGNER      |
| DESIGNER_REVIEW   | AGREED_WITH_COMMENTS  | DESIGNER      |
| DESIGNER_REVIEW   | NO_OBJECTION          | DESIGNER      |
| DESIGNER_REVIEW   | OBJECTED              | DESIGNER      |
| OWNER_APPROVAL    | APPROVE               | OWNER         |
| OWNER_APPROVAL    | APPROVE_WITH_COMMENTS | OWNER         |
| OWNER_APPROVAL    | RESUBMIT              | OWNER         |
| OWNER_APPROVAL    | REJECT                | OWNER         |

**Impersonation**: Superadmin + Org Admin สามารถทำแทนได้ทุก action (บันทึก `impersonated` + `on_behalf_of`)
