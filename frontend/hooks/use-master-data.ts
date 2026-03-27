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
import { Contract } from '@/types/contract';

// Helper to extract array data from various API response formats (paginated vs direct)
const extractArrayData = <T,>(value: unknown): T[] => {
  if (Array.isArray(value)) return value as T[];
  if (value && typeof value === 'object' && 'data' in value) {
    const data = (value as { data?: unknown }).data;
    if (Array.isArray(data)) return data as T[];
  }
  return [];
};

export const masterDataKeys = {
  all: ['masterData'] as const,
  organizations: () => [...masterDataKeys.all, 'organizations'] as const,
  correspondenceTypes: () => [...masterDataKeys.all, 'correspondenceTypes'] as const,
  disciplines: (contractId?: number | string) => [...masterDataKeys.all, 'disciplines', contractId] as const,
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
    mutationFn: ({ uuid, data }: { uuid: string; data: UpdateOrganizationDto }) =>
      masterDataService.updateOrganization(uuid, data),
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
    mutationFn: (uuid: string) => masterDataService.deleteOrganization(uuid),
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

export function useDisciplines(contractId?: number | string) {
  return useQuery({
    queryKey: masterDataKeys.disciplines(contractId),
    queryFn: () => masterDataService.getDisciplines(contractId),
  });
}

export function useProjects(isActive: boolean = true) {
  return useQuery({
    queryKey: ['projects', { isActive }],
    queryFn: async () => {
      // ADR-019: projectService.getAll() returns Project[] directly
      return await projectService.getAll({ isActive });
    },
  });
}

export function useContracts(projectId?: number | string) {
  return useQuery<Contract[]>({
    queryKey: ['contracts', projectId ?? 'all'],
    queryFn: () => contractService.getAll(projectId ? { projectId } : undefined),
  });
}

export function useCorrespondenceTypes() {
  return useQuery({
    queryKey: masterDataKeys.correspondenceTypes(),
    queryFn: () => masterDataService.getCorrespondenceTypes(),
  });
}

// --- Drawing Categories Hooks ---

export function useContractDrawingCategories(projectId?: number | string) {
  return useQuery({
    queryKey: ['contract-drawing-categories', projectId],
    queryFn: () => masterDataService.getContractDrawingCategories(projectId),
    enabled: !!projectId,
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
