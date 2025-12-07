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

// Add other master data hooks as needed
