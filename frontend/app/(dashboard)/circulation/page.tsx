"use client";

import { useQuery } from "@tanstack/react-query";
import { CirculationList } from "@/components/circulation/circulation-list";
import { circulationService } from "@/lib/services/circulation.service";
import { Button } from "@/components/ui/button";
import { Plus, RefreshCw } from "lucide-react";
import Link from "next/link";
import { CirculationListResponse } from "@/types/circulation";

/**
 * Circulation list page - displays circulations for the current user's organization
 */
export default function CirculationPage() {
  const {
    data,
    isLoading,
    error,
    refetch,
  } = useQuery<CirculationListResponse>({
    queryKey: ["circulations"],
    queryFn: () => circulationService.getAll(),
  });

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Circulation</h1>
          <p className="text-muted-foreground">
            Manage internal document circulation and assignments
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
          <Link href="/circulation/new">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create Circulation
            </Button>
          </Link>
        </div>
      </div>

      {error && (
        <div className="bg-destructive/10 text-destructive px-4 py-3 rounded-md">
          Failed to load circulations. Please try again.
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : data ? (
        <CirculationList data={data} />
      ) : (
        <div className="text-center py-12 text-muted-foreground">
          No circulations found
        </div>
      )}
    </section>
  );
}
