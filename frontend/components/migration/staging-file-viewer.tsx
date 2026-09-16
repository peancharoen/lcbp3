// File: frontend/components/migration/staging-file-viewer.tsx
// Change Log:
// - 2026-09-16: เพิ่ม attachmentPublicId fallback — ไฟล์ที่เปลี่ยนใหม่ผ่าน
//   /files/upload อยู่นอก staging root (staging-file endpoint 403) จึง fallback
//   ไป GET /files/preview/:publicId เมื่อ staging-file ล้มเหลว
// - 2026-08-25: Initial creation — แก้ iframe 401 โดยดึงไฟล์ผ่าน apiClient (JWT) → BlobURL

'use client';

// แสดง PDF จาก /api/migration/staging-file ใน iframe โดยใช้ BlobURL
// เหตุผล: iframe src แบบ raw URL จะถูก browser ส่งเป็น navigation request
// ที่ไม่แนบ Authorization header → backend JwtAuthGuard ตอบ 401
// วิธีแก้: ดึงไฟล์ผ่าน apiClient (interceptor แนบ Bearer JWT อัตโนมัติ)
// แล้วแปลงเป็น BlobURL ก่อนเซ็ตเป็น iframe src (อ้างอิงรูปแบบเดียวกับ FilePreviewModal)

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import apiClient from '@/lib/api/client';
import { AxiosError } from 'axios';
import { useTranslations } from '@/hooks/use-translations';

export interface StagingFileViewerProps {
  /** Canonical path บน staging (เช่น /mnt/legacy-staging/Incoming/...) */
  sourceFilePath: string | null;
  /**
   * publicId ของ attachment ที่ผูกกับ queue item — fallback เมื่อไฟล์อยู่นอก
   * staging root (เช่นไฟล์ที่เปลี่ยนใหม่ผ่าน /files/upload → staging-file 403)
   */
  attachmentPublicId?: string | null;
  /** ชื่อไฟล์สำหรับ a11y title (optional) */
  title?: string;
  /** className สำหรับ container wrapper */
  className?: string;
}

/**
 * StagingFileViewer — ฝัง PDF จาก staging path โดยผ่านการ auth ของ apiClient
 * แปลง response เป็น BlobURL ก่อนเซ็ตเป็น iframe src เพื่อหลีกเลี่ยง 401 จาก raw navigation
 * ถ้า staging-file ล้มเหลวและมี attachmentPublicId → fallback ไป /files/preview
 */
export function StagingFileViewer({
  sourceFilePath,
  attachmentPublicId,
  title = 'Document Viewer',
  className = 'absolute inset-0 w-full h-full',
}: StagingFileViewerProps) {
  const t = useTranslations();
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // ไม่มี path → รีเซ็ต state แล้ว return โดยไม่สร้าง BlobURL
    if (!sourceFilePath) {
      setBlobUrl(null);
      setError(null);
      return;
    }

    let currentUrl: string | null = null;
    let cancelled = false;
    // flag กัน outer finally ปิด spinner ก่อน fallback preview เสร็จ
    let fallbackInFlight = false;
    setIsLoading(true);
    setError(null);

    const setUrl = (blob: Blob) => {
      if (cancelled) return;
      const url = URL.createObjectURL(blob);
      currentUrl = url;
      setBlobUrl(url);
    };

    const showError = (err: AxiosError) => {
      if (cancelled) return;
      // ADR-007: แยก error ตาม status code เพื่อ message ที่ตรงกับสถานการณ์
      if (err.response?.status === 404) {
        setError(t('filePreview.fileUnavailable'));
      } else {
        // 401 และอื่นๆ ใช้ message กลาง — 401 จะถูก interceptor redirect ไป /login อยู่แล้ว
        setError(t('filePreview.loadError'));
      }
    };

    // ดึงไฟล์ผ่าน apiClient เพื่อแนบ JWT header อัตโนมัติ → แปลงเป็น BlobURL
    apiClient
      .get('/migration/staging-file', {
        responseType: 'blob',
        params: { path: sourceFilePath },
      })
      .then((res) => {
        setUrl(res.data as Blob);
      })
      .catch((err: AxiosError) => {
        // Fallback: ไฟล์อาจอยู่นอก staging root (เปลี่ยนไฟล์ใหม่ผ่าน /files/upload)
        // → ลอง /files/preview/:publicId ซึ่ง stream ผ่าน attachment record
        if (!attachmentPublicId || cancelled) {
          showError(err);
          return;
        }
        fallbackInFlight = true;
        apiClient
          .get(`/files/preview/${attachmentPublicId}`, {
            responseType: 'blob',
          })
          .then((res) => {
            setUrl(res.data as Blob);
          })
          .catch((previewErr: AxiosError) => {
            showError(previewErr);
          })
          .finally(() => {
            if (!cancelled) setIsLoading(false);
          });
      })
      .finally(() => {
        if (!cancelled && !fallbackInFlight) setIsLoading(false);
      });

    // Cleanup: เพิกถอน BlobURL เพื่อป้องกัน memory leak
    return () => {
      cancelled = true;
      if (currentUrl) URL.revokeObjectURL(currentUrl);
    };
  }, [sourceFilePath, attachmentPublicId, t]);

  // กรณีไม่มี sourceFilePath → แสดง empty state
  if (!sourceFilePath) {
    return (
      <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
        <p>No Source File Path found for this document</p>
      </div>
    );
  }

  return (
    <div className={className}>
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {error && !isLoading && (
        <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
          {error}
        </div>
      )}

      {!isLoading && !error && blobUrl && (
        <iframe
          src={`${blobUrl}#toolbar=0&navpanes=0`}
          className="absolute inset-0 w-full h-full"
          title={title}
        />
      )}
    </div>
  );
}
