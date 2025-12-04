"use client";

import { RFA } from "@/types/rfa";
import { DataTable } from "@/components/common/data-table";
import { ColumnDef } from "@tanstack/react-table";
import { StatusBadge } from "@/components/common/status-badge";
import { Button } from "@/components/ui/button";
import { Eye } from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";

interface RFAListProps {
  data: {
    items: RFA[];
    total: number;
    page: number;
    totalPages: number;
  };
}

export function RFAList({ data }: RFAListProps) {
  const columns: ColumnDef<RFA>[] = [
    {
      accessorKey: "rfa_number",
      header: "RFA No.",
      cell: ({ row }) => (
        <span className="font-medium">{row.getValue("rfa_number")}</span>
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
      accessorKey: "contract_name",
      header: "Contract",
    },
    {
      accessorKey: "discipline_name",
      header: "Discipline",
    },
    {
      accessorKey: "created_at",
      header: "Date",
      cell: ({ row }) => format(new Date(row.getValue("created_at")), "dd MMM yyyy"),
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
            <Link href={`/rfas/${item.rfa_id}`}>
              <Button variant="ghost" size="icon" title="View">
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
      <DataTable columns={columns} data={data.items} />
      {/* Pagination component would go here */}
    </div>
  );
}
