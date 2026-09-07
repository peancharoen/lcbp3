'use client';

// File: components/documents/bulk-action-bar.tsx
// Feature 253 T026: Floating Bulk Action Bar — count + bulk action buttons

import { Button } from '@/components/ui/button';
import { useTranslations } from '@/hooks/use-translations';
import { X } from 'lucide-react';

export interface BulkActionBarProps {
  selectedCount: number;
  onBulkCancel: () => void;
  onBulkTag: () => void;
  onBulkExport: () => void;
  onClear: () => void;
  isLoading?: boolean;
}

export function BulkActionBar({
  selectedCount,
  onBulkCancel,
  onBulkTag,
  onBulkExport,
  onClear,
  isLoading = false,
}: BulkActionBarProps) {
  const t = useTranslations();

  if (selectedCount === 0) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-lg border bg-background px-4 py-3 shadow-lg">
      <span className="text-sm font-medium">
        {t('document.bulk.selected', { count: selectedCount })}
      </span>

      <div className="h-4 w-px bg-border" />

      <Button
        variant="outline"
        size="sm"
        onClick={onBulkExport}
        disabled={isLoading}
      >
        {t('document.bulk.export')}
      </Button>

      <Button
        variant="outline"
        size="sm"
        onClick={onBulkTag}
        disabled={isLoading}
      >
        {t('document.bulk.tag')}
      </Button>

      <Button
        variant="destructive"
        size="sm"
        onClick={onBulkCancel}
        disabled={isLoading}
      >
        {t('document.bulk.cancel')}
      </Button>

      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6"
        onClick={onClear}
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}
