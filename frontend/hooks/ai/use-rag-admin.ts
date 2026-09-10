// File: frontend/hooks/ai/use-rag-admin.ts
// Change Log:
// - 2026-09-10: T013 — สร้าง TanStack Query hooks สำหรับ Feature 255 RAG Admin Console

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminRagService } from '@/lib/services/admin-rag.service';
import type {
  RagAdminListParams,
  RagAdminClassificationListParams,
  RagAdminFailedIngestionsParams,
  RagAdminAttachmentsResponse,
  RagAdminClassificationListResponse,
  RagAdminGenerationsResponse,
  RagAdminFailedIngestionsResponse,
  RagAdminBatchRetryResponse,
  RagAdminReingestResponse,
  RagAdminMetricsResetResponse,
  RagAdminMetricsSnapshot,
  SecurityClassification,
} from '@/lib/services/admin-rag.service';

// === Query Keys ===
const KEYS = {
  attachments: (params?: RagAdminListParams) =>
    ['rag-admin', 'attachments', params] as const,
  classification: (params?: RagAdminClassificationListParams) =>
    ['rag-admin', 'classification', params] as const,
  generations: (attachmentPublicId: string) =>
    ['rag-admin', 'generations', attachmentPublicId] as const,
  metrics: ['rag-admin', 'metrics'] as const,
  failedIngestions: (params?: RagAdminFailedIngestionsParams) =>
    ['rag-admin', 'failed-ingestions', params] as const,
};

// === Query Hooks ===

/** ดึง attachments list สำหรับ Dashboard tab (US1) — auto-polling 10s (Q21) */
export function useRagAttachments(params?: RagAdminListParams) {
  return useQuery({
    queryKey: KEYS.attachments(params),
    queryFn: () => adminRagService.listAttachments(params ?? {}),
    refetchInterval: 10_000, // 10s polling (Q21)
    refetchIntervalInBackground: false, // หยุดเมื่อ tab backgrounded (Q21)
  });
}

/** ดึง classification list สำหรับ Classification tab (US2, Q43) */
export function useRagClassificationList(params?: RagAdminClassificationListParams) {
  return useQuery({
    queryKey: KEYS.classification(params),
    queryFn: () => adminRagService.listAttachmentsForClassification(params ?? {}),
  });
}

/** ดึง generation lifecycle history สำหรับ Lifecycle tab (US3) */
export function useRagGenerations(attachmentPublicId: string | null) {
  return useQuery({
    queryKey: KEYS.generations(attachmentPublicId ?? ''),
    queryFn: () => adminRagService.listGenerations(attachmentPublicId!),
    enabled: !!attachmentPublicId,
  });
}

/** ดึง metrics snapshot สำหรับ Metrics tab (US4) */
export function useRagMetrics() {
  return useQuery({
    queryKey: KEYS.metrics,
    queryFn: () => adminRagService.getMetrics(),
    refetchInterval: 10_000,
    refetchIntervalInBackground: false,
  });
}

/** ดึง failed ingestions สำหรับ Retry tab (US5, Q31) */
export function useRagFailedIngestions(params?: RagAdminFailedIngestionsParams) {
  return useQuery({
    queryKey: KEYS.failedIngestions(params),
    queryFn: () => adminRagService.listFailedIngestions(params ?? {}),
    refetchInterval: 10_000,
    refetchIntervalInBackground: false,
  });
}

// === Mutation Hooks ===

/** Force re-ingest attachment (US3, Q12) — 409 Conflict handled by caller */
export function useRagReingest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ attachmentPublicId, idempotencyKey }: { attachmentPublicId: string; idempotencyKey: string }) =>
      adminRagService.reingest(attachmentPublicId, idempotencyKey),
    onSuccess: (_data, variables) => {
      // Invalidate generations สำหรับ attachment นี้
      void queryClient.invalidateQueries({ queryKey: KEYS.generations(variables.attachmentPublicId) });
      // Invalidate dashboard list (status จะเปลี่ยนเป็น BUILDING)
      void queryClient.invalidateQueries({ queryKey: ['rag-admin', 'attachments'] });
    },
  });
}

/** Reset metrics globally (US4, Q15) */
export function useRagMetricsReset() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => adminRagService.resetMetrics(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: KEYS.metrics });
    },
  });
}

/** Batch retry failed ingestions (US5, Q17) — partial-success */
export function useRagBatchRetry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ attachmentPublicIds, idempotencyKey }: { attachmentPublicIds: string[]; idempotencyKey: string }) =>
      adminRagService.batchRetry(attachmentPublicIds, idempotencyKey),
    onSuccess: () => {
      // Invalidate failed ingestions list
      void queryClient.invalidateQueries({ queryKey: ['rag-admin', 'failed-ingestions'] });
      // Invalidate dashboard list (status จะเปลี่ยน)
      void queryClient.invalidateQueries({ queryKey: ['rag-admin', 'attachments'] });
    },
  });
}

/** Override classification (US2) — existing endpoint */
export function useRagClassificationOverride() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      attachmentPublicId,
      classification,
      reason,
    }: {
      attachmentPublicId: string;
      classification: SecurityClassification;
      reason: string;
    }) => adminRagService.overrideClassification(attachmentPublicId, classification, reason),
    onSuccess: () => {
      // Invalidate classification list
      void queryClient.invalidateQueries({ queryKey: ['rag-admin', 'classification'] });
      // Invalidate dashboard list (effective classification จะเปลี่ยน)
      void queryClient.invalidateQueries({ queryKey: ['rag-admin', 'attachments'] });
    },
  });
}

// === Type re-exports for convenience ===
export type {
  RagAdminAttachmentsResponse,
  RagAdminClassificationListResponse,
  RagAdminGenerationsResponse,
  RagAdminFailedIngestionsResponse,
  RagAdminBatchRetryResponse,
  RagAdminReingestResponse,
  RagAdminMetricsResetResponse,
  RagAdminMetricsSnapshot,
};
