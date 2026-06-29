# 🖼️ UI/UX Wireframes & Screen Inventory — LCBP3-DMS v1.8.1

---

title: 'UI/UX Screen Inventory, Navigation Map, and Wireframes'
version: 1.8.1
status: updated
owner: Nattanin Peancharoen (Product Owner)
last_updated: 2026-03-24
related:

- specs/01-Requirements/01-02-business-rules/01-02-03-ui-ux-rules.md
- specs/01-Requirements/01-04-user-stories.md
- specs/01-Requirements/01-05-acceptance-criteria.md
- specs/01-Requirements/01-06-edge-cases-and-rules.md
- specs/06-Decision-Records/ADR-012-ui-components.md
- specs/06-Decision-Records/ADR-019-hybrid-identifier-strategy.md

---

> [!NOTE]
> Wireframes ในเอกสารนี้เป็น **Low-fidelity ASCII/Text Wireframes** เพื่อสื่อสาร Layout และ Component Hierarchy
> สำหรับ High-fidelity Design ให้ใช้ Figma หรือ Shadcn/UI Components ตาม ADR-012

---

## 1. 🗺️ Navigation Map (Site Map)

```
[🔓 Public]
│
└── /login                          → หน้า Login (Anonymous)
    └── /login/forgot-password      → ลืมรหัสผ่าน
    └── /login/change-password      → เปลี่ยนรหัสผ่านครั้งแรก (Force)

[🔒 Authenticated — App Shell (Sidebar + Navbar)]
│
├── /dashboard                      → หน้าหลัก (My Tasks + KPI)
│
├── /correspondences                → รายการ Correspondence
│   ├── /correspondences/new        → สร้างใหม่
│   └── /correspondences/:uuid        → รายละเอียด + Workflow
│
├── /rfas                           → รายการ RFA
│   ├── /rfas/new                   → สร้างใหม่
│   ├── /rfas/:uuid                   → รายละเอียด + Workflow
│   ├── /rfas/:uuid/edit            → แก้ไข Draft RFA (ใหม่!)
│   └── /rfas/search                 → ค้นหาและกรอง RFA (ใหม่!)
│
├── /transmittals                   → รายการ Transmittal
│   ├── /transmittals/new           → สร้างใหม่ (รวม RFAs)
│   └── /transmittals/:uuid           → รายละเอียด
│
├── /drawings                       → Drawing Management
│   ├── /drawings/contract          → Contract Drawings
│   │   ├── /drawings/contract/new  → Upload ใหม่
│   │   └── /drawings/contract/:uuid  → รายละเอียด
│   └── /drawings/shop              → Shop Drawings
│       ├── /drawings/shop/new      → Upload ใหม่
│       └── /drawings/shop/:uuid      → รายละเอียด + RFA History
│
├── /circulations                   → Circulation Sheets (Internal)
│   ├── /circulations/new           → สร้างใหม่
│   └── /circulations/:uuid           → รายละเอียด + Assignees
│
├── /search                         → Full-text Search
│
├── /notifications                  → รายการ Notifications
│
├── /profile                        → ข้อมูลส่วนตัว + ตั้งค่า
│
[🔒 Admin Routes]
│
├── /admin/users                    → จัดการ Users (Org Admin+)
│   ├── /admin/users/new            → เพิ่ม User
│   └── /admin/users/:id/edit       → แก้ไข User + Role
│
├── /admin/organizations            → จัดการ Orgs (Superadmin)
│   └── /admin/organizations/new
│
├── /admin/projects                 → จัดการ Projects (Superadmin)
│   └── /admin/projects/:id/contracts
│
├── /admin/doc-numbering            → Document Number Config (Superadmin)
│
└── /admin/audit-logs               → Audit Log Viewer (Superadmin + OrgAdmin)
```

---

## 2. 🧩 App Shell Layout

```
┌─────────────────────────────────────────────────────────────────┐
│ NAVBAR                                                          │
│  [🏗️ LCBP3-DMS]     [Project: LCBP3 ▼]    [🔔 3] [👤 สมชาย ▼] │
└─────────────────────────────────────────────────────────────────┘
┌──────────────┬──────────────────────────────────────────────────┐
│ SIDEBAR      │ MAIN CONTENT AREA                                │
│              │                                                  │
│ 📊 Dashboard │                                                  │
│ 📨 Corres.   │   [Page Content Here]                            │
│ 📋 RFA       │                                                  │
│ 📦 Transmit  │                                                  │
│ 📐 Drawings  │                                                  │
│ 📄 Circulat. │                                                  │
│ 🔍 Search    │                                                  │
│              │                                                  │
│ ─────────── │                                                  │
│ [Admin ▼]   │                                                  │
│  👥 Users   │                                                  │
│  🏢 Orgs    │                                                  │
│  ⚙️ Config  │                                                  │
└──────────────┴──────────────────────────────────────────────────┘

Mobile: Sidebar → Collapsible Hamburger Drawer (ตาม UI-Rule 5.11)
```

