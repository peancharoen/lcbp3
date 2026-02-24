import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { masterDataService } from '@/lib/services/master-data.service';
import type { CreateDisciplineDto } from '@/types/dto/master/discipline.dto';
import type { CreateRfaTypeDto, UpdateRfaTypeDto } from '@/types/dto/master/rfa-type.dto';
import type { CreateCorrespondenceTypeDto, UpdateCorrespondenceTypeDto } from '@/types/dto/master/correspondence-type.dto';

export const referenceDataKeys = {
  all: ['reference-data'] as const,
  rfaTypes: (contractId?: number) => [...referenceDataKeys.all, 'rfaTypes', contractId] as const,
  disciplines: (contractId?: number) => [...referenceDataKeys.all, 'disciplines', contractId] as const,
  correspondenceTypes: () => [...referenceDataKeys.all, 'correspondenceTypes'] as const,
};

// --- RFA Types ---
export const useRfaTypes = (contractId?: number) => {
  return useQuery({
    queryKey: referenceDataKeys.rfaTypes(contractId),
    queryFn: () => masterDataService.getRfaTypes(contractId),
  });
};

export const useCreateRfaType = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateRfaTypeDto) => masterDataService.createRfaType(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reference-data', 'rfaTypes'] });
    },
  });
};

export const useUpdateRfaType = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateRfaTypeDto }) => masterDataService.updateRfaType(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reference-data', 'rfaTypes'] });
    },
  });
};

export const useDeleteRfaType = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => masterDataService.deleteRfaType(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reference-data', 'rfaTypes'] });
    },
  });
};

// --- Disciplines ---
export const useDisciplines = (contractId?: number) => {
  return useQuery({
    queryKey: referenceDataKeys.disciplines(contractId),
    queryFn: () => masterDataService.getDisciplines(contractId),
  });
};

export const useCreateDiscipline = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateDisciplineDto) => masterDataService.createDiscipline(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reference-data', 'disciplines'] });
    },
  });
};

export const useDeleteDiscipline = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => masterDataService.deleteDiscipline(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reference-data', 'disciplines'] });
    },
  });
};

// --- Correspondence Types ---
export const useCorrespondenceTypes = () => {
  return useQuery({
    queryKey: referenceDataKeys.correspondenceTypes(),
    queryFn: () => masterDataService.getCorrespondenceTypes(),
  });
};

export const useCreateCorrespondenceType = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateCorrespondenceTypeDto) => masterDataService.createCorrespondenceType(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reference-data', 'correspondenceTypes'] });
    },
  });
};

export const useUpdateCorrespondenceType = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateCorrespondenceTypeDto }) => masterDataService.updateCorrespondenceType(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reference-data', 'correspondenceTypes'] });
    },
  });
};

export const useDeleteCorrespondenceType = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => masterDataService.deleteCorrespondenceType(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reference-data', 'correspondenceTypes'] });
    },
  });
};
