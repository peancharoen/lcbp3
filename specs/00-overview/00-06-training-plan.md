# 🎓 Training & Change Management Plan — LCBP3-DMS v1.8.0

---

title: 'Training & Change Management Plan'
version: 1.0.0
status: DRAFT
owner: Nattanin Peancharoen (Product Owner / System Architect)
last_updated: 2026-03-11
related:

- specs/00-Overview/README.md
- specs/01-Requirements/01-01-objectives.md
- specs/01-Requirements/01-02-business-rules/01-02-01-rbac-matrix.md

---

## 1. 🎯 วัตถุประสงค์

> **"ระบบที่ดีที่สุดก็ล้มเหลวได้ ถ้าผู้ใช้ไม่รู้วิธีใช้"**

แผนนี้ครอบคลุม:

1. **Training Curriculum** — หลักสูตรฝึกอบรมแยกต่อ Role
2. **Training Materials** — สื่อและเอกสารการฝึกอบรม
3. **Train-the-Trainer** — กระบวนการเตรียม Trainer ภายในองค์กร
4. **Support Desk Setup** — ระบบ Support หลัง Go-Live
5. **Change Management** — การสื่อสารและรับมือกับ Change

---

## 2. 📅 Training Timeline

```
T-4 สัปดาห์ก่อน Go-Live:
├── สร้าง Training Materials ครบ
├── ติดตั้ง Staging Environment สำหรับ Training
└── เตรียม Trainer (Train-the-Trainer)

T-3 สัปดาห์:
├── Training: Superadmin + Org Admin (ทุกองค์กร)
└── UAT Pre-check กับ Admin ทุกคน

T-2 สัปดาห์:
├── Training: Document Control (ทุกองค์กร)
└── UAT ทดสอบ Workflow จริงบน Staging

T-1 สัปดาห์:
├── Training: Engineers / Reviewers / Viewers
├── UAT Sign-off
└── Dry Run Go-Live

Go-Live Day:
├── Hypercare Support (8:00–18:00 on-call)
└── ทีม Dev พร้อม Hotfix ตลอด

T+1 เดือน:
├── Hypercare สิ้นสุด
└── Handover ไป Standard Support
```

---

## 3. 👥 Target Audience & Training Groups

| Group | Role ในระบบ         | ผู้เข้าอบรม              | ระยะเวลา  | รูปแบบ              |
| ----- | ------------------- | ------------------------ | --------- | ------------------- |
| **A** | Superadmin          | ทีม NAP (1-2 คน)         | 4 ชั่วโมง | 1-on-1 Workshop     |
| **B** | Org Admin           | 1 คนต่อองค์กร × 5 องค์กร | 3 ชั่วโมง | Group Workshop      |
| **C** | Document Control    | 1-3 คนต่อองค์กร          | 4 ชั่วโมง | Group Workshop      |
| **D** | Engineer / Reviewer | หลายคนต่อองค์กร          | 2 ชั่วโมง | Group + Self-paced  |
| **E** | Viewer / Auditor    | ผู้บริหาร + Observer     | 1 ชั่วโมง | Video + Quick Guide |

> **หมายเหตุ:** Train-the-Trainer: แต่ละองค์กรมี Trainer 1 คน ก่อนอบรมองค์กรอื่น

---

## 4. 📚 Training Curriculum per Role

### 4.1 Group A — Superadmin (4 ชั่วโมง)

**เป้าหมาย:** ดูแลระบบทั้งหมด, Config Master Data, จัดการ Permission

| Module | หัวข้อ                                                  | เวลา    |
| ------ | ------------------------------------------------------- | ------- |
| A1     | System Architecture Overview (ภาพรวมระบบ, Docker, QNAP) | 30 นาที |
| A2     | สร้าง Organization, Project, Contract                   | 30 นาที |
| A3     | User Management — สร้าง/แก้ไข/Deactivate User           | 20 นาที |
| A4     | Document Number Template Config                         | 30 นาที |
| A5     | Workflow DSL — อ่านและแก้ไข Workflow Definitions        | 45 นาที |
| A6     | Permission & RBAC Matrix — กำหนดสิทธิ์ระดับ Global      | 30 นาที |
| A7     | Audit Log & Security Monitoring                         | 20 นาที |
| A8     | Backup & Restore (DR Runbook)                           | 20 นาที |
| A9     | Troubleshooting Guide (Common Issues)                   | 15 นาที |
| —      | **Q&A + Hands-on Practice**                             | 20 นาที |

**Deliverables:**

