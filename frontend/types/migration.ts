export enum MigrationReviewStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

export interface MigrationReviewQueueItem {
  publicId: string; // ADR-019: public identifier
  id?: number; // Internal INT (excluded from API)
  documentNumber: string;
  title?: string;
  originalTitle?: string;
  aiSuggestedCategory?: string;
  aiConfidence?: number;
  aiIssues?: Record<string, unknown>;
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
  extractedTags?: Record<string, unknown>;
  tempAttachmentId?: number | string; // ADR-019: Accept UUID
}

export interface CommitBatchItemDto {
  queueId: number;
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
