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
        <CardTitle className="text-base flex items-center gap-2">
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
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border"
                style={{
                  backgroundColor: `${hex}22`,
                  borderColor: `${hex}66`,
                  color: hex === DEFAULT_TAG_COLOR_HEX ? 'inherit' : hex,
                }}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ backgroundColor: hex }}
                />
                {tag.tagName}
                {canEdit && (
                  <button
                    onClick={() => handleRemove(tag.publicId)}
                    disabled={removeMutation.isPending}
                    className="ml-0.5 opacity-60 hover:opacity-100 transition-opacity"
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
          <div className="pt-2 border-t">
            {isOpen ? (
              <div className="space-y-2">
                <div className="max-h-40 overflow-y-auto border rounded-md divide-y">
                  {available.length === 0 ? (
                    <p className="p-2 text-xs text-muted-foreground text-center">
                      {allTags.length === 0 ? 'Loading...' : 'All tags already assigned'}
                    </p>
                  ) : (
                    available.map((tag) => (
                      <button
                        key={tag.publicId}
                        className="w-full flex items-center gap-2 p-2 text-xs hover:bg-muted/60 transition-colors text-left"
                        onClick={() => { handleAdd(tag.publicId); setIsOpen(false); }}
                        disabled={addMutation.isPending}
                      >
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: getTagColor(tag.colorCode) }}
                        />
                        {tag.tagName}
                      </button>
                    ))
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full h-7 text-xs"
                  onClick={() => setIsOpen(false)}
                >
                  <ChevronDown className="h-3 w-3 mr-1" />
                  Close
                </Button>
              </div>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="w-full h-8 text-xs"
                onClick={() => setIsOpen(true)}
              >
                <Plus className="h-3 w-3 mr-1.5" />
                Add Tag
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
