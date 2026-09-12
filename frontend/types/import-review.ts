// File: types/import-review.ts
// Change Log:
// - 2026-09-09: Initial creation — frontend types for 4-Layer Excel Data Review
//   Pipeline (Feature 252, ADR-052). Mirrors backend
//   backend/src/modules/migration/types/excel-review.types.ts and
//   backend/src/modules/migration/services/excel-data-review.service.ts
//   response shapes exactly so the UI stays in sync with the API contract.
// - 2026-09-12: Async/polling pattern — เพิ่ม CheckReviewAsyncResponse +
//   ReviewStatusResponse สำหรับ poll GET /:sessionId/status (ADR-008)

export type FindingLevel = 'BLOCK' | 'WARN' | 'AI_SUGGEST';

export type ReviewTargetMode = 'MIGRATION_STAGING' | 'DIRECT_IMPORT';

export type AiReviewerProvider = 'LOCAL_OLLAMA' | 'GEMINI' | 'CLAUDE';

export type BatchStrategy = 'FULL' | 'FAST_SELECTIVE';

/** Session status สำหรับ async pattern (ADR-008) */
export type ReviewSessionStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'READY'
  | 'FAILED'
  | 'CONFIRMED'
  | 'CANCELLED'
  | 'EXPIRED';

export interface ReviewFinding {
  row: number;
  column: string;
  level: FindingLevel;
  message: string;
  originalValue: unknown;
  suggestedValue?: unknown;
  confidence?: number;
}

/** Response ของ POST /v1/correspondence/import-review/check (FR-001) */
export interface CheckReviewResponse {
  reviewSessionPublicId: string;
  targetMode: ReviewTargetMode;
  totalRows: number;
  passCount: number;
  warnCount: number;
  blockCount: number;
  aiSuggestCount: number;
  canConfirm: boolean;
  downloadAnnotatedUrl: string;
  findings: ReviewFinding[];
  aiAvailable: boolean;
  aiUnavailableReason?: string;
  aiReviewedRowCount: number;
  aiSamplingMode: BatchStrategy;
}

/** Response ของ POST /check (async pattern — คืนทันที ไม่รอประมวลผล) */
export interface CheckReviewAsyncResponse {
  reviewSessionPublicId: string;
  status: 'PENDING';
  statusUrl: string;
}

/** Response ของ GET /:sessionId/status (async pattern — poll จนเสร็จ) */
export interface ReviewStatusResponse {
  reviewSessionPublicId: string;
  status: ReviewSessionStatus;
  progress?: number;
  currentStep?: string;
  errorMessage?: string;
  /** ผลลัพธ์เมื่อ status === 'READY' */
  result?: CheckReviewResponse;
}

/** Response ของ POST /v1/correspondence/import-review/:sessionId/confirm (FR-014~FR-017) */
export interface ConfirmReviewResponse {
  reviewSessionPublicId: string;
  batchId: string;
  targetMode: ReviewTargetMode;
  totalRows: number;
  enqueuedCount: number;
  quarantinedCount: number;
  failedRowsDownloadUrl: string;
  status: 'CONFIRMED';
}

/** Response ของ POST /v1/correspondence/import-review/:sessionId/cancel (FR-016) */
export interface CancelReviewResponse {
  reviewSessionPublicId: string;
  status: 'CANCELLED';
}
