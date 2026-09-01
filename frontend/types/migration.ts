// File: types/migration.ts
// Change Log:
// - 2026-08-31: T029 — เพิ่ม requiresHumanReview, ocrQualityConfidence, MigrationAiExtractionDetails (ADR-050)
// - 2026-08-23: เพิ่ม details field ใน MigrationReviewQueueItem สำหรับ source_file_path/disciplineId
// - 2026-05-22: Initial creation and update for ADR-019 compatibility and added subject fields
// - 2026-08-06: เพิ่ม CompareStatus, CompareResult, CompareFieldResult, FieldResolution สำหรับ Feature 242
// - 2026-08-22: ปรับ MigrationReviewStatus, เพิ่ม MigrationAiStatus, aiStatus, aiJobId (ADR-047)

export enum MigrationReviewStatus {
  PENDING = 'PENDING',
  PENDING_REVIEW = 'PENDING_REVIEW',
  REJECTED = 'REJECTED',
  IMPORTED = 'IMPORTED',
}

/** ADR-047: สถานะ BullMQ AI job ของ migration queue item */
export enum MigrationAiStatus {
  PENDING = 'PENDING',
  WAITING = 'WAITING',
  RUNNING = 'RUNNING',
  DONE = 'DONE',
  FAILED = 'FAILED',
}

/** สถานะการเปรียบเทียบทะเบียนกับเอกสารจริง (FR-012a) */
export enum CompareStatus {
  COMPARED = 'COMPARED',
  UNAVAILABLE = 'UNAVAILABLE',
}

/** ชื่อช่องที่เปรียบเทียบ (FR-006) */
export type ComparedField =
  | 'documentNumber'
  | 'subject'
  | 'documentDate'
  | 'fromOrganization'
  | 'toOrganization'
  | 'correspondenceType'
  | 'discipline'
  | 'project'
  | 'revision';

/** ผลการเปรียบเทียบรายช่อง (FR-007) */
export interface CompareFieldResult {
  field: ComparedField;
  excelValue: string | null;
  ocrValue: string | null;
  match: boolean;
  foundInDocument: boolean;
}

/** ผลการเปรียบเทียบทั้งฉบับ (FR-007, FR-008) */
export interface CompareResult {
  fieldResults: CompareFieldResult[];
  mismatches: string[];
  confidence: number;
}

/** การตัดสินใจของผู้ตรวจสอบรายช่อง (FR-011, FR-011b) */
export interface FieldResolution {
  field: string;
  source: 'EXCEL' | 'DOCUMENT' | 'MANUAL';
  finalValue: string;
}

/** ค่า threshold ที่จับภาพไว้ ณ เวลาประมวลผล (FR-010c) */
export interface CapturedThresholds {
  maxMismatchFields: number;
  minConfidence: number;
}

/** ADR-050: Tag suggestion จาก AI extraction (data-model.md §3) */
export interface MigrationTagSuggestion {
  name: string;
  isNew: boolean;
  evidence: string;
}

/** ADR-050: สถานะการ resolve รายช่องของผู้ตรวจสอบ (data-model.md §4) */
export interface MigrationFieldResolutionState {
  ocrQuality?: 'edited' | 'acknowledged';
  summary?: 'edited' | 'acknowledged';
  correspondenceType?: 'edited' | 'acknowledged';
  tags?: 'edited' | 'acknowledged';
}

/** ADR-050: คุณภาพ OCR จาก AI extraction (data-model.md §2) */
export interface MigrationOcrQualityAssessment {
  confidence: number;
  issues: Array<{
    type: string;
    message: string;
    evidence: string;
  }>;
}

/** ADR-050: confidence รายช่องของ metadata (data-model.md §1) */
export interface MigrationMetadataConfidence {
  summary: number;
  correspondenceType: number;
  tags: number;
}

/** ADR-050: metadata ที่สกัดจาก AI (data-model.md §1) */
export interface MigrationExtractedMetadata {
  summary: string;
  correspondenceType: string;
  tags: MigrationTagSuggestion[];
  confidence: MigrationMetadataConfidence;
}

/** ADR-050: สาเหตุการล้มเหลวของ AI (data-model.md §1) */
export type MigrationAiFailureReason = 'SCHEMA_VALIDATION_FAILED' | 'LLM_CALL_FAILED';

/** ADR-050: details JSON shape เต็มรูปแบบสำหรับ AI extraction output (data-model.md §1)
 *  มี index signature เพื่อรองรับ legacy/extra fields (เช่น source_file_path, disciplineId)
 *  ที่อาจอยู่ร่วมกับ new-shape fields ใน JSON เดียวกัน */
