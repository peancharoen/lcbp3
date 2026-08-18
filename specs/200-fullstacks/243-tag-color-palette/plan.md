// File: specs/200-fullstacks/243-tag-color-palette/plan.md
// Change Log:
// - 2026-08-18: Initial implementation plan for Tag Color Palette Picker

# Implementation Plan: Tag Color Palette Picker

**Branch**: `243-tag-color-palette` | **Date**: 2026-08-18 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/200-fullstacks/243-tag-color-palette/spec.md`

## Summary

เปลี่ยน `tags.color_code` จาก free-form string (hex/CSS name ปนกัน ไม่ validate) เป็น **palette key enum** ปิด 14 ค่า (`default`, `slate`, `red`, `orange`, `amber`, `yellow`, `green`, `teal`, `blue`, `indigo`, `violet`, `purple`, `pink`, `rose`) โดย frontend เป็น source of truth ของ palette, backend enforce ด้วย `@IsIn`, และหน้า admin ใช้ `ColorPickerField` component ใหม่ (inline grid 14 swatch) แทน text input เดิม การเปลี่ยนแปลงอ้างอิงตาม **ADR-046** ที่บันทึกไว้แล้ว

## Technical Context

**Language/Version**: TypeScript (strict mode) — NestJS 11 (backend), Next.js 16 App Router (frontend)
**Primary Dependencies**: `class-validator` (backend DTO validation), `react-hook-form` + `@tanstack/react-query` + shadcn/ui (frontend), `vitest` + `@testing-library/react` (frontend test), Jest (backend test)
**Storage**: MariaDB 11.8 — คอลัมน์ `tags.color_code VARCHAR(30)` (ไม่เปลี่ยน type, เปลี่ยนแค่ domain ของค่าที่ยอมรับ)
**Testing**: Vitest (frontend unit/component), Jest (backend unit) — ตามที่ใช้อยู่ในโปรเจกต์
**Target Platform**: Web — Admin Console (ผู้ใช้ desktop browser เป็นหลัก)
**Project Type**: Web application (frontend + backend, monorepo `frontend/` + `backend/`)
**Performance Goals**: N/A — CRUD ปริมาณต่ำ (จำนวน tag ต่อระบบระดับสิบ-ร้อยรายการ ไม่ใช่ hot path)
**Constraints**: ADR-044 (no TypeORM migrations — schema เปลี่ยนผ่าน SQL delta เท่านั้น), ADR-019 (publicId only ใน API response)
**Scale/Scope**: 14 palette colors, กระทบ 2 backend module (`master/`, `tags/`), 1 frontend page (`tags/page.tsx`), 1 shared component (`GenericCrudTable` ใช้ร่วมกับอีก 8 หน้า admin/reference), 1 correspondence component (`tag-manager.tsx`)

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

โปรเจกต์นี้ยังไม่มี `.specify/memory/constitution.md` ที่กรอกเนื้อหาจริง (ยังเป็น template) — ใช้ **Product Vision Design Principles** (`specs/00-overview/00-03-product-vision.md` §9) เป็น gate แทนตาม `_LCBP3-CONTEXT.md`:

| Design Principle | ผลกระทบจาก feature นี้ | Gate |
|---|---|---|
| **Security First** | เพิ่ม validation (`@IsIn`) ที่ backend DTO ทั้งสอง module — ลด attack surface ของ free-form injection ใน field นี้ | ✅ PASS |
| **Data Never Lies** | ไม่กระทบ audit trail ที่มีอยู่ (tag color เป็น cosmetic field ไม่ผูกกับ workflow/approval) | ✅ PASS |
| **Fail Gracefully** | ไม่มี external service dependency ใหม่; ถ้า palette key ไม่รู้จัก helper fallback เป็น `'default'` เสมอ ไม่ throw | ✅ PASS |
| **Built for Thailand** | Palette label เป็นภาษาอังกฤษ (ตัดสินใจแล้วใน grill session — ชื่อสี Tailwind คนไทยคุ้นในรูปแบบอังกฤษ) ใช้ i18n key เปิดทางแปลได้ในอนาคต | ✅ PASS (documented trade-off) |
| **On-Premise by Design** | ไม่กระทบ — ไม่มีการส่งข้อมูลออกนอกระบบ | ✅ PASS |
| **Boring Technology** | ใช้ component/library ที่มีอยู่แล้ว (shadcn `Button`, React Hook Form) ไม่เพิ่ม dependency ใหม่ | ✅ PASS |

**ไม่มี violation ที่ต้องบันทึกใน Complexity Tracking**

## Project Structure

### Documentation (this feature)

```text
specs/200-fullstacks/243-tag-color-palette/
├── spec.md              # Feature specification
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md         # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── tags.yaml        # Phase 1 output — OpenAPI สำหรับ POST/PATCH tag color_code
└── tasks.md             # Phase 2 output (/105-speckit.tasks)
```

### Source Code (repository root)

```text
backend/src/modules/
├── master/
│   ├── constants/
│   │   └── tag-colors.ts          # [NEW] TAG_COLOR_KEYS mirror (backend validation source)
│   ├── dto/
│   │   ├── create-tag.dto.ts      # [MODIFY] colorCode: @IsIn(TAG_COLOR_KEYS)
│   │   └── update-tag.dto.ts      # (ไม่ต้องแก้ — extends CreateTagDto)
│   └── master.service.ts          # [MODIFY] createTag/updateTag: `??  'default'`
└── tags/
    ├── dto/
    │   └── create-tag.dto.ts      # [MODIFY] colorCode: @IsIn(TAG_COLOR_KEYS)
    └── tags.service.ts            # [MODIFY] create(): `?? 'default'`

