"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import apiClient from "@/lib/api/client";
import { DataTable } from "@/components/common/data-table";
import { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { LogOut, Monitor, Smartphone, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

interface Session {
  id: string;
  userId: number;
  user: {
    username: string;
    firstName: string;
    lastName: string;
  };
  deviceName: string; // e.g., "Chrome on Windows"
  ipAddress: string;
  lastActive: string;
  isCurrent: boolean;
}

const sessionService = {
  getAll: async () => {
    const response = await apiClient.get("/auth/sessions");
    return response.data.data || response.data;
  },
  revoke: async (sessionId: string) => (await apiClient.delete(`/auth/sessions/${sessionId}`)).data,
};

export default function SessionsPage() {
  const queryClient = useQueryClient();

  const { data: sessions = [], isLoading } = useQuery<Session[]>({
    queryKey: ["sessions"],
    queryFn: sessionService.getAll,
  });

  const revokeMutation = useMutation({
    mutationFn: sessionService.revoke,
    onSuccess: () => {
      toast.success("Session revoked successfully");
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
    },
    onError: () => toast.error("Failed to revoke session"),
  });

  const columns: ColumnDef<Session>[] = [
    {
      accessorKey: "user",
      header: "User",
      cell: ({ row }) => {
        const user = row.original.user;
        return (
          <div className="flex flex-col">
            <span className="font-medium">{user.username}</span>
            <span className="text-xs text-muted-foreground">
              {user.firstName} {user.lastName}
            </span>
          </div>
        );
      },
    },
    {
      accessorKey: "deviceName",
      header: "Device / IP",
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          {row.original.deviceName.toLowerCase().includes("mobile") ? (
            <Smartphone className="h-4 w-4 text-muted-foreground" />
          ) : (
            <Monitor className="h-4 w-4 text-muted-foreground" />
          )}
          <div className="flex flex-col">
            <span>{row.original.deviceName}</span>
            <span className="text-xs text-muted-foreground">{row.original.ipAddress}</span>
          </div>
        </div>
      ),
    },
    {
      accessorKey: "lastActive",
      header: "Last Active",
      cell: ({ row }) => format(new Date(row.original.lastActive), "dd MMM yyyy, HH:mm"),
    },
    {
      id: "status",
      header: "Status",
      cell: ({ row }) =>
        row.original.isCurrent ? <Badge>Current</Badge> : <Badge variant="secondary">Active</Badge>,
    },
    {
      id: "actions",
      cell: ({ row }) => (
        <Button
          variant="destructive"
          size="sm"
          disabled={row.original.isCurrent || revokeMutation.isPending}
          onClick={() => revokeMutation.mutate(row.original.id)}
        >
          <LogOut className="h-4 w-4 mr-2" />
          Revoke
        </Button>
      ),
    },
  ];

  if (isLoading) {
    return (
      <div className="flex justify-center p-12">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Active Sessions</h1>
          <p className="text-muted-foreground">Manage user sessions and force logout if needed</p>
        </div>
      </div>
      <DataTable columns={columns} data={sessions} />
    </div>
  );
}
