'use client';

// ADR-021: FilePreviewModal — แสดงไฟล์แนบ Workflow Step โดยไม่บังคับดาวน์โหลด (US4)
// รองรับ: PDF (iframe), Image (img), อื่นๆ (ลิงก์ดาวน์โหลด)
// Auth: ดึงไฟล์ผ่าน apiClient เพื่อแนบ JWT header อัตโนมัติ → แปลงเป็น BlobURL

import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, Download, FileIcon } from 'lucide-react';
import type { AxiosError } from 'axios';
import apiClient from '@/lib/api/client';
import { useTranslations } from '@/hooks/use-translations';
import type { WorkflowAttachmentSummary } from '@/types/workflow';

interface FilePreviewModalProps {
  attachment: WorkflowAttachmentSummary | null;
  onClose: () => void;
  // ADR-021 T041: เรียกเมื่อ API คืน 404 (ไฟล์ถูกลบออกจาก Storage)
  onUnavailable?: (publicId: string) => void;
}

// แปลง bytes เป็น KB/MB สำหรับแสดงขนาดไฟล์
function formatBytes(bytes?: number): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ตรวจสอบว่า mimeType เป็น PDF หรือ Image
function getPreviewType(mimeType?: string): 'pdf' | 'image' | 'none' {
  if (!mimeType) return 'none';
  if (mimeType === 'application/pdf') return 'pdf';
  if (mimeType.startsWith('image/')) return 'image';
  return 'none';
}

export function FilePreviewModal({ attachment, onClose, onUnavailable }: FilePreviewModalProps) {
  const t = useTranslations();
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ดึงไฟล์จาก API เมื่อ attachment เปลี่ยน — แปลงเป็น BlobURL เพื่อรองรับ JWT auth
  useEffect(() => {
    if (!attachment) {
      setBlobUrl(null);
      return;
    }

    let currentUrl: string | null = null;
    setIsLoading(true);
    setError(null);

    apiClient
      .get(`/files/preview/${attachment.publicId}`, { responseType: 'blob' })
      .then((res) => {
        const url = URL.createObjectURL(res.data as Blob);
        currentUrl = url;
        setBlobUrl(url);
      })
      .catch((err: AxiosError) => {
        // ADR-021 T041: ตรวจสอบ 404 เพื่อแยกแยะกรณี ไฟล์ถูกลบ vs เกิดผิดพลาดอื่น
        if (err.response?.status === 404) {
          setError(t('filePreview.fileUnavailable'));
          if (attachment?.publicId) onUnavailable?.(attachment.publicId);
        } else {
          setError(t('filePreview.loadError'));
        }
      })
      .finally(() => {
        setIsLoading(false);
      });

    // Cleanup: เพิกถอน BlobURL เพื่อป้องกัน memory leak
    return () => {
      if (currentUrl) URL.revokeObjectURL(currentUrl);
    };
  }, [attachment, onUnavailable, t]);

  const previewType = getPreviewType(attachment?.mimeType);

  return (
    <Dialog open={!!attachment} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl w-full h-[85vh] flex flex-col p-0">
        {/* Header — ชื่อไฟล์ + ขนาด */}
        <DialogHeader className="px-6 pt-5 pb-3 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2 text-base truncate">
            <FileIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="truncate">{attachment?.originalFilename ?? t('filePreview.fallbackTitle')}</span>
            {attachment?.fileSize && (
              <span className="ml-auto text-xs text-muted-foreground font-normal shrink-0">
                {formatBytes(attachment.fileSize)}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        {/* Body — Preview Area */}
        <div className="flex-1 overflow-hidden relative bg-muted/30">
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          )}

          {error && !isLoading && (
            <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
              {error ?? t('filePreview.loadError')}
            </div>
          )}

          {!isLoading && !error && blobUrl && previewType === 'pdf' && (
            <iframe
              src={blobUrl}
              className="w-full h-full border-0"
              title={attachment?.originalFilename}
            />
          )}

          {!isLoading && !error && blobUrl && previewType === 'image' && (
            <div className="w-full h-full flex items-center justify-center p-4">
              <img
                src={blobUrl}
                alt={attachment?.originalFilename}
                className="max-w-full max-h-full object-contain rounded"
              />
            </div>
          )}

          {!isLoading && !error && blobUrl && previewType === 'none' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
              <FileIcon className="h-12 w-12 opacity-30" />
              <p>{t('filePreview.unsupported')}</p>
            </div>
          )}
        </div>

        {/* Footer — ปุ่มดาวน์โหลด + ปิด */}
        <DialogFooter className="px-6 py-3 border-t shrink-0">
          {blobUrl && (
            <a
              href={blobUrl}
              download={attachment?.originalFilename}
              className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <Download className="h-4 w-4" />
              {t('filePreview.download')}
            </a>
          )}
          <Button variant="outline" size="sm" onClick={onClose}>
            {t('filePreview.close')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
