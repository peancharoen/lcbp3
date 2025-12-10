"use client";

import { CorrespondenceList } from "@/components/correspondences/list";
import { Pagination } from "@/components/common/pagination";
import { useCorrespondences } from "@/hooks/use-correspondence";
import { useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";

export function CorrespondencesContent() {
  const searchParams = useSearchParams();
  const page = parseInt(searchParams.get("page") || "1");
  const status = searchParams.get("status") || undefined;
  const search = searchParams.get("search") || undefined;

  const { data, isLoading, isError } = useCorrespondences({
    page,
    status,
    search,
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
      <CorrespondenceList data={data} />
      <div className="mt-4">
        <Pagination
          currentPage={data?.page || 1}
          totalPages={data?.totalPages || 1}
          total={data?.total || 0}
        />
      </div>
    </>
  );
}
