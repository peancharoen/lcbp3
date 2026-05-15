// File: src/modules/ai/dto/legacy-migration.dto.ts
// Change Log
// - 2026-05-14: เพิ่ม DTO สำหรับ ADR-023 legacy migration staging endpoints.
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { MigrationReviewRecordStatus } from '../entities/migration-review.entity';

export class LegacyMigrationRecordDto {
  @IsString()
  @IsOptional()
  originalFileName?: string;

  @IsObject()
  @IsOptional()
  extractedMetadata?: Record<string, unknown>;

  @Transform(({ value }: { value: unknown }) =>
    value === undefined || value === null || value === ''
      ? undefined
      : Number(value)
  )
  @IsNumber()
  @Min(0)
  @Max(1)
  @IsOptional()
  confidenceScore?: number;

  @IsEnum(MigrationReviewRecordStatus)
  @IsOptional()
  status?: MigrationReviewRecordStatus;

  @IsString()
  @IsOptional()
  errorReason?: string;
}

export class LegacyMigrationIngestDto {
  @IsString()
  @IsNotEmpty()
  batchId!: string;

  @IsString()
  @IsOptional()
  source?: 'api' | 'folder-watcher';

  @IsOptional()
  records?: LegacyMigrationRecordDto[] | string;
}

export class LegacyMigrationQueueQueryDto {
  @Transform(({ value }: { value: unknown }) =>
    value === undefined ? 1 : Number(value)
  )
  @IsNumber()
  @Min(1)
  @IsOptional()
  page?: number;

  @Transform(({ value }: { value: unknown }) =>
    value === undefined ? 20 : Number(value)
  )
  @IsNumber()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit?: number;

  @IsEnum(MigrationReviewRecordStatus)
  @IsOptional()
  status?: MigrationReviewRecordStatus;
}

export class ApproveLegacyMigrationDto {
  @IsString()
  @IsNotEmpty()
  documentNumber!: string;

  @IsString()
  @IsNotEmpty()
  subject!: string;

  @IsString()
  @IsNotEmpty()
  categoryCode!: string;

  @IsUUID()
  projectPublicId!: string;

  @IsUUID()
  @IsOptional()
  senderOrganizationPublicId?: string;

  @IsUUID()
  @IsOptional()
  receiverOrganizationPublicId?: string;

  @IsString()
  @IsOptional()
  issuedDate?: string;

  @IsString()
  @IsOptional()
  receivedDate?: string;

  @IsString()
  @IsOptional()
  body?: string;

  @IsObject()
  @IsOptional()
  finalMetadata?: Record<string, unknown>;
}
