// File: frontend/components/admin/ai/__tests__/OcrEngineSelector.test.tsx
// Change Log:
// - 2026-06-15: Created test file for OcrEngineSelector

import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import OcrEngineSelector from '../OcrEngineSelector';
import { adminAiService } from '@/lib/services/admin-ai.service';
import { toast } from 'sonner';

// Mock the services
vi.mock('@/lib/services/admin-ai.service', () => ({
  adminAiService: {
    getOcrEngines: vi.fn(),
    selectOcrEngine: vi.fn(),
  },
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const mockEngines = [
  {
    engineId: 'engine-1',
    engineName: 'Fast Path (PyMuPDF)',
    engineType: 'fast_path',
    isCurrentActive: true,
    concurrentLimit: 10,
    vramRequirementMB: 0,
  },
  {
    engineId: 'engine-2',
    engineName: 'np-dms-ocr',
    engineType: 'np_dms_ocr',
    isCurrentActive: false,
    concurrentLimit: 1,
    vramRequirementMB: 4096,
  },
];

describe('OcrEngineSelector', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state initially', () => {
    // Return a promise that doesn't resolve immediately to keep it in loading state
    (adminAiService.getOcrEngines as any).mockReturnValue(new Promise(() => {}));

    const { container } = render(<OcrEngineSelector />);
    // Card with animate-pulse
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('renders engines list successfully after loading', async () => {
    (adminAiService.getOcrEngines as any).mockResolvedValue(mockEngines);

    render(<OcrEngineSelector />);

    await waitFor(() => {
      expect(screen.getByText('ระบบจัดการ OCR Engine')).toBeInTheDocument();
    });

    expect(screen.getByText('Fast Path (PyMuPDF)')).toBeInTheDocument();
    expect(screen.getByText('np-dms-ocr')).toBeInTheDocument();
    expect(screen.getByText('กำลังใช้งาน')).toBeInTheDocument(); // Badge for active engine
    expect(screen.getByText('AI Powered')).toBeInTheDocument(); // Badge for np-dms-ocr
  });

  it('calls selectOcrEngine and shows success toast when changing engine', async () => {
    const user = userEvent.setup();
    (adminAiService.getOcrEngines as any).mockResolvedValue(mockEngines);
    (adminAiService.selectOcrEngine as any).mockResolvedValue({});

    render(<OcrEngineSelector />);

    await waitFor(() => {
      expect(screen.getByText('ระบบจัดการ OCR Engine')).toBeInTheDocument();
    });

    // The active engine will have "เลือกอยู่แล้ว", the inactive will have "สลับใช้งาน"
    const switchButton = screen.getByRole('button', { name: /สลับใช้งาน/i });

    await act(async () => {
      await user.click(switchButton);
    });

    expect(adminAiService.selectOcrEngine).toHaveBeenCalledWith('engine-2');
    expect(toast.success).toHaveBeenCalledWith('เปลี่ยนเอนจิน OCR หลักเป็น np-dms-ocr สำเร็จ');

    // It should fetch engines again
    expect(adminAiService.getOcrEngines).toHaveBeenCalledTimes(2);
  });

  it('shows error toast if fetching fails', async () => {
    (adminAiService.getOcrEngines as any).mockRejectedValue(new Error('Network error'));

    render(<OcrEngineSelector />);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('ไม่สามารถดึงข้อมูล OCR Engines ได้');
    });
  });

  it('shows error toast if selecting engine fails', async () => {
    const user = userEvent.setup();
    (adminAiService.getOcrEngines as any).mockResolvedValue(mockEngines);
    (adminAiService.selectOcrEngine as any).mockRejectedValue(new Error('Select error'));

    render(<OcrEngineSelector />);

    await waitFor(() => {
      expect(screen.getByText('ระบบจัดการ OCR Engine')).toBeInTheDocument();
    });

    const switchButton = screen.getByRole('button', { name: /สลับใช้งาน/i });

    await act(async () => {
      await user.click(switchButton);
    });

    expect(adminAiService.selectOcrEngine).toHaveBeenCalledWith('engine-2');
    expect(toast.error).toHaveBeenCalledWith('ไม่สามารถเปลี่ยนเอนจิน OCR ได้');
  });
});
