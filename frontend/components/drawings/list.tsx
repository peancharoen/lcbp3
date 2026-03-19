'use client';

import { useDrawings } from '@/hooks/use-drawing';
import { useState } from 'react';
import { PaginationState, SortingState } from '@tanstack/react-table';
import { ServerDataTable } from '@/components/documents/common/server-data-table';
import { columns } from './columns';

import { SearchContractDrawingDto } from '@/types/dto/drawing/contract-drawing.dto';
import { SearchShopDrawingDto } from '@/types/dto/drawing/shop-drawing.dto';
import { SearchAsBuiltDrawingDto } from '@/types/dto/drawing/asbuilt-drawing.dto';

type DrawingSearchParams = SearchContractDrawingDto | SearchShopDrawingDto | SearchAsBuiltDrawingDto;

interface DrawingListProps {
  type: 'CONTRACT' | 'SHOP' | 'AS_BUILT';
  projectUuid: string;
  filters?: Partial<DrawingSearchParams>;
}

export function DrawingList({ type, projectUuid, filters }: DrawingListProps) {
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 20,
  });
  const [sorting, setSorting] = useState<SortingState>([]);

  const {
    data: response,
    isLoading,
    isError,
    error,
  } = useDrawings(type, {
    projectUuid,
    ...filters,
    page: pagination.pageIndex + 1, // API is 1-based
    limit: pagination.pageSize,
  } as any);

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
        onPaginationChange={setPagination}
        sorting={sorting}
        onSortingChange={setSorting}
        isLoading={isLoading}
      />
    </div>
  );
}
