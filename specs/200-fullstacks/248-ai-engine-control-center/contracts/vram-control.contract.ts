// File: specs/200-fullstacks/248-ai-engine-control-center/contracts/vram-control.contract.ts

/**
 * POST /ai/admin/models/:modelName/vram/load
 * POST /ai/admin/models/:modelName/vram/unload
 * Header: Authorization: Bearer <token>, Idempotency-Key: <uuid>
 * Permission: system.manage_all
 */

export interface ModelVramActionResponse {
  success: boolean;
  message: string;
  data: {
    modelName: string;
    action: 'load' | 'unload';
    isLoaded: boolean;
    vramUsageMb: number;
    evictedModels?: string[];
  };
}

export interface ModelVramConflictErrorResponse {
  statusCode: 409;
  error: 'Conflict';
  message: string;
  userMessage: string;
  details: {
    activeJobsCount: number;
    waitingJobsCount: number;
    activeQueues: string[];
  };
}
