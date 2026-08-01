// File: backend/src/modules/ai/dto/sandbox-rag-prep.dto.ts
// Change Log:
// - 2026-06-14: Created SandboxRagPrepDto for Sandbox RAG Prep testing (conforming to task T007)
// - 2026-07-31: DTO hardening (Feature-237 review) — @MaxLength ป้องกัน payload overflow

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  IsUUID,
} from 'class-validator';

/**
 * จำกัดขนาดข้อความ OCR สำหรับ Sandbox RAG Prep
 * รองรับเอกสารยาวได้สูงสุด 200,000 ตัวอักษร (~100 หน้า OCR)
 */
const MAX_SANDBOX_RAG_TEXT_LENGTH = 200_000;

export class SandboxRagPrepDto {
  @ApiProperty({
    description: 'Text to prepare for RAG (OCR text)',
    maxLength: MAX_SANDBOX_RAG_TEXT_LENGTH,
  })
  @IsNotEmpty()
  @IsString()
  @MaxLength(MAX_SANDBOX_RAG_TEXT_LENGTH)
  text!: string;

  @ApiPropertyOptional({
    description: 'Execution profile public ID (UUID) to use',
  })
  @IsOptional()
  @IsUUID('7')
  profileId?: string | null;
}
