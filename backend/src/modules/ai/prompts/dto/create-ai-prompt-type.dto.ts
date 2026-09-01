// File: backend/src/modules/ai/prompts/dto/create-ai-prompt-type.dto.ts
// Change Log:
// - 2026-09-01: Created DTO for creating ai_prompt_type (Feature 251)

import {
  IsString,
  MaxLength,
  IsOptional,
  IsArray,
  IsNotEmpty,
  Matches,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO สำหรับสร้าง ai_prompt_type ใหม่
 */
export class CreateAiPromptTypeDto {
  @ApiProperty({ example: 'ocr_extraction' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(50)
  @Matches(/^[a-z][a-z0-9_]*$/, {
    message:
      'prompt_type ต้องเป็น snake_case ตัวพิมพ์เล็ก และขึ้นต้นด้วยตัวอักษร',
  })
  promptType!: string;

  @ApiProperty({ example: 'สกัด Metadata จาก OCR' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(255)
  displayName!: string;

  @ApiPropertyOptional({ example: 'คำอธิบายประเภท prompt' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    example: ['ocr_text', 'allowed_correspondence_types'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  expectedPlaceholders?: string[];
}
