// File: frontend/lib/utils/__tests__/tag-color.test.ts
// Change Log:
// - 2026-08-18: Initial creation — T006 verification

import { describe, it, expect } from 'vitest';
import { getTagColor } from '@/lib/utils/tag-color';
import { TAG_PALETTE, TAG_COLOR_KEYS } from '@/lib/constants/tag-colors';

describe('getTagColor', () => {
  it('คืน hex ที่ถูกต้องสำหรับ palette key ทั้ง 14 ตัว', () => {
    for (const entry of TAG_PALETTE) {
      expect(getTagColor(entry.key)).toBe(entry.hex);
    }
  });

  it('คืน hex ของ default เมื่อ key เป็น undefined', () => {
    const defaultHex = TAG_PALETTE.find((e) => e.key === 'default')!.hex;
    expect(getTagColor(undefined)).toBe(defaultHex);
  });

  it('คืน hex ของ default เมื่อ key เป็น empty string', () => {
    const defaultHex = TAG_PALETTE.find((e) => e.key === 'default')!.hex;
    expect(getTagColor('')).toBe(defaultHex);
  });

  it('คืน hex ของ default เมื่อ key เป็น null', () => {
    const defaultHex = TAG_PALETTE.find((e) => e.key === 'default')!.hex;
    expect(getTagColor(null)).toBe(defaultHex);
  });

  it('คืน hex ของ default เมื่อ key เป็น legacy hex value', () => {
    const defaultHex = TAG_PALETTE.find((e) => e.key === 'default')!.hex;
    expect(getTagColor('#ff0000')).toBe(defaultHex);
  });

  it('คืน hex ของ default เมื่อ key เป็นค่านอก palette', () => {
    const defaultHex = TAG_PALETTE.find((e) => e.key === 'default')!.hex;
    expect(getTagColor('purpleish')).toBe(defaultHex);
  });

  it('คืน hex ของ default เมื่อ key เป็น CSS color name ที่ไม่อยู่ใน palette', () => {
    const defaultHex = TAG_PALETTE.find((e) => e.key === 'default')!.hex;
    expect(getTagColor('cyan')).toBe(defaultHex);
  });

  it('case-sensitive — คืน default สำหรับ "Red" แม้ "red" จะ valid', () => {
    const defaultHex = TAG_PALETTE.find((e) => e.key === 'default')!.hex;
    expect(getTagColor('Red')).toBe(defaultHex);
  });

  it('TAG_COLOR_KEYS มี 14 entries และตรงกับ TAG_PALETTE keys', () => {
    expect(TAG_COLOR_KEYS).toHaveLength(14);
    const paletteKeys = TAG_PALETTE.map((e) => e.key);
    expect([...TAG_COLOR_KEYS]).toEqual(paletteKeys);
  });
});
