'use client';

import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { FileText, Clipboard, Image, Loader2 } from 'lucide-react';
import { SearchResult } from '@/types/search';
import { format } from 'date-fns';
import DOMPurify from 'dompurify';

/** SEV-007: Sanitize HTML highlight — อนุญาตเฉพาะ <em>, <strong> tags เท่านั้น */
function sanitizeHighlight(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['em', 'strong'],
    ALLOWED_ATTR: [],
  });
}

interface SearchResultsProps {
  results: SearchResult[];
  query: string;
  loading: boolean;
}

const TYPE_META: Record<string, { icon: React.ElementType; label: string; color: string }> = {
  correspondence: { icon: FileText, label: 'Correspondence', color: 'text-info' },
  rfa: { icon: Clipboard, label: 'RFA', color: 'text-ai' },
  drawing: { icon: Image, label: 'Drawing', color: 'text-success' },
};

const STATUS_VARIANT: Record<string, string> = {
  DRAFT: 'bg-muted text-foreground',
  SUBOWN: 'bg-warning/10 text-warning',
  CLBOWN: 'bg-success/10 text-success',
  CCBOWN: 'bg-destructive/10 text-destructive',
  CANCELLED: 'bg-muted text-muted-foreground line-through',
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
        const statusClass = STATUS_VARIANT[result.status] ?? 'bg-muted text-foreground';
        const statusLabel = STATUS_LABEL[result.status] ?? result.status;

        return (
          <Card
            key={`${result.type}-${result.publicId ?? index}`}
            className="group px-5 py-4 transition-shadow hover:shadow-md"
          >
            <Link href={getLink(result)}>
              <div className="flex gap-4">
                <div className={`mt-0.5 flex-shrink-0 ${meta.color}`}>
                  <Icon className="h-5 w-5" />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex flex-wrap items-start gap-2">
                    <span className="shrink-0 font-mono text-xs text-muted-foreground">{result.documentNumber}</span>
                    <Badge variant="secondary" className={`shrink-0 px-1.5 py-0 text-xs ${statusClass}`}>
                      {statusLabel}
                    </Badge>
                    <Badge variant="outline" className="shrink-0 px-1.5 py-0 text-xs">
                      {meta.label}
                    </Badge>
                  </div>

                  <h3
                    className="line-clamp-1 text-sm font-semibold transition-colors group-hover:text-primary"
                    dangerouslySetInnerHTML={{
                      __html: sanitizeHighlight(result.highlight || result.title),
                    }}
                  />

                  {result.description && (
                    <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{result.description}</p>
                  )}

                  <p className="mt-1 text-xs text-muted-foreground">
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
