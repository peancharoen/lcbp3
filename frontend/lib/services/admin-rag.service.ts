// File: lib/services/admin-rag.service.ts
// Change Log:
// - 2026-09-10: T008 — สร้าง API client สำหรับ Feature 255 RAG Admin Console (8 endpoints)

import api from '@/lib/api/client';

// ==========================================================
// Types (mirror backend DTOs)
// ==========================================================

export type RagAdminStatus = 'NOT_STARTED' | 'BUILDING' | 'ACTIVE' | 'RETIRED' | 'FAILED';
export type AiProcessingStatus = 'PENDING' | 'PROCESSING' | 'DONE' | 'FAILED';
export type SecurityClassification = 'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL';
export type GenerationStatus = 'BUILDING' | 'ACTIVE' | 'RETIRED' | 'FAILED';
export type RagAdminPageSize = 10 | 20 | 50;

export interface ClassificationOverrideInfo {
  reason: string;
  overriddenBy: string;
  overriddenAt: string;
}

export interface RagAdminAttachmentItem {
  attachmentPublicId: string;
  originalFilename: string;
  mimeType: string;
  ragStatus: RagAdminStatus;
  aiProcessingStatus: AiProcessingStatus;
  chunkCount: number;
  effectiveClassification: SecurityClassification;
  classificationOverride: ClassificationOverrideInfo | null;
  lastUpdated: string;
  errorMessage: string | null;
}

