// File: lib/__tests__/auth.test.ts
// Change Log:
// - 2026-06-14: สร้างใหม่สำหรับ Phase 3 Coverage

import { describe, it, expect, vi } from 'vitest';
import { getJwtExpiry, unwrapApiResponse, isTokenPayload } from '../auth';

// Mock NextAuth
vi.mock('next-auth', () => ({
  default: vi.fn(() => ({
    handlers: { GET: vi.fn(), POST: vi.fn() },
    auth: vi.fn(),
    signIn: vi.fn(),
    signOut: vi.fn(),
  })),
}));

describe('auth.ts helper functions', () => {
  describe('getJwtExpiry', () => {
    it('ควรคำนวณ expiry time จาก valid JWT token', () => {
      const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE2ODAwMDAwMDB9.test';
      const expiry = getJwtExpiry(token);

      expect(expiry).toBe(1680000000000);
    });

    it('ควร return Date.now() เมื่อ token ไม่ valid', () => {
      const invalidToken = 'invalid.token.here';
      const expiry = getJwtExpiry(invalidToken);

      expect(expiry).toBeLessThanOrEqual(Date.now() + 1000);
    });
  });

  describe('unwrapApiResponse', () => {
    it('ควร return value ทันทีเมื่อไม่ใช่ object', () => {
      const value = 'test string';
      const result = unwrapApiResponse(value);
      expect(result).toBe('test string');
    });

    it('ควร unwrap data เมื่อไม่มี access_token', () => {
      const value = { data: { some: 'value' } };
      const result = unwrapApiResponse(value);
      expect(result).toEqual({ some: 'value' });
    });

    it('ควร return value เมื่อมี access_token', () => {
      const value = { access_token: 'test_token' };
      const result = unwrapApiResponse(value);
      expect(result).toEqual({ access_token: 'test_token' });
    });

    it('ควร unwrap data ซ้อนกันสูงสุด 5 ชั้น', () => {
      const value = { data: { data: { data: { data: { access_token: 'test_token' } } } } };
      const result = unwrapApiResponse(value);
      expect(result).toEqual({ access_token: 'test_token' });
    });
  });

  describe('isTokenPayload', () => {
    it('ควร return true เมื่อมี access_token เป็น string', () => {
      const value = { access_token: 'test_token' };
      expect(isTokenPayload(value)).toBe(true);
    });

    it('ควร return false เมื่อไม่มี access_token', () => {
      const value = { some: 'value' };
      expect(isTokenPayload(value)).toBe(false);
    });

    it('ควร return false เมื่อ access_token ไม่ใช่ string', () => {
      const value = { access_token: 123 };
      expect(isTokenPayload(value)).toBe(false);
    });

    it('ควร return false เมื่อ value เป็น null', () => {
      const value = null;
      expect(isTokenPayload(value)).toBe(false);
    });
  });
});
