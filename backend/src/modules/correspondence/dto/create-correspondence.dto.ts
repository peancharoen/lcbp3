import {
  IsInt,
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsObject,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCorrespondenceDto {
  @ApiProperty({ description: 'Project ID', example: 1 })
  @IsInt()
  @IsNotEmpty()
  projectId!: number;

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
    description: 'Correspondence Title',
    example: 'Monthly Progress Report',
  })
  @IsString()
  @IsNotEmpty()
  title!: string;

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
  details?: Record<string, any>; // ข้อมูล JSON (เช่น RFI question)

  @ApiPropertyOptional({ description: 'Is internal document?', default: false })
  @IsBoolean()
  @IsOptional()
  isInternal?: boolean;

  // ✅ เพิ่ม Field สำหรับ Impersonation (เลือกองค์กรผู้ส่ง)
  @ApiPropertyOptional({
    description: 'Originator Organization ID (for impersonation)',
    example: 1,
  })
  @IsInt()
  @IsOptional()
  originatorId?: number;
}
