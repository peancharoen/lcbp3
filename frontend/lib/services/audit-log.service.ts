import apiClient from "@/lib/api/client";

export interface AuditLogRaw {
    audit_log_id: number;
    user_id: number;
    user_name?: string;
    action: string;
    entity_type: string;
    entity_id: string; // or number
    description: string;
    ip_address?: string;
    created_at: string;
}

export const auditLogService = {
  getLogs: async (params?: any) => {
    const response = await apiClient.get<AuditLogRaw[]>("/audit-logs", { params });
    return response.data;
  }
};
