// File: frontend/app/(admin)/admin/ai/rag-console/__tests__/retry.test.tsx
// Change Log:
// - 2026-09-10: T053 — สร้าง frontend test สำหรับ Retry tab (Feature 255)

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import RagAdminConsolePage from '../page';

const mockUseRagAttachments = vi.fn();
const mockUseRagFailedIngestions = vi.fn();
const mockUseRagBatchRetry = vi.fn();

vi.mock('@/hooks/ai/use-rag-admin', () => ({
  useRagAttachments: (...args: unknown[]) => mockUseRagAttachments(...args),
  useRagFailedIngestions: (...args: unknown[]) => mockUseRagFailedIngestions(...args),
  useRagBatchRetry: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('@/components/admin/ai/rag-console/rag-admin-i18n', () => ({
  ragAdminT: (key: string) => key,
  useRagAdminT: () => (key: string) => key,
}));

class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
window.ResizeObserver = ResizeObserver;

function renderWithQueryClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
  );
}

describe('Retry Tab (US5)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseRagAttachments.mockReturnValue({
      data: { items: [], total: 0, page: 1, pageSize: 20 },
      isLoading: false,
      isFetching: false,
      refetch: vi.fn(),
    });
  });

  it('should display empty state when no failures (Q41)', async () => {
    mockUseRagFailedIngestions.mockReturnValue({
      data: {
        ragFailures: { items: [], total: 0, page: 1, pageSize: 20 },
        aiPipelineFailures: { items: [], total: 0 },
      },
      isLoading: false,
    });

    renderWithQueryClient(<RagAdminConsolePage />);

    const retryTab = screen.getByText('tabs.retry');
    await userEvent.click(retryTab);

    await waitFor(() => {
      expect(screen.getByText('retry.empty_state.no_failures')).toBeInTheDocument();
    });
  });

  it('should display 2 sections: RAG failures + AI pipeline failures (Q31)', async () => {
    mockUseRagFailedIngestions.mockReturnValue({
      data: {
        ragFailures: {
          items: [
            {
              attachmentPublicId: 'uuid-1',
              originalFilename: 'failed.pdf',
              ragStatus: 'FAILED',
              errorCode: 'OCR_ERROR',
              errorMessage: 'OCR failed',
              failedAt: '2026-09-10T00:00:00Z',
            },
          ],
          total: 1,
          page: 1,
          pageSize: 20,
        },
        aiPipelineFailures: {
          items: [
            {
              attachmentPublicId: 'uuid-2',
              originalFilename: 'pipeline-failed.pdf',
              aiProcessingStatus: 'FAILED',
              errorMessage: null,
            },
          ],
          total: 1,
        },
      },
      isLoading: false,
    });

    renderWithQueryClient(<RagAdminConsolePage />);

    const retryTab = screen.getByText('tabs.retry');
    await userEvent.click(retryTab);

    await waitFor(() => {
      expect(screen.getByText('retry.rag_failures')).toBeInTheDocument();
      expect(screen.getByText('retry.ai_pipeline_failures')).toBeInTheDocument();
      expect(screen.getByText('failed.pdf')).toBeInTheDocument();
      expect(screen.getByText('pipeline-failed.pdf')).toBeInTheDocument();
    });
  });

  it('should display retry button for RAG failures section', async () => {
    mockUseRagFailedIngestions.mockReturnValue({
      data: {
        ragFailures: {
          items: [
            {
              attachmentPublicId: 'uuid-1',
              originalFilename: 'failed.pdf',
              ragStatus: 'FAILED',
              errorCode: null,
              errorMessage: null,
              failedAt: null,
            },
          ],
          total: 1,
          page: 1,
          pageSize: 20,
        },
        aiPipelineFailures: { items: [], total: 0 },
      },
      isLoading: false,
    });

    renderWithQueryClient(<RagAdminConsolePage />);

    const retryTab = screen.getByText('tabs.retry');
    await userEvent.click(retryTab);

    await waitFor(() => {
      expect(screen.getByText('retry.retry_all')).toBeInTheDocument();
    });
  });
});
