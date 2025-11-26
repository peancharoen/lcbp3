// File: src/modules/correspondence/dto/create-correspondence.dto.ts
import {
  IsInt,
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsObject,
} from 'class-validator';

export class CreateCorrespondenceDto {
  @IsInt()
  @IsNotEmpty()
  projectId!: number;

  @IsInt()
  @IsNotEmpty()
  typeId!: number; // ID ของประเภทเอกสาร (เช่น RFA, LETTER)

  @IsInt()
  @IsOptional()
  disciplineId?: number; // [Req 6B] สาขางาน (เช่น GEN, STR)

  @IsInt()
  @IsOptional()
  subTypeId?: number; // [Req 6B] ประเภทย่อย (เช่น MAT, SHP สำหรับ Transmittal/RFA)

  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsObject()
  @IsOptional()
  details?: Record<string, any>; // ข้อมูล JSON (เช่น RFI question)

  @IsBoolean()
  @IsOptional()
  isInternal?: boolean;

  // ✅ เพิ่ม Field สำหรับ Impersonation (เลือกองค์กรผู้ส่ง)
  @IsInt()
  @IsOptional()
  originatorId?: number;
}