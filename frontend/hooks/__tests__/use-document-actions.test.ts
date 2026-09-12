// File: frontend/hooks/__tests__/use-document-actions.test.ts
// Change Log:
// - 2026-09-12: Unit tests สำหรับ useDocumentActions hook (Feature 253 — Phase 2 Frontend Unit)

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { createTestQueryClient } from '@/lib/test-utils';
import { useDocumentActions } from '../use-document-actions';
import { documentActionService } from '@/lib/services/document-action.service';
import { getDocumentActionConfig } from '@/components/documents/document-action-strategy';
import { toast } from 'sonner';

vi.mock('@/lib/services/document-action.service', () => ({
  documentActionService: {
    cancel: vi.fn(),
    hardDelete: vi.fn(),
    metadataPatch: vi.fn(),
  },
}));

vi.mock('@/hooks/use-translations', () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock('@/lib/api/client', () => ({
  parseApiError: vi.fn().mockReturnValue({ error: { message: 'API error' } }),
}));

describe('useDocumentActions (Feature 253 — Phase 2 Frontend Unit)', () => {
  const config = getDocumentActionConfig('CORRESPONDENCE');
  const publicId = '019505a1-7c3e-7000-8000-abc123def456';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('cancel: เรียก documentActionService.cancel + toast success', async () => {
    const { wrapper } = createTestQueryClient();
    (documentActionService.cancel as jest.Mock).mockResolvedValue({
      success: true,
      publicId,
      action: 'cancel',
    });

    const { result } = renderHook(
      () => useDocumentActions({ config }),
      { wrapper },
    );

    result.current.cancel({ publicId, reason: 'test' });

    await waitFor(() => {
      expect(documentActionService.cancel).toHaveBeenCalledWith(
        config.apiBasePath,
        publicId,
        'test',
      );
    });
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith(config.successKey);
    });
  });

  it('cancel: เรียก toast.error เมื่อ error', async () => {
    const { wrapper } = createTestQueryClient();
    (documentActionService.cancel as jest.Mock).mockRejectedValue(
      new Error('fail'),
    );

    const { result } = renderHook(
      () => useDocumentActions({ config }),
      { wrapper },
    );

    result.current.cancel({ publicId });

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalled();
    });
  });

  it('hardDelete: เรียก documentActionService.hardDelete + toast success', async () => {
    const { wrapper } = createTestQueryClient();
    (documentActionService.hardDelete as jest.Mock).mockResolvedValue({
      success: true,
      publicId,
      action: 'hardDelete',
    });

    const { result } = renderHook(
      () => useDocumentActions({ config }),
      { wrapper },
    );

    result.current.hardDelete({ publicId });

    await waitFor(() => {
      expect(documentActionService.hardDelete).toHaveBeenCalledWith(
        config.apiBasePath,
        publicId,
      );
    });
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('document.hardDelete.success');
    });
  });

  it('metadataPatch: เรียก documentActionService.metadataPatch + toast success', async () => {
    const { wrapper } = createTestQueryClient();
    (documentActionService.metadataPatch as jest.Mock).mockResolvedValue({
      success: true,
      publicId,
      action: 'metadataPatch',
      newVersion: 2,
    });

    const { result } = renderHook(
      () => useDocumentActions({ config }),
      { wrapper },
    );

    result.current.metadataPatch({
      publicId,
      patch: { subject: 'new subject' },
      version: 1,
    });

    await waitFor(() => {
      expect(documentActionService.metadataPatch).toHaveBeenCalledWith(
        config.apiBasePath,
        publicId,
        { subject: 'new subject' },
        1,
      );
    });
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('document.metadata.success');
    });
  });

  it('onSuccess callback: เรียกเมื่อ mutation สำเร็จ', async () => {
    const { wrapper } = createTestQueryClient();
    const onSuccess = vi.fn();
    (documentActionService.cancel as jest.Mock).mockResolvedValue({
      success: true,
      publicId,
      action: 'cancel',
    });

    const { result } = renderHook(
      () => useDocumentActions({ config, onSuccess }),
      { wrapper },
    );

    result.current.cancel({ publicId });

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledWith('cancel', publicId);
    });
  });
});
