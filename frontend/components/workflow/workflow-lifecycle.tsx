'use client';

// ADR-021: WorkflowLifecycle — แสดง Timeline การเดินเรื่องเอกสาร (US2, REQ-02, REQ-03)
// แสดง Step ที่เสร็จแล้ว, Step ปัจจุบัน (active, มีสีพิเศษ), และ Step ที่ยังรอ

import { useRef, useState } from 'react';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';
import { CheckCircle2, XCircle, RotateCcw, MessageSquare, Clock, Loader2, Paperclip, Upload, X as XIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import apiClient from '@/lib/api/client';
import { useTranslations } from '@/hooks/use-translations';
import type { WorkflowAttachmentSummary, WorkflowHistoryItem } from '@/types/workflow';

// รูปแบบ response จาก POST /files/upload
interface UploadedAttachment {
  publicId: string;
  originalFilename: string;
}

interface WorkflowLifecycleProps {
  history?: WorkflowHistoryItem[];
  currentState?: string;
  isLoading?: boolean;
  error?: Error | null;
  // ADR-021 US4: callback เมื่อ User คลิก attachment chip เพื่อ preview
  onFileClick?: (attachment: WorkflowAttachmentSummary) => void;
  // ADR-021 T028: callback เมื่อ publicIds ของไฟล์แนบ Step ปัจจุบันเปลี่ยน
  onAttachmentsChange?: (publicIds: string[]) => void;
  // ADR-021 T041: บอก publicIds ที่ API คืน 404 (ไฟล์ถูกลบออกจาก Storage)
  unavailableAttachmentIds?: string[];
}

// Icon ตาม Action ประเภท (labels resolve ผ่าน t() ใน component)
const ACTION_ICON_MAP: Record<string, React.ReactNode> = {
  APPROVE:     <CheckCircle2 className="h-4 w-4" />,
  REJECT:      <XCircle className="h-4 w-4" />,
  RETURN:      <RotateCcw className="h-4 w-4" />,
  COMMENT:     <MessageSquare className="h-4 w-4" />,
  ACKNOWLEDGE: <CheckCircle2 className="h-4 w-4" />,
  SUBMIT:      <Clock className="h-4 w-4" />,
};

// สีของ Node ตาม Action (REQ-03: Active Step Color)
function getNodeStyle(action: string, isLatest: boolean): { wrapper: string; icon: string } {
  const a = action.toUpperCase();
  if (isLatest) {
    // Step ปัจจุบัน — เน้นด้วย primary ring
    return {
      wrapper: 'bg-primary/10 border-primary ring-2 ring-primary/30 ring-offset-2',
      icon: 'text-primary',
    };
  }
  if (a === 'APPROVE' || a === 'ACKNOWLEDGE') {
    return { wrapper: 'bg-green-50 border-green-300', icon: 'text-green-600' };
  }
  if (a === 'REJECT') {
    return { wrapper: 'bg-red-50 border-red-300', icon: 'text-red-600' };
  }
  if (a === 'RETURN') {
    return { wrapper: 'bg-amber-50 border-amber-300', icon: 'text-amber-600' };
  }
  return { wrapper: 'bg-blue-50 border-blue-200', icon: 'text-blue-600' };
}

// แปลง Action key เป็น i18n key
function getActionLabelKey(action: string): string {
  return `workflow.timeline.step.${action.toUpperCase()}`;
}

export function WorkflowLifecycle({
  history,
  currentState,
  isLoading = false,
  error,
  onFileClick,
  onAttachmentsChange,
  unavailableAttachmentIds,
}: WorkflowLifecycleProps) {
  const unavailableSet = new Set(unavailableAttachmentIds ?? []);
  const t = useTranslations();
  // ADR-021 T028: สถานะการอัปโหลดไฟล์แนบประจำ Step ปัจจุบัน
  const [pendingFiles, setPendingFiles] = useState<UploadedAttachment[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // อัปโหลดไฟล์ผ่าน Two-Phase upload (POST /files/upload → temp)
  async function handleFileUpload(files: FileList | null) {
    if (!files || files.length === 0) return;
    setIsUploading(true);

    const newUploaded: UploadedAttachment[] = [];
    for (const file of Array.from(files)) {
      const formData = new FormData();
      formData.append('file', file);
      try {
        const res = await apiClient.post<{ data?: UploadedAttachment } & UploadedAttachment>(
          '/files/upload',
          formData
        );
        const att: UploadedAttachment = (res.data as { data?: UploadedAttachment }).data ?? (res.data as UploadedAttachment);
        if (att?.publicId) newUploaded.push(att);
      } catch {
        toast.error(`${t('workflow.timeline.uploadError')} "${file.name}"`);
      }
    }

    const updated = [...pendingFiles, ...newUploaded];
    setPendingFiles(updated);
    onAttachmentsChange?.(updated.map((f) => f.publicId));
    setIsUploading(false);
  }

  function removeUploadedFile(publicId: string) {
    const updated = pendingFiles.filter((f) => f.publicId !== publicId);
    setPendingFiles(updated);
    onAttachmentsChange?.(updated.map((f) => f.publicId));
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-md bg-muted/50 p-4 text-center text-sm text-muted-foreground">
        {t('workflow.timeline.loadError')}
      </div>
    );
  }

  if (!history || history.length === 0) {
    return (
      <div className="rounded-md bg-muted/50 p-6 text-center text-sm text-muted-foreground">
        {t('workflow.timeline.noHistory')}
      </div>
    );
  }

  return (
    <div className="py-4 px-2">
      <div className="relative">
        {/* เส้นแนวตั้งเชื่อม Node */}
        <div
          className="absolute left-5 top-5 bottom-5 w-px bg-border"
          aria-hidden="true"
        />

        <ol className="space-y-6">
          {history.map((item, index) => {
            const isLatest = index === history.length - 1;
            const nodeStyle = getNodeStyle(item.action, isLatest);
            const icon =
              ACTION_ICON_MAP[item.action.toUpperCase()] ?? (
                <Clock className="h-4 w-4" />
              );

            return (
              <li key={item.id} className="relative flex gap-4">
                {/* Node Circle — REQ-03: active step มี ring */}
                <div
                  className={`relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 ${nodeStyle.wrapper}`}
                >
                  <span className={nodeStyle.icon}>{icon}</span>
                </div>

                {/* เนื้อหา Step */}
                <div className="flex-1 min-w-0 pt-1.5 pb-2">
                  {/* Action + State Transition */}
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="font-semibold text-sm">
                      {t(getActionLabelKey(item.action))}
                    </span>
                    <Badge variant="outline" className="text-xs font-normal">
                      {item.fromState}
                      <span className="mx-1 text-muted-foreground">→</span>
                      {item.toState}
                    </Badge>
                    {isLatest && currentState && (
                      <Badge className="text-xs bg-primary text-primary-foreground">
                        {t('workflow.timeline.current')}
                      </Badge>
                    )}
                  </div>

                  {/* ความเห็น */}
                  {item.comment && (
                    <p className="text-sm text-muted-foreground mb-1 italic">
                      &ldquo;{item.comment}&rdquo;
                    </p>
                  )}

                  {/* Attachment Chips — ADR-021 US4 / T041: unavailable chip */}
                  {item.attachments && item.attachments.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-2">
                      {item.attachments.map((att) => {
                        const isUnavailable = unavailableSet.has(att.publicId);
                        return isUnavailable ? (
                          <span
                            key={att.publicId}
                            className="inline-flex items-center gap-1 h-6 px-2 rounded border text-xs text-muted-foreground/50 line-through cursor-not-allowed select-none"
                            title={t('workflow.timeline.fileUnavailable')}
                          >
                            <Paperclip className="h-3 w-3" />
                            {t('workflow.timeline.fileUnavailable')}
                          </span>
                        ) : (
                          <Button
                            key={att.publicId}
                            variant="outline"
                            size="sm"
                            className="h-6 px-2 text-xs gap-1"
                            onClick={() => onFileClick?.(att)}
                          >
                            <Paperclip className="h-3 w-3" />
                            {att.originalFilename}
                          </Button>
                        );
                      })}
                    </div>
                  )}

                  {/* Timestamp + Actor */}
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(item.createdAt), 'dd MMM yyyy HH:mm', {
                      locale: th,
                    })}
                    {item.actionByUserId && (
                      <span className="ml-2 text-muted-foreground/70">
                        · User #{item.actionByUserId}
                      </span>
                    )}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      </div>

      {/* ADR-021 T028: Upload Zone — แสดงเฉพาะ Step ปัจจุบัน (เมื่อ parent ต้องการเก็บไฟล์แนบ) */}
      {onAttachmentsChange && (
        <div className="mt-4 px-2">
          {/* Dropzone */}
          <div
            className={`relative flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-5 text-center transition-colors cursor-pointer
              ${isDragOver ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/40'}`}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragOver(false);
              void handleFileUpload(e.dataTransfer.files);
            }}
          >
            {isUploading ? (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            ) : (
              <Upload className="h-5 w-5 text-muted-foreground" />
            )}
            <p className="text-xs text-muted-foreground">
              {isUploading ? t('workflow.timeline.uploading') : t('workflow.timeline.uploadHint')}
            </p>
            <p className="text-xs text-muted-foreground/60">{t('workflow.timeline.uploadTypes')}</p>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.docx,.xlsx,.dwg,.zip"
              className="sr-only"
              onChange={(e) => void handleFileUpload(e.target.files)}
            />
          </div>

          {/* ไฟล์ที่อัปโหลดแล้ว (pending) */}
          {pendingFiles.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {pendingFiles.map((f) => (
                <span
                  key={f.publicId}
                  className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary"
                >
                  <Paperclip className="h-3 w-3" />
                  {f.originalFilename}
                  <button
                    type="button"
                    className="ml-0.5 hover:text-destructive"
                    onClick={(e) => { e.stopPropagation(); removeUploadedFile(f.publicId); }}
                    aria-label={t('workflow.timeline.removeFile')}
                  >
                    <XIcon className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
