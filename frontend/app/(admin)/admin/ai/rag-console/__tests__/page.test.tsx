// File: frontend/app/(admin)/admin/ai/rag-console/__tests__/page.test.tsx
// Change Log:
// - 2026-09-10: T021 — สร้าง frontend test สำหรับ RAG Admin Console page (Feature 255)

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import RagAdminConsolePage from '../page';

// Mock the hooks
const mockUseRagAttachments = vi.fn();
vi.mock('@/hooks/ai/use-rag-admin', () => ({
  useRagAttachments: (...args: unknown[]) => mockUseRagAttachments(...args),
}));

// Mock sonner
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock translations
vi.mock('@/components/admin/ai/rag-console/rag-admin-i18n', () => ({
  ragAdminT: (key: string) => key,
  useRagAdminT: () => (key: string) => key,
}));

// ResizeObserver mock for Radix UI
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

describe('RagAdminConsolePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render page title', async () => {
    mockUseRagAttachments.mockReturnValue({
      data: { items: [], total: 0, page: 1, pageSize: 20 },
      isLoading: false,
      isFetching: false,
      refetch: vi.fn(),
    });

    renderWithQueryClient(<RagAdminConsolePage />);

    await waitFor(() => {
      expect(screen.getByText('title')).toBeInTheDocument();
    });
  });

  it('should render 5 tabs (Q23, Q24)', async () => {
    mockUseRagAttachments.mockReturnValue({
      data: { items: [], total: 0, page: 1, pageSize: 20 },
      isLoading: false,
      isFetching: false,
      refetch: vi.fn(),
    });

    renderWithQueryClient(<RagAdminConsolePage />);

    await waitFor(() => {
      expect(screen.getByText('tabs.dashboard')).toBeInTheDocument();
      expect(screen.getByText('tabs.classification')).toBeInTheDocument();
      expect(screen.getByText('tabs.lifecycle')).toBeInTheDocument();
      expect(screen.getByText('tabs.metrics')).toBeInTheDocument();
      expect(screen.getByText('tabs.retry')).toBeInTheDocument();
    });
  });

  it('should show empty state when no attachments (Q41)', async () => {
    mockUseRagAttachments.mockReturnValue({
      data: { items: [], total: 0, page: 1, pageSize: 20 },
      isLoading: false,
      isFetching: false,
      refetch: vi.fn(),
    });

    renderWithQueryClient(<RagAdminConsolePage />);

    await waitFor(() => {
      expect(screen.getByText('dashboard.empty_state.no_data')).toBeInTheDocument();
    });
  });

  it('should show loading state while fetching', async () => {
    mockUseRagAttachments.mockReturnValue({
      data: undefined,
      isLoading: true,
      isFetching: false,
      refetch: vi.fn(),
    });

    renderWithQueryClient(<RagAdminConsolePage />);

    await waitFor(() => {
      expect(screen.getByText('common.loading')).toBeInTheDocument();
    });
  });

  it('should render attachment rows when data exists', async () => {
    mockUseRagAttachments.mockReturnValue({
      data: {
        items: [
          {
            attachmentPublicId: 'test-uuid-1',
            originalFilename: 'test.pdf',
            mimeType: 'application/pdf',
            ragStatus: 'ACTIVE',
            aiProcessingStatus: 'DONE',
            chunkCount: 42,
            effectiveClassification: 'PUBLIC',
            classificationOverride: null,
            lastUpdated: '2026-09-10T00:00:00Z',
            errorMessage: null,
          },
        ],
        total: 1,
        page: 1,
        pageSize: 20,
      },
      isLoading: false,
      isFetching: false,
      refetch: vi.fn(),
    });

    renderWithQueryClient(<RagAdminConsolePage />);

    await waitFor(() => {
      expect(screen.getByText('test.pdf')).toBeInTheDocument();
      expect(screen.getByText('42')).toBeInTheDocument();
    });
  });
});
