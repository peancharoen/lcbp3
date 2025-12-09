"use client";

import { useQuery } from "@tanstack/react-query";
import { TransmittalList } from "@/components/transmittal/transmittal-list";
import { transmittalService } from "@/lib/services/transmittal.service";
import { Button } from "@/components/ui/button";
import { Plus, RefreshCw } from "lucide-react";
import Link from "next/link";
import { TransmittalListResponse } from "@/types/transmittal";

export default function TransmittalPage() {
  const {
    data,
    isLoading,
    error,
    refetch,
  } = useQuery<TransmittalListResponse>({
    queryKey: ["transmittals"],
    queryFn: () => transmittalService.getAll({ projectId: 1 }),
  });

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Transmittals</h1>
          <p className="text-muted-foreground">
            Manage document transmittal slips
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => refetch()}
            disabled={isLoading}
            title="Refresh"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          </Button>
          <Link href="/transmittals/new">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Transmittal
            </Button>
          </Link>
        </div>
      </div>

      {error && (
        <div className="bg-destructive/10 text-destructive px-4 py-3 rounded-md">
          Failed to load transmittals.
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <TransmittalList data={data?.data || []} />
      )}
    </section>
  );
}
