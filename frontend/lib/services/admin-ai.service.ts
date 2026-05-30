// File: lib/services/admin-ai.service.ts
// Change Log
// - 2026-05-21: เพิ่ม service สำหรับ AI Admin Console toggle API.
// - 2026-05-21: เพิ่ม service method `getHealth` สำหรับดึงข้อมูลสุขภาพของระบบ AI (T028).
// - 2026-05-21: เพิ่ม API service สำหรับ Superadmin Sandbox RAG (T037).
// - 2026-05-21: เพิ่ม service method `submitSandboxExtract` สำหรับอัปโหลดไฟล์ใน OCR Sandbox (T043).
// - 2026-05-25: เพิ่ม methods สำหรับจัดการโมเดล AI แบบไดนามิก (ADR-027).
// - 2026-05-29: เพิ่ม ocr field ใน AiSystemHealth interface ตาม OcrService.checkHealth()
// - 2026-05-29: เพิ่ม ocrText, ocrUsed, promptVersionUsed ใน AiSandboxJobResult
// - 2026-05-30: เพิ่มเมธอด getOcrEngines และ selectOcrEngine สำหรับจัดการ OCR engines (T017, T018, US1)
// - 2026-05-30: เพิ่ม getVramStatus และปรับปรุง getAvailableModels/setActiveModel/addModel ให้เรียกใช้ endpoints ใหม่ที่มี VRAM capacity check (T031-T034, US2)

import api from '../api/client';

export interface AiAdminSettings {
  aiFeaturesEnabled: boolean;
}

export interface QueueMetrics {
  active?: number;
  waiting?: number;
  failed?: number;
  completed?: number;
  isPaused?: boolean;
  error?: string;
}

export interface AiSystemHealth {
  ollama: {
    status: 'HEALTHY' | 'DEGRADED' | 'DOWN';
    latencyMs: number;
    models: string[];
    error?: string;
  };
  qdrant: {
    status: 'HEALTHY' | 'DEGRADED' | 'DOWN';
    latencyMs: number;
    collections?: string[];
    error?: string;
  };
  ocr: {
    status: 'HEALTHY' | 'DOWN';
    latencyMs: number;
    url: string;
    error?: string;
  };
  queues: {
    realtime: QueueMetrics;
    batch: QueueMetrics;
  };
  timestamp: string;
}

export interface AiRagCitation {
  pointId: string | number;
  score: number;
  docType?: string;
  docNumber?: string;
  snippet?: string;
}

export interface AiSandboxJobResult {
  requestPublicId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled' | 'not_found';
  answer?: string;
  ocrText?: string;
  ocrUsed?: boolean;
  engineUsed?: string;
  fallbackUsed?: boolean;
  promptVersionUsed?: number;
  citations?: AiRagCitation[];
  confidence?: number;
  usedFallbackModel?: boolean;
  errorMessage?: string;
  completedAt?: string;
}

export interface LoadedModelInfo {
  modelId: string;
  modelName: string;
  vramUsageMB: number;
}

export interface VramStatusResponse {
  totalVRAMMB: number;
  usedVRAMMB: number;
  usagePercent: number;
  thresholdPercent: number;
  loadedModels: LoadedModelInfo[];
  canLoadModel: boolean;
  lastUpdated: string;
}

