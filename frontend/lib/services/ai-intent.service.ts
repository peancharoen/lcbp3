// File: lib/services/ai-intent.service.ts
// Change Log
// - 2026-05-19: สร้าง API client สำหรับ Intent Classification (ADR-024).
// Service สำหรับเรียก Intent Classification API (Admin + Classify)

import api from '../api/client';

// Helper: แกะ nested data wrapper จาก TransformInterceptor
const extractData = <T>(value: unknown): T => {
  if (value && typeof value === 'object' && 'data' in value) {
    return (value as { data: T }).data;
  }
  return value as T;
};

// === Types ===

/** หมวดหมู่ Intent */
export type IntentCategory = 'read' | 'suggest' | 'utility';

/** ชนิด Pattern */
export type PatternType = 'keyword' | 'regex';

/** ภาษา Pattern */
export type PatternLanguage = 'th' | 'en' | 'any';

/** วิธีที่ใช้จำแนก */
export type ClassificationMethod =
  | 'pattern'
  | 'llm_fallback'
  | 'semaphore_overflow'
  | 'llm_error';

/** Intent Definition */
export interface IntentDefinition {
  publicId: string;
  intentCode: string;
  descriptionTh: string;
  descriptionEn: string;
  category: IntentCategory;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  patterns?: IntentPattern[];
}

/** Intent Pattern */
export interface IntentPattern {
  publicId: string;
  intentCode: string;
  language: PatternLanguage;
  patternType: PatternType;
  patternValue: string;
  priority: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/** ผลลัพธ์การจำแนก Intent */
export interface ClassificationResult {
  intentCode: string;
  confidence: number;
  method: ClassificationMethod;
  params?: Record<string, unknown>;
  latencyMs: number;
}

/** DTO สำหรับสร้าง Intent Definition */
export interface CreateIntentDefinitionDto {
  intentCode: string;
  descriptionTh: string;
  descriptionEn: string;
  category: IntentCategory;
}

/** DTO สำหรับ update Intent Definition */
export interface UpdateIntentDefinitionDto {
  descriptionTh?: string;
  descriptionEn?: string;
  isActive?: boolean;
}

/** DTO สำหรับสร้าง Pattern */
export interface CreateIntentPatternDto {
  language?: PatternLanguage;
  patternType: PatternType;
  patternValue: string;
  priority?: number;
}

/** สถิติแยกตาม method */
export interface MethodStats {
  method: string;
  count: number;
  avgConfidence: number;
  avgLatencyMs: number;
}

/** สถิติแยกตาม intent */
export interface IntentStats {
  intentCode: string;
  count: number;
  avgConfidence: number;
  patternHits: number;
  llmHits: number;
}

/** คำแนะนำ Recalibration */
export interface RecalibrationRecommendation {
  intentCode: string;
  llmCallCount: number;
  avgConfidence: number;
  priority: number;
}

/** ผลลัพธ์ Analytics รวม */
export interface ClassificationAnalytics {
  totalRequests: number;
  successCount: number;
  failedCount: number;
  patternHitRate: number;
  avgConfidence: number;
  avgLatencyMs: number;
  byMethod: MethodStats[];
  byIntent: IntentStats[];
  recalibration: RecalibrationRecommendation[];
}

/** DTO สำหรับ update Pattern */
export interface UpdateIntentPatternDto {
  language?: PatternLanguage;
  patternType?: PatternType;
  patternValue?: string;
  priority?: number;
  isActive?: boolean;
}

// === API Client ===

export const aiIntentService = {
  // --- Classification ---

  /** จำแนก Intent จาก user query */
  classify: async (query: string, projectPublicId?: string): Promise<ClassificationResult> => {
    const { data } = await api.post('/ai/intent/classify', {
      query,
      projectPublicId,
    });
    return extractData<ClassificationResult>(data);
  },

  // --- Intent Definitions (Admin) ---

  /** ดึงรายการ Intent Definitions ทั้งหมด */
  getDefinitions: async (params?: {
    category?: IntentCategory;
    isActive?: boolean;
  }): Promise<IntentDefinition[]> => {
    const { data } = await api.get('/admin/ai/intent-definitions', { params });
    const result = extractData<{ data: IntentDefinition[] } | IntentDefinition[]>(data);
    return Array.isArray(result) ? result : result.data;
  },

  /** ดึง Intent Definition ตาม intentCode */
  getDefinition: async (intentCode: string): Promise<IntentDefinition> => {
    const { data } = await api.get(`/admin/ai/intent-definitions/${intentCode}`);
    return extractData<IntentDefinition>(data);
  },

  /** สร้าง Intent Definition ใหม่ */
  createDefinition: async (dto: CreateIntentDefinitionDto): Promise<IntentDefinition> => {
    const { data } = await api.post('/admin/ai/intent-definitions', dto);
    return extractData<IntentDefinition>(data);
  },

  /** อัปเดต Intent Definition */
  updateDefinition: async (
    intentCode: string,
    dto: UpdateIntentDefinitionDto
  ): Promise<IntentDefinition> => {
    const { data } = await api.patch(`/admin/ai/intent-definitions/${intentCode}`, dto);
    return extractData<IntentDefinition>(data);
  },

  // --- Intent Patterns (Admin) ---

  /** ดึง Patterns ตาม intentCode */
  getPatterns: async (intentCode: string): Promise<IntentPattern[]> => {
    const { data } = await api.get(`/admin/ai/intent-definitions/${intentCode}/patterns`);
    const result = extractData<{ data: IntentPattern[] } | IntentPattern[]>(data);
    return Array.isArray(result) ? result : result.data;
  },

  /** สร้าง Pattern ใหม่ */
  createPattern: async (
    intentCode: string,
    dto: CreateIntentPatternDto
  ): Promise<IntentPattern> => {
    const { data } = await api.post(
      `/admin/ai/intent-definitions/${intentCode}/patterns`,
      dto
    );
    return extractData<IntentPattern>(data);
  },

  /** อัปเดต Pattern */
  updatePattern: async (
    publicId: string,
    dto: UpdateIntentPatternDto
  ): Promise<IntentPattern> => {
    const { data } = await api.patch(`/admin/ai/intent-patterns/${publicId}`, dto);
    return extractData<IntentPattern>(data);
  },

  /** Soft delete Pattern */
  deletePattern: async (publicId: string): Promise<void> => {
    await api.delete(`/admin/ai/intent-patterns/${publicId}`);
  },

  // --- Analytics (Admin) ---

  /** ดึงสถิติ Classification Analytics */
  getAnalytics: async (params?: {
    from?: string;
    to?: string;
  }): Promise<ClassificationAnalytics> => {
    const { data } = await api.get('/admin/ai/intent-analytics', { params });
    return extractData<ClassificationAnalytics>(data);
  },
};
