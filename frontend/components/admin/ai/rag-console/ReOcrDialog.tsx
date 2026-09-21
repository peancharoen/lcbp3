// File: frontend/components/admin/ai/rag-console/ReOcrDialog.tsx
// Change Log:
// - 2026-09-19: ADR-055 T026/T031 — full-screen dialog 3 phase (เลือก engine → รอ job → เปรียบเทียบ) + resume-by-click
//   + failed view (retry ด้วย engine ใดก็ได้ = trigger ใหม่ ไม่มี silent fallback) + AlertDialog confirm (D16)
// - 2026-09-19: ADR-055 extension (D17–D22) — replace mode: link picker + candidate file picker
//   (staging/upload) + filename-mismatch warning + PDF old/new toggle + confirm wording แบบ replace

'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, FileWarning, Loader2 } from 'lucide-react';
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
import {
  useAttachmentLinks,
  useReOcrConfirm,
  useReOcrReplaceConfirm,
  useReOcrReplaceTrigger,
  useReOcrStatus,
  useReOcrTrigger,
} from '@/hooks/ai/use-re-ocr';
import type {
  ReOcrTriggerResponse,
  ReOcrEngine,
} from '@/lib/services/re-ocr.service';
import { ReOcrDiffView } from './ReOcrDiffView';
import {
  ReOcrReplacePicker,
  type ReOcrReplaceSelection,
} from './ReOcrReplacePicker';
import { useRagAdminT } from './rag-admin-i18n';

export interface ReOcrDialogProps {
  attachmentPublicId: string;
  originalFilename: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * replace mode (D17–D22): เปิด link picker + candidate file picker
   * - ถ้าระบุ replaceTargetCorrespondencePublicId (จากหน้า correspondence detail)
   *   link ถูกล็อกกับ correspondence นั้น ไม่ต้องเลือก
   */
  replaceEnabled?: boolean;
  replaceTargetCorrespondencePublicId?: string;
}

