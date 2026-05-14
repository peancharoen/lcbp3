// File: hooks/use-distribution-matrices.ts
// Change Log
// - 2026-05-14: Add TanStack Query hooks for Distribution Matrix admin UI.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import apiClient from '@/lib/api/client';
import { getApiErrorMessage } from '@/types/api-error';

export type DistributionRecipientType = 'USER' | 'ORGANIZATION' | 'TEAM' | 'ROLE';
export type DistributionDeliveryMethod = 'EMAIL' | 'IN_APP' | 'BOTH';

export interface DistributionConditions {
  codes?: string[];
  excludeCodes?: string[];
}

export interface DistributionRecipient {
  publicId: string;
  recipientType: DistributionRecipientType;
  recipientPublicId: string;
  deliveryMethod: DistributionDeliveryMethod;
  sequence?: number;
}

export interface DistributionMatrix {
  publicId: string;
  name: string;
  documentTypeId: number;
  conditions?: DistributionConditions;
  isActive: boolean;
  recipients?: DistributionRecipient[];
  responseCode?: {
    publicId: string;
    code: string;
    descriptionEn?: string;
  };
}

export interface CreateDistributionMatrixDto {
  name: string;
  projectPublicId?: string;
  documentTypeId: number;
  responseCodePublicId?: string;
  conditions?: DistributionConditions;
}

const extractArrayData = <T>(value: unknown): T[] => {
  if (Array.isArray(value)) return value as T[];
  if (value && typeof value === 'object' && 'data' in value) {
    const nested = (value as { data?: unknown }).data;
    return Array.isArray(nested) ? (nested as T[]) : extractArrayData<T>(nested);
  }
  return [];
};

export const distributionMatrixKeys = {
  all: ['distribution-matrices'] as const,
  byProject: (projectPublicId?: string) => [...distributionMatrixKeys.all, { projectPublicId }] as const,
};

export function useDistributionMatrices(projectPublicId?: string) {
  return useQuery({
    queryKey: distributionMatrixKeys.byProject(projectPublicId),
    queryFn: async (): Promise<DistributionMatrix[]> => {
      const res = await apiClient.get('/admin/distribution-matrices', {
        params: { projectPublicId },
      });
      return extractArrayData<DistributionMatrix>(res.data);
    },
  });
}

export function useCreateDistributionMatrix() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateDistributionMatrixDto) => apiClient.post('/admin/distribution-matrices', data),
    onSuccess: () => {
      toast.success('Distribution Matrix created');
      queryClient.invalidateQueries({ queryKey: distributionMatrixKeys.all });
    },
    onError: (error: unknown) => {
      toast.error('Failed to create Distribution Matrix', {
        description: getApiErrorMessage(error, 'Something went wrong'),
      });
    },
  });
}

export function useDeleteDistributionMatrix() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (publicId: string) => apiClient.delete(`/admin/distribution-matrices/${publicId}`),
    onSuccess: () => {
      toast.success('Distribution Matrix deactivated');
      queryClient.invalidateQueries({ queryKey: distributionMatrixKeys.all });
    },
    onError: (error: unknown) => {
      toast.error('Failed to deactivate Distribution Matrix', {
        description: getApiErrorMessage(error, 'Something went wrong'),
      });
    },
  });
}
