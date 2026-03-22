import apiClient from '@/lib/api/client';
import { DashboardStats, ActivityLog, PendingTask } from '@/types/dashboard';

export const dashboardService = {
  getStats: async (): Promise<DashboardStats> => {
    const response = await apiClient.get('/dashboard/stats');
    return response.data;
  },

  getRecentActivity: async (): Promise<ActivityLog[]> => {
    try {
      const response = await apiClient.get('/dashboard/activity');
      // ตรวจสอบว่า response.data เป็น array จริงๆ
      if (Array.isArray(response.data)) {
        return response.data;
      }
      return [];
    } catch (_error) {
      return [];
    }
  },

  getPendingTasks: async (): Promise<PendingTask[]> => {
    try {
      const response = await apiClient.get('/dashboard/pending');
      // Backend คืน { data: [], meta: {} } ต้องดึง data ออกมา
      if (response.data?.data && Array.isArray(response.data.data)) {
        return response.data.data;
      }
      if (Array.isArray(response.data)) {
        return response.data;
      }
      return [];
    } catch (_error) {
      return [];
    }
  },
};
