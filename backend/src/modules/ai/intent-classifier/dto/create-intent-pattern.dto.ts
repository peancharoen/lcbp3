// File: src/modules/ai/intent-classifier/dto/create-intent-pattern.dto.ts
// Change Log
// - 2026-05-19: สร้าง DTO สำหรับสร้าง Intent Pattern (ADR-024).

import {
  IsString,
  IsEnum,
  IsInt,
  IsOptional,
  MaxLength,
  Min,
  Max,
} from 'class-validator';
import {
  PatternType,
  PatternLanguage,
} from '../interfaces/intent-category.enum';

/**
 * DTO สำหรับสร้าง Intent Pattern
 * ใช้กับ POST /admin/ai/intent-definitions/:intentCode/patterns
 */
export class CreateIntentPatternDto {
  /** ภาษาที่ Pattern รองรับ */
  @IsOptional()
  @IsEnum(PatternLanguage)
  language?: PatternLanguage;

  /** ชนิด Pattern */
  @IsEnum(PatternType)
  patternType!: PatternType;

  /** ค่า Pattern (keyword หรือ regex string) */
  @IsString()
  @MaxLength(255)
  patternValue!: string;

  /** ลำดับความสำคัญ (ต่ำ = สำคัญกว่า) */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(9999)
  priority?: number;
}
