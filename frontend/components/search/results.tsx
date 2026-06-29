'use client';

import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { FileText, Clipboard, Image, Loader2 } from 'lucide-react';
import { SearchResult } from '@/types/search';
import { format } from 'date-fns';

interface SearchResultsProps {
  results: SearchResult[];
  query: string;
  loading: boolean;
}

const TYPE_META: Record<string, { icon: React.ElementType; label: string; color: string }> = {
  correspondence: { icon: FileText, label: 'Correspondence', color: 'text-blue-600' },
  rfa: { icon: Clipboard, label: 'RFA', color: 'text-purple-600' },
  drawing: { icon: Image, label: 'Drawing', color: 'text-green-600' },
};

const STATUS_VARIANT: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-700',
  SUBOWN: 'bg-yellow-100 text-yellow-700',
  CLBOWN: 'bg-green-100 text-green-700',
  CCBOWN: 'bg-red-100 text-red-700',
  CANCELLED: 'bg-slate-100 text-slate-500 line-through',
};

const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Draft',
  SUBOWN: 'Submitted',
  CLBOWN: 'Approved',
  CCBOWN: 'Rejected',
  CANCELLED: 'Cancelled',
};

function getLink(result: SearchResult): string {
  if (result.type === 'drawing') return `/drawings/${result.publicId}`;
  return `/${result.type}s/${result.publicId}`;
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
        {query ? `No results found for "${query}"` : 'Enter a search term to start'}
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {results.map((result, index) => {
        const meta = TYPE_META[result.type] ?? TYPE_META.correspondence;
        const Icon = meta.icon;
        const statusClass = STATUS_VARIANT[result.status] ?? 'bg-gray-100 text-gray-700';
        const statusLabel = STATUS_LABEL[result.status] ?? result.status;

        return (
          <Card
            key={`${result.type}-${result.publicId ?? index}`}
            className="px-5 py-4 hover:shadow-md transition-shadow group"
          >
            <Link href={getLink(result)}>
              <div className="flex gap-4">
                <div className={`flex-shrink-0 mt-0.5 ${meta.color}`}>
                  <Icon className="h-5 w-5" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start gap-2 flex-wrap mb-1">
                    <span className="text-xs font-mono text-muted-foreground shrink-0">
                      {result.documentNumber}
                    </span>
                    <Badge
                      variant="secondary"
                      className={`text-xs px-1.5 py-0 shrink-0 ${statusClass}`}
                    >
                      {statusLabel}
                    </Badge>
                    <Badge variant="outline" className="text-xs px-1.5 py-0 shrink-0">
                      {meta.label}
                    </Badge>
                  </div>

                  <h3
                    className="text-sm font-semibold group-hover:text-primary transition-colors line-clamp-1"
                    dangerouslySetInnerHTML={{ __html: result.highlight || result.title }}
                  />

                  {result.description && (
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                      {result.description}
                    </p>
                  )}

                  <p className="text-xs text-muted-foreground mt-1">
                    {format(new Date(result.createdAt), 'dd MMM yyyy')}
                  </p>
                </div>
              </div>
            </Link>
          </Card>
        );
      })}
    </div>
  );
}
