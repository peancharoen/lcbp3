'use client';

// File: components/documents/document-cancel-dialog.tsx
// Feature 253 T022: Shared Cancel Dialog — reason input + warning + type-specific label

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
import { DocumentActionConfig } from './document-action-strategy';

export interface DocumentCancelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  config: DocumentActionConfig;
  documentLabel: string;
  isLoading?: boolean;
  onConfirm: (reason: string) => void;
}

export function DocumentCancelDialog({
  open,
  onOpenChange,
  config,
  documentLabel,
  isLoading = false,
  onConfirm,
}: DocumentCancelDialogProps) {
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
          <DialogTitle>{t(config.confirmKey)}</DialogTitle>
          <DialogDescription>
            {t('document.cancel.confirm')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="rounded-md bg-muted p-3">
            <p className="text-sm font-medium">{t(config.displayName)}</p>
            <p className="text-sm text-muted-foreground">{documentLabel}</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="cancel-reason">
              {t('document.cancel.reason')}
            </Label>
            <Textarea
              id="cancel-reason"
              placeholder={t('document.cancel.reasonPlaceholder')}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            {t('common.cancel')}
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={isLoading}
          >
            {isLoading ? t('common.processing') : t('document.cancel.confirmAction')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
