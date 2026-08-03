# MCP StitchMCP Tools

MCP StitchMCP server ให้เครื่องมือสำหรับสร้างและจัดการ UI designs และ frontend code ผ่าน Stitch platform ใช้สำหรับ:

- สร้าง UI mockups และ frontend code จาก text description
- จัดการ design systems (colors, typography, component tokens)
- สร้าง design variants สำหรับ A/B testing หรือ theme alternatives
- แปลง design markdown (`design.md`) เป็น design system

## Available Tools

### Project Management

| Tool             | หน้าที่                              |
| ---------------- | ------------------------------------ |
| `create_project` | สร้าง Stitch project ใหม่ (container สำหรับ UI designs + code) |
| `get_project`    | ดูรายละเอียด project                 |
| `list_projects`  | แสดง projects ทั้งหมด               |
| `delete_project` | ลบ project                           |

### Screen Management

| Tool                       | หน้าที่                              |
| -------------------------- | ------------------------------------ |
| `list_screens`             | แสดง screens ใน project             |
| `get_screen`               | ดูรายละเอียด screen (UI + code)      |
| `generate_screen_from_text`| สร้าง screen จาก text description    |
| `edit_screens`             | แก้ไข screens ที่มีอยู่             |
| `generate_variants`        | สร้าง variants ของ screen            |

### Design System Management

| Tool                                | หน้าที่                              |
| ----------------------------------- | ------------------------------------ |
| `upload_design_md`                  | อัปโหลด `design.md` file            |
| `create_design_system`              | สร้าง design system ใหม่             |
| `create_design_system_from_design_md`| สร้าง design system จาก `design.md` |
| `update_design_system`              | แก้ไข design system                 |
| `list_design_systems`               | แสดง design systems ทั้งหมด         |
| `apply_design_system`                | ประยุกต์ใช้ design system กับ project |

## การใช้งานร่วมกับ Development Flow

**เมื่อสร้าง UI mockup ใหม่:**

1. ใช้ `create_project` เพื่อสร้าง container (หรือใช้ project ที่มีอยู่)
2. ใช้ `generate_screen_from_text` เพื่อสร้าง screen จาก description
3. ใช้ `get_screen` เพื่อดู UI + generated code
4. ใช้ `edit_screens` เพื่อปรับแต่ง

**เมื่อสร้าง/ประยุกต์ design system:**

1. ใช้ `create_design_system` หรือ `create_design_system_from_design_md` จาก `design.md`
2. ใช้ `update_design_system` เพื่อปรับ colors, typography, component tokens
3. ใช้ `apply_design_system` เพื่อประยุกต์กับ project

**เมื่อสร้าง variants:**

1. ใช้ `generate_variants` สำหรับ screen ที่ต้องการ
2. ใช้ `get_screen` เพื่อเปรียบเทียบ variants

## ข้อควรระวัง

- **⚠️ ใช้สำหรับ ideation/mockup เท่านั้น** — code ที่ generate ต้องผ่าน review และปรับให้สอดคล้องกับ project conventions (ADR-019, TypeScript strict, ฯลฯ)
- **⚠️ ห้ามใช้ generated code โดยตรงใน production** — ต้อง adapt ให้ใช้ `publicId` (ไม่ใช่ INT id), RHF+Zod, TanStack Query ตาม `07-frontend-patterns.md`
- **✅ ใช้ `design.md` สำหรับ design system** — เพื่อให้ consistent กับ brand/theme
- **⚠️ ระวังการลบ project** — อาจทำให้เสีย designs ที่ยังไม่ได้ export
- **✅ ตรวจสอบ generated code กับ forbidden patterns** — ห้ามมี `any`, `console.log`, `parseInt()` บน UUID

## Related Documents

- `specs/05-Engineering-Guidelines/05-03-frontend-guidelines.md` — Frontend conventions
- `.devin/rules/07-frontend-patterns.md` — Next.js patterns, RHF+Zod+TanStack Query
- `.devin/rules/01-adr-019-uuid.md` — UUID handling (publicId only)
