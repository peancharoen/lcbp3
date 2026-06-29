// Frontend Type Contracts: Unified Prompt Management UX/UI
// Feature: 237-unified-prompt-management-ux-ui
// Date: 2026-06-14

// Prompt Types
export type PromptType = 'ocr_extraction' | 'rag_query_prompt' | 'rag_prep_prompt' | 'classification_prompt';

// Context Config
export interface ContextConfig {
  filter: {
    projectId: string | null;
    contractId: string | null;
  };
  pageSize: number;
  language: string;
  outputLanguage: string;
}

// Prompt Version
export interface PromptVersion {
  id: string; // publicId (UUID)
  promptType: PromptType;
  versionNumber: number;
  template: string;
  contextConfig: ContextConfig | null;
  isActive: boolean;
  manualNote: string | null;
  createdAt: string; // ISO 8601
}

// Runtime Parameters
export interface RuntimeParameters {
  temperature: number;
  topP: number;
  repeatPenalty: number;
  maxTokens: number;
  ctxSize: number;
  keepAlive: number;
}

// Execution Profile
export interface ExecutionProfile {
  id: string; // publicId (UUID)
  profileName: string;
  temperature: number;
  topP: number;
  repeatPenalty: number;
  maxTokens: number;
  ctxSize: number;
  keepAlive: number;
  isDefault: boolean;
}

// Sandbox Job Types
export type SandboxJobType = 'ocr' | 'ai-extract' | 'rag-prep';

export type SandboxJobStatus = 'pending' | 'processing' | 'completed' | 'failed';

// Sandbox Job Result
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

// Sandbox Job
export interface SandboxJob {
  jobId: string; // UUID
  jobType: SandboxJobType;
  status: SandboxJobStatus;
  result: SandboxJobResult;
  createdAt: string; // ISO 8601
  completedAt?: string; // ISO 8601
}

// API Request DTOs
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

export interface CreateExecutionProfileDto {
  profileName: string;
  temperature: number;
  topP: number;
  repeatPenalty: number;
  maxTokens: number;
  ctxSize: number;
  keepAlive: number;
}

export interface UpdateExecutionProfileDto {
  temperature?: number;
  topP?: number;
  repeatPenalty?: number;
  maxTokens?: number;
  ctxSize?: number;
  keepAlive?: number;
}

export interface SandboxRagPrepDto {
  text: string;
  profileId?: string;
}

// API Response DTOs
export interface PromptVersionResponse {
  data: PromptVersion;
}

export interface PromptVersionsResponse {
  data: PromptVersion[];
}

export interface ContextConfigResponse {
  data: ContextConfig;
}

export interface ExecutionProfilesResponse {
  data: ExecutionProfile[];
}

export interface ExecutionProfileResponse {
  data: ExecutionProfile;
}

export interface SandboxJobResponse {
  data: SandboxJob;
}

// Placeholder Validation Rules
export const PLACEHOLDER_REQUIREMENTS: Record<PromptType, string[]> = {
  ocr_extraction: ['{{ocr_text}}', '{{master_data_context}}'],
  rag_query_prompt: ['{{query}}', '{{context}}'],
  rag_prep_prompt: ['{{text}}'],
  classification_prompt: ['{{document_text}}'],
};

// Runtime Parameter Constraints
export const RUNTIME_PARAMETER_CONSTRAINTS = {
  temperature: { min: 0.0, max: 1.0, default: 0.7 },
  topP: { min: 0.0, max: 1.0, default: 0.9 },
  repeatPenalty: { min: 1.0, max: 2.0, default: 1.0 },
  maxTokens: { min: 1, max: 8192, default: 2048 },
  ctxSize: { min: 1, max: 16384, default: 4096 },
  keepAlive: { min: 0, max: 3600, default: 300 },
};
