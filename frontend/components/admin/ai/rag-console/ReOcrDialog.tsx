// File: frontend/components/admin/ai/rag-console/ReOcrDialog.tsx
// Change Log:
// - 2026-09-19: ADR-055 T026/T031 — full-screen dialog 3 phase (เลือก engine → รอ job → เปรียบเทียบ) + resume-by-click
//   + failed view (retry ด้วย engine ใดก็ได้ = trigger ใหม่ ไม่มี silent fallback) + AlertDialog confirm (D16)

'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useReOcrConfirm, useReOcrStatus, useReOcrTrigger } from '@/hooks/ai/use-re-ocr';
import type { ReOcrTriggerResponse, ReOcrEngine } from '@/lib/services/re-ocr.service';
import { ReOcrDiffView } from './ReOcrDiffView';
import { useRagAdminT } from './rag-admin-i18n';

export interface ReOcrDialogProps {
  attachmentPublicId: string;
  originalFilename: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Re-OCR dialog — เปิดแล้วอ่านสถานะก่อนเสมอเพื่อ resume job เดิม (ไม่สร้าง job ซ้ำ) */
export function ReOcrDialog({
  attachmentPublicId,
  originalFilename,
  open,
  onOpenChange,
}: ReOcrDialogProps) {
  const t = useRagAdminT();
  const { data: status, isLoading } = useReOcrStatus(attachmentPublicId, open);
  const trigger = useReOcrTrigger(attachmentPublicId);
  const confirm = useReOcrConfirm(attachmentPublicId);
  const [engine, setEngine] = useState<ReOcrEngine>('np-dms-ocr');
  const [queueInfo, setQueueInfo] = useState<ReOcrTriggerResponse | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const start = (chosen: ReOcrEngine) => {
    trigger.mutate(chosen, { onSuccess: (res) => setQueueInfo(res) });
  };

  const handleConfirm = () => {
    if (status?.status !== 'completed') return;
    confirm.mutate(status.reOcrToken, {
      onSuccess: (res) => {
        toast.success(t(res.reindexQueued ? 're_ocr.toast.confirmed' : 're_ocr.toast.confirmed_no_reindex'));
        setConfirmOpen(false);
        onOpenChange(false);
      },
      onError: () => setConfirmOpen(false),
    });
  };

  const startedBy =
    status != null
      ? t('re_ocr.started_by', {
          name: status.triggeredByDisplayName,
          time: new Date(status.triggeredAt).toLocaleString(),
        })
      : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-screen max-h-screen w-screen max-w-none flex-col gap-4 rounded-none p-6 sm:max-w-none">
        <DialogHeader className="shrink-0">
          <DialogTitle>
            {t('re_ocr.title')} — <span className="font-normal">{originalFilename}</span>
          </DialogTitle>
          <DialogDescription>{startedBy ?? t('re_ocr.action_hint')}</DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex flex-1 items-center justify-center text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            {t('re_ocr.loading')}
          </div>
        ) : !status ? (
          <div className="mx-auto w-full max-w-xl space-y-4">
            <h3 className="font-medium">{t('re_ocr.select.heading')}</h3>
            {(['np-dms-ocr', 'auto'] as const).map((value) => (
              <label
                key={value}
                className="flex cursor-pointer items-start gap-3 rounded border p-3"
              >
                <input
                  type="radio"
                  name="re-ocr-engine"
                  className="mt-1"
                  checked={engine === value}
                  onChange={() => setEngine(value)}
                />
                <span>
                  <span className="block font-medium">
                    {t(value === 'auto' ? 're_ocr.select.auto' : 're_ocr.select.np_dms_ocr')}
                  </span>
                  <span className="block text-sm text-muted-foreground">
                    {t(value === 'auto' ? 're_ocr.select.auto_desc' : 're_ocr.select.np_dms_ocr_desc')}
                  </span>
                </span>
              </label>
            ))}
            <p className="text-sm text-muted-foreground">{t('re_ocr.select.note')}</p>
            <Button onClick={() => start(engine)} disabled={trigger.isPending}>
              {trigger.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('re_ocr.select.start')}
            </Button>
          </div>
        ) : status.status === 'queued' || status.status === 'processing' ? (
          <div className="mx-auto flex w-full max-w-xl flex-col items-center gap-3 py-8 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="font-medium">
              {t(status.status === 'queued' ? 're_ocr.waiting.queued' : 're_ocr.waiting.processing')}
              {status.attempt ? ` — ${t('re_ocr.waiting.attempt', { n: status.attempt })}` : ''}
            </p>
            {queueInfo && status.status === 'queued' && (
              <>
                <p className="text-sm">{t('re_ocr.waiting.queue_position', { n: queueInfo.queuePosition })}</p>
                <p className="text-sm text-muted-foreground">
                  {t('re_ocr.waiting.estimate', { seconds: queueInfo.estimatedWaitSeconds })}
                </p>
              </>
            )}
            <p className="text-sm text-muted-foreground">{t('re_ocr.waiting.hint')}</p>
          </div>
        ) : status.status === 'failed' ? (
          <div className="mx-auto flex w-full max-w-xl flex-col gap-4">
            <div className="flex items-start gap-2 rounded border border-destructive/40 bg-destructive/5 p-3 text-sm">
              <AlertTriangle className="mt-0.5 h-4 w-4 text-destructive" />
              <div>
                <p className="font-medium">{t('re_ocr.error.heading')}</p>
                <p className="text-muted-foreground">{status.errorMessage}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => start('np-dms-ocr')} disabled={trigger.isPending}>
                {t('re_ocr.error.retry_np_dms_ocr')}
              </Button>
              <Button variant="outline" onClick={() => start('auto')} disabled={trigger.isPending}>
                {t('re_ocr.error.retry_auto')}
              </Button>
            </div>
          </div>
        ) : (
          <>
            {status.identical && (
              <div className="shrink-0 rounded border bg-muted/40 p-2 text-sm">
                {t('re_ocr.diff.identical')}
              </div>
            )}
            {status.warning === 'RESULT_MUCH_SHORTER' && (
              <div
                className="flex shrink-0 items-center gap-2 rounded border border-yellow-400 bg-yellow-50 p-2 text-sm text-yellow-900"
                role="alert"
              >
                <AlertTriangle className="h-4 w-4" />
                {t('re_ocr.diff.much_shorter')}
              </div>
            )}
            <ReOcrDiffView
              attachmentPublicId={attachmentPublicId}
              currentText={status.currentText}
              newText={status.newText}
              engineUsed={status.engineUsed}
            />
            <div className="flex shrink-0 justify-end">
              <Button onClick={() => setConfirmOpen(true)} disabled={status.identical || confirm.isPending}>
                {t('re_ocr.diff.confirm')}
              </Button>
            </div>
            <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t('re_ocr.confirm_dialog.title')}</AlertDialogTitle>
                  <AlertDialogDescription>
                    {t('re_ocr.confirm_dialog.description', {
                      old: status.currentText.length,
                      new: status.newText.length,
                    })}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                  <AlertDialogAction onClick={handleConfirm} disabled={confirm.isPending}>
                    {t('re_ocr.confirm_dialog.confirm')}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
