<!-- File: specs/06-Decision-Records/ADR-046-tag-color-palette-key.md -->
<!-- Change Log
- 2026-08-18: Created ADR-046 — เปลี่ยน tags.color_code จาก free-form string เป็น palette key enum
- 2026-08-18: Renumbered ADR-045 → ADR-046 (ADR-045 ถูกใช้โดย Edge Proxy Topology Amendment ก่อนหน้านี้)
-->

# ADR-046: Tag Color Palette Key — เปลี่ยน `tags.color_code` จาก Free-form String เป็น Palette Key Enum

**Status:** Accepted
**Date:** 2026-08-18
**Related Documents:**
- [ADR-019: Hybrid Identifier Strategy](./ADR-019-hybrid-identifier-strategy.md) (publicId pattern)
- [ADR-030: Context-Aware Prompt Templates](./ADR-030-context-aware-prompt-templates.md) (tag color ใน AI prompt context)
- [ADR-044: Database Schema Strategy Amendment](./ADR-044-database-schema-strategy-amendment.md) (schema delta process)

---

## Context and Problem Statement

### สถานะเดิมของ `tags.color_code`

ตาราง `tags.color_code` (VARCHAR(30) DEFAULT 'default') เดิมออกแบบให้เก็บค่าแบบ free-form string โดยไม่มี validation ทำให้รับค่าได้ 3 รูปแบบปนกัน:

1. **Hex string** (เช่น `#ff0000`) — จากการกรอกด้วยมือในหน้า admin
2. **CSS color name** (เช่น `red`, `blue`) — จากการกรอกด้วยมือ
3. **Sentinel `'default'`** — ค่า default จาก schema และ n8n workflow

Data dictionary เดิมบรรยายว่า "UI Color/Class Code" — กำกวำระหว่าง hex, CSS color name, และ CSS class name

### ปัญหาที่เกิดขึ้น

1. **ไม่มี validation** — ผู้ใช้พิมพ์ `purpleish` หรือ `#zzz` ได้ ระบบ render เป็นสีดำเงียบ
2. **Display logic ต้อง branch** — `tag-manager.tsx` และ `tags/page.tsx` ต้องตรวจ `isHex`, `'default'`, และ fallback ทำให้ code ซับซ้อน
3. **ไม่รองรับ dark mode** — hex ตายตัว ไม่สามารถ map เป็นสีที่เหมาะกับ theme ได้
4. **AI prompt context กำกวำ** — ADR-030 ส่ง `color: t.colorCode` เข้า prompt context ซึ่งอาจเป็น hex หรือ name ทำให้ AI ตีความไม่สม่ำเสมอ
5. **Schema ออกแบบเหมือน enum แต่ไม่ใช่ enum** — VARCHAR(30) + DEFAULT 'default' บอกใบ้ว่าตั้งใจให้เก็บ key แต่ไม่ได้บังคับ

---

## Decision Drivers

- **Data Integrity** — ค่าใน `color_code` ควรอยู่ในชุดที่กำหนด เพื่อ render ได้สม่ำเสมอ
- **Validation** — ทั้ง backend และ frontend ควร validate ค่าก่อนบันทึก
- **Dark Mode Readiness** — ควรสามารถ map key → theme-aware hex ในอนาคตได้โดยไม่ต้องเปลี่ยน schema
- **AI Prompt Clarity** — AI context ควรเห็น semantic key (`'red'`) แทน hex (`'#ff0000'`)
- **Simplicity** — ลด branch ใน display logic และ helper function

---

## Considered Options

### Option A: Hex String Only
เก็บเฉพาะ hex (เช่น `#ef4444`) ยกเลิก sentinel `'default'` ใช้ hex default แทน

- ✅ เรียบง่าย render เหมือนกันทุกที่
- ❌ เสีย semantic meaning ("สีแดง" กลายเป็น `#ef4444` ไม่ใช่ `'red'`)
- ❌ ไม่รองรับ dark mode (hex ตายตัว)
- ❌ AI context เห็น hex แทน semantic key

### Option B: Constrained Palette Key (Chosen)
เก็บ palette key (เช่น `red`, `amber`, `blue`) จาก enum ตายตัว — frontend map key → hex + tailwind classes

