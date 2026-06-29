// File: frontend/components/admin/ai/__tests__/OcrSandboxPromptManager.test.tsx
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import OcrSandboxPromptManager from '../OcrSandboxPromptManager';

// Mock Hooks
vi.mock('@/hooks/use-ai-prompts', () => ({
  useAiPrompts: vi.fn(() => ({
    versionsQuery: { data: [], isSuccess: true, refetch: vi.fn() },
    createMutation: { mutateAsync: vi.fn(), isPending: false },
    activateMutation: { mutateAsync: vi.fn() },
    deleteMutation: { mutateAsync: vi.fn() },
    updateNoteMutation: { mutateAsync: vi.fn() },
  })),
  useSandboxRun: vi.fn(() => ({
    state: { isRunning: false },
    jobId: null,
    reset: vi.fn(),
    startPolling: vi.fn(),
  })),
}));

vi.mock('@/hooks/use-translations', () => ({
  useTranslations: vi.fn(() => (key: string) => key),
}));

vi.mock('@/hooks/use-master-data', () => ({
  useProjects: vi.fn(() => ({ data: [{ publicId: 'proj-1', projectCode: 'P1', projectName: 'Project 1' }] })),
  useContracts: vi.fn(() => ({ data: [] })),
}));

// Mock React Query
vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn(() => ({ data: [] })),
}));

// Mock Service
vi.mock('@/lib/services/admin-ai.service', () => ({
  adminAiService: {
    getOcrEngines: vi.fn().mockResolvedValue([]),
    getSandboxProfile: vi.fn().mockResolvedValue({}),
    getProductionDefaults: vi.fn().mockResolvedValue({}),
  },
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// We must mock PromptVersionHistory since it might rely on other complex contexts
vi.mock('../PromptVersionHistory', () => ({
  default: () => <div data-testid="mock-prompt-version-history" />,
}));

describe('OcrSandboxPromptManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders correctly and defaults to sandbox tab', async () => {
    const { container } = render(<OcrSandboxPromptManager />);
    
    await waitFor(() => {
      expect(screen.getByText('ai.prompt.sandboxCardTitle')).toBeInTheDocument();
    });
    
    expect(screen.getByText('ai.prompt.tabSandbox')).toBeInTheDocument();
    expect(screen.getByText('ai.prompt.tabEditor')).toBeInTheDocument();
  });

  it('switches to editor tab', async () => {
    const user = userEvent.setup();
    render(<OcrSandboxPromptManager />);
    
    await waitFor(() => {
      expect(screen.getByText('ai.prompt.tabEditor')).toBeInTheDocument();
    });

    const editorTab = screen.getByText('ai.prompt.tabEditor');
    await user.click(editorTab);

    expect(screen.getByText('ai.prompt.cardTitle')).toBeInTheDocument();
  });

  it('handles rate limiting (429/503) errors gracefully on OCR submission', async () => {
    const user = userEvent.setup();
    const mockSubmitOcr = vi.fn().mockRejectedValue({
      response: { data: { message: 'Rate limit exceeded. Try again later.' } }
    });
    
    // Override the mock implementation for this test
    const { adminAiService } = await import('@/lib/services/admin-ai.service');
    (adminAiService.submitSandboxOcr as any) = mockSubmitOcr;

    render(<OcrSandboxPromptManager />);

    // Select project
    const selects = document.querySelectorAll('select');
    const projectSelect = selects[0]; // First select is Project
    await userEvent.selectOptions(projectSelect, 'proj-1');

    // Simulate file drop/upload
    const file = new File(['dummy content'], 'test.pdf', { type: 'application/pdf' });
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    await userEvent.upload(fileInput, file);

    const submitButton = screen.getByRole('button', { name: /Step 1: Run OCR Only/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockSubmitOcr).toHaveBeenCalled();
    });

    // Check if error toast was called
    const { toast } = await import('sonner');
    expect(toast.error).toHaveBeenCalledWith('Rate limit exceeded. Try again later.');
  });
});
