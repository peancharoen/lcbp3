// File: frontend/lib/services/migration.service.ts
// Change Log:
// - 2026-06-13: Add support for direct array response in normalizePaginatedResponse and add file header

import api from '../api/client';
import {
  MigrationReviewQueueItem,
  MigrationErrorItem,
  PaginatedResponse,
  MigrationReviewStatus,
  CommitBatchDto,
  StartIngestPayload,
  UpdateQueueOcrPayload,
} from '@/types/migration';

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

  getStagingFileUrl: (filePath: string) => {
    // Generate the URL directly since it returns a file stream.
    // Ensure we encode the file path correctly.
    // It assumes your axios baseURL is set to your nestjs API.
    // If working with raw <img> or <iframe>, you might need to append the token,
    // or handle it via a fetch wrapper that downloads creating an object URL.
    return `/api/migration/staging-file?path=${encodeURIComponent(filePath)}`;
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

  startIngestion: async (payload: StartIngestPayload, idempotencyKey: string) => {
    const { data } = await api.post('/migration/ingest/start', payload, {
      headers: {
        'idempotency-key': idempotencyKey,
      },
    });
    return data?.data || data;
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

  // ADR-047: List โฟลเดอร์ย่อยจาก Legacy NAS folder สำหรับ Staging PDF
  listLegacyFolders: async (): Promise<
    Array<{ folderName: string; fullPath: string }>
  > => {
    const { data } = await api.get('/migration/legacy-folders');
    const result = data?.data ?? data;
    return Array.isArray(result?.folders) ? result.folders : [];
  },
};
