// File: src/modules/migration/dto/commit-migration-review.dto.ts
// Change Log:
// - 2026-05-22: Initial creation for ADR-028 Migration Review Commit (US2)
// - 2026-05-22: Update to support hybrid ID (number | string) for projects and organizations per ADR-019

import { IsString, IsNotEmpty, IsOptional, IsArray } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

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
}