export interface RagAdminAttachmentsResponse {
  items: RagAdminAttachmentItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface RagAdminClassificationItem {
  attachmentPublicId: string;
  originalFilename: string;
  effectiveClassification: SecurityClassification;
  classificationOverride: ClassificationOverrideInfo | null;
}

export interface RagAdminClassificationListResponse {
  items: RagAdminClassificationItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface RagAdminGenerationItem {
  status: GenerationStatus;
  chunkCount: number;
  createdAt: string;
  activatedAt: string | null;
  retiredAt: string | null;
  failedAt: string | null;
  errorCode: string | null;
  errorMessage: string | null;
}

export interface RagAdminGenerationsResponse {
  attachmentPublicId: string;
  generations: RagAdminGenerationItem[];
}

export interface RagAdminFailureItem {
  attachmentPublicId: string;
  originalFilename: string;
  ragStatus: 'FAILED';
  errorCode: string | null;
  errorMessage: string | null;
  failedAt: string | null;
}

export interface AiPipelineFailureItem {
  attachmentPublicId: string;
  originalFilename: string;
  aiProcessingStatus: 'FAILED';
  errorMessage: string | null;
}

export interface RagAdminFailedIngestionsResponse {
  ragFailures: {
    items: RagAdminFailureItem[];
    total: number;
    page: number;
    pageSize: number;
  };
  aiPipelineFailures: {
    items: AiPipelineFailureItem[];
    total: number;
  };
}

export interface BatchRetrySuccessItem {
  attachmentPublicId: string;
  jobId: string;
}

export interface BatchRetryFailedItem {
  attachmentPublicId: string;
  reason: string;
}

export interface RagAdminBatchRetryResponse {
  succeeded: BatchRetrySuccessItem[];
  failed: BatchRetryFailedItem[];
  totalRequested: number;
  totalSucceeded: number;
  totalFailed: number;
}

export interface RagAdminReingestResponse {
  attachmentPublicId: string;
  status: 'BUILDING';
  jobId: string;
}

export interface RagAdminMetricsResetResponse {
  reset: boolean;
  scope: 'global';
}

// Metrics snapshot — mirror RagObservabilityService.getSnapshot()
export interface RagAdminMetricsSnapshot {
  swap: { started: number; completed: number; rolledBack: number; activeConcurrent: number; maxConcurrent: number };
  qdrantDeletion: { attempted: number; succeeded: number; partialFailures: number; totalPendingRetries: number };
  cleanup: { processed: number; succeeded: number; failed: number };
  ingestionDuration: { count: number; sumMs: number; buckets: { '100': number; '500': number; '2000': number } };
  chunkCount: { totalChunks: number; ingestions: number };
  vectorLatency: { count: number; sumMs: number; buckets: { '50': number; '100': number; '500': number; '2000': number } };
  staleResultRate: { filtered: number; total: number };
  fallbackRate: { fullTextFallbacks: number; totalQueries: number };
  cleanupRetryRate: { retries: number };
  uptimeMs: number;
}

// ==========================================================
// Query params
// ==========================================================

export interface RagAdminListParams {
  status?: RagAdminStatus;
  page?: number;
  pageSize?: RagAdminPageSize;
}

export interface RagAdminClassificationListParams {
  page?: number;
  pageSize?: RagAdminPageSize;
}

export interface RagAdminFailedIngestionsParams {
  page?: number;
  pageSize?: RagAdminPageSize;
}

// ==========================================================
// API client (single file, 8 endpoints — Q44)
// ==========================================================

const BASE_URL = '/ai/admin/rag';

/**
 * บริการ API client สำหรับ RAG Admin Console (Feature 255)
 * ครอบคลุม 8 endpoints ใน RagAdminController + 1 existing classification endpoint
 */
export const adminRagService = {
  /** GET /ai/admin/rag/attachments — dashboard list (US1) */
  async listAttachments(params: RagAdminListParams): Promise<RagAdminAttachmentsResponse> {
    const response = await api.get(`${BASE_URL}/attachments`, { params });
    return response.data.data as RagAdminAttachmentsResponse; // Unwrap NestJS Interceptor 'data' wrapper
  },

  /** GET /ai/admin/rag/attachments/classification — classification list (US2, Q43) */
  async listAttachmentsForClassification(params: RagAdminClassificationListParams): Promise<RagAdminClassificationListResponse> {
    const response = await api.get(`${BASE_URL}/attachments/classification`, { params });
    return response.data.data as RagAdminClassificationListResponse; // Unwrap NestJS Interceptor 'data' wrapper
  },

  /** GET /ai/admin/rag/attachments/:id/generations — lifecycle (US3) */
  async listGenerations(attachmentPublicId: string): Promise<RagAdminGenerationsResponse> {
    const response = await api.get(`${BASE_URL}/attachments/${attachmentPublicId}/generations`);
    return response.data.data as RagAdminGenerationsResponse; // Unwrap NestJS Interceptor 'data' wrapper
  },

  /** POST /ai/admin/rag/attachments/:id/reingest — force re-ingest (US3, Q12) */
  async reingest(attachmentPublicId: string, idempotencyKey: string): Promise<RagAdminReingestResponse> {
    const response = await api.post(
      `${BASE_URL}/attachments/${attachmentPublicId}/reingest`,
      {},
      { headers: { 'Idempotency-Key': idempotencyKey } }
    );
    return response.data.data as RagAdminReingestResponse; // Unwrap NestJS Interceptor 'data' wrapper
  },

  /** GET /ai/admin/rag/metrics — metrics snapshot (US4) */
  async getMetrics(): Promise<RagAdminMetricsSnapshot> {
    const response = await api.get(`${BASE_URL}/metrics`);
    return response.data.data as RagAdminMetricsSnapshot; // Unwrap NestJS Interceptor 'data' wrapper
  },

  /** POST /ai/admin/rag/metrics/reset — global reset (US4, Q15) */
  async resetMetrics(): Promise<RagAdminMetricsResetResponse> {
    const response = await api.post(`${BASE_URL}/metrics/reset`, {});
    return response.data.data as RagAdminMetricsResetResponse; // Unwrap NestJS Interceptor 'data' wrapper
  },

  /** GET /ai/admin/rag/failed-ingestions — 2 sections (US5, Q31) */
  async listFailedIngestions(params: RagAdminFailedIngestionsParams): Promise<RagAdminFailedIngestionsResponse> {
    const response = await api.get(`${BASE_URL}/failed-ingestions`, { params });
    return response.data.data as RagAdminFailedIngestionsResponse; // Unwrap NestJS Interceptor 'data' wrapper
  },

  /** POST /ai/admin/rag/failed-ingestions/retry — batch retry (US5, Q17) */
  async batchRetry(attachmentPublicIds: string[], idempotencyKey: string): Promise<RagAdminBatchRetryResponse> {
    const response = await api.post(
      `${BASE_URL}/failed-ingestions/retry`,
      { attachmentPublicIds },
      { headers: { 'Idempotency-Key': idempotencyKey } }
    );
    return response.data.data as RagAdminBatchRetryResponse; // Unwrap NestJS Interceptor 'data' wrapper
  },

  /** PATCH /ai/rag/attachments/:id/classification — existing endpoint (US2, no backend change) */
  async overrideClassification(attachmentPublicId: string, classification: SecurityClassification, reason: string): Promise<{ attachmentPublicId: string; classification: SecurityClassification }> {
    const response = await api.patch(
      `/ai/rag/attachments/${attachmentPublicId}/classification`,
      { classification, reason }
    );
    return response.data.data as { attachmentPublicId: string; classification: SecurityClassification }; // Unwrap NestJS Interceptor 'data' wrapper
  },
};
