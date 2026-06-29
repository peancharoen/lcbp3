// File: frontend/lib/utils/__tests__/uuid-guard.test.ts
// Change Log:
// - 2026-06-13: Initial creation - test coverage for assertUuid utility (pure function 100%)

import { describe, it, expect } from 'vitest';
import { assertUuid } from '../uuid-guard';

describe('assertUuid', () => {
  it('ควร return UUID ที่ถูกต้องกลับมา', () => {
    const validUuid = '019505a1-7c3e-7000-8000-abc123def456';
    expect(assertUuid(validUuid)).toBe(validUuid);
  });

  it('ควร return UUIDv4 ที่ถูกต้องกลับมา', () => {
    const uuidV4 = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
    expect(assertUuid(uuidV4)).toBe(uuidV4);
  });

  it('ควร return UUID lowercase ที่ถูกต้องกลับมา', () => {
    const lowercase = '00000000-0000-0000-0000-000000000001';
    expect(assertUuid(lowercase)).toBe(lowercase);
  });

  it('ควร throw Error เมื่อ value ไม่ใช่ UUID format', () => {
    expect(() => assertUuid('not-a-uuid')).toThrow('Invalid UUID format: not-a-uuid');
  });

  it('ควร throw Error เมื่อ value เป็น integer string', () => {
    expect(() => assertUuid('12345')).toThrow('Invalid UUID format: 12345');
  });

  it('ควร throw Error เมื่อ value เป็น string ว่าง', () => {
    expect(() => assertUuid('')).toThrow('Invalid UUID format: ');
  });

  it('ควร throw Error เมื่อ UUID มี segment ไม่ครบ', () => {
    expect(() => assertUuid('019505a1-7c3e-7000-8000')).toThrow();
  });

  it('ควร throw Error เมื่อ UUID มีตัวอักษรที่ไม่ใช่ hex', () => {
    expect(() => assertUuid('gggggggg-gggg-gggg-gggg-gggggggggggg')).toThrow();
  });
});
