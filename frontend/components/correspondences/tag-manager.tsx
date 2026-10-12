'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Tag as TagIcon, X, Plus, ChevronDown } from 'lucide-react';
import { useCorrespondenceTags, useAddTag, useRemoveTag } from '@/hooks/use-correspondence';
import { useQuery } from '@tanstack/react-query';
import { masterDataService } from '@/lib/services/master-data.service';
import { Tag } from '@/types/master-data';
import { getTagColor } from '@/lib/utils/tag-color';
import { DEFAULT_TAG_COLOR_HEX } from '@/lib/constants/tag-colors';

interface TagManagerProps {
  uuid: string;
  canEdit: boolean;
}

export function TagManager({ uuid, canEdit }: TagManagerProps) {
  const [isOpen, setIsOpen] = useState(false);

  const { data: assignedRaw, isLoading } = useCorrespondenceTags(uuid);
  const { data: allTagsRaw } = useQuery({
    queryKey: ['master', 'tags'],
    queryFn: () => masterDataService.getTags(),
    enabled: isOpen,
  });

  const addMutation = useAddTag();
  const removeMutation = useRemoveTag();

  const assigned: Tag[] = Array.isArray(assignedRaw) ? (assignedRaw as Tag[]) : [];
  const allTags: Tag[] = Array.isArray(allTagsRaw) ? (allTagsRaw as Tag[]) : [];
  const assignedIds = new Set(assigned.map((t) => t.publicId));
  const available = allTags.filter((t) => !assignedIds.has(t.publicId));

  const handleAdd = (tagId: number | string) => {
    addMutation.mutate({ uuid, tagId });
  };

  const handleRemove = (tagId: number | string) => {
    removeMutation.mutate({ uuid, tagId });
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <TagIcon className="h-4 w-4" />
          Tags
          {assigned.length > 0 && (
            <Badge variant="secondary" className="ml-auto text-xs">
              {assigned.length}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            Loading tags...
          </div>
        ) : assigned.length === 0 ? (
          <p className="text-sm text-muted-foreground">No tags assigned</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {assigned.map((tag) => {
              const hex = getTagColor(tag.colorCode);
              return (
                <span
                  key={tag.publicId}
                  className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium"
                  style={{
                    backgroundColor: `${hex}22`,
                    borderColor: `${hex}66`,
                    color: hex === DEFAULT_TAG_COLOR_HEX ? 'inherit' : hex,
                  }}
                >
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: hex }} />
                  {tag.tagName}
                  {canEdit && (
                    <button
                      onClick={() => handleRemove(tag.publicId)}
                      disabled={removeMutation.isPending}
                      className="ml-0.5 opacity-60 transition-opacity hover:opacity-100"
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  )}
                </span>
              );
            })}
          </div>
        )}

        {canEdit && (
          <div className="border-t pt-2">
            {isOpen ? (
              <div className="space-y-2">
                <div className="max-h-40 divide-y overflow-y-auto rounded-md border">
                  {available.length === 0 ? (
                    <p className="p-2 text-center text-xs text-muted-foreground">
                      {allTags.length === 0 ? 'Loading...' : 'All tags already assigned'}
                    </p>
                  ) : (
                    available.map((tag) => (
                      <button
                        key={tag.publicId}
                        className="flex w-full items-center gap-2 p-2 text-left text-xs transition-colors hover:bg-muted/60"
                        onClick={() => {
                          handleAdd(tag.publicId);
                          setIsOpen(false);
                        }}
                        disabled={addMutation.isPending}
                      >
                        <span
                          className="h-2 w-2 shrink-0 rounded-full"
                          style={{ backgroundColor: getTagColor(tag.colorCode) }}
                        />
                        {tag.tagName}
                      </button>
                    ))
                  )}
                </div>
                <Button variant="ghost" size="sm" className="h-7 w-full text-xs" onClick={() => setIsOpen(false)}>
                  <ChevronDown className="mr-1 h-3 w-3" />
                  Close
                </Button>
              </div>
            ) : (
              <Button variant="outline" size="sm" className="h-8 w-full text-xs" onClick={() => setIsOpen(true)}>
                <Plus className="mr-1.5 h-3 w-3" />
                Add Tag
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
