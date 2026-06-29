# TASK-FE-005: Common Components & Reusable UI

**ID:** TASK-FE-005
**Title:** Build Reusable UI Components Library
**Category:** Foundation
**Priority:** P1 (High)
**Effort:** 3-4 days
**Dependencies:** TASK-FE-001
**Assigned To:** Frontend Developer

---

## 📋 Overview

Create reusable components including Data Table, File Upload, Date Picker, Pagination, Status Badges, and other common UI elements used across the application.

---

## 🎯 Objectives

1. Build DataTable component with sorting, filtering
2. Create File Upload component with drag-and-drop
3. Implement Date Range Picker
4. Create Pagination component
5. Build Status Badge components
6. Create Confirmation Dialog
7. Implement Toast Notifications

---

## 📦 Deliverables

### 1. Data Table Component

```typescript
// File: src/components/common/data-table.tsx
'use client';

import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
  getSortedRowModel,
  SortingState,
} from '@tanstack/react-table';
import { useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
}

export function DataTable<TData, TValue>({
  columns,
  data,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = useState<SortingState>([]);

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    onSortingChange: setSorting,
    getSortedRowModel: getSortedRowModel(),
    state: {
      sorting,
    },
  });

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead key={header.id}>
                  {flexRender(
                    header.column.columnDef.header,
                    header.getContext()
                  )}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows?.length ? (
            table.getRowModel().rows.map((row) => (
              <TableRow key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={columns.length} className="h-24 text-center">
                No results
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
```

### 2. File Upload Component

```typescript
// File: src/components/common/file-upload.tsx
'use client';

import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, X, File } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface FileUploadProps {
  onFilesSelected: (files: File[]) => void;
  maxFiles?: number;
  accept?: string;
  maxSize?: number; // bytes
}

export function FileUpload({
  onFilesSelected,
  maxFiles = 5,
  accept = '.pdf,.doc,.docx',
  maxSize = 10485760, // 10MB
}: FileUploadProps) {
  const [files, setFiles] = useState<File[]>([]);

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      setFiles((prev) => {
        const newFiles = [...prev, ...acceptedFiles].slice(0, maxFiles);
        onFilesSelected(newFiles);
        return newFiles;
      });
    },
    [maxFiles, onFilesSelected]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    maxFiles,
    accept: accept.split(',').reduce((acc, ext) => ({ ...acc, [ext]: [] }), {}),
    maxSize,
  });

  const removeFile = (index: number) => {
    setFiles((prev) => {
      const newFiles = prev.filter((_, i) => i !== index);
      onFilesSelected(newFiles);
      return newFiles;
    });
  };

  return (
    <div className="space-y-4">
      <div
        {...getRootProps()}
        className={cn(
          'border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors',
          isDragActive
            ? 'border-primary bg-primary/5'
            : 'border-gray-300 hover:border-gray-400'
        )}
      >
        <input {...getInputProps()} />
        <Upload className="mx-auto h-12 w-12 text-gray-400" />
        <p className="mt-2 text-sm text-gray-600">
          {isDragActive
            ? 'Drop files here'
            : 'Drag & drop files or click to browse'}
        </p>
        <p className="mt-1 text-xs text-gray-500">
          Maximum {maxFiles} files, {(maxSize / 1024 / 1024).toFixed(0)}MB each
        </p>
      </div>

      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((file, index) => (
            <div
              key={index}
              className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
            >
              <div className="flex items-center gap-3">
                <File className="h-5 w-5 text-gray-500" />
                <div>
                  <p className="text-sm font-medium">{file.name}</p>
                  <p className="text-xs text-gray-500">
                    {(file.size / 1024).toFixed(1)} KB
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => removeFile(index)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

### 3. Pagination Component

```typescript
// File: src/components/common/pagination.tsx
'use client';

import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  total: number;
}

export function Pagination({
  currentPage,
  totalPages,
  total,
}: PaginationProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const createPageURL = (pageNumber: number) => {
    const params = new URLSearchParams(searchParams);
    params.set('page', pageNumber.toString());
    return `${pathname}?${params.toString()}`;
  };

  return (
    <div className="flex items-center justify-between">
      <div className="text-sm text-gray-600">
        Showing page {currentPage} of {totalPages} ({total} total items)
      </div>

      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => router.push(createPageURL(currentPage - 1))}
          disabled={currentPage <= 1}
        >
          <ChevronLeft className="h-4 w-4" />
          Previous
        </Button>

        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
          const pageNum = i + 1;
          return (
            <Button
              key={pageNum}
              variant={pageNum === currentPage ? 'default' : 'outline'}
              size="sm"
              onClick={() => router.push(createPageURL(pageNum))}
            >
              {pageNum}
            </Button>
          );
        })}

        <Button
          variant="outline"
          size="sm"
          onClick={() => router.push(createPageURL(currentPage + 1))}
          disabled={currentPage >= totalPages}
        >
          Next
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
```

### 4. Status Badge Component

```typescript
// File: src/components/common/status-badge.tsx
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface StatusBadgeProps {
  status: string;
  className?: string;
}

const statusConfig = {
  DRAFT: { label: 'Draft', variant: 'secondary' },
  PENDING: { label: 'Pending', variant: 'warning' },
  IN_REVIEW: { label: 'In Review', variant: 'info' },
  APPROVED: { label: 'Approved', variant: 'success' },
  REJECTED: { label: 'Rejected', variant: 'destructive' },
  CLOSED: { label: 'Closed', variant: 'outline' },
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status] || { label: status, variant: 'default' };

  return (
    <Badge
      variant={config.variant as any}
      className={cn('uppercase', className)}
    >
      {config.label}
    </Badge>
  );
}
```

### 5. Confirmation Dialog

```typescript
// File: src/components/common/confirm-dialog.tsx
'use client';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  onConfirm: () => void;
  confirmText?: string;
  cancelText?: string;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  onConfirm,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
}: ConfirmDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{cancelText}</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>
            {confirmText}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
```

### 6. Toast Notifications

```bash
npx shadcn-ui@latest add toast
```

```typescript
// File: src/lib/stores/toast-store.ts (if not using Shadcn toast)
import { create } from 'zustand';

interface Toast {
  id: string;
  title: string;
  description?: string;
  variant: 'default' | 'success' | 'error' | 'warning';
}

interface ToastState {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],

  addToast: (toast) =>
    set((state) => ({
      toasts: [...state.toasts, { ...toast, id: Math.random().toString() }],
    })),

  removeToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),
}));
```

---

## 🧪 Testing

- [ ] DataTable sorts columns correctly
- [ ] File upload accepts/rejects files based on criteria
- [ ] Pagination navigates pages correctly
- [ ] Status badges show correct colors
- [ ] Confirmation dialog confirms/cancels actions
- [ ] Toast notifications appear and dismiss

---

## 🔗 Related Documents

- [ADR-012: UI Component Library](../../05-decisions/ADR-012-ui-component-library.md)

---

**Created:** 2025-12-01
**Status:** Ready
