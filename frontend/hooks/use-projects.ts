import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { projectService } from '@/lib/services/project.service';
import { CreateProjectDto, UpdateProjectDto, SearchProjectDto } from '@/types/dto/project/project.dto';
import { toast } from 'sonner';

export const projectKeys = {
  all: ['projects'] as const,
  list: (params: SearchProjectDto) => [...projectKeys.all, 'list', params] as const,
  detail: (id: number) => [...projectKeys.all, 'detail', id] as const,
};

export function useProjects(params?: SearchProjectDto) {
  return useQuery({
    queryKey: projectKeys.list(params || {}),
    queryFn: () => projectService.getAll(params),
  });
}

export function useCreateProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateProjectDto) => projectService.create(data),
    onSuccess: () => {
      toast.success("Project created successfully");
      queryClient.invalidateQueries({ queryKey: projectKeys.all });
    },
    onError: (error: any) => {
      toast.error("Failed to create project", {
        description: error.response?.data?.message || "Unknown error"
      });
    }
  });
}

export function useUpdateProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateProjectDto }) => projectService.update(id, data),
    onSuccess: () => {
      toast.success("Project updated successfully");
      queryClient.invalidateQueries({ queryKey: projectKeys.all });
    },
    onError: (error: any) => {
      toast.error("Failed to update project", {
        description: error.response?.data?.message || "Unknown error"
      });
    }
  });
}

export function useDeleteProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => projectService.delete(id),
    onSuccess: () => {
      toast.success("Project deleted successfully");
      queryClient.invalidateQueries({ queryKey: projectKeys.all });
    },
    onError: (error: any) => {
      toast.error("Failed to delete project", {
        description: error.response?.data?.message || "Unknown error"
      });
    }
  });
}
