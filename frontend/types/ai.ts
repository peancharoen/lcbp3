// File: types/ai.ts
// ประเภทข้อมูลสำหรับ AI Integration (ADR-023/023A)
// Change Log:
// - 2026-08-25: D161 — ลบ dead types (AiMigrationLogStatus, AiMigrationLog, ExtractDocumentDto, AiMigrationUpdateDto, AiPaginatedResult) ที่เกี่ยวข้องกับ migration_logs (ADR-020 era)
//   สงวน ExtractionResult ไว้ชั่วคราวเพราะ DocumentComparisonView ยังอ้างอิงอยู่ (dead component — จะ clean up ใน D162)
// - 2026-09-05: D162 follow-up — ลบ ExtractionResult แล้ว (DocumentComparisonView ถูกลบ — dead component ไม่มี caller)

// Feedback สำหรับปรับปรุงความแม่นยำ AI
export interface AiFeedbackDto {
  documentPublicId: string; // ADR-019: UUID เท่านั้น
  field: string;
  aiSuggestion: string;
  userCorrection: string;
  confidence: number;
  timestamp: string;
  userAgent: string;
}

// Metrics สำหรับ Admin Analytics Dashboard
export interface PerformanceMetrics {
  overallAccuracy: number;
  userCorrectionRate: number;
  avgProcessingTime: number;
  fieldAccuracy: Record<string, number>;
  modelPerformance: Record<string, number>;
}

export type ExecutionProfile = 'interactive' | 'standard' | 'quality' | 'deep-analysis';

export interface AiJobResponse {
  jobId: string;
  status: 'queued' | 'completed' | 'failed';
  modelUsed: 'np-dms-ai' | 'np-dms-ocr';
  effectiveProfile: ExecutionProfile;
  queueName: 'ai-realtime' | 'ai-batch';
}

/**
 * แท็กที่ AI แนะนำจากการวิเคราะห์เอกสาร (Pipeline B — ADR-023 D5)
 * - isNew=false: match กับ existing tag ในโปรเจกต์ → มี publicId
 * - isNew=true: AI แนะนำ tag ใหม่ที่ไม่มีในระบบ → ไม่มี publicId (สร้างใหม่เมื่อ commit)
 */
export interface SuggestedTag {
  name: string;
  description?: string;
  isNew: boolean;
  publicId?: string;
  confidence: number;
}

/**
 * ผลลัพธ์จากการวิเคราะห์เอกสารของ AI สำหรับ Pipeline B (New Correspondence)
 * Frontend ใช้ pre-fill Editable Review Form — user approve/edit ก่อน submit
 */
export interface AiJobResult {
  isValid: boolean;
  confidence: number;
  category: string;
  summary: string;
  suggestedTags: SuggestedTag[];
  detectedIssues: string[];
  // Fields สำหรับ pre-fill form (optional — AI อาจไม่สกัดได้)
  suggestedSubject?: string;
  suggestedDocumentDate?: string;
  suggestedSenderId?: string;
  suggestedDisciplineId?: string;
}

/**
 * สถานะของ AI Job สำหรับ polling (Pipeline B)
 */
export type AiJobStatus = 'queued' | 'processing' | 'completed' | 'failed';

/**
 * Response จาก GET /ai/jobs/:jobId สำหรับ polling
 */
export interface AiJobStatusResponse {
  jobId: string;
  status: AiJobStatus;
  result?: AiJobResult;
  error?: string;
}
