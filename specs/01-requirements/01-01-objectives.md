# 📌 Section 1: Objectives (วัตถุประสงค์)

---

title: 'Objectives'
version: 1.8.1
status: updated
owner: Nattanin Peancharoen
last_updated: 2026-03-24
related:

- specs/00-Overview/00-03-product-vision.md
- specs/01-Requirements/01-04-user-stories.md
- specs/01-Requirements/01-05-acceptance-criteria.md
- specs/01-Requirements/01-03-modules/01-03-00-index.md
- specs/06-Decision-Records/ADR-005-technology-stack.md

---

> [!NOTE]
> เอกสารนี้กำหนด **วัตถุประสงค์และขอบเขตของ LCBP3-DMS** ซึ่งเป็นเอกสารอ้างอิงหลักสำหรับการตัดสินใจทางสถาปัตยกรรมและ Feature Prioritization

---

## 1. 🎯 วัตถุประสงค์หลัก (Primary Objectives)

สร้างระบบบริหารจัดการเอกสารโครงการ (Document Management System) สำหรับโครงการก่อสร้างท่าเรือแหลมฉบังระยะที่ 3 ที่รองรับองค์กรผู้มีส่วนได้ส่วนเสียหลายฝ่าย ได้แก่ กทท., สค., ผรม., คคง. โดยมีเป้าหมายดังนี้:

| # | วัตถุประสงค์ | KPI ที่วัดได้ | สถานะ |
|---|------------|------------|------|
| O-01 | จัดการวงจรชีวิตเอกสาร (Correspondence, RFA, Transmittal) แบบครบวงจร | Document turnaround time ลดลง ≥ 50% จาก Manual | 🔄 UAT |
| O-02 | บังคับใช้ RBAC 4 ระดับ (Global/Org/Project/Contract) ผ่าน CASL | ไม่พบ Unauthorized Access ใน Penetration Test | ✅ Done |
| O-03 | ป้องกัน Race Condition ในการออกเลขเอกสาร ด้วย Redis Redlock | Duplicate document number = 0 ใน load test 50 concurrent | ✅ Done |
| O-04 | ตรวจสอบไวรัสทุกไฟล์ที่อัปโหลด ด้วย ClamAV | Malware detection rate = 100% จาก EICAR test | ✅ Done |
| O-05 | รองรับ Full-text Search ข้ามเอกสารทั้งหมด ด้วย Elasticsearch | Search response time < 500ms สำหรับ 10K documents | ✅ Done |
| O-06 | รองรับ ~20,000 เอกสารที่มีอยู่เดิม ผ่าน Migration Bot (n8n + Ollama) | Migration accuracy ≥ 95% | 🔄 Planned |
| O-07 | บันทึก Audit Log ทุก Action ที่สำคัญในระบบ | Audit trail ครบ 100% สำหรับ CRUD + Workflow events | ✅ Done |
| O-08 | ระบบพร้อมรองรับ 100 concurrent users โดยไม่มี degradation | API response time < 200ms (P95) ที่ 100 VUs | 🔄 UAT |

---

## 2. 🧩 ขอบเขตระบบ (Scope)

### ✅ In Scope — ฟีเจอร์ที่พัฒนาใน LCBP3-DMS

| Module | คำอธิบาย | อ้างอิง |
|--------|---------|--------|
| **Correspondence** | จดหมาย/เอกสารระหว่างองค์กร พร้อม Workflow | US-001~005 |
| **RFA (Request for Approval)** | ขออนุมัติ Shop Drawing พร้อม Transmittal | US-006~012c |
| **Transmittal** | ส่งเอกสารจำนวนมากพร้อมกัน | US-013~015 |
| **Shop Drawing** | จัดการแบบก่อสร้างพร้อม Revision History | US-016~018 |
| **Contract Drawing** | จัดการแบบคู่สัญญา | US-019~020 |
| **As-built Drawing** | จัดการแบบ As-built พร้อม Revision | US-021~022 |
| **Circulation Sheet** | เวียนเอกสารภายในองค์กร | US-023~025 |
| **Document Numbering** | ออกเลขเอกสารอัตโนมัติ พร้อม Format Config | ADR-002 |
| **Workflow Engine** | State machine สำหรับกระบวนการอนุมัติ | ADR-001 |
| **RBAC** | สิทธิ์ 4 ระดับผ่าน CASL | ADR-016 |
| **Full-text Search** | ค้นหาข้ามเอกสารทั้งหมด | Elasticsearch |
| **Audit Log** | บันทึกทุก Action สำคัญ | — |
| **Notifications** | แจ้งเตือน In-App, Email, LINE | ADR-008 |
| **Admin Panel** | จัดการ Users, Orgs, Projects, Configs | SCR-022~026 |
| **Migration Bot** | นำเข้าเอกสารเดิม ~20K docs | ADR-017 |

