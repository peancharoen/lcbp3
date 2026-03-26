'use client';

import { CorrespondenceRevision } from '@/types/correspondence';
import { DataTable } from '@/components/common/data-table';
import { ColumnDef } from '@tanstack/react-table';
import { StatusBadge } from '@/components/common/status-badge';
import { Button } from '@/components/ui/button';
import { Eye, Edit } from 'lucide-react';
import Link from 'next/link';
import { format } from 'date-fns';

interface CorrespondenceListProps {
  data: CorrespondenceRevision[];
}

export function CorrespondenceList({ data }: CorrespondenceListProps) {
  const columns: ColumnDef<CorrespondenceRevision>[] = [
    {
      accessorKey: 'correspondence.correspondenceNumber',
      header: 'Document No.',
      cell: ({ row }) => <span className="font-medium">{row.original.correspondence?.correspondenceNumber}</span>,
    },
    {
      accessorKey: 'revisionLabel',
      header: 'Rev',
      cell: ({ row }) => (
        <span className="font-medium">{row.original.revisionLabel || row.original.revisionNumber}</span>
      ),
    },
    {
      accessorKey: 'subject',
      header: 'Subject',
      cell: ({ row }) => (
        <div className="max-w-[300px] truncate" title={row.original.subject}>
          {row.original.subject}
        </div>
      ),
    },
    {
      accessorKey: 'correspondence.type.typeCode',
      header: 'Type',
      cell: ({ row }) => (
        <span className="text-xs font-medium bg-muted px-1.5 py-0.5 rounded">
          {row.original.correspondence?.type?.typeCode || '-'}
        </span>
      ),
    },
    {
      accessorKey: 'correspondence.originator.organizationCode',
      header: 'From',
      cell: ({ row }) => (
        <span className="font-medium">{row.original.correspondence?.originator?.organizationCode || '-'}</span>
      ),
    },
    {
      accessorKey: 'correspondence.project.projectCode',
      header: 'Project',
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">{row.original.correspondence?.project?.projectCode || '-'}</span>
      ),
    },
    {
      accessorKey: 'dueDate',
      header: 'Due Date',
      cell: ({ row }) => {
        const due = row.original.dueDate;
        if (!due) return <span className="text-muted-foreground">-</span>;
        const isOverdue = new Date(due) < new Date() && row.original.status?.statusCode !== 'CANCELLED';
        return (
          <span className={isOverdue ? 'text-destructive font-medium' : ''}>
            {format(new Date(due), 'dd MMM yyyy')}
          </span>
        );
      },
    },
    {
      accessorKey: 'createdAt',
      header: 'Created',
      cell: ({ row }) => format(new Date(row.getValue('createdAt')), 'dd MMM yyyy'),
    },
    {
      accessorKey: 'status.statusName',
      header: 'Status',
      cell: ({ row }) => <StatusBadge status={row.original.status?.statusCode || 'UNKNOWN'} />,
    },
    {
      id: 'actions',
      cell: ({ row }) => {
        const item = row.original;
        // Edit/View link goes to the DOCUMENT detail (correspondence.publicId)
        // Ideally we might pass ?revId=item.publicId to view specific revision, but detail page defaults to latest.
        // For editing, we edit the document.
        const docUuid = item.correspondence.publicId;
        const statusCode = item.status?.statusCode;

        return (
          <div className="flex gap-2">
            <Link href={`/correspondences/${docUuid}`}>
              <Button variant="ghost" size="icon" title="View Details">
                <Eye className="h-4 w-4" />
              </Button>
            </Link>
            {statusCode === 'DRAFT' && (
              <Link href={`/correspondences/${docUuid}/edit`}>
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
