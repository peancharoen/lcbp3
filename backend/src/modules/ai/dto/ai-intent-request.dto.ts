// File: src/modules/ai/dto/ai-intent-request.dto.ts
// Change Log
// - 2026-05-19: สร้าง DTO สำหรับ POST /ai/intent endpoint (ADR-025).

import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Request body สำหรับ POST /ai/intent
 * ส่ง intent code + project context ไปยัง AiToolRegistryService
 */
export class AiIntentRequestDto {
  @ApiProperty({
    description:
      'Intent code เช่น GET_RFA, GET_DRAWING, GET_TRANSMITTAL (ADR-025)',
    example: 'GET_RFA',
  })
  @IsNotEmpty()
  @IsString()
  intent!: string;

  @ApiProperty({
    description: 'UUID ของ Project (ADR-019) — จำเป็นสำหรับ CASL scope',
    example: '0195a1b2-c3d4-7000-8000-abc123def456',
  })
  @IsNotEmpty()
  @IsUUID()
  projectPublicId!: string;

  @ApiPropertyOptional({
    description: 'Parameters เพิ่มเติม เช่น { statusCode: "DFT" }',
    example: { statusCode: 'FAP' },
  })
  @IsOptional()
  params?: Record<string, unknown>;
}
