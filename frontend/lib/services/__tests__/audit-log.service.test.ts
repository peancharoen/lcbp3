// File: frontend/lib/services/__tests__/audit-log.service.test.ts
// Change Log:
// - 2026-06-13: Initial creation - test coverage for auditLogService

import { describe, it, expect, vi, beforeEach } from 'vitest';
import apiClient from '@/lib/api/client';
import { auditLogService } from '../audit-log.service';

describe('auditLogService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getLogs', () => {
    it('ควรดึงข้อมูล audit logs รูปแบบอาร์เรย์ได้อย่างถูกต้อง', async () => {
      const mockLogs = [
        {
          publicId: '019505a1-7c3e-7000-8000-audit1111111',
          auditId: 'AUD-001',
          action: 'LOGIN',
          severity: 'INFO',
          createdAt: '2026-06-13T00:00:00.000Z',
        },
      ];
      vi.mocked(apiClient.get).mockResolvedValue({ data: mockLogs });
      const result = await auditLogService.getLogs();
      expect(apiClient.get).toHaveBeenCalledWith('/audit-logs', { params: undefined });
      expect(result).toEqual(mockLogs);
    });

    it('ควรดึงข้อมูล audit logs รูปแบบ data wrapper ได้อย่างถูกต้อง', async () => {
      const mockLogs = [
        {
          publicId: '019505a1-7c3e-7000-8000-audit1111111',
          auditId: 'AUD-001',
          action: 'LOGIN',
          severity: 'INFO',
          createdAt: '2026-06-13T00:00:00.000Z',
        },
      ];
      vi.mocked(apiClient.get).mockResolvedValue({ data: { data: mockLogs } });
      const result = await auditLogService.getLogs({ search: 'login' });
      expect(apiClient.get).toHaveBeenCalledWith('/audit-logs', { params: { search: 'login' } });
      expect(result).toEqual(mockLogs);
    });
  });
});
