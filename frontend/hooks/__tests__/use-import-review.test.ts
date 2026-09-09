// File: frontend/hooks/__tests__/use-import-review.test.ts
// Change Log:
// - 2026-09-09: Initial creation — test coverage for use-import-review hooks
//   (Feature 252, ADR-052, T029)

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { createTestQueryClient } from '@/lib/test-utils';
import { useCheckImportReview, useConfirmImportReview, useCancelImportReview } from '../use-import-review';
import { importReviewService } from '@/lib/services/import-review.service';
import type { CheckReviewResponse, ConfirmReviewResponse, CancelReviewResponse } from '@/types/import-review';

vi.mock('@/lib/services/import-review.service', () => ({
  importReviewService: {
    check: vi.fn(),
    confirm: vi.fn(),
    cancel: vi.fn(),
    downloadAnnotated: vi.fn(),
    downloadFailedRows: vi.fn(),
  },
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const SESSION_ID = '019505a1-7c3e-7000-8000-item111111111';

describe('use-import-review hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('useCheckImportReview', () => {
    it('ควรเรียก importReviewService.check และคืนผลลัพธ์สำเร็จ', async () => {
      const mockResponse: CheckReviewResponse = {
        reviewSessionPublicId: SESSION_ID,
        targetMode: 'DIRECT_IMPORT',
        totalRows: 5,
        passCount: 5,
        warnCount: 0,
        blockCount: 0,
        aiSuggestCount: 0,
        canConfirm: true,
        downloadAnnotatedUrl: 'x',
        findings: [],
        aiAvailable: true,
        aiReviewedRowCount: 5,
        aiSamplingMode: 'FULL',
      };
      vi.mocked(importReviewService.check).mockResolvedValue(mockResponse);

      const { wrapper } = createTestQueryClient();
      const { result } = renderHook(() => useCheckImportReview(), { wrapper });

      await act(async () => {
        await result.current.mutateAsync({
          projectPublicId: 'proj-1',
          targetMode: 'DIRECT_IMPORT',
          aiProvider: 'LOCAL_OLLAMA',
          batchStrategy: 'FULL',
          file: new File(['x'], 'a.xlsx'),
        });
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockResponse);
    });

    it('ควรแจ้ง error เมื่อ check ล้มเหลว', async () => {
      const { toast } = await import('sonner');
      vi.mocked(importReviewService.check).mockRejectedValue(new Error('boom'));

      const { wrapper } = createTestQueryClient();
      const { result } = renderHook(() => useCheckImportReview(), { wrapper });

      await act(async () => {
        try {
          await result.current.mutateAsync({
            projectPublicId: 'proj-1',
            targetMode: 'DIRECT_IMPORT',
            aiProvider: 'LOCAL_OLLAMA',
            batchStrategy: 'FULL',
            file: new File(['x'], 'a.xlsx'),
          });
        } catch {
          // expected
        }
      });

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(toast.error).toHaveBeenCalled();
    });
  });

  describe('useConfirmImportReview', () => {
    it('ควรเรียก importReviewService.confirm ด้วย sessionId และแจ้งสำเร็จ', async () => {
      const { toast } = await import('sonner');
      const mockResponse: ConfirmReviewResponse = {
        reviewSessionPublicId: SESSION_ID,
        batchId: 'batch-1',
        targetMode: 'DIRECT_IMPORT',
        totalRows: 5,
        enqueuedCount: 5,
        quarantinedCount: 0,
        failedRowsDownloadUrl: '',
        status: 'CONFIRMED',
      };
      vi.mocked(importReviewService.confirm).mockResolvedValue(mockResponse);

      const { wrapper } = createTestQueryClient();
      const { result } = renderHook(() => useConfirmImportReview(), { wrapper });

      await act(async () => {
        await result.current.mutateAsync(SESSION_ID);
      });

      expect(importReviewService.confirm).toHaveBeenCalledWith(SESSION_ID);
      expect(toast.success).toHaveBeenCalled();
    });

    it('ควรแสดงจำนวน quarantine ใน toast เมื่อมีแถวถูกกักกัน', async () => {
      const { toast } = await import('sonner');
      const mockResponse: ConfirmReviewResponse = {
        reviewSessionPublicId: SESSION_ID,
        batchId: 'batch-1',
        targetMode: 'MIGRATION_STAGING',
        totalRows: 10,
        enqueuedCount: 8,
        quarantinedCount: 2,
        failedRowsDownloadUrl: '/download',
        status: 'CONFIRMED',
      };
      vi.mocked(importReviewService.confirm).mockResolvedValue(mockResponse);

      const { wrapper } = createTestQueryClient();
      const { result } = renderHook(() => useConfirmImportReview(), { wrapper });

      await act(async () => {
        await result.current.mutateAsync(SESSION_ID);
      });

      expect(toast.success).toHaveBeenCalledWith(
        'ยืนยันนำเข้าข้อมูลสำเร็จ',
        expect.objectContaining({ description: expect.stringContaining('กักกัน 2 แถว') })
      );
    });
  });

  describe('useCancelImportReview', () => {
    it('ควรเรียก importReviewService.cancel ด้วย sessionId และแจ้งสำเร็จ', async () => {
      const { toast } = await import('sonner');
      const mockResponse: CancelReviewResponse = { reviewSessionPublicId: SESSION_ID, status: 'CANCELLED' };
      vi.mocked(importReviewService.cancel).mockResolvedValue(mockResponse);

      const { wrapper } = createTestQueryClient();
      const { result } = renderHook(() => useCancelImportReview(), { wrapper });

      await act(async () => {
        await result.current.mutateAsync(SESSION_ID);
      });

      expect(importReviewService.cancel).toHaveBeenCalledWith(SESSION_ID);
      expect(toast.success).toHaveBeenCalled();
    });
  });
});