---

## 3. 📋 Screen Inventory

| Screen ID | Route                    | ชื่อหน้า                         | Primary Role | Priority  |
| --------- | ------------------------ | -------------------------------- | ------------ | --------- |
| SCR-001   | `/login`                 | Login                            | ทุก Role     | 🔴 Must   |
| SCR-002   | `/login/change-password` | Force Password Change            | ทุก Role     | 🔴 Must   |
| SCR-003   | `/dashboard`             | Dashboard                        | ทุก Role     | 🔴 Must   |
| SCR-004   | `/correspondences`       | Correspondence List              | Doc Control  | 🔴 Must   |
| SCR-005   | `/correspondences/new`   | Create Correspondence            | Doc Control  | 🔴 Must   |
| SCR-006   | `/correspondences/:uuid`   | Correspondence Detail + Workflow | ทุก Role     | 🔴 Must   |
| SCR-007   | `/rfas`                  | RFA List                         | Doc Control  | 🔴 Must   |
| SCR-008   | `/rfas/new`              | Create RFA                       | Doc Control  | 🔴 Must   |
| SCR-009   | `/rfas/:uuid`            | RFA Detail + Workflow            | ทุก Role     | 🔴 Must   |
| SCR-008b  | `/rfas/:uuid/edit`       | Edit Draft RFA                   | Doc Control  | 🔴 Must   |
| SCR-008c  | — (action modal)         | Cancel Draft RFA                 | Doc Control  | 🔴 Must   |
| SCR-008d  | `/rfas/search`            | RFA Search & Filter              | Doc Control  | 🔴 Must   |
| SCR-010   | `/transmittals`          | Transmittal List                 | Doc Control  | 🟠 Should |
| SCR-011   | `/transmittals/new`      | Create Transmittal               | Doc Control  | 🟠 Should |
| SCR-012   | `/transmittals/:uuid`      | Transmittal Detail               | ทุก Role     | 🟠 Should |
| SCR-013   | `/drawings/contract`     | Contract Drawing List            | Doc Control  | 🟠 Should |
| SCR-014   | `/drawings/shop`         | Shop Drawing List                | Doc Control  | 🟠 Should |
| SCR-015   | `/drawings/shop/:id`     | Shop Drawing Detail              | ทุก Role     | 🟠 Should |
| SCR-016   | `/circulations`          | Circulation List                 | Doc Control  | 🟠 Should |
| SCR-017   | `/circulations/new`      | Create Circulation               | Doc Control  | 🟠 Should |
| SCR-018   | `/circulations/:id`      | Circulation Detail               | ทุก Role     | 🟠 Should |
| SCR-019   | `/search`                | Search Results                   | ทุก Role     | 🟠 Should |
| SCR-020   | `/notifications`         | Notification Center              | ทุก Role     | 🟡 Could  |
| SCR-021   | `/profile`               | Profile & Settings               | ทุก Role     | 🟠 Should |
| SCR-022   | `/admin/users`           | User Management                  | Org Admin+   | 🔴 Must   |
| SCR-023   | `/admin/organizations`   | Organization Management          | Superadmin   | 🔴 Must   |
| SCR-024   | `/admin/projects`        | Project & Contract Mgmt          | Superadmin   | 🔴 Must   |
| SCR-025   | `/admin/doc-numbering`   | Document Number Config           | Superadmin   | 🟠 Should |
| SCR-026   | `/admin/audit-logs`      | Audit Log Viewer                 | Org Admin+   | 🟠 Should |

**รวม:** 29 หน้า (12 Must / 14 Should / 1 Could)

---

## 4. 🖼️ Wireframes — Key Screens

### SCR-001: Login Page

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│              🏗️ LCBP3-DMS                               │
│         ท่าเรือแหลมฉบัง เฟส 3                            │
│         Document Management System                      │
│                                                         │
│  ┌─────────────────────────────────────────────────┐    │
│  │                                                 │    │
│  │   ชื่อผู้ใช้ (Username)                          │    │
│  │   [________________________________]            │    │
│  │                                                 │    │
│  │   รหัสผ่าน (Password)                            │    │
│  │   [________________________________] [👁️]       │    │
│  │                                                 │    │
│  │   [ เข้าสู่ระบบ (Login)           ] ← Primary  │    │
│  │                                                 │    │
│  │   [ลืมรหัสผ่าน?]                                │    │
│  │                                                 │    │
│  └─────────────────────────────────────────────────┘    │
│                                                         │
│   ❌ Error Banner (แสดงเมื่อ Login ผิด):                 │
│   [⚠️ ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง]                  │
│                                                         │
│   v1.8.0 | Internal Use Only                           │
└─────────────────────────────────────────────────────────┘

