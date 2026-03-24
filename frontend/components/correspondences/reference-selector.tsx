'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Search, X, Link2, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import {
  useReferences,
  useAddReference,
  useRemoveReference,
  useCorrespondences,
} from '@/hooks/use-correspondence';

interface LinkedDoc {
  uuid: string;
  correspondenceNumber: string;
}

interface RefItem {
  source?: LinkedDoc;
  target?: LinkedDoc;
}

interface CorrespondenceRevisionItem {
  subject: string;
  correspondence?: { uuid: string; correspondenceNumber: string };
}

interface ReferenceSelectorProps {
  uuid: string;
  canEdit: boolean;
}

export function ReferenceSelector({ uuid, canEdit }: ReferenceSelectorProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  const { data: referencesData, isLoading: isLoadingRefs } = useReferences(uuid);
  const addMutation = useAddReference();
  const removeMutation = useRemoveReference();

  const { data: searchResults, isFetching: isSearchFetching } = useCorrespondences(
    isSearching && searchQuery.trim().length >= 2
      ? { search: searchQuery.trim(), limit: 8 }
      : { search: '', limit: 0 }
  );

  const outgoing: RefItem[] = referencesData?.outgoing ?? [];
  const incoming: RefItem[] = referencesData?.incoming ?? [];
  const totalCount = outgoing.length + incoming.length;

  const searchItems = Array.isArray(searchResults?.data)
    ? searchResults.data
    : [];

  const existingRefUuids = new Set([
    ...outgoing.map((r) => r.target?.uuid).filter(Boolean),
    ...incoming.map((r) => r.source?.uuid).filter(Boolean),
  ]);

  const handleAdd = (targetUuid: string) => {
    addMutation.mutate({ uuid, targetUuid });
    setIsSearching(false);
    setSearchQuery('');
  };

  const handleRemove = (targetUuid: string) => {
    removeMutation.mutate({ uuid, targetUuid });
  };

  const renderRef = (linked: LinkedDoc, direction: 'out' | 'in') => (
    <div
      key={linked.uuid}
      className="flex items-center justify-between gap-2 p-2 bg-muted/40 rounded-md text-sm"
    >
      <div className="flex items-center gap-2 min-w-0">
        <span className={`text-[10px] font-semibold px-1 py-0.5 rounded shrink-0 ${direction === 'out' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
          {direction === 'out' ? 'REF' : 'FROM'}
        </span>
        <Link
          href={`/correspondences/${linked.uuid}`}
          className="font-mono font-medium hover:underline truncate text-xs"
        >
          {linked.correspondenceNumber}
        </Link>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <Link href={`/correspondences/${linked.uuid}`} target="_blank">
          <Button variant="ghost" size="icon" className="h-6 w-6">
            <ExternalLink className="h-3 w-3" />
          </Button>
        </Link>
        {canEdit && direction === 'out' && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground hover:text-destructive"
            onClick={() => handleRemove(linked.uuid)}
            disabled={removeMutation.isPending}
          >
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>
    </div>
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Link2 className="h-4 w-4" />
          Referenced Documents
          {totalCount > 0 && (
            <Badge variant="secondary" className="ml-auto text-xs">
              {totalCount}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoadingRefs ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            Loading references...
          </div>
        ) : totalCount === 0 ? (
          <p className="text-sm text-muted-foreground">No referenced documents</p>
        ) : (
          <div className="space-y-2">
            {outgoing.map((r) => r.target && renderRef(r.target, 'out'))}
            {incoming.map((r) => r.source && renderRef(r.source, 'in'))}
          </div>
        )}

        {canEdit && (
          <div className="pt-2 border-t space-y-2">
            {isSearching ? (
              <>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      autoFocus
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search by number or subject..."
                      className="pl-7 h-8 text-sm"
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8"
                    onClick={() => { setIsSearching(false); setSearchQuery(''); }}
                  >
                    Cancel
                  </Button>
                </div>

                {searchQuery.trim().length >= 2 && (
                  <div className="border rounded-md divide-y max-h-48 overflow-y-auto">
                    {isSearchFetching ? (
                      <div className="flex items-center gap-2 p-3 text-sm text-muted-foreground">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Searching...
                      </div>
                    ) : searchItems.length === 0 ? (
                      <p className="p-3 text-sm text-muted-foreground">No results found</p>
                    ) : (
                      searchItems
                        .filter((item: CorrespondenceRevisionItem) => {
                          const itemUuid = item.correspondence?.uuid;
                          return itemUuid && itemUuid !== uuid && !existingRefUuids.has(itemUuid);
                        })
                        .map((item: CorrespondenceRevisionItem) => (
                          <button
                            key={item.correspondence?.uuid}
                            className="w-full flex items-center justify-between gap-2 p-2.5 text-sm hover:bg-muted/60 transition-colors text-left"
                            onClick={() => handleAdd(item.correspondence!.uuid)}
                            disabled={addMutation.isPending}
                          >
                            <span className="font-mono font-medium text-xs">
                              {item.correspondence?.correspondenceNumber}
                            </span>
                            <span className="text-muted-foreground truncate flex-1 ml-2">
                              {item.subject}
                            </span>
                          </button>
                        ))
                    )}
                  </div>
                )}
              </>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="w-full h-8 text-xs"
                onClick={() => setIsSearching(true)}
              >
                <Search className="h-3 w-3 mr-1.5" />
                Add Reference Document
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