export interface AiAvailableModel {
  id?: number;
  modelId?: string;
  modelName: string;
  modelVersion: string;
  description?: string;
  vramGb?: number;
  vramRequirementMB?: number;
  isActive: boolean;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AiModelsResponse {
  models: AiAvailableModel[];
  activeModel: string;
}

export interface AiActiveModelResponse {
  activeModel: string;
}

const extractData = <T>(value: unknown): T => {
  if (value && typeof value === 'object' && 'data' in value) {
    return (value as { data: T }).data;
  }
  return value as T;
};

/** Service สำหรับเรียก AI Admin Console API ผ่าน DMS Backend เท่านั้น */
export const adminAiService = {
  getStatus: async (): Promise<AiAdminSettings> => {
    const { data } = await api.get('/ai/status');
    return extractData<AiAdminSettings>(data);
  },
  getSettings: async (): Promise<AiAdminSettings> => {
    const { data } = await api.get('/ai/admin/settings');
    return extractData<AiAdminSettings>(data);
  },
  toggleFeatures: async (enabled: boolean): Promise<AiAdminSettings> => {
    const { data } = await api.post('/ai/admin/toggle', { enabled });
    return extractData<AiAdminSettings>(data);
  },
  getHealth: async (): Promise<AiSystemHealth> => {
    const { data } = await api.get('/ai/admin/health');
    return extractData<AiSystemHealth>(data);
  },
  submitSandboxRag: async (
    projectPublicId: string,
    question: string
  ): Promise<{ requestPublicId: string; jobId: string; status: string }> => {
    const { data } = await api.post('/ai/admin/sandbox/rag', {
      projectPublicId,
      question,
    });
    return extractData<{ requestPublicId: string; jobId: string; status: string }>(data);
  },
  getSandboxJobStatus: async (id: string): Promise<AiSandboxJobResult> => {
    const { data } = await api.get(`/ai/admin/sandbox/job/${id}`);
    return extractData<AiSandboxJobResult>(data);
  },
  submitSandboxExtract: async (
    file: File
  ): Promise<{ requestPublicId: string; jobId: string; status: string }> => {
    const formData = new FormData();
    formData.append('file', file);
    const { data } = await api.post('/ai/admin/sandbox/extract', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return extractData<{ requestPublicId: string; jobId: string; status: string }>(data);
  },

  // --- Step 1: OCR Only (สำหรับตรวจคุณภาพ OCR ก่อนทดสอบ AI) ---

  submitSandboxOcr: async (
    file: File,
    engineType: 'auto' | 'tesseract' | 'typhoon-ocr-3b' = 'auto'
  ): Promise<{ requestPublicId: string; jobId: string; status: string }> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('engineType', engineType);
    const { data } = await api.post('/ai/admin/sandbox/ocr', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return extractData<{ requestPublicId: string; jobId: string; status: string }>(data);
  },

  // --- Step 2: AI Extraction (ใช้ OCR text ที่ cache จาก Step 1) ---

  submitSandboxAiExtract: async (
    requestPublicId: string,
    promptVersion?: number
  ): Promise<{ requestPublicId: string; jobId: string; status: string }> => {
    const { data } = await api.post('/ai/admin/sandbox/ai-extract', {
      requestPublicId,
      promptVersion,
    });
    return extractData<{ requestPublicId: string; jobId: string; status: string }>(data);
  },

  // --- AI Model Management (ADR-027, US2) ---

  getAvailableModels: async (): Promise<AiModelsResponse> => {
    const { data } = await api.get('/ai/models');
    return extractData<AiModelsResponse>(data);
  },

  getActiveModel: async (): Promise<AiActiveModelResponse> => {
    const { data } = await api.get('/ai/admin/models/active');
    return extractData<AiActiveModelResponse>(data);
  },

  setActiveModel: async (modelId: string): Promise<AiActiveModelResponse> => {
    const { data } = await api.patch(`/ai/models/${encodeURIComponent(modelId)}/activate`, {});
    return extractData<AiActiveModelResponse>(data);
  },

  getVramStatus: async (): Promise<VramStatusResponse> => {
    const { data } = await api.get('/ai/vram/status');
    return extractData<VramStatusResponse>(data);
  },

  addModel: async (
    model: Omit<AiAvailableModel, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<{ model: AiAvailableModel }> => {
    const { data } = await api.post('/ai/models', model);
    return extractData<{ model: AiAvailableModel }>(data);
  },

  toggleModelActive: async (modelName: string): Promise<{ model: AiAvailableModel }> => {
    const { data } = await api.patch(`/ai/admin/models/${encodeURIComponent(modelName)}/toggle`);
    return extractData<{ model: AiAvailableModel }>(data);
  },

  removeModel: async (modelName: string): Promise<void> => {
    await api.delete(`/ai/admin/models/${encodeURIComponent(modelName)}`);
  },

  // --- OCR Engine Management (ADR-032) ---

  getOcrEngines: async (): Promise<OcrEngineResponse[]> => {
    const { data } = await api.get('/ai/ocr-engines');
    return extractData<OcrEngineResponse[]>(data);
  },

  selectOcrEngine: async (engineId: string): Promise<{ activeEngineName: string }> => {
    const { data } = await api.post(`/ai/ocr-engines/${encodeURIComponent(engineId)}/select`, {});
    return extractData<{ activeEngineName: string }>(data);
  },
};

export interface OcrEngineResponse {
  engineId: string;
  engineName: string;
  engineType: string;
  isActive: boolean;
  isCurrentActive: boolean;
  vramRequirementMB: number;
  processingTimeLimitSeconds: number;
  concurrentLimit: number;
  fallbackEngineId?: string | null;
  createdAt: string;
  updatedAt: string;
}
