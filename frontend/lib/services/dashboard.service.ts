// File: frontend/lib/services/dashboard.service.ts
// Change Log:
// - 2026-10-16: แก้ bug unwrap response — backend มี TransformInterceptor ครอบทุก response
//   ด้วย envelope { statusCode, message, data } ทำให้ stats/activity แสดงค่าว่าง

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
  getStats: async (projectId?: string | null): Promise<DashboardStats> => {
    const params = projectId ? { projectId } : undefined;
    const response = await apiClient.get('/dashboard/stats', { params });
    // แกะ NestJS TransformInterceptor envelope { statusCode, message, data }
    return (response.data?.data ?? response.data) as DashboardStats;
  },

  getRecentActivity: async (projectId?: string | null): Promise<ActivityLog[]> => {
    try {
      const params = projectId ? { projectId } : undefined;
      const response = await apiClient.get('/dashboard/activity', { params });
      // แกะ NestJS TransformInterceptor envelope — items อยู่ใน data ชั้นใน
      const envelope: unknown = response.data;
      const items: unknown[] = Array.isArray((envelope as { data?: unknown })?.data)
        ? (envelope as { data: unknown[] }).data
        : Array.isArray(envelope)
          ? (envelope as unknown[])
          : [];
      if (items.length > 0) {
        return (items as RawActivityLog[]).map((log) => {
          const firstName = log.user?.firstName || '';
          const lastName = log.user?.lastName || '';
          const fullName = firstName || lastName ? `${firstName} ${lastName}`.trim() : log.user?.username || 'System';
          const initials =
            firstName && lastName ? `${firstName[0]}${lastName[0]}` : (log.user?.username?.[0] || 'S').toUpperCase();

          return {
            ...log,
            user: {
              name: fullName,
              initials: initials,
            },
            description:
              (log.details?.description as string) || `${log.action} ${log.entityType || ''} ${log.entityId || ''}`,
            targetUrl: `/${(log.entityType || 'correspondence').toLowerCase()}s/${log.entityId || ''}`,
          } as ActivityLog;
        });
      }
      return [];
    } catch (_error) {
      return [];
    }
  },

  getPendingTasks: async (projectId?: string | null): Promise<PendingTask[]> => {
    try {
      const params = projectId ? { projectId } : undefined;
      const response = await apiClient.get('/dashboard/pending', { params });
      // แกะ NestJS TransformInterceptor envelope — paginated payload ถูก unzip
      // เป็น { statusCode, message, data: [...], meta: {...} } จึงอ่าน data ชั้นใน
      const envelope: unknown = response.data;
      const rawTasks = (
        Array.isArray((envelope as { data?: unknown })?.data)
          ? (envelope as { data: unknown[] }).data
          : Array.isArray(envelope)
            ? (envelope as unknown[])
            : []
      ) as RawPendingTask[];

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