Component Rules:
- Error Toast: แสดงทับ Form (ไม่บอกว่าอันไหนผิด — Security)
- Rate Limit: หลัง 5 ครั้ง → ปุ่ม Disabled 60 วินาที + Countdown
- Password: Toggle Show/Hide icon
- Auto-focus: Username field on load
- Enter key: Submit form
```

---

### SCR-003: Dashboard

```
┌─ Dashboard ─────────────────────────────────────────────────────────┐
│                                                                      │
│  📊 ภาพรวม — [สมชาย จาก สค.] วันนี้ 11 มี.ค. 2569                  │
│                                                                      │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐   │
│  │ 📨 Corres.  │ │ 📋 RFA      │ │ ⏰ Overdue   │ │ 🔒 Security │   │
│  │             │ │             │ │             │ │             │   │
│  │  Pending    │ │  Pending    │ │  Tasks      │ │  Files      │   │
│  │    [12]     │ │    [5]      │ │    [3]      │ │  Scanned    │   │
│  │             │ │             │ │             │ │   [847]     │   │
│  │ ← ↑3 จากเมื่อ │ │ ← ↓1 จากเมื่อ │ │ ⚠️ เกินกำหนด │ │ 0 Threats  │   │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘   │
│                                                                      │
│  ═══ งานของฉัน (My Tasks) ════════════════════════════════════════  │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ [Filter: ทั้งหมด ▼] [Status: Active ▼]   🔍 [ค้นหา...]      │   │
│  ├────────┬──────────────────┬──────────┬──────────┬────────────┤   │
│  │ ประเภท │ เลขที่/Subject   │ หน้าที่  │ กำหนด   │ การดำเนินการ│   │
│  ├────────┼──────────────────┼──────────┼──────────┼────────────┤   │
│  │ 📄 RFA │ LCBP3-RFA-STR.. │ Approve  │⚠️12 มี.ค.│ [ดำเนินการ]│   │
│  │ 📨 Cir │ สค.-กทท.-001... │ Review   │ 15 มี.ค. │ [ดำเนินการ]│   │
│  │ 📨 Cir │ สค.-กทท.-002... │ Info     │ 20 มี.ค. │ [ดำเนินการ]│   │
│  ├────────┴──────────────────┴──────────┴──────────┴────────────┤   │
│  │  แสดง 3 จาก 12 รายการ               [ดูทั้งหมด →]          │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘

Mobile (Card View):
┌───────────────────────┐
│ 📄 RFA                │
│ LCBP3-RFA-STR-0042    │
│ หน้าที่: Approve      │
│ ⚠️ กำหนด: 12 มี.ค.  │
│ [ดำเนินการ →]         │
└───────────────────────┘
```

---

### SCR-004: Correspondence List

```
┌─ Correspondence ────────────────────────────────────────────────────┐
│                                                                      │
│  [+ สร้างใหม่]  [📥 รับเข้า (12)] [📤 ส่งออก (8)]  [ทั้งหมด (20)]   │
│                                                                      │
│  [ Filter: ประเภท ▼ ] [ Filter: สถานะ ▼ ] [ Filter: วันที่ ▼ ]       │
│  🔍 [ค้นหาเอกสาร...                              ]  [ล้าง Filter]   │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │☐ │ เลขที่เอกสาร        │ Subject    │ ผู้ส่ง │วันที่│สถานะ  │    │
│  ├──┼─────────────────────┼────────────┼────────┼──────┼───────┤    │
│  │☐ │ LCBP3-สค-กทท-L-001 │ ขอแบบงาน.  │ สค.    │11มีค│✅ ปิด │    │
│  │☐ │ LCBP3-กทท-สค-L-002 │ ตอบรับ...  │ กทท.   │10มีค│🔄 ดำเนิน│   │
│  │☐⚠️│ LCBP3-สค-กทท-L-003 │ ขอข้อมูล.. │ สค.    │08มีค│⏰ เกิน │    │
│  │  │ ...                 │            │        │      │       │    │
│  └─────────────────────────────────────────────────────────────┘    │
│  [< 1 2 3 >]                              แสดง 15/47 รายการ         │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘

