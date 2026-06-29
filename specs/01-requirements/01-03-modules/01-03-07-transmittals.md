# 3.7 Transmittals Management (การจัดการเอกสารนำส่ง)

---

title: 'Functional Requirements: Transmittals Management'
version: 1.8.1
status: updated
owner: Nattanin Peancharoen
last_updated: 2026-03-24
related:

- specs/01-requirements/01-01-objectives.md
- specs/01-requirements/01-03-modules/01-03-00-index.md
- specs/01-requirements/01-03-modules/01-03-02-correspondence.md
- specs/01-requirements/01-03-modules/01-03-03-rfa.md
- specs/01-requirements/01-06-edge-cases-and-rules.md (EC-RFA-004)
- specs/03-Data-and-Storage/03-01-data-dictionary.md
- specs/01-requirements/01-02-business-rules/01-02-01-rbac-matrix.md

---

## 3.7.1. วัตถุประสงค์

เอกสารนำส่ง (Transmittal) ใช้สำหรับรวบรวมเอกสารหลายฉบับ (เช่น RFA) แล้วส่งเป็นชุดไปยังองค์กรอื่นในคราวเดียว เป็น **Correspondence ประเภทหนึ่ง** (`type_code = 'TRANSMITTAL'`) — ใช้ pattern **Correspondence + Extension** เช่นเดียวกับ RFA

---

## 3.7.2. โครงสร้างข้อมูล (Database Tables)

| Table | บทบาท |
|---|---|
| `correspondences` | ข้อมูลหลัก: เลขเอกสาร, subject, project, originator, recipients |
| `transmittals` | ข้อมูลเฉพาะ Transmittal: `purpose`, `remarks` — FK = `correspondences.id` |
| `transmittal_items` | รายการเอกสารที่นำส่งใน Transmittal นั้น (M:N กับ `correspondences`) |

**ข้อสำคัญ:** `transmittals.correspondence_id` คือ PK และ FK ชี้ไปที่ `correspondences.id` (ไม่มี AUTO_INCREMENT ของตัวเอง)

---

## 3.7.3. Fields ที่ต้องกรอกเมื่อสร้าง Transmittal

| Field | Required | หมายเหตุ |
|---|---|---|
| Project | ✅ | UUID — เหมือน Correspondence ทั่วไป |
| Correspondence Type | ✅ | ต้องเป็น `TRANSMITTAL` |
| Subject | ✅ | ขั้นต่ำ 5 ตัวอักษร |
| To Organization | ✅ | UUID — `recipient_type = 'TO'` |
| Purpose | ❌ | ENUM — วัตถุประสงค์การนำส่ง |
| Remarks | ❌ | หมายเหตุ |
| Items (เอกสารที่นำส่ง) | ❌ | UUID[] — รายการ Correspondence ที่แนบ |

### Purpose ENUM (transmittals.purpose)

| purpose | ความหมาย |
|---|---|
| `FOR_APPROVAL` | นำส่งเพื่อขออนุมัติ |
| `FOR_INFORMATION` | นำส่งเพื่อทราบ |
| `FOR_REVIEW` | นำส่งเพื่อตรวจสอบ |
| `OTHER` | วัตถุประสงค์อื่น |

---

## 3.7.4. transmittal_items

รายการเอกสารที่แนบใน Transmittal:

| Field | หมายเหตุ |
|---|---|
| `transmittal_id` | FK → `transmittals.correspondence_id` |
| `item_correspondence_id` | FK → `correspondences.id` — เอกสารที่นำส่ง (เช่น RFA) |
| `quantity` | จำนวน (default = 1) |
| `remarks` | หมายเหตุสำหรับรายการนี้ |

- UNIQUE KEY `(transmittal_id, item_correspondence_id)` — ป้องกันเอกสารซ้ำใน Transmittal เดียวกัน
- 1 Transmittal รวบรวมเอกสารได้หลายฉบับ
- เอกสารที่นำส่งได้ไม่จำกัดประเภท (RFA, Letter, ฯลฯ)

---

## 3.7.5. การสร้างและสิทธิ์ (RBAC)

| การกระทำ | Role ที่อนุญาต | หมายเหตุ |
|---|---|---|
| สร้าง Transmittal (Draft) | Document Control, Org Admin, Superadmin | ภายในองค์กรตัวเอง |
| Submit Transmittal | Document Control, Org Admin, Superadmin | ต้องผ่าน EC-RFA-004 ก่อน |
| แก้ไข/ยกเลิก หลัง Submit | **Org Admin ขึ้นไปเท่านั้น** พร้อมระบุเหตุผล | — |
| ดู Transmittal ที่ Draft | เฉพาะคนในองค์กรเดียวกัน | — |
| ดู Transmittal ที่ Submitted | ทุกคนที่มีสิทธิ์ใน Project | — |

---

## 3.7.6. Business Rules และ Edge Cases

| รหัส | กฎ | Severity |
|---|---|---|
| **EC-RFA-004** | Transmittal Submit ได้เฉพาะเมื่อ **ทุกเอกสารใน Transmittal** อยู่ในสถานะ READY (ไม่ใช่ DRAFT) — ถ้ามี DRAFT → 422 "RFA [เลข] ยังอยู่ใน Draft กรุณา Submit ก่อน" | 🟠 High |

ดูรายละเอียดครบที่ `01-06-edge-cases-and-rules.md` หมวด "Module 4: RFA & Drawing Edge Cases"
