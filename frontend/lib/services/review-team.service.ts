// File: lib/services/review-team.service.ts
import apiClient from '@/lib/api/client';

export interface CreateReviewTeamDto {
  name: string;
  description?: string;
  projectPublicId: string;
  defaultForRfaTypes?: string[];
}

export interface UpdateReviewTeamDto {
  name?: string;
  description?: string;
  defaultForRfaTypes?: string[];
  isActive?: boolean;
}

export interface AddTeamMemberDto {
  userPublicId: string;
  disciplineId: number;
  role: 'REVIEWER' | 'LEAD' | 'MANAGER';
  priorityOrder?: number;
}

export interface SearchReviewTeamDto {
  projectPublicId?: string;
  isActive?: boolean;
  search?: string;
}

export const reviewTeamService = {
  /** ดึง Review Teams ตาม project */
  getAll: async (params?: SearchReviewTeamDto) => {
    const response = await apiClient.get('/review-teams', { params });
    return response.data;
  },

  /** ดึง Review Team เดียว (ADR-019) */
  getByPublicId: async (publicId: string) => {
    const response = await apiClient.get(`/review-teams/${publicId}`);
    return response.data;
  },

  /** สร้าง Review Team */
  create: async (data: CreateReviewTeamDto) => {
    const response = await apiClient.post('/review-teams', data);
    return response.data;
  },

  /** อัปเดต Review Team */
  update: async (publicId: string, data: UpdateReviewTeamDto) => {
    const response = await apiClient.patch(`/review-teams/${publicId}`, data);
    return response.data;
  },

  /** เพิ่มสมาชิก */
  addMember: async (teamPublicId: string, data: AddTeamMemberDto) => {
    const response = await apiClient.post(`/review-teams/${teamPublicId}/members`, data);
    return response.data;
  },

  /** ลบสมาชิก */
  removeMember: async (teamPublicId: string, memberPublicId: string) => {
    const response = await apiClient.delete(
      `/review-teams/${teamPublicId}/members/${memberPublicId}`,
    );
    return response.data;
  },

  /** Deactivate Review Team */
  deactivate: async (publicId: string) => {
    const response = await apiClient.delete(`/review-teams/${publicId}`);
    return response.data;
  },
};
