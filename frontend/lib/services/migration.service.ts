import api from '../api/client';
import {
  MigrationReviewQueueItem,
  MigrationErrorItem,
  PaginatedResponse,
  MigrationReviewStatus,
  CommitBatchDto,
} from '@/types/migration';

interface WrappedData {
  data?: unknown;
}

const extractNestedData = <T,>(value: unknown): T => {
  let current: unknown = value;

  for (let i = 0; i < 5; i += 1) {
    if (!current || typeof current !== 'object' || !('data' in current)) {
      return current as T;
    }

    current = (current as WrappedData).data;
  }

  return current as T;
};

const normalizePaginatedResponse = <T,>(value: unknown): PaginatedResponse<T> => {
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

  getQueueItem: async (id: number): Promise<MigrationReviewQueueItem> => {
    const { data } = await api.get(`/migration/queue/${id}`);
    return extractNestedData<MigrationReviewQueueItem>(data);
  },

  getErrors: async (params: {
    page?: number;
    limit?: number;
  }): Promise<PaginatedResponse<MigrationErrorItem>> => {
    const { data } = await api.get('/migration/errors', { params });
    return normalizePaginatedResponse<MigrationErrorItem>(data);
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
