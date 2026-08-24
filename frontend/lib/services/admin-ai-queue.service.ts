// File: lib/services/admin-ai-queue.service.ts
// Change Log:
// - 2026-08-24: สร้าง service สำหรับ QueueJobDrawer (T019) เรียก AI admin queue endpoints

import api from '@/lib/api/client';

/** สถานะของ BullMQ job ทีรองรับบน UI */
export type QueueJobStatus = 'active' | 'waiting' | 'delayed' | 'completed' | 'failed';

/** รายละเอียดงานในคิว */
export interface QueueJobItem {
  id: string;
  name: string;
  jobType: string;
  status: QueueJobStatus;
  data: Record<string, unknown>;
  failedReason?: string;
  stacktrace?: string[];
  attemptsMade: number;
  createdAt: number;
  processedOn?: number;
  finishedOn?: number;
}

/** ผลลัพธ์การดึงรายการงานในคิว */
export interface QueueJobsResponse {
  jobs: QueueJobItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/** ผลลัพธ์การล้างงานทีล้มเหลวแบบ async */
export interface ClearFailedResult {
  jobId: string;
  targetQueueName: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  clearedCount?: number;
  remainingFailed?: number;
  error?: string;
  completedAt?: string;
}

const MAX_DEPTH = 3;

/**
 * แกะ wrapper { data: ... } ออกจาก response ตาม pattern ของ backend
 * รองรับทั้ง envelope แบบ axios และ backend wrapper
 */
const extractData = <T>(value: unknown): T => {
  let current = value;
  for (let depth = 0; depth < MAX_DEPTH; depth += 1) {
    if (current && typeof current === 'object' && 'data' in current) {
      current = (current as { data: unknown }).data;
      continue;
    }
    break;
  }
  return current as T;
};

/** Service สำหรับจัดการ BullMQ queue jobs และ clear-failed operation */
export const adminAiQueueService = {
  getQueueJobs: async (
    queueName: string,
    status: string | 'all' = 'all',
    page = 1,
    limit = 20
  ): Promise<QueueJobsResponse> => {
    const { data } = await api.get(`/ai/admin/queues/${encodeURIComponent(queueName)}/jobs`, {
      params: { status, page, limit },
    });
    const result = extractData<{
      jobs: QueueJobItem[];
      total: number;
      page: number;
      limit: number;
    }>(data);
    const totalPages = result.limit > 0 ? Math.ceil(result.total / result.limit) : 1;
    return { ...result, totalPages };
  },

  retryJob: async (queueName: string, jobId: string): Promise<{ success: boolean }> => {
    const { data } = await api.post(
      `/ai/admin/queues/${encodeURIComponent(queueName)}/jobs/${encodeURIComponent(jobId)}/retry`
    );
    return extractData<{ success: boolean }>(data) ?? { success: true };
  },

  deleteJob: async (queueName: string, jobId: string): Promise<void> => {
    await api.delete(`/ai/admin/queues/${encodeURIComponent(queueName)}/jobs/${encodeURIComponent(jobId)}`);
  },

  clearFailedJobs: async (queueName: string): Promise<{ jobId: string; status: string }> => {
    const { data } = await api.post(`/ai/admin/queues/${encodeURIComponent(queueName)}/clear-failed`);
    return extractData<{ jobId: string; status: string }>(data);
  },

  getClearFailedStatus: async (
    queueName: string,
    jobId: string
  ): Promise<ClearFailedResult | null> => {
    const { data } = await api.get(
      `/ai/admin/queues/${encodeURIComponent(queueName)}/clear-failed/${encodeURIComponent(jobId)}`
    );
    const result = extractData<ClearFailedResult | { found: false }>(data);
    if (result && typeof result === 'object' && 'found' in result && result.found === false) {
      return null;
    }
    if (result && typeof result === 'object' && 'jobId' in result) {
      return result as ClearFailedResult;
    }
    return null;
  },
};
