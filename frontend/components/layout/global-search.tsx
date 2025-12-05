"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Search, FileText, Clipboard, Image } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Command, CommandEmpty, CommandGroup, CommandItem, CommandList,
 } from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { searchApi } from "@/lib/api/search";
import { SearchResult } from "@/types/search";
import { useDebounce } from "@/hooks/use-debounce"; // We need to create this hook or implement debounce inline

// Simple debounce hook implementation inline for now if not exists
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
  const [suggestions, setSuggestions] = useState<SearchResult[]>([]);

  const debouncedQuery = useDebounceValue(query, 300);

  useEffect(() => {
    if (debouncedQuery.length > 2) {
      searchApi.suggest(debouncedQuery).then(setSuggestions);
      setOpen(true);
    } else {
      setSuggestions([]);
      if (debouncedQuery.length === 0) setOpen(false);
    }
  }, [debouncedQuery]);

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
      <Popover open={open && suggestions.length > 0} onOpenChange={setOpen}>
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
                if (suggestions.length > 0) setOpen(true);
              }}
            />
          </div>
        </PopoverTrigger>
        <PopoverContent className="p-0 w-[var(--radix-popover-trigger-width)]" align="start">
          <Command>
            <CommandList>
              <CommandGroup heading="Suggestions">
                {suggestions.map((item) => (
                  <CommandItem
                    key={`${item.type}-${item.id}`}
                    onSelect={() => {
                      setQuery(item.title);
                      router.push(`/${item.type}s/${item.id}`);
                      setOpen(false);
                    }}
                  >
                    {getIcon(item.type)}
                    <span>{item.title}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
