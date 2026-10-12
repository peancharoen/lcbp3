'use client';

import { useAuditLogs } from '@/hooks/use-audit-logs';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';
import { Loader2 } from 'lucide-react';

export default function AuditLogsPage() {
  const { data: logs, isLoading } = useAuditLogs();
  const logList = Array.isArray(logs) ? logs : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Audit Logs</h1>
        <p className="mt-1 text-muted-foreground">View system activity and changes</p>
      </div>

      {isLoading ? (
        <div className="flex justify-center p-8">
          <Loader2 className="animate-spin" />
        </div>
      ) : (
        <div className="space-y-2">
          {logList.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground">No logs found</div>
          ) : (
            logList.map((log: import('@/lib/services/audit-log.service').AuditLog) => (
              <Card key={log.publicId} className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="mb-2 flex items-center gap-3">
                      <span className="text-sm font-medium">
                        {log.user?.fullName || log.user?.username || `User #${log.userId || 'System'}`}
                      </span>
                      <Badge
                        variant={log.severity === 'ERROR' ? 'destructive' : 'outline'}
                        className="text-[10px] uppercase"
                      >
                        {log.action}
                      </Badge>
                      <Badge variant="secondary" className="text-[10px] uppercase">
                        {log.entityType || 'General'}
                      </Badge>
                    </div>
                    <p className="text-sm text-foreground">
                      {typeof log.detailsJson === 'string' ? log.detailsJson : JSON.stringify(log.detailsJson || {})}
                    </p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {log.createdAt && formatDistanceToNow(new Date(log.createdAt), { addSuffix: true })}
                    </p>
                  </div>
                  {/* Only show IP if available */}
                  {log.ipAddress && (
                    <span className="hidden rounded bg-muted px-2 py-1 font-mono text-xs text-muted-foreground md:inline-block">
                      {log.ipAddress}
                    </span>
                  )}
                </div>
              </Card>
            ))
          )}
        </div>
      )}
    </div>
  );
}
