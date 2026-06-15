// File: lib/api/__tests__/drawings.test.ts
// Change Log:
// - 2026-06-14: สร้างใหม่สำหรับ Phase 3 Coverage

import { describe, it, expect } from 'vitest';
import { drawingApi } from '../drawings';

describe('drawingApi', () => {
  describe('getAll', () => {
    it('ควร return array of drawings พร้อม meta', async () => {
      const result = await drawingApi.getAll();
      
      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('meta');
      expect(Array.isArray(result.data)).toBe(true);
    });

    it('ควร return drawings ที่มี publicId, drawingNumber, title', async () => {
      const result = await drawingApi.getAll();
      
      expect(result.data[0]).toHaveProperty('publicId');
      expect(result.data[0]).toHaveProperty('drawingNumber');
      expect(result.data[0]).toHaveProperty('title');
    });

    it('ควร return meta.total เท่ากับจำนวน drawings', async () => {
      const result = await drawingApi.getAll();
      
      expect(result.meta.total).toBe(result.data.length);
    });
  });

  describe('getById', () => {
    it('ควร return drawing เมื่อ id ถูกต้อง', async () => {
      const drawing = await drawingApi.getById('dwg-001');
      
      expect(drawing).toBeDefined();
      expect(drawing?.publicId).toBe('dwg-001');
    });

    it('ควร return undefined เมื่อ id ไม่ถูกต้อง', async () => {
      const drawing = await drawingApi.getById('non-existent');
      
      expect(drawing).toBeUndefined();
    });
  });

  describe('getByContract', () => {
    it('ควร return array of drawings สำหรับ contract', async () => {
      const result = await drawingApi.getByContract('contract-001');
      
      expect(result).toHaveProperty('data');
      expect(Array.isArray(result.data)).toBe(true);
    });

    it('ควร return drawings ที่มี discipline, status, revision', async () => {
      const result = await drawingApi.getByContract('contract-001');
      
      expect(result.data[0]).toHaveProperty('discipline');
      expect(result.data[0]).toHaveProperty('status');
      expect(result.data[0]).toHaveProperty('revision');
    });
  });
});