Status Badges:
🟡 Draft | 🔵 Submitted | 🔄 In Review | ✅ Closed | ❌ Cancelled | ⏰ Overdue
```

---

### SCR-005: Create Correspondence (Form)

```
┌─ สร้าง Correspondence ─────────────────────────────────────────────┐
│                                                                     │
│  Step 1: ข้อมูลทั่วไป ●─────── Step 2: แนบไฟล์ ○─── Step 3: ตรวจสอบ ○│
│                                                                     │
│  ┌───────────────────────────────────────────────────────────┐     │
│  │ ประเภทเอกสาร*          │ จาก (Originator)*               │     │
│  │ [Letter ▼]             │ [สค. (กำหนดอัตโนมัติ)]          │     │
│  │                        │                                  │     │
│  │ ถึง (To)*              │ สำเนา (CC)                      │     │
│  │ [เลือกองค์กร ▼][+ เพิ่ม]│ [เลือกองค์กร ▼][+ เพิ่ม]      │     │
│  │ Tag: กทท. ×            │                                  │     │
│  │                        │                                  │     │
│  │ Subject*                                                  │     │
│  │ [_____________________________________________]            │     │
│  │                        ○ ตัวอักษรที่เหลือ: 200            │     │
│  │                                                           │     │
│  │ เอกสารอ้างอิง (References)                                │     │
│  │ [🔍 ค้นหาเลขที่เอกสาร...           ]  [+ เพิ่ม]          │     │
│  │ หมวดหมู่ (Tags)                                           │     │
│  │ [🔍 ค้นหา Tag...] [construction] × [rfa] ×               │     │
│  │                                                           │     │
│  │ หมายเหตุ (Remark)                                         │     │
│  │ [_____________________________________________]            │     │
│  │ [_____________________________________________]            │     │
│  └───────────────────────────────────────────────────────────┘     │
│                                                                     │
│  ⚠️ Auto-save: บันทึกล่าสุด 13:28:45                               │
│                                                                     │
│  [← ยกเลิก]                    [บันทึก Draft]  [ต่อไป: แนบไฟล์ →]  │
└─────────────────────────────────────────────────────────────────────┘
```

---

### SCR-005b: File Attachment Step

```
┌─ สร้าง Correspondence — แนบไฟล์ ───────────────────────────────────┐
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                                                             │   │
│  │     📎 ลากและวางไฟล์ที่นี่ หรือ [เลือกไฟล์]               │   │
│  │                                                             │   │
│  │     รองรับ: PDF, DWG, ZIP, DOCX, XLSX (สูงสุด 100MB/ไฟล์) │   │
│  │                                                             │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ไฟล์ที่แนบ:                                                         │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │ ☑️ เอกสารหลัก │ 📄 drawing-v2.pdf        │ 2.3MB │ ✅ Scan OK│[🗑️]│
│  │ ☐ เอกสารหลัก │ 📐 detail.dwg             │ 1.1MB │ 🔄 Scanning│[🗑️]│
│  │ ☐ เอกสารหลัก │ 📦 supporting-docs.zip   │ 5.8MB │ ✅ Scan OK│[🗑️]│
│  └────────────────────────────────────────────────────────────┘    │
│                                                                     │
│  ℹ️ ☑️ = เอกสารหลัก (Main Document) — เลือกได้ 1 ไฟล์            │
│                                                                     │
│  ❌ Error File:                                                      │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │ 🚨 malware-test.pdf │ ❌ VIRUS DETECTED — ไฟล์ถูกปฏิเสธ   │    │
│  └────────────────────────────────────────────────────────────┘    │
│                                                                     │
│  [← ย้อนกลับ]                  [บันทึก Draft]  [ต่อไป: ตรวจสอบ →] │
└─────────────────────────────────────────────────────────────────────┘
```

---

### SCR-006: Correspondence Detail + Workflow

```
┌─ LCBP3-สค.-กทท.-LETTER-0001-68 ────────────────────────────────────┐
│  Subject: ขอข้อมูลแบบก่อสร้างเพิ่มเติม                              │
│  ส่งโดย: สค.  →  ถึง: กทท.   วันที่: 11 มี.ค. 2569                │
│  Status: 🔄 IN REVIEW                                               │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ TAB: [ข้อมูล] [📎 เอกสารแนบ (3)] [🔄 Workflow] [📋 Circulation]│   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  ═══ Workflow Diagram ════════════════════════════════════════════  │
│                                                                      │
│    ✅ Submit     ──→    🔄 Review    ──→    ○ ปิด                    │
│    (สค.)               (กทท.)              (สค.)                    │
│    11 มี.ค.            กำลังดำเนินการ        รอ                     │
│    [คลิกดู Log]        [คลิกดูรายละเอียด]                           │
│                                                                      │
│  ═══ Action Panel (แสดงเฉพาะ Step ที่ Active) ══════════════════   │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ 📋 งานของคุณ: Review เอกสารนี้และตอบกลับ                    │   │
│  │                                                              │   │
│  │ Comment / หมายเหตุ:                                          │   │
│  │ [___________________________________________________]        │   │
│  │ [___________________________________________________]        │   │
│  │                                                              │   │
│  │ [❌ ปฏิเสธ]  [✅ รับทราบ]  [📩 ตอบกลับ]                    │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  Admin Only: [⚡ Force Proceed →]  [↩️ Revert ←]                   │
└──────────────────────────────────────────────────────────────────────┘

