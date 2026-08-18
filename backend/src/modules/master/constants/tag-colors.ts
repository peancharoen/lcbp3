// File: backend/src/modules/master/constants/tag-colors.ts
// Change Log:
// - 2026-08-18: Initial creation — ADR-046 backend mirror ของ frontend palette

/**
 * Tag Color Palette Keys — backend mirror
 *
 * ⚠️ Source of truth อยู่ที่ `frontend/lib/constants/tag-colors.ts` (ADR-046)
 * ไฟล์นี้เป็น mirror สำหรับใช้ใน `@IsIn()` validation ของ DTO
 * ต้อง sync กับ frontend เสมอ — มี test ตรวจความตรง
 *
 * 14 keys ตั้งชื่อตาม Tailwind color palette:
 * default, slate, red, orange, amber, yellow, green, teal,
 * blue, indigo, violet, purple, pink, rose
 */

/** Palette key ที่ valid ทั้งหมด — ใช้สำหรับ `@IsIn(TAG_COLOR_KEYS)` */
export const TAG_COLOR_KEYS = [
  'default',
  'slate',
  'red',
  'orange',
  'amber',
  'yellow',
  'green',
  'teal',
  'blue',
  'indigo',
  'violet',
  'purple',
  'pink',
  'rose',
] as const;

/** Type ของ palette key — literal union `'default' | 'slate' | ... | 'rose'` */
export type TagColorKey = (typeof TAG_COLOR_KEYS)[number];
