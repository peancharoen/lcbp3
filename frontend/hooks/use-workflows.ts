import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { workflowEngineService } from '@/lib/services/workflow-engine.service';
import {
  CreateWorkflowDefinitionDto,
  UpdateWorkflowDefinitionDto,
  EvaluateWorkflowDto,
  GetAvailableActionsDto,
} from '@/types/dto/workflow-engine/workflow-engine.dto';

export const workflowKeys = {
  all: ['workflows'] as const,
  definitions: () => [...workflowKeys.all, 'definitions'] as const,
  definition: (id: string | number) => [...workflowKeys.definitions(), id] as const,
};

export const useWorkflowDefinitions = () => {
  return useQuery({
    queryKey: workflowKeys.definitions(),
    queryFn: () => workflowEngineService.getDefinitions(),
  });
};

export const useWorkflowDefinition = (id: string | number) => {
  return useQuery({
    queryKey: workflowKeys.definition(id),
    queryFn: () => workflowEngineService.getDefinitionById(id),
    enabled: !!id,
  });
};

export const useCreateWorkflowDefinition = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateWorkflowDefinitionDto) => workflowEngineService.createDefinition(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: workflowKeys.definitions() });
    },
  });
};

export const useUpdateWorkflowDefinition = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string | number; data: UpdateWorkflowDefinitionDto }) =>
      workflowEngineService.updateDefinition(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: workflowKeys.definitions() });
      queryClient.invalidateQueries({ queryKey: workflowKeys.definition(variables.id) });
    },
  });
};

export const useDeleteWorkflowDefinition = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string | number) => workflowEngineService.deleteDefinition(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: workflowKeys.definitions() });
    },
  });
};

/**
 * Since this is a POST request, we use mutation. If you prefer to use useQuery,
 * you would need to adjust the service to use GET (if possible) or pass the body via queryKey.
 * For now, using useMutation for actions evaluation.
 */
export const useEvaluateWorkflow = () => {
  return useMutation({
    mutationFn: (data: EvaluateWorkflowDto) => workflowEngineService.evaluate(data),
  });
};

export const useGetAvailableActions = () => {
  return useMutation({
    mutationFn: (data: GetAvailableActionsDto) => workflowEngineService.getAvailableActions(data),
  });
};
