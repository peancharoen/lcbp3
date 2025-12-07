import { useQuery } from '@tanstack/react-query';
import { dashboardService } from '@/lib/services/dashboard.service';

export const dashboardKeys = {
  all: ['dashboard'] as const,
  stats: () => [...dashboardKeys.all, 'stats'] as const,
  activity: () => [...dashboardKeys.all, 'activity'] as const,
  pending: () => [...dashboardKeys.all, 'pending'] as const,
};

export function useDashboardStats() {
  return useQuery({
    queryKey: dashboardKeys.stats(),
    queryFn: dashboardService.getStats,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useRecentActivity() {
  return useQuery({
    queryKey: dashboardKeys.activity(),
    queryFn: dashboardService.getRecentActivity,
    staleTime: 1 * 60 * 1000,
  });
}

export function usePendingTasks() {
  return useQuery({
    queryKey: dashboardKeys.pending(),
    queryFn: dashboardService.getPendingTasks,
    staleTime: 2 * 60 * 1000,
  });
}
