// File: frontend/hooks/use-notification-admin.ts
// Change Log:
// - 2026-09-25: Initial creation (Feature 258 US4, T057) — TanStack Query hooks สำหรับ admin deliveries/settings

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notificationAdminService, DeliveryListFilter } from '@/lib/services/notification-admin.service';
import { toast } from 'sonner';
import { getApiErrorMessage } from '@/types/api-error';

export const notificationAdminKeys = {
  all: ['admin', 'notifications'] as const,
  deliveries: (filter?: DeliveryListFilter) => [...notificationAdminKeys.all, 'deliveries', filter] as const,
  settings: () => [...notificationAdminKeys.all, 'settings'] as const,
};

export function useNotificationDeliveries(filter?: DeliveryListFilter) {
  return useQuery({
    queryKey: notificationAdminKeys.deliveries(filter),
    queryFn: () => notificationAdminService.listDeliveries(filter ?? {}),
  });
}

export function useTelegramSettings() {
  return useQuery({
    queryKey: notificationAdminKeys.settings(),
    queryFn: () => notificationAdminService.getSettings(),
  });
}

export function usePatchTelegramSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: { enabled: boolean }) => notificationAdminService.patchSettings(dto),
    onSuccess: (result) => {
      toast.success(result.enabled ? 'Telegram notifications enabled' : 'Telegram notifications disabled');
      queryClient.invalidateQueries({ queryKey: notificationAdminKeys.settings() });
    },
    onError: (error: unknown) => {
      toast.error('Failed to update settings', {
        description: getApiErrorMessage(error, 'Unknown error'),
      });
    },
  });
}