- ✅ Semantic meaning ("สีแดง" = `'red'`)
- ✅ Dark mode ได้ในอนาคต (key → theme hex)
- ✅ Validation ได้ทั้ง backend (`@IsIn`) และ frontend (Zod/union type)
- ✅ AI context เห็น semantic key
- ✅ สอดคล้องกับ shadcn/ui pattern (variant key ไม่ใช่ hex)
- ❌ Admin เลือก hex นอก palette ไม่ได้ (แต่เป็นข้อดี — กันสีที่ contrast ต่ำ)
- ❌ ต้อง maintain palette key list 2 ที่ (frontend + backend)

### Option C: Free-form + Palette Picker
คง free-form ไว้ เพิ่ม palette picker ที่ insert ค่าลง text field เดิม

- ✅ ง่ายที่สุด ไม่ต้อง migrate
- ❌ ยังกำกวำ (hex + name + `'default'` ปนกัน)
- ❌ Validation ไม่ได้
- ❌ Display logic ยังต้อง branch

---

## Decision Outcome

**Chosen Option:** B — Constrained Palette Key

### Palette Definition

14 keys ใช้ชื่อ Tailwind color palette (shade 500 ตายตัวต่อ key):

| Key | Hex (shade 500) |
|---|---|
| `default` | `#e2e8f0` (slate-200) |
| `slate` | `#64748b` |
| `red` | `#ef4444` |
| `orange` | `#f97316` |
| `amber` | `#f59e0b` |
| `yellow` | `#eab308` |
| `green` | `#22c55e` |
| `teal` | `#14b8a6` |
| `blue` | `#3b82f6` |
| `indigo` | `#6366f1` |
| `violet` | `#8b5cf6` |
| `purple` | `#a855f7` |
| `pink` | `#ec4899` |
| `rose` | `#f43f5e` |

### Source of Truth

- **Frontend** `frontend/lib/constants/tag-colors.ts` — `TAG_PALETTE` constant + `TagColorKey` type (source of truth)
- **Backend** `backend/src/modules/master/constants/tag-colors.ts` — `TAG_COLOR_KEYS` mirror สำหรับ `@IsIn` validation
- **Helper** `frontend/lib/utils/tag-color.ts` — `getTagColor(key)` map key → hex สำหรับ render

### Validation

- **Backend DTO** — `@IsIn(TAG_COLOR_KEYS)` ใน `CreateTagDto` ทั้ง `master/dto` และ `tags/dto`
- **Frontend** — `ColorPickerField` component ให้เลือกจาก palette เท่านั้น (ไม่มี text input อิสระ)

### Migration

1. **SQL delta** (`specs/03-Data-and-Storage/deltas/2026-08-18-tag-color-palette-key.sql`) — `UPDATE tags SET color_code = 'default' WHERE color_code NOT IN (...)`
2. **Canonical schema** — อัปเดต comment ของ `color_code` ใน `lcbp3-v1.9.0-schema-02-tables.sql`
3. **Data dictionary** — อัปเดต description ใน `03-01-data-dictionary.md`
4. **n8n workflow v3** — เปลี่ยน `colorCode: t.colorCode || undefined` เป็น `colorCode: 'default'` (tag ที่ AI suggest เป็นสี default ทั้งหมด admin เลือกสีเองภายหลัง)

### Rationale

1. **Schema ออกแบบเหมือน enum อยู่แล้ว** — VARCHAR(30) + DEFAULT 'default' บอกใบ้ว่าตั้งใจให้เก็บ key ไม่ใช่ hex (hex ใช้แค่ 7 ตัวอักษร)
2. **n8n workflow สร้าง tag ใหม่ทุกตัวเป็น `'default'` อยู่แล้ว** — migration cost ต่ำ
3. **shadcn/ui ใช้ variant key pattern** — สอดคล้องกับ ecosystem
4. **AI context ชัดเจนขึ้น** — `'red'` สื่อความหมายกับ AI ได้ดีกว่า `'#ff0000'`

---

## 🔍 Impact Analysis

### Affected Components