frontend/
├── lib/
│   ├── constants/
│   │   └── tag-colors.ts          # [NEW] TAG_PALETTE (source of truth), TagColorKey, TAG_COLOR_KEYS
│   └── utils/
│       └── tag-color.ts           # [NEW] getTagColor(key) → hex
├── components/
│   ├── admin/reference/
│   │   ├── generic-crud-table.tsx # [MODIFY] Field.type += 'custom', Field.render prop
│   │   └── color-picker-field.tsx # [NEW] inline 14-swatch grid, i18n label
│   └── correspondences/
│       └── tag-manager.tsx        # [MODIFY] ลบ getTagColor เดิม, import จาก lib/utils/tag-color
├── app/(admin)/admin/doc-control/reference/tags/
│   └── page.tsx                   # [MODIFY] colorCode field → type: 'custom' + ColorPickerField
└── public/locales/{th,en}/
    └── common.json                 # [MODIFY] +16 keys (14 palette label + selected + fieldLabel)

specs/03-Data-and-Storage/
├── lcbp3-v1.9.0-schema-02-tables.sql  # [MODIFY] color_code comment
├── 03-01-data-dictionary.md           # [MODIFY] color_code description
├── deltas/2026-08-18-tag-color-palette-key.sql  # [NEW] UPDATE non-palette values → 'default'
└── n8n.workflow.v3.json               # [MODIFY] colorCode normalization → 'default'

CONTEXT.md              # [MODIFIED — already applied] +Tag, +Tag Color Key definitions
specs/06-Decision-Records/
└── ADR-046-tag-color-palette-key.md   # [CREATED — already applied]
```

**Structure Decision**: Web application structure (`backend/` + `frontend/` monorepo ที่มีอยู่แล้ว) — ไม่มีการเพิ่ม project ใหม่ ทำงานภายใน module/component ที่มีอยู่ ยกเว้นไฟล์ constant/helper/component ใหม่ 5 ไฟล์ (2 backend, 3 frontend)

## Complexity Tracking

> ไม่มี violation ที่ต้อง justify — ตารางนี้เว้นว่างตามเกณฑ์ (Constitution Check ผ่านทุกข้อ)
