# 3.5 Shop Drawing Management (การจัดการแบบก่อสร้าง)

---

title: 'Functional Requirements: Shop Drawing Management'
version: 1.8.1
status: updated
owner: Nattanin Peancharoen
last_updated: 2026-03-24
related:

- specs/01-requirements/01-01-objectives.md
- specs/01-requirements/01-03-modules/01-03-00-index.md
- specs/01-requirements/01-03-modules/01-03-03-rfa.md
- specs/01-requirements/01-03-modules/01-03-04-contract-drawing.md
- specs/01-requirements/01-06-edge-cases-and-rules.md (EC-RFA-001, EC-RFA-003)
- specs/03-Data-and-Storage/03-01-data-dictionary.md
- specs/01-requirements/01-02-business-rules/01-02-01-rbac-matrix.md

---

## 3.5.1. วัตถุประสงค์

แบบก่อสร้าง (Shop Drawing) คือแบบที่ Contractor จัดทำขึ้นเพื่อขออนุมัติจากผู้ว่าจ้างหรือที่ปรึกษา โดยส่งผ่าน RFA (Request for Approval) — มี Revision Model (Rev.A, Rev.B, ...) และอ้างอิง Contract Drawing ที่เป็นต้นฉบับได้

---

## 3.5.2. โครงสร้างข้อมูล (Database Tables)

| Table | บทบาท |
|---|---|
| `shop_drawings` | ข้อมูล Master: เลขแบบ, หมวดหมู่หลัก, หมวดหมู่ย่อย, project |
| `shop_drawing_revisions` | ประวัติแต่ละ Revision: title, revision_label, is_current, revision_date |
| `shop_drawing_revision_contract_refs` | M:N: Revision ↔ Contract Drawing ที่อ้างอิง |
| `shop_drawing_revision_attachments` | ไฟล์แนบต่อ Revision (M:N กับ `attachments`) |
| `shop_drawing_main_categories` | Master: หมวดหมู่หลัก (ผูกกับ Project) |
| `shop_drawing_sub_categories` | Master: หมวดหมู่ย่อย (ผูกกับ Project) |

**ข้อสำคัญ:**
- `drawing_number` ต้อง UNIQUE ภายใน Project (`ux_shop_dwg_no_project`)
- `is_current = TRUE` มีได้เพียง 1 แถวต่อ Shop Drawing (`uq_sd_current`)

---

## 3.5.3. Fields ที่ต้องกรอกเมื่อสร้าง Shop Drawing

### Master (shop_drawings)

| Field | Required | หมายเหตุ |
|---|---|---|
| Project | ✅ | UUID |
| Drawing Number | ✅ | VARCHAR(100) — unique per project |
| Main Category | ✅ | INT id — FK → `shop_drawing_main_categories` |
| Sub Category | ✅ | INT id — FK → `shop_drawing_sub_categories` |

### Revision (shop_drawing_revisions)

| Field | Required | หมายเหตุ |
|---|---|---|
| Title | ✅ | VARCHAR(500) — ชื่อแบบใน Revision นี้ |
| Revision Label | ❌ | VARCHAR(10) เช่น A, B, 1.1 |
| Revision Date | ❌ | DATE |
| Description | ❌ | คำอธิบายการแก้ไข |
| Legacy Drawing Number | ❌ | VARCHAR(100) — เลขแบบเดิม (สำหรับข้อมูล Migration) |
| Contract Drawing Refs | ❌ | UUID[] — อ้างอิง Contract Drawing ต้นฉบับ |
| Attachments | ❌ | PDF / DWG / SOURCE / OTHER — ผ่าน ClamAV scan |

---

## 3.5.4. ไฟล์แนบ (shop_drawing_revision_attachments)

ไฟล์แนบผูกกับ **Revision** ไม่ใช่ Master — รองรับหลายไฟล์ต่อ 1 Revision:

| file_type | ความหมาย |
|---|---|
| `PDF` | ไฟล์ PDF แบบดิจิทัล |
| `DWG` | ไฟล์ AutoCAD |
| `SOURCE` | ไฟล์ต้นฉบับอื่นๆ |
| `OTHER` | ประเภทอื่น |

- `is_main_document = TRUE` ระบุไฟล์หลักของ Revision นั้น

---

## 3.5.5. โครงสร้างหมวดหมู่ (Category Structure)

หมวดหมู่ผูกกับ **Project** — จัดการโดย Project Manager:

```
shop_drawing_main_categories   (หมวดหมู่หลัก เช่น ARCH, STR, MEP)
shop_drawing_sub_categories    (หมวดหมู่ย่อย เช่น STR-COLUMN, STR-BEAM)
```

- ต่างจาก Contract Drawing ที่ Main ↔ Sub เป็น M:N — Shop Drawing เป็น **direct FK**: `shop_drawings.main_category_id` และ `shop_drawings.sub_category_id` (1 แบบ = 1 Main + 1 Sub)

---

## 3.5.6. Revision Model

- 1 Shop Drawing Master → หลาย Revision (1:N)
- `revision_number`: 0-based integer สำหรับ sorting
- `revision_label`: A, B, C, ... — แสดงใน UI
- `is_current = TRUE` มีได้เพียง 1 แถว (NULL สำหรับที่ไม่ใช่ปัจจุบัน — ต่างจาก BOOLEAN เพื่อให้ UNIQUE constraint ทำงาน)

---

## 3.5.7. การสร้างและสิทธิ์ (RBAC)

| การกระทำ | Role ที่อนุญาต | Scope |
|---|---|---|
| สร้าง Shop Drawing + Revision | Document Control, Org Admin, Superadmin | Project |
| แก้ไข Shop Drawing | Document Control, Org Admin, Superadmin | Project |
| ลบ Shop Drawing | Org Admin, Superadmin | Project |
| จัดการ Main/Sub Category (Master) | Project Manager | Project |
| ดู Shop Drawing | ทุกคนที่มีสิทธิ์ใน Project | Project |

---

## 3.5.8. ความสัมพันธ์กับ Module อื่น

- **RFA** (`rfa_items`) อ้างอิง `shop_drawing_revision_id` → 1 Revision มี Active RFA ได้สูงสุด 1 ฉบับ (EC-RFA-001)
- **Contract Drawing** (`shop_drawing_revision_contract_refs`) — แต่ละ Revision สามารถอ้างอิง Contract Drawing ต้นฉบับได้หลายฉบับ (M:N)
- **As-Built Drawing** — ไม่มีความสัมพันธ์โดยตรง (คนละ module)

---

## 3.5.9. Business Rules และ Edge Cases

| รหัส | กฎ | Severity |
|---|---|---|
| **EC-RFA-001** | 1 Shop Drawing Revision มี Active RFA ได้สูงสุด 1 ฉบับ (ยกเว้น REJECTED/CANCELLED แล้ว) | 🔴 Critical |
| **EC-RFA-003** | Discipline และ Category ต้องเลือกก่อน Upload — ไม่มี Auto-detection (Phase 3) | 🟡 Medium |

ดูรายละเอียดครบที่ `01-06-edge-cases-and-rules.md` หมวด "Module 4: RFA & Drawing Edge Cases"
