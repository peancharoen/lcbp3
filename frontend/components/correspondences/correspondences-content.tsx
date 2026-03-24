'use client';

import { CorrespondenceList } from '@/components/correspondences/list';
import { Pagination } from '@/components/common/pagination';
import { useCorrespondences } from '@/hooks/use-correspondence';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { Loader2, Search, X, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Link from 'next/link';
import { useCallback, useState } from 'react';
import apiClient from '@/lib/api/client';

const STATUS_FILTERS = [
  { value: '', label: 'All Statuses' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'IN_REVIEW', label: 'In Review' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

export function CorrespondencesContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const page = Number(searchParams.get('page') || '1');
  const statusFilter = searchParams.get('status') || '';
  const search = searchParams.get('search') || undefined;
  const revisionStatus = (searchParams.get('revisionStatus') as 'CURRENT' | 'ALL' | 'OLD') || 'CURRENT';

  const [searchInput, setSearchInput] = useState(search || '');
  const [exporting, setExporting] = useState(false);

  const handleExportCsv = async () => {
    setExporting(true);
    try {
      const params: Record<string, string> = {};
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      if (revisionStatus) params.revisionStatus = revisionStatus;

      const response = await apiClient.get('/correspondences/export-csv', {
        params,
        responseType: 'blob',
      });

      const url = URL.createObjectURL(new Blob([response.data], { type: 'text/csv' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `correspondences-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  const { data, isLoading, isError } = useCorrespondences({
    page,
    search,
    status: statusFilter || undefined,
    revisionStatus,
  });

  const buildUrl = useCallback((updates: Record<string, string>) => {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(updates).forEach(([k, v]) => {
      if (v) params.set(k, v);
      else params.delete(k);
    });
    params.set('page', '1');
    return `${pathname}?${params.toString()}`;
  }, [searchParams, pathname]);

  const handleSearch = () => {
    router.push(buildUrl({ search: searchInput }));
  };

  const handleClearSearch = () => {
    setSearchInput('');
    router.push(buildUrl({ search: '' }));
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (isError) {
    return <div className="text-red-500 text-center py-8">Failed to load correspondences.</div>;
  }

  return (
    <>
      {/* Filters bar */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="flex items-center gap-1 flex-1 min-w-[200px] max-w-sm">
          <div className="relative w-full">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Search by number or subject..."
              className="pl-8 pr-8 h-9 text-sm"
            />
            {searchInput && (
              <button
                onClick={handleClearSearch}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <Button size="sm" onClick={handleSearch} className="h-9">Search</Button>
        </div>

        {/* Status filter */}
        <div className="flex gap-1 bg-muted p-1 rounded-md">
          {STATUS_FILTERS.map(({ value, label }) => (
            <Link key={value} href={buildUrl({ status: value })}>
              <Button
                variant={statusFilter === value ? 'default' : 'ghost'}
                size="sm"
                className="text-xs px-3 h-7"
              >
                {label}
              </Button>
            </Link>
          ))}
        </div>

        {/* Revision filter */}
        <div className="flex gap-1 bg-muted p-1 rounded-md">
          {(['CURRENT', 'ALL', 'OLD'] as const).map((rs) => (
            <Link key={rs} href={buildUrl({ revisionStatus: rs })}>
              <Button
                variant={revisionStatus === rs ? 'default' : 'ghost'}
                size="sm"
                className="text-xs px-3 h-7"
              >
                {rs === 'CURRENT' ? 'Latest' : rs === 'OLD' ? 'Previous' : 'All'}
              </Button>
            </Link>
          ))}
        </div>

        {/* Export */}
        <Button
          variant="outline"
          size="sm"
          className="h-9 ml-auto gap-1.5"
          onClick={handleExportCsv}
          disabled={exporting}
        >
          {exporting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Download className="h-3.5 w-3.5" />
          )}
          Export CSV
        </Button>
      </div>

      <CorrespondenceList data={data?.data || []} />
      <div className="mt-4">
        <Pagination
          currentPage={data?.meta?.page || 1}
          totalPages={data?.meta?.totalPages || 1}
          total={data?.meta?.total || 0}
        />
      </div>
    </>
  );
}
