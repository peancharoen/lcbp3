"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Search, FileText, Clipboard, Image, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Command, CommandGroup, CommandItem, CommandList,
 } from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useSearchSuggestions } from "@/hooks/use-search";

function useDebounceValue<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);
  return debouncedValue;
}

export function GlobalSearch() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const debouncedQuery = useDebounceValue(query, 300);

  const { data: suggestions, isLoading } = useSearchSuggestions(debouncedQuery);

  useEffect(() => {
    if (debouncedQuery.length > 2 && suggestions && suggestions.length > 0) {
      setOpen(true);
    } else {
      if (debouncedQuery.length === 0) setOpen(false);
    }
  }, [debouncedQuery, suggestions]);

  const handleSearch = () => {
    if (query.trim()) {
      router.push(`/search?q=${encodeURIComponent(query)}`);
      setOpen(false);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case "correspondence": return <FileText className="mr-2 h-4 w-4" />;
      case "rfa": return <Clipboard className="mr-2 h-4 w-4" />;
      case "drawing": return <Image className="mr-2 h-4 w-4" />;
      default: return <Search className="mr-2 h-4 w-4" />;
    }
  };

  return (
    <div className="relative w-full max-w-sm">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search documents..."
              className="pl-8 w-full bg-background"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              onFocus={() => {
                if (suggestions && suggestions.length > 0) setOpen(true);
              }}
            />
            {isLoading && (
              <Loader2 className="absolute right-2.5 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />
            )}
          </div>
        </PopoverTrigger>
        <PopoverContent className="p-0 w-[var(--radix-popover-trigger-width)]" align="start" onOpenAutoFocus={(e) => e.preventDefault()}>
          <Command>
            <CommandList>
              {suggestions && suggestions.length > 0 && (
                <CommandGroup heading="Suggestions">
                  {suggestions.map((item: any) => (
                    <CommandItem
                      key={`${item.type}-${item.id}`}
                      onSelect={() => {
                        setQuery(item.title);
                        // Assumption: item has type and id.
                        // If type is missing, we might need a map or check usage in backend response
                        router.push(`/${item.type}s/${item.id}`);
                        setOpen(false);
                      }}
                    >
                      {getIcon(item.type)}
                      <span className="truncate">{item.title}</span>
                      <span className="ml-auto text-xs text-muted-foreground">{item.documentNumber}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
              {(!suggestions || suggestions.length === 0) && !isLoading && (
                  <div className="py-6 text-center text-sm text-muted-foreground">
                    No suggestions found.
                  </div>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
