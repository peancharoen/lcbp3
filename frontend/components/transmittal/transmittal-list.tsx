'use client';

import { Transmittal } from '@/types/transmittal';
import { DataTable } from '@/components/common/data-table';
import { ColumnDef } from '@tanstack/react-table';
import { Button } from '@/components/ui/button';
import { Eye } from 'lucide-react';
import Link from 'next/link';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { DocumentRowActions } from '@/components/documents/document-row-actions';
import { getDocumentActionConfig } from '@/components/documents/document-action-strategy';

interface TransmittalListProps {
  data: Transmittal[];
  rowSelection?: Record<string, boolean>;
  onRowSelectionChange?: (value: Record<string, boolean>) => void;
}

export function TransmittalList({
  data,
  rowSelection,
  onRowSelectionChange,
}: TransmittalListProps) {
  if (!data) return null;

  const columns: ColumnDef<Transmittal>[] = [
    {
      id: 'transmittalNo',
      header: 'Transmittal No.',
      cell: ({ row }) => {
        const no = row.original.correspondence?.correspondenceNumber || row.original.transmittalNo || '-';
        return <span className="font-medium">{no}</span>;
      },
    },
    {
      id: 'subject',
      header: 'Subject',
      cell: ({ row }) => {
        const currentRev = row.original.correspondence?.revisions?.find((r) => r.isCurrent);
        const subject = currentRev?.title || row.original.subject || '-';
        return (
          <div className="max-w-[300px] truncate" title={subject}>
            {subject}
          </div>
        );
      },
    },
    {
      accessorKey: 'purpose',
      header: 'Purpose',
      cell: ({ row }) => <Badge variant="outline">{row.getValue('purpose') || 'OTHER'}</Badge>,
    },
    {
      accessorKey: 'items',
      header: 'Items',
      cell: ({ row }) => {
        const items = row.original.items || [];
        return <span>{items.length} items</span>;
      },
    },
    {
      id: 'createdAt',
      header: 'Date',
      cell: ({ row }) => {
        const dateStr = row.original.correspondence?.createdAt || row.original.createdAt;
        if (!dateStr) return '-';
        return format(new Date(dateStr), 'dd MMM yyyy');
      },
    },
    {
      id: 'actions',
      cell: ({ row }) => {
        const item = row.original;
        return (
          <div className="flex gap-2">
            <Link href={`/transmittals/${item.publicId}`}>
              <Button variant="ghost" size="icon" title="View Details">
                <Eye className="h-4 w-4" />
              </Button>
            </Link>
            <DocumentRowActions
              config={getDocumentActionConfig('TRANSMITTAL')}
              onCancel={() => {/* TODO: open cancel dialog */}}
              onHardDelete={() => {/* TODO: open hard-delete dialog */}}
              onMetadataEdit={() => {/* TODO: open metadata edit dialog */}}
            />
          </div>
        );
      },
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={data}
      enableRowSelection
      rowSelection={rowSelection}
      onRowSelectionChange={onRowSelectionChange}
      getRowId={(row) => row.publicId}
    />
  );
}
