// File: backend/src/modules/migration/dto/commit-migration-review.dto.ts
// Change Log:
// - 2026-05-22: Initial creation for ADR-028 Migration Review Commit (US2)
// - 2026-05-22: Update to support hybrid ID (number | string) for projects and organizations per ADR-019
// - 2026-08-06: เพิ่ม fieldResolutions สำหรับ per-field source selection (Feature 242, FR-011, FR-011b)

import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  ValidateNested,
  IsIn,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

/**
 * การตัดสินใจของผู้ตรวจสอบรายช่อง (FR-011, FR-011b)
 * source: EXCEL (ทะเบียน), DOCUMENT (เอกสารจริง), MANUAL (พิมพ์เอง)
 */
export class FieldResolutionDto {
  @ApiProperty({ description: 'ชื่อช่อง' })
  @IsString()
  @IsNotEmpty()
  field!: string;

  @ApiProperty({
    description: 'แหล่งที่มาของค่าที่เลือก',
    enum: ['EXCEL', 'DOCUMENT', 'MANUAL'],
  })
  @IsIn(['EXCEL', 'DOCUMENT', 'MANUAL'])
  source!: 'EXCEL' | 'DOCUMENT' | 'MANUAL';

  @ApiProperty({ description: 'ค่าที่ใช้จริง' })
  @IsString()
  finalValue!: string;
}

export class CommitMigrationReviewDto {
  @ApiProperty({
    description: 'UUID ของรายการใน Staging Migration Review Queue',
  })
  @IsString()
  @IsNotEmpty()
  publicId!: string;

  @ApiProperty({ description: 'ชื่อเรื่อง (แก้ไขได้)', required: false })
  @IsString()
  @IsOptional()
  subject?: string;

  @ApiProperty({ description: 'หมวดหมู่เอกสาร (แก้ไขได้)', required: false })
  @IsString()
  @IsOptional()
  category?: string;

  @ApiProperty({
    description: 'ID หรือ UUID ของ Project (แก้ไขได้)',
    required: false,
  })
  @IsOptional()
  projectId?: number | string;

  @ApiProperty({
    description: 'ID หรือ UUID ขององค์กรผู้ส่ง (แก้ไขได้)',
    required: false,
  })
  @IsOptional()
  senderId?: number | string;

  @ApiProperty({
    description: 'ID หรือ UUID ขององค์กรผู้รับ (แก้ไขได้)',
    required: false,
  })
  @IsOptional()
  receiverId?: number | string;

  @ApiProperty({ description: 'วันที่ออกเอกสาร (แก้ไขได้)', required: false })
  @IsString()
  @IsOptional()
  issuedDate?: string;

  @ApiProperty({ description: 'วันที่รับเอกสาร (แก้ไขได้)', required: false })
  @IsString()
  @IsOptional()
  receivedDate?: string;

  @ApiProperty({
    description: 'รายการแท็กภาษาไทย (แก้ไขได้)',
    required: false,
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];

  @ApiProperty({ description: 'เนื้อหาจดหมาย (แก้ไขได้)', required: false })
  @IsString()
  @IsOptional()
  body?: string;

  @ApiPropertyOptional({
    description:
      'การตัดสินใจรายช่องของผู้ตรวจสอบ (FR-011, FR-011b) — ว่าง = ใช้ค่าทะเบียนทั้งหมด',
    type: [FieldResolutionDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FieldResolutionDto)
  @IsOptional()
  fieldResolutions?: FieldResolutionDto[];
}
