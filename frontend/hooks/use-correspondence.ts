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
  detail: (id: number | string) => [...correspondenceKeys.details(), id] as const,
};

// --- Queries ---

export function useCorrespondences(params: SearchCorrespondenceDto) {
  return useQuery({
    queryKey: correspondenceKeys.list(params),
    queryFn: () => correspondenceService.getAll(params),
    placeholderData: (previousData) => previousData, // Keep previous data while fetching new page
  });
}

export function useCorrespondence(id: number | string) {
  return useQuery({
    queryKey: correspondenceKeys.detail(id),
    queryFn: () => correspondenceService.getById(id),
    enabled: !!id,
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
    mutationFn: ({ id, data }: { id: number | string; data: Partial<CreateCorrespondenceDto> }) =>
      correspondenceService.update(id, data),
    onSuccess: (_, { id }) => {
      toast.success('Correspondence updated successfully');
      queryClient.invalidateQueries({ queryKey: correspondenceKeys.detail(id) });
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
    mutationFn: (id: number | string) => correspondenceService.delete(id),
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
    mutationFn: ({ id, data }: { id: number; data: SubmitCorrespondenceDto }) =>
      correspondenceService.submit(id, data),
    onSuccess: (_, { id }) => {
      toast.success('Correspondence submitted successfully');
      queryClient.invalidateQueries({ queryKey: correspondenceKeys.detail(id) });
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
    mutationFn: ({ id, data }: { id: number | string; data: WorkflowActionDto }) =>
      correspondenceService.processWorkflow(id, data),
    onSuccess: (_, { id }) => {
      toast.success('Action completed successfully');
      queryClient.invalidateQueries({ queryKey: correspondenceKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: correspondenceKeys.lists() });
    },
    onError: (error: ApiError) => {
      toast.error('Failed to process action', {
        description: error.response?.data?.message || 'Something went wrong',
      });
    },
  });
}

