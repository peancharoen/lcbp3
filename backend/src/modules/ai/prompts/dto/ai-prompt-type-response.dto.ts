// File: backend/src/modules/ai/prompts/dto/ai-prompt-type-response.dto.ts
// Change Log:
// - 2026-09-01: Created response DTO for ai_prompt_type (Feature 251)

import { Expose, Exclude } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO สำหรับตอบกลับข้อมูล ai_prompt_type
 */
@Exclude()
export class AiPromptTypeResponseDto {
  @ApiProperty({ example: '0195...' })
  @Expose({ name: 'publicId' })
  publicId!: string;

  @ApiProperty({ example: 'ocr_extraction' })
  @Expose({ name: 'promptType' })
  promptType!: string;

  @ApiProperty({ example: 'สกัด Metadata จาก OCR' })
  @Expose({ name: 'displayName' })
  displayName!: string;

  @ApiPropertyOptional({ example: 'คำอธิบาย' })
  @Expose({ name: 'description' })
  description?: string | null;

  @ApiPropertyOptional({
    example: ['ocr_text', 'allowed_correspondence_types'],
  })
  @Expose({ name: 'expectedPlaceholders' })
  expectedPlaceholders?: string[] | null;

  @ApiProperty({ example: true })
  @Expose({ name: 'isSystemManaged' })
  isSystemManaged!: boolean;

  @ApiProperty({ example: true })
  @Expose({ name: 'isActive' })
  isActive!: boolean;
}
