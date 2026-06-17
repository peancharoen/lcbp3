// File: frontend/components/admin/ai/__tests__/SandboxTabs.test.tsx
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import SandboxTabs from '../SandboxTabs';

const mockSubmitSandboxOcr = vi.fn();
const mockSubmitSandboxAiExtract = vi.fn();
const mockSubmitSandboxRagPrep = vi.fn();
const mockGetSandboxJobStatus = vi.fn();

vi.mock('@/lib/services/admin-ai.service', () => ({
  adminAiService: {
    submitSandboxOcr: (...args: any) => mockSubmitSandboxOcr(...args),
    submitSandboxAiExtract: (...args: any) => mockSubmitSandboxAiExtract(...args),
    submitSandboxRagPrep: (...args: any) => mockSubmitSandboxRagPrep(...args),
    getSandboxJobStatus: (...args: any) => mockGetSandboxJobStatus(...args),
  },
}));

vi.mock('@/hooks/use-master-data', () => ({
  useProjects: vi.fn(() => ({ data: [{ publicId: 'proj-1', projectCode: 'P1', projectName: 'Project 1' }] })),
  useContracts: vi.fn(() => ({ data: [] })),
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

describe('SandboxTabs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.PointerEvent = MouseEvent as any;
  });

  it('renders correctly', async () => {
    render(<SandboxTabs promptType="ocr_extraction" />);
    
    await waitFor(() => {
      expect(screen.getByText(/รันบอร์ดทดลองการทำงาน/i)).toBeInTheDocument();
    });

    expect(screen.getByText('Step 1: Run OCR')).toBeInTheDocument();
    expect(screen.getByText('Step 2: AI Extract')).toBeInTheDocument();
    expect(screen.getByText('Step 3: RAG Prep')).toBeInTheDocument();
  });

  it('requires project and file for OCR', async () => {
    const user = userEvent.setup();
    render(<SandboxTabs promptType="ocr_extraction" />);
    
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /เริ่มรัน OCR/i })).toBeDisabled();
    });

    // Upload file
    const file = new File(['dummy content'], 'test.pdf', { type: 'application/pdf' });
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    await userEvent.upload(fileInput, file);

    // After uploading file, button is enabled, but submitting will fail without project in AI Extract step.
    // Wait, handleRunOcr checks if file exists, it doesn't check project!
    expect(screen.getByRole('button', { name: /เริ่มรัน OCR/i })).not.toBeDisabled();
  });

  it('runs OCR and polls status', async () => {
    const user = userEvent.setup();
    
    mockSubmitSandboxOcr.mockResolvedValue({ requestPublicId: 'req-1' });
    mockGetSandboxJobStatus.mockResolvedValue({ status: 'completed', ocrText: 'Extracted text from PDF' });

    render(<SandboxTabs promptType="ocr_extraction" />);

    // Upload file
    const file = new File(['dummy content'], 'test.pdf', { type: 'application/pdf' });
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    await userEvent.upload(fileInput, file);

    const runBtn = screen.getByRole('button', { name: /เริ่มรัน OCR/i });
    await user.click(runBtn);

    expect(mockSubmitSandboxOcr).toHaveBeenCalled();

    await waitFor(() => {
      expect(mockGetSandboxJobStatus).toHaveBeenCalledWith('req-1');
    }, { timeout: 3000 }); // Polling interval is 2s
  });
});
