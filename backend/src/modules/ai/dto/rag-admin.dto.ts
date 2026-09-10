// File: backend/src/modules/ai/dto/rag-admin.dto.ts
// Change Log:
// - 2026-09-10: T007 — เพิ่ม admin DTOs สำหรับ Feature 255 RAG Admin Console (8 endpoints)

import {
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsUUID,
  ArrayMaxSize,
  ArrayMinSize,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Enum สำหรับ pageSize — รับเฉพาะ 10, 20, 50 เท่านั้น (Q20)
 */
export enum RagAdminPageSize {
  TEN = 10,
  TWENTY = 20,
  FIFTY = 50,
}

/**
 * Enum สำหรับ ragStatus filter — ใช้ generation status จริง + NOT_STARTED (computed, Q5)
 */
export enum RagAdminStatusFilter {
  NOT_STARTED = 'NOT_STARTED',
  BUILDING = 'BUILDING',
  ACTIVE = 'ACTIVE',
  RETIRED = 'RETIRED',
  FAILED = 'FAILED',
}

/**
 * Enum สำหรับ aiProcessingStatus (supplementary column, Q7)
 */
export enum AiProcessingStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  DONE = 'DONE',
  FAILED = 'FAILED',
}

/**
 * Enum สำหรับ security classification
 */
export type SecurityClassification = 'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL';

/**
 * Query DTO สำหรับ GET /ai/admin/rag/attachments (dashboard list)
 */
export class RagAdminListAttachmentsDto {
  @ApiPropertyOptional({
    description: 'กรองตาม RAG status',
    enum: RagAdminStatusFilter,
  })
  @IsOptional()
  @IsEnum(RagAdminStatusFilter)
  public status?: RagAdminStatusFilter;