export interface MigrationAiExtractionDetails {
  ocrQuality: MigrationOcrQualityAssessment;
  metadata: MigrationExtractedMetadata;
  aiFailureReason?: MigrationAiFailureReason;
  fieldResolutions: MigrationFieldResolutionState;
  [key: string]: unknown;
}

export interface MigrationReviewQueueItem {
  publicId: string; // ADR-019: public identifier
  id?: number; // Internal INT (excluded from API)
  batchId?: string; // ADR-047: batch identifier for bulk operations
  documentNumber: string;
  title?: string;
  originalTitle?: string;
  subject?: string;
  originalSubject?: string;
  body?: string;
  aiSuggestedCorrespondenceType?: string;
  aiSuggestedCorrespondenceTypeName?: string | null;
  senderOrganizationCode?: string | null;
  receiverOrganizationCode?: string | null;
  /** ADR-019: publicId (UUID) ขององค์กรผู้ส่ง (สำหรับ dropdown selection) */
  senderOrganizationPublicId?: string | null;
  /** ADR-019: publicId (UUID) ขององค์กรผู้รับ (สำหรับ dropdown selection) */
  receiverOrganizationPublicId?: string | null;
  aiConfidence?: number;
  aiIssues?: Record<string, unknown>[];
  reviewReason?: string;
  status: MigrationReviewStatus;
  aiStatus?: MigrationAiStatus;
  aiJobId?: string | null;
  reviewedBy?: string;
  reviewedAt?: string;
  createdAt: string;
  projectId?: number | string; // ADR-019: Accept UUID
  senderOrganizationId?: number | string; // ADR-019: Accept UUID
  receiverOrganizationId?: number | string; // ADR-019: Accept UUID
  receivedDate?: string;
  issuedDate?: string;
  remarks?: string;
  aiSummary?: string;
  extractedTags?: Record<string, unknown>[];
  ocrText?: string | null;
  tempAttachmentId?: number | string; // ADR-019: Accept UUID
  // Feature 242: multi-attachment + compare
  tempAttachmentIds?: number[];
  compareStatus?: CompareStatus;
  compareUnavailableReason?: string;
  compareResult?: CompareResult;
  capturedThresholds?: CapturedThresholds;
  /** Edge Case 4: flag แสดงว่า AI enrichment ล้มเหลวหลัง retry ครบ */
  aiFailed?: boolean;
  /** ADR-050: server-computed flag — แสดงว่า item ต้องการการตรวจสอบโดยมนุษย์ (FR-003) */
  requiresHumanReview?: boolean;
  /** ADR-050: OCR quality confidence 0-1, promoted from details.ocrQuality.confidence (FR-004) */
  ocrQualityConfidence?: number | null;
  /** Metadata จาก ingestion / AI enrichment เช่น source_file_path, disciplineId (ADR-047)
   *  ADR-050: หลัง refactor จะมี shape เต็มรูปแบบตาม MigrationAiExtractionDetails
   *  Legacy items (pre-refactor) อาจมี shape เดิมที่ไม่มี metadata.confidence */
  details?: MigrationAiExtractionDetails | Record<string, unknown> | null;
}

export interface CommitBatchItemDto {
  /** ADR-019: ใช้ publicId (UUIDv7) เท่านั้น ห้ามใช้ INT id */
  queuePublicId: string;
  dto: Record<string, unknown>;
}

export interface CommitBatchDto {
  items: CommitBatchItemDto[];
  batchId: string;
}

export enum MigrationErrorType {
  FILE_NOT_FOUND = 'FILE_NOT_FOUND',
  AI_PARSE_ERROR = 'AI_PARSE_ERROR',
  API_ERROR = 'API_ERROR',
  DB_ERROR = 'DB_ERROR',
  SECURITY = 'SECURITY',
  UNKNOWN = 'UNKNOWN',
}

export interface MigrationErrorItem {
  publicId: string; // ADR-019: public identifier
  id?: number; // Internal INT (excluded from API)
  batchId?: string;
  documentNumber?: string;
  errorType?: MigrationErrorType;
  errorMessage?: string;
  rawAiResponse?: string;
  createdAt: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface StartIngestPayload {
  filePath: string;
  projectPublicId: string;
  contractCode?: string;
  sheetName?: string;
  pdfFolderPath?: string;
  batchId?: string;
  resume?: boolean;
}

/** ADR-047: ผลลัพธ์จาก startIngestion */
export interface StartIngestResponse {
  message: string;
  batchId: string;
  totalRowsProcessed: number;
  enqueuedCount: number;
  skippedCount: number;
  errorCount: number;
  lastProcessedIndex: number;
  status: string;
  filePath: string;
}

export interface UpdateQueueOcrPayload {
  ocrText: string;
  reEmbed?: boolean;
}
