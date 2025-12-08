import { useQuery } from '@tanstack/react-query';
import { masterDataService } from '@/lib/services/master-data.service';

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

