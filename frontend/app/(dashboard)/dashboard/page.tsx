import { StatsCards } from "@/components/dashboard/stats-cards";
import { RecentActivity } from "@/components/dashboard/recent-activity";
import { PendingTasks } from "@/components/dashboard/pending-tasks";
import { QuickActions } from "@/components/dashboard/quick-actions";
import { dashboardApi } from "@/lib/api/dashboard";

export default async function DashboardPage() {
  // Fetch data in parallel
  const [stats, activities, tasks] = await Promise.all([
    dashboardApi.getStats(),
    dashboardApi.getRecentActivity(),
    dashboardApi.getPendingTasks(),
  ]);

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

      <StatsCards stats={stats} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <RecentActivity activities={activities} />
        </div>
        <div className="lg:col-span-1">
          <PendingTasks tasks={tasks} />
        </div>
      </div>
    </div>
  );
}
