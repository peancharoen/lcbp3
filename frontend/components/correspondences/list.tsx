"use client";

import { Correspondence } from "@/types/correspondence";
import { DataTable } from "@/components/common/data-table";
import { ColumnDef } from "@tanstack/react-table";
import { StatusBadge } from "@/components/common/status-badge";
import { Button } from "@/components/ui/button";
import { Eye, Edit } from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";

interface CorrespondenceListProps {
  data?: {
    items: Correspondence[];
    total: number;
    page: number;
    totalPages: number;
  };
}

export function CorrespondenceList({ data }: CorrespondenceListProps) {
  const columns: ColumnDef<Correspondence>[] = [
    {
      accessorKey: "documentNumber",
      header: "Document No.",
      cell: ({ row }) => (
        <span className="font-medium">{row.getValue("documentNumber")}</span>
      ),
    },
    {
      accessorKey: "subject",
      header: "Subject",
      cell: ({ row }) => (
        <div className="max-w-[300px] truncate" title={row.getValue("subject")}>
          {row.getValue("subject")}
        </div>
      ),
    },
    {
      accessorKey: "fromOrganization.orgName",
      header: "From",
    },
    {
      accessorKey: "toOrganization.orgName",
      header: "To",
    },
    {
      accessorKey: "createdAt",
      header: "Created",
      cell: ({ row }) => format(new Date(row.getValue("createdAt")), "dd MMM yyyy"),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => <StatusBadge status={row.getValue("status")} />,
    },
    {
      id: "actions",
      cell: ({ row }) => {
        const item = row.original;
        return (
          <div className="flex gap-2">
            <Link href={`/correspondences/${row.original.correspondenceId}`}>
              <Button variant="ghost" size="icon" title="View">
                <Eye className="h-4 w-4" />
              </Button>
            </Link>
            {item.status === "DRAFT" && (
              <Link href={`/correspondences/${row.original.correspondenceId}/edit`}>
                <Button variant="ghost" size="icon" title="Edit">
                  <Edit className="h-4 w-4" />
                </Button>
              </Link>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div>
      <DataTable columns={columns} data={data?.items || []} />
      {/* Pagination component would go here, receiving props from data */}
    </div>
  );
}
