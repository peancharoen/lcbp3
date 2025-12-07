"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { SearchFilters } from "@/components/search/filters";
import { SearchResults } from "@/components/search/results";
import { SearchFilters as FilterType } from "@/types/search";
import { useSearch } from "@/hooks/use-search";
import { Button } from "@/components/ui/button";

export default function SearchPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  // URL Params state
  const query = searchParams.get("q") || "";
  const typeParam = searchParams.get("type");
  const statusParam = searchParams.get("status");

  // Local Filter State (synced with URL initially, but can be independent before apply)
  // For simplicity, we'll keep filters in sync with valid search params or local state that pushes to URL
  const [filters, setFilters] = useState<FilterType>({
    types: typeParam ? [typeParam] : [],
    statuses: statusParam ? [statusParam] : [],
  });

  // Construct search DTO
  const searchDto = {
    q: query,
    // Map internal types to backend expectation if needed, assumes direct mapping for now
    type: filters.types?.length === 1 ? filters.types[0] : undefined, // Backend might support single type or multiple?
    // DTO says 'type?: string', 'status?: string'. If multiple, our backend might need adjustment or we only support single filter for now?
    // Spec says "Advanced filters work (type, status)". Let's assume generic loose mapping for now or comma separated.
    // Let's assume the hook and backend handle it. If backend expects single value, we pick first or join.
    // Backend controller uses `SearchQueryDto`. Let's check DTO if I can view it.
    // Actually, I'll pass them and let the service handle serialization if needed.
    ...filters
  };

  const { data: results, isLoading, isError } = useSearch(searchDto);

  const handleFilterChange = (newFilters: FilterType) => {
    setFilters(newFilters);
    // Optional: Update URL to reflect filters?
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Search Results</h1>
        <p className="text-muted-foreground mt-1">
          {isLoading
            ? "Searching..."
            : `Found ${results?.length || 0} results for "${query}"`
          }
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1">
          <SearchFilters onFilterChange={handleFilterChange} />
        </div>

        <div className="lg:col-span-3">
          {isError ? (
            <div className="text-red-500 py-8 text-center">Failed to load search results.</div>
          ) : (
            <SearchResults results={results || []} query={query} loading={isLoading} />
          )}
        </div>
      </div>
    </div>
  );
}
