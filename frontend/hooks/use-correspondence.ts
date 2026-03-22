import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { correspondenceService } from '@/lib/services/correspondence.service';
import { SearchCorrespondenceDto } from '@/types/dto/correspondence/search-correspondence.dto';
import { CreateCorrespondenceDto } from '@/types/dto/correspondence/create-correspondence.dto';
import { SubmitCorrespondenceDto } from '@/types/dto/correspondence/submit-correspondence.dto';
import { WorkflowActionDto } from '@/types/dto/correspondence/workflow-action.dto';
import { toast } from 'sonner';

// Error type for axios errors
type ApiError = Error & { response?: { data?: { message?: string } } };

// Keys for Query Cache
export const correspondenceKeys = {
  all: ['correspondences'] as const,
  lists: () => [...correspondenceKeys.all, 'list'] as const,
  list: (params: SearchCorrespondenceDto) => [...correspondenceKeys.lists(), params] as const,
  details: () => [...correspondenceKeys.all, 'detail'] as const,
  detail: (uuid: string) => [...correspondenceKeys.details(), uuid] as const,
};

// --- Queries ---

export function useCorrespondences(params: SearchCorrespondenceDto) {
  return useQuery({
    queryKey: correspondenceKeys.list(params),
    queryFn: () => correspondenceService.getAll(params),
    placeholderData: (previousData) => previousData, // Keep previous data while fetching new page
  });
}

export function useCorrespondence(uuid: string) {
  return useQuery({
    queryKey: correspondenceKeys.detail(uuid),
    queryFn: () => correspondenceService.getByUuid(uuid),
    enabled: !!uuid,
  });
}

// --- Mutations ---

export function useCreateCorrespondence() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateCorrespondenceDto) => correspondenceService.create(data),
    onSuccess: () => {
      toast.success('Correspondence created successfully');
      queryClient.invalidateQueries({ queryKey: correspondenceKeys.lists() });
    },
    onError: (error: ApiError) => {
      toast.error('Failed to create correspondence', {
        description: error.response?.data?.message || 'Something went wrong',
      });
    },
  });
}

export function useUpdateCorrespondence() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ uuid, data }: { uuid: string; data: Partial<CreateCorrespondenceDto> }) =>
      correspondenceService.update(uuid, data),
    onSuccess: (_, { uuid }) => {
      toast.success('Correspondence updated successfully');
      queryClient.invalidateQueries({ queryKey: correspondenceKeys.detail(uuid) });
      queryClient.invalidateQueries({ queryKey: correspondenceKeys.lists() });
    },
    onError: (error: ApiError) => {
      toast.error('Failed to update correspondence', {
        description: error.response?.data?.message || 'Something went wrong',
      });
    },
  });
}

export function useDeleteCorrespondence() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (uuid: string) => correspondenceService.delete(uuid),
    onSuccess: () => {
      toast.success('Correspondence deleted successfully');
      queryClient.invalidateQueries({ queryKey: correspondenceKeys.lists() });
    },
    onError: (error: ApiError) => {
      toast.error('Failed to delete correspondence', {
        description: error.response?.data?.message || 'Something went wrong',
      });
    },
  });
}

export function useSubmitCorrespondence() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ uuid, data }: { uuid: string; data: SubmitCorrespondenceDto }) =>
      correspondenceService.submit(uuid, data),
    onSuccess: (_, { uuid }) => {
      toast.success('Correspondence submitted successfully');
      queryClient.invalidateQueries({ queryKey: correspondenceKeys.detail(uuid) });
      queryClient.invalidateQueries({ queryKey: correspondenceKeys.lists() });
    },
    onError: (error: ApiError) => {
      toast.error('Failed to submit correspondence', {
        description: error.response?.data?.message || 'Something went wrong',
      });
    },
  });
}

export function useProcessWorkflow() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ uuid, data }: { uuid: string; data: WorkflowActionDto }) =>
      correspondenceService.processWorkflow(uuid, data),
    onSuccess: (_, { uuid }) => {
      toast.success('Action completed successfully');
      queryClient.invalidateQueries({ queryKey: correspondenceKeys.detail(uuid) });
      queryClient.invalidateQueries({ queryKey: correspondenceKeys.lists() });
    },
    onError: (error: ApiError) => {
      toast.error('Failed to process action', {
        description: error.response?.data?.message || 'Something went wrong',
      });
    },
  });
}