Workflow Step Popup (คลิก Step ที่ผ่านแล้ว):
┌─────────────────────────────────┐
│ ✅ Submit — 11 มี.ค. 2569      │
│ โดย: สมชาย ก. (สค.)            │
│ เวลา: 09:32 น.                 │
│ IP: 192.168.1.10               │
│ Comment: -                     │
└─────────────────────────────────┘
```

---

### SCR-008: Create RFA (Form)

```
┌─ สร้าง RFA ────────────────────────────────────────────────────────┐
│                                                                     │
│  Step 1: ข้อมูล RFA ●── Step 2: Shop Drawing ○── Step 3: Transmittal ○│
│                                                                     │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │ ประเภท RFA*                │ สาขา (Discipline)*             │    │
│  │ [Shop Drawing ▼]           │ [Structural (STR) ▼]           │    │
│  │                                                             │    │
│  │ ⚠️ เลขที่ RFA (Auto-generated)                             │    │
│  │ Preview: LCBP3-RFA-STR-0043  (จะออกเมื่อ Submit)          │    │
│  │                                                             │    │
│  │ Contract Drawing ที่อ้างอิง                                 │    │
│  │ [🔍 ค้นหาแบบคู่สัญญา...    ]  [+ เลือก]                  │    │
│  │ → CD-STR-001: Foundation Plan ×                            │    │
│  │                                                             │    │
│  │ หมายเหตุ (Remark)                                           │    │
│  │ [____________________________________________]              │    │
│  └────────────────────────────────────────────────────────────┘    │
│                                                                     │
│  [← ยกเลิก]                   [บันทึก Draft]  [ต่อไป: แนบแบบ →]   │
└─────────────────────────────────────────────────────────────────────┘
```

---

### SCR-008b: Edit Draft RFA

```
┌─ แก้ไข RFA (Draft) ───────────────────────────────────────────────┐
│  LCBP3-RFA-STR-0042 | สถานะ: 🟡 DRAFT | แก้ไขล่าสุด: 13:28:45       │
│                                                                     │
│  ⚠️ สามารถแก้ไขได้เฉพาะในสถานะ Draft เท่านั้น                     │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ Subject*                                                   │    │
│  │ [ขออนุมัติแก้ไขแบบ Shop Drawing ส่วน Foundation...]         │    │
│  │                                                            │    │
│  │ Body/Description*                                         │    │
│  │ [เนื่องจากมีการเปลี่ยนแปลงรายละเอียด Connection Plate...]      │    │
│  │                                                            │    │
│  │ Remarks                                                    │    │
│  │ [_____________________________________________]             │    │
│  │                                                            │    │
│  │ 📋 RFA Details (JSON Schema v1) — ไม่สามารถแก้ไขได้         │    │
│  │ Drawing Count: 1 | Discipline: Structural | Due: 20 มี.ค.     │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                     │
│  📎 Shop Drawing (ไม่สามารถเปลี่ยนได้):                           │
│  ☑️ CD-STR-001-Foundation-RevA.pdf (2.3MB) ✅ Scan OK              │
│                                                                     │
│  [บันทึก Draft] [Submit →] [ยกเลิก]                               │
└─────────────────────────────────────────────────────────────────────┘

Validation:
- ถ้าสถานะ ≠ DRAFT → Redirect ไปหน้า detail พร้อม error toast
- Shop Drawing Revision ไม่สามารถเปลี่ยน (EC-RFA-001)
- Auto-save ทุก 2 วินาที
```

---

### SCR-008c: Cancel Draft RFA (Modal)

```
┌─ ยกเลิก RFA (Draft) ───────────────────────────────────────────────┐
│  LCBP3-RFA-STR-0042 | สถานะ: 🟡 DRAFT                            │
│                                                                     │
│  ⚠️ การยกเลิกจะทำให้ Shop Drawing Revision นี้สามารถสร้าง RFA ใหม่ได้ │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ เหตุผลการยกเลิก*                                        │    │
│  │ [_____________________________________________]             │    │
│  │                                                            │    │
│  │ เลือกเหตุผล:                                             │    │
│  │ ○ ข้อมูลไม่ครบถ้วย                                       │    │
│  │ ○ แก้ไขข้อมูลผิดพลาดหลายครั้ง                            │    │
│  │ ○ ไม่ต้องการส่งออกแล้ว                                 │    │
│  │ ○ อื่นๆ (ระบุ)                                           │    │
│  │                                                            │    │
│  │ [คำอธิบายเพิ่มเติม...]                                    │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                     │
│  🔔 ผู้ที่เกี่ยวข้องจะได้รับแจ้งเตือน:                           │
│  - Document Control ที่สร้าง RFA (Email + In-App)               │
│  - Admin ขององค์กร (ถ้ามีการตั้งค่า)                         │
│                                                                     │
│  [← กลับ]                    [✅ ยืนยันการยกเลิก]                 │
└─────────────────────────────────────────────────────────────────────┘

