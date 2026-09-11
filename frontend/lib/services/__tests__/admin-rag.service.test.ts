// File: frontend/lib/services/__tests__/admin-rag.service.test.ts
// Change Log:
// - 2026-09-12: ISSUE-003 — สร้าง service-level test สำหรับ admin-rag.service.ts
//   ครอบคลุม NestJS response envelope unwrapping (response.data.data)
//   ป้องกัน P0 bug ที่เคยเกิดขึ้น (commit 23db3109)

import { describe, it, expect, vi, beforeEach } from 'vitest';
import api from '@/lib/api/client';
import { adminRagService } from '../admin-rag.service';

// apiClient is already mocked in vitest.setup.ts

describe('adminRagService — NestJS envelope unwrapping (ISSUE-003)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('listAttachments', () => {
    it('should unwrap response.data.data (not response.data) for attachments list', async () => {
      const innerPayload = {
        items: [
          {
            attachmentPublicId: 'test-uuid-1',
            originalFilename: 'doc1.pdf',
            mimeType: 'application/pdf',
            ragStatus: 'NOT_STARTED' as const,
            aiProcessingStatus: 'PENDING' as const,
            chunkCount: 0,
            effectiveClassification: 'INTERNAL' as const,
            classificationOverride: null,
            lastUpdated: '2026-09-12T00:00:00Z',
          },
        ],
        total: 1,
        page: 1,
        pageSize: 20,
      };
      // NestJS wraps as { statusCode, message, data: innerPayload }
      const nestjsEnvelope = {
        statusCode: 200,
        message: 'Success',
        data: innerPayload,
      };
      vi.mocked(api.get).mockResolvedValue({ data: nestjsEnvelope });

      const result = await adminRagService.listAttachments({ page: 1, pageSize: 20 });

      expect(api.get).toHaveBeenCalledWith('/ai/admin/rag/attachments', {
        params: { page: 1, pageSize: 20 },
      });
      expect(result).toEqual(innerPayload);
      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should return items array (not envelope) so .length access does not crash', async () => {
      const innerPayload = { items: [], total: 0, page: 1, pageSize: 20 };
      vi.mocked(api.get).mockResolvedValue({
        data: { statusCode: 200, message: 'Success', data: innerPayload },
      });

      const result = await adminRagService.listAttachments({ page: 1, pageSize: 20 });

      // This is the exact access pattern that crashed before the fix
      expect(result.items.length).toBe(0);
      expect(result.total).toBe(0);
    });
  });

  describe('listAttachmentsForClassification', () => {
    it('should unwrap response.data.data for classification list', async () => {
      const innerPayload = {
        items: [
          {
            attachmentPublicId: 'test-uuid-1',
            originalFilename: 'doc1.pdf',
            effectiveClassification: 'CONFIDENTIAL' as const,
            classificationOverride: {
              reason: 'Security review',
              overriddenBy: 'admin',
              overriddenAt: '2026-09-12T00:00:00Z',
            },
          },
        ],
        total: 1,
        page: 1,
        pageSize: 20,
      };
      vi.mocked(api.get).mockResolvedValue({
        data: { statusCode: 200, message: 'Success', data: innerPayload },
      });

      const result = await adminRagService.listAttachmentsForClassification({ page: 1, pageSize: 20 });

      expect(result).toEqual(innerPayload);
      expect(result.items[0].classificationOverride?.reason).toBe('Security review');
    });
  });

  describe('listGenerations', () => {
    it('should unwrap response.data.data for generations list', async () => {
      const innerPayload = {
        items: [
          {
            generationPublicId: 'gen-uuid-1',
            status: 'BUILDING' as const,
            createdAt: '2026-09-12T00:00:00Z',
            chunkCount: 0,
          },
        ],
        total: 1,
      };
      vi.mocked(api.get).mockResolvedValue({
        data: { statusCode: 200, message: 'Success', data: innerPayload },
      });

      const result = await adminRagService.listGenerations('test-uuid-1');

      expect(api.get).toHaveBeenCalledWith('/ai/admin/rag/attachments/test-uuid-1/generations');
      expect(result).toEqual(innerPayload);
    });
  });

  describe('reingest', () => {
    it('should unwrap response.data.data for reingest response', async () => {
      const innerPayload = {
        generationPublicId: 'gen-uuid-2',
        status: 'BUILDING' as const,
        message: 'Re-ingest started',
      };
      vi.mocked(api.post).mockResolvedValue({
        data: { statusCode: 201, message: 'Created', data: innerPayload },
      });

      const result = await adminRagService.reingest('test-uuid-1', 'idem-key-1');

      expect(api.post).toHaveBeenCalledWith(
        '/ai/admin/rag/attachments/test-uuid-1/reingest',
        {},
        { headers: { 'Idempotency-Key': 'idem-key-1' } }
      );
      expect(result).toEqual(innerPayload);
    });
  });

  describe('getMetrics', () => {
    it('should unwrap response.data.data for metrics snapshot', async () => {
      const innerPayload = {
        ingestionDuration: { totalMs: 0, count: 0, buckets: { '100': 0, '500': 0, '2000': 0 } },
        chunkCount: { total: 0, ingestionCount: 0 },
        vectorLatency: { totalMs: 0, count: 0 },
        staleResultRate: { stale: 0, total: 0 },
        fallbackRate: { fullTextFallback: 0, totalQueries: 0 },
        cleanupRetryRate: { retries: 0, cleanups: 0 },
      };
      vi.mocked(api.get).mockResolvedValue({
        data: { statusCode: 200, message: 'Success', data: innerPayload },
      });

      const result = await adminRagService.getMetrics();

      expect(api.get).toHaveBeenCalledWith('/ai/admin/rag/metrics');
      expect(result).toEqual(innerPayload);
    });
  });

  describe('resetMetrics', () => {
    it('should unwrap response.data.data for reset response', async () => {
      const innerPayload = { reset: true, message: 'Metrics reset successfully' };
      vi.mocked(api.post).mockResolvedValue({
        data: { statusCode: 200, message: 'Success', data: innerPayload },
      });

      const result = await adminRagService.resetMetrics();

      expect(api.post).toHaveBeenCalledWith('/ai/admin/rag/metrics/reset', {});
      expect(result).toEqual(innerPayload);
    });
  });

  describe('listFailedIngestions', () => {
    it('should unwrap response.data.data for failed ingestions list', async () => {
      const innerPayload = {
        ragFailures: {
          items: [
            {
              generationPublicId: 'gen-uuid-3',
              attachmentPublicId: 'test-uuid-1',
              originalFilename: 'failed.pdf',
              errorCode: 'NO_OCR_TEXT',
              errorMessage: 'Attachment has no OCR text to ingest',
              failedAt: '2026-09-12T00:00:00Z',
            },
          ],
          total: 1,
          page: 1,
          pageSize: 20,
        },
        pipelineFailures: {
          items: [],
          total: 0,
          page: 1,
          pageSize: 20,
        },
      };
      vi.mocked(api.get).mockResolvedValue({
        data: { statusCode: 200, message: 'Success', data: innerPayload },
      });

      const result = await adminRagService.listFailedIngestions({ page: 1, pageSize: 20 });

      expect(result).toEqual(innerPayload);
      expect(result.ragFailures.items).toHaveLength(1);
      expect(result.pipelineFailures.items).toHaveLength(0);
    });
  });

  describe('batchRetry', () => {
    it('should unwrap response.data.data for batch retry response', async () => {
      const innerPayload = {
        succeeded: ['gen-uuid-3'],
        failed: [
          { generationPublicId: 'gen-uuid-4', reason: 'Permanent error' },
        ],
      };
      vi.mocked(api.post).mockResolvedValue({
        data: { statusCode: 200, message: 'Success', data: innerPayload },
      });

      const result = await adminRagService.batchRetry(['gen-uuid-3', 'gen-uuid-4'], 'idem-key-2');

      expect(api.post).toHaveBeenCalledWith(
        '/ai/admin/rag/failed-ingestions/retry',
        { attachmentPublicIds: ['gen-uuid-3', 'gen-uuid-4'] },
        { headers: { 'Idempotency-Key': 'idem-key-2' } }
      );
      expect(result).toEqual(innerPayload);
      expect(result.succeeded).toHaveLength(1);
      expect(result.failed).toHaveLength(1);
    });
  });

  describe('overrideClassification', () => {
    it('should unwrap response.data.data for classification override', async () => {
      const innerPayload = {
        attachmentPublicId: 'test-uuid-1',
        classification: 'CONFIDENTIAL' as const,
      };
      vi.mocked(api.patch).mockResolvedValue({
        data: { statusCode: 200, message: 'Success', data: innerPayload },
      });

      const result = await adminRagService.overrideClassification(
        'test-uuid-1',
        'CONFIDENTIAL',
        'Security review'
      );

      expect(api.patch).toHaveBeenCalledWith(
        '/ai/rag/attachments/test-uuid-1/classification',
        { classification: 'CONFIDENTIAL', reason: 'Security review' }
      );
      expect(result).toEqual(innerPayload);
    });
  });
});
