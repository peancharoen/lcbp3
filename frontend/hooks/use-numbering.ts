import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { documentNumberingService } from '@/lib/services/document-numbering.service';
import { numberingApi, NumberingTemplate } from '@/lib/api/numbering';
import { ManualOverrideDto, VoidReplaceDto, CancelNumberDto, AuditQueryParams } from '@/types/dto/numbering.dto';

export const numberingKeys = {
  all: ['numbering'] as const,
  templates: () => [...numberingKeys.all, 'templates'] as const,
  metrics: () => [...numberingKeys.all, 'metrics'] as const,
  auditLogs: (params?: AuditQueryParams) => [...numberingKeys.all, 'auditLogs', params] as const,
};

export const useTemplates = () => {
  return useQuery({
    queryKey: numberingKeys.templates(),
    queryFn: () => numberingApi.getTemplates(),
  });
};

export const useSaveTemplate = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<NumberingTemplate>) => numberingApi.saveTemplate(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: numberingKeys.templates() });
    },
  });
};

export const useNumberingMetrics = () => {
  return useQuery({
    queryKey: numberingKeys.metrics(),
    queryFn: () => documentNumberingService.getMetrics(),
  });
};

export const useNumberingAuditLogs = (params?: AuditQueryParams) => {
  return useQuery({
    queryKey: numberingKeys.auditLogs(params),
    queryFn: () => documentNumberingService.getAuditLogs(),
  });
};

export const useManualOverrideNumbering = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: ManualOverrideDto) => documentNumberingService.manualOverride(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: numberingKeys.metrics() });
      queryClient.invalidateQueries({ queryKey: numberingKeys.all }); // depending on keys
    },
  });
};

export const useVoidAndReplaceNumbering = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: VoidReplaceDto) => documentNumberingService.voidAndReplace(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: numberingKeys.all });
    },
  });
};

export const useCancelNumbering = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CancelNumberDto) => documentNumberingService.cancelNumber(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: numberingKeys.all });
    },
  });
};

export const useBulkImportNumbering = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: FormData | { documentNumber: string; projectId: number; sequenceNumber: number }[]) => documentNumberingService.bulkImport(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: numberingKeys.all });
    },
  });
};
