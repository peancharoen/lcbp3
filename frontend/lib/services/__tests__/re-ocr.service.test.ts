// File: frontend/lib/services/__tests__/re-ocr.service.test.ts
// Change Log:
// - 2026-09-19: ADR-055 — unit tests สำหรับ re-ocr.service.ts
//   ครอบคลุม envelope unwrapping, Idempotency-Key header, และ 404→null contract

import { describe, it, expect, vi, beforeEach } from 'vitest';
import api from '@/lib/api/client';
import { reOcrService } from '../re-ocr.service';

// apiClient is already mocked in vitest.setup.ts

describe('reOcrService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('trigger', () => {
    it('should POST with engineType + Idempotency-Key and unwrap data.data', async () => {
      const innerPayload = {
        reOcrToken: 'tok-1',
        jobId: 'job-1',
        status: 'queued' as const,
        queuePosition: 0,
        estimatedWaitSeconds: 0,
      };
      vi.mocked(api.post).mockResolvedValue({
        data: { statusCode: 202, message: 'Accepted', data: innerPayload },
      });

      const result = await reOcrService.trigger('att-uuid-1', 'np-dms-ocr', 'idem-1');

      expect(api.post).toHaveBeenCalledWith(
        '/files/att-uuid-1/re-ocr',
        { engineType: 'np-dms-ocr' },
        { headers: { 'Idempotency-Key': 'idem-1' } }
      );
      expect(result).toEqual(innerPayload);
    });
  });

  describe('getStatus', () => {
    it('should GET status and unwrap data.data', async () => {
      const innerPayload = {
        status: 'processing' as const,
        reOcrToken: 'tok-1',
        jobId: 'job-1',
        engineType: 'np-dms-ocr',
        triggeredByDisplayName: 'Admin',
        triggeredAt: '2026-09-19T00:00:00Z',
      };
      vi.mocked(api.get).mockResolvedValue({
        data: { statusCode: 200, message: 'OK', data: innerPayload },
      });

      const result = await reOcrService.getStatus('att-uuid-1');

      expect(api.get).toHaveBeenCalledWith('/files/att-uuid-1/re-ocr/status');
      expect(result).toEqual(innerPayload);
    });

    it('should return null on 404 (no job / pointer expired)', async () => {
      vi.mocked(api.get).mockRejectedValue({
        isAxiosError: true,
        response: { status: 404 },
      });

      const result = await reOcrService.getStatus('att-uuid-1');

      expect(result).toBeNull();
    });

    it('should rethrow non-404 errors', async () => {
      const serverError = {
        isAxiosError: true,
        response: { status: 500 },
      };
      vi.mocked(api.get).mockRejectedValue(serverError);

      await expect(reOcrService.getStatus('att-uuid-1')).rejects.toBe(serverError);
    });
  });

  describe('confirm', () => {
    it('should POST reOcrToken + Idempotency-Key and unwrap data.data', async () => {
      const innerPayload = {
        status: 'confirmed' as const,
        ragStatus: 'PENDING' as const,
        reindexQueued: true,
      };
      vi.mocked(api.post).mockResolvedValue({
        data: { statusCode: 200, message: 'OK', data: innerPayload },
      });

      const result = await reOcrService.confirm('att-uuid-1', 'tok-1', 'idem-2');

      expect(api.post).toHaveBeenCalledWith(
        '/files/att-uuid-1/re-ocr/confirm',
        { reOcrToken: 'tok-1' },
        { headers: { 'Idempotency-Key': 'idem-2' } }
      );
      expect(result).toEqual(innerPayload);
    });
  });

  describe('triggerReplace (ADR-055 D19)', () => {
    it('should POST /re-ocr/replace with body + Idempotency-Key and unwrap data.data', async () => {
      const innerPayload = {
        reOcrToken: 'tok-9',
        jobId: 'job-9',
        status: 'queued' as const,
        queuePosition: 1,
        estimatedWaitSeconds: 180,
      };
      vi.mocked(api.post).mockResolvedValue({
        data: { statusCode: 202, message: 'Accepted', data: innerPayload },
      });

      const body = {
        engineType: 'np-dms-ocr' as const,
        targetCorrespondencePublicId: 'corr-1',
        storageTempPath: '/staging/new.pdf',
      };
      const result = await reOcrService.triggerReplace('att-uuid-1', body, 'idem-9');

      expect(api.post).toHaveBeenCalledWith(
        '/files/att-uuid-1/re-ocr/replace',
        body,
        { headers: { 'Idempotency-Key': 'idem-9' } }
      );
      expect(result).toEqual(innerPayload);
    });
  });

  describe('listLinks (ADR-055 D22)', () => {
    it('should GET /re-ocr/links and unwrap data.data', async () => {
      const links = [
        {
          correspondencePublicId: 'corr-1',
          correspondenceNumber: 'คคง.-สคฉ.3-03-21-0004-2567',
          revisionPublicId: 'rev-1',
          revisionNumber: 3,
          isCurrent: true,
          isMainDocument: true,
        },
      ];
      vi.mocked(api.get).mockResolvedValue({
        data: { statusCode: 200, message: 'OK', data: links },
      });

      const result = await reOcrService.listLinks('att-uuid-1');

      expect(api.get).toHaveBeenCalledWith('/files/att-uuid-1/re-ocr/links');
      expect(result).toEqual(links);
    });
  });
});
