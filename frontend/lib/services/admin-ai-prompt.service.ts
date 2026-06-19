// File: frontend/lib/services/admin-ai-prompt.service.ts
// Change Log
// - 2026-06-17: Created adminAiPromptService for prompt management UI (Feature 238)
// - 2026-06-19: Normalize prompt response envelopes to prevent non-array prompt history crashes

import client from '../api/client';

export interface AiPromptVersion {
  publicId: string;
  promptType: string;
  versionNumber: number;
  version: number;
  template: string;
  contextConfig?: Record<string, unknown>;
  isActive: boolean;
  manualNote?: string | null;
  activatedAt?: string | null;
  createdAt: string;
  createdBy?: number;
}

const extractData = <T>(value: unknown): T => {
  let current = value;
  for (let depth = 0; depth < 3; depth += 1) {
    if (current && typeof current === 'object' && 'data' in current) {
      current = (current as { data: unknown }).data;
      continue;
    }
    break;
  }
  return current as T;
};

const normalizePromptList = (value: unknown): AiPromptVersion[] => {
  const data = extractData<unknown>(value);
  return Array.isArray(data) ? (data as AiPromptVersion[]) : [];
};

/**
 * Service สำหรับจัดการ AI Prompt Versions ใน Admin Console
 */
export const adminAiPromptService = {
  /**
   * ดึงรายการ prompt versions ทั้งหมดสำหรับ prompt_type ที่กำหนด
   */
  async getPrompts(promptType: string): Promise<AiPromptVersion[]> {
    const response = await client.get<unknown>(
      `/ai/prompts/${promptType}`
    );
    return normalizePromptList(response.data);
  },

  /**
   * สร้าง prompt version ใหม่
   */
  async createPrompt(
    promptType: string,
    template: string,
    contextConfig?: Record<string, unknown>
  ): Promise<AiPromptVersion> {
    const idempotencyKey = crypto.randomUUID();
    const response = await client.post<unknown>(
      `/ai/prompts/${promptType}`,
      { template, contextConfig },
      {
        headers: {
          'Idempotency-Key': idempotencyKey,
        },
      }
    );
    return extractData<AiPromptVersion>(response.data);
  },

  /**
   * เปิดใช้งาน prompt version ที่กำหนด
   */
  async activatePrompt(
    promptType: string,
    versionNumber: number,
    expectedVersion?: number
  ): Promise<AiPromptVersion> {
    const idempotencyKey = crypto.randomUUID();
    const response = await client.post<unknown>(
      `/ai/prompts/${promptType}/${versionNumber}/activate`,
      expectedVersion !== undefined ? { expectedVersion } : {},
      {
        headers: {
          'Idempotency-Key': idempotencyKey,
        },
      }
    );
    return extractData<AiPromptVersion>(response.data);
  },

  /**
   * ลบ prompt version (ห้ามลบ active version)
   */
  async deletePrompt(promptType: string, versionNumber: number): Promise<void> {
    await client.delete(
      `/ai/prompts/${promptType}/${versionNumber}`
    );
  },

  /**
   * อัปเดต manual note
   */
  async updatePromptNote(
    promptType: string,
    versionNumber: number,
    manualNote: string | null
  ): Promise<AiPromptVersion> {
    const response = await client.patch<unknown>(
      `/ai/prompts/${promptType}/${versionNumber}/note`,
      { manualNote }
    );
    return extractData<AiPromptVersion>(response.data);
  },
};
