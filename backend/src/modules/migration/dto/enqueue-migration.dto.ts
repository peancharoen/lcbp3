import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsBoolean,
  IsArray,
  IsEnum,
} from 'class-validator';
import type {
  CompareResult,
  CapturedThresholds,
} from '../../ai/types/migration-compare-result.type';
import { CompareStatus } from '../entities/migration-review-queue.entity';

export class EnqueueMigrationDto {
  @IsString()
  @IsNotEmpty()
  documentNumber!: string;

  @IsString()
  @IsOptional()
  subject?: string;

  @IsString()
  @IsOptional()
  originalSubject?: string;

  @IsString()
  @IsOptional()
  body?: string;

  @IsString()
  @IsOptional()
  category?: string;

  @IsString()
  @IsOptional()
  aiSummary?: string;

  @IsNumber()
  @IsOptional()
  projectId?: number;

  @IsNumber()
  @IsOptional()
  senderOrgId?: number;

  @IsNumber()
  @IsOptional()
  receiverOrgId?: number;

  @IsString()
  @IsOptional()
  issuedDate?: string;

  @IsString()
  @IsOptional()
  receivedDate?: string;

  @IsString()
  @IsOptional()
  remarks?: string;

  @IsArray()
  @IsOptional()
  extractedTags?: Record<string, string>[];

  @IsOptional()
  details?: Record<string, unknown>;

  /** @deprecated ใช้ tempAttachmentIds แทน — retained for backward compatibility (R4) */
  @IsNumber()
  @IsOptional()
  tempAttachmentId?: number;

  /** รายการ internal attachment IDs หลายไฟล์ (FR-001, FR-002) */
  @IsArray()
  @IsOptional()
  tempAttachmentIds?: number[];

  @IsBoolean()
  @IsOptional()
  isValid?: boolean;

  @IsNumber()
  @IsOptional()
  confidence?: number;

  @IsArray()
  @IsOptional()
  aiIssues?: Record<string, unknown>[];

  @IsString()
  @IsOptional()
  aiJobId?: string;

  /** ผลการเปรียบเทียบทะเบียนกับเอกสารจริง (FR-007) */
  @IsOptional()
  compareResult?: CompareResult;

  /** สถานะการเปรียบเทียบ (FR-012a) */
  @IsEnum(CompareStatus)
  @IsOptional()
  compareStatus?: CompareStatus;

  /** เหตุผลภาษาไทยเมื่อ compareStatus = UNAVAILABLE (FR-012b) */
  @IsString()
  @IsOptional()
  compareUnavailableReason?: string;

  /** ค่า threshold ที่จับภาพไว้ ณ เวลาประมวลผล (FR-010c) */
  @IsOptional()
  capturedThresholds?: CapturedThresholds;
}
