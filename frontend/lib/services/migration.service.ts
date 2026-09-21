// File: frontend/lib/services/migration.service.ts
// Change Log:
// - 2026-09-16: เพิ่ม listLegacyFolderFiles + replaceQueueFile สำหรับเปลี่ยนไฟล์ต้นฉบับ
//   ของ queue item (staging path / uploaded attachment)
// - 2026-09-21: listLegacyFolderFiles รองรับ q filter + คืน { files, total, truncated }
//   (folder staging ที่มีไฟล์ >1,000 ต้องค้นฝั่ง server ก่อน cap)
// - 2026-09-16: เพิ่ม correspondenceType, confidenceBucket params ใน getReviewQueue
// - 2026-09-14: T016 — เพิ่ม restoreQueueOcrText (POST /migration/queue/:publicId/restore-ocr-text) (ADR-054, FR-007)
// - 2026-08-31: T030 — เพิ่ม requiresHumanReview, sortBy, sortOrder params ใน getReviewQueue (ADR-050)
// - 2026-06-13: Add support for direct array response in normalizePaginatedResponse and add file header

import api from '../api/client';
import {
  MigrationReviewQueueItem,
  MigrationErrorItem,
  PaginatedResponse,
  MigrationReviewStatus,
  MigrationAiStatus,
  CommitBatchDto,
  StartIngestPayload,
  StartIngestResponse,
  UpdateQueueOcrPayload,
} from '@/types/migration';

interface WrappedData {
  data?: unknown;
}

// ADR-047: Tree node สำหรับ Legacy NAS folder (recursive)
export interface LegacyFolderNode {
  name: string;
  path: string;
  children: LegacyFolderNode[];
}

/** ADR-054 (FR-007): response ของ POST /migration/queue/:publicId/restore-ocr-text */
export interface RestoreQueueOcrTextResponse {
  publicId: string;
  ocrTextLength: number;
  restored: boolean;
}

/** ไฟล์ PDF ในโฟลเดอร์ staging (GET /migration/legacy-folder-files) */
export interface LegacyFolderFile {
  filename: string;
  fullPath: string;
  size: number;
  modifiedAt: string;
}

/** response ของ legacy-folder-files — total = จำนวนไฟล์ที่ match ทั้งหมด, truncated = เกิน cap */
export interface LegacyFolderFileList {
  files: LegacyFolderFile[];
  total: number;
  truncated: boolean;
}

