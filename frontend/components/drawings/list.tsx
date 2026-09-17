'use client';

import { useDrawings } from '@/hooks/use-drawing';
import { useState } from 'react';
import { PaginationState, SortingState, Updater } from '@tanstack/react-table';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ServerDataTable } from '@/components/documents/common/server-data-table';
import { createDrawingColumns } from './columns';

import { SearchContractDrawingDto } from '@/types/dto/drawing/contract-drawing.dto';
import { SearchShopDrawingDto } from '@/types/dto/drawing/shop-drawing.dto';
import { SearchAsBuiltDrawingDto } from '@/types/dto/drawing/asbuilt-drawing.dto';

type DrawingSearchParams = SearchContractDrawingDto | SearchShopDrawingDto | SearchAsBuiltDrawingDto;

interface DrawingListProps {
  type: 'CONTRACT' | 'SHOP' | 'AS_BUILT';
  projectUuid: string;
  filters?: Partial<DrawingSearchParams>;
  onSelectionChange?: (selectedIds: string[]) => void;
}

export function DrawingList({ type, projectUuid, filters, onSelectionChange }: DrawingListProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const page = Number(searchParams.get('page') ?? 1);
  const limit = Number(searchParams.get('limit') ?? 20);
  const sortBy = searchParams.get('sortBy');
  const sortOrder = searchParams.get('sortOrder');
  const pagination: PaginationState = { pageIndex: Math.max(page - 1, 0), pageSize: limit };
  const sorting: SortingState = sortBy ? [{ id: sortBy, desc: sortOrder === 'DESC' }] : [];
  const [rowSelection, setRowSelection] = useState<Record<string, boolean>>({});
  const columns = createDrawingColumns(type);

  const updateQuery = (changes: Record<string, string>) => {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(changes).forEach(([key, value]) => params.set(key, value));
    router.push(`${pathname}?${params.toString()}`);
  };

  const handlePaginationChange = (updater: Updater<PaginationState>) => {
    const next = typeof updater === 'function' ? updater(pagination) : updater;
    updateQuery({ page: String(next.pageIndex + 1), limit: String(next.pageSize) });
  };

  const handleSortingChange = (updater: Updater<SortingState>) => {
    const next = typeof updater === 'function' ? updater(sorting) : updater;
    if (next[0]) updateQuery({ sortBy: next[0].id, sortOrder: next[0].desc ? 'DESC' : 'ASC', page: '1' });
  };

  const handleRowSelectionChange = (value: Record<string, boolean>) => {
    setRowSelection(value);
    if (onSelectionChange) {
      const selected = Object.keys(value).filter((k) => value[k]);
      onSelectionChange(selected);
    }
  };

  const {
    data: response,
    isLoading,
    isError,
    error,
  } = useDrawings(type, {
    projectUuid,
    ...filters,
    documentNumber: searchParams.get('documentNumber') || undefined,
    revision: type === 'CONTRACT' ? undefined : searchParams.get('revision') || undefined,
    createdDate: searchParams.get('createdDate') || undefined,
    sortBy: sortBy === 'revision' && type === 'CONTRACT' ? undefined : sortBy || undefined,
    sortOrder: sortOrder === 'ASC' || sortOrder === 'DESC' ? sortOrder : undefined,
    page: pagination.pageIndex + 1, // API is 1-based
    limit: pagination.pageSize,
  } as DrawingSearchParams);

  const drawings = response?.data || [];
  const meta = response?.meta || { total: 0, page: 1, limit: 20, totalPages: 0 };

  if (isError) {
    const axiosError = error as Error & { response?: { status?: number; data?: { message?: string | string[] } } };
    const status = axiosError?.response?.status;
    const message = axiosError?.response?.data?.message;
    return (
      <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
        <p className="font-medium">Failed to load {type.toLowerCase()} drawings</p>
        <p className="mt-1 text-xs opacity-80">
          {status && `HTTP ${status}: `}
          {Array.isArray(message) ? message.join(', ') : message || axiosError.message}
        </p>
      </div>
    );
  }

  return (
    <div>
      <ServerDataTable
        columns={columns}
        data={drawings}
        pageCount={meta.totalPages}
        pagination={pagination}
        onPaginationChange={handlePaginationChange}
        sorting={sorting}
        onSortingChange={handleSortingChange}
        isLoading={isLoading}
        enableRowSelection
        rowSelection={rowSelection}
        onRowSelectionChange={handleRowSelectionChange}
        getRowId={(row) => row.publicId ?? ''}
      />
    </div>
  );
}
