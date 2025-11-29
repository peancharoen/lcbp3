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
} from 'class-validator';

export class CreateRfaDto {
  @ApiProperty({ description: 'ID ของโครงการ', example: 1 })
  @IsInt()
  @IsNotEmpty()
  projectId!: number;

  @ApiProperty({ description: 'ID ของประเภท RFA', example: 1 })
  @IsInt()
  @IsNotEmpty()
  rfaTypeId!: number;

  @ApiProperty({
    description: 'ID ของสาขางาน (Discipline) ตาม Req 6B',
    example: 1,
  })
  @IsInt()
  @IsOptional() // Optional ไว้ก่อนเผื่อบางโครงการไม่บังคับ
  disciplineId?: number;

  @ApiProperty({
    description: 'หัวข้อเอกสาร',
    example: 'Submission of Shop Drawing for Building A',
  })
  @IsString()
  @IsNotEmpty()
  title!: string;

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
  details?: Record<string, any>;

  @ApiProperty({
    description: 'รายการ Shop Drawing Revisions ที่แนบมาด้วย',
    required: false,
    type: [Number],
  })
  @IsArray()
  @IsOptional()
  shopDrawingRevisionIds?: number[];
}
