// File: backend/src/modules/migration/dto/commit-batch.dto.ts
// Change Log:
// - 2026-08-06: Initial creation
// - 2026-08-20: ADR-019 — เปลี่ยน queueId (INT) เป็น queuePublicId (UUIDv7) ใน API contract

import {
  IsArray,
  ValidateNested,
  IsString,
  IsNotEmpty,
  IsUUID,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ImportCorrespondenceDto } from './import-correspondence.dto';

export class CommitBatchItemDto {
  /** ADR-019: ใช้ publicId (UUIDv7) เท่านั้น ห้ามใช้ INT id ใน API */
  @IsUUID('7')
  @IsNotEmpty()
  queuePublicId!: string;

  @ValidateNested()
  @Type(() => ImportCorrespondenceDto)
  dto!: ImportCorrespondenceDto;
}

export class CommitBatchDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CommitBatchItemDto)
  items!: CommitBatchItemDto[];

  @IsString()
  @IsNotEmpty()
  batchId!: string;
}
