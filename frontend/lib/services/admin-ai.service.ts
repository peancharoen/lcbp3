// File: lib/services/admin-ai.service.ts
// Change Log
// - 2026-05-21: เพิ่ม service สำหรับ AI Admin Console toggle API.
// - 2026-05-21: เพิ่ม service method `getHealth` สำหรับดึงข้อมูลสุขภาพของระบบ AI (T028).
// - 2026-05-21: เพิ่ม API service สำหรับ Superadmin Sandbox RAG (T037).
// - 2026-05-21: เพิ่ม service method `submitSandboxExtract` สำหรับอัปโหลดไฟล์ใน OCR Sandbox (T043).

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
  citations?: AiRagCitation[];
  confidence?: number;
  usedFallbackModel?: boolean;
  errorMessage?: string;
  completedAt?: string;
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
};
