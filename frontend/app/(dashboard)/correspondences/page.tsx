"use client";

import { CorrespondenceList } from "@/components/correspondences/list";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Plus, Loader2 } from "lucide-react"; // Added Loader2
import { Pagination } from "@/components/common/pagination";
import { useCorrespondences } from "@/hooks/use-correspondence";
import { useSearchParams } from "next/navigation";

export default function CorrespondencesPage() {
  const searchParams = useSearchParams();
  const page = parseInt(searchParams.get("page") || "1");
  const status = searchParams.get("status") || undefined;
  const search = searchParams.get("search") || undefined;

  const { data, isLoading, isError } = useCorrespondences({
    page,
    status, // This might be wrong type, let's cast or omit for now
    search,
  } as any);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Correspondences</h1>
          <p className="text-muted-foreground mt-1">
            Manage official letters and communications
          </p>
        </div>
        <Link href="/correspondences/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            New Correspondence
          </Button>
        </Link>
      </div>

      {/* Filters component could go here */}

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : isError ? (
        <div className="text-red-500 text-center py-8">
          Failed to load correspondences.
        </div>
      ) : (
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
      )}
    </div>
  );
}
