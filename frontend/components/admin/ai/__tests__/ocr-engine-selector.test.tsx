// File: frontend/components/admin/ai/__tests__/ocr-engine-selector.test.tsx
// Change Log
// - 2026-06-13: Add coverage for OCR engine loading, display, and selection flows.

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { toast } from 'sonner';
import OcrEngineSelector from '../OcrEngineSelector';
import { adminAiService, type OcrEngineResponse } from '@/lib/services/admin-ai.service';

vi.mock('@/lib/services/admin-ai.service', () => ({
  adminAiService: {
    getOcrEngines: vi.fn(),
    selectOcrEngine: vi.fn(),
  },
}));

const engines: OcrEngineResponse[] = [
  {
    engineId: 'tesseract',
    engineName: 'Tesseract OCR',
    engineType: 'tesseract',
    isCurrentActive: true,
    concurrentLimit: 4,
    vramRequirementMB: 0,
  },
  {
    engineId: 'typhoon',
    engineName: 'Typhoon OCR',
    engineType: 'typhoon_ocr',
    isCurrentActive: false,
    concurrentLimit: 1,
    vramRequirementMB: 6144,
  },
];

describe('OcrEngineSelector', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(adminAiService.getOcrEngines).mockResolvedValue(engines);
    vi.mocked(adminAiService.selectOcrEngine).mockResolvedValue({ success: true });
  });

  it('renders OCR engine data from admin service', async () => {
    render(<OcrEngineSelector />);
    expect(await screen.findByText('Tesseract OCR')).toBeInTheDocument();
    expect(screen.getByText('Typhoon OCR')).toBeInTheDocument();
    expect(screen.getByText('AI Powered')).toBeInTheDocument();
    expect(adminAiService.getOcrEngines).toHaveBeenCalledTimes(1);
  });

  it('selects a non-active OCR engine and refreshes list', async () => {
    const user = userEvent.setup();
    render(<OcrEngineSelector />);
    await user.click(await screen.findByRole('button', { name: 'สลับใช้งาน' }));
    await waitFor(() => {
      expect(adminAiService.selectOcrEngine).toHaveBeenCalledWith('typhoon');
    });
    expect(toast.success).toHaveBeenCalledWith('เปลี่ยนเอนจิน OCR หลักเป็น Typhoon OCR สำเร็จ');
    expect(adminAiService.getOcrEngines).toHaveBeenCalledTimes(2);
  });

  it('shows an error toast when loading engines fails', async () => {
    vi.mocked(adminAiService.getOcrEngines).mockRejectedValue(new Error('API error'));
    render(<OcrEngineSelector />);
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('ไม่สามารถดึงข้อมูล OCR Engines ได้');
    });
  });
});
