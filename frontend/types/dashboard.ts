export interface DashboardStats {
  correspondences: number;
  rfas: number;
  approved: number;
  pending: number;
}

export interface ActivityLog {
  id: number;
  user: {
    name: string;
    initials: string;
    avatar?: string;
  };
  action: string;
  description: string;
  createdAt: string;
  targetUrl: string;
}

export interface PendingTask {
  id: number;
  title: string;
  description: string;
  daysOverdue: number;
  url: string;
  priority: "HIGH" | "MEDIUM" | "LOW";
}