/** response ของ PATCH /migration/queue/:publicId/file */
export interface ReplaceQueueFileResponse {
  message: string;
  publicId: string;
  attachmentPublicId?: string;
  source?: 'STAGING' | 'UPLOAD';
  idempotentReplay?: boolean;
  reExtract?: { message?: string; jobId?: string | null };
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

const normalizePaginatedResponse = <T>(value: unknown): PaginatedResponse<T> => {
  const extracted = extractNestedData<unknown>(value);

  if (!extracted || typeof extracted !== 'object') {
    return {
      items: [],
      total: 0,
      page: 1,
      limit: 0,
      totalPages: 0,
    };
  }

  if (Array.isArray(extracted)) {
    return {
      items: extracted as T[],
      total: extracted.length,
      page: 1,
      limit: extracted.length,
      totalPages: 1,
    };
  }

  const response = extracted as Partial<PaginatedResponse<T>> & { data?: unknown };

  if (Array.isArray(response.items)) {
    return {
      items: response.items,
      total: response.total ?? response.items.length,
      page: response.page ?? 1,
      limit: response.limit ?? response.items.length,
      totalPages: response.totalPages ?? 1,
    };
  }

  if (Array.isArray(response.data)) {
    return {
      items: response.data as T[],
      total: response.total ?? response.data.length,
      page: response.page ?? 1,
      limit: response.limit ?? response.data.length,
      totalPages: response.totalPages ?? 1,
    };
  }

  return {
    items: [],
    total: 0,
    page: 1,
    limit: 0,
    totalPages: 0,
  };
};

export const migrationService = {
  getReviewQueue: async (params: {
    page?: number;
    limit?: number;
    status?: MigrationReviewStatus;
    aiStatus?: MigrationAiStatus;
    batchId?: string;
    requiresHumanReview?: boolean;
    correspondenceType?: string;
    confidenceBucket?: 'low' | 'mid' | 'high' | 'missing';
    sortBy?: 'ocrQualityConfidence';
    sortOrder?: 'asc' | 'desc';
  }): Promise<PaginatedResponse<MigrationReviewQueueItem>> => {
    const { data } = await api.get('/migration/queue', { params });
    return normalizePaginatedResponse<MigrationReviewQueueItem>(data);
  },

  // ADR-019: ใช้ publicId (UUIDv7) เท่านั้น ห้ามใช้ INT id ใน API
  getQueueItem: async (publicId: string): Promise<MigrationReviewQueueItem> => {
    const { data } = await api.get(`/migration/queue/${publicId}`);
    return extractNestedData<MigrationReviewQueueItem>(data);
  },

  getErrors: async (params: { page?: number; limit?: number }): Promise<PaginatedResponse<MigrationErrorItem>> => {
    const { data } = await api.get('/migration/errors', { params });
    return normalizePaginatedResponse<MigrationErrorItem>(data);
  },

  // ADR-019: ใช้ publicId (UUIDv7) เท่านั้น
  approveQueueItem: async (
    publicId: string,
    payload: Record<string, unknown>,
    idempotencyKey: string
  ) => {
    const { data } = await api.post(`/migration/queue/${publicId}/approve`, payload, {
      headers: {
        'idempotency-key': idempotencyKey,
      },
    });
    return data?.data || data;
  },

  // ADR-047: เริ่มประมวลผล OCR/AI ของ queue item เดียว
  startExtractQueueItem: async (publicId: string, idempotencyKey: string) => {
    const { data } = await api.post(`/migration/queue/${publicId}/extract`, {}, {
      headers: {
        'idempotency-key': idempotencyKey,
      },
    });
    return data?.data || data;
  },

  // ADR-047: เริ่มประมวลผล OCR/AI ใหม่ (re-extract) สำหรับ queue item ที่เคยประมวลผลแล้ว
  reExtractQueueItem: async (publicId: string, idempotencyKey: string) => {
    const { data } = await api.post(`/migration/queue/${publicId}/re-extract`, {}, {
      headers: {
        'idempotency-key': idempotencyKey,
      },
    });
    return data?.data || data;
  },

  // ADR-047: เริ่มประมวลผล OCR/AI แบบ batch
  startExtractBatch: async (publicIds: string[], idempotencyKey: string) => {
    const { data } = await api.post('/migration/extract', { queuePublicIds: publicIds }, {
      headers: {
        'idempotency-key': idempotencyKey,
      },
    });
    return data?.data || data;
  },

  // ADR-019: ใช้ publicId (UUIDv7) เท่านั้น
  // ADR-016: ต้องส่ง Idempotency-Key สำหรับ state mutation
  rejectQueueItem: async (publicId: string, idempotencyKey: string) => {
    const { data } = await api.post(`/migration/queue/${publicId}/reject`, {}, {
      headers: {
        'idempotency-key': idempotencyKey,
      },
    });
    return data?.data || data;
  },

  commitBatch: async (payload: CommitBatchDto, idempotencyKey: string) => {
    const { data } = await api.post(`/migration/commit_batch`, payload, {
      headers: {
        'idempotency-key': idempotencyKey,
      },
    });
    return data?.data || data;
  },

  // ADR-047: Streaming Legacy Ingestion API Methods
  uploadExcelFile: async (file: File): Promise<{ filePath: string; originalFilename: string; size: number }> => {
    const formData = new FormData();
    formData.append('file', file);
    const { data } = await api.post('/migration/ingest/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return data?.data || data;
  },

  startIngestion: async (payload: StartIngestPayload, idempotencyKey: string): Promise<StartIngestResponse> => {
    const { data } = await api.post('/migration/ingest/start', payload, {
      headers: {
        'idempotency-key': idempotencyKey,
      },
    });
    return (data?.data || data) as StartIngestResponse;
  },

  // ADR-054 (FR-007): กู้คืน OCR text จาก ocr_text_bak — restore ไม่ลบ backup (non-destructive)
  // ADR-019 + ADR-016: ใช้ publicId และต้องส่ง Idempotency-Key
  restoreQueueOcrText: async (
    publicId: string,
    idempotencyKey: string
  ): Promise<RestoreQueueOcrTextResponse> => {
    const { data } = await api.post(`/migration/queue/${publicId}/restore-ocr-text`, {}, {
      headers: {
        'idempotency-key': idempotencyKey,
      },
    });
    return (data?.data || data) as RestoreQueueOcrTextResponse;
  },

  // ADR-019 + ADR-016: ใช้ publicId และต้องส่ง Idempotency-Key
  updateQueueOcr: async (
    publicId: string,
    payload: UpdateQueueOcrPayload,
    idempotencyKey: string
  ) => {
    const { data } = await api.patch(`/migration/queue/${publicId}/ocr`, payload, {
      headers: {
        'idempotency-key': idempotencyKey,
      },
    });
    return data?.data || data;
  },

  // ADR-047: List Excel files จาก Legacy NAS folder
  listLegacyExcelFiles: async (): Promise<
    Array<{ filename: string; fullPath: string; size: number }>
  > => {
    const { data } = await api.get('/migration/legacy-files');
    const result = data?.data ?? data;
    return Array.isArray(result?.files) ? result.files : [];
  },

  // ADR-047: List โฟลเดอร์ย่อย (recursive tree) จาก Legacy NAS folder สำหรับ Staging PDF
  listLegacyFolders: async (): Promise<LegacyFolderNode[]> => {
    const { data } = await api.get('/migration/legacy-folders');
    const result = data?.data ?? data;
    return Array.isArray(result?.tree) ? result.tree : [];
  },

  /**
   * List ไฟล์ PDF ในโฟลเดอร์ staging ที่เลือก (non-recursive) —
   * ใช้คู่กับ listLegacyFolders สำหรับ dialog เปลี่ยนไฟล์ต้นฉบับ
   * q = กรองชื่อไฟล์ฝั่ง server (folder บางอันมีไฟล์ >1,000 — ต้อง filter ก่อน cap)
   */
  listLegacyFolderFiles: async (
    folderPath: string,
    q?: string
  ): Promise<LegacyFolderFileList> => {
    const { data } = await api.get('/migration/legacy-folder-files', {
      params: { path: folderPath, ...(q?.trim() ? { q: q.trim() } : {}) },
    });
    const result = data?.data ?? data;
    const files = Array.isArray(result?.files) ? result.files : [];
    return {
      files,
      total: typeof result?.total === 'number' ? result.total : files.length,
      truncated: Boolean(result?.truncated),
    };
  },

  /**
   * เปลี่ยนไฟล์ต้นฉบับของ queue item (PATCH /migration/queue/:publicId/file)
   * รองรับ 2 แหล่ง: storageTempPath (staging/NAS) หรือ tempAttachmentPublicId
   * (attachment จาก POST /files/upload) — backend จะ auto re-extract หลังผูกไฟล์
   */
  replaceQueueFile: async (
    publicId: string,
    payload: { storageTempPath?: string; tempAttachmentPublicId?: string },
    idempotencyKey: string
  ): Promise<ReplaceQueueFileResponse> => {
    const { data } = await api.patch(
      `/migration/queue/${publicId}/file`,
      payload,
      {
        headers: {
          'idempotency-key': idempotencyKey,
        },
      }
    );
    return (data?.data ?? data) as ReplaceQueueFileResponse;
  },

  // ADR-047: รายการ batchId จาก Review Queue สำหรับ filter dropdown
  getQueueBatches: async (): Promise<string[]> => {
    const { data } = await api.get('/migration/queue/batches');
    const result = data?.data ?? data;
    return Array.isArray(result?.batches) ? result.batches : [];
  },

  // ADR-047: รายการ batchId จาก Migration Errors สำหรับ filter dropdown
  getErrorBatches: async (): Promise<string[]> => {
    const { data } = await api.get('/migration/errors/batches');
    const result = data?.data ?? data;
    return Array.isArray(result?.batches) ? result.batches : [];
  },

  // ADR-047: ลบรายการ Review Queue ตาม batch / ทั้งหมด / ที่เลือก พร้อมลบ BullMQ job
  deleteReviewQueue: async (
    batchId?: string,
    all: boolean = false,
    publicIds?: string[]
  ): Promise<{ deleted: number }> => {
    const params: Record<string, string> = {};
    if (all) params.all = 'true';
    else if (batchId) params.batchId = batchId;
    else if (publicIds && publicIds.length > 0) {
      params.publicIds = publicIds.join(',');
    }
    const idempotencyKey =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `del-queue-${Date.now()}`;
    const { data } = await api.delete('/migration/queue', {
      params,
      headers: { 'Idempotency-Key': idempotencyKey },
    });
    const result = data?.data ?? data;
    return result ?? { deleted: 0 };
  },

  // ADR-047: ลบรายการ Migration Errors ตาม batch หรือทั้งหมด
  deleteErrors: async (
    batchId?: string,
    all: boolean = false
  ): Promise<{ deleted: number }> => {
    const params: Record<string, string> = {};
    if (all) params.all = 'true';
    else if (batchId) params.batchId = batchId;
    const idempotencyKey =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `del-errors-${Date.now()}`;
    const { data } = await api.delete('/migration/errors', {
      params,
      headers: { 'Idempotency-Key': idempotencyKey },
    });
    const result = data?.data ?? data;
    return result ?? { deleted: 0 };
  },
};
