import api from '../api/client';
import {
  MigrationReviewQueueItem,
  MigrationErrorItem,
  PaginatedResponse,
  MigrationReviewStatus,
  CommitBatchDto,
} from '@/types/migration';

export const migrationService = {
  getReviewQueue: async (params: {
    page?: number;
    limit?: number;
    status?: MigrationReviewStatus;
  }): Promise<PaginatedResponse<MigrationReviewQueueItem>> => {
    const { data } = await api.get('/migration/queue', { params });
    return data?.data || data;
  },

  getQueueItem: async (id: number): Promise<MigrationReviewQueueItem> => {
    const { data } = await api.get(`/migration/queue/${id}`);
    return data?.data || data;
  },

  getErrors: async (params: {
    page?: number;
    limit?: number;
  }): Promise<PaginatedResponse<MigrationErrorItem>> => {
    const { data } = await api.get('/migration/errors', { params });
    return data?.data || data;
  },

  approveQueueItem: async (id: number, payload: any, idempotencyKey: string) => {
    const { data } = await api.post(`/migration/queue/${id}/approve`, payload, {
      headers: {
        'idempotency-key': idempotencyKey,
      },
    });
    return data?.data || data;
  },

  rejectQueueItem: async (id: number) => {
    const { data } = await api.post(`/migration/queue/${id}/reject`);
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
};
