import { useQuery } from '@tanstack/react-query';
import { searchService } from '@/lib/services/search.service';
import { SearchQueryDto } from '@/types/dto/search/search-query.dto';

export const searchKeys = {
  all: ['search'] as const,
  results: (query: SearchQueryDto) => [...searchKeys.all, 'results', query] as const,
  suggestions: (query: string) => [...searchKeys.all, 'suggestions', query] as const,
};

export function useSearch(query: SearchQueryDto) {
  return useQuery({
    queryKey: searchKeys.results(query),
    queryFn: () => searchService.search(query),
    enabled: !!query.q || Object.keys(query).length > 0,
    placeholderData: (previousData) => previousData,
  });
}

export function useSearchSuggestions(query: string) {
  return useQuery({
    queryKey: searchKeys.suggestions(query),
    queryFn: () => searchService.suggest(query),
    enabled: query.length > 2,
    staleTime: 60 * 1000, // Cache suggestions for 1 minute
  });
}
