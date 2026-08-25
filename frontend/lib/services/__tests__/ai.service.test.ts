// File: frontend/lib/services/__tests__/ai.service.test.ts
// Change Log:
// - 2026-06-13: Initial creation - test coverage for aiService
// - 2026-08-25: D161 — ลบ tests สำหรับ dead methods (extract, getMigrationList, updateMigration)

import { describe, it, expect, vi, beforeEach } from 'vitest';
import api from '@/lib/api/client';
import { aiService } from '../ai.service';

describe('aiService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('submitFeedback', () => {
    it('ควรส่งคำขอ POST /ai/feedback พร้อมข้อมูลฟีดแบ็คสำเร็จ', async () => {
      vi.mocked(api.post).mockResolvedValue({ data: {} });
      const dto = { logPublicId: 'log-1', rating: 5, comments: 'Good extraction' };
      await aiService.submitFeedback(dto);
      expect(api.post).toHaveBeenCalledWith('/ai/feedback', dto);
    });
  });
});
