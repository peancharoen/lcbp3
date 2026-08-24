// File: specs/200-fullstacks/248-ai-engine-control-center/contracts/queue-control.contract.ts

/**
 * Queue Management Endpoints
 * Base: /ai/admin/queues/:queueName
 * Header: Authorization: Bearer <token>
 * Permission: system.manage_all
 */

export interface GetQueueJobsQueryDto {
  status?: 'active' | 'waiting' | 'delayed' | 'completed' | 'failed' | 'all';
  page?: number;
  limit?: number;
}

export interface GetQueueJobsResponse {
  success: boolean;
  data: {
    queueName: string;
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    jobs: Array<{
      id: string;
      name: string;
      jobType: string;
      status: string;
      data: Record<string, unknown>;
      failedReason?: string;
      stacktrace?: string[];
      attemptsMade: number;
      createdAt: number;
      processedOn?: number;
      finishedOn?: number;
    }>;
  };
}

export interface RetryJobResponse {
  success: boolean;
  message: string;
  data: {
    queueName: string;
    jobId: string;
    status: 'retried';
  };
}

export interface DeleteJobResponse {
  success: boolean;
  message: string;
  data: {
    queueName: string;
    jobId: string;
    status: 'deleted';
  };
}

export interface EnqueueClearFailedResponse {
  success: boolean;
  message: string;
  data: {
    cleanupJobId: string;
    targetQueueName: string;
    status: 'queued';
  };
}

export interface GetClearFailedStatusResponse {
  success: boolean;
  data: {
    cleanupJobId: string;
    targetQueueName: string;
    status: 'queued' | 'processing' | 'completed' | 'failed';
    clearedCount?: number;
    remainingFailed?: number;
    error?: string;
    completedAt?: string;
  };
}
