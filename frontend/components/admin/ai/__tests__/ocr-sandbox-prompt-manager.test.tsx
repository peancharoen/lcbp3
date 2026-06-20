// File: frontend/components/admin/ai/__tests__/ocr-sandbox-prompt-manager.test.tsx
// Change Log:
// - 2026-06-14: Add smoke coverage for OcrSandboxPromptManager sandbox/editor paths

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import OcrSandboxPromptManager from '../OcrSandboxPromptManager';
import { AiPrompt } from '@/types/ai-prompts';

const mocks = vi.hoisted(() => ({
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  refetchVersions: vi.fn(),
  createVersion: vi.fn(),
  activateVersion: vi.fn(),
  deleteVersion: vi.fn(),
  updateNote: vi.fn(),
  resetSandbox: vi.fn(),
  startPolling: vi.fn(),
}));

const prompts: AiPrompt[] = [
  {
    promptType: 'ocr_extraction',
    versionNumber: 2,
    template: 'Extract {{ocr_text}} with {{master_data_context}}',
    isActive: true,
    testResultJson: null,
    manualNote: null,
    lastTestedAt: null,
    activatedAt: '2026-06-01T00:00:00Z',
    createdAt: '2026-06-01T00:00:00Z',
  },
];

vi.mock('sonner', () => ({
  toast: {
    success: mocks.toastSuccess,
    error: mocks.toastError,
  },
}));

vi.mock('@/hooks/use-translations', () => ({
  useTranslations: () => (key: string, params?: Record<string, string>) => {
    if (key === 'ai.prompt.activeLabel') return `Active: v${params?.version}`;
    if (key === 'ai.prompt.charCount') return `${params?.count} / 4000 ตัวอักษร`;
    return key;
  },
}));

vi.mock('@/hooks/use-ai-prompts', () => ({
  useAiPrompts: () => ({
    versionsQuery: {
      data: prompts,
      isSuccess: true,
      isLoading: false,
      refetch: mocks.refetchVersions,
    },
    createMutation: { mutateAsync: mocks.createVersion, isPending: false },
    activateMutation: { mutateAsync: mocks.activateVersion, isPending: false },
    deleteMutation: { mutateAsync: mocks.deleteVersion, isPending: false },
    updateNoteMutation: { mutateAsync: mocks.updateNote, isPending: false },
  }),
  useSandboxRun: () => ({
    state: {
      isRunning: false,
      progress: 0,
      statusText: '',
      result: null,
    },
    jobId: null,
    reset: mocks.resetSandbox,
    startPolling: mocks.startPolling,
  }),
}));

vi.mock('@/hooks/use-master-data', () => ({
  useProjects: () => ({
    data: [
      {
        publicId: '019505a1-7c3e-7000-8000-abc123def201',
        projectCode: 'LCB3',
        projectName: 'Laem Chabang Phase 3',
      },
    ],
  }),
  useContracts: () => ({
    data: [
      {
        publicId: '019505a1-7c3e-7000-8000-abc123def301',
        contractCode: 'C01',
        contractName: 'Marine Works',
      },
    ],
  }),
}));

vi.mock('@/lib/services/admin-ai.service', () => ({
  adminAiService: {
    getOcrEngines: vi.fn().mockResolvedValue([
      {
        engineType: 'np_dms_ocr',
        engineName: 'np-dms-ocr',
        vramRequirementMB: 4096,
        isCurrentActive: true,
      },
    ]),
    getSandboxProfile: vi.fn().mockResolvedValue({
      temperature: 0.1,
      topP: 0.2,
      repeatPenalty: 1.1,
      maxTokens: 1024,
      numCtx: 4096,
      keepAliveSeconds: 0,
    }),
    getProductionDefaults: vi.fn().mockResolvedValue({
      temperature: 0.2,
      topP: 0.3,
      repeatPenalty: 1.2,
      maxTokens: 2048,
      numCtx: 8192,
      keepAliveSeconds: 60,
    }),
    saveSandboxProfile: vi.fn().mockResolvedValue({
      temperature: 0.2,
      topP: 0.3,
      repeatPenalty: 1.2,
      maxTokens: 2048,
      numCtx: 8192,
      keepAliveSeconds: 60,
    }),
    resetSandboxProfile: vi.fn().mockResolvedValue({
      temperature: 0.1,
      topP: 0.2,
      repeatPenalty: 1.1,
      maxTokens: 1024,
      numCtx: 4096,
      keepAliveSeconds: 0,
    }),
    applyProfile: vi.fn().mockResolvedValue({ ok: true }),
    submitSandboxOcr: vi.fn().mockResolvedValue({
      requestPublicId: '019505a1-7c3e-7000-8000-abc123def401',
    }),
    getSandboxJobStatus: vi.fn().mockResolvedValue({
      status: 'pending',
    }),
  },
}));

vi.mock('../PromptVersionHistory', () => ({
  default: ({ versions, onLoadTemplate }: { versions: AiPrompt[]; onLoadTemplate: (version: AiPrompt) => void }) => (
    <div data-testid="prompt-version-history">
      <span>{versions.length} versions</span>
      <button type="button" onClick={() => onLoadTemplate(versions[0])}>
        Load version
      </button>
    </div>
  ),
}));

const renderManager = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <OcrSandboxPromptManager />
    </QueryClientProvider>
  );
};

describe('OcrSandboxPromptManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('confirm', vi.fn().mockReturnValue(true));
  });

  it('ควร render sandbox tab พร้อม project, contract, engine และ history', async () => {
    renderManager();
    expect(screen.getByText('ai.prompt.tabSandbox')).toBeInTheDocument();
    expect(screen.getByText('Step 1: Run OCR Only')).toBeInTheDocument();
    expect(screen.getByTestId('prompt-version-history')).toHaveTextContent('1 versions');
    await waitFor(() => expect(screen.getByText(/np-dms-ocr/)).toBeInTheDocument());
  });

  it('ควรสลับไป editor และบันทึก prompt version ได้', async () => {
    mocks.createVersion.mockResolvedValueOnce(prompts[0]);
    renderManager();
    fireEvent.click(screen.getByText('ai.prompt.tabEditor'));
    expect(await screen.findByDisplayValue('Extract {{ocr_text}} with {{master_data_context}}')).toBeInTheDocument();
    fireEvent.click(screen.getByText('ai.prompt.saveVersion'));
    await waitFor(() => expect(mocks.createVersion).toHaveBeenCalledWith('Extract {{ocr_text}} with {{master_data_context}}'));
    expect(mocks.toastSuccess).toHaveBeenCalledWith('ai.prompt.saveVersionSuccess');
  });

  it('ควร load template จาก history เข้า editor', async () => {
    renderManager();
    fireEvent.click(screen.getByText('Load version'));
    expect(await screen.findByDisplayValue('Extract {{ocr_text}} with {{master_data_context}}')).toBeInTheDocument();
    expect(mocks.toastSuccess).toHaveBeenCalledWith('ai.prompt.loadSuccess');
  });
});
