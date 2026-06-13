// File: frontend/hooks/__tests__/use-review-teams.test.ts
// Change Log:
// - 2026-06-13: Initial creation - test coverage for use-review-teams hooks

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { createTestQueryClient } from '@/lib/test-utils';
import {
  useReviewTeams,
  useReviewTeam,
  useCreateReviewTeam,
  useUpdateReviewTeam,
  useAddTeamMember,
  useRemoveTeamMember,
  reviewTeamKeys,
} from '../use-review-teams';
import { reviewTeamService } from '@/lib/services/review-team.service';
import { toast } from 'sonner';

// Mock reviewTeamService
vi.mock('@/lib/services/review-team.service', () => ({
  reviewTeamService: {
    getAll: vi.fn(),
    getByPublicId: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    addMember: vi.fn(),
    removeMember: vi.fn(),
  },
}));

describe('use-review-teams hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('reviewTeamKeys', () => {
    it('ควรสร้าง cache keys ที่ถูกต้อง', () => {
      expect(reviewTeamKeys.all).toEqual(['reviewTeams']);
      expect(reviewTeamKeys.lists()).toEqual(['reviewTeams', 'list']);
      expect(reviewTeamKeys.list({ search: 'A' })).toEqual(['reviewTeams', 'list', { search: 'A' }]);
      expect(reviewTeamKeys.details()).toEqual(['reviewTeams', 'detail']);
      expect(reviewTeamKeys.detail('uuid-1')).toEqual(['reviewTeams', 'detail', 'uuid-1']);
    });
  });

  describe('useReviewTeams', () => {
    it('ควรดึงข้อมูล lists ของ review teams สำเร็จ', async () => {
      const mockData = [{ publicId: 'uuid-team-1', teamName: 'Team A' }];
      vi.mocked(reviewTeamService.getAll).mockResolvedValue(mockData as any);
      const { wrapper } = createTestQueryClient();
      const { result } = renderHook(() => useReviewTeams({ search: 'A' }), { wrapper });
      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });
      expect(result.current.data).toEqual(mockData);
      expect(reviewTeamService.getAll).toHaveBeenCalledWith({ search: 'A' });
    });
  });

  describe('useReviewTeam', () => {
    it('ควรดึงข้อมูลรายละเอียด review team สำเร็จ', async () => {
      const mockData = { publicId: 'uuid-team-1', teamName: 'Team A' };
      vi.mocked(reviewTeamService.getByPublicId).mockResolvedValue(mockData as any);
      const { wrapper } = createTestQueryClient();
      const { result } = renderHook(() => useReviewTeam('uuid-team-1'), { wrapper });
      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });
      expect(result.current.data).toEqual(mockData);
      expect(reviewTeamService.getByPublicId).toHaveBeenCalledWith('uuid-team-1');
    });
  });

  describe('useCreateReviewTeam', () => {
    it('ควรสร้าง review team สำเร็จและแสดง toast success', async () => {
      vi.mocked(reviewTeamService.create).mockResolvedValue({ success: true } as any);
      const { wrapper } = createTestQueryClient();
      const { result } = renderHook(() => useCreateReviewTeam(), { wrapper });
      const mockDto = { teamName: 'New Team', projectId: 1 };
      await act(async () => {
        await result.current.mutateAsync(mockDto as any);
      });
      expect(reviewTeamService.create).toHaveBeenCalledWith(mockDto);
      expect(toast.success).toHaveBeenCalledWith('Review Team created successfully');
    });

    it('ควรแสดง toast error เมื่อสร้าง review team ล้มเหลว', async () => {
      const mockError = new Error('API Error');
      vi.mocked(reviewTeamService.create).mockRejectedValue(mockError);
      const { wrapper } = createTestQueryClient();
      const { result } = renderHook(() => useCreateReviewTeam(), { wrapper });
      await act(async () => {
        try {
          await result.current.mutateAsync({ teamName: 'New Team' } as any);
        } catch {
          // Expected
        }
      });
      expect(toast.error).toHaveBeenCalledWith('Failed to create Review Team', {
        description: 'API Error',
      });
    });
  });

  describe('useUpdateReviewTeam', () => {
    it('ควรปรับปรุงข้อมูลทีมสำเร็จและแสดง toast success', async () => {
      vi.mocked(reviewTeamService.update).mockResolvedValue({ success: true } as any);
      const { wrapper } = createTestQueryClient();
      const { result } = renderHook(() => useUpdateReviewTeam(), { wrapper });
      await act(async () => {
        await result.current.mutateAsync({ publicId: 'uuid-team-1', data: { teamName: 'Updated Team' } });
      });
      expect(reviewTeamService.update).toHaveBeenCalledWith('uuid-team-1', { teamName: 'Updated Team' });
      expect(toast.success).toHaveBeenCalledWith('Review Team updated');
    });

    it('ควรแสดง toast error เมื่อปรับปรุงข้อมูลทีมล้มเหลว', async () => {
      const mockError = new Error('API Error');
      vi.mocked(reviewTeamService.update).mockRejectedValue(mockError);
      const { wrapper } = createTestQueryClient();
      const { result } = renderHook(() => useUpdateReviewTeam(), { wrapper });
      await act(async () => {
        try {
          await result.current.mutateAsync({ publicId: 'uuid-team-1', data: { teamName: 'Updated Team' } });
        } catch {
          // Expected
        }
      });
      expect(toast.error).toHaveBeenCalledWith('Failed to update Review Team', {
        description: 'API Error',
      });
    });
  });

  describe('useAddTeamMember', () => {
    it('ควรเพิ่มสมาชิกเข้าทีมสำเร็จและแสดง toast success', async () => {
      vi.mocked(reviewTeamService.addMember).mockResolvedValue({ success: true } as any);
      const { wrapper } = createTestQueryClient();
      const { result } = renderHook(() => useAddTeamMember(), { wrapper });
      await act(async () => {
        await result.current.mutateAsync({ teamPublicId: 'uuid-team-1', data: { userPublicId: 'uuid-user-1', role: 'REVIEWER' } as any });
      });
      expect(reviewTeamService.addMember).toHaveBeenCalledWith('uuid-team-1', { userPublicId: 'uuid-user-1', role: 'REVIEWER' });
      expect(toast.success).toHaveBeenCalledWith('Member added to team');
    });

    it('ควรแสดง toast error เมื่อเพิ่มสมาชิกเข้าทีมล้มเหลว', async () => {
      const mockError = new Error('API Error');
      vi.mocked(reviewTeamService.addMember).mockRejectedValue(mockError);
      const { wrapper } = createTestQueryClient();
      const { result } = renderHook(() => useAddTeamMember(), { wrapper });
      await act(async () => {
        try {
          await result.current.mutateAsync({ teamPublicId: 'uuid-team-1', data: { userPublicId: 'uuid-user-1', role: 'REVIEWER' } as any });
        } catch {
          // Expected
        }
      });
      expect(toast.error).toHaveBeenCalledWith('Failed to add member', {
        description: 'API Error',
      });
    });
  });

  describe('useRemoveTeamMember', () => {
    it('ควรลบสมาชิกออกจากทีมสำเร็จและแสดง toast success', async () => {
      vi.mocked(reviewTeamService.removeMember).mockResolvedValue({ success: true } as any);
      const { wrapper } = createTestQueryClient();
      const { result } = renderHook(() => useRemoveTeamMember(), { wrapper });
      await act(async () => {
        await result.current.mutateAsync({ teamPublicId: 'uuid-team-1', memberPublicId: 'uuid-member-1' });
      });
      expect(reviewTeamService.removeMember).toHaveBeenCalledWith('uuid-team-1', 'uuid-member-1');
      expect(toast.success).toHaveBeenCalledWith('Member removed from team');
    });

    it('ควรแสดง toast error เมื่อลบสมาชิกออกจากทีมล้มเหลว', async () => {
      const mockError = new Error('API Error');
      vi.mocked(reviewTeamService.removeMember).mockRejectedValue(mockError);
      const { wrapper } = createTestQueryClient();
      const { result } = renderHook(() => useRemoveTeamMember(), { wrapper });
      await act(async () => {
        try {
          await result.current.mutateAsync({ teamPublicId: 'uuid-team-1', memberPublicId: 'uuid-member-1' });
        } catch {
          // Expected
        }
      });
      expect(toast.error).toHaveBeenCalledWith('Failed to remove member', {
        description: 'API Error',
      });
    });
  });
});
