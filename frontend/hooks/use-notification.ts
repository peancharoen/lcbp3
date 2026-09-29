// File: frontend/hooks/use-notification.ts
// Change Log:
// - 2026-09-25: เพิ่ม hooks สำหรับ preferences + Telegram binding (Feature 258 US1, T029)

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notificationService, UserPreferences } from '@/lib/services/notification.service';
import { toast } from 'sonner';

export const notificationKeys = {
  all: ['notifications'] as const,
  unread: () => [...notificationKeys.all, 'unread'] as const,
  preferences: () => ['users', 'me', 'preferences'] as const,
  telegramStatus: () => ['users', 'me', 'telegram', 'status'] as const,
};

export function useNotifications() {
  return useQuery({
    queryKey: notificationKeys.unread(),
    queryFn: notificationService.getUnread,
    refetchInterval: 60 * 1000, // Poll every 1 minute
    staleTime: 30 * 1000,
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: notificationService.markAsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.unread() });
    },
    onError: () => {
      toast.error('Failed to mark notification as read');
    },
  });
}

// --- Preferences (Feature 258 US1/US3) ---

export function useUserPreferences() {
  return useQuery({
    queryKey: notificationKeys.preferences(),
    queryFn: notificationService.getPreferences,
  });
}

export function useUpdatePreferences() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: Partial<UserPreferences>) => notificationService.updatePreferences(dto),
    onSuccess: (data) => {
      queryClient.setQueryData(notificationKeys.preferences(), data);
      toast.success('บันทึกการตั้งค่าแจ้งเตือนแล้ว');
    },
    onError: () => {
      toast.error('ไม่สามารถบันทึกการตั้งค่าได้');
    },
  });
}

// --- Telegram binding (Feature 258 US1) ---

export function useTelegramStatus() {
  return useQuery({
    queryKey: notificationKeys.telegramStatus(),
    queryFn: notificationService.getTelegramStatus,
  });
}

export function useTelegramLinkToken() {
  return useMutation({
    mutationFn: notificationService.getTelegramLinkToken,
    onError: () => {
      toast.error('ไม่สามารถสร้างลิงก์เชื่อมต่อ Telegram ได้');
    },
  });
}

export function useUnlinkTelegram() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: notificationService.unlinkTelegram,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.telegramStatus() });
      toast.success('ยกเลิกการเชื่อมต่อ Telegram แล้ว');
    },
    onError: () => {
      toast.error('ไม่สามารถยกเลิกการเชื่อมต่อได้');
    },
  });
}

export function useTelegramTestMessage() {
  return useMutation({
    mutationFn: notificationService.sendTelegramTestMessage,
    onSuccess: () => {
      toast.success('ส่งข้อความทดสอบแล้ว กรุณาตรวจสอบ Telegram');
    },
    onError: () => {
      toast.error('ส่งข้อความทดสอบไม่สำเร็จ');
    },
  });
}
