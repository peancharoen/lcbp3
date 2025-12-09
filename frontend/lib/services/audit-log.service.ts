import apiClient from "@/lib/api/client";

export interface AuditLog {
    auditId: string;
    userId?: number | null;
    user?: {
        id: number;
        fullName?: string;
        username: string;
    };
    action: string;
    severity: string;
    entityType?: string;
    entityId?: string;
    detailsJson?: any;
    ipAddress?: string;
    userAgent?: string;
    createdAt: string;
}

export const auditLogService = {
  getLogs: async (params?: any) => {
    const response = await apiClient.get<any>("/audit-logs", { params });
    // Support both wrapped and unwrapped scenarios
    return response.data.data || response.data;
  },
};
