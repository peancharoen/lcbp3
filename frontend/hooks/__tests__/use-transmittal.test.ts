// File: frontend/hooks/__tests__/use-transmittal.test.ts
// Change Log:
// - 2026-06-13: Initial creation - test coverage for useTransmittal hook

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { createTestQueryClient } from '@/lib/test-utils';
import { useTransmittal, transmittalKeys } from '../use-transmittal';
import { transmittalService } from '@/lib/services/transmittal.service';

// Mock service
vi.mock('@/lib/services/transmittal.service', () => ({
  transmittalService: {
    getByUuid: vi.fn(),
  },
}));

describe('useTransmittal hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('transmittalKeys', () => {
    it('ควรสร้าง cache keys ที่ถูกต้อง', () => {
      expect(transmittalKeys.all).toEqual(['transmittals']);
      expect(transmittalKeys.detail('uuid-1')).toEqual(['transmittals', 'detail', 'uuid-1']);
    });
  });

  describe('useTransmittal', () => {
    it('ควรดึงรายละเอียด transmittal สำเร็จ', async () => {
      const mockData = { publicId: 'uuid-1', transmittalNumber: 'TR-001' };
      vi.mocked(transmittalService.getByUuid).mockResolvedValue(mockData as any);
      const { wrapper } = createTestQueryClient();
      const { result } = renderHook(() => useTransmittal('uuid-1'), { wrapper });
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
      expect(result.current.transmittal).toEqual(mockData);
      expect(transmittalService.getByUuid).toHaveBeenCalledWith('uuid-1');
    });

    it('ควรดึงรายละเอียด transmittal สำเร็จในแบบ wrapped response', async () => {
      const mockData = { publicId: 'uuid-2', transmittalNumber: 'TR-002' };
      vi.mocked(transmittalService.getByUuid).mockResolvedValue({ data: mockData } as any);
      const { wrapper } = createTestQueryClient();
      const { result } = renderHook(() => useTransmittal('uuid-2'), { wrapper });
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
      expect(result.current.transmittal).toEqual(mockData);
    });

    it('ไม่ควรทำงานเมื่อไม่ระบุ uuid', async () => {
      const { wrapper } = createTestQueryClient();
      const { result } = renderHook(() => useTransmittal(undefined), { wrapper });
      expect(result.current.isLoading).toBe(false);
      expect(result.current.transmittal).toBeUndefined();
      expect(transmittalService.getByUuid).not.toHaveBeenCalled();
    });
  });
});
