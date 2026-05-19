// File: src/modules/ai/intent-classifier/dto/create-intent-definition.dto.ts
// Change Log
// - 2026-05-19: สร้าง DTO สำหรับสร้าง Intent Definition (ADR-024).

import { IsString, IsEnum, MaxLength, Matches } from 'class-validator';
import { IntentCategory } from '../interfaces/intent-category.enum';

/**
 * DTO สำหรับสร้าง Intent Definition
 * ใช้กับ POST /admin/ai/intent-definitions
 */
export class CreateIntentDefinitionDto {
  /** Intent code — UPPERCASE_SNAKE_CASE เท่านั้น */
  @IsString()
  @MaxLength(50)
  @Matches(/^[A-Z][A-Z0-9_]*$/, {
    message: 'intentCode must be UPPERCASE_SNAKE_CASE (e.g. GET_RFA)',
  })
  intentCode!: string;

  /** คำอธิบายภาษาไทย */
  @IsString()
  @MaxLength(255)
  descriptionTh!: string;

  /** คำอธิบายภาษาอังกฤษ */
  @IsString()
  @MaxLength(255)
  descriptionEn!: string;

  /** หมวดหมู่ */
  @IsEnum(IntentCategory)
  category!: IntentCategory;
}
