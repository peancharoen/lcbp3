'use client';

// File: frontend/components/correspondences/list.tsx
// Change Log:
// - 2026-09-17: เชื่อม row actions เข้าหน้า detail dialogs และเปิด full edit หลัง submit สำหรับ Admin/Superadmin

import { CorrespondenceRevision } from '@/types/correspondence';
import { DataTable } from '@/components/common/data-table';
import { ColumnDef } from '@tanstack/react-table';
import { StatusBadge } from '@/components/common/status-badge';
import { Button } from '@/components/ui/button';
import { Eye, Edit } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { useAuthStore } from '@/lib/stores/auth-store';
import { DocumentRowActions } from '@/components/documents/document-row-actions';
import { getDocumentActionConfig } from '@/components/documents/document-action-strategy';
import { DocumentListHeader } from '@/components/documents/common/document-list-header';

interface CorrespondenceListProps {
  data: CorrespondenceRevision[];
  rowSelection?: Record<string, boolean>;
  onRowSelectionChange?: (value: Record<string, boolean>) => void;
}

export function CorrespondenceList({ data, rowSelection, onRowSelectionChange }: CorrespondenceListProps) {
  const { user, hasPermission } = useAuthStore();
  const router = useRouter();

  const columns: ColumnDef<CorrespondenceRevision>[] = [
    {
      accessorKey: 'correspondence.correspondenceNumber',
      header: () => <DocumentListHeader title="Document No." field="documentNumber" filter="text" />,
      cell: ({ row }) => <span className="font-medium">{row.original.correspondence?.correspondenceNumber}</span>,
    },
    {
      accessorKey: 'revisionLabel',
      header: () => <DocumentListHeader title="Rev" field="revision" filter="text" />,
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
        <span className="text-sm text-muted-foreground">
          {row.original.correspondence?.project?.projectCode || '-'}
        </span>
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
      header: () => <DocumentListHeader title="Created" field="createdAt" filter="date" />,
      cell: ({ row }) => format(new Date(row.getValue('createdAt')), 'dd MMM yyyy'),
    },
    {
      accessorKey: 'status.statusName',
      header: () => (
        <DocumentListHeader
          title="Status"
          field="status"
          filter="status"
          statusOptions={['DRAFT', 'IN_REVIEW', 'APPROVED', 'CANCELLED']}
        />
      ),
      cell: ({ row }) => <StatusBadge status={row.original.status?.statusCode || 'UNKNOWN'} />,
    },
    {
      id: 'actions',
      cell: ({ row }) => {
        const item = row.original;
        // Edit/View link goes to the DOCUMENT detail (correspondence.publicId)
        // Ideally we might pass ?revId=item.publicId to view specific revision, but detail page defaults to latest.
        // For editing, we edit the document.
        const docUuid = item.correspondence?.publicId;
        const revId = item.publicId;
        const statusCode = item.status?.statusCode;
        const normalizedRole = (user?.role || '').toUpperCase().replace(/\s+/g, '_');
        const isPrivilegedEditRole = ['SUPERADMIN', 'SUPER_ADMIN', 'ADMIN', 'DC', 'DOCUMENT_CONTROL'].includes(
          normalizedRole
        );
        const canEditInStatus = statusCode !== 'CANCELLED' && (statusCode === 'DRAFT' || isPrivilegedEditRole);
        const canEdit = canEditInStatus && (hasPermission('correspondence.edit') || isPrivilegedEditRole);

        if (!docUuid) {
          return null;
        }

        return (
          <div className="flex gap-2">
            <Link href={`/correspondences/${docUuid}?revId=${revId}`}>
              <Button variant="ghost" size="icon" title="View Details">
                <Eye className="h-4 w-4" />
              </Button>
            </Link>
            {canEdit && (
              <Link href={`/correspondences/${docUuid}/edit?revId=${revId}`}>
                <Button variant="ghost" size="icon" title="Edit">
                  <Edit className="h-4 w-4" />
                </Button>
              </Link>
            )}
            <DocumentRowActions
              config={getDocumentActionConfig('CORRESPONDENCE')}
              onCancel={() => router.push(`/correspondences/${docUuid}?action=cancel`)}
              onHardDelete={() => router.push(`/correspondences/${docUuid}?action=hard-delete`)}
              onMetadataEdit={() => router.push(`/correspondences/${docUuid}?revId=${revId}&action=edit-metadata`)}
            />
          </div>
        );
      },
    },
  ];

  return (
    <div>
      <DataTable
        columns={columns}
        data={data || []}
        enableRowSelection
        rowSelection={rowSelection}
        onRowSelectionChange={onRowSelectionChange}
        getRowId={(row) => row.correspondence?.publicId ?? row.publicId}
      />
    </div>
  );
}
