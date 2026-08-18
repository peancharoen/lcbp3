// File: specs/200-fullstacks/243-tag-color-palette/research.md
// Change Log:
// - 2026-08-18: Phase 0 research for Tag Color Palette Picker

# Phase 0 Research: Tag Color Palette Picker

> ทุกหัวข้อในนี้ถูกวิจัย/ตัดสินใจแล้วระหว่าง grill session (ดู ADR-046) ก่อน `/102-speckit.specify` ไม่มี `NEEDS CLARIFICATION` เหลือใน Technical Context ของ `plan.md`

## 1. รูปแบบการเก็บค่าสี (`color_code` storage format)

- **Decision**: Palette key enum (14 ค่า) แทน free-form string
- **Rationale**: Schema เดิม (`VARCHAR(30) DEFAULT 'default'`) ออกแบบเหมือนตั้งใจให้เป็น enum อยู่แล้ว; n8n workflow สร้าง tag ใหม่ด้วย `'default'` เสมออยู่แล้ว ทำให้ migration cost ต่ำ; สอดคล้องกับ shadcn/ui variant-key pattern
- **Alternatives considered**:
  - Hex string only — เสีย semantic meaning, ไม่รองรับ dark mode ในอนาคต
  - Free-form + picker overlay — ยังกำกวำ (hex/name/`'default'` ปนกัน), validation ไม่ได้

## 2. จำนวนและชื่อสีใน palette

- **Decision**: 14 keys ตามชื่อ Tailwind CSS color scale (`default`, `slate`, `red`, `orange`, `amber`, `yellow`, `green`, `teal`, `blue`, `indigo`, `violet`, `purple`, `pink`, `rose`), shade 500 คงที่
- **Rationale**: ชื่อสี Tailwind เป็นที่คุ้นของ dev; 14 สีพอเลือกโดยไม่รก และแยกจางกันชัดในสายตา; shade 500 ให้ contrast เพียงพอทั้ง light/dark background โดยไม่ต้อง maintain theme-aware map ใน v1
- **Alternatives considered**:
  - Tailwind เต็มสเกล (16-17 สี) — เยอะเกินไป หลายสีใกล้กันมาก (teal/cyan/sky)
  - ชื่อ semantic ตามธุรกิจ (critical/warning/success) — บังคับ mapping ที่ไม่ตรงกับสีที่ admin ต้องการ (เช่น tag "URGENT" อาจอยากสีฟ้าไม่ใช่แดง)

## 3. Source of truth ของ palette (frontend vs backend)

- **Decision**: Frontend (`lib/constants/tag-colors.ts`) เป็น source of truth, backend mirror เป็น `TAG_COLOR_KEYS` constant สำหรับ `@IsIn` validation เท่านั้น
- **Rationale**: Palette เป็นเรื่อง UI มากกว่า domain logic — frontend เป็นเจ้าของ natural; ไม่ต้องเพิ่ม API call เพื่อดึง palette ในหน้า admin
- **Alternatives considered**:
  - Backend enum เป็น source of truth, frontend fetch ผ่าน API — เพิ่ม network round-trip ที่ไม่จำเป็นสำหรับ static list
  - ทั้งสองฝั่งประกาศ constant แยกกันไม่ sync อัตโนมัติ — เสี่ยง drift มากกว่า mirror ที่มี comment ชี้กลับไปที่ frontend

## 4. UI pattern สำหรับเลือกสี

- **Decision**: Inline grid 14 swatch แสดงพร้อมกันในฟอร์ม (ไม่ใช้ popover/dropdown)
- **Rationale**: 14 สีไม่เยอะพอใส่ dialog (`max-w-md`) ได้สบาย; ผู้ใช้เห็นตัวเลือกทั้งหมดพร้อมกัน ตัดสินใจเร็วกว่า popover ที่ต้องคลิกเปิด; หลีกเลี่ยงปัญหา z-index/overflow ของ popover ซ้อนใน dialog
- **Alternatives considered**:
  - Popover trigger + grid ภายใน — ประหยัดพื้นที่แต่เพิ่ม 1 click และมีความเสี่ยง z-index
  - Native `<input type="color">` — ให้ hex อิสระ ขัดกับ decision #1
  - shadcn `Select` dropdown — ต้อง hack เพื่อแสดง swatch คู่กับ text, ไม่เห็นทุกสีพร้อมกัน

## 5. การจัดการค่าเดิมที่ไม่อยู่ใน palette (migration strategy)

