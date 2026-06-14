// File: frontend/lib/types/ai-prompts.ts
// Change Log:
// - 2026-06-14: Created frontend types for AI prompt management (conforming to task T010)

export type PromptType = 'ocr_extraction' | 'rag_query_prompt' | 'rag_prep_prompt' | 'classification_prompt';

export interface ContextConfig {
  filter: {
    projectId: string | null;
    contractId: string | null;
  } | null;
  pageSize: number;
  language: string;
  outputLanguage: string;
}

export interface PromptVersion {
  publicId: string;
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
  publicId: string;
  profileName: string;
  canonicalModel: 'np-dms-ai' | 'np-dms-ocr';
  temperature: number;
  topP: number;
  repeatPenalty: number;
  maxTokens: number | null;
  ctxSize: number | null;
  keepAlive: number;
  isDefault?: boolean;
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
