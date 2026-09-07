'use client';

// File: hooks/use-document-actions.ts
// Feature 253 T027: Shared mutations for document actions with cross-module cache invalidation

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useTranslations } from '@/hooks/use-translations';
import { documentActionService } from '@/lib/services/document-action.service';
import { DocumentActionConfig } from '@/components/documents/document-action-strategy';
import { getInvalidationKeys } from '@/lib/query-keys';
import { parseApiError } from '@/lib/api/client';
import { AxiosError } from 'axios';

interface UseDocumentActionsOptions {
  config: DocumentActionConfig;
  onSuccess?: (action: string, publicId: string) => void;
}

export function useDocumentActions({ config, onSuccess }: UseDocumentActionsOptions) {
  const t = useTranslations();
  const queryClient = useQueryClient();

  const invalidate = (publicId: string) => {
    const keys = getInvalidationKeys(config.apiBasePath, publicId);
    for (const key of keys) {
      queryClient.invalidateQueries({ queryKey: key });
    }
  };

  const cancelMutation = useMutation({
    mutationFn: ({ publicId, reason }: { publicId: string; reason?: string }) =>
      documentActionService.cancel(config.apiBasePath, publicId, reason),
    onSuccess: (_data, { publicId }) => {
      toast.success(t(config.successKey));
      invalidate(publicId);
      onSuccess?.('cancel', publicId);
    },
    onError: (error: Error) => {
      const apiError = parseApiError(error as AxiosError);
      toast.error(t(config.failedKey), { description: apiError.error.message });
    },
  });

  const hardDeleteMutation = useMutation({
    mutationFn: ({ publicId }: { publicId: string }) =>
      documentActionService.hardDelete(config.apiBasePath, publicId),
    onSuccess: (_data, { publicId }) => {
      toast.success(t('document.hardDelete.success'));
      invalidate(publicId);
      onSuccess?.('hardDelete', publicId);
    },
    onError: (error: Error) => {
      const apiError = parseApiError(error as AxiosError);
      toast.error(t('document.hardDelete.failed'), { description: apiError.error.message });
    },
  });

  const metadataPatchMutation = useMutation({
    mutationFn: ({
      publicId,
      patch,
      version,
    }: {
      publicId: string;
      patch: Record<string, string | number | boolean | null>;
      version: number;
    }) =>
      documentActionService.metadataPatch(
        config.apiBasePath,
        publicId,
        patch,
        version,
      ),
    onSuccess: (_data, { publicId }) => {
      toast.success(t('document.metadata.success'));
      invalidate(publicId);
      onSuccess?.('metadataPatch', publicId);
    },
    onError: (error: Error) => {
      const apiError = parseApiError(error as AxiosError);
      toast.error(t('document.metadata.failed'), { description: apiError.error.message });
    },
  });

  return {
    cancel: cancelMutation.mutate,
    hardDelete: hardDeleteMutation.mutate,
    metadataPatch: metadataPatchMutation.mutate,
    isCancelling: cancelMutation.isPending,
    isHardDeleting: hardDeleteMutation.isPending,
    isPatching: metadataPatchMutation.isPending,
  };
}
