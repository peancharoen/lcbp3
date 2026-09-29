// File: frontend/lib/services/notification-channel.service.ts
// Change Log:
// - 2026-09-25: Initial creation (Feature 258 US2, T043) — admin notification_channels client

import apiClient from '@/lib/api/client';

/** Notification channel (Telegram group/topic binding) จาก GET /admin/notifications/channels */
export interface NotificationChannel {
  publicId: string;
  channelType: 'TELEGRAM_GROUP' | 'TELEGRAM_CHANNEL' | 'LINE_GROUP';
  externalChatId: string;
  telegramTopicId: number | null;
  projectId: number | null;
  name: string | null;
  isActive: boolean;
  lastError: string | null;
  createdAt: string;
}

export interface IssueLinkCodeResult {
  code: string;
  expiresIn: number;
  projectPublicId: string;
}

export const notificationChannelService = {
  list: async (projectPublicId?: string): Promise<NotificationChannel[]> => {
    const response = await apiClient.get('/admin/notifications/channels', {
      params: projectPublicId ? { projectPublicId } : undefined,
    });
    return response.data;
  },

  issueLinkCode: async (dto: { projectPublicId: string; name?: string }): Promise<IssueLinkCodeResult> => {
    const response = await apiClient.post('/admin/notifications/channels/link-code', dto);
    return response.data;
  },

  patch: async (publicId: string, dto: { name?: string; isActive?: boolean }): Promise<NotificationChannel> => {
    const response = await apiClient.patch(`/admin/notifications/channels/${publicId}`, dto);
    return response.data;
  },

  remove: async (publicId: string): Promise<void> => {
    await apiClient.delete(`/admin/notifications/channels/${publicId}`);
  },
};
