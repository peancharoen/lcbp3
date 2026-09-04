// File: frontend/components/ai/ai-unavailable-wait-dialog.tsx
// Change Log:
// - 2026-09-04: Two-Phase Batch OCR/AI Extraction (D267) — modal shown when a request fails
//   with AI_FEATURES_UNAVAILABLE (503) while a legacy batch OCR phase holds the main model.
//   Gives the user an explicit Wait/Cancel choice instead of a silent cold-start delay or a
//   generic error bubble. Shared by useAiChat and the RAG Sandbox Playground.
'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { useTranslations } from '@/hooks/use-translations';

interface AiUnavailableWaitDialogProps {
  open: boolean;
  isRetrying: boolean;
  elapsedSeconds: number;
  onWait: () => void;
  onCancel: () => void;
}

export function AiUnavailableWaitDialog({
  open,
  isRetrying,
  elapsedSeconds,
  onWait,
  onCancel,
}: AiUnavailableWaitDialogProps) {
  const t = useTranslations();

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onCancel();
      }}
    >
      <DialogContent
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>{t('ai.unavailable.title')}</DialogTitle>
          <DialogDescription>{t('ai.unavailable.description')}</DialogDescription>
        </DialogHeader>
        {isRetrying ? (
          <div className="flex items-center justify-center gap-2 py-4 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            <span>
              {t('ai.unavailable.retrying', { seconds: elapsedSeconds })}
            </span>
          </div>
        ) : null}
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            {t('ai.unavailable.cancel')}
          </Button>
          {!isRetrying ? (
            <Button onClick={onWait}>{t('ai.unavailable.wait')}</Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
