# 📖 User Stories — LCBP3-DMS v1.8.0

---

title: 'User Stories — All Modules'
version: 1.8.1
status: updated
owner: Nattanin Peancharoen (Product Owner)
last_updated: 2026-03-24
related:

- specs/01-Requirements/01-01-objectives.md
- specs/01-Requirements/01-05-acceptance-criteria.md
- specs/01-Requirements/01-03-modules/
- specs/01-Requirements/01-06-edge-cases-and-rules.md

---

## 📖 วิธีอ่าน

- **Format:** `As a [role] / I want to [goal] / So that [benefit]`
- **Priority:** 🔴 M (Must) | 🟠 S (Should) | 🟡 C (Could) | ⚫ W (Won't-Now)
- **SP:** Story Points (Fibonacci) — 1 SP ≈ ความซับซ้อนระดับ Login
- **AC Link:** → `[AC-XXX-YYY]` อ้างอิง `01-05-acceptance-criteria.md`

---

## 👥 Epic 1: Authentication & User Management

### US-001 — Login เข้าระบบ

**Priority:** 🔴 M | **SP:** 2 | **AC:** AC-AUTH-001, AC-AUTH-002

```
As a ผู้ใช้งานทุกประเภท
I want to login ด้วย Username + Password
So that ฉันเข้าถึงระบบตามบทบาทของตนได้
```

**Done When:**

- Login สำเร็จ → Dashboard | Password ผิด → Error กลางๆ
- ผิดเกิน 5 ครั้งใน 1 นาที → 429 Rate Limit
- Audit Log: `LOGIN_SUCCESS` / `LOGIN_FAILED` + IP

---

### US-002 — เปลี่ยนรหัสผ่านครั้งแรก

**Priority:** 🔴 M | **SP:** 2 | **AC:** AC-AUTH-003

```
As a ผู้ใช้งานใหม่ที่เพิ่งถูกสร้างโดย Admin
I want to ถูกบังคับเปลี่ยนรหัสผ่านใน Login ครั้งแรก
So that ฉันมีรหัสผ่านที่ฉันรู้คนเดียว
```

**Done When:**

- Login ครั้งแรก → Redirect หน้าเปลี่ยน Password ทันที (ผ่านไม่ได้)
- Password ใหม่ต้องผ่าน Policy (8+ ตัว, อักษรใหญ่-เล็ก-ตัวเลข)

---

### US-003 — จัดการ Profile ส่วนตัว

**Priority:** 🟠 S | **SP:** 2

```
As a ผู้ใช้งานทุกประเภท
I want to แก้ไขข้อมูลส่วนตัวและเปลี่ยนรหัสผ่าน
So that ฉันดูแล Account ของตัวเองได้
```

**Done When:**

- แก้ไข ชื่อ, Email, ช่องทาง Notification ได้
- เปลี่ยน Password ต้องยืนยัน Password เก่า

---

### US-004 — Superadmin สร้างองค์กร + Project + Contract

**Priority:** 🔴 M | **SP:** 5 | **AC:** AC-ADMIN-001, AC-ADMIN-002

```
As a Superadmin
I want to สร้าง Organization, Project, Contract และผูกความสัมพันธ์กัน
So that ระบบพร้อมให้แต่ละองค์กรเริ่มทำงานได้
```

**Done When:**

- สร้าง Org → แต่งตั้ง Org Admin ได้ทันที
- สร้าง Project → ผูก Organizations (หลายองค์กร)
- สร้าง Contract → 1 Contractor ต่อ 1 Contract
- กำหนด Document Number Template ต่อ Project

---

### US-005 — Org Admin จัดการ User ในองค์กร

**Priority:** 🔴 M | **SP:** 3 | **AC:** AC-ADMIN-003

```
As a Org Admin
I want to เพิ่ม/แก้ไข/Deactivate User และกำหนด Role
So that ทีมงานเข้าถึงระบบได้ตามหน้าที่
```

**Done When:**

- เพิ่ม User → Email แจ้ง Credentials อัตโนมัติ
- Deactivate ได้ (ไม่ Delete — Audit ยังอยู่)
- เห็นเฉพาะ User ในองค์กรตัวเอง

---

### US-006 — Permission Isolation ระหว่าง Contractor

**Priority:** 🔴 M | **SP:** 2 | **AC:** AC-ADMIN-004

```
As a ระบบ
I want to ป้องกัน Contractor A เห็นข้อมูล Contractor B
So that ข้อมูลทางธุรกิจของแต่ละ Contractor เป็นความลับ
```

**Done When:**

- Contractor A→ ไม่เห็น List เอกสาร B | พยายาม Access URL ตรงๆ → 403
- Audit Log บันทึก Unauthorized Attempt

---

## 📨 Epic 2: Correspondence Management

### US-007 — สร้าง Correspondence Draft

**Priority:** 🔴 M | **SP:** 5 | **AC:** AC-CORR-001

```
As a Document Control
I want to สร้าง Correspondence (Letter/RFI) ในสถานะ Draft พร้อมแนบไฟล์
So that เตรียมเอกสารได้ก่อนส่งโดยองค์กรอื่นยังไม่เห็น
```

**Done When:**

- Form: Subject, To (หลายองค์กร), CC, Doc Type, Attachments (PDF/ZIP)
- Drag-and-Drop Multi-file | ClamAV Scan ทุกไฟล์
- Auto-Save Draft → LocalStorage (กันข้อมูลสูญ)
- ผู้ใช้นอกองค์กรไม่เห็น Draft

---

### US-008 — Submit Correspondence + Auto Number

**Priority:** 🔴 M | **SP:** 5 | **AC:** AC-CORR-002

```
As a Document Control
I want to Submit Correspondence และให้ระบบออกเลขอัตโนมัติ
So that เอกสารได้รับเลขที่ไม่ซ้ำและส่งถึงผู้รับทันที
```

**Done When:**

- ออกเลขตาม Template (เช่น `LCBP3-สค.-กทท.-LETTER-0001-68`)
- เลขไม่ซ้ำแม้ Submit พร้อมกัน (Redis Redlock)
- สถานะ → SUBMITTED | Workflow Instance ถูกสร้าง
- ผู้รับ → Email + In-App Notification

---

### US-009 — ดู Correspondence ใน Inbox

**Priority:** 🔴 M | **SP:** 3 | **AC:** AC-CORR-003

```
As a Document Control ขององค์กรผู้รับ
I want to เห็น Correspondence ที่ส่งมาถึงองค์กรในรายการ
So that ดำเนินการได้ทันที (สร้าง Circulation, ตอบกลับ)
```

**Done When:**

- List แสดง Received/Sent แยก | PDF Viewer ในแอป (Streaming)
- ดาวน์โหลดไฟล์แนบได้ (ถ้ามีสิทธิ์)

---

### US-010 — อ้างอิง + Tag เอกสาร

**Priority:** 🟠 S | **SP:** 3 | **AC:** AC-CORR-004

```
As a Document Control
I want to อ้างอิงเอกสารเก่าและกำหนด Tag หลาย Tag
So that จัดกลุ่มเอกสารและ Navigate ข้าม Thread ได้
```

**Done When:**

- ค้นหาและเลือก Reference Documents | Link ระหว่างเอกสาร (คลิก Navigate)
- กำหนด Tag หลาย Tag | ค้นหาได้จาก Tag

---

### US-011 — ยกเลิก Correspondence (Admin)

**Priority:** 🟡 C | **SP:** 2 | **AC:** AC-CORR-005

```
As a Org Admin / Superadmin
I want to ยกเลิก Correspondence ที่ Submit แล้ว พร้อมระบุเหตุผล
So that เอกสารที่ส่งผิดถูกระงับโดยมีหลักฐาน Audit
```

**Done When:**

- ต้องกรอก cancel_reason | สถานะ → CANCELLED
- Editor/Viewer ทำ Cancel ไม่ได้ → 403

---

## 📋 Epic 3: RFA Management

### US-012 — สร้าง RFA + Shop Drawing

**Priority:** 🔴 M | **SP:** 8 | **AC:** AC-RFA-001

```
As a Document Control ของ Contractor
I want to สร้าง RFA พร้อม Upload Shop Drawing
So that ยื่นขออนุมัติแบบก่อสร้างจากที่ปรึกษาได้อย่างเป็นระบบ
```

**Done When:**

- Form: RFA Type, Discipline, Shop Drawing (PDF/DWG/ZIP)
- 1 Shop Drawing Revision = 1 RFA เท่านั้น (EC-RFA-001 enforced)
- ClamAV Scan | Draft ไม่เห็นข้ามองค์กร (เฉพาะ originator)
- Project/Contract/Dicipline Selector แบบ dynamic (ไม่ hardcoded)

---

### US-012a — แก้ไข Draft RFA (Edit)

**Priority:** 🔴 M | **SP:** 3 | **AC:** AC-RFA-007

```
As a Document Control ของ Contractor
I want to แก้ไขข้อมูล RFA ในสถานะ Draft
So that แก้ไขข้อผิดพลาดก่อน Submit ได้
```

**Done When:**

- แก้ไขได้: Subject, Body, Remarks, Description, Due Date
- แก้ไขได้: Details JSON (schema_version คงที่)
- ห้ามแก้ไขหากสถานะไม่ใช่ DFT → Error 403

---

### US-012b — ยกเลิก Draft RFA (Cancel)

**Priority:** 🟠 S | **SP:** 2 | **AC:** AC-RFA-008

```
As a Document Control ของ Contractor
I want to ยกเลิก RFA ที่ยังไม่ Submit (สถานะ Draft)
So that ลบรายการที่สร้างผิดออกจากระบบ
```

**Done When:**

- ยกเลิกได้เฉพาะสถานะ DFT
- เปลี่ยนสถานะเป็น CC (Cancelled)
- บันทึก Audit Log: CANCELLED + user + timestamp
- Shop Drawing Revision ที่ถูกผูก → ปลดผูก (available สำหรับ RFA ใหม่)

---

### US-012c — ค้นหาและกรองรายการ RFA

**Priority:** 🔴 M | **SP:** 5 | **AC:** AC-RFA-009

```
As a Document Control / Engineer
I want to ค้นหา RFA ด้วย Project, Status, Keyword
So that หาเอกสารที่ต้องการได้รวดเร็ว
```

**Done When:**

- Filter: Project (จาก Project Selector), Status Code (DFT/FAP/1A/4X/CC), Revision Status (CURRENT/OLD/ALL)
- Search: เลขเอกสาร, Subject
- RBAC: DFT → เห็นเฉพาะ originator org | สถานะอื่น → เห็นตามสิทธิ์ปกติ
- Pagination: 20 items/page, แสดง total count

---

### US-013 — Submit RFA ผ่าน Transmittal

**Priority:** 🔴 M | **SP:** 8 | **AC:** AC-RFA-002, AC-TRM-001

```
As a Document Control ของ Contractor
I want to สร้าง Transmittal รวม RFA หลายฉบับ ส่งไปยังที่ปรึกษา
So that ส่งเอกสารเป็นชุด ที่ปรึกษาได้รับทุกฉบับพร้อมกัน
```

**Done When:**

- Transmittal → เลือก RFA หลายฉบับ | ออกเลขเองเป็น Correspondence
- RFA แต่ละฉบับ → ออกเลขตาม Format `LCBP3-RFA-{DISCIPLINE}-{SEQ}`
- ที่ปรึกษา → Notification

---

### US-014 — Review RFA (Approved / w.Comments / Rejected)

**Priority:** 🔴 M | **SP:** 5 | **AC:** AC-RFA-003~005

```
As a Engineer ของ Supervisor Organization
I want to เปิดดู Shop Drawing และให้คำตอบ RFA
So that Contractor ได้รับผลพิจารณาและดำเนินการต่อได้
```

**Done When:**

- PDF Viewer Streaming | ปุ่ม: Approved / Approved w/Comments / Rejected
- Comment บังคับสำหรับ Approved w/Comments และ Rejected
- Originator → Notification | Workflow History บันทึกครบ

---

### US-015 — ยื่น RFA Revision ใหม่หลัง Reject

**Priority:** 🟠 S | **SP:** 5 | **AC:** AC-RFA-006

```
As a Document Control ของ Contractor
I want to สร้าง RFA Revision ใหม่ (Rev.B) หลัง Rev.A ถูก Rejected
So that แก้ไขและยื่น Shop Drawing เวอร์ชันใหม่ได้
```

**Done When:**

- Rev.B ผูกกับ Shop Drawing Rev.B | Rev.A ยังดูได้
- Revision Code เปลี่ยนตาม Sequence (A→B→C)

---

## 📐 Epic 4: Drawing Management

### US-016 — Upload Contract Drawing

**Priority:** 🟠 S | **SP:** 5 | **AC:** AC-DRW-001

```
As a Document Control ของ Design Consultant
I want to Upload แบบคู่สัญญา (Contract Drawing) พร้อมกำหนดหมวดหมู่
So that Contractor ใช้อ้างอิงใน Shop Drawing ได้
```

**Done When:**

- Upload PDF → Drawing Number, Category, Discipline
- Shop Drawing Link Reference กับ Contract Drawing ได้

---

### US-017 — Upload Shop Drawing + Revision Control

**Priority:** 🟠 S | **SP:** 5 | **AC:** AC-DRW-002, AC-DRW-003

```
As a Document Control ของ Contractor
I want to Upload Shop Drawing พร้อม Reference Contract Drawing และจัดการ Revision
So that ผู้ Review เห็น Revision ล่าสุด และ History ทุก Revision
```

**Done When:**

- ค้นหาและเลือก Contract Drawing ที่ Reference
- Rev.ใหม่ → Rev.เก่า Mark "Superseded" แต่ยังดูได้
- 1 Revision = 1 RFA เท่านั้น (Constraint enforced)

---

## ⚙️ Epic 5: Workflow Engine

### US-018 — ดู Workflow Diagram ของเอกสาร

**Priority:** 🟠 S | **SP:** 3 | **AC:** AC-WF-004

```
As a ผู้ใช้งานที่มีสิทธิ์ดูเอกสาร
I want to เห็น Workflow Diagram แบบ Visual
So that รู้ทันทีว่าเอกสารอยู่ขั้นตอนไหน ใครถืออยู่
```

**Done When:**

- Workflow Diagram แสดง State ปัจจุบัน (Highlight)
- คลิก Step ที่ผ่านมา → Audit Log ย่อย (ใคร/เมื่อไหร่/Comment)
- Step ที่ยังไม่ถึง → Disabled Style

---

### US-019 — Approve / Reject ผ่าน Workflow

**Priority:** 🔴 M | **SP:** 5 | **AC:** AC-WF-002, AC-WF-003

```
As a Reviewer ที่ถูก Assign ใน Workflow
I want to Approve / Reject เอกสารในขั้นตอนที่ฉันรับผิดชอบ
So that Workflow เดินหน้าหรือส่งกลับตามการตัดสินใจ
```

**Done When:**

- เห็นปุ่ม Action เฉพาะ Step ที่เป็นของฉัน
- Wrong Role → ปุ่มซ่อน / 403 ถ้าเรียก API ตรงๆ
- ทุก Action → Workflow History + Timestamp

---

### US-020 — Force Proceed + Revert (Document Control)

**Priority:** 🟡 C | **SP:** 3 | **AC:** AC-WF-005

```
As a Document Control
I want to บังคับข้ามหรือย้อน Workflow Step ในกรณีพิเศษ
So that Workflow ที่ติดขัดถูก Unblock ได้อย่างมีหลักฐาน
```

**Done When:**

- ปุ่ม "Force Proceed" / "Revert" เห็นได้เฉพาะ Document Control ขึ้นไป
- ต้องกรอก reason | Audit Log: FORCE_PROCEED / REVERT

---

### US-021 — กำหนด Deadline ใน Workflow

**Priority:** 🟡 C | **SP:** 3 | **AC:** AC-WF-006

```
As a Document Control
I want to กำหนด Deadline ให้แต่ละ Organization ใน Workflow
So that ดำเนินการทันเวลา ไม่เกิดความล่าช้า
```

**Done When:**

- กำหนด Due Date ต่อ Org ใน Workflow
- เกิน Deadline → Dashboard Overdue Badge + Notification
- 2 วันก่อน → Reminder Notification

---

## 📄 Epic 6: Circulation Sheet

### US-022 — สร้าง Circulation Sheet

**Priority:** 🟠 S | **SP:** 5 | **AC:** AC-CIRC-001

```
As a Document Control ภายในองค์กร
I want to สร้างใบเวียนสำหรับ Correspondence พร้อมกำหนดผู้รับผิดชอบ
So that งานถูก Assign ชัดเจนและมีหลักฐาน
```

**Done When:**

- กำหนด Main / Action / Information Assignees (หลายคน)
- Assignees → In-App + Email Notification
- Internal Only (ไม่เห็นข้ามองค์กร)

---

### US-023 — ติดตาม Circulation Deadline + ปิด

**Priority:** 🟠 S | **SP:** 3 | **AC:** AC-CIRC-002, AC-CIRC-003

```
As a Assignee / Document Control
I want to เห็น Deadline งานของฉันและปิด Circulation เมื่อเสร็จ
So that ไม่พลาดงาน และ Track สถานะได้ชัดเจน
```

**Done When:**

- Dashboard My Tasks แสดง Deadline + Overdue Badge
- ปิด Circulation → สถานะ CLOSED + Timestamp
- My Tasks ลบรายการที่ปิดแล้ว

---

## 🔍 Epic 7: Search & Notifications

### US-024 — ค้นหาเอกสาร Full-text

**Priority:** 🟠 S | **SP:** 5 | **AC:** AC-SRCH-001

```
As a ผู้ใช้งานทุกประเภท
I want to ค้นหาเอกสารด้วย Keyword ได้รวดเร็ว
So that พบเอกสารที่ต้องการโดยไม่ต้องจำเลขที่แม่นยำ
```

**Done When:**

- ผล Search < 500ms (Elasticsearch) | ค้นจาก เลขเอกสาร, Subject, Tag
- แสดงเฉพาะเอกสารที่มีสิทธิ์เห็น

---

### US-025 — รับ Notification (Email + In-App)

**Priority:** 🟠 S | **SP:** 5 | **AC:** AC-NOTIF-001, AC-NOTIF-002

```
As a ผู้ใช้งาน
I want to รับ Email และ In-App Notification เมื่อมี Event เกี่ยวข้องกับฉัน
So that ไม่พลาดงานโดยไม่ต้องเช็คระบบตลอดเวลา
```

**Done When:**

- Email ถูกส่งภายใน 5 นาที หลัง Event (BullMQ Queue)
- Bell Icon Unread Count | คลิก → Navigate ไปเอกสาร
- Retry 3 ครั้ง ถ้าส่งไม่ได้ → Dead Letter Queue

---

## 💾 Epic 8: File & Dashboard

### US-026 — Upload ไฟล์ + ดู PDF ในแอป

**Priority:** 🟠 S | **SP:** 5 | **AC:** AC-STOR-001, AC-STOR-003

```
As a Document Control / Reviewer
I want to Upload ไฟล์หลายไฟล์และดู PDF ในแอปได้เลย
So that ทำงานเร็วขึ้นและลดความเสี่ยงข้อมูลรั่วจาก Download
```

**Done When:**

- Drag-and-Drop Multi-file | ClamAV Scan < 30s
- In-App PDF Viewer (Range Requests Streaming)
- ปุ่ม Download → Disabled สำหรับ Viewer-only

---

### US-027 — Dashboard KPI ส่วนตัว

**Priority:** 🟠 S | **SP:** 5 | **AC:** AC-DASH-001

```
As a ผู้ใช้งานทุกประเภท
I want to เห็น Dashboard สรุปงานของฉันทันทีที่ Login
So that รู้สถานะงานโดยไม่ต้องไล่ดูแต่ละ Module
```

**Done When:**

- KPI Cards: Pending RFA, Pending Correspondence, Overdue Circulation
- My Tasks Table: Circulation ที่ค้าง + Deadline
- Filter ตาม Permission ของ User

---

## 📊 Story Map Summary

| Epic             | Stories    | 🔴 Must | 🟠 Should | 🟡 Could |
| ---------------- | ---------- | ------- | --------- | -------- |
| Auth & Users     | US-001~006 | 4       | 1         | 1        |
| Correspondence   | US-007~011 | 2       | 2         | 1        |
| RFA              | US-012~015 | 2       | 2         | 0        |
| Drawing          | US-016~017 | 0       | 2         | 0        |
| Workflow         | US-018~021 | 1       | 1         | 2        |
| Circulation      | US-022~023 | 0       | 2         | 0        |
| Search & Notify  | US-024~025 | 0       | 2         | 0        |
| File & Dashboard | US-026~027 | 0       | 2         | 0        |
| **รวม**          | **27**     | **9**   | **14**    | **4**    |

> **MVP Sprint Focus:** US-001~006, US-007~008, US-012~014, US-019 — ครอบคลุม Core Happy Path ทั้งหมด

---

## 📝 Document Control

- **Version:** 1.0.0 | **Status:** DRAFT
- **Created:** 2026-03-11 | **Owner:** Nattanin Peancharoen
- **Classification:** Internal Use Only
