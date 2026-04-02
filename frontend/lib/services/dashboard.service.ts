import apiClient from '@/lib/api/client';
import { DashboardStats, ActivityLog, PendingTask } from '@/types/dashboard';

interface RawActivityLog {
  id: string;
  action: string;
  entityType?: string;
  entityId?: string;
  details?: Record<string, unknown>;
  createdAt: string;
  user?: {
    username: string;
    firstName?: string;
    lastName?: string;
  };
}

interface RawPendingTask {
  instanceId: string;
  workflowCode: string;
  currentState: string;
  entityType: string;
  entityId: string;
  documentNumber: string;
  subject: string;
  assignedAt: string;
}

export const dashboardService = {
  getStats: async (): Promise<DashboardStats> => {
    const response = await apiClient.get('/dashboard/stats');
    return response.data;
  },

  getRecentActivity: async (): Promise<ActivityLog[]> => {
    try {
      const response = await apiClient.get('/dashboard/activity');
      if (Array.isArray(response.data)) {
        return (response.data as RawActivityLog[]).map((log) => {
          const firstName = log.user?.firstName || '';
          const lastName = log.user?.lastName || '';
          const fullName = firstName || lastName ? `${firstName} ${lastName}`.trim() : log.user?.username || 'System';
          const initials = firstName && lastName ? `${firstName[0]}${lastName[0]}` : (log.user?.username?.[0] || 'S').toUpperCase();

          return {
            ...log,
            user: {
              name: fullName,
              initials: initials,
            },
            description: (log.details?.description as string) || `${log.action} ${log.entityType || ''} ${log.entityId || ''}`,
            targetUrl: `/${(log.entityType || 'correspondence').toLowerCase()}s/${log.entityId || ''}`,
          } as ActivityLog;
        });
      }
      return [];
    } catch (_error) {
      return [];
    }
  },

  getPendingTasks: async (): Promise<PendingTask[]> => {
    try {
      const response = await apiClient.get('/dashboard/pending');
      const rawTasks = (response.data?.data || (Array.isArray(response.data) ? response.data : [])) as RawPendingTask[];

      return rawTasks.map((task) => {
        const assignedAt = new Date(task.assignedAt);
        const now = new Date();
        const diffTime = now.getTime() - assignedAt.getTime();
        const daysOverdue = Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));

        return {
          ...task,
          publicId: task.instanceId,
          title: task.subject || task.documentNumber,
          description: task.currentState || task.workflowCode,
          daysOverdue,
          url: `/${(task.entityType || 'correspondence').toLowerCase()}s/${task.entityId}`,
          priority: daysOverdue > 2 ? 'HIGH' : 'MEDIUM',
        };
      });
    } catch (_error) {
      return [];
    }
  },
};
