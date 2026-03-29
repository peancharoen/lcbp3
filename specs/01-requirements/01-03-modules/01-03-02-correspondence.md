# 3.2 การจัดการเอกสารโต้ตอบ (Correspondence Management)

---

title: 'Functional Requirements: Correspondence Management'
version: 1.8.2
status: implemented
owner: Nattanin Peancharoen
last_updated: 2026-03-24
related:

- specs/01-requirements/01-01-objectives.md
- specs/01-requirements/01-03-modules/01-03-00-index.md
- specs/01-requirements/01-03-modules/01-03-06-unified-workflow.md
- specs/01-requirements/01-03-modules/01-03-08-circulation-sheet.md
- specs/01-requirements/01-06-edge-cases-and-rules.md (EC-CORR-001 ถึง EC-CORR-003)
- specs/03-Data-and-Storage/03-01-data-dictionary.md
- specs/01-requirements/01-02-business-rules/01-02-01-rbac-matrix.md

---

## 3.2.1. วัตถุประสงค์

เอกสารโต้ตอบ (Correspondence) คือ **โครงสร้างข้อมูลหลัก (Parent)** ของเอกสารทุกประเภทในระบบ — ทั้ง RFA, RFI, Transmittal, Letter ฯลฯ เป็นการสื่อสารระหว่างองค์กร-องค์กร ภายในโครงการ (Project) รองรับผู้รับหลัก (TO) และผู้รับสำเนา (CC) ได้หลายองค์กร

---

## 3.2.2. โครงสร้างข้อมูล (Database Tables)

| Table | บทบาท |
|---|---|
| `correspondences` | ข้อมูล Master: เลขเอกสาร, type, project, originator — ไม่เปลี่ยนตาม revision |
| `correspondence_revisions` | ประวัติแต่ละ Revision: subject, body, status, due_date |
| `correspondence_recipients` | ผู้รับ TO/CC (M:N กับ organizations) |
| `correspondence_references` | การอ้างอิงข้ามเอกสาร (M:N) |
| `correspondence_tags` | Tags ที่ติดกับเอกสาร (M:N) |
| `correspondence_attachments` | ไฟล์แนบ (M:N กับ attachments) |
| `correspondence_types` | Master: ประเภทเอกสาร (Global) |
| `correspondence_status` | Master: สถานะเอกสาร (Global) |

**ข้อสำคัญ:** `correspondence_number` ต้อง UNIQUE ภายใน Project เดียวกัน (`uq_corr_no_per_project`)

---

## 3.2.3. ประเภทเอกสาร (correspondence_types)

ประเภทเป็น Global Master — จัดการโดย Superadmin เท่านั้น:

| type_code | ชื่อ | มี Extension Table |
|---|---|---|
| `RFA` | Request for Approval | ✅ `rfas` + `rfa_revisions` |
| `RFI` | Request for Information | ❌ (ใช้ `details` JSON) |
| `TRANSMITTAL` | Transmittal | ❌ (ใช้ `details` JSON) |
| `EMAIL` | Email | ❌ |
| `INSTRUCTION` | Instruction | ❌ |
| `LETTER` | Letter | ❌ |
| `MEMO` | Memorandum | ❌ |
| `MOM` | Minutes of Meeting | ❌ |
| `NOTICE` | Notice | ❌ |
| `OTHER` | Other | ❌ |

ไฟล์แนบรองรับ **PDF, ZIP**

---

## 3.2.4. Fields ที่ต้องกรอกเมื่อสร้าง Correspondence

