import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { rfaService } from '@/lib/services/rfa.service';
import { SearchRfaDto, CreateRfaDto, UpdateRfaDto } from '@/types/dto/rfa/rfa.dto';
import { WorkflowActionDto } from '@/lib/services/rfa.service';
import { toast } from 'sonner';

// Keys
export const rfaKeys = {
  all: ['rfas'] as const,
  lists: () => [...rfaKeys.all, 'list'] as const,
  list: (params: SearchRfaDto) => [...rfaKeys.lists(), params] as const,
  details: () => [...rfaKeys.all, 'detail'] as const,
  detail: (id: number | string) => [...rfaKeys.details(), id] as const,
};

// --- Queries ---

export function useRFAs(params: SearchRfaDto) {
  return useQuery({
    queryKey: rfaKeys.list(params),
    queryFn: () => rfaService.getAll(params),
    placeholderData: (previousData) => previousData,
  });
}

export function useRFA(id: number | string) {
  return useQuery({
    queryKey: rfaKeys.detail(id),
    queryFn: () => rfaService.getById(id),
    enabled: !!id,
  });
}

// --- Mutations ---

export function useCreateRFA() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateRfaDto) => rfaService.create(data),
    onSuccess: () => {
      toast.success('RFA created successfully');
      queryClient.invalidateQueries({ queryKey: rfaKeys.lists() });
    },
    onError: (error: any) => {
      toast.error('Failed to create RFA', {
        description: error.response?.data?.message || 'Something went wrong',
      });
    },
  });
}

export function useUpdateRFA() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number | string; data: UpdateRfaDto }) =>
      rfaService.update(id, data),
    onSuccess: (_, { id }) => {
      toast.success('RFA updated successfully');
      queryClient.invalidateQueries({ queryKey: rfaKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: rfaKeys.lists() });
    },
    onError: (error: any) => {
      toast.error('Failed to update RFA', {
        description: error.response?.data?.message || 'Something went wrong',
      });
    },
  });
}

export function useProcessRFA() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number | string; data: WorkflowActionDto }) =>
      rfaService.processWorkflow(id, data),
    onSuccess: (_, { id }) => {
      toast.success('Workflow status updated successfully');
      queryClient.invalidateQueries({ queryKey: rfaKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: rfaKeys.lists() });
    },
    onError: (error: any) => {
      toast.error('Failed to process workflow', {
        description: error.response?.data?.message || 'Something went wrong',
      });
    },
  });
}