- [ ] Admin Quick Reference Card (A4 1 หน้า)
- [ ] System Admin Runbook (PDF)
- [ ] Access ไปยัง Grafana + phpMyAdmin Dashboard

---

### 4.2 Group B — Org Admin (3 ชั่วโมง)

**เป้าหมาย:** จัดการ User ภายในองค์กร, กำหนดสิทธิ์ระดับ Org

| Module | หัวข้อ                                         | เวลา    |
| ------ | ---------------------------------------------- | ------- |
| B1     | ภาพรวมระบบและ Role ของ Org Admin               | 20 นาที |
| B2     | เพิ่ม/แก้ไข/Deactivate User ในองค์กร           | 30 นาที |
| B3     | กำหนด Role: Document Control / Editor / Viewer | 20 นาที |
| B4     | Assign User เข้า Project และ Contract          | 20 นาที |
| B5     | ดู Audit Log ภายในองค์กร                       | 15 นาที |
| B6     | จัดการ Tags สำหรับองค์กร                       | 15 นาที |
| B7     | การรับมือ Lock Account / Reset Password        | 20 นาที |
| —      | **Hands-on Practice บน Staging**               | 30 นาที |
| —      | **Q&A**                                        | 10 นาที |

**Deliverables:**

- [ ] Org Admin User Manual (PDF, 10-15 หน้า)
- [ ] User Onboarding Checklist

---

### 4.3 Group C — Document Control (4 ชั่วโมง)

**เป้าหมาย:** สร้าง/ส่ง/ติดตามเอกสารทุกประเภท, จัดการ Workflow

| Module | หัวข้อ                                                        | เวลา    |
| ------ | ------------------------------------------------------------- | ------- |
| C1     | ภาพรวมระบบ DMS — ทำไมต้องเปลี่ยนจาก Email?                    | 15 นาที |
| C2     | Login + Dashboard + My Tasks                                  | 15 นาที |
| C3     | **สร้าง Correspondence** — Draft → Submit → Track             | 30 นาที |
| C4     | **สร้าง RFA + Shop Drawing** — Draft → Submit via Transmittal | 45 นาที |
| C5     | Upload ไฟล์ — Drag-and-Drop, Main vs Supporting, Virus Scan   | 20 นาที |
| C6     | **Circulation Sheet** — สร้าง, Assign, กำหนด Deadline         | 30 นาที |
| C7     | ติดตามสถานะ Workflow + Workflow Diagram                       | 20 นาที |
| C8     | Force Proceed / Revert Workflow (กรณีพิเศษ)                   | 15 นาที |
| C9     | ค้นหาเอกสาร + Advanced Filter                                 | 15 นาที |
| C10    | Notification Settings + LINE Notify                           | 15 นาที |
| —      | **Hands-on: ทำ Scenario จริงบน Staging**                      | 40 นาที |
| —      | **Q&A**                                                       | 20 นาที |

**Hands-on Scenarios (Staging):**

1. สร้าง Correspondence → Submit → Track Workflow
2. สร้าง RFA + Transmittal → ส่ง → รอ Response
3. รับ Correspondence → สร้าง Circulation → Assign

**Deliverables:**

- [ ] Document Control User Manual (PDF, 20-30 หน้า)
- [ ] Quick Reference Card: Document Types & Workflow States
- [ ] Video Tutorial: "สร้างและส่ง RFA" (15 นาที)
- [ ] FAQ Document (10 ข้อที่พบบ่อย)

---

### 4.4 Group D — Engineer / Reviewer (2 ชั่วโมง)

**เป้าหมาย:** รับและ Review เอกสาร, ตอบ RFA, ดู Circulation

| Module | หัวข้อ                                            | เวลา    |
| ------ | ------------------------------------------------- | ------- |
| D1     | Login + Dashboard + Notification Bell             | 15 นาที |
| D2     | ดู Correspondence ที่รับเข้ามา + PDF Viewer       | 20 นาที |
| D3     | **Review RFA** — Approved / w.Comments / Rejected | 30 นาที |
| D4     | ดู Shop Drawing ใน PDF Viewer (Streaming)         | 15 นาที |
| D5     | ตอบ Circulation ที่ได้รับมอบหมาย                  | 15 นาที |
| D6     | ค้นหาเอกสาร + ดู Workflow History                 | 10 นาที |
| D7     | ตั้งค่า Notification (Email/LINE)                 | 5 นาที  |
| —      | **Q&A**                                           | 10 นาที |

**Deliverables:**

- [ ] Reviewer Quick Guide (A4 2 หน้า)
- [ ] Video Tutorial: "วิธี Review RFA" (10 นาที)

---