- **Decision**: SQL delta `UPDATE tags SET color_code = 'default' WHERE color_code NOT IN (...)` + backend `@IsIn` เข้มข้น (ไม่รับ hex legacy)
- **Rationale**: DB ใน environment ปัจจุบันว่าง (ตรวจสอบผ่าน MCP MariaDB แล้ว); n8n สร้าง tag ใหม่เป็น `'default'` เสมออยู่แล้ว ทำให้ migration cost ต่ำมาก; รักษา invariant เดียว (`color_code ∈ PALETTE_KEYS`) ทำให้ display logic ไม่ต้อง branch
- **Alternatives considered**:
  - Backend ยอมรับทั้ง palette key และ hex (backward compat) — ทำให้ "palette key only" อ่อนลง, ต้อง maintain double-format helper
  - Nearest-color mapping (hex → nearest palette key) — เพิ่ม logic ซับซ้อนที่ไม่คุ้มกับปริมาณข้อมูลเดิมที่มีน้อย

## 6. การขยาย `GenericCrudTable` สำหรับ field type ใหม่

- **Decision**: เพิ่ม `type: 'custom'` + `render` prop ใน `Field` interface, สร้าง `ColorPickerField` เป็น component แยกที่ไม่ผูกกับ `GenericCrudTable`
- **Rationale**: `GenericCrudTable` ใช้ร่วมกับอีก 8 หน้า admin/reference — เพิ่ม `type: 'color'` ที่ import palette ตรงจะทำให้ generic component รู้เรื่อง domain (tag) มากเกินไป; `type: 'custom'` เป็น extension point ทั่วไปที่หน้าอื่นในอนาคตใช้ได้ด้วย
- **Alternatives considered**:
  - เพิ่ม `type: 'color'` เฉพาะเจาะจง — ผูก `GenericCrudTable` กับ domain tag
  - เขียน custom table แยกสำหรับ tags page ไม่ใช้ `GenericCrudTable` — เสียประโยชน์ CRUD/dialog/mutation ที่มีอยู่แล้ว, scope บานปลาย

## 7. i18n scope

- **Decision**: ใช้ i18n key เฉพาะภายใน `ColorPickerField` component ใหม่ (palette label 14 คำ + "Selected: {{color}}" + field label) — ไม่แตะ `tags/page.tsx` ที่เหลือ (คง hardcoded เหมือนหน้า admin/reference อื่น)
- **Rationale**: หน้า admin/reference ทั้งหมด (9 หน้า) ยังไม่ใช้ i18n hook เลย — การนำ i18n เข้าทั้งหน้าจะสร้าง inconsistency และขยาย scope เกินจำเป็น; component ใหม่ไม่มี legacy จึงเริ่มต้นถูกตั้งแต่ต้นได้โดยไม่กระทบความสม่ำเสมอของหน้าเดิม
- **Alternatives considered**:
  - i18n เต็มหน้า — ขยาย scope เกินจำเป็นสำหรับ feature นี้
  - ไม่ใช้ i18n เลย (คง hardcode English ใน `TAG_PALETTE`) — ผิด `.devin/rules/03-typescript.md` ที่บังคับ i18n key

## 8. Backend module duplication (`master/` vs `tags/`)

- **Decision**: แก้ทั้งสอง `CreateTagDto` (ใน `master/dto` และ `tags/dto`) ให้ใช้ `@IsIn(TAG_COLOR_KEYS)` เหมือนกัน — ไม่รวม module เป็นตัวเดียว
- **Rationale**: ทั้งสอง module เขียนไปยังตาราง `tags` เดียวกัน (คนละ path: `/master/tags` สำหรับ admin, `/tags` สำหรับ n8n/tag-manager) — ต้องรักษา invariant ทุกทางเข้า DB; การรวม module เป็นงาน refactor ใหญ่แยกเป็นคนละ scope
- **Alternatives considered**:
  - แก้เฉพาะ `master/dto` — ทำให้ n8n ยังส่ง hex ผ่านได้ ทำลาย invariant
  - รวม module เป็นตัวเดียว — ขยาย scope เกินไปสำหรับ feature นี้ (ต้องจัดการ entity ที่ duplicate ด้วย)

## 9. Test coverage scope

- **Decision**: แก้ test ที่พังจาก helper เปลี่ยน (`tag-manager.test.tsx`) + เพิ่ม test ใหม่สำหรับ `ColorPickerField` และ `type: 'custom'` ใน `GenericCrudTable`
- **Rationale**: `type: 'custom'` เป็น extension point ใหม่ในcomponent ที่ใช้กับ 9 หน้า — ต้องมี test คุ้มครอง; `ColorPickerField` เป็น component ใหม่ตาม testing rules (Business Logic 80%+); ไม่เพิ่ม integration test สำหรับ `tags/page.tsx` เพราะเป็น composition ของ component ที่มี test แล้ว
- **Alternatives considered**:
  - แก้เฉพาะ test ที่พัง ไม่เพิ่มใหม่ — ผิด testing coverage rules
  - เพิ่ม integration test ที่ page level ด้วย — scope ใหญ่กว่าที่จำเป็น

## Outcome

ไม่มี `NEEDS CLARIFICATION` เหลือ — พร้อมเข้า Phase 1 (Design & Contracts)
