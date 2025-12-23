"use client";

import { useEffect, useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { documentNumberingService } from "@/lib/services/document-numbering.service";
import { format } from "date-fns";

export function AuditLogsTable() {
  const [logs, setLogs] = useState<any[]>([]); // Replace with AuditLog type
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchLogs() {
      try {
        const data = await documentNumberingService.getMetrics(); // Using metrics endpoint for now as it contains logs
        if (data && data.audit) {
           setLogs(data.audit);
        }
      } catch (error) {
        console.error("Failed to fetch audit logs", error);
      } finally {
        setLoading(false);
      }
    }
    fetchLogs();
  }, []);

  if (loading) return <div>Loading logs...</div>;

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Time</TableHead>
            <TableHead>Operation</TableHead>
            <TableHead>Number</TableHead>
            <TableHead>User</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {logs.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="text-center">No logs found.</TableCell>
            </TableRow>
          ) : (
            logs.map((log) => (
              <TableRow key={log.id}>
                <TableCell>{format(new Date(log.createdAt), "yyyy-MM-dd HH:mm:ss")}</TableCell>
                <TableCell>{log.operation}</TableCell>
                <TableCell>{log.generatedNumber}</TableCell>
                <TableCell>{log.createdBy || "System"}</TableCell>
                <TableCell>{log.status}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
