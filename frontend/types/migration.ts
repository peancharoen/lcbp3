// File: types/migration.ts
// Change Log:
// - 2026-09-24: เพิ่ม typed field attachments ใน MigrationAiExtractionDetails
//   (enrichWithAttachments ฉีดตอน serialize — ใช้แสดงชื่อไฟล์ในหน้า queue)
// - 2026-09-24: เพิ่ม revision_label ใน MigrationAiExtractionDetails —
//   revision-chain import เก็บ label จริงจาก Excel column "revision"
//   (document_number เป็น staging key — เลขจริงใน original_document_number)
// - 2026-09-22: เพิ่ม typed fields contractId/contractCode/disciplineCode/disciplineId
//   ใน MigrationAiExtractionDetails — ingestion context ที่ backend persist ลง
//   ai_metadata_json (fix contractCode หลุดจาก /admin/migration)
// - 2026-09-14: T022 — ADR-054 contract finish: ตัด fieldResolutions ออกจาก details
//   (ย้ายไป reviewState.fieldResolutions), ย้าย compareResult/capturedThresholds ลง details
//   (AI output — ไม่เคยเป็น top-level field), เพิ่ม hasOcrTextBak flag สำหรับ list response
// - 2026-09-14: T016 — เพิ่ม first-class fields ตาม ADR-054: storageTempPath, originalFilename,
//   ocrTextBak, reviewState, importedCorrespondencePublicId (FR-007, FR-010)
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

/** ADR-050: reference shape ของสถานะการ resolve รายช่อง (data-model.md §4)
 *  ADR-054: ไม่ได้อยู่ใน details อีกต่อไป — backend ใช้เป็น commit-gate state เท่านั้น
 *  (reviewState.fieldResolutions เป็น FieldResolution[] ตาม Feature 242 contract) */
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
 *  ADR-054: bag แคบลงเหลือ AI output + residual ingestion keys เท่านั้น —
 *  `fieldResolutions` ย้ายไป `reviewState` (review_state_json), `source_file_path`
 *  ย้ายไป `storageTempPath` column, `attachment_ids` ซ้ำ `temp_attachment_ids` column
 *  มี index signature เพื่อรองรับ legacy/extra fields (เช่น disciplineId, attachments[]
 *  ที่ enrichWithAttachments ฉีดตอน serialize) ที่อาจอยู่ร่วมกับ new-shape fields ใน JSON เดียวกัน */
export interface MigrationAiExtractionDetails {
  ocrQuality: MigrationOcrQualityAssessment;
  metadata: MigrationExtractedMetadata;
  aiFailureReason?: MigrationAiFailureReason;
  /** Feature 242: ผลการเปรียบเทียบทะเบียนกับเอกสารจริง (FR-007) — AI output อยู่ใน details เสมอ */
  compareResult?: CompareResult;
  /** Feature 242 (FR-010c): ค่า threshold ที่จับภาพไว้ ณ เวลาประมวลผล */
  capturedThresholds?: CapturedThresholds;
  // ── ADR-054 D3: residual ingestion keys (ไม่มี dedicated column — re-extract preserve) ──
  /** index ของแถวใน Excel ตอน ingestion (เก็บไว้ debug/audit) */
  original_row_index?: number;
  /** ชื่อองค์กรผู้ส่ง/ผู้รับจาก Excel ที่ resolve ไม่ได้ตอน ingestion */
  unresolved_orgs?: Record<string, string>;
  /** เลขที่เอกสารฐานจริง (queue document_number เป็น staging key ที่อาจมี
   *  suffix เช่น -RA/-R1/-D1 — revision-chain import ใช้ค่านี้เป็น
   *  correspondenceNumber เสมอ) */
  original_document_number?: string;
  /** ลำดับ revision ภายใน batch เดียวกัน (0 = ต้นฉบับ) — legacy dedup counter */
  revision_number?: number;
  /** revision label จริงจาก Excel column "revision" ('0','1','2','A','B',…)
   *  — ใช้ resolve CorrespondenceRevision ตอน commit (revision-chain import) */
  revision_label?: string;
  /** Contract ที่เลือกตอน ingest (internal INT — contract lookup ผ่าน master API) */
  contractId?: number;
  /** รหัสคู่สัญญาที่เลือกตอน ingest เช่น LCBP3-C2 */
  contractCode?: string;
  /** discipline code จาก Excel column เช่น GEN/STR (resolve ภายใน contractId เท่านั้น) */
  disciplineCode?: string;
  /** Discipline internal ID ที่ resolve ได้ตอน ingestion */
  disciplineId?: number;
  /** Feature 242 (FR-005): attachment metadata ที่ enrichWithAttachments ฉีด
   *  ตอน serialize (ไม่ได้ persist ใน ai_metadata_json) — length > 0 =
   *  พบไฟล์ต้นฉบับแล้วตอน ingestion */
  attachments?: Array<{
    publicId?: string;
    originalFilename?: string;
    mimeType?: string;
    hasOcrText?: boolean;
    isMainDocument?: boolean;
  }>;
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
  reviewedBy?: number;
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
  /** Edge Case 4: flag แสดงว่า AI enrichment ล้มเหลวหลัง retry ครบ */
  aiFailed?: boolean;
  /** ADR-050: server-computed flag — แสดงว่า item ต้องการการตรวจสอบโดยมนุษย์ (FR-003) */
  requiresHumanReview?: boolean;
  /** ADR-050: OCR quality confidence 0-1, promoted from details.ocrQuality.confidence (FR-004) */
  ocrQualityConfidence?: number | null;
  /** ADR-054 (FR-010): ingestion metadata — path ไฟล์ staging (ย้ายออกจาก details.source_file_path) */
  storageTempPath?: string | null;
  /** ADR-054 (FR-010): ชื่อไฟล์ต้นฉบับ (ย้ายออกจาก details.original_filename) */
  originalFilename?: string | null;
  /** ADR-054 (D5, FR-007): OCR text สำรองก่อน user edit — restore ไม่ลบค่านี้
   *  list endpoint อาจไม่ส่ง (payload size) — ใช้ hasOcrTextBak ตรวจ presence แทน
   *  แต่ detail endpoint ต้องส่งเสมอ */
  ocrTextBak?: string | null;
  /** ADR-054 (D5): presence flag บน LIST response — true เมื่อ ocr_text_bak ไม่ว่าง
   *  (detail response ส่ง ocrTextBak เต็ม แทน flag นี้) */
  hasOcrTextBak?: boolean;
  /** ADR-054 (D9, FR-010): review state — การตัดสินใจของผู้ตรวจสอบเท่านั้น
   *  (fieldResolutions ย้ายออกจาก details.fieldResolutions; shape = FieldResolutionDto[]
   *  ตาม backend MigrationReviewState / data-model.md — ไม่ใช่ FieldResolutionState object) */
  reviewState?: {
    fieldResolutions?: FieldResolution[];
    fieldAcknowledgments?: string[];
  } | null;
  /** ADR-054 (D10, FR-010): audit link — publicId ของ correspondence ที่ import สำเร็จแล้ว */
  importedCorrespondencePublicId?: string | null;
  /** Metadata จาก ingestion / AI enrichment เช่น disciplineId (ADR-047)
   *  ADR-050: หลัง refactor จะมี shape เต็มรูปแบบตาม MigrationAiExtractionDetails
   *  ADR-054: AI output + residual ingestion keys เท่านั้น — source_file_path/original_filename/
   *  fieldResolutions ย้ายออกเป็น first-class fields แล้ว
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