### 4.5 Group E — Viewer / Auditor / Management (1 ชั่วโมง)

**เป้าหมาย:** ดู Dashboard, ค้นหา, ดาวน์โหลดรายงาน

| Module | หัวข้อ                        | เวลา    |
| ------ | ----------------------------- | ------- |
| E1     | Login + Dashboard Overview    | 10 นาที |
| E2     | ค้นหาเอกสารและดู Status       | 15 นาที |
| E3     | อ่านเอกสารใน PDF Viewer       | 10 นาที |
| E4     | ดู Audit Log (สำหรับ Auditor) | 10 นาที |
| E5     | ตั้งค่า Notification          | 5 นาที  |
| —      | **Q&A**                       | 10 นาที |

**Deliverables:**

- [ ] Viewer Quick Start (A4 1 หน้า, ภาษาไทย + อังกฤษ)

---

## 5. 🎥 Training Materials Checklist

### 5.1 เอกสาร (Documents)

| Material                     | Target     | สถานะ                       | Deadline    |
| ---------------------------- | ---------- | --------------------------- | ----------- |
| System Admin Runbook         | Group A    | ⬜ ต้องสร้าง                | T-4 สัปดาห์ |
| Org Admin User Manual        | Group B    | ⬜ ต้องสร้าง                | T-4 สัปดาห์ |
| Document Control User Manual | Group C    | ⬜ ต้องสร้าง                | T-4 สัปดาห์ |
| Reviewer Quick Guide         | Group D    | ⬜ ต้องสร้าง                | T-3 สัปดาห์ |
| Viewer Quick Start           | Group E    | ⬜ ต้องสร้าง                | T-3 สัปดาห์ |
| Glossary / คำศัพท์ระบบ       | ทุก Role   | ✅ มี (`00-02-glossary.md`) | —           |
| FAQ (10 ข้อพบบ่อย)           | Group C, D | ⬜ ต้องสร้าง                | T-2 สัปดาห์ |

### 5.2 Video Tutorials

| Video                             | ความยาว | Target   | สถานะ |
| --------------------------------- | ------- | -------- | ----- |
| ภาพรวมระบบ (System Intro)         | 5 นาที  | ทุก Role | ⬜    |
| วิธีสร้างและส่ง Correspondence    | 10 นาที | Group C  | ⬜    |
| วิธีสร้างและส่ง RFA + Transmittal | 15 นาที | Group C  | ⬜    |
| วิธี Review RFA                   | 10 นาที | Group D  | ⬜    |
| วิธีสร้าง Circulation Sheet       | 8 นาที  | Group C  | ⬜    |
| ค้นหาเอกสารและใช้ Filter          | 5 นาที  | ทุก Role | ⬜    |

> **เครื่องมือแนะนำ:** OBS Studio (Screen Record) + CapCut / DaVinci Resolve (Edit) + Loom (Quick Share)

### 5.3 Hands-on Training Scenarios (บน Staging)

```markdown
Scenario 1: "ส่ง RFA ครั้งแรก" (Group C)
───────────────────────────────────────

1. Login ด้วย Account Contractor A
2. Upload Shop Drawing (ไฟล์ PDF ตัวอย่าง)
3. สร้าง RFA Type: Shop Drawing — Discipline: STR
4. สร้าง Transmittal → แนบ RFA → Submit
5. ยืนยัน: Notification ถูกส่ง | เลขเอกสารถูกออก

Scenario 2: "Review และ Approve RFA" (Group D)
─────────────────────────────────────────────

1. Login ด้วย Account Engineer (TEAM หรือ คคง.)
2. ดู Notification Bell → เปิด RFA ที่ได้รับ
3. ดู Shop Drawing ใน PDF Viewer
4. คลิก "Approved with Comments" + กรอก Comment
5. ยืนยัน: Contractor ได้รับ Notification

Scenario 3: "สร้าง Circulation และติดตาม" (Group C)
───────────────────────────────────────────────

1. รับเอกสาร Correspondence ใน Inbox
2. สร้าง Circulation Sheet → Assign Main, Action, Info
3. กำหนด Deadline 3 วัน
4. Assignee Login → ดู My Tasks → ตอบกลับ
5. Document Control ปิด Circulation
```

---

## 6. 🏆 Train-the-Trainer Program

### 6.1 เป้าหมาย

แต่ละองค์กรมี **Internal Trainer** 1 คน ที่สามารถ:

- สอน User ใหม่ในองค์กรได้ด้วยตัวเอง
- ตอบ FAQ เบื้องต้นโดยไม่ต้องติดต่อ NAP
- รายงาน Issues ผ่าน Support Channel ได้ถูกต้อง

