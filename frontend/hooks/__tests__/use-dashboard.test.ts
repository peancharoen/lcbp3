// File: frontend/hooks/__tests__/use-dashboard.test.ts
// Change Log:
// - 2026-06-13: Initial creation - test coverage for use-dashboard hooks

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { createTestQueryClient } from '@/lib/test-utils';
import { useDashboardStats, useRecentActivity, usePendingTasks, dashboardKeys } from '../use-dashboard';
import { dashboardService } from '@/lib/services/dashboard.service';

// Mock services
vi.mock('@/lib/services/dashboard.service', () => ({
  dashboardService: {
    getStats: vi.fn(),
    getRecentActivity: vi.fn(),
    getPendingTasks: vi.fn(),
  },
}));

describe('use-dashboard hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('dashboardKeys', () => {
    it('ควรสร้าง cache keys ที่ถูกต้อง', () => {
      expect(dashboardKeys.all).toEqual(['dashboard']);
      expect(dashboardKeys.stats('proj-1')).toEqual(['dashboard', 'stats', 'proj-1']);
      expect(dashboardKeys.activity('proj-2')).toEqual(['dashboard', 'activity', 'proj-2']);
      expect(dashboardKeys.pending('proj-3')).toEqual(['dashboard', 'pending', 'proj-3']);
    });
  });

  describe('useDashboardStats', () => {
    it('ควรดึงข้อมูล stats สำเร็จ', async () => {
      const mockData = { totalDocuments: 10, pendingApprovals: 2 };
      vi.mocked(dashboardService.getStats).mockResolvedValue(mockData as any);
      const { wrapper } = createTestQueryClient();
      const { result } = renderHook(() => useDashboardStats('proj-1'), { wrapper });
      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });
      expect(result.current.data).toEqual(mockData);
      expect(dashboardService.getStats).toHaveBeenCalledWith('proj-1');
    });
  });

  describe('useRecentActivity', () => {
    it('ควรดึงข้อมูล recent activity สำเร็จ', async () => {
      const mockData = [{ id: 'act-1', action: 'CREATE' }];
      vi.mocked(dashboardService.getRecentActivity).mockResolvedValue(mockData as any);
      const { wrapper } = createTestQueryClient();
      const { result } = renderHook(() => useRecentActivity('proj-1'), { wrapper });
      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });
      expect(result.current.data).toEqual(mockData);
      expect(dashboardService.getRecentActivity).toHaveBeenCalledWith('proj-1');
    });
  });

  describe('usePendingTasks', () => {
    it('ควรดึงข้อมูล pending tasks สำเร็จ', async () => {
      const mockData = [{ publicId: 'task-1', title: 'Task 1' }];
      vi.mocked(dashboardService.getPendingTasks).mockResolvedValue(mockData as any);
      const { wrapper } = createTestQueryClient();
      const { result } = renderHook(() => usePendingTasks('proj-1'), { wrapper });
      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });
      expect(result.current.data).toEqual(mockData);
      expect(dashboardService.getPendingTasks).toHaveBeenCalledWith('proj-1');
    });
  });
});
