// File: frontend/app/(admin)/admin/ai/prompt-management/__tests__/page.test.tsx
// Change Log:
// - 2026-06-18: Created test for prompt-management page rendering and tab switching (gap-4)
// - 2026-09-01: Update for unified prompt management page with dynamic ai_prompt_types (Feature 251)

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import UnifiedPromptManagementPage from '../page';

const mockListPrompts = vi.fn();
const mockListPromptTypes = vi.fn();
const mockCreatePrompt = vi.fn();
const mockActivatePrompt = vi.fn();
const mockDeletePrompt = vi.fn();
const mockUpdateContextConfig = vi.fn();

vi.mock('@/lib/services/admin-ai.service', () => ({
  adminAiService: {
    listPromptTypes: (...args: unknown[]) => mockListPromptTypes(...args),
    listPrompts: (...args: unknown[]) => mockListPrompts(...args),
    createPrompt: (...args: unknown[]) => mockCreatePrompt(...args),
    activatePrompt: (...args: unknown[]) => mockActivatePrompt(...args),
    deletePrompt: (...args: unknown[]) => mockDeletePrompt(...args),
    updateContextConfig: (...args: unknown[]) => mockUpdateContextConfig(...args),
  },
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// ResizeObserver mock is needed for Radix UI tabs and select
class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
window.ResizeObserver = ResizeObserver;

describe('UnifiedPromptManagementPage', () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  beforeEach(() => {
    vi.clearAllMocks();
    window.PointerEvent = MouseEvent as unknown as typeof PointerEvent;
    mockListPromptTypes.mockResolvedValue([
      { publicId: '1', promptType: 'ocr_extraction', displayName: 'OCR Extraction', isSystemManaged: true, isActive: true },
      { publicId: '2', promptType: 'ocr_system', displayName: 'OCR System', isSystemManaged: true, isActive: true },
    ]);
  });

  const renderWithQueryClient = (component: React.ReactNode) => {
    return render(
      <QueryClientProvider client={queryClient}>
        {component}
      </QueryClientProvider>
    );
  };

  it('renders the unified page title and prompt type dropdown', async () => {
    mockListPrompts.mockResolvedValue([]);

    renderWithQueryClient(<UnifiedPromptManagementPage />);

    await waitFor(() => {
      expect(screen.getByText(/ระบบจัดการ Prompt และบริบท/i)).toBeInTheDocument();
    });

    expect(mockListPromptTypes).toHaveBeenCalled();
    expect(screen.getByText('prompt_management.prompt_type')).toBeInTheDocument();
  });

  it('renders Editor & Context, Sandbox, and Runtime Params tabs', async () => {
    mockListPrompts.mockResolvedValue([]);

    renderWithQueryClient(<UnifiedPromptManagementPage />);

    await waitFor(() => {
      expect(screen.getByText(/ระบบจัดการ Prompt และบริบท/i)).toBeInTheDocument();
    });

    // Check for the three main tabs
    expect(screen.getByText(/ตัวแก้ไขและบริบท/i)).toBeInTheDocument();
    expect(screen.getByText(/บอร์ดทดลอง/i)).toBeInTheDocument();
    expect(screen.getByText(/พารามิเตอร์รันไทม์/)).toBeInTheDocument();
  });

  it('loads prompt versions for the default selected prompt type', async () => {
    const mockVersions = [
      {
        versionNumber: 1,
        template: 'Test template',
        isActive: true,
        contextConfig: null,
        manualNote: 'Initial version',
        createdAt: '2026-06-18T00:00:00Z',
      },
    ];

    mockListPrompts.mockResolvedValue(mockVersions);

    renderWithQueryClient(<UnifiedPromptManagementPage />);

    await waitFor(() => {
      expect(mockListPrompts).toHaveBeenCalled();
    });

    // Verify that the API was called with the default prompt type
    expect(mockListPrompts).toHaveBeenCalledWith('ocr_extraction');
  });
});
