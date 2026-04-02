import { useQuery } from '@tanstack/react-query';
import { dashboardService } from '@/lib/services/dashboard.service';

export const dashboardKeys = {
  all: ['dashboard'] as const,
  stats: (projectId?: string | null) => [...dashboardKeys.all, 'stats', projectId] as const,
  activity: (projectId?: string | null) => [...dashboardKeys.all, 'activity', projectId] as const,
  pending: (projectId?: string | null) => [...dashboardKeys.all, 'pending', projectId] as const,
};

export function useDashboardStats(projectId?: string | null) {
  return useQuery({
    queryKey: dashboardKeys.stats(projectId),
    queryFn: () => dashboardService.getStats(projectId),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useRecentActivity(projectId?: string | null) {
  return useQuery({
    queryKey: dashboardKeys.activity(projectId),
    queryFn: () => dashboardService.getRecentActivity(projectId),
    staleTime: 1 * 60 * 1000,
  });
}

export function usePendingTasks(projectId?: string | null) {
  return useQuery({
    queryKey: dashboardKeys.pending(projectId),
    queryFn: () => dashboardService.getPendingTasks(projectId),
    staleTime: 2 * 60 * 1000,
  });
}