Post-cancel Flow:
- RFA status → CANCELLED
- Shop Drawing Revision.available → true
- Audit Log: CANCELLED + reason + user + timestamp
- Redirect ไปหน้า RFA List พร้อม success toast
```

---

### SCR-008d: RFA Search & Filter

```
┌─ ค้นหาและกรอง RFA ───────────────────────────────────────────────────┐
│  🔍 [ค้นหา RFA...] [ค้นหา]                                   [ตั้งค่ากรอง] │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ 📁 Project: [LCBP3 ▼]                                     │    │
│  │ 📊 Status: [ทั้งหมด ▼] 🟡DRAFT 🔵SUBMITTED 🔄FAP ✅APPROVED ❌REJECTED │    │
│  │ 📅 Revision: [ทั้งหมด ▼] CURRENT OLD ALL                     │    │
│  │ 🏢 Originator: [ทั้งหมด ▼] [สค.] [กทท.] [ผรม.] [คคง.]      │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                     │
│  พบ 15 รายการ (แสดงตามสิทธิ์ของคุณ)                         │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ ☐ │ เลขที่       │ Subject               | สถานะ | วันที่   │  │    │
│  ├──┼─────────────┼──────────────────────┼────────┼──────────┤    │
│  │ ☐ │ RFA-STR-0042 │ Foundation Plan Rev.A│ 🟡DRAFT │ 10 มี.ค. │[✏️]│    │
│  │ ☐ │ RFA-STR-0043 │ Column Detail Rev.B   │ 🔵SUBMIT│ 12 มี.ค. │[👁️]│    │
│  │ ☐ │ RFA-STR-0041 │ Beam Design Rev.A     │ ✅APPROV│ 08 มี.ค. │[👁️]│    │
│  │ ☐ │ RFA-STR-0040 │ Slab Detail Rev.A     | ❌REJECT│ 05 มี.ค. │[✏️]│    │
│  └────────┴─────────────┴──────────────────────┴────────┴──────────┘    │
│                                                                     │
│  [< 1 2 >] แสดง 10/15                                      [ส่งออก Excel] │
│                                                                     │
│  ⚠️ หมายเหตุ RBAC:                                              │
│  - DRAFT → เห็นเฉพาะ originator organization                      │
│  - สถานะอื่น → เห็นตาม project/contract scope                   │
└─────────────────────────────────────────────────────────────────────┘

Advanced Filters (Collapsible):
┌─ กรองขั้นสูง ───────────────────────────────────────────────────┐
│  📅 วันที่สร้าง: [____] ถึง [____]                              │
│  👤 ผู้สร้าง: [ค้นหา...]                                      │
│  📝 มีคำว่า: [ค้นหา...]                                      │
│  🏷️  Tags: [foundation] [column] [beam]                           │
│  [ค้นหา] [ล้าง]                                              │
└─────────────────────────────────────────────────────────────────┘
```

---

### SCR-009: RFA Detail + Workflow

```
┌─ LCBP3-RFA-STR-0042 ───────────────────────────────────────────────┐
│  ประเภท: Shop Drawing | สาขา: Structural | Revision: A             │
│  ยื่นโดย: ผรม.1  →  ผ่าน Transmittal: LCBP3-TRM-0015              │
│  Status: 🔄 UNDER REVIEW (คคง.)                                    │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ TAB: [ข้อมูล] [📎 Shop Drawing] [🔄 Workflow] [📝 Revision] │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ═══ Shop Drawing Viewer ════════════════════════════════════════  │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                                                             │   │
│  │         [ 📄 PDF Viewer — Streaming ]                      │   │
│  │                                                             │   │
│  │  ⬅️ หน้า 2/15 ➡️         🔍 80%       [⬇️ ดาวน์โหลด] ← (ถ้ามี)│  │
│  │                                                             │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ═══ Action Panel (เฉพาะ Reviewer) ════════════════════════════   │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ ผลการพิจารณา:                                               │   │
│  │ ○ Approved     ● Approved with Comments     ○ Rejected      │   │
│  │                                                             │   │
│  │ Comment (บังคับเมื่อ AW/C หรือ Rejected):                  │   │
│  │ [พบข้อผิดพลาดในรายละเอียด Connection Plate ...]           │   │
│  │                                                             │   │
│  │                          [ยกเลิก]  [✅ ยืนยันผลการพิจารณา]│   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘

Workflow Diagram สำหรับ RFA:
 ✅ Draft → ✅ Submitted → 🔄 TEAM Review → 🔄 คคง. Review → ○ APPROVED
                              (parallel)        (sequential)
