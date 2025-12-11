"use client";

import { RFA } from "@/types/rfa";
import { DataTable } from "@/components/common/data-table";
import { ColumnDef } from "@tanstack/react-table";
import { StatusBadge } from "@/components/common/status-badge";
import { Button } from "@/components/ui/button";
import { Eye, Edit, FileText } from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";

interface RFAListProps {
  data: RFA[];
}

export function RFAList({ data }: RFAListProps) {
  if (!data) return null;

  const columns: ColumnDef<RFA>[] = [
    {
      accessorKey: "rfa_number",
      header: "RFA No.",
      cell: ({ row }) => {
        const rev = row.original.revisions?.[0];
        return <span className="font-medium">{rev?.correspondence?.correspondenceNumber || '-'}</span>;
      },
    },
    {
      accessorKey: "subject",
      header: "Subject",
      cell: ({ row }) => {
        const rev = row.original.revisions?.[0];
        return (
          <div className="max-w-[300px] truncate" title={rev?.title}>
            {rev?.title || '-'}
          </div>
        );
      },
    },
    {
      accessorKey: "contract_name", // AccessorKey can be anything if we provide cell
      header: "Contract",
      cell: ({ row }) => {
        const rev = row.original.revisions?.[0];
        return <span>{rev?.correspondence?.project?.projectName || '-'}</span>;
      },
    },
    {
      accessorKey: "discipline_name",
      header: "Discipline",
      cell: ({ row }) => <span>{row.original.discipline?.name || '-'}</span>,
    },
    {
      accessorKey: "createdAt",
      header: "Created",
      cell: ({ row }) => {
         const date = row.original.revisions?.[0]?.correspondence?.createdAt;
         return date ? format(new Date(date), "dd MMM yyyy") : '-';
      },
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
        const status = row.original.revisions?.[0]?.statusCode?.statusName || row.original.revisions?.[0]?.statusCode?.statusCode;
        return <StatusBadge status={status || 'Unknown'} />;
      },
    },
    {
      id: "actions",
      cell: ({ row }) => {
        const item = row.original;

        const handleViewFile = (e: React.MouseEvent) => {
           e.preventDefault();
           // Logic to find first attachment: Check items -> shopDrawingRevision -> attachments
           const firstAttachment = item.revisions?.[0]?.items?.[0]?.shopDrawingRevision?.attachments?.[0];
           if (firstAttachment?.url) {
             window.open(firstAttachment.url, '_blank');
           } else {
             // Use alert or toast. Assuming toast is available or use generic alert for now if toast not imported
             // But rfa.service.ts in use-rfa.ts uses 'sonner', so 'sonner' is likely available.
             // I will try to use toast from 'sonner' if I import it, or just window.alert for safety.
             // User said "หน้าต่างแจ้งเตือน" -> Alert window.
             alert("ไม่พบไฟล์แนบ (No file attached)");
           }
        };

        return (
          <div className="flex gap-2">
            <Link href={`/rfas/${row.original.id}`}>
              <Button variant="ghost" size="icon" title="View Details">
                <Eye className="h-4 w-4" />
              </Button>
            </Link>
             <Button variant="ghost" size="icon" title="View File" onClick={handleViewFile}>
                <FileText className="h-4 w-4" />
              </Button>
            <Link href={`/rfas/${row.original.id}/edit`}>
               <Button variant="ghost" size="icon" title="Edit">
                <Edit className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        );
      },
    },
  ];

  return (
    <div>
      <DataTable columns={columns} data={data || []} />
      {/* Pagination component would go here */}
    </div>
  );
}
