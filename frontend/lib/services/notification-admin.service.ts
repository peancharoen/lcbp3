// File: frontend/lib/services/notification-admin.service.ts
// Change Log:
// - 2026-09-25: Initial creation (Feature 258 US4, T057) — admin deliveries audit + Telegram settings client

import apiClient from '@/lib/api/client';

/** Delivery audit row จาก GET /admin/notifications/deliveries (FR-009) */
export interface NotificationDelivery {
  publicId: string;
  channelType: 'EMAIL' | 'LINE' | 'SYSTEM' | 'TELEGRAM';
  target: string;
  eventType: string;
  entityType?: string;
  entityId?: string;
  status: 'PENDING' | 'SENT' | 'FAILED' | 'SKIPPED';
  errorCode?: string;
  errorMessage?: string;
  attemptCount: number;
  queuedJobId?: string;
  sentAt?: string;
  createdAt: string;
}

export interface DeliveryListFilter {
  channelType?: string;
  status?: string;
  target?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}

export interface DeliveryListResponse {
  data: NotificationDelivery[];
  meta: { total: number; page: number; limit: number };
}

/** Telegram settings status — masked เสมอ ไม่มี secret value (FR-012) */
export interface TelegramSettingsStatus {
  enabled: boolean;
  botTokenConfigured: boolean;
  webhookSecretConfigured: boolean;
  botUsername: string | null;
  botReachable: boolean;
  botInfo: { username?: string } | null;
}

export const notificationAdminService = {
  listDeliveries: async (filter: DeliveryListFilter): Promise<DeliveryListResponse> => {
    const params = Object.fromEntries(Object.entries(filter).filter(([, v]) => v !== undefined && v !== ''));
    const response = await apiClient.get('/admin/notifications/deliveries', { params });
    // paginated: envelope มี data+meta ที่ top-level ตรงกับ DeliveryListResponse — ไม่ต้อง unwrap
    return response.data;
  },

  getSettings: async (): Promise<TelegramSettingsStatus> => {
    const response = await apiClient.get('/admin/notifications/settings');
    return response.data.data; // Unwrap NestJS Interceptor envelope
  },

  patchSettings: async (dto: { enabled: boolean }): Promise<{ enabled: boolean }> => {
    const response = await apiClient.patch('/admin/notifications/settings', dto);
    return response.data.data; // Unwrap NestJS Interceptor envelope
  },
};
