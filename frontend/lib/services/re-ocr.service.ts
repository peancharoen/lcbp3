// File: lib/services/re-ocr.service.ts
// Change Log:
// - 2026-09-19: ADR-055 T023 — API client สำหรับ Attachment Manual Re-OCR (trigger/status/confirm)
// - 2026-09-19: ADR-055 extension (D17–D22) — triggerReplace + listLinks + replace fields บน status

import axios from 'axios';
import api from '@/lib/api/client';

/** OCR engine ที่ admin เลือกได้ (ADR-055 D7) */
export type ReOcrEngine = 'np-dms-ocr' | 'auto';

/** แหล่งที่มาของ candidate file ของ replace flow (D18) */
export type ReOcrCandidateSource = 'STAGING' | 'UPLOAD';

/** fields ของ replace mode บน status response (มีค่าเฉพาะ job ที่ trigger ผ่าน /re-ocr/replace) */
interface ReOcrReplaceFields {
  mode?: 'replace';
  targetCorrespondencePublicId?: string;
  candidateAttachmentPublicId?: string;
  candidateFilename?: string;
  candidateSource?: ReOcrCandidateSource;
}

/** link ของ attachment ↔ correspondence revision — สำหรับ link picker (D22) */
export interface AttachmentLink {
  correspondencePublicId: string;
  correspondenceNumber: string;
  revisionPublicId: string;
  revisionNumber: number;
  isCurrent: boolean;
  isMainDocument: boolean;
}

/** Body ของ POST /files/:id/re-ocr/replace — source เลือกได้ทางเดียว (XOR) */
export interface ReOcrReplaceRequest {
  engineType: ReOcrEngine;
  targetCorrespondencePublicId: string;
  storageTempPath?: string;
  tempAttachmentPublicId?: string;
}

/** ข้อมูลผู้เริ่ม job — ใช้แสดง "เริ่มโดย …" */
interface ReOcrStarter extends ReOcrReplaceFields {
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

  /** POST /files/:id/re-ocr/replace — re-OCR candidate file เพื่อเทียบก่อน swap junction (D19) */
  async triggerReplace(
    attachmentPublicId: string,
    body: ReOcrReplaceRequest,
    idempotencyKey: string
  ): Promise<ReOcrTriggerResponse> {
    const response = await api.post(
      `/files/${attachmentPublicId}/re-ocr/replace`,
      body,
      { headers: { 'Idempotency-Key': idempotencyKey } }
    );
    return response.data.data as ReOcrTriggerResponse;
  },

  /** GET /files/:id/re-ocr/links — link ทั้งหมดของ attachment (link picker ของ replace flow) */
  async listLinks(attachmentPublicId: string): Promise<AttachmentLink[]> {
    const response = await api.get(`/files/${attachmentPublicId}/re-ocr/links`);
    return response.data.data as AttachmentLink[];
  },
};
