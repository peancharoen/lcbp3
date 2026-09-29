// File: frontend/lib/services/notification.service.ts
// Change Log:
// - 2026-09-25: เพิ่ม Telegram binding + preferences client methods (Feature 258 US1, T029)

import apiClient from '@/lib/api/client';
import { NotificationResponse } from '@/types/notification';

/** Preferences ของ user ปัจจุบัน (GET /users/me/preferences) */
export interface UserPreferences {
  notifyEmail: boolean;
  notifyLine: boolean;
  notifyTelegram: boolean;
  digestMode: boolean;
  uiTheme: string;
}

/** สถานะ binding Telegram ของ user ปัจจุบัน (GET /users/me/telegram/status) */
export interface TelegramStatus {
  linked: boolean;
  telegramUsername: string | null;
  telegramLinkedAt: string | null;
}

/** ผลลัพธ์การออก deep-link token (POST /users/me/telegram/link-token) */
export interface TelegramLinkToken {
  deepLink: string;
  expiresIn: number;
}

export const notificationService = {
  getUnread: async (): Promise<NotificationResponse> => {
    const response = await apiClient.get('/notifications/unread');
    // Backend should return { items: [], unreadCount: number }
    // Or just items and we count on frontend, but typically backend gives count.
    return response.data.data; // Unwrap NestJS Interceptor envelope
  },

  markAsRead: async (uuid: string) => {
    const response = await apiClient.put(`/notifications/${uuid}/read`);
    return response.data.data; // Unwrap NestJS Interceptor envelope
  },

  markAllAsRead: async () => {
    const response = await apiClient.patch(`/notifications/read-all`);
    return response.data.data; // Unwrap NestJS Interceptor envelope
  },

  // --- User Preferences ---
  getPreferences: async (): Promise<UserPreferences> => {
    const response = await apiClient.get('/users/me/preferences');
    return response.data.data; // Unwrap NestJS Interceptor envelope
  },

  updatePreferences: async (dto: Partial<UserPreferences>): Promise<UserPreferences> => {
    const response = await apiClient.patch('/users/me/preferences', dto);
    return response.data.data; // Unwrap NestJS Interceptor envelope
  },

  // --- Telegram binding (Feature 258) ---
  getTelegramStatus: async (): Promise<TelegramStatus> => {
    const response = await apiClient.get('/users/me/telegram/status');
    return response.data.data; // Unwrap NestJS Interceptor envelope
  },

  getTelegramLinkToken: async (): Promise<TelegramLinkToken> => {
    const response = await apiClient.post('/users/me/telegram/link-token');
    return response.data.data; // Unwrap NestJS Interceptor envelope
  },

  unlinkTelegram: async (): Promise<void> => {
    await apiClient.delete('/users/me/telegram');
  },

  sendTelegramTestMessage: async (): Promise<void> => {
    await apiClient.post('/users/me/telegram/test-message');
  },
};