### 6.2 Internal Trainer คุณสมบัติ

- มักเป็น **Document Control** อาวุโส หรือ Org Admin
- เข้าร่วม Training Group A หรือ C ก่อน
- ผ่าน Hands-on Practice Scenario ทั้ง 3 ครบ
- ได้รับ "Trainer Kit" (Materials + Access พิเศษ)

### 6.3 Trainer Kit

```
📦 Trainer Kit ประกอบด้วย:
├── 📄 User Manuals (ทุก Role) — สำหรับแจกจ่าย
├── 🎥 Video Tutorials — ลิงก์ internal host
├── 🃏 Training Scenario Scripts (3 Scenarios)
├── ❓ FAQ Document
├── 📊 Staging Environment Access (ไม่กระทบ Production)
└── 📞 Escalation Contact: Nattanin (Line/Email)
```

---

## 7. 🆘 Support Desk Setup

### 7.1 Support Tiers

```
Level 1 — Internal Trainer (Self-service, 0-4 ชั่วโมง)
│  └── FAQ Document + Video Tutorials
│       ↓ ถ้าแก้ไม่ได้
Level 2 — Org Admin / Document Control (4-24 ชั่วโมง)
│  └── ติดต่อ Internal Trainer ขององค์กร
│       ↓ ถ้าแก้ไม่ได้
Level 3 — NAP Support (1-2 วันทำการ)
   └── LINE Group / Email → Nattanin
        ↓ ถ้าเป็น Bug หรือ System Issue
Level 4 — Dev Team (Hotfix / Patch)
   └── Fix + Deploy + Notify
```

### 7.2 Support Channels

| Channel                          | ใช้เมื่อ                  | Response Time             |
| -------------------------------- | ------------------------- | ------------------------- |
| **LINE Group** (NAP-DMS Support) | ปัญหาเร่งด่วน, ถามวิธีใช้ | 2-4 ชั่วโมง (ในเวลาทำงาน) |
| **Email** nattanin@[domain]      | รายงาน Bug, ขอ Feature    | 1-2 วันทำการ              |
| **FAQ Document**                 | ปัญหาทั่วไป               | ทันที (Self-service)      |
| **Video Tutortials**             | ต้องการดูวิธีใช้ซ้ำ       | ทันที (Self-service)      |

### 7.3 Hypercare Period (Go-Live Month 1)

**สัปดาห์ 1-2 (Go-Live):**

- NAP ทีม On-Call: 08:00–18:00 ทุกวันทำการ
- Daily Check-in กับ Internal Trainers ทุกองค์กร (15 นาที)
- Bug Tracker: บันทึก Issues ทั้งหมด (Priority P0-P3)

**สัปดาห์ 3-4:**

- On-Call: ตามปกติ (Response ภายใน 4 ชั่วโมง)
- Weekly Review: สรุป Issues + แก้ไข + FAQ Update

**หลัง 1 เดือน:**

- Standard Support (Level 1-4 ตามปกติ)
- Monthly Review Meeting

### 7.4 Bug Priority & SLA

| Priority          | ตัวอย่าง                | Response   | Resolution |
| ----------------- | ----------------------- | ---------- | ---------- |
| **P0 — Critical** | ระบบล่ม, Data Loss      | 30 นาที    | 4 ชั่วโมง  |
| **P1 — High**     | Login ไม่ได้, เอกสารหาย | 2 ชั่วโมง  | 24 ชั่วโมง |
| **P2 — Medium**   | Feature ทำงานผิด        | 4 ชั่วโมง  | 3 วัน      |
| **P3 — Low**      | UI ผิดเล็กน้อย, Typo    | 24 ชั่วโมง | 2 สัปดาห์  |

---

## 8. 📢 Change Management Communication Plan

### 8.1 Communication Timeline

| เวลา        | ข้อความ                                | ช่องทาง      | ผู้รับ              |
| ----------- | -------------------------------------- | ------------ | ------------------- |
| T-8 สัปดาห์ | Announcement: ระบบใหม่กำลังจะมา        | Email + LINE | ผู้บริหารทุกองค์กร  |
| T-4 สัปดาห์ | Training Schedule แจ้งรายละเอียด       | Email        | Org Admin ทุกองค์กร |
| T-2 สัปดาห์ | Training Reminder + Staging Access     | Email + LINE | ทุก User            |
| T-1 สัปดาห์ | "1 สัปดาห์แล้ว!" + Go-Live Date        | Email + LINE | ทุก User            |
| Go-Live Day | Go-Live Announcement + Support Contact | Email + LINE | ทุก User            |
| T+2 สัปดาห์ | Feedback Survey (Google Form)          | Email        | ผู้ใช้งานทุกคน      |
| T+1 เดือน   | Summary Report ต่อผู้บริหาร            | Meeting      | Project Management  |

