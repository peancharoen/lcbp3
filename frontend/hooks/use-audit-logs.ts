import { AuditLog, AuditLogQueryParams } from '@/lib/services/audit-log.service';
import { useQuery } from '@tanstack/react-query';
import { auditLogService } from '@/lib/services/audit-log.service';

export const auditLogKeys = {
  all: ['audit-logs'] as const,
  list: (params?: AuditLogQueryParams) => [...auditLogKeys.all, 'list', params] as const,
};

export function useAuditLogs(params?: AuditLogQueryParams) {
  return useQuery<AuditLog[]>({
    queryKey: auditLogKeys.list(params),
    queryFn: () => auditLogService.getLogs(params),
  });
}
