import { RFAList } from "@/components/rfas/list";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Plus } from "lucide-react";
import { rfaApi } from "@/lib/api/rfas";
import { Pagination } from "@/components/common/pagination";

export default async function RFAsPage({
  searchParams,
}: {
  searchParams: { page?: string; status?: string; search?: string };
}) {
  const page = parseInt(searchParams.page || "1");
  const data = await rfaApi.getAll({
    page,
    status: searchParams.status,
    search: searchParams.search,
  });

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

      <RFAList data={data} />

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
