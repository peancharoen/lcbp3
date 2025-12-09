"use client";

import { useQuery } from "@tanstack/react-query";
import apiClient from "@/lib/api/client";
import { DataTable } from "@/components/common/data-table";
import { ColumnDef } from "@tanstack/react-table";
import { RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";

interface NumberingError {
  id: number;
  userId?: number;
  errorMessage: string;
  stackTrace?: string;
  createdAt: string;
  context?: any;
}

const logService = {
  getNumberingErrors: async () => (await apiClient.get("/document-numbering/logs/errors")).data,
};

export default function NumberingLogsPage() {
  const { data: errors = [], isLoading, refetch } = useQuery<NumberingError[]>({
    queryKey: ["numbering-errors"],
    queryFn: logService.getNumberingErrors,
  });

  const columns: ColumnDef<NumberingError>[] = [
    {
      accessorKey: "createdAt",
      header: "Timestamp",
      cell: ({ row }) => format(new Date(row.original.createdAt), "dd MMM yyyy, HH:mm:ss"),
    },
    {
      accessorKey: "context.projectId", // Accessing nested property
      header: "Project ID",
      cell: ({ row }) => <span className="font-mono">{row.original.context?.projectId || 'N/A'}</span>,
    },
    {
      accessorKey: "errorMessage",
      header: "Message",
      cell: ({ row }) => <span className="text-destructive font-medium">{row.original.errorMessage}</span>,
    },
    {
      accessorKey: "stackTrace",
      header: "Details",
      cell: ({ row }) => (
        <div className="max-w-[400px] truncate text-xs text-muted-foreground font-mono" title={row.original.stackTrace}>
          {row.original.stackTrace}
        </div>
      ),
    },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Numbering Logs</h1>
          <p className="text-muted-foreground">Diagnostics for document numbering issues</p>
        </div>
        <Button variant="outline" size="icon" onClick={() => refetch()} disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center p-12">
          <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <DataTable columns={columns} data={errors} />
      )}
    </div>
  );
}
