// File: src/modules/ai/dto/create-ai-job.dto.ts
// Change Log
// - 2026-05-15: เพิ่ม DTO สำหรับ enqueue AI jobs ตาม ADR-023A US1.

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export const AI_JOB_TYPES = [
  'ai-suggest',
  'rag-query',
  'ocr',
  'extract-metadata',
  'embed-document',
] as const;

export type CreateAiJobType = (typeof AI_JOB_TYPES)[number];

/** DTO สำหรับส่งงาน AI เข้า BullMQ โดยใช้ publicId เท่านั้นตาม ADR-019 */
export class CreateAiJobDto {
  @ApiProperty({ description: 'Attachment/document publicId สำหรับงาน AI' })
  @IsUUID()
  documentPublicId!: string;

  @ApiProperty({ description: 'Project publicId สำหรับ project isolation' })
  @IsUUID()
  projectPublicId!: string;

  @ApiProperty({
    enum: AI_JOB_TYPES,
    description: 'ชนิดงาน AI ที่ต้อง enqueue',
  })
  @IsIn(AI_JOB_TYPES)
  jobType!: CreateAiJobType;

  @ApiProperty({ description: 'Idempotency key จาก request header/body' })
  @IsString()
  @IsNotEmpty()
  idempotencyKey!: string;

  @ApiPropertyOptional({
    description: 'Payload เพิ่มเติม เช่น pdfPath, extractedText, question',
  })
  @IsOptional()
  @IsObject()
  payload?: Record<string, unknown>;
}
