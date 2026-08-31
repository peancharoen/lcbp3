// File: backend/src/modules/migration/dto/migration-queue-query.dto.ts
// Change Log:
// - 2026-08-23: เพิ่ม batchId filter สำหรับ getReviewQueue
// - 2026-08-31: ADR-050/FR-003/FR-004 — เพิ่ม requiresHumanReview filter และ
//   sortBy=ocrQualityConfidence + sortOrder สำหรับ GET /migration/queue (T019)

import {
  IsOptional,
  IsEnum,
  IsInt,
  Min,
  IsString,
  IsBoolean,
  IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  MigrationReviewStatus,
  MigrationAiStatus,
} from '../entities/migration-review-queue.entity';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class PaginationDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 10;
}

export class MigrationQueueQueryDto extends PaginationDto {
  @ApiPropertyOptional({ enum: MigrationReviewStatus })
  @IsOptional()
  @IsEnum(MigrationReviewStatus)
  status?: MigrationReviewStatus;

  @ApiPropertyOptional({ enum: MigrationAiStatus })
  @IsOptional()
  @IsEnum(MigrationAiStatus)
  aiStatus?: MigrationAiStatus;

  @ApiPropertyOptional({ description: 'Filter by batchId (ADR-047)' })
  @IsOptional()
  @IsString()
  batchId?: string;

  @ApiPropertyOptional({
    description: 'ADR-050/FR-003 — filter to only items requiring human review',
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  requiresHumanReview?: boolean;

  @ApiPropertyOptional({
    description: 'ADR-050/FR-004 — sort key',
    enum: ['ocrQualityConfidence'],
  })
  @IsOptional()
  @IsIn(['ocrQualityConfidence'])
  sortBy?: 'ocrQualityConfidence';

  @ApiPropertyOptional({
    description: 'Sort order for sortBy',
    enum: ['asc', 'desc'],
    default: 'asc',
  })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'asc';
}
