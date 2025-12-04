import { CorrespondenceList } from "@/components/correspondences/list";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Plus } from "lucide-react";
import { correspondenceApi } from "@/lib/api/correspondences";
import { Pagination } from "@/components/common/pagination";

export default async function CorrespondencesPage({
  searchParams,
}: {
  searchParams: { page?: string; status?: string; search?: string };
}) {
  const page = parseInt(searchParams.page || "1");
  const data = await correspondenceApi.getAll({
    page,
    status: searchParams.status,
    search: searchParams.search,
  });

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

      <CorrespondenceList data={data} />

      <div className="mt-4">
        <Pagination
          currentPage={data.page}
          totalPages={data.totalPages}
          total={data.total}
        />
      </div>
    </div>
  );
}
