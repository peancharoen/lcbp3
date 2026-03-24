// File: src/modules/rfa/dto/create-rfa.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateRfaDto {
  @ApiProperty({ description: 'ID or UUID ของโครงการ', example: 1 })
  @IsNotEmpty()
  projectId!: number | string;

  @ApiProperty({ description: 'Contract ID or UUID', required: false })
  @IsString()
  @IsOptional()
  contractId?: string;

  @ApiProperty({ description: 'To Organization ID or UUID' })
  @IsNotEmpty()
  toOrganizationId!: number | string;

  @ApiProperty({ description: 'ID ของประเภท RFA', example: 1 })
  @IsInt()
  @IsNotEmpty()
  rfaTypeId!: number;

  @ApiProperty({
    description:
      'ID ของสาขางาน (Discipline) ตาม Req 6B — Required per spec §3.3.4',
    example: 1,
  })
  @IsInt()
  @Min(1)
  @IsNotEmpty()
  disciplineId!: number;

  @ApiProperty({
    description: 'หัวข้อเอกสาร',
    example: 'Submission of Shop Drawing for Building A',
  })
  @IsString()
  @IsNotEmpty()
  subject!: string;

  @ApiProperty({ description: 'Body', required: false })
  @IsString()
  @IsOptional()
  body?: string;

  @ApiProperty({ description: 'Remarks', required: false })
  @IsString()
  @IsOptional()
  remarks?: string;

  @ApiProperty({ description: 'Due Date', required: false })
  @IsDateString()
  @IsOptional()
  dueDate?: string;

  @ApiProperty({ description: 'รายละเอียดเพิ่มเติม', required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ description: 'วันที่ในเอกสาร', required: false })
  @IsDateString()
  @IsOptional()
  documentDate?: string;

  @ApiProperty({
    description: 'ข้อมูล Dynamic Details (JSON)',
    required: false,
  })
  @IsObject()
  @IsOptional()
  details?: Record<string, unknown>;

  @ApiProperty({
    description: 'รายการ Shop Drawing Revision IDs หรือ UUIDs ที่แนบมาด้วย',
    required: false,
    type: [String],
  })
  @IsArray()
  @IsOptional()
  shopDrawingRevisionIds?: Array<number | string>;

  @ApiProperty({
    description: 'รายการ As-Built Drawing Revision IDs หรือ UUIDs ที่แนบมาด้วย',
    required: false,
    type: [String],
  })
  @IsArray()
  @IsOptional()
  asBuiltDrawingRevisionIds?: Array<number | string>;
}
