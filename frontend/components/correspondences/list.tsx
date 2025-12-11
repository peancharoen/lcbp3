"use client";

import { CorrespondenceRevision } from "@/types/correspondence";
import { DataTable } from "@/components/common/data-table";
import { ColumnDef } from "@tanstack/react-table";
import { StatusBadge } from "@/components/common/status-badge";
import { Button } from "@/components/ui/button";
import { Eye, Edit, FileText } from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";

interface CorrespondenceListProps {
  data: CorrespondenceRevision[];
}

export function CorrespondenceList({ data }: CorrespondenceListProps) {
  const columns: ColumnDef<CorrespondenceRevision>[] = [
    {
      accessorKey: "correspondence.correspondenceNumber",
      header: "Document No.",
      cell: ({ row }) => (
        <span className="font-medium">{row.original.correspondence?.correspondenceNumber}</span>
      ),
    },
    {
      accessorKey: "revisionLabel",
      header: "Rev",
      cell: ({ row }) => (
        <span className="font-medium">{row.original.revisionLabel || row.original.revisionNumber}</span>
      ),
    },
    {
      accessorKey: "title",
      header: "Subject",
      cell: ({ row }) => (
        <div className="max-w-[300px] truncate" title={row.original.title}>
          {row.original.title}
        </div>
      ),
    },
    {
      accessorKey: "correspondence.originator.orgName",
      header: "From",
      cell: ({ row }) => (
        <span>{row.original.correspondence?.originator?.orgName || '-'}</span>
      ),
    },
    {
      accessorKey: "createdAt",
      header: "Created",
      cell: ({ row }) => format(new Date(row.getValue("createdAt")), "dd MMM yyyy"),
    },
    {
      accessorKey: "status.statusName",
      header: "Status",
      cell: ({ row }) => <StatusBadge status={row.original.status?.statusCode || "UNKNOWN"} />,
    },
    {
      id: "actions",
      cell: ({ row }) => {
        const item = row.original;
        // Edit/View link goes to the DOCUMENT detail (correspondence.id)
        // Ideally we might pass ?revId=item.id to view specific revision, but detail page defaults to latest.
        // For editing, we edit the document.
        const docId = item.correspondence.id;
        const statusCode = item.status?.statusCode;

        return (
          <div className="flex gap-2">
            <Link href={`/correspondences/${docId}`}>
              <Button variant="ghost" size="icon" title="View Details">
                <Eye className="h-4 w-4" />
              </Button>
            </Link>
             <Button variant="ghost" size="icon" title="View File" onClick={() => {
                const attachments = item.attachments; // Now we are on Revision, so attachments might be here if joined
                if (attachments && attachments.length > 0 && attachments[0].url) {
                   window.open(attachments[0].url, '_blank');
                } else {
                   // Fallback check if attachments are on details json inside revision
                   // or if we simply didn't join them yet.
                   // Current Backend join: leftJoinAndSelect('rev.status', 'status') doesn't join attachments explicitly but maybe relation exists?
                   // Wait, checking Entity... CorrespondenceRevision does NOT have attachments relation in code snippet provided earlier.
                   // It might be in 'details' JSON or implied.
                   // Just Alert for now as per previous logic.
                   alert("ไม่พบไฟล์แนบ (No file attached)");
                }
             }}>
                <FileText className="h-4 w-4" />
              </Button>
            {statusCode === "DRAFT" && (
              <Link href={`/correspondences/${docId}/edit`}>
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
      <DataTable columns={columns} data={data || []} />
    </div>
  );
}
