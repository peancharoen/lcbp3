"use client";

import { Transmittal } from "@/types/transmittal";
import { DataTable } from "@/components/common/data-table";
import { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Eye } from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";

interface TransmittalListProps {
  data: Transmittal[];
}

export function TransmittalList({ data }: TransmittalListProps) {
  if (!data) return null;

  const columns: ColumnDef<Transmittal>[] = [
    {
      accessorKey: "transmittalNo",
      header: "Transmittal No.",
      cell: ({ row }) => (
        <span className="font-medium">{row.getValue("transmittalNo")}</span>
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
      accessorKey: "purpose",
      header: "Purpose",
      cell: ({ row }) => (
        <Badge variant="outline">{row.getValue("purpose") || "OTHER"}</Badge>
      ),
    },
    {
      accessorKey: "items",
      header: "Items",
      cell: ({ row }) => {
        const items = row.original.items || [];
        return <span>{items.length} items</span>;
      },
    },
    {
      accessorKey: "createdAt",
      header: "Date",
      cell: ({ row }) =>
        format(new Date(row.getValue("createdAt")), "dd MMM yyyy"),
    },
    {
      id: "actions",
      cell: ({ row }) => {
        const item = row.original;
        return (
          <Link href={`/transmittals/${item.id}`}>
            <Button variant="ghost" size="icon" title="View Details">
              <Eye className="h-4 w-4" />
            </Button>
          </Link>
        );
      },
    },
  ];

  return <DataTable columns={columns} data={data} />;
}
