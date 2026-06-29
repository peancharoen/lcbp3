// File: backend/src/modules/ai/dto/sandbox-rag-prep.dto.ts
// Change Log:
// - 2026-06-14: Created SandboxRagPrepDto for Sandbox RAG Prep testing (conforming to task T007)

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class SandboxRagPrepDto {
  @ApiProperty({ description: 'Text to prepare for RAG (OCR text)' })
  @IsNotEmpty()
  @IsString()
  text!: string;

  @ApiPropertyOptional({ description: 'Execution profile public ID to use' })
  @IsOptional()
  @IsString()
  profileId?: string | null;
}
