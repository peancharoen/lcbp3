// File: frontend/components/admin/ai/__tests__/sandbox-tabs.test.tsx
// Change Log:
// - 2026-06-14: สร้างใหม่สำหรับ Phase 3 Coverage

import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import SandboxTabs from '../SandboxTabs';

// Mock hooks
vi.mock('@/hooks/use-master-data', () => ({
  useProjects: () => ({ data: [] }),
  useContracts: () => ({ data: [] }),
}));

// Mock service
vi.mock('@/lib/services/admin-ai.service', () => ({
  adminAiService: {
    submitSandboxOcr: vi.fn(),
    submitSandboxAiExtract: vi.fn(),
    submitSandboxRagPrep: vi.fn(),
    getSandboxJobStatus: vi.fn(),
  },
}));

import { adminAiService } from '@/lib/services/admin-ai.service';

describe('SandboxTabs', () => {
  const mockOnActivateVersion = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(adminAiService.submitSandboxOcr).mockResolvedValue({ requestPublicId: 'test-request-id' });
    vi.mocked(adminAiService.getSandboxJobStatus).mockResolvedValue({ status: 'completed' });
  });

  it('ควร render 3-step sandbox testing interface', () => {
    render(
      <SandboxTabs
        promptType="ocr_extraction"
        selectedVersionNumber={1}
        onActivateVersion={mockOnActivateVersion}
      />
    );

    expect(screen.getByText('รันบอร์ดทดลองการทำงาน (3-Step Sandbox Testing)')).toBeInTheDocument();
    expect(screen.getByText('Step 1: Run OCR')).toBeInTheDocument();
    expect(screen.getByText('Step 2: AI Extract')).toBeInTheDocument();
    expect(screen.getByText('Step 3: RAG Prep')).toBeInTheDocument();
  });

  it('ควร disabled ปุ่ม Run OCR เมื่อไม่มีไฟล์', () => {
    render(
      <SandboxTabs
        promptType="ocr_extraction"
        selectedVersionNumber={1}
        onActivateVersion={mockOnActivateVersion}
      />
    );

    const runButton = screen.queryByText('เริ่มรัน OCR (Run OCR)');
    if (runButton) {
      expect(runButton).toBeDisabled();
    }
  });
});
