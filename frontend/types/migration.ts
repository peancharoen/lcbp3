// File: types/migration.ts
// Change Log:
// - 2026-05-22: Initial creation and update for ADR-019 compatibility and added subject fields
// - 2026-08-06: เพิ่ม CompareStatus, CompareResult, CompareFieldResult, FieldResolution สำหรับ Feature 242

export enum MigrationReviewStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  IMPORTED = 'IMPORTED',
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
  aiSuggestedCategory?: string;
  aiSuggestedCategoryName?: string | null;
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
