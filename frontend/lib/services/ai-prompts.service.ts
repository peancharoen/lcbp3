// File: frontend/lib/services/ai-prompts.service.ts
// Change Log
// - 2026-05-25: Created aiPromptsService for prompt versioning and sandbox operations (ADR-029)
// - 2026-05-26: แก้ไขการ unwrap ข้อมูลจาก TransformInterceptor ที่ซ้อนกันหลายชั้นเพื่อป้องกันข้อผิดพลาด N.find is not a function

import api from '../api/client';
import { AiPrompt } from '../../types/ai-prompts';

const extractData = <T>(value: unknown): T => {
  let current: unknown = value;
  let depth = 0;
  while (current && typeof current === 'object' && 'data' in current && depth < 5) {
    current = (current as { data: unknown }).data;
    depth += 1;
  }
  return current as T;
};

/**
 * ฟังก์ชันช่วย unwrap ข้อมูลจาก API Response ที่อาจจะถูก wrap ซ้อนกันหลายชั้นโดย TransformInterceptor
 */
const unwrapResponse = <T>(value: unknown): T => {
  const extracted = extractData<T>(value);
  return extracted;
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
    return unwrapResponse<AiPrompt[]>(data);
  },

  /**
   * สร้าง Prompt Version ใหม่ (เริ่มต้นเป็น inactive)
   */
  createVersion: async (promptType: string, template: string): Promise<AiPrompt> => {
    const { data } = await api.post(`/ai/prompts/${encodeURIComponent(promptType)}`, { template });
    return unwrapResponse<AiPrompt>(data);
  },

  /**
   * เปิดใช้งาน Prompt Version เพื่อใช้เป็น active version
   */
  activateVersion: async (promptType: string, versionNumber: number): Promise<AiPrompt> => {
    const { data } = await api.post(
      `/ai/prompts/${encodeURIComponent(promptType)}/${versionNumber}/activate`
    );
    return unwrapResponse<AiPrompt>(data);
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
    return unwrapResponse<AiPrompt>(data);
  },
};

