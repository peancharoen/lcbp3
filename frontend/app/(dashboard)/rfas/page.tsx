'use client';

import { RFAList } from '@/components/rfas/list';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import Link from 'next/link';
import { Plus, Loader2, Search } from 'lucide-react';
import { useRFAs } from '@/hooks/use-rfa';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { Pagination } from '@/components/common/pagination';
import { Suspense, useCallback } from 'react';

const RFA_STATUS_OPTIONS = [
  { value: 'ALL', label: 'All Statuses' },
  { value: 'DFT', label: 'Draft' },
  { value: 'FAP', label: 'For Approve' },
  { value: 'FRE', label: 'For Review' },
  { value: 'FCO', label: 'For Comment Only' },
  { value: 'CC', label: 'Cancelled' },
];

function RFAsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const page = Number(searchParams.get('page') || '1');
  const statusCode = searchParams.get('statusCode') || undefined;
  const search = searchParams.get('search') || undefined;
  const projectId = searchParams.get('projectId') || undefined;
  const revisionStatus = (searchParams.get('revisionStatus') as 'CURRENT' | 'ALL' | 'OLD') || 'CURRENT';

  const { data, isLoading, isError } = useRFAs({ page, statusCode, search, projectId, revisionStatus });

  const updateParam = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value && value !== 'ALL') {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      params.set('page', '1');
      router.push(`${pathname}?${params.toString()}`);
    },
    [searchParams, router, pathname]
  );

  return (
    <>
      <div className="mb-4 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search RFA number or subject..."
            defaultValue={search ?? ''}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                updateParam('search', (e.target as HTMLInputElement).value);
              }
            }}
            onBlur={(e) => updateParam('search', e.target.value)}
          />
        </div>

        <Select
          value={statusCode ?? 'ALL'}
          onValueChange={(val) => updateParam('statusCode', val)}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            {RFA_STATUS_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex gap-1 bg-muted p-1 rounded-md">
          {(['ALL', 'CURRENT', 'OLD'] as const).map((s) => (
            <Button
              key={s}
              variant={revisionStatus === s ? 'default' : 'ghost'}
              size="sm"
              className="text-xs px-3"
              onClick={() => updateParam('revisionStatus', s)}
            >
              {s === 'CURRENT' ? 'Latest' : s === 'OLD' ? 'Previous' : 'All Revisions'}
            </Button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : isError ? (
        <div className="text-red-500 text-center py-8">Failed to load RFAs.</div>
      ) : (
        <>
          <RFAList data={data?.data || []} />
          <div className="mt-4">
            <Pagination
              currentPage={data?.meta?.page || 1}
              totalPages={data?.meta?.totalPages || 1}
              total={data?.meta?.total || 0}
            />
          </div>
        </>
      )}
    </>
  );
}

export default function RFAsPage() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">RFAs (Request for Approval)</h1>
          <p className="text-muted-foreground mt-1">Manage approval requests and submissions</p>
        </div>
        <Link href="/rfas/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            New RFA
          </Button>
        </Link>
      </div>

      <Suspense
        fallback={
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        }
      >
        <RFAsContent />
      </Suspense>
    </div>
  );
}
