"use client";

import { StatsCards } from "@/components/dashboard/stats-cards";
import { RecentActivity } from "@/components/dashboard/recent-activity";
import { PendingTasks } from "@/components/dashboard/pending-tasks";
import { QuickActions } from "@/components/dashboard/quick-actions";
import { useDashboardStats, useRecentActivity, usePendingTasks } from "@/hooks/use-dashboard";

export default function DashboardPage() {
  const { data: stats, isLoading: statsLoading } = useDashboardStats();
  const { data: activities, isLoading: activityLoading } = useRecentActivity();
  const { data: tasks, isLoading: tasksLoading } = usePendingTasks();

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Welcome back! Here's an overview of your project status.
          </p>
        </div>
        <QuickActions />
      </div>

      <StatsCards stats={stats} isLoading={statsLoading} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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
