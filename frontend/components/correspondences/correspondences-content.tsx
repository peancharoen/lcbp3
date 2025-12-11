"use client";

import { CorrespondenceList } from "@/components/correspondences/list";
import { Pagination } from "@/components/common/pagination";
import { useCorrespondences } from "@/hooks/use-correspondence";
import { useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export function CorrespondencesContent() {
  const searchParams = useSearchParams();
  const page = parseInt(searchParams.get("page") || "1");
  const status = searchParams.get("status") || undefined;
  const search = searchParams.get("search") || undefined;

  const revisionStatus = (searchParams.get('revisionStatus') as 'CURRENT' | 'ALL' | 'OLD') || 'CURRENT';

  const { data, isLoading, isError } = useCorrespondences({
    page,
    status,
    search,
    revisionStatus,
  } as any);

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="text-red-500 text-center py-8">
        Failed to load correspondences.
      </div>
    );
  }

  return (
    <>
      <div className="mb-4 flex gap-2">
         <div className="flex gap-1 bg-muted p-1 rounded-md">
           {['ALL', 'CURRENT', 'OLD'].map((status) => (
             <Link key={status} href={`?${new URLSearchParams({...Object.fromEntries(searchParams.entries()), revisionStatus: status, page: '1'}).toString()}`}>
               <Button
                 variant={revisionStatus === status ? 'default' : 'ghost'}
                 size="sm"
                 className="text-xs px-3"
               >
                 {status === 'CURRENT' ? 'Latest' : status === 'OLD' ? 'Previous' : 'All'}
               </Button>
             </Link>
           ))}
        </div>
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
