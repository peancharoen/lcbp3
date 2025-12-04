"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { SearchFilters } from "@/components/search/filters";
import { SearchResults } from "@/components/search/results";
import { searchApi } from "@/lib/api/search";
import { SearchResult, SearchFilters as FilterType } from "@/types/search";

export default function SearchPage() {
  const searchParams = useSearchParams();
  const query = searchParams.get("q") || "";
  const [results, setResults] = useState<SearchResult[]>([]);
  const [filters, setFilters] = useState<FilterType>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchResults = async () => {
      setLoading(true);
      try {
        const data = await searchApi.search({ query, ...filters });
        setResults(data);
      } catch (error) {
        console.error("Search failed", error);
      } finally {
        setLoading(false);
      }
    };

    fetchResults();
  }, [query, filters]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Search Results</h1>
        <p className="text-muted-foreground mt-1">
          {loading
            ? "Searching..."
            : `Found ${results.length} results for "${query}"`
          }
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1">
          <SearchFilters onFilterChange={setFilters} />
        </div>

        <div className="lg:col-span-3">
          <SearchResults results={results} query={query} loading={loading} />
        </div>
      </div>
    </div>
  );
}
