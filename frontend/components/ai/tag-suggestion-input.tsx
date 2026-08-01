'use client';

// File: frontend/components/ai/tag-suggestion-input.tsx
// Change Log:
// - 2026-07-31: Initial creation — Pipeline B tag suggestion UI (ADR-023 D5)
//   แสดง suggestedTags จาก AI พร้อม isNew flag + manual add/remove

import { useState } from 'react';
import { X, Plus, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { SuggestedTag } from '@/types/ai';

interface TagSuggestionInputProps {
  /** รายการแท็กที่ AI แนะนำ (pre-fill) */
  suggestedTags: SuggestedTag[];
  /** รายการแท็กที่ user เลือกไว้แล้ว (controlled) */
  selectedTags: SuggestedTag[];
  /** Callback เมื่อ selected tags เปลี่ยน */
  onChange: (tags: SuggestedTag[]) => void;
  /** disabled state */
  disabled?: boolean;
}

/**
 * Component สำหรับแสดงและจัดการ AI Tag Suggestions (Pipeline B)
 * - Existing tags (isNew=false): แสดงเป็น chip สีตาม tag
 * - New tags (isNew=true): แสดงเป็น chip สี default + icon "new"
 * - User สามารถ: accept/remove suggested tag, add manual tag
 */
export function TagSuggestionInput({
  suggestedTags,
  selectedTags,
  onChange,
  disabled = false,
}: TagSuggestionInputProps) {
  const [manualTagName, setManualTagName] = useState('');

  const pendingSuggestions = suggestedTags.filter(
    (s) => !selectedTags.some((sel) => sel.name === s.name)
  );

  const acceptSuggestion = (tag: SuggestedTag): void => {
    if (disabled) return;
    if (selectedTags.some((t) => t.name === tag.name)) return;
    onChange([...selectedTags, tag]);
  };

  const removeTag = (tagName: string): void => {
    if (disabled) return;
    onChange(selectedTags.filter((t) => t.name !== tagName));
  };

  const addManualTag = (): void => {
    if (disabled) return;
    const trimmed = manualTagName.trim();
    if (!trimmed) return;
    if (selectedTags.some((t) => t.name === trimmed)) {
      setManualTagName('');
      return;
    }
    onChange([
      ...selectedTags,
      { name: trimmed, isNew: true, confidence: 1.0 },
    ]);
    setManualTagName('');
  };

  return (
    <div className="space-y-3">
      {/* AI Suggested Tags (pending acceptance) */}
      {pendingSuggestions.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Sparkles className="h-3 w-3" />
            AI Suggestions (click to accept)
          </p>
          <div className="flex flex-wrap gap-1.5">
            {pendingSuggestions.map((tag) => (
              <button
                key={tag.name}
                type="button"
                onClick={() => acceptSuggestion(tag)}
                disabled={disabled}
                className={cn(
                  'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs transition-colors',
                  'hover:bg-primary/10 cursor-pointer',
                  tag.isNew
                    ? 'border-amber-300 bg-amber-50 text-amber-700'
                    : 'border-primary/30 bg-primary/5 text-primary',
                  disabled && 'cursor-not-allowed opacity-50'
                )}
              >
                {tag.isNew && <Plus className="h-3 w-3" />}
                {tag.name}
                <span className="text-[10px] opacity-60">
                  {(tag.confidence * 100).toFixed(0)}%
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Selected Tags */}
      {selectedTags.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs text-muted-foreground">Selected Tags</p>
          <div className="flex flex-wrap gap-1.5">
            {selectedTags.map((tag) => (
              <Badge
                key={tag.name}
                variant="secondary"
                className={cn(
                  'gap-1',
                  tag.isNew && !tag.publicId && 'border-amber-300 bg-amber-50 text-amber-700'
                )}
              >
                {tag.isNew && !tag.publicId && (
                  <span className="text-[10px] font-bold">NEW</span>
                )}
                {tag.name}
                {!disabled && (
                  <button
                    type="button"
                    onClick={() => removeTag(tag.name)}
                    className="ml-0.5 rounded-full hover:bg-destructive/20"
                    aria-label={`Remove ${tag.name}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Manual Tag Input */}
      {!disabled && (
        <div className="flex gap-2">
          <Input
            value={manualTagName}
            onChange={(e) => setManualTagName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addManualTag();
              }
            }}
            placeholder="Add tag manually..."
            className="h-8 text-sm"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addManualTag}
            disabled={!manualTagName.trim()}
          >
            <Plus className="h-3 w-3" />
            Add
          </Button>
        </div>
      )}

      {selectedTags.length === 0 && pendingSuggestions.length === 0 && (
        <p className="text-xs text-muted-foreground">No tags yet</p>
      )}
    </div>
  );
}
