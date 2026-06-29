# 3.4 Contract Drawing Management (การจัดการแบบคู่สัญญา)

---

title: 'Functional Requirements: Contract Drawing Management'
version: 1.8.1
status: updated
owner: Nattanin Peancharoen
last_updated: 2026-03-24
related:

- specs/01-requirements/01-01-objectives.md
- specs/01-requirements/01-03-modules/01-03-00-index.md
- specs/01-requirements/01-03-modules/01-03-05-shop-drawing.md
- specs/03-Data-and-Storage/03-01-data-dictionary.md
- specs/01-requirements/01-02-business-rules/01-02-01-rbac-matrix.md

---

## 3.4.1. วัตถุประสงค์

แบบคู่สัญญา (Contract Drawing) คือแบบที่ได้รับจากสัญญาก่อสร้าง ใช้เป็น **เอกสารอ้างอิงหลัก** สำหรับ Shop Drawing และ As-Built Drawing ภายในโครงการ ไม่มี Revision Model — แต่ละแบบเป็นเอกสาร Master คงที่

> **หมายเหตุการพัฒนา:** ข้อมูล Contract Drawing มาจาก **Seed Data** (นำเข้าจากข้อมูลสัญญาที่มีอยู่แล้ว) ไม่ได้สร้างใหม่ผ่าน UI ระบบอัปโหลดไฟล์ PDF อยู่**ระหว่างการพัฒนา** — ปัจจุบัน record มีอยู่ในระบบแต่ไฟล์แนบยังไม่สมบูรณ์

---

## 3.4.2. โครงสร้างข้อมูล (Database Tables)

| Table | บทบาท |
|---|---|
| `contract_drawings` | ข้อมูล Master แบบคู่สัญญา: เลขแบบ, ชื่อ, หมวดหมู่, เล่ม |
| `contract_drawing_attachments` | ไฟล์แนบ (M:N กับ `attachments`) รองรับหลายไฟล์ต่อแบบ |
| `contract_drawing_volumes` | Master: เล่มของแบบ (ผูกกับ Project) |
| `contract_drawing_cats` | Master: หมวดหมู่หลัก (ผูกกับ Project) |
| `contract_drawing_sub_cats` | Master: หมวดหมู่ย่อย (ผูกกับ Project) |
| `contract_drawing_subcat_cat_maps` | M:N ระหว่าง หมวดหมู่หลัก ↔ หมวดหมู่ย่อย (ผูกกับ Project) |

**ข้อสำคัญ:** `condwg_no` ต้อง UNIQUE ภายใน Project เดียวกัน (`ux_condwg_no_project`)

---

## 3.4.3. Fields ที่ต้องกรอกเมื่อสร้าง Contract Drawing

| Field | Required | หมายเหตุ |
|---|---|---|
| Project | ✅ | UUID — ผูกกับ `projects` |
| Drawing Number (`condwg_no`) | ✅ | VARCHAR(255) — unique per project |
| Title | ✅ | VARCHAR(255) |
| Category (`map_cat_id`) | ❌ | FK → `contract_drawing_subcat_cat_maps` |
| Volume (`volume_id`) | ❌ | FK → `contract_drawing_volumes` |
| Volume Page (`volume_page`) | ❌ | INT |
| Attachments | ❌ | PDF / DWG / SOURCE / OTHER — ผ่าน ClamAV scan (**อยู่ระหว่างพัฒนาระบบนำเข้า PDF**) |

---

## 3.4.4. ไฟล์แนบ (contract_drawing_attachments)

รองรับหลายไฟล์ต่อ 1 Contract Drawing:

| file_type | ความหมาย |
|---|---|
| `PDF` | ไฟล์ PDF แบบดิจิทัล |
| `DWG` | ไฟล์ AutoCAD |
| `SOURCE` | ไฟล์ต้นฉบับอื่นๆ |
| `OTHER` | ประเภทอื่น |

- `is_main_document = TRUE` ระบุไฟล์หลัก (แสดงเป็น Default สำหรับ Preview)

> **สถานะ:** ข้อมูล `contract_drawings` ถูก Seed เข้าระบบแล้ว แต่ `contract_drawing_attachments` ยังว่างอยู่ระหว่างรอระบบ PDF Import

---

## 3.4.5. โครงสร้างหมวดหมู่ (Category Structure)

หมวดหมู่ผูกกับ **Project** (ไม่ใช่ Global) — จัดการโดย Project Manager:

```
contract_drawing_volumes        (เล่ม — Volume)
contract_drawing_cats           (หมวดหมู่หลัก — Main Category)
contract_drawing_sub_cats       (หมวดหมู่ย่อย — Sub Category)
contract_drawing_subcat_cat_maps (M:N: Sub Category ↔ Main Category)
```

- `contract_drawings.map_cat_id` FK → `contract_drawing_subcat_cat_maps`
- 1 Sub Category สามารถอยู่ใน Main Category ได้หลายหมวด (M:N)

---

## 3.4.6. การสร้างและสิทธิ์ (RBAC)

| การกระทำ | Role ที่อนุญาต | Scope |
|---|---|---|
| สร้าง / แก้ไข Contract Drawing | Project Manager, Org Admin, Superadmin | Project |
| ลบ Contract Drawing | Org Admin, Superadmin | Project |
| จัดการ Volume / Category (Master) | Project Manager | Project |
| ดู Contract Drawing | ทุกคนที่มีสิทธิ์ใน Project | Project |

---

## 3.4.7. ความสัมพันธ์กับ Module อื่น

- **Shop Drawing** (`shop_drawings`) อ้างอิง `contract_drawing_id` → ใช้ Contract Drawing เป็นแบบต้นฉบับ
- Contract Drawing **ไม่มี Revision Model** — ต่างจาก Shop Drawing ที่มี `shop_drawing_revisions`
- ไม่มีความสัมพันธ์โดยตรงกับ RFA — RFA อ้างอิง `shop_drawing_revisions` ไม่ใช่ Contract Drawing
