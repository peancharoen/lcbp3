// File: frontend/hooks/use-notification-channels.ts
// Change Log:
// - 2026-09-25: Initial creation (Feature 258 US2, T043) — TanStack Query hooks สำหรับ admin channels

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notificationChannelService, IssueLinkCodeResult, IssueLinkCodeDto } from '@/lib/services/notification-channel.service';
import { toast } from 'sonner';
import { getApiErrorMessage } from '@/types/api-error';

export const notificationChannelKeys = {
  all: ['admin', 'notification-channels'] as const,
  list: (projectPublicId?: string) => [...notificationChannelKeys.all, 'list', projectPublicId] as const,
};

export function useNotificationChannels(projectPublicId?: string) {
  return useQuery({
    queryKey: notificationChannelKeys.list(projectPublicId),
    queryFn: () => notificationChannelService.list(projectPublicId),
  });
}

export function useIssueLinkCode() {
  return useMutation<IssueLinkCodeResult, unknown, IssueLinkCodeDto>({
    mutationFn: (dto) => notificationChannelService.issueLinkCode(dto),
    onError: (error) => {
      toast.error('ไม่สามารถสร้างรหัสผูกกลุ่มได้', {
        description: getApiErrorMessage(error, 'Unknown error'),
      });
    },
  });
}

export function usePatchChannel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ publicId, ...dto }: { publicId: string; name?: string; isActive?: boolean }) =>
      notificationChannelService.patch(publicId, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationChannelKeys.all });
      toast.success('อัปเดต channel แล้ว');
    },
    onError: (error) => {
      toast.error('อัปเดต channel ไม่สำเร็จ', {
        description: getApiErrorMessage(error, 'Unknown error'),
      });
    },
  });
}

export function useDeleteChannel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (publicId: string) => notificationChannelService.remove(publicId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationChannelKeys.all });
      toast.success('ยกเลิกการผูก channel แล้ว');
    },
    onError: (error) => {
      toast.error('ยกเลิกการผูกไม่สำเร็จ', {
        description: getApiErrorMessage(error, 'Unknown error'),
      });
    },
  });
}