```

---

### SCR-017: Create Circulation Sheet

```
┌─ สร้างใบเวียน (Circulation Sheet) ─────────────────────────────────┐
│  อ้างอิง: LCBP3-กทท-สค-LETTER-0012 — ขอข้อมูลงวดงานที่ 3         │
│                                                                     │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │ ผู้รับผิดชอบหลัก (Main — ต้องดำเนินการ)*                  │    │
│  │ [🔍 ค้นหาชื่อผู้ใช้...     ]  [+ เพิ่ม]                  │    │
│  │ → [👤 สมชาย ก. (หัวหน้า)] ×  [📅 กำหนด: 15 มี.ค.]       │    │
│  │                                                             │    │
│  │ ผู้ดำเนินการ (Action — ร่วมดำเนินการ)                     │    │
│  │ [🔍 ค้นหาชื่อผู้ใช้...    ]  [+ เพิ่ม]                   │    │
│  │ → [👤 วิชัย ส. (วิศวกร)] ×  [📅 กำหนด: 20 มี.ค.]        │    │
│  │                                                             │    │
│  │ รับทราบ (Information — เพื่อทราบเท่านั้น)                 │    │
│  │ [🔍 ค้นหาชื่อผู้ใช้...    ]  [+ เพิ่ม]                   │    │
│  │ → [👤 มานะ พ. (ผจก.)] ×                                   │    │
│  │                                                             │    │
│  │ หมายเหตุ / คำสั่งการ                                       │    │
│  │ [โปรดตรวจสอบและเตรียมข้อมูลงวดงานที่ 3...]                │    │
│  └────────────────────────────────────────────────────────────┘    │
│                                                                     │
│  [← ยกเลิก]                                [✅ สร้างและส่ง Notify] │
└─────────────────────────────────────────────────────────────────────┘
```

---

### SCR-022: User Management (Admin)

```
┌─ จัดการผู้ใช้งาน ───────────────────────────────────────────────────┐
│  องค์กร: สค. (สำนักงานโครงการ)     [+ เพิ่ม User ใหม่]             │
│                                                                      │
│  🔍 [ค้นหาชื่อ / อีเมล...]  [Role: ทั้งหมด ▼]  [สถานะ: Active ▼]  │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ ชื่อ              │ Username    │ Role           │ Status │   │   │
│  ├───────────────────┼─────────────┼────────────────┼────────┼───┤   │
│  │ สมชาย กิตติ      │ somchai.k   │ Document Ctrl  │ ✅     │[⚙️]│   │
│  │ วิชัย สมศรี      │ wichai.s    │ Editor         │ ✅     │[⚙️]│   │
│  │ มานะ พงษ์ดี      │ mana.p      │ Org Admin      │ ✅     │[⚙️]│   │
│  │ สมหญิง รักดี     │ somying.r   │ Viewer         │ ⛔     │[⚙️]│   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘

User Edit Drawer (Slide in from right):
┌──────────────────────────┐
│ แก้ไขผู้ใช้งาน           │
│ ────────────────────     │
│ ชื่อ: [สมชาย กิตติ    ] │
│ Email: [somchai@...   ] │
│ Role: [Document Ctrl ▼] │
│ Status: ✅ Active [Toggle]│
│                          │
│ [รีเซ็ตรหัสผ่าน]         │
│ [❌ ยกเลิก] [✅ บันทึก]  │
└──────────────────────────┘
```

---

### SCR-025: Document Number Config (Superadmin)

```
┌─ ตั้งค่าเลขที่เอกสาร ────────────────────────────────────────────────┐
│  Project: LCBP3  [+ เพิ่ม Format ใหม่]                               │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │ ประเภท          │ Format Template                │ Reset  │ Actn │ │
│  ├─────────────────┼────────────────────────────────┼────────┼──────┤ │
│  │ Letter          │ {PROJECT}-{ORIG}-{RECP}-L-{SEQ:4}-{YY}│ Yearly│[✏️]│ │
│  │ RFI             │ {PROJECT}-{ORIG}-{RECP}-I-{SEQ:4}-{YY}│ Yearly│[✏️]│ │
│  │ RFA-Shop Dwg    │ {PROJECT}-RFA-{DISC}-{SEQ:4}   │ Never  │[✏️]│ │
│  │ Transmittal     │ {PROJECT}-{ORIG}-{RECP}-T-{SEQ:4}-{YY}│ Yearly│[✏️]│ │
│  └─────────────────────────────────────────────────────────────────┘ │
│                                                                       │
│  Edit Format Inline:                                                  │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │ Template: [{PROJECT}-{ORIG}-{RECP}-L-{SEQ:4}-{YY}           ] │ │
│  │ Preview:  [LCBP3-สค.-กทท.-L-0001-68]                          │ │
│  │           ✅ Format ถูกต้อง                                    │ │
│  │ [ยกเลิก]                                          [✅ บันทึก]  │ │
│  └─────────────────────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────────────────┘
```

---

## 5. 🎨 Design System Reference

### Color Tokens

```css
/* Primary — ใช้กับ Action Buttons, Links */
--primary: hsl(221, 83%, 53%); /* Blue-600 */
--primary-hover: hsl(221, 83%, 45%);

