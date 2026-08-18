# Session — 2026-08-18 (Tag Color Palette Picker — Feature 243)

## Summary

Implement feature 243: Tag Color Palette Picker ตาม ADR-046 — เปลี่ยน `tags.color_code` จาก free-form string เป็น 14 palette key enum (frontend = source of truth, backend mirror สำหรับ `@IsIn` validation) ครบทั้ง 3 user stories: palette picker UI, สีสม่ำเสมอทั้งระบบ, ข้อมูลเดิมไม่พัง ผ่าน code review + แก้ไข 6 ข้อ + deploy สำเร็จ + ทดสอบเพิ่ม tag ใหม่ได้

## ปัญหาที่พบ (Root Cause)

1. **ADR numbering conflict** — ADR-045 มีอยู่แล้ว (Edge Proxy) → เปลี่ยนเป็น ADR-046
2. **Line ending mismatch** — edit tool เปลี่ยน CRLF→LF ใน master.service.ts (756 lines diff) → แก้ด้วย `sed -i 's/\r$//'` กลับเป็น LF ตาม `.editorconfig`
3. **Code review พบ 6 ข้อ**:
   - 🟠 HIGH: `updateTag` ไม่มี `?? 'default'` (จะเขียน `undefined` ทับค่าเดิม)
   - 🟡 MEDIUM: SQL delta ไม่ครอบคลุม NULL (`NULL NOT IN` คืน NULL ไม่ match)
   - 🟡 MEDIUM: Magic value `'#e2e8f0'` ใน tag-manager.tsx couples to palette internals
   - 🟡 MEDIUM: Backend `TagColorKey` เป็น `string` ไม่ใช่ literal union (explicit annotation widen type)
   - 🟢 LOW: `TagColorKey` dead export ใน backend
   - 🟢 LOW: `handleAdd` ไม่ initialize custom field

## การแก้ไข (Fix)

| ไฟล์ | การเปลี่ยนแปลง |
|---|---|
| `backend/src/modules/master/master.service.ts:367` | `updateTag`: เพิ่ม `dto.colorCode ?? 'default'` |
| `specs/03-Data-and-Storage/deltas/2026-08-18-tag-color-palette-key.sql` | เพิ่ม `OR color_code IS NULL` |
| `frontend/lib/constants/tag-colors.ts` | Export `DEFAULT_TAG_COLOR_HEX` constant |
| `frontend/lib/utils/tag-color.ts` | ใช้ `DEFAULT_TAG_COLOR_HEX` แทน `KEY_TO_HEX.get('default')!` |
| `frontend/components/correspondences/tag-manager.tsx` | ใช้ `DEFAULT_TAG_COLOR_HEX` แทน `'#e2e8f0'` + cache `getTagColor()` ในตัวแปร |
| `backend/src/modules/master/constants/tag-colors.ts` | ถอด `readonly string[]` annotation → `TagColorKey` เป็น literal union |
| `backend/src/modules/master/dto/create-tag.dto.ts` | `colorCode?: TagColorKey` (literal union ไม่ใช่ `string`) |
| `backend/src/modules/tags/dto/create-tag.dto.ts` | `colorCode?: TagColorKey` (literal union ไม่ใช่ `string`) |
| `frontend/components/admin/reference/generic-crud-table.tsx` | เพิ่ม `defaultValue?: unknown` ใน `Field` interface + `handleAdd` init |
| `frontend/app/(admin)/admin/doc-control/reference/tags/page.tsx` | ใช้ `defaultValue: 'default'` สำหรับ colorCode field |
| `backend/tests/unit/master/tag-color-palette.spec.ts` | เปลี่ยน `require('fs')`/`require('path')` เป็น ES imports (lint fix) |

## กฎที่ Lock แล้ว

- **ADR-046**: `tags.color_code` เป็น palette key enum (14 keys) — frontend = source of truth, backend mirror
- **Palette keys**: `default, slate, red, orange, amber, yellow, green, teal, blue, indigo, violet, purple, pink, rose`
- **`DEFAULT_TAG_COLOR_HEX`**: export เป็น constant จาก `tag-colors.ts` — ห้ามใช้ magic value `'#e2e8f0'` โดยตรง
- **Backend `TagColorKey`**: literal union (ไม่มี explicit `readonly string[]` annotation)
- **`@IsIn(TAG_COLOR_KEYS)`**: ใช้ใน DTO ทั้งสอง path (master + tags)
- **`?? 'default'`**: ใช้ในทุก service method ที่จัดการ colorCode (create + update)
- **SQL delta**: ต้องครอบคลุมทั้ง invalid values และ NULL (`OR color_code IS NULL`)

## Verification

- [x] Frontend typecheck: 0 errors
- [x] Backend typecheck: 0 errors
- [x] Frontend tests: 961 pass (141 files)
- [x] Backend tests: 1029 pass (10 skipped pre-existing)
- [x] Lint: 0 errors (ทั้งสองฝั่ง)
- [x] Forbidden patterns (`any`/`console.log`/`parseInt(UUID)`): 0
- [x] Coverage: 100% สำหรับไฟล์ใหม่ (constants + DTOs)
- [x] SQL delta รันสำเร็จผ่าน MCP MariaDB (0 rows affected — DB ว่าง)
- [x] Code review: ผ่านครบหลังแก้ไข 6 ข้อ
- [x] 3 commits push สำเร็จทั้ง Gitea + GitHub
- [x] ทดสอบเพิ่ม tag ใหม่ได้ (deploy สำเร็จ)

## Commits

| # | Hash | Message |
|---|---|---|
| 1 | `0643e84b` | `docs(243): ADR-046 Tag Color Palette Key — foundation (spec/schema/delta/n8n)` |
| 2 | `33b5dbdd` | `feat(243): backend palette enforcement — @IsIn validation + default handling` |
| 3 | `b5ad4d66` | `feat(243): frontend color palette picker — ColorPickerField + shared helper` |

Pushed to: `origin` (Gitea) + `github` (GitHub) — branch `main`
