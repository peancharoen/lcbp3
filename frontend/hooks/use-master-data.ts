import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { masterDataService } from '@/lib/services/master-data.service';
import { toast } from 'sonner';
import {
  CreateOrganizationDto,
  UpdateOrganizationDto,
  SearchOrganizationDto,
} from '@/types/dto/organization/organization.dto';
import { AxiosError } from 'axios';

export const masterDataKeys = {
  all: ['masterData'] as const,
  organizations: () => [...masterDataKeys.all, 'organizations'] as const,
  correspondenceTypes: () => [...masterDataKeys.all, 'correspondenceTypes'] as const,
  disciplines: (contractId?: number) => [...masterDataKeys.all, 'disciplines', contractId] as const,
};

import { organizationService } from '@/lib/services/organization.service';

export function useOrganizations(params?: SearchOrganizationDto) {
  return useQuery({
    queryKey: [...masterDataKeys.organizations(), params],
    queryFn: () => organizationService.getAll(params),
  });
}

export function useCreateOrganization() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateOrganizationDto) => masterDataService.createOrganization(data),
    onSuccess: () => {
      toast.success("Organization created successfully");
      queryClient.invalidateQueries({ queryKey: masterDataKeys.organizations() });
    },
    onError: (error: AxiosError<{ message?: string }>) => {
      toast.error("Failed to create organization", {
        description: error.response?.data?.message || "Unknown error"
      });
    }
  });
}

export function useUpdateOrganization() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateOrganizationDto }) => masterDataService.updateOrganization(id, data),
    onSuccess: () => {
      toast.success("Organization updated successfully");
      queryClient.invalidateQueries({ queryKey: masterDataKeys.organizations() });
    },
    onError: (error: AxiosError<{ message?: string }>) => {
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
    onError: (error: AxiosError<{ message?: string }>) => {
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

// Add useProjects hook
import { projectService } from '@/lib/services/project.service';

export function useProjects(isActive: boolean = true) {
  return useQuery({
    queryKey: ['projects', { isActive }],
    queryFn: () => projectService.getAll({ isActive }),
  });
}

// Add useContracts hook
import { contractService } from '@/lib/services/contract.service';

export function useContracts(projectId: number = 1) {
  return useQuery({
    queryKey: ['contracts', projectId],
    queryFn: () => contractService.getAll({ projectId }),
  });
}

