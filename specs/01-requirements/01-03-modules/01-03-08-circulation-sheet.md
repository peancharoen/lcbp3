# 3.8 Circulation Sheet Management (การจัดการใบเวียนเอกสาร)

---

title: 'Functional Requirements: Circulation Sheet Management'
version: 1.8.1
status: updated
owner: Nattanin Peancharoen
last_updated: 2026-03-24
related:

- specs/01-requirements/01-01-objectives.md
- specs/01-requirements/01-03-modules/01-03-00-index.md
- specs/01-requirements/01-03-modules/01-03-02-correspondence.md
- specs/01-requirements/01-03-modules/01-03-06-unified-workflow.md
- specs/01-requirements/01-06-edge-cases-and-rules.md (EC-CIRC-001 ถึง EC-CIRC-003, EC-CORR-001)
- specs/03-Data-and-Storage/03-01-data-dictionary.md
- specs/01-requirements/01-02-business-rules/01-02-01-rbac-matrix.md

---

## 3.8.1. วัตถุประสงค์

ใบเวียนเอกสาร (Circulation Sheet) ใช้สำหรับ **มอบหมายและติดตามงานภายในองค์กร** เมื่อได้รับ Correspondence จากภายนอก — **มองเห็นและแก้ไขได้เฉพาะคนในองค์กรเดียวกัน** เท่านั้น

---

## 3.8.2. โครงสร้างข้อมูล (Database Tables)

| Table | บทบาท |
|---|---|
| `circulations` | ข้อมูล Master: เลขใบเวียน, subject, status, organization — ผูก 1:1 กับ `correspondences` |
| `circulation_attachments` | ไฟล์แนบเพิ่มเติม (M:N กับ `attachments`) |
| `circulation_status_codes` | Master: สถานะใบเวียน |

**ข้อสำคัญ:**
- `circulations.correspondence_id` UNIQUE — 1 Correspondence มีใบเวียนได้ **1 ฉบับต่อองค์กร**
- ใบเวียนผูกกับ `organization_id` — มองเห็นเฉพาะคนในองค์กรนั้น

---

## 3.8.3. Fields ที่ต้องกรอกเมื่อสร้าง Circulation

| Field | Required | หมายเหตุ |
|---|---|---|
| Correspondence | ✅ | UUID — เอกสารที่ต้องการเวียน |
| Organization | ✅ | UUID — องค์กรเจ้าของใบเวียน (auto จาก current user org) |
| Subject (`circulation_subject`) | ✅ | VARCHAR(500) |
| Assignees | ✅ | UUID[] — ผู้รับมอบหมาย (จัดการผ่าน Workflow context) |
| Deadline | ❌ | สำหรับผู้รับผิดชอบประเภท Main และ Action |
| Attachments | ❌ | ไฟล์แนบเพิ่มเติม — ผ่าน ClamAV scan |

### ประเภทผู้รับมอบหมาย (Assignee Types)

| ประเภท | ความหมาย | Deadline |
|---|---|---|
| **Main** | ผู้รับผิดชอบหลัก (มีได้หลายคน) | ✅ บังคับ |
| **Action** | ผู้ร่วมปฏิบัติงาน (มีได้หลายคน) | ✅ บังคับ |
| **Information** | ผู้ที่ต้องรับทราบ (มีได้หลายคน) | ❌ |

---

## 3.8.4. Status Codes (circulation_status_codes)

| status_code | ความหมาย |
|---|---|
| `OPEN` | เปิดใบเวียนแล้ว — รอดำเนินการ |
| `IN_REVIEW` | กำลังพิจารณา |
| `COMPLETED` | ดำเนินการเสร็จสมบูรณ์ |
| `CANCELLED` | ยกเลิก / ถอนกลับ |

---

## 3.8.5. การสร้างและสิทธิ์ (RBAC)

| การกระทำ | Role ที่อนุญาต | Scope |
|---|---|---|
| สร้าง Circulation | Document Control, Org Admin, Superadmin | ภายในองค์กรตัวเอง |
| แก้ไข / Re-assign | Document Control, Org Admin | ภายในองค์กรตัวเอง |
| Force Close | Document Control, Org Admin | พร้อมระบุเหตุผล (EC-CIRC-002) |
| ปิด Circulation (ปกติ) | ผู้ที่ถูก Assign (Main/Action) | เมื่อดำเนินการเสร็จ |
| ดู Circulation | เฉพาะคนในองค์กรเดียวกัน | องค์กรอื่นมองไม่เห็น |

---

## 3.8.6. Workflow และ Notifications

- Circulation ใช้ Unified Workflow Engine (`entity_type = 'circulation'`) — ดู `01-03-06-unified-workflow.md`
- **แจ้งเตือน:** เมื่อถูก Assign ใหม่, เมื่อใกล้ถึง Deadline, เมื่อ Overdue → Email / LINE Notify / In-App (BullMQ)
- **Deadline Rule:** หมดเขตเมื่อ `deadline_date 23:59:59` — Overdue Badge ขึ้นเมื่อ `NOW() > deadline_date + 1 day` (EC-CIRC-003)

---

## 3.8.7. Business Rules และ Edge Cases

| รหัส | กฎ | Severity |
|---|---|---|
| **EC-CORR-001** | Cancel Correspondence ที่มี Circulation เปิดอยู่ → Force Close Circulation ทั้งหมด + Audit Log | 🔴 Critical |
| **EC-CIRC-001** | Assignee ถูก Deactivate ก่อน Respond → Document Control สามารถ Re-assign ได้ | 🟠 High |
| **EC-CIRC-002** | Multi-Assignee — บางคนยังไม่ Respond → Document Control Force Close ได้ พร้อมระบุเหตุผล | 🟡 Medium |
| **EC-CIRC-003** | Deadline = Today → หมดเขต 23:59:59, Reminder 08:00, Overdue Badge วันถัดไป | 🟡 Medium |

ดูรายละเอียดครบที่ `01-06-edge-cases-and-rules.md` หมวด "Module 8: Circulation Edge Cases"
