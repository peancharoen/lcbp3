'use client';

import { ColumnDef } from '@tanstack/react-table';
import { Drawing } from '@/types/drawing';
import { Button } from '@/components/ui/button';
import { MoreHorizontal, Pencil, Upload } from 'lucide-react';
import Link from 'next/link';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { DocumentRowActions } from '@/components/documents/document-row-actions';
import { getDocumentActionConfig } from '@/components/documents/document-action-strategy';
import { DocumentListHeader } from '@/components/documents/common/document-list-header';

export function createDrawingColumns(type: 'CONTRACT' | 'SHOP' | 'AS_BUILT'): ColumnDef<Drawing>[] {
  return [
  {
    accessorKey: 'drawingNumber',
    header: () => <DocumentListHeader title="Drawing No." field="documentNumber" filter="text" />,
  },
  {
    accessorKey: 'title',
    header: 'Title',
  },
  {
    accessorKey: 'revision',
    header: () => type === 'CONTRACT'
      ? <span>Revision</span>
      : <DocumentListHeader title="Revision" field="revision" filter="text" />,
    cell: ({ row }) => type === 'CONTRACT' ? '-' : row.original.revision || '-',
  },
  {
    accessorKey: 'legacyDrawingNumber',
    header: 'Legacy No.',
    cell: ({ row }) => row.original.legacyDrawingNumber || '-',
  },
  {
    accessorKey: 'createdAt',
    header: () => <DocumentListHeader title="Created" field="createdAt" filter="date" />,
    cell: ({ row }) => {
      const date = new Date(row.original.createdAt || '');
      return isNaN(date.getTime()) ? '-' : date.toLocaleDateString();
    },
  },
  {
    id: 'status',
    header: 'Status',
    cell: () => '-',
  },
  {
    id: 'actions',
    cell: ({ row }) => {
      const drawing = row.original;

      return (
        <div className="flex gap-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <span className="sr-only">Open menu</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => navigator.clipboard.writeText(drawing.drawingNumber)}>
                Copy Drawing No.
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href={`/drawings/${drawing.publicId}`}>View Details</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href={`/drawings/${drawing.publicId}?edit=true`}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit Detail
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href={`/drawings/${drawing.publicId}?upload=true`}>
                  <Upload className="mr-2 h-4 w-4" />
                  Upload Revision
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <DocumentRowActions
            config={getDocumentActionConfig('DRAWING')}
            onCancel={() => {/* TODO: open cancel dialog */}}
            onHardDelete={() => {/* TODO: open hard-delete dialog */}}
            onMetadataEdit={() => {/* TODO: open metadata edit dialog */}}
          />
        </div>
      );
    },
  },
  ];
}
