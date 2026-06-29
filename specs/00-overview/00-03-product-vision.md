# 🎯 Product Vision Statement — LCBP3-DMS v1.8.0

---

title: 'Product Vision Statement'
version: 1.0.0
status: APPROVED (Internal)
owner: Nattanin Peancharoen (Product Owner)
last_updated: 2026-03-11
related:

- specs/00-Overview/README.md
- specs/01-Requirements/01-01-objectives.md
- specs/00-Overview/00-04-stakeholder-signoff-and-risk.md

---

---

## 1. 🗣️ Elevator Pitch (30 วินาที)

> **LCBP3-DMS** คือระบบบริหารจัดการเอกสารก่อสร้าง On-Premise ที่ออกแบบมาเพื่อโครงการท่าเรือแหลมฉบัง เฟส 3 โดยเฉพาะ
>
> ระบบแปลงกระบวนการอนุมัติเอกสาร RFA ที่เคยใช้เวลา 2–3 สัปดาห์ผ่านอีเมล ให้กลายเป็น Workflow อัตโนมัติที่โปร่งใส ตรวจสอบได้ และเสร็จสิ้นภายใน 3–5 วัน
>
> รองรับการทำงานร่วมกันของ 5 องค์กรใน 4 โครงการ ด้วยสิทธิ์การเข้าถึงข้อมูลระดับองค์กร ที่ปลอดภัย ไม่มีข้อมูลรั่วไหลข้ามองค์กร

---

## 2. ❗ Problem Statement

### ปัญหาที่เกิดขึ้นจริง (Pain Points)

| #   | ปัญหา                                                   | ผลกระทบ                        |
| --- | ------------------------------------------------------- | ------------------------------ |
| P1  | **RFA ใช้ Email** → ตามงานยาก, ตกหล่น                   | Cycle Time 14–21 วัน, งานช้า   |
| P2  | **เลขเอกสารทำมือ** → ซ้ำ, ผิด                           | ต้องยกเลิกและออกเลขใหม่        |
| P3  | **ไม่รู้สถานะ** → ต้องโทรถาม                            | เสียเวลา ≥ 30 นาที/ครั้ง       |
| P4  | **หลาย Version ใน Email** → งง                          | ใช้แบบเวอร์ชันเก่า ก่อสร้างผิด |
| P5  | **ไม่มี Audit Trail** → ตรวจสอบยาก                      | พิสูจน์ไม่ได้ว่าใครอนุมัติ     |
| P6  | **ไม่มี Permission Control** → Contractor เห็นข้อมูลกัน | ความลับทางธุรกิจรั่ว           |
| P7  | **ไม่มีการแจ้งเตือน** → พลาด Deadline                   | งานเกินเวลา                    |
| P8  | **ค้นหาเอกสารยาก** → ต้องขอซ้ำ                          | ทำงานซ้ำ เสียเวลา              |

### ผู้ที่ได้รับผลกระทบ

- **Document Control:** ทำงานซ้ำซ้อน, นับเลขเอกสารมือ
- **Engineers / Reviewers:** รับงาน Review ช้า ไม่รู้ว่ามีงานรอ
- **PM / Supervisors:** ไม่มีภาพรวม Status ของเอกสารทั้งหมด
- **Management:** ไม่สามารถตรวจสอบ Audit Trail ย้อนหลังได้

---

## 3. 🌟 Vision Statement

> **"For construction document teams at LCBP3 who struggle with manual, email-based approval processes, LCBP3-DMS is an on-premise document intelligence platform that delivers automated multi-organization workflows, tamper-proof audit trails, and real-time visibility into every document's lifecycle.**
>
> **Unlike general-purpose DMS products, LCBP3-DMS is purpose-built for Thai construction project complexity — multi-contractor isolation, Thai document numbering conventions, and on-premise security requirements — making it the only system that truly fits how LCBP3 teams work."**

### โดยย่อ (3 คำ)

> **"Document. Approve. Trust."**

---

## 4. 🏛️ Strategic Pillars (3 เสาหลัก)

### Pillar 1: ⚡ Speed & Automation

ลด Cycle Time ของ RFA จาก 14 วัน → 3 วัน ด้วย:

- Auto Document Number (Redis Redlock — ไม่ซ้ำ, ไม่ต้องนับมือ)
- Workflow Automation (DSL-based — Route, Notify, Track อัตโนมัติ)
- Instant Notification (Email + LINE + In-App — ไม่ต้องโทรถาม)

### Pillar 2: 🔒 Security & Trust

ไม่มีข้อมูลรั่วไหล ไม่มีการปลอมแปลง ด้วย:

- 4-Level RBAC (Org Isolation — Contractor A ไม่เห็น Contractor B)
- Immutable Audit Trail (ทุก Action บันทึก ≥ 7 ปี ไม่แก้ไขได้)
- ClamAV Virus Scan ทุกไฟล์ + File Encryption at Rest
- On-Premise Deployment (ข้อมูลไม่ออก Internet)

### Pillar 3: 👁️ Visibility & Control

ทุกคนรู้ว่าเอกสารอยู่ที่ไหน ใครถือ ครบด้วย:

- Real-time Workflow Diagram (คลิกดู History ทุก Step)
- Dashboard: My Tasks, Overdue, KPI Cards
- Elasticsearch Full-text Search (ค้นหาได้ภายใน 500ms)
- Graceful Degradation (Core ยังทำงานแม้ Service รองล่ม)

