// File: src/modules/ai/dto/extract-document.dto.ts
// DTO สำหรับ Real-time AI Extraction endpoint (/api/ai/extract)

import { IsUUID, IsEnum, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// บริบทการใช้งาน AI Extraction
export type ExtractionContext = 'migration' | 'ingestion';

export class ExtractDocumentDto {
  // UUID ของไฟล์ที่ต้องการ Extract (ADR-019: ใช้ publicId เท่านั้น)
  @ApiProperty({ description: 'UUID ของไฟล์ที่ต้องการให้ AI สกัด Metadata' })
  @IsUUID()
  publicId!: string;

  // บริบทการใช้งาน: migration=นำเข้าเอกสารเก่า, ingestion=อัปโหลดเอกสารใหม่
  @ApiProperty({
    enum: ['migration', 'ingestion'],
    description: 'บริบทการใช้งาน AI',
  })
  @IsEnum(['migration', 'ingestion'])
  context!: ExtractionContext;

  // ประเภทไฟล์ (optional — ใช้เพื่อ optimization)
  @ApiPropertyOptional({
    enum: ['pdf', 'docx', 'xlsx'],
    description: 'ประเภทไฟล์ (optional)',
  })
  @IsOptional()
  @IsString()
  @IsEnum(['pdf', 'docx', 'xlsx'])
  fileType?: string;
}
