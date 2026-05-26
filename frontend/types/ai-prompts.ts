// File: frontend/types/ai-prompts.ts
// Change Log
// - 2026-05-25: Created types for dynamic prompt management (ADR-029)

/**
 * Interface สำหรับข้อมูล Prompt Version แต่ละรายการ
 */
export interface AiPrompt {
  promptType: string;
  versionNumber: number;
  template: string;
  isActive: boolean;
  testResultJson: Record<string, unknown> | null;
  manualNote: string | null;
  lastTestedAt: string | null;
  activatedAt: string | null;
  createdAt: string;
}

/**
 * Interface สำหรับผลการทดสอบ Sandbox OCR
 */
export interface SandboxResult {
  requestPublicId: string;
  status: 'processing' | 'completed' | 'failed';
  answer?: string;
  errorMessage?: string;
  completedAt?: string;
}
