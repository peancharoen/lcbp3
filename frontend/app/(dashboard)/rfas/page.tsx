"use client";

import { RFAList } from '@/components/rfas/list';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Plus, Loader2 } from 'lucide-react';
import { useRFAs } from '@/hooks/use-rfa';
import { useSearchParams } from 'next/navigation';
import { Pagination } from '@/components/common/pagination';
import { Suspense } from 'react';

function RFAsContent() {
  const searchParams = useSearchParams();
  const page = parseInt(searchParams.get('page') || '1');
  const statusId = searchParams.get('status') ? parseInt(searchParams.get('status')!) : undefined;
  const search = searchParams.get('search') || undefined;
  const projectId = searchParams.get('projectId') ? parseInt(searchParams.get('projectId')!) : undefined;

  const { data, isLoading, isError } = useRFAs({ page, statusId, search, projectId });

  return (
    <>
      {/* RFAFilters component could be added here if needed */}

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : isError ? (
        <div className="text-red-500 text-center py-8">
          Failed to load RFAs.
        </div>
      ) : (
        <>
          <RFAList data={data} />
           <div className="mt-4">
            <Pagination
              currentPage={data?.page || 1}
              totalPages={data?.lastPage || data?.totalPages || 1}
              total={data?.total || 0}
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
          <p className="text-muted-foreground mt-1">
            Manage approval requests and submissions
          </p>
        </div>
        <Link href="/rfas/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            New RFA
          </Button>
        </Link>
      </div>

      <Suspense fallback={
        <div className="flex justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      }>
        <RFAsContent />
      </Suspense>
    </div>
  );
}