| Component | Level | Impact | Required Action |
|---|---|---|---|
| **Schema SQL** | 🟡 Medium | อัปเดต comment + delta | แก้ `lcbp3-v1.9.0-schema-02-tables.sql` + สร้าง delta |
| **Data Dictionary** | 🟢 Low | อัปเดต description | แก้ `03-01-data-dictionary.md` |
| **Backend DTO** | 🟡 Medium | เปลี่ยน validation | แก้ `master/dto/create-tag.dto.ts` + `tags/dto/create-tag.dto.ts` |
| **Backend Service** | 🟢 Low | เปลี่ยน `|| 'default'` เป็น `?? 'default'` | แก้ `master.service.ts` + `tags.service.ts` |
| **Frontend Constant** | 🟡 Medium | สร้างใหม่ | สร้าง `lib/constants/tag-colors.ts` + `lib/utils/tag-color.ts` |
| **Frontend Component** | 🟡 Medium | สร้าง `ColorPickerField` + เพิ่ม `type: 'custom'` ใน `GenericCrudTable` | สร้าง component ใหม่ + แก้ `GenericCrudTable` |
| **Frontend Page** | 🟡 Medium | เปลี่ยน field type ของ `colorCode` | แก้ `tags/page.tsx` |
| **Frontend tag-manager** | 🟢 Low | แทนที่ helper เดิมด้วย import จากกลาง | แก้ `tag-manager.tsx` |
| **i18n** | 🟢 Low | เพิ่ม 16 key (14 palette + 2 UI) | เพิ่มใน `common.json` (th + en) |
| **n8n workflow v3** | 🟢 Low | เปลี่ยน colorCode normalization | แก้ `n8n.workflow.v3.json` |
| **Tests** | 🟡 Medium | แก้ test พัง + เพิ่ม test ใหม่ | แก้ `tag-manager.test.tsx` + สร้าง `color-picker-field.test.tsx` + แก้ `generic-crud-table.test.tsx` |

### Required Changes

- [x] สร้าง ADR-046 (เอกสารนี้)
- [ ] อัปเดต `CONTEXT.md` — เพิ่มนิยาม Tag + Tag Color Key
- [ ] สร้าง SQL delta + อัปเดต canonical schema + data dictionary
- [ ] สร้าง backend constant + แก้ DTO ทั้งสอง + แก้ service
- [ ] สร้าง frontend constant + helper
- [ ] สร้าง `ColorPickerField` + เพิ่ม `type: 'custom'` ใน `GenericCrudTable`
- [ ] แก้ `tags/page.tsx` ใช้ `ColorPickerField`
- [ ] แก้ `tag-manager.tsx` ใช้ helper จากกลาง
- [ ] เพิ่ม i18n keys
- [ ] แก้ n8n workflow v3
- [ ] แก้ test + เพิ่ม test ใหม่

---

## Consequences

### Positive

- ✅ Invariant: `color_code ∈ PALETTE_KEYS` — รักษาได้ทุกทางเข้า DB (backend validation + frontend picker)
- ✅ Dark mode ในอนาคตได้ (key → theme hex ผ่าน helper ที่เดียว)
- ✅ AI prompt context เห็น semantic key (`'red'`) แทน hex — ชัดเจนขึ้น
- ✅ ลด branch ใน display logic — helper เดียว map key → hex
- ✅ สอดคล้องกับ shadcn/ui variant pattern
- ✅ Validation ทั้ง backend และ frontend

### Negative

- ❌ Admin เลือก hex นอก palette ไม่ได้ (แต่เป็นข้อดี — กันสีที่ contrast ต่ำและ visual noise)
- ❌ ต้อง maintain palette key list 2 ที่ (frontend + backend) — ลดด้วย test ที่เช็คความตรง
- ❌ Migration ต้องแปลงค่าเดิม (แต่ DB ใน environment นี้ว่าง และ n8n สร้าง `'default'` อยู่แล้ว)

---

## 🔗 Relationships

- **ADR-019** — ใช้ `publicId` (UUIDv7) สำหรับ API response เช่นเดียวกับ entity อื่น
- **ADR-030** — tag color ใน AI prompt context เปลี่ยนจาก hex เป็น semantic key (ปรับปรุง)
- **ADR-044** — schema delta process (แก้ canonical schema + สร้าง delta)

---

## 📋 Version Dependency Matrix

| ADR | Version | Dependency Type | Affected Version(s) | Implementation Status | Relationship to ADR-046 |
|-----|---------|-----------------|---------------------|----------------------|-------------------------|
| **ADR-046** | 1.0 | New | v1.9.1+ | 🚧 Pending | This document |
| **ADR-019** | 1.0 | Related | v1.8.0+ | ✅ Active | publicId pattern สำหรับ Tag entity |
| **ADR-030** | 1.0 | Related | v1.8.0+ | ✅ Active | tag color ใน prompt context (ปรับปรุงโดย ADR-046) |
| **ADR-044** | 1.0 | Related | v1.9.13+ | ✅ Active | schema delta process |
