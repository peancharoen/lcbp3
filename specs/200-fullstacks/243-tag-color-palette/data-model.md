// File: specs/200-fullstacks/243-tag-color-palette/data-model.md
// Change Log:
// - 2026-08-18: Phase 1 data model for Tag Color Palette Picker

# Phase 1 Data Model: Tag Color Palette Picker

## Entity: Tag

ตาราง `tags` (ไม่มีการเปลี่ยน column ใหม่ — เปลี่ยนแค่ domain ของ `color_code`)

| Field | Type | Constraints | หมายเหตุ |
|---|---|---|---|
| `id` | INT | PK, AUTO_INCREMENT | Internal only — ไม่ expose ใน API (ADR-019) |
| `public_id` | CHAR(36) | UNIQUE, NOT NULL | UUIDv7 — exposed ใน API เป็น `publicId` |
| `project_id` | INT | NULL, FK → `projects.id` | NULL = Global tag |
| `tag_name` | VARCHAR(100) | NOT NULL | Unique ร่วมกับ `project_id` (`uq_tag_project`) — ไม่เปลี่ยนโดย feature นี้ |
| `color_code` | VARCHAR(30) | DEFAULT `'default'` | **[เปลี่ยน domain]** ต้องเป็นหนึ่งใน `TAG_COLOR_KEYS` (14 ค่า) — validate ที่ backend DTO ด้วย `@IsIn`, ไม่เปลี่ยน column type |
| `description` | TEXT | NULL | ไม่เปลี่ยน |
| `created_by` | INT | NULL, FK → `users.user_id` | ไม่เปลี่ยน |
| `created_at` / `updated_at` / `deleted_at` | TIMESTAMP | — | ไม่เปลี่ยน |

### Validation Rules (เปลี่ยนโดย feature นี้)

- `color_code` **MUST** เป็นสมาชิกของ `TAG_COLOR_KEYS` = `['default', 'slate', 'red', 'orange', 'amber', 'yellow', 'green', 'teal', 'blue', 'indigo', 'violet', 'purple', 'pink', 'rose']`
- ถ้าไม่ระบุ `color_code` เมื่อสร้าง tag → backend กำหนด `'default'` ให้อัตโนมัติ
- ค่าที่ไม่อยู่ใน `TAG_COLOR_KEYS` → backend ปฏิเสธด้วย `400 Bad Request` (validation error จาก `class-validator`)

### Lifecycle (ไม่เปลี่ยนจากเดิม)

```
[Created] --(admin edit color)--> [Updated] --(admin delete)--> [Soft Deleted (deleted_at)]
```

การเปลี่ยน `color_code` ไม่สร้าง state transition ใหม่ — เป็นการ update field ปกติเหมือน `tag_name`/`description`

## Concept: Tag Color (ไม่ใช่ตาราง — เป็น frontend constant)

ไม่มีตารางใหม่ใน DB สำหรับ palette — เก็บเป็น constant ที่ frontend (source of truth) และ mirror ที่ backend (validation only)

| Key | Hex (shade 500) |
|---|---|
| `default` | `#e2e8f0` |
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

## Relationships (ไม่เปลี่ยนจากเดิม)

- `Tag` M:N `Correspondence` ผ่าน `correspondence_tags` (junction table)
- `Tag` N:1 `Project` (nullable — NULL = Global)
- `Tag Color` เป็น value object ของ `Tag.color_code` ไม่ใช่ entity แยก ไม่มี FK

## Migration ของข้อมูลเดิม

```sql
-- ดู deltas/2026-08-18-tag-color-palette-key.sql (สร้างแล้วใน commit 1)
UPDATE tags
SET color_code = 'default'
WHERE color_code NOT IN (
  'default', 'slate', 'red', 'orange', 'amber', 'yellow', 'green',
  'teal', 'blue', 'indigo', 'violet', 'purple', 'pink', 'rose'
);
```

**Impact**: ตรวจสอบผ่าน MCP MariaDB แล้วว่า `tags` table ใน environment นี้มี 0 rows — ไม่มีข้อมูลสูญ ใน production ที่มีข้อมูลจริง คาดว่ากระทบน้อยเพราะ n8n workflow สร้าง tag ใหม่เป็น `'default'` เสมออยู่แล้ว
