'use client';

import { DrawingCard } from '@/components/drawings/card';
import { useDrawings } from '@/hooks/use-drawing';
import { Drawing } from '@/types/drawing';
import { Loader2 } from 'lucide-react';
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
  projectId: number;
  filters?: Partial<DrawingSearchParams>;
}

export function DrawingList({ type, projectId, filters }: DrawingListProps) {
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 20,
  });
  const [sorting, setSorting] = useState<SortingState>([]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const {
    data: response,
    isLoading,
    isError,
  } = useDrawings(type, {
    projectId,
    ...filters,
    page: pagination.pageIndex + 1, // API is 1-based
    pageSize: pagination.pageSize,
  } as any);

  const drawings = response?.data || [];
  const meta = response?.meta || { total: 0, page: 1, limit: 20, totalPages: 0 };

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
