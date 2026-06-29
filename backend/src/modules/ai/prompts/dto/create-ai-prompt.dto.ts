// File: backend/src/modules/ai/prompts/dto/create-ai-prompt.dto.ts
// Change Log
// - 2026-05-25: Created CreateAiPromptDto for prompt version creation (ADR-029)
// - 2026-05-25: Added definite assignment assertion operator (!) to satisfy strictPropertyInitialization

import {
  IsNotEmpty,
  IsOptional,
  IsObject,
  IsString,
  MaxLength,
} from 'class-validator';

/**
 * Data Transfer Object สำหรับการสร้าง prompt version ใหม่
 */
export class CreateAiPromptDto {
  @IsString()
  @IsNotEmpty({ message: 'Template text must not be empty' })
  @MaxLength(4000, { message: 'Template exceeds 4,000 character limit' })
  template!: string;

  @IsOptional()
  @IsObject({ message: 'contextConfig must be a valid JSON object' })
  contextConfig?: Record<string, unknown>;
}
