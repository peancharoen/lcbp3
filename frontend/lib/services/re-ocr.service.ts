// File: lib/services/re-ocr.service.ts
// Change Log:
// - 2026-09-19: ADR-055 T023 — API client สำหรับ Attachment Manual Re-OCR (trigger/status/confirm)

import axios from 'axios';
import api from '@/lib/api/client';

/** OCR engine ที่ admin เลือกได้ (ADR-055 D7) */
export type ReOcrEngine = 'np-dms-ocr' | 'auto';

/** ข้อมูลผู้เริ่ม job — ใช้แสดง "เริ่มโดย …" */
interface ReOcrStarter {
  reOcrToken: string;
  triggeredByDisplayName: string;
  triggeredAt: string;
}

export interface ReOcrTriggerResponse {
  reOcrToken: string;
  jobId: string;
  status: 'queued';
  queuePosition: number;
  estimatedWaitSeconds: number;
}

/** ฟิลด์ของ job ที่ยังไม่จบ (แยก queued/processing เป็นสอง member เพื่อให้ TS narrow discriminant ได้) */
interface ReOcrWaiting {
  jobId: string;
  engineType: string;
  attempt?: number;
}

export type ReOcrStatusResponse = ReOcrStarter &
  (
    | ({ status: 'queued' } & ReOcrWaiting)
    | ({ status: 'processing' } & ReOcrWaiting)
    | { status: 'failed'; errorMessage: string }
    | {
        status: 'completed';
        newText: string;
        currentText: string;
        engineUsed: string;
        charCount: number;
        processingTimeMs: number;
        identical: boolean;
        warning?: 'RESULT_MUCH_SHORTER';
      }
  );

export interface ReOcrConfirmResponse {
  status: 'confirmed';
  ragStatus: 'PENDING';
  reindexQueued: boolean;
}

export const reOcrService = {
  /** POST /files/:id/re-ocr — enqueue (ไม่แตะ ocr_text จนกว่าจะ confirm) */
  async trigger(
    attachmentPublicId: string,
    engineType: ReOcrEngine,
    idempotencyKey: string
  ): Promise<ReOcrTriggerResponse> {
    const response = await api.post(
      `/files/${attachmentPublicId}/re-ocr`,
      { engineType },
      { headers: { 'Idempotency-Key': idempotencyKey } }
    );
    return response.data.data as ReOcrTriggerResponse;
  },

  /** GET /files/:id/re-ocr/status — คืน null เมื่อไม่มี job (404 / pointer หมด TTL) */
  async getStatus(attachmentPublicId: string): Promise<ReOcrStatusResponse | null> {
    try {
      const response = await api.get(`/files/${attachmentPublicId}/re-ocr/status`);
      return response.data.data as ReOcrStatusResponse;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return null;
      }
      throw error;
    }
  },

  /** POST /files/:id/re-ocr/confirm — แทนที่ ocr_text ถาวร + re-index */
  async confirm(
    attachmentPublicId: string,
    reOcrToken: string,
    idempotencyKey: string
  ): Promise<ReOcrConfirmResponse> {
    const response = await api.post(
      `/files/${attachmentPublicId}/re-ocr/confirm`,
      { reOcrToken },
      { headers: { 'Idempotency-Key': idempotencyKey } }
    );
    return response.data.data as ReOcrConfirmResponse;
  },
};
