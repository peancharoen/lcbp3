// File: backend/src/modules/migration/dto/migration-queue-query.dto.ts
// Change Log:
// - 2026-09-16: เพิ่ม correspondenceType filter และ confidenceBucket filter
//   (low/mid/high/missing ตามเกณฑ์ badge ของหน้า Legacy Review Queue)
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
    description:
      'Filter by AI-suggested correspondence type code (เช่น RFA, LETTER, TRANSMITTAL)',
  })
  @IsOptional()
  @IsString()
  correspondenceType?: string;

  @ApiPropertyOptional({
    description:
      'Filter by aiConfidence bucket — low (<0.5), mid (0.5-0.8), high (>0.8), missing (NULL)',
    enum: ['low', 'mid', 'high', 'missing'],
  })
  @IsOptional()
  @IsIn(['low', 'mid', 'high', 'missing'])
  confidenceBucket?: 'low' | 'mid' | 'high' | 'missing';

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
