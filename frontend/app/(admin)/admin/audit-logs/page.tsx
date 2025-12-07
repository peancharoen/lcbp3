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
                logs.map((log: any) => (
                <Card key={log.audit_log_id} className="p-4">
                    <div className="flex items-start justify-between">
                    <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                        <span className="font-medium text-sm">{log.user_name || `User #${log.user_id}`}</span>
                        <Badge variant="outline" className="uppercase text-[10px]">{log.action}</Badge>
                        <Badge variant="secondary" className="uppercase text-[10px]">{log.entity_type}</Badge>
                        </div>
                        <p className="text-sm text-foreground">{log.description}</p>
                        <p className="text-xs text-muted-foreground mt-2">
                        {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                        </p>
                    </div>
                    {log.ip_address && (
                        <span className="text-xs text-muted-foreground font-mono bg-muted px-2 py-1 rounded">
                        {log.ip_address}
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
