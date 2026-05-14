import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { rfaService, SubmitRfaDto } from '@/lib/services/rfa.service';
import { SearchRfaDto, CreateRfaDto, UpdateRfaDto } from '@/types/dto/rfa/rfa.dto';
import { WorkflowActionDto } from '@/lib/services/rfa.service';
import { toast } from 'sonner';
import { getApiErrorMessage } from '@/types/api-error';

// ADR-021: Re-export useWorkflowHistory เพื่อให้ page import ได้จาก use-rfa
export { useWorkflowHistory } from './use-workflow-history';

// Keys
export const rfaKeys = {
  all: ['rfas'] as const,
  lists: () => [...rfaKeys.all, 'list'] as const,
  list: (params: SearchRfaDto) => [...rfaKeys.lists(), params] as const,
  details: () => [...rfaKeys.all, 'detail'] as const,
  detail: (uuid: string) => [...rfaKeys.details(), uuid] as const,
};

// --- Queries ---

export function useRFAs(params: SearchRfaDto) {
  return useQuery({
    queryKey: rfaKeys.list(params),
    queryFn: () => rfaService.getAll(params),
    placeholderData: (previousData) => previousData,
  });
}

export function useRFA(uuid: string) {
  return useQuery({
    queryKey: rfaKeys.detail(uuid),
    queryFn: () => rfaService.getByUuid(uuid),
    enabled: !!uuid,
  });
}

// --- Mutations ---

export function useSubmitRFA() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ uuid, data }: { uuid: string; data: SubmitRfaDto }) =>
      rfaService.submit(uuid, data),
    onSuccess: (_, { uuid }) => {
      toast.success('RFA submitted successfully');
      queryClient.invalidateQueries({ queryKey: rfaKeys.detail(uuid) });
      queryClient.invalidateQueries({ queryKey: rfaKeys.lists() });
    },
    onError: (error: unknown) => {
      toast.error('Failed to submit RFA', {
        description: getApiErrorMessage(error, 'Something went wrong'),
      });
    },
  });
}

export function useCreateRFA() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateRfaDto) => rfaService.create(data),
    onSuccess: () => {
      toast.success('RFA created successfully');
      queryClient.invalidateQueries({ queryKey: rfaKeys.lists() });
    },
    onError: (error: unknown) => {
      toast.error('Failed to create RFA', {
        description: getApiErrorMessage(error, 'Something went wrong'),
      });
    },
  });
}

export function useUpdateRFA() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ uuid, data }: { uuid: string; data: UpdateRfaDto }) => rfaService.update(uuid, data),
    onSuccess: (_, { uuid }) => {
      toast.success('RFA updated successfully');
      queryClient.invalidateQueries({ queryKey: rfaKeys.detail(uuid) });
      queryClient.invalidateQueries({ queryKey: rfaKeys.lists() });
    },
    onError: (error: unknown) => {
      toast.error('Failed to update RFA', {
        description: getApiErrorMessage(error, 'Something went wrong'),
      });
    },
  });
}

export function useProcessRFA() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ uuid, data }: { uuid: string; data: WorkflowActionDto }) => rfaService.processWorkflow(uuid, data),
    onSuccess: (_, { uuid }) => {
      toast.success('Workflow status updated successfully');
      queryClient.invalidateQueries({ queryKey: rfaKeys.detail(uuid) });
      queryClient.invalidateQueries({ queryKey: rfaKeys.lists() });
    },
    onError: (error: unknown) => {
      toast.error('Failed to process workflow', {
        description: getApiErrorMessage(error, 'Something went wrong'),
      });
    },
  });
}
