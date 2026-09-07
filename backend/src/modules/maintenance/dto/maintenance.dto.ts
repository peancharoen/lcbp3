// File: backend/src/modules/maintenance/dto/maintenance.dto.ts
// Change Log:
// - 2026-09-07: DTOs for Maintenance Console endpoints (Code Review M2)

import {
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  IsIn,
  ArrayMaxSize,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO สำหรับ sync numbering counters
 */
export class SyncCountersDto {
  @ApiPropertyOptional({ description: 'Project publicId (UUIDv7)' })
  @IsOptional()
  @IsUUID('7')
  projectId?: string;
}

/**
 * DTO สำหรับ manual override numbering counter
 */
export class OverrideCounterDto {
  @ApiProperty({ description: 'Counter key เช่น CORR-PROJ-2026' })
  @IsString()
  counterKey!: string;

  @ApiProperty({ description: 'ค่า lastNumber ใหม่', example: 150 })
  @IsInt()
  @Min(0)
  newLastNumber!: number;
}

/**
 * DTO สำหรับ purge orphan files
 */
export class PurgeOrphansDto {
  @ApiProperty({
    description: 'รายการ path ของ orphan files ที่ต้องการลบ (max 500)',
    type: [String],
  })
  @IsArray()
  @ArrayMaxSize(500)
  @IsString({ each: true })
  paths!: string[];
}

/**
 * DTO สำหรับ enqueue re-embed
 */
export class EnqueueReEmbedDto {
  @ApiProperty({ description: 'Project publicId (UUIDv7)' })
  @IsUUID('7')
  projectPublicId!: string;

  @ApiProperty({ description: 'Document publicId (UUIDv7)' })
  @IsUUID('7')
  documentPublicId!: string;
}

/**
 * DTO สำหรับ force release locks
 */
export class ReleaseLocksDto {
  @ApiProperty({
    description: 'รายการ lock keys ที่ต้องการปลด (max 100)',
    type: [String],
  })
  @IsArray()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  lockKeys!: string[];
}

/**
 * DTO สำหรับ emergency bulk hard purge
 */
export class BulkHardPurgeDto {
  @ApiProperty({
    description: 'รายการ publicId ของเอกสารที่ต้องการ hard purge (max 100)',
    type: [String],
  })
  @IsArray()
  @ArrayMaxSize(100)
  @IsUUID('7', { each: true })
  publicIds!: string[];

  @ApiProperty({
    description: 'ประเภทเอกสาร',
    enum: ['CORRESPONDENCE', 'RFA', 'TRANSMITTAL', 'DRAWING'],
  })
  @IsIn(['CORRESPONDENCE', 'RFA', 'TRANSMITTAL', 'DRAWING'])
  documentType!: 'CORRESPONDENCE' | 'RFA' | 'TRANSMITTAL' | 'DRAWING';
}
