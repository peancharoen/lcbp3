// File: frontend/lib/utils/tag-color.ts
// Change Log:
// - 2026-08-18: Initial creation — ADR-046 shared helper สำหรับ render tag color

import { TAG_PALETTE, TAG_COLOR_KEYS, DEFAULT_TAG_COLOR_HEX, type TagColorKey } from '@/lib/constants/tag-colors';

/**
 * Map ระหว่าง palette key → hex สำหรับ render
 * ใช้สำหรับ lookup เร็ว (O(1)) แทนการ `.find()` ทุกครั้ง
 */
const KEY_TO_HEX: ReadonlyMap<string, string> = new Map(
  TAG_PALETTE.map((entry) => [entry.key, entry.hex]),
);

/**
 * แปลง palette key เป็น hex สำหรับ render
 *
 * - ค่าที่ valid ใน `TAG_COLOR_KEYS` → คืน hex ของ key นั้น
 * - ค่าว่าง / undefined / null / ค่านอก palette (legacy) → คืน `DEFAULT_TAG_COLOR_HEX`
 *
 * ใช้ทุกที่ที่ต้องแปลง `tags.color_code` เป็นสีสำหรับแสดงผล
 * (tags/page.tsx, tag-manager.tsx, ฯลฯ)
 *
 * @param key - palette key จาก `tags.color_code` (อาจเป็น legacy hex/name ก็ได้)
 * @returns hex string เช่น `'#ef4444'` สำหรับใช้ใน CSS `background-color`
 */
export const getTagColor = (key?: string | null): string => {
  if (key && TAG_COLOR_KEYS.includes(key as TagColorKey)) {
    return KEY_TO_HEX.get(key) ?? DEFAULT_TAG_COLOR_HEX;
  }
  return DEFAULT_TAG_COLOR_HEX;
};
