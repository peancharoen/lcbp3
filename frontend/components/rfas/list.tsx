'use client';

import { RFA } from '@/types/rfa';
import { DataTable } from '@/components/common/data-table';
import { ColumnDef } from '@tanstack/react-table';
import { StatusBadge } from '@/components/common/status-badge';
import { Button } from '@/components/ui/button';
import { Eye, Edit, FileText } from 'lucide-react';
import Link from 'next/link';
import { format } from 'date-fns';
import { toast } from 'sonner';

interface RFAListProps {
  data: RFA[];
}

export function RFAList({ data }: RFAListProps) {
  if (!data) return null;

  const columns: ColumnDef<RFA>[] = [
    {
      accessorKey: 'rfa_number',
      header: 'RFA No.',
      cell: ({ row }) => {
        return <span className="font-medium">{row.original.correspondence?.correspondenceNumber || '-'}</span>;
      },
    },
    {
      accessorKey: 'subject',
      header: 'Subject',
      cell: ({ row }) => {
        const rev = row.original.revisions?.[0];
        return (
          <div className="max-w-[300px] truncate" title={rev?.subject}>
            {rev?.subject || '-'}
          </div>
        );
      },
    },
    {
      accessorKey: 'project_name',
      header: 'Project',
      cell: ({ row }) => {
        return <span>{row.original.correspondence?.project?.projectName || '-'}</span>;
      },
    },
    {
      accessorKey: 'discipline_name',
      header: 'Discipline',
      cell: ({ row }) => <span>{row.original.discipline?.name || '-'}</span>,
    },
    {
      accessorKey: 'createdAt',
      header: 'Created',
      cell: ({ row }) => {
        const date = row.original.correspondence?.createdAt || row.original.revisions?.[0]?.createdAt; // Fallback or strict?
        // In backend I set RFA -> Correspondence (createdAt is in Correspondence base)
        // But RFA revision also has createdAt?
        // Use correspondence.createdAt usually for document date.
        return date ? format(new Date(date), 'dd MMM yyyy') : '-';
      },
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => {
        const status =
          row.original.revisions?.[0]?.statusCode?.statusName || row.original.revisions?.[0]?.statusCode?.statusCode;
        return <StatusBadge status={status || 'Unknown'} />;
      },
    },
    {
      id: 'actions',
      cell: ({ row }) => {
        const item = row.original;

        const handleViewFile = (e: React.MouseEvent) => {
          e.preventDefault();
          const firstItem = item.revisions?.[0]?.items?.[0];
          const firstAttachment =
            firstItem?.shopDrawingRevision?.attachments?.[0] || firstItem?.asBuiltDrawingRevision?.attachments?.[0];
          if (firstAttachment?.url) {
            window.open(firstAttachment.url, '_blank');
          } else {
            // Use alert or toast. Assuming toast is available or use generic alert for now if toast not imported
            // But rfa.service.ts in use-rfa.ts uses 'sonner', so 'sonner' is likely available.
            // I will try to use toast from 'sonner' if I import it, or just window.alert for safety.
            // User said "หน้าต่างแจ้งเตือน" -> Alert window.
            toast.error('ไม่พบไฟล์แนบ (No file attached)');
          }
        };

        return (
          <div className="flex gap-2">
            <Link href={`/rfas/${row.original.publicId}`}>
              <Button variant="ghost" size="icon" title="View Details">
                <Eye className="h-4 w-4" />
              </Button>
            </Link>
            <Button variant="ghost" size="icon" title="View File" onClick={handleViewFile}>
              <FileText className="h-4 w-4" />
            </Button>
            <Link href={`/rfas/${row.original.publicId}/edit`}>
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
