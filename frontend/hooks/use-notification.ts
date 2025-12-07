import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notificationService } from '@/lib/services/notification.service';
import { toast } from 'sonner';

export const notificationKeys = {
  all: ['notifications'] as const,
  unread: () => [...notificationKeys.all, 'unread'] as const,
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
      toast.error("Failed to mark notification as read");
    }
  });
}
