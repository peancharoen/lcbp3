// File: lib/api/ai.ts
// Change Log
// - 2026-05-14: เพิ่ม hooks สำหรับ AI staging queue ตาม ADR-023.
'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api/client';

export enum AiStagingStatus {
  PENDING = 'PENDING',
  IMPORTED = 'IMPORTED',
  REJECTED = 'REJECTED',
}

export interface AiStagingRecord {
  publicId: string;
  batchId: string;
  originalFileName: string;
  sourceAttachmentPublicId?: string;
  extractedMetadata?: Record<string, unknown>;
  confidenceScore?: number;
  status: AiStagingStatus;
  errorReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AiStagingQueueResponse {
  items: AiStagingRecord[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ApproveAiStagingPayload {
  documentNumber: string;
  subject: string;
  categoryCode: string;
  projectPublicId: string;
  senderOrganizationPublicId?: string;
  receiverOrganizationPublicId?: string;
  issuedDate?: string;
  receivedDate?: string;
  body?: string;
  finalMetadata?: Record<string, unknown>;
}

interface WrappedData<T> {
  data?: T;
}

const extractData = <T>(value: unknown): T => {
  let current: unknown = value;
  for (let index = 0; index < 5; index += 1) {
    if (!current || typeof current !== 'object' || !('data' in current)) {
      return current as T;
    }
    current = (current as WrappedData<unknown>).data;
  }
  return current as T;
};

export const aiStagingKeys = {
  all: ['ai-staging'] as const,
  queue: (status?: AiStagingStatus) =>
    [...aiStagingKeys.all, 'queue', status ?? 'ALL'] as const,
};

export function useAiStagingQueue(status?: AiStagingStatus) {
  return useQuery({
    queryKey: aiStagingKeys.queue(status),
    queryFn: async (): Promise<AiStagingQueueResponse> => {
      const response = await apiClient.get('/ai/legacy-migration/queue', {
        params: { status, page: 1, limit: 50 },
      });
      return extractData<AiStagingQueueResponse>(response.data);
    },
    staleTime: 30 * 1000,
  });
}

// ─── RAG Query Hooks (Phase 4) ────────────────────────────────────────────────

export type RagJobStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled' | 'not_found';

export interface AiRagCitation {
  pointId: string | number;
  score: number;
  docType?: string;
  docNumber?: string;
  snippet?: string;
}

export interface AiRagJobResult {
  requestPublicId: string;
  status: RagJobStatus;
  answer?: string;
  citations?: AiRagCitation[];
  confidence?: number;
  usedFallbackModel?: boolean;
  errorMessage?: string;
  completedAt?: string;
}

export interface SubmitRagQueryPayload {
  question: string;
  projectPublicId: string;
}

export const ragQueryKeys = {
  all: ['ai-rag'] as const,
  job: (requestPublicId: string) => [...ragQueryKeys.all, 'job', requestPublicId] as const,
};

export function useSubmitRagQuery() {
  return useMutation({
    mutationFn: async (payload: SubmitRagQueryPayload): Promise<{ requestPublicId: string; jobId: string; status: string }> => {
      const response = await apiClient.post('/ai/rag/query', payload, {
        headers: { 'Idempotency-Key': `rag-${Date.now()}` },
      });
      return extractData<{ requestPublicId: string; jobId: string; status: string }>(response.data);
    },
  });
}

export function useRagJobStatus(requestPublicId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: ragQueryKeys.job(requestPublicId ?? ''),
    queryFn: async (): Promise<AiRagJobResult> => {
      const response = await apiClient.get(`/ai/rag/jobs/${requestPublicId}`);
      return extractData<AiRagJobResult>(response.data);
    },
    enabled: enabled && !!requestPublicId,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status === 'completed' || status === 'failed' || status === 'cancelled') return false;
      return 2000;
    },
    staleTime: 0,
  });
}

export function useCancelRagJob() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (requestPublicId: string): Promise<void> => {
      await apiClient.delete(`/ai/rag/jobs/${requestPublicId}`);
    },
    onSuccess: (_data, requestPublicId) => {
      void queryClient.invalidateQueries({ queryKey: ragQueryKeys.job(requestPublicId) });
    },
  });
}

export function useApproveAiStagingRecord() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      publicId,
      payload,
    }: {
      publicId: string;
      payload: ApproveAiStagingPayload;
    }) => {
      const response = await apiClient.post(
        `/ai/legacy-migration/queue/${publicId}/approve`,
        payload
      );
      return extractData<{ record: AiStagingRecord; importResult: unknown }>(
        response.data
      );
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: aiStagingKeys.all });
    },
  });
}
