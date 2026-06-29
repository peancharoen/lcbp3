// File: lib/services/ai.service.ts
// Service สำหรับ AI Gateway API (ADR-018: Frontend → DMS API เท่านั้น ห้ามเรียก n8n/Ollama โดยตรง)

import api from '../api/client';
import type {
  ExtractionResult,
  ExtractDocumentDto,
  AiMigrationLog,
  AiMigrationLogStatus,
  AiMigrationUpdateDto,
  AiFeedbackDto,
  AiPaginatedResult,
} from '@/types/ai';

// Helper: แกะ nested data wrapper จาก TransformInterceptor
const extractData = <T>(value: unknown): T => {
  if (value && typeof value === 'object' && 'data' in value) {
    return (value as { data: T }).data;
  }
  return value as T;
};

// Helper: normalize paginated response
const normalizePaginated = <T>(value: unknown): AiPaginatedResult<T> => {
  const inner = extractData<unknown>(value);
  if (
    inner &&
    typeof inner === 'object' &&
    'items' in inner &&
    Array.isArray((inner as { items: unknown[] }).items)
  ) {
    return inner as AiPaginatedResult<T>;
  }
  return { items: [], total: 0, page: 1, limit: 10, totalPages: 0 };
};

export const aiService = {
  // --- Real-time Extraction (ADR-018: ผ่าน /api/ai/extract เท่านั้น ห้ามเรียก n8n/Ollama) ---
  extract: async (dto: ExtractDocumentDto): Promise<ExtractionResult> => {
    const { data } = await api.post('/ai/extract', dto);
    return extractData<ExtractionResult>(data);
  },

  // --- Admin: รายการ AI Migration Logs ---
  getMigrationList: async (params: {
    page?: number;
    limit?: number;
    status?: AiMigrationLogStatus;
    minConfidence?: number;
  }): Promise<AiPaginatedResult<AiMigrationLog>> => {
    const { data } = await api.get('/ai/migration', { params });
    return normalizePaginated<AiMigrationLog>(data);
  },

  // --- Admin: อัปเดตสถานะ Migration Log (ADR-019: ใช้ publicId) ---
  updateMigration: async (
    publicId: string, // ADR-019: UUID เท่านั้น ห้ามใช้ parseInt
    dto: AiMigrationUpdateDto,
    idempotencyKey: string
  ): Promise<AiMigrationLog> => {
    const { data } = await api.patch(`/ai/migration/${publicId}`, dto, {
      headers: { 'Idempotency-Key': idempotencyKey },
    });
    return extractData<AiMigrationLog>(data);
  },

  // --- Feedback Collection (สำหรับปรับปรุง AI) ---
  submitFeedback: async (dto: AiFeedbackDto): Promise<void> => {
    await api.post('/ai/feedback', dto);
  },
};
