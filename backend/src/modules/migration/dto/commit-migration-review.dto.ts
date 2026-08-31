// File: backend/src/modules/migration/dto/commit-migration-review.dto.ts
// Change Log:
// - 2026-05-22: Initial creation for ADR-028 Migration Review Commit (US2)
// - 2026-05-22: Update to support hybrid ID (number | string) for projects and organizations per ADR-019
// - 2026-08-06: เพิ่ม fieldResolutions สำหรับ per-field source selection (Feature 242, FR-011, FR-011b)
// - 2026-08-31: ADR-050 T015 — BREAKING CHANGE: แทนที่ `tags: string[]` ด้วย `tagDecisions[]`
//   (accept/reject ต่อ tag พร้อม evidence, data-model.md §6) และเพิ่ม `fieldAcknowledgments`
//   สำหรับรับทราบ field ที่ confidence ต่ำโดยไม่แก้ไขค่า (FR-013/FR-014)

import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  IsBoolean,
  ValidateNested,
  IsIn,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

/** field ที่รองรับการรับทราบ (acknowledge) ความมั่นใจต่ำโดยไม่แก้ไขค่า (ADR-050 §4/data-model.md §4) */
export const ACKNOWLEDGEABLE_FIELDS = [
  'ocrQuality',
  'summary',
  'category',
  'tags',
] as const;
export type AcknowledgeableField = (typeof ACKNOWLEDGEABLE_FIELDS)[number];

/**
 * การตัดสินใจ accept/reject ของผู้ตรวจสอบต่อ tag ที่ AI เสนอ (ADR-050 §4, FR-006/FR-007/FR-008)
 * แทนที่ `tags: string[]` เดิม — breaking change ตามที่ ADR-050 กำหนด
 */
export class TagDecisionDto {
  @ApiProperty({
    description: 'ชื่อ tag ตามที่ AI เสนอ (หรือ tag ใหม่ที่ผู้ตรวจสอบยืนยัน)',
  })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({
    description:
      'true = ยอมรับ tag นี้ (นำไปผูกกับเอกสาร), false = ปฏิเสธ (บันทึก audit trail)',
  })
  @IsBoolean()
  accepted!: boolean;

  @ApiPropertyOptional({
    description:
      'excerpt จาก OCR text ที่สนับสนุนการเสนอ tag นี้ — ส่งมาด้วยแม้ accepted=false เพื่อเก็บ audit',
  })
  @IsString()
  @IsOptional()
  evidence?: string;
}

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

  @ApiPropertyOptional({
    description:
      'การตัดสินใจ accept/reject รายตัวต่อ tag ที่ AI เสนอ (ADR-050 §4, data-model.md §6) — ' +
      'แทนที่ `tags: string[]` เดิม (BREAKING CHANGE) ว่าง/ไม่ส่ง = ใช้ extractedTags เดิมทั้งหมด (backward-compat fallback สำหรับ item ที่ไม่มี tag suggestion ใหม่)',
    type: [TagDecisionDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TagDecisionDto)
  @IsOptional()
  tagDecisions?: TagDecisionDto[];

  @ApiPropertyOptional({
    description:
      'field ที่ผู้ตรวจสอบรับทราบว่า confidence ต่ำกว่าเกณฑ์แล้ว "ยืนยันดำเนินการต่อ" โดยไม่ได้แก้ไขค่า ' +
      '(ADR-050 §4/data-model.md §4, FR-013/FR-014) — field ที่ผู้ตรวจสอบแก้ไขค่าจริง (category/summary ต่างจาก AI suggestion, ' +
      'หรือส่ง tagDecisions มา) ถือว่า "edited" โดยอัตโนมัติ ไม่ต้องระบุในนี้',
    enum: ACKNOWLEDGEABLE_FIELDS,
    isArray: true,
  })
  @IsArray()
  @IsIn(ACKNOWLEDGEABLE_FIELDS, { each: true })
  @IsOptional()
  fieldAcknowledgments?: AcknowledgeableField[];

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
