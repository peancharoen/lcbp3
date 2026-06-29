// File: src/modules/ai/intent-classifier/dto/update-intent-definition.dto.ts
// Change Log
// - 2026-05-19: สร้าง DTO สำหรับ update Intent Definition (ADR-024).

import { IsString, IsBoolean, IsOptional, MaxLength } from 'class-validator';

/**
 * DTO สำหรับ update Intent Definition
 * ใช้กับ PATCH /admin/ai/intent-definitions/:intentCode
 */
export class UpdateIntentDefinitionDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  descriptionTh?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  descriptionEn?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
