// File: backend/src/common/dto/bulk-export.dto.ts
// บันทึกการแก้ไข: DTO สำหรับ Bulk Export (Feature 253)

import {
  IsArray,
  ArrayMaxSize,
  IsUUID,
  IsString,
  IsIn,
  IsOptional,
  IsEnum,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * รูปแบบไฟล์ส่งออก
 */
export enum ExportFormat {
  CSV = 'CSV',
  XLSX = 'XLSX',
  JSON = 'JSON',
}

/**
 * DTO สำหรับ Bulk Export Request
 * ส่งออก metadata เอกสารหลายประเภทพร้อมกัน (max 100 รายการ)
 */
export class BulkExportRequestDto {
  @ApiProperty({
    description: 'รายการ publicId ของเอกสารที่ต้องการส่งออก',
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
    description: 'รูปแบบไฟล์ส่งออก',
    enum: ExportFormat,
    default: ExportFormat.CSV,
  })
  @IsEnum(ExportFormat)
  format!: ExportFormat;

  @ApiPropertyOptional({
    description: 'columns ที่ต้องการส่งออก (ถ้าไม่ระบุใช้ default)',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  columns?: string[];
}
