// File: backend/src/modules/ai/prompts/dto/activate-prompt.dto.ts
// Change Log
// - 2026-06-18: Created ActivatePromptDto for prompt activation with validation (Feature 238 code review fix)

import { Type } from 'class-transformer';
import { IsOptional, IsInt, Min } from 'class-validator';

/**
 * Data Transfer Object สำหรับเปิดใช้งาน prompt version
 * รองรับ expectedVersion เพื่อป้องกัน race condition ในการ activate
 */
export class ActivatePromptDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'expectedVersion must be an integer' })
  @Min(1, { message: 'expectedVersion must be at least 1' })
  expectedVersion?: number;
}
