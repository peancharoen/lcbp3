import { DashboardStats, ActivityLog, PendingTask } from "@/types/dashboard";

export const dashboardApi = {
  getStats: async (): Promise<DashboardStats> => {
    await new Promise((resolve) => setTimeout(resolve, 500));
    return {
      totalDocuments: 124,
      documentsThisMonth: 12,
      pendingApprovals: 4,
      approved: 89,
      totalRfas: 45,
      totalCirculations: 15,
    };
  },

  getRecentActivity: async (): Promise<ActivityLog[]> => {
    await new Promise((resolve) => setTimeout(resolve, 600));
    return [
      {
        id: 1,
        user: { name: "John Doe", initials: "JD" },
        action: "Created RFA",
        description: "RFA-001: Concrete Pouring Request",
        createdAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(), // 30 mins ago
        targetUrl: "/rfas/1",
      },
      {
        id: 2,
        user: { name: "Jane Smith", initials: "JS" },
        action: "Approved Correspondence",
        description: "COR-005: Site Safety Report",
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), // 2 hours ago
        targetUrl: "/correspondences/5",
      },
      {
        id: 3,
        user: { name: "Mike Johnson", initials: "MJ" },
        action: "Uploaded Drawing",
        description: "A-101: Ground Floor Plan Rev B",
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(), // 5 hours ago
        targetUrl: "/drawings/1",
      },
    ];
  },

  getPendingTasks: async (): Promise<PendingTask[]> => {
    await new Promise((resolve) => setTimeout(resolve, 400));
    return [
      {
        id: 1,
        title: "Review RFA-002",
        description: "Approval required for steel reinforcement",
        daysOverdue: 2,
        url: "/rfas/2",
        priority: "HIGH",
      },
      {
        id: 2,
        title: "Approve Monthly Report",
        description: "January 2025 Progress Report",
        daysOverdue: 0,
        url: "/correspondences/10",
        priority: "MEDIUM",
      },
    ];
  },
};
