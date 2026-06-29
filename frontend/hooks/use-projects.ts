import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { projectService } from '@/lib/services/project.service';
import { CreateProjectDto, UpdateProjectDto, SearchProjectDto } from '@/types/dto/project/project.dto';
import { toast } from 'sonner';
import { getApiErrorMessage } from '@/types/api-error';

export interface Project {
  publicId: string;
  projectCode: string;
  projectName: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export const projectKeys = {
  all: ['projects'] as const,
  list: (params: SearchProjectDto) => [...projectKeys.all, 'list', params] as const,
  detail: (uuid: string) => [...projectKeys.all, 'detail', uuid] as const,
};

export function useProjects(params?: SearchProjectDto) {
  return useQuery<Project[]>({
    queryKey: projectKeys.list(params || {}),
    queryFn: () => projectService.getAll(params),
  });
}

export function useCreateProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateProjectDto) => projectService.create(data),
    onSuccess: () => {
      toast.success('Project created successfully');
      queryClient.invalidateQueries({ queryKey: projectKeys.all });
    },
    onError: (error: unknown) => {
      toast.error('Failed to create project', {
        description: getApiErrorMessage(error, 'Unknown error'),
      });
    },
  });
}

export function useUpdateProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ uuid, data }: { uuid: string; data: UpdateProjectDto }) => projectService.update(uuid, data),
    onSuccess: () => {
      toast.success('Project updated successfully');
      queryClient.invalidateQueries({ queryKey: projectKeys.all });
    },
    onError: (error: unknown) => {
      toast.error('Failed to update project', {
        description: getApiErrorMessage(error, 'Unknown error'),
      });
    },
  });
}

export function useDeleteProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (uuid: string) => projectService.delete(uuid),
    onSuccess: () => {
      toast.success('Project deleted successfully');
      queryClient.invalidateQueries({ queryKey: projectKeys.all });
    },
    onError: (error: unknown) => {
      toast.error('Failed to delete project', {
        description: getApiErrorMessage(error, 'Unknown error'),
      });
    },
  });
}
