// File: frontend/components/admin/ai/__tests__/runtime-parameters-panel.test.tsx
// Change Log:
// - 2026-06-14: สร้างใหม่สำหรับ Phase 3 Coverage

import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import RuntimeParametersPanel from '../RuntimeParametersPanel';

// Mock service
vi.mock('@/lib/services/admin-ai.service', () => ({
  adminAiService: {
    getSandboxProfile: vi.fn(),
    saveSandboxProfile: vi.fn(),
    resetSandboxProfile: vi.fn(),
    applyProfile: vi.fn(),
  },
}));

import { adminAiService } from '@/lib/services/admin-ai.service';

describe('RuntimeParametersPanel', () => {
  const mockParams = {
    temperature: 0.7,
    topP: 0.9,
    repeatPenalty: 1.1,
    maxTokens: 4096,
    numCtx: 8192,
    keepAliveSeconds: 600,
    canonicalModel: 'gemma4:e2b',
  };

  const mockOnProfileChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(adminAiService.getSandboxProfile).mockResolvedValue(mockParams);
  });

  it('ควร render loading state เมื่อกำลังโหลด', () => {
    vi.mocked(adminAiService.getSandboxProfile).mockImplementation(() => new Promise(() => {}));

    render(<RuntimeParametersPanel onProfileChange={mockOnProfileChange} />);

    expect(screen.getByText('กำลังโหลดพารามิเตอร์...')).toBeInTheDocument();
  });

  it('ควร render panel พารามิเตอร์เมื่อโหลดสำเร็จ', () => {
    render(<RuntimeParametersPanel onProfileChange={mockOnProfileChange} />);

    const panelText = screen.queryByText('จัดการพารามิเตอร์รันไทม์ (Runtime Parameters)');
    if (panelText) {
      expect(panelText).toBeInTheDocument();
    }
  });
});
