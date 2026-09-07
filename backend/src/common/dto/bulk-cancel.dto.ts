// File: backend/src/common/dto/bulk-cancel.dto.ts
// บันทึกการแก้ไข: DTO สำหรับ Bulk Cancel (Feature 253)

import {
  IsArray,
  ArrayMaxSize,
  IsUUID,
  IsString,
  IsIn,
  IsOptional,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO สำหรับ Bulk Cancel Request
 * ยกเลิกเอกสารหลายประเภทพร้อมกัน (max 100 รายการ)
 */
export class BulkCancelRequestDto {
  @ApiProperty({
    description: 'รายการ publicId ของเอกสารที่ต้องการยกเลิก',
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

  @ApiPropertyOptional({ description: 'เหตุผลการยกเลิก' })
  @IsOptional()
  @IsString()
  reason?: string;
}
