// File: frontend/contracts/frontend-types.ts
// Change Log:
// - 2026-06-14: Created frontend contract types from specifications (conforming to task T010)

export type PromptType = 'ocr_extraction' | 'rag_query_prompt' | 'rag_prep_prompt' | 'classification_prompt';

export interface ContextConfig {
  filter: {
    projectId: string | null;
    contractId: string | null;
  };
  pageSize: number;
  language: string;
  outputLanguage: string;
}

export interface PromptVersion {
  id: string;
  promptType: PromptType;
  versionNumber: number;
  template: string;
  contextConfig: ContextConfig | null;
  isActive: boolean;
  manualNote: string | null;
  createdAt: string;
}

export interface RuntimeParameters {
  temperature: number;
  topP: number;
  repeatPenalty: number;
  maxTokens: number;
  ctxSize: number;
  keepAlive: number;
}

export interface ExecutionProfile {
  id: string;
  profileName: string;
  temperature: number;
  topP: number;
  repeatPenalty: number;
  maxTokens: number;
  ctxSize: number;
  keepAlive: number;
  isDefault: boolean;
}

export type SandboxJobType = 'ocr' | 'ai-extract' | 'rag-prep';
export type SandboxJobStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface SandboxJobResult {
  ocrText?: string;
  extractedMetadata?: Record<string, unknown>;
  ragChunks?: Array<{
    text: string;
    summary: string;
  }>;
  ragVectors?: number[][];
  error?: string | null;
}

export interface SandboxJob {
  jobId: string;
  jobType: SandboxJobType;
  status: SandboxJobStatus;
  result: SandboxJobResult;
  createdAt: string;
  completedAt?: string;
}

export interface CreatePromptDto {
  template: string;
  contextConfig: ContextConfig;
  manualNote?: string;
}

export interface UpdateContextConfigDto {
  filter: {
    projectId: string | null;
    contractId: string | null;
  };
  pageSize: number;
  language: string;
  outputLanguage: string;
}

export const PLACEHOLDER_REQUIREMENTS: Record<PromptType, string[]> = {
  ocr_extraction: ['{{ocr_text}}'],
  rag_query_prompt: ['{{query}}', '{{context}}'],
  rag_prep_prompt: ['{{text}}'],
  classification_prompt: ['{{document_text}}'],
};

export const RUNTIME_PARAMETER_CONSTRAINTS = {
  temperature: { min: 0.0, max: 1.0, default: 0.7 },
  topP: { min: 0.0, max: 1.0, default: 0.9 },
  repeatPenalty: { min: 1.0, max: 2.0, default: 1.0 },
  maxTokens: { min: 1, max: 8192, default: 2048 },
  ctxSize: { min: 1, max: 16384, default: 4096 },
  keepAlive: { min: 0, max: 3600, default: 300 },
};
