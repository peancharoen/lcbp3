// File: lib/api/__tests__/ai.test.ts
// Change Log:
// - 2026-06-14: สร้างใหม่สำหรับ Phase 3 Coverage

import { describe, it, expect } from 'vitest';
import { extractData } from '../ai';

describe('ai.ts helper functions', () => {
  describe('extractData', () => {
    it('ควร return value ทันทีเมื่อไม่ใช่ object', () => {
      const value = 'test string';
      const result = extractData(value);
      expect(result).toBe('test string');
    });

    it('ควร return value ทันทีเมื่อไม่มี data property', () => {
      const value = { some: 'value' };
      const result = extractData(value);
      expect(result).toEqual({ some: 'value' });
    });

    it('ควร unwrap data เมื่อมี data property', () => {
      const value = { data: { some: 'value' } };
      const result = extractData(value);
      expect(result).toEqual({ some: 'value' });
    });

    it('ควร unwrap data ซ้อนกันสูงสุด 5 ชั้น', () => {
      const value = { data: { data: { data: { data: { data: 'final' } } } } };
      const result = extractData(value);
      expect(result).toBe('final');
    });
  });
});
