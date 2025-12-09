"use client";

import { Circulation, CirculationListResponse } from "@/types/circulation";
import { DataTable } from "@/components/common/data-table";
import { ColumnDef } from "@tanstack/react-table";
import { StatusBadge } from "@/components/common/status-badge";
import { Button } from "@/components/ui/button";
import { Eye, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";

interface CirculationListProps {
  data: CirculationListResponse;
}

/**
 * Calculate progress of circulation routings
 */
function getProgress(routings?: Circulation["routings"]) {
  if (!routings || routings.length === 0) return { completed: 0, total: 0 };
  const completed = routings.filter((r) => r.status === "COMPLETED").length;
  return { completed, total: routings.length };
}

/**
 * Get status color variant for circulation status
 */
function getStatusVariant(
  statusCode: string
): "default" | "secondary" | "destructive" | "outline" {
  switch (statusCode?.toUpperCase()) {
    case "DRAFT":
      return "outline";
    case "ACTIVE":
    case "IN_PROGRESS":
      return "default";
    case "COMPLETED":
    case "CLOSED":
      return "secondary";
    default:
      return "outline";
  }
}

export function CirculationList({ data }: CirculationListProps) {
  if (!data) return null;

  const columns: ColumnDef<Circulation>[] = [
    {
      accessorKey: "circulationNo",
      header: "Circulation No.",
      cell: ({ row }) => (
        <span className="font-medium">{row.getValue("circulationNo")}</span>
      ),
    },
    {
      accessorKey: "subject",
      header: "Subject",
      cell: ({ row }) => (
        <div className="max-w-[250px] truncate" title={row.getValue("subject")}>
          {row.getValue("subject")}
        </div>
      ),
    },
    {
      accessorKey: "organization",
      header: "Organization",
      cell: ({ row }) => {
        const org = row.original.organization;
        return org?.organization_name || "-";
      },
    },
    {
      accessorKey: "statusCode",
      header: "Status",
      cell: ({ row }) => {
        const status = row.getValue("statusCode") as string;
        return <Badge variant={getStatusVariant(status)}>{status}</Badge>;
      },
    },
    {
      id: "progress",
      header: "Progress",
      cell: ({ row }) => {
        const { completed, total } = getProgress(row.original.routings);
        if (total === 0) return "-";
        const percent = Math.round((completed / total) * 100);
        return (
          <div className="flex items-center gap-2">
            <div className="w-20 h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${percent}%` }}
              />
            </div>
            <span className="text-xs text-muted-foreground">
              {completed}/{total}
            </span>
          </div>
        );
      },
    },
    {
      accessorKey: "createdAt",
      header: "Created",
      cell: ({ row }) =>
        format(new Date(row.getValue("createdAt")), "dd MMM yyyy"),
    },
    {
      id: "actions",
      cell: ({ row }) => {
        const item = row.original;
        return (
          <div className="flex gap-1">
            <Link href={`/circulation/${item.id}`}>
              <Button variant="ghost" size="icon" title="View Details">
                <Eye className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        );
      },
    },
  ];

  return (
    <div>
      <DataTable columns={columns} data={data.data || []} />
      {data.meta && (
        <div className="mt-4 text-sm text-muted-foreground text-center">
          Showing {data.data?.length || 0} of {data.meta.total} circulations
        </div>
      )}
    </div>
  );
}
