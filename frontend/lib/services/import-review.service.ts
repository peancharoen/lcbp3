// File: lib/services/import-review.service.ts
// Change Log:
// - 2026-09-09: Initial creation — client for 4-Layer Excel Data Review Pipeline
//   (Feature 252, ADR-052). Endpoints live under global prefix `api` + controller
//   path `v1/correspondence/import-review` (backend/src/modules/migration/
//   excel-import-review.controller.ts) — apiClient baseURL already includes
//   `/api`, so paths here start with `/v1/...`.

import api from '../api/client';
import {
  AiReviewerProvider,
  BatchStrategy,
  CancelReviewResponse,
  CheckReviewResponse,
  ConfirmReviewResponse,
  ReviewTargetMode,
} from '@/types/import-review';

interface WrappedData {
  data?: unknown;
}

const extractNestedData = <T>(value: unknown): T => {
  let current: unknown = value;
  for (let i = 0; i < 5; i += 1) {
    if (!current || typeof current !== 'object' || !('data' in current)) {
      return current as T;
    }
    current = (current as WrappedData).data;
  }
  return current as T;
};

/** Trigger บันทึกไฟล์ blob ลงเครื่องผู้ใช้ (pattern เดียวกับ correspondences/detail.tsx) */
const triggerBlobDownload = (blob: Blob, filename: string): void => {
  const blobUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(blobUrl);
};

export const importReviewService = {
  /** FR-001: อัปโหลดไฟล์ .xlsx/.zip และรัน 4-Layer review */
  check: async (params: {
    projectPublicId: string;
    targetMode: ReviewTargetMode;
    aiProvider: AiReviewerProvider;
    batchStrategy: BatchStrategy;
    file: File;
  }): Promise<CheckReviewResponse> => {
    const formData = new FormData();
    formData.append('file', params.file);
    const { data } = await api.post('/v1/correspondence/import-review/check', formData, {
      params: {
        projectPublicId: params.projectPublicId,
        targetMode: params.targetMode,
        aiProvider: params.aiProvider,
        batchStrategy: params.batchStrategy,
      },
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return extractNestedData<CheckReviewResponse>(data);
  },

  /** FR-013: ดาวน์โหลดไฟล์ Annotated Excel และบันทึกลงเครื่องทันที */
  downloadAnnotated: async (sessionId: string): Promise<void> => {
    const res = await api.get(`/v1/correspondence/import-review/${sessionId}/download-annotated`, {
      responseType: 'blob',
    });
    triggerBlobDownload(res.data as Blob, `annotated-${sessionId}.xlsx`);
  },

  /** D6: ดาวน์โหลดไฟล์ failed_rows.xlsx ของแถวที่ถูกกักกัน (MIGRATION_STAGING) */
  downloadFailedRows: async (sessionId: string): Promise<void> => {
    const res = await api.get(`/v1/correspondence/import-review/${sessionId}/download-failed-rows`, {
      responseType: 'blob',
    });
    triggerBlobDownload(res.data as Blob, `failed_rows-${sessionId}.xlsx`);
  },

  /** FR-014~FR-017: ยืนยันนำเข้าจริง (Re-validate + Commit + Stash cleanup) */
  confirm: async (sessionId: string): Promise<ConfirmReviewResponse> => {
    const { data } = await api.post(`/v1/correspondence/import-review/${sessionId}/confirm`);
    return extractNestedData<ConfirmReviewResponse>(data);
  },

  /** FR-016: ยกเลิก session และล้าง stash ทันที */
  cancel: async (sessionId: string): Promise<CancelReviewResponse> => {
    const { data } = await api.post(`/v1/correspondence/import-review/${sessionId}/cancel`);
    return extractNestedData<CancelReviewResponse>(data);
  },
};
