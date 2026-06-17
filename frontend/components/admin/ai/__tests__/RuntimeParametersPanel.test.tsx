// File: frontend/components/admin/ai/__tests__/RuntimeParametersPanel.test.tsx
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import RuntimeParametersPanel from '../RuntimeParametersPanel';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

const mockGetSandboxProfile = vi.fn();
const mockSaveSandboxProfile = vi.fn();
const mockResetSandboxProfile = vi.fn();
const mockApplyProfile = vi.fn();

vi.mock('@/lib/services/admin-ai.service', () => ({
  adminAiService: {
    getSandboxProfile: (...args: any) => mockGetSandboxProfile(...args),
    saveSandboxProfile: (...args: any) => mockSaveSandboxProfile(...args),
    resetSandboxProfile: (...args: any) => mockResetSandboxProfile(...args),
    applyProfile: (...args: any) => mockApplyProfile(...args),
  },
}));

vi.mock('uuid', () => ({
  v7: () => 'mock-uuid-v7',
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// ResizeObserver mock is needed for Radix UI select
class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
window.ResizeObserver = ResizeObserver;

describe('RuntimeParametersPanel', () => {
  const mockParams = {
    temperature: 0.7,
    topP: 0.9,
    repeatPenalty: 1.1,
    maxTokens: 2048,
    numCtx: 4096,
    keepAliveSeconds: 300,
    canonicalModel: 'np-dms-ai-test',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSandboxProfile.mockResolvedValue(mockParams);
    window.PointerEvent = MouseEvent as any;
  });

  it('renders loading state initially', () => {
    // We mock promise without resolving immediately to see loading state
    let resolvePromise: any;
    mockGetSandboxProfile.mockReturnValue(new Promise((resolve) => {
      resolvePromise = resolve;
    }));
    
    render(<RuntimeParametersPanel />);
    expect(screen.getByText(/กำลังโหลดพารามิเตอร์/)).toBeInTheDocument();
    
    // Resolve to avoid act warnings
    resolvePromise(mockParams);
  });

  it('renders parameters after loading', async () => {
    render(<RuntimeParametersPanel />);
    
    await waitFor(() => {
      expect(screen.getByText('sandbox_test.runtime_parameters')).toBeInTheDocument();
    });

    expect(screen.getByText('np-dms-ai-test')).toBeInTheDocument();
    expect(screen.getByDisplayValue('2048')).toBeInTheDocument();
    expect(screen.getByDisplayValue('4096')).toBeInTheDocument();
    expect(screen.getByDisplayValue('300')).toBeInTheDocument();
  });

  it('calls save draft correctly', async () => {
    const user = userEvent.setup();
    mockSaveSandboxProfile.mockResolvedValue(mockParams);
    
    render(<RuntimeParametersPanel />);
    
    await waitFor(() => {
      expect(screen.getByText('sandbox_test.runtime_parameters')).toBeInTheDocument();
    });

    const saveButton = screen.getByRole('button', { name: /บันทึกแบบร่าง/i });
    await user.click(saveButton);

    expect(mockSaveSandboxProfile).toHaveBeenCalledWith('standard', mockParams, 'mock-uuid-v7');
    
    const { toast } = await import('sonner');
    expect(toast.success).toHaveBeenCalledWith('บันทึกแบบร่าง Sandbox สำเร็จ');
  });

  it('calls apply to production correctly', async () => {
    const user = userEvent.setup();
    mockApplyProfile.mockResolvedValue(true);
    
    render(<RuntimeParametersPanel />);
    
    await waitFor(() => {
      expect(screen.getByText('sandbox_test.runtime_parameters')).toBeInTheDocument();
    });

    const applyButton = screen.getByRole('button', { name: /ปรับใช้จริง/i });
    await user.click(applyButton);

    expect(mockApplyProfile).toHaveBeenCalledWith('standard', 'mock-uuid-v7');
    
    const { toast } = await import('sonner');
    expect(toast.success).toHaveBeenCalledWith('ปรับใช้พารามิเตอร์จริงสำเร็จ');
  });
});