---

## 5. 👥 Target Users (Primary)

| Persona                  | ต้องการอะไร                    | ได้อะไรจากระบบ                      |
| ------------------------ | ------------------------------ | ----------------------------------- |
| **Document Control**     | ออกเลข, ส่ง, Track เร็ว        | Auto-Number + Workflow Dashboard    |
| **Engineer / Reviewer**  | รับแจ้ง, Review ง่าย, Comment  | Notification + PDF Viewer + History |
| **PM / Supervisor**      | เห็น Big Picture, ติดตาม Delay | Dashboard KPI + Overdue Alerts      |
| **Management / Auditor** | ตรวจสอบย้อนหลัง                | Audit Log + Immutable History       |
| **กทท. (Owner)**         | Compliance + Control           | Permission Isolation + Reports      |

---

## 6. 🗺️ Product Roadmap Vision

```
Now (v1.8.0 — MVP)
├── Core DMS: Correspondence, RFA, Transmittal, Circulation
├── Workflow Engine: DSL-based Multi-Org Approval
├── Security: RBAC, Audit, ClamAV, JWT
└── ✅ "Every document has a number, a trail, and a home"

Phase 2 (3–6 เดือน) — Operational Excellence
├── Advanced Reporting & Export (PDF/Excel)
├── Visual Workflow Builder (No-code DSL Editor)
├── LINE Notify Deep Integration (Approve via LINE)
└── Mobile-Optimized Views

Phase 3 (6–12 เดือน) — Intelligence
├── AI-assisted Document Classification (Ollama)
├── Predictive Delay Alerts ("RFA นี้มีโอกาส Delay 70%")
├── Bulk Legacy Migration Assistant
└── API Gateway สำหรับ Integration กับ ERP/Cost Systems

Phase 4 (12–24 เดือน) — Enterprise Scale
├── Multi-Project / Multi-Tenant Architecture
├── SaaS Option (Cloud Deployment)
└── ขยายไปใช้กับโครงการท่าเรืออื่นๆ ของ กทท.
```

---

## 7. ✅ Definition of Success

### MVP Success (Go-Live + 3 เดือน)

| Metric                | Target                     | วิธีวัด                      |
| --------------------- | -------------------------- | ---------------------------- |
| **RFA Cycle Time**    | ≤ 5 วัน (จาก 14)           | Average จาก Workflow History |
| **User Adoption**     | > 90% Login ทุกวันทำการ    | System Analytics             |
| **Error Rate**        | < 1% Document Number Error | Audit Log                    |
| **Uptime**            | ≥ 99.5%                    | Monitoring Dashboard         |
| **User Satisfaction** | ≥ 4.0/5.0                  | Post Go-Live Survey          |

### Long-term Success (1 ปีหลัง Go-Live)

> "ทีมไม่จำเป็นต้องส่ง Email เพื่อติดตามเอกสารอีกต่อไป"
> "เลขเอกสารทุกฉบับถูกต้อง 100% โดยไม่ต้องมีคนนับ"
> "การตรวจสอบ Audit สามารถทำได้ภายใน 5 นาที"

---

## 8. 🚫 What We Are NOT Building (Guardrails)

การรู้ว่าเราไม่ทำอะไรสำคัญพอกับรู้ว่าเราทำอะไร:

| ❌ ไม่ทำ                     | เหตุผล                 | ทางเลือก                           |
| ---------------------------- | ---------------------- | ---------------------------------- |
| ระบบบัญชี / Finance          | Out of Scope — ใช้ ERP | SAP / Oracle Integration (Phase 4) |
| Project Scheduling (Gantt)   | Domain ต่างกัน         | Microsoft Project / Primavera      |
| HR / Payroll                 | ไม่เกี่ยวข้อง          | ระบบ HR ที่มีอยู่                  |
| Mobile Native App            | Phase 2+               | Web Responsive เพียงพอ ช่วงแรก     |
| Cloud SaaS                   | Data Sovereignty       | On-Premise (ADR-005)               |
| AI Document Generation       | Risk สูง ใน MVP        | Phase 3 (Ollama)                   |
| Real-time Video Conferencing | Out of Scope           | Microsoft Teams / Zoom             |

---

## 9. 📐 Design Principles

1. **Security First** — ไม่มี Feature ไหนสำคัญกว่าความปลอดภัยของข้อมูล
2. **Data Never Lies** — ทุก Action มี Audit Trail ไม่มีข้อยกเว้น
3. **Fail Gracefully** — ถ้า Service รองล่ม Core ต้องทำงานต่อได้
4. **Built for Thailand** — Thai language, Thai calendar, Thai org structure
5. **On-Premise by Design** — ไม่ส่งข้อมูลออก Internet โดยไม่จำเป็น
6. **Boring Technology** — ใช้เทคโนโลยีที่ Proven ไม่ใช่ Trendy

---

## 📝 Document Control

- **Version:** 1.0.0 | **Status:** APPROVED (Internal)
- **Created:** 2026-03-11 | **Owner:** Nattanin Peancharoen
- **Approved By:** Nattanin Peancharoen (PO) | กทท. Sign-off pending
- **Classification:** Internal Use Only
