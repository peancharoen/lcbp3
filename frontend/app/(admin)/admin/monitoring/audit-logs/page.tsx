"use client";

import { useAuditLogs } from "@/hooks/use-audit-logs";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import { Loader2 } from "lucide-react";

export default function AuditLogsPage() {
  const { data: logs, isLoading } = useAuditLogs();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Audit Logs</h1>
        <p className="text-muted-foreground mt-1">View system activity and changes</p>
      </div>

      {isLoading ? (
        <div className="flex justify-center p-8">
            <Loader2 className="animate-spin" />
        </div>
      ) : (
        <div className="space-y-2">
            {!logs || logs.length === 0 ? (
                <div className="text-center text-muted-foreground py-10">No logs found</div>
            ) : (
                logs.map((log: import("@/lib/services/audit-log.service").AuditLog) => (
                <Card key={log.auditId} className="p-4">
                    <div className="flex items-start justify-between">
                    <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                        <span className="font-medium text-sm">
                            {log.user?.fullName || log.user?.username || `User #${log.userId || 'System'}`}
                        </span>
                        <Badge variant={log.severity === 'ERROR' ? 'destructive' : 'outline'} className="uppercase text-[10px]">
                            {log.action}
                        </Badge>
                        <Badge variant="secondary" className="uppercase text-[10px]">{log.entityType || 'General'}</Badge>
                        </div>
                        <p className="text-sm text-foreground">
                            {typeof log.detailsJson === 'string' ? log.detailsJson : JSON.stringify(log.detailsJson || {})}
                        </p>
                        <p className="text-xs text-muted-foreground mt-2">
                        {log.createdAt && formatDistanceToNow(new Date(log.createdAt), { addSuffix: true })}
                        </p>
                    </div>
                    {/* Only show IP if available */}
                    {log.ipAddress && (
                        <span className="text-xs text-muted-foreground font-mono bg-muted px-2 py-1 rounded hidden md:inline-block">
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