  @ApiPropertyOptional({ description: 'หน้าที่ (default: 1)', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  public page?: number;

  @ApiPropertyOptional({
    description: 'จำนวนรายการต่อหน้า (enum: 10, 20, 50 — default: 20)',
    enum: RagAdminPageSize,
    default: RagAdminPageSize.TWENTY,
  })
  @IsOptional()
  @Type(() => Number)
  @IsEnum(RagAdminPageSize)
  public pageSize?: RagAdminPageSize;
}

/**
 * Query DTO สำหรับ GET /ai/admin/rag/attachments/classification (classification list, Q43)
 */
export class RagAdminClassificationListDto {
  @ApiPropertyOptional({ description: 'หน้าที่ (default: 1)', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  public page?: number;

  @ApiPropertyOptional({
    description: 'จำนวนรายการต่อหน้า (enum: 10, 20, 50 — default: 20)',
    enum: RagAdminPageSize,
    default: RagAdminPageSize.TWENTY,
  })
  @IsOptional()
  @Type(() => Number)
  @IsEnum(RagAdminPageSize)
  public pageSize?: RagAdminPageSize;
}

/**
 * Query DTO สำหรับ GET /ai/admin/rag/failed-ingestions (2 sections, Q31)
 */
export class RagAdminFailedIngestionsDto {
  @ApiPropertyOptional({
    description: 'หน้าที่ — ใช้กับ ragFailures section เท่านั้น (default: 1)',
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  public page?: number;

  @ApiPropertyOptional({
    description:
      'จำนวนรายการต่อหน้า — ใช้กับ ragFailures section เท่านั้น (enum: 10, 20, 50)',
    enum: RagAdminPageSize,
    default: RagAdminPageSize.TWENTY,
  })
  @IsOptional()
  @Type(() => Number)
  @IsEnum(RagAdminPageSize)
  public pageSize?: RagAdminPageSize;
}

/**
 * Request DTO สำหรับ POST /ai/admin/rag/failed-ingestions/retry (batch retry, Q34)
 */
export class RagAdminBatchRetryDto {
  @ApiProperty({
    description: 'Array ของ attachment publicId ที่ต้องการ retry (max 50)',
    type: [String],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @IsUUID('7', { each: true })
  public attachmentPublicIds!: string[];
}

// ==========================================================
// Response DTOs
// ==========================================================

/**
 * classificationOverride object จาก audit log (Q11)
 */
export interface ClassificationOverrideInfo {
  reason: string;
  overriddenBy: string;
  overriddenAt: Date;
}

/**
 * Item ใน RagAdminAttachmentsResponseDto (dashboard list)
 */
export interface RagAdminAttachmentItem {
  attachmentPublicId: string;
  originalFilename: string;
  mimeType: string;
  ragStatus: RagAdminStatusFilter;
  aiProcessingStatus: AiProcessingStatus;
  chunkCount: number;
  effectiveClassification: SecurityClassification;
  classificationOverride: ClassificationOverrideInfo | null;
  lastUpdated: Date;
  errorMessage: string | null;
}

/**
 * Response DTO สำหรับ GET /ai/admin/rag/attachments
 */
export class RagAdminAttachmentsResponseDto {
  public items!: RagAdminAttachmentItem[];
  public total!: number;
  public page!: number;
  public pageSize!: number;
}

/**
 * Item ใน RagAdminClassificationListResponseDto (classification list, Q43)
 */
export interface RagAdminClassificationItem {
  attachmentPublicId: string;
  originalFilename: string;
  effectiveClassification: SecurityClassification;
  classificationOverride: ClassificationOverrideInfo | null;
}

/**
 * Response DTO สำหรับ GET /ai/admin/rag/attachments/classification
 */
export class RagAdminClassificationListResponseDto {
  public items!: RagAdminClassificationItem[];
  public total!: number;
  public page!: number;
  public pageSize!: number;
}

/**
 * Item ใน RagAdminGenerationsResponseDto (lifecycle, Q25)
 * Note: generationUuid ไม่ถูก expose (FR-014)
 */
export interface RagAdminGenerationItem {
  status: 'BUILDING' | 'ACTIVE' | 'RETIRED' | 'FAILED';
  chunkCount: number;
  createdAt: Date;
  activatedAt: Date | null;
  retiredAt: Date | null;
  failedAt: Date | null;
  errorCode: string | null;
  errorMessage: string | null;
}

/**
 * Response DTO สำหรับ GET /ai/admin/rag/attachments/:id/generations
 */
export class RagAdminGenerationsResponseDto {
  public attachmentPublicId!: string;
  public generations!: RagAdminGenerationItem[];
}

/**
 * Item ใน ragFailures section (Q31)
 */
export interface RagAdminFailureItem {
  attachmentPublicId: string;
  originalFilename: string;
  ragStatus: 'FAILED';
  errorCode: string | null;
  errorMessage: string | null;
  failedAt: Date | null;
}

/**
 * Item ใน aiPipelineFailures section (Q31)
 */
export interface AiPipelineFailureItem {
  attachmentPublicId: string;
  originalFilename: string;
  aiProcessingStatus: 'FAILED';
  errorMessage: string | null;
}

/**
 * Response DTO สำหรับ GET /ai/admin/rag/failed-ingestions (2 sections, Q31)
 */
export class RagAdminFailedIngestionsResponseDto {
  public ragFailures!: {
    items: RagAdminFailureItem[];
    total: number;
    page: number;
    pageSize: number;
  };
  public aiPipelineFailures!: {
    items: AiPipelineFailureItem[];
    total: number;
  };
}

/**
 * Item ใน succeeded[] ของ batch retry response (Q17)
 */
export interface BatchRetrySuccessItem {
  attachmentPublicId: string;
  jobId: string;
}

/**
 * Item ใน failed[] ของ batch retry response (Q17)
 */
export interface BatchRetryFailedItem {
  attachmentPublicId: string;
  reason: string;
}

/**
 * Response DTO สำหรับ POST /ai/admin/rag/failed-ingestions/retry (partial-success, Q17)
 */
export class RagAdminBatchRetryResponseDto {
  public succeeded!: BatchRetrySuccessItem[];
  public failed!: BatchRetryFailedItem[];
  public totalRequested!: number;
  public totalSucceeded!: number;
  public totalFailed!: number;
}

/**
 * Response DTO สำหรับ POST /ai/admin/rag/attachments/:id/reingest
 */
export class RagAdminReingestResponseDto {
  public attachmentPublicId!: string;
  public status!: 'BUILDING';
  public jobId!: string;
}

/**
 * Response DTO สำหรับ POST /ai/admin/rag/metrics/reset (global-only, Q15)
 */
export class RagAdminMetricsResetResponseDto {
  public reset!: boolean;
  public scope!: 'global';
}

/**
 * Metrics snapshot DTO สำหรับ GET /ai/admin/rag/metrics (US4)
 * Mirror RagObservabilityService.getSnapshot() shape
 */
export interface RagAdminMetricsSnapshotDto {
  swap: {
    started: number;
    completed: number;
    rolledBack: number;
    activeConcurrent: number;
    maxConcurrent: number;
  };
  qdrantDeletion: {
    attempted: number;
    succeeded: number;
    partialFailures: number;
    totalPendingRetries: number;
  };
  cleanup: {
    processed: number;
    succeeded: number;
    failed: number;
  };
  ingestionDuration: {
    count: number;
    sumMs: number;
    buckets: { '100': number; '500': number; '2000': number };
  };
  chunkCount: { totalChunks: number; ingestions: number };
  vectorLatency: {
    count: number;
    sumMs: number;
    buckets: { '50': number; '100': number; '500': number; '2000': number };
  };
  staleResultRate: { filtered: number; total: number };
  fallbackRate: { fullTextFallbacks: number; totalQueries: number };
  cleanupRetryRate: { retries: number };
  uptimeMs: number;
}
