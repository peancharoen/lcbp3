// File: frontend/lib/services/admin-ai-prompt.service.ts
// Change Log
// - 2026-06-17: Created adminAiPromptService for prompt management UI (Feature 238)

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

/**
 * Service สำหรับจัดการ AI Prompt Versions ใน Admin Console
 */
export const adminAiPromptService = {
  /**
   * ดึงรายการ prompt versions ทั้งหมดสำหรับ prompt_type ที่กำหนด
   */
  async getPrompts(promptType: string): Promise<AiPromptVersion[]> {
    const response = await client.get<{ data: AiPromptVersion[] }>(
      `/ai/prompts/${promptType}`
    );
    return response.data.data;
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
    const response = await client.post<{ data: AiPromptVersion }>(
      `/ai/prompts/${promptType}`,
      { template, contextConfig },
      {
        headers: {
          'Idempotency-Key': idempotencyKey,
        },
      }
    );
    return response.data.data;
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
    const response = await client.post<{ data: AiPromptVersion }>(
      `/ai/prompts/${promptType}/${versionNumber}/activate`,
      expectedVersion !== undefined ? { expectedVersion } : {},
      {
        headers: {
          'Idempotency-Key': idempotencyKey,
        },
      }
    );
    return response.data.data;
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
    const response = await client.patch<{ data: AiPromptVersion }>(
      `/ai/prompts/${promptType}/${versionNumber}/note`,
      { manualNote }
    );
    return response.data.data;
  },
};
