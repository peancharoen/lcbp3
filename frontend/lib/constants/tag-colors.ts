// File: frontend/lib/constants/tag-colors.ts
// Change Log:
// - 2026-08-18: Initial creation — ADR-046 palette key source of truth

/**
 * Tag Color Palette — ค่าที่ valid สำหรับ `tags.color_code`
 *
 * Source of truth สำหรับ palette key list (ADR-046)
 * Backend mirror ที่ `backend/src/modules/master/constants/tag-colors.ts`
 * ต้อง sync กับไฟล์นี้เสมอ — มี test ตรวจความตรง
 */

/** Palette key ที่ valid ทั้งหมด (14 keys, ตั้งชื่อตาม Tailwind color palette) */
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

/** Type ของ palette key — ใช้สำหรับ type-safe parameter/return */
export type TagColorKey = (typeof TAG_COLOR_KEYS)[number];

/** โครงสร้าง palette entry — key + hex (shade 500 ตาม Tailwind) */
export interface TagPaletteEntry {
  /** Palette key ที่เก็บใน `tags.color_code` */
  key: TagColorKey;
  /** Hex value สำหรับ render (shade 500, `default` = slate-200) */
  hex: string;
}

/**
 * Hex ของ palette key `'default'` — ใช้ตรวจสอบว่าสีเป็น default หรือไม่
 * (เช่น tag-manager.tsx ใช้เพื่อตั้ง `color: 'inherit'` สำหรับ default tag)
 *
 * Export เป็น constant เพื่อหลีกเลี่ยง magic value ในโค้ดที่ใช้งาน
 */
export const DEFAULT_TAG_COLOR_HEX = '#e2e8f0' as const;

/**
 * Palette ทั้งหมด — key → hex mapping
 * `default` ใช้ slate-200 เพื่อให้ visually neutral (ไม่ใช่ slate-500 ที่เข้มเกิน)
 */
export const TAG_PALETTE: readonly TagPaletteEntry[] = [
  { key: 'default', hex: DEFAULT_TAG_COLOR_HEX },
  { key: 'slate', hex: '#64748b' },
  { key: 'red', hex: '#ef4444' },
  { key: 'orange', hex: '#f97316' },
  { key: 'amber', hex: '#f59e0b' },
  { key: 'yellow', hex: '#eab308' },
  { key: 'green', hex: '#22c55e' },
  { key: 'teal', hex: '#14b8a6' },
  { key: 'blue', hex: '#3b82f6' },
  { key: 'indigo', hex: '#6366f1' },
  { key: 'violet', hex: '#8b5cf6' },
  { key: 'purple', hex: '#a855f7' },
  { key: 'pink', hex: '#ec4899' },
  { key: 'rose', hex: '#f43f5e' },
] as const;
