// File: src/modules/ai/dto/migration-query.dto.ts
// DTO สำหรับ Query Parameters ของ GET /api/ai/migration

import { IsOptional, IsEnum, IsNumber, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { MigrationLogStatus } from '../entities/migration-log.entity';

export class MigrationQueryDto {
  // กรองตามสถานะ
  @ApiPropertyOptional({ enum: MigrationLogStatus })
  @IsOptional()
  @IsEnum(MigrationLogStatus)
  status?: MigrationLogStatus;

  // กรองตาม Confidence Score ขั้นต่ำ
  @ApiPropertyOptional({ minimum: 0, maximum: 1 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  @Type(() => Number)
  minConfidence?: number;

  // หน้าที่ต้องการ (เริ่มที่ 1)
  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  page?: number = 1;

  // จำนวนรายการต่อหน้า (สูงสุด 100)
  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 10 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit?: number = 10;
}
