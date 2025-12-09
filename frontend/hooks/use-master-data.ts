import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { masterDataService } from '@/lib/services/master-data.service';
import { toast } from 'sonner';

export const masterDataKeys = {
  all: ['masterData'] as const,
  organizations: () => [...masterDataKeys.all, 'organizations'] as const,
  correspondenceTypes: () => [...masterDataKeys.all, 'correspondenceTypes'] as const,
  disciplines: (contractId?: number) => [...masterDataKeys.all, 'disciplines', contractId] as const,
};

export function useOrganizations() {
  return useQuery({
    queryKey: masterDataKeys.organizations(),
    queryFn: () => masterDataService.getOrganizations(),
  });
}

export function useCreateOrganization() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => masterDataService.createOrganization(data),
    onSuccess: () => {
      toast.success("Organization created successfully");
      queryClient.invalidateQueries({ queryKey: masterDataKeys.organizations() });
    },
    onError: (error: any) => {
      toast.error("Failed to create organization", {
        description: error.response?.data?.message || "Unknown error"
      });
    }
  });
}

export function useUpdateOrganization() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => masterDataService.updateOrganization(id, data),
    onSuccess: () => {
      toast.success("Organization updated successfully");
      queryClient.invalidateQueries({ queryKey: masterDataKeys.organizations() });
    },
    onError: (error: any) => {
      toast.error("Failed to update organization", {
        description: error.response?.data?.message || "Unknown error"
      });
    }
  });
}

export function useDeleteOrganization() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => masterDataService.deleteOrganization(id),
    onSuccess: () => {
      toast.success("Organization deleted successfully");
      queryClient.invalidateQueries({ queryKey: masterDataKeys.organizations() });
    },
    onError: (error: any) => {
      toast.error("Failed to delete organization", {
        description: error.response?.data?.message || "Unknown error"
      });
    }
  });
}

export function useDisciplines(contractId?: number) {
  return useQuery({
    queryKey: masterDataKeys.disciplines(contractId),
    queryFn: () => masterDataService.getDisciplines(contractId),
  });
}

// Add useContracts hook
import { projectService } from '@/lib/services/project.service';
export function useContracts(projectId: number = 1) {
  return useQuery({
    queryKey: ['contracts', projectId],
    queryFn: () => projectService.getContracts(projectId),
  });
}

