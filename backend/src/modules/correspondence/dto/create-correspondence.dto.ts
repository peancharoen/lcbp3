import {
  IsInt,
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsObject,
  IsDateString,
  IsArray,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCorrespondenceDto {
  @ApiProperty({ description: 'Project ID or UUID', example: 1 })
  @IsNotEmpty()
  projectId!: number | string;

  @ApiProperty({ description: 'Document Type ID', example: 1 })
  @IsInt()
  @IsNotEmpty()
  typeId!: number; // ID ของประเภทเอกสาร (เช่น RFA, LETTER)

  @ApiPropertyOptional({ description: 'Discipline ID', example: 2 })
  @IsInt()
  @IsOptional()
  disciplineId?: number; // [Req 6B] สาขางาน (เช่น GEN, STR)

  @ApiPropertyOptional({ description: 'Sub Type ID', example: 3 })
  @IsInt()
  @IsOptional()
  subTypeId?: number; // [Req 6B] ประเภทย่อย (เช่น MAT, SHP สำหรับ Transmittal/RFA)

  @ApiProperty({
    description: 'Correspondence Subject',
    example: 'Monthly Progress Report',
  })
  @IsString()
  @IsNotEmpty()
  subject!: string;

  @ApiPropertyOptional({
    description: 'Body/Content',
    example: '<p>...</p>',
  })
  @IsString()
  @IsOptional()
  body?: string;

  @ApiPropertyOptional({
    description: 'Remarks',
    example: 'Note...',
  })
  @IsString()
  @IsOptional()
  remarks?: string;

  @ApiPropertyOptional({
    description: 'Due Date',
    example: '2025-12-06T00:00:00Z',
  })
  @IsDateString()
  @IsOptional()
  dueDate?: string;

  @ApiPropertyOptional({
    description: 'Correspondence Description',
    example: 'Detailed report...',
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({
    description: 'Additional details (JSON)',
    example: { key: 'value' },
  })
  @IsObject()
  @IsOptional()
  details?: Record<string, unknown>; // ข้อมูล JSON (เช่น RFI question)

  @ApiPropertyOptional({ description: 'Is internal document?', default: false })
  @IsBoolean()
  @IsOptional()
  isInternal?: boolean;

  @ApiPropertyOptional({
    description: 'Document Date (วันที่เอกสาร)',
    example: '2025-12-06',
  })
  @IsDateString()
  @IsOptional()
  documentDate?: string;

  @ApiPropertyOptional({
    description: 'Issued Date (วันที่ออกเอกสาร) — ใช้จัดเก็บไฟล์ตาม YYYY/MM',
    example: '2025-12-06T00:00:00Z',
  })
  @IsDateString()
  @IsOptional()
  issuedDate?: string;

  @ApiPropertyOptional({
    description: 'Received Date (วันที่รับเอกสาร)',
    example: '2025-12-06T00:00:00Z',
  })
  @IsDateString()
  @IsOptional()
  receivedDate?: string;

  @ApiPropertyOptional({
    description: 'Attachment temp IDs from upload phase (Two-Phase Storage)',
    example: ['uuid-temp-1', 'uuid-temp-2'],
  })
  @IsArray()
  @IsOptional()
  attachmentTempIds?: string[];

  // ✅ เพิ่ม Field สำหรับ Impersonation (เลือกองค์กรผู้ส่ง)
  @ApiPropertyOptional({
    description: 'Originator Organization ID or UUID (for impersonation)',
    example: 1,
  })
  @IsOptional()
  originatorId?: number | string;

  @ApiPropertyOptional({
    description: 'Recipients',
    example: [{ organizationId: 1, type: 'TO' }],
  })
  @IsArray()
  @IsOptional()
  recipients?: { organizationId: number | string; type: 'TO' | 'CC' }[];
}
