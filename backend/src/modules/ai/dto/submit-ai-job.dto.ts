// File: src/modules/ai/dto/submit-ai-job.dto.ts
// Change Log:
// - 2026-05-22: สร้าง SubmitAiJobDto สำหรับรับงานประมวลผลการย้ายเอกสารของ AI (ADR-028)

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsUUID,
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  ValidateNested,
  IsObject,
  IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * ตัวเลือกแท็กประกอบการวิเคราะห์ของ AI
 */
export class TagOptionDto {
  @ApiPropertyOptional({ description: 'UUID ของแท็กที่มีอยู่แล้วในโครงการ' })
  @IsUUID()
  @IsOptional()
  publicId?: string;

  @ApiProperty({ description: 'ชื่อแท็ก' })
  @IsString()
  @IsNotEmpty()
  tagName!: string;

  @ApiPropertyOptional({ description: 'รหัสสีของแท็ก' })
  @IsString()
  @IsOptional()
  colorCode?: string;
}

/**
 * ตัวกรองบริบท Master Data สำหรับ Migration AI โดยใช้ public UUID เท่านั้น
 */
export class MigrationContextOverrideDto {
  @ApiPropertyOptional({ description: 'UUID สาธารณะของโครงการ' })
  @IsUUID()
  @IsOptional()
  projectPublicId?: string;

  @ApiPropertyOptional({ description: 'UUID สาธารณะของสัญญา' })
  @IsUUID()
  @IsOptional()
  contractPublicId?: string;
}

/**
 * Payload ข้อมูลเอกสารเก่าสำหรับการทำ Migration
 */
export class MigrateDocumentPayloadDto {
  @ApiProperty({ description: 'UUID ของ temp attachment ในระบบ' })
  @IsUUID()
  tempAttachmentId!: string;

  @ApiProperty({ description: 'เลขที่เอกสารเก่า' })
  @IsString()
  @IsNotEmpty()
  documentNumber!: string;

  @ApiProperty({ description: 'ชื่อเรื่องเอกสาร' })
  @IsString()
  @IsNotEmpty()
  title!: string;

  @ApiProperty({
    type: [TagOptionDto],
    description: 'รายการแท็กโครงการที่มีอยู่ก่อนแล้ว',
  })
  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => TagOptionDto)
  existingTags?: TagOptionDto[];

  @ApiProperty({ type: [String], description: 'หมวดหมู่เอกสารหลักที่มีในระบบ' })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  systemCategories?: string[];

  @ApiProperty({ description: 'รหัสกลุ่มการนำเข้า (Batch ID)' })
  @IsString()
  @IsNotEmpty()
  batchId!: string;

  @ApiPropertyOptional({
    type: MigrationContextOverrideDto,
    description: 'ตัวกรอง Master Data Context ตาม ADR-030',
  })
  @IsObject()
  @ValidateNested()
  @Type(() => MigrationContextOverrideDto)
  @IsOptional()
  contextOverride?: MigrationContextOverrideDto;
}

/**
 * DTO สำหรับส่งคำขอเปิดงานประมวลผล AI (AI processing job submission)
 */
export class SubmitAiJobDto {
  @ApiProperty({
    example: 'migrate-document',
    description: 'ชนิดงานประมวลผล AI',
  })
  @IsString()
  @IsNotEmpty()
  @IsIn(['migrate-document'])
  type!: string;

  @ApiProperty({ type: MigrateDocumentPayloadDto })
  @IsObject()
  @ValidateNested()
  @Type(() => MigrateDocumentPayloadDto)
  payload!: MigrateDocumentPayloadDto;
}
