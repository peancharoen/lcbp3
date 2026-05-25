// File: frontend/lib/services/ai-prompts.service.ts
// Change Log
// - 2026-05-25: Created aiPromptsService for prompt versioning and sandbox operations (ADR-029)

import api from '../api/client';
import { AiPrompt } from '../../types/ai-prompts';

const extractData = <T>(value: unknown): T => {
  if (value && typeof value === 'object' && 'data' in value) {
    return (value as { data: T }).data;
  }
  return value as T;
};

/**
 * Service สำหรับเรียก API ในการจัดการ AI prompt templates ทางฝั่งหน้าบ้าน
 */
export const aiPromptsService = {
  /**
   * ดึงรายการ Prompt Versions ทั้งหมดสำหรับ prompt_type ที่กำหนด
   */
  listVersions: async (promptType: string): Promise<AiPrompt[]> => {
    const { data } = await api.get(`/ai/prompts/${encodeURIComponent(promptType)}`);
    return extractData<AiPrompt[]>(data);
  },

  /**
   * สร้าง Prompt Version ใหม่ (เริ่มต้นเป็น inactive)
   */
  createVersion: async (promptType: string, template: string): Promise<AiPrompt> => {
    const { data } = await api.post(`/ai/prompts/${encodeURIComponent(promptType)}`, { template });
    return extractData<AiPrompt>(data);
  },

  /**
   * เปิดใช้งาน Prompt Version เพื่อใช้เป็น active version
   */
  activateVersion: async (promptType: string, versionNumber: number): Promise<AiPrompt> => {
    const { data } = await api.post(
      `/ai/prompts/${encodeURIComponent(promptType)}/${versionNumber}/activate`
    );
    return extractData<AiPrompt>(data);
  },

  /**
   * ลบ Prompt Version (ต้องไม่เป็น active version)
   */
  deleteVersion: async (promptType: string, versionNumber: number): Promise<void> => {
    await api.delete(`/ai/prompts/${encodeURIComponent(promptType)}/${versionNumber}`);
  },

  /**
   * อัปเดต manual note ของเวอร์ชันที่กำหนด
   */
  updateNote: async (
    promptType: string,
    versionNumber: number,
    manualNote: string | null
  ): Promise<AiPrompt> => {
    const { data } = await api.patch(
      `/ai/prompts/${encodeURIComponent(promptType)}/${versionNumber}/note`,
      { manualNote }
    );
    return extractData<AiPrompt>(data);
  },
};
