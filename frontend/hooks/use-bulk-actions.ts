'use client';

// File: hooks/use-bulk-actions.ts
// Feature 253 T028: Bulk operations with progress polling + result dialog
// - 2026-09-07: Add cleanup on unmount + max poll timeout (Code Review M4, S3)

import { useState, useRef, useEffect, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useTranslations } from '@/hooks/use-translations';
import { documentActionService } from '@/lib/services/document-action.service';
import { documentActionKeys } from '@/lib/query-keys';
import { parseApiError } from '@/lib/api/client';
import { AxiosError } from 'axios';

interface UseBulkActionsOptions {
  documentType: string;
  onComplete?: (bulkId: string, results: { completed: number; failed: number; total: number; failedItems?: string[] }) => void;
}

/** Max poll attempts before timeout (150 × 2s = 5 minutes) */
const MAX_POLL_ATTEMPTS = 150;
const POLL_INTERVAL_MS = 2000;

export function useBulkActions({ documentType, onComplete }: UseBulkActionsOptions) {
  const t = useTranslations();
  const queryClient = useQueryClient();
  const [activeBulkId, setActiveBulkId] = useState<string | null>(null);

  // Track timeout + active state for cleanup on unmount
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(true);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, []);

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({
      queryKey: documentActionKeys.lists(documentType),
    });
  }, [queryClient, documentType]);

  const pollProgress = useCallback(
    async (bulkId: string) => {
      let attempts = 0;

      const check = async (): Promise<void> => {
        if (!isMountedRef.current) return;

        attempts += 1;

        // Timeout: exceeded max attempts
        if (attempts > MAX_POLL_ATTEMPTS) {
          if (isMountedRef.current) {
            setActiveBulkId(null);
            toast.error(t('document.bulk.timeout'));
          }
          return;
        }

        try {
          const progress = await documentActionService.getBulkProgress(bulkId);

          if (!isMountedRef.current) return;

          if (progress.completed + progress.failed >= progress.total) {
            setActiveBulkId(null);
            onCompleteRef.current?.(bulkId, {
              completed: progress.completed,
              failed: progress.failed,
              total: progress.total,
              failedItems: progress.failedItems,
            });
            if (progress.failed === 0) {
              toast.success(t('document.bulk.success', { count: progress.completed }));
            } else {
              toast.warning(
                t('document.bulk.partial', {
                  success: progress.completed,
                  failed: progress.failed,
                }),
              );
            }
            invalidate();
            return;
          }
          // Poll again — store timeout for cleanup
          timeoutRef.current = setTimeout(check, POLL_INTERVAL_MS);
        } catch (error: unknown) {
          if (!isMountedRef.current) return;
          setActiveBulkId(null);
          const apiError = parseApiError(error as AxiosError);
          toast.error(t('document.bulk.failed'), { description: apiError.error.message });
        }
      };
      void check();
    },
    [t, invalidate],
  );

  const bulkCancelMutation = useMutation({
    mutationFn: ({ publicIds, reason }: { publicIds: string[]; reason?: string }) =>
      documentActionService.bulkCancel(publicIds, documentType, reason),
    onSuccess: (data, { publicIds }) => {
      setActiveBulkId(data.bulkId);
      toast.info(t('document.bulk.started', { count: publicIds.length }));
      void pollProgress(data.bulkId);
    },
    onError: (error: Error) => {
      const apiError = parseApiError(error as AxiosError);
      toast.error(t('document.bulk.failed'), { description: apiError.error.message });
    },
  });

  const bulkTagMutation = useMutation({
    mutationFn: ({
      publicIds,
      addTags,
      removeTags,
    }: {
      publicIds: string[];
      addTags: number[];
      removeTags?: number[];
    }) =>
      documentActionService.bulkTag(publicIds, documentType, addTags, removeTags),
    onSuccess: (data, { publicIds }) => {
      setActiveBulkId(data.bulkId);
      toast.info(t('document.bulk.started', { count: publicIds.length }));
      void pollProgress(data.bulkId);
    },
    onError: (error: Error) => {
      const apiError = parseApiError(error as AxiosError);
      toast.error(t('document.bulk.failed'), { description: apiError.error.message });
    },
  });

  const bulkExportMutation = useMutation({
    mutationFn: ({
      publicIds,
      format,
      columns,
    }: {
      publicIds: string[];
      format: 'CSV' | 'XLSX' | 'JSON';
      columns?: string[];
    }) =>
      documentActionService.bulkExport(publicIds, documentType, format, columns),
    onSuccess: (data) => {
      if (data.downloadUrl) {
        // Export เสร็จทันที — download
        window.open(data.downloadUrl, '_blank');
        toast.success(t('document.bulk.exportReady'));
      } else {
        setActiveBulkId(data.bulkId);
        void pollProgress(data.bulkId);
      }
    },
    onError: (error: Error) => {
      const apiError = parseApiError(error as AxiosError);
      toast.error(t('document.bulk.failed'), { description: apiError.error.message });
    },
  });

  return {
    bulkCancel: bulkCancelMutation.mutate,
    bulkTag: bulkTagMutation.mutate,
    bulkExport: bulkExportMutation.mutate,
    isBulkCancelling: bulkCancelMutation.isPending,
    isBulkTagging: bulkTagMutation.isPending,
    isBulkExporting: bulkExportMutation.isPending,
    activeBulkId,
  };
}
