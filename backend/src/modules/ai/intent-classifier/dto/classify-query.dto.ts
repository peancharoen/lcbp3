// File: src/modules/ai/intent-classifier/dto/classify-query.dto.ts
// Change Log
// - 2026-05-19: สร้าง DTO สำหรับ Classify Query (ADR-024).

import { IsString, IsOptional, MaxLength, IsUUID } from 'class-validator';

/**
 * DTO สำหรับ classify intent จาก user query
 * ใช้กับ POST /ai/intent/classify
 */
export class ClassifyQueryDto {
  /** คำถามจาก user (trim แล้ว, max 200 chars) */
  @IsString()
  @MaxLength(200)
  query!: string;

  /** Context project UUID (optional) */
  @IsOptional()
  @IsUUID()
  projectPublicId?: string;

  /** Context user UUID (optional) */
  @IsOptional()
  @IsUUID()
  userPublicId?: string;

  /** Document ที่เปิดอยู่ UUID (optional) */
  @IsOptional()
  @IsUUID()
  currentDocumentId?: string;
}