### ❌ Out of Scope — ไม่รวมในโครงการนี้

- ระบบบัญชี / ERP Integration
- Mobile Native App (iOS/Android) — รองรับเฉพาะ Responsive Web
- Electronic Signature (e-Signature) ตามกฎหมาย
- Video Conference / Real-time Collaboration Editor
- IoT / Sensor Data Integration

---

## 3. 🏗️ บริบทธุรกิจ (Business Context)

**โครงการ:** ท่าเรือแหลมฉบัง ระยะที่ 3 (Laem Chabang Port Phase 3)
**ผู้ใช้งาน:** 4 องค์กรหลัก — กทท. (PAT), สค. (PMC), ผรม. (Contractor), คคง. (Consultant)
**ปัญหาเดิมที่แก้ไข:**

- เอกสารเดิมอยู่ในรูปแบบกระดาษและไฟล์กระจัดกระจาย (~20,000 รายการ)
- ไม่มีระบบ Version Control สำหรับแบบก่อสร้าง
- กระบวนการอนุมัติต้องส่งเอกสารผ่านอีเมลหรือมือ ใช้เวลานาน
- ไม่มีการตรวจสอบสิทธิ์ที่รัดกุม ทำให้ข้อมูลรั่วไหลได้
- ไม่มี Audit Trail สำหรับการตรวจสอบย้อนหลัง

---

## 4. 📐 Architectural Principles (หลักการออกแบบ)

| หลักการ | รายละเอียด | ADR |
|--------|---------|-----|
| **Security-First** | RBAC ทุก Endpoint, JWT, Helmet.js, ClamAV | ADR-016 |
| **Data Integrity** | UUID-based routing (ป้องกัน IDOR), Optimistic Locking | ADR-019 |
| **No Magic Migrations** | แก้ไข Schema SQL โดยตรง ไม่ใช้ ORM Migration | ADR-009 |
| **Thin Controller** | Business Logic อยู่ใน Service Layer เท่านั้น | — |
| **Unified Workflow** | State Machine เดียวสำหรับทุก Workflow | ADR-001 |
| **Hybrid Identifier** | INT PK (internal) + UUIDv7 (public API) | ADR-019 |
| **Queue-based Notifications** | BullMQ → Email/LINE/In-App async | ADR-008 |
| **Observable System** | Prometheus + Loki + Grafana | ADR-010 |

---

## 5. ✅ เกณฑ์ความสำเร็จ (Success Criteria)

ระบบถือว่าพร้อม Go-Live เมื่อ:

- [ ] UAT ผ่าน ≥ 95% ของ Test Cases ใน `01-05-acceptance-criteria.md`
- [ ] ไม่พบ Critical Bug (Severity 1) ที่ค้างอยู่
- [ ] Performance Test ผ่านที่ 100 concurrent users (API < 200ms P95)
- [ ] Security Audit ผ่าน (0 High/Critical Vulnerabilities)
- [ ] Sign-off จากตัวแทนทั้ง 4 องค์กร ตาม `00-04-stakeholder-signoff-and-risk.md`
- [ ] Runbook และ Backup/Recovery Plan พร้อม ตาม `04-02-backup-recovery.md`

---

## 📝 Document Control

- **Version:** 1.8.1 | **Status:** updated
- **Created:** 2026-02-23 | **Updated:** 2026-03-24 | **Owner:** Nattanin Peancharoen
- **Changes:** Expanded from stub to full objectives document — added KPI table, scope, business context, architectural principles, success criteria
- **Classification:** Internal Use Only
