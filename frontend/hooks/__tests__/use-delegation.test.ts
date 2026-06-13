// File: frontend/hooks/__tests__/use-delegation.test.ts
// Change Log:
// - 2026-06-13: Initial creation - test coverage for use-delegation hooks

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { createTestQueryClient } from '@/lib/test-utils';
import { useMyDelegations, useCreateDelegation, useRevokeDelegation, delegationKeys } from '../use-delegation';
import apiClient from '@/lib/api/client';
import { toast } from 'sonner';

// Mock apiClient
vi.mock('@/lib/api/client', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('use-delegation hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('delegationKeys', () => {
    it('ควรสร้าง cache keys ที่ถูกต้อง', () => {
      expect(delegationKeys.all).toEqual(['delegations']);
      expect(delegationKeys.mine()).toEqual(['delegations', 'mine']);
    });
  });

  describe('useMyDelegations', () => {
    it('ควรดึงข้อมูล delegations ของฉันสำเร็จ', async () => {
      const mockData = [{ publicId: 'uuid-deleg-1', scope: 'PROJECT' }];
      vi.mocked(apiClient.get).mockResolvedValue({ data: mockData });
      const { wrapper } = createTestQueryClient();
      const { result } = renderHook(() => useMyDelegations(), { wrapper });
      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });
      expect(result.current.data).toEqual(mockData);
      expect(apiClient.get).toHaveBeenCalledWith('/delegations');
    });
  });

  describe('useCreateDelegation', () => {
    it('ควรสร้าง delegation สำเร็จและแสดง toast success', async () => {
      vi.mocked(apiClient.post).mockResolvedValue({ data: { success: true } });
      const { wrapper } = createTestQueryClient();
      const { result } = renderHook(() => useCreateDelegation(), { wrapper });
      const mockDto = {
        delegateUserPublicId: 'uuid-user-1',
        scope: 'PROJECT' as const,
        startDate: '2026-01-01',
        endDate: '2026-01-10',
      };
      await act(async () => {
        await result.current.mutateAsync(mockDto);
      });
      expect(apiClient.post).toHaveBeenCalledWith('/delegations', mockDto);
      expect(toast.success).toHaveBeenCalledWith('Delegation created successfully');
    });

    it('ควรแสดง toast error เมื่อสร้าง delegation ล้มเหลว', async () => {
      const mockError = new Error('API Error');
      vi.mocked(apiClient.post).mockRejectedValue(mockError);
      const { wrapper } = createTestQueryClient();
      const { result } = renderHook(() => useCreateDelegation(), { wrapper });
      const mockDto = {
        delegateUserPublicId: 'uuid-user-1',
        scope: 'PROJECT' as const,
        startDate: '2026-01-01',
        endDate: '2026-01-10',
      };
      await act(async () => {
        try {
          await result.current.mutateAsync(mockDto);
        } catch {
          // Expected
        }
      });
      expect(toast.error).toHaveBeenCalledWith('Failed to create delegation', {
        description: 'API Error',
      });
    });
  });

  describe('useRevokeDelegation', () => {
    it('ควรลบ delegation (revoke) สำเร็จและแสดง toast success', async () => {
      vi.mocked(apiClient.delete).mockResolvedValue({ data: { success: true } });
      const { wrapper } = createTestQueryClient();
      const { result } = renderHook(() => useRevokeDelegation(), { wrapper });
      await act(async () => {
        await result.current.mutateAsync('uuid-deleg-1');
      });
      expect(apiClient.delete).toHaveBeenCalledWith('/delegations/uuid-deleg-1');
      expect(toast.success).toHaveBeenCalledWith('Delegation revoked');
    });

    it('ควรแสดง toast error เมื่อยกเลิก delegation ล้มเหลว', async () => {
      const mockError = new Error('API Error');
      vi.mocked(apiClient.delete).mockRejectedValue(mockError);
      const { wrapper } = createTestQueryClient();
      const { result } = renderHook(() => useRevokeDelegation(), { wrapper });
      await act(async () => {
        try {
          await result.current.mutateAsync('uuid-deleg-1');
        } catch {
          // Expected
        }
      });
      expect(toast.error).toHaveBeenCalledWith('Failed to revoke delegation', {
        description: 'API Error',
      });
    });
  });
});
