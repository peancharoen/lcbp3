// File: backend/src/common/dto/bulk-tag.dto.ts
// บันทึกการแก้ไข: DTO สำหรับ Bulk Tag (Feature 253)
// - 2026-09-07: Change addTags/removeTags to number[] (tag IDs are integer FKs, not UUIDs) (Code Review L1)

import {
  IsArray,
  ArrayMaxSize,
  IsUUID,
  IsString,
  IsIn,
  IsOptional,
  IsInt,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

/**
 * DTO สำหรับ Bulk Tag Request
 * เพิ่ม/ลบแท็กเอกสารหลายประเภทพร้อมกัน (max 100 รายการ)
 * addTags/removeTags เป็น tag IDs (integer FKs ใน tags table)
 */
export class BulkTagRequestDto {
  @ApiProperty({
    description: 'รายการ publicId ของเอกสารที่ต้องการแก้ไขแท็ก',
    type: [String],
    example: ['019505a1-7c3e-7000-8000-abc123def456'],
  })
  @IsArray()
  @ArrayMaxSize(100)
  @IsUUID('7', { each: true })
  publicIds!: string[];

  @ApiProperty({
    description: 'ประเภทเอกสาร',
    enum: ['CORRESPONDENCE', 'RFA', 'TRANSMITTAL', 'DRAWING', 'CIRCULATION'],
  })
  @IsString()
  @IsIn(['CORRESPONDENCE', 'RFA', 'TRANSMITTAL', 'DRAWING', 'CIRCULATION'])
  documentType!: string;

  @ApiProperty({
    description: 'แท็ก IDs ที่ต้องการเพิ่ม (integer FKs)',
    type: [Number],
    example: [1, 2, 3],
  })
  @IsArray()
  @ArrayMaxSize(50)
  @IsInt({ each: true })
  @Type(() => Number)
  addTags!: number[];

  @ApiPropertyOptional({
    description: 'แท็ก IDs ที่ต้องการลบ (integer FKs)',
    type: [Number],
    example: [4],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsInt({ each: true })
  @Type(() => Number)
  removeTags?: number[];

  @ApiPropertyOptional({ description: 'เหตุผลการแก้ไขแท็ก' })
  @IsOptional()
  @IsString()
  reason?: string;
}
