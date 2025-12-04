"use client";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { FileText, Clipboard, Image, Loader2 } from "lucide-react";
import { SearchResult } from "@/types/search";
import { format } from "date-fns";

interface SearchResultsProps {
  results: SearchResult[];
  query: string;
  loading: boolean;
}

export function SearchResults({ results, query, loading }: SearchResultsProps) {
  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <Card className="p-12 text-center text-muted-foreground">
        {query ? `No results found for "${query}"` : "Enter a search term to start"}
      </Card>
    );
  }

  const getIcon = (type: string) => {
    switch (type) {
      case "correspondence":
        return FileText;
      case "rfa":
        return Clipboard;
      case "drawing":
        return Image;
      default:
        return FileText;
    }
  };

  const getLink = (result: SearchResult) => {
    return `/${result.type}s/${result.id}`; // Assuming routes are plural (correspondences, rfas, drawings)
  };

  return (
    <div className="space-y-4">
      {results.map((result, index) => {
        const Icon = getIcon(result.type);

        return (
          <Card
            key={`${result.type}-${result.id}-${index}`}
            className="p-6 hover:shadow-md transition-shadow group"
          >
            <Link href={getLink(result)}>
              <div className="flex gap-4">
                <div className="flex-shrink-0 mt-1">
                  <Icon className="h-6 w-6 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>

                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2 flex-wrap">
                    <h3
                      className="text-lg font-semibold group-hover:text-primary transition-colors"
                      dangerouslySetInnerHTML={{
                        __html: result.highlight || result.title
                      }}
                    />
                    <Badge variant="secondary" className="capitalize">{result.type}</Badge>
                    <Badge variant="outline">{result.status}</Badge>
                  </div>

                  <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                    {result.description}
                  </p>

                  <div className="flex gap-4 text-xs text-muted-foreground">
                    <span className="font-medium">{result.documentNumber}</span>
                    <span>•</span>
                    <span>
                      {format(new Date(result.createdAt), "dd MMM yyyy")}
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
