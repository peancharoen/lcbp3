// File: frontend/lib/services/__tests__/session.service.test.ts
// Change Log:
// - 2026-06-13: Refactor to use static imports instead of require, fixing ESM module resolution errors

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sessionService, extractArrayData, transformSession } from '../session.service';
import apiClient from '@/lib/api/client';

// Mock apiClient
vi.mock('@/lib/api/client', () => ({
  default: {
    get: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('sessionService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getActiveSessions', () => {
    it('should get active sessions from array response', async () => {
      const mockSessions = [
        {
          id: 1,
          userId: 1,
          user: { username: 'testuser', firstName: 'Test', lastName: 'User' },
          deviceName: 'Chrome',
          ipAddress: '192.168.1.1',
          lastActive: '2026-01-01T00:00:00Z',
          isCurrent: true,
        },
      ];
      (apiClient.get as any).mockResolvedValue({ data: mockSessions });
      const result = await sessionService.getActiveSessions();
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(1);
      expect(result[0].user.username).toBe('testuser');
      expect(apiClient.get).toHaveBeenCalledWith('/auth/sessions');
    });

    it('should get active sessions from nested data response', async () => {
      const mockSessions = [
        {
          id: 2,
          userId: 2,
          user: { username: 'testuser2', firstName: 'Test2', lastName: 'User2' },
          deviceName: 'Firefox',
          ipAddress: '192.168.1.2',
          lastActive: '2026-01-02T00:00:00Z',
          isCurrent: false,
        },
      ];
      (apiClient.get as any).mockResolvedValue({ data: { data: mockSessions } });
      const result = await sessionService.getActiveSessions();
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(2);
      expect(apiClient.get).toHaveBeenCalledWith('/auth/sessions');
    });

    it('should handle string id in session and convert to number', async () => {
      const mockSessions = [
        {
          id: '3',
          userId: 3,
          user: { username: 'testuser3', firstName: 'Test3', lastName: 'User3' },
          deviceName: 'Safari',
          ipAddress: '192.168.1.3',
          lastActive: '2026-01-03T00:00:00Z',
          isCurrent: false,
        },
      ];
      (apiClient.get as any).mockResolvedValue({ data: { data: { data: mockSessions } } });
      const result = await sessionService.getActiveSessions();
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(3);
      expect(typeof result[0].id).toBe('number');
    });

    it('should return empty array for non-array response', async () => {
      (apiClient.get as any).mockResolvedValue({ data: 'not an array' });
      const result = await sessionService.getActiveSessions();
      expect(result).toEqual([]);
    });

    it('should return empty array for null response', async () => {
      (apiClient.get as any).mockResolvedValue({ data: null });
      const result = await sessionService.getActiveSessions();
      expect(result).toEqual([]);
    });
  });

  describe('revokeSession', () => {
    it('should revoke session by id', async () => {
      const mockResponse = { success: true };
      (apiClient.delete as any).mockResolvedValue({ data: mockResponse });
      const result = await sessionService.revokeSession(1);
      expect(result).toEqual(mockResponse);
      expect(apiClient.delete).toHaveBeenCalledWith('/auth/sessions/1');
    });

    it('should revoke session with numeric id', async () => {
      const mockResponse = { success: true };
      (apiClient.delete as any).mockResolvedValue({ data: mockResponse });
      await sessionService.revokeSession(123);
      expect(apiClient.delete).toHaveBeenCalledWith('/auth/sessions/123');
    });
  });

  describe('Helper Functions', () => {
    it('should extract array data from nested structure', () => {
      const data = { data: { data: [1, 2, 3] } };
      const result = extractArrayData(data);
      expect(result).toEqual([1, 2, 3]);
    });

    it('should return empty array for non-array data', () => {
      const data = { data: 'not an array' };
      const result = extractArrayData(data);
      expect(result).toEqual([]);
    });

    it('should transform session with number id', () => {
      const session = {
        id: 1,
        userId: 1,
        user: { username: 'test', firstName: 'Test', lastName: 'User' },
        deviceName: 'Chrome',
        ipAddress: '192.168.1.1',
        lastActive: '2026-01-01T00:00:00Z',
        isCurrent: true,
      };
      const result = transformSession(session);
      expect(result.id).toBe(1);
      expect(typeof result.id).toBe('number');
    });

    it('should transform session with string id to number', () => {
      const session = {
        id: '1',
        userId: 1,
        user: { username: 'test', firstName: 'Test', lastName: 'User' },
        deviceName: 'Chrome',
        ipAddress: '192.168.1.1',
        lastActive: '2026-01-01T00:00:00Z',
        isCurrent: true,
      };
      const result = transformSession(session);
      expect(result.id).toBe(1);
      expect(typeof result.id).toBe('number');
    });
  });
});
