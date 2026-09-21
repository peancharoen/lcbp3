// File: frontend/hooks/ai/__tests__/use-re-ocr.test.ts
// Change Log
// - 2026-09-19: ADR-055 — unit tests สำหรับ use-re-ocr hooks
//   (status polling gate, trigger/confirm mutations, cache invalidation)

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { createTestQueryClient } from '@/lib/test-utils';
import {
  useReOcrStatus,
  useReOcrTrigger,
  useReOcrReplaceTrigger,
  useReOcrConfirm,
  useAttachmentLinks,
  RE_OCR_POLL_INTERVAL_MS,
} from '../use-re-ocr';
import { reOcrService } from '@/lib/services/re-ocr.service';

vi.mock('@/lib/services/re-ocr.service', () => ({
  reOcrService: {
    getStatus: vi.fn(),
    trigger: vi.fn(),
    triggerReplace: vi.fn(),
    listLinks: vi.fn(),
    confirm: vi.fn(),
  },
}));

describe('use-re-ocr hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('useReOcrStatus', () => {
    it('ควรดึงสถานะเมื่อ enabled และมี attachmentPublicId', async () => {
      const mockStatus = {
        status: 'processing' as const,
        reOcrToken: 'tok-1',
        jobId: 'job-1',
        engineType: 'np-dms-ocr',
        triggeredByDisplayName: 'Admin',
        triggeredAt: '2026-09-19T00:00:00Z',
      };
      vi.mocked(reOcrService.getStatus).mockResolvedValue(mockStatus);

      const { wrapper } = createTestQueryClient();
      const { result } = renderHook(() => useReOcrStatus('att-1', true), {
        wrapper,
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockStatus);
      expect(reOcrService.getStatus).toHaveBeenCalledWith('att-1');
    });

    it('ควรไม่ fetch เมื่อ enabled=false', () => {
      const { wrapper } = createTestQueryClient();
      const { result } = renderHook(() => useReOcrStatus('att-1', false), {
        wrapper,
      });

      expect(result.current.fetchStatus).toBe('idle');
      expect(reOcrService.getStatus).not.toHaveBeenCalled();
    });

    it('ควรไม่ fetch เมื่อ attachmentPublicId เป็น null', () => {
      const { wrapper } = createTestQueryClient();
      const { result } = renderHook(() => useReOcrStatus(null, true), {
        wrapper,
      });

      expect(result.current.fetchStatus).toBe('idle');
      expect(reOcrService.getStatus).not.toHaveBeenCalled();
    });
  });

  describe('useReOcrTrigger', () => {
    it('ควรเรียก trigger พร้อม engineType และ Idempotency-Key ที่สร้างใหม่', async () => {
      vi.mocked(reOcrService.trigger).mockResolvedValue({
        reOcrToken: 'tok-1',
        jobId: 'job-1',
        status: 'queued',
        queuePosition: 0,
        estimatedWaitSeconds: 0,
      });

      const { wrapper, queryClient } = createTestQueryClient();
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
      const { result } = renderHook(() => useReOcrTrigger('att-1'), { wrapper });

      result.current.mutate('auto');

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(reOcrService.trigger).toHaveBeenCalledWith(
        'att-1',
        'auto',
        expect.stringMatching(/^re-ocr-trigger-att-1-/)
      );
      // onSuccess ต้อง invalidate query key ของ status
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ['re-ocr', 'att-1'],
      });
    });
  });

  describe('useReOcrConfirm', () => {
    it('ควรเรียก confirm พร้อม token และ invalidate rag-admin caches', async () => {
      vi.mocked(reOcrService.confirm).mockResolvedValue({
        status: 'confirmed',
        ragStatus: 'PENDING',
        reindexQueued: true,
      });

      const { wrapper, queryClient } = createTestQueryClient();
      const removeSpy = vi.spyOn(queryClient, 'removeQueries');
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
      const { result } = renderHook(() => useReOcrConfirm('att-1'), { wrapper });

      result.current.mutate('tok-1');

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(reOcrService.confirm).toHaveBeenCalledWith(
        'att-1',
        'tok-1',
        expect.stringMatching(/^re-ocr-confirm-att-1-/)
      );
      // ล้างสถานะ re-ocr + refresh list/generations ให้ badge/timeline แสดง re-index
      expect(removeSpy).toHaveBeenCalledWith({ queryKey: ['re-ocr', 'att-1'] });
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ['rag-admin', 'attachments'],
      });
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ['rag-admin', 'generations', 'att-1'],
      });
    });
  });

  describe('useAttachmentLinks (ADR-055 D22)', () => {
    it('ควรดึง links เมื่อ enabled', async () => {
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
      vi.mocked(reOcrService.listLinks).mockResolvedValue(links);

      const { wrapper } = createTestQueryClient();
      const { result } = renderHook(() => useAttachmentLinks('att-1', true), {
        wrapper,
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(links);
      expect(reOcrService.listLinks).toHaveBeenCalledWith('att-1');
    });

    it('ควรไม่ fetch เมื่อ enabled=false', () => {
      const { wrapper } = createTestQueryClient();
      const { result } = renderHook(() => useAttachmentLinks('att-1', false), {
        wrapper,
      });
      expect(result.current.fetchStatus).toBe('idle');
      expect(reOcrService.listLinks).not.toHaveBeenCalled();
    });
  });

  describe('useReOcrReplaceTrigger (ADR-055 D19)', () => {
    it('ควรเรียก triggerReplace พร้อม body และ Idempotency-Key prefix re-ocr-replace', async () => {
      vi.mocked(reOcrService.triggerReplace).mockResolvedValue({
        reOcrToken: 'tok-2',
        jobId: 'job-2',
        status: 'queued',
        queuePosition: 0,
        estimatedWaitSeconds: 0,
      });

      const { wrapper, queryClient } = createTestQueryClient();
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
      const { result } = renderHook(() => useReOcrReplaceTrigger('att-1'), {
        wrapper,
      });

      const body = {
        engineType: 'np-dms-ocr' as const,
        targetCorrespondencePublicId: 'corr-1',
        tempAttachmentPublicId: 'cand-1',
      };
      result.current.mutate(body);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(reOcrService.triggerReplace).toHaveBeenCalledWith(
        'att-1',
        body,
        expect.stringMatching(/^re-ocr-replace-att-1-/)
      );
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ['re-ocr', 'att-1'],
      });
    });
  });

  it('poll interval ควรเป็น 3 วินาทีตาม ADR-055 D14', () => {
    expect(RE_OCR_POLL_INTERVAL_MS).toBe(3000);
  });
});
