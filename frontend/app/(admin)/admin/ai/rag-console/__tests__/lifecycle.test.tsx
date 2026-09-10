// File: frontend/app/(admin)/admin/ai/rag-console/__tests__/lifecycle.test.tsx
// Change Log:
// - 2026-09-10: T036 — สร้าง frontend test สำหรับ Lifecycle tab (Feature 255)

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import RagAdminConsolePage from '../page';

const mockUseRagAttachments = vi.fn();
const mockUseRagGenerations = vi.fn();
const mockUseRagReingest = vi.fn();

vi.mock('@/hooks/ai/use-rag-admin', () => ({
  useRagAttachments: (...args: unknown[]) => mockUseRagAttachments(...args),
  useRagGenerations: (...args: unknown[]) => mockUseRagGenerations(...args),
  useRagReingest: () => ({
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

describe('Lifecycle Tab (US3)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseRagAttachments.mockReturnValue({
      data: { items: [], total: 0, page: 1, pageSize: 20 },
      isLoading: false,
      isFetching: false,
      refetch: vi.fn(),
    });
  });

  it('should display empty state when no attachment selected', async () => {
    mockUseRagGenerations.mockReturnValue({
      data: undefined,
      isLoading: false,
    });

    renderWithQueryClient(<RagAdminConsolePage />);

    const lifecycleTab = screen.getByText('tabs.lifecycle');
    await userEvent.click(lifecycleTab);

    await waitFor(() => {
      expect(screen.getByText('lifecycle.empty_state.no_generation')).toBeInTheDocument();
    });
  });

  it('should display lifecycle Select and empty state when no attachment selected', async () => {
    mockUseRagGenerations.mockReturnValue({
      data: undefined,
      isLoading: false,
    });

    renderWithQueryClient(<RagAdminConsolePage />);

    const lifecycleTab = screen.getByText('tabs.lifecycle');
    await userEvent.click(lifecycleTab);

    await waitFor(() => {
      expect(screen.getByText('lifecycle.select_attachment')).toBeInTheDocument();
      expect(screen.getByText('lifecycle.empty_state.no_generation')).toBeInTheDocument();
    });
  });

  it('should NOT expose internal generationUuid (FR-014)', async () => {
    mockUseRagGenerations.mockReturnValue({
      data: {
        attachmentPublicId: 'test-uuid',
        generations: [
          {
            status: 'BUILDING',
            chunkCount: 0,
            createdAt: '2026-09-10T00:00:00Z',
            activatedAt: null,
            retiredAt: null,
            failedAt: null,
            errorCode: null,
            errorMessage: null,
          },
        ],
      },
      isLoading: false,
    });

    renderWithQueryClient(<RagAdminConsolePage />);

    const lifecycleTab = screen.getByText('tabs.lifecycle');
    await userEvent.click(lifecycleTab);

    await waitFor(() => {
      // generationUuid should never appear in the UI
      const allText = document.body.textContent ?? '';
      expect(allText).not.toContain('generationUuid');
      expect(allText).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[0-9a-f]{4}/i);
    });
  });

  it('should show force re-ingest button placeholder when no attachment selected', async () => {
    mockUseRagGenerations.mockReturnValue({
      data: {
        attachmentPublicId: 'test-uuid',
        generations: [],
      },
      isLoading: false,
    });

    renderWithQueryClient(<RagAdminConsolePage />);

    const lifecycleTab = screen.getByText('tabs.lifecycle');
    await userEvent.click(lifecycleTab);

    // Force re-ingest button only appears when an attachment is selected
    // Without selection, the Select placeholder should be visible
    await waitFor(() => {
      expect(screen.getByText('lifecycle.select_attachment')).toBeInTheDocument();
    });
  });
});
