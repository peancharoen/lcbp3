// File: hooks/use-delegation.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import apiClient from '@/lib/api/client';
import { getApiErrorMessage } from '@/types/api-error';
import { DelegationScope } from '@/types/review-team';

export interface Delegation {
  publicId: string;
  delegatorUserId?: number;
  delegateUserId?: number;
  scope: DelegationScope;
  projectId?: number;
  startDate: string;
  endDate: string;
  reason?: string;
  isActive: boolean;
  createdAt: string;
  delegate?: {
    publicId: string;
    fullName?: string;
    email?: string;
  };
}

export interface CreateDelegationDto {
  delegateUserPublicId: string;
  scope: DelegationScope;
  projectPublicId?: string;
  startDate: string;
  endDate: string;
  reason?: string;
}

export const delegationKeys = {
  all: ['delegations'] as const,
  mine: () => [...delegationKeys.all, 'mine'] as const,
};

export function useMyDelegations() {
  return useQuery({
    queryKey: delegationKeys.mine(),
    queryFn: async (): Promise<Delegation[]> => {
      const res = await apiClient.get('/delegations');
      return res.data;
    },
  });
}

export function useCreateDelegation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateDelegationDto) => apiClient.post('/delegations', data),
    onSuccess: () => {
      toast.success('Delegation created successfully');
      queryClient.invalidateQueries({ queryKey: delegationKeys.mine() });
    },
    onError: (error: unknown) => {
      toast.error('Failed to create delegation', {
        description: getApiErrorMessage(error, 'Something went wrong'),
      });
    },
  });
}

export function useRevokeDelegation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (publicId: string) => apiClient.delete(`/delegations/${publicId}`),
    onSuccess: () => {
      toast.success('Delegation revoked');
      queryClient.invalidateQueries({ queryKey: delegationKeys.mine() });
    },
    onError: (error: unknown) => {
      toast.error('Failed to revoke delegation', {
        description: getApiErrorMessage(error, 'Something went wrong'),
      });
    },
  });
}
