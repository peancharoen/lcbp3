'use client';

import { StatsCards } from '@/components/dashboard/stats-cards';
import { RecentActivity } from '@/components/dashboard/recent-activity';
import { PendingTasks } from '@/components/dashboard/pending-tasks';
import { QuickActions } from '@/components/dashboard/quick-actions';
import { useDashboardStats, useRecentActivity, usePendingTasks } from '@/hooks/use-dashboard';
import { useProjectStore } from '@/lib/stores/project-store';

export default function DashboardPage() {
  const selectedProjectId = useProjectStore((state) => state.selectedProjectId);

  const { data: stats, isLoading: statsLoading } = useDashboardStats(selectedProjectId);
  const { data: activities, isLoading: activityLoading } = useRecentActivity(selectedProjectId);
  const { data: tasks, isLoading: tasksLoading } = usePendingTasks(selectedProjectId);

  return (
    <div className="space-y-8">
      <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="mt-1 text-muted-foreground">Welcome back! Here's an overview of your project status.</p>
        </div>
        <QuickActions />
      </div>

      <StatsCards stats={stats} isLoading={statsLoading} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <RecentActivity activities={activities} isLoading={activityLoading} />
        </div>
        <div className="lg:col-span-1">
          <PendingTasks tasks={tasks} isLoading={tasksLoading} />
        </div>
      </div>
    </div>
  );
}
