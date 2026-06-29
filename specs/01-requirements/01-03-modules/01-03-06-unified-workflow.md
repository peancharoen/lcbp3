# 3.6 Unified Workflow Management (การจัดการ Workflow)

---

title: 'Functional Requirements: Unified Workflow Management'
version: 1.8.1
status: updated
owner: Nattanin Peancharoen
last_updated: 2026-03-24
related:

- specs/01-requirements/01-01-objectives.md
- specs/01-requirements/01-03-modules/01-03-00-index.md
- specs/01-requirements/01-03-modules/01-03-02-correspondence.md
- specs/01-requirements/01-03-modules/01-03-03-rfa.md
- specs/01-requirements/01-03-modules/01-03-08-circulation-sheet.md
- specs/06-Decision-Records/ADR-001-unified-workflow-engine.md
- specs/01-requirements/01-02-business-rules/01-02-01-rbac-matrix.md

---

## 3.6.1. วัตถุประสงค์

Unified Workflow Engine คือ **Engine กลาง** สำหรับจัดการสถานะ (State) และการเปลี่ยนสถานะ (Transition) ของเอกสารทุกประเภทในระบบ ใช้ **JSON-based DSL** เก็บ Workflow Definition ไว้ใน Database ไม่ต้อง Deploy ใหม่เมื่อแก้ Workflow

ดูการตัดสินใจเลือก Architecture ได้ที่ `ADR-001-unified-workflow-engine.md`

---

## 3.6.2. โครงสร้างข้อมูล (Database Tables)

| Table | บทบาท |
|---|---|
| `workflow_definitions` | นิยาม Workflow (DSL + compiled) — versioned per `workflow_code` |
| `workflow_instances` | Instance ผูกกับเอกสาร — เก็บ `current_state` + `context` JSON |
| `workflow_histories` | Audit Trail: ทุก transition บันทึก from/to state, action, user, comment |

### workflow_instances.entity_type ที่รองรับ

| entity_type | Module |
|---|---|
| `rfa_revision` | RFA Revision |
| `correspondence_revision` | Correspondence Revision |
| `circulation` | Circulation Sheet |

### workflow_instances.status

| status | ความหมาย |
|---|---|
| `ACTIVE` | กำลังดำเนินการ |
| `COMPLETED` | เสร็จสมบูรณ์ (ถึง terminal state) |
| `CANCELLED` | ยกเลิกโดยผู้ใช้ |
| `TERMINATED` | ถูกยุติโดยระบบ |

---

## 3.6.3. Workflow Definition (DSL)

Workflow Definition เก็บ 2 ฟอร์แมตใน DB:
- `dsl` — JSON ต้นฉบับที่ Admin กำหนด
- `compiled` — Execution Tree ที่ Engine Compile แล้ว (optimize สำหรับ runtime)

### DSL Structure (ตัวอย่าง)

```json
{
  "workflow": "CORRESPONDENCE_ROUTING",
  "version": 1,
  "states": [
    {
      "name": "DRAFT",
      "initial": true,
      "on": {
        "SUBMIT": {
          "to": "SUBMITTED",
          "require": { "role": ["Document Control", "Org Admin"] },
          "condition": "context.hasRecipient === true",
          "events": [{ "type": "notify", "target": "recipients" }]
        }
      }
    },
    { "name": "SUBMITTED", "on": { "RETURN": { "to": "DRAFT" }, "CLOSE": { "to": "CLOSED" } } },
    { "name": "CLOSED", "terminal": true }
  ]
}
```

### DSL Elements

| Element | ความหมาย |
|---|---|
| `states[].initial` | State เริ่มต้นเมื่อสร้าง Instance |
| `states[].terminal` | State สุดท้าย — Instance จะ COMPLETED |
| `on.<ACTION>.to` | State ปลายทางหลัง transition |
| `on.<ACTION>.require.role` | Role ที่ต้องมีจึงจะ trigger action ได้ |
| `on.<ACTION>.condition` | JS Expression ประเมินจาก `context` JSON |
| `on.<ACTION>.events` | Events ที่ fire หลัง transition (notify, etc.) |

---

## 3.6.4. Workflow Execution

1. **สร้าง Instance** — เมื่อเอกสารถูกสร้าง → `WorkflowEngineService.createInstance(workflowCode, entityType, entityId)`
2. **Transition** — `processTransition(instanceId, action, userId, comment)` → validate role + condition → update `current_state` → write `workflow_histories`
3. **Auto-Action** — เมื่อ condition ครบ (เช่น Review ครบทุกคน) Engine trigger transition อัตโนมัติ
4. **Terminal State** — `instance.status = COMPLETED` เมื่อถึง terminal state

### Versioning

- แก้ Workflow ได้โดยเพิ่ม `version` ใหม่ — In-progress instances ยังคงใช้ version เดิม
- `UNIQUE KEY (workflow_code, version)` — ป้องกัน version ซ้ำ

---

## 3.6.5. Flexibility

- **Sequential Approval:** Originator → Org1 → Org2 → Org3 → ส่งผลกลับตามลำดับเดิม — องค์กรใด Reject ได้ทันทีโดยไม่รอลำดับถัดไป
- **Parallel Review:** ส่งให้หลายคนตรวจพร้อมกัน — รอผลครบก่อน transition
- **Conditional Flow:** `condition` expression ประเมิน `context` — เช่น เพิ่ม Approver เมื่อยอดเกิน threshold
- **Skip Step:** ผู้มีสิทธิ์ข้ามขั้นตอนได้ (force transition)
- **Return:** ส่งกลับ state ก่อนหน้าได้ พร้อม comment บังคับ

---

## 3.6.6. Notifications & Deadline

- **Event:** `"type": "notify"` ใน DSL → fire ผ่าน Notification Module (BullMQ)
- **Deadline:** กำหนดได้ต่อ Org ใน Workflow Step
- **แจ้งเตือน:** เมื่อมีเอกสารใหม่ หรือสถานะเปลี่ยน → Email / LINE Notify / In-App

---

## 3.6.7. RBAC

| การกระทำ | Role ที่อนุญาต |
|---|---|
| จัดการ Workflow Definition (สร้าง/แก้ไข DSL) | Superadmin |
| Trigger Workflow Action (Submit, Approve, Reject, ฯลฯ) | ขึ้นอยู่กับ `require.role` ใน DSL |
| ดู Workflow History | ทุกคนที่มีสิทธิ์ใน Document นั้น |

---

## 3.6.8. Audit Trail (workflow_histories)

ทุก transition บันทึก:
- `from_state` / `to_state` / `action`
- `action_by_user_id` — ผู้กระทำ
- `comment` — ความเห็น (บังคับสำหรับ Return/Reject)
- `metadata` JSON — Snapshot ข้อมูล ณ ขณะนั้น
