'use client';

import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { SearchFilters } from '@/components/search/filters';
import { SearchResults } from '@/components/search/results';
import { SearchFilters as FilterType } from '@/types/search';
import { useSearch } from '@/hooks/use-search';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const PAGE_SIZE = 20;

function SearchContent() {
  const searchParams = useSearchParams();

  const query = searchParams.get('q') || '';
  const typeParam = searchParams.get('type');
  const statusParam = searchParams.get('status');

  const [filters, setFilters] = useState<FilterType>({
    types: typeParam ? [typeParam] : [],
    statuses: statusParam ? [statusParam] : [],
  });
  const [page, setPage] = useState(1);

  const searchDto = {
    q: query,
    type: filters.types?.length ? filters.types[0] : undefined,
    status: filters.statuses?.length ? filters.statuses[0] : undefined,
    page,
    limit: PAGE_SIZE,
  };

  const { data: results, isLoading, isError } = useSearch(searchDto);

  const total = results?.meta?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const handleFilterChange = (newFilters: FilterType) => {
    setFilters(newFilters);
    setPage(1);
  };

  return (
    <>
      <div>
        <h1 className="text-3xl font-bold">Search Results</h1>
        <p className="text-muted-foreground mt-1">
          {isLoading
            ? 'Searching...'
            : `Found ${total} results${query ? ` for "${query}"` : ''}`}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1">
          <SearchFilters filters={filters} onFilterChange={handleFilterChange} />
        </div>

        <div className="lg:col-span-3 space-y-4">
          {isError ? (
            <div className="text-red-500 py-8 text-center">Failed to load search results.</div>
          ) : (
            <>
              <SearchResults results={results?.data || []} query={query} loading={isLoading} />

              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-2">
                  <span className="text-sm text-muted-foreground">
                    Page {page} of {totalPages}
                  </span>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page === 1}
                      onClick={() => setPage((p) => p - 1)}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Prev
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page >= totalPages}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}

export default function SearchPage() {
  return (
    <div className="space-y-6">
      <Suspense
        fallback={
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        }
      >
        <SearchContent />
      </Suspense>
    </div>
  );
}
