// File: frontend/app/(admin)/admin/ai/rag-console/__tests__/classification.test.tsx
// Change Log:
// - 2026-09-10: T027 — สร้าง frontend test สำหรับ Classification tab (Feature 255)

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import RagAdminConsolePage from '../page';

// Mock hooks
const mockUseRagAttachments = vi.fn();
const mockUseRagClassificationList = vi.fn();
const mockUseRagClassificationOverride = vi.fn();

vi.mock('@/hooks/ai/use-rag-admin', () => ({
  useRagAttachments: (...args: unknown[]) => mockUseRagAttachments(...args),
  useRagClassificationList: (...args: unknown[]) => mockUseRagClassificationList(...args),
  useRagClassificationOverride: () => ({
    mutateAsync: vi.fn(),
  }),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('@/components/admin/ai/rag-console/rag-admin-i18n', () => ({
  ragAdminT: (key: string) => key,
  useRagAdminT: () => (key: string) => key,
}));

vi.mock('@/lib/stores/auth-store', () => ({
  useAuthStore: (selector: (s: { hasPermission: (p: string) => boolean }) => boolean) =>
    selector({ hasPermission: (p: string) => p === 'document.classification_override' }),
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

describe('Classification Tab (US2)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseRagAttachments.mockReturnValue({
      data: { items: [], total: 0, page: 1, pageSize: 20 },
      isLoading: false,
      isFetching: false,
      refetch: vi.fn(),
    });
  });

  it('should display classification empty state when no data (Q41)', async () => {
    mockUseRagClassificationList.mockReturnValue({
      data: { items: [], total: 0, page: 1, pageSize: 20 },
      isLoading: false,
    });

    renderWithQueryClient(<RagAdminConsolePage />);

    // Switch to classification tab
    const classificationTab = screen.getByText('tabs.classification');
    await userEvent.click(classificationTab);

    await waitFor(() => {
      expect(screen.getByText('classification.empty_state.no_data')).toBeInTheDocument();
    });
  });

  it('should display attachment list with classification badges', async () => {
    mockUseRagClassificationList.mockReturnValue({
      data: {
        items: [
          {
            attachmentPublicId: 'test-uuid-1',
            originalFilename: 'doc1.pdf',
            effectiveClassification: 'CONFIDENTIAL',
            classificationOverride: null,
          },
        ],
        total: 1,
        page: 1,
        pageSize: 20,
      },
      isLoading: false,
    });

    renderWithQueryClient(<RagAdminConsolePage />);

    const classificationTab = screen.getByText('tabs.classification');
    await userEvent.click(classificationTab);

    await waitFor(() => {
      expect(screen.getByText('doc1.pdf')).toBeInTheDocument();
      expect(screen.getByText('CONFIDENTIAL')).toBeInTheDocument();
    });
  });

  it('should display override info when classificationOverride exists (Q11)', async () => {
    mockUseRagClassificationList.mockReturnValue({
      data: {
        items: [
          {
            attachmentPublicId: 'test-uuid-1',
            originalFilename: 'doc1.pdf',
            effectiveClassification: 'INTERNAL',
            classificationOverride: {
              reason: 'Security review',
              overriddenBy: 'admin',
              overriddenAt: '2026-09-10T00:00:00Z',
            },
          },
        ],
        total: 1,
        page: 1,
        pageSize: 20,
      },
      isLoading: false,
    });

    renderWithQueryClient(<RagAdminConsolePage />);

    const classificationTab = screen.getByText('tabs.classification');
    await userEvent.click(classificationTab);

    await waitFor(() => {
      expect(screen.getByText('doc1.pdf')).toBeInTheDocument();
      expect(screen.getByText('INTERNAL')).toBeInTheDocument();
      expect(screen.getAllByText('Security review').length).toBeGreaterThan(0);
    });
  });

  it('should hide override form and show permission denied when user lacks document.classification_override (SC-008)', async () => {
    // Override the auth-store mock for this test only
    vi.mocked(
      await import('@/lib/stores/auth-store')
    ).useAuthStore = (() => false) as unknown as typeof import('@/lib/stores/auth-store').useAuthStore;

    mockUseRagClassificationList.mockReturnValue({
      data: {
        items: [
          {
            attachmentPublicId: 'test-uuid-1',
            originalFilename: 'doc1.pdf',
            effectiveClassification: 'INTERNAL',
            classificationOverride: null,
          },
        ],
        total: 1,
        page: 1,
        pageSize: 20,
      },
      isLoading: false,
    });

    renderWithQueryClient(<RagAdminConsolePage />);

    const classificationTab = screen.getByText('tabs.classification');
    await userEvent.click(classificationTab);

    await waitFor(() => {
      expect(screen.getByText('doc1.pdf')).toBeInTheDocument();
      expect(screen.getByText('classification.permission_denied')).toBeInTheDocument();
    });
  });
});
