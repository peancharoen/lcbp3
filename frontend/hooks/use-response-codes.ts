// File: hooks/use-response-codes.ts
import { useQuery } from '@tanstack/react-query';
import apiClient from '@/lib/api/client';
import { ResponseCode, ResponseCodeCategory } from '@/types/review-team';

export const responseCodeKeys = {
  all: ['responseCodes'] as const,
  byCategory: (cat: ResponseCodeCategory) => [...responseCodeKeys.all, 'category', cat] as const,
  byDocType: (docTypeId: number, projectId?: number) =>
    [...responseCodeKeys.all, 'docType', docTypeId, projectId] as const,
};

export function useResponseCodes() {
  return useQuery({
    queryKey: responseCodeKeys.all,
    queryFn: async (): Promise<ResponseCode[]> => {
      const res = await apiClient.get('/response-codes');
      return res.data;
    },
  });
}

export function useResponseCodesByCategory(category: ResponseCodeCategory) {
  return useQuery({
    queryKey: responseCodeKeys.byCategory(category),
    queryFn: async (): Promise<ResponseCode[]> => {
      const res = await apiClient.get(`/response-codes/category/${category}`);
      return res.data;
    },
    enabled: !!category,
  });
}

export function useResponseCodesByDocType(documentTypeId: number, projectId?: number) {
  return useQuery({
    queryKey: responseCodeKeys.byDocType(documentTypeId, projectId),
    queryFn: async (): Promise<ResponseCode[]> => {
      const res = await apiClient.get(`/response-codes/document-type/${documentTypeId}`, {
        params: projectId ? { projectId } : undefined,
      });
      return res.data;
    },
    enabled: !!documentTypeId,
  });
}
