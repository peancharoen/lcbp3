import apiClient from "@/lib/api/client";
import { AuditQueryParams } from '@/types/dto/numbering.dto';

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
    detailsJson?: Record<string, unknown>;
    ipAddress?: string;
    userAgent?: string;
    createdAt: string;
}

export type AuditLogQueryParams = AuditQueryParams;

export const auditLogService = {
  getLogs: async (params?: AuditLogQueryParams) => {
    const response = await apiClient.get<{ data: AuditLog[] } | AuditLog[]>("/audit-logs", { params });
    // Support both wrapped and unwrapped scenarios
    return (response.data as { data: AuditLog[] }).data ?? response.data;
  },
};
