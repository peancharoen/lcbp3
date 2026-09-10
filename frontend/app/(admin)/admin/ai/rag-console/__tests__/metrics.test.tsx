// File: frontend/app/(admin)/admin/ai/rag-console/__tests__/metrics.test.tsx
// Change Log:
// - 2026-09-10: T045 — สร้าง frontend test สำหรับ Metrics tab (Feature 255)

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import RagAdminConsolePage from '../page';

const mockUseRagAttachments = vi.fn();
const mockUseRagMetrics = vi.fn();
const mockUseRagMetricsReset = vi.fn();

vi.mock('@/hooks/ai/use-rag-admin', () => ({
  useRagAttachments: (...args: unknown[]) => mockUseRagAttachments(...args),
  useRagMetrics: (...args: unknown[]) => mockUseRagMetrics(...args),
  useRagMetricsReset: () => ({
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

describe('Metrics Tab (US4)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseRagAttachments.mockReturnValue({
      data: { items: [], total: 0, page: 1, pageSize: 20 },
      isLoading: false,
      isFetching: false,
      refetch: vi.fn(),
    });
  });

  it('should display empty state when no metrics data (Q41)', async () => {
    mockUseRagMetrics.mockReturnValue({
      data: undefined,
      isLoading: false,
    });

    renderWithQueryClient(<RagAdminConsolePage />);

    const metricsTab = screen.getByText('tabs.metrics');
    await userEvent.click(metricsTab);

    await waitFor(() => {
      expect(screen.getByText('metrics.empty_state.no_data')).toBeInTheDocument();
    });
  });

  it('should display 6 metric cards when data exists', async () => {
    mockUseRagMetrics.mockReturnValue({
      data: {
        ingestionDuration: { count: 10, sumMs: 5000, buckets: { '100': 5, '500': 3, '2000': 2 } },
        chunkCount: { totalChunks: 100, ingestions: 10 },
        vectorLatency: { count: 50, sumMs: 1000, buckets: { '50': 20, '100': 15, '500': 10, '2000': 5 } },
        staleResultRate: { filtered: 5, total: 100 },
        fallbackRate: { fullTextFallbacks: 3, totalQueries: 100 },
        cleanupRetryRate: { retries: 2 },
        uptimeMs: 60000,
      },
      isLoading: false,
    });

    renderWithQueryClient(<RagAdminConsolePage />);

    const metricsTab = screen.getByText('tabs.metrics');
    await userEvent.click(metricsTab);

    await waitFor(() => {
      expect(screen.getByText('metrics.cards.ingestion_duration')).toBeInTheDocument();
      expect(screen.getByText('metrics.cards.chunk_count')).toBeInTheDocument();
      expect(screen.getByText('metrics.cards.vector_latency')).toBeInTheDocument();
      expect(screen.getByText('metrics.cards.stale_result_rate')).toBeInTheDocument();
      expect(screen.getByText('metrics.cards.fallback_rate')).toBeInTheDocument();
      expect(screen.getByText('metrics.cards.cleanup_retry_rate')).toBeInTheDocument();
    });
  });

  it('should display reset button (global only — Q15)', async () => {
    mockUseRagMetrics.mockReturnValue({
      data: { uptimeMs: 1000 },
      isLoading: false,
    });

    renderWithQueryClient(<RagAdminConsolePage />);

    const metricsTab = screen.getByText('tabs.metrics');
    await userEvent.click(metricsTab);

    await waitFor(() => {
      expect(screen.getByText('metrics.reset')).toBeInTheDocument();
    });
  });
});
