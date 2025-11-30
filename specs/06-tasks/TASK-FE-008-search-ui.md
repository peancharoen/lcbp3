# TASK-FE-008: Search & Global Filters UI

**ID:** TASK-FE-008
**Title:** Global Search, Advanced Filters & Results UI
**Category:** Supporting Features
**Priority:** P2 (Medium)
**Effort:** 3-4 days
**Dependencies:** TASK-FE-003, TASK-BE-010
**Assigned To:** Frontend Developer

---

## 📋 Overview

Implement global search functionality with advanced filters, faceted search, and unified results display across all document types.

---

## 🎯 Objectives

1. Create global search bar in header
2. Build advanced search page with filters
3. Implement faceted search (by type, status, date)
4. Create unified results display
5. Add search suggestions/autocomplete
6. Implement search history

---

## ✅ Acceptance Criteria

- [ ] Global search accessible from header
- [ ] Advanced filters work (type, status, date range, organization)
- [ ] Results show across all document types
- [ ] Search suggestions appear as user types
- [ ] Search history saved locally
- [ ] Results paginated with highlighting

---

## 🔧 Implementation Steps

### Step 1: Global Search Component in Header

```typescript
// File: src/components/layout/global-search.tsx
'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useDebounce } from '@/hooks/use-debounce';
import { searchApi } from '@/lib/api/search';

export function GlobalSearch() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);

  const debouncedQuery = useDebounce(query, 300);

  // Fetch suggestions
  useEffect(() => {
    if (debouncedQuery.length > 2) {
      searchApi.suggest(debouncedQuery).then(setSuggestions);
    }
  }, [debouncedQuery]);

  const handleSearch = () => {
    if (query.trim()) {
      router.push(`/search?q=${encodeURIComponent(query)}`);
      setOpen(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div className="relative w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search documents..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="pl-9"
          />
        </div>
      </PopoverTrigger>

      <PopoverContent className="w-96 p-0" align="start">
        <Command>
          <CommandList>
            {suggestions.length === 0 ? (
              <CommandEmpty>No results found</CommandEmpty>
            ) : (
              <CommandGroup heading="Suggestions">
                {suggestions.map((item: any) => (
                  <CommandItem
                    key={item.id}
                    onSelect={() => {
                      setQuery(item.title);
                      router.push(`/${item.type}s/${item.id}`);
                      setOpen(false);
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-gray-500">{item.type}</span>
                      <span>{item.title}</span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
```

### Step 2: Advanced Search Page

```typescript
// File: src/app/(dashboard)/search/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { SearchFilters } from '@/components/search/filters';
import { SearchResults } from '@/components/search/results';
import { searchApi } from '@/lib/api/search';

export default function SearchPage() {
  const searchParams = useSearchParams();
  const query = searchParams.get('q') || '';
  const [results, setResults] = useState([]);
  const [filters, setFilters] = useState({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (query) {
      setLoading(true);
      searchApi
        .search({ query, ...filters })
        .then(setResults)
        .finally(() => setLoading(false));
    }
  }, [query, filters]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Search Results</h1>
        <p className="text-gray-600 mt-1">
          Found {results.length} results for "{query}"
        </p>
      </div>

      <div className="grid grid-cols-4 gap-6">
        <div className="col-span-1">
          <SearchFilters onFilterChange={setFilters} />
        </div>

        <div className="col-span-3">
          <SearchResults results={results} query={query} loading={loading} />
        </div>
      </div>
    </div>
  );
}
```

### Step 3: Search Filters Component

```typescript
// File: src/components/search/filters.tsx
'use client';

import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';

export function SearchFilters({
  onFilterChange,
}: {
  onFilterChange: (filters: any) => void;
}) {
  const [filters, setFilters] = useState({
    types: [],
    statuses: [],
    dateFrom: null,
    dateTo: null,
  });

  const handleFilterChange = (key: string, value: any) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    onFilterChange(newFilters);
  };

  return (
    <Card className="p-4 space-y-6">
      <div>
        <h3 className="font-semibold mb-3">Document Type</h3>
        <div className="space-y-2">
          {['Correspondence', 'RFA', 'Drawing', 'Transmittal'].map((type) => (
            <label key={type} className="flex items-center gap-2">
              <Checkbox
                checked={filters.types.includes(type)}
                onCheckedChange={(checked) => {
                  const newTypes = checked
                    ? [...filters.types, type]
                    : filters.types.filter((t) => t !== type);
                  handleFilterChange('types', newTypes);
                }}
              />
              <span className="text-sm">{type}</span>
            </label>
          ))}
        </div>
      </div>

      <div>
        <h3 className="font-semibold mb-3">Status</h3>
        <div className="space-y-2">
          {['Draft', 'Pending', 'Approved', 'Rejected'].map((status) => (
            <label key={status} className="flex items-center gap-2">
              <Checkbox />
              <span className="text-sm">{status}</span>
            </label>
          ))}
        </div>
      </div>

      <div>
        <h3 className="font-semibold mb-3">Date Range</h3>
        <div className="space-y-2">
          <div>
            <Label className="text-xs">From</Label>
            <Calendar mode="single" />
          </div>
        </div>
      </div>

      <Button
        variant="outline"
        className="w-full"
        onClick={() => {
          setFilters({ types: [], statuses: [], dateFrom: null, dateTo: null });
          onFilterChange({});
        }}
      >
        Clear Filters
      </Button>
    </Card>
  );
}
```

### Step 4: Search Results Component

```typescript
// File: src/components/search/results.tsx
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { FileText, Clipboard, Image } from 'lucide-react';

export function SearchResults({ results, query, loading }: any) {
  if (loading) {
    return <div>Loading...</div>;
  }

  if (results.length === 0) {
    return (
      <Card className="p-12 text-center text-gray-500">
        No results found for "{query}"
      </Card>
    );
  }

  const getIcon = (type: string) => {
    switch (type) {
      case 'correspondence':
        return FileText;
      case 'rfa':
        return Clipboard;
      case 'drawing':
        return Image;
      default:
        return FileText;
    }
  };

  return (
    <div className="space-y-4">
      {results.map((result: any) => {
        const Icon = getIcon(result.type);

        return (
          <Card
            key={result.id}
            className="p-6 hover:shadow-md transition-shadow"
          >
            <Link href={`/${result.type}s/${result.id}`}>
              <div className="flex gap-4">
                <div className="flex-shrink-0">
                  <Icon className="h-6 w-6 text-gray-400" />
                </div>

                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold hover:text-primary">
                      {result.title}
                    </h3>
                    <Badge>{result.type}</Badge>
                    <Badge variant="outline">{result.status}</Badge>
                  </div>

                  <p className="text-sm text-gray-600 mb-2">
                    {result.highlight || result.description}
                  </p>

                  <div className="flex gap-4 text-xs text-gray-500">
                    <span>{result.documentNumber}</span>
                    <span>•</span>
                    <span>
                      {new Date(result.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>
            </Link>
          </Card>
        );
      })}
    </div>
  );
}
```

---

## 📦 Deliverables

- [ ] Global search component in header
- [ ] Advanced search page
- [ ] Filters panel (type, status, date)
- [ ] Results display with highlighting
- [ ] Search suggestions/autocomplete
- [ ] Mobile responsive design

---

## 🔗 Related Documents

- [TASK-BE-010: Search & Elasticsearch](./TASK-BE-010-search-elasticsearch.md)

---

**Created:** 2025-12-01
**Status:** Ready
