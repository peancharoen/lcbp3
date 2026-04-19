import { useMutation } from '@tanstack/react-query';
import apiClient from '../lib/api/client';

export interface RagCitation {
  chunkId: string;
  docNumber: string | null;
  docType: string;
  revision: string | null;
  snippet: string;
  score: number;
}

export interface RagQueryRequest {
  question: string;
  projectPublicId: string;
}

export interface RagQueryResponse {
  answer: string;
  citations: RagCitation[];
  confidence: number;
  usedFallbackModel: boolean;
  cachedAt?: string;
}

export function useRagQuery() {
  return useMutation<RagQueryResponse, Error, RagQueryRequest>({
    mutationFn: async (payload) => {
      const idempotencyKey = `rag-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const res = await apiClient.post<{ data: RagQueryResponse }>('/rag/query', payload, {
        headers: { 'Idempotency-Key': idempotencyKey },
      });
      return res.data.data;
    },
  });
}
