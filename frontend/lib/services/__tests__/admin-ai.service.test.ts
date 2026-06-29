// File: frontend/lib/services/__tests__/admin-ai.service.test.ts
// Change Log:
// - 2026-06-19: เพิ่ม regression tests สำหรับ AI Admin response normalization

import { beforeEach, describe, expect, it, vi } from 'vitest';
import apiClient from '@/lib/api/client';
import { adminAiService } from '../admin-ai.service';
import { adminAiPromptService } from '../admin-ai-prompt.service';

const promptVersion = {
  publicId: '0195aaaa-aaaa-7000-8000-aaaaaaaaaaaa',
  promptType: 'ocr_system',
  versionNumber: 1,
  version: 3,
  template: 'OCR prompt',
  isActive: true,
  createdAt: '2026-06-19T00:00:00.000Z',
};

describe('admin AI service normalization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('ควร unwrap VRAM response ที่ถูกห่อ data ซ้อนกัน', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      data: {
        data: {
          totalVramMb: 16384,
          usedVramMb: 4096,
          freeVramMb: 12288,
          hasCapacity: true,
          loadedModels: [
            {
              modelId: 'np-dms-ai:latest',
              modelName: 'np-dms-ai:latest',
              vramUsageMB: 4096,
            },
          ],
        },
      },
    });

    const result = await adminAiService.getVramStatus();

    expect(result.totalVRAMMB).toBe(16384);
    expect(result.usedVRAMMB).toBe(4096);
    expect(result.usagePercent).toBe(25);
    expect(result.canLoadModel).toBe(true);
    expect(result.loadedModels).toHaveLength(1);
  });

  it('ควรไม่แสดง OOM Guard เมื่อ backend ยังไม่ส่ง total VRAM', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      data: {
        data: {
          loadedModels: [],
          hasCapacity: false,
        },
      },
    });

    const result = await adminAiService.getVramStatus();

    expect(result.totalVRAMMB).toBe(0);
    expect(result.usedVRAMMB).toBe(0);
    expect(result.canLoadModel).toBe(true);
  });

  it('ควรคืน prompt list เป็น array เมื่อ response ถูกห่อ data ซ้อนกัน', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      data: {
        data: {
          data: [promptVersion],
        },
      },
    });

    const result = await adminAiPromptService.getPrompts('ocr_system');

    expect(result).toEqual([promptVersion]);
  });

  it('ควรคืน empty array เมื่อ prompt payload ไม่ใช่ array', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      data: {
        data: {
          message: 'unexpected payload',
        },
      },
    });

    const result = await adminAiPromptService.getPrompts('ocr_system');

    expect(result).toEqual([]);
  });
});
