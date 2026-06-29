// File: frontend/lib/services/__tests__/review-team.service.test.ts
// Change Log:
// - 2026-06-13: Initial creation - test coverage for reviewTeamService

import { describe, it, expect, vi, beforeEach } from 'vitest';
import apiClient from '@/lib/api/client';
import { reviewTeamService } from '../review-team.service';

describe('reviewTeamService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getAll', () => {
    it('ควรดึงข้อมูลทีมทบทวนทั้งหมดสำเร็จ', async () => {
      const mockTeams = [{ publicId: '019505a1-7c3e-7000-8000-team11111111', name: 'Review Team Alpha' }];
      vi.mocked(apiClient.get).mockResolvedValue({ data: mockTeams });
      const result = await reviewTeamService.getAll({ projectPublicId: 'proj-1' });
      expect(apiClient.get).toHaveBeenCalledWith('/review-teams', { params: { projectPublicId: 'proj-1' } });
      expect(result).toEqual(mockTeams);
    });
  });

  describe('getByPublicId', () => {
    it('ควรดึงข้อมูลทีมตาม PublicId สำเร็จ', async () => {
      const mockTeam = { publicId: '019505a1-7c3e-7000-8000-team11111111', name: 'Review Team Alpha' };
      vi.mocked(apiClient.get).mockResolvedValue({ data: mockTeam });
      const result = await reviewTeamService.getByPublicId('019505a1-7c3e-7000-8000-team11111111');
      expect(apiClient.get).toHaveBeenCalledWith('/review-teams/019505a1-7c3e-7000-8000-team11111111');
      expect(result).toEqual(mockTeam);
    });
  });

  describe('create', () => {
    it('ควรส่งคำขอ POST เพื่อสร้างทีมทบทวนใหม่สำเร็จ', async () => {
      const createDto = { name: 'New Team', projectPublicId: 'proj-1', defaultForRfaTypes: ['RFA'] };
      vi.mocked(apiClient.post).mockResolvedValue({ data: { publicId: 'new-team-uuid', ...createDto } });
      const result = await reviewTeamService.create(createDto);
      expect(apiClient.post).toHaveBeenCalledWith('/review-teams', createDto);
      expect(result.name).toBe('New Team');
    });
  });

  describe('update', () => {
    it('ควรส่งคำขอ PATCH เพื่ออัปเดตทีมทบทวนสำเร็จ', async () => {
      const updateDto = { name: 'Updated Team' };
      vi.mocked(apiClient.patch).mockResolvedValue({ data: { publicId: 'team-uuid', ...updateDto } });
      const result = await reviewTeamService.update('team-uuid', updateDto);
      expect(apiClient.patch).toHaveBeenCalledWith('/review-teams/team-uuid', updateDto);
      expect(result.name).toBe('Updated Team');
    });
  });

  describe('addMember', () => {
    it('ควรส่งคำขอ POST เพื่อเพิ่มสมาชิกเข้าทีมทบทวนสำเร็จ', async () => {
      const memberDto = { userPublicId: 'user-1', disciplineId: 1, role: 'REVIEWER' as const };
      vi.mocked(apiClient.post).mockResolvedValue({ data: { success: true } });
      const result = await reviewTeamService.addMember('team-uuid', memberDto);
      expect(apiClient.post).toHaveBeenCalledWith('/review-teams/team-uuid/members', memberDto);
      expect(result).toEqual({ success: true });
    });
  });

  describe('removeMember', () => {
    it('ควรส่งคำขอ DELETE เพื่อลบสมาชิกออกจากทีมทบทวนสำเร็จ', async () => {
      vi.mocked(apiClient.delete).mockResolvedValue({ data: { success: true } });
      const result = await reviewTeamService.removeMember('team-uuid', 'member-uuid');
      expect(apiClient.delete).toHaveBeenCalledWith('/review-teams/team-uuid/members/member-uuid');
      expect(result).toEqual({ success: true });
    });
  });

  describe('deactivate', () => {
    it('ควรส่งคำขอ DELETE เพื่อหยุดการทำงานของทีมทบทวนสำเร็จ', async () => {
      vi.mocked(apiClient.delete).mockResolvedValue({ data: { success: true } });
      const result = await reviewTeamService.deactivate('team-uuid');
      expect(apiClient.delete).toHaveBeenCalledWith('/review-teams/team-uuid');
      expect(result).toEqual({ success: true });
    });
  });
});
