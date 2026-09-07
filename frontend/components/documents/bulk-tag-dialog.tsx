'use client';

// File: components/documents/bulk-tag-dialog.tsx
// Feature 253 T088: Bulk tag dialog — comma-separated tag IDs to add/remove
// - 2026-09-07: Change onConfirm to number[] (tag IDs are integer FKs) (Code Review L1)

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useTranslations } from '@/hooks/use-translations';

export interface BulkTagDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCount: number;
  isLoading?: boolean;
  onConfirm: (addTags: number[], removeTags: number[]) => void;
}

export function BulkTagDialog({
  open,
  onOpenChange,
  selectedCount,
  isLoading = false,
  onConfirm,
}: BulkTagDialogProps) {
  const t = useTranslations();
  const [addTags, setAddTags] = useState('');
  const [removeTags, setRemoveTags] = useState('');

  const handleConfirm = () => {
    const add = addTags
      .split(',')
      .map((s) => Number(s.trim()))
      .filter((n) => !Number.isNaN(n) && n > 0);
    const remove = removeTags
      .split(',')
      .map((s) => Number(s.trim()))
      .filter((n) => !Number.isNaN(n) && n > 0);
    onConfirm(add, remove);
    setAddTags('');
    setRemoveTags('');
    onOpenChange(false);
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setAddTags('');
      setRemoveTags('');
    }
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('document.bulk.tagDialog.title')}</DialogTitle>
          <DialogDescription>
            {t('document.bulk.tagDialog.description', { count: selectedCount })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="add-tags">{t('document.bulk.tagDialog.addTags')}</Label>
            <Input
              id="add-tags"
              placeholder={t('document.bulk.tagDialog.addTagsPlaceholder')}
              value={addTags}
              onChange={(e) => setAddTags(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="remove-tags">{t('document.bulk.tagDialog.removeTags')}</Label>
            <Input
              id="remove-tags"
              placeholder={t('document.bulk.tagDialog.removeTagsPlaceholder')}
              value={removeTags}
              onChange={(e) => setRemoveTags(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleConfirm} disabled={isLoading}>
            {isLoading ? t('common.processing') : t('document.bulk.tagDialog.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
