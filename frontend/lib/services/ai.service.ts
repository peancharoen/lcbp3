// File: lib/services/ai.service.ts
// Service สำหรับ AI Gateway API (ADR-023/023A: Frontend → DMS API → BullMQ เท่านั้น)
// Change Log:
// - 2026-08-25: D161 — ลบ dead methods (extract, getMigrationList, updateMigration) ที่เกี่ยวข้องกับ migration_logs (ADR-020 era)

import api from '../api/client';
import type { AiFeedbackDto } from '@/types/ai';

export const aiService = {
  // --- Feedback Collection (สำหรับปรับปรุง AI) ---
  submitFeedback: async (dto: AiFeedbackDto): Promise<void> => {
    await api.post('/ai/feedback', dto);
  },
};
