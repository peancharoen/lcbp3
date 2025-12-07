import { useQuery } from '@tanstack/react-query';
import { auditLogService } from '@/lib/services/audit-log.service';

export const auditLogKeys = {
  all: ['audit-logs'] as const,
  list: (params: any) => [...auditLogKeys.all, 'list', params] as const,
};

export function useAuditLogs(params?: any) {
  return useQuery({
    queryKey: auditLogKeys.list(params),
    queryFn: () => auditLogService.getLogs(params),
  });
}