| Field | Required | หมายเหตุ |
|---|---|---|
| Project | ✅ | UUID |
| Correspondence Type | ✅ | INT id (Global) |
| Subject | ✅ | ขั้นต่ำ 5 ตัวอักษร — เก็บใน `correspondence_revisions` |
| To Organization | ✅ | UUID — `recipient_type = 'TO'` (≥ 1) |
| CC Organizations | ❌ | UUID[] — `recipient_type = 'CC'` |
| Discipline | ❌ | INT — กรองตาม Contract |
| Body | ❌ | เนื้อหา — เก็บใน `correspondence_revisions` |
| Description | ❌ | คำอธิบาย Revision |
| Remarks | ❌ | หมายเหตุ |
| Document Date | ❌ | วันที่ในเอกสาร |
| Due Date | ❌ | กำหนดส่งคืน |
| Tags | ❌ | UUID[] — จัดกลุ่มเพื่อค้นหาขั้นสูง |
| References | ❌ | UUID[] — อ้างอิงเอกสารฉบับก่อนหน้า |
| Attachments | ❌ | PDF/ZIP — ผ่าน ClamAV scan |
| Is Internal | ❌ | `is_internal_communication = 1` → ใช้ Circulation แทน |

### Document Number Preview

ระบบแสดง Preview เลขเอกสารแบบ Real-time ก่อน Submit เมื่อกรอกครบ: Project + Type + Discipline + To Organization โดยเรียก `POST /api/correspondences/preview-number`

---

## 3.2.5. การสร้างและสิทธิ์ (RBAC)

| การกระทำ | Role ที่อนุญาต | หมายเหตุ |
|---|---|---|
| สร้าง Correspondence (Draft) | Document Control, Org Admin, Superadmin | ภายในองค์กรตัวเอง |
| Submit Correspondence | Document Control, Org Admin, Superadmin | เปลี่ยนสถานะ DRAFT → SUB* |
| แก้ไข/ถอนกลับ/ยกเลิก หลัง Submit | **Org Admin ขึ้นไปเท่านั้น** พร้อมระบุเหตุผล | — |
| ดู Correspondence ที่ Draft | เฉพาะคนในองค์กรเดียวกัน | องค์กรอื่นมองไม่เห็น |
| ดู Correspondence ที่ Submitted แล้ว | ทุกคนที่มีสิทธิ์ใน Project | รวม TO และ CC org |
| จัดการ Correspondence Types (Master) | Superadmin | Global |

---

## 3.2.6. Status Codes (correspondence_status)

สถานะแบ่งตามหมวดและ Actor:

| หมวด | status_code | ชื่อ |
|---|---|---|
| **Draft** | `DRAFT` | Draft — มองเห็นเฉพาะ Originator Org |
| **Submitted** | `SUBOWN` | Submitted to Owner |
| | `SUBDSN` | Submitted to Designer |
| | `SUBCSC` | Submitted to CSC |
| | `SUBCON` | Submitted to Contractor |
| | `SUBOTH` | Submitted to Others |
| **Reply** | `REPOWN` | Reply by Owner |
| | `REPDSN` | Reply by Designer |
| | `REPCSC` | Reply by CSC |
| | `REPCON` | Reply by Contractor |
| | `REPOTH` | Reply by Others |
| **Resubmitted** | `RSBOWN` | Resubmitted by Owner |
| | `RSBDSN` | Resubmitted by Designer |
| | `RSBCSC` | Resubmitted by CSC |
| | `RSBCON` | Resubmitted by Contractor |
| **Closed** | `CLBOWN` | Closed by Owner |
| | `CLBDSN` | Closed by Designer |
| | `CLBCSC` | Closed by CSC |
| | `CLBCON` | Closed by Contractor |
| **Canceled** | `CCBOWN` | Canceled by Owner |
| | `CCBDSN` | Canceled by Designer |
| | `CCBCSC` | Canceled by CSC |
| | `CCBCON` | Canceled by Contractor |

---

## 3.2.7. การอ้างอิงและ Tags

- **References** (`correspondence_references`): M:N — เอกสารหนึ่งอ้างถึงได้หลายฉบับ ทิศทางเดียว (src → tgt)
- **Tags** (`correspondence_tags` + `tags`): M:N — Tag ผูกกับ Project หรือ Global (project_id = NULL)
- ทั้งสองอย่างใช้ค้นหาขั้นสูงใน Elasticsearch Index

