export interface DashboardStats {
  totalDocuments: number;
  documentsThisMonth: number;
  pendingApprovals: number;
  approved: number;
  totalRfas: number;
  totalCirculations: number;
}

export interface ActivityLog {
  id: string;
  action: string;
  entityType?: string;
  entityId?: string;
  details?: Record<string, unknown>;
  createdAt: string;
  username?: string;
  user: {
    name: string;
    initials: string;
    avatar?: string;
  };
  targetUrl: string;
  description: string;
}

export interface PendingTask {
  publicId: string;
  workflowCode: string;
  currentState: string;
  entityType: string;
  entityId: string;
  documentNumber: string;
  subject: string;
  assignedAt: string;
  // Derived fields for UI
  title: string;
  description: string;
  daysOverdue: number;
  url: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
}
