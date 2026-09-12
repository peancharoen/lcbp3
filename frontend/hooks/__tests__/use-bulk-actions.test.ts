// File: frontend/hooks/__tests__/use-bulk-actions.test.ts
// Change Log:
// - 2026-09-12: Unit tests สำหรับ useBulkActions hook (Feature 253 — Phase 2 Frontend Unit)

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { createTestQueryClient } from '@/lib/test-utils';
import { useBulkActions } from '../use-bulk-actions';
import { documentActionService } from '@/lib/services/document-action.service';
import { toast } from 'sonner';

vi.mock('@/lib/services/document-action.service', () => ({
  documentActionService: {
    bulkCancel: vi.fn(),
    bulkTag: vi.fn(),
    bulkExport: vi.fn(),
    getBulkProgress: vi.fn(),
  },
}));

vi.mock('@/hooks/use-translations', () => ({
  useTranslations: () => (key: string, _params?: Record<string, unknown>) => key,
}));

vi.mock('@/lib/api/client', () => ({
  parseApiError: vi.fn().mockReturnValue({ error: { message: 'API error' } }),
}));

describe('useBulkActions (Feature 253 — Phase 2 Frontend Unit)', () => {
  const documentType = 'CORRESPONDENCE';
  const publicIds = ['019505a1-7c3e-7000-8000-abc123def456'];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('bulkCancel: เรียก documentActionService.bulkCancel', async () => {
    const { wrapper } = createTestQueryClient();
    (documentActionService.bulkCancel as jest.Mock).mockResolvedValue({
      bulkId: 'bulk-123',
    });
    (documentActionService.getBulkProgress as jest.Mock).mockResolvedValue({
      total: 1,
      completed: 1,
      failed: 0,
    });

    const { result } = renderHook(
      () => useBulkActions({ documentType }),
      { wrapper },
    );

    result.current.bulkCancel({ publicIds, reason: 'test' });

    await waitFor(() => {
      expect(documentActionService.bulkCancel).toHaveBeenCalledWith(
        publicIds,
        documentType,
        'test',
      );
    });
  });

  it('bulkTag: เรียก documentActionService.bulkTag', async () => {
    const { wrapper } = createTestQueryClient();
    (documentActionService.bulkTag as jest.Mock).mockResolvedValue({
      bulkId: 'bulk-456',
    });
    (documentActionService.getBulkProgress as jest.Mock).mockResolvedValue({
      total: 1,
      completed: 1,
      failed: 0,
    });

    const { result } = renderHook(
      () => useBulkActions({ documentType }),
      { wrapper },
    );

    result.current.bulkTag({ publicIds, addTags: [1, 2] });

    await waitFor(() => {
      expect(documentActionService.bulkTag).toHaveBeenCalledWith(
        publicIds,
        documentType,
        [1, 2],
        undefined,
      );
    });
  });

  it('bulkExport: เรียก documentActionService.bulkExport + window.open เมื่อมี downloadUrl', async () => {
    const { wrapper } = createTestQueryClient();
    (documentActionService.bulkExport as jest.Mock).mockResolvedValue({
      bulkId: 'bulk-789',
      downloadUrl: '/api/documents/bulk/bulk-789/download',
    });
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

    const { result } = renderHook(
      () => useBulkActions({ documentType }),
      { wrapper },
    );

    result.current.bulkExport({ publicIds, format: 'CSV' });

    await waitFor(() => {
      expect(documentActionService.bulkExport).toHaveBeenCalledWith(
        publicIds,
        documentType,
        'CSV',
        undefined,
      );
    });
    await waitFor(() => {
      expect(openSpy).toHaveBeenCalledWith('/api/documents/bulk/bulk-789/download', '_blank');
    });
    openSpy.mockRestore();
  });

  it('isBulkCancelling: true เมื่อ bulkCancel กำลังทำงาน', async () => {
    const { wrapper } = createTestQueryClient();
    let resolveCancel: (value: unknown) => void;
    (documentActionService.bulkCancel as jest.Mock).mockImplementation(
      () => new Promise((resolve) => { resolveCancel = resolve; }),
    );

    const { result } = renderHook(
      () => useBulkActions({ documentType }),
      { wrapper },
    );

    result.current.bulkCancel({ publicIds });

    await waitFor(() => {
      expect(result.current.isBulkCancelling).toBe(true);
    });

    resolveCancel!({ bulkId: 'bulk-123' });

    await waitFor(() => {
      expect(result.current.isBulkCancelling).toBe(false);
    });
  });

  it('activeBulkId: clear เมื่อ bulkCancel สำเร็จ + progress เสร็จ', async () => {
    const { wrapper } = createTestQueryClient();
    (documentActionService.bulkCancel as jest.Mock).mockResolvedValue({
      bulkId: 'bulk-active-1',
    });
    (documentActionService.getBulkProgress as jest.Mock).mockResolvedValue({
      total: 2,
      completed: 2,
      failed: 0,
    });

    const { result } = renderHook(
      () => useBulkActions({ documentType }),
      { wrapper },
    );

    result.current.bulkCancel({ publicIds });

    // activeBulkId จะถูก set แล้ว clear เมื่อ progress เสร็จ (polling ทันที)
    await waitFor(() => {
      expect(result.current.activeBulkId).toBeNull();
    });
  });
});
