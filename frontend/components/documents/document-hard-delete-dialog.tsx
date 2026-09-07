'use client';

// File: components/documents/document-hard-delete-dialog.tsx
// Feature 253 T023: Shared Hard-Delete Dialog — two-tier confirmation + "DELETE" text input

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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useTranslations } from '@/hooks/use-translations';
import { DocumentActionConfig } from './document-action-strategy';

export interface DocumentHardDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  config: DocumentActionConfig;
  documentLabel: string;
  isLoading?: boolean;
  onConfirm: () => void;
}

export function DocumentHardDeleteDialog({
  open,
  onOpenChange,
  config,
  documentLabel,
  isLoading = false,
  onConfirm,
}: DocumentHardDeleteDialogProps) {
  const t = useTranslations();
  const [step, setStep] = useState<1 | 2>(1);
  const [confirmText, setConfirmText] = useState('');

  const canProceed = step === 2 && confirmText === 'DELETE';

  const handleConfirm = () => {
    if (!canProceed) return;
    onConfirm();
    setStep(1);
    setConfirmText('');
    onOpenChange(false);
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setStep(1);
      setConfirmText('');
    }
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-destructive">
            {t('document.hardDelete.title')}
          </DialogTitle>
          <DialogDescription>
            {t('document.hardDelete.confirm')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="rounded-md bg-muted p-3">
            <p className="text-sm font-medium">{t(config.displayName)}</p>
            <p className="text-sm text-muted-foreground">{documentLabel}</p>
          </div>

          {step === 1 && (
            <div className="space-y-2">
              <p className="text-sm text-destructive font-medium">
                {t('document.hardDelete.warning')}
              </p>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setStep(2)}
              >
                {t('document.hardDelete.understand')}
              </Button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-2">
              <Label htmlFor="confirm-delete">
                {t('document.hardDelete.typeDelete')}
              </Label>
              <Input
                id="confirm-delete"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="DELETE"
                className="font-mono"
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            {t('common.cancel')}
          </Button>
          {step === 2 && (
            <Button
              variant="destructive"
              onClick={handleConfirm}
              disabled={!canProceed || isLoading}
            >
              {isLoading
                ? t('common.processing')
                : t('document.hardDelete.confirmAction')}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
