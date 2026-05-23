// File: src/modules/ai/dto/migration-checkpoint.dto.ts
// Change Log:
// - 2026-05-23: สร้าง DTOs สำหรับ Migration Checkpoint API endpoints (ADR-023A)

import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { MigrationProgressStatus } from '../entities/migration-progress.entity';

/** DTO สำหรับบันทึก/อัพเดต Checkpoint */
export class SaveCheckpointDto {
  @IsString()
  @IsNotEmpty()
  batchId!: string;

  @IsNumber()
  @Min(0)
  lastProcessedIndex!: number;

  @IsEnum(MigrationProgressStatus)
  @IsOptional()
  status?: MigrationProgressStatus;
}

/** DTO สำหรับบันทึกรายการเข้า Review Queue */
export class MigrationQueueRecordDto {
  @IsString()
  @IsNotEmpty()
  batchId!: string;

  @IsString()
  @IsNotEmpty()
  documentNumber!: string;

  @IsString()
  @IsOptional()
  subject?: string;

  @IsString()
  @IsOptional()
  originalSubject?: string;

  @IsNumber()
  @IsOptional()
  tempAttachmentId?: number;

  @IsNumber()
  @Min(0)
  @Max(1)
  @IsOptional()
  confidence?: number;

  @IsString()
  @IsOptional()
  reviewReason?: string;

  @IsEnum(['PENDING', 'PENDING_REVIEW'])
  status!: 'PENDING' | 'PENDING_REVIEW';

  @IsObject()
  @IsOptional()
  aiResult?: Record<string, unknown>;

  @IsString()
  @IsOptional()
  idempotencyKey?: string;
}

/** DTO สำหรับบันทึก Error Log */
export class MigrationErrorLogDto {
  @IsString()
  @IsNotEmpty()
  batchId!: string;

  @IsString()
  @IsNotEmpty()
  documentNumber!: string;

  @IsString()
  @IsOptional()
  errorType?: string;

  @IsString()
  @IsOptional()
  errorMessage?: string;

  @IsString()
  @IsOptional()
  jobId?: string;
}
