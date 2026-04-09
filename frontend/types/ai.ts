// File: types/ai.ts
// ประเภทข้อมูลสำหรับ AI Integration (ADR-018, ADR-020)

// สถานะของ AI Migration Log (ตรงกับ backend MigrationLogStatus)
export enum AiMigrationLogStatus {
  PENDING_REVIEW = 'PENDING_REVIEW',
  VERIFIED = 'VERIFIED',
  IMPORTED = 'IMPORTED',
  FAILED = 'FAILED',
}

// ผลลัพธ์จาก Real-time AI Extraction
export interface ExtractionResult {
  migrationLogPublicId: string; // ADR-019: UUID เท่านั้น
  status: 'processing' | 'completed' | 'failed';
  extractedMetadata?: Record<string, unknown>;
  confidenceScore?: number;
  action?: string;
  processingTimeMs?: number;
}

// ข้อมูล AI Migration Log (ตาราง migration_logs)
export interface AiMigrationLog {
  publicId: string; // ADR-019: UUID เท่านั้น
  sourceFile: string;
  sourceMetadata?: Record<string, unknown>;
  aiExtractedMetadata?: Record<string, unknown>;
  confidenceScore?: number;
  status: AiMigrationLogStatus;
  adminFeedback?: string;
  reviewedAt?: string;
  createdAt: string;
  updatedAt: string;
}

// DTO สำหรับส่ง Extract Document ไปยัง AI
export interface ExtractDocumentDto {
  publicId: string; // ADR-019: UUID ของไฟล์ใน temp storage
  context: 'ingestion' | 'migration' | 'review';
  fileType?: string;
}

// DTO สำหรับอัปเดตสถานะ Migration Log (Admin)
export interface AiMigrationUpdateDto {
  status?: AiMigrationLogStatus;
  adminFeedback?: string;
}

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

// Paginated Result สำหรับ AI endpoints
export interface AiPaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