---

## 3.2.8. Revision Model

- 1 Correspondence Master → หลาย Revision (1:N)
- `is_current = TRUE` มีได้เพียง 1 แถวต่อ correspondence (UNIQUE constraint)
- `revision_number`: 0-based integer สำหรับ sorting
- `revision_label`: กำหนดตามประเภทเอกสารดังนี้:
  | Type | Initial Label | ลำดับถัดไป | Format |
  |------|--------------|------------|--------|
  | **RFA, RFI** | `A` | B, C, D... | Alphabet |
  | **LETTER, MEMO, TRANSMITTAL, EMAIL, INSTRUCTION, NOTICE, MOM, OTHER** | `null` | 1, 2, 3... | Numeric |

**หมายเหตุ:** Shop Drawing และ As-Built Drawing ใช้ revision label แยกตามกฎของ Drawing Module (numeric '0', '1', '2'... หรือ user กำหนดเอง)

---

## 3.2.9. Workflow (Unified Workflow)

Correspondence ใช้ Unified Workflow Engine — ดูรายละเอียดที่ `01-03-06-unified-workflow.md`

เมื่อ Correspondence ถูก Submit → ผู้รับ (TO/CC) สามารถสร้าง **Circulation Sheet** เพื่อมอบหมายงานภายในองค์กร (ดู `01-03-08-circulation-sheet.md`)

---

## 3.2.10. Business Rules และ Edge Cases

| รหัส | กฎ | Severity |
|---|---|---|
| **EC-CORR-001** | Cancel Correspondence ที่มี Circulation เปิดอยู่ → ต้องยืนยันก่อน + Force Close Circulation ทั้งหมด + Audit Log | 🔴 Critical |
| **EC-CORR-002** | Reply ต่อ Correspondence ที่ถูก Cancel → ทำได้แต่ UI ต้องแสดง Warning | 🟡 Medium |
| **EC-CORR-003** | Originator และ Recipient เป็นองค์กรเดียวกัน → Block (ใช้ Circulation แทน) | 🟡 Medium |

ดูรายละเอียดครบที่ `01-06-edge-cases-and-rules.md` หมวด "Module 7: Correspondence Edge Cases"

---

## 3.2.11. Implementation Status (v1.8.2)

| Feature | Status | หมายเหตุ |
|---|---|---|
| Create/Update/List/Detail Correspondence | ✅ Done | Phase 1 |
| File Attachments (two-phase upload) | ✅ Done | Phase 2 |
| Recipients (TO/CC), Submit Workflow | ✅ Done | Phase 3 |
| Elasticsearch Indexing | ✅ Done | Phase 4 |
| Cancel + In-App Notifications (cancel/submit) | ✅ Done | Phase 4 |
| Reference Selector (outgoing/incoming) | ✅ Done | Phase 5 |
| Tag Manager (assign/remove tags) | ✅ Done | Phase 5–6 |
| Search `/search` — status filter + pagination | ✅ Done | Phase 6.1 |
| Circulation Status Card in detail sidebar | ✅ Done | Phase 6.2 |
| Revision History UI (timeline) | ✅ Done | Phase 6.3 |
| Due Date Reminder (`@Cron` daily at 08:00) | ✅ Done | Phase 6.4 |
| Email notification via Nodemailer/BullMQ | ✅ Done | Phase 7.1 — type `'EMAIL'` → NotificationProcessor sends Nodemailer |
| Unit tests (service layer ≥ 80%) | ✅ Done | Phase 7.2 — 8 backend + 5 frontend tests |
| Bulk operations (bulk cancel/export) | ✅ Done | Phase 7.3 — `POST /bulk-cancel`, `GET /export-csv`, CSV button |