/* Status Colors */
--status-draft: hsl(48, 96%, 53%); /* Yellow */
--status-submitted: hsl(217, 91%, 60%); /* Blue */
--status-fap: hsl(24, 95%, 53%); /* Orange */
--status-approved: hsl(142, 71%, 45%); /* Green */
--status-approved-wc: hsl(142, 71%, 35%); /* Green Dark */
--status-rejected: hsl(0, 84%, 60%); /* Red */
--status-cancelled: hsl(215, 14%, 55%); /* Gray */
--status-overdue: hsl(0, 84%, 60%); /* Red (same as rejected) */

/* Background */
--bg-base: hsl(222, 47%, 11%); /* Dark Navy (dark mode base) */
--bg-surface: hsl(222, 47%, 16%); /* Card surface */
--bg-muted: hsl(215, 28%, 17%); /* Muted sections */
```

### Typography

```css
font-family: 'Inter', 'Noto Sans Thai', sans-serif;

/* Scale */
--text-xs: 0.75rem; /* 12px — Badge, Caption */
--text-sm: 0.875rem; /* 14px — Table cell, Label */
--text-base: 1rem; /* 16px — Body */
--text-lg: 1.125rem; /* 18px — Subheading */
--text-xl: 1.25rem; /* 20px — Page title */
--text-2xl: 1.5rem; /* 24px — Dashboard KPI */
```

### Component States

| Component      | Default          | Hover            | Active              | Disabled        | Error          |
| -------------- | ---------------- | ---------------- | ------------------- | --------------- | -------------- |
| Button Primary | bg-primary       | bg-primary-hover | scale-95            | opacity-50      | —              |
| Button Secondary| bg-surface       | bg-muted         | scale-95            | opacity-50      | —              |
| Button Danger   | bg-red-500       | bg-red-600       | scale-95            | opacity-50      | —              |
| Input          | border-gray-300  | border-primary   | border-primary ring | border-gray-200 | border-red-500 |
| Table Row      | bg-surface       | bg-muted         | —                   | opacity-60      | bg-red-50      |
| Badge          | per status color | —                | —                   | —               | —              |

---

## 6. 📱 Responsive Breakpoints

| Breakpoint | Width      | Behavior                                |
| ---------- | ---------- | --------------------------------------- |
| `sm`       | < 640px    | Mobile: Sidebar → Drawer, Table → Cards |
| `md`       | 640-1024px | Tablet: Collapsed Sidebar               |
| `lg`       | > 1024px   | Desktop: Full Sidebar                   |

**Mobile-specific Rules (UI-Rule 5.11):**

- ตาราง → Card View อัตโนมัติ
- Sidebar → Collapsible Hamburger Drawer
- Action Panel → Bottom Sheet แทน Inline Panel

---

## 7. ⚡ Interaction Patterns

### Optimistic Updates (UI-Rule 5.10)

```
User กด "Approve" → UI เปลี่ยนสถานะทันที (ไม่รอ API)
   ↓
API ตอบกลับ Success → ยืนยัน UI ที่เปลี่ยนแล้ว
   ↓ (ถ้า API ล้มเหลว)
Rollback UI → แสดง Toast Error: "เกิดข้อผิดพลาด กรุณาลองใหม่"
```

### Auto-save Draft (UI-Rule 5.12)

```
User พิมพ์ใน Form → debounce 2 วินาที → บันทึกลง localStorage
ปิด Browser → เปิดใหม่ → แสดง Banner: "พบ Draft ที่บันทึกไว้ [กู้คืน] [ทิ้ง]"
```

### File Upload Progress

```
เลือกไฟล์ → แสดง Progress Bar → ClamAV Scan → ✅/❌
```

---

## 📝 Document Control

- **Version:** 1.8.1 | **Status:** updated
- **Created:** 2026-03-11 | **Updated:** 2026-03-24 | **Owner:** Nattanin Peancharoen
- **Changes:** Added SCR-008b~008d (Edit/Cancel/Search RFA), Updated routes to use UUID (ADR-019), Added new status colors and button variants, Sync with US-012a~012c and AC-RFA-007~009
- **Next Step:** สร้าง High-fidelity Mockup ใน Figma ตามโครงสร้างนี้
- **Figma Link:** [TBD — สร้างใน Figma Community หรือ Self-hosted Penpot]
- **Classification:** Internal Use Only
