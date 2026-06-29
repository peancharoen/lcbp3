# 3.1 Project Management (การจัดการโครงสร้างโครงการและองค์กร)

---

title: "Functional Requirements: Project Management"
version: 1.8.1
status: updated
owner: Nattanin Peancharoen
last_updated: 2026-03-24
related:

- specs/01-requirements/01-01-objectives.md
- specs/01-requirements/01-03-modules/01-03-00-index.md
- specs/03-Data-and-Storage/03-01-data-dictionary.md
- specs/01-requirements/01-02-business-rules/01-02-01-rbac-matrix.md

---

## 3.1.1. วัตถุประสงค์

จัดการโครงสร้างหลักของระบบ ได้แก่ **Project → Contract → Organization → Discipline** — ทุกเอกสารในระบบผูกอยู่กับ Project และ/หรือ Contract เสมอ

---

## 3.1.2. โครงสร้างข้อมูล (Database Tables)

| Table | บทบาท |
|---|---|
| `projects` | ข้อมูล Master โครงการ: code, name, is_active |
| `contracts` | สัญญา ผูกกับ Project (N:1) |
| `organizations` | ข้อมูล Master องค์กร: code, name, role |
| `organization_roles` | Master: ประเภทองค์กร (OWNER/DESIGNER/ฯลฯ) |
| `project_organizations` | M:N: Project ↔ Organization |
| `contract_organizations` | M:N: Contract ↔ Organization + role_in_contract |
| `disciplines` | สาขางาน ผูกกับ Contract (N:1) |

### Hierarchy

```
Project (1)
  └── Contract (N)
        ├── Organization (M:N via contract_organizations)
        └── Discipline (N)

Project ↔ Organization (M:N via project_organizations)
```

---

## 3.1.3. Projects

| Field | Type | หมายเหตุ |
|---|---|---|
| `project_code` | VARCHAR(50) UNIQUE | รหัสโครงการ |
| `project_name` | VARCHAR(255) | ชื่อโครงการ |
| `is_active` | TINYINT(1) | 1 = Active |

- ปัจจุบันมี **4 โครงการ** — รองรับการเพิ่มในอนาคต
- จัดการโดย Superadmin เท่านั้น

---

## 3.1.4. Contracts

| Field | Type | หมายเหตุ |
|---|---|---|
| `project_id` | INT FK | ผูกกับ Project |
| `contract_code` | VARCHAR(50) UNIQUE | รหัสสัญญา |
| `contract_name` | VARCHAR(255) | ชื่อสัญญา |
| `start_date` / `end_date` | DATE | ระยะเวลาสัญญา |
| `is_active` | BOOLEAN | สถานะ |

- 1 Project มีได้หลาย Contract (≥ 1)
- Document Number ผูกกับ Contract (ไม่ใช่ Project)

---

## 3.1.5. Organizations และ Organization Roles

### Organization Roles (organization_roles)

| role_name | ความหมาย | สามารถอยู่ใน |
|---|---|---|
| `OWNER` | เจ้าของโครงการ | หลาย Project / หลาย Contract |
| `DESIGNER` | ผู้ออกแบบ | หลาย Project / หลาย Contract |
| `CONSULTANT` | ที่ปรึกษา | หลาย Project / หลาย Contract |
| `CONTRACTOR` | ผู้รับเหมา | **1 Contract / 1 Project เท่านั้น** |
| `THIRD PARTY` | บุคคลที่สาม | หลาย Project / หลาย Contract |

### project_organizations (M:N)
- ผูก Organization เข้า Project — ไม่มี role_in_contract ระดับ Project

### contract_organizations (M:N)
- ผูก Organization เข้า Contract พร้อม `role_in_contract` (Owner/Designer/Consultant/Contractor)
- 1 Organization สามารถมีหลาย role ใน Contract เดียวกันได้

---

## 3.1.6. Disciplines (สาขางาน)

Discipline ผูกกับ **Contract** (ไม่ใช่ Project):

| Field | หมายเหตุ |
|---|---|
| `contract_id` | FK → contracts |
| `discipline_code` | VARCHAR(10) เช่น GEN, STR, MEP |
| `code_name_th` / `code_name_en` | ชื่อภาษาไทย/อังกฤษ |
| `is_active` | สถานะ |

- UNIQUE KEY `(contract_id, discipline_code)` — code ซ้ำได้ระหว่าง Contract
- ใช้กรอง RFA Type และ Correspondence ต่อ Contract

---

## 3.1.7. การสร้างและสิทธิ์ (RBAC)

| การกระทำ | Role ที่อนุญาต | Scope |
|---|---|---|
| สร้าง / แก้ไข Project | Superadmin | Global |
| สร้าง / แก้ไข Contract | Superadmin, Org Admin | Project |
| สร้าง / แก้ไข Organization | Superadmin | Global |
| เพิ่ม Organization เข้า Project/Contract | Superadmin | Global |
| จัดการ Disciplines | Superadmin, Org Admin | Contract |
| ดู Project / Contract | ทุกคนที่มีสิทธิ์ใน Project | Project |
