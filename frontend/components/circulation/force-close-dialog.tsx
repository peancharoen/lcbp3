'use client';

// File: frontend/components/circulation/force-close-dialog.tsx
// Feature 253 T114: Circulation force-close dialog with reason input

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
import { Textarea } from '@/components/ui/textarea';
import { useTranslations } from '@/hooks/use-translations';

export interface ForceCloseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentLabel?: string;
  isLoading?: boolean;
  onConfirm: (reason: string) => void;
}

export function ForceCloseDialog({
  open,
  onOpenChange,
  documentLabel,
  isLoading = false,
  onConfirm,
}: ForceCloseDialogProps) {
  const t = useTranslations();
  const [reason, setReason] = useState('');

  const handleConfirm = () => {
    onConfirm(reason.trim());
    setReason('');
    onOpenChange(false);
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) setReason('');
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('circulation.forceClose.title')}</DialogTitle>
          <DialogDescription>{t('circulation.forceClose.confirm')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {documentLabel && (
            <div className="rounded-md bg-muted p-3">
              <p className="text-sm text-muted-foreground">{documentLabel}</p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="force-close-reason">{t('circulation.forceClose.reasonLabel')}</Label>
            <Textarea
              id="force-close-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            {t('common.cancel')}
          </Button>
          <Button variant="destructive" onClick={handleConfirm} disabled={isLoading}>
            {isLoading ? t('common.processing') : t('common.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
