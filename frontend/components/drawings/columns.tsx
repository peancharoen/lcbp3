'use client';

import { ColumnDef } from '@tanstack/react-table';
import { Drawing } from '@/types/drawing';
import { Button } from '@/components/ui/button';
import { ArrowUpDown, MoreHorizontal, Pencil, Upload } from 'lucide-react';
import Link from 'next/link';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export const columns: ColumnDef<Drawing>[] = [
  {
    accessorKey: 'drawingNumber',
    header: ({ column }) => {
      return (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
          Drawing No.
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
  },
  {
    accessorKey: 'title',
    header: 'Title',
  },
  {
    accessorKey: 'revision',
    header: 'Revision',
    cell: ({ row }) => row.original.revision || '-',
  },
  {
    accessorKey: 'legacyDrawingNumber',
    header: 'Legacy No.',
    cell: ({ row }) => row.original.legacyDrawingNumber || '-',
  },
  {
    accessorKey: 'updatedAt',
    header: 'Last Updated',
    cell: ({ row }) => {
      const date = new Date(row.original.updatedAt || '');
      return isNaN(date.getTime()) ? '-' : date.toLocaleDateString();
    },
  },
  {
    id: 'actions',
    cell: ({ row }) => {
      const drawing = row.original;

      return (
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
              <Link href={`/drawings/${drawing.uuid}`}>
                View Details
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href={`/drawings/${drawing.uuid}?edit=true`}>
                <Pencil className="mr-2 h-4 w-4" />
                Edit Detail
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href={`/drawings/${drawing.uuid}?upload=true`}>
                <Upload className="mr-2 h-4 w-4" />
                Upload Revision
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
  },
];