### 8.2 Key Messages

**สำหรับผู้บริหาร:**

> "ระบบ LCBP3-DMS ช่วยให้ติดตามสถานะเอกสารได้ Real-time, ลดเวลา Cycle RFA จาก 2 สัปดาห์เหลือ 3 วัน, และมี Audit Trail ครบถ้วน"

**สำหรับ Document Control:**

> "ระบบนี้ช่วยลดการทำงานซ้ำซ้อนจาก Email ไปสู่ Workflow อัตโนมัติ เลขเอกสารออกอัตโนมัติ ไม่ต้องจำหรือนับมือ"

**สำหรับ Engineer / Reviewer:**

> "รับ Notification ทันทีเมื่อมี RFA ใหม่ ดู PDF ในระบบโดยไม่ต้อง Download คลิก Approve ได้เลย"

### 8.3 Resistance Management

| กลุ่มที่อาจต้าน        | เหตุผล           | วิธีรับมือ                               |
| ---------------------- | ---------------- | ---------------------------------------- |
| ผู้ใช้ที่คุ้นชิน Email | "Email ง่ายกว่า" | แสดง Case Study: วันไหน RFA ตกหล่น       |
| ผู้บริหารอาวุโส        | "ไม่ถนัด IT"     | เน้น: ดูสถานะได้ 1 คลิก, ไม่ต้องโทรถาม   |
| Document Control       | "งานเพิ่มขึ้น"   | แสดง: Auto-Number, Auto-Notify ลดงานจริง |
| IT/Ops ที่คุ้นระบบเดิม | "Server อะไรอีก" | ADR-015, Docker ง่ายต่อ Maintain         |

---

## 9. 📊 Training KPIs & Success Criteria

| KPI                         | Target                                     | วิธีวัด                       |
| --------------------------- | ------------------------------------------ | ----------------------------- |
| Training Attendance         | > 90% ของ Users ทุก Group                  | Sign-in Sheet                 |
| Post-Training Quiz Score    | > 80% เฉลี่ย                               | Online Quiz (Google Form)     |
| Hands-on Scenario Pass Rate | > 90% ทำ Scenario 1-3 ได้                  | Trainer Assessment            |
| Support Tickets Week 1      | < 20 tickets (แสดง Training มีประสิทธิภาพ) | Support Log                   |
| User Adoption Month 1       | > 70% Login ทุกวันทำการ                    | System Analytics              |
| User Adoption Month 3       | > 90% Active Users                         | System Analytics              |
| Satisfaction Score          | > 4.0/5.0                                  | Feedback Survey (T+2 สัปดาห์) |

---

## 10. ✅ Training Readiness Checklist (Pre Go-Live)

### Materials

- [ ] System Admin Runbook สร้างเสร็จ + Review แล้ว
- [ ] Document Control User Manual สร้างเสร็จ
- [ ] Quick Guides (Reviewer, Viewer) สร้างเสร็จ
- [ ] Video Tutorials อย่างน้อย 3 clips
- [ ] FAQ Document (10+ ข้อ) สร้างเสร็จ
- [ ] Training Scenarios (Staging Data) เตรียมพร้อม

### Infrastructure

- [ ] Staging Environment Deploy แล้ว (Mirror Production)
- [ ] Test Users ทุก Role สร้างแล้ว (1 ชุดต่อ Org)
- [ ] Email + LINE Notify บน Staging ทำงาน (Test Mode)
- [ ] Staging URL แจ้ง Trainers แล้ว

### People

- [ ] Internal Trainer แต่ละองค์กร ระบุชื่อแล้ว
- [ ] Train-the-Trainer Session เสร็จแล้ว
- [ ] Training Schedule แจ้งทุกคนแล้ว
- [ ] Support LINE Group สร้างแล้ว + เพิ่ม Users

### Process

- [ ] Bug Report Process อธิบายให้ Trainers แล้ว
- [ ] Escalation Path ชัดเจน
- [ ] Hypercare Schedule ตกลงกันแล้ว (ว่าใครรับผิดชอบวันไหน)

---

## 📝 Document Control

- **Version:** 1.0.0 | **Status:** DRAFT
- **Created:** 2026-03-11 | **Owner:** Nattanin Peancharoen
- **Next Review:** T-4 สัปดาห์ก่อน Go-Live
- **Classification:** Internal Use Only
