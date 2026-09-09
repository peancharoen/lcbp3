// File: frontend/lib/services/__tests__/import-review.service.test.ts
// Change Log:
// - 2026-09-09: Initial creation — test coverage for import-review service
//   (Feature 252, ADR-052, T029)

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { importReviewService } from '../import-review.service';
import api from '@/lib/api/client';
import type { CheckReviewResponse, ConfirmReviewResponse, CancelReviewResponse } from '@/types/import-review';

vi.mock('@/lib/api/client', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

const SESSION_ID = '019505a1-7c3e-7000-8000-item111111111';

describe('importReviewService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
    global.URL.revokeObjectURL = vi.fn();
  });

  describe('check', () => {
    it('ควรส่ง multipart/form-data พร้อม query params ที่ถูกต้อง', async () => {
      const mockResponse: CheckReviewResponse = {
        reviewSessionPublicId: SESSION_ID,
        targetMode: 'DIRECT_IMPORT',
        totalRows: 10,
        passCount: 8,
        warnCount: 2,
        blockCount: 0,
        aiSuggestCount: 1,
        canConfirm: true,
        downloadAnnotatedUrl: `/api/v1/correspondence/import-review/${SESSION_ID}/download-annotated`,
        findings: [],
        aiAvailable: true,
        aiReviewedRowCount: 10,
        aiSamplingMode: 'FULL',
      };
      vi.mocked(api.post).mockResolvedValue({ data: mockResponse });

      const file = new File(['dummy'], 'register.xlsx');
      const result = await importReviewService.check({
        projectPublicId: 'proj-1',
        targetMode: 'DIRECT_IMPORT',
        aiProvider: 'LOCAL_OLLAMA',
        batchStrategy: 'FULL',
        file,
      });

      expect(result).toEqual(mockResponse);
      expect(api.post).toHaveBeenCalledWith(
        '/v1/correspondence/import-review/check',
        expect.any(FormData),
        expect.objectContaining({
          params: {
            projectPublicId: 'proj-1',
            targetMode: 'DIRECT_IMPORT',
            aiProvider: 'LOCAL_OLLAMA',
            batchStrategy: 'FULL',
          },
          headers: { 'Content-Type': 'multipart/form-data' },
        })
      );
    });

    it('ควรแกะ nested data wrapper ออกก่อนคืนค่า', async () => {
      const mockResponse: Partial<CheckReviewResponse> = { reviewSessionPublicId: SESSION_ID };
      vi.mocked(api.post).mockResolvedValue({ data: { data: mockResponse } });

      const result = await importReviewService.check({
        projectPublicId: 'proj-1',
        targetMode: 'DIRECT_IMPORT',
        aiProvider: 'LOCAL_OLLAMA',
        batchStrategy: 'FULL',
        file: new File(['dummy'], 'register.xlsx'),
      });

      expect(result).toEqual(mockResponse);
    });
  });

  describe('downloadAnnotated', () => {
    it('ควรเรียก GET download-annotated แบบ responseType blob และ trigger การดาวน์โหลด', async () => {
      const mockBlob = new Blob(['xlsx-bytes']);
      vi.mocked(api.get).mockResolvedValue({ data: mockBlob });

      const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

      await importReviewService.downloadAnnotated(SESSION_ID);

      expect(api.get).toHaveBeenCalledWith(
        `/v1/correspondence/import-review/${SESSION_ID}/download-annotated`,
        { responseType: 'blob' }
      );
      expect(global.URL.createObjectURL).toHaveBeenCalledWith(mockBlob);
      expect(clickSpy).toHaveBeenCalled();
      expect(global.URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');

      clickSpy.mockRestore();
    });
  });

  describe('downloadFailedRows', () => {
    it('ควรเรียก GET download-failed-rows แบบ responseType blob และ trigger การดาวน์โหลด', async () => {
      const mockBlob = new Blob(['xlsx-bytes']);
      vi.mocked(api.get).mockResolvedValue({ data: mockBlob });
      const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

      await importReviewService.downloadFailedRows(SESSION_ID);

      expect(api.get).toHaveBeenCalledWith(
        `/v1/correspondence/import-review/${SESSION_ID}/download-failed-rows`,
        { responseType: 'blob' }
      );
      expect(clickSpy).toHaveBeenCalled();

      clickSpy.mockRestore();
    });
  });

  describe('confirm', () => {
    it('ควรเรียก POST confirm ด้วย sessionId ที่ถูกต้อง', async () => {
      const mockResponse: ConfirmReviewResponse = {
        reviewSessionPublicId: SESSION_ID,
        batchId: 'batch-1',
        targetMode: 'DIRECT_IMPORT',
        totalRows: 10,
        enqueuedCount: 10,
        quarantinedCount: 0,
        failedRowsDownloadUrl: '',
        status: 'CONFIRMED',
      };
      vi.mocked(api.post).mockResolvedValue({ data: mockResponse });

      const result = await importReviewService.confirm(SESSION_ID);

      expect(result).toEqual(mockResponse);
      expect(api.post).toHaveBeenCalledWith(`/v1/correspondence/import-review/${SESSION_ID}/confirm`);
    });
  });

  describe('cancel', () => {
    it('ควรเรียก POST cancel ด้วย sessionId ที่ถูกต้อง', async () => {
      const mockResponse: CancelReviewResponse = { reviewSessionPublicId: SESSION_ID, status: 'CANCELLED' };
      vi.mocked(api.post).mockResolvedValue({ data: mockResponse });

      const result = await importReviewService.cancel(SESSION_ID);

      expect(result).toEqual(mockResponse);
      expect(api.post).toHaveBeenCalledWith(`/v1/correspondence/import-review/${SESSION_ID}/cancel`);
    });
  });
});
