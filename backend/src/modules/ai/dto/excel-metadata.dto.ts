// File: backend/src/modules/ai/dto/excel-metadata.dto.ts
// Change Log:
// - 2026-08-06: Initial creation — register row sent by n8n (Feature 242, FR-006, R1)

import { IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * ข้อมูลแถวทะเบียนเอกสารจาก Excel ที่ n8n ส่งมาใน migrate-document job payload (FR-006)
 * ใช้เป็น {{excel_metadata}} placeholder ใน migration_compare prompt
 */
export class ExcelMetadataDto {
  @ApiProperty({ description: 'เลขที่เอกสาร (required)' })
  @IsString()
  @IsNotEmpty()
  documentNumber!: string;

  @ApiPropertyOptional({ description: 'ชื่อเรื่องเอกสาร' })
  @IsString()
  @IsOptional()
  subject?: string;

  @ApiPropertyOptional({ description: 'วันที่เอกสาร' })
  @IsString()
  @IsOptional()
  documentDate?: string;

  @ApiPropertyOptional({ description: 'หน่วยงานผู้ส่ง (ชื่อหรือรหัส)' })
  @IsString()
  @IsOptional()
  fromOrganization?: string;

  @ApiPropertyOptional({ description: 'หน่วยงานผู้รับ (ชื่อหรือรหัส)' })
  @IsString()
  @IsOptional()
  toOrganization?: string;

  @ApiPropertyOptional({ description: 'ประเภทเอกสาร (RFA, Transmittal, ฯลฯ)' })
  @IsString()
  @IsOptional()
  correspondenceType?: string;

  @ApiPropertyOptional({ description: 'สาขางาน' })
  @IsString()
  @IsOptional()
  discipline?: string;

  @ApiPropertyOptional({ description: 'ชื่อโครงการ' })
  @IsString()
  @IsOptional()
  project?: string;

  @ApiPropertyOptional({ description: 'ฉบับแก้ไข' })
  @IsString()
  @IsOptional()
  revision?: string;
}