/** Re-OCR dialog — เปิดแล้วอ่านสถานะก่อนเสมอเพื่อ resume job เดิม (ไม่สร้าง job ซ้ำ) */
export function ReOcrDialog({
  attachmentPublicId,
  originalFilename,
  open,
  onOpenChange,
  replaceEnabled = false,
  replaceTargetCorrespondencePublicId,
}: ReOcrDialogProps) {
  const t = useRagAdminT();
  const { data: status, isLoading } = useReOcrStatus(attachmentPublicId, open);
  const { data: links } = useAttachmentLinks(attachmentPublicId, open && replaceEnabled);
  const trigger = useReOcrTrigger(attachmentPublicId);
  const replaceTrigger = useReOcrReplaceTrigger(attachmentPublicId);
  const confirm = useReOcrConfirm(attachmentPublicId);
  const confirmReplace = useReOcrReplaceConfirm(attachmentPublicId);
  const [engine, setEngine] = useState<ReOcrEngine>('np-dms-ocr');
  const [queueInfo, setQueueInfo] = useState<ReOcrTriggerResponse | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [targetLink, setTargetLink] = useState<string | undefined>(
    replaceTargetCorrespondencePublicId
  );
  const [selection, setSelection] = useState<ReOcrReplaceSelection | null>(null);

  // job เดิมที่เป็น replace mode (resume) — ใช้ context จาก status แทน selection ใน dialog
  const resumingReplace = status?.mode === 'replace';
  const effectiveReplace = replaceEnabled || resumingReplace;

  const start = (chosen: ReOcrEngine) => {
    if (replaceEnabled) {
      if (!targetLink || !selection) return;
      replaceTrigger.mutate(
        {
          engineType: chosen,
          targetCorrespondencePublicId: targetLink,
          storageTempPath: selection.storageTempPath,
          tempAttachmentPublicId: selection.tempAttachmentPublicId,
        },
        { onSuccess: (res) => setQueueInfo(res) }
      );
      return;
    }
    trigger.mutate(chosen, { onSuccess: (res) => setQueueInfo(res) });
  };

  /** retry ใน replace mode — ใช้ candidate เดิม (temp attachment ยังอยู่) + link เดิมจาก status */
  const retryReplace = (chosen: ReOcrEngine) => {
    if (status?.mode !== 'replace') return;
    replaceTrigger.mutate(
      {
        engineType: chosen,
        targetCorrespondencePublicId: status.targetCorrespondencePublicId as string,
        tempAttachmentPublicId: status.candidateAttachmentPublicId,
      },
      { onSuccess: (res) => setQueueInfo(res) }
    );
  };

  const handleConfirm = () => {
    if (status?.status !== 'completed') return;
    // replace mode ต้องยิง route แยก (dual permission — junction swap)
    const mutation =
      status.mode === 'replace' ? confirmReplace : confirm;
    mutation.mutate(status.reOcrToken, {
      onSuccess: (res) => {
        toast.success(
          t(
            res.reindexQueued
              ? 're_ocr.toast.confirmed'
              : 're_ocr.toast.confirmed_no_reindex'
          )
        );
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

  const canStartReplace = Boolean(targetLink && selection);
  const filenameMismatch =
    resumingReplace &&
    status?.candidateFilename &&
    status.candidateFilename !== originalFilename;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-screen max-h-screen w-screen max-w-none flex-col gap-4 rounded-none p-6 sm:max-w-none">
        <DialogHeader className="shrink-0">
          <DialogTitle>
            {t(effectiveReplace ? 're_ocr.replace.title' : 're_ocr.title')} —{' '}
            <span className="font-normal">{originalFilename}</span>
          </DialogTitle>
          <DialogDescription>
            {startedBy ?? t(replaceEnabled ? 're_ocr.replace.action_hint' : 're_ocr.action_hint')}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex flex-1 items-center justify-center text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            {t('re_ocr.loading')}
          </div>
        ) : !status ? (
          <div className="mx-auto w-full max-w-xl space-y-4 overflow-y-auto">
            {replaceEnabled && (
              <>
                {/* link picker — ซ่อนเมื่อ detail page preselect link แล้ว */}
                {replaceTargetCorrespondencePublicId ? (
                  <p className="rounded border bg-muted/40 p-2 text-sm">
                    {t('re_ocr.replace.link_fixed')}
                  </p>
                ) : (
                  <div>
                    <h3 className="mb-2 font-medium">{t('re_ocr.replace.link_picker')}</h3>
                    {(links ?? []).map((l) => (
                      <label
                        key={`${l.correspondencePublicId}-${l.revisionPublicId}`}
                        className={`flex items-center gap-3 rounded border p-2 ${
                          l.isCurrent ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'
                        }`}
                      >
                        <input
                          type="radio"
                          name="re-ocr-target-link"
                          disabled={!l.isCurrent}
                          checked={targetLink === l.correspondencePublicId}
                          onChange={() => setTargetLink(l.correspondencePublicId)}
                        />
                        <span className="text-sm">
                          {l.correspondenceNumber}
                          <span className="ml-2 text-xs text-muted-foreground">
                            rev {l.revisionNumber}
                            {l.isMainDocument ? ` · ${t('re_ocr.replace.main_doc')}` : ''}
                            {!l.isCurrent ? ` · ${t('re_ocr.replace.not_current')}` : ''}
                          </span>
                        </span>
                      </label>
                    ))}
                    {links && links.length === 0 && (
                      <p className="text-sm text-muted-foreground">
                        {t('re_ocr.replace.no_links')}
                      </p>
                    )}
                  </div>
                )}
                <div>
                  <h3 className="mb-2 font-medium">{t('re_ocr.replace.select_file')}</h3>
                  <ReOcrReplacePicker onChange={setSelection} />
                </div>
              </>
            )}
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
            <p className="text-sm text-muted-foreground">
              {t(replaceEnabled ? 're_ocr.replace.select_note' : 're_ocr.select.note')}
            </p>
            <Button
              onClick={() => start(engine)}
              disabled={
                trigger.isPending ||
                replaceTrigger.isPending ||
                (replaceEnabled && !canStartReplace)
              }
            >
              {(trigger.isPending || replaceTrigger.isPending) && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {t(replaceEnabled ? 're_ocr.replace.start' : 're_ocr.select.start')}
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
              <Button
                onClick={() => (resumingReplace ? retryReplace('np-dms-ocr') : start('np-dms-ocr'))}
                disabled={trigger.isPending || replaceTrigger.isPending}
              >
                {t('re_ocr.error.retry_np_dms_ocr')}
              </Button>
              <Button
                variant="outline"
                onClick={() => (resumingReplace ? retryReplace('auto') : start('auto'))}
                disabled={trigger.isPending || replaceTrigger.isPending}
              >
                {t('re_ocr.error.retry_auto')}
              </Button>
            </div>
          </div>
        ) : (
          <>
            {resumingReplace && status.candidateFilename && (
              <div className="shrink-0 rounded border bg-muted/40 p-2 text-sm">
                {t('re_ocr.replace.candidate_label')}: {status.candidateFilename}
              </div>
            )}
            {filenameMismatch && (
              <div
                className="flex shrink-0 items-center gap-2 rounded border border-yellow-400 bg-yellow-50 p-2 text-sm text-yellow-900"
                role="alert"
                data-testid="filename-mismatch"
              >
                <FileWarning className="h-4 w-4" />
                {t('re_ocr.replace.filename_mismatch', {
                  expected: originalFilename,
                  got: status.candidateFilename as string,
                })}
              </div>
            )}
            {!resumingReplace && status.identical && (
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
              candidatePublicId={resumingReplace ? status.candidateAttachmentPublicId : undefined}
            />
            <div className="flex shrink-0 justify-end">
              <Button
                onClick={() => setConfirmOpen(true)}
                disabled={(!resumingReplace && status.identical) || confirm.isPending}
              >
                {t(resumingReplace ? 're_ocr.replace.confirm' : 're_ocr.diff.confirm')}
              </Button>
            </div>
            <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    {t(resumingReplace ? 're_ocr.replace.confirm_title' : 're_ocr.confirm_dialog.title')}
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    {resumingReplace
                      ? t('re_ocr.replace.confirm_desc', {
                          old: originalFilename,
                          new: status.candidateFilename ?? '',
                        })
                      : t('re_ocr.confirm_dialog.description', {
                          old: status.currentText.length,
                          new: status.newText.length,
                        })}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                  <AlertDialogAction onClick={handleConfirm} disabled={confirm.isPending}>
                    {t(resumingReplace ? 're_ocr.replace.confirm_action' : 're_ocr.confirm_dialog.confirm')}
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
