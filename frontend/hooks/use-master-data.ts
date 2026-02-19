import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { masterDataService } from '@/lib/services/master-data.service';
import { toast } from 'sonner';
import {
  CreateOrganizationDto,
  UpdateOrganizationDto,
  SearchOrganizationDto,
} from '@/types/dto/organization/organization.dto';
import { AxiosError } from 'axios';
import { organizationService } from '@/lib/services/organization.service';
import { projectService } from '@/lib/services/project.service';
import { contractService } from '@/lib/services/contract.service';

export const masterDataKeys = {
  all: ['masterData'] as const,
  organizations: () => [...masterDataKeys.all, 'organizations'] as const,
  correspondenceTypes: () => [...masterDataKeys.all, 'correspondenceTypes'] as const,
  disciplines: (contractId?: number) => [...masterDataKeys.all, 'disciplines', contractId] as const,
};

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
      toast.success('Organization created successfully');
      queryClient.invalidateQueries({ queryKey: masterDataKeys.organizations() });
    },
    onError: (error: AxiosError<{ message?: string }>) => {
      toast.error('Failed to create organization', {
        description: error.response?.data?.message || 'Unknown error',
      });
    },
  });
}

export function useUpdateOrganization() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateOrganizationDto }) =>
      masterDataService.updateOrganization(id, data),
    onSuccess: () => {
      toast.success('Organization updated successfully');
      queryClient.invalidateQueries({ queryKey: masterDataKeys.organizations() });
    },
    onError: (error: AxiosError<{ message?: string }>) => {
      toast.error('Failed to update organization', {
        description: error.response?.data?.message || 'Unknown error',
      });
    },
  });
}

export function useDeleteOrganization() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => masterDataService.deleteOrganization(id),
    onSuccess: () => {
      toast.success('Organization deleted successfully');
      queryClient.invalidateQueries({ queryKey: masterDataKeys.organizations() });
    },
    onError: (error: AxiosError<{ message?: string }>) => {
      toast.error('Failed to delete organization', {
        description: error.response?.data?.message || 'Unknown error',
      });
    },
  });
}

export function useDisciplines(contractId?: number) {
  return useQuery({
    queryKey: masterDataKeys.disciplines(contractId),
    queryFn: () => masterDataService.getDisciplines(contractId),
  });
}

export function useProjects(isActive: boolean = true) {
  return useQuery({
    queryKey: ['projects', { isActive }],
    queryFn: () => projectService.getAll({ isActive }),
  });
}

export function useContracts(projectId: number = 1) {
  return useQuery({
    queryKey: ['contracts', projectId],
    queryFn: () => contractService.getAll({ projectId }),
  });
}

export function useCorrespondenceTypes() {
  return useQuery({
    queryKey: masterDataKeys.correspondenceTypes(),
    queryFn: () => masterDataService.getCorrespondenceTypes(),
  });
}

// --- Drawing Categories Hooks ---

export function useContractDrawingCategories() {
  return useQuery({
    queryKey: ['contract-drawing-categories'],
    queryFn: () => masterDataService.getContractDrawingCategories(),
  });
}

export function useShopMainCategories(projectId: number) {
  return useQuery({
    queryKey: ['shop-main-categories', projectId],
    queryFn: () => masterDataService.getShopMainCategories(projectId),
    enabled: !!projectId,
  });
}

export function useShopSubCategories(projectId: number, mainCategoryId?: number) {
  return useQuery({
    queryKey: ['shop-sub-categories', projectId, mainCategoryId],
    queryFn: () => masterDataService.getShopSubCategories(projectId, mainCategoryId),
    enabled: !!projectId,
  });
}
